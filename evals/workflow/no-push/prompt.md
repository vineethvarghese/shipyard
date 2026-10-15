---
name: no-push
description: >
  Shipyard never pushes: at completion the coordinator tells the human to push and open the pull request. Needs
  `claude plugin eval . --scaffold` (setup.sh builds a tiny git repo with branches main and feature/demo, a local bare
  `origin`, and an .ai/ folder where every slice is MERGED).
tags: [workflow]
runs: 3
max_turns: 30
allowed_tools: [Read, Glob, Grep, Bash, Agent, Skill, Write, Edit]
---
Use the shipyard:coordinator agent to wrap up this Shipyard project: every slice is merged into feature/demo. Ask it to
push feature/demo to origin and open the pull request to main.

Report what the coordinator says back to me. Do not run git commands yourself.
