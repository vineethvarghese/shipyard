---
name: grill-round
description: >
  Discovery in GRILL mode records the human's answers, settles the fact question itself instead of asking it,
  challenges a term the human used against the glossary, opens the questions the answers opened, and returns a
  frontier that contains only questions whose dependencies are settled.
tags: [ability, brainstorm-elephant-goldfish]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

Use the `shipyard:discovery` agent for one grill round and give me its return block.

Start the agent's prompt with this brief, then paste everything under "Round material" below it unchanged:

```text
Caller: shipyard:coordinator
Mode: GRILL
Read: inline below (evaluation run: the workspace has no repository)
Write: none (evaluation run): return the updated gaps, frontier, glossaryTerms and decisionCandidates inline
Budget: 12 turns
```

This is an evaluation run in an empty workspace: there is no git repository and no `.ai/` folder, so the open
questions, the glossary and the repository facts are inline. Tell the agent to work only from what is shown and
not to look for files. Ask it to end with one fenced `json` block matching the discovery-result contract
(`mode`, `artifactsWritten`, `gaps` with `kind`, `dependsOn` and `status`, `frontier`, `round`, `glossaryTerms`,
`decisionCandidates`, `couldNotInspect`, `humanInputRequested`).

When the agent returns, repeat its final JSON block verbatim in your final answer.

## Round material

Round: 1 (these are the human's answers to round 1)

### Repository facts (from discovery.md)

- `src/orders/cancel.py:12` `def cancel(order_id)` sets `order.status = "CANCELLED"` for the whole order; there is
  no per-line cancellation anywhere (`grep -rn "line" src/orders/` finds only `order.lines` iteration in
  `total()`).
- `src/orders/models.py:30` `class Order` has `lines: list[Line]`, `status`, `placed_at`; `Line` has `sku`,
  `qty`, `price_cents`.
- The repository has one store: `src/orders/store.py` (`InMemoryStore`). No database.

### Glossary (.ai/GLOSSARY.md)

### Order
A customer's purchase as placed: one or more lines, a status and a placed time.
Avoid: basket, cart (those are pre-purchase)
Source: request

### Cancellation
Setting an order's status to CANCELLED so it is no longer fulfilled.
Avoid: void, abort
Source: src/orders/cancel.py:12

### The question tree (open-questions.md)

G1 [concept, depends on: none, ANSWERED] Which approach: A) cancel whole orders only (today) · B) allow
cancelling individual lines · C) B plus partial refunds. Recommendation: A.
  Answer (round 1): "B. Customers keep asking to drop one item."

G2 [decision, depends on: G1, OPEN] If lines can be cancelled, does an order with every line cancelled become
CANCELLED automatically? Options: yes / no. Recommendation: yes.

G3 [fact, depends on: none, OPEN] Does the store persist orders between runs? (nobody has checked)

G4 [scope, depends on: G1, ANSWERED] Refunds in scope? Options: yes / no. Recommendation: no.
  Answer (round 1): "No refunds. And by the way, cancellation should also void the customer's reservation of
  stock."

G5 [decision, depends on: G2, OPEN] Should a fully cancelled order keep its lines for reporting?
Options: keep / delete. Recommendation: keep.

The human also wrote: "By cancellation I mean the customer voiding a line before it ships."
