---
name: Inline save evidence
description: A persisted inline save must also establish a clean client baseline without erasing independent drafts.
---

Verify inline save completion by leaving without a discard prompt and reopening
the saved values, not just by checking that the database changed.

**Why:** A real authenticated save persisted correctly while the client still
treated the previous draft as unsaved. Fixture checks initially hid this because
missing request-security setup prevented the save request from being made.

**How to apply:** Wait for UI save completion as well as checking persistence.
Keep fixture writes faithful to native request security, and distinguish failed
request setup from failed saves. An independent account-status action must not
clear unrelated profile edits.
