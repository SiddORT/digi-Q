# Registration and setup notifications: verified boundary and operating guide

## Authorization and evidence

This is development implementation, not live delivery certification. No real
messages, clinic activations, credential changes or deployment are authorized by
this work. Fake SMTP/SMS transports and disposable PostgreSQL exercise behavior.
Workspace configuration cannot establish deployed UAT configuration or receipt.

Three different kinds of evidence must not be conflated:

1. **Configuration readiness:** SMTP/public origin or SMS provider settings and
   approved sender/DLT identifiers pass validation. Not a connection test.
2. **Provider accepted:** the transport accepted the message. This is not inbox
   delivery, handset delivery or proof that a person read it.
3. **Delivered:** requires separately authorized real mailbox/handset/provider
   evidence. Not established here, for any of the five scenarios.

## Five-scenario classification: before → implemented target

| Scenario | Email classification and behavior | SMS classification and behavior |
|---|---|---|
| Clinic Admin self-registration | Already-working required OTP trigger, **wrong template binding** (hardcoded). Now resolves Required platform `clinic_registration_otp` on initial send and resend. | **Missing collection and proof**. Optional country-code mobile now requests separate `registration_mobile_otp`; email remains mandatory. |
| Doctor initial password setup | Secure invitation email already worked; **wrong binding**. Now Required `doctor_setup` with doctor wording. **Missing trigger** for acknowledgement; now Required `password_setup_complete` after committed initial setup. | **Missing triggers**. Eligible saved mobile gets token-free setup advisory and non-secret completion, conditional on approved published SMS content and provider readiness. |
| Other staff initial password setup | Secure invitation already worked; **wrong binding**. Now Required `staff_setup`, with role-appropriate wording, and completion after successful initial setup. Includes receptionist and administratively invited Clinic Admin accounts. | **Missing triggers**, now same conditional advisory/completion contract as doctors. Invalid/absent mobiles are not requested; this never prevents the staff save or password setup. |
| Patient email registration/login | Required email code already worked; **wrong binding**. Now `patient_email_otp`, same resolver for first request and subsequent requests. | Existing-account SMS login was **already working**, a separate selectable channel (`patient_login_otp`). Optional registration mobile proof is newly supported alongside email, not phone-only signup. No merging or existing-mobile replacement. |
| Clinic Admin / doctor / receptionist-created booking | Patient confirmation and owning-admin jobs **already working** through shared booking creation. Preserved gates, scopes, exact-once capture, owner recipient and doctor opt-in. **Missing protected content** under custom wording: canonical committed ticket details are now retained even when custom wording omits `appointment_details`. | Existing optional notification pipeline retained. Default-off optional SMS events stay off; no channel/provider/clinic switch or published override is changed. |

### Required versus default-off versus conditional

- Required security email cannot be disabled by optional Email, clinic-wide,
  booking-recipient or personal communication switches.
- Registration SMS is conditional on voluntarily supplied international mobile;
  setup SMS is conditional on an eligible saved mobile. Required describes the
  action-specific security policy, **not** an instruction to enable an unapproved
  SMS template. New security SMS will not dispatch from default wording: approved
  wording must be explicitly published, with the provider's sender/DLT metadata.
  This work does not invent DLT approvals or enable real providers.
- Optional operational email/SMS still uses existing published activation,
  channel configuration, clinic notification gates, recipient eligibility and
  production-only dispatch. Doctor booking notification remains selectable,
  default-off; existing explicit opt-outs are retained.
- Ordinary staff email/password login remains OTP- and SMTP-independent.
  Recovery configuration is separate and unchanged.

## Verification and delivery rules

Email challenges remain authoritative for the supplied email identity. Phone
challenges have a different purpose, are bound to an opaque parent email intent,
its exact email/mobile and original expiry, and never issue sessions or set
email verification. Only successful phone proof marks the new number verified.
Both channels keep bounded attempts, single-use proofs and request throttling.
Changing details starts a new intent. Email resend rotates only its code without
extending the original lifetime or replenishing its attempt budget. The remaining
expiry in content comes from the stored challenge.

If mobile is omitted, unavailable, rejected, uncertain or not verified, successful
email proof still permits registration with no verified-phone claim. Successful
phone proof is retained across email resend. Finishing email verification consumes
the intent; phone verification must happen before that, or be skipped explicitly
by continuing with email only. Resuming the registration tab restores access to
pending phone proof without persisting phone codes in browser drafts.

Patient email resend retains the same parent intent, including successful phone
proof, and rotates only the email code without extending expiry or replenishing
attempts. Unknown/expired intents and unsuccessful dispatch have the same generic
resend response; users can restart email entry when the code has expired.

Patient login responses deliberately do not disclose account matching or certify
delivery. “If eligible, a code has been requested” is not a delivery receipt.
The new phone is saved only after successful mobile proof when creating the
email-verified account; skipping SMS proof or a channel failure leaves it only
in the expiring registration intent, not the account's login-matching mobile.
An existing account keeps its saved mobile. An attacker who proves only a new
email cannot make another patient's phone ambiguous and deny their SMS login.
Genuinely shared, proved/saved phone numbers still fail closed rather than
choosing or merging identities.

Staff setup sends only secure, expiring, single-use email links on the configured
public origin. SMS refers to that email and never contains a bearer link or
password. Failed email invitations retain the saved profile and a failed
invitation state, with explicit resend recovery. A failed/uncertain invitation's
link is invalidated, as before. Check the provider before an explicit resend;
do not create the staff account again.

Initial password setup commits credential/session changes and a durable
completion claim atomically. Only that winning acceptance sends acknowledgements.
Replayed tokens, other outstanding invitations, ordinary password changes and
password resets do not send another initial-setup acknowledgement. Failure never
undoes a password or its session. A crash after commit is an uncertain
acknowledgement, not permission to replay sends automatically (at-most-once
dispatch rather than a claim of exactly-once network delivery).

Safe outcomes are provider_accepted, provider_rejected, pre_dispatch_failed,
delivery_unknown, unavailable and not_requested. Where identity disclosure is
permitted, screens show separate channels and masked destinations. Real OTPs,
bearer links, rendered security bodies and provider responses never enter
notification history. Passwords are never sent in any channel.

## Superadmin operating guide

Use the existing **Settings → Communication / Notification Templates** surfaces:

- Email configuration: `/admin/settings?area=email`
- SMS configuration: `/admin/settings?area=sms`
- Notification Templates / event status: `/admin/settings?area=events`
  (the existing navigation resolves this to `/admin/templates`)

Choose **Platform defaults** for authentication events; clinic-level editors do
not own these security templates. Select the relevant recipient (Clinic Admin,
Patient, Doctor or Receptionist) and event, then **Edit**. Required controls are
labelled independently from optional booking activation and cannot be switched
off. Event status reports configuration blockers without applying optional gates
to security events. These are additive event rows in the existing status contract,
not another general settings/preference system.

Defaults apply unless a published platform template exists. Operational clinic
overrides retain precedence over platform wording. **Save Draft** stores edits
without changing delivery. **Publish** selects future effective wording, but does
not send anything or change provider settings. **Reset** removes that scope's
draft and publication and inherits again.

OTP content must retain both `{{otp}}` and `{{expiry_minutes}}`. Setup email must
retain `{{setup_link}}` and `{{expiry_minutes}}`; SMS must omit the bearer link.
Authentication content cannot supply arbitrary destination URLs or email
addresses. Preview/test values for security content are fictional, including the
example.invalid setup URL. New security SMS requires published approved wording;
the Required label does not mean regulatory/provider approval has been obtained.
Only an explicitly authorized future test may contact a real destination.

No personal preference editor, inbox redesign, navigation rollout, SMTP recovery
setup or broad owner-history recovery is part of this work.

## Booking recipient and ticket contract

The owning Clinic Admin is resolved from clinic ownership, not from whoever
clicked Book. All permitted staff entry points use the shared committed booking.
Patient confirmation is independent of owner email outcome. Owner/doctor wording
describes a clinic notification; patient wording confirms the patient's visit.
Doctors are eligible only when explicitly enabled and still assigned. Other
staff are not automatically broadcast recipients.

The existing same-address deduplication gives patient confirmation precedence
when the owner/doctor shares the patient's address, and avoids extra sends for
shared staff addresses. Recipient/contact and membership are rechecked by the
worker. No historical bookings are replayed after settings change.

Patient email always includes reference and queue token, clinic/location,
doctor, date, session start/end and timezone, and clinic contact (or explicit
reception contact instruction where contact is absent). These are committed ticket
facts; a session range is not a promised consultation time. The sender has no PDF
attachment, no new private bearer-ticket URL, and makes no such promise.

## Verification and live work still separate

The automated regressions use fictional identities and fake transports for
independent channel outcomes, optional-gate bypass, phone/email separation,
attempts/expiry/resend, immutable existing identities, required template
validation, secure invitation/completion and duplicate acceptance rejection.
Existing booking regressions cover all permitted staff roles, owning-admin
selection, doctor opt-in, shared-address deduplication and independent outcomes.

Verification performed in development:

- API/schema generation and backend/frontend TypeScript checks passed.
- Targeted backend regressions passed for native/JWT authentication, actual
  HTTPS/CSRF password login with SMTP absent, invitation-save recovery,
  required template policy and fictional previews, independent registration
  channels, preserved phone proof on email resend, one-time setup completion,
  and booking recipient/content parity. No external transports were used.
- Rendered/static UI regressions passed for masked per-channel outcomes,
  separate mobile/email controls, Required security controls and saved staff.
- A browser pass intercepted every API request with fictional responses. It
  verified registration partial outcomes and separate proof requests, generic
  patient email/SMS login, saved-password failure feedback, Required versus
  optional booking controls and fictional-only security preview. Mobile resend
  was not clicked during its cooldown; isolated route tests cover that behavior.
- The public registration page rendered cleanly in Preview. This does not
  establish deployed readiness, provider acceptance or delivery.

Real UAT configuration, provider/DLT approval, SMTP acceptance and actual
inbox/handset receipt still need separate authorization. Existing UAT
certification, recovery SMTP, resend concurrency and owner-history proposals
remain separate; none is silently marked complete by this report.
