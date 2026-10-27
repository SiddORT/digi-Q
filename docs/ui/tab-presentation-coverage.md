# Tab-only presentation acceptance

## Scope and inventory

The approved reference is `attached_assets/image_1793026842063.png`: adjacent
icon-and-label tabs, neutral inactive borders, pale-blue active fill, blue
text/icon and a thin blue bottom indicator. Panel contents in that image are
**not** a requested layout. Existing DigiQ type, blue/navy tokens, focus outline
and subtle hover conventions are retained.

[`tab-inventory.json`](tab-inventory.json) accounts for **17 genuine groups**,
their labels, explicit icon mapping, style owners, permitted role gates,
conditional groups, linked entry points and verification cases. The generated
surface inventory links this ledger; a source-census test fails for a newly
unaccounted genuine-tab owner or a FormTabs caller without icon metadata.

Coverage includes:

- Appointment Booking/Details/History in expanded rows and private details.
- Clinic Details/Locations/Staff/Policies/Activity History; doctor
  Clinics/Staff/Booking QR.
- User administration, settings, communication and reports.
- Weekly/Exceptions, nested weekday tabs, session settings and generic
  patient/user/receptionist record-editor tabs.
- Permission-filtered global-search categories and dynamic counts; notification
  popover and patient details drawer.
- Multi-location consulting-owner registration tabs. Their child
  `WeeklyDraftDays` controls remain **accordions**, not invented weekday tabs.
  Saved `WeeklyScheduleEditor` uses the existing weekday tabs.

Queue `StatusTabs` remains a pressed **filter group**. Sidebar navigation,
ordinary links, wizard progress, list/calendar switches, toggles, report
selectors and menus were not converted to tabs. Older status-only tab guidance
does not authorize removing the existing genuine tab surfaces.

## Presentation and behavior boundaries

`components/tab-presentation.css` owns only strips, triggers, their decorative
icons, count treatment and error/attention flags. Shared Radix, FormTabs,
WorkspaceTabs and direct implementations consume that owner. Competing legacy
tab declarations were retired from their existing stylesheets; the generic
compact button size excludes genuine tab buttons instead of adding a global
override. Strip margins and panel styles remain at their existing owners.

Desktop targets are 40px; narrow/coarse-pointer targets remain 44px. Tracks share
available width but retain intrinsic label width and internal horizontal
scrolling. Focus has reserved space inside the scrollport. URL/validation
selection and resized containers reveal the selected tab without moving the
page or a panel. Section icons are explicit fixed Lucide metadata, not guessed
from an arbitrary location name, and are hidden from the accessible name.

Active blue remains active during hover and focus. Error and attention badges
are separate red/amber symbols with their existing accessible explanations,
including when selected. Counts remain visible. Routes, labels/order,
permission gates, panel mounting, save/validation/draft/confirmation handlers and
the appointment expansion's 24px bottom clearance/separator are unchanged.
Arrow/Home/End navigation uses the existing tab model; rejected workspace changes
retain focus on the committed selection. Targeting the already-selected tab now
focuses that tab rather than the originating inactive trigger.

## Executed checks

| Check | Observed result |
|---|---|
| `pnpm run typecheck:libs` then `pnpm --filter @workspace/clinicflow typecheck` | Pass. Initial leaf check encountered stale shared declarations; rebuilding them resolved it without source/toolchain repair. |
| `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build` | Pass; existing large-chunk advisory. |
| `node scripts/compact-ui-inventory.mjs` and `--check` | Pass; 79 route patterns and 179 source surfaces; enumeration, not role authorization evidence. |
| Focused tab/source, form, workspace, schedule and appointment Node checks | **65/65 pass**. One literal class-name assertion in linked-schedule tests was updated for the added shared class. |
| Workspace browser projects `tab-presentation`, `doctor-context`, `users-administration` | First run: **34/40 pass**; existing doctor and user cases **31/31 pass**. Six new tab cases exposed the cascade issues/fixture assumption described below. |
| Focused tab CSS follow-up | **8/9 pass**, including six responsive profiles, touch and real overlay/search/owner components. The remaining case exposed the already-selected focus edge. |
| Focused hover/selected/focus/flags/disabled/long-label/rejected-selection case after focus correction | **1/1 pass**. Combined final evidence covers all nine new cases; this is not a claim that the original failing run passed. |
| Workspace + form-presentation browser specs | **40/44 pass**. Four pre-existing stale fixture expectations remain; see below. |
| Ticket `booking-tab.spec.ts` + `appointment-details.spec.ts` | **54/54 pass**, including drafts, discard, authorization loss, all three appointment tabs and expansion clearance across row/calendar, viewport and loading/error/empty contexts. No real messages were sent. |

Reproducible browser commands:

```sh
pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/playwright.config.ts \
  --project tab-presentation --project doctor-context --project users-administration
pnpm exec playwright test workspace.spec.ts form-presentation.spec.ts \
  --config artifacts/clinicflow/workspace-regression/playwright.config.ts --project workspace
pnpm exec playwright test --config artifacts/clinicflow/ticket-regression/playwright.config.ts \
  booking-tab.spec.ts appointment-details.spec.ts
```

Responsive profiles: **390×844, 768×768, 1024×640, 1366×768, 1920×1080,
512×320**. The last is reflow, not native zoom. A separate native Chromium
**200%** run measured outer **1024×640**, inner **512×320**,
`devicePixelRatio: 2`, and document width **512px**. The tab suite checks text
and icon containment, aligned single-row tabs, colors, bottom indicator, icon
size, horizontal overflow, 44px touch targets and representative short overlays.

The first rendered pass correctly caught a 32px generic-button size winning on
desktop and a hover selector outranking selected fill. Their owners were fixed;
no acceptance tolerance was reduced. The owner-registration test initially
expected weekday tabs where the source has accordions; it now asserts the seven
existing weekday rows instead of changing production UI.

The first configured completion run of `pnpm test:tickets` passed **135/144**.
Nine notification geometry cases exposed an unintended specificity increase in
the generic button exclusion: two `:not()` clauses also overrode unrelated switch
and accordion rules. The exclusion now uses one selector list
`:not(.button,[role=tab])`, preserving the original selector weight for every
non-tab button. A focused source guard prevents that regression; no notification
component or panel style was changed.

## Rendered evidence and its limits

Stable, ignored evidence lives in `generated-artifacts/tabs/`:

- `fixture-1366x768.png`, `fixture-390x844.png`, `geometry-1366.json`,
  `geometry-390.json`: complete **presentation samples** for the inventoried
  labels/icons, using actual shared primitives and the full production CSS.
  These samples do not independently prove every caller's route/role gate.
- `overlay-nested-1366x768.png`, `drawer-nested-1366x768.png`: real AppDialog
  contexts around shared strip samples.
- `owner-locations-1366x768.png`: real OwnerWeeklySessions and unchanged child
  weekday accordions.
- `real-patient-drawer-1366x768.png`, `notifications-popup-1366x768.png`,
  `search-popup-1366x768.png`: actual components with intercepted fictional data.
- `native-200-1024x640.png`, `geometry-native-200-1024x640.json`: native zoom,
  separately identified from reflow.
- `fixture-projects.log`, `workspace-form.log`, `ticket-tab-accordion.log`,
  `tab-presentation-css-followup.log`, `tab-presentation-roving-final.log`:
  original and focused results, including failures rather than only successes.
- `live-signed-out-preview.jpg`: actual running app at 390×844, with clean
  browser output; **not** signed-in tab evidence.

The source role matrix is not a claim of independently authenticated identity.
Browser suites use fictional/intercepted identities and scoped data. Authenticated
live role checks were unavailable without crossing the credential-access
boundary; no real privileged session, patient identity or UAT acceptance is
claimed. The signed-out Preview was inspected and both managed app/API services
started cleanly.

Known broader fixture failures, already documented in compact UI coverage:
`old landing redirects but direct clinic and legacy section links keep their
context` expects obsolete empty-state wording; `compact workspace Staff:
bounds, focus, drawer-only filters and columns` expects no Staff Type select;
`compact drawers commit combined filters, staff type and appointment time view`
and `compact schedule drawer keeps scope, day, date and actual workspace tabs`
expect the retired Staff Type drawer button. Production labels/filters were not
changed to satisfy these tests.

Safari/Firefox, screen-reader announcements, real device behavior and every
conditional role/route/data permutation were not independently exercised.
No backend/auth/permission changes, clinical writes, live mail/SMS, publishing,
project deck/canvas edits, new design system or tab-panel redesign were made.
