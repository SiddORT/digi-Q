---
name: Concurrent validation readiness
description: Distinguish loaded-runner setup timeouts from product assertion failures.
---
Check the configured concurrent validation run, not only isolated command success, when assessing test reliability.

**Why:** The same unchanged ticket and PostgreSQL checks passed sequentially but hit initialization, page-load and overall-test deadlines when completion validation ran them together.

**How to apply:** Inspect the failure location and preserve assertions and retry policy. Give cold compilation and PDF rendering reasonable bounded setup/test budgets rather than bypassing checks or changing product behavior to address runner load.
