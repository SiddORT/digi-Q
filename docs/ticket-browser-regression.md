# Ticket browser regression

Run from the repository root with `pnpm test:tickets`. This starts a separate
Vite fixture server on **127.0.0.1:43719** (strict port; it fails rather than
connecting to a different server), then uses the pinned local Chromium at
`/repl/tools/bin/chromium`. Install the existing workspace dependencies first
with `pnpm install`. Port 43719 must be free. The server is stopped by
Playwright after the suite. Reports are written to ignored `playwright-report/`
and `test-results/`; a failure retains its trace.

Poppler's `pdfinfo`, `pdfimages` and `pdftoppm` must be on PATH (provided by
the Replit runtime). Missing tools fail the run; PDF checks are never skipped.
Two workers limit memory use while rendering PDF pages at 300 DPI.

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
names, standalone print HTML while offline, and actual downloaded PDF bytes.
Every PDF is parsed with Poppler, rendered at 300 DPI and its QR decoded to
the exact fictional signed URL using `jsqr`. Print tests call
the native `window.open` synchronously inside the click handler and replace
only the child `print()` method before asynchronous preparation; they never
open/accept/dismiss a native print dialog.

Run one case during diagnosis with
`pnpm test:tickets --grep "changing revision"`.

## PDF release guard

Both guest and account component fixtures export through the real buttons,
including fresh server reads. The long-content cases cover both formats:

- One page, 105 mm ticket width with content-driven height (80–400 mm), or
  exactly 210 × 297 mm A4, with 0.05 mm dimension tolerance.
- 10 KB minimum and 750 KB maximum per ticket page. Current fixtures are
  comfortably below this ceiling; uncompressed multi-megabyte raster PDFs
  fail. JPEG/JPEG2000 embedded images also fail to protect lossless QR edges.
- Long unbroken names and addresses, accented Latin, Greek, and escaped HTML
  characters checked against reviewed **rendered PDF** PNG references.
  These are image PDFs, so text extraction alone cannot verify their content.
- Exact QR decode from every rasterised PDF page, not the source QR data URI.
- Downloaded PDF and byte/page/dimension metrics attached to the HTML report.

References live in `artifacts/clinicflow/ticket-regression/tests/tickets.spec.ts-snapshots/`.
Keep Chromium, Poppler and fonts consistent with this Linux runtime. For an
intentional visual change, run
`pnpm test:tickets --grep "PDF preserves long Unicode" --update-snapshots`,
inspect all four references for readable glyphs, complete final lines, margins
and QR, then run `pnpm test:tickets` **without** update mode before committing.
Never update references simply to silence a failure. PNG comparison allows only
100 differing pixels (colour threshold 0.1), not a page-wide percentage.

The previous failure was test drift: print selectors expected old `h2`/`table`
markup, immediate guest booking skipped the current stage buttons, and 110 DPI
PDF rasterisation sometimes lost QR readability. Those checks now follow the
current UI and use print-resolution rendering. No production authentication,
QR freshness logic, records or outbound messages are changed.