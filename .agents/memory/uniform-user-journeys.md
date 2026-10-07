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

**How to apply:** Preserve existing saved countries; distinguish address country code IN from telephone calling code +91. The subsequently approved Section C requests PIN assistance after provider assessment, with explicit locality choice, manual fallback and cached reference data. Never silently use a district or post-office name as a city.

Use shared defaults, components and styling throughout these sections; do not duplicate features or UI for different entry points.

**Why:** The user explicitly reinforced seamless uniformity when authorizing all remaining sections.

**How to apply:** Reuse the shared address, booking, patient-entry and schedule controls rather than maintaining parallel implementations.

Place equivalent controls in consistent positions across pages. Avoid repeated counts/context and size fields by their content rather than forcing half-width or full-width layouts. Table check-in/check-out actions should fit their column using compact icons with tooltips.

**Why:** The user identified duplicated location counts, overflowing check-out actions, excessive address help text and wasted form space in screenshots.

**How to apply:** Apply shared placement and compact responsive sizing across applicable roles/pages, preserving readable labels, keyboard access, touch targets and visible critical warnings.

Users & staff must offer Add Staff with a role choice, rather than requiring administrators to find a staff-type filter before creating another role.

**Why:** The user explicitly reiterated the agreed Add Staff journey after finding only Add Doctor. They rejected partial development and completion claims based on component existence.

**How to apply:** Keep permitted roles scoped to the acting user's authority; verify discoverability and the complete create/save/reopen journey, not just the presence of a shared component.

Keep sidebar labels short: use Profile, not Profile & consultation. Consolidate related management functions into tabs with create/edit and enable/disable actions instead of separate pages for small functions.

**Why:** The user explicitly requested a simpler, consistent navigation structure across all users.

**How to apply:** Group related workflows without broadening role permissions; retain distinct workspaces for genuinely different daily tasks. Analyze the system-wide grouping before implementing it.
