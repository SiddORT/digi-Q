---
name: Operational assignment context
description: Saved assignment reuse and the distinction between ordinary operations and assignment management.
---
Daily operations reuse saved ownership and clinical assignments. An existing patient's registration is immutable for ordinary staff even when they manage several locations. Clinic Group and Clinic should be labelled, non-clearable information in that edit.

**Why:** The user explicitly distinguished demographic edits and daily operations from authorised assignment changes. Directory projections can conceal whether access comes from a clinic-wide or branch-only link.

**How to apply:** Fixed context must come from a verified workspace/booking context or a complete unsearched sole-option result, not the first directory row or a URL parameter. A doctor context intersects that doctor's active clinical assignments with the acting user's permissions. Preserve optional all-location meanings and legitimate Super Admin/assignment-management capabilities.

See [Account assignment boundary](account-status-boundary.md) for unchanged mapping safety. Cross-session freshness is bounded polling/focus/navigation, not instantaneous sync; record the measured bound in the verification report.
