---
name: nightly-report-sql
description: >
  False-positive check: a correlated subquery in a nightly report over small, indexed tables must not be rated
  BLOCKING.
tags: [ability, performance]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

Use the `shipyard:code-reviewer` agent to review the slice below and give me its review in Shipyard finding format.

Start the agent's prompt with this brief, then paste everything under "Slice material" below it unchanged:

```text
Caller: shipyard:coordinator
Mode: SLICE
Slice: 01
Round: 0
Feature-branch: feature/admin-reports
Slice-branch: feature/admin-reports-slice-01
Diff: inline below (evaluation run: the workspace has no repository)
Read: inline below
Write: none (evaluation run): return every finding inline in your final message
Budget: 12 turns
```

This is an evaluation run in an empty workspace: there is no git repository and no `.ai/` folder, so the slice
spec, the relevant planning excerpts and the diff are all inline. Tell the agent to review only what is shown and
not to look for files. Report each finding as one block with the lines `ID:`, `Severity:`, `Category:`, `Location:`, `Finding:`,
`Why it matters:`, `Evidence:`, `Required resolution:`, `Confidence:`, `Owner:`, `Status:` (the Shipyard
finding format), or the single line `NO FINDINGS`.

When the agent returns, repeat its findings verbatim in your final answer (do not summarise or re-rate them).

## Slice material

#### SLICE.md (excerpt)

Objective: a nightly admin report of active subscriptions per plan.
- AC-1: The report lists every plan with its count of active subscriptions, sorted by plan name.
- AC-2: The report runs once a night at 02:00 from the existing job scheduler and writes a CSV for admins.

#### PROJECT.md — Scale (excerpt)

- `plans` has 12 rows and changes a few times a year. `subscriptions` has about 3,000 rows and grows by about
  100 a month. No user-facing request runs this query.

### Diff

```diff
diff --git a/db/migrations/0042_subscriptions_plan_index.sql b/db/migrations/0042_subscriptions_plan_index.sql
new file mode 100644
--- /dev/null
+++ b/db/migrations/0042_subscriptions_plan_index.sql
@@ -0,0 +1,1 @@
+CREATE INDEX idx_subscriptions_plan_status ON subscriptions (plan_id, status);

diff --git a/reports/plan_summary.sql b/reports/plan_summary.sql
new file mode 100644
--- /dev/null
+++ b/reports/plan_summary.sql
@@ -0,0 +1,9 @@
+-- Nightly admin report (AC-1). Runs once at 02:00 (AC-2).
+SELECT p.id,
+       p.name,
+       (SELECT COUNT(*)
+          FROM subscriptions s
+         WHERE s.plan_id = p.id
+           AND s.status = 'active') AS active_subscriptions
+  FROM plans p
+ ORDER BY p.name;

diff --git a/jobs/schedule.yaml b/jobs/schedule.yaml
--- a/jobs/schedule.yaml
+++ b/jobs/schedule.yaml
@@ -7,3 +7,7 @@
 jobs:
   - name: invoice-reminders
     cron: "0 6 * * *"
+  - name: plan-summary-report
+    cron: "0 2 * * *"
+    run: reports/plan_summary.sql
+    output: exports/plan_summary.csv
```
