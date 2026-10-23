# Compact UI coverage and evidence

## How to read this record

`surface-inventory.json` is the exhaustive **source** ledger: 79 explicit or
expanded route patterns, 167 TSX files with 1,467 field/action/link/overlay/form
occurrences at the time of this pass. Each occurrence has a state profile,
responsive target profile, source location and attributes. Dynamic hrefs remain
expressions rather than invented destinations. Regenerate after changing JSX.

This is not a claim that 1,467 independently rendered states were browser-tested.
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
