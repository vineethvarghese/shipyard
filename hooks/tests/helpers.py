"""Test helpers: a throwaway git repo with Shipyard state, and a runner that feeds hook JSON on stdin."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_ROOT = os.path.dirname(os.path.dirname(HERE))
SCRIPTS = os.path.join(PLUGIN_ROOT, "hooks", "scripts")

FEATURE = "feature/x"
SLICE = "feature/x-slice-01"

SLICE_MD = """# Slice 01 — cache layer

## Objective
Add a read-through cache.

## Expected touch set — code
- src/cache/**
- `src/config/cache.ts`

## Expected touch set — tests
- tests/cache/**
- src/cache/**/*.test.ts

## Branch
feature/x-slice-01
"""

SLICE_MD_HYPHEN = """# Slice 01

## Expected touch set - code
- lib/**

## Expected touch set - tests
- spec/**
"""

BANNER = "> \U0001F916 AGENT FILE. Written by a Shipyard agent; humans read the *.HUMAN.md files."


def test_plan(status="DRAFT"):
    return "%s\nStatus: %s\n\n## AC → planned tests\n| AC | Test |\n|---|---|\n| AC1 | tests/cache/a.test.ts |\n" % (
        BANNER, status)


def default_state(**overrides):
    state = {
        "schemaVersion": "1.0",
        "project": "demo",
        "status": "IMPLEMENTING",
        "featureBranch": FEATURE,
        "baseBranch": "main",
        "protectedBranches": ["main", "master", "release/*"],
        "activeSlice": "01",
        "sliceBranch": SLICE,
        "notesBranch": "feature/x-shipyard",
        "brainstormBreadth": 1,
    }
    state.update(overrides)
    return state


def _git(repo, *args):
    return subprocess.run(["git", "-c", "commit.gpgsign=false"] + list(args), cwd=repo, check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True).stdout.strip()


class Repo(object):
    """main + feature/x + feature/x-slice-01 (checked out), origin/HEAD -> origin/develop."""

    def __init__(self):
        self.path = os.path.realpath(tempfile.mkdtemp(prefix="shipyard-hooks-"))
        g = self.git
        g("init", "-q")
        g("symbolic-ref", "HEAD", "refs/heads/main")
        g("config", "user.email", "test@example.com")
        g("config", "user.name", "Test")
        self.write("README.md", "demo\n")
        g("add", "README.md")
        g("commit", "-q", "-m", "init")
        g("branch", "develop")
        g("branch", "release/1")
        g("branch", FEATURE)
        g("branch", "feature/x-shipyard")
        g("update-ref", "refs/remotes/origin/develop", "HEAD")
        g("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/develop")
        g("checkout", "-q", "-b", SLICE, FEATURE)
        self.reset()

    def git(self, *args):
        return _git(self.path, *args)

    def write(self, rel, text):
        p = os.path.join(self.path, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(text)
        return p

    def read(self, rel):
        with open(os.path.join(self.path, rel), "r", encoding="utf-8") as fh:
            return fh.read()

    def remove(self, rel):
        p = os.path.join(self.path, rel)
        if os.path.isdir(p):
            shutil.rmtree(p)
        elif os.path.exists(p):
            os.remove(p)

    def set_state(self, state=None, **overrides):
        self.write(".ai/state.json", json.dumps(state if state is not None else default_state(**overrides)))

    def set_plan(self, status="DRAFT", slice_id="01"):
        self.write(".ai/slices/%s/TEST_PLAN.md" % slice_id, test_plan(status))

    def checkout(self, branch):
        self.git("checkout", "-q", branch)

    def reset(self):
        """Back to the default fixture: state, SLICE.md, DRAFT plan, slice branch checked out, no findings."""
        self.remove(".ai")
        self.set_state()
        self.write(".ai/slices/01/SLICE.md", SLICE_MD)
        self.set_plan("DRAFT")
        self.git("config", "--unset-all", "alias.pp") if self._has_alias() else None
        self.checkout(SLICE)

    def _has_alias(self):
        r = subprocess.run(["git", "config", "--get", "alias.pp"], cwd=self.path, stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE)
        return r.returncode == 0

    def cleanup(self):
        shutil.rmtree(self.path, ignore_errors=True)


def run_hook(script, payload, project, env_extra=None, plugin_root=True, raw=None):
    env = dict(os.environ)
    env.pop("SHIPYARD_HOOK_DEBUG", None)
    env["CLAUDE_PROJECT_DIR"] = project
    if plugin_root:
        env["CLAUDE_PLUGIN_ROOT"] = PLUGIN_ROOT
    else:
        env.pop("CLAUDE_PLUGIN_ROOT", None)
    if env_extra:
        env.update(env_extra)
    data = raw if raw is not None else json.dumps(payload)
    return subprocess.run([sys.executable, os.path.join(SCRIPTS, script)], input=data, cwd=project, env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=30)


class HookTestCase(unittest.TestCase):
    script = None

    @classmethod
    def setUpClass(cls):
        cls.repo = Repo()

    @classmethod
    def tearDownClass(cls):
        cls.repo.cleanup()

    def setUp(self):
        self.repo.reset()

    def payload(self, agent, tool_name, tool_input, event="PreToolUse", **extra):
        p = {"session_id": "s1", "cwd": self.repo.path, "hook_event_name": event, "tool_name": tool_name,
             "tool_input": tool_input, "tool_use_id": "t1", "permission_mode": "default"}
        if agent is not None:
            p["agent_type"] = agent
            p["agent_id"] = "a1"
        p.update(extra)
        return p

    def run_tool(self, agent, tool_name, tool_input, script=None, **kw):
        env_extra = kw.pop("env_extra", None)
        plugin_root = kw.pop("plugin_root", True)
        return run_hook(script or self.script, self.payload(agent, tool_name, tool_input, **kw), self.repo.path,
                        env_extra=env_extra, plugin_root=plugin_root)

    def bash(self, agent, command, **kw):
        return self.run_tool(agent, "Bash", {"command": command}, **kw)

    def assertAllowed(self, res):
        self.assertEqual(res.returncode, 0, "expected allow, got %d: %s" % (res.returncode, res.stderr))

    def assertDenied(self, res, *needles):
        self.assertEqual(res.returncode, 2, "expected deny (2), got %d: %s" % (res.returncode, res.stderr))
        for n in needles:
            self.assertIn(n, res.stderr)
