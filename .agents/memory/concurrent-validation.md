---
name: Concurrent validation readiness
description: Distinguish loaded-runner setup timeouts from product assertion failures.
---
Check the configured concurrent validation run, not only isolated command success, when assessing test reliability.

**Why:** The same unchanged ticket and PostgreSQL checks passed sequentially but hit initialization, page-load and overall-test deadlines when completion validation ran them together.

**How to apply:** Inspect the failure location and preserve assertions and retry policy. Give cold compilation and PDF rendering reasonable bounded setup/test budgets rather than bypassing checks or changing product behavior to address runner load.

Isolated browser fixtures need separate dependency-optimizer caches from the running app, and concurrent browser runs must not share an output directory.

**Why:** The app and fixture servers can invalidate each other's Vite optimized dependencies, causing 504 responses before rendering. Concurrent Playwright runs also delete each other's trace files and produce misleading missing-file failures.

**How to apply:** Keep fixture optimizer caches separate. Do not launch a focused browser run into the same report/output directory while a configured browser validation is running. Before completion validation, stop any duplicate browser-test workflow using the same fixed fixture port; otherwise the validation can fail with “already used” before any assertions run.

Reusing another test run's fixture server does not transfer its lifetime to the new run.

**Why:** The owning run can finish and stop the server while the second run is still testing, producing connection refusals unrelated to application behavior.

**How to apply:** Let the owning run finish before starting focused checks, or use independently owned ports and output directories. Do not treat `reuseExistingServer` as isolation.
