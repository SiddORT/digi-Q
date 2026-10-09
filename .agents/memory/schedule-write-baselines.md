---
name: Schedule write baselines
description: Optimistic authoring checks and partial-save reconciliation without silent overwrites
---

Per-session optimistic checks are intentionally additive and backward compatible;
do not turn them into a new atomic weekly service or require a database revision
migration without authorization.

**Why:** The schedule-management scope explicitly preserves existing per-session
storage, services, doctor-lock ordering and older clients.

**How to apply:** Modified editors carry the loaded authoring baseline and let
the locked server reject stale edits. A background read is not consent to discard
that baseline.

After a partial save, rebase only successful records from their own write
responses, retaining original baselines for failures. Reconcile returned create
identities even when the post-save reload fails.

**Why:** A post-write refetch can contain another administrator's later changes.
Adopting that newer baseline while retaining the older draft hides the conflict
on retry. Omitting successful create identities can duplicate sessions.

**How to apply:** Keep failed changes retryable without automatically rebasing
them. Whole-success refreshes may rebuild the displayed saved state.
