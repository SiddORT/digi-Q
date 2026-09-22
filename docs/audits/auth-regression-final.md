# ClinicFlow authentication and regression verification

## Verdict

**Password-only staff login is verified for all four staff roles. Full authentication sign-off remains incomplete because invitation acceptance and invitation reuse/expiry browser checks are unverified.**

Environment: Development only. Audit completed 2026-09-22, 19:27 UTC.

The owner disabled Development Device Trust before this run. The agent made no further Clerk configuration changes and no application-functionality or architecture changes during this verification. CAPTCHA, lockout, enumeration protection, Clerk session security, server-side password verification, and authorization were not disabled or bypassed.

## Evidence totals and meaning

- Current live API audit: **158 passing assertions, zero failures**.
- Local regression tests: **35 passed** (28 backend regressions plus 7 authentication source-contract checks; these are not browser tests).
- Browser results appear individually below; no aggregate browser-test count is claimed.
- PASS means the stated behavior was observed using the stated method. BLOCKED means the environment prevented completion. UNVERIFIED means the behavior was not exercised, not that it passed.
- Clerk development test email codes were used. Successful code verification does not prove delivery to a real inbox.
- Historical pre-fix results are retained separately and are not counted in this run.

## Authentication results

| Requested check | Result | Method and observed evidence |
| --- | --- | --- |
| Super Admin email/password login | PASS | Fresh isolated browser context; no OTP; Admin dashboard; authenticated identity exactly matched the fixture and superAdmin role. |
| Clinic Admin email/password login | PASS | Fresh isolated browser context; no OTP; expected role dashboard; authenticated identity exactly matched the fixture and clinicAdmin role. |
| Doctor email/password login | PASS | Fresh isolated browser context; no OTP; Doctor dashboard; authenticated identity exactly matched the fixture and doctor role. |
| Receptionist email/password login | PASS | Fresh isolated browser context; no OTP; expected role dashboard; authenticated identity exactly matched the fixture and receptionist role. |
| New patient email/OTP login | PASS | Browser requested and verified a development email code, completed onboarding, reached Patient dashboard; authenticated API identity was patient. |
| Returning patient email/OTP login | PASS | Browser logout and second email-code login returned to Patient dashboard. Exact database identity remained one user and one patient master. |
| No patient password required | PASS | Neither patient browser flow requested a password. Clerk confirmed passwordEnabled=false before cleanup. |
| Real patient OTP inbox receipt | UNVERIFIED | Development email-code verification was tested, not delivery to a real mailbox. |
| Staff blocked from Patient OTP entry | PASS | Live application patient-entry API returned 403 for all four staff roles. This claim concerns ClinicFlow entry and access controls, not disabling every direct Clerk factor. |
| Patient blocked from staff dashboards | PASS | Browser staff-dashboard navigation returned to Patient dashboard. Live staff-entry, staff verification, and staff assignment APIs returned 403. |
| Staff password verification remains server-side | PASS | Direct Clerk sessions lacked application staff access; incorrect password returned 401; correct password established session-bound proof. Each ordinary staff fixture's latest active Clerk session had a matching persisted proof before cleanup. |
| Password proof isolated by session | PASS | Same-session token refresh retained access; a new session did not inherit proof. Local regression also tests expiration against the Clerk session rather than the short-lived token. |
| Invalid staff password | PASS | Actual browser attempt stayed on Sign In and showed password error with provider 422. Live application password verification returned 401. |
| Staff logout and login again | PASS, representative | Super Admin UI logout returned to public root; password-only UI re-login succeeded. Separate logout/relogin cycles were not performed for every staff role. |
| Staff refresh after token rotation | PASS, representative | Super Admin browser remained authenticated after bounded waits totaling 75 seconds and reload; Admin dashboard and authenticated identity remained correct, with no password prompt. |
| Patient logout and login again | PASS | Browser logout returned to public root; second OTP login returned to Patient dashboard without a duplicate patient master. |
| Unauthenticated protected route | PASS | Browser Admin-dashboard request redirected to Sign In; unauthenticated identity and auth-status API requests were rejected. |
| Wrong staff role dashboard | PASS | Doctor browser request for Admin dashboard returned to Doctor dashboard without displaying Admin content. |
| Ordinary staff password reset | PASS | Super Admin browser recovery code, new password, confirmation redirect, then password-only login to Admin dashboard. Clerk confirmed passwordEnabled=true. |
| Passwordless staff recovery | PASS | Linked passwordless staff browser recovery code, new password, confirmation redirect, then password-only Receptionist dashboard. Clerk confirmed passwordEnabled=true. |
| Invitation routing | PASS | Latest private invitation reached the application Set Your Staff Password page. |
| Invitation password setup and subsequent login | BLOCKED | Provider human-verification challenge remained at Checking invitation. CAPTCHA was not removed, solved, or bypassed; full invitation acceptance was not completed. |
| Resend set-password invitation | PASS, live API/provider | Separate invitation fixture; resend returned 200, application reported sent, a new pending Clerk ticket existed, and the previous ticket was revoked. The browser invitation fixture was not disturbed. |
| Revoked invitation behavior | PARTIAL | Live Clerk revoked state was verified after resend. Browser opening/rejection of that revoked ticket was not exercised. |
| Used invitation cannot be reused | UNVERIFIED | No invitation was successfully consumed in this run because acceptance was CAPTCHA-blocked. No used-ticket success is claimed. |
| Expired invitation behavior | UNVERIFIED live | Expiry configuration/error handling received static review only. No naturally expired ticket was tested and no time manipulation was used. |
| Real invitation email receipt and rendered content | UNVERIFIED | Provider state and application outcomes were checked, but no real mailbox receipt or branded template rendering was verified. |

## Security results

| Requested check | Result | Evidence and boundary |
| --- | --- | --- |
| Client values cannot promote staff roles | PASS | Live unauthorized Clinic Admin-to-Super Admin and existing-role switch requests returned 403; patient-to-staff onboarding returned 400. |
| Authorization remains server-side | PASS | Live role-specific allow/deny tests; Doctor/Receptionist audit-log requests denied; patient staff operations denied. |
| Client-shaped privilege fields ignored | PASS | Unknown privilege-shaped profile fields did not alter patient role; Doctor-ID and fake-patient substitutions were rejected. |
| Clinic/branch scope preserved | PASS | Exact ownership/mapping snapshots matched; mismatched schedule, booking, QR, and report scopes were rejected. |
| Passwords not stored in ClinicFlow | PASS, inspection/contract tests | Application schema and authentication implementation retain no password or password-hash store. Password logging redaction and transient handling are covered by source-contract checks. Clerk remains password authority. |
| Only Clerk used as authentication provider | PASS, inspection/live checks | Existing Clerk SDK/session flow used throughout. No second identity provider or custom password/session authentication system was introduced. |
| Browser authentication flags not trusted | PASS | Direct sessions without server proof were denied; client role/privilege manipulation did not grant access. |
| Session proof tied to identity | PASS | Live session isolation plus local wrong-user/session regression. Matching persisted proofs were checked before cleanup. |
| Inactive staff denied | PASS | Live staff password verification and identity access returned 403. |
| Other Clerk security settings | UNCHANGED | No agent configuration changes. Owner reported lockout, bot protection, and enumeration protection still enabled; CAPTCHA was visibly active. No independent tenant-wide settings audit is claimed. |

## ClinicFlow regression results

These are live API/database regressions unless explicitly stated otherwise; they do not claim that every clinical UI interaction was retested.

| Requested area | Result | Observed behavior |
| --- | --- | --- |
| Clinics and branches | PASS | Exact owned clinic/branch relationships preserved; authorized reads and invalid-scope rejections passed. |
| Clinic Admin mappings | PASS | Ownership and clinic assignment snapshot invariance; authorized owned-clinic access. |
| Doctor mappings | PASS | Exact Doctor owner/clinic/branch mapping; own identity and unauthorized Doctor substitution rejection. |
| Receptionist mappings | PASS | Exact assignments preserved; operational reads/check-in remained within authorized scope. |
| Availability | PASS | Owned schedule and availability worked; cross-clinic mismatched branch rejected. |
| Appointments and patient booking | PASS | Booking succeeded with exact patient/Doctor/clinic/branch mapping and server-owned state; mismatched scope rejected. |
| Patient master | PASS | Exact user/master linkage; own read; registration scope/status tampering denied. Browser returning login created no duplicate. |
| Appointment QR | PASS | Signed QR returned; authorized check-in succeeded; persisted lifecycle history checked. |
| Clinic QR | PASS | Active clinic/branch QR resolved without a Doctor; exact mapping checked; tampered context rejected; QR-based booking created. |
| Check-in | PASS | Authorized receptionist check-in and persisted history. |
| Queue and consultation | PASS | Enqueue, call, start, complete and final persisted history. |
| Skip/no-show | PASS | Waiting-to-noShow, requeue to waiting, second noShow, persisted history/queue entry, and aggregate checked. |
| Dashboards | PASS | All five roles' scoped dashboard APIs passed. Browser staff and patient dashboards also loaded as recorded above. |
| Scoped reports | PASS | Authorized report read and mismatched clinic/branch rejection. |
| Notifications configuration | PASS | Persisted notificationsEnabled value exactly matched database configuration. |
| Notification delivery/inbox | NOT AVAILABLE | Static review found no dispatcher, notification table, or in-app inbox in the existing app. Email/SMS/push delivery was neither implemented nor claimed as tested; no new notification functionality was added. |

## Cleanup and data safety

- Read-only ownership reconciliation corrected a stale patient fixture identifier before deletion; exact email/Clerk/role linkage was used rather than trusting the stale identifier.
- All test application records, clinical fixtures, audits, patient masters, staff proofs, and owned Clerk users/sessions were removed.
- Independent scans found zero database fixture markers, zero owned Clerk users, and zero pending owned invitations.
- Clerk may retain revoked invitation history as provider audit state; no pending usable fixture invitation remains.
- The normalized database snapshot exactly matched the pre-fixture baseline.
- The private credential manifest was removed. No credentials, session tokens, invitation tickets, or personal details are included in this report.

## Remaining sign-off requirements

1. A human must complete the invitation CAPTCHA in an approved test browser/inbox and finish password setup.
2. Verify that this newly invited account can sign in with password only and reach its assigned dashboard.
3. Open the consumed ticket again and confirm rejection without duplicate user/mapping creation.
4. Open a revoked ticket and a naturally expired ticket and verify safe rejection.
5. Verify actual invitation and patient-code email receipt if real-mail delivery is part of acceptance.

These outstanding items are not marked passed. No publishing or production configuration/migration was performed.

## Detailed evidence files

- docs/audits/auth-flows-api.json
- docs/audits/auth-flows-api.md
- docs/audits/auth-flows-browser.md
- artifacts/api-server/src/auth-flow.test.mjs