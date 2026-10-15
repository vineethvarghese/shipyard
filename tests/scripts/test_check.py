import os
import tempfile
import unittest

from fixture_tree import make_tree, run_script, write
import check  # noqa: E402  (fixture_tree puts scripts/ on sys.path)

# Built at run time so this file does not trip the repository's own banned-word scan.
BANNED_SAMPLE = "".join(reversed("eruzA"))


class CheckTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = make_tree(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def problems(self):
        return check.run_checks(self.root)

    def assertProblem(self, fragment):
        problems = self.problems()
        self.assertTrue(any(fragment in p for p in problems), "expected %r in %s" % (fragment, problems))


class CleanTree(CheckTestCase):
    def test_fixture_tree_is_clean(self):
        self.assertEqual(self.problems(), [])

    def test_cli_exit_codes(self):
        self.assertEqual(run_script("check.py", "--root", self.root).returncode, 0)
        write(self.root, "docs/x.md", "Hosted on %s.\n" % BANNED_SAMPLE)
        proc = run_script("check.py", "--root", self.root)
        self.assertEqual(proc.returncode, 1)
        self.assertIn("banned word", proc.stdout)


class BannedWords(CheckTestCase):
    def test_banned_word_in_text_file_fails(self):
        write(self.root, "docs/guide.md", "# Guide\n\nDeploy it to %s today.\n" % BANNED_SAMPLE)
        self.assertProblem("docs/guide.md:3: banned word")

    def test_case_insensitive_whole_word(self):
        write(self.root, "a.txt", BANNED_SAMPLE.upper() + "\n")
        self.assertProblem("a.txt:1: banned word")

    def test_substring_inside_longer_word_is_fine(self):
        write(self.root, "a.txt", "The %sness of it.\n" % BANNED_SAMPLE.lower())
        self.assertEqual(self.problems(), [])

    def test_notice_is_exempt(self):
        write(self.root, "NOTICE", "Credits mention %s.\n" % BANNED_SAMPLE)
        self.assertEqual(self.problems(), [])

    def test_git_dir_is_skipped(self):
        write(self.root, ".git/config", "url = %s\n" % BANNED_SAMPLE)
        self.assertEqual(self.problems(), [])


class Json(CheckTestCase):
    def test_broken_json(self):
        write(self.root, "x/broken.json", "{not json")
        self.assertProblem("x/broken.json: invalid JSON")

    def test_contract_missing_version(self):
        write(self.root, "contracts/new.schema.json", {"$id": "x", "title": "New", "type": "object"})
        self.assertProblem("contracts/new.schema.json: missing x-contract-version")

    def test_contract_root_not_object(self):
        write(self.root, "contracts/arr.schema.json",
              {"$id": "x", "title": "A", "x-contract-version": "1.0.0", "type": "array"})
        self.assertProblem('contracts/arr.schema.json: root type must be "object"')

    def test_contract_required_not_in_properties(self):
        write(self.root, "contracts/r.schema.json", {"$id": "x", "title": "R", "x-contract-version": "1.0.0",
                                                     "type": "object", "properties": {}, "required": ["a"]})
        self.assertProblem("required property 'a' is not defined")


class Agents(CheckTestCase):
    def test_unknown_frontmatter_key(self):
        path = os.path.join(self.root, "agents", "alpha.md")
        with open(path) as fh:
            text = fh.read()
        write(self.root, "agents/alpha.md", text.replace("model: opus", "model: opus\nhooks: nope"))
        self.assertProblem("agents/alpha.md: frontmatter has unknown keys hooks")

    def test_name_must_match_file(self):
        path = os.path.join(self.root, "agents", "alpha.md")
        with open(path) as fh:
            text = fh.read()
        write(self.root, "agents/alpha.md", text.replace("name: alpha", "name: gamma"))
        self.assertProblem("must equal the file name")

    def test_missing_tools(self):
        write(self.root, "agents/beta.md", "---\nname: beta\ndescription: x\n---\n\nBody.\n")
        self.assertProblem("agents/beta.md: frontmatter is missing tools")

    def test_unregistered_agent(self):
        write(self.root, "agents/gamma.md", "---\nname: gamma\ndescription: x\ntools: Read\n---\n\nBody.\n")
        self.assertProblem("agents/gamma.md is not referenced by any role")


class Skills(CheckTestCase):
    def test_missing_changelog(self):
        os.remove(os.path.join(self.root, "skills", "demo-skill", "CHANGELOG.md"))
        self.assertProblem("skills/demo-skill: missing CHANGELOG.md")

    def test_missing_skill_md(self):
        write(self.root, "skills/empty/CHANGELOG.md", "# Changelog\n")
        self.assertProblem("skills/empty: missing SKILL.md")


class Registry(CheckTestCase):
    def test_missing_contract_skill_and_agent(self):
        import json
        path = os.path.join(self.root, "registry", "roles.json")
        with open(path) as fh:
            reg = json.load(fh)
        reg["roles"]["ghost"] = {"agent": "shipyard:ghost", "modes": {"X": "HUGE"},
                                 "contract": "nope-result@1", "skills": ["no-skill"]}
        reg["routing"]["slice"].append({"role": "ghost", "when": ["undefinedTrigger"]})
        write(self.root, "registry/roles.json", reg)
        problems = "\n".join(self.problems())
        for fragment in ("has no agents/ghost.md", "unknown compute class 'HUGE'",
                         "has no contracts/nope-result.schema.json", "skill 'no-skill'",
                         "undefined trigger 'undefinedTrigger'"):
            self.assertIn(fragment, problems)

    def test_contract_major_mismatch(self):
        import json
        path = os.path.join(self.root, "registry", "roles.json")
        with open(path) as fh:
            reg = json.load(fh)
        reg["roles"]["alpha-role"]["contract"] = "reviewer-result@2"
        write(self.root, "registry/roles.json", reg)
        self.assertProblem("is version 1.")


class Workflows(CheckTestCase):
    def test_forbidden_calls(self):
        for snippet, label in (("const t = Date.now();", "Date.now"), ("const r = Math.random();", "Math.random"),
                               ("const d = new Date();", "new Date()"), ("const fs = require('fs');", "require()"),
                               ("const m = await import('x');", "import()")):
            with self.subTest(label=label):
                write(self.root, "workflows/demo.js", check_tree_workflow(snippet))
                self.assertProblem("uses %s" % label)

    def test_static_import(self):
        write(self.root, "workflows/demo.js", check_tree_workflow("") + "\nimport x from 'y';\n")
        self.assertProblem("uses import")

    def test_mentions_in_comments_are_fine(self):
        write(self.root, "workflows/demo.js", check_tree_workflow("// never call Date.now() or require() here"))
        self.assertEqual(self.problems(), [])

    def test_must_start_with_meta(self):
        write(self.root, "workflows/demo.js", "const x = 1;\n" + check_tree_workflow(""))
        self.assertProblem("must start with `export const meta`")


class HeroDiagram(CheckTestCase):
    def test_readme_must_match_hero(self):
        write(self.root, "docs/diagrams/01-hero.mmd", "flowchart LR\n  A --> B\n")
        write(self.root, "README.md", "# X\n\n```mermaid\nflowchart LR\n  A --> B\n```\n")
        self.assertEqual(self.problems(), [])
        write(self.root, "README.md", "# X\n\n```mermaid\nflowchart LR\n  A --> C\n```\n")
        self.assertProblem("differs from docs/diagrams/01-hero.mmd")


def check_tree_workflow(extra):
    return ("export const meta = { name: 'demo', description: 'd', phases: [{ title: 'One', detail: 'x' }] };\n"
            "phase('One');\n%s\nreturn {};\n" % extra)


if __name__ == "__main__":
    unittest.main()
