---
name: Reports product scope
description: User-approved reporting direction and expanded analytics intent.
---

The user accepted separate Live Reports and Report Templates tabs: templates open reports against current data rather than implying saved execution history.

**Why:** The user proposed both tabs and acknowledged the distinction between reusable templates and frozen results.

**How to apply:** Preserve separate Communication Usage access. Do not treat a template as a completed report run.

The user wants report templates covering SMS/email usage per user and clinic, reschedule counts, clinic patient comparisons, and doctor patient volume, time and cancellations.

**Why:** The user wants to identify which clinic has the most patients and which doctors handle more patients, alongside operational and communication activity.

**How to apply:** Define ambiguous metrics before implementation; distinguish unique patients from visits, actual durations from scheduled capacity, and observed communication activity from confirmed delivery. Missing historical evidence must remain explicit.

The user instructed: “use existing ui ux standards, no duplicate code or styling.”

**Why:** The user explicitly required reuse when authorizing the Reports implementation.

**How to apply:** Reuse the existing listing, form, date, lookup, dialog, saved-view, table-column and Communication Usage components. Add only report-specific composition and analytics rather than parallel UI primitives.

Reports filter editing is drawer-only; applying filters must not automatically save a persistent named view.

**Why:** The user explicitly superseded the earlier Reports reference's inline dropdowns and kept explicit saved-view functionality separate.

**How to apply:** Keep compact readable pills as drawer entry points, draft all report filter edits until Apply, and preserve pinned/read-only workspace restrictions. This approval is bounded to Reports, not an app-wide filter redesign.
