# Authenticated API integration verification

**Executed:** 2026-09-22T11:18:08.586Z
**Marker:** CF-AUDIT-20260922111729-42a323
**Result:** 92 passed, 0 failed, 0 skipped.

## Verification evidence

| Outcome | Check | Route/status | Evidence |
|---|---|---|---|
| PASS | Create isolated Clinic A through API | POST /clinics 201 | Expected 201 and received 201. |
| PASS | Create isolated Clinic B through API | POST /clinics 201 | Expected 201 and received 201. |
| PASS | Create Branch A through API | POST /branches 201 | Expected 201 and received 201. |
| PASS | Create Branch B through API | POST /branches 201 | Expected 201 and received 201. |
| PASS | Create inactive validation branch through API | POST /branches 201 | Expected 201 and received 201. |
| PASS | Assign clinicAdmin scope through API | PATCH /users/ffa08483-49bd-459f-afe4-333c3db19efe 200 | Expected 200 and received 200. |
| PASS | Assign receptionist scope through API | PATCH /users/f1c26a78-a6f9-47d0-9b48-1ef956e83ce2 200 | Expected 200 and received 200. |
| PASS | Assign doctorA through doctor API | PATCH /doctors/96a3e935-d884-4833-a7ce-feac84d50c4a 200 | Expected 200 and received 200. |
| PASS | Assign doctorB through doctor API | PATCH /doctors/6d1b164c-7121-4f8f-8ae2-e6d2cfe3410e 200 | Expected 200 and received 200. |
| PASS | Create full-day doctorA schedule through API | POST /schedules 201 | Expected 201 and received 201. |
| PASS | Create full-day doctorB schedule through API | POST /schedules 201 | Expected 201 and received 201. |
| PASS | Create next-day schedule for closed-date validation | POST /schedules 201 | Expected 201 and received 201. |
| PASS | Create future schedule for cancellation validation | POST /schedules 201 | Expected 201 and received 201. |
| PASS | Create closed-date exception through API | POST /availability-exceptions 201 | Expected 201 and received 201. |
| PASS | patientA request mobile OTP | POST /otp/request 200 | Existing development OTP endpoint accepted request. |
| PASS | patientA development OTP delivery | POST /otp/request 200 | Development provider returned an in-band code without changing global settings. |
| PASS | patientA verify mobile OTP | POST /otp/verify 200 | Patient mobile verified via existing OTP flow. |
| PASS | patientB request mobile OTP | POST /otp/request 200 | Existing development OTP endpoint accepted request. |
| PASS | patientB development OTP delivery | POST /otp/request 200 | Development provider returned an in-band code without changing global settings. |
| PASS | patientB verify mobile OTP | POST /otp/verify 200 | Patient mobile verified via existing OTP flow. |
| PASS | Create scoped QR through API | POST /qrs 201 | Expected 201 and received 201. |
| PASS | Resolve active public QR without patient data | GET /public/qr/pH2j00Rnljt_UN7DiUduE5zmVKn6u57ecd2xs98P2-o 200 | Expected 200 and received 200. |
| PASS | Regenerate QR | POST /qrs/60a7ebe2-eb42-4488-b4e6-dad231961914/regenerate 200 | Expected 200 and received 200. |
| PASS | Reject stale regenerated QR reference | GET /public/qr/pH2j00Rnljt_UN7DiUduE5zmVKn6u57ecd2xs98P2-o 404 | Expected 404 and received 404. |
| PASS | Resolve regenerated QR reference | GET /public/qr/3aAUs6AirCNC5DLI6U_MhKSDRfx7YvEaJwIBZC1H478 200 | Expected 200 and received 200. |
| PASS | Patient online booking remains booked | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Online booking initial state |    | Advance online booking is booked, not waiting. |
| PASS | Idempotent booking replay | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Idempotent replay identity |    | Same actor/requestId returned the original appointment. |
| PASS | Reject idempotency key semantic mutation | POST /appointments 409 | Expected 409 and received 409. |
| PASS | patientA sees connected appointment | GET /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da 200 | Expected 200 and received 200. |
| PASS | receptionist sees connected appointment | GET /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da 200 | Expected 200 and received 200. |
| PASS | doctorA sees connected appointment | GET /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da 200 | Expected 200 and received 200. |
| PASS | clinicAdmin sees connected appointment | GET /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da 200 | Expected 200 and received 200. |
| PASS | superAdmin sees connected appointment | GET /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da 200 | Expected 200 and received 200. |
| PASS | Doctor B cannot read Doctor A appointment | GET /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da 403 | Expected 403 and received 403. |
| PASS | Patient A cannot read Patient B profile | GET /patients/98f1cd7f-eacf-47a8-aaf0-8ed9a022b736 403 | Expected 403 and received 403. |
| PASS | Clinic admin cannot mutate platform settings | PATCH /settings 403 | Expected 403 and received 403. |
| PASS | Clinic A receptionist cannot operate Clinic B queue | POST /queue/call-next 403 | Expected 403 and received 403. |
| PASS | checkIn 8a0863ba | POST /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da/actions 200 | Expected 200 and received 200. |
| PASS | enqueue 8a0863ba | POST /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da/actions 200 | Expected 200 and received 200. |
| PASS | Patient live queue | GET /queue?doctorId=96a3e935-d884-4833-a7ce-feac84d50c4a&branchId=f3e0c3cb-4265-428a-a703-e0cb6eb4116d&date=2026-09-22&appointmentId=8a0863ba-2630-4a03-b419-cc265d58b3da 200 | Expected 200 and received 200. |
| PASS | Patient queue privacy |    | Patient response contains own/aggregate data and omits staff entries. |
| PASS | Call oldest waiting appointment | POST /queue/call-next 200 | Expected 200 and received 200. |
| PASS | Call-next consistency |    | Call-next selected the expected waiting appointment. |
| PASS | start 8a0863ba | POST /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da/actions 200 | Expected 200 and received 200. |
| PASS | complete 8a0863ba | POST /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da/actions 200 | Expected 200 and received 200. |
| PASS | Completed appointment history remains readable | GET /appointments/8a0863ba-2630-4a03-b419-cc265d58b3da 200 | Expected 200 and received 200. |
| PASS | Lifecycle history preserved |    | All connected lifecycle states persisted in order. |
| PASS | superAdmin dashboard reads persisted state | GET /dashboard?date=2026-09-22 200 | Expected 200 and received 200. |
| PASS | superAdmin dashboard completion count |    | Completed flow is reflected in dashboard metrics. |
| PASS | clinicAdmin dashboard reads persisted state | GET /dashboard?date=2026-09-22 200 | Expected 200 and received 200. |
| PASS | clinicAdmin dashboard completion count |    | Completed flow is reflected in dashboard metrics. |
| PASS | receptionist dashboard reads persisted state | GET /dashboard?date=2026-09-22 200 | Expected 200 and received 200. |
| PASS | receptionist dashboard completion count |    | Completed flow is reflected in dashboard metrics. |
| PASS | doctorA dashboard reads persisted state | GET /dashboard?date=2026-09-22 200 | Expected 200 and received 200. |
| PASS | doctorA dashboard completion count |    | Completed flow is reflected in dashboard metrics. |
| PASS | patientA dashboard reads persisted state | GET /dashboard?date=2026-09-22 200 | Expected 200 and received 200. |
| PASS | patientA dashboard completion count |    | Completed flow is reflected in dashboard metrics. |
| PASS | Receptionist creates walk-in | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Walk-in immediate queue state |    | Walk-in traversed check-in and enqueue atomically. |
| PASS | noShow c939a6a5 | POST /appointments/c939a6a5-1158-477d-96ed-8b4eae4d0418/actions 200 | Expected 200 and received 200. |
| PASS | requeue c939a6a5 | POST /appointments/c939a6a5-1158-477d-96ed-8b4eae4d0418/actions 200 | Expected 200 and received 200. |
| PASS | Call requeued no-show | POST /queue/call-next 200 | Expected 200 and received 200. |
| PASS | start c939a6a5 | POST /appointments/c939a6a5-1158-477d-96ed-8b4eae4d0418/actions 200 | Expected 200 and received 200. |
| PASS | complete c939a6a5 | POST /appointments/c939a6a5-1158-477d-96ed-8b4eae4d0418/actions 200 | Expected 200 and received 200. |
| PASS | Receptionist creates phone booking | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Phone advance state |    | Phone booking remains booked until explicit check-in. |
| PASS | Cancel booked appointment | POST /appointments/994988af-a501-4575-b320-bf83591f06ea/actions 200 | Cancellation succeeded under configured cutoff. |
| PASS | Cancelled appointment rejects consultation | POST /appointments/994988af-a501-4575-b320-bf83591f06ea/actions 409 | Expected 409 and received 409. |
| PASS | Patient books through regenerated QR | POST /appointments 201 | Expected 201 and received 201. |
| PASS | QR converges to normal appointment |    | QR entry produced a standard booked appointment. |
| PASS | checkIn 4784e5c8 | POST /appointments/4784e5c8-6038-4a73-b39f-9928f817e7ce/actions 200 | Expected 200 and received 200. |
| PASS | enqueue 4784e5c8 | POST /appointments/4784e5c8-6038-4a73-b39f-9928f817e7ce/actions 200 | Expected 200 and received 200. |
| PASS | Call QR appointment | POST /queue/call-next 200 | Expected 200 and received 200. |
| PASS | start 4784e5c8 | POST /appointments/4784e5c8-6038-4a73-b39f-9928f817e7ce/actions 200 | Expected 200 and received 200. |
| PASS | complete 4784e5c8 | POST /appointments/4784e5c8-6038-4a73-b39f-9928f817e7ce/actions 200 | Expected 200 and received 200. |
| PASS | Book sole Doctor B capacity | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Reject full session | POST /appointments 409 | Expected 409 and received 409. |
| PASS | Closed-date availability | GET /public/availability?doctorId=96a3e935-d884-4833-a7ce-feac84d50c4a&branchId=f3e0c3cb-4265-428a-a703-e0cb6eb4116d&date=2026-09-23 200 | Expected 200 and received 200. |
| PASS | Closed date rejected |    | Availability reports the configured closure. |
| PASS | Past availability | GET /public/availability?doctorId=96a3e935-d884-4833-a7ce-feac84d50c4a&branchId=f3e0c3cb-4265-428a-a703-e0cb6eb4116d&date=2026-09-21 200 | Expected 200 and received 200. |
| PASS | Past date rejected |    | Past date is unavailable. |
| PASS | Booking horizon availability | GET /public/availability?doctorId=96a3e935-d884-4833-a7ce-feac84d50c4a&branchId=f3e0c3cb-4265-428a-a703-e0cb6eb4116d&date=2027-09-27 200 | Expected 200 and received 200. |
| PASS | Beyond-horizon date rejected |    | Date outside configured booking horizon is unavailable. |
| PASS | Reject invalid doctor/branch/clinic combination | POST /appointments 403 | Expected 403/409 and received 403. |
| PASS | Reject inactive or unassigned branch | POST /appointments 403 | Expected 403/409 and received 403. |
| PASS | Create race queue entry A | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Create race queue entry B | POST /appointments 201 | Expected 201 and received 201. |
| PASS | Concurrent call-next serialization | POST /queue/call-next 409 | Exactly one caller activated an appointment; the competing caller received 409. |
| PASS | Queue after call-next race | GET /queue?doctorId=96a3e935-d884-4833-a7ce-feac84d50c4a&branchId=f3e0c3cb-4265-428a-a703-e0cb6eb4116d&date=2026-09-22 200 | Expected 200 and received 200. |
| PASS | Single active called/consultation invariant |    | Queue contains exactly one active called/consultation record. |

## Safety and retention

- All requests used genuine Clerk development-instance sessions and Bearer tokens; no auth bypass was used.
- The runner refuses non-development, non-test Clerk, and deployment environments.
- Credentials and fixture IDs exist only in `/tmp/clinicflow-audit-credentials.json` with mode 0600 and are not included here.
- Fixtures are visibly tagged and retained for the separate browser tester. Cleanup requires `--cleanup --confirm-cleanup`.
- Existing records and global settings were not changed.

## Limitations

- Browser/mobile responsive checks are intentionally outside this API runner.
- Production SMS delivery is not tested; only the existing explicitly enabled development OTP provider is exercised.
- At verification time, fixtures were retained for the separate browser audit; their later confirmed cleanup is recorded below.

## Post-browser cleanup

Cleanup completed after the browser audit for marker `CF-AUDIT-20260922111729-42a323`. The prior **92 passed, 0 failed, 0 skipped** verification result above is preserved.

- Cleanup revalidated that both fixture clinics were marker-tagged and owned by one of the isolated runner accounts before deleting anything.
- Appointment discovery used the two verified fixture clinic scopes rather than only the IDs recorded by the runner. This included the browser-created QR appointment and every other appointment descendant in those isolated scopes.
- Related appointment history, OTP challenges, availability exceptions, schedules, QR records, audit records, assignments, scoped patient descendants, fixture doctor profiles, branches, clinics, and the seven isolated database accounts were removed in foreign-key-safe order.
- All seven isolated Clerk test identities were deleted and then checked by email lookup; none remained.
- A post-cleanup database query found `0` rows associated with the marker or the two fixture clinic IDs across users, clinics, branches, appointments, patients, and assignments.
- The original preview-account query still returned `5` accounts.
- `/tmp/clinicflow-audit-credentials.json` was removed and its absence was verified.

No pre-existing user, clinic, branch, appointment, patient, assignment, or original preview account was deleted.
