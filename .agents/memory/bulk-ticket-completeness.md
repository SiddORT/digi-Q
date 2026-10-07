---
name: Bulk ticket completeness
description: Why bulk ticket documents require all-or-nothing preparation.
---
Bulk ticket documents must not download a successful subset when a selected appointment's QR fails or is unavailable.

**Why:** The user explicitly requires that no partial or mismatched download escapes a multi-ticket export. A shorter document can appear successful while leaving selected patients without tickets.

**How to apply:** Preserve this requirement when changing bulk PDF or print preparation. Do not apply it indiscriminately to CSV or cancellation actions, which have different partial-result semantics.
