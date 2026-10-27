# Appointment ticket layering — local verification

## Scope and diagnosis

Verified locally on 2026-10-27. Hosted UAT was not accessed, changed or deployed.
The report is treated as a current rendered defect, not an outdated deployment.

The supplied image shows a ticket/help surface painting over listing headings
and live information below the taller left column. Current source already places
the ticket and status inside one right-hand wrapper: that historical grouping
failure did **not** reproduce in the current full-app tree. The remaining
reproducible alignment defect was the ticket's inherited maximum width and
centering: the actual card edge differed from its status section by approximately
29.7px on wide desktop and 101px on tablet before the scoped width correction.

The stylesheet cascade also mixed tablet `position:static` headings with pinned
sticky cells, while ticket children and body-portalled help had no booking-local
protected region. The correction keeps the existing responsive grouping,
aligns the screen card to its column, isolates expansion layers, gives direct
listing headings opaque sticky surfaces, and bounds booking help below tabs and
headings. Booking help dismisses on vertical or horizontal scrolling; its
permanent accessible description, pointer, keyboard and touch behavior remain.
Other help consumers retain their existing placement behavior.

No backend, authorization, notification, print/PDF document, queue or hosted-UAT
changes were made. Menus and intentional dialogs still use their existing portals.

## Full-app reproduction versus fixture omissions

Tests render the actual `App` and appointment listing with fictional intercepted
API responses, real global stylesheet order and explicit application-source
utility scanning. A separate-root fixture originally imported `main.tsx` without
generating lazy dialog utilities. Missing dialog centering/stacking there was
a **fixture omission**, corrected in the fixture entry rather than in production
dialog styling.

The current `ListingRegion` grows naturally; it does not reproduce the image's
old bounded vertical list by itself. Scroll regression cases therefore explicitly
limit the **real `.appt-table` scrollport** to 360px inside the complete application
at 640px viewport height. This is an intentional reproduction constraint, not
a new production height cap. Natural page scrolling remains covered on phone.

## Measured final geometry

All dimensions are CSS pixels; card animation was allowed to finish first.

| Viewport | Card and status left edge | Both widths | Card-to-status gap | Header bottom / help top |
|---|---:|---:|---:|---:|
| 1024 × 640 | 598.109 | 396.875 | 12 | 226.594 / 275 |
| 1440 × 640 | 791.594 | 619.391 | 12 | 226.594 / 275 |
| 820 × 640 | 29 | 762 | 12 | 226.594 / 275 |

At 1024 and 1440, Booking Details and Ticket start on the same row. Status ends
at 899.141 and 820.156 respectively, well before the taller Booking Details
bottoms of 2122.313 and 1945.969. At 820 and 390, the ticket stacks after Booking
Details with status immediately after it.

At the scrolled header band, all 39 sampled points at 1024 and 820, and all
60 at 1440, hit a header cell or one of its controls rather than ticket content.
All direct listing header surfaces are opaque. Horizontal scrolling dismisses
help on overflowing tablet/reference listings; the default wide listing fits
without horizontal overflow. Long unbroken notes fit their available width at
the existing 14px body size.

## Checks and retained evidence

- Both relevant browser files were run together: 67 checks passed initially,
  exposing two assertion mismatches (wide screens need not overflow; approved
  pinned/header surfaces need not have identical colors). Corrected final
  layering cases at 1024/1440/820/390 and the existing desktop shared-heading
  comparison subsequently passed. The four final screenshot/geometry cases
  passed again after adding settled-animation evidence.
- Existing coverage passed for editing/save concurrency, ticket actions and
  freshness validation, offline/stale controls, QR privacy/authorization loss,
  unavailable/completed visits, tab switching, history, multiple/final rows,
  expansion boundaries and long content.
- Added full-app touch checks passed for enabled Get Directions and disabled
  missing-address help, including Escape, keyboard focus and scroll dismissal.
- Frontend typecheck passed after rebuilding existing API-client declaration
  outputs with `pnpm exec tsc -b lib/api-client-react`. No generated source or
  API contract was changed.
- `git diff --check` passed. The frontend workflow restarted successfully;
  direct Preview screenshot shows the expected unauthenticated staff login.
  The private listing evidence comes from the fictional full-app browser
  fixture, not an authenticated hosted account.

Reproduce:

```sh
pnpm exec tsc -b lib/api-client-react
pnpm --filter @workspace/clinicflow typecheck
pnpm exec playwright test \
  --config artifacts/clinicflow/ticket-regression/playwright.config.ts \
  artifacts/clinicflow/ticket-regression/tests/appointment-details.spec.ts \
  artifacts/clinicflow/ticket-regression/tests/booking-tab.spec.ts
```

Use `REUSE_TICKET_SERVER=1` only if the fixture server is already running.
Do not run suites sharing the same results directory concurrently.

Final local screenshots and JSON are retained under
`generated-artifacts/appointment-layering/` (ignored generated output):
`1024-scrolled.png`, `{1024,1440,820}-horizontal.png`,
`{1024,1440,820,390}-help.png`, `{1024,1440,820,390}-editor.png`,
`390-touch-help.png`, and `{1024,1440,820}-geometry.json`.
The delivered self-contained HTML evidence report embeds representative final
screenshots and geometry so it does not depend on those relative files.

This is Chromium desktop and touch-emulation verification. It is not a claim
of native Safari/Firefox, physical-device or hosted-UAT acceptance.
