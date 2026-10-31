---
name: Ticket interaction contract
description: Approved ticket action ownership and count-based waiting semantics.
---

Ticket actions in an Appointments view share one scoped operation lifetime.
Collapsing a visit or switching its section must not discard an in-flight send,
its request identity or an uncertain result. Account/view transitions must not
attach those results to a different booking.

**Why:** The user approved identical ticket actions in the row menu and Booking
ticket area, explicitly preserving unknown-outcome duplicate protection.

**How to apply:** Keep reusable standalone consumers locally scoped; do not solve
tab unmounting with global application state or cross-tab send history.

Approximate queue wait is the current patients-ahead count multiplied by the
configured duration. An active patient ahead counts in full; elapsed consultation
time must not reduce it. The assigned token is not the patients-ahead count.

**Why:** The user explicitly chose the count-based estimate (three ahead at
30 minutes means about 90 minutes; two means about 60), not an elapsed-time model.

**How to apply:** Keep session start, breaks, closing and uncertain/offline
guidance explicit and separate from that multiplication. Never turn the estimate
into a promised consultation time or expose configured duration on public links.
