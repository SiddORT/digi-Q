# Arrival guidance and live-ticket verification

## Surfaces and compact coverage

The shared Booking tab keeps the approved Booking Details / Ticket & QR layout.
Arrival guidance is in the left card. The same server projection feeds standalone
patient/staff tickets, guest receipts, queue status, single/bulk print and PDF,
and prepared email attachments. Patient projections omit internal duration.

`node scripts/compact-ui-inventory.mjs` regenerated the inventory: 80 route
patterns, 180 source surfaces and 1,590 controls/links/child surfaces.

The changed-surface Playwright tests cover rows, Today/dashboard, calendar and
queue expansion boundaries at desktop, tablet, phone and 200%-equivalent widths;
Booking/Details/History keyboard use; long contact/note values; refreshing,
permission denial, QR errors, stale estimates and export actions. Existing
receptionist component paths are retained. These use fictional intercepted
appointments, not real staff authentication.

## Checks and evidence

- `node --test --test-concurrency=1 artifacts/api-server/src/arrival-estimate.test.mjs artifacts/api-server/src/live-ticket.integration.test.mjs`
  covers live ordering rather than token order, pre-session examples, active
  anchoring/current consultation, missing/overrun timing, breaks, closing limits,
  terminal visits, timezone/DST boundaries, saved versus explicitly changed
  duration, hash-only capabilities, invalid/expired/revoked links, exact owner
  upgrades, nonowner/staff redaction and unchanged guest receipt management.
  The email-attachment test prepares and extracts a PDF without sending mail.
- `pnpm exec playwright test --config artifacts/clinicflow/ticket-regression/playwright.config.ts`
  contains persistent new live-ticket tests using the real router and auth UI
  with fictional intercepted identities. It verifies URL-fragment removal,
  capability POST bodies, public/owner/nonowner/staff rendering, keyboard
  Directions, missing addresses, mobile overflow, offline/reconnect and distinct
  invalid/connection states. Existing ticket tests decode the private staff QR
  from each PDF page and preserve selected order/completeness. Updated image
  references include the newly required estimate and live-link snapshot content.
  An additional output test checks safe fields, hidden visit contacts/notes and
  a clickable PDF live link. No management action or message send is performed.
- Independent browser verification against the running root Preview passed
  public status, owner/nonowner/staff UI separation, allowed owner management
  visibility, keyboard Directions and stale/paused/ended/error states.
  At 390×844, document client/scroll widths were both 375px. The only intrinsic
  width exception was the intentionally hidden 1px help text. Evidence:
  `generated-artifacts/live-ticket/mobile-geometry.json` and the browser
  screenshots attached to the verification report.
- API and frontend TypeScript checks, generated-library build, backend build and
  frontend production build passed. Frontend build needs `PORT=3000 BASE_PATH=/`
  in a standalone shell, as it does for the existing self-host build.
- The actual signed-out `/live-ticket` Preview was also captured at 390×844:
  it rendered the distinct invalid/expired state without console errors.

## Boundaries

The browser's mocked identities are UI evidence, not real-account sign-in or
hosted UAT evidence. Authorization and persistence use disposable PostgreSQL
integration tests, not the live database. The independent browser helper's
standalone generated script could not launch its missing default Chromium;
the checked-in Playwright tests use the project's configured Chromium and passed
their focused run. There was one independent browser pass, not repeated testers.

Safari/Firefox, screen readers and real device keyboards were not independently
exercised. No real accounts, clinic data, notification providers, message
templates, hosted repairs or production deployment were changed/tested.
