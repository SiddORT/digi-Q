# Dropdown readiness coverage

## Contract and authorization

Readiness means starting a permitted, bounded, unsearched first page when the
owning page/form opens. It does not mean opening a menu, fetching every page,
making an unrelated screen's requests, or choosing the first of several rows.
Existing sole-result defaults still require successful, current cardinality.

Roles below: **S** Super Admin, **A** Clinic Admin, **O** consulting owner,
**D** doctor, **R** receptionist/staff, **C** a custom role based on A/D/R,
**P** patient, **G** guest. A role listed in the inventory means **only where
the existing navigation, capability checks, and actual server scope permit the
screen/control**. It does not grant a role new access. C inherits and narrows its
base role, never broadens it. O retains the Clinic Admin role and its own doctor
profile. Optional all-location filters retain their authorized aggregate scope;
they are not silently converted into mandatory parent selectors.

Existing ResourceLookup/ResourceMultiLookup reads were already eager when
enabled and mounted. Signed-in CareLookup delegates to them. Most editor tabs,
disclosures, and both initial booking stages already stay mounted: these were
not changed to falsely attribute their reads to opening a dropdown.

## System-wide screen/control inventory

Paths are relative to `src/`. `E` = existing eager mounted read; `P` = starts
when a required parent is available; `L` = local/static or data already loaded
by its owning page/form. `R` = newly added readiness observer for closed
filters. All dialog rows start when the dialog/form opens, not before the user
chooses Add/Edit. Closed drawers preload only their declared permitted lookups,
without mounting inputs, hidden dialogs, focus targets, or default callbacks.

| Owner / source | Screens and controls, including forms and filters | Applicable roles | Entry / dependent scope |
|---|---|---|---|
| `components/ResourceLookup.tsx` | Shared single/multi resource and assignment selectors, fixed and disabled saved names | S A O D R C | E/P; bounded 20-row pages, exact saved-ID hydration independent of menu |
| `components/CareLookup.tsx` | Care single selectors, own appointment selector, public-safe care selectors | S A O D R C P G | E/P; public/private keys and endpoints remain distinct |
| `components/SearchableSelect.tsx` | Single selector primitive, optional local or remote paging | All rendered consumers | L; not a network trigger; scope changes reset local search/menu |
| `components/SearchableMultiSelect.tsx` | Multi selector primitive and selected chips | All rendered consumers | L; distinct initial loading/search/loading-more/empty/error |
| `components/ListingControls.tsx` | Advanced filter drawers; quick filters; row count | S A O D R C P | R for resource/care fields; L for static controls; mobile quick filters already mounted |
| `resources.tsx` | Clinics, locations, doctors, patients, users, masters, schedules, exceptions, QRs, audit: listings, filters, add/edit, hidden editor tabs, master suggestions, exception sessions, metadata, address, sort, status | S A O D R C where permitted | E/R/P; assignments and master category included in keys; required context explains prerequisites; optional aggregate filters preserved |
| `Users.tsx` | Staff type/status/sort, doctor/admin/receptionist filters, Add/Edit Staff, role, professional masters, clinic/location multi-assignment, account recovery | S A O D R C where permitted | E/R/P; existing staff tabs stay mounted; saved mappings hydrate separately |
| `clinic.tsx` | Booking clinic/location/doctor/patient; appointment list/calendar filters; reports; profile/assigned-clinic sorts | S A O D R C P | E/R/P; patient care catalogs public-safe; hidden patient stage already mounted |
| `components/ClinicSettings.tsx` | Clinic scope, clinic-details editor, metadata, location editor, source clinic/source location for hours, consulting locations, format/policy editors, embedded staff/audit/QR | S A O | E/P and nested R; source settings loaded on form opening; clinic tabs mount their own page, not all clinics |
| `components/ClinicRegistrationWizard.tsx` | Guided/public onboarding category/specialities, specialization/qualifications, gender, address, formats, owner schedule | S / onboarding A O / G | L from eager registration options and local references; geography P; same public reference payload as before |
| `components/ClinicMetadataFields.tsx` | Standard/custom category and speciality multi-select in clinic details and registration | S A O / registration G | E or supplied eager references; saved labels retained; custom text is not a master ID |
| `components/AddressFields.tsx` | Country, state and city suggestions in all resource/registration/profile forms | S A O D R C P G where form permits | Country L; geography E/P by country/state and public/private mode; actor/scope-aware search reset |
| `components/TimezoneSelect.tsx` | Location/schedule timezone | S A O D R C | L from Intl plus saved/browser timezone |
| `components/PhoneInput.tsx` | Country calling code | All phone-input consumers | L from bundled countries; no remote catalog |
| `components/LinkedScheduleControls.tsx` | Linked owner duration, queue mode and prefix | S A O | L from current form values/options |
| `components/PublicClinicPage.tsx` | Clinic/location landing directory sort and items/page | S A O D R C P G | L; public listing itself E by resolved slug |
| `components/GuestClinicFinder.tsx` | Public clinic → location finder | P G and public visitors | E/P with public catalog; automatic sole bookable result requires complete authority |
| `components/GuestBooking.tsx` | Public booking location → doctor, visit/contact/confirmation | P G and public visitors | E/P; fixed QR context preserved; committed private receipts do not depend on new public label reads |
| `components/appointments/RescheduleAppointment.tsx` | Location and doctor destination, current/saved session | S A O D R C P G with movement/receipt authority | E/P from saved clinic/location; public-safe catalogs for patient/guest; movement eligibility unchanged |
| `components/appointments/VisitRangePicker.tsx` | Visit range | Appointment consumers | L |
| `components/queue/SessionQueue.tsx` | Clinic/location/doctor or own appointment, queue sort | S A O D R C P | E/P; own doctor disabled label still hydrates; queue operations retain permissions |
| `components/queue/SessionSelector.tsx` | Daily session/interval and queue session context | S A O D R C P G via booking | E/P immediately after doctor/location/date; no session option read from menu-open event |
| `components/queue/GuestRequests.tsx` | Request status and sorting | S A O D R C where permitted | L plus owning request list E |
| `components/queue/DurationEditor.tsx` | Expected duration / future-or-running effect dialog | S A O D R C where permitted | L; current duration value loads on dialog opening |
| `components/schedule/DoctorScheduleContext.tsx` | Doctor editor group/location; exceptions panel | S A O D R C where permitted | E/P from freshly verified doctor assignments; saved location details not inferred from stale profile |
| `components/schedule/WeeklyScheduleEditor.tsx` | Session duration and queue mode | S A O D R C where permitted | L from mounted weekly draft |
| `components/schedule/CompactDayEditor.tsx` | Copy day/slot, consultation duration, queue mode | S A O D R C where permitted | L/P from current draft day; no full directory read |
| `components/schedule/FollowLocationHours.tsx` | Custom/follow-hours and queue mode | S A O / permitted schedule readers | L; owner/doctor/clinic eligibility reads E; existing owner-only checks unchanged |
| `components/schedule/WeeklyOverview.tsx` | Session/day selectors | S A O D R C where permitted | L from scoped weekly plan |
| `components/reports/ReportsDashboard.tsx` | Period/type/group/status/metrics; clinic/location/doctor filters | S A O D R C where permitted | L/E/R/P; no new report permissions |
| `components/reports/ReportTrendPanel.tsx` | Trend metric | Report readers | L |
| `components/CommunicationUsage.tsx` | Channel/outcome/event/source/group/attribution/staff and Super Admin clinic filters | S A O where permitted | L from report response; resource clinic R when drawer is closed |
| `components/NotificationLogs.tsx` | Channel/source/event/status/recipient group filters | S A O where permitted | L; log list E |
| `components/EmailTemplates.tsx` | Recipient and event, optional clinic override | S A O where permitted | L/E from owning template query; inherited controls unchanged |
| `components/NotificationTemplatesPage.tsx` | Channel/event/recipient editor selections | S A O where permitted | L/E from owning notification page |
| `components/EventControls.tsx` | Event and notification scope | S A O where permitted | L/E from owning controls query |
| `components/NotificationSmsSettings.tsx` | Legacy provider/mapping/encoding/auth and scope selectors | S / permitted readers | L/E; no credentials or live provider calls added |
| `components/IntegrationSettings.tsx` | Provider/transport/security configuration selections | S / permitted readers | L/E; readiness never sends a test message |
| `components/SmsProviderPanel.tsx` | SMS provider, country format, body encoding and authentication mode | S / permitted readers | L from current private configuration |
| `components/SystemUsers.tsx` | Account status, role and clinic filter; details | S | L/R; clinic catalog starts before drawer opening |
| `components/AccessRules.tsx` | Role and module selectors | S | L/E from eagerly loaded permission/custom-role config |
| `components/CustomRoles.tsx` | Base role, staff member and dependent staff-owned clinic | S | Staff E, bounded infinite pages with retry; clinic L/P from selected staff's authorized embedded clinics; no previous-role placeholder rows |
| `components/PatientDocuments.tsx` | Upload clinic selector | S A O R C with upload permission | Document list E; upload eligibility comes exclusively from document endpoint |
| `components/DocumentClinicLookup.tsx` | Permitted upload clinic labels, including clinics without prior documents | Same as documents | E, exact-ID batches of 20; selected ID detail hydrates independently; manual pagination; no broader clinic catalog |
| `components/StaffDeletionReview.tsx` | Handoff target and reconciliation choices | S A O where permitted | E/P from explicit review endpoint; not a general staff download; no deletion changes |
| `components/HistoryReconciliationReview.tsx` | Reason, affected records and review scope | S where permitted | L plus scoped review E; no history writes added |
| `components/WorkspaceShell.tsx` | Profile-menu workspace choices | A O D R C; S/P have fixed scope copy | Workspace read now starts on shell/page entry, before profile menu; server switching authority unchanged |

The global command search (`components/WorkspaceSearch.tsx`) is a deliberate
cross-module search, not an option selector: it still searches permitted sources
only after an actual search intent. It does not preload unrelated clinical
directories. Listing search suggestions use their already-running scoped list.
PIN localities (`components/PinLocalities.tsx`) start after a valid country/PIN,
not before that dependency exists. Calendar/time/date pickers and table
column/view menus use local options; no remote option request is delayed there.

## Executable evidence and limitations

- `src/components/dropdown-inventory.test.mjs`: every selector-bearing source
  file must remain represented in this inventory. This is discovery coverage,
  **not** a claim of browser or role coverage.
- `workspace-regression/tests/dropdown-readiness.spec.ts`: real migrated,
  disposable database, real native sessions and `/me`, real scoped directory
  endpoints. Initial queries precede interactions; page size stays bounded;
  closed filters share warm reads; patient/guest requests use public endpoints.
  A custom-role receptionist denies patient viewing while permitted catalogs
  remain available; a Clinic Admin has an actual consulting doctor profile.
  Cold/warm measurements and six-area request lists are test attachments.
- Existing `selector-names`, `booking-discovery`, and `patient-registration`
  browser regressions cover disabled saved labels, selected IDs, slow/failing
  requests, retry, booking roles, draft preservation and public/staff boundaries.
- Focused directory/cache/public/sole/selected-label/dropdown/loading checks:
  36 passing before the browser pass.
- Shared libraries: `pnpm typecheck:libs` passed. Frontend source checking after
  refreshing those builds reports only the existing two Vite plugin-type
  incompatibilities in `vite.config.ts`; the separate frontend-typecheck task
  owns that dependency problem.
- No UAT/production changes, production incident claims, real patient fixtures,
  provider tests, mail sends or permission changes are part of this work.
- Do not equate the static inventory with execution of every role × page ×
  dialog combination. Shared-control browser coverage and the actual entry
  points below are the executed coverage; remaining inventory rows document
  ownership, authorization and mounting rather than separate browser runs.

## Execution results — 2026-10-22

All **78 selected browser cases have a passing execution**, across the initial
suite and targeted rechecks. This is not a claim that a final whole-suite rerun
occurred. The initial run passed 64 cases; setup/schema/native-token and existing
HTTP-fixture mismatches blocked the others. Only affected flows were rechecked.
The final targeted run passed all four remaining checks.

| Executed evidence | Result |
|---|---|
| Native Super Admin, Clinic Admin, doctor, receptionist, second receptionist | `/me`-backed browser identity/role assertions passed for each. Consulting-owner doctor identity separately verified by the real `/me` route. |
| Restricted custom role | Actual `patients:read` denial returns 403; clinic catalogs remain available. Switching from Super Admin drops the old clinic label and unauthorized options. |
| Closed filter / first open / dependent selection | One successful initial clinic request before interaction, no premature child query; opening warm filter adds no request. Selecting clinic starts its scoped locations before location-menu interaction; first options visible and foreign location excluded. |
| Saved IDs / multiple options / multi-select / paging | Disabled off-page name resolves, ID and empty drafts remain unchanged, explicit multi-selection works, scrolling obtains page two with page size ≤20. |
| Parent change after search | New parent starts an unsearched child read immediately; opening shows only its own locations. |
| Slow / failed / retry | Loading is not reported as empty; simulated 503 displays an error; manual Retry recovers initial options. |
| Patient and guest | Public-safe unsearched clinic load; no private directory reads; location starts after clinic selection. Native patient session preflight verifies its actual account; patient browser test verifies public-safe behavior, not a separate role-label assertion. |
| Clinic details → Edit | Actual clinic-settings and registration-reference routers mounted in the isolated harness; registration-options request succeeds before any option menu is opened. |
| Doctors → Add | First specialization/master page starts successfully before menu interaction. |
| Patients → Add | First clinic page starts successfully before menu interaction; unchosen dependent scope stays disabled. |
| Staff → Add Receptionist | Real assignment-options request succeeds on form entry. |
| Booking | Patient first page succeeds on entry, while its stage remains closed; a doctor read is also observed. The six-area test does not independently assert that doctor's response status. |
| Appointments | Clinic first page succeeds while filter drawer is closed; first opening exposes Lakeview Clinic. |
| Existing selector/booking/registration regressions | All 66 selected cases have passing executions, including disabled labels, missing records/retry, guest/staff booking boundaries and saved rescheduling. Stale pinned-queue, movement and confirmation-link fixture expectations were aligned with current product behavior, not changed in the product. |

For doctors, patients, staff and booking, the six-area browser case asserts
request initiation/readiness, not an individual option-label assertion on each
form. First-open rendering is exercised by the same shared controls in the
native-role, public, multi-select and appointment-filter cases.

### Measured readiness

Restricted receptionist, cold browser navigation to confirmed initial readiness:
**3,299 ms**. Warm drawer/menu open to visible initial option: **393 ms**.
**One initial clinic request; no additional warm request.** These intervals
include navigation/rendering in the local disposable fixture, not just API
latency, and are not a production response-time promise. Other native-role
cases also passed cold/warm request assertions; numeric attachments from their
earlier list-reporter run were not retained, so no numeric claim is made for them.

### Checks and environment

- 48 focused Node checks passed: the original 36 directory/cache/public/sole/
  selected-label/dropdown/loading checks, plus custom-role, registration-address
  rendering and the system-wide inventory guard.
- Shared-library typecheck/build passed. The full frontend check still reports
  the two existing Vite peer/plugin type incompatibilities tracked separately;
  no changed frontend source error was reported.
- Both existing app workflows started cleanly. Login layout was captured in
  Preview; a subsequent proxied auth-status request returned HTTP 200 after the
  backend started. Protected behavior was verified through the fictional
  native-session browser harness, not by using real clinic accounts.
- No UAT/production verification was executed. No real patient test data,
  notification test sends, or changes to booking/movement eligibility were made.
- Completion review passed. The first required validation run passed queue
  contention, appointment movement and communication usage; tickets passed 101
  cases but two PDF cases failed during context teardown because trace files
  were missing (ENOENT), not because of PDF assertions. Ticket output/report
  directories were subsequently isolated under ignored generated-artifacts;
  assertions, workers, deadlines and retry policy were not relaxed.
