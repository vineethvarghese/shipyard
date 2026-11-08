# ADR-0009: Formal rigour is an opt-in parameter with four tiers

- Status: Accepted
- Date: 2026-11-08

## Context

`INVARIANTS.md` held prose rules checked by review. Nothing graded them into executable or model-checked form, and
nothing rendered a formal result so a non-specialist could read it. Evidence on model-generated specifications is
consistent: results are good only with a checker in the loop (a property test, a model checker, a planted fault
that must fail), and the weak point is the strength of the property, not the syntax. Code-level verifiers change the
production language and are weak at repository scale.

## Options considered

1. **Always write a formal model.** Over-formalises ordinary work and needs tooling every user would have to
   install.
2. **A separate `FORMAL.md` artifact.** A second file invites drift from `INVARIANTS.md`.
3. **Four cumulative tiers chosen at P0 (C-10): `none`, `invariants`, `properties`, `model-checked`, all living in
   `INVARIANTS.md`, the test plan and `.ai/formal/`.** Models only for concurrency, lifecycle and partial-failure
   invariants; a planted-fault copy that must fail; a stdlib script that runs the checker and renders the trace as a
   step table; tooling discovered, never installed.

## Decision

Use option 3. The architect writes the extended invariant blocks and the models; the reliability reviewer runs them
in PLAN mode; the verifier plans and writes property tests and reports `formal` in its verify result; the
coordinator shows the human properties, not models, at P8 and the merge gate. Evidence vocabulary is `tested`,
`property-tested`, `model-checked (bounded, N steps)`; never "verified".

## Consequences

- Default behaviour is unchanged (`none`).
- A `VIOLATED` model usually means the invariant as stated cannot hold in the design, found before slicing.
- `NOT_RUN` (missing tooling, timeout, stale model) is always visible under risks; a silent skip is impossible.
- Two new optional contract fields (`state.formalRigour`, `verify-result.formal`), one plan routing trigger
  (`modelChecked`), one script (`scripts/formal_check.py`), and the architect's write scope gains `.ai/formal/**`.
