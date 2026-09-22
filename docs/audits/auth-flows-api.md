# Authentication flows API audit

**Status:** cleaned
**Generated:** 2026-09-22T19:27:35.706Z
**Result:** 158 passed, 0 failed.

## Provider feasibility

- A disposable Clerk development user was created with a reserved email identification and `skipPasswordRequirement`.
- Clerk reported password disabled and no initial email verification; the disposable probe was deleted immediately.
- Provider viability was subsequently confirmed in the parent browser: real Clerk development email-code verification and patient onboarding passed.

## Historical audit provenance

- The prior audit generated 2026-09-22T17:58:40.696Z remains recorded as 104 passed and 1 failed, then cleaned.
- The original pre-fix global-IP limiter returned 429 for the final patient-to-staff negative; a separate post-fix request reached role enforcement and returned 403.

## Pre-cleanup read-only verification

- Exact owned email and Clerk linkage reconciled all app user IDs before deletion; stale manifest IDs were not trusted.
- The latest active Clerk session for every ordinary staff role had a matching persisted staff password proof.
- Clerk reported password enabled for the Super Admin and recoveryStaff reset fixtures.
- OTP patient password disabled: true.

## Evidence

| Unit | Outcome | Assertion | Route/status | Evidence |
|---|---|---|---|---|
| setup-01-super-bootstrap | PASS | superAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| setup-03-app-owned-scope | PASS | Create Clinic Admin and first clinic through guarded app API | POST /clinic-admin-onboarding 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | clinicAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| setup-03-app-owned-scope | PASS | Clinic Admin creates second owned clinic through app API | POST /clinics 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | Create scoped Branch A through app API | POST /branches 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | Create scoped Branch B through app API | POST /branches 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | Create Doctor with both owned clinics through app API | POST /doctors 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | Create Receptionist with both owned branches through app API | POST /users 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | Create inactive-state probe through app API | POST /users 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | Create linked passwordless staff recovery fixture through app API | POST /users 201 | Expected 201 and received 201. |
| setup-03-app-owned-scope | PASS | Recovery fixture links the owned Clerk identity |    | The app profile is linked to the exact passwordless development identity. |
| setup-03-app-owned-scope | PASS | Deactivate fixture staff through app API | PATCH /users/ea374489-ab91-4c1a-8142-2984fcfc08e5 200 | Expected 200 and received 200. |
| setup-04-reserved-patient | PASS | Provision reserved patient identity through live patient entry | POST /auth/patient-entry 200 | Expected 200 and received 200. |
| setup-04-reserved-patient | PASS | Patient provider identity is unique |    | Exactly one development Clerk identity was provisioned. |
| setup-04-reserved-patient | PASS | Reserved patient has no password |    | Clerk reports passwordEnabled false. |
| setup-04-reserved-patient | PASS | Reserved patient awaits real email-code verification |    | The provider identity remains reserved/unverified until Clerk's email-code factor is completed. |
| setup-04b-api-patient | PASS | Patient first-login onboarding remains available | POST /onboarding 201 | Expected 201 and received 201. |
| setup-05-non-delivery-invitation | PASS | Non-delivery invitation fixture created |    | Clerk accepted an invitation with notify:false. This is link/state evidence only; no mailbox delivery is claimed. |
| browser-fixture-refresh | PASS | clinicAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| browser-fixture-refresh | PASS | Create scoped invited Receptionist through authorized app API | POST /users 201 | Expected 201 and received 201. |
| browser-fixture-refresh | PASS | Latest invited Receptionist ticket is non-delivery |    | The app profile is persisted and every older pending ticket was revoked before storing a fresh notify:false URL privately. |
| run-01-entry-separation | PASS | Unauthenticated auth status is denied | GET /auth/status 401 | Expected 401 and received 401. |
| run-01-entry-separation | PASS | Unauthenticated identity is denied | GET /me 401 | Expected 401 and received 401. |
| run-01-entry-separation | PASS | Patient entry accepts reserved OTP patient | POST /auth/patient-entry 200 | Expected 200 and received 200. |
| run-01-entry-separation | PASS | Patient entry rejects superAdmin | POST /auth/patient-entry 403 | Expected 403 and received 403. |
| run-01-entry-separation | PASS | Staff entry accepts superAdmin | POST /auth/staff-entry 200 | Expected 200 and received 200. |
| run-01-entry-separation | PASS | Patient entry rejects clinicAdmin | POST /auth/patient-entry 403 | Expected 403 and received 403. |
| run-01-entry-separation | PASS | Staff entry accepts clinicAdmin | POST /auth/staff-entry 200 | Expected 200 and received 200. |
| run-01-entry-separation | PASS | Patient entry rejects doctor | POST /auth/patient-entry 403 | Expected 403 and received 403. |
| run-01-entry-separation | PASS | Staff entry accepts doctor | POST /auth/staff-entry 200 | Expected 200 and received 200. |
| run-01-entry-separation | PASS | Patient entry rejects receptionist | POST /auth/patient-entry 403 | Expected 403 and received 403. |
| run-01-entry-separation | PASS | Staff entry accepts receptionist | POST /auth/staff-entry 200 | Expected 200 and received 200. |
| run-01-entry-separation | PASS | Staff entry rejects reserved OTP patient | POST /auth/staff-entry 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | superAdmin direct Clerk session has auth status | GET /auth/status 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | superAdmin direct session lacks proof |    | Status requires a session-bound staff password proof. |
| run-02-session-proof | PASS | superAdmin direct Clerk session cannot access /me | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | superAdmin wrong password is rejected | POST /auth/staff-verify 401 | Expected 401 and received 401. |
| run-02-session-proof | PASS | superAdmin correct password establishes proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | superAdmin proof is reported |    | Auth status reports the expected role and verified session proof. |
| run-02-session-proof | PASS | superAdmin proof survives token refresh in the same session | GET /me 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | superAdmin proof does not transfer to a new Clerk session | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | clinicAdmin direct Clerk session has auth status | GET /auth/status 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | clinicAdmin direct session lacks proof |    | Status requires a session-bound staff password proof. |
| run-02-session-proof | PASS | clinicAdmin direct Clerk session cannot access /me | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | clinicAdmin wrong password is rejected | POST /auth/staff-verify 401 | Expected 401 and received 401. |
| run-02-session-proof | PASS | clinicAdmin correct password establishes proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | clinicAdmin proof is reported |    | Auth status reports the expected role and verified session proof. |
| run-02-session-proof | PASS | clinicAdmin proof survives token refresh in the same session | GET /me 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | clinicAdmin proof does not transfer to a new Clerk session | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | doctor direct Clerk session has auth status | GET /auth/status 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | doctor direct session lacks proof |    | Status requires a session-bound staff password proof. |
| run-02-session-proof | PASS | doctor direct Clerk session cannot access /me | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | doctor wrong password is rejected | POST /auth/staff-verify 401 | Expected 401 and received 401. |
| run-02-session-proof | PASS | doctor correct password establishes proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | doctor proof is reported |    | Auth status reports the expected role and verified session proof. |
| run-02-session-proof | PASS | doctor proof survives token refresh in the same session | GET /me 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | doctor proof does not transfer to a new Clerk session | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | receptionist direct Clerk session has auth status | GET /auth/status 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | receptionist direct session lacks proof |    | Status requires a session-bound staff password proof. |
| run-02-session-proof | PASS | receptionist direct Clerk session cannot access /me | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | receptionist wrong password is rejected | POST /auth/staff-verify 401 | Expected 401 and received 401. |
| run-02-session-proof | PASS | receptionist correct password establishes proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | receptionist proof is reported |    | Auth status reports the expected role and verified session proof. |
| run-02-session-proof | PASS | receptionist proof survives token refresh in the same session | GET /me 200 | Expected 200 and received 200. |
| run-02-session-proof | PASS | receptionist proof does not transfer to a new Clerk session | GET /me 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | Inactive staff cannot establish proof | POST /auth/staff-verify 403 | Expected 403 and received 403. |
| run-02-session-proof | PASS | Inactive staff cannot access /me | GET /me 403 | Expected 403 and received 403. |
| run-03-patient-and-role-authorization | PASS | Patient auth status resolves | GET /auth/status 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Patient never requires staff password proof |    | Patient status remains independent of the staff proof flow. |
| run-03-patient-and-role-authorization | PASS | Patient accesses /me | GET /me 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Patient onboarding identity is preserved |    | The original patient user and patient master remain linked. |
| run-03-patient-and-role-authorization | PASS | Patient cannot enter staff verification | POST /auth/staff-verify 403 | Expected 403 and received 403. |
| run-03-patient-and-role-authorization | PASS | Patient cannot access staff assignment APIs | GET /staff-assignment-options?targetRole=receptionist 403 | Expected 403 and received 403. |
| run-03-patient-and-role-authorization | PASS | superAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | clinicAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | doctor establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | receptionist establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Super Admin reaches platform settings API | GET /settings 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Clinic Admin reaches owned clinic API | GET /clinics?pageSize=100 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Clinic Admin dashboard identity has both owned clinics |    | Both fixture clinic IDs are visible. |
| run-03-patient-and-role-authorization | PASS | Doctor reaches own dashboard identity API | GET /doctors/3fb372b1-0c87-44d9-9bfb-40d67ac82bfb 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Doctor dashboard identity is exact |    | Doctor profile and app user remain linked. |
| run-03-patient-and-role-authorization | PASS | Doctor cannot access platform audit logs | GET /audit-logs?pageSize=1 403 | Expected 403 and received 403. |
| run-03-patient-and-role-authorization | PASS | Receptionist cannot access platform audit logs | GET /audit-logs?pageSize=1 403 | Expected 403 and received 403. |
| run-03-patient-and-role-authorization | PASS | Receptionist reaches scoped operational API | GET /appointments?pageSize=1 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Clinic Admin can initiate supported recovery instructions for linked passwordless staff | POST /users/d5c5579f-4203-4525-ba25-5ceb1e0d674f/password-reset 202 | Expected 202 and received 202. |
| run-03-patient-and-role-authorization | PASS | Recovery response directs to Clerk secure flow |    | The endpoint returns the supported Clerk forgot-password path without credentials or a server-generated password. |
| run-04-invariance | PASS | Authentication leaves role and clinic mappings invariant |    | Clinic ownership, branches, staff assignments, and Doctor ownership exactly match the post-setup snapshot. |
| run-04-invariance | PASS | Patient master remains intact |    | Authentication checks did not recreate or alter patient identity linkage. |
| run-05-clinical-regression | PASS | doctor establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | receptionist establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Patient requests configured development mobile verification | POST /otp/request 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Development mobile OTP provider is explicit |    | The live API supplied its configured development challenge. |
| run-05-clinical-regression | PASS | Patient verifies fixture mobile through live API | POST /otp/verify 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Doctor creates guarded availability in assigned clinic and branch | POST /schedules 201 | Expected 201 and received 201. |
| run-05-clinical-regression | PASS | Mismatched cross-clinic branch availability is rejected | POST /schedules 400 | Expected 400/403/409 and received 400. |
| run-05-clinical-regression | PASS | Doctor creates signed booking QR resource | POST /qrs 201 | Expected 201 and received 201. |
| run-05-clinical-regression | PASS | Mismatched cross-clinic appointment branch is rejected | POST /appointments 400 | Expected 400/403/409 and received 400. |
| run-05-clinical-regression | PASS | Patient books appointment through live guarded API | POST /appointments 201 | Expected 201 and received 201. |
| run-05-clinical-regression | PASS | Patient reads own clinical appointment | GET /appointments/86767c93-aed6-4311-b43e-3889ddefdfa2 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Owned clinical booking mapping is exact |    | The retained appointment maps the fixture Patient, Doctor, Clinic A, and Branch A exactly. |
| run-05-clinical-regression | PASS | Patient reads signed appointment QR | GET /appointments/86767c93-aed6-4311-b43e-3889ddefdfa2/qr 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Receptionist checks patient in with signed QR | POST /appointment-qr/check-in 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Doctor calls next queued patient | POST /queue/call-next 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Doctor starts consultation | POST /appointments/86767c93-aed6-4311-b43e-3889ddefdfa2/actions 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Doctor completes consultation | POST /appointments/86767c93-aed6-4311-b43e-3889ddefdfa2/actions 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Clinical journey reaches completed |    | Availability, booking, signed QR check-in, queue, and consultation state transitions completed once. |
| run-05-clinical-regression | PASS | Persisted clinical history proves QR and queue journey |    | Appointment history contains checked-in, waiting, called, in-consultation, and completed transitions. |
| run-05-clinical-regression | PASS | Receptionist reads scoped queue | GET /queue?doctorId=3fb372b1-0c87-44d9-9bfb-40d67ac82bfb&branchId=73487ccc-d59a-4427-8fc8-d589acac5d23&date=2026-09-23 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Doctor reads scoped dashboard | GET /dashboard 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Receptionist reads scoped report | GET /reports 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | superAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | clinicAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | doctor establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | receptionist establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Patient reads own patient master | GET /patients/9db44f9d-9cbe-41f8-9883-c249f00f3934 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Patient master identity and verification mapping is exact |    | The owned patient master retains its exact app user linkage and verified mobile state. |
| run-06-expanded-live-regression | PASS | Patient cannot tamper with registration scope or status fields | PATCH /patients/9db44f9d-9cbe-41f8-9883-c249f00f3934 403 | Expected 403 and received 403. |
| run-06-expanded-live-regression | PASS | Patient onboarding cannot be tampered into a staff role | POST /onboarding 400 | Expected 400/409 and received 400. |
| run-06-expanded-live-regression | PASS | Patient identity is readable before client-field tampering | GET /me 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Unknown client privilege fields do not grant access | PATCH /me 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Patient identity is readable after client-field tampering | GET /me 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Client-supplied privilege fields are ignored |    | Role and patient linkage remain server-owned after a payload containing privilege-shaped fields. |
| run-06-expanded-live-regression | PASS | Patient cannot substitute another patient identity | POST /appointments 403 | Expected 403 and received 403. |
| run-06-expanded-live-regression | PASS | Clinic Admin cannot grant Super Admin through role-field tampering | POST /users 403 | Expected 403 and received 403. |
| run-06-expanded-live-regression | PASS | Existing staff role cannot be switched by client payload | PATCH /users/ac2cc23b-ae99-43a9-b6e1-9e07e5a4fcec 403 | Expected 403/409 and received 403. |
| run-06-expanded-live-regression | PASS | Doctor cannot substitute another Doctor identity | POST /appointments 403 | Expected 403 and received 403. |
| run-06-expanded-live-regression | PASS | Public clinic QR resolves active clinic and branch context | GET /public/qr/yFUHb4nM2PXvE9S7b_6MndpSE-uRLXq_puKLdLP7wQw 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Clinic QR mapping is exact |    | The clinic QR resolves the owned clinic and branch while leaving Doctor selection unbound. |
| run-06-expanded-live-regression | PASS | Clinic QR rejects client-tampered clinic and branch context | POST /appointments 400 | Expected 400/403 and received 400. |
| run-06-expanded-live-regression | PASS | Patient reads own clinic-QR appointment | GET /appointments/e372ca90-d42c-40b9-ad64-4ef1310b9380 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Clinic-QR appointment ownership and mapping is exact |    | The QR appointment maps the owned Patient, Doctor, Clinic, and Branch exactly. |
| run-06-expanded-live-regression | PASS | Skip/no-show transition persists |    | The guarded waiting-to-noShow transition is persisted on the appointment. |
| run-06-expanded-live-regression | PASS | Receptionist requeues no-show appointment | POST /appointments/e372ca90-d42c-40b9-ad64-4ef1310b9380/actions 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | No-show requeue transition persists |    | The guarded noShow-to-waiting transition is persisted. |
| run-06-expanded-live-regression | PASS | Receptionist marks requeued patient no-show again | POST /appointments/e372ca90-d42c-40b9-ad64-4ef1310b9380/actions 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Skip/no-show and requeue history is persisted |    | Appointment history contains both no-show transitions and the intervening requeue. |
| run-06-expanded-live-regression | PASS | Scoped queue reports no-show state | GET /queue?doctorId=3fb372b1-0c87-44d9-9bfb-40d67ac82bfb&branchId=73487ccc-d59a-4427-8fc8-d589acac5d23&date=2026-09-23 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Queue no-show aggregate and entry are exact |    | The scoped queue includes the owned no-show appointment and increments its no-show aggregate. |
| run-06-expanded-live-regression | PASS | Super Admin reads role-scoped dashboard | GET /dashboard 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Clinic Admin reads role-scoped dashboard | GET /dashboard 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Doctor reads role-scoped dashboard | GET /dashboard 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Receptionist reads role-scoped dashboard | GET /dashboard 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Patient reads role-scoped dashboard | GET /dashboard 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Report rejects mismatched clinic and branch scope | GET /reports?clinicId=8018a6db-c1a7-4770-8350-36bc9cfbca92&branchId=73487ccc-d59a-4427-8fc8-d589acac5d23 400 | Expected 400/403 and received 400. |
| run-06-expanded-live-regression | PASS | Notification configuration is readable | GET /settings 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Notification preference is persisted consistently |    | The API value matches persisted platform configuration; no email, SMS, push, or in-app delivery is claimed. |
| run-06-expanded-live-regression | PASS | General notification delivery is not implemented |    | Static implementation review: notification configuration is persisted only; there is no notification table, dispatcher, or in-app inbox. Real delivery was not claimed or attempted. |
| run-06-expanded-live-regression | PASS | Browser invitation remains pending before separate resend probe |    | The browser inviteProbe ticket is still pending and is not reused by the resend test. |
| run-06-expanded-live-regression | PASS | Prime separate set-password invitation after failed local-origin delivery | POST /users/ba563a90-8d8c-4ef4-bff2-d28de903b8cd/resend-invitation 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Separate resend probe accepts HTTPS app redirect |    | The invitation endpoint records sent when invoked with the DEVELOPMENT HTTPS app origin. |
| run-06-expanded-live-regression | PASS | Separate resend probe has initial pending invitation |    | Live Clerk provider state contains a pending invitation for only the separate resend probe. |
| run-06-expanded-live-regression | PASS | Clinic Admin resends separate set-password invitation | POST /users/ba563a90-8d8c-4ef4-bff2-d28de903b8cd/resend-invitation 200 | Expected 200 and received 200. |
| run-06-expanded-live-regression | PASS | Resend persists sent invitation status |    | The separate app profile remains unchanged in role/scope and records invitationStatus sent. |
| run-06-expanded-live-regression | PASS | Resend creates a fresh live set-password ticket |    | Clerk exposes a fresh pending ticket for the separate probe; its private URL is not reported. |
| run-06-expanded-live-regression | PASS | Resend revokes the prior separate invitation |    | Live Clerk provider state reports the prior separate-probe ticket as revoked. |
| run-06-expanded-live-regression | PASS | Browser invitation is untouched by separate resend probe |    | The original browser inviteProbe ticket remains pending with the same provider ID. |
| run-06-expanded-live-regression | PASS | Expired and used invitation states are not live-tested |    | No clock manipulation, invitation acceptance, browser-session interference, or Clerk setting change was attempted. Revoked state is live provider evidence; expired/used semantics remain static provider behavior only. |

## Invitation state evidence

- **pending/resend** — live; passed. Separate resendProbe created a fresh pending Clerk set-password ticket.
- **revoked** — live; passed. Clerk reported the prior separate resendProbe ticket revoked.
- **browser acceptance/reuse** — untested; blocked. Browser acceptance was CAPTCHA-blocked; setup and reuse are not claimed.
- **expired** — static-only; untested. A one-day expiry was configured, but no clock manipulation or elapsed expiry test was performed.
- **mocked invitation behavior** — mocked; not-used. No mocked invitation state is counted as live evidence.

## Notification evidence

- **configuration persistence** — live; passed.
- **in-app notification inbox** — static; not-implemented.
- **real email/SMS/push delivery** — untested; not-claimed.

## Safety and handoff

- The private mode-0600 manifest at /tmp/clinicflow-auth-flows-audit.json was removed after verified cleanup.
- All synthetic addresses use Clerk's documented `+clerk_test` development pattern; the patient browser code is `424242`.
- Fixture app records are created through guarded APIs after only the Super Admin bootstrap is inserted directly.
- Existing records are never updated. Cleanup validates exact fixture ownership and requires the original database snapshot to be restored byte-for-byte after normalization.
- The invitation fixture uses `notify:false`; no email delivery or mailbox evidence is claimed.

## Browser provenance

- New and existing patient OTP, exact single user/master linkage, logout, and relogin passed in the parent browser.
- Password-only dashboards passed for all four staff roles; invalid-password, wrong-role, and unauthenticated denial also passed.
- recoveryStaff passwordless reset and password-only dashboard passed; Super Admin reset and password login passed.
- A Super Admin authenticated reload after 75 seconds retained `/me` 200 without another password prompt.
- Invitation acceptance remained CAPTCHA-blocked; browser setup, reuse, and expiry are not claimed.
- Before cleanup, the latest notify:false invitation used the HTTPS app `/set-password` redirect. The provider fixture and private URL have now been removed.

## Commands

Run from the workspace root only after the API server has been restarted with the new authentication implementation:

```sh
NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --setup
NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --run
NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --verify-cleanup-readiness
NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --cleanup --confirm-cleanup
```

Setup and run are checkpointed in the private manifest. Cleanup is deliberately explicit.

## Truthful limitations

- The notify:false Clerk invitation is provider state/link evidence only. No mailbox delivery is claimed.
- The API runner did not simulate browser OTP verification. The parent-observed browser pass completed real Clerk development email-code verification and patient onboarding.
- The guarded clinical regression uses only this suite's owned fixture graph; the separate ownership runner and its manifest are never reused.
- No authentication method is faked; API requests use real Clerk development sessions and the live staff password verification endpoint.
- After the user disabled DEVELOPMENT Device Trust, the parent browser verified password-only dashboards for all four staff roles, invalid-password and wrong-role denial, reset-password logins, and authenticated reload persistence.
- General notifications are persisted configuration only. No notification dispatcher, notification table, in-app inbox, or real message delivery is implemented or claimed.
- Invitation resend and revoked states use a separate owned probe. Expired and used states are not live-tested because doing so would require time manipulation or acceptance that could interfere with the browser pass.

## Cleanup verification

- Marker-owned database rows and Clerk fixtures were removed.
- The normalized database snapshot exactly matches the pre-fixture baseline.
- The private manifest was removed.
- Independent post-cleanup checks found 0 database marker rows, 0 owned Clerk users, and 0 pending owned invitations.
- Removing owned Clerk users removed their provider sessions; the exact restored database baseline includes no fixture staff proofs or sessions.
- Clerk retains revoked invitation history as provider audit state; no pending/usable fixture invitation remains.
