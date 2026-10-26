# Compact shared schedule editor

## Scope and owners

This refines the existing editor, not the schedule tables or scheduling rules.
`AvailabilityScheduleEntry` and `DoctorScheduleContext` provide fresh, saved
assignment scope; `ScheduleDayDialog` supplies the existing fixed row scope.
All three still render `WeeklyScheduleEditor` / `CompactDayEditor`.

- `ScheduleContextHeader`: doctor left; two wrapping clinic/location columns
  right on desktop; one timezone/time-format row below. No font/color changes.
- `CompactDayEditor`: selected-day source and actual clinic hours beside the
  day controls; Working day beside the weekday; inline Copy from and one Add
  action at the right. The visible select border (not its absolute trigger)
  is the alignment boundary.
- Desktop session tracks use 32px slot numbering, equal 160px time fields,
  160–180px duration and a 44px reserved action track. These are column widths,
  not new control heights. Below the editor's existing 640px/480px container
  breakpoints, fields wrap. The modal retains its existing width.
- Each session disclosure begins in the start-time column, has one indicator,
  and retains its own capacity, token, buffer, break and queue controls.
- Identical outside-hours notices become one visible selected-day warning
  naming current slot numbers. Distinct warnings and all errors remain visible.
  Save's extended-hours confirmation and custom-day confirmation are unchanged.
- `compact-ui.css` owns the ordinary 40px `field-action` button family (44px
  on touch), used for Add beside the ordinary Copy select. Compact secondary
  actions remain in the existing 32px family. No local height override.
- `FormActions` has an opt-in primary group, used here only, keeping Cancel/Save
  together after secondary actions wrap. Date Exceptions remains secondary;
  authorized Delete Schedule retains its original permissions and confirmation.
- `AppDialogActions` opts this editor into a real, non-scrolling action track.
  React portals preserve the editor's existing context and event handlers.
  Other dialog consumers have an empty hidden host and keep their old layout.
  Outside a dialog, the same actions stay in normal page/embedded flow.
- The action track has its own bounded overflow for extreme viewports.
  Its dialog body uses 8px scroll clearance rather than the old 88/96px
  sticky-footer exclusion. The latter made a focused field partially invisible
  at actual 200% tab zoom despite correct footer geometry.

No account/schedule data, backend policy, booking behavior, saved-draft,
day-override, permission, stale-write, retry or unsaved-change contract changed.

## Paired evidence

Before editing, the two Sunday sessions (09:00–13:00 and 19:00–22:00) were
rendered with fictional long doctor/clinic/location names, inherited source and
closed clinic hours. Actual application styles include `form-standard.css`,
`compact-ui.css` and Tailwind scanning of the app sources. These are controlled
fictional recreations of the reference state, not the supplied person's data
or pixel-identical images of UAT. Both sides use the same viewport, scale,
fonts, data and 24-hour display format.

`generated-artifacts/schedule-compact/before-{1024,1366}.{png,json}` preserves
the untouched-source baseline. `after-*` records the refined layout.

| Measurement | 1024×640 before → after | 1366×768 before → after |
|---|---|---|
| Editor + action subtree height | 787.56 → 645.28px | 787.56 → 645.28px |
| Scroll-body extent | 812 → 629px | 812 → 629px |
| New separate action track | none → 57px | none → 57px |
| Start / end width | 342 / 342 → 160 / 160px | 362 / 362 → 160 / 160px |
| Footer bottom / visible dialog bottom | 861.76 / 627.20 → 618.20 / 627.20px | 879.68 / 737.27 → 728.27 / 737.27px |

The action subtree measurement sums the editor and relocated footer, excluding
the dialog track's padding. Counting that track too, the combined scroll-content
and action extent is 812 → 686px. The dialog itself remains viewport-bounded;
this is measured content reduction for this fixture, **not** a promised fixed
height reduction for every schedule. At short heights the body still scrolls.

To record a new baseline, use untouched source and
`SCHEDULE_BASELINE=1 pnpm exec playwright test availability-editor.spec.ts
--config artifacts/clinicflow/workspace-regression/playwright.config.ts
--project=workspace -g 'compact layout paired'`.
Do not overwrite a baseline from the candidate source. Normal runs compare
against the recorded measurements and capture candidate images.

## Coverage

The schedule browser suite uses fictional, fully intercepted APIs. It asserts
the `/api/me` role contract via the fixture and verifies distinct doctor/admin
scopes; it is not proof of authentication as a real clinic user.

| Area | Observed checks |
|---|---|
| Shared entries | Schedule page, staff doctor-context dialog, Edit Schedule dialog; Superadmin, Clinic Admin, Doctor; receptionist inherited fields locked |
| Responsive | 390×844, 768×900, 1024×640, 1366×768, 1920×1080, 512×320 for all three entries |
| Geometry | Real field/button border edges; equal content-width times; disclosure start alignment; actual child and text bounds; complete footer buttons and readable label sizes; last advanced input focus clear of header/footer |
| States | Zero/one/multiple sessions; day off; inherited/custom/closed/not-configured; long and unbroken names; copy menu edge clamp; advanced settings; hidden-day errors; separate session-count/outside-hours warnings; immediate warning renumbering/removal |
| Draft behavior | Copy day/slot confirmation, retained settings and independent session ownership, dirty dismissal, busy guards, save/cancel, failed/partial saves, stale retry identifiers, custom day off and linked-day confirmation |
| Secondary actions | Date Exceptions through all entries, nested dirty confirmation and focus return; authorized Delete Schedule |

The text-bound audit excludes intentionally visually hidden ARIA descriptions,
not visible explanations or warnings. Footer action locators follow the actual
owning dialog/inline footer, not a page-wide selector that could accidentally
find an underlying page editor.

### Native browser zoom, separately from reflow

`node scripts/schedule-zoom-evidence.mjs` runs against the isolated workspace
fixture server, with intercepted GETs only. Start it with
`pnpm --dir artifacts/clinicflow exec vite --config workspace-regression/vite.config.ts`.

Chromium's `chrome.tabs.setZoom(2)` reported 2. The physical browser window
remained 1024px wide; CSS viewport changed 1024×553 → 512×276 and
devicePixelRatio 1 → 2. All three entries passed field/header/footer clearance,
readable action sizes and document containment. Page actions stayed static and
scroll-reachable. Native-zoom PNGs use CDP's physical surface capture, because
the CSS-viewport screenshot path returned blank images at native tab zoom.
Evidence: `generated-artifacts/schedule-compact/native-zoom/`.

512×320 and 720×500 Playwright cases remain **reflow emulation**, not native zoom.

## Commands and results

- `pnpm --filter @workspace/clinicflow test:weekly-drafts`: **30 passed**.
- `node --test artifacts/api-server/src/schedule-day-overrides.test.mjs
  artifacts/clinicflow/src/lib/schedule-editor.test.mjs`: **23 passed**, using
  disposable PostgreSQL, not application data.
- `pnpm run typecheck:libs` and `pnpm --filter @workspace/clinicflow typecheck`:
  passed.
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`: passed;
  existing large-chunk advisory remains.
- `node scripts/compact-ui-inventory.mjs` and `--check`: source ledger refreshed.
- Initial combined browser run was stopped at the shell's five-minute limit.
  It exposed relocated-action fixture locators, visually hidden description
  sampling, and the real Add-button alignment issue. These were corrected
  without relaxing geometry thresholds. The focused correction run passed
  **33/33**. Final full run:
  `pnpm exec playwright test availability-editor.spec.ts doctor-context.spec.ts
  --config artifacts/clinicflow/workspace-regression/playwright.config.ts
  --project=workspace --project=doctor-context`: **92/92 passed (4.4 minutes)**.
  The final opt-in action-group layout and native-zoom scroll-clearance fix are
  included. Fixture console resource errors are deliberately blocked web fonts;
  no application page exception was observed.
- Native browser zoom: all three entries passed after correcting the obsolete
  sticky-footer exclusion; before/after geometry retained.
- Managed frontend and API workflows restarted cleanly. The real signed-out
  Preview rendered without browser errors. No live sign-in was performed.

## Limits

No UAT/production writes, real schedule changes, notifications, deployment,
table/export/PDF changes or unrelated test repairs. Safari/Firefox, screen
readers, OS autofill, actual mobile virtual keyboards and every possible
custom-role configuration were not independently exercised. Existing separate
cross-browser/screen-reader follow-ups are not marked complete by this work.
