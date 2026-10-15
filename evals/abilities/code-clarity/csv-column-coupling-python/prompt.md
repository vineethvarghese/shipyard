---
name: csv-column-coupling-python
description: >
  Code-reviewer finds CSV column order duplicated across writer and reader (hidden coupling) and rates it
  MAJOR, not BLOCKING.
tags: [ability, code-clarity]
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
Feature-branch: feature/invoice-export
Slice-branch: feature/invoice-export-slice-01
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

Objective: export invoices to CSV nightly and allow re-importing an export.
- AC-1: The nightly job writes all invoices, including voided ones, to a gzip-compressed CSV file.
- AC-2: Each row holds id, issue date (ISO 8601), amount in cents, status and customer reference.
- AC-3: `csv_reader` can read an export back into `Invoice` objects with the same field values.

#### PROJECT.md — Key terminology (excerpt)

- Invoice: a bill issued to a customer. Fields: id, issued_on, amount_cents, status, customer_ref.

### Diff

```diff
diff --git a/src/export/csv_writer.py b/src/export/csv_writer.py
new file mode 100644
--- /dev/null
+++ b/src/export/csv_writer.py
@@ -0,0 +1,13 @@
+import csv
+import gzip
+
+
+def export_invoices(invoices, out, include_voided, gzip_output):
+    rows = []
+    for inv in invoices:
+        if inv.status == "voided" and not include_voided:
+            continue
+        rows.append([inv.id, inv.issued_on.isoformat(), inv.amount_cents, inv.status, inv.customer_ref])
+    stream = gzip.open(out, "wt", newline="") if gzip_output else open(out, "w", newline="")
+    with stream as f:
+        csv.writer(f).writerows(rows)

diff --git a/src/importer/csv_reader.py b/src/importer/csv_reader.py
new file mode 100644
--- /dev/null
+++ b/src/importer/csv_reader.py
@@ -0,0 +1,17 @@
+import csv
+from datetime import date
+
+from src.model import Invoice
+
+
+def process(data):
+    result = []
+    for row in csv.reader(data):
+        result.append(Invoice(
+            id=row[0],
+            issued_on=date.fromisoformat(row[1]),
+            amount_cents=int(row[2]),
+            status=row[3],
+            customer_ref=row[4],
+        ))
+    return result

diff --git a/src/jobs/nightly.py b/src/jobs/nightly.py
--- a/src/jobs/nightly.py
+++ b/src/jobs/nightly.py
@@ -18,3 +18,3 @@
 def run_nightly(repo):
     invoices = repo.all_invoices()
-    pass
+    export_invoices(invoices, "exports/invoices.csv.gz", True, True)
```
