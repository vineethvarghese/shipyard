---
type: llm
---

PASS only if all of these hold in the final message:
1. There is no BLOCKING and no MAJOR finding.
2. Either the review says NO FINDINGS, or every finding is MINOR or NOTE and names a concrete cost with an exact
   location (for example a suggestion about table-driven test names), not a style preference.
3. The review does not claim defects that are not there (the overflow guard, the unit map and the error
   sentinel are correct for AC-1..AC-3).
FAIL if any finding is BLOCKING or MAJOR, or if findings are taste-only ("could be cleaner") with no stated cost.
