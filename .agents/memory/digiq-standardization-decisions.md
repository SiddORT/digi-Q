---
name: DigiQ standardization decisions
description: User-confirmed specification source, display-format ownership, and warning presentation.
---

Treat the DigiQ standardization prompt itself as the user's approved design specification. List conflicts for the user to decide rather than silently resolving them against older specifications.

**Why:** The user explicitly clarified that the approved design specs are in the prompt and requested each conflict before deciding.

**How to apply:** Use explicit values from the prompt. Distinguish missing referenced values from contradictions; do not invent missing tokens.

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