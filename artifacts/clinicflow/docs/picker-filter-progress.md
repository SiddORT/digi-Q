# Picker and Filter Drawer Progress

Status legend: **Done**, meaning implemented with local tests passing. Main ran a local browser check (`scripts/picker-filter-browser-check.mjs`): all 7 suites passed on desktop and at 390px width, using local fixtures with every API call intercepted and zero writes. Results and screenshots are in `screenshots/picker-filter-check/` (`results.json`). Main owns the final runtime pass.

## 1. Date/Time Entry Caller Inventory
A grep for `type="date|time|datetime-local|month"` and plain-text date/time placeholders across `src/` found no matches. Every entry point goes through the shared `DateFormatInput` / `TimeFormatInput`, which provide a picker, validated typing, clinic formats, min/max and a custom validity state.

| # | Surface | File | Control | Bounds / prefs | Role in the UI |
|---|---|---|---|---|---|
| 1 | Public guest booking: visit date | components/GuestBooking.tsx | Date | min = today in the location's timezone | form |
| 2 | Clinic registration hours | components/ClinicRegistrationHours.tsx | Time | clinic prefs | form |
| 3 | Weekly schedule editor | components/schedule/WeeklyScheduleEditor.tsx | Time | clinic prefs; typing exact minutes still works | form |
| 4 | Reschedule appointment | components/appointments/RescheduleAppointment.tsx | Date | existing | form |
| 5 | Session queue date | components/queue/SessionQueue.tsx | Date | required; invalid text pauses session/queue fetching and shows an inline error | operational context (stays in the page) |
| 6 | Resource editor date/time fields | resources.tsx (Controller) | Date/Time | field rules | form |
| 7 | Patients/Audit From–To | resources.tsx | Date | to.min = from; inversion blocks Apply | drawer |
| 8 | Exceptions date filter | resources.tsx | Date | — | drawer (moved from inline) |
| 9 | Appointments From–To + quick presets | clinic.tsx | Date | to.min = from; clinic prefs | drawer |
| 10 | Reports From–To (required) | clinic.tsx | Date | to.min = from; both required | drawer, drafted |

## 2. Filter Container Inventory
| Listing | Before | Now |
|---|---|---|
| Resources (all admin resources) | status tabs, plus inline clinic/location/doctor/date/category and the sort select | status, scope, date, category and sort are drafted in the drawer; one Apply, with an inversion guard |
| Staff users (Users.tsx) | status tabs with counts | "Account Status" in the drawer (drafted); counts are shown read-only in each option label; chip shown |
| System users | status tabs; drawer applied live | drafted drawer with Status, Role and Clinic plus Apply; status chip |
| Appointments | status tabs, inline Visit Range, live sort | Status (counts in labels), Visit Range, Sort, dates and scope all drafted; quick Today / Tomorrow / Next 7 Days |
| Reports | inline live date range; no draft for dates | dates drafted; required plus inversion inline errors block Apply; Reset sets today/today, Date grouping, no scope, no search, default sort, page 1 |
| Clinic assigned/network clinics | inline sort selects | sort drafted in the drawer; Apply and Reset work the same as other listings |
| Session queue | status tabs, sort, date/doctor | **Unchanged on purpose**: operational queue context, as the user directed |
| Public directory, Guest requests | search only | no record filters to move |

Columns, saved views and export stay in the `secondary` group (compact "More"). Pagination stays at the bottom and header sorting is unchanged.

## 3. Numbered Progress
1. Done: real pickers. The calendar month grid supports Arrow keys, PageUp/PageDown, Home/End, Enter, Escape and a Today button. Keyboard focus is clamped to min/max and disabled days are not selectable. The time list uses a 15-minute default step; a typed exact minute is merged into the list.
2. Done: the popover is portaled into the nearest `[role=dialog]` (so it stays inside the Radix focus trap) or into `document.body`. Placement is computed by the pure `placePanel` function: it flips above when needed and is clamped inside the container. It is repositioned on scroll and resize. `AppDialog` passes Escape and outside clicks through to an open picker rather than closing the dialog.
3. Done: the FilterBar drawer is now a `<form noValidate>`. Apply runs `checkValidity()` first, focuses the first `:invalid` field and shows an inline summary alert. A caller returning `false` from `onApply` keeps the drawer open. The drawer only closes after a successful apply.
4. Done: Reports drafts its dates until Apply, Reset covers every report filter coherently, and Apply is blocked with inline range errors.
5. Done: Appointments Apply is blocked for invalid or inverted dates with an inline error, replacing the earlier toast-only message.
6. Done: status filters moved into the drawer in Resources, Users, SystemUsers and Appointments. Read-only counts are kept in the option labels.
7. Done: the page size of 25 now parses from the URL in resources.
8. Done: native selects in IntegrationSettings and PatientDocuments were replaced with SearchableSelect.
10. Done: calendar month/year shortcut views. Click the title to pick a month, then click again to pick from a 12-year page. This reaches birth dates in a few clicks. It respects min/max and keeps the day, clamped to the month length (`jumpTo`, tested).
11. Done: Assigned/Network sort drawers are drafted with Apply/Reset.
12. Done: an invalid Queue date no longer leaves the previous date silently in use. Fetching pauses and an inline message appears until the date is valid.
13. Done (browser follow-up): Escape pressed with focus anywhere in the picker, its trigger or the input closes only the picker, not the parent dialog or drawer.
14. Done (browser follow-up): when typed report dates are unparseable, Reports shows "Enter valid start and end dates, with the end on or after the start." instead of the misleading empty-date message.
15. Done: the DateFormatInput test now removes its generated `.date-format-input-test-*.css` file as well as the bundle; leftover CSS files were deleted.
9. Done: picker CSS is tokenized (passes enterprise-tokens).

## 4. Validation Evidence
- `npm run typecheck`: passes.
- All `src/**/*.test.mjs` (node --test): pass.
- New behaviour tests: `src/lib/date-picker-logic.test.mjs` covers leap years, month clamping, calendar keyboard with min/max clamping, initial focus, inclusive bounds, exact-minute time options with step and bounds, popover flip/clamp/scroll placement, and range errors. `DateFormatInput.test.mjs` adds required, min/max, exact-minute and leap-day render validity. `filter-drawer.test.mjs` covers the Apply gating order, pluralised messages, report/appointment/resource draft guards, the portal and dialog Escape handling, and status-filter placement.
- Updated source-contract tests that encoded the superseded "status tabs inline / sort outside filters" decision: compact-listing, resource-controls, linked-schedules-ui, uniformity, staff-controls, information-density-pages, searchable-select-callers and accessibility-sweep. Each now asserts the approved drawer contract with equal or greater specificity. None were deleted.

## 5. Remaining Gaps (Truthful)
### Final verification
- Broad frontend run: 309 checks passed; after the final Escape/message fixes, the 21 focused checks and frontend typecheck passed.
- Backend date/range and feature integration run: 18 checks passed; API typecheck passed.
- Ticket regression: corrected the stale title-casing expectation only; all 24 browser checks then passed. Ticket rendering and QR logic were unchanged.
- UI/API services start successfully. The public mobile page renders without browser errors. Signed-in picker/drawer checks use intercepted fictional data, not real accounts.
- No live email, real booking submission, production data changes or publishing was performed by this work.

- Escape/keyboard handling is unit-tested by source assertions only; the real behaviour is confirmed in Main's browser run.
- No DOM test runner (jsdom or happy-dom) is installed, so click and focus interactions are covered by pure-logic and source tests, not real DOM events. Browser/E2E acceptance belongs to Main.
- Status filters stay single-select by decision; the reference image shows checkboxes, but no multi-status backend feature was requested.
- The Session Queue keeps its inline tabs and sort, as directed (operational).
- Server: Main reports existing calendar/time/session validation plus a new inverted-date-range check (18 passing). Client validation is not authoritative.
