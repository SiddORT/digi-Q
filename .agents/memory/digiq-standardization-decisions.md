---
name: DigiQ standardization decisions
description: User-confirmed specification source, display-format ownership, and warning presentation.
---

Treat the DigiQ standardization prompt itself as the user's approved design specification. List conflicts for the user to decide rather than silently resolving them against older specifications.

**Why:** The user explicitly clarified that the approved design specs are in the prompt and requested each conflict before deciding.

**How to apply:** Use explicit values from the prompt. Distinguish missing referenced values from contradictions; do not invent missing tokens.

Date/time display preferences belong to the parent clinic entity and are inherited by its locations; each location retains its own timezone.

**Why:** The user selected parent-level format ownership with location-specific timezones.

**How to apply:** Keep display formatting ownership separate from the timezone used to interpret a location's schedules.

Use friendly in-app warnings, not JavaScript pop-ups.

**Why:** The user explicitly requested warnings presented through the app UI.

**How to apply:** Replace in-app alert/confirm/prompt interactions with app dialogs. Do not claim a custom dialog can intercept browser tab closure or reload; that browser-level limitation still requires a separate decision if unload protection is requested.