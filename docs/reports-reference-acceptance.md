# Reports reference acceptance

## Environment and product decisions

This change is verified in the **development fork/Preview**, not the deployed UAT or production build. No deployment, production/UAT data mutation, communication configuration change or live notification delivery is authorized or performed.

References: `image_1792648133614.png` (dashboard) and `image_1792648142775.png` (drawer), in `attached_assets/`. Their numbers, dates and clinic names are illustrative, never production fixtures.

The user approved separate **Live Reports** and **Report Templates** tabs. Templates are reusable settings that open current data, not frozen reports, execution jobs or fabricated completed runs. The pre-existing clinical aggregates remain available in **Operational Detail**. The separate **Communication Usage** tab remains administrator-only.

## Reference and functional checklist

| Requirement | Implementation / evidence |
|---|---|
| Reports title, subtitle, period, Compare and header Export | Shared listing title/header; existing SearchableSelect for Today, 7 Days, 30 Days, This Month, Custom Range. Date text uses clinic preferences. |
| Inline controls and right drawer, neither omitted | Both presentations share one draft. Inline Group By/Report Type/Status/Clinic and Apply; drawer includes dates/presets/group/type/status/clinic plus authorized location/doctor context. |
| Drawer Reset/Apply/close; cancellation | Existing FilterBar/AppDialog gains opt-in draft reset/cancel callbacks. Reset does not commit; Apply validates complete form; cancel restores applied filters. Existing callers preserve their prior behavior. |
| Applied chips and Clear All | Existing FilterBar chips, named scope labels, removable non-date context; Clear All resets period/search/filter state, retaining pinned workspace scope. |
| Four KPI cards | Whole-scope SQL totals, independent of table pagination, from the same snapshot as trend and results. No current-page sums. |
| Previous-period comparison | Immediately preceding equal-length inclusive range; previous dates disclosed. Zero baseline says previous period had 0, not an infinite percentage. Missing comparison is unavailable. Bad outcomes reverse positive/negative tone. |
| Appointments Trend and metric selector | Existing Recharts library; appointments/completed/cancelled/no-shows/waiting; prior-period series aligned by day offset. Single day remains a bar chart. Empty/error/loading states retain the chart section. |
| Report families | Appointments, Doctor Utilization, No-show Analysis, Patient Registration, Cancellation, Clinic Activity, Reschedules, Clinic Performance, Patient Activity. Templates select useful grouping/ranking/columns. |
| Accurate live availability, no job history | Available and No Data derive from each family's actual source-event count in an observed clinic/group. Entirely unobserved ranges do not invent rows. Availability filters rows, not the clinical population behind the dashboard; this distinction is disclosed in Data Coverage. |
| Results hierarchy | Count, row numbers, Date, Report/Event, Clinic, Type, Status, contextual actions; shared columns, sorting and pagination/rows-per-page. |
| Existing operational metrics | Operational Detail retained. Every new row exposes visits/outcomes/unique patients/registration/wait/duration/timing coverage/reschedule/activity metrics in Details, configurable columns and CSV. |
| Clinic/doctor comparisons | Unique-patient and completed-visit ranking, doctor grouping with doctor names, measured total/average consultation time. No capacity utilization is guessed from opening hours. |
| Search and saved Views/templates | Shared search and saved-view infrastructure; PHI-bearing search is not saved. Relative presets resolve on opening. Missing/failed saved templates do not silently open a default report. |
| Complete header/CSV exports | Both call the same single-snapshot `exportAll` endpoint, validate count and unique IDs, include every metric and group, escape spreadsheet formulas, and reject stale/pending/error/changed-context exports. Row CSV is explicitly one row. |
| Permissions and isolation | Existing authorized source SQL and context validation reused. Administrator-only audit activity and communication remain restricted; a template grants no extra access. |
| Registration scope vs profile visibility | Registration events are independently constrained to authorized clinics and locations. A foreign-registered patient with a local visit remains visible as a patient/visit, but their foreign registration and clinic row never enter local reports or exports. Tested for clinic admin, doctor and receptionist; Super Admin retains global reporting. |
| SMS/email per user/clinic/etc. | Existing Communication Usage extended with clinic, user, location, event and recipient-role breakdowns; user attribution explicitly chooses recorded recipient or actor. Whole-scope breakdown CSV remains separate from clinical CSV. |
| Clinic-admin doctor identities | Reporting resolves names/options through both the existing scoped staff and scoped doctor relationships. A managed doctor recipient is reportable even when the general staff-management directory omits doctor accounts. This does not broaden general staff visibility or clinic ownership. |
| Honest communication coverage | Provider acceptance is not proof of delivery or billable usage. Only prospectively captured, provenance-bound staff identities are attributed. Historical missing identities remain unknown; booking creator is not guessed to be a later rescheduling actor. Privacy-erased history stays excluded. |
| Realtime, loading, failure and empty | Live polling every 30 seconds plus manual refresh; timestamp and update state. Pending scope never displays old counts as current; failed reads disable exports. Zero-data cards/chart/results stay present with recovery controls. |
| Existing UI/UX reuse | FilterBar, DateRangeInput, SearchableSelect, CareLookup/ResourceLookup, AppDialog, HelpTip, OverflowText, ListingViewControls, TableColumns, pagination and existing panel/badge/button tokens reused. Report CSS only composes these. |

## Functional verification

- Shared OpenAPI generation and TypeScript library build.
- API-server and ClinicFlow typechecks.
- Production-mode frontend bundling with `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow run build` (build only, not deployed).
- Disposable PGlite integration: full totals versus page size; unique patients; equal-length comparisons; explicit false query booleans; real recorded consultation duration; actions versus distinct rescheduled appointments; all families; row availability; complete export; search; single-day points; invalid/reversed/oversized date ranges; role and cross-clinic denial.
- Communication integration: counts and breakdowns agree; all dimensions; recorded actor/recipient filters; historical/unattributed records; foreign users denied; privacy-erased records excluded; 20,000-record retention volume scenario.
- Notification provenance: captured identity fingerprints verified; no raw staff IDs retained; later reschedule does not inherit original booking actor; existing erasure/replay invariants.
- UI render/model tests: periods, comparison baselines, complete CSV refusal, row metrics, links, KPIs, trend empty/failure, templates, shared drafts and existing drawer contracts.

## Browser evidence

The first anonymous capture correctly displayed Staff Login. The browser tester could not securely obtain native login credentials; its interaction checks therefore use **clearly fictional route-intercepted responses**, not a hidden authentication bypass or database fixtures. Disposable integration tests exercise real SQL/routes independently.

The workspace process subsequently used the normal native CSRF/password sign-in securely against the actual HTTPS development Preview. Authenticated analytics and user-grouped usage reads both returned 200/no-store; a future range returned zero rows with comparison disabled. No credentials or session state were saved into evidence files. The actual dashboard and opened drawer were captured separately, and an actual one-row CSV download succeeded. Sessions created for these checks were logged out.

The browser evidence checklist and screenshot locations are recorded in `generated-artifacts/reports/preview-reference-checklist.md` (generated evidence is excluded from Git).

### Completed interaction evidence

The single continued browser pass covered populated results, the five period choices (period computation additionally unit-tested), custom dates, Compare, inline draft/Apply, drawer cancel/Reset/Apply, chip removal, trend metric selection, Details, configurable Columns, pagination/page size, Doctor Utilization and saved templates, Communication Usage grouping, loading, empty, 503/retry and complete CSV (31 rows plus header). Its isolated fixtures had lookup/availability envelope corrections; those are not production failures.

It identified a genuine 390px horizontal overflow caused by the existing non-wrapping `.report-tabs` rule. The shared rule now wraps, with a regression assertion. A cheaper direct authenticated capture confirmed document client/scroll widths **1536/1536, 1366/1366, 768/768 and 390/390** after the fix. Drawer close controls were visible and usable at all four sizes. The row-level CSV check interrupted by development HMR was completed successfully against the actual Preview afterward. No further end-to-end pass was started.

### Saved actual-Preview screenshots

- `generated-artifacts/reports/live-desktop-1536.png`, `live-drawer-1536.png`
- `generated-artifacts/reports/live-desktop-1366.png`, `live-drawer-1366.png`
- `generated-artifacts/reports/live-desktop-768.png`, `live-drawer-768.png`
- `generated-artifacts/reports/live-desktop-390.png`, `live-drawer-390.png`
- `generated-artifacts/reports/live-row.csv` (one real scoped summary, not a patient export)

These are actual development data; that scope contains retained activity but no recorded appointments in the selected period, so clinical KPIs correctly remain zero. The populated synthetic fixture separately demonstrated nonzero KPI/trend interactions. Generated screenshots may include the external development-preview banner; it is not DigiQ UI or evidence about UAT. The reference comparison sheets distinguish illustrative reference numbers from the actual recorded development scope.

**Acceptance status:** implemented requirements have functional, model/render, SQL and browser evidence as described above. Production/UAT deployment and deployed-build verification were not performed and are not claimed. Missing historic communication identity or timing evidence remains explicitly unavailable rather than fabricated.
