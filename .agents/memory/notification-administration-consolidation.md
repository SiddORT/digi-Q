---
name: Notification administration consolidation
description: Approved scope of combining existing delivery controls with notification wording administration
---

The user approved composing the existing overall delivery gate and event activation
controls into the canonical Notifications page. This supersedes the earlier
restriction against composing those controls with template management.

**Why:** The user wants one administrative notification destination, not repeated
delivery-management screens or another settings layer.

**How to apply:** Reuse existing saved-policy and template mechanisms. Keep provider
configuration/diagnostics and read-only logs separate, preserve personal preferences
without restoring the removed preferences interface, and do not widen Clinic Admin
activation/SMS/provider permissions. This approval does not authorize a backend
redesign, changed defaults, migration, live message, production setting change or
deployment.

Bulk event activation describes and verifies the entire unfiltered event, but
only writes optional rows whose activation must change.

**Why:** Rewriting already-correct inherited options creates unnecessary local
overrides, silently freezing their future inheritance. The user's group action
must not alter the overall gate or imply provider readiness.

**How to apply:** Exclude required messages, capture all event rows for stale-data
checks, retain untouched inheritance, and verify the complete target after the
atomic save before claiming success.
