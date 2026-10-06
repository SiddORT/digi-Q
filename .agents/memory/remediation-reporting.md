---
name: Remediation reporting
description: User expectations for completing the DigiQ testing report without confusing implementation and acceptance.
---

Work through all pending report sections without stopping for approval between already-authorized changes; keep the user updated with progress.

**Why:** The user repeatedly requested full completion and corrected the impression that every point was implemented with only testing left.

**How to apply:** Track confirmed fixes separately from unreproduced failures and acceptance-only checks. General regression tests do not establish closure of individual report points. The user subsequently authorized the listed exact-case protected checks. Use a disposable private database for test identities; permission to test does not authorize creating accounts in their development database, touching real records or sending real emails.

When the user authorizes one checklist section, finish its shared components, custom-page adoption and verification before stopping; do not treat a shared foundation as completion or request permission to finish the same section.

**Why:** The user explicitly objected to a partial Section A delivery and requested completion, while retaining control over starting the next section.

**How to apply:** Give progress updates during the authorized section and stop at its boundary, not at an intermediate implementation milestone.
