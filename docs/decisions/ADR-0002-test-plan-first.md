# ADR-0002: An approved test plan comes before code and tests

- Status: Accepted
- Date: 2026-10-15

## Context

When the same agent writes code and then tests, the tests tend to confirm the code it wrote, not the behaviour
that was asked for. Gaps in the acceptance criteria show up late, after code exists. Reviewers then argue about
what "done" means.

## Options considered

1. **Tests after code.** Fast to start. Tests follow the implementation, including its mistakes.
2. **Strict test-driven development by one agent.** Better, but one agent still holds both views.
3. **A written test plan, reviewed and approved, before any code or test.** A separate verifier writes the
   plan. The code-reviewer approves it. Code and tests are then written in parallel by different agents, both
   from the slice spec and the plan.

## Decision

Use option 3. The verifier writes `TEST_PLAN.md` as `DRAFT`, mapping each acceptance criterion to planned tests,
failure cases and benchmarks. The code-reviewer reviews it and, on approval, changes only the status line to
`APPROVED`. At most 2 revisions, then escalate. The test-plan-gate hook blocks code and test writes until the
plan is approved. The implementer and verifier never derive their work from each other.

## Consequences

- Unclear acceptance criteria are found before any code exists.
- Tests check what was asked for, not what was built.
- The plan is a short, readable record of what "done" means for each slice.
- Each slice pays for one extra review step. For mechanical slices the plan is short.
- A slice whose plan cannot be approved in 2 revisions is usually badly specified. It escalates instead of
  looping.
