---
name: Booking history paging compatibility
description: Why owner booking history retains numeric paging despite deep-offset cost.
---

Keep the existing numeric-page booking email history contract unless API and
client changes are explicitly in scope. Treat deep-page offset work separately
from growth in unrelated clinics' history.

**Why:** The history optimization was authorized to preserve the API and durable
email outcomes, not introduce a cursor or resend operation. An ordered clinic
index removes global scan/sort work but cannot eliminate skipped-row work for
arbitrarily deep numeric pages.

**How to apply:** Measure actual query plans with skewed selected-clinic history.
Do not claim an indexed OFFSET read is constant-cost. Propose cursor migration
separately when per-clinic histories justify changing the contract.
