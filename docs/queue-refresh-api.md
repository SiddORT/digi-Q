# Queue refresh API contract

## PostgreSQL contention regression tests

Run `pnpm --filter @workspace/api-server test:queue-contention`.
Requires PostgreSQL `initdb` and `pg_ctl` on PATH and a non-root OS user.
Missing binaries fail the suite; it does not silently skip or fall back to PGlite.

The harness starts its own disposable PostgreSQL cluster in a private temporary
directory, exposes only a Unix socket (no TCP listener), and supplies all connection
settings explicitly. It never uses the application's database URL or existing
database records. Cleanup closes connections, stops the server, and removes its
temporary data and bundle on success or test failure.

Each race uses independent connections and transactions at PostgreSQL's default
READ COMMITTED isolation. A separate transaction holds the application advisory
locks while `pg_locks` confirms **every** contender is blocked; only then is the
gate released. Backend PIDs must be distinct, and waits/statements are bounded.
Launch order is varied but does not imply a guaranteed PostgreSQL winner.
Authentication is fixture-injected with per-operation async context; lifecycle,
ordering, reschedule, booking, and call-next logic are the real application code.

Cases cover duplicate/competing check-ins; duplicate checkout racing call-next
with legacy pending reservations; skip racing check-in; competing re-entry with
one queue version; reschedule racing check-in; transfers competing for destination
capacity; and opposing doctor transfers. Assertions include readable 409 conflicts,
one called/consulting reservation, exactly-once history/audit writes, stable
references/tokens/ranks, non-reused source tokens, and no losing destination token
allocation. Shared synthetic schema/fixtures include the queue's partial unique
indexes, but this is not a full production migration, Clerk, or browser test.
The existing PGlite suite remains the fast domain/SQL suite; its concurrent promises
alone do not prove independent PostgreSQL connection contention.

## Lifecycle contract

- New `POST /api/appointments` bookings (online, QR, walk-in) immediately return `status: waiting`, a stable dated doctor/branch token and `waitingAt`. No arrival/enqueue step is required.
- `POST /api/appointments/:id/actions` retains the existing action enum. Primary UI actions: `checkIn` = enter consultation (`inConsultation`, stamps `checkedInAt` and `consultationStartedAt`); `complete` = checkout (`completed`) and atomically call the next reservation (`called`, never automatically start consultation); `noShow` = explicit skip with mandatory `reason`; `requeue` = return with mandatory `reason`, one-based `position`, `expectedRevision` and `expectedQueueVersion`; `cancel` = cancel before consultation subject to cutoff.
- `checkIn` accepts `called`, or the first pending reservation when no patient is called/in consultation. Legacy `booked`/`checkedIn` remain usable as pending reservations. All consultation/queue actions are appointment-date-only. No automatic skip occurs. Token/reference survive skip/requeue.
- Compatibility actions `call`, `start`, `enqueue` remain accepted, but are not primary `allowedActions`: `start` is equivalent to `checkIn`; `enqueue` only normalizes legacy pending states. `allowedActions` uses existing enum values `checkIn`, `complete`, `noShow`, `requeue`, `cancel`; availability is state/role/date based, and queue ordering/concurrency is finally enforced on mutation (409 on stale/blocked state).
- Requeue is receptionist/clinicAdmin/superAdmin only and never interrupts the current consultation. Checkout and check-in are serialized using the existing session transaction locks.
- Rescheduling accepts preconsultation `booked`, `checkedIn`, `waiting`, `called` without `checkedInAt`, within the original cancellation cutoff, and returns `waiting` in the destination. Existing reference/history survive; destination token is allocated.
- Signed appointment QR lookup is read-only. Its existing check-in endpoint now enters consultation, not arrival. Staff must explicitly confirm before submitting it; duplicate scans do not restart consultation.
- `GET /api/public/display/:reference` is unauthenticated and requires an active, existing, branch-specific booking QR. Clinic-only references are rejected. Doctor-specific references restrict sessions to that doctor; branch references include all active assigned doctors.
- Display response: `{ clinic: { name }, branch: { name, address, city, timezone }, date, updatedAt, sessions: [{ doctorId, doctorName, startTime, endTime, currentToken, nextToken, waitingTokens: string[], waitingCount, completedCount }] }`. Date is today in branch timezone. Times/tokens may be null, address/city may be null. `currentToken` includes called or in-consultation; waiting tokens include legacy pending reservations. No patient names, patient/appointment IDs, appointment references or other patient information is emitted. Poll every 15–30 seconds and clear stale content on errors.
- Existing public QR context also exposes nullable `clinicAddress`, `branchAddress`, `branchCity`, `branchTimezone` for booking location labels.
- Display sessions additionally require `currentStatus: "called" | "inConsultation" | null`; label a called patient "Called next", not "In consultation".
- Appointment listing and queue queries accept optional `statusGroup=active|waiting|absent|completed|cancelled|all`, applied before pagination and intersected with existing `status` and other filters. Active = booked/checkedIn/waiting/called/inConsultation; waiting = booked/checkedIn/waiting; absent = noShow; completed/cancelled match their status; all is unfiltered. Appointment `total` and queue `entriesTotal`/`totalPages` describe the filtered collection, never the current page. Queue summary counters remain whole-session counts. Do not derive tab badges from page lengths; request the corresponding group total if needed.
- `waitMinutes` means **session queue wait**, not physical arrival wait: elapsed minutes at consultation start since the later of reservation `waitingAt` and the appointment's snapshotted session start in its timezone, floored at zero for early starts. Advance-booking lead time is excluded. Missing/invalid session snapshots or nonexistent DST wall times yield null (unknown). UI label: "Average session queue wait"; do not label it arrival wait. Dashboard/report `waiting` includes legacy booked/checkedIn plus waiting, while the retained `checkedIn` metric now counts current inConsultation only.
- Checkout still succeeds if the operational doctor/account/clinic/branch is inactive or assignment removed; pending reservations stay pending instead of being automatically called. Unexpected database/audit errors are not swallowed.