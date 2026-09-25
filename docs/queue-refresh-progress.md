# ClinicFlow — reception display and queue refresh

This is the newly approved scope, separate from the earlier Phase 1 acceptance checklist.
Status: all eight workstreams implemented; automated and public-display checks passed. Protected staff browser acceptance remains blocked by the test sign-in session. Not release-approved.

## Approved workflow

- Confirmed bookings receive a token and join their doctor/branch/date waiting queue immediately.
- Check in means the patient enters consultation; check out means consultation completed.
- Checkout automatically calls the next eligible waiting patient, but does not start their consultation.
- No automatic absence skipping. Staff explicitly skips with a reason; position-based re-entry retains the ticket.
- No promised appointment time: display the consultation window and approximate event-based wait.
- Public reception displays show doctor names and tokens, never patient names, contact details, references or ticket QR codes.
- Branch-specific booking QR is distinct from private patient check-in QR.
- Bulk actions operate only on explicitly selected, authorized and eligible records, with per-record outcomes.
- No bulk consultation transitions or bulk deletion.
- Preserve existing branding, tenant ownership and authentication.
- SMS delivery remains outside this scope.

## Progress

| Workstream | Status | Acceptance evidence |
|---|---|---|
| Booking → waiting → check in → checkout → automatic next | Implemented; domain checks passed | SQL lifecycle/order/checkout tests; protected browser journey blocked |
| Legacy booking, cancellation, rescheduling and QR compatibility | Implemented; regressions passed | Backend-flow and SQL compatibility tests |
| Privacy-safe live public feed and branch QR/location context | Implemented; verified | Response projection/revocation tests and real public endpoint with isolated fixture |
| Split-screen clinic reception display | Implemented; rendered | Desktop 1440×1000 and mobile 390×844; generated date serialization corrected |
| Queue summaries, tabs, rich appointment rows and defaults | Implemented; browser acceptance pending | Server-side grouped pagination tests; client typecheck passed |
| Admin two-line listings, QR/link actions and selection | Implemented; browser acceptance pending | CSV escaping and status-payload tests passed |
| Bulk export, QR/ticket print/download, status and cancellation | Implemented; browser acceptance pending | Per-record fresh authorization/eligibility, outcomes and query invalidation reviewed; native printing not verified |
| Compact dialogs/sidebar, icons, accessible help, empty/offline states | Implemented; partial visual verification | Public responsive render passed; protected keyboard/tap/dialog checks pending |

## Verification log

- 2026-09-25: Full workspace TypeScript check passed. Frontend unit checks: 16/16; backend-flow, SQL domain and list-query checks: 61/61. No whitespace errors.
- The original SQL concurrency tests use embedded PGlite. The separate `test:queue-contention` suite now covers eight lifecycle races on independent connections in a disposable PostgreSQL cluster, with observed advisory-lock waits; all eight passed.
- Review corrected future-booking lead time being counted as queue wait, legacy metric discrepancies, checkout rollback after entity deactivation, and stale single-ticket printing.
- Average queue wait is measured within the consultation session, not physical arrival wait. Missing/invalid timing remains unknown.
- Public display screenshots: `screenshots/queue-refresh-display-desktop.jpg`, `screenshots/queue-refresh-display-mobile.jpg`. These use synthetic SQL-seeded data and do not prove a real booking/consultation UI journey.
- The focused staff browser test returned 401 after its sign-in helper handshake. It stopped without creating data; protected workflows are not claimed browser-verified.
- API and frontend workflows restarted and serving. No production changes or publication.
- Temporary public-display fixtures were removed in an ownership-checked transaction and verified absent. Screenshot QR links are test examples, not usable clinic booking links.
- Earlier Phase 1 incomplete acceptance and multi-page report snapshot limitations are not resolved by this refresh.