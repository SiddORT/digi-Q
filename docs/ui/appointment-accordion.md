# Appointment accordion acceptance

## Scope and presentation contract

The 26 October 2026 refinement applies to the shared appointment expansion used
by Dashboard → Today's Appointments and Appointments. The three supplied
screenshots describe the original repeated summary, separate Consultation tab,
and initial Waiting event; they are not authority to remove real history.

The tabs are **Booking** (default), **Details**, and **History**. Booking's
approved cards, editor, ticket controls, status strip, and safety behavior are
unchanged. No ticket/PDF model, backend lifecycle/history semantics, permission
rule, notification delivery, or hosted configuration was modified.

| Information | Retained location |
|---|---|
| Patient/name and ID, status, token, visit/session, clinic/location, doctor | Parent appointment row, with existing measured full-value reveals |
| Hidden parent columns and session-scoped omitted visit/provider columns | Details → Additional information, without duplicating reference or booked-at |
| Copyable reference | Compact reference control above the tabs; standalone summary retains it |
| Booked at, visit mobile, notes | Approved Booking card |
| Location address and timezone | Details → Additional information |
| Consultation check-in/completion | Details → Consultation; absent timestamps remain “Not recorded” |
| Standalone linked visit/calendar details | Existing identity/visit summary; additional patient ID in Details |
| Actual recorded history | History table with Date & time, Event, Status, Reason |

Check-in still means entry into consultation, **not clinic arrival**. The session
window warning remains visible. Neither empty filler cards nor repeated Patient
and Provider sections are introduced.

## History state handling

- History uses the shared authorized appointment query, not an unverified list
  projection or the appointment's current status.
- Initial loading, refresh errors, missing history, and denied private reads
  remain distinct from empty history. Private denial hides the complete detail
  surface and private drafts.
- Only a confirmed zero-length history renders the shared icon-based
  `EmptyState` with the exact text **“Nothing to show.”**, with no table/header.
- Real initial Waiting events remain. Actionless recorded events are labelled
  “Status recorded,” with the recorded status in its separate column.
- Timestamps use configured date/time formats and appointment timezone.
  Reasons preserve line breaks and wrap long/unbroken text.

## Existing UI conventions

The implementation reuses shared Tabs, EmptyState, History icon, Table, compact
layout classes, copy control and full-value reveals. The only shared Table CSS
addition protects semantic table display/row positioning against legacy mobile
card rules; it introduces no local control/cell sizes, fonts, colors, theme or
new card design. Appointment-list width/layout rules were narrowed to their
direct table so they cannot force the nested History table to list-table widths.
Existing Booking CSS and control/focus/touch families are retained.

The fictional detail fixture now loads the real `index.css`, `form-standard.css`
and `compact-ui.css`, and explicitly scans application sources for utilities.
It remains lazy-loaded so ticket/PDF fixture modes do not acquire host styles.

## Source/build verification

Passed:

```sh
node --test artifacts/clinicflow/src/components/appointments/{refinement,booking-tab,information-density,uniform-layout}.test.mjs artifacts/clinicflow/src/components/uniformity.test.mjs
# 30 passed
pnpm run typecheck:libs
pnpm --filter @workspace/clinicflow typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build
node scripts/compact-ui-inventory.mjs
node scripts/compact-ui-inventory.mjs --check
git diff --check
```

Initial typecheck used stale generated library declarations; rebuilding the
existing library declarations resolved those errors without application changes.
Build retains the existing large-JavaScript-chunk advisory.

The app workflow was restarted after the coherent changes and served cleanly.
A public-preview screenshot verified app startup, not the signed-in accordion.
The source inventory is refreshed; it is not independent route/role coverage.

## Browser evidence boundary

Browser checks use intercepted fictional appointment data in
`ticket-regression/AppointmentDetailsFixture.tsx`, not real authenticated clinic
identities. The `rows` surface exercises ordinary appointment rows; `today`
also exercises the stricter session-scoped variant. Both requested page entry
points use the same production `AppointmentRows` component.

The focused pass runs:

```sh
pnpm exec playwright test --config artifacts/clinicflow/ticket-regression/playwright.config.ts appointment-details.spec.ts booking-tab.spec.ts
```

Its initial result was 39 passed / 7 failed. Failures identified nested-history
layout inheritance, hidden token reference-help duplication, a stale removed-
summary assertion, and premature print-popup closure in the fixture. The fixes
preserve Booking and export implementation. A follow-up of **only those seven
previously failing cases passed 7/7**:

```sh
pnpm exec playwright test --config artifacts/clinicflow/ticket-regression/playwright.config.ts appointment-details.spec.ts booking-tab.spec.ts --grep 'hidden row values|rows: a denied|tabs and long content/control bounds fit (1024|768|390)|output actions'
```

The original 39 unaffected passing cases were not rerun. Their pass remains
valid: the later fixes narrowed nested-table CSS selectors, corrected a
duplicated hidden-token tooltip and fixed stale fixture assertions/print timing;
they did not alter Booking's component or export behavior.

The same fictional fixture was rendered at 390×844 (phone), 768×844 (tablet),
1024×640 (short desktop), 1366×844 and 1920×844, all three tabs. Details’
additional information and Consultation sit side-by-side at 768px and wider and
stack at 390px. The history table and its cells stayed within detail bounds at
every measured size (detail/table widths: 332/332, 712/712, 968/968, 1310/1310,
1864/1864 respectively); no measured text-range bounds failed. The wider
appointment *list* scrolls horizontally on tablet by its existing design.

Keyboard ArrowRight moved tab focus/selection from Booking to Details. In the
phone touch context all three tabs selected correctly with 44px tab hit heights;
copying the reference gave the exact fictional value and tapping clipped
patient text revealed its full value. Generated screenshots and computed
geometry are recorded in `manual-metrics.json` and `manual-*.png`.

`node scripts/appointment-zoom-evidence.mjs` was run against the isolated
fixture for **native Chromium tab zoom**. Its extension called
`chrome.tabs.setZoom(2)` and `getZoom` returned 2. With the same 1024px-wide
physical window, the CSS viewport changed 1024→512px and devicePixelRatio
1→2. Booking, Details and History each fit the 454px detail region without a
control, table cell or header leaving its bounds; see
`native-zoom/geometry.json` and the three physical-surface screenshots.
CSS `zoom: 200%` was also tried separately as reflow emulation but is **not**
counted as proof of native browser zoom. Chrome physical zoom does not prove
Safari/Firefox or physical-device behavior.

Screenshots and computed geometry are kept under the ignored
`generated-artifacts/appointment-tabs/` directory. Playwright failure traces and
reports are under `generated-artifacts/ticket-regression/`.

No production/UAT inspection or changes, real account authentication, live
appointments, contact verification, or messages are part of this evidence.
Native Safari/Firefox, physical devices and screen-reader announcement quality
are not independently verified by Chromium fixtures.

## 27 October 2026: Details and History reference refinement

The two later supplied screenshots were layout references, not claims about
recorded data or permissions. The earlier acceptance above describes the
*before* state. The *after* state keeps Booking and the three shared tabs
untouched: Details has Patient information and Visit information alongside each
other on desktop, with Additional information below. On a narrow screen the
cards stack. Consultation check-in/completion live in Visit information and
are explicitly different from clinic arrival. The profile mobile and the
booking's visit contact mobile have different labels and values; the booking
source is displayed only when actually recorded. There is no internal-notes
editor or generic schedule editor. The copyable reference, visit notes,
timezone, location address and optional hidden-column facts remain in Details.

The private `GET /appointments/:id` response can include only independently
authorized patient demographics/contact and safe display attribution for its
recorded events. Edit patient appears only with the existing patient writer's
registration/self authority and fetches the current profile before opening its
reused editor. The patient self-editor omits status and registration scope.
Visit contact/notes retain the existing visit-only editor, draft/discard,
terminal-state, stale-revision and server checks. Actor IDs, order IDs and
unclassified history JSON are not sent in the detail's enriched history.
Missing, erased, system and unreadable actors stay distinct. Role text is
**recorded event role**, never an account's present-day role; event names
are present-day permitted display names, not historical name snapshots.
The ordinary list, ticket and guest-receipt serializers do not call this
detail-only projection.

History now shows newest-first recorded events (stable for timestamp ties),
with status badge text, event/action, remarks, safe attribution and recorded
reschedule coordinates where available. Newly recorded moves preserve the
old and new session dates, windows and timezones; old incomplete records
explicitly say what was not recorded. One timezone notice beside History
describes event timestamps; a different or absent historical session timezone
is identified beside that session window. Empty, unavailable, loading and
error/retry states remain separate. No artificial Created or Scheduled event
is added to a visit that has only one recorded initial event.

**Evidence boundary:** The before comparison is the documented prior
Consultation/Additional-only layout above and the supplied *reference*
screenshots; neither is a captured authenticated before image. The after
inspection used the fictional browser fixture with actual application CSS,
not an authenticated clinic account. Its 1366×844 Details image shows the
two cards and full-width Additional section; its 390×844 image shows their
stacked order and distinct fictional phone numbers. The 390px History image
contains 24 long events with labels on each stacked row. These generated
images remain in ignored `generated-artifacts/appointment-tabs/` and are
not deployment or live-patient evidence. The initial delegated browser
inspection failed because it opened this interception-dependent fixture
without its mock API routes; it observed a 404/blank screen, **not** an app
response from an authenticated session. Running the fixture with its own
routes confirmed the changed layouts.

**Verification:** Focused private appointment/booking and render tests,
uniformity source tests, shared-library codegen/typecheck and both application
typechecks passed. A disposable-database guest receipt regression confirmed
that public management/receipt responses contain no private profile or actor
projection. A focused fictional browser profile edit confirmed that
the fresh profile read and subsequent PATCH omit registration/status fields
and leave the visit contact unchanged. Six booking-edit browser regressions
cover draft/discard, tab/row switches, polling, revision conflict, terminal
edits and access loss. The full fictional appointment-detail browser regression
passed 44 of 47 cases initially; three failures were obsolete heading/loading/
column assertions after the new layout and all three passed on the corrected
focused rerun (47 distinct cases passing), plus a new profile-edit fixture
case. Native Chromium tab zoom 2× at
1024×640 physical pixels reduced the CSS viewport to 512×276; Booking,
Details and History each occupied the 454px detail region with no measured
element leaving its bounds. Tests also exercised 768px tablet, 1024px short
desktop, 1366px desktop, 390px phone, long notes and actual initial/empty/
unavailable histories. These are isolated fixture and disposable-PostgreSQL
checks, not UAT, Safari, Firefox, real patient authorization, or delivery tests.

The separately configured full ticket-browser workflow reported 161/162 while
generated client files were being refreshed: its guest-creation case timed out
after Vite logged missing generated imports during the concurrent codegen
window. That exact guest-creation case passed on a focused rerun once codegen
settled (1/1). This does not make the full workflow's 161/162 result a clean
full-suite pass. The managed API and web development services restarted and
came up cleanly; the anonymous app preview loaded, but it cannot show the
signed-in appointment expansion.
