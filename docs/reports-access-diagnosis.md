# Reports access and correctness diagnosis

**Date:** 31 October 2026. **Result:** diagnosis complete; no repairs applied.

## Conclusion

The current code has a **confirmed conditional authorization defect**: a staff
account with a clinic-bound custom role denying `reports:read` can open the
top-level Operational report for an allowed clinic, but nested report requests
lose that same explicit clinic scope and return 403. This is now reproduced
through actual Express routes and saved disposable policies, not just an
extracted function with a stub policy provider.

**This is not yet the proven cause of the reported hosted UAT incident.** No
authorized authenticated UAT session or failing UAT response was available. The
user could not provide sanitized request details. Available environment secret
names alone do not establish an authenticated session, the affected account's
identity, or permission to reset credentials. No login bypass, account change,
policy edit, production query or hosted verification was attempted.

The prior audit also records the user's instruction to keep checks in Preview.
Neither that prior Preview evidence nor this disposable test run establishes
what happened in hosted UAT.

## Prioritized findings

All **confirmed** findings below concern current source/disposable execution,
not authenticated UAT. “Recommended correction” means future work requiring
approval, not a change made in this investigation.

| ID / priority | Affected surface | Current evidence and reproduction conditions | Recommended correction |
|---|---|---|---|
| A1 / High — foreign registration summary exposure | Operational Detail, including its paged CSV source; Clinic Admin, Doctor, Receptionist | Reproduced: a patient registered at foreign c3 has a permitted visit at c1. Unscoped `/reports?groupBy=clinic` includes c3 with registrations=1 for all three roles, although explicit c3 access is denied. Live analytics independently excludes this foreign registration correctly. | Authorize registration events separately from patient-profile visibility in legacy reports; cover unscoped reads and exports without removing legitimate local visit access. |
| A2 / High — allowed scope discarded | Live Reports, Operational trend, Communication Usage and nested detail; clinic-bound restricted staff | Real-route tests: with denial bound only to c2, `/reports?clinicId=c1` returns 200 and c2 returns the intended clinic-denial 403. `/reports/analytics`, `/reports/trends`, `/reports/communication-usage` with either explicit clinic return the **scope-selection** 403. Branch-only and clinic+branch inputs fail similarly on nested paths. Verified for all three configurable staff base roles. Usage is otherwise available only to administrators. | Introduce route-aware trusted scope resolution before custom-role enforcement. Preserve global denials, forbidden clinics, ordinary role/ownership checks and no-scope protection. Do not simply exempt Reports from policy. Resolve detail scope from the record rather than blindly trusting query input. |
| A3 / High — malformed historical timing breaks analytics | Live KPIs, trend, rows, details availability and export; all four staff roles when affected record is included | Reproduced HTTP 500 with non-numeric `waitMinutes` (SQLSTATE 22P02) and timestamp-shaped invalid calendar date (22008). All seven non-outcome-selected families fail in the fixture; no-show/cancellation selections exclude that fixture and succeed. This is not evidence that UAT contains those values. | Validate safely before numeric/timestamp casts; keep missing/invalid duration unavailable, not zero; do not silently rewrite stored history. Verify actual supported PostgreSQL versions. |
| A4 / Medium — trend and table disagree | Operational Detail; all four staff roles | Prior scenario rerun: morning table 3 vs trend 4. New independent fixture confirms table 2 vs trend 3 for SA/CA/Doctor/Receptionist. Same permitted clinic/location/doctor/date/start query, both HTTP 200. Trend query omits session/start predicates; legacy grouped search also does not constrain its separate trend. | Align supported table/trend scope, or explicitly disclose intentionally different scope. Add combined-filter assertions. |
| A5 / Medium — denial reasons indistinguishable | Reports error presentation | Source-confirmed: `friendly-error.ts` maps every HTTP 403 to the same access-denied text. Global policy, custom global denial, missing custom-role scope, forbidden clinic and ordinary context denial have distinct safe server messages but look alike. | Return/use stable safe reason categories and tailored guidance; do not expose raw policy contents or provider/database errors. |
| A6 / Follow-up candidate, not runtime-confirmed — old context rows | Operational Detail | Current source still renders placeholder rows while new context is fetching. Exports are disabled while fetching/placeholder/error. No delayed-request browser reproduction was performed in this investigation. | Reproduce with delayed filter changes, then mask or explicitly mark old-context rows if confirmed. |

### Exact authorization trace for A2

1. `requireUser` finds the fixture account, applies the saved workspace and
   checks staff session proof, then calls `enforcePermissionPolicy`.
2. GET `/reports/...` maps to `reports:read`. A global permission-policy denial
   rejects first, as intended.
3. `enforceCustomRoles` loads the **saved disposable** `custom-roles` row.
   A matching global binding rejects intentionally. A clinic-bound binding
   continues to scope resolution.
4. It reads query/body `clinicId`; a supplied branch resolves its clinic.
5. In `custom-roles.ts`, `reports` has no record table, and the nested-path rule
   clears `clinicId` for paths with more than one segment.
6. The nonempty-scope assertion then rejects with:
   **“Select a clinic scope before using this operation with your assigned role”**.
   It fails before report-specific context checks or report SQL execute.

Saved workspace c1 does not repair this discarded request scope. Unrestricted
staff do not enter this conditional scope check. Super Admin remains exempt.
Global policy and global custom-role denials correctly reject both top-level
and nested routes; those are not defects.

## Coverage and results

These are current disposable route/SQL checks and Node model/render/source
checks, **not a native-login browser matrix**.

| Surface | Roles and boundaries | Filters, consistency, details and export evidence |
|---|---|---|
| Live Reports | SA/CA/Doctor/Receptionist clean-data reads pass. Doctor gets own visits; receptionist assigned locations. Foreign clinic/branch/doctor denied, including full exports. Patient 403, anonymous 401. Global restrictions deny intentionally; clinic-bound nested defect A2 confirmed. | Nine families checked for each staff role. Audit/reschedule families intentionally have no rows for Doctor/Receptionist. Independent oracle: 6 local visits, 2 completed, 1 cancelled, 1 no-show, 2 distinct patients, 1 authorized registration, 20 recorded consultation minutes, 2 reschedule actions on 1 appointment. Summary/trend/detail metrics agree in single-group scenario; prior period, date/clinic/doctor grouping, combined location/doctor/start, family/group search, availability, empty data, pagination and complete export checks pass on clean data. Timing corruption A3 fails. |
| Report Templates | Built-in and saved configurations are entry points to Live, not separate executions or permission grants. Usage entry is administrator-only. Clinical report opening retains the workspace location gate. | Current render/model/source checks pass family list, saved configurations, empty state, relative-period resolution, scoped visit links, all detail metrics and CSV escaping/completeness/refusal. Missing saved views have an explicit unavailable state in source. No template or saved view was created/deleted; no current browser interaction or saved-view HTTP mutation tested. All families are displayed to Doctor/Receptionist, but audit families open no eligible rows, not extra authority. |
| Operational Detail | All four staff roles checked; normal explicit scope enforcement and denial remain. Foreign registration defect A1 affects non-SA unscoped reads. | New independent scenario checks date/clinic/doctor grouping, descending key paging, unique page keys, whole-page visit/cancellation sums and matching/unmatched grouped search across all four roles. Session mismatch A4 confirmed for every role. Source inspection shows CSV fetching all pages and rejecting changed totals/duplicate keys rather than silently exporting a subset; its client download was not executed. Operational has no Live-style row-details drawer or previous-period comparison; its separate trend and multi-request CSV lack one-snapshot guarantees. |
| Communication Usage | SA global; CA currently owned clinics only, including multiple owned clinics. Doctor/Receptionist/Patient denied, anonymous 401. Foreign detail 404; forbidden clinic/source/user 403. Current ownership is rechecked. A2 can reject an otherwise eligible restricted CA before these checks. | Current route tests pass known-source totals (13 global, 9 owning-clinic in the principal fixture), outcome buckets, clinic/user/location/event/recipient grouping, recipient/actor filters, source/date/status filters, cursor stability, legacy/undated history, retention, masked read-only details and foreign exclusions. Additional 20,000 fictional records retain bounded pages with whole-scope aggregates. Model/source checks cover date presets, UI controls and read-only behavior. Source inspection confirms channel filtering and a full-breakdown CSV path, but no browser download was executed; no free-text search or previous-period trend is offered. Accepted is not delivered or billed. |

### Reproducible checks

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/reports-access-diagnosis.integration.test.mjs \
  artifacts/api-server/src/reports-audit.integration.test.mjs \
  artifacts/api-server/src/report-analytics.integration.test.mjs \
  artifacts/api-server/src/communication-usage.integration.test.mjs \
  artifacts/clinicflow/src/components/reports/reports.test.mjs \
  artifacts/clinicflow/src/components/communication-usage.test.mjs
```

The five pre-existing files passed **23 checks** in the combined run. The new
diagnosis file initially expected 404 for a syntactically invalid detail ID;
the real route correctly returned 400. The fixture was corrected to use a valid
nonexistent record ID, and the expanded diagnosis file passed **2/2** on rerun.
Final evidence is therefore 23 unchanged passing checks plus 2 new passing
checks, not a claim of a fresh combined 25-check run.

The harness uses disposable PGlite with checked-in migrations, actual routers,
actual SQL, `findUser`, workspace application and both policy implementations.
It injects fixture identity/session-proof fields; it **does not** verify native
authentication or a deployed session. Policies and all other writes exist only
inside the disposable database. Passing diagnosis tests intentionally assert
existing defects; they do not mean Reports is repaired.

## Hosted incident: unresolved evidence, not a claimed resolution

The earlier audit describes a reported Clinic Admin screenshot for 26 October,
Today, Group Date, All Reports/All Statuses, comparison off, with a selected
workspace location. It does not contain the failed request or safe server
response. KPI cards and trend share one analytics request, so multiple failed
sections do not establish multiple independent backend failures.

To identify the incident cause, an authorized operator would need only:

- failing GET path and sanitized report filter identifiers, HTTP status and safe
  response `error`/`code`;
- timestamp/timezone and request correlation ID if available;
- effective application role, active workspace and authorized clinic/location
  scope, with personal/account names omitted;
- whether a relevant global Reports denial or matching clinic-bound custom-role
  Reports denial is saved for that account; and deployed revision.

No password, session cookie, authorization header, raw HAR, patient list,
message body or complete settings dump is needed. The user was asked and could
not supply this evidence; no further technical collection is assigned to them.
An authorized maintainer can obtain it later during a read-only UAT session.

If the failed request is nested, returns the scope-selection reason, and the
account has a matching clinic-bound denial, A2 explains that rejection. A global
denial or outside-scope reason would instead indicate intended restriction.
A 500 would require separate sanitized server diagnostics; A3 is only one
candidate. **The screenshot alone cannot choose among these causes.**

## Scope integrity

Only a diagnosis test and tracked audit documentation were added. No application
behavior, role policy, account, saved view, business data, workflow, migration,
message transport or deployment was changed. Prior Preview observations remain
historical evidence in `reports-functional-audit.md`, not new UAT proof.
