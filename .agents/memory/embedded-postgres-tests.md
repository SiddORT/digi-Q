---
name: Embedded PostgreSQL test dependencies
description: Workspace dependency placement for PGlite and Drizzle type compatibility
---

Keep the embedded PostgreSQL test dependency at the workspace root rather than adding a separate API-package peer variant.

**Why:** Installing PGlite only in the API package caused duplicate Drizzle peer instances and incompatible types during the listing-query regression work. Root placement resolved the mismatch.

**How to apply:** When changing embedded database test dependencies, check the pnpm peer graph and typecheck database consumers before attributing type errors to query code. Keep fixtures isolated from development and production records.

Pass the active transaction connection through nested settings/readiness lookups.

**Why:** Adding a global-connection credential lookup inside a booking transaction stalled the PGlite regressions: the lookup waited outside the transaction that was itself waiting for the lookup. Isolated provider tests did not expose this.

**How to apply:** Helpers called within transactions must accept and reuse the caller's connection. Also extend isolated module doubles when a shared helper gains a database dependency; do not let a unit test accidentally resolve the real database module.

Run the full backend suite serially when it includes disposable native PostgreSQL clusters.

**Why:** Parallel cluster initialization on this container exceeded the harness's initdb timeout, producing environment failures unrelated to the feature under test.

**How to apply:** Use Node's `--test-concurrency=1` for the combined backend suite; keep focused pure-unit runs separate.