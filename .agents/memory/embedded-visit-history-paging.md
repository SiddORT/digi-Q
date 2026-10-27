---
name: Embedded visit history paging
description: Why private visit history needs a two-part cursor while events remain in appointment JSON
---

Private visit history pages should use the normalized event instant plus its original array position as the ordering key. The separate operational appointment-history relation is not a substitute for the richer display events embedded in the visit.

**Why:** Recorded events can share a timestamp, and new events are appended to the JSON array. A time-only cursor loses ties; an offset cursor can repeat or skip rows after an append. Original array position resolves ties without exposing actor or ordering IDs to clients.

**How to apply:** Keep exact-visit permission checks before any history page, project only actors on that page, and preserve a distinct missing-history state for legacy visits.
