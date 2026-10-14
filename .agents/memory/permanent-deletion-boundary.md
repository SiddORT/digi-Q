---
name: Permanent staff deletion boundary
description: User-selected data preservation and implementation approval boundary for staff deletion.
---

Permanent staff deletion is user-owned data only: erase the account, credentials and exclusively personal activities; preserve shared clinics, patient records, appointments, clinical documents and other staff accounts. Anonymize identity references rather than deleting shared records. The user requested role-specific warnings and an explicit option to hand off a doctor's open care to a new or existing doctor, or a Clinic Admin's responsibilities to an eligible replacement, with system-wide consistency checks to prevent orphaned relationships.

**Why:** The user explicitly selected this data boundary, then requested corrective cleanup and selectable handoff rather than a blocker-only flow. They did not authorize automatic transfer or shared-record deletion.

**How to apply:** Keep permanent deletion separate from existing deactivation and retain native PostgreSQL authentication. Require separately reviewed transfers and fresh deletion impact. Do not infer permission to delete shared files from their uploader's identity or that all historical visits imply an ongoing doctor-patient assignment.

For a doctor's open-visit handoff, the user accepted keeping existing visit-based patient access: the receiving doctor gets the same-clinic profile/document access already conferred by a valid visit, but no cross-clinic access. Full-plan implementation approval is recorded below.

**Why:** The user chose the recommended existing rule after its practical effect was explained.

**How to apply:** Test both doctors' access before and after handoff/deletion without widening the app's ordinary visit-based authorization.

The revised deletion plan received explicit implementation approval, including preserved clinical-document contents and visible account-removed/file-cleanup-pending status. This does not authorize deleting real accounts or deploying.

**Why:** The user first required approval, then approved the full revised plan after choosing the existing visit-based handoff access rule.

**How to apply:** Implement the approved scope as a complete safety-coherent feature with disposable fixtures only; do not delete real accounts or deploy under this approval.

Do not make unproven legacy notification history deletable merely by signing its present metadata. Unknown historical envelopes must stay blocked until original ownership can be established.

**Why:** A new signature proves that today's metadata was signed, not that it describes all earlier recipients, staff subjects or encrypted snapshots. Guessing would risk either retaining erased identity or deleting unrelated shared history.

**How to apply:** Preserve the fail-closed review boundary during future history backfills and reconciliation work; require trustworthy source evidence for every retained historical envelope. An original signed archive can restore a lost capture proof, but an unsigned older backup cannot become proven just because it is available.

History reconciliation implementation is approved; real-data reconciliation and cleanup still require separate explicit approval.

**Why:** The user approved building the review process after being told it would not automatically clean up real data or bypass deletion safety checks.

**How to apply:** Use disposable sources for development and testing. Never interpret implementation approval as permission to import a real archive, restore live ownership proofs or remove an account.

Treat the rare removal write boundary as an explicit safety tradeoff, not a template for ordinary requests. Busy pre-existing writers must cause a bounded conflict, not partial-lock waiting across the legacy application's mixed lock orders.

**Why:** Waiting while holding some table/advisory locks can deadlock with ordinary writers that acquire them in a different order.

**How to apply:** Keep credential/role ordering and fail-fast graph acquisition consistent. Any narrower future locking design must preserve exact live impact and late-writer protections.
