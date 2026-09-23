# Listing contract

Existing resource GET endpoints and generated helpers retain their names and `{items,total,page,pageSize}` response. Default page size is 20, maximum 100; `totalPages` is additive. Sorting retains `-field` descending convention with an ID tie-breaker. Filtering and authorization run before database LIMIT/OFFSET.

Assignment options retain `clinics`, `branches`, `managingAdmins`. They additionally accept `search`, `page`, `pageSize`, `clinicId`, `branchId`, and comma-separated `selectedIds` (maximum 100); selected records remain authorization-scoped. Pagination metadata is returned separately for clinics and branches under `pagination`. Search applies to names/codes; clinicId narrows branches. Consumers must search/page rather than assume the first response is the whole catalog.

Queue retains session-wide counters; entries are paginated separately with `entriesTotal`, `page`, `pageSize`, `totalPages`. Reports retain `rows`, with additive `total`, `page`, `pageSize`, `totalPages`. Audit accepts `activityType=operational|security|all`; default all retains security records. Dashboard operational activity excludes security events without deleting them.

Do not expose invented session or patient-type filters: a session is the existing doctor/branch/date combination. Patient type is not currently persisted as an independently queryable field.

Clinics additionally support `adminId`; patients additionally support `status`, `from`, `to` (registration date range). Public clinic/branch/doctor lists also use SQL pagination with existing public response projections.

Queue entry default ordering remains waiting/creation time, then numeric token, then stable ID. Aggregate counts and own-entry wait estimates are not reduced by the staff entries search/status/page filters.

Integration closure: schedules accept search/sort and numeric `dayOfWeek` (0–6; `weekday` alias); exceptions accept search/sort/date; QR lists accept search/sort. Schedule/exception search includes resolved doctor/branch names. Recovery users support boolean `linkedOnly` together with role/scope. Branch `doctorId` filters use actual branch assignments, both private and public. All public option lists accept exact `selectedIds` while retaining active/public and parent-context restrictions.

Assignment `managingAdminId` narrows ownership and cannot override the actor/edited staff manager. During selectedIds hydration only, an authorized existing doctor/user can resolve its retained inactive assignments, still restricted to its owning admin. Unassigned inactive and foreign-owner rows are excluded; ordinary option search stays active-only. This does not change save-time validation or operational access.