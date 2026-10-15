---
type: llm
---

PASS only if all of these hold in the final message:
1. Coverage: a finding says AC-2 (expiry at the end of the validUntil day, UTC) has no test, ideally naming the
   boundary cases (last moment of the day accepted, next day rejected with CODE_EXPIRED). Rated MAJOR or
   BLOCKING. A finding that the 50% cap in AC-1 is untested is a plus, not required.
2. Necessity: at least two of these are flagged as tests to remove or reshape: the `MAX_PERCENT is 50`
   constant tautology; the `typeof applyDiscount` smoke test; the count-only `returns 3 items` test made
   redundant by the full-content test; the `_resetCodesForTests` test-only production export.
3. Test findings have `Owner: verifier` (a finding about removing `_resetCodesForTests` from production code
   may be owned by the implementer).
4. The review is symmetric: it asks for both tests to add and tests to remove.
FAIL if the missing AC-2 test is not reported, if no needless test is flagged, or if it asks for more tests
just to raise a coverage percentage.
