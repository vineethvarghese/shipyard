---
name: voucher-invariant-java
description: >
  Code-reviewer finds an invariant bypass (negative total, double redemption), a language mismatch (Coupon vs
  Voucher), and a rule placed in the controller.
tags: [ability, domain-design]
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
Feature-branch: feature/vouchers
Slice-branch: feature/vouchers-slice-01
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

Objective: customers can redeem a voucher code on an open order.
- AC-1: `POST /orders/{id}/voucher` with a code reduces the order total by the voucher's fixed amount.
- AC-2: A voucher can be redeemed only once; a second redemption returns 409 VOUCHER_USED.

#### PROJECT.md — Key terminology (excerpt)

- Order: a customer's purchase; holds line items and a total.
- Voucher: a single-use code worth a fixed amount off one order. (The business never says "coupon".)

#### INVARIANTS.md (excerpt)

- INV-004: An order total is never negative.
- INV-005: A voucher is redeemed at most once.

### Diff

```diff
diff --git a/src/main/java/shop/domain/Coupon.java b/src/main/java/shop/domain/Coupon.java
new file mode 100644
--- /dev/null
+++ b/src/main/java/shop/domain/Coupon.java
@@ -0,0 +1,14 @@
+package shop.domain;
+
+import java.math.BigDecimal;
+
+public class Coupon {
+    private String code;
+    private BigDecimal amount;
+    private boolean used;
+
+    public String getCode() { return code; }
+    public BigDecimal getAmount() { return amount; }
+    public boolean isUsed() { return used; }
+    public void setUsed(boolean used) { this.used = used; }
+}

diff --git a/src/main/java/shop/domain/Order.java b/src/main/java/shop/domain/Order.java
--- a/src/main/java/shop/domain/Order.java
+++ b/src/main/java/shop/domain/Order.java
@@ -30,1 +30,3 @@
     public BigDecimal getTotal() { return total; }
+
+    public void setTotal(BigDecimal total) { this.total = total; }

diff --git a/src/main/java/shop/web/OrderController.java b/src/main/java/shop/web/OrderController.java
new file mode 100644
--- /dev/null
+++ b/src/main/java/shop/web/OrderController.java
@@ -0,0 +1,25 @@
+package shop.web;
+
+import shop.domain.Coupon;
+import shop.domain.Order;
+
+public class OrderController {
+    private final OrderRepository orderRepository;
+    private final CouponRepository couponRepository;
+
+    public OrderController(OrderRepository orders, CouponRepository coupons) {
+        this.orderRepository = orders;
+        this.couponRepository = coupons;
+    }
+
+    // POST /orders/{orderId}/voucher
+    public OrderDto applyCoupon(long orderId, String code) {
+        Order order = orderRepository.findById(orderId).orElseThrow(NotFoundException::new);
+        Coupon coupon = couponRepository.findByCode(code).orElseThrow(NotFoundException::new);
+        order.setTotal(order.getTotal().subtract(coupon.getAmount()));
+        coupon.setUsed(true);
+        orderRepository.save(order);
+        couponRepository.save(coupon);
+        return OrderDto.from(order);
+    }
+}
```
