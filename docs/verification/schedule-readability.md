# Schedule readability verification

## Scope

Weekly schedules, date-exception tables and the existing shared day editor.
Clinic opening hours, permissions, whole-location link behavior, day-override
write/retry contracts and notification delivery were not changed.

## Reproduction and changes

- The supplied screenshot's selection/expansion overlap was reproduced against
  current real components: at a 1440px viewport the expansion button ended at
  x=295 while its table cell ended at x=269. Measuring the flex wrapper alone
  would have missed the overflowing button.
- The existing direct inherited-day customization and explicit confirmation
  were already present and were retained, not reimplemented.
- Schedule tables now give colgroup, headers and cells the same lead-column
  constraints. Narrow-table touch targets have a larger reserved column.
  Columns can scroll internally; selection, pinned day and pinned actions remain
  separated during horizontal scrolling.
- Each session summary has a readable queue mode. Shared timezone/time format
  is shown once for a matching doctor/location context; different values and
  non-default queue windows remain in details. Hidden summary columns remain
  accessible through expansion.
- Capacity, token prefix, consultation duration and buffer have distinct labels.
- Weekly ordering happens in the authorized SQL result before pagination,
  grouped by doctor/clinic/location, then Monday–Sunday, session start/end and ID.
  Explicit sorting wins. Exception ordering is unchanged.
- Single-page schedule navigation is omitted without removing count or size.
  Other listings retain their existing pagination defaults.
- Advanced settings identify capacity, breaks and queue settings. Location-hours
  tools and date exceptions have separate disclosures. Day source and actual
  clinic hours remain beside the editor.

## Passing checks

- `pnpm run typecheck:libs`
- `pnpm --filter @workspace/clinicflow typecheck`
- `pnpm --filter @workspace/api-server typecheck`
- `PORT=4173 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`
- API build and startup through the managed API workflow.
- `node --test artifacts/clinicflow/src/lib/schedule-editor.test.mjs artifacts/api-server/src/list-query.test.mjs`
  — 24 passing checks, including real isolated PostgreSQL execution of
  chronological ordering over six pages, deterministic ties, explicit sorting,
  unchanged exception filtering and resource authorization boundaries.
- `pnpm --filter @workspace/clinicflow test:weekly-drafts` — 30 passing checks.
- `node --test artifacts/api-server/src/schedule-day-overrides.test.mjs`
  — 16 passing checks, including permissions, confirmation, stale writes,
  idempotent retries, partial safety and clinic-hours synchronization.
- Browser fixtures: the combined workspace/editor pass had 60 passing cases,
  with the zoom case and four broader workspace failures described below.
  All ten weekly/exception geometry cases at 1440, 1280, 1024, 768 and 390px
  passed, including keyboard expansion/collapse and single-page pagination.
  Normal and inherited/custom editor flows, hidden columns, multi-page URL/Back
  behavior and stale-write/retry checks passed.
- The doctor-context browser project passed all 20 cases.
- The corrected 200% layout-zoom check passed separately, including expanded row,
  open Advanced section, focusable capacity input and bounded dialog.
- Two additional targeted browser checks passed: different per-session queue
  modes without redundant expansions, and hidden columns plus pinned
  day/selection/actions during internal scrolling at 1280, 1024 and 768px.
- `git diff --check`

Browser commands use
`artifacts/clinicflow/workspace-regression/playwright.config.ts`.
Screenshots are generated under `generated-artifacts/schedule-readability/`,
including both list types at all five widths and `zoom-200-editor.png`.
Existing day-editor images are under `generated-artifacts/day-overrides/`.
Generated evidence is not checked into Git.

## Zoom interpretation

Applying CSS `zoom:2` to the document was not an accurate native-browser-zoom
simulation: viewport-height dialog units stayed unscaled and the Advanced
control became unreachable. The corrected layout test uses a 720×500 CSS
viewport with deviceScaleFactor 2, equivalent to the layout and density of a
1440×1000 display at 200% browser zoom. This revealed a real lead-column
touch-target mismatch below 768px; reserving the shared touch-target width
fixed it. Native browser UI zoom in Safari and Firefox was not exercised.

## Other suite failures and limits

Four broader workspace cases did not pass; they were not suppressed or changed:

- Legacy/direct Clinic link expects `Select a clinic to manage its settings.`
  on `/admin/clinic?section=staff`; that text was not found.
- Compact Staff header expects zero selection controls; one remains.
- Compact drawers expect a `Staff Type` button that was not found.
- The combined compact schedule-drawer case later expects the same `Staff Type`
  button and could not find it.

These failures concern Clinic/Staff fixtures and controls outside the scheduling
readability changes. They remain unresolved; the complete shared workspace
suite is not claimed green.

The browser fixtures render real application components with fictional,
intercepted API responses. They are not proof of live authentication or saved
UAT/production data. Hosted staff sessions and Safari/Firefox were not verified.
The ordinary Preview landing page rendered and the managed frontend/API
workflows restarted cleanly. No deployment or live notifications were performed.
