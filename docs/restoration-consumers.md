# ClinicFlow restoration consumer migration

This report covers the screen consumers migrated in this change. It does not describe unchanged screens or claim browser QA that was not performed.

## Changed-screen matrix

| Screen / surface | Consumer changes | Preserved behaviour |
|---|---|---|
| Resource lists and editors | Shared search, filter bar, searchable single/multi selectors, enum selectors, and free-text suggestions; contextual empty/error copy | Existing list parameters, role-derived fields, ownership scope, mutations, sort, page and page size |
| Staff: Clinic Admins, Doctors, Receptionists | Contextual search copy; shared Status and Sort selectors; existing searchable assignment selectors | Per-tab state, role scope, assignment validation, invitations, recovery, mutations and server pagination |
| Appointments | Contextual appointment search copy and existing shared relation/enum selectors | 30-second refresh, server query, transition actions and pagination |
| Booking | Booking source migrated to the shared selector | Clinic → Branch → Doctor clearing, patient scope, availability, OTP and booking semantics |
| Live queue | Existing shared scoped selectors retained and audited | Patient/staff scope, queue refresh, call-next and entry pagination |
| Doctor clinics | Heading copy standardized; shared searches retained | Assigned/network query separation and server pagination |
| Reports | Existing shared scoped selectors retained and audited | Date validation, dependent clearing, export consistency and server pagination |
| Clinic Admin setup | Action, dialog and failure copy standardized | Atomic onboarding request, duplicate-submit guard and ownership semantics |
| Check-in scanner | Capitalization and progress/action copy standardized | Staff-only access, QR resolution, camera/file scanning and idempotent check-in |
| Home and authentication | “Staff login” / “Patient login” terminology standardized | Native staff password flow, separate patient email-code flow, single-use invitation links and redirects; historical provider entry is retired |

## Search matrix

| Screen | Placeholder | Clear action | Debounce | Query behaviour |
|---|---|---|---|---|
| Clinic Admins | `Search Clinic Admins by name, email or mobile…` | Shared search clear button | Yes | Server-side staff list; page resets |
| Doctors | `Search doctors by name, email or specialization…` | Shared search clear button | Yes | Server-side doctor list; page resets |
| Receptionists | `Search receptionists by name, email or mobile…` | Shared search clear button | Yes | Server-side staff list; page resets |
| Appointments | `Search appointments by patient or reference…` | Shared search clear button | Yes | Combined with dates, status, clinic, branch, doctor, sort and pagination |
| Clinics / Branches / resources | Resource-specific wording, for example `Search branches…` | Shared search clear button | Yes | Existing server-side list query and pagination |
| Patients | `Search patients by name, email or mobile…` | Shared search clear button | Yes | Existing scoped server-side list query |
| Assigned clinics | `Search assigned clinics…` | Shared search clear button | Yes | Assigned-clinic endpoint with server pagination |
| Network clinics | `Search network clinics…` | Shared search clear button | Yes | Assignment-options endpoint with server pagination |
| Relation selectors | `Search clinics…`, `Search branches…`, etc. | Selector clear action | Yes | Bounded 20-row pages; incremental loading |
| Location suggestions | `Type or search city…`, state, pincode, country or area | Free-text editing | Yes | Bounded 20-row master-value suggestions; free text remains valid |

## Dropdown matrix

| Screen / editor | Field | Shared control | Searchable | Scope / dependency |
|---|---|---|---|---|
| Resource filters | Status, Category, Day, Event category, Sort | `SearchableSelect` | Yes | Fixed enums; no new query parameters |
| Resource editors | Fixed enum fields | `SearchableSelect` via form controller | Yes | Existing form values and validation preserved |
| Resource editors | Clinic Admin / Managing admin | `ResourceLookup` | Yes, single | Users endpoint constrained to `clinicAdmin` |
| Branches / doctors / patients / schedules / QR | Clinic | `ResourceLookup` | Yes, single | Authorized clinic endpoint |
| Doctors / patients / schedules / exceptions / QR | Branch | `ResourceLookup` | Yes, single | Scoped by selected clinic; stale branch is cleared |
| Schedules / exceptions / QR / reports | Doctor | `ResourceLookup` | Yes, single | Scoped by clinic and optional branch |
| Staff editor | Clinics / Branches | `ResourceMultiLookup` | Yes, multi | Assignment endpoint, retained selected rows, managing-admin and clinic constraints |
| Booking / appointments | Clinic / Branch / Doctor | `CareLookup` | Yes, single | Public endpoints for patients; authorized endpoints for staff; dependent values clear |
| Booking | Booking source | `SearchableSelect` | Yes, single | Existing `phone` / `walkIn` values only |
| Queue | Appointment or Clinic / Branch / Doctor / Status | Shared care/resource/select controls | Yes, single | Role-specific scope and dependent clearing preserved |
| Location text | City / State / Pincode / Country / Area | `SuggestionInput` | Yes, free text | Master suggestions are optional; choosing a suggestion is not required |

## Copy matrix

| Area | Before | Standardized copy |
|---|---|---|
| Authentication | `Staff Login`, `Patient Login` | `Staff login`, `Patient login` |
| Check-in title | `Appointment Check-In` | `Appointment check-in` |
| Check-in actions | `Scan Next`, `Confirm Check-in` | `Scan next`, `Confirm check-in` |
| Scanner file mode | `Image File`, `Upload QR Code Image` | `Image file`, `Upload QR code image` |
| Clinic Admin dialog | Ampersand-based title and create wording | `Set up Clinic Admin and first clinic`, `Set up Clinic Admin` |
| Form primary action | Mixed editor save wording | Existing editors use `Save changes`; Clinic Admin atomic setup keeps its workflow-specific action |
| Filter reset | Mixed reset wording | Shared `Clear filters` |
| Doctor clinic heading | Title case | Sentence case: `Currently assigned clinics` |

## Data and performance notes

- Search, sort, filters, page and page size continue to be sent to existing list endpoints; no fake client-only filters were added.
- Remote selector pages remain bounded to 20 rows and load additional pages on demand.
- Selected relation values are retained while searching. Assignment options use the existing selected-ID path rather than fetching entire datasets.
- Clinic changes continue to clear Branch and Doctor where applicable; Branch changes continue to clear Doctor.
- No backend contracts, authorization rules, invitation mutations, email delivery, OTP delivery or check-in logic were changed.

## Limitations and verification

- TypeScript validation passed with `pnpm --filter @workspace/clinicflow typecheck`.
- Per instruction, no workflow restart, live browser mutation, invitation resend, email/OTP request, or check-in mutation was performed.
- Browser visual and responsive QA was not performed by this consumer task. The shared components and global styling are owned by parallel work and require integrated visual QA after all branches are combined.
- Fixed-enum search is retained through the shared selector for visual consistency even when the option count is small.
- The free-text suggestion input intentionally allows values absent from master data; changing it to a strict select would break the existing location-field contract.