# Assignment API verification

**Executed:** 2026-09-22T13:30:18.519Z
**Marker:** CF-ASSIGN-20260922131518-807f59
**Result:** 141 passed, 0 failed, 0 skipped.
**Historical:** This report predates the canonical managing-admin owner boundary. It is retained as historical evidence and was not rerun; use the ownership-tabs regression for the current contract.

## Evidence

| Outcome | Assertion | Route/status | Evidence |
|---|---|---|---|
| PASS | SuperAdmin creates Clinic A with Admin A | POST /clinics 201 | Expected 201 and received 201. |
| PASS | SuperAdmin creates Branch A1 | POST /branches 201 | Expected 201 and received 201. |
| PASS | adminA re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Admin A reads assigned Clinic A after re-auth | GET /clinics?pageSize=100 200 | Expected 200 and received 200. |
| PASS | Admin A Clinic A projection |    | Clinic A is immediately in Admin A scope. |
| PASS | Admin A creates Doctor A through API | POST /doctors 201 | Expected 201 and received 201. |
| PASS | Admin A creates Receptionist A with mandatory branch | POST /users 201 | Expected 201 and received 201. |
| PASS | doctorA re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | receptionistA re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Doctor A reads persisted Clinic A and Branch A1 | GET /me 200 | Expected 200 and received 200. |
| PASS | Doctor A initial assignment |    | Re-authenticated identity contains Clinic A / Branch A1. |
| PASS | Doctor A creates Receptionist B in own scope | POST /users 201 | Expected 201 and received 201. |
| PASS | receptionistB re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | superAdmin reads Doctor-created Receptionist B | GET /users?role=receptionist&pageSize=100 200 | Expected 200 and received 200. |
| PASS | superAdmin Receptionist B visibility |    | Shared persisted staff mapping is visible. |
| PASS | adminA reads Doctor-created Receptionist B | GET /users?role=receptionist&pageSize=100 200 | Expected 200 and received 200. |
| PASS | adminA Receptionist B visibility |    | Shared persisted staff mapping is visible. |
| PASS | doctorA reads Doctor-created Receptionist B | GET /users?role=receptionist&pageSize=100 200 | Expected 200 and received 200. |
| PASS | doctorA Receptionist B visibility |    | Shared persisted staff mapping is visible. |
| PASS | Doctor A creates Clinic B | POST /clinics 201 | Expected 201 and received 201. |
| PASS | Doctor A creates Branch B1 | POST /branches 201 | Expected 201 and received 201. |
| PASS | doctorA re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | doctorA refreshes doctor-created clinic scope | GET /clinics?pageSize=100 200 | Expected 200 and received 200. |
| PASS | doctorA sees Clinic B |    | Doctor-created clinic cascade is persisted. |
| PASS | doctorA reads Branch B1 | GET /branches?clinicId=2d0bc73e-21b8-409c-b7ce-b1a65ee67c13&pageSize=100 200 | Expected 200 and received 200. |
| PASS | doctorA sees Branch B1 |    | Doctor-created branch is visible to the cascade. |
| PASS | adminA re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | adminA refreshes doctor-created clinic scope | GET /clinics?pageSize=100 200 | Expected 200 and received 200. |
| PASS | adminA sees Clinic B |    | Doctor-created clinic cascade is persisted. |
| PASS | adminA reads Branch B1 | GET /branches?clinicId=2d0bc73e-21b8-409c-b7ce-b1a65ee67c13&pageSize=100 200 | Expected 200 and received 200. |
| PASS | adminA sees Branch B1 |    | Doctor-created branch is visible to the cascade. |
| PASS | superAdmin re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | superAdmin refreshes doctor-created clinic scope | GET /clinics?pageSize=100 200 | Expected 200 and received 200. |
| PASS | superAdmin sees Clinic B |    | Doctor-created clinic cascade is persisted. |
| PASS | superAdmin reads Branch B1 | GET /branches?clinicId=2d0bc73e-21b8-409c-b7ce-b1a65ee67c13&pageSize=100 200 | Expected 200 and received 200. |
| PASS | superAdmin sees Branch B1 |    | Doctor-created branch is visible to the cascade. |
| PASS | Second admin ownership conflict | PATCH /clinics/2d0bc73e-21b8-409c-b7ce-b1a65ee67c13 403 | A second ClinicAdmin cannot take over Clinic B. |
| PASS | Ownership preserved after conflict |    | Rejected second-admin request did not alter Clinic B adminId or assignments. |
| PASS | Admin A maps Doctor A to Branch B1 | PATCH /doctors/b5de426a-74fe-4595-bf5e-a10ce6edc0b5 200 | Expected 200 and received 200. |
| PASS | Admin A maps Receptionist B to Branch B1 | PATCH /users/33f58ffd-0e83-4f6a-b252-7eae2190ed21 200 | Expected 200 and received 200. |
| PASS | Concurrent duplicate mapping requests are bounded |    | Both requests completed or conflicted without a server error. |
| PASS | Concurrent mapping leaves one Branch B1 row |    | Database uniqueness preserved exactly one receptionist/branch mapping. |
| PASS | Resume checkpoint is complete |    | Existing fixture contains every ID required after the assignment phase. |
| PASS | Concurrent branch creation is unique |    | Expected one 201 and one 409; received 201/409. |
| PASS | Doctor A creates Branch B1 schedule | POST /schedules 201 | Expected 201 and received 201. |
| PASS | Reject cross-location overlapping schedule | POST /schedules 409 | Expected 409 and received 409. |
| PASS | Create future Branch B schedule for exception collision | POST /schedules 201 | Expected 201 and received 201. |
| PASS | Create non-overlapping Branch A schedule | POST /schedules 201 | Expected 201 and received 201. |
| PASS | Receptionist exception cannot overlap another location | POST /availability-exceptions 409 | Expected 409 and received 409. |
| PASS | Receptionist manages authorized Doctor A availability | POST /availability-exceptions 201 | Expected 201 and received 201. |
| PASS | Admin A creates peer doctor through API | POST /doctors 201 | Expected 201 and received 201. |
| PASS | peerDoctor re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Peer doctor cannot manage Doctor A availability | POST /availability-exceptions 403 | Expected 403 and received 403. |
| PASS | Patient creates minimal self profile through onboarding API | POST /onboarding 201 | Expected 201 and received 201. |
| PASS | Patient requests development mobile OTP | POST /otp/request 200 | Expected 200 and received 200. |
| PASS | Development OTP is explicitly enabled |    | Development-only provider returned an in-band code; report redaction suppresses it. |
| PASS | Patient verifies mobile OTP | POST /otp/verify 200 | Expected 200 and received 200. |
| PASS | Doctor creates Branch B booking QR | POST /qrs 201 | Expected 201 and received 201. |
| PASS | Public booking QR resolves without identity data | GET /public/qr/XKvorTn8uqJCuMMGnWWieO1r08KPeLXTx3gyZyUM1JY 200 | Expected 200 and received 200. |
| PASS | Patient online booking | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Patient gets signed appointment QR | GET /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97/qr 200 | Expected 200 and received 200. |
| PASS | Receptionist resolves appointment QR | POST /appointment-qr/resolve 200 | Expected 200 and received 200. |
| PASS | Receptionist QR check-in uses queue engine | POST /appointment-qr/check-in 200 | Expected 200 and received 200. |
| PASS | QR check-in enqueues atomically |    | Appointment reached waiting through signed QR flow. |
| PASS | Appointment QR remains retrievable after check-in | GET /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97/qr 200 | Expected 200 and received 200. |
| PASS | Appointment QR preserved |    | Signed QR payload remains stable through lifecycle changes. |
| PASS | Doctor calls QR-checked-in patient | POST /queue/call-next 200 | Expected 200 and received 200. |
| PASS | Queue calls expected QR appointment |    | Call-next selected the connected online booking. |
| PASS | Doctor starts consultation | POST /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97/actions 200 | Expected 200 and received 200. |
| PASS | Doctor completes consultation | POST /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97/actions 200 | Expected 200 and received 200. |
| PASS | Patient reads completed history | GET /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97 200 | Expected 200 and received 200. |
| PASS | Connected lifecycle history is complete |    | Patient history contains every queue transition in order. |
| PASS | Receptionist creates phone booking | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Resume checkpoint is complete |    | Existing fixture contains every ID required after the assignment phase. |
| PASS | Advanced resume checkpoint is complete |    | Schedules, peer doctor, patient, booking QR, and completed online flow remain persisted. |
| PASS | Reload signed appointment QR at advanced checkpoint | GET /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97/qr 200 | Expected 200 and received 200. |
| PASS | Phone booking checks in | POST /appointments/9959f0c7-4d1e-4bf6-92cd-963e1158fbff/actions 200 | Expected 200 and received 200. |
| PASS | Phone booking enters queue | POST /appointments/9959f0c7-4d1e-4bf6-92cd-963e1158fbff/actions 200 | Expected 200 and received 200. |
| PASS | Doctor calls phone booking | POST /queue/call-next 200 | Expected 200 and received 200. |
| PASS | Doctor starts phone consultation | POST /appointments/9959f0c7-4d1e-4bf6-92cd-963e1158fbff/actions 200 | Expected 200 and received 200. |
| PASS | Doctor completes phone consultation | POST /appointments/9959f0c7-4d1e-4bf6-92cd-963e1158fbff/actions 200 | Expected 200 and received 200. |
| PASS | Receptionist creates walk-in booking | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Walk-in enters same queue engine |    | Walk-in atomically reached waiting. |
| PASS | Walk-in no-show transition | POST /appointments/79115748-e10a-463d-9534-1e153dace092/actions 200 | Expected 200 and received 200. |
| PASS | Patient books from clinic QR source | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Prepare booked appointment QR for browser scanning | GET /appointments/00be430f-c4d0-402c-be20-a13e3430e60f/qr 200 | Expected 200 and received 200. |
| PASS | All four booking sources persisted |    | Online, phone, walk-in, and QR all used the live appointment API. |
| PASS | Receptionist A requests out-of-scope appointments filter | GET /appointments?clinicId=2d0bc73e-21b8-409c-b7ce-b1a65ee67c13&pageSize=100 200 | Expected 200 and received 200. |
| PASS | Appointments response has no Clinic B leakage |    | Response omitted out-of-scope IDs and marker names. |
| PASS | Receptionist A requests out-of-scope doctor projection | GET /doctors?clinicId=2d0bc73e-21b8-409c-b7ce-b1a65ee67c13&pageSize=100 200 | Expected 200 and received 200. |
| PASS | Shared doctor projection hides out-of-scope mappings |    | Response omitted out-of-scope IDs and marker names. |
| PASS | Receptionist A reads shared Doctor A projection | GET /doctors?clinicId=9cabfba9-d5ab-4b64-868f-daed88400d0b&pageSize=100 200 | Expected 200 and received 200. |
| PASS | Shared doctor mapping projection is scoped |    | Receptionist A sees the shared doctor with only Clinic A / Branch A1 mappings. |
| PASS | Non-assignment doctor edit preserves omitted mappings | PATCH /doctors/b5de426a-74fe-4595-bf5e-a10ce6edc0b5 200 | Expected 200 and received 200. |
| PASS | Hidden doctor mapping survives profile edit |    | Clinic B / Branch B1 remained persisted when assignment arrays were omitted. |
| PASS | Receptionist A cannot read Branch B queue | GET /queue?doctorId=b5de426a-74fe-4595-bf5e-a10ce6edc0b5&branchId=45e1f561-de37-45d6-a0ab-27e91326a6d9&date=2026-09-22 403 | Expected 403 and received 403. |
| PASS | Receptionist A cannot resolve Branch B appointment QR | POST /appointment-qr/resolve 403 | Expected 403 and received 403. |
| PASS | Receptionist A cannot read Branch B patient | GET /patients/9e581d0f-cbfe-416c-b84a-a841c5e873ea 403 | Expected 403 and received 403. |
| PASS | Admin revokes Receptionist B Branch B scope only | PATCH /users/33f58ffd-0e83-4f6a-b252-7eae2190ed21 200 | Expected 200 and received 200. |
| PASS | receptionistB re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Resume checkpoint is complete |    | Existing fixture contains every ID required after the assignment phase. |
| PASS | Advanced resume checkpoint is complete |    | Schedules, peer doctor, patient, booking QR, and completed online flow remain persisted. |
| PASS | Reload signed appointment QR at advanced checkpoint | GET /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97/qr 200 | Expected 200 and received 200. |
| PASS | Revocation resume checkpoint is complete |    | Booked browser QR appointment remains persisted. |
| PASS | receptionistB re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Revoked receptionist cannot read Branch B dashboard | GET /dashboard?clinicId=2d0bc73e-21b8-409c-b7ce-b1a65ee67c13&branchId=45e1f561-de37-45d6-a0ab-27e91326a6d9&date=2026-09-22 403 | Expected 403 and received 403. |
| PASS | Revoked receptionist cannot read Branch B appointment | GET /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97 403 | Expected 403 and received 403. |
| PASS | Revoked receptionist cannot read Branch B patient | GET /patients/9e581d0f-cbfe-416c-b84a-a841c5e873ea 403 | Expected 403 and received 403. |
| PASS | Revoked receptionist cannot resolve Branch B QR | POST /appointment-qr/resolve 403 | Expected 403 and received 403. |
| PASS | Revoked receptionist retains Branch A scope | GET /branches?clinicId=9cabfba9-d5ab-4b64-868f-daed88400d0b&pageSize=100 200 | Expected 200 and received 200. |
| PASS | Exact-branch revocation preserves other branch |    | Branch A remains available after Branch B revocation. |
| PASS | Revocation preserves DB history |    | Appointment history rows remain unchanged. |
| PASS | Admin revokes Doctor A Branch B scope | PATCH /doctors/b5de426a-74fe-4595-bf5e-a10ce6edc0b5 200 | Expected 200 and received 200. |
| PASS | doctorA re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Revoked doctor cannot read Branch B appointment | GET /appointments/eb81fc07-e4d2-4e9d-9962-85f401fafa97 403 | Expected 403 and received 403. |
| PASS | Revoked doctor cannot read Branch B patient | GET /patients/9e581d0f-cbfe-416c-b84a-a841c5e873ea 403 | Expected 403 and received 403. |
| PASS | Revoked doctor cannot read Branch B booking QR | GET /qrs/f5b8e473-9d38-48ed-ab54-6c02a215a57e 403 | Expected 403 and received 403. |
| PASS | Revoked doctor cannot resolve Branch B appointment QR | POST /appointment-qr/resolve 403 | Expected 403 and received 403. |
| PASS | Doctor revocation preserves DB history |    | Doctor assignment revocation removed access without deleting lifecycle history. |
| PASS | Restore Doctor A scope for browser fixture | PATCH /doctors/b5de426a-74fe-4595-bf5e-a10ce6edc0b5 200 | Expected 200 and received 200. |
| PASS | doctorA re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Create test-only clinic for CRUD deactivation | POST /clinics 201 | Expected 201 and received 201. |
| PASS | Create test-only branch for CRUD deactivation | POST /branches 201 | Expected 201 and received 201. |
| PASS | Branch update CRUD | PATCH /branches/ddeacc30-9fc8-4f63-9665-a1650b49dc29 200 | Expected 200 and received 200. |
| PASS | Branch deactivation CRUD | DELETE /branches/ddeacc30-9fc8-4f63-9665-a1650b49dc29 204 | Expected 204 and received 204. |
| PASS | Clinic update CRUD | PATCH /clinics/a438fb2d-8af5-4d8d-b6a9-5963da652328 200 | Expected 200 and received 200. |
| PASS | Clinic deactivation CRUD | DELETE /clinics/a438fb2d-8af5-4d8d-b6a9-5963da652328 204 | Expected 204 and received 204. |
| PASS | Doctor deactivation CRUD | DELETE /doctors/17040ed9-0f3d-4069-8691-ea6730c92591 204 | Expected 204 and received 204. |
| PASS | Deactivated doctor login rejected | GET /me 403 | Fresh authenticated request was rejected after doctor deactivation. |
| PASS | Restore Receptionist B scope for browser QR verification | PATCH /users/33f58ffd-0e83-4f6a-b252-7eae2190ed21 200 | Expected 200 and received 200. |
| PASS | receptionistB re-authenticates with current persisted claims | GET /me 200 | Expected 200 and received 200. |
| PASS | Browser fixture receptionist can read booked QR appointment | GET /appointments/00be430f-c4d0-402c-be20-a13e3430e60f 200 | Expected 200 and received 200. |
| PASS | Browser QR fixture remains booked |    | A current marker-owned booked appointment is retained for browser scanning. |
| PASS | Exactly one ClinicAdmin owns each clinic |    | Clinic A and doctor-created Clinic B both persist Admin A as their single adminId. |
| PASS | Doctor has one persisted owner admin |    | Doctor A ownerAdminId is the creating ClinicAdmin A. |
| PASS | Admin cascade mappings are exact |    | Admin A has exactly one clinic-level mapping for Clinic A and Clinic B. |
| PASS | Doctor Branch B mapping is exact |    | Doctor A has exactly one persisted Clinic B / Branch B1 mapping. |
| PASS | No duplicate assignment rows |    | Persisted user/clinic/branch mappings are unique. |
| PASS | All branch assignments match clinic |    | Every persisted branch assignment resolves to its own clinic. |
| PASS | Composite assignment FK rejects clinic mismatch |    | Rollback-only direct SQL received PostgreSQL foreign-key violation 23503. |
| PASS | Invalid SQL probe rolled back |    | No invalid assignment survived the rollback transaction. |

## Resume provenance

- Preserved 100 passing assertions from the prior phase.
- Prior failure: Revoked receptionist cannot read Branch B dashboard: Expected 403 and received 200..
- Prior report generated: 2026-09-22T13:25:02.283Z.

## Safety

- Real Clerk development sessions authenticate every protected request; no auth bypass is used.
- Execution is refused outside development, with non-test Clerk keys, or in deployments.
- Requests are throttled to 400 ms and retry only HTTP 429 responses.
- Tokens, passwords, OTP codes, signed QR payloads, secrets, and headers are never written to reports.
- Browser credentials and IDs are retained only at /tmp/clinicflow-assignment-audit-credentials.json with mode 0600.
- Cleanup is marker/ownership guarded and requires both `--cleanup` and `--confirm-cleanup` after browser verification.
- The approved legacy PreviewClinicAdmin four-clinic/two-doctor fixture is not mutated.

## Not tested by this runner

- Frontend layout, responsive behavior, selectors, and browser refresh rendering are reserved for the parent browser audit.
- Production SMS is not exercised; the runner requires the existing development OTP provider.
- Production Clerk and deployed environments are deliberately refused.
- Legacy PreviewClinicAdmin clinics/doctors are inspected only indirectly for non-mutation and are never used as fixtures.

## Cleanup verification

- Completed: 2026-09-22T13:45:49.415Z
- Marker: CF-ASSIGN-20260922131518-807f59
- All isolated database and Clerk fixtures removed; marker rows remaining: 0.
- All pre-existing rows, clinic/doctor ownership, and the original Clerk account set were preserved exactly.
- The 141-pass regression evidence and historical fixed-failure provenance above are preserved.
- Temporary credential file removed after verification.
