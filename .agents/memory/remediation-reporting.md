---
name: Remediation reporting
description: User expectations for completing the DigiQ testing report without confusing implementation and acceptance.
---

Work through all pending report sections without stopping for approval between already-authorized changes; keep the user updated with progress.

**Why:** The user repeatedly requested full completion and corrected the impression that every point was implemented with only testing left.

**How to apply:** Track confirmed fixes separately from unreproduced failures and acceptance-only checks. General regression tests do not establish closure of individual report points. The user subsequently authorized the listed exact-case protected checks. Use a disposable private database for test identities; permission to test does not authorize creating accounts in their development database, touching real records or sending real emails.

When the user authorizes one checklist section, finish its shared components, custom-page adoption and verification before stopping; do not treat a shared foundation as completion or request permission to finish the same section.

**Why:** The user explicitly objected to a partial Section A delivery and requested completion.

**How to apply:** Give progress updates and finish the whole section, not only an intermediate implementation milestone. The user subsequently requested continuous development of the remaining agreed sections, one after another, without repeatedly asking them to say “proceed.” Continue across those section boundaries with progress updates.

Cross-check every original section requirement before claiming completion, and distinguish development completion from representative verification or unresolved acceptance coverage.

**Why:** The user explicitly requested this after repeated contradictions about Section A being complete.

**How to apply:** Keep an evidence checklist; do not substitute shared-component adoption or source-string tests for a complete requirement review.

Modernizing legacy screen checks must distinguish obsolete UI assumptions from genuine failures of the remaining acceptance criteria.

**Why:** Once removed toolbar and popup selectors were repaired, the same smoke check exposed real table overflow. Calling the whole script green or relaxing its geometry threshold would have concealed a separate UI defect.

**How to apply:** Verify the current user-visible behavior, retain independent acceptance assertions, and report surviving real failures separately. A tests-only assignment does not authorize changing the UI to make its checks pass.
