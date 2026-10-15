import os
import tempfile
import unittest

from fixture_tree import make_tree, run_script, write
import gen_docs  # noqa: E402  (fixture_tree puts scripts/ on sys.path)


class GenDocs(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = make_tree(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def gen(self, *args):
        return run_script("gen_docs.py", "--root", self.root, *args)

    def read(self, rel):
        with open(os.path.join(self.root, rel), encoding="utf-8") as fh:
            return fh.read()

    def test_check_fails_before_generation_and_passes_after(self):
        self.assertEqual(self.gen("--check").returncode, 1)
        self.assertFalse(os.path.exists(os.path.join(self.root, "docs")), "--check must not write")
        self.assertEqual(self.gen().returncode, 0)
        proc = self.gen("--check")
        self.assertEqual(proc.returncode, 0, proc.stdout)

    def test_agent_page_content(self):
        self.gen()
        page = self.read("docs/agents/alpha.md")
        self.assertTrue(page.startswith(gen_docs.MARKER))
        self.assertIn("`shipyard:alpha` · role `alpha-role`", page)
        self.assertIn("You are the alpha fixture. You exist to be documented.", page)
        self.assertIn("| SLICE | DEEP | opus | high | [`reviewer-result@1`](../../contracts/reviewer-result.schema.json) |",
                      page)
        self.assertIn("| RECHECK | STANDARD | sonnet | medium |", page)
        self.assertIn("- [`demo-skill`](../../skills/demo-skill/SKILL.md) (preloaded)", page)
        self.assertIn("`Read`, `Grep`, `Glob`", page)
        self.assertIn("Max turns: 10.", page)
        self.assertIn("**Slice review:** when any of: `productionCode` (Any source change) — unless `mechanicalOnly`",
                      page)
        beta = self.read("docs/agents/beta.md")
        self.assertIn("**Plan review:** always", beta)
        self.assertIn("[`planner-result@1`]", beta)

    def test_index_lists_every_agent(self):
        self.gen()
        index = self.read("docs/agents/README.md")
        self.assertIn("| [alpha](alpha.md) | alpha-role | SLICE, RECHECK | `reviewer-result@1` |", index)
        self.assertIn("| [beta](beta.md) | beta-role | PLAN |", index)

    def test_check_detects_agent_change(self):
        self.gen()
        path = os.path.join(self.root, "agents", "alpha.md")
        with open(path) as fh:
            text = fh.read()
        write(self.root, "agents/alpha.md", text.replace("maxTurns: 10", "maxTurns: 12"))
        proc = self.gen("--check")
        self.assertEqual(proc.returncode, 1)
        self.assertIn("docs/agents/alpha.md", proc.stdout)

    def test_check_detects_hand_edit(self):
        self.gen()
        with open(os.path.join(self.root, "docs", "agents", "beta.md"), "a") as fh:
            fh.write("hand edit\n")
        self.assertEqual(self.gen("--check").returncode, 1)

    def test_stale_generated_page_removed(self):
        self.gen()
        write(self.root, "docs/agents/old.md", gen_docs.MARKER + "\n# old\n")
        write(self.root, "docs/agents/notes.md", "# Hand-written, not generated\n")
        proc = self.gen("--check")
        self.assertEqual(proc.returncode, 1)
        self.assertIn("would remove docs/agents/old.md", proc.stdout)
        self.gen()
        self.assertFalse(os.path.exists(os.path.join(self.root, "docs", "agents", "old.md")))
        self.assertTrue(os.path.exists(os.path.join(self.root, "docs", "agents", "notes.md")))

    def test_output_is_deterministic(self):
        first = gen_docs.build(self.root)
        second = gen_docs.build(self.root)
        self.assertEqual(first, second)


class CheckLinks(unittest.TestCase):
    def test_broken_and_ok_links(self):
        with tempfile.TemporaryDirectory() as root:
            write(root, "docs/a.md", "See [b](b.md), [anchor](#x), [web](https://example.com), "
                                     "[up](../README.md#top), [tpl](<path to *.HUMAN.md>).\n"
                                     "```\n[in code](missing.md)\n```\n`[inline](missing2.md)`\n")
            write(root, "docs/b.md", "# B\n")
            write(root, "README.md", "[docs](docs/) and [gone](docs/gone.md)\n")
            proc = run_script("check_links.py", "--root", root)
            self.assertEqual(proc.returncode, 1)
            self.assertIn("README.md:1: broken link docs/gone.md", proc.stdout)
            self.assertNotIn("missing", proc.stdout)
            write(root, "docs/gone.md", "# here now\n")
            self.assertEqual(run_script("check_links.py", "--root", root).returncode, 0)


if __name__ == "__main__":
    unittest.main()
