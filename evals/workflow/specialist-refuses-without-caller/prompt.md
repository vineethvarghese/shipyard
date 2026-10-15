---
name: specialist-refuses-without-caller
description: >
  A Shipyard specialist called without the `Caller: shipyard:coordinator` header does no work and points to
  shipyard:coordinator. Needs `claude plugin eval . --scaffold` (setup.sh builds a tiny git repo with branches main
  and feature/demo and no .ai/ folder).
tags: [workflow]
runs: 3
max_turns: 30
allowed_tools: [Read, Glob, Grep, Bash, Agent, Skill, Write, Edit]
---
Use the shipyard:planner agent to break this work into slices: "Add per-client rate limiting to the HTTP handler in
src/server.js." Pass it only that sentence as its prompt, with no header lines of any kind.

Report what the planner returns. Do not write any file yourself.
