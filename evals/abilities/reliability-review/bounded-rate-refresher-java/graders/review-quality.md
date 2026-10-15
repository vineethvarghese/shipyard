---
type: llm
---

PASS only if all of these hold in the final message:
1. There is no BLOCKING finding.
2. The review recognises the bounds already in place: connect and request timeouts, at most 3 attempts with
   backoff on an idempotent GET, a single scheduler thread with fixed delay (no overlapping runs), last good
   value kept, interrupt handled on shutdown.
3. Any finding has a concrete failure scenario and a plausibility label; THEORETICAL findings are MINOR or
   lower. A POSSIBLE scenario such as "a slow service makes one cycle take up to ~5 minutes" is acceptable
   only if checked against AC-4 (10 minutes), so it should be at most MINOR.
4. No heavy machinery (circuit breaker, bulkhead framework, message queue) is proposed as a required fix.
FAIL if any finding is BLOCKING, or if a MAJOR finding lacks a LIKELY or POSSIBLE scenario with real impact.
