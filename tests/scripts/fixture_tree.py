"""Helpers shared by the script tests: paths and a minimal, valid Shipyard-shaped repo tree."""

import json
import os
import shutil
import subprocess
import sys

REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SCRIPTS = os.path.join(REPO_ROOT, "scripts")
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)


def run_script(name, *args, cwd=None, stdin=None):
    return subprocess.run([sys.executable, os.path.join(SCRIPTS, name)] + list(args), cwd=cwd,
                          input=stdin, capture_output=True, text=True)


def write(root, relpath, content):
    path = os.path.join(root, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content if isinstance(content, str) else json.dumps(content, indent=2))
    return path


AGENT_MD = """---
name: {name}
description: >
  Test agent {name}. Used only by the fixture tree.
tools: Read, Grep, Glob
model: opus
effort: high
maxTurns: 10
skills:
  - demo-skill
---

# {name}

You are the {name} fixture. You exist to be documented.

## Step 0

Do nothing.
"""

SKILL_MD = """---
name: demo-skill
description: A fixture skill.
---

# Demo skill

Version 1.0.0.
"""

WORKFLOW_JS = """export const meta = {
  name: 'demo',
  description: 'A fixture workflow',
  phases: [{ title: 'One', detail: 'Do one thing' }],
};

phase('One');
const r = await agent('Caller: shipyard:coordinator\\nMode: DEMO', { label: 'demo' });
return { ok: r !== null };
"""


def make_tree(root):
    """Create a small repository that passes scripts/check.py and gen_docs.py."""
    shutil.copytree(os.path.join(REPO_ROOT, "contracts"), os.path.join(root, "contracts"))
    write(root, "agents/alpha.md", AGENT_MD.format(name="alpha"))
    write(root, "agents/beta.md", AGENT_MD.format(name="beta"))
    write(root, "skills/demo-skill/SKILL.md", SKILL_MD)
    write(root, "skills/demo-skill/CHANGELOG.md", "# Changelog\n\n## 1.0.0 — 2026-10-15\n\nInitial release.\n")
    write(root, "workflows/demo.js", WORKFLOW_JS)
    write(root, ".claude-plugin/plugin.json", {"name": "fixture", "version": "1.0.0",
                                               "description": "A fixture plugin."})
    write(root, ".claude-plugin/marketplace.json", {
        "name": "fixture",
        "owner": {"name": "Fixture Owner"},
        "plugins": [{"name": "fixture", "source": "./", "description": "A fixture plugin."}],
    })
    write(root, "README.md", "# Fixture\n\nSee [the agents](agents/alpha.md).\n")
    write(root, "registry/roles.json", {
        "computeClasses": {"DEEP": {"model": "opus", "effort": "high"},
                           "STANDARD": {"model": "sonnet", "effort": "medium"}},
        "roles": {
            "alpha-role": {"agent": "shipyard:alpha", "modes": {"SLICE": "DEEP", "RECHECK": "STANDARD"},
                           "contract": "reviewer-result@1", "skills": ["demo-skill"]},
            "beta-role": {"agent": "shipyard:beta", "modes": {"PLAN": "DEEP"},
                          "contracts": {"PLAN": "planner-result@1"}, "skills": []},
        },
        "routing": {
            "slice": [{"role": "alpha-role", "when": ["productionCode"], "unless": ["mechanicalOnly"]}],
            "plan": [{"role": "beta-role", "when": ["always"]}],
            "uncertainFlag": "route",
            "triggerDefinitions": {"productionCode": "Any source change", "mechanicalOnly": "Renames only"},
        },
    })
    return root
