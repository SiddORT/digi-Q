# Appointment movement

## Policy and API

- **Shift Time** keeps the same visit, session, token, reference and pending state.
  The reviewed position must be strictly later, including exactly one place later.
  Called patients require explicit authorized staff call release. Patients cannot
  release their own call.
- **Reschedule** transfers an unserved visit to another eligible session/date.
  The source cancellation deadline does not control ordinary rescheduling.
  Destination booking rules and the stricter staff-account handoff rules remain.
- **Mark Absent / Re-enter** are operational, assigned-staff actions. Assigned
  doctors can use them. Re-entry requires a reason, active original session,
  current queue version and explicitly reviewed pending position.
- Actual consultation timestamps, completed/cancelled states, source closure and
  ended sessions prevent movement. Cancellation policy is unchanged.

`GET /api/appointments/:id/movement` provides authoritative eligibility and
anonymous position choices. Mutations retain revision/queue-version checks and
reuse the existing transactional session locks.

`POST /api/public/guest-receipt/manage` accepts the existing receipt capability in
the request body. It reads or manages only the one linked confirmed booking,
without granting a staff session. Responses are no-store and rate-limited.
Secrets are not put into URLs, query cache keys, errors or application logs.
Position history is removed from patient responses; private receipt actions have
an explicit patient attribution in history and audit summaries.

Shifting does not enqueue rescheduling notifications. Rescheduling keeps the
existing notification outbox, templates and delivery gates.

## Development verification (2026-10-15)

- OpenAPI generation and shared-library build succeeded:
  `pnpm --filter @workspace/api-spec run codegen`.
- Workspace typechecks succeeded: `pnpm typecheck`.
- The movement suite passed all 19 tests:
  `node --test artifacts/api-server/src/appointment-movement.test.mjs`.
  It includes socket-only disposable PostgreSQL with independent connection PIDs
  and observed lock waits, source time boundaries, one-place movement, called
  release, consultation locks, assignment scopes, failed destination rollback,
  protected receipt privacy/revocation, stale replay, and simultaneous writes.
- The combined movement, queue contention, booking-notification integration and
  booking-lookup privacy run passed all 49 tests before the two additional
  boundary tests were added. Staff-account handoff integration passed separately.
- The two focused row-menu browser regressions passed: Shift Time and Re-enter
  both open the shared review and submit its exact position/version.
- The existing 79-test ticket browser suite passed before those two tests were
  added. The ticket fixtures now explicitly serve the new protected management
  read and CSRF request.
- Four relevant legacy phase-one tests passed after updating their assertions
  for the approved movement and doctor re-entry policy.
- Actual Preview browser checks verified native receptionist, doctor, patient,
  Clinic Admin and Super Admin identities in isolated contexts. Reception shifted
  a visit and explicitly released a called visit for rescheduling; the doctor
  marked absent and re-entered a visit. Admin checks exercised eligible menus,
  not mutations. A patient shifted their own visit at 390px; patient menus did not
  offer absence or re-entry. An unauthenticated guest booked immediately, saw the
  last-position explanation, rescheduled and cancelled with reason/confirmation.
- The browser pass exposed a date-only response coercion bug and outdated
  post-cancellation heading/email copy. These were fixed with API date-contract
  and ticket cancellation assertions, rather than another full browser pass.
  Exact reference retention in the called-patient flow was verified by domain
  tests, not separately inspected in the browser. Narrow patient tables remain
  dense, while the movement dialog fitted and was usable.

## Broader-suite limitations

The full `phase-one.test.mjs` attempt did not finish within five minutes. It also
reported an owner hours-only clinic/QR fixture failure, outside the movement
path. The separate `notification-template-values.test.mjs` run failed its
existing “SMS draft, publish and activation work with only the event DLT ID and
configured Sender ID” assertion: it expects an untouched cancelled SMS template
to be disabled, while the current default resolves enabled. The accompanying
SMS transport checks passed. Neither default activation nor provider behavior
was changed for appointment movement.

Browser role checks use the optional fictional fixture in a disposable database,
with fake transports and actual native sessions. This is development evidence,
not UAT or production acceptance. No production deployment, database migration
or live patient email/SMS test is authorized by this change.
