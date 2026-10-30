# Reports functional audit and drawer-only filters

Audit date: 30 October 2026. Product: DigiQ / ClinicFlow.

## Answer

**Reports cannot currently be described as complete and correct for every role/filter.**

- **Live Reports:** the independent clean-data scenarios pass for all four staff roles, with the intended audit-family restrictions. Two historical-value failure modes are confirmed: non-numeric wait values and invalid consultation timestamps can turn the shared analytics request into HTTP 500. This also prevents export. Both are reproduced in disposable data, **not established as the cause of the UAT screenshot**.
- **Operational Detail:** confirmed foreign-registration summary exposure in unscoped reads for Clinic Admin, Doctor and Receptionist, plus a session-filter discrepancy between the table and trend. These have not been fixed.
- **Report Templates:** templates are configurations opening Live Reports, not independent report executions. They inherit the target report's failures and access rules.
- **Communication Usage:** the existing real-route disposable tests pass counts, grouping, attribution, detail isolation and complete breakdown coverage. This does not establish historical completeness, delivery or billing.
- **Actual Preview:** normal Super Admin authentication and read-only source reconciliation succeeded in the sampled clinic/date scope. Clinic Admin authentication was blocked. Doctor/Receptionist native browser authentication was unavailable.
- **Hosted UAT:** user confirmed that the screenshot is from hosted UAT and subsequently instructed **“keep checked in preview”**. UAT was not accessed. Shared code delivered through Git does not establish equal data, migrations, configuration or runtime behavior.

No report-data/backend correction, permission change, account change, shared clinical-data mutation, message delivery or deployment was made. The only application behavior changed is the authorized Reports filter interaction.

## Evidence levels and reproducibility

| ID | Evidence | What it proves / does not prove |
|---|---|---|
| E1 | `artifacts/api-server/src/reports-audit.integration.test.mjs` | Current real Express report routes, PostgreSQL SQL, scoped user lookup and permission policies against a disposable PGlite database. Fixture-only identity headers do **not** exercise native password/session authentication. |
| E2 | `artifacts/api-server/src/report-analytics.integration.test.mjs` | Existing scope, foreign registration exclusion in **Live** analytics, family, comparison, validation, paging and export assertions; rerun during this audit. |
| E3 | `artifacts/api-server/src/communication-usage.integration.test.mjs` | Existing independently constructed notification fixtures, totals, dimensions, actor/recipient provenance, foreign detail denial, retention and 20,000-record paging scenario; rerun during this audit. |
| E4 | `scripts/audit-reports-preview.mjs` | Actual HTTPS development Preview, ordinary CSRF/password login and `/me` role confirmation, report GETs, complete-export response and independent `BEGIN READ ONLY` SQL counts. No credentials/cookies or patient rows are written to evidence. |
| E5 | `components/reports/reports.test.mjs`, `components/communication-usage.test.mjs` under `artifacts/clinicflow/src/` | Model/render and source contract checks: CSV completeness/refusal/escaping, date presets, links, details metrics, KPI/trend states, templates and drawer-only composition. Not substitutes for interaction evidence. |
| E6 | `generated-artifacts/reports-audit/clinicflow-reports-drawer-audit.md` and the attached browser screenshots | One actual authenticated Preview pass, no fictional response interception. Generated evidence is excluded from Git; this document preserves substantive results and rendering measurements. |
| E7 | Supplied `attached_assets/Screenshot_2026-10-30_at_5.06.09_PM_1793360174772.png` | Before-state UAT rendering: generic failure, unavailable KPIs, failed trend and large inline filter row. It contains no HTTP status, request ID or server diagnosis. |

Reproduce E1–E5 without changing shared business data:

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/reports-audit.integration.test.mjs \
  artifacts/api-server/src/report-analytics.integration.test.mjs \
  artifacts/api-server/src/communication-usage.integration.test.mjs \
  artifacts/clinicflow/src/components/reports/reports.test.mjs \
  artifacts/clinicflow/src/components/communication-usage.test.mjs
```

E1 deliberately asserts the current defects, including HTTP 500. Its passing status means **the diagnosis reproduced**, not that those defects are fixed.

## Reporting contract

The approved baseline is `docs/reports-reference-acceptance.md`. Its former requirement for inline dropdowns is superseded by the current drawer-only instruction.

| Surface | Source and meaning | Filters/search | Comparison/detail/export |
|---|---|---|---|
| Live Reports | Scoped appointments, separately authorized patient registration events, retained operational audit events | Period/custom inclusive dates; date/clinic/doctor grouping; family; availability; permitted clinic/location/doctor; single-day session/start; debounced grouped/family search | Previous equal-length inclusive period; four visit KPI cards; daily trend; all metrics in row Details; exact scoped visit links only where representable; one-snapshot `exportAll` CSV |
| Report Templates | Nine built-in family configurations and explicit saved Views | A built-in opens live current data; relative saved periods re-evaluate on opening; pinned context retained | Saved configurations are not jobs or historical snapshots. Opening does not save or expand access. Missing configurations must not open a substitute report. |
| Operational Detail | Legacy grouped appointment metrics plus registration events; separate trend endpoint | Dates, grouping, permitted scope/doctor/session, grouped search; sorting/page size | No previous-period comparison; configurable metric columns; CSV fetches every page and rejects changed counts/duplicate keys. Separate requests do not provide Live's single-snapshot guarantee. |
| Communication Usage | Observed channel/recipient occurrences at first-recorded timestamp; retained/legacy history only | All time/today/7/30/month/custom IST time bounds; channel/outcome/event; administrator-specific clinic/source; group and recorded staff recipient/actor | Group by clinic/user/location/purpose/recipient role; masked read-only record drawer; cursor-paged items; breakdown CSV uses whole-scope aggregate, not just current page |

### Semantics that must not be reported as defects

- Visits are appointment records, **not unique patients**. One patient can have multiple visits.
- Live `status=available|noData` filters family rows, **not appointment outcomes or KPIs**. Entirely unobserved periods have no fabricated rows.
- Selecting `reportType=cancellations` or `noShow` restricts the visit population to that outcome. Other families describe the same scoped visit population; adding family rows double-counts visits.
- A family-name search chooses matching display families but does not rewrite `reportType`. In E1, `search=Cancellation` produces one family row with **6 visits/1 cancelled**, while `reportType=cancellations` produces **1 visit/1 cancelled**. Group-name search instead narrows source groups. This distinct behavior follows the current selection/search contract; it is not an outcome filter.
- “Waiting” includes booked and waiting statuses. E1 has two such visits.
- Registrations are creation events on the location-local day, independently scoped from patient profile/visit visibility. A local visit does not authorize a foreign registration.
- Completed visits with no usable start/end evidence have unavailable duration, not zero. No capacity utilization is inferred.
- Reschedule actions and distinct rescheduled appointments differ. Historical omissions cannot be reconstructed. Doctor/session audit attribution can use current appointment coordinates where historical ones were not retained.
- Communication provider acceptance is not delivery confirmation, SMS segments, invoice authority or balance. Unknown/erased/unrecorded identity remains unknown. Counts cannot establish complete historical activity.
- Doctor-grouped registrations without a recorded doctor coordinate are not assigned by guessing from later visits. E1 proves the whole-scope registration count; a complete per-doctor registration attribution is **unverified/unavailable from that source evidence**.

## Role and tab matrix

Legend: **P** = passed in controlled current-route evidence; **F** = confirmed defect; **D** = intentional denied/unavailable; **B** = blocked/unverified in actual authenticated environment. A P here does not imply hosted verification.

| Tab / route | Super Admin | Clinic Admin | Doctor | Receptionist | Restricted staff | Patient / anonymous |
|---|---|---|---|---|---|---|
| Live analytics and full export | P clean data; F malformed timing | P clean data; F malformed timing | P own visits; F malformed timing | P assigned branch visits; F malformed timing | D global `reports:read` and global custom-role denial exercised | D 403 / 401 |
| Built-in Templates | Opens same authorized family; inherits Live failures | Same | Clinical families open; audit families unavailable | Same | No template access escalation; native restricted UI B | Reports workspace unavailable |
| Operational `/reports` | P scoped counts; global registration authority intentional; session trend F | F foreign-registration summary in unscoped query; session trend F | Same F within own clinical scope | Same F within assigned clinical scope | D report route under denied read policy | D 403 / 401 |
| Operational `/reports/trends` | F session mismatch | F session mismatch | Same implementation path; representative UI B | Same implementation path; representative UI B | D under denied read policy | D 403 / 401 |
| Usage `/reports/communication-usage` and detail | P E3; all permitted clinics/platform; source/test controls | P E3 owning clinic, excludes platform/test/foreign | D 403 | D 403 | Current report read policy applies; per-custom-clinic variants B | D 403 / 401 |
| Actual native Preview role/session | P E4 | B: existing credential returned 401 | B: no securely available verified native login | B: no securely available verified native login | B native login | Anonymous denial P via E1 |
| Hosted UAT / production | B not accessed | B screenshot failure not reproduced | B | B | B | B |

Custom clinic-bound role variants and mid-session role/context changes are not exhaustively authenticated in this environment. No accounts or permission settings were altered to manufacture those conditions.

### Live family coverage

Each family was requested for each staff role in E1 with `clinicId=c1`, one-day range and `exportAll=true`. For eligible clean-data rows, Details metrics matched the same response's independently checked whole-scope metrics in this single-group scenario.

| Family | SA | CA | Doctor | Receptionist | Independent population |
|---|---|---|---|---|---|
| Daily Appointment Summary | P | P | P own | P assigned | Visits/outcomes, unique patients |
| Doctor Utilization | P | P | P own | P assigned | Actual measured consultation time, not scheduled capacity |
| No-show Analysis | P | P | P own | P assigned | Outcome-selected visit count |
| Patient Registration | P | P | P scoped | P scoped | One authorized local registration; foreign creation excluded |
| Cancellation | P | P | P own | P assigned | Outcome-selected visit count |
| Clinic Activity | P | P | D no rows | D no rows | Retained operational audit events |
| Reschedules | P | P | D no rows | D no rows | Two actions / one distinct changed visit |
| Clinic Performance | P | P | P own | P assigned | Same visit population; unique-patient ranking columns |
| Patient Activity | P | P | P own | P assigned | Distinct patients versus visit count |

These passes are conditional on valid source values. E1 also confirms malformed-value failures for all seven non-outcome-selected families across all four roles; the separate no-show/cancellation selections exclude the corrupt checked-in/completed fixture and return 200. Outcome reports are not generally immune if their own included values are malformed.

## Independent expectations and reconciliations

E1 creates disposable fictional clinics, two local locations, two local doctors, a foreign clinic/doctor, a locally registered patient and a foreign-registered patient with a local visit. No source rows come from the shared database.

| Check | Independent expected | Actual |
|---|---|---|
| CA / SA identical explicit clinic | 6 visits, 2 completed, 1 cancelled, 1 no-show, 2 distinct patients | Exact summary equality; equal rows/total/trend/comparison |
| Doctor own visit scope | 5 visits, excludes second doctor's appointment | 5 |
| Receptionist b1 assignment | 5 visits, excludes b4 | 5; b4 direct request 403 |
| Session/start combined with clinic, branch, doctor, family and doctor grouping | 3 visits in morning versus 4 for that doctor/branch day | 3 in Live analytics |
| Previous equal-length period | 25 Oct only; 1 visit | 1; disclosed previous bounds correct |
| Local-day registration | 25 Oct 18:45 UTC is 26 Oct in b1's IST; foreign registration excluded | 1 local registration |
| Recorded consultation | One 20-minute timed completed visit; another completed visit lacks timing | Total/average 20; timed count 1; not fabricated for other visit |
| Recorded wait | Only one recorded numeric wait, 10 minutes | Average 10, not divided by six visits |
| Activity | Two retained local actions on local action date | 2 actions, 1 distinct changed visit |
| Pagination | Page size 1 cannot truncate totals/export | 1 visible row / 9 total; full export 9 unique IDs |
| Grouping | Date/clinic/doctor grouping must preserve whole-scope visit total | 6 for each; complete export count/identity checks pass |
| Search | Local clinic name matches; unmatched query excludes scope | Full expected summary for local clinic; unmatched total 0 |
| Availability | Row statuses only; summary unchanged | Available/no-data filters do not change six-visit summary |
| No-data future period | No visits/rows; duration unavailable | 0 visits, 0 rows, null duration |
| Foreign clinic/location/doctor | Must deny normal and full-export requests | 403 for CA/Doctor/Receptionist |
| Global denied Reports/custom denied doctor | No report/read/export bypass | 403 |

E3 independently seeds known notification statuses/provenance, not implementation-produced totals. Expected overall observed total **13**, owning-clinic total **9**, accepted and failure buckets, actor/recipient filters, retained legacy row, excluded erased rows and all grouping totals agree. Foreign detail requests return 404; forbidden scope/source requests return 403. The volume test adds 20,000 fictional retained records; aggregate coverage is independent of the bounded item page. These are observed records only.

E4 actual Preview reads at approximately **11:55 UTC on 30 Oct**:

| Actor / request context | HTTP / correlation | Expected source versus result |
|---|---|---|
| Verified SA; selected server-authorized clinic; 26 Oct; date/all/all; compare false; page 1/20 | 200; workflow request 10; response has no `x-request-id` | 0 visits/completed/cancelled/no-show in read-only SQL; summary and trend 0; exportAll response complete |
| Same, exportAll | 200; request 11 | 0 rows / total 0; no fabricated results |
| Same, 30 Oct | 200; request 12 | Same zero-count reconciliation |
| Same, exportAll | 200; request 13 | Complete zero-row response |
| Intended CA normal native login | 401; no report request | Credential not accepted **in Preview**; no password reset or change |
| Browser's populated SA context independently queried through E4 `--populated` | Analytics and exportAll both 200 | 24–30 Oct; clinic group; Daily Appointment Summary; Available; Compare on; all authorized clinics: raw source **1** visit, **0** completed/cancelled/no-show; KPI, trend sum and one exported group row reconcile. Prior 17–23 Oct source count **0**, comparison **0**. |

Workflow request numbers are local to that process and correlate by timestamp/method/path; they are not globally durable request IDs. No failing UAT request or server stack is available. E4's chosen clinic is not proven to be the screenshot's clinic/location.

### Reported screenshot context and diagnosis limit

The visible context is **26 Oct 2026 / Today / Group Date / All Reports / All Statuses / Compare off**, with workspace location **Baner Pune**, in the reported Clinic Admin journey. The large inline controls constitute the before rendering for the authorized filter change. Clinic/location database identifiers, the actual authenticated user mapping, failing request/status/correlation, deployed revision, SQL diagnostics and UAT source data are unavailable here. The four unavailable cards and failed trend share the analytics request; they are not five independently diagnosed report failures. Preview's empty selected-clinic result and populated Super Admin result do not reproduce that failure. No hosted authentication was attempted after the user's Preview-only instruction.

## Confirmed defects — diagnosis only

### R1 — High: foreign registration summary in Operational Detail

**Affected:** Clinic Admin, Doctor, Receptionist; unscoped legacy `/reports` reads and the same paged data used by its CSV. Super Admin global visibility is intentional, not a defect.

**Reproduce:** in E1, a patient registered at foreign c3 has an authorized local visit at c1. Request `GET /api/reports?from=2026-10-26&to=2026-10-26&groupBy=clinic` as each of the three local staff identities. HTTP 200 includes a c3 row with registrations=1, although direct `clinicId=c3` is denied.

**Expected:** local visit/profile visibility must not authorize the foreign registration event or its summary. **Actual:** legacy registration SQL reuses broad patient-profile visibility without Live analytics' independent registration clinic/location guard. The result leaks a foreign grouping identifier and registration count. An explicit pinned authorized clinic/location narrows away this particular fixture; it does not secure direct unscoped reads.

**Suggested later correction:** independently authorize registration events in legacy reports, including unfiltered reads and exports; retain local visit visibility. Mirror the Live registration guard and add no-bypass regression tests. No correction implemented.

### R2 — High: malformed timing values fail the shared Live request

**Affected:** all four staff roles when the corrupt visit is included, across family views/export; operational shared metric casts have the same risky pattern but full legacy failure matrix is not claimed.

**Reproduce A:** E1 isolated appointment contains `waitMinutes:"not-recorded"`; request one-day `/api/reports/analytics?...&clinicId=c1&reportType=appointments&exportAll=true`. **Actual:** HTTP 500; sanitized PostgreSQL cause SQLSTATE **22P02**. **Expected:** report must not disappear because a historical timing field is not numeric; invalid evidence should be classified unavailable under an approved data policy.

**Reproduce B:** completed visit has consultation start `2026-99-99T09:00:00Z` and a syntactically shaped valid end. **Actual:** HTTP 500, SQLSTATE **22008**. The timestamp prefix regex does not validate a calendar timestamp. **Expected:** unavailable timing, not a workspace-wide report failure.

The shared analytics response supplies KPI cards, trend and rows, so one failure yields all those symptoms. Current UI properly does not present the failed request as zero data. This is a **possible mechanism**, not a proven diagnosis of the separately hosted UAT screenshot.

**Suggested later correction:** safely validate historical numeric/timestamp inputs before casting; preserve unknown versus zero, do not silently repair stored clinical history; verify PostgreSQL 15/16 compatibility. No correction implemented.

### R3 — Medium: Operational trend ignores selected session

**Affected:** all staff roles using the legacy Operational Detail journey. The current route discrepancy is reproduced with CA; other roles use the same trend filter construction.

**Reproduce:** E1 has three morning visits plus one afternoon visit for one doctor/branch/date. `/api/reports?...&clinicId=c1&branchId=b1&doctorId=d1&startTime=09%3A00` returns **3** visits. `/api/reports/trends` with the same query returns **4**. Both return 200.

**Expected:** a session-scoped report's chart must either honor that scope or explicitly say it is whole-day. **Actual:** the table honors session/start; trend's schema/query/UI does not forward/apply it. Legacy search likewise does not narrow its separate trend, which should be disclosed or aligned after product approval.

**Suggested later correction:** unify permitted trend/table scope and add combined-filter assertions; do not modify role authority. No correction implemented.

## Code-trace risk not functionally confirmed

### R4 — Medium candidate: legacy retained rows can appear under newly applied context

**Evidence type:** current code trace, not a separately reproduced browser failure. `LegacyReports` uses query placeholder data but renders table rows whenever `q.data?.rows.length`; it shows the loading table only for `q.isLoading`, not `q.isPlaceholderData`. Export is disabled while placeholder/fetch/error, and pagination reports loading, but the old rows may remain visible below new pills. On read error it can show prior rows with a warning. Live analytics suppresses placeholder/error data instead.

**Expected:** pending-context results must not look current. **Affected:** all legacy staff roles. **Suggested later correction:** mask or clearly mark pending-context rows and test a deliberately delayed changed-filter request. Not fixed; browser reproduction remains unverified.

## Bounded interface change

- Removed Live's inline group/type/status/clinic dropdowns and separate inline Apply, header period/Compare editors and separate custom-range panel.
- Removed Operational Detail's inline date/group row and moved its session editor into the shared drawer.
- Added compact human-readable pills to existing filter surfaces. Default period/group/type/status/compare/scope are visible; editable pills open the existing drawer at the relevant control; pinned clinic/location pills remain read-only.
- Live and Operational session selection is drafted, committed on Apply and cleared when dependent scope changes. Existing sole-session defaults remain; no session is invented.
- Communication Usage pills open the same drawer. Existing clickable channel/outcome/clinic drill-down controls now open their corresponding drawer fields rather than applying a hidden immediate filter.
- FilterBar's compact pills and drawer-field navigation are opt-in. Other listing callers retain their presentation. Long Reports pills use horizontal overflow, not a row of large dropdowns.
- Apply validates the complete mounted drawer, commits together, resets pagination and closes. Live additionally validates the API's maximum range. Cancel/Escape/outside dismissal discard; reopening starts from applied values. Reset is draft-only until Apply.
- Search, sorting/page size, exports, columns and explicit saved Views remain. Applying filters does **not** persist a named View.

Before rendering: E7 supplied screenshot and the earlier reference screenshots listed in `docs/reports-reference-acceptance.md`. Current rendered evidence and interaction limitations are recorded in the final verification section below.

## Verification and remaining limits

- Clean fixture matrix, confirmed defect reproductions and native Preview observations are described above.
- Shared library build and ClinicFlow typecheck pass after rebuilding pre-existing stale library outputs. No API schema or generated source changed.
- Production-mode frontend bundle succeeds; existing large-chunk advisory remains. This is a build, not a deployment.
- Reports and Communication Usage model/render tests pass. Date-range reference assertions were updated to remove the obsolete Reports inline picker. The shared filter-drawer suite has an unrelated existing queue selector assertion expecting `sq-list-controls`; current queue uses a differently composed header. Queue code/test expectations were not altered for this task.
- No deployed-build correctness, hosted data repair, historical reconstruction, billing accuracy, full custom-policy permutation matrix, concurrency-under-load result or Safari/Firefox interaction claim is made.

### Browser interaction evidence

One native-authenticated **Super Admin** Preview pass was completed at `/admin/reports`, with `/api/me` independently returning HTTP 200 and role `superAdmin`. No fixture identity or intercepted report response was used in that pass.

| Journey | Result / qualification |
|---|---|
| Filters and editable pills | Same drawer; Period focused From; Status pill focused Status; keyboard Enter worked. Escape restored trigger focus. |
| Transactional Live draft | Seven Days + Clinic grouping + Daily Appointment Summary + Available + Compare on caused no captured analytics request until Apply. Apply closed drawer, committed all five, page 1, one real result. |
| Cancel / Escape / outside / Reset | Dismissal discarded unapplied edits; Reset left drawer open and background applied values unchanged. |
| Validation | Reversed 31–30 Oct range and ordered >367-day range stayed open with errors on Apply, then were canceled. |
| Operational and Usage | Existing applicable editors inside drawer, no duplicate inline filter row/Apply. Usage showed 8 observed notifications, all skipped/not attempted; this UI number is not a delivery claim. Their full transactional/pinned-session combination matrix was not browser-tested. |
| Templates / Views | Template list rendered; Communication Usage template opened its existing report. Explicit Views remained available. No view creation/deletion or settings mutation. |
| Row Focus Clinic | Opened shared drawer with row clinic as a draft; background “All permitted” scope unchanged. Cancel discarded. |
| Search | Impossible query: 0 analytics requests after 50 ms, 1 after 500 ms; no matches. Removing search chip restored original result. |
| Full CSV / Details | Real one-row CSV downloaded and counted as one data row; temporary CSV deleted. Details opened with metrics and closed. Multi-page browser export was unavailable because this actual result had one row; complete multi-row backend/model checks are E1/E5, not browser evidence. |
| Failure/retry and stale detail | No injected 503/retry browser case. Details modal blocked an attempted underlying search change, so this did not establish the stale-detail guard. Live's placeholder/error hiding and export lock have code/model evidence, not a fabricated browser pass. |
| Role/context variations | Other native staff roles, custom-restricted browser identities, pinned session switching and mid-session role changes remain B. E1/E3 establish controlled SQL/policy isolation, not native sessions for those roles. |

**Rendered before/after evidence:** before = supplied UAT screenshot E7 (old inline controls). After = actual authenticated desktop drawer screenshot `onvj51`, phone pills `8sgt0t`, phone drawer `ri4nfu`, Focus Clinic draft `lp5nva`, range errors `wiiggl` / `a7ckux`, real export success `ufkj9u` and Details `msgn7e`, attached to the browser audit run. These show an interface change across different environments; they do not establish a UAT data fix.

At **1366×768**, document width was **1351 px**, pill strip **1024 px client / 1248 px scroll**. At **390×844**, document width was **375 px**, pill strip **256 px client / 1248 px scroll**. Neither had document-level horizontal overflow; pills scroll internally. The mobile drawer remained vertically scrollable with its action footer. A separate anonymous screenshot of `/admin/reports` rendered the expected staff-login page with no browser errors; protected-page verification is the authenticated pass above.

### Filter coverage summary

Period presets, custom reversed/long ranges, grouping, family, availability, Compare, search delay/clear, apply/cancel/reset/dismiss and row clinic draft navigation have actual Super Admin browser evidence. Single-day session/start, branch/doctor combined filters, scope denial, empty periods, complete multi-row exports and policy restrictions have controlled route evidence. Sorting is retained and covered by existing model/API validation rather than a fresh browser sorting journey. Pinned workspace restrictions are retained in code; full authenticated Clinic Admin/Doctor/Receptionist and hosted matrices remain blocked. No unperformed check is counted as passing.
