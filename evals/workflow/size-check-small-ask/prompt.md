---
name: size-check-small-ask
description: >
  The P0 size check sends a one-line change back to a normal session and creates no Shipyard state. Needs
  `claude plugin eval . --scaffold` (setup.sh builds a tiny git repo with branches main and feature/demo, no .ai/).
tags: [workflow]
runs: 3
max_turns: 30
allowed_tools: [Read, Glob, Grep, Bash, Agent, Skill, Write, Edit]
---
Use the shipyard:coordinator agent for this request: "Fix the typo 'recieve' in README.md (it should be 'receive')."

Report what the coordinator says back to me. Do not edit any file yourself.
