---
type: llm
---

PASS only if all of these hold in the final message:
1. There is no BLOCKING finding and no MAJOR performance finding.
2. If the correlated subquery is mentioned at all, the review recognises the workload: a cold path (once a
   night), 12 plans, ~3,000 subscriptions, an index on (plan_id, status); any such finding is NOTE or MINOR and
   states that workload assumption.
3. The review does not demand a rewrite (e.g. GROUP BY join, materialised view, caching) as a required fix
   without evidence that the current query is too slow for this workload.
FAIL if any finding is BLOCKING, or if a MAJOR performance finding is raised without a workload under which it
matters.
