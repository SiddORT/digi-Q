# Administration frontend migration

## Implemented listings

All rows use mobile `data-label` attributes and no inline assignment truncation. Shared table CSS supplies desktop wrapping and mobile stacked rows. All listings request exact server totals, default to 20 rows, offer 10/20/50/100, preserve filters after edits, reset pagination on filter/sort changes, and distinguish loading, query errors with retry, unfiltered empty, and filtered empty states.

| Listing | Search | Filters | Sort |
| --- | --- | --- | --- |
| Users / Clinic Admins | Debounced | Status | Name / created date |
| Users / Doctors | Debounced | Status, clinic, specialization, managing admin (Super Admin) | Name / created date |
| Users / Receptionists | Debounced | Status, clinic, branch, managing admin (Super Admin) | Name / created date |
| Clinics | Debounced | Status, Clinic Admin (Super Admin) | Name / created date |
| Branches | Debounced | Status, clinic | Name / created date |
| Doctors resource | Debounced | Status, clinic, branch, specialization, managing admin (Super Admin) | Name / created date |
| Patients | Debounced | Status, clinic, branch, registration range | Name / created date |
| Masters | Debounced | Status, category | Name / created date |
| Weekly schedules | Debounced | Clinic, branch, doctor, weekday | Created date |
| Date exceptions | Debounced | Branch, doctor, date | Created date |
| Booking QR codes | Debounced | Status, clinic, branch, doctor | Name / created date |
| Audit | Debounced | Operational/security/all, date range | Created date |

## Forms and dropdowns

- `ResourceLookup` and `ResourceMultiLookup` use shared searchable controls, debounced remote search, 20-record requests, incremental loading, selected-record retention, visible errors, and retry.
- Generic relation forms cover clinic, branch, doctor, patient, Clinic Admin, specialization, qualifications, master parent, and other master relations. Administrative user selectors specify the Clinic Admin role, never global users.
- Staff clinic/branch multi-selects use the management assignment catalog with the current edited user/doctor identity, not operational lists. Selected records use the catalog's scoped selectedIds resolver; ordinary retained records resolve through existing authorized detail endpoints.
- Multiple clinic branch catalogs issue a bounded request per selected clinic, with remote search and incremental pagination. Search-page absence never clears existing assignments.
- Explicit clinic changes clear dependent singular selections. Staff assignment removal clears known branches of the removed clinic. Server assignment validation remains authoritative.
- Staff editor keeps receptionist branch selection visible, requires clinics and receptionist branches, and prohibits mixing known clinic owners. Selected assignment labels persist across searches/pages.
- Recovery is a role-specific remote staff account picker, not a current-table-page picker.
- Generic forms, staff forms and Clinic Admin onboarding use `AppDialog` for focus, escape, dirty-close confirmation and busy-close protection.
- Save/delete/QR regenerate/invitation actions give success feedback, preserve list context and disable pending actions. No invitations, emails, recovery mutations or OTPs were executed during implementation.
- Staff tables group identity/contact, assignment and account state instead of forcing ten narrow columns. Each tab retains its search/filter/page settings.
- Audit and staff created dates use configured settings timezone when available; raw timestamps remain visible if configuration cannot load.
- Location fields remain free-text inputs with bounded, remotely searched master suggestions rather than restricting established free-text input.

## Performance and compatibility

No `allPages` callers remain in the frontend; its unused implementation was removed. No operational listing loads every page or filters/sorts the listing client-side. Authentication, staff-input allowlisting, invitation mutations and metadata behavior are unchanged. Do not infer security guarantees solely from frontend controls: backend authorization remains authoritative.

## Verification

- `pnpm --filter @workspace/clinicflow typecheck`: passed.
- `node --test artifacts/clinicflow/src/staff-input.test.mjs`: 4 passed, 0 failed.
- Browser, visual, keyboard, responsive and live authorization tests: delegated to main agent; not run by this implementation subagent.

## Backend integration checks required before acceptance

The new frontend sends search/sort to schedules, exceptions and QR listings, weekday to schedules, `from`/`to` to patients/audit, `linkedOnly` to recovery user lookups, and `doctorId` to branch lookups for exception/availability assignment. Ensure generated query schemas retain these fields and the SQL layer actually handles them (not merely JSON fields that do not exist on branches). At implementation time schedules' generated schema still omitted search/sort/weekday and SQL did not implement weekday/linkedOnly or branch-by-doctor resolution. Assignment clinic ownership is additionally enforced by disabled incompatible options; optional managingAdminId on the assignment catalog should be implemented server-side for efficient filtered catalogs. Assignment selectedIds hydration must preserve already-assigned inactive values as well as active options, subject to authorization. These are backend-owned integration issues, not verified completed frontend behavior.