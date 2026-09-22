# ClinicFlow authentication browser audit

Date: 2026-09-22  
Scope: narrow follow-up pass using isolated browser contexts. Secrets, tickets, emails, passwords, and PII are intentionally omitted.

## Passed

- Patient OTP lifecycle: patient entry loaded, development email-code verification succeeded, required onboarding completed, and the patient dashboard loaded.
- Patient identity: authenticated read-only `/api/me` returned HTTP 200 with role `patient`.
- Passwordless staff recovery fixture: `/forgot-password` sent the recovery code, development code verification advanced to new-password, and saving a strong transient password redirected to `/sign-in?passwordReset=1` with `Your password was reset. Sign in with your new password.` No staff login was attempted.
- Ordinary staff reset fixture: the same email-code reset lifecycle completed and redirected to `/sign-in?passwordReset=1` with the password-reset confirmation. No staff login was attempted.
- Refreshed invitation routing: the private invitation opened the app `/set-password` route with the expected “Set your staff password” shell.

## Blocked

- Staff normal login remains blocked by the confirmed tenant prerequisite `needs_client_trust`. No further staff login attempts were made. Prior inspection recorded Clerk `signIn.status=needs_client_trust`, first factor `verified/password`, no second-factor verification yet, and supported second factor `email_code`; no Clerk error code was present. This was reported as a genuine tenant security prerequisite, not bypassed.
- Refreshed invitation completion is blocked by the hosted Clerk/Cloudflare human-verification challenge. The app remains at “Checking invitation…” and exposes no password fields. CAPTCHA was not interacted with or bypassed.

## Unverified / not repeated

- Invitation password save, redirect to staff login, used-ticket rejection, and provider `passwordEnabled` confirmation could not be completed without bypassing the CAPTCHA or attempting prohibited staff login.
- Cross-entry rejection, role-specific staff dashboards, staff logout/reload proof refresh, inactive-staff probe, and invalid/reused invitation checks were not repeated in this narrow follow-up.
- No normal staff OTP was added or used. Patient flow was not repeated after its earlier pass.

## Notes

- No application data outside the synthetic fixture lifecycle was intentionally modified. The two reset flows changed only their synthetic fixture passwords.
- No real mailbox delivery was claimed; development email-code behavior was used.