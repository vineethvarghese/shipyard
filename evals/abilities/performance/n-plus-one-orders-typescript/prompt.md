---
name: n-plus-one-orders-typescript
description: >
  Code-reviewer finds the per-order queries (N+1) on a hot list endpoint, states the workload, and proposes a
  settling benchmark.
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
Feature-branch: feature/orders-dashboard
Slice-branch: feature/orders-dashboard-slice-01
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

Objective: the dashboard lists the caller's orders with customer name and line items.
- AC-1: `GET /orders?page=n` returns up to 200 orders per page, newest first, each with customer name and items.
- AC-2: p95 latency of `listOrders` stays under 150 ms for a full page of 200 orders (local benchmark).

#### PROJECT.md — Scale (excerpt)

- The dashboard calls `GET /orders` about 50 times per second at peak. Database round trip is about 1 ms.

### Diff

```diff
diff --git a/src/orders/list.ts b/src/orders/list.ts
new file mode 100644
--- /dev/null
+++ b/src/orders/list.ts
@@ -0,0 +1,26 @@
+import type { Db } from "../db";
+
+interface OrderRow { id: string; customer_id: string; total_cents: number; created_at: string }
+interface CustomerRow { id: string; name: string }
+interface ItemRow { sku: string; qty: number }
+export interface OrderView { id: string; customer: string; total: number; items: ItemRow[]; createdAt: string }
+
+export async function listOrders(db: Db, userId: string, page: number): Promise<OrderView[]> {
+  const orders = await db.query<OrderRow>(
+    "SELECT id, customer_id, total_cents, created_at FROM orders WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 200 OFFSET $2",
+    [userId, page * 200],
+  );
+  const views: OrderView[] = [];
+  for (const o of orders) {
+    const [customer] = await db.query<CustomerRow>("SELECT id, name FROM customers WHERE id = $1", [o.customer_id]);
+    const items = await db.query<ItemRow>("SELECT sku, qty FROM order_items WHERE order_id = $1", [o.id]);
+    views.push({
+      id: o.id,
+      customer: customer.name,
+      total: o.total_cents / 100,
+      items: structuredClone(items),
+      createdAt: o.created_at,
+    });
+  }
+  return views;
+}
```
