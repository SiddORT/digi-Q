# Compact UI coverage and evidence

## Shared schedule editor density

See [compact schedule layout evidence](../verification/schedule-compact-layout.md)
for paired two-slot desktop/short-height measurements, shared page/doctor/dialog
coverage, fictional role boundaries, native Chromium tab zoom versus reflow,
footer and focused-field clearance, commands/results and explicit limitations.
The source inventory was regenerated; it remains a source ledger, not a claim
of independent browser coverage for every role and route.

## Current all-form presentation pass

See [Forms and popups: current coverage](form-presentation-coverage.md) for the
latest approved reference, page/inline/filter/auth/onboarding scope, source
dispositions, role matrix, actual Chromium zoom, baseline failures and limits.
This supersedes earlier Add Staff ordering/badge constraints and historical
counts below; the older sections remain historical evidence, not current totals.

## How to read this record

For the Clinic heading, Staff toolbar/table and Add Staff alignment checks,
see [Clinic staff layout evidence](clinic-staff-layout-evidence.md). That record
distinguishes measured local baselines, intercepted rendered/payload checks,
the pre-existing typecheck failure, and untested browser/deployment paths.

`surface-inventory.json` is the exhaustive **source** ledger: 79 explicit or
expanded route patterns, 169 TSX files with 1,556 field/action/link/overlay/form
occurrences at the time of this pass. Each occurrence has a state profile,
responsive target profile, source location and attributes. Dynamic hrefs remain
expressions rather than invented destinations. Regenerate after changing JSX.

This is not a claim that 1,556 independently rendered states were browser-tested.
The tables below distinguish shared-family evidence, observed scoped fixtures,
and untested role/route combinations. A route that redirects is not evidence for
the editor at its destination.

## Route and role ledger

All exact paths are expanded in the JSON; `:reference`, slugs, clinic IDs and
query-driven child sections remain separate destination types.

| Route group | Routes / nested destinations accounted for | Family evidence / limits |
|---|---|---|
| Public | `/`, clinic and clinic/location slugs, `#how-it-works`, `#for-clinics`, public header/footer links | Public mobile sign-in screenshot; public header/drawer source audit. All slug-specific populated combinations not independently checked in this pass. |
| Auth | `/sign-in/*?`, `/sign-up/*?`, `/patient-login`, `/demo-login`, `/forgot-password`, `/reset-password`, `/set-password`, `/register-doctor`, `/login`, `/register` | Shared text/email/password/OTP feedback and reveal controls; mobile real sign-in screenshot. Actual sign-in, password recovery and live code delivery were not exercised. |
| Registration / onboarding | `/register-clinic/*?`, `/onboarding`; account/review/verify, clinic, locations, hours, own-doctor, review and completion | Fictional onboarding suite covers save/reload, hours, own-doctor and submission. The emailed-code test has a stale accessible-label expectation; see unresolved checks below. |
| Public booking / scanners | `/scan-qr`, `/check-in`, `/guest-booking`, `/book/:reference`, `/display/:reference`; guest search, visit, patient, review and receipt children | Shared selector/date/phone/address families; no camera/device permission or display-session acceptance claim. Owner-booking recovery is deliberately not rerun. |
| Superadmin / Clinic Admin | `/admin`, dashboard, clinic, clinics, branches, users, staff, patients, masters, appointments, queue, reports, settings, audit, qrs, book, availability, exceptions, profile, demo, templates, communication, permissions, integrations, system-users | Representative fixture suites exercise clinics, locations, staff, patients, appointments, schedules, users, roles and permission editors. Platform-only screens are source-accounted; not every nested tab was independently rechecked. No real privileged session was used. |
| Clinic child links | `/admin/clinics/:clinicId/:section?`, `/admin/doctors` legacy link, query section/area/returnTo/editor links | Existing navigation/return-state tests, inline/drawer editors and source href ledger. One expected empty-state text is outdated; no destination was changed for this UI work. |
| Doctor / consulting owner | `/doctor`, dashboard, profile, clinics, branches, availability, exceptions, appointments, queue, patients, qrs, book, users, settings | Scoped doctor/navigation cases and consulting-owner onboarding fixtures; shares the repaired form/shell primitives. Independently authenticated doctor and owner routes are not claimed. |
| Reception / custom role | `/receptionist`, dashboard, appointments, queue, patients, book, qrs, availability, exceptions, profile, settings; custom-role restrictions and mappings | User-administration fixtures check custom-role drafts, permissions, restrictions and account actions. Full scoped reception journey is not independently verified here. |
| Patient | `/patient`, dashboard, book, appointments, queue, profile, settings | Shared form and public control-family geometry; no authenticated patient journey was exercised in this pass. |

## Shared shell, navigation and child-surface checklist

| Family | Implementation / applicable states | Evidence |
|---|---|---|
| Workspace shell/header | compact header and breadcrumb, full/collapsed sidebar, current/hover/pressed/focus/long labels, mobile nav | Real stylesheet fixtures at required widths; initial screenshots show long labels contained. Collapsed rail and mobile navigation source-accounted, not a substitute for role-by-role interactive evidence. |
| Profile / scope / row menu | aligned row/icon sizing, viewport-bounded scroll, keyboard, Escape/focus return, outside pointer including touch | Shared fixture exercises menu bounds after feedback checks; touch outside listener uses pointer events. |
| Dialog / drawer / nested editor | shared field geometry, internal scroll, sticky action exclusion, Escape/focus return, busy/dirty guards | Shared fixture and representative workspace/users suites. Failed/blocked assertions remain listed below rather than counted as passes. |
| Page headers / cards / tabs / pagination | compact spacing, wrapping, current vs pressed, no hover border-width changes | Shared CSS and source ledger; representative clinic/roles/listing fixtures. Table columns and export layout not changed. |
| Links / breadcrumbs | hover underline outside button/navigation families, focus, visited text links, preserved hrefs | Source href enumeration and existing navigation tests. Browser visited-history/external-link behavior is not exhaustively tested. |

## Form-family and state checklist

The reusable `compact-ui.spec.ts` imports the actual workspace/dialog components
and full production CSS cascade, with explicit Tailwind application-source
scanning. `compact-geometry.ts` checks child bounds, field bounds and popup edges.

| Family | Applicable coverage |
|---|---|
| Text / email / password / number | empty/populated, long labels, invalid+focused, simultaneous short/long errors, read-only/disabled, reveal and ordinary/touch height |
| Textarea / multiple select | natural multiline growth; deliberately not forced to single-line height |
| Native / searchable select | short/long selection, loading/error/retry simulation, selected labels and clear actions; existing readiness/names suites remain the source for data-loading behavior |
| Date / time | shared typed field plus dedicated picker controls and anchored overlays; picker cells retain their intentional family |
| Phone / address | compound country/number and address fields measured inside the actual responsive grid |
| OTP / file | OTP numeric/autocomplete shape; selected long filename browser verification. Upload progress/retry is N/A for native file selection without an upload operation |
| Checkbox / radio / switch | native and shared primitive geometry, checked/unchecked/disabled, workspace/dialog track/thumb protection; indeterminate applies only to supported checkbox consumers |
| Feedback | persistent field/summary feedback, four semantic palettes, wrapping, contrast, icon sizing, invalid focus without geometry changes |
| Help / full-value / library tooltip | measured clipping, no short-value bubble, cross-family dismissal, focus, Escape, desktop pointer travel, real touch toggle/outside and settled no-reopen |
| Submitting / success / dirty | existing users/onboarding/workspace fixtures; no live messages or account changes |

## Recorded verification

- `pnpm run typecheck:libs` then
  `pnpm --filter @workspace/clinicflow typecheck`: passed. The first leaf-only
  typecheck saw stale built shared declarations; no API contract was changed.
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`: passed;
  existing large-chunk advisory remains.
- `node scripts/compact-ui-inventory.mjs --check`: freshness gate.
- Initial compact browser pass: 2/8 passed; six cases were blocked by animation
  timing / FileList comparison in the test, not silently counted.
- Representative workspace/onboarding/users pass: 40/46 passed.
- Targeted follow-up: switch settling passed at all five widths; contrast,
  reduced motion, selected filename and 200% reflow passed. Touch-help obstruction
  was fixed and its existing workspace regression passed.
- Remaining geometry verification is recorded in
  `generated-artifacts/compact-ui/browser-report.md` and the final addendum below.

## Before/after and known limitations

The compact suite temporarily disables only the new final stylesheet to measure
the legacy real-cascade switch defect, captures `switch-before.png`, restores it
and captures `switch-after.png`. JSON attachments include the actual boxes.
This is a controlled cascade comparison, not an image of a historical live app.
Generated images/traces live under `generated-artifacts/compact-ui/` (ignored by
Git/deployment); initial inspected screenshots are `mobile-390x844.png` and
`short-laptop-1024x640.png`. The latter exposed wrapped-label misalignment, which
was corrected with shared label/control/message subgrid tracks.

The broader suite has five unresolved fixture expectations after the touch fix:
the old “Code Emailed” label, old direct-clinic empty text, a Staff header that now
exposes a select, and two outdated Staff Type drawer triggers. These are not
evidence that the corresponding journeys passed. They overlap the existing
shared-form/booking-fixture maintenance work and are not fixed by changing
production labels, dropdown contracts or navigation in this visual task.

No production/UAT writes, live mail/SMS, stored permissions, bookings, validation
rules, exported PDF/ticket geometry, table-column redesign or standalone artifacts
were changed. No claim is made for Safari/Firefox, actual browser autofill,
screen readers, camera permissions, a real authenticated role or a route/state
combination not explicitly represented above.

## Final targeted geometry addendum

`pnpm exec playwright test --config
artifacts/clinicflow/workspace-regression/playwright.config.ts --project compact-ui
-g 'compact field'`: **5/5 passed** after reconciling the legacy `!important`
invalid border and waiting for actual CSS transitions/overlay positioning to
settle. Each case reached its dialog, drawer, footer and menu assertions.
The strict geometry and color expectations were retained, not removed.

Together with the two initially passed tooltip/touch cases and the subsequently
passed contrast/reduced-motion/upload/zoom case, all eight new compact cases have
passed. This is combined targeted evidence, not a claim that the original failed
run passed. The existing clinic-help touch regression passed separately.
Five broader fixture expectations remain unresolved as listed above.

## Behavior-preserving legacy control cleanup

Acceptance authority remains `compact-ui.md`. The declaration-by-declaration
retirement ledger, retained exceptions and reproducible paired-evidence commands
are in `control-cascade-retirement.md`.

- Captured the original full-cascade baseline before editing the five shared
  stylesheets. `node scripts/control-cascade-evidence.mjs record`, followed by
  `node scripts/control-cascade-evidence.mjs compare` against the candidate:
  **54 viewport/state profiles, 19,410 element samples, zero final differences**
  in rectangles and 30 computed properties on elements and pseudo-elements.
  The initial comparison identified active screen-only padding; it was retained,
  not replaced with an override. The original baseline was preserved.
- `pnpm run typecheck:libs` and
  `pnpm --filter @workspace/clinicflow typecheck`: **passed**.
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`: **passed**
  on final CSS; existing large-JavaScript-chunk advisory remains.
- `node scripts/compact-ui-inventory.mjs --check`: **passed**; no JSX, routes or
  links changed, so the source inventory did not need regeneration.
- `pnpm exec playwright test --config
  artifacts/clinicflow/workspace-regression/playwright.config.ts --project
  compact-ui --project doctor-context`: **28/28 passed** (8 compact family
  cases, including touch/zoom/focus/feedback, and 20 scoped scheduling cases).
  Clinic Admin fixed-group and Doctor own-scope fixtures are fictional
  intercepted identities, not independently authenticated-role evidence.
- `pnpm exec playwright test --config
  artifacts/clinicflow/ticket-regression/playwright.config.ts tickets.spec.ts`:
  **34/34 passed**, including downloaded PDFs, printed documents, QR contents,
  long Unicode values, bulk all-or-nothing output and per-clinic preferences.
- Signed-out 390×844 app screenshot inspected. The first capture's API 502s
  came from the backend workflow not being started; after starting it, the
  preview auth-status endpoint returned **200** and both services ran cleanly.

Evidence is saved under `generated-artifacts/control-cascade/` and the existing
suite result directories, all ignored by Git/deployment. No production/UAT
writes, live notifications, branding/navigation changes or export redesign were
made. Earlier broader-fixture limitations and untested browser/role/route
combinations above remain limitations; this cleanup does not mark them passed.

### Completion-check fixture correction

The first full `pnpm test:tickets` completion run passed **102/103** cases.
The notification-management Superadmin density assertion failed at **240.375px**
against a strict `<240px` limit. Running that same case on an ignored archive of
the untouched original frontend reproduced the **same 240.375px** result
(Clinic Admin also retained its original 240.765625px position). Waiting for
fonts/viewport alone did not change it. No production spacing was changed.

The fixture now sets the viewport before mounting, waits for fonts and permits
**0.5 CSS pixel** at the original header-position limit. Its 44–48px header-height,
switch shape, enabled state and contained-thumb assertions are unchanged.
This is a fractional-pixel fixture correction supported by original-source
evidence, not acceptance of a geometry regression.

### Staff account unification (task 239, frontend)

Inventory regenerated with `node scripts/compact-ui-inventory.mjs` (source inventory only).
Run: `node --test src/staff-account.test.mjs src/staff-input.test.mjs src/staff-controls.test.mjs` (19 passing) and `tsc --noEmit`.
Changed surfaces: Add Staff (create fields, no create tabs/inherited panel), admin onboarding
password fields, Profile contact verification, first-login prompt.
Fictional browser fixtures verified doctor/receptionist password mismatch focus,
blocked invalid writes, valid create payloads with credentials/request identity,
fixed clinic/location context, password-ready status without setup/resend, and
password absence from browser storage. Separate explicit email/SMS requests,
cooldown-disabled resend, confirmations, Verified states, deferral and Profile
access were exercised; no automatic OTP request occurred.

Two rendered defects were found and corrected: the sidebar-free admin form had
occupied the public wizard's 240px sidebar column, and uncontrolled password
inputs did not update their checklist. `node scripts/staff-account-layout-snapshot.mjs`
confirms the fixes: admin widths 880/880/706.56/366px at viewports
1366/1024/768/390px, no document overflow, all three password requirements update
then clear, and no password enters storage. Narrow context includes touch support.
Screenshots and geometry are generated under `generated-artifacts/staff-accounts/`.

No shared control family was replaced, no retired selector was restored and no
global override was added. The only registration layout rule is scoped to the
admin single-page modifier; the public sidebar wizard remains unchanged.
Clinic Details shell/section structure and Notifications presentation were not
modified outside the explicitly added staff functionality and event metadata.

**Evidence limits:** browser roles and requests were fictional/intercepted, not
real staff authentication. The admin empty-draft validation was exercised, while
its successful account/clinic/consulting-owner save was proved at the real API
against a disposable database rather than by completing the whole browser form.
200% zoom, full keyboard/touch traversal, arbitrary long-label permutations and
an independent rendered comparison of unchanged Clinic Details/Notifications
were not exhaustively repeated. Existing merged semantic-control acceptance
checks remain the baseline. No UAT deployment or live delivery is implied.

## Add Staff reference layout

New doctor/receptionist forms reuse the existing account fields, sections,
assignment lookups, dialog and footer. Account Details and Work Assignment remain
visible together; the role control belongs to assignments. Clinic-admin
onboarding and existing-record editing retain their distinct requirements.
Verification badges are passive create-time indicators, not delivery actions.

Verification:
- Shared-library and frontend typechecks passed.
- Production build passed with the configured artifact port/base path; existing
  large-chunk advisory remains.
- Users administration plus staff toolbar fixture suites: 11 passed. After
  correcting the portalled activation switch's shared CSS scope, the three
  changed popup cases passed again.
- Five staff role-switch checks passed; outdated source assertions now reflect
  the existing password-redacted snapshots, lookup primitives and save callbacks.
- Responsive create forms checked at 390, 768, 1024 and 1366px, including paired
  fields, horizontal control containment and reachable submit buttons.
- Empty-submit email accessibility/error associations and visible activation
  switch checked. Inventory freshness passed.
- Popup screenshots: `generated-artifacts/staff-popup/`. The restarted actual
  Preview sign-in page rendered without browser errors.

These are fictional/intercepted role checks, not authentication as the supplied
clinic administrator. No real staff creation, provider delivery, UAT verification,
200% zoom or exhaustive keyboard/touch traversal is claimed.

### Staff popup density refinement

The create-time status control now uses the existing Account Details section's
header actions slot, with the same single controller and confirmation behavior.
Create-only row/section spacing is reduced; shared field heights and edit layouts
are unchanged. Header/toggle alignment and containment passed at 390, 768, 1024
and 1366px for doctor and receptionist forms. Empty validation and cancelling
deactivation passed in the focused popup fixture. Frontend typecheck, production
build and inventory freshness passed. Updated fictional screenshots remain in
`generated-artifacts/staff-popup/`; no real-account save or UAT verification.

### Add Staff creation hierarchy and assignment help

This supersedes the earlier creation-only Account Details / Work Assignment
ordering above. Doctor and receptionist creation now displays **Role & Locations**
before **Staff Details** in DOM and visual order. Existing edit panels retain their
ordering, tabs and status control; separate Clinic Admin onboarding is unchanged.
The fixed clinic shows its full saved name in a wrapping read-only value.
Optional clinic/location explanations use adjacent shared information help.
Same-admin restrictions, location prerequisites, required-location instructions,
errors and load/retry states remain visible.

Verification:

- `pnpm run typecheck:libs` and
  `pnpm --filter @workspace/clinicflow typecheck`: passed.
- `node --test artifacts/clinicflow/src/staff-account.test.mjs
  artifacts/clinicflow/src/staff-input.test.mjs
  artifacts/clinicflow/src/staff-controls.test.mjs
  artifacts/clinicflow/src/lib/staff-role-switch.test.mjs`: **25/25 passed**.
  The first run exposed two obsolete literal-label source assertions; these now
  check the conditional edit labels and adjacent creation-label wiring.
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`: passed on
  final CSS, with the existing large-chunk advisory.
- `node scripts/compact-ui-inventory.mjs` and its `--check` freshness gate: passed.
- Fictional browser pass:
  `pnpm exec playwright test users-administration.spec.ts
  staff-type-toolbar.spec.ts --config
  artifacts/clinicflow/workspace-regression/playwright.config.ts
  --project users-administration --project workspace`: **9/12 passed initially**.
  The fixed long-clinic/help/reflow case and existing role switching, dirty/edit
  guards and staff toolbar cases passed. Three popup cases stopped at alignment
  assertions: role/clinic control offset and heading/Active-switch centering.
  These failures are not recorded as suite passes.
- After correcting only creation-scoped label tracks and the status wrapper's
  inline line-box gap, focused rendered measurements passed for both creation
  roles at 390×768, 768×768, 1024×640, 1366×768 and 512×320. At desktop widths,
  all three assignment controls had identical top coordinates. Heading/switch
  center difference was **0.008px**; no dialog horizontal overflow was measured.
  Footer access and screenshots were checked in each profile. The full browser
  suite was not repeated after these straightforward CSS corrections.
- Actual keyboard Tab traversal in the fixed-clinic creation dialog reached Role,
  clinic/location help and Locations before Active, Full Name and Email. Evidence:
  `generated-artifacts/staff-popup/keyboard-order.json`.
- Shared help passed hover, focus, Escape without closing the dialog, touch
  toggle, replacement by another help trigger and settled outside dismissal.
  Long unbroken clinic names, required-field errors and footer visibility were
  checked. Final popup screenshots and measurements:
  `generated-artifacts/staff-popup/final-*.png` and `final-geometry.json`.
  The actual signed-out Preview also rendered cleanly after workflow restart.

Limits: these are fictional/intercepted roles, not authenticated staff evidence.
512×320 is the 200% browser-reflow equivalent of 1024×640, not an actual
browser-menu zoom check. Screen readers, Safari/Firefox, real device keyboards,
all load-error/retry permutations and a successful real-account save were not
independently exercised. Backend/authorization, password handling, save behavior,
shared HelpTip, exports and Clinic Admin onboarding were not changed.
No real accounts, live messages, UAT or production deployment were involved.

The separately reusable future-pass prompt is
[`popup-form-refinement-prompt.md`](popup-form-refinement-prompt.md). It does not
authorize an app-wide redesign.
