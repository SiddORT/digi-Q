# Forms and popups: current presentation coverage

This record supersedes the older assignment-first Add Staff and helper-only
verification-badge guidance. The selected reference is
`attached_assets/image_1792951103973.png`. The later diagnostic screenshot calls
out alignment and wasted height; it does not reverse Account Details-first order.
Existing DigiQ colours, typography and 32/40/44px control families are retained.

## Source reconciliation and disposition

Regenerate with `node scripts/compact-ui-inventory.mjs`; verify with `--check`.
The schema-3 ledger contains 79 route patterns, 169 TSX source files and 1,556
tag occurrences: 324 field, 583 action, 148 form/section, 291 overlay,
97 navigation and 113 link occurrences. These categories describe source, not
independent rendered screens.

There are 29 native `<form>` placements, 60 `AppDialog`/`ConfirmDialog`
placements, seven lower-level dialog primitive definitions/calls, and four
explicitly named ancillary panel placements (notifications, row actions, profile
menu and visit range). Location and date/time panels are additionally captured
by semantic dialog roles; searchable controls and popup primitives are captured
by component tags. The previous 83-dialog/seven-panel estimates used a different
matching scheme. They are not carried forward as either an acceptance total or
a runtime count. Wrapper, definition and caller can all describe one UI surface.

Every ledger occurrence includes its enclosing definition, shared presentation
owner/disposition, state/responsive profiles and a warning that conditional
runtime reachability is not inferred. Import traversal from the production
entry statically reaches 152 of these modules; 17 retained primitive modules
are not statically reached. The latter remain in the ledger without pretending
they are live workflows. Static imports do not prove a permitted role can
render a particular branch or linked destination.

### Consumer families

The JSON is the per-placement record; this table describes the treatment of
all consumer groups, including those intentionally retaining existing markup.

| Consumers / source entrypoints | Disposition and presentation owner |
|---|---|
| `Users`, `StaffAccountFields`, `StaffContactVerification`, `PasswordInput`, `PhoneInput` | Account Details → Work Assignment on creation; existing edit tabs retained. Paired inputs remain equal width; passive badges share the label row with an accessible description. Mobile spans the account row. Shared field/subgrid and phone/password rules, not separate screen inputs. |
| `resources`, `clinic`, `ClinicSettings`, `LocationDetails`, `DoctorEditor` | Existing page, inline, resource editor and drawer contracts retained. Shared native-control/field/section rules; doctor phone width and height tokens reconciled with shared controls. No ownership or saved-scope changes. |
| `Profile`, `PatientDetails`, `ExactRecordDrawer`, read-only form values | Existing read-only/edit distinctions retained. Label metrics and verification rows use shared presentation; long read-only text wraps. No conversion of data drawers into creation forms. |
| `StaffLogin`, `PatientLogin`, `PasswordFlows`, `DemoLogin` | Auth ancestry included in compound-control sizing; password reveal uses the input's actual height. Existing password/OTP and delivery flows retained. |
| `ClinicRegistration`, `ClinicRegistrationWizard`, onboarding location/hours/review | Registration ancestry uses the same compound sizing and labels; existing steps, readiness instructions and recovery metadata unchanged. Staff-specific order is not applied to this wizard. |
| `Booking`, `GuestBooking`, `BookingDiscovery`, `BookingVisitSelector`, public booking/QR destinations | Existing page forms/selectors inherit shared field and popup rules. Private/public intent and session-readiness rules remain distinct. No booking-state or ticket-output changes. |
| `Availability`, `AvailabilityEditor`, weekly hours/day rows and `HoursOverrideEditor` | Existing tabs and row geometry retained; shared inputs, dropdowns, help and actions. No hidden-tab validation, capacity or scheduling-policy changes. |
| `CheckIn`, queue `DurationEditor`, appointment rows/movement/reschedule/receipts and details | Inline controls and appropriate dialogs retain workflow-specific sections. Shared compact controls/footer geometry; scanner, ticket and PDF contents excluded. |
| `CommunicationUsage`, `NotificationLogs`, `EmailTemplates`, `NotificationSmsSettings`, email/SMS providers, `IntegrationEditor`, connection checks | Shared page filters, FormField and dialog conventions. Integration credentials now reuse FormField rather than manual labels. Visible gate warnings, disabled/read-only values, secrets and save/test semantics retained. No provider sends or live connection tests. |
| `ReportsDashboard`, `FilterBar`, `SearchInput`, `ListingControls`, `SavedViews`, column controls | Shared compact filter/button/native/searchable control families. Existing report custom-range and advanced-filter geometry retained; no report/table/navigation redesign. |
| `AppDialog`, `ConfirmDialog`, `FormSection`, `FormField`, `FormActions`, `FormDisclosure` and all callers | Existing focus, scroll, dirty/discard and footer lifecycle retained. Modal sections use restrained dividers; page sections and read-only drawers keep their appropriate boundaries. |
| `SearchableSelect`, `SearchableMultiSelect`, native multiple selects, address, OTP, upload, check/radio/switch | Empty single-line controls share the height floor; chip/multiline/file controls grow. Composed controls no longer receive both internal label gaps and legacy native top margins. Address and short-code controls retain content-specific widths. |
| `DateFormatInput`, `DateRangeInput`, `LocationMenu`, `VisitRangePicker`, row/profile menus, notifications, responsive action disclosure and workspace search | Anchored/command panels retain anchoring, stacking and dismissal, rather than receiving modal geometry. Shared compact typography/target families remain the owner. Existing date/time portal ancestry is preserved. |
| Unreached `components/ui` primitives | Retained, not deleted or advertised as rendered coverage. Their source entries remain explicitly distinguished from production-module consumers. |

## Rendered evidence matrix

All staff identities, records, persistence and provider responses below are
fictional/intercepted. No real sign-in, account write, live delivery, deployment
or UAT mutation was performed. Identity assertions use `/api/me` and the actual
App route, not merely a fixture role query string.

| Family / roles | Rendered checks and result |
|---|---|
| Shared field/overlay fixture | Nine checks passed: five viewport geometries; long multi-select chips with remove/Enter/Escape/focus return; help families; real browser touch events; contrast/reduced-motion/upload/disabled/read-only/reflow. Actual date/time/address components are included. |
| Staff administration / Superadmin and Clinic Admin | Eleven Users checks, three Clinic Staff checks and one Staff Type toolbar check passed. Selected section/DOM order, paired edges/widths, full mobile row, associated badges, long chips/errors, selector interaction, discard/conflict/dirty/busy and intercepted create/edit payload invariants are covered. |
| Actual profile routes / Superadmin, Clinic Admin, doctor, receptionist, patient, limited custom receptionist | Six checks passed, each at 390×844, 768×900, 1024×640 and 1920×1080. Correct actor identity/value, permitted editable profile, visible-control bounds/heights and no unexpected API calls/writes or browser errors are asserted. This does not simulate a real login or prove all custom permission combinations. |
| Standalone staff/patient login, forgot/set password | Four checks passed over mobile, laptop and short/reflow widths. Bounds and password reveal edges/behaviour checked. Optional reveal-height transitions are allowed to settle before measuring. No submit, OTP send or password change. |
| Scheduling / Superadmin, Clinic Admin, doctor | Ten checks passed: three roles' tab/save/reopen flows; hidden capacity/break/queue errors; failed-save/discard lifecycle; busy dismissal guard; four phone/tablet/laptop/desktop role-layout cases. All writes intercepted. |
| Onboarding / fictional signed-out applicant | Two checks passed: save/reload/review/complete/reconcile flow and hours-copy/linked-versus-custom owner schedule flow. No real registration. |
| Notifications / Superadmin, Clinic Admin and ordinary-role denial | Five checks passed: keyboard disclosure; non-editable ordinary roles; essential gate warnings; draft failure/conflict/discard; loading/error/retry/empty/no-match states. All APIs intercepted. |
| Chromium actual browser zoom | `scripts/form-zoom-evidence.mjs` passed. Browser `chrome.tabs.setZoom(2)` reported 2; physical window stayed 1024px wide, CSS viewport changed 1024→512px and devicePixelRatio 1→2. All visible staff inputs and the final action were scrolled into reach. This is browser tab zoom, not CSS zoom, pinch zoom or only viewport emulation. |
| Public Preview | Actual app `/sign-in` at 390×844 rendered without browser error; no authentication attempted. |

Total: **51 distinct rendered regression checks passed**, plus the separate
actual-browser-zoom and twelve-profile before/after evidence captures.
The 512×320 automated viewport cases remain labelled **reflow**, not actual zoom.
The separately assigned Safari/Firefox Add Staff zoom work is not repeated or
claimed here.

### Evidence files and reproduction

- `scripts/form-presentation-evidence.mjs before|after` writes twelve
  screenshots plus geometry to `generated-artifacts/form-presentation/<phase>/`.
- The **before** captures run archived, untouched source with workspace library,
  dependency and TypeScript-reference context, not the modified application.
- `scripts/form-zoom-evidence.mjs` writes browser-reported zoom/geometry and a
  screenshot under `generated-artifacts/form-presentation/browser-zoom/`.
- Role profile and auth screenshots are emitted by
  `workspace-regression/tests/form-presentation.spec.ts`.
- Generated outputs are ignored; scripts and assertions, not large PNGs or
  archived application copies, are the durable reproducible record.

At 1366×768 the original headings were Role & Locations / Staff Details; the
candidate headings are Account Details / Work Assignment. Both paired input
families retain 40px actual input height (44px in touch/mobile families). The
mobile compound row is no longer restricted to one half of the account grid,
and passive badges no longer consume a helper row. Screenshots and geometry
record the actual application cascade rather than an isolated component mockup.

## Baseline failures and verification limits

The six existing `booking-discovery.spec.ts` role cases stop at a stale wording
assertion: they expect “Other weekdays or dates may have sessions”, while the
unchanged production source says “Other dates may have sessions” in adjacent
help. The same wording is present in untouched source. These cases are recorded
as baseline failures, not presented as passes or silently weakened. Later
interactions in those six cases therefore remain unverified here.

New regression fixture issues were fixed, not treated as product bugs: an
uncontrolled input's current value must be checked as a property, actual App
branding/clinic requests need explicit fixture responses, and animated heights
must settle after resizing. The original half-row/mobile and helper-only status
assertions were superseded by the approved layout, with strict new width,
association and edge assertions.

The full route × role × conditional-state Cartesian product is **not** browser
tested. Reports, provider credential editors, appointment movement/receipt
variants, public slug-specific populated variants and scanner/camera paths have
source/shared-family presentation coverage but no dedicated end-to-end acceptance
in this pass. Actual server authorization, persistence, live account identity,
real emails/SMS, physical mobile keyboards, screen-reader output and Safari/
Firefox zoom are not claimed. None of these limits changes app permissions or
permits live testing.

Frontend typecheck, production build, inventory freshness and all 25 staff
unit checks passed. The build retains its existing large-JS-chunk advisory.
The historical Vite peer-type failure recorded in earlier evidence did not
reproduce in this environment; dependencies/configuration were not changed.
