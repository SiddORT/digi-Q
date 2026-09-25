# Ticket browser regression

Run from the repository root with `pnpm test:tickets`. This starts a separate
Vite fixture server on **127.0.0.1:43719** (strict port; it fails rather than
connecting to a different server), then uses the pinned local Chromium at
`/repl/tools/bin/chromium`. Install the existing workspace dependencies first
with `pnpm install`. Port 43719 must be free. The server is stopped by
Playwright after the suite. Reports are written to ignored `playwright-report/`
and `test-results/`; a failure retains its trace.

The fixture imports the **real** GuestBooking, AppointmentTicket and VisitTicket
components, their hooks, and their `prepareExport` logic. It does not load the
production router. Every `/api/` request is intercepted and answered by
per-test in-browser HTTP fixtures; unknown calls receive 501. It uses no
database, Clerk session, token, credentials or live API. In particular,
the "authenticated" appointment tests exercise an API-boundary component
fixture with a stubbed `/api/me` response, **not real sign-in or authorization**.
They do not replace end-to-end identity/access-control tests.

Coverage includes guest receipt recovery and immediate booking, fresh
server reads before either export, conflicting revisions, cancelled/rescheduled
details, QR absence and API failures, pop-up blocking, mobile-width hostile
names, actual downloaded standalone HTML while offline, and decoding each
screen/export QR to its exact signed URL using `jsqr`. Print tests call
the native `window.open` synchronously inside the click handler and replace
only the child `print()` method before asynchronous preparation; they never
open/accept/dismiss a native print dialog.

Run one case during diagnosis with
`pnpm test:tickets --grep "changing revision"`.