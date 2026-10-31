---
name: Weekly consultation duration
description: Doctor-level per-patient choice in one editing context, with explicit legacy replacement.
---

Consultation duration means time per patient for the selected doctor, consistent across sessions in the edited week. Working-day state and session windows remain independent by weekday.

**Why:** The user clarified that a 30-minute duration can yield six consultations in 10:00–13:00 and four in 19:00–21:00 before existing break/capacity rules. The reference's repeated duration controls do not authorize independent morning/evening choices.

**How to apply:** Treat repeated weekday selectors as the same week-scoped choice, not a global doctor-profile migration. Retain heterogeneous saved durations on load and unrelated edits; replacing them requires explicit choice and confirmation. Never normalize other locations or contexts automatically.

Successful weekdays remain saved when another weekday fails.

**Why:** The user explicitly accepts existing partial-save/retry behavior; one Save Schedule action does not mean an atomic weekly transaction.

**How to apply:** Preserve existing per-session persistence and response-based retry reconciliation. Onboarding remains draft-only until Finish.
