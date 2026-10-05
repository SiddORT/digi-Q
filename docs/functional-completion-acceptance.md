# DigiQ — 41-point completion and acceptance record

This is the current acceptance ledger. Older reports are historical evidence, not current completion certificates.

## Scope and evidence rules

- Implement the remaining functionality, preserving native authentication, clinical permissions, individual check-in and existing patient records.
- Real email delivery and deployed end-to-end acceptance are deferred by the owner. Do not send test emails, publish, or mutate existing live accounts during this pass.
- Local implementation, automated checks, and rendered checks are separate evidence categories. A disabled control, adapter without a caller, passing source check, or fictional browser response does not establish a working live journey.
- No percentages or blanket completion claim until every item has an explicit disposition.
- No notification preview may expose clinical notes. Workspace selection must only narrow existing access.

## Point-by-point ledger

Implementation is complete for the functionality listed below. “Deferred” means owner-deferred deployed/device acceptance, not an unimplemented feature. Existing-page evidence is retained rather than relabelled as fresh end-to-end testing.

| # | Requirement | Final disposition / evidence |
|---|---|---|
| 1 | Title Case and consistent wording | Implemented; label/casing tests pass. |
| 2 | Consistent buttons | Implemented; shared contracts pass; prior desktop/touch rendered evidence retained. |
| 3 | Compact listings and responsive More controls | Implemented; prior layout/state-retention evidence retained. |
| 4 | Full-text disclosure | Membership and notification titles now use shared OverflowText; source checks pass. |
| 5 | Shared design consistency | Existing compact design retained in new components; exhaustive deployed visual acceptance deferred. |
| 6 | Public header/hamburger | Implemented; prior responsive/focus checks retained. |
| 7 | Public/auth layouts and states | Implemented; local regressions pass; deployed submissions deferred. |
| 8 | Invitation/setup/recovery | Implemented; local auth/backend tests pass. Real delivery/deployed journey deferred. |
| 9 | Camera scanning | Implemented; physical-camera acceptance deferred. |
| 10 | Sidebar/favorites/recent/search | Implemented; existing navigation tests retained, new result links unit-tested. |
| 11 | In-app notifications | Implemented; real history/audit data, persistent per-user reads, 60-second refresh; scoped HTTP integration tests pass. |
| 12 | Unsupported Mentions tab | Removed; All/Appointments/Queue/System are functional. |
| 13 | Workspace switching | Implemented; server narrows assignments, audits selection; cache cleared/reload; scope tests pass. |
| 14 | Global queue/report search | Implemented; scoped visit search and actual report-group search with explicit date range and exact destinations. |
| 15 | Saved views | Implemented; account sync and scoped staff sharing; legacy device views remain usable and explicitly importable. |
| 16 | Profile-menu keyboard interaction | Implemented; focus, arrows, Home/End, Tab and Escape support. |
| 17 | Listing controls/exports | Preserved; frontend suite passes; previous export browser evidence retained. |
| 18 | Patient appointment timeline | Preserved; existing paging and state checks retained. |
| 19 | Patient-wide activity | Implemented; independent paginated scoped status-history endpoint; HTTP tests pass. Not a full clinical-record system. |
| 20 | Patient documents | Implemented; authenticated upload/list/download/delete, validation, scoped access, audit. HTTP tests plus real private-storage byte round-trip/delete pass. |
| 21 | Report trends | Implemented; daily scoped aggregates, zero days and one-year bound; HTTP tests pass; chart includes an accessible data table. |
| 22 | Queue operations | Preserved; full backend suite covers operational/lock guards; no bulk check-in. |
| 23 | Clinic Admin staff creation | Existing implementation retained; local backend creation/ownership tests pass. |
| 24 | Super Admin onboarding | Existing implementation retained; local onboarding/rollback tests pass. |
| 25 | Doctor receptionist creation | Existing implementation retained; role/assignment tests pass. |
| 26 | Complete staff onboarding | Local implementation/tests complete; real invitation/sign-in acceptance deferred. |
| 27 | Administration forms/permissions | Preserved; new alias routes enforce underlying module and custom-role restrictions; HTTP denial tests pass. |
| 28 | Patient workspace | Own history/activity/documents reachable through Profile → View My Records; server uses authenticated patient scope. Local access and UI wiring tests pass. |
| 29 | Ticket/QR behavior | Unchanged; prior 24 ticket-browser checks retained, not claimed as rerun. |
| 30 | Full patient journey | Local functionality retained; deployed end-to-end acceptance deferred. |
| 31 | Notification tabs accessibility | Implemented IDs/relationships, roving focus, arrows, Home/End; helper tests pass. |
| 32 | Patient Details tabs accessibility | Same shared tested tab behavior implemented. |
| 33 | Workspace truncation accessibility | Shared full-value disclosure implemented for workspace names. |
| 34 | Loading/error/empty/forbidden states | Implemented in new query/mutation surfaces; local contract and HTTP failure checks pass. Full rendered acceptance deferred. |
| 35 | Nested overlays/focus | Existing focus-return behavior retained; new menu/tab keyboard handling tested locally; deployed nested-flow acceptance deferred. |
| 36 | Real screen reader | Deferred to deployed/device acceptance; ARIA/source tests are not a screen-reader certification. |
| 37 | Native browser zoom | Deferred to actual-browser acceptance; no claim that CSS viewport tests prove native zoom. |
| 38 | Role coverage | Prior 59-route evidence retained; new scoped endpoints exercised with fictional identities and real SQL/permission logic. Deployed role acceptance deferred. |
| 39 | Automated tests | 292 frontend tests pass. Full backend suite passed 249 before final focused additions; final feature suite 21/21 passes. Typechecks and whitespace checks pass. |
| 40 | Documentation reconciliation | This ledger and implementation report supersede older missing-feature/verification statements. |
| 41 | Final acceptance | Functional implementation/local checks complete; deployed/live/device acceptance explicitly deferred, not falsely marked passed. |

## Verification details

- Full backend command: `node --test --test-concurrency=1 artifacts/api-server/src/*.test.mjs`. The earlier full run passed 249 tests; subsequent focused tests added permission-denial and deep-link cases. Counts from overlapping runs are not summed.
- Final feature command: `node --test artifacts/api-server/src/functional-features.integration.test.mjs artifacts/api-server/src/feature-policy.test.mjs` — 21 pass.
- Final frontend command: `find artifacts/clinicflow/src -name '*.test.mjs' -print0 | xargs -0 node --test` — 292 pass.
- Typechecks: shared libraries, API server and ClinicFlow — pass.
- Configured private document storage: created a synthetic text object, read byte-identical contents, deleted it, confirmed it was absent. No patient file or real account was used.
- Migration journal/schema parity tested in a disposable database; additive development migration applied. No production migration or deployment performed.
- API/UI workflows start successfully. Public homepage rendered without browser errors. Actual running notification/workspace/saved-view endpoints returned 401 without authentication, as required. Protected-screen browser end-to-end acceptance remains deferred.

## Explicit product limits

- Notifications show the latest 60 appointment/queue updates and 30 system updates within 30 days, with counts/read-all scoped to the displayed list. Patients also receive their own booking/status events; staff own-action noise is excluded.
- Documents are clinical workspace records: staff upload; authorized patients may read their own documents; deletion requires uploader/admin rights and permission-policy approval.
- Patient activity is appointment status history, not diagnoses, prescriptions or a complete medical record.
- Report search covers an explicitly shown 30-day window; trend ranges support up to one year.
- Saved-view import is opt-in; local copies are never deleted or silently uploaded.

## Publication boundary

Nothing in this ledger authorizes publishing or establishes production migration, email-provider, deployed-account, backup or live accessibility readiness.
