---
name: Owner mobile onboarding boundary
description: Required phone-first owner setup is a narrow exception, not mobile login or a general signup redesign.
---

New public clinic owners and Super Admin-created clinic owners must explicitly
prove their mobile before account details. Keep required email identity,
email/password login, existing creation outcomes and completion receipts.
Existing Super Admins correct and verify their own account contact through
My Profile without losing login/recovery while it is missing.

For public clinic-owner registration, entering an email remains required but
verifying that email is optional after successful mobile verification. Owners
can proceed to clinic setup without requesting an email, or skip a pending email
step. Never mark the skipped email verified, bypass mobile proof, or apply this
exception to patient registration or existing-account contact verification.

**Why:** The user explicitly requested email input with optional verification
after successful mobile verification, replacing the former required-email-proof
policy for this clinic-owner flow.

**How to apply:** Require the same browser's exact, current, single-use owner
mobile proof. The no-email path must not depend on SMTP or email activation.

**Why:** The user selected verification during onboarding rather than after
first login and explicitly limited permission to necessary in-place changes.

**How to apply:** Keep strict mobile-only country rules scoped to these account
controls. Do not tighten clinic/location landlines or unrelated signup.
Pre-account proof must not create a placeholder identity. Preserve supplied
details when correcting email; unchanged-phone proof may be retained only
within the same unconsumed, bounded registration intent.

Live OTP/onboarding sends, environment-data changes, template publication,
deployment and historical replay require separate authorization. Generic old
recipient failures do not establish a historical account-field cause.

**Why:** Supplied UAT evidence separated missing recipient, disabled and actual
provider rejection stages, without identifying every original account field.

**How to apply:** Distinguish configuration from eligible account proof,
provider acceptance from handset receipt, and local fake-transport evidence
from UAT verification. Never import Preview contacts/settings or certify legacy
numbers automatically.

Approved registration SMS wording must remain literal except for substituting
approved variable slots with existing application placeholders. Incompatible
code/expiry slots are a configuration compatibility issue, not permission to
rewrite approved text, invent expiry semantics or borrow login-purpose approval.

Update the respective existing Clinic Registration, Patient Registration and
Patient Login templates and values; do not create additional templates.

**Why:** The user reiterated this boundary when supplying the three approved
DLT bodies and IDs after a provider rejection.

Public registration failures must use simple retry-later wording, not DLT,
sender or template configuration advice. Keep technical rejection categories
private to server diagnostics.

**Why:** The user explicitly requested that common users see only a provider
rejection or general SMS error, not the underlying configuration terminology.

**How to apply:** Preserve the actual delivery outcome and cooldown; an unknown
delivery still requires waiting/checking the phone rather than an automatic retry.

**Why:** The user explicitly limited preparation to existing supported variables
and administrator-supplied approved wording/ID, with approval and live publication
handled separately.

**How to apply:** Explain incompatibility and retain fail-closed proof. Future
wording requests do not implicitly authorize new variables or weaker validation.

For missing registration SMS configuration, reconcile the current running Preview
database, effective publications, installation receipt and safe audit evidence
before applying the explicit installer. Do not treat earlier successful reports
as proof that the current database retained those settings, or infer a historical
cause from their absence. Never recover automatically on startup.

**Why:** A later fresh Preview inspection found both approvals, their receipt and
audit entries absent while unrelated settings/provider fingerprints still matched
an earlier successful report. That evidence did not establish how the loss occurred.

**How to apply:** Repair only the authorized environment and approved pairs through
the guarded transaction, preserve later administrator conflicts, and verify fresh
runtime/tool fingerprints plus post-restart readiness. Keep hosted rollout and live
delivery authorization separate from workspace recovery.
