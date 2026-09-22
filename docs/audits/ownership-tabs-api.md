# Ownership tabs API regression

**Status:** executed
**Generated:** 2026-09-22T14:54:42.621Z
**Marker:** CF-OWN-20260922144055-d37001
**Result:** 93 passed, 0 failed.
**Checkpoint:** all live units complete

## Evidence

| Unit | Outcome | Assertion | Route/status | Evidence |
|---|---|---|---|---|
| 00-development-identities | PASS | Live API health | GET /healthz 200 | Expected 200 and received 200. |
| 01-owner-fixture | PASS | Create Clinic A owned by Admin A | POST /clinics 201 | Expected 201 and received 201. |
| 01-owner-fixture | PASS | Create Clinic A branch | POST /branches 201 | Expected 201 and received 201. |
| 01-owner-fixture | PASS | Create Clinic B owned by same Admin A | POST /clinics 201 | Expected 201 and received 201. |
| 01-owner-fixture | PASS | Create Clinic B branch | POST /branches 201 | Expected 201 and received 201. |
| 01-owner-fixture | PASS | Create Admin A clinic intentionally unassigned to Doctor A | POST /clinics 201 | Expected 201 and received 201. |
| 01-owner-fixture | PASS | Create unassigned clinical-scope branch | POST /branches 201 | Expected 201 and received 201. |
| 01-owner-fixture | PASS | Create cross-owner Clinic Z | POST /clinics 201 | Expected 201 and received 201. |
| 01-owner-fixture | PASS | Create Clinic Z branch | POST /branches 201 | Expected 201 and received 201. |
| runner | PASS | Live API health | GET /healthz 200 | Expected 200 and received 200. |
| 02-derived-staff | PASS | Admin A creates Doctor X across both owned clinics without selecting managing admin | POST /doctors 201 | Expected 201 and received 201. |
| 02-derived-staff | PASS | Super Admin creates Receptionist X without selecting managing admin | POST /users 201 | Expected 201 and received 201. |
| 02-derived-staff | PASS | Doctor canonical manager aliases agree |    | ownerAdminId and canonical managingAdminId both resolve to Admin A. |
| 02-derived-staff | PASS | Doctor ownership and invitation projection is complete |    | Manager name, notRequired invitation state, and nullable createdAt are projected. |
| 02-derived-staff | PASS | Receptionist canonical manager projection persists |    | users.managingAdminId/name, notRequired invitation state, and nullable createdAt are projected. |
| 02-derived-staff | PASS | doctorA authenticates with persisted role | GET /me 200 | Expected 200 and received 200. |
| 02-derived-staff | PASS | receptionistA authenticates with persisted role | GET /me 200 | Expected 200 and received 200. |
| 02b-projection-and-invitation-contract | PASS | Read owned clinic projection | GET /clinics/1ecc29c7-b33a-47bc-bba0-e6ecde78fa81 200 | Expected 200 and received 200. |
| 02b-projection-and-invitation-contract | PASS | Clinic projects owner name |    | Clinic adminId and adminName identify Admin A. |
| 02b-projection-and-invitation-contract | PASS | Resend invitation is idempotent for an already-linked fixture identity | POST /users/3f5b5a9c-6777-4bec-9e97-2a8c24f0d857/resend-invitation 200 | Expected 200 and received 200. |
| 02b-projection-and-invitation-contract | PASS | Linked resend returns updated user |    | The linked existing fixture identity converged to invitationStatus notRequired. |
| 02b-projection-and-invitation-contract | PASS | Concurrent linked resends converge |    | Both advisory-lock-protected calls returned the same updated user with notRequired. |
| 03-assignment-options | PASS | superAdmin reads doctor assignment options | GET /staff-assignment-options?targetRole=doctor&doctorId=20e51064-fa03-4f18-bd19-033456e3bb97 200 | Expected 200 and received 200. |
| 03-assignment-options | PASS | superAdmin options derive Admin A clinics |    | Options contain all and only the selected staff member's managing-admin clinics. |
| 03-assignment-options | PASS | superAdmin options group valid branches and one manager |    | Branches remain owner-scoped and managingAdmins contains exactly Admin A. |
| 03-assignment-options | PASS | adminA reads doctor assignment options | GET /staff-assignment-options?targetRole=doctor&doctorId=20e51064-fa03-4f18-bd19-033456e3bb97 200 | Expected 200 and received 200. |
| 03-assignment-options | PASS | adminA options derive Admin A clinics |    | Options contain all and only the selected staff member's managing-admin clinics. |
| 03-assignment-options | PASS | adminA options group valid branches and one manager |    | Branches remain owner-scoped and managingAdmins contains exactly Admin A. |
| 03-assignment-options | PASS | doctorA reads receptionist assignment options | GET /staff-assignment-options?targetRole=receptionist&userId=3f5b5a9c-6777-4bec-9e97-2a8c24f0d857 200 | Expected 200 and received 200. |
| 03-assignment-options | PASS | doctorA options derive Admin A clinics |    | Options contain all and only the selected staff member's managing-admin clinics. |
| 03-assignment-options | PASS | doctorA options group valid branches and one manager |    | Branches remain owner-scoped and managingAdmins contains exactly Admin A. |
| 04-doctor-owner-catalog-and-clinical-scope | PASS | Doctor reads owner-managed receptionist catalog | GET /staff-assignment-options?targetRole=receptionist 200 | Expected 200 and received 200. |
| 04-doctor-owner-catalog-and-clinical-scope | PASS | Doctor staff catalog includes all owner clinics only |    | Assignment catalog includes the owner-managed unassigned clinic but excludes Admin B Clinic Z. |
| 04-doctor-owner-catalog-and-clinical-scope | PASS | Doctor reads exact clinical clinic scope | GET /clinics?pageSize=100 200 | Expected 200 and received 200. |
| 04-doctor-owner-catalog-and-clinical-scope | PASS | Doctor clinical catalog stays assignment-scoped |    | Clinical clinic list excludes the owner-managed but unassigned location. |
| 04-doctor-owner-catalog-and-clinical-scope | PASS | Doctor clinical schedule operation denied at owner-managed but unassigned branch | POST /schedules 403 | Expected 403 and received 403. |
| 04-doctor-owner-catalog-and-clinical-scope | PASS | Doctor queue operations denied at owner-managed but unassigned branch | GET /queue?doctorId=20e51064-fa03-4f18-bd19-033456e3bb97&branchId=80758cf8-40aa-4905-b519-a991fc4082b2&date=2026-09-22 409 | Expected 403/409 and received 409. |
| 05-doctor-cascade | PASS | Doctor X creates Clinic C | POST /clinics 201 | Expected 201 and received 201. |
| 05-doctor-cascade | PASS | Doctor-created Clinic C owner is derived |    | Clinic C is owned by Doctor X's Admin A. |
| 05-doctor-cascade | PASS | Doctor creates Clinic C branch | POST /branches 201 | Expected 201 and received 201. |
| 05-doctor-cascade | PASS | Doctor creates Receptionist Y in owner-managed branch not assigned for clinical operations | POST /users 201 | Expected 201 and received 201. |
| 05-doctor-cascade | PASS | Doctor-created Receptionist Y manager derives from selected clinic |    | Receptionist Y persisted Admin A despite Doctor X lacking clinical assignment there. |
| 05-doctor-cascade | PASS | Receptionist requires at least one branch for every selected clinic | PATCH /users/7e40d90d-c019-49f0-8826-72473dc1764a 400 | Expected 400/409 and received 400. |
| 06-role-tabs-query-contract | PASS | clinicAdmin role list supports search, newest sorting, and pagination | GET /users?role=clinicAdmin&search=CF-OWN-20260922144055-d37001&page=1&pageSize=1&sort=-createdAt 200 | Expected 200 and received 200. |
| 06-role-tabs-query-contract | PASS | clinicAdmin projection counts are coherent |    | Total is pre-pagination and one newest matching row is projected. |
| 06-role-tabs-query-contract | PASS | clinicAdmin list contains only requested role |    | The paged result is role-specific. |
| 06-role-tabs-query-contract | PASS | doctor role list supports search, newest sorting, and pagination | GET /users?role=doctor&search=CF-OWN-20260922144055-d37001&page=1&pageSize=1&sort=-createdAt 200 | Expected 200 and received 200. |
| 06-role-tabs-query-contract | PASS | doctor projection counts are coherent |    | Total is pre-pagination and one newest matching row is projected. |
| 06-role-tabs-query-contract | PASS | receptionist role list supports search, newest sorting, and pagination | GET /users?role=receptionist&search=CF-OWN-20260922144055-d37001&page=1&pageSize=1&sort=-createdAt 200 | Expected 200 and received 200. |
| 06-role-tabs-query-contract | PASS | receptionist projection counts are coherent |    | Total is pre-pagination and one newest matching row is projected. |
| 06-role-tabs-query-contract | PASS | receptionist list contains only requested role |    | The paged result is role-specific. |
| 06-role-tabs-query-contract | PASS | Role list filter contract accepts mobile/ownership/location/status filters | GET /doctors?clinicId=1ecc29c7-b33a-47bc-bba0-e6ecde78fa81&managingAdminId=0f6b87a2-ba2d-49f5-abf9-49199cbb807c&status=active&pageSize=20 200 | Expected 200 and received 200. |
| 07-rejections-and-immutability | PASS | Super Admin cannot create staff from clinics with different owners | POST /doctors 409 | Expected 409 and received 409. |
| 07-rejections-and-immutability | PASS | Cross-owner doctor create is rejected before duplicate reuse | POST /doctors 409 | Expected 403/409 and received 409. |
| 07-rejections-and-immutability | PASS | Existing doctor manager is immutable | PATCH /doctors/20e51064-fa03-4f18-bd19-033456e3bb97 409 | Expected 409 and received 409. |
| 07-rejections-and-immutability | PASS | Existing receptionist manager is immutable | PATCH /users/3f5b5a9c-6777-4bec-9e97-2a8c24f0d857 409 | Expected 409 and received 409. |
| 07-rejections-and-immutability | PASS | Cross-owner doctor edit is rejected | PATCH /doctors/20e51064-fa03-4f18-bd19-033456e3bb97 409 | Expected 403/409 and received 409. |
| 07-rejections-and-immutability | PASS | Super Admin cannot edit staff into mixed-owner clinic scope | PATCH /doctors/20e51064-fa03-4f18-bd19-033456e3bb97 409 | Expected 409 and received 409. |
| 07-rejections-and-immutability | PASS | Cross-owner receptionist edit is rejected | PATCH /users/3f5b5a9c-6777-4bec-9e97-2a8c24f0d857 409 | Expected 403/409 and received 409. |
| 07-rejections-and-immutability | PASS | Ownership transfer is rejected while dependents exist | PATCH /clinics/1ecc29c7-b33a-47bc-bba0-e6ecde78fa81 409 | Expected 409 and received 409. |
| 08-duplicates-and-races | PASS | Duplicate staff identity is rejected | POST /users 409 | Expected 409 and received 409. |
| 08-duplicates-and-races | PASS | Concurrent assignment writes are bounded |    | Concurrent statuses were 200/200. |
| 08-duplicates-and-races | PASS | Concurrent writes leave no duplicate mappings |    | Database uniqueness retained one row per assignment key. |
| 08-duplicates-and-races | PASS | Mixed-owner assignment race has one valid winner |    | Concurrent statuses were 200/409. |
| 08-duplicates-and-races | PASS | Mixed-owner race leaves no cross-owner rows |    | Database state contains only Admin A clinic assignments after the race. |
| 09-patient-and-operational-smoke | PASS | Self-onboarding is patient-only | POST /onboarding 400 | Doctor self-onboarding was rejected with 400. |
| 09-patient-and-operational-smoke | PASS | Rejected self-onboarding creates no orphan profile |    | No application user was created for the rejected doctor intent. |
| 09-patient-and-operational-smoke | PASS | Patient creates isolated fixture profile | POST /onboarding 201 | Expected 201 and received 201. |
| 09-patient-and-operational-smoke | PASS | Patient requests development OTP | POST /otp/request 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Development OTP provider is explicit |    | In-band development code is consumed and never reported. |
| 09-patient-and-operational-smoke | PASS | Patient verifies fixture mobile | POST /otp/verify 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Create today schedule for operational smoke | POST /schedules 201 | Expected 201 and received 201. |
| 09-patient-and-operational-smoke | PASS | Create booking QR | POST /qrs 201 | Expected 201 and received 201. |
| 09-patient-and-operational-smoke | PASS | Patient books appointment | POST /appointments 201 | Expected 201 and received 201. |
| 09-patient-and-operational-smoke | PASS | Read resumable operational appointment | GET /appointments/b4774f63-3035-4cd3-aae3-439c6b1afee6 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Patient reads signed appointment QR | GET /appointments/b4774f63-3035-4cd3-aae3-439c6b1afee6/qr 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Receptionist checks in through QR | POST /appointment-qr/check-in 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Doctor calls queue patient | POST /queue/call-next 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Doctor starts consultation | POST /appointments/b4774f63-3035-4cd3-aae3-439c6b1afee6/actions 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Doctor completes consultation | POST /appointments/b4774f63-3035-4cd3-aae3-439c6b1afee6/actions 200 | Expected 200 and received 200. |
| 09-patient-and-operational-smoke | PASS | Operational appointment reaches completed |    | Resume-aware QR and queue flow completed exactly once. |
| 09-patient-and-operational-smoke | PASS | Retain booked-today appointment for one browser QR pass | POST /appointments 201 | Expected 201 and received 201. |
| 09-patient-and-operational-smoke | PASS | Prepare retained appointment QR | GET /appointments/56f94c6b-7b3c-4197-8f09-27d19fadb7dc/qr 200 | Expected 200 and received 200. |
| 10-ownership-concurrency | PASS | Reload checkpointed Create isolated empty clinic for stale ownership race | GET /clinics/a1a6b2f7-1c6f-4282-bb74-553782a36554 200 | Expected 200 and received 200. |
| 10-ownership-concurrency | PASS | Reset isolated race clinic to neutral initial owner | PATCH /clinics/a1a6b2f7-1c6f-4282-bb74-553782a36554 200 | Expected 200 and received 200. |
| 10-ownership-concurrency | PASS | Concurrent stale ownership claims allow one winner |    | Statuses 200/409; final owner AdminA; owner links 1. |
| 10-ownership-concurrency | PASS | Ownership race leaves one canonical owner mapping |    | Statuses 200/409; final owner AdminA; owner links 1. |
| 11-database-integrity | PASS | Canonical persisted managers are single and consistent |    | Doctor ownerAdminId and receptionist managingAdminId all equal Admin A. |
| 11-database-integrity | PASS | Clinic ownership projection is exact |    | A/B/C/U have Admin A and Z has Admin B, with one adminId per clinic. |
| 11-database-integrity | PASS | Fixture has no duplicate assignment keys |    | Every marker assignment is unique. |
| 11-database-integrity | PASS | Fixture has no mismatched or orphan branches |    | Every branch assignment belongs to its recorded clinic. |
| 11-database-integrity | PASS | Database rejects mixed-owner clinic/branch probe |    | Composite branch/clinic FK returned PostgreSQL 23503. |
| 12-reserve-browser-identities | PASS | Browser form identities are reserved without app profiles |    | Verified Clerk test identities for one Doctor form and one Receptionist form are retained only in the mode-0600 manifest. |

## Safety

- Development mode, Clerk `sk_test_`, DATABASE_URL, and non-deployment guards are mandatory.
- Every protected request uses a real Clerk development session. There is no authentication bypass.
- Existing Clerk fixture identities are created before staff APIs run, so no real invitation email is sent.
- Requests are throttled and retry only HTTP 429 responses.
- Reports redact email, mobile, credentials, tokens, OTPs, QR payloads, and authorization material.
- The mode-0600 temporary credential manifest was removed after the completed browser pass.
- Resume skips every completed unit. Mutation IDs are persisted immediately so a failed unit does not recreate successful fixture records.
- Cleanup requires marker and ownership validation, compares pre-existing snapshots, and removes only the owned fixture graph.

## Deliberate exclusions / merge coordination

- Task 3 atomic Clinic Admin plus first-clinic flow is not duplicated by this suite and must be reviewed after its merge.
- Responsive tabs, mobile search/filter controls, and real Clerk sign-in are reserved for the single parent browser pass.
- Invitation injected-failure and 409 identity-conflict behavior are covered by the 20 isolated backend regressions; live email delivery is intentionally not invoked.

## Cleanup verification

- Marker-owned database and Clerk fixtures removed.
- Both browser-created application profiles were removed (one Doctor and one Receptionist).
- Remaining marker counts are zero for users, Doctor/Receptionist role profiles, clinics, branches, audit logs, and Clerk identities.
- Pre-existing data and approved ownership snapshots were preserved exactly.
- Temporary credential file removed.
- Cleanup exceptions: none.
