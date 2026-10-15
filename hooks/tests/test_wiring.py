"""Wiring tests: bind hooks.json to the scripts it names and to the plugin-prefixed agent_type the whole
guardrail layer depends on. The other hooks/tests files exercise each script in isolation with a synthetic
payload; nothing there proves hooks.json itself is correct, nor that a plugin agent's agent_type must arrive
as `shipyard:<name>` for any hook to engage. These tests close that seam.

They cannot prove what the live runtime actually sends as agent_type — only a real session can (see the manual
smoke test in docs/troubleshooting.md). What they can do: fail loudly if hooks.json drifts from the scripts, if
a matcher stops compiling or stops anchoring, or if the fail-open-for-unprefixed assumption silently changes.
"""

import json
import os
import re
import unittest

import helpers

HOOKS_JSON = os.path.join(helpers.PLUGIN_ROOT, "hooks", "hooks.json")
SCRIPTS_DIR = helpers.SCRIPTS
SCRIPT_RX = re.compile(r"hooks/scripts/([A-Za-z0-9_-]+\.py)")
REVIEWERS = ["code", "security", "contract", "integration", "reliability", "simplicity"]

# Every event this plugin wires must be a real Claude Code hook event.
KNOWN_EVENTS = {
    "PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop", "UserPromptSubmit",
    "Stop", "SessionStart", "SessionEnd", "Notification", "PreCompact",
}


def load():
    with open(HOOKS_JSON, encoding="utf-8") as fh:
        return json.load(fh)


def entries(cfg):
    for event, groups in cfg["hooks"].items():
        for g in groups:
            yield event, g


def scripts_in(group):
    out = []
    for h in group.get("hooks", []):
        m = SCRIPT_RX.search(h.get("command", ""))
        if m:
            out.append(m.group(1))
    return out


class Structure(unittest.TestCase):
    def setUp(self):
        self.cfg = load()

    def test_top_level_shape(self):
        self.assertIsInstance(self.cfg.get("hooks"), dict)

    def test_events_are_real(self):
        for event in self.cfg["hooks"]:
            self.assertIn(event, KNOWN_EVENTS, "unknown hook event %r in hooks.json" % event)

    def test_matchers_compile(self):
        for event, g in entries(self.cfg):
            self.assertIn("matcher", g, "a %s group has no matcher" % event)
            try:
                re.compile(g["matcher"])
            except re.error as exc:
                self.fail("matcher %r (%s) is not a valid regex: %s" % (g["matcher"], event, exc))

    def test_commands_resolve_and_use_plugin_root(self):
        for event, g in entries(self.cfg):
            for h in g["hooks"]:
                self.assertEqual(h.get("type"), "command", "every hook must be a command hook")
                self.assertIn("${CLAUDE_PLUGIN_ROOT}", h["command"],
                              "use ${CLAUDE_PLUGIN_ROOT} so the path resolves once installed: %r" % h["command"])
                m = SCRIPT_RX.search(h["command"])
                self.assertTrue(m, "command names no hooks/scripts script: %r" % h["command"])
                self.assertTrue(os.path.isfile(os.path.join(SCRIPTS_DIR, m.group(1))),
                                "hooks.json references missing script %s" % m.group(1))

    def test_no_orphan_scripts(self):
        """Every hook script on disk is wired into hooks.json (mirrors check.py's registry completeness)."""
        referenced = {s for _e, g in entries(self.cfg) for s in scripts_in(g)}
        on_disk = {n for n in os.listdir(SCRIPTS_DIR)
                   if n.endswith(".py") and n != "shipyard_hooklib.py"}
        orphans = on_disk - referenced
        self.assertFalse(orphans, "hook scripts not wired into hooks.json: %s" % ", ".join(sorted(orphans)))


class ReviewerMatcher(unittest.TestCase):
    """The SubagentStart/Stop matchers filter on agent type, which for a plugin agent is the plugin-prefixed
    name. They must match each reviewer and nothing else (anchored)."""

    def setUp(self):
        cfg = load()
        self.matchers = [g["matcher"] for e, g in entries(cfg) if e in ("SubagentStart", "SubagentStop")]
        self.assertTrue(self.matchers, "expected SubagentStart/Stop matchers")

    def test_matches_every_reviewer(self):
        for pat in self.matchers:
            rx = re.compile(pat)
            for name in REVIEWERS:
                self.assertTrue(rx.search("shipyard:%s-reviewer" % name),
                                "%r should match shipyard:%s-reviewer" % (pat, name))

    def test_rejects_coordinator_suffixed_and_other_plugins(self):
        for pat in self.matchers:
            rx = re.compile(pat)
            self.assertIsNone(rx.search("shipyard:coordinator"))
            self.assertIsNone(rx.search("shipyard:code-reviewer-extra"), "matcher must be anchored")
            self.assertIsNone(rx.search("other:code-reviewer"))


class AgentTypeSeam(unittest.TestCase):
    """The guardrails engage only when agent_type arrives plugin-prefixed ('shipyard:...'). This binds
    hooks.json's PreToolUse/Bash wiring to protect-branches.py and pins the prefix dependency: prefixed engages,
    unprefixed fails open (so normal sessions are untouched). If the runtime ever stopped prefixing, the first
    assertion here would still pass (it runs the script directly) — but the manual smoke test in
    docs/troubleshooting.md is what catches a real runtime change. These tests catch wiring drift."""

    @classmethod
    def setUpClass(cls):
        cls.repo = helpers.Repo()
        cls.cfg = load()

    @classmethod
    def tearDownClass(cls):
        cls.repo.cleanup()

    def setUp(self):
        self.repo.reset()

    def _bash_pretooluse_scripts(self):
        out = []
        for event, g in entries(self.cfg):
            if event == "PreToolUse" and re.search(g["matcher"], "Bash"):
                out += scripts_in(g)
        return out

    def test_protect_branches_wired_for_bash(self):
        self.assertIn("protect-branches.py", self._bash_pretooluse_scripts(),
                      "hooks.json must route PreToolUse/Bash through protect-branches.py")

    def _push(self, agent_type):
        payload = {"session_id": "s", "cwd": self.repo.path, "hook_event_name": "PreToolUse",
                   "tool_name": "Bash", "tool_input": {"command": "git push origin feature/x"},
                   "agent_type": agent_type, "agent_id": "a1"}
        return helpers.run_hook("protect-branches.py", payload, self.repo.path)

    def test_prefixed_agent_type_engages_guardrail(self):
        res = self._push("shipyard:coordinator")
        self.assertEqual(res.returncode, 2, "a shipyard: agent push must be blocked; got: %s" % res.stderr)

    def test_unprefixed_agent_type_fails_open(self):
        res = self._push("coordinator")
        self.assertEqual(res.returncode, 0,
                         "unprefixed agent_type must fail open so normal sessions are untouched. If this "
                         "changes, the whole guardrail layer's prefix assumption needs re-verifying.")


if __name__ == "__main__":
    unittest.main()
