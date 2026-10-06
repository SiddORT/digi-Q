---
name: Uniform user journeys
description: Shared flows across roles, doctor schedule authority, and compact India-first address controls.
---

The same function must have a consistent user journey across users and roles, rather than separate role-specific journeys. Permissions remain distinct.

**Why:** The user explicitly corrected role-by-role journey design and wants simplification.

**How to apply:** Organize proposed checklists by shared rules and pages, stating applicable users; reuse flows with scoped choices rather than different steps.

Doctor times are entered directly as the doctor schedule, not through a separate time-entry and schedule-creation process. Date exceptions remain separate. Doctor intervals outside ordinary location hours must be accepted with a warning, not an error (including earlier starts and later finishes).

**Why:** Clinics can extend hours for a doctor; the user gave location 9 AM–5 PM and doctor 8 AM–12 PM plus 3–6 PM as a valid example.

**How to apply:** Apply the rule to both schedule saving and downstream availability/booking, not merely UI validation. Preserve genuine conflict and explicit closure protections.

Default new country selections to India and use compact country codes rather than full country names in selected controls. Provide state/city dropdowns and PIN code entry.

**Why:** The user wants consistent address entry and no multiline country labels.

**How to apply:** Preserve existing saved countries; distinguish address country code IN from telephone calling code +91. API-backed lookup is requested for assessment, not yet a chosen provider.
