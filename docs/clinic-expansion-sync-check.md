# Clinic expansion sync check

Final solo-owner update: the complete current API/frontend test run passed
**146/146**. Actual one-account solo onboarding, settings/profile reload,
bookings and consultation queue operation passed in the browser. Review fixes
preserve inactive-doctor management, allow removing inactive clinical selections,
and reject mismatched public clinic/branch filters. Solo fixture cleanup is DONE:
zero owned clinical records, local users or session proofs remain; the provider
account deletion was verified. Production is untouched. Current release guidance
supersedes the historical function-migration and reduced-release blockers below.

## CURRENT implementation and verification

Solo consulting uses the existing pre-0008 production ownership functions:
Clinic Admin retains their clinic-only assignment and clinic-wide administrative
access; selected clinical branch IDs live in `doctors.data.branchIds` on a
self-owned doctor profile. Central active effective membership governs public
discovery, counts, availability, booking, scheduling and queue transitions.
Management visibility is separate: the owner may list/edit/reactivate an
inactive doctor/profile with its selected branch form data, but public discovery
and booking cannot use it until active. No custom SQL/function migration or
ownership-guard weakening is required for this design.

All **117 API tests passed**, including disposable pre-0008 exact function
hashes/ten enabled triggers, solo and ordinary doctor regression tests, foreign
owner denial, inactive owner-profile reactivation, branch-subset discovery,
booking capacity and queue actions. Main-agent root/API/frontend/deck/scripts
typechecks passed. An unrelated mockup-sandbox Vite plugin version conflict
means full workspace typecheck must **not** be claimed.

The latest development browser journey submitted a real single-branch six-step
wizard with `ownDoctor:true`, using one real Clerk fixture and actual app-password
confirmation, no invite/second user. `/me` returned 200 with `clinicAdmin` and
`doctorId`; settings, own profile and admin menus survived reload. Friday UTC
full-day schedule, two name-only bookings, On break/Available calling, check-in
and checkout with automatic next call (not automatic consultation) passed. This
does not establish new Clerk signup or invitation email delivery. Production
is untouched and unpublished; fixture cleanup is pending. Review the actual
managed Publish diff for ordinary indexes/guest uniqueness before user-controlled
publication; no custom-function changes are planned.

## Historical earlier sync evidence (superseded where release claims differ)

## Scope and evidence

Reviewed existing phase-one, list-query, backend-flow, queue-contention and frontend tests before adding coverage. Existing tests already covered settings-service parity/inheritance, immutable URLs, attaching the consulting-admin capability, ownership triggers, broad SQL pagination/authorization, and nullable actual TAT. Added two route-level regressions to the existing phase-one harness rather than duplicating those services or creating another fixture engine.

The focused automated verification uses isolated PGlite PostgreSQL execution and actual Express route handlers, generated request validation, transactions and SQL list/count queries. Internal actors replace `requireUser`; this proves domain behavior, **not Clerk authentication or browser acceptance**. That focused run used no application listener, browser, production connection or existing user-data mutation. The fixtures reset only the isolated in-memory database. Separate confirmed main-agent browser evidence is recorded below.

Focused command:

`node --test --test-name-pattern='shared settings routes|consulting admin retains|clinic settings parity|admin clinician capability|actual TAT' artifacts/api-server/src/phase-one.test.mjs`

Result: **5 passed, 0 failed**, including both new tests. Frontend `pnpm --filter @workspace/clinicflow typecheck` passed. Unaffected suites were not rerun.

Subsequently, a browser-discovered staff-assisted name-only patient creation 500 was fixed: mobile verification preservation requires an existing record before dereferencing it. Its focused real-route SQL regression passed for new patients with mobile omitted/present and edits preserving verification only when mobile is unchanged (changed/removed clears it).

Latest main-agent verification: **120/120 combined unit/regression tests passed**, full workspace typecheck passed, and the new disposable-PostgreSQL migration test passes all **12 migrations plus runner replay**. Prior **16 exact-trigger PostgreSQL contention/ownership tests** remain valid prior evidence, not a freshly rerun result.

## Confirmed main-agent browser acceptance

- The isolated owner's actual Clerk session and app password confirmation reached the real six-step registration wizard. Two branches and `ownDoctor:true` submitted atomically; role remained Clinic Admin and settings reload returned 200. Earlier proof failures were resolved with correct routing and ready app/network, not weaker security. New Clerk signup and email delivery are not claimed.
- Two isolated sessions began at five places each. Two staff-assisted name-only PM bookings received tokens 1/2; AM stayed five, PM three. On break/Away disabled Call next. Available allowed called state, check-in began consultation, and checkout automatically called the next patient without starting that consultation.
- A separate fresh anonymous request returned 201/pending with no capacity reservation. Owner approval allocated PM token 3; PM became two and AM stayed five. Public token feed exposed no leaked PII. The authenticated staff booking form was not treated as anonymous guest evidence.
- Fresh Super Admin password proof and `/api/me` 200 preceded exact-test-clinic phone update 200. Fresh owner proof and `/api/me` 200 preceded reading the same persisted phone. A foreign admin, after successful proof and `/api/me` 200, received target settings 403 and clinic list 200 excluding the target.
- Public branch booking rendered at 390px. Mobile owner Clinics had no horizontal overflow and its filter popup fit. A table-label collision was found and CSS corrected by the main agent; final screenshot verification remains pending.
- The earlier existing-development-clinic phone edit was restored using a phone-only compare-and-set with the original audit retained and a correction audit added. It is an isolation incident, not acceptance evidence; see the progress document. Current isolated fixture cleanup remains pending. No production modifications are claimed.

## Newly verified

- Two independent clinic owners, a foreign consulting admin and persisted foreign receptionist/assignment. Owner and Super Admin PATCH the same clinic configuration and receive identical GET results. Email inheritance updates immediately, a separate phone override remains unchanged, weekly hours round-trip, and both booking-policy fields persist.
- Foreign Clinic Admin and foreign receptionist cannot GET or PATCH those settings (403). The first owner cannot read the second clinic's settings; the second owner still reads its unchanged clinic.
- An owning Clinic Admin with its own doctor capability can book its own doctor **and both other doctors in its clinic**, including another branch outside the capability's branch assignment. Foreign-clinic booking attempts fail in both directions.
- Actual `/patients`, `/appointments` and `/doctors` route responses give matching scoped totals to owner and Super Admin before pagination: four registered patients, three doctors and three visits, with page size one.
- Doctor/branch/date/status filters yield one expected visit; patient search gives the expected count. Explicit foreign-clinic filters return zero rows/counts to the owner and reciprocal foreign owner; Super Admin sees the foreign patient.
- A foreign-registered patient with a subsequent authorized visit becomes readable by the owning admin through the existing visit-based rule. The patient's other clinic owner does not gain access to that visit. No duplicate patient implementation was introduced.

## Actual frontend synchronization review

- `resources.tsx` uses `[resource, user.id, user.role, listParams]`; filters, pagination and actor identity therefore distinguish list caches. Resource save/delete, QR regeneration and settings/profile mutations invalidate the existing QueryClient globally, reaching both these custom resource keys and generated endpoint keys.
- `ClinicSettings.tsx` uses the generated clinic-ID settings key, 30-second polling, and shared GET/PATCH endpoints for both admin roles. Save and own-profile attachment invalidate queries. Resource lists, appointments, dashboard, reports and doctor-clinic lists already poll every 30 seconds.
- Generated clinic/appointment list keys include request parameters; settings keys include the clinic ID. `App.tsx` clears the QueryClient when Clerk user identity changes; explicit sign-out also clears it. Generated keys themselves do not contain actor identity, so that reset is material to isolation.
- Fixed bounded freshness gaps in the permitted files: master lookup, the clinic-settings owner-clinic discovery query, navigation-dialog branch list and doctor network assignment catalog now have 30-second polling. No alternative cache, endpoints or data source was added.
- Queue/session queries already poll at 30 seconds; guest requests at 20 seconds. Resource-role defaults and queue `isDoctor` checks depend on the actual `doctor` role, not mere presence of a doctor ID, so a consulting admin is not narrowed to its clinical capability.

## Remaining acceptance gaps

- Core authenticated registration, queue lifecycle, separate anonymous approval and cross-role settings/privacy now have the browser evidence above. Form preservation under refetch, uninterrupted cross-session propagation and broader responsive/keyboard cases are not exhaustively verified. Real Clerk signup/email delivery and all legacy Phase 1 cases are not claimed.
- Follow-up authorized selector fixes close the remaining identified polling gaps: `ResourceLookup.tsx` remote options and selected hydration, and `SessionQueue.tsx` summary doctor list now poll every 30 seconds with `refetchIntervalInBackground:false`. Existing query keys/caches remain; no new store was added. Selected hydration re-fetches selected IDs instead of skipping IDs already present in the label cache, and respects disabled selectors.
- Patient `clinicId` filtering follows the stored registration clinic, whereas patient authorization also admits an authorized visit. Appointment clinic filters describe visits. The patient filter and its active chip now say **Registration clinic** to avoid implying a visit-clinic filter. This is a label-only change: the default remains unfiltered and includes patients visible through authorized visits; no patient visibility or API behavior changed.
- The focused regression work did not alter authentication or migration files and does not replace prior historical-trigger coverage. Separate main-agent migration readiness evidence is stated above.
- **Historical release gate, superseded:** the earlier admin-branch-assignment design was blocked because managed Publish omitted custom ownership functions. The current effective-membership design works against pre-0008 functions and has no custom-function rollout prerequisite. The ordinary index/guest uniqueness diff still needs review and production remains unpublished. See [current plan](clinic-expansion-release.md).