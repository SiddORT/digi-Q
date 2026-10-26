---
name: Notification channel boundary
description: Preserve security-message boundaries, the approved patient SMS login exception and future-event-only activation
---

The administrator requested configurable notification SMS HTTP URL/key, not a fixed
provider. Preserve the existing Twilio mobile-verification credentials and flow.
Platform security activation is now explicitly switchable by real Superadmin at
System Default; it is not a clinic operational notification control.

**Why:** Security verification, invitations and password recovery were originally out
of scope. The user subsequently approved patient SMS login alongside email OTP,
not a general replacement of authentication or security-message transports.
The user later explicitly replaced the immutable activation policy while
retaining authentication proof and platform ownership.

**How to apply:** Extend the shared encrypted vault and durable notification machinery
for appointment channels rather than adding an alternative email sender or replacing
Twilio verification, staff invitations, recovery or patient email login.
Constrain configuration to declarative POST mappings, never executable provider scripts.

Patient SMS login is the approved exception: it uses the configured SMS API but is
a platform security message, not an optional notification or outbox job. It serves
existing uniquely matched patient accounts with real email identities; shared or
unregistered phone numbers must not create or merge accounts.

**Why:** The user explicitly chose “Add SMS login alongside email OTP.” Operational
notification switches must not lock patients out; the security event's own explicit
Superadmin activation does control delivery. Real codes must not become
notification history or provider-debug content.

**How to apply:** Keep the editable login template platform/SMS/patient-only, require
its OTP in the transmitted body and approved sender/DLT metadata, and preserve
single-use, expiry and bounded attempts independently of notification opt-outs.
Only examples may appear in template previews; never persist real login messages.

Patient SMS login may explicitly reject an unregistered-mobile request rather than
returning a fake challenge. Non-unique matches must share that public error without
revealing names, identities, counts or shared-account details.

**Why:** The user explicitly requested actionable unregistered-mobile feedback,
accepting this limited account-existence disclosure while retaining throttling.

**How to apply:** Do not restore blanket generic success responses for this case;
keep bounded account/IP request limits and require a unique active patient for
real single-use OTP delivery.

Absent clinic-registration SMS is not itself a defect and must not block required
registration email.

**Why:** The user clarified that SMS was not configured or expected for the
reported clinic-registration trigger; email delivery must work independently.

**How to apply:** Do not enable or repair registration SMS merely to diagnose an
email failure. Optional phone proof never replaces required email verification.

Existing patient SMS login wording may contain only the OTP placeholder; the
challenge still enforces expiry server-side.

**Why:** Requiring a new expiry placeholder at dispatch would silently break
previously valid published templates without any administrator activation change.

**How to apply:** Preserve the established per-event content requirements when
changing activation; newer security event templates retain their own expiry rules.

The user requires minimal in-place edits to Notifications: reuse existing
sections, row markup, switches, group handlers, editor, persistence and senders.
Do not rebuild or restyle the page to change activation capability.

**Why:** The user explicitly imposed this implementation constraint.

**How to apply:** Keep platform classification separate from switchability,
show an action-specific disabling warning, and fail closed with a truthful
delivery-unavailable outcome rather than bypassing verification.

Registration and initial staff setup are approved additional security SMS uses,
not optional appointment notifications. Optional registration phone proof must
never substitute for email identity proof or change another account's mobile.
New security SMS needs explicitly approved published wording even for generic
providers that do not technically demand DLT metadata.

Switching default security SMS activation off and back on must not itself count
as publishing approved wording.

**Why:** Activation is delivery policy, not content approval; treating any saved
activation record as approved wording would bypass the explicit publication boundary.

**How to apply:** Preserve publication provenance independently of activation
changes and drafts, including when no wording has previously been published.

Resetting platform security wording must preserve its explicit activation, even
when the reset removes the only published wording record.

**Why:** Reset is a wording action, not permission to restore the default-on
security delivery policy or to approve default SMS wording.

**How to apply:** Preserve activation independently across reset and subsequent
draft edits; only an explicit authorized activation/publication action may change it.

**Why:** The user authorized focused registration/setup coverage while explicitly
excluding provider replacement, new DLT wording projects and live sends. Provider
configuration alone is not content approval.

**How to apply:** Preserve the existing vault/transports and Twilio boundary.
Keep security templates platform-owned and required independently of operational
gates, and use fictional previews rather than recording rendered security bodies.

Do not save an unverified optional registration mobile into an identity's
phone-login matching field.

**Why:** Even without account takeover, an attacker who controls a second email
could supply another patient's number and make its SMS login ambiguous, denying
access. Merely recording `mobileVerified: false` does not protect a legacy
matcher that intentionally accepts existing saved numbers.

**How to apply:** Keep pending numbers in the expiring registration intent and
save them only after mobile proof. Preserve existing-account phone-login policy
and regress both successful-send-without-proof and failed-send registration.
Apply this rule through profile completion too: email-only onboarding must not
introduce an unproved authentication phone, even if the initial signup handler
correctly withheld it. Retain an already-saved phone without allowing replacement.

System Admin clinic-onboarding notices use the existing active Superadmin role.

**Why:** The user asked for onboarding “for system admin also,” not a new role or
expanded permission to ordinary appointment notifications.

**How to apply:** Preserve the owning Clinic Admin notice, scope System Admin
recipients to onboarding and recheck their active role before dispatch.

Clinic onboarding booking links are intended for clinics to share publicly.

**Why:** The user requested a booking-link variable for the clinic's welcome SMS.

**How to apply:** Use the clinic-wide public booking page, never a private patient
ticket, a staff workspace address or an inferred branch-specific QR link.

Enabling/configuring a channel must affect future eligible events only. In particular,
idempotent booking retries must not capture fresh notification jobs for old bookings.

**Why:** The requested operational boundary forbids backlog replay and silent clinic
activation. A retry after a configuration change is not a newly created booking.

**How to apply:** Capture booking jobs at actual creation, independently of the separately
claimed patient email. Preserve the clinic gate and existing explicit opt-outs. Do not
activate real clinics or send real recipients as part of development verification.

Optional email and notification SMS activation are independent. Disabling optional
email must not stop SMS capture or disable SMTP for account-security messages.

**Why:** The approved provider controls affect one optional channel, not all notifications
or sign-in, invitations and recovery.

**How to apply:** Apply each channel's opt-out inside its own preparation/dispatch path,
after the shared clinic gate. Verify that another enabled channel still queues when one is off.

Prospective skipped notification decisions are observations, not a retry backlog.
Their event-capture authority must survive expiry of detailed notification history.

**Why:** The user explicitly requires traceable disabled/missing-contact decisions
without replaying historical events after configuration or contact changes.

**How to apply:** Repeated reminder polling and booking retries must retain the
original decision. History retention must not delete operational idempotency or
non-send capture safeguards. Only a genuinely new event may make a new decision.

SMS/email template drawers should remain simple like the user's supplied references:
template key/variables, Active, email Subject/Body or SMS DLT registration/Body, and
Cancel/Save Template at the bottom.

**Why:** The user explicitly requested simpler drawers, not a change to template delivery
or an HTML-authoring feature.

**How to apply:** Keep optional branding, sender overrides and secondary actions under
collapsed Advanced controls. Preserve DigiQ branding, supported double-brace variables,
plain-text email escaping, scope/revision checks and save/discard confirmation.

Patient email request feedback must remain private even when optional registration
SMS outcomes are shown. Phone proof is independent of email-account eligibility;
it cannot authenticate email, create an account alone, or replace an existing phone.

**Why:** Returning real SMS outcomes only for eligible emails would reveal account
eligibility indirectly, despite generic email wording. A supplied phone is not
evidence that the requester owns the accompanying email.

**How to apply:** Keep public email outcomes generic and make optional phone-proof
behavior independent of whether the email is new, active, inactive or staff-owned.
Any future outcome or resend changes must preserve that distinction. Never claim
receipt from provider acceptance or infer phone proof from a successful send.
