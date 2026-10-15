---
type: llm
---

PASS only if all of these hold in the final message:
1. A finding identifies the N+1 pattern: two queries per order (customers and order_items) inside the for-loop
   in src/orders/list.ts, i.e. up to 400 extra sequential round trips per request.
2. It states a workload assumption drawn from the material (200 orders per page and/or ~50 requests per second,
   ~1 ms per round trip) and connects it to AC-2's 150 ms target.
3. It is rated MAJOR or BLOCKING (BLOCKING is acceptable because AC-2 gives a hot-path target the code cannot
   plausibly meet: ~400 ms of round trips vs 150 ms).
4. Required resolution proposes batching (one query with `IN (...)`/`ANY($1)` or a join) for customers and items.
5. It names a measurement or benchmark that would settle it (e.g. benchmark listOrders with 200 orders, p95 <
   150 ms), as a test to add for the verifier or in the evidence.
FAIL if the N+1 is missed, if no workload or measurement is given, or if the review is dominated by
speculative micro-optimisations without evidence.
