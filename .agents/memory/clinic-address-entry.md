---
name: Clinic address entry
description: Product meaning and scope of the optional public clinic address.
---

“Public clinic address” means the clinic's patient-facing URL slug, not an external Website field. Users may omit choosing it during either administrator onboarding or public registration; the clinic still needs a valid available address before creation. Location URL slugs remain required, and existing patient URLs must not change.

**Why:** The user explicitly requested less onboarding work without changing the meaning of clinic addresses or breaking patient links.

**How to apply:** Keep automatic selection limited to blank clinic-level input. Preserve deliberate custom input and require review before another creation attempt after a conflict; never use address generation to bypass uncertain-create receipt recovery.
