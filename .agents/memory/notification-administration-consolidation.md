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
without restoring the removed preferences interface. Clinic Admins may manage the
optional-delivery gate and optional event/recipient activation for Email and SMS
only in their currently owned clinic. This does not grant SMS wording, platform
security, Superadmin-recipient or provider access. This approval does not authorize a backend
redesign, changed defaults, migration, live message, production setting change or
deployment.

**Why:** The user explicitly extended Clinic Admin authority to switch unwanted
optional clinic notifications off. This supersedes the prior Superadmin-only
activation restriction, not the other configuration boundaries.

Bulk event activation describes and verifies the entire unfiltered event, but
only writes optional rows whose activation must change.

**Why:** Rewriting already-correct inherited options creates unnecessary local
overrides, silently freezing their future inheritance. The user's group action
must not alter the overall gate or imply provider readiness.

**How to apply:** Exclude required messages, capture all event rows for stale-data
checks, retain untouched inheritance, and verify the complete target after the
atomic save before claiming success.

Super Admin notification administration starts at System Default, even when an
old link contains a clinic selection. Clinic Admins retain owned-clinic-only
selection. Selection alone must never save settings or create overrides.

**Why:** The user explicitly overrode the former deep-link initialization and
wants the system context to be a real selectable entry, not an empty placeholder.

**How to apply:** Keep this rule confined to Notifications. Do not remove clinic
context from unrelated routes or infer wider Clinic Admin permissions.
