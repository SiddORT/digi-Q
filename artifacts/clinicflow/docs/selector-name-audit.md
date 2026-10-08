# Dropdown name audit

## Scope and outcome

Audited every `SearchableSelect`, `SearchableMultiSelect`, `ResourceLookup`,
`ResourceMultiLookup`, `CareLookup`, native `<select>` and shared Select consumer
under `src`, including generic resource fields and selectors generated from field
metadata. This was a name-display change, not an eligibility or authorization
change. Database IDs, filter parameters and submitted assignments remain IDs.
User-facing tokens, codes and booking references remain visible.

The reported Queue exposure was confirmed in the original implementation:
disabled Doctor/pinned controls disabled both catalogs and selected hydration;
the shared control then displayed its UUID value. The new isolated UUID fixtures
exercise that exact cold/restored path and now display names. The original
deployed session/customer records were not inspected or modified.

### Confirmed defects and fixes

| Defect | Fix |
|---|---|
| Disabled resource controls did not hydrate saved selections | Selected detail/exact-ID reads run independently of menu editability |
| Single-select retained the old label when its value changed | Retention is keyed by value and actor/resource scope; current option text is derived during render |
| Single/multiple closed values, chips, accessible descriptions and remove-button names fell back to IDs | Explicit loading, unavailable and failed-name text; no raw-value fallback |
| Resource and public option builders fell back to `row.id` | Human-readable names or explicit `Name unavailable`; appointments use token/doctor/location/date/session/reference summaries |
| Public/reschedule selections outside the first page lacked an authoritative name lookup | Bounded public `selectedIds` reads; own appointment details use the authorized appointment endpoint |
| Selected-hydration failures were not propagated to the controls | Failure state and retry remain accessible even when the selection control is disabled; IDs are retained |
| Resource retained rows were not actor/scope bounded | Selected-only retention resets on actor/resource/parent scope changes; confirmed missing results remove display retention |
| Generic/Staff/System Users/Report chips only said “Selected” | Exact permitted name reads with explicit states and retry; patient filter labels use public endpoints |
| Patient document clinic fallback displayed a fragment of an internal ID | Explicit `Clinic name unavailable` instead |
| Exception session selection only knew the initial schedule page | Authorized exact schedule detail supplies an off-page hours label, not menu eligibility |
| Doctor contextual location cache lacked an actor dimension | Actor-bound query and selected-label scope |
| Guest confirmation could omit a location/doctor selected outside its small sole-option page | Scoped selected records supply the confirmation names |

## Surface / role matrix

SA = Super Admin, CA = Clinic Admin, D = Doctor, R = Receptionist,
P = Patient, G = guest/prospective clinic registrant. These are the existing
intended role surfaces, not new permissions; ownership, assignment, custom policy
and endpoint checks still decide access. “Source” means all generated fields and
consumers were traced; it does not imply a separate browser run for every cell.

| Page, pop-up or filter | Existing role surface | Selectors / result | Verification |
|---|---|---|---|
| Queue first load, restored/reloaded staff session | SA, CA, D, R | Clinic, location, doctor; disabled Doctor now resolves; selected IDs unchanged | Source + browser CA/D/R |
| Queue pinned workspace | CA, D, R | Read-only clinic and disabled location/doctor resolve names | Source + pinned D browser |
| Queue patient appointment | P | Token, doctor, location, date/session and reference, not appointment ID | Source + P fixture browser |
| Queue consulting/operational session and Quick Switch | Staff above | Session hours/state; doctor names; loading/error/retry supplied | Source + Queue browser |
| Queue sort, presence, duration and earlier guest requests | Staff where existing actions permit | Named static choices and doctor context | Source |
| Appointment listing/filter drawer/saved filters | SA, CA, D, R, P | Clinic/location/doctor names, status/date/view and consulting session summaries | Source + Apply/Reset browser |
| Appointment create/Book/Walk-in staged visit and patient controls | SA, CA, D, R, P | Disabled/restored visit scope, patient names and session hours; normal submission IDs | Source; shared public/appointment controls browser |
| Reschedule pop-up | Authorized appointment staff/P | Scoped public destination location/doctor names including off-page original values; session hours | Source; shared public controls browser |
| Clinic group create/edit, category/speciality assignments | SA/CA and authorized D clinic creation | Entity names and master names; multiselect label retention | Source |
| Location create/edit, parent clinic and linked doctor | SA/CA | Parent and saved linked doctor labels; read-only hydration | Source; shared controls browser |
| Doctor add/edit and assignment multiselects | SA/CA, permitted D profile editing | Managing admin, clinic/location, specialization/qualification names; saved scoped labels cannot become eligible options | Source + doctor-context browser |
| Patient add/edit and fixed registration context | SA/CA/R; D permitted demographic edit | Clinic/location/master names, immutable saved-context label hydration | Source + create/edit browser |
| Generic user add/edit and staff role editor | SA/CA where permitted | User/admin/clinic/location/master names and assignment chips | Source; shared controls browser |
| Master create/edit/list category | Authorized administrative settings | Named category enum; any entity/master relations use shared hydration | Source |
| Weekly schedule add/edit and exception add/edit | SA/CA/D/R where permitted | Clinic/location/doctor names, weekday enum, session hours; saved off-page session detail | Source + contextual schedule browser |
| Booking QR create/edit/list filters | SA/CA where permitted | Clinic/location/doctor names and QR type enum; fixed saved contexts | Source |
| Resource listings and filter drawers (`resources.tsx`) | Role-permitted resource pages | Clinic/admin/location/doctor/specialization filters resolve exact selected names; status/day/category/date remain human choices | Source + filter browser |
| Staff Users listing/filter/saved filters | SA/CA; permitted D paths | Clinic/location/specialization/managing admin names and staff-type/status enums | Source |
| System Users listing/filter/effective-scope pop-up | SA | Clinic names in filters; effective scope uses user clinic names, not IDs | Source |
| Reports filter drawer/saved filters/session/grouping | SA/CA | Clinic/location/doctor names, session hours, date/doctor/clinic grouping labels; retry within filter drawer | Source |
| Doctor contextual editor location and exception details | SA/CA, permitted D | Actor-scoped saved location names; doctor fixed-name context | Source + CA/D fixture browser |
| Linked schedule controls / follow-location-hours | SA/CA where permitted | Saved linked doctor via ResourceLookup; booking-policy enums named | Source |
| Clinic Settings location/category/copy-source selectors | SA/CA | Location and source-location names, categories/specialities, time/date preferences | Source |
| Public clinic directory / location directory | G, P, visitors | Human name sort and numeric page size; clinic/location/doctor cards already named | Source |
| Guest clinic finder | G, P | Public scoped clinic/location names; selected-record callback remains tied to ID | Source; shared public lookup browser |
| Guest booking visit and confirmation | G | Public location/doctor labels, session hours; confirmation resolves selected records beyond sole-option probe; committed-ticket recovery uses private receipt names without public directory hydration | Source; shared public lookup browser |
| Clinic registration wizard | G/prospective registrant, SA provisioning | Complete registration-option catalogs supply category/speciality/qualification names; static duration/date/time named | Source |
| Custom roles / staff binding / Access Rules | SA | Role/staff names, assigned clinic names, human module/base-role names; remote search retention uses exact selected ID | Source |
| Email templates / integration settings | Authorized administrative settings | Named events/providers, inherited scopes and entity relations use shared controls | Source |
| Patient documents upload-clinic choice | P / authorized record viewer | Clinic payload name or explicit unavailable state; no shortened ID | Source |
| Address, phone and timezone controls | All allowed forms/public registration | Country labels/calling codes, IANA timezone + offset (intentional user-facing values) | Source |
| Weekly copy controls / duration / listing page size | Authorized staff/list viewers | Day names, minute summaries and numeric page sizes | Source |
| Visit-range month/year native selects | Appointment-list viewers | Month names and year numbers; no entity identifiers | Source |
| Shared `ui/select.tsx` primitive | Reusable UI primitive | No additional entity dropdown consumer bypassing the above wrappers was found | Source |

### Source inventory

- Shared controls: `SearchableSelect.tsx`, `SearchableMultiSelect.tsx`,
  `ResourceLookup.tsx`, `CareLookup.tsx`, `FilterNames.tsx`.
- Workspaces: `resources.tsx`, `Users.tsx`, `clinic.tsx`,
  `SystemUsers.tsx`, `ListingControls.tsx`.
- Queue: `SessionQueue.tsx`, `SessionSelector.tsx`, `DurationEditor.tsx`,
  `GuestRequests.tsx`.
- Booking: `GuestBooking.tsx`, `GuestClinicFinder.tsx`,
  `PublicClinicPage.tsx`, `appointments/RescheduleAppointment.tsx`,
  `appointments/VisitRangePicker.tsx`.
- Scheduling: `LinkedScheduleControls.tsx`,
  `schedule/DoctorScheduleContext.tsx`, `schedule/WeeklyScheduleEditor.tsx`,
  `schedule/WeeklyOverview.tsx`, `schedule/FollowLocationHours.tsx`.
- Other consumers: `ClinicRegistrationWizard.tsx`, `ClinicSettings.tsx`,
  `CustomRoles.tsx`, `AccessRules.tsx`, `EmailTemplates.tsx`,
  `IntegrationSettings.tsx`, `PatientDocuments.tsx`, `AddressFields.tsx`,
  `PhoneInput.tsx`, `TimezoneSelect.tsx`, `ui/select.tsx`.
- Cache/permission boundaries: `directory-cache.ts`, `use-directory.ts`,
  `relation-validity.ts`, `WorkspaceBranch.tsx`, backend `routes/resources.ts`
  and `routes/public.ts`. Backend submission contracts and permission checks
  did not change.

## Verification and evidence

All data in the browser pass was intercepted synthetic fixture data. Every
`/api/**` request was intercepted; no existing customer record, account or
assignment was changed.

1. One representative acceptance pass: **15 checks passed**; two assertions
   stopped on fixture locator mistakes (shrinking retry-button indices and
   expecting a pinned Clinic button instead of its intentional read-only input).
   Both assertions were corrected; the two affected checks then passed in a
   narrow **2-check rerun**, without repeating the broader journeys.
2. `selector-names.spec.ts` covers disabled cold/reloaded values, UUID fixtures,
   off-page and remote-search retention, value changes, multiselect accessible
   names, public lookup/appointment summaries, loading, missing-name payloads,
   missing public records, failed lookups/retry, actor change, restored CA/D/R
   Queue and pinned/Patient Queue.
3. Passing existing acceptance checks include:
   - `advanced filter values do not fetch until Apply and Reset clears the server scope`
   - `create form preserves clinic and branch across unrelated edits, search and option refresh`
   - `edit form retains valid branch for unchanged clinic and removes it for another clinic`
   - `branch option errors are not reported as empty or endless loading, and keep the edit selection`
   - `doctor role retains staff permissions; clinic admins can use the shared contextual editor`
   - `scoped doctor assignment labels stay readable and external saved mappings cannot be cleared`
   These inspect visible controls and unchanged request/filter/assignment IDs.
4. Frontend TypeScript check: passed. Label helper tests: **2 passed**.
   Existing directory/cache/session/sole-option suite: **24 passed**.
5. Production frontend build: passed with the managed preview port/base-path
   supplied; existing CSS/sourcemap/large-chunk warnings remain non-blocking.
6. Managed frontend workflow restarted and served cleanly. Signed-out preview
   screenshot confirmed the public landing page renders normally.
7. Required ticket validation initially passed 31 checks and caught an
   unnecessary public-directory read during committed private receipt recovery.
   Hydration now stops for that private-ticket path. The targeted
   `guest recovery API error warns and refresh can restore ticket` check and
   TypeScript check passed after the correction. Queue contention validation and
   the completion code review passed; the completion process rechecks required
   validations before accepting the task.

Screenshots under `workspace-regression/evidence/selector-names/`:

| Evidence | What it demonstrates |
|---|---|
| `queue-doctor.png` | Clinic/location/disabled Doctor have names in restored Queue |
| `queue-clinicAdmin.png`, `queue-receptionist.png` | Same Queue labels with those role props |
| `queue-pinned.png` | Read-only Clinic plus disabled location/Doctor resolve names |
| `queue-patient.png` | Appointment selected summary is meaningful, not an internal ID |
| `disabled-cold.png` | Exact disabled resource/public/multiselect hydration; original IDs retained in test-only output |
| `changed-and-multi.png` | Changed values do not borrow old text; multiselect/accessibility state |
| `off-page-search.png` | Selected label survives search; off-page selected option remains disabled in the menu |
| `missing-and-actor.png` | Explicit failure/unavailable state after actor change; selection values retained |
| `retry-recovered.png` | Failed disabled lookups recover names via retry |

The `submission-values` output shown only by the isolated regression fixture
intentionally contains IDs for assertions. It is not an application display
surface and is not shipped with the app.

### Limitations

- Browser role props exercise the real components but are **not real login or
  production authorization proof**. The backend permission checks were inspected,
  not altered or re-tested against customer accounts.
- Every selector consumer received a source audit; not every page/pop-up/role
  combination received a separate browser visit. Create/edit/filter evidence is
  the passing automated assertions above; selected Queue/public/multiselect
  journeys additionally have screenshots.
- No production deployment was requested or performed. API submission values,
  selection eligibility, assignment ownership and account-status behavior were
  intentionally preserved.
