---
name: DigiQ standardization decisions
description: User-confirmed specification source, display-format ownership, and warning presentation.
---

Treat the DigiQ standardization prompt itself as the user's approved design specification. List conflicts for the user to decide rather than silently resolving them against older specifications.

**Why:** The user explicitly clarified that the approved design specs are in the prompt and requested each conflict before deciding.

**How to apply:** Use explicit values from the prompt. Distinguish missing referenced values from contradictions; do not invent missing tokens.

The user approved a compact, data-first workspace revision: narrower/collapsible sidebar, consolidated listing toolbars, reduced vertical spacing and row padding, and collapsed secondary panels.

**Why:** The user wants more actual data visible rather than space consumed by stacked controls and navigation. This deliberately supersedes the earlier 245px sidebar and 24px workspace-padding dimensions.

**How to apply:** Apply density changes to workspace listings while preserving readability, accessible controls, responsive behavior, forms, public booking, printed tickets and QR geometry.

Completion must cover the prompt's cross-cutting requirements as well as the numbered findings. A zero-pending finding register is not full-prompt acceptance.

**Why:** A later comparison found omitted weekly-editor, dropdown, patient-form and visual-standard requirements despite the earlier register reporting no local implementation gaps.

**How to apply:** Reconcile each prompt section separately and distinguish implementation, scoped tests, browser acceptance and live-system proof.

Proposed schedule limits are not approved hard limits; four daily sessions is only a soft recommendation. Existing dated exceptions do not authorize bypassing clinic opening-hour restrictions.

**Why:** The prompt preserves existing scheduling rules and requires approval for new limits or exception powers.

**How to apply:** Keep server rules authoritative; do not introduce UI count caps or describe already-supported dated exceptions as a missing data model.

Date/time display preferences belong to the parent clinic entity and are inherited by its locations; each location retains its own timezone.

**Why:** The user selected parent-level format ownership with location-specific timezones.

**How to apply:** Keep display formatting ownership separate from the timezone used to interpret a location's schedules.

Use friendly in-app warnings, not JavaScript pop-ups.

**Why:** The user explicitly requested warnings presented through the app UI.

**How to apply:** Replace in-app alert/confirm/prompt interactions with app dialogs. Do not claim a custom dialog can intercept browser tab closure or reload; that browser-level limitation still requires a separate decision if unload protection is requested.

Use a universal phone country-code dropdown so users enter the local number separately. Clinic timezone and date/time configuration may be changed only by Clinic Admin or Super Admin, not ordinary doctors or staff.

**Why:** The user explicitly requested consistent entry throughout the app and administrator-owned clinic configuration.

**How to apply:** Apply across forms, including edits and onboarding. Do not infer that this locks patients' or staff members' personal contact details.

The user wants predefined booking, clinic-onboarding, rescheduling, post-checkout thank-you and one-hour-before-appointment reminder emails, plus detailed module/action permission visibility for Super Admin.

**Why:** These are explicit requested workflow capabilities, not a claim that current templates, scheduling or permission-editor UI already implement them.

**How to apply:** Distinguish existing role enforcement from a configurable permission matrix. Resolve queue-versus-fixed appointment timing before promising precisely timed reminders. Preserve solo Clinic Admin-doctor and staffed-clinic operation.

Super Admin management modules must be visible in navigation. Both Super Admin and Clinic Admin must be able to manage notification templates, including logos and prefixes. Super Admin can work with dynamic variables; Clinic Admin should see actual clinic names/details in readable previews.

**Why:** The user explicitly approved the expanded management/template scope and requested visible modules, correct mappings, frequent coding progress and regression checks without making the system unresponsive.

**How to apply:** Scope clinic edits to owned clinics. Resolve appointment-specific recipient/doctor details at send time rather than freezing preview values into templates. Report completed, in-progress and blocked work distinctly; verify existing flows before claiming completion.

Uniform elements and styling are part of the entire approved scope: the same function must use the same control and interaction across and within pages, not a toggle in one place and a dropdown elsewhere.

**Why:** The user explicitly reinforced this requirement and requested analysis before coding.

**How to apply:** Inventory all callers and control states before changing shared controls. Distinguish a status-editing toggle from a status filter or read-only badge; preserve those semantic differences while standardizing their respective patterns.

Custom roles are restrictive specializations of existing staff roles, not independent cross-clinic privilege grants. Multiple restrictions combine; clinic-ambiguous operations fail closed.

**Why:** Named roles must not weaken the existing clinic ownership and workflow boundaries or turn an unscoped request into a restriction bypass.

**How to apply:** Keep effective-permission explanations conditional on built-in authorization, and do not label an unrestricted capability as unconditional record access.