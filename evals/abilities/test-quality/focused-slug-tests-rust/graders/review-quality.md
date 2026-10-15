---
type: llm
---

PASS only if all of these hold in the final message:
1. There is no BLOCKING finding.
2. The review recognises that each AC has a test that would catch a regression (AC-1: three tests; AC-2: the
   EmptySlug test; AC-3: the two boundary tests at 63+separator and exactly 64).
3. Any finding is MINOR or NOTE with an exact location and a concrete reason (for example, a suggested extra
   edge such as digits-only or a long run of separators at the limit), not a demand for more tests to raise
   coverage.
4. The review does not classify these tests as tautologies, redundant or over-engineered without a specific
   reason.
FAIL if any finding is BLOCKING or MAJOR without a concrete untested AC behaviour, or if it invents
anti-patterns that are not present.
