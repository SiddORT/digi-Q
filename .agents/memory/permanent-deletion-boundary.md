---
name: Permanent staff deletion boundary
description: User-selected data preservation and implementation approval boundary for staff deletion.
---

Permanent staff deletion is user-owned data only: erase the account, credentials and exclusively personal activities; preserve shared clinics, patient records, appointments, clinical documents and other staff accounts. Anonymize identity references rather than deleting shared records. Ownership responsibilities must be explicitly transferred first.

**Why:** The user explicitly selected this data boundary and excluded automatic transfer and shared-record deletion.

**How to apply:** Keep permanent deletion separate from existing deactivation and retain native PostgreSQL authentication. Do not infer permission to delete shared files from their uploader's identity.

The deletion request is planning-only until explicit implementation approval.

**Why:** The user stated “implementation must await approval.”

**How to apply:** A task assignment or acceptance checklist does not override this boundary. Document the design first; do not enable deletion, migrate its schema or operate on real accounts without the applicable approval.
