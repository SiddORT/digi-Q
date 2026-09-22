# ClinicFlow authentication update — incomplete pending Clerk configuration

> Historical implementation report. Superseded for current verification results by
> `auth-regression-final.md`. Development Device Trust has since been disabled by
> the owner, and all four staff password-only browser logins have passed.

## Scope

This update implements the authentication-only request in
`Pasted--CLINICFLOW-FINAL-AUTHENTICATION-FLOW-CORRECTION-Procee_1790097311355.txt`.
Clerk remains the sole identity, password, email-code, invitation and session provider.
No clinic ownership, role definitions, clinic/branch mappings, appointment rules,
availability, QR, queue or dashboard business logic was changed.

## Implemented

- Separate staff password and patient email-code entry screens using the installed Clerk SDK.
- Server-authoritative entry checks reject staff emails from the patient flow and patient emails from the staff flow.
- New patient identities are reserved/unverified and passwordless through Clerk's supported backend provisioning options. Public tenant signup requirements were not changed.
- Protected staff API access requires successful Clerk server-side password verification bound to the authenticated Clerk session. No browser method flag or password-presence flag grants access.
- Staff proof lasts until the actual Clerk session expires, not the short-lived access token. Token refresh does not intentionally require a new password.
- Account/IP entry throttles and user/IP password throttles remain active.
- Clerk ticket-based password setup, invitation replacement/revocation, bounded invitation expiry, secure application redirects and truthful delivery outcomes.
- Staff recovery uses Clerk's email-code password reset mechanism. This is recovery, not the normal staff login method.
- Linked staff password state is obtained from Clerk, with an explicit unknown state if the provider lookup fails.
- Passwords are transient request/component values only; they are not stored in ClinicFlow or logged.

## Verified

- Full workspace typecheck passed.
- Backend regressions: 28 passed.
- Authentication security regressions: 7 passed.
- Live API audit: 104 passing assertions, with one historical pre-fix 429 failure retained for provenance. The corresponding current patient-to-staff rejection was separately confirmed as 403.
- API tests exercised real Clerk development sessions, wrong/correct password verification, session isolation, role identity, inactive accounts, patient onboarding and unchanged mappings.
- Clinical API regression passed availability, appointment booking, signed QR, check-in, queue/consultation completion, scoped reporting and cross-clinic/branch rejection.
- Browser patient email-code verification, onboarding and patient dashboard passed without creating a password.
- Browser passwordless-staff recovery and existing-staff password reset passed and returned to Staff Login. Provider password-enabled state was confirmed afterward.
- Desktop staff and 390px patient authentication screens rendered successfully.

## Blocking findings — do not claim completion

### Staff password-only login

The actual browser sign-in returned `needs_client_trust` after successful password
verification. Clerk required an email-code second factor on the new device.
This is Clerk Device Trust, not a stale SDK status or an application role error.

No OTP option was added to staff login and no provider security setting was bypassed
or disabled. The UI explains the configuration conflict. Normal new-device staff
login therefore remains blocked until the owner resolves the Device Trust setting.
Backend password-proof success is not evidence that browser staff sign-in completed.

Clerk documents Device Trust under Protect → Rules. Disabling it removes its
additional new-device verification protection and requires an informed configuration
decision. No production or development tenant settings were changed.

### Invitation acceptance and email content

The latest isolated invitation reached the application `/set-password` route but
the provider's human-verification challenge blocked automated completion.
The test did not solve or bypass the CAPTCHA. Invitation password submission,
used-ticket browser rejection and the final staff sign-in remain unverified.

Provider invitation metadata includes authoritative role/clinic information, but
this does not establish that the tenant's email template renders it. Exact branded
email wording and real inbox delivery are not verified. Recovery assistance does
not falsely claim that an administrator action already sent an email; the recipient
initiates Clerk's recovery-code flow.

### Provider-level limitation

ClinicFlow offers patients only email-code authentication and forbids patient entry
through its staff screen. This does not remove a legacy patient's existing Clerk
password or prove the original authentication factor of a session obtained directly
outside these application entry points. No such provider-wide prohibition is claimed.
Direct staff sessions, however, cannot obtain staff application access without the
server-side Clerk password proof.

## Database and cleanup

An additive staff-session-proof table and versioned migration were added in development.
The generic schema-push command created the table/indexes but then encountered an
existing duplicate constraint elsewhere. No force-push, constraint drop or unrelated
schema repair was performed. The intended table and indexes were checked directly.
Production migrations and publishing were not performed.

All synthetic Clerk identities, sessions, invitations, application fixtures, clinical
history, audit rows and session proofs were removed through guarded cleanup.
The normalized pre-fixture database snapshot matched exactly; the independent marker
scan found zero remaining fixture rows. The private test manifest was removed.

## Evidence

- `auth-flows-api.md` and `auth-flows-api.json`
- `auth-flows-browser.md`