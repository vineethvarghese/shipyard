---
type: llm
---

PASS only if all of these hold in the final JSON block:
1. G3 (a `fact` question) is marked SETTLED, not asked: the answer cites the repository fact that the only store is
   `InMemoryStore` with no database, so nothing persists between runs. It must not appear in `frontier`.
2. The frontier contains G2 (its dependency G1 is answered) and does not contain G5 (its dependency G2 is still
   open).
3. A new `term` question challenges the word "cancellation": the glossary and `src/orders/cancel.py:12` mean
   cancelling a whole order, while the human now means a customer voiding a single line before it ships, and
   "void" is on the glossary's Avoid list. The question asks which meaning to keep, with a recommendation.
4. The stock-reservation remark in G4's answer becomes a new `scope` or `decision` question (it is a new
   requirement the answer opened), not silently adopted.
5. `glossaryTerms` names at least one term updated in this round (for example Cancellation or Line), and
   `decisionCandidates` includes G1's answer with `hardToReverse`, `surprising` and `tradeoff` flags, each a
   boolean.
FAIL if G3 is put to the human, if G5 is in the frontier, if the cancellation term conflict is not raised, or if the
block is not valid JSON.
