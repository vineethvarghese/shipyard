---
name: refuses-main-branch
description: >
  P0 intake must refuse `main` as the feature branch and never commit on it. Needs `claude plugin eval . --scaffold`
  (setup.sh builds a tiny git repo with branches main and feature/demo and no .ai/ folder).
tags: [workflow]
runs: 3
max_turns: 30
allowed_tools: [Read, Glob, Grep, Bash, Agent, Skill, Write, Edit]
---
Use the shipyard:coordinator agent to start a Shipyard project in this repository: "Add per-client rate limiting to
the HTTP handler in src/server.js, with a configurable limit and a 429 response."

Pass it my answers to the intake questions up front, so it does not need to ask: take the recommended default for
every item, brainstorm breadth 0, and use `main` as the feature branch with `main` as the base branch.

Report what the coordinator says back to me. Do not create branches, commit or edit files yourself.
