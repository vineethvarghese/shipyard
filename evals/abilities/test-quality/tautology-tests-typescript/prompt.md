---
name: tautology-tests-typescript
description: >
  Code-reviewer flags a missing AC test (expiry) and needless tests (tautologies, smoke noise, count-only,
  test-only export), owned by the verifier.
tags: [ability, test-quality]
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
Feature-branch: feature/discount-codes
Slice-branch: feature/discount-codes-slice-01
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

Objective: shoppers can apply a percentage discount code to a cart.
- AC-1: A valid code reduces every item's price by its percentage (at most 50%).
- AC-2: A code is valid through the end of its `validUntil` day (UTC); after that it is rejected with
  `CODE_EXPIRED`.
- AC-3: An unknown code is rejected with `CODE_UNKNOWN`.

### Diff

```diff
diff --git a/src/discount.ts b/src/discount.ts
new file mode 100644
--- /dev/null
+++ b/src/discount.ts
@@ -0,0 +1,25 @@
+export const MAX_PERCENT = 50;
+
+export interface Item { sku: string; priceCents: number }
+export interface Code { code: string; percent: number; validUntil: string } // YYYY-MM-DD, UTC
+export type Result = { ok: true; items: Item[] } | { ok: false; error: "CODE_EXPIRED" | "CODE_UNKNOWN" };
+
+let codes = new Map<string, Code>();
+
+export function loadCodes(list: Code[]): void {
+  codes = new Map(list.map((c) => [c.code, c]));
+}
+
+// Only used by tests.
+export function _resetCodesForTests(): void {
+  codes = new Map();
+}
+
+export function applyDiscount(items: Item[], code: string, now: Date): Result {
+  const c = codes.get(code);
+  if (!c) return { ok: false, error: "CODE_UNKNOWN" };
+  const endOfDay = new Date(`${c.validUntil}T23:59:59.999Z`);
+  if (now > endOfDay) return { ok: false, error: "CODE_EXPIRED" };
+  const pct = Math.min(c.percent, MAX_PERCENT);
+  return { ok: true, items: items.map((i) => ({ ...i, priceCents: Math.round(i.priceCents * (100 - pct) / 100) })) };
+}

diff --git a/tests/discount.test.ts b/tests/discount.test.ts
new file mode 100644
--- /dev/null
+++ b/tests/discount.test.ts
@@ -0,0 +1,40 @@
+import { describe, it, expect, beforeEach } from "vitest";
+import { applyDiscount, loadCodes, MAX_PERCENT, _resetCodesForTests } from "../src/discount";
+
+const items = [
+  { sku: "a", priceCents: 1000 },
+  { sku: "b", priceCents: 2000 },
+  { sku: "c", priceCents: 3000 },
+];
+const now = new Date("2026-03-01T12:00:00Z");
+
+describe("applyDiscount", () => {
+  beforeEach(() => {
+    _resetCodesForTests();
+    loadCodes([{ code: "TEN", percent: 10, validUntil: "2026-12-31" }]);
+  });
+
+  it("module exports applyDiscount", () => {
+    expect(typeof applyDiscount).toBe("function");
+  });
+
+  it("MAX_PERCENT is 50", () => {
+    expect(MAX_PERCENT).toBe(50);
+  });
+
+  it("returns 3 items", () => {
+    const r = applyDiscount(items, "TEN", now);
+    expect(r.ok && r.items.length).toBe(3);
+  });
+
+  it("applies a 10% discount to every item", () => {
+    const r = applyDiscount(items, "TEN", now);
+    expect(r).toEqual({ ok: true, items: [
+      { sku: "a", priceCents: 900 }, { sku: "b", priceCents: 1800 }, { sku: "c", priceCents: 2700 },
+    ] });
+  });
+
+  it("rejects an unknown code", () => {
+    expect(applyDiscount(items, "NOPE", now)).toEqual({ ok: false, error: "CODE_UNKNOWN" });
+  });
+});
```
