---
name: OpenAPI query export collisions
description: Generated Zod path validators can collide with TypeScript query-param aliases.
---

With the current Orval split-output configuration, adding query parameters to a
path-parameter operation can produce identically named path validators and
query-parameter types in the Zod barrel, causing an ambiguous re-export.

**Why:** The generators succeeded but the shared-library TypeScript build
failed; generating clients alone did not establish a usable contract.

**How to apply:** Inspect both generated exports before changing the barrel or
generator globally. For complex read-only scans, a named body schema on a
read-only POST can avoid the collision without weakening validation. Document
that it performs no writes and run the shared-library build after generation.
