---
name: Query observer tests
description: Difference between raw TanStack observers and React's optimistic render results.
---
When two raw observers are constructed before subscribing, starting a stale refresh through the first can leave the second observer's cached result showing idle until the next query state transition. Recompute its result after subscription when checking the current in-flight state.

**Why:** This looks like broken refresh/cancellation logic, but the shared query is already fetching. React hooks additionally read optimistic results during rendering, so raw observer tests must account for that difference.

**How to apply:** In shared-observer tests, explicitly update observer results after subscribing or read the optimistic result. Do not change production fetching behavior merely to satisfy a stale raw observer snapshot.
