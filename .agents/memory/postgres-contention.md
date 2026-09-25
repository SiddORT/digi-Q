---
name: PostgreSQL contention verification
description: Safety and evidence requirements for concurrent queue regression tests
---

Use a freshly initialized socket-only PostgreSQL cluster for contention tests, never the application's configured development or production database.

**Why:** Promise concurrency on a single embedded PGlite backend cannot demonstrate real connection lock contention; shared database fixtures also risk real patient records.

**How to apply:** Require distinct backend connections and observe all contenders waiting on actual PostgreSQL locks before release. Preserve explicit, isolated connection configuration and bounded waits. Launch order alone does not prove which transaction acquires the lock first.

Ownership/capability tests must also install the real historical constraint-trigger migrations, not just equivalent-looking table definitions.

**Why:** Simplified SQL fixtures accepted a consulting administrator that the live database rejected through an older ownership trigger. Passing service tests did not prove compatibility with the deployed constraints.

**How to apply:** When extending roles or assignment capabilities, exercise immediate and deferred guards with the actual migration chain, including foreign assignments, deactivation and last-owner removal. Keep migration changes explicit; never disable guards to make a new capability pass.