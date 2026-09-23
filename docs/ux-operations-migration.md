# Operational and patient UI migration

## Files and ownership

- `artifacts/clinicflow/src/clinic.tsx`: operational and patient portal screens.
- `artifacts/clinicflow/src/components/CareLookup.tsx`: bounded public-care and own-appointment lookups; delegates staff entity selection to the shared `ResourceLookup`.
- Shared controls, CSS, Users/receptionist management, generic resource pages, and CheckIn are owned by the other migration workstreams. This change does not claim those implementations.
- Onboarding, authentication architecture, invitation delivery, and existing role/navigation rules were not redesigned. No live OTP, invitation, email, or booking requests were executed as testing.

## Screen inventory

| Screen | Implemented behavior |
| --- | --- |
| Dashboard, all roles | Preserved bounded metrics and appointment previews; explicit loading, failure, retry; operational-activity label explains separation from security audit. Backend excludes security events without deleting them. |
| Appointments, all roles | Debounced server search; from/to range; status; clinic → branch → doctor; stable server sort; shared 20-row-default pagination and page-size selection; distinct filtered-empty state; retry. Patient relation selectors use public catalog endpoints while appointment results remain ownership-scoped. |
| Appointment actions | Existing server-provided allowed actions and expected-status concurrency retained. Cancellation/no-show reason collected in shared accessible dialog. Mutation lock, pending buttons, success and error feedback. QR shown in shared dialog. |
| Appointment QR | Image-generation loading/error/retry, cancellation of stale image updates, download only when image exists. Original QR URL and check-in behavior preserved. |
| Public QR booking | Existing sign-in/onboarding handoff preserved; context/profile loading, errors and retry. |
| Staff and patient booking | Searchable bounded clinic/branch/doctor relations, explicit selected-record lookup, parent-change clearing, scoped patient lookup, registration dialog and success feedback. Preserves session capacity, token assignment, break/queue-open/close rules, phone/walk-in/QR/online source rules, consent, request idempotency ID and confirmation. No fixed time slots introduced. |
| Patient registration in booking | Existing role restriction retained: administrators/receptionists can register; doctors select existing scoped patients. Shared dialog with dirty/busy handling and retained errors. |
| Mobile verification in booking | Existing user-initiated OTP architecture retained; same-render duplicate guard added. No OTP was requested during implementation. |
| Queue, staff | Clinic → branch → doctor + date/status filters. Entries genuinely server-paged, counters/current/next token remain session-wide. Call-next uses session next-token rather than only the current visible page. Existing ordering is owned by backend. Retry, success and duplicate guards. |
| Queue, patients | Bounded searchable own-appointment lookup, selected appointment context, existing own-token/wait estimate display. No staff entries shown. |
| Doctor clinics | Assigned clinics and administrator-network clinics independently searched and paged. No first-100 truncation or client subtraction of only the current assigned page. Network list explicitly includes existing assignments. |
| Profile | Existing fields/permissions retained; loading/error/retry, save success and duplicate guard. |
| Settings | Explicit loading/error/retry, save success and duplicate guard; integration boundaries and Clerk-owned session behavior unchanged. |
| Reports | Server-paged date/clinic/doctor grouping; from/to and dependent scope filters; loading/error/retry and grouped responsive columns. Explicit **Export all results CSV** fetches all matching report pages only on user demand, not merely the displayed page. |

## Dropdown audit

| Location | Control | Search and paging | Scope/dependency |
| --- | --- | --- | --- |
| Staff appointments, booking, queue, reports | Clinic/branch/doctor, single | Shared ResourceLookup, remote 20-row pages | Existing authorized endpoints; branch/doctor reset on parent change |
| Patient appointment filters and booking | Public clinic/branch/doctor, single | SearchableSelect + infinite-query remote 20-row pages | Active public catalog; selectedIds exact lookup; clinic/branch/doctor-QR dependencies |
| Staff booking | Patient, single | Shared ResourceLookup, remote search/paging | Active patients in selected clinic and branch |
| Patient queue | Own appointment, single | SearchableSelect + remote search/paging | Ownership enforced by appointment API; selected date |
| Appointments/queue/reports | Status, sort, grouping | Shared SearchableSelect | Fixed real backend-supported enumerations |
| Booking | Source | Small fixed native enumeration using shared form styles | Phone/advance or walk-in; existing workflow unchanged |

Selected IDs and labels survive option search/page changes. Exact selected public records are independently loaded with `selectedIds`, not inferred from membership in the current options page. Missing or unavailable selected records produce an explicit error. No global Users-as-doctors/patients selector was introduced.

## Tables and data loading

- Every operational table cell in `clinic.tsx` has `data-label`; shared CSS owns desktop wrapping and mobile stacked cells.
- Appointment identity/location/date/status/actions use grouped columns.
- Report visits and outcomes are grouped to avoid seven competing numeric columns.
- Doctor assigned/network clinics use separate totals and pagination.
- Queue pagination never slices a previously fetched full queue client-side.
- All `allPages` calls/imports were removed from `clinic.tsx`.
- Reports export is intentionally a separate full-result operation. It fetches bounded pages sequentially, guards duplicate export clicks, quotes CSV fields, neutralizes spreadsheet formula prefixes, rejects changed totals/duplicate grouping keys/incomplete pages, and revokes object URLs.
- API contract metadata used: report `total`, queue `entriesTotal`, assignment `pagination.clinics.total`.
- No invented independent session selector or patient-type filter: session is doctor/branch/date; patient type is not independently queryable in the current contract.

## Security and business rules

All list/action authorization remains server-side. Frontend filters are only query constraints, not authorization. Patient-own appointment selection, doctor identity lock in queue, server allowed-actions, existing patient-registration role restrictions and request idempotency are preserved. Doctor/receptionist assignment relationships and Doctor-created clinic rules were not altered.

## Validation and remaining limitations

- Static audit: no `allPages`, native dynamic record select, or unlabeled table cells remain in the owned operational files.
- Shared component signatures checked against current implementations.
- `pnpm --filter @workspace/clinicflow typecheck` passed after completion; parent agent owns final integration/build/browser and regression testing.
- No browser, responsive-device, live mutation, scale-fixture or role-isolation integration tests were run by this workstream, per delegation.
- Required integration contract: public selectedIds and public branch doctorId filtering, plus assignment/report/queue pagination metadata, must be present on deployed backend.
- Shell heading/greeting, dashboard activity and queue last-updated now use the configured application timezone through reusable exports in `src/lib/date-time.ts`. Timezone comes from identity settings when supplied, otherwise the existing cached settings endpoint (no new authentication query). Missing settings produce an explicitly labeled ISO timestamp rather than silently using browser timezone. Session timing continues to use its returned session timezone. ResourcePage's createdAt display was checked: it already uses settings timezone and preserves calendar-date strings unchanged.
- Full CSV export is complete across bounded pages but is not a transactionally frozen report snapshot; concurrent metric changes that preserve group keys/totals cannot be detected client-side.
- Users/receptionist management, generic clinic QR listing/editing, resource tables, and CheckIn completion/testing must be reported by their owning workstreams rather than inferred from this inventory.