---
name: Publishing database guard changes
description: Schema synchronization alone is not proof that custom PostgreSQL guards reach production
---

Do not assume the managed Publish schema diff includes custom function or trigger-body migrations.

**Why:** The observed Publish diff included ordinary indexes and foreign-key changes but omitted ownership-guard function replacements. Read-only production catalog checks confirmed that the old bodies remained. A working development capability therefore was not ready for production merely because its schema diff was available.

**How to apply:** Compare the proposed diff and read-only production function definitions with the intended migration chain. Missing guard changes remain a rollout blocker until a supported deployment procedure is established; do not hide custom production DDL in startup.

Also compare real development constraints with both declared schema and production before publishing.

**Why:** Development had drifted from its declared guest-request uniqueness constraints, and the first proposed Publish diff would have removed production safeguards without replacements. Safe development reconciliation restored replacement constraints in the proposed diff.

**How to apply:** Inspect both DROP and corresponding ADD statements. Validate pre-existing data before adding uniqueness; preserve records and treat declarations in source as intent, not proof of live database state.

Recheck the live catalog and Publish diff after task merges, even when earlier release checks passed.

**Why:** A later main-workspace check again found declared expression indexes absent, producing production index drops without replacements. The exact cause was not established; a prior clean diff did not remain reliable across intervening work.

**How to apply:** Check index definitions as well as names after development schema synchronization. Fail release readiness when required replacements disappear; never assume a successful merge proves database parity.

Consulting-admin operation need not require replacing the old production functions.

**Why:** Exact historical-guard tests established that an admin can own its own doctor profile while retaining clinic-only admin assignments. The incompatible part was inserting admin branch-assignment rows, not the combined identity itself.

**How to apply:** Keep management ownership separate from the doctor's selected clinical branches and validate effective clinical membership centrally. Preserve ordinary doctor assignment rules, test against both old and new guards, and distinguish inactive-profile management visibility from active clinical eligibility.

The owner approved a reduced release that defers consulting Clinic Admin capability
rather than bypassing the omitted custom-function migration.

**Why:** The current managed production guards reject admin branch assignments;
ordinary clinic-only admin registration can remain compatible without changing
those guards. This is a deliberate feature deferral, not a solved migration.

**How to apply:** Do not re-enable consulting capability as a cosmetic UI fix or
environment toggle. First establish supported custom-function delivery and verify
compatibility, rollback, and production definitions. Keep ordinary doctor and
receptionist workflows available; never delete existing data to meet old guards.