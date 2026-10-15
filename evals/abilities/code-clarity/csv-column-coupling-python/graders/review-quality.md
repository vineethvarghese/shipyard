---
type: llm
---

PASS only if all of these hold in the final message:
1. A finding identifies that the CSV column order is encoded twice — as the list in
   src/export/csv_writer.py (the `rows.append([...])` line) and as positional indexes `row[0]`..`row[4]` in
   src/importer/csv_reader.py — with no shared definition and no header row, so changing one silently breaks the
   other (hidden coupling / information leakage / change amplification).
2. That finding is rated MAJOR (MINOR is acceptable only if the reasoning explains why), not BLOCKING, because
   the two files currently agree and no failing input exists.
3. Its Required resolution is a concrete minimum fix, such as one shared column definition plus a header row
   read by name.
4. At least one other clarity issue is mentioned at MINOR or NOTE: the positional boolean flags in
   `export_invoices(invoices, "...", True, True)` or the vague name `process(data)`.
5. Findings use the Shipyard finding format with exact file locations and evidence.
FAIL if the coupling is missed, if any clarity finding is BLOCKING without naming a concrete failing input, or
if findings are vague ("hard to read") with no location or cost.
