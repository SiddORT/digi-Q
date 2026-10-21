---
name: Clinic metadata vocabulary boundary
description: Why custom clinic descriptions must stay separate from master IDs and personal doctor specialization
---

Clinic categories and specialities are clinic-owned descriptions. Custom entry
must remain separate from global master IDs and must never infer or overwrite
the owner's personal doctor specialization.

**Why:** The requested onboarding contract explicitly permits custom clinic
vocabulary without granting ordinary owners global vocabulary creation or
claiming professional qualifications.

**How to apply:** Preserve explicit standard/custom representations on future
clinic editors and imports. Equivalent master provisioning must preserve IDs,
operator-managed labels and intentional inactive decisions, not restore or
reclassify existing values. Keep custom entry usable during catalog failures.

Normalization during onboarding must not mutate the original request used for
the actor-scoped completion fingerprint.

**Why:** Whitespace trimming, duplicate normalization or implicit category
replacement can otherwise make the exact submitted retry look like a different
request after a successful commit.

**How to apply:** Normalize a copy for persistence, leaving the original payload
intact for completion comparisons. Preserve completion receipts during edits.
