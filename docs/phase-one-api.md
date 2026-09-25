# Phase-one API contract (implementation underway)

Existing authentication and `/api` base unchanged. Generated hooks follow operation IDs.

Duration GET/PATCH authorization: Super Admin, assigned Clinic Admin, assigned Receptionist, and the assigned Doctor (own doctor only); never patients. Clinic-wide config requires clinic scope and doctor assignment; Doctor/Receptionist must share an assigned branch with that doctor. Applying to a running branch session additionally requires that exact branch scope. Re-entry is only Super Admin / assigned Clinic Admin / assigned Receptionist (not doctors/patients).

- `GET /doctors/{id}/duration/{clinicId}` → `{doctorId,clinicId,expectedDurationMinutes:number|null}`. Null means no clinic-wide override; legacy schedule duration remains effective.
- `PATCH /doctors/{id}/duration/{clinicId}` (`updateDoctorDuration`): `{clinicId,expectedDurationMinutes:20|30|60,effect:"futureOnly"|"runningSession",branchId?,date?,confirmRunningSession?,expectedQueueVersion?}`. Both effects update sessions that have not started, **including already-booked future sessions** in that doctor/clinic. Running-session change requires branch/date, explicit confirmation and current queueVersion. Future-only preserves running and historical session snapshots. Confirmed running-session changes affect the selected running session in addition to not-yet-started sessions.
- `POST /appointments/{id}/reschedule` (`rescheduleAppointment`): `{doctorId,branchId,date,expectedRevision,reason?}`. Only before check-in and cutoff; same clinic. Keeps appointment ID/reference/history, issues a new destination token. Transactional failure preserves original.
- Appointment responses add `queueRank`, `revision` (legacy starts at zero), `expectedDurationMinutes`.
- History events add `action`, optional `position`, and reschedule `from`/`to` session metadata (doctorId,branchId,date,token,tokenNumber). Patient views omit internal actor IDs.
- Appointment search now matches `token` as well as existing reference/name fields, supporting scoped manual check-in lookup.
- Existing actions: `noShow` explicitly skips a booked/checkedIn/waiting/called absent patient, with mandatory reason. `requeue` is reception/admin only, requires nonblank reason, one-based `position` amongst pending reservations, `expectedRevision` and `expectedQueueVersion`. Token retained. Current consultation never interrupted. Other actions may send `expectedRevision`.
- Queue adds `reserved` (booked+checkedIn+waiting), `arrived` (checkedIn+waiting+called+inConsultation), `queueVersion`, `expectedDurationMinutes`, `blockedByAbsentReservation`. `waiting` retains its narrower existing meaning.
- Stable queue order uses reservation rank, never arrival time. Call-next returns 409 if first reservation has not arrived/enqueued; staff must explicitly skip rather than silently bypass.
- `ownEntry.patientsAhead` includes earlier pending reservations plus current patient, including before check-in. `estimatedWaitMinutes` is ahead × session duration, with no buffer/countdown.
- Scoped staff may provide `appointmentId` to obtain that ticket's `ownEntry` ahead/ETA. Patient callers must still own the selected appointment; no other patient's entry is returned.
- Approved legacy policy: existing schedule durations (including 10) remain effective without buffer until staff deliberately updates them. New selections are restricted to 20/30/60. Sessions snapshot the effective duration so schedule/config edits cannot silently change existing ETAs.
- No pause/delay claim is introduced. Errors remain `{error:message}`, 400 invalid input / 403 scope / 409 conflict; refresh after 409.

Implementation/tests are in progress; this is an integration contract, not acceptance evidence.

## Backend verification handoff

- Implemented without DB schema migration or authentication changes. Duration config/snapshots/token counters use existing JSON storage.
- `phase-one.test.mjs` exercises real isolated PGlite transactions: reservation/arrival order, explicit skip, re-entry reason/permissions/stale versions/ranks, duration snapshots/confirmed updates, reschedule rollback/history/token preservation, capacity/duplicate protections, cancellation, patient privacy, concurrent lifecycle and re-entry/reschedule conflicts.
- Existing backend-flow fixtures were updated for snapshot storage and required re-entry fields; existing QR/manual lifecycle behavior remains.
- Embedded PGlite concurrency checks are not a substitute for multi-connection production PostgreSQL load testing. The application uses transaction-scoped PostgreSQL advisory locks plus existing uniqueness constraints.
- No running workflow restart, live-browser verification, notification delivery, pause/delay state, or deployment acceptance is claimed.