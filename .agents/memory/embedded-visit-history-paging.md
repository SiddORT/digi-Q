---
name: Embedded visit history paging
description: Why private visit history needs a two-part cursor while events remain in appointment JSON
---

Private visit history pages should use the normalized event instant plus its original array position as the ordering key. The separate operational appointment-history relation is not a substitute for the richer display events embedded in the visit.

**Why:** Recorded events can share a timestamp, and new events are appended to the JSON array. A time-only cursor loses ties; an offset cursor can repeat or skip rows after an append. Original array position resolves ties without exposing actor or ordering IDs to clients.

**How to apply:** Keep exact-visit permission checks before any history page, project only actors on that page, and preserve a distinct missing-history state for legacy visits.

Do not assume the disposable test server's PostgreSQL version matches an external
UAT server, or describe a locally reproduced history-query fix as a hosted repair.

**Why:** A local PostgreSQL-16 test environment can conceal unsupported SQL
functions on older installations; an external host may have no diagnostic
connection in the development fork.

**How to apply:** Test the declared database compatibility baseline explicitly.
For hosted claims, correlate an authorized detail response, a sanitized server
exception and the version of that same database; otherwise keep the hosted
diagnosis unverified.
