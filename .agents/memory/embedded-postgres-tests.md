---
name: Embedded PostgreSQL test dependencies
description: Workspace dependency placement for PGlite and Drizzle type compatibility
---

Keep the embedded PostgreSQL test dependency at the workspace root rather than adding a separate API-package peer variant.

**Why:** Installing PGlite only in the API package caused duplicate Drizzle peer instances and incompatible types during the listing-query regression work. Root placement resolved the mismatch.

**How to apply:** When changing embedded database test dependencies, check the pnpm peer graph and typecheck database consumers before attributing type errors to query code. Keep fixtures isolated from development and production records.