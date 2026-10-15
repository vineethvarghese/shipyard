---
type: llm
---

PASS only if all of these hold in the final message:
1. A finding shows INV-004 can be violated: a voucher worth more than the order total makes the total negative,
   because the controller subtracts directly through a new public `setTotal`. Rated BLOCKING or MAJOR with the
   concrete sequence.
2. A finding shows INV-005 / AC-2 is not enforced: `isUsed()` is never checked, so a code can be redeemed twice
   (BLOCKING or MAJOR).
3. The ubiquitous-language mismatch is noted: the code says Coupon/applyCoupon where PROJECT.md says Voucher.
4. The fix places the rules in the domain (e.g. `order.redeem(voucher)` that checks single use and clamps or
   rejects, with setTotal no longer public) rather than adding unrelated ceremony (factories, domain events,
   new repositories).
FAIL if either invariant problem is missed, or if the review's main demand is pattern ceremony with no
invariant or cost named.
