# Appointment QR assignment audit

## Scope and baseline

Before this change, ClinicFlow had a separate clinic/branch booking QR (`qrs.publicReference`) and normal appointment actions, but no signed appointment QR contract. Staff could use the generic appointment action endpoint to check in and enqueue an appointment. Booking already allocated the queue token, and the appointment engine already used a doctor/branch/date advisory transaction lock plus append-only status history.

The booking QR remains unchanged. No database schema, assignment model, authentication middleware, resource route, OpenAPI file, or token-allocation rule was changed.

## Implemented

- Added an appointment-only QR service in `src/lib/appointment-qr.ts`.
  - Payload format is versioned and HMAC-SHA256 signed with the runtime-only `SESSION_SECRET`.
  - The payload contains only the existing opaque appointment reference and its signature; it contains no patient name, mobile number, clinic name, or other PII.
  - Signature comparison uses constant-time comparison and rejects non-canonical/tampered encodings.
- Added focused authenticated routes:
  - `GET /api/appointments/:id/qr`
  - `POST /api/appointment-qr/resolve`
  - `POST /api/appointment-qr/check-in`
- Resolution returns `{ appointment, eligible, alreadyCheckedIn, message }` only after role and clinic/branch/doctor scope authorization succeeds.
- Check-in returns `{ appointment, alreadyCheckedIn, message }`.
- Check-in uses the existing queue transaction lock and the existing `checkIn` then `enqueue` transitions. It preserves the token allocated at booking.
- A repeated scan of an appointment already in `checkedIn`, `waiting`, `called`, or `inConsultation` returns an explicit already-checked-in response without another transition, queue token, appointment-history row, or audit row.
- `cancelled`, `completed`, and `noShow` appointments produce clear HTTP 409 conflicts.
- The appointment date is compared with the current calendar date in the appointment/branch timezone. Active doctor, branch, clinic, account, and branch assignment checks reuse the existing appointment engine policy. No new opening/closing-minute restriction was invented.
- QR responses use `Cache-Control: no-store`; signing secrets and payloads are not logged.

## Security and concurrency checks

- Authorized patient/owner or scoped staff can generate an appointment QR.
- Only authenticated operational staff can resolve or check in.
- Receptionist and clinic-admin scope is enforced by clinic/branch assignment; doctors remain restricted to their own appointments; super admin remains platform-scoped.
- An authenticated but cross-scope staff member receives HTTP 403 before appointment details are returned.
- Concurrent scans serialize on the existing doctor/branch/date advisory lock. The second scan observes the committed checked-in/waiting state and returns idempotently.

## Verification

- `pnpm --filter @workspace/api-server run typecheck` — passed.
- `node --test artifacts/api-server/src/backend-flow.test.mjs` — 9/9 passed.
- Added regression coverage for:
  - valid signature round-trip;
  - signature tampering;
  - eligible resolution;
  - check-in plus enqueue through the existing lifecycle;
  - booking-token preservation;
  - repeated scan with no duplicate history;
  - malicious cross-scope resolution;
  - cancelled/completed/no-show rejection;
  - non-current branch-local appointment-date rejection.

## Database changes

None. The existing unique appointment reference is signed; no new table or secret was introduced.