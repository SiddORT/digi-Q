---
name: Post-merge verification
description: Setup success does not prove schema synchronization or service readiness.
---

Inspect post-merge stderr and service readiness independently of the setup result.

**Why:** The schema push tool reported an existing-index PostgreSQL error but returned success, allowing later setup steps to finish. Separately, a 20-second total allowance expired after dependency installation consumed 13.6 seconds.

**How to apply:** Allow headroom for cold dependency installation, inspect database-tool output even on zero exit, and verify the managed frontend and API after reconciliation. Do not drop existing indexes simply to make setup pass.
