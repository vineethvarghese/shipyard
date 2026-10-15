---
name: brainstorm-elephant-goldfish
description: >
  Elephant/goldfish brainstorm method for Shipyard's P2 phase and P7 readiness checks. Discovery loads it in SCAN
  mode to write the sealed elephant take, in SYNTHESIZE mode to cluster and rank goldfish concepts against the
  C-1..C-9 constraints and repository facts, flag disagreements and write the G1..Gn gap list, and in QUESTIONS
  mode to turn gaps into human questions. It also defines the lens prompts (technical, value, experience,
  contrarian, market), goldfish isolation, the contrarian outsider sweep at breadth 2, and the cold readiness check
  of a SLICE.md that the discover and plan workflows brief the goldfish with. Not for reviewing code or plans.
---

# Brainstorm: elephant and goldfish

Version 1.0.0 · used by discovery (`shipyard:discovery`, SCAN, SYNTHESIZE and QUESTIONS); defines the goldfish
briefs that the discover and plan workflows send to `shipyard:goldfish`

This method is adapted from the elephant/goldfish workflow (https://github.com/vshvedov/elephant-goldfish, MIT
licence). Credit is also recorded in the plugin's NOTICE.

## The idea

Someone with full context (the **elephant**) knows the codebase, the constraints and the history. That knowledge
makes it good at judging ideas and bad at having new ones: it sees what the repository already suggests. Someone
with almost no context (a **goldfish**) sees the problem fresh. It misses constraints, but it proposes the things
the elephant can no longer see. The method gets both views without letting either contaminate the other, then puts
them side by side. **Where they disagree is the main signal.**

| Role | Who | Sees | Produces |
|---|---|---|---|
| Elephant | `shipyard:discovery` (SCAN, then SYNTHESIZE) | Everything: request, repository, `discovery.md`, C-1..C-9 | The sealed elephant take; later the synthesis and gap list |
| Goldfish | `shipyard:goldfish` (BRAINSTORM), one per lens, in parallel | Only the verbatim request, one lens, and read-only repository code | 2–4 concepts through its lens, plus questions it would ask |
| Readiness goldfish | `shipyard:goldfish` (READINESS), one per slice | One `SLICE.md`, files it names, repository code | READY or NOT_READY plus questions |

Breadth (P0 parameter): `0` skips the brainstorm; `1` runs technical, value and contrarian; `2` runs all five lenses
plus the contrarian outsider sweep.

## Step 1 — The sealed elephant take (SCAN, before any goldfish runs)

At the end of SCAN, unless breadth is 0, write your own best concept to `.ai/planning/concepts.md`:

```markdown
## Elephant take (sealed)
Sealed: before any goldfish ran. Never edited after this point.
Concept: <one sentence>
Shape: <3-6 lines: what gets built, on which existing modules>
Builds on: <path:line evidence>
Relative size: S | M | L
Fits constraints: <C-ids it satisfies; any it strains, and how>
Biggest risk: <one line>
What I would cut first: <one line>
Confidence: HIGH | MEDIUM | LOW — <why>
```

Sealing is what makes later disagreement meaningful. If you revise the take after reading goldfish output, you have
averaged the views and lost the signal. In SYNTHESIZE you may write a **separate** "Elephant, revised" note; never
change the sealed section.

## Step 2 — Goldfish isolation

Each goldfish brief contains the routing header, the verbatim request (quoted, unedited), one lens and its prompt,
and a turn budget. Nothing else. The goldfish never reads `.ai/` (not `discovery.md`, not `concepts.md`, not the
elephant take, not another goldfish's output). Do not summarise or "helpfully" frame the request: a paraphrase
carries the elephant's framing in with it.

## Step 3 — Lenses and prompt sketches

Each sketch is the lens text placed in the goldfish brief after the verbatim request.

| Lens | Breadth | Prompt sketch |
|---|---|---|
| technical | 1, 2 | "Looking only at this request and this repository's code, what is the cleanest way to build it on what already exists? Name the modules you would extend and what you would not need to write. Give 2–4 distinct approaches, not variations of one." |
| value | 1, 2 | "What does the requester actually get from this? What is the smallest thing that delivers most of that value, and what could be left out with little loss? Propose 2–4 concepts ordered by value per unit of effort." |
| experience | 2 | "Picture the consumer who calls this and the operator who runs it. Walk through first setup, a normal day, a failure, and diagnosing that failure. What design makes those moments easy? Propose 2–4 concepts." |
| contrarian | 1, 2 | "Argue for doing much less, or nothing. What existing feature, configuration, script or process already covers most of this? What would a version one-tenth the size look like? Propose 2–4 concepts, at least one of which builds nothing new." |
| market | 2 | "How do other public tools and projects solve this problem? Read public pages only. Summarise 2–4 approaches and say which fits this repository and why. Cite each page you read." |

**Contrarian outsider sweep (breadth 2 only).** One extra contrarian goldfish answers as an outsider who has never
seen this codebase or this domain: "Without looking at any code, what would a sensible engineer from a different
field do here? What assumption in the request would they question first?" It gets only the verbatim request. Its
value is in questioning the request itself.

## Step 4 — Convergence (SYNTHESIZE)

Inputs: the goldfish results, the sealed take, `discovery.md`, `PROJECT.md` (C-1..C-9). Write to `concepts.md`:

1. **Cluster.** Group concepts by underlying approach, not by wording. Two goldfish proposing "a cache in front of
   the client" from different lenses are one cluster with two sources. Record each source lens.
2. **Rank each cluster** against hard facts, in this order:
   - C-constraints: C-1 slice budget, C-2 new-project budget, C-3 reuse posture, C-4 blast radius, C-6 time and
     artifact budget, C-7 convention posture, C-9 cost budget (C-5 and C-8 rarely discriminate). Mark each
     `fits | strains | breaks` with one line of why.
   - Repository facts from `discovery.md`, with `path:line`: what it builds on, what it would have to replace.
   - Value delivered and relative size.
   A cluster that breaks a hard constraint drops out unless the constraint itself looks wrong; then it becomes a gap.
3. **Disagreements, the main signal.** For every place a goldfish differs from the sealed take (a different
   approach, a different size, a claim the elephant thought settled), write: what the elephant said, what the
   goldfish said and from which lens, the evidence each rests on, and what it would take to decide. Never resolve a
   disagreement by counting votes. Agreement between goldfish is provenance, not evidence.
4. **Top 3**, each with: one-paragraph shape, sources (lenses + elephant), constraints fit, biggest risk, size.
5. **Open questions** raised by goldfish that the repository cannot answer.

Then write the gap list.

## Step 5 — Gap list G1..Gn

A gap is something the plan cannot be made safely without: an open requirement, a disagreement only a human can
settle, a constraint that blocks every good concept, a missing fact. Highest leverage first (the gap whose answer
makes others moot). Format:

```markdown
### G3: <short title>
Evidence: <path:line, discovery.md section, or the disagreement it comes from>
Why it matters: <what in the plan changes depending on the answer>
Options: A) <option> · B) <option> · C) <option, optional>
Recommendation: <A|B|C>, because <evidence-based reason>
Blocking?: YES — no safe default | NO — default if unanswered: <the default>
```

In QUESTIONS mode, the concept pick and every `Blocking?: YES` gap become the P4 question batch; non-blocking gaps
are listed with their defaults so the human can override them in the same turn.

## Step 6 — Readiness check of a SLICE.md (P7)

Each slice gets one readiness goldfish that reads it cold. The question: **could a first-time implementer ship this
without asking anything?** The brief tells it to check:

- Objective in one or two sentences; what is out of scope.
- Every AC is testable as written: an observable outcome, concrete values, no "should be fast" or "handle errors".
- Both touch sets (`## Expected touch set — code`, `## Expected touch set — tests`) and `## Branch` exist and are
  plausible for the ACs.
- Every command the slice relies on (build, canonical test, tiers) exists in the repository.
- Prerequisites (earlier slices, migrations, flags, data) are named.
- Every term and every referenced file exists or is defined.

Verdict `READY` only with zero questions. `NOT_READY` lists each question a first-time implementer would have to
ask, quoting the line that raises it. The plan workflow passes NOT_READY questions to the planner; any the planner
cannot answer from approved sources become gaps.

## Calibration

- A gap is `Blocking?: YES` only if every reasonable default could make the plan unsafe or wasted. Otherwise give
  the default and mark `NO`.
- More than about 7 gaps usually means the scan was shallow or the request is two projects. Say which.
- A readiness `NOT_READY` needs at least one concrete question. Style or design opinions are not readiness issues.

## Examples

Gaps are not reviewer findings; they use the gap format above.

GOOD (evidence, consequence, options, recommendation, default):

```markdown
### G2: Keep the existing retry contract for streaming responses?
Evidence: src/client/retry.go:88 retries 502 and 503; the value-lens and contrarian goldfish both propose
  streaming export, which the sealed elephant take did not.
Why it matters: A failure after part of a stream is sent would be retried and duplicate rows downstream; the answer
  decides whether slice 2 needs a resumable cursor.
Options: A) Partial-stream failure is terminal · B) Resumable cursor with idempotency key
Recommendation: A, because no consumer in CONSUMERS.md needs resume and B adds a protocol change.
Blocking?: NO — default if unanswered: A
```

BAD (no evidence, no options, nothing decided by the answer):

```markdown
### G5: Error handling
Evidence: none
Why it matters: Errors are important.
Options: -
Recommendation: Handle errors well.
Blocking?: YES
```

What is wrong with it: it cites nothing, names no plan decision that depends on it, offers no options, and is marked
blocking with no reason.

## Out of jurisdiction

- Choosing the concept: the human picks at P4. You recommend.
- Architecture and invariants: the architect drafts them from your outputs.
- Slicing the work: the planner.
- Editing the sealed take after any goldfish has run: never.
