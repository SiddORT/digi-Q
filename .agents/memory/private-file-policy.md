---
name: Private file policy
description: Quarantine, retained bytes and staff-erasure boundaries for private uploads
---

Treat private-file release as a security decision separate from type sniffing.
New private attachments are quarantined until an exact-digest offline review is
attested. Public branding keeps its explicit sanitized-image publication policy.

**Why:** No antivirus service or permission to contact a live scanning provider
was supplied for the local foundation; a MIME signature is not malware evidence.

**How to apply:** Do not auto-approve attachments to make an upload/download test
or UI succeed, or describe manual review as an automated scan.

Do not equate soft deletion with personal-byte erasure. Retained clinical files
must preserve uploader anonymization; personal doctor files require a separately
approved byte-erasure policy before permanent staff removal can proceed.

**Why:** Restoration must not undo intentional staff erasure, and no retention
duration or automatic purge policy was authorized.

**How to apply:** Preserve erasure fences and fail closed on personal retained
files. Future retention or erasure work needs explicit policy approval; changing
the default storage driver never authorizes migrating historical bytes.
