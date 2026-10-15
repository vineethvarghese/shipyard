import json
import os
import tempfile
import unittest

from fixture_tree import run_script
import install_settings as mod  # noqa: E402  (fixture_tree puts scripts/ on sys.path)

EXAMPLE = {
    "$schema": "https://example.invalid/schema.json",
    "permissions": {
        "allow": ["Read", "Bash(git status:*)", "Workflow(shipyard:slice)"],
        "deny": ["Bash(git push:*)"],
    },
}


class MergeUnit(unittest.TestCase):
    def test_from_empty_adds_everything(self):
        merged, summary = mod.merge_settings({}, EXAMPLE)
        self.assertEqual(merged["permissions"]["allow"], EXAMPLE["permissions"]["allow"])
        self.assertEqual(merged["permissions"]["deny"], ["Bash(git push:*)"])
        self.assertEqual(merged["$schema"], EXAMPLE["$schema"])
        self.assertEqual(summary["allow"], EXAMPLE["permissions"]["allow"])
        self.assertEqual(summary["deny"], ["Bash(git push:*)"])

    def test_preserves_existing_entries_and_order(self):
        existing = {"permissions": {"allow": ["Bash(make:*)", "Read"]}}
        merged, summary = mod.merge_settings(existing, EXAMPLE)
        # User's entries stay first and in order; new ones append.
        self.assertEqual(merged["permissions"]["allow"][:2], ["Bash(make:*)", "Read"])
        self.assertIn("Workflow(shipyard:slice)", merged["permissions"]["allow"])
        self.assertNotIn("Read", summary["allow"])  # already present, not re-added

    def test_preserves_unrelated_keys(self):
        existing = {"model": "opus", "env": {"FOO": "bar"}}
        merged, _ = mod.merge_settings(existing, EXAMPLE)
        self.assertEqual(merged["model"], "opus")
        self.assertEqual(merged["env"], {"FOO": "bar"})

    def test_keeps_user_schema(self):
        existing = {"$schema": "mine"}
        merged, _ = mod.merge_settings(existing, EXAMPLE)
        self.assertEqual(merged["$schema"], "mine")

    def test_idempotent(self):
        once, _ = mod.merge_settings({}, EXAMPLE)
        twice, summary = mod.merge_settings(once, EXAMPLE)
        self.assertEqual(once, twice)
        self.assertEqual(summary, {"allow": [], "deny": []})

    def test_extra_allow_appended(self):
        merged, summary = mod.merge_settings({}, EXAMPLE, extra_allow=["Bash(pytest:*)"])
        self.assertIn("Bash(pytest:*)", merged["permissions"]["allow"])
        self.assertIn("Bash(pytest:*)", summary["allow"])

    def test_rejects_non_object_existing(self):
        with self.assertRaises(mod.SettingsError):
            mod.merge_settings([], EXAMPLE)


class TestCommandRule(unittest.TestCase):
    def test_bare_command_becomes_bash_prefix(self):
        self.assertEqual(mod.test_command_rule("npm test"), "Bash(npm test:*)")

    def test_tool_form_used_verbatim(self):
        self.assertEqual(mod.test_command_rule("Bash(go test ./...:*)"), "Bash(go test ./...:*)")

    def test_blank_is_none(self):
        self.assertIsNone(mod.test_command_rule("   "))


class EndToEnd(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.project = self._tmp.name
        self.example = os.path.join(self.project, "settings.example.json")
        with open(self.example, "w", encoding="utf-8") as fh:
            json.dump(EXAMPLE, fh)
        self.target = os.path.join(self.project, ".claude", "settings.json")

    def tearDown(self):
        self._tmp.cleanup()

    def _run(self, *args):
        return run_script("install_settings.py", "--project", self.project, "--example", self.example, *args)

    def test_creates_file_and_is_idempotent(self):
        proc = self._run()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertTrue(os.path.isfile(self.target))
        with open(self.target) as fh:
            data = json.load(fh)
        self.assertIn("Workflow(shipyard:slice)", data["permissions"]["allow"])
        # Second run changes nothing.
        proc2 = self._run()
        self.assertIn("Nothing to change", proc2.stdout)

    def test_dry_run_writes_nothing(self):
        proc = self._run("--dry-run")
        self.assertIn("Would add", proc.stdout)
        self.assertFalse(os.path.exists(self.target))

    def test_test_command_added(self):
        self._run("--test-command", "npm test")
        with open(self.target) as fh:
            data = json.load(fh)
        self.assertIn("Bash(npm test:*)", data["permissions"]["allow"])

    def test_invalid_existing_json_refuses(self):
        os.makedirs(os.path.dirname(self.target))
        with open(self.target, "w") as fh:
            fh.write("{not json")
        proc = self._run()
        self.assertEqual(proc.returncode, 1)
        self.assertIn("not valid JSON", proc.stderr)
        # The broken file is left untouched, not clobbered.
        with open(self.target) as fh:
            self.assertEqual(fh.read(), "{not json")


if __name__ == "__main__":
    unittest.main()
