# Phase-one API contract (implementation underway)

Existing authentication and `/api` base unchanged. Generated hooks follow operation IDs.

- `GET /doctors/{id}/duration/{clinicId}` → `{doctorId,clinicId,expectedDurationMinutes:20|30|60|null}`.
- `PATCH /doctors/{id}/duration/{clinicId}` (`updateDoctorDuration`): `{clinicId,expectedDurationMinutes:20|30|60,effect:"futureOnly"|"runningSession",branchId?,date?,confirmRunningSession?,expectedQueueVersion?}`. Running-session change requires branch/date, explicit confirmation and current queueVersion. Future-only changes leave already snapshotted sessions unchanged.
- `POST /appointments/{id}/reschedule` (`rescheduleAppointment`): `{doctorId,branchId,date,expectedRevision,reason?}`. Only before check-in and cutoff; same clinic. Keeps appointment ID/reference/history, issues a new destination token. Transactional failure preserves original.
- Appointment responses add `queueRank`, `revision` (legacy starts at zero), `expectedDurationMinutes`.
- Existing actions: `noShow` explicitly skips a booked/checkedIn/waiting/called absent patient, with mandatory reason. `requeue` is reception/admin only, requires nonblank reason, one-based `position` amongst pending reservations, `expectedRevision` and `expectedQueueVersion`. Token retained. Current consultation never interrupted. Other actions may send `expectedRevision`.
- Queue adds `reserved` (booked+checkedIn+waiting), `arrived` (checkedIn+waiting+called+inConsultation), `queueVersion`, `expectedDurationMinutes`, `blockedByAbsentReservation`. `waiting` retains its narrower existing meaning.
- Stable queue order uses reservation rank, never arrival time. Call-next returns 409 if first reservation has not arrived/enqueued; staff must explicitly skip rather than silently bypass.
- `ownEntry.patientsAhead` includes earlier pending reservations plus current patient, including before check-in. `estimatedWaitMinutes` is ahead × session duration, with no buffer/countdown.
- Existing legacy 10-minute schedule data is not silently converted to an approved 20/30/60 choice. Until duration is configured, duration/ETA are null. Parent notified about missing migration-default policy.
- No pause/delay claim is introduced. Errors remain `{error:message}`, 400 invalid input / 403 scope / 409 conflict; refresh after 409.

Implementation/tests are in progress; this is an integration contract, not acceptance evidence.