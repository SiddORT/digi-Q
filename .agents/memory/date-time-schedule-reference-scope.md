---
name: Date/time and schedule reference scope
description: User-required reference layouts and strict scope for the staff, notifications, branch-login and picker review.
---

Keep this review strictly to Add Staff/Receptionist, email/SMS event notifications, branch-wise login, and date/time/schedule controls across all applicable pages and roles. Do not expand it into unrelated remediation.

Use the user's three screenshot references for date/time and schedule structure, layout and UX: range calendar, calendar with time-selection columns, and expandable weekday rows with on/off controls and multiple time intervals. Preserve the app's existing colours and visual styling.

**Why:** The user explicitly repeated the scope restriction and distinguished reference layout/UX from colours/styles.

**How to apply:** Cover all applicable pages and roles, not just pictured pages. Provide a numbered page-wise checklist for confirmation before coding. Do not infer natural-language date parsing, hotel pricing, or new role permissions from the screenshots.

The user approved email/SMS support for existing events plus queue alerts (patient-called and approaching-turn), with configurable channels and recipients.

**Why:** The user selected “Existing events plus queue alerts” when asked which notification events to implement.

**How to apply:** Include queue alerts in implementation scope without enabling unsolicited real-recipient delivery during development or treating provider acceptance as confirmed receipt.

Place branch selection in the top-right workspace header near notifications, not on sign-in. Show a selector for staff/doctors assigned to two or more accessible locations, and a fixed label for one.

**Why:** The user proposed the header location and explicitly selected “Two or more locations.”

**How to apply:** Preserve permissions, validate remembered selections, protect unsaved work, and keep operational pages consistent with the selected branch.
