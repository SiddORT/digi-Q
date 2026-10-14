---
name: Structural merge verification
description: Automatic merge success does not establish correct authentication handler placement
---

After a structural merge of shared authentication code, compare the changed handlers with incoming main and run type checks and the affected transport tests.

**Why:** An automatic merge left no conflict markers but inserted registration statements into unrelated login, recovery and patient handlers. Compilation exposed the misplaced bindings; preserving incoming handlers plus the intended dispatch and revision additions restored both features.

**How to apply:** Treat a clean rebase as a mechanical result, not semantic verification. Keep incoming functionality and this task's safety boundaries together; do not accept unrelated handler rewrites just because conflict markers are gone.
