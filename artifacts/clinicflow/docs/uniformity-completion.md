# Uniformity / representation pass: completion notes

## Final browser verification

All 11 focused browser checks passed using fictional intercepted responses, alongside TypeScript and all 241 frontend unit/style tests. Evidence: `screenshots/uniformity-check/results.json`; harness: `scripts/uniformity-browser-check.mjs`.

- At 1024×640, title/search/Export/Book share the first row with 38px action buttons. Status/scope controls take 73px below; at 1440×900 they take 34px. No page overflow; live typing keeps focus and suggestions work.
- The normal appointment ticket fits at 1024×640: dialog 920×585, body scrollHeight and clientHeight both 541px. Full links, QR, instructions and status remain. Long-content and mobile tickets retain safe scrolling.
- Details drawer, field grouping, admin route matrix, role-specific profile/doctor views, booking, public/auth surfaces, downloaded HTML and Print popup were checked. Authenticated patient queue was verified at its selection state, not through a live consultation.
- Download/Print preserve patient, token, full reference, date/location, QR and logo. No real API mutations or messages were issued.

This is UI verification with fixtures, not a production authentication or live-backend regression run.

Scope: frontend only. No changes to the API, auth, permissions, query parameters or domain behaviour. Fonts (Manrope / DM Sans) and DigiQ blue tokens are unchanged. Nothing was removed, shrunk or clipped. Styles are in `src/components/uniformity.css`, imported unlayered after the compact styles and scoped by component root, with no `!important`.

## 1. Shared list header (`ListingControls.tsx` FilterBar)
- **Changed:** the header now has two rows. **Row 1** is the title/count on the left, then a wide flexible search, then the actions on the right (secondary Export, then the filled primary Add/Book). **Row 2** holds status tabs, plus a new `meta` slot (scope, range, sort, last updated, help), then Filters and Clear. Row 2 only renders when it has content, so no tool row is left on its own. Row 1 always renders first and in the same place, so the search input does not remount while typing. Search suggestions, query scope and export logic are untouched.
- **Sizes:** header buttons and the search field are 38px tall. Primary buttons are filled blue; secondary buttons are outlined. Export status text now wraps instead of being cut off with an ellipsis.
- **Responsive:** see §1b.
- **Appointments:** "Book appointment" (or "Book Now" for patients) moved from the small page-heading button into the header's primary slot. It keeps `data-testid="link-page-book-appointment"`. Export sits beside it. The last-updated tip moved to `meta`. The dashboard button is now 38px.
- **Shared resource pages** (patients, clinic groups, locations, doctors, masters, schedules, exceptions, audit, QR): sort moved to `meta`. Availability and exception scope (clinic, location, doctor, date) and the master category also moved to `meta` on row 2. Patient export and Add stay in actions.
- **Queue:** the sort selector and the "Clear all" help moved to `meta`. Quick switch, Validate appointment QR and Register walk-in stay in actions.
- **Reports:** the required From/To range and the methodology help moved to `meta`. Export CSV stays in actions.
- **Doctor assigned/network clinics:** the sort selector moved to `meta`.
- **Staff users and system users:** reviewed; existing actions already fit the pattern (Recovery / Roles & permissions as secondary, Add / Set up as primary). They pick up the shared layout without code changes.

## 2. Appointment details (`AppointmentDetails.tsx`, `AppointmentRows.tsx`)
- **Changed:** opens as a right-side drawer, full width on phones.
- **Summary card:** patient name, current status badge and a token block ("Not assigned" when there is no token).
- **Two-column fact grid:** doctor, clinic group, location, visit date, session with timezone, and the full reference with a Copy button. If copy is unavailable, a message tells the user to select the reference. The session is labelled "Session window, not a promised consultation time."
- **Grouped sections:** Notes (full text, or "No notes recorded."), Consultation (check-in and completed times, or "Not recorded", plus the arrival explanation), and a history timeline with reasons ("No history recorded." when empty).

## 3. Ticket popup (`AppointmentTicket.tsx`, `VisitTicket.tsx`)
- **On-screen layout:** applies inside `.appt-ticket` only. The QR (140px) sits on the left. Waiting number, reference and patient form one column; date/location/session and the Clinic/Address/Doctor label-value list form another. Download and Print are on the same row as the footer note. The logo strip is shorter. Text sizes are unchanged.
- **Below the ticket:** all text that previously appeared below the ticket is now in a compact two-column info grid:
  - booking-status sentence with the full URL (wraps)
  - doctor status
  - queue estimate or offline warning
  - private-QR warning
  - refresh notice
  - Open booking status link
  - appointment history disclosure (unchanged)
  - stale-ticket warning and Refresh
  
  The confirmation email message and Retry QR are kept.
- **Width and scrolling:** the dialog keeps its default width (about 672px). Nothing is hidden. The dialog body still scrolls on short or mobile screens.
- **Download / print:** `ticketHtml` is unchanged, so downloaded and printed content is identical. The default `VisitTicket` (guest booking receipt) only gained wrapper divs (`vt-info`, `vt-main`, `vt-facts`) and renders as before.

## 1b. Page title on row 1 (follow-up)
- **Changed:** `ListPageTitleContext` (in `ListingControls.tsx`) gives the page's own `<h1>`, and the date eyebrow where one exists, to the first list header on the page. Row 1 is now **page title, then search, then Export and primary action**, all on one line at desktop sizes including 1024. Rough fit at 1024: content area about 760–830px; title about 130–160px, search at least 220px and flexible, actions about 230–300px.
- **Count moved:** on these pages the record count is no longer a heading. It now shows as smaller metadata at the start of row 2, so the title isn't repeated.
- **Pages using it:** Appointments, Patients, Clinic groups (admin), Locations, Staff users, Masters, Reports, System users and Audit (super admin).
- **Pages that keep their own page heading:** Dashboard, Queue (session selectors sit above the list), Schedules (section switcher and Copy opening hours sit above the list), Doctor clinics (two lists, each with its own panel heading), and all non-listing pages.
- **Breakpoints:** the 1100px breakpoint is removed. At 900px and below (sidebar becomes a drawer), the search drops to its own line. At 640px and below, actions go full width at 44px.

## 4. Whole-app consistency: page-by-page matrix
Shared rules live in the "Whole-app consistency system" block of `uniformity.css`:
- one section header (`.section-head`): title and description on the left, actions on the right, a divider below
- the same panel padding throughout
- two-column field grid with fields filling their column, capped at 560px when a field sits alone, and one column on phones
- titled editor sections
- outlined secondary and filled primary buttons at 36–38px; footers aligned right, full width at 44px on phones
- one shared shape for notices and empty states

| Area | Status | What changed / preservation |
|---|---|---|
| Dashboard | Changed | Stat and activity text enlarged; Book button 38px. Keeps its page heading because it is not a list. |
| Appointments list | Changed | h1, search, Export and Book on one row; count, status tabs, updated time and Filters on row 2. Details drawer and ticket as in §2–3. |
| Queue | Changed | Sort and Clear-all help moved to row 2. Quick switch, Validate QR and Walk-in stay as actions. Selectors and duration drawer pick up shared field and footer rules. Page heading kept. |
| Guest requests | Changed | Uses the shared section header. Rows are aligned flex rows with actions on the right; buttons 36px; long text wraps. |
| Resource lists and editors | Changed | Row-1 h1 header. Scope and sort moved to row 2. Editors with more than 5 fields get titled sections (Details, Professional, Assignment and scope, Day, Timing, Capacity, Queue window, Verification and links, Status). Fields are reordered only between sections and keep their order within a section. Every field, its validation and the patients "More details" collapse are kept, and section headings for collapsed fields are hidden. |
| Staff / system users | Changed | Row-1 h1 header. Recovery and Roles & permissions are secondary; Add and Set up are primary. The assignment and effective-permissions drawers use the shared drawer title and footer. |
| Schedules / exceptions | Changed | Clinic, location, doctor and date scope moved to row 2. Editors get Day, Timing, Capacity and Queue window sections. Page heading kept because the section switcher sits above the list. |
| Reports | Changed | Row-1 h1 header with Export CSV. Date range and methodology on row 2. Numbers in tabular figures, right-aligned. |
| QR | Changed | Full URL wraps; the list uses the shared header. |
| Audit | Changed | Row-1 h1 header. Technical payload wraps. Facts list unchanged. |
| Clinic settings | Changed | Every panel heading uses the shared section header. "Edit policies" is now an outlined secondary button, same behaviour. Policy editor fields use the shared grid. |
| Platform settings | Changed | Platform preferences now has the same section header as other panels, with one short description line added. Its editor is grouped into Details, Timing, and Verification and links. |
| Email templates | Changed | Bare `secondary` buttons are now `button secondary` (outlined, 36px); the danger action is outlined red. Preview and editor panels use the shared panel rhythm. All variables, preview and server-render drawer kept. |
| Permissions (access rules) | Changed | Shared section header; outlined secondary buttons. Matrix unchanged. |
| Custom roles | Changed | Header uses the shared section header with New custom role on the right at 38px. Empty state uses the shared shape. |
| Integrations / storage | Changed | Header uses the shared section header with the chooser alongside. Buttons now `button secondary`. Fields capped at 560px. Secrets and test-send flow unchanged. |
| Booking | Changed | Steps 2 and 3 headings now use the same section heading as step 1. Form grid and footers are shared. Every step, notice and verification prerequisite is kept. |
| Profile | Changed | Shared section header. Editor keeps all fields and gets grouped sections when it has more than 5 fields. |
| Demo management | Changed | Shared section header. Link and QR actions are 36px outlined. All URLs shown in full. |
| Public clinic / doctor pages | Changed (CSS only) | Cards wrap long text; buttons 40px. All content and links kept. |
| Patient queue / patient booking confirmations | Changed | The booking confirmations panel uses the shared section header. Queue view picks up the shared notice and empty-state styles. |
| Auth (staff, patient, demo, password flows) | Changed (CSS only) | Submit buttons are full width at 44px; inputs use the standard field height; auth links lay out as a wrapping row. Copy and flows unchanged. |
| Shared drawers | Changed | Heading font at 17px; footer buttons 38px. AppDialog behaviour unchanged. |

## Tests
- **Added:** `src/components/uniformity.test.mjs` (header structure and sizes, Appointments actions, kept detail fields, kept ticket and export information).
- **Follow-up tests added:** row-1 page title, section headers, grouped editors and secondary buttons.
- **Updated assertions:** `resource-controls.test.mjs` (sort now in `meta`) and `linked-schedules-ui.test.mjs` (the `Appointments` signature now takes `role`).

Browser verification is still pending; the main agent will do it.
