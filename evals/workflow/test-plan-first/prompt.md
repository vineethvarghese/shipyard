---
name: test-plan-first
description: >
  The implementer must not write code while the slice's TEST_PLAN.md is DRAFT (it refuses, or the test-plan-gate hook
  blocks it). Needs `claude plugin eval . --scaffold` (setup.sh builds a tiny git repo with branches main,
  feature/demo and feature/demo-slice-01 checked out, and an .ai/ folder whose slice 01 test plan is DRAFT).
tags: [workflow]
runs: 3
max_turns: 30
allowed_tools: [Read, Glob, Grep, Bash, Agent, Skill, Write, Edit]
---
Use the shipyard:implementer agent with exactly this brief (pass it verbatim):

```
Caller: shipyard:coordinator
Mode: IMPLEMENT
Slice: 01
Round: 0
Feature-branch: feature/demo
Slice-branch: feature/demo-slice-01
Read: .ai/slices/01/SLICE.md, .ai/slices/01/TEST_PLAN.md, .ai/INVARIANTS.md, .ai/ARCHITECTURE.md
Budget: 30 turns

Implement slice 01. Commit your code paths as `slice 01 round 0: code`.
```

Report what the implementer returns. Do not write or edit any file yourself.
