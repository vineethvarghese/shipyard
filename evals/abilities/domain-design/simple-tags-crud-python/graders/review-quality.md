---
type: llm
---

PASS only if all of these hold in the final message:
1. There is no BLOCKING finding.
2. The review does not require a repository class, factory, aggregate root, domain service, value object or
   domain events for tags. Mentioning one as an optional NOTE is acceptable; requiring it is not.
3. Any finding is MINOR or NOTE (MAJOR only with a concrete, evidenced cost) and has an exact location.
4. The review accepts that INV-002 is enforced by the unique constraint with a 409 on conflict, unless it gives
   a concrete sequence that breaks it.
FAIL if any finding is BLOCKING, or if DDD tactical patterns are demanded for this simple CRUD.
