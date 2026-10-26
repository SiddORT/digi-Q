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
