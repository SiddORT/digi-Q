# ClinicFlow Phase 1 — implementation and verification

Status: 3/40 completed and verified; 37 blocked at full acceptance verification. Implementation is present, but Phase 1 is NOT release-approved.

Only verified items receive a green tick. Existing functionality does not count as verification.
Statuses: Not started / In progress / Completed and verified / Blocked.

## Approved policies

- Preserve current branding, colors, fonts and navigation; compact operational UI rather than a redesign.
- Expected duration is configured per doctor within a clinic (20/30/60 minutes). Approximate wait is patients ahead × expected duration, updated with queue events, not a countdown.
- Authorized staff choose future-only duration changes or explicitly confirm applying a change to a running session after a warning.
- Existing durations, including 10 minutes, remain unchanged until staff deliberately changes them. New selections are 20/30/60 minutes.
- Ordinary later bookings and walk-ins do not displace an earlier reservation. Temporary departure does not cancel a booking.
- Reception chooses a returning absent patient's position and must record a reason. Keep the booking/token and audit the action; never interrupt a current consultation.
- Patients may reschedule before check-in to another doctor/branch within the same clinic, subject to the cancellation cutoff. Preserve reference/history and issue a destination-session token. Failure leaves the original untouched.
- Email OTP is accepted. SMS, custom SMTP, notification delivery, advanced calendar grids, billing, clinical records, family accounts and ratings are excluded.
- Stop and ask about consequential unresolved business policy before implementing it.

## Checklist

| # | Requirement | Status | Evidence / remaining checks |
|---|---|---|---|
| 1 | Preserve appearance | Blocked | Public desktop/mobile shell rendered; protected screens remain |
| 2 | Compact spacing | Blocked | Shared CSS implemented; authenticated rendered check remains |
| 3 | Primary search/filter toolbar | Blocked | Implemented; interaction acceptance remains |
| 4 | Collapsible advanced filters, chips, clear | Blocked | Implemented; interaction acceptance remains |
| 5 | Role-aware defaults | Blocked | Implemented; role UI acceptance remains |
| 6 | Readable 10+ desktop rows and pagination | Blocked | Implemented; populated desktop measurement remains |
| 7 | Sticky headings, status badges, actions | Blocked | Implemented; rendered scroll check remains |
| 8 | Responsive/accessibility/context preservation | Blocked | Mobile login rendered; protected mobile/focus checks remain |
| 9 | Per-doctor-per-clinic duration | Blocked | Domain tests pass; staff editor interaction remains |
| 10 | Explicit duration-edit effects | Blocked | Running/future/legacy tests pass; warning interaction remains |
| 11 | Weekly availability, breaks, capacity, exceptions UX | Blocked | Form improvements implemented; staff UI acceptance remains |
| 12 | Sessions, remaining/full states | Blocked | Live booking succeeded; full-session UI acceptance remains |
| 13 | Concurrency, duplicate and capacity integrity | ✅ Completed and verified | Isolated SQL domain race/capacity/duplicate tests pass; not a production load test |
| 14 | QR/link through email verification | Blocked | QR backend regressions pass; actual email-return flow not tested |
| 15 | Assisted bookings and walk-ins | Blocked | Backend lifecycle tests pass; staff UI acceptance remains |
| 16 | Ticket view | Blocked | Live patient booking showed ticket controls; dedicated dialog acceptance remains |
| 17 | Complete ticket information | Blocked | Fields implemented; screenshot/print acceptance remains |
| 18 | QR validation and manual token lookup | Blocked | Signed QR and scoped lookup tests pass; staff interaction remains |
| 19 | Token distinct from position | Blocked | Domain tests and UI copy present; full ticket UI acceptance remains |
| 20 | Approximate wait without countdown | Blocked | Live patient confirmation showed approximate wait; changing queue UI remains |
| 21 | All lifecycle statuses | Blocked | Domain tests pass; lifecycle UI acceptance remains |
| 22 | Upcoming/past, reopen and print ticket | Blocked | Implemented, including private live link; print/navigation acceptance remains |
| 23 | Honest stale/pause/delay/privacy messaging | Blocked | Failure/offline messaging implemented; disconnect UI check remains |
| 24 | Reserved versus arrived/active queue remotely | Blocked | SQL summary tests pass; changing queue UI remains |
| 25 | Stable reservation order | ✅ Completed and verified | Reversed arrival, absent-first, both call paths and positioned re-entry SQL tests pass |
| 26 | Agreed absence/re-entry | Blocked | Reason/position/version/role tests pass; receptionist dialog acceptance remains |
| 27 | Event-based ETA | Blocked | Ahead × duration domain checks pass; multi-session browser refresh remains |
| 28 | Current/next/call controls | Blocked | Domain tests pass; staff controls acceptance remains |
| 29 | Safe concurrent start/complete transitions | ✅ Completed and verified | Single-winner call/start/complete isolated SQL tests pass |
| 30 | Authorized/audited skip, priority and re-entry | Blocked | Skip/re-entry permission and audit tests pass; staff interaction remains |
| 31 | Cancellation | Blocked | Capacity/reference/history tests pass; confirm dialog acceptance remains |
| 32 | Atomic rescheduling | Blocked | Success, full destination, audit failure rollback and check-in race tests pass; UI acceptance remains |
| 33 | Doctor compact current/next/list/details | Blocked | Implemented; protected doctor page acceptance remains |
| 34 | Reception switch, summary, search, check-in, walk-ins | Blocked | Implemented; protected reception page acceptance remains |
| 35 | Clinic admin compact scoped management/duration | Blocked | Scope regressions pass; protected admin UI acceptance remains |
| 36 | Superadmin compact oversight | Blocked | Shared compact controls implemented; role UI acceptance remains |
| 37 | Auth, roles, tenant privacy, provider-free messages | Blocked | Regression suite and fixture role mapping pass; real OTP and full role UI not reverified |
| 38 | Ticket/queue/report consistency, audits and retry recovery | Blocked | Domain/audit tests pass; report parity and browser retry acceptance remain |
| 39 | End-to-end absence/cancel/reschedule workflow | Blocked | Live booking succeeded; remaining staff journey blocked by test identity reattachment |
| 40 | Desktop/mobile acceptance and release summary | Blocked | Public shell rendered; protected acceptance incomplete; do not publish as verified |

## Verification log

- 2026-09-25: API codegen/library typecheck, API typecheck and ClinicFlow frontend typecheck pass.
- Combined isolated automated run: 65 API/domain/auth/listing tests + 11 frontend input/device-trust tests = 76 passed, zero failures.
- PGlite uses a single embedded backend: SQL race tests do not establish multi-connection production load behavior.
- API and frontend managed workflows restarted and serving. Mobile login screenshot: `screenshots/phase-one-mobile-login.jpg`.
- Real development browser fixture confirmed mapped roles, patient booking, confirmation/token/reference/approximate wait and DB persistence. Staff proof fixtures do not constitute real password/OTP evidence.
- Browser observation selected a different page than the active patient page. A single follow-up on the original page returned a different identity with `needsOnboarding:true`, not the intended receptionist. Stopped rather than bypassing authentication or claiming remaining checks passed.
- Full workspace typecheck is blocked by two nullable-total errors in unrelated `artifacts/clinicflow-project-deck/src/widgets/ImportedChart.tsx:78`. The paused deck was not changed.
- No production changes or publishing performed. No notification delivery claimed.
- Development test database fixtures were removed in a verified, ownership-checked transaction; no matching fixture records remain. External test authentication identities were not modified.