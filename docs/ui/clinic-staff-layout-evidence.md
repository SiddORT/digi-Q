# Clinic workspace and Add Staff alignment evidence

## Latest selected-reference update

The current Add Staff layout is Account Details **before** Work Assignment in
visual and keyboard order, with equal paired controls, a full-row compound
mobile control and associated status badges beside labels. The previous
half-grid mobile/helper-only badge assumptions below are historical, not current
acceptance requirements. See [current all-form evidence](form-presentation-coverage.md)
for the refreshed inventory, before/after captures, passing role checks, actual
Chromium 200% zoom and remaining browser/route limits. The earlier Vite peer-type
failure below did not reproduce in this environment; no dependencies were changed.

## Scope and limits

Local Chromium checks use fictional intercepted records, never live staff or
clinic data. All `/api/` traffic is fulfilled by the fixture. The successful
create/edit check captures fictional payloads and supplies fictional responses;
it does not write to any API server. No messages, deployment, UAT changes, or
actual staff creation occurred.

The supplied UAT screenshots are visual references, not computed-style evidence.
The isolated harness uses the application's final CSS import order and actual
ClinicSettings, Users, field and dialog components, but not a live signed-in
workspace session. The source shell explicitly delegates the Clinic heading to
ClinicSettings; the fixture follows the same ownership rule.

Actual Safari/Firefox browser zoom remains separate, already active work.
512×320 below is the CSS-viewport reflow equivalent of a 1024×640 display at
200%, **not** evidence of actual browser zoom or either browser engine.

## Measured cause and changes

- Before editing, the local desktop Account Status column measured **110px**,
  while its nowrap header's scroll width was **113px**. At 768px, the status
  cell extended to x=645 while the right-sticky Actions cell started at x=619:
  a measured **26px overlap**. This is local evidence, not a claim about UAT's
  exact font metrics. The staff table now has a 168px status floor and ordinary
  internal horizontal scrolling; its Actions column is not horizontally sticky.
- Staff Type's actual trigger was roughly 12px below search at desktop, because
  the toolbar centred the complete stacked label/control group. The label is now
  inline and the actual controls use the existing compact 32px or touch 44px
  family. Toolbar wrapping is intentional when the available workspace is narrow.
- At 1440px, Full Name was **374px** wide but Email was about **255px** wide.
  The verification badge previously consumed the remainder of Email's flex row.
  Both inputs now measure **374px**. Password/Confirm Password use the same
  column edges and widths. Passive statuses remain visible, connected through
  `aria-describedby`, without taking input width.
- The complete mobile interaction uses the left account column's width rather
  than a separate arbitrary maximum width. Country and number value boxes align.
  Measurements also caught a touch clear button enlarging its parent by 14px;
  scoped padding/height alignment preserves its touch target without enlarging
  the country or role value row.
- Clinic scope now shares the single Clinic heading. In the fictional fixture,
  the overview top moved from **185.36px to 121.19px** at 1440/1024/768 widths
  (64.17px upward). At 390/512 widths it moved from **207.36px to 166.80px**
  (40.56px upward), with the selector wrapping beneath the heading.

## Rendered coverage

`artifacts/clinicflow/workspace-regression/tests/clinic-staff-layout.spec.ts`
checks:

- 1440×900, 1024×640, 768×768, 390×640 and 512×320;
- one heading/selector, heading-to-card gap, workspace scope versus Staff Type;
- actual search/select/recovery alignment, not their outer group centres;
- status text-range containment and Status/Actions cell bounds at start,
  middle and end of internal horizontal scrolling;
- account input edges/widths, paired rows, country/number heights and alignment,
  assignment row labels/value alignment and text-range containment;
- selecting multiple long location chips, using their actual hit targets,
  validation errors, associated helper/error IDs, and reachable dialog actions;
- permitted scope options, clinic navigation, cancelled/discarded draft editing,
  saved staff assignment hydration and separate Staff Type state;
- fictional successful receptionist create/edit payloads, with credentials on
  create only, while blocking all live writes.

Evidence images and before/after numeric measurements are generated under
`generated-artifacts/clinic-staff-layout/` (ignored build/test output):
`before.json`, `after.json`, `before-{width}.png`, `after-{width}.png`,
`listing-{width}.png`, and `errors-chips-{width}.png`.

Additional passing checks:

- **5/5** focused workspace tests: the new geometry/reflow and scope/discard
  checks, existing Staff Type role/scoped-reset/mobile behavior, Clinic canonical
  sections/keyboard/scoped switching, and Clinic error/responsive layout.
- **4/4** existing Add Staff rendered tests: desktop semantics, doctors and
  receptionists at phone/tablet/laptop widths, and touch/long fixed-clinic/
  help dismissal/error/reflow checks.
- **1/1** additional intercepted successful create/edit test.
- **25/25** staff account, staff input, staff controls and role-switch unit tests.
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build` passed,
  with the existing large-bundle warning.
- Source UI inventory regenerated and `node scripts/compact-ui-inventory.mjs
  --check` passed. The managed frontend workflow restarted and served cleanly;
  the public preview screenshot showed no runtime error.

Two pre-existing test-selector errors were reproduced using untouched source in
an ignored, workspace-linked baseline copy before correcting them: a generated
DOM ID was confused with a data-testid, and `filter({has: ...})` incorrectly
included the outer dialog ancestor in its relative child locator. Those tests
now compare actual DOM node order and use a relative heading query. Existing
geometry thresholds were not loosened.

## Remaining verification limits

`pnpm --filter @workspace/clinicflow typecheck` still reports the same **two
TS2769 errors in vite.config.ts (54 and 55)** on both untouched and changed source.
The installed Vite plugin types resolve through different YAML peer dependency
instances. This task does not change packages, Vite configuration, or backend
code. No new source type errors were reported.

No live account sign-in, backend authorization acceptance, actual staff
persistence, notification delivery, UAT computed-style comparison, deployed
behavior, Safari/Firefox zoom, or physical-device acceptance is claimed here.
