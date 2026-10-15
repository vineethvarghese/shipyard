# ADR-0005: Code review and simplicity review are separate agents

- Status: Accepted
- Date: 2026-10-15

## Context

A code reviewer asks: is this code clear, correct, well tested and well shaped? A simplicity reviewer asks a
different question: should this new layer, abstraction or file exist at all?

When one agent does both, the first question wins. Once a reviewer has read an abstraction closely and suggested
ways to improve it, it rarely says "delete it". Reviewing the details makes the structure feel settled.

## Options considered

1. **One code reviewer with a simplicity checklist.** Cheaper. In practice the checklist gets light attention.
2. **Two reviewers with separate jobs and separate abilities.** The simplicity reviewer is adapted from the
   MIT-licensed Cranky Old Sam reviewer persona. It argues for less: fewer layers, fewer files, fewer options.

## Decision

Use option 2. The code-reviewer owns the test-plan gate and reviews code and tests together for clarity, design
depth, performance, domain fit and test quality. The simplicity-reviewer reviews only whether new structure
should exist. It runs at plan critique (always) and on every slice with production code, unless the slice is
mechanical only.

## Consequences

- Needless layers are challenged by an agent whose only job is to challenge them.
- The two reviewers may disagree. That is recorded, not averaged. A maintained architectural `BLOCKING`
  finding goes to the architect, then to the human.
- Each production-code slice pays for one more review. Mechanical slices skip it.
- Each reviewer's ability can be tuned and evaluated on its own.
