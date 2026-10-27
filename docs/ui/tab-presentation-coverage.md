# Shared tab presentation acceptance

## Scope and inventory

The approved reference is **Booking / Details / History inside the appointment
accordion**, including
`attached_assets/Screenshot_2026-10-27_at_1.17.45_PM_1793087268804.png`: adjacent
icon-and-label tabs, neutral inactive borders, pale-blue active fill, blue
text/icon and a thin blue bottom indicator. Panel contents in that image are
**not** a requested layout. Existing DigiQ type, blue/navy tokens, focus outline
and subtle hover conventions are retained.

[`tab-inventory.json`](tab-inventory.json) accounts for **17 genuine groups plus
the explicitly approved Appointment List / Calendar view selector**,
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
ordinary links, wizard progress, other view switches, toggles, report
selectors and menus were not converted to tabs. Older status-only tab guidance
does not authorize removing the existing genuine tab surfaces.
List / Calendar retains its accessible group name, two ordinary keyboard-focusable
pressed buttons, test IDs and existing view/month selection handlers. Only its
presentation is shared: `dq-tabs-intrinsic` keeps it content-width in the existing
toolbar. It is deliberately **not** a tablist and has no arrow-key tab model.

## Presentation and behavior boundaries

`components/tab-presentation.css` owns only strips, triggers, their decorative
icons, count treatment and error/attention flags. Shared Radix, FormTabs,
WorkspaceTabs and direct implementations consume that owner. Competing legacy
tab declarations were retired from their existing stylesheets; the generic
compact button size excludes shared tab-style buttons instead of adding a global
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

## Current verification: shared tabs plus appointment view selector

All 17 inventory groups were reconciled against current source consumers.
No labels, order, panel contents, role restrictions, routing or data APIs changed.
The selector's competing declarations were removed at `visit-range.css` and
`uniformity.css`; its selected/hover/focus states now use the same owner as the
accordion. The compact-button exclusion remains one `:not()` selector list to
avoid increasing specificity for unrelated switches/accordions.

### Coverage matrix and evidence boundary

| Surface family | Current coverage |
|---|---|
| Appointment; clinic; doctor clinic; Users; Settings; Communication; Schedule; Reports | All labels/icons measured with production styles and real Radix/Workspace/direct tab primitives. Actual clinic linked destinations, Users and Schedule exercised by workspace suites; appointment rows/calendar/private details exercised by ticket suites. The presentation samples alone are not actual route/role checks. |
| Schedule/patient/system-user/receptionist editors; weekdays | Real shared FormTabs presentation including invalid/attention badges, hidden groups and nested overlays; focused editor suites exercise drafts, validation and discard behavior. |
| Search; notifications; patient drawer | Real components with intercepted fictional read-only data, popup/drawer interaction and dynamic category counts. |
| Consulting-owner locations | Real OwnerWeeklySessions with long dynamic names, location keyboard selection and unchanged weekday accordions. Public registration/onboarding consumers are source-verified, not authenticated acceptance. |
| List / Calendar | Real extracted production selector, shared CSS, intrinsic width, mouse hover, Tab/Shift+Tab focus, Enter/Space activation, pressed state and no invented tab semantics. Actual Appointments consumer also verifies calendar paging and return to list. |
| Super Admin / Clinic Admin / Doctor / Receptionist / Patient | Source permission matrix retained. Intercepted identity fixtures are not privileged live sessions; real credential-based checks remain unavailable and are not claimed as passed. Public signed-out Preview is separately inspected. |

Responsive profiles: 390×844, 768×768, 1024×640, 1366×768, 1920×1080
and 512×320 reflow. Native **200% Chromium tab zoom** is independently captured
with `scripts/tab-zoom-evidence.mjs`: physical outer width 1024 unchanged,
inner width 1024 → 512, devicePixelRatio 1 → 2. It measures all 21 visible strips
(17 families plus selector and stress samples), full content bounds, touch target
heights, selected view behavior and focused overflowing label reveal. Screenshots
use physical-surface capture rather than CSS viewport scaling.

Current logs and native-zoom measurements are under ignored
`generated-artifacts/tabs/current/`; tab-suite screenshots are under
`generated-artifacts/tabs/results/`. Responsive geometry is asserted in the
suite and attached to its test results; the native-zoom JSON is also saved directly.
`native-zoom/view-selector-200-percent.png` visibly compares the real selector
with the accordion-reference primitive. `native-zoom/overflow-focus-200-percent.png`
and `native-zoom/geometry.json` cover keyboard overflow and native zoom.
`live-signed-out.jpg` proves only that the running public app loads cleanly.

Commands:

```sh
pnpm run typecheck:libs && pnpm --filter @workspace/clinicflow typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build
node scripts/compact-ui-inventory.mjs --check
pnpm exec playwright test tab-presentation.spec.ts doctor-context.spec.ts \
  users-administration.spec.ts workspace.spec.ts form-presentation.spec.ts \
  --config artifacts/clinicflow/workspace-regression/playwright.config.ts \
  --project=tab-presentation --project=doctor-context \
  --project=users-administration --project=workspace
node scripts/tab-zoom-evidence.mjs # while that fixture server is running
```

No live notifications, production/UAT writes, publishing, deck or canvas changes
were made. Safari/Firefox, screen-reader announcements, physical touch devices
and every conditional role/route permutation are not independently verified.

### Current results

| Check | Observed result |
|---|---|
| Shared-library build and frontend typecheck | Pass, with no frontend source or toolchain workaround. |
| Frontend production build | Pass; existing large-chunk advisory only. |
| Inventory freshness | Pass after regenerating against the final styles: 80 route patterns, 182 source surfaces, 1,601 enumerated child controls/links/surfaces. Enumeration is not route authorization evidence. |
| Focused tab, keyboard, appointment, form, linked-schedule and workspace Node checks | 51/51 pass (`current/source.log`). The five tab-specific guards also pass against the final intrinsic-width rule order. |
| Tab browser project | 9/9 pass: six responsive profiles, shared states/flags/disabled/navigation, real popup/drawer/search/onboarding components and coarse-pointer targets. |
| Combined workspace / tab / doctor-context / users-administration browser run | 75/84 pass (`current/workspace.log`): tab 9/9, doctor-context 20/20, workspace+form 38/44, users-administration 8/11. Nine stale fixture expectations are listed below; this is not an all-green broader-suite claim. |
| Focused appointment `booking-tab.spec.ts` + `appointment-details.spec.ts` | 63/63 pass (`current/appointments.log`), including accordion/reference style, actual application tree, row/calendar details, drafts, validation, discard and authorization loss. |
| Native Chromium 200% zoom | Pass, 21 visible strips measured, selected view and keyboard overflow reveal verified (`current/zoom.log`, `current/native-zoom/geometry.json`). |
| Managed app workflow and public Preview | Clean startup; signed-out mobile public page renders with no browser errors. Not signed-in tab evidence. |

The automatically started broader ticket workflow initially passed 155/156:
the today/phone expansion refresh case expected a History row after the fixture
had collapsed its appointment expansion. Its context is preserved in
`current/initial-ticket-failure.md`; the subsequent focused run passed that case
and all 62 other appointment cases. This is an unreproduced initial failure,
**not** a claim that the original full run passed or proof of its historical cause.

The broader workspace project retains six unrelated stale expectations:

- `old landing redirects but direct clinic and legacy section links keep their context`:
  obsolete “Select a clinic…” wording (also documented in the preceding pass).
- `Clinic compact toolbar keeps bounds, descriptions, stable search and working preferences`:
  expects a heading named `Clinic`; the pre-task source/fixture renders `Clinic Groups`.
- `unrelated shared headers retain labelled tools, views and quick status`:
  expects the QR header not to use `list-header--compact`; the pre-task shared
  header already uses that class.
- `compact workspace Staff: bounds, focus, drawer-only filters and columns`:
  expects no visible Staff Type selector.
- `compact drawers commit combined filters, staff type and appointment time view`
  and `compact schedule drawer keeps scope, day, date and actual workspace tabs`:
  expect the retired Staff Type drawer button.

The last three expectations were also documented in the preceding pass.
No tab-style assertion fails in these cases; production headings, filters and
header composition were not changed or acceptance assertions weakened to make
them pass. Their current failure contexts remain under the workspace test
results, and the complete run is recorded in `current/workspace.log`.

Three additional users-administration fixtures fail before their old header
geometry assertions can establish a tab issue:
`Add Staff shows Account Details before Work Assignment with paired rows, honest verification and role-specific footer`,
`Add doctors layout stays contained on phone, tablet and laptop` and
`Add receptionists layout stays contained on phone, tablet and laptop`.
All three select `.form-section-head` inside the Account Details section.
The unchanged pre-task `FormSection.tsx` already renders that section through
`PageHeader` instead; only disclosure summaries retain `.form-section-head`.
The switch itself is visible and checked, but that retired header locator matches
no nodes. This was established from failure context and unchanged source, not by
changing the assertions, increasing timeouts or claiming a new baseline run.
The remaining eight user-administration cases pass, including mounted drafts,
role navigation, conflict recovery, focus and responsive account actions.

## Historical checks from the preceding tab standardization

The results and paths below describe the preceding implementation, not a new run
against this revision. Current results are recorded separately above.

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

The preceding pass recorded these ignored paths under `generated-artifacts/tabs/`;
they are historical references, not a claim that they exist in every fork:

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
