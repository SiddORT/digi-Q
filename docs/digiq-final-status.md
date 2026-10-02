# DigiQ final-status reconciliation — 2 October 2026

> **Superseded scope conclusion:** A subsequent comparison with the complete v3 prompt found implementation gaps in its cross-cutting requirements. The historical “local scope complete” and register counts below are not full-prompt completion claims. See [current point-by-point progress](digiq-pending-progress.md).

## Conclusion

**Local implementation/investigation scope is complete; not all137 findings are browser/UAT closed and no release certification is claimed.** Current root typecheck **passed**. Latest recursive API/UI run: **333 tests,332 passed, one stale repository-double failure**. The fixture was corrected to mirror production SQL's `passwordEnabled` projection, then the full backend-flow file passed **38/38**. **333 tests verified across combined + targeted runs**, not a clean single full run; overlapping runs are not summed. No runtime bug or production credential reread restoration was involved. Final scoped browser invitation continuation passed; no work remains running.

The appended **Current disposition register — all 137 items** in [the QA report](digiq-ui-qa-report.md) is authoritative for individual statuses. Original audit text is preserved as history. Implemented-awaiting-browser is neither a missing implementation nor a successful live retest. Existing-behavior-verified means source tracing unless expressly stated otherwise.

This documentation reconciliation performed no code edits, test execution, workflow operation or browser run. New test files are not automatically evidence of passing tests.

The register validates **137 unique dispositions, none missing:52 scoped-evidence verified,59 implemented-awaiting-browser,6 existing source behavior,10 optional policy-held,10 external,0 local pending**. These are not52 browser-covered findings,59 missing implementations or completion percentages. Tests certify cited assertions, not original UAT incident causes.

## Three current closure lists

### Implemented and verified within the stated scope

- Current root typecheck;333 source tests verified across combined/targeted evidence, with the stale fixture failure preserved in chronology.
- Local list-performance measurement/repairs and queue diagnosis; invitation/action/error/partial-result tests; authorized-visit patient SQL repair; local-master SQL/static rendering; source accessibility sweep; key-lifecycle/legacy-retirement disposable rehearsal.
- Current browser partial pass: patient listing has no unsupported badge; shared Gender select keyboard selection; required FormField inline error/ARIA/focus; draft discard and resend confirmation copy;390px/640px no document overflow. These are scoped fixture checks, not all-caller certification.
- Final same-page invitation continuation passed after dedicated CSRF route precedence corrected a fixture error: one actual app resend POST/fake sent response showed row plus toast “Set-password invitation sent”; bulk three selected gave one fake success, one503 failure and one password-enabled skip, with1 of3 sent, per-row results and summary. Findings38/40/41 have source/scoped fixture-interaction evidence; no real email or original SMTP-incident resolution claimed.
- Patient own upcoming booking notice, reload persistence and details link `/patient/appointments?view=all&search=REF` matching the request passed; app requests `statusGroup=waiting` without client patientID. Cross-tab logout passed with fake shared-server auth/BroadcastChannel: other private tab reached sign-in, no rebroadcast loop after1s. All intercepted data/responses fictional; actual server revocation remains separately isolated-tested, not live-UAT proof.
- Development guards restored exactly with no row/count/mapping changes; disposable source-migrated backup/restore passed. Neither proves production parity.

### Implemented, still needing browser evidence

- Visit-linked staff booking patient lookup; actual200% zoom, screen-reader/nested controls and unexercised signed-in role/list/dialog callers. Isolated SQL/lifecycle passes do not prove these UI cases. Patient notice reload and scoped cross-tab logout are now fixture-verified, not pending.
- Other source-wired register entries remain source-verified/awaiting-browser where their actual scenarios were not exercised, not a list of missing implementation.

### Requires actual live input, authorization or optional policy approval

- Authoritative target build/auth/schema/account readiness, original recurring-UAT data/provider diagnostics, real delivery, actual-target recovery/cutover/key/provider retirement and user-owned publication.
- Full approved JSON and literal finite-selector/bounded-preview standard interpretation; deployed network/render/load evidence.
- Optional extensions described below; none silently overrides the current explicit policies.

The historical baseline had12 pending local tasks: **23/35/77/89 performance**, **38/40/41/61/87 action/data diagnostics**, **111/125/129 key lifecycle/legacy retirement**. All twelve now have local work/evidence in [performance](digiq-performance.md), [diagnostics](digiq-remaining-diagnostics.md) and [auth compatibility](digiq-auth-compatibility.md). Local API measurement, invitation replacement/partial-result tests, authorized-visit patient SQL repair and local-master error handling are complete; disposable key-cutover/compromise rehearsal and repository retirement are complete. No local implementation gap is currently established.

## Current-policy recommendations versus optional extensions

These are **not19 required unimplemented features**. Current recommendations are done:64 optional-sign-in copy;106 unsupported mobileVerified listing/export column removed;102 no standalone clinic login helper;75 explanation of existing reschedule restrictions;83/84 existing positive/nonnegative integer minima/helpers, with no invented maximum;88 deactivate-with-history recommendation and wording already present;104 status-effects helper;93 actual supplied cooldown shown. Source completion does not certify their interactive browser presentation.

Separate optional approval-held scope remains family/consent, cross-clinic/extended-day rules, emergency bypass, new maxima, permanent deletion/retention, automatic notification channels, verified email-change policy, short-access/refresh/overlapping keys or destructive auth-schema retirement. “Do all” does not silently replace existing explicit policies. Existing fixed12h/native-default, role/privacy, queue authority, rescheduling and history-preservation rules remain intact.

## Implementation now present in callers

- Parent Clinic Group JSON date/time preferences, inherited Clinic responses and onboarding/settings/booking/ticket/queue/report consumers; resource timestamps now use configured formatting. DateFormatInput retains external invalid state. Canonical timestamps unchanged.
- Searchable selection/retained labels, name/phone/DOB/numeric validation, password visibility, timezone/phone/date controls, custom dialogs/toasts/loading/refresh, and honest staff invitation partial-success handling.
- Registration **resend endpoint and UI with 60-second cooldown**, challenge replacement and original expiry preservation.
- Onboarding Back clears stale errors without dropping values; doctor weekly-day overview, exact typed minutes/slider, clinic-hour bands and selected/all-day copy are implemented without new schedule powers.
- Notes/reasons/check-in details, completed-ticket guard, queue current-time default/distinct schedule labels, quick-switch explanation and **pending candidate call preview explicitly awaiting server**. Preview is not a falsely committed called state.
- Full-width dashboard list with booking action in workspace header; persistent patient booking notices derived from own authorized appointment records, without new notification-center infrastructure; Clinic/Clinic Group terminology and patient/location/status explanation improvements.
- Reporting filter/group/search/sort/count coverage; appointment confirmation uses **existing SMTP/template**, persists provider outcome and preserves successful booking when mail fails. Respects existing notification-enable setting; no notification center/SMS added.
- Atomic credential/session/challenge changes, login/reset race protection, superseded recovery-link invalidation and shared database rate limiting.

## Confirmed test evidence and limits

1. Current root typecheck passed; recursive333 had332 passes and one stale fixture failure; corrected complete backend-flow38/38 passed. See the performance report's fixture-parity addendum. No clean333/333 single-run result is claimed.
2. Main agent reports **13 authentication-contention tests passed**, including registration-resend protections/concurrency.
3. Main reports **six appointment-confirmation tests passed with fake transport**. No real message was sent; provider acceptance is not confirmed inbox delivery.
4. Historical root chronology:280/284, targeted8 and58 after earlier expectation/first-receipt/allowlist corrections, then321/321 zero skipped45.48s. Evidence `/tmp/replit-shell-output-logs/T2YACJF5WN1AM491ZZZRG/log`. This predates the current333 combined/targeted evidence; overlapping totals are never added.
5. Latest ticket suite: **24/24 passed**, including mixed-format records after approved-format fixture updates; `/tmp/ticket-regression-approved-formats.txt`. Workflow card may retain an older failure; current CLI result passed. Seven CSRF tests also passed separately; not included in `.test.mjs` count.
6. One fixture-browser pass: availability rendered and accepted exact `08:32`; invalid `31 Feb` blocked Continue; registration Back retained values/format preview and cleared validation; password toggle/required behavior passed; completed appointment row had no Ticket action. Original availability crash **not reproduced**, not diagnosed as a wrong route. Main separately reports the specific trailing-hyphen slug keystroke fix proven.
7. Historical browser found mobile registration overflow, then **verified repair at390×844 for Locations and Opening hours**: document375 within viewport390. Protected-action401 reached `/sign-in`; **one POST, no retry**, after mock-CSRF setup correction. No real users/email. Cross-tab/logout and patient notices were untested in that pass; current scoped fixture checks above now pass. Live revocation/UAT is not browser-certified.
8. Queue SQL pagination/guest search, same-lock summary/full-list compatibility/privacy and real contention pass in321. Ten lifecycle tests cover401/no replay,60-second status polling, cross-tab logout and stale/abort safety. Demo actions use custom confirmation/friendly errors. All fixture checks remain distinct from live UAT.

## Precise remaining verification and external scope

This is the remaining evidence/authorization boundary, not a proposal for follow-up tasks or a list of unimplemented local features.

1. **Remaining interactive coverage.** Current tester's exact scoped pass list is above, including invitations, patient notice/reload/link and cross-tab logout; earlier Locations/Opening-hours390×844 and protected401 checks passed. These do not prove all listings, dialogs, role screens, visit-linked staff booking lookup or dataset variations. [Accessibility coverage](digiq-accessibility-coverage.md) records source repairs and8/8 contracts, not full opened-control/screen-reader/200%-zoom certification. No aggregate browser-findings coverage claim.
2. **Exact standard interpretation/certification.** Full approved JSON remains unavailable. Finite native selectors and bounded dashboard/feed/public summaries were inventoried; their accessible source behavior is not a blanket literal every-dropdown-searchable/every-collection certification. Missing JSON does not block the already completed functional repairs.
3. **Actual deployed latency.** Local benchmark/diagnosis for23/35/77/89 is complete. Doctor20 median69.65→32.20ms; staff20 query count23→3; branch100101→2 in the stated disposable fixture. Queue remained20 statements; no queue speedup claimed. Browser/render/network, auth overhead, deployment load/hardware and original incident latency remain unmeasured. Five broad queue membership reads are documented, not speculative evidence for changing shared safety code.
4. **Exact original-UAT incident attribution, only where still reproducible.** Availability/weekday/queue incidents have fixture evidence but no original reproduction. Invitation38/40/41 means replacing invitations, not revoking sessions/deactivating; original503 still needs actual delivery diagnostics. Patient61 now has a real authorized-visit SQL repair, but Deepa's exact deployed context is unavailable. Address87 uses local city/state/country/area/pincode masters; actual deployed catalog/response remains unknown, not a proven geocoder-key gap. No account/catalog mutation to make screenshots pass.
5. **Authoritative target/auth cutover and real delivery.** Actual UAT/VPS build/mode/middleware/proxy/schema, account/password/invitation readiness, real recovery/setup/patient-code/appointment mail, provider configuration retirement and actual signing-key replacement remain unverified/authorization-gated. Repository111/125/129 work is complete. Ordinary staff login remains SMTP-independent, fixed12h/native-default; no unapproved refresh/overlap.
6. **Actual-target recoverability and publication.** Disposable source-migrated backup/restore passed; not production backup/recovery proof. User owns Publish/schema-diff/rename review and release decision; no unconditional cutover/publish readiness claim.

## Development readiness and anonymous UAT evidence

- Development aggregate inventory:17 users/9 clinics/6 branches/7 doctors/3 appointments; normalized-email collisions0/0. **14/14 active development staff lack password material**; this is not proof about published accounts and does not authorize resets.
- Initial inventory found three existing booking unique guards absent. Separately authorized development-only restoration used exact migration definitions after duplicate0/0/0 and alternative-guard0 preflight, repeated under transaction lock. Now **3/3 booking guards and7/7 source unique guards**; counts/mappings identical and no rows changed. This gap is repaired, not carried forward as missing. No blind DB repair or production DDL.
- Disposable backup/restore applied all14 source migrations, restored to a separate empty database, matched schema and aggregates20 tables/67 indexes/80 constraints/10 enabled application triggers, and passed8 guard-rejection assertions. No live backup/restore or real-target recovery claim.
- Actual anonymous UAT reads: root/sign-in HTML200 without HSTS; health200 with HSTS; auth/status200 anonymous/no-store with HSTS. Public reachability/header observations **do not prove authenticated source parity, cookies, CSRF, expiry or role authorization**.
- See [release readiness](digiq-release-readiness.md) for exact boundaries. No credentials, secrets, live email or published account changes were made by this reconciliation.

## Safety and evidence boundaries

### Auth lifecycle completion addendum — disposable evidence

- Command: `node --test artifacts/api-server/src/native-auth.integration.test.mjs artifacts/api-server/src/jwt-session.test.mjs artifacts/api-server/src/auth-http.integration.test.mjs artifacts/api-server/src/auth-contention.integration.test.mjs artifacts/clinicflow/src/auth/auth-retirement.test.mjs`.
- **33/33 passed, zero skipped, 21.77 seconds**; evidence `/tmp/auth-retirement-rehearsal-final.txt`. This overlaps prior321 and must not be added to that count.
- Existing isolated tests plus new cutover/compromise tests prove old-key rejection despite an unrevoked row, new-key login, fixed12h lifetime, tamper rejection, missing-DB-proof rejection even with the signing key, logout/user revocation, old-key restoration hazard and durable all-session cutoff preventing resurrection. Native-default opaque sessions survive an unused JWT-key change. IDs/email/role/status/password hash/provider mapping remain identical. No SMTP calls/challenges from ordinary login.
- HTTPS/real Express test proves missing CSRF403 precedes retired endpoint410, no-store response, no Set-Cookie/session/email. Direct disposable tests additionally reject valid historical challenges without consuming their stored hashes. Frontend source regression verifies removal of the dead branch/helper.
- OpenAPI generation, library build/typecheck (`pnpm -w run typecheck:libs`), API package typecheck and `git diff --check` passed. UI package typecheck at this run reported out-of-scope errors in `Users.tsx:180` (nullable invitationFeedback) and `staff-controls.ts:6` (not all paths return); no auth-file error was reported. The earlier full typecheck result is historical, not this run's certification.
- Static screenshot of already-running anonymous `/sign-in` at1280×850 shows the native email/password form rendering; no interactive login, signed-in UI, tester, UAT or delivery verification was performed.
- These changes do not modify actual environment/secrets, deploy, seed, send real email, run old provider fixtures or change native-default policy. Only disposable test-process configuration changes. Actual incident revocation/key replacement remains separately authorization-gated.

- Original screenshots resolve target identity only. #24 is render failure; #82 is conditional exception-session requirement; #102 is **location credentials**, not SMTP.
- Main applied approved **development JSON default backfill to nine clinics**; the later authorized development-only restoration of three existing unique indexes is recorded above. Counts/mappings preserved; production unchanged. Rehearsal data remains disposable.
- No JWT activation, real email send, live UAT login/enrollment action or production deployment is asserted.
- Accounts/hashes/roles/ownership/assignments and canonical records remain protected. The 24 passing ticket browser checks cover screen/export formatting, freshness and QR behavior; live printer/UAT certification is not claimed.
- Publishing remains user-owned and approval-gated. Current recommended local scope, browser evidence limits, optional policy extensions and actual-target prerequisites are separated—not indiscriminately labeled unimplemented features or release-ready.