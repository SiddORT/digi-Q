---
name: Clinic address entry
description: Product meaning and scope of the optional public clinic address.
---

“Clinic URL name” and “Location URL name” mean patient-facing URL segments, not external Website fields. Users may leave either blank during administrator onboarding or public registration; Continue resolves them before Review. Existing patient URLs must not change.

**Why:** The user explicitly requested less onboarding work without changing the meaning of clinic addresses or breaking patient links.

**How to apply:** Generate only blank inputs from their matching display names. Reserve all explicit location values first; retain resolved values across display-name edits and restored drafts. Preserve deliberate custom input and require review before another creation attempt after a conflict; never use URL generation to bypass uncertain-create receipt recovery.
