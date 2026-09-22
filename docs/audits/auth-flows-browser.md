# ClinicFlow authentication browser audit

Date: 2026-09-22  
Pass: fresh synthetic UI flows, isolated contexts, no provider/settings/app changes. Secrets, tickets, passwords, emails, and PII are omitted.

## Staff baseline retained

- SuperAdmin, ClinicAdmin, Doctor, and Receptionist all passed real email/password UI login in isolated fresh contexts, reached their expected dashboards, showed no OTP, and each returned HTTP 200 from read-only `/api/me` with the exact DB-linked fixture identity and expected role.
- One invalid-password probe stayed on `/sign-in` with `Password is incorrect. Try again, or use another method.` and HTTP 422.
- SuperAdmin logout returned to public root; one UI re-login returned to `/admin/dashboard`.
- Unauthenticated `/admin/dashboard` redirected to `/sign-in`.
- Authenticated Doctor navigation to `/admin/dashboard` redirected back to `/doctor/dashboard` without exposing Admin content.

## Patient lifecycle

- Fresh patient UI email-code request, development code verification, required onboarding, and `/patient/dashboard` all passed.
- Patient `/api/me` returned HTTP 200 with role `patient`.
- Read-only duplicate check found exactly one matching user, one patient-role user, and one patient master. The API user ID matched the database user ID; the manifest patient `userId` was stale/mismatched. No duplicate patient master was created.
- Authenticated patient navigation to `/admin/dashboard` redirected back to `/patient/dashboard`.
- Patient UI logout returned to public root. A second UI email-code login with development code `424242` returned to `/patient/dashboard`; `/api/me` again returned HTTP 200 role `patient` and matched the DB-linked identity.
- No password was added to the patient fixture and no real mailbox delivery was claimed.

## Invitation

- The latest private invitation reached the app `/set-password` route and rendered the “Set your staff password” shell.
- The hosted invitation check remained at “Checking invitation…” and visibly presented a Cloudflare “Verify you are human” challenge. No password fields became available.
- CAPTCHA was not clicked, bypassed, or redesigned. Invitation password setup, staff-login redirect, used-ticket rejection, and resendProbe/invalid-link checks are therefore UNVERIFIED by limitation, not treated as application failures.

## Password reset

- Passwordless recoveryStaff: forgot-password email-code request, code verification, strong transient password save, redirect to `/sign-in?passwordReset=1`, and normal password-only UI login to the expected Receptionist dashboard all passed. Read-only `/api/me` returned HTTP 200 role `receptionist` and matched the DB-linked identity.
- Ordinary synthetic SuperAdmin reset: email-code request, code verification, strong transient password save, reset confirmation, and normal password-only UI login to `/admin/dashboard` all passed. Read-only `/api/me` returned HTTP 200 role `superAdmin` and matched the DB-linked identity.
- The private mode-0600 manifest was updated in place with both new synthetic passwords; no password value was printed.
- No normal staff OTP was used or added. The password-form accessibility warning about an optional hidden username field was observed but did not block the flows.

## >60-second refresh / proof

- Using the surviving authenticated SuperAdmin context, five bounded 15-second waits (each below the notebook timeout) elapsed more than 60 seconds, followed by one reload.
- After reload the page remained `/admin/dashboard`, no staff email/password fields were present, and read-only `/api/me` returned HTTP 200 role `superAdmin` with DB/API identity match.
- The dashboard activity feed contains `verifyStaffPassword users record`, consistent with the server staff-verification path. Direct performance-resource inspection after reload retained `/api/me` entries but no `/staff-verify` URL, so the exact network request path was not independently captured. Dashboard access and the activity record are the available evidence that staff proof remained accepted.

## Remaining gaps

- Invitation flows are blocked by the hosted Clerk/Cloudflare CAPTCHA; do not bypass.
- Used-ticket, invalid/revoked-link, and naturally expired-link behavior remain untested because invitation setup never reached password completion. No invitation was revoked by this audit.
- The refreshed manifest patient `userId` should be reconciled by the fixture owner; DB/API linkage itself is unique and consistent.
- No clinical records or real users/settings were modified. The only mutations were the two synthetic password resets and the patient onboarding profile already required by the fixture lifecycle.