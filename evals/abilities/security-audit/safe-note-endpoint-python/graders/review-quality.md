---
type: llm
---

PASS only if all of these hold in the final message:
1. There is no BLOCKING finding.
2. The review recognises that the query is parameterized, that ownership is enforced in the WHERE clause
   (INV-001), that `note_id` is typed as an int, that the response model exposes only id, title and body, and
   that missing and foreign notes return the same 404 (no enumeration signal).
3. Any finding is LOW/INFORMATIONAL (MINOR or NOTE), with a concrete reason and location; for example a
   defence-in-depth note on rate limiting. No invented attack path.
4. No secret value is copied into the review.
FAIL if any finding is BLOCKING, or if a MAJOR finding has no concrete attack path through the shown code.
