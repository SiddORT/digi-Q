# Authentication flows API audit

**Status:** cleaned
**Generated:** 2026-09-22T17:58:40.696Z
**Result:** 104 passed, 1 failed.

## Provider feasibility

- A disposable Clerk development user was created with a reserved email identification and `skipPasswordRequirement`.
- Clerk reported password disabled and no initial email verification; the disposable probe was deleted immediately.
- Provider viability was subsequently confirmed in the parent browser: real Clerk development email-code verification and patient onboarding passed.

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
| setup-03-app-owned-scope | PASS | Deactivate fixture staff through app API | PATCH /users/67f6a14f-4230-4180-832f-0a0650db2ac6 200 | Expected 200 and received 200. |
| setup-04-reserved-patient | PASS | Reserved patient has no password |    | Clerk reports passwordEnabled false. |
| setup-04-reserved-patient | PASS | Reserved patient awaits real email-code verification |    | The provider identity remains reserved/unverified until Clerk's email-code factor is completed. |
| setup-04b-api-patient | PASS | Patient first-login onboarding remains available | POST /onboarding 201 | Expected 201 and received 201. |
| setup-05-non-delivery-invitation | PASS | Non-delivery invitation fixture created |    | Clerk accepted an invitation with notify:false. This is link/state evidence only; no mailbox delivery is claimed. |
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
| run-01-entry-separation | FAIL | Staff entry rejects reserved OTP patient | POST /auth/staff-entry 429 | Checkpoint retained: the original global 10-per-10-minute IP bucket blocked the final negative after all preceding entry assertions passed. It is not retried. |
| browser-fixture-refresh | PASS | clinicAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| browser-fixture-refresh | PASS | Create scoped invited Receptionist through authorized app API | POST /users 201 | Expected 201 and received 201. |
| browser-fixture-refresh | PASS | Latest invited Receptionist ticket is non-delivery |    | The app profile is persisted and every older pending ticket was revoked before storing a fresh notify:false URL privately. |
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
| run-03-patient-and-role-authorization | PASS | Doctor reaches own dashboard identity API | GET /doctors/1daa7f1e-c699-4244-800b-d60867336b64 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Doctor dashboard identity is exact |    | Doctor profile and app user remain linked. |
| run-03-patient-and-role-authorization | PASS | Doctor cannot access platform audit logs | GET /audit-logs?pageSize=1 403 | Expected 403 and received 403. |
| run-03-patient-and-role-authorization | PASS | Receptionist cannot access platform audit logs | GET /audit-logs?pageSize=1 403 | Expected 403 and received 403. |
| run-03-patient-and-role-authorization | PASS | Receptionist reaches scoped operational API | GET /appointments?pageSize=1 200 | Expected 200 and received 200. |
| run-03-patient-and-role-authorization | PASS | Clinic Admin can initiate supported recovery instructions for linked passwordless staff | POST /users/d5f3e1db-c15e-4569-9e0d-95a06a524d4f/password-reset 202 | Expected 202 and received 202. |
| run-03-patient-and-role-authorization | PASS | Recovery response directs to Clerk secure flow |    | The endpoint returns the supported Clerk forgot-password path without credentials or a server-generated password. |
| run-04-invariance | PASS | Authentication leaves role and clinic mappings invariant |    | Clinic ownership, branches, staff assignments, and Doctor ownership exactly match the post-setup snapshot. |
| run-04-invariance | PASS | Patient master remains intact |    | Authentication checks did not recreate or alter patient identity linkage. |
| run-05-clinical-regression | PASS | doctor establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | receptionist establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Reload verified patient mobile checkpoint |    | The live patient master retains successful mobile verification. |
| run-05-clinical-regression | PASS | Reload guarded Doctor availability checkpoint | GET /schedules/bda7d5d3-37dc-4bc0-801a-5d25c1d5e6dc 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Mismatched cross-clinic branch availability is rejected | POST /schedules 400 | Expected 400/403/409 and received 400. |
| run-05-clinical-regression | PASS | Reload signed booking QR resource | GET /qrs/0e4202a1-c636-4931-b4b4-0e92b6926572 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Mismatched cross-clinic appointment branch is rejected | POST /appointments 400 | Expected 400/403/409 and received 400. |
| run-05-clinical-regression | PASS | Patient reads own clinical appointment | GET /appointments/6a4dd597-f6a3-4834-ac42-ff6a543dc495 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Owned clinical booking mapping is exact |    | The retained appointment maps the fixture Patient, Doctor, Clinic A, and Branch A exactly. |
| run-05-clinical-regression | PASS | Clinical journey reaches completed |    | Availability, booking, signed QR check-in, queue, and consultation state transitions completed once. |
| run-05-clinical-regression | PASS | Persisted clinical history proves QR and queue journey |    | Appointment history contains checked-in, waiting, called, in-consultation, and completed transitions. |
| run-05-clinical-regression | PASS | Receptionist reads scoped queue | GET /queue?doctorId=1daa7f1e-c699-4244-800b-d60867336b64&branchId=edcf37a5-7cbd-4e98-a42d-43aee76c48d9&date=2026-09-22 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Doctor reads scoped dashboard | GET /dashboard 200 | Expected 200 and received 200. |
| run-05-clinical-regression | PASS | Receptionist reads scoped report | GET /reports 200 | Expected 200 and received 200. |
| browser-fixture-refresh | PASS | clinicAdmin establishes session-bound password proof | POST /auth/staff-verify 200 | Expected 200 and received 200. |
| browser-fixture-refresh | PASS | Latest invited Receptionist ticket is non-delivery |    | The app profile is persisted and every older pending ticket was revoked before storing a fresh notify:false URL privately. |
| run-01b-corrected-limiter-negative | PASS | Corrected limiter permits authoritative patient-to-staff rejection | POST /auth/staff-entry 403 | Expected 403 and received 403. |
| run-01b-corrected-limiter-negative | PASS | Historical limiter failure remains provenance only |    | The pre-restart 429 is retained unchanged; this separate post-restart request reached role enforcement and returned 403. |

## Safety and handoff

- The private mode-0600 manifest at /tmp/clinicflow-auth-flows-audit.json was removed after verified cleanup.
- All synthetic addresses use Clerk's documented `+clerk_test` development pattern; the patient browser code is `424242`.
- Fixture app records are created through guarded APIs after only the Super Admin bootstrap is inserted directly.
- Existing records are never updated. Cleanup validates exact fixture ownership and requires the original database snapshot to be restored byte-for-byte after normalization.
- The invitation fixture uses `notify:false`; no email delivery or mailbox evidence is claimed.

## Browser provenance

- Patient OTP verification and onboarding passed in the parent browser using the genuine Clerk development tenant.
- Staff browser login is not yet claimed: after verified password, Clerk required the genuine `needs_client_trust` email-code second factor. Tenant settings were not changed and no workaround was used.
- Before cleanup, the latest notify:false invitation used the HTTPS app `/set-password` redirect. The provider fixture and private URL have now been removed.

## Commands

Run from the workspace root only after the API server has been restarted with the new authentication implementation:

```sh
NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --setup
NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --run
NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --cleanup --confirm-cleanup
```

Setup and run are checkpointed in the private manifest. Cleanup is deliberately explicit.

## Truthful limitations

- The notify:false Clerk invitation is provider state/link evidence only. No mailbox delivery is claimed.
- The API runner did not simulate browser OTP verification. The parent-observed browser pass completed real Clerk development email-code verification and patient onboarding.
- The guarded clinical regression uses only this suite's owned fixture graph; the separate ownership runner and its manifest are never reused.
- No authentication method is faked; API requests use real Clerk development sessions and the live staff password verification endpoint.
- Patient browser OTP and onboarding passed. Staff browser login is not yet claimed because the genuine tenant required Clerk Device Trust (needs_client_trust) after the verified password.

## Cleanup verification

- Marker-owned database rows and Clerk fixtures were removed.
- The normalized database snapshot exactly matches the pre-fixture baseline.
- The private manifest was removed.
- Before cleanup, Clerk reported `passwordEnabled: true` for recoveryStaff and every ordinary password staff fixture; no password or token value was read or reported.
- The latest invitation was revoked if still pending, all owned provider identities were removed, and no private invitation URL was retained.
