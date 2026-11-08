# ADR-0008: P4 is a grill of rounds, not one batched turn

- Status: Accepted
- Date: 2026-11-08

## Context

The P4 gate asked everything in one batched turn, forbade "trickling", and calibrated the gap list so that more
than about seven gaps meant the scan was shallow. An answer could never open a new question, goldfish questions
reached the human only if synthesis promoted them, and nothing confirmed the project's terms with the human. Users
reported that the brainstorm "does not ask enough to get all the details".

The grilling method we adapted asks the whole **frontier** of a design tree per round (every question whose
prerequisites are settled, each with a recommended answer), waits, recomputes, and stops only when nothing is left
silently assumed; it writes the glossary and decision records inline. That is compatible with Shipyard's batching
rule and with hard rule 9 (only the coordinator talks to the human).

## Options considered

1. **Keep one turn, raise the gap cap.** Cheapest. Still cannot ask a question an answer opens, and still loses
   terms.
2. **Let discovery interview the human directly.** Breaks hard rule 9 and the single human channel.
3. **Rounds run by the coordinator, recomputed by discovery.** Discovery returns a question tree (kind, dependsOn,
   status). The coordinator asks the frontier, records, calls discovery `GRILL` for the next frontier, writes
   short-form ADRs for answers that are hard to reverse, surprising and a real trade-off, and ends with a
   shared-understanding checklist the human says yes to.

## Decision

Use option 3. Caps are per round (`grillQuestionsPerRound`, 7) and on rounds (`grillRounds`, 3, extendable by the
human), never on the tree. `fact` questions are settled from the repository and never asked. Terms are written to
`.ai/GLOSSARY.md` in the round they are settled. The sealed elephant take moves to its own deep-compute call so the
brainstorm's main signal is not produced by the cheapest model.

## Consequences

- More human turns at P4, each short, each with recommendations a plain "yes" accepts.
- The glossary becomes the source of truth for names; the architect, planner, verifier and code reviewer read it.
- Decisions carry their reasoning (short-form ADRs), not just their answer.
- One more deep discovery call per round, bounded by C-6 and C-9.
- Resume must know which round was asked; the phase log records `P4 round <n>`.
