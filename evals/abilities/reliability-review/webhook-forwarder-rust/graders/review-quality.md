---
type: llm
---

PASS only if all of these hold in the final message:
1. At least two of these failure scenarios are reported, each as a concrete sequence of events:
   a. When the partner slows down, events keep arriving at 200/s into an unbounded channel and one spawned task
      per event, so tasks and memory grow without bound (INV-003 at risk).
   b. `send()` has no timeout (the client is built without one), so a hung partner holds every task forever.
   c. `deliver` retries forever with a fixed 100 ms delay and no cap or backoff, including for 4xx responses
      that will never succeed, amplifying load on a struggling partner.
2. Each finding states a plausibility label (LIKELY, POSSIBLE or THEORETICAL) with a reason, an impact, and the
   current behaviour with a location in src/forwarder.rs.
3. Corrections are minimal and local: a bounded channel and/or a concurrency limit, a request timeout, capped
   exponential backoff, and not retrying non-retryable statuses. A circuit breaker or new queueing system may
   be mentioned only after explaining why the cheaper options are not enough.
4. The most serious finding is MAJOR or BLOCKING. Retrying is not itself flagged as a duplicate-side-effect
   bug, since AC-2 says the partner deduplicates by event_id.
FAIL if findings lack failure scenarios or plausibility, or if the review's main fix is heavy new machinery.
