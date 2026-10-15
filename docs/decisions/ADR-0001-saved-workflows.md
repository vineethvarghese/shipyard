# ADR-0001: Use saved workflows for order, caps and fail-closed

- Status: Accepted
- Date: 2026-10-15

## Context

Shipyard runs a long process with fixed order and fixed limits. Test plan before code. At most 2 test-plan
revisions. At most 3 fix rounds. One retry for a reviewer, then stop. Route reviewers by facts. Merge duplicate
findings.

If an agent decides these things turn by turn, they depend on its judgment in that moment. Long sessions drift.
A model under pressure to finish may skip a reviewer or run a fourth round. We need these rules to hold every
time.

Claude Code supports saved workflows: plain JavaScript scripts that call agents, run them in parallel, and check
each return against a JSON Schema. A workflow cannot pause to ask the user anything.

## Options considered

1. **Coordinator drives every step, turn by turn.** Simple. One agent holds the whole process in its prompt.
   Rejected: the order, caps and routing would depend on judgment, and a missed step would be hard to detect.
2. **One saved workflow for the whole project.** Rejected: a workflow cannot stop for the four human decisions.
3. **Three saved workflows between the human stops, launched by the coordinator.** The coordinator holds the
   gates and talks to the human. The workflows do the rest in code.

## Decision

Use option 3. `workflows/discover.js` runs P1 to P3. `workflows/plan.js` runs P5 to P7. `workflows/slice.js` runs P9
for one slice. Order, caps, routing, dedupe and fail-closed are written in code. Every agent call inside a
workflow passes the contract schema, so returns are checked by the runtime. The coordinator launches each
workflow with the registry and contracts as arguments.

## Consequences

- The process is testable without a model. `tests/workflows/` runs each script with stand-in agents.
- Caps cannot be argued with. A slice that does not converge escalates.
- Dynamic workflows must be enabled. Shipyard does not run without them.
- Anything the workflow cannot decide comes back as a status (`ESCALATE`, `NEEDS_SHARED_APPROVAL`,
  `BLOCKED_REVIEWER`) for the coordinator to bring to the human.
- Work outside the workflows (P10 reconcile, adjudication) is a direct call. The brief-check hook and
  `scripts/shipyard_validate.py` give those calls the same modes, caps and return checks.
