# Consulting-owner booking verification


## Current incident boundary (2026-10-22)

**User-supplied UAT SQL confirms the first persisted discrepancy: no doctor row
is linked to the owning Clinic Admin account. The historical cause and safe
repair remain unverified. No live data repair, permission change, notification
delivery, or deployment was performed.**

The user confirmed that `https://uat.digi-q.in` is hosted on their own server
and receives code developed in Replit via Git. It is not this workspace's
Replit-managed deployment. Code delivery through Git does not by itself
recover the missing UAT profile. Keep any code correction, the user's server
rollout, and an explicitly approved UAT data-recovery action separate.

The supplied screenshot
`attached_assets/Screenshot_2026-10-22_at_11.49.29_AM_1792649974513.png`
shows **Super Admin** at `https://uat.digi-q.in/admin/book`, with Kushan Clinic,
dombivali, Doctor “Not assigned,” and the successful-zero assignment explanation.
It does not expose saved IDs, the authenticated response, or a deployed revision.
Preserve the original owning Clinic Admin report as a separate case.

### User-captured UAT request and response

The later Network screenshots and supplied response establish this bounded
request from the reported failing booking page:

```text
GET https://uat.digi-q.in/api/doctors
  ?status=active
  &clinicId=99174216-168e-469a-995f-60b527d362bf
  &branchId=b3b18641-d053-4d92-9f1e-58cbbb9e22d5
  &page=1
  &pageSize=20
HTTP 200
Cache-Control: no-store
```

```json
{"items":[],"total":0,"page":1,"pageSize":20,"totalPages":0}
```

Source: user-captured UAT Network evidence, not an authenticated request executed
by this workspace. The capture pins the observed symptom to the API result:
the page did not discard a doctor returned by this particular request. It does
not establish which eligibility, identity, persisted mapping or deployed-code
condition produced the zero. Response `no-store` alone does not prove that all
client-side query state was fresh. No session/header credentials are retained
in this report or used for investigation.

The user subsequently supplied the same session's `/api/me` identity fields:
`role: "superAdmin"` and `doctorId: null`, together with a stable actor ID.
This confirms the reported Super Admin actor in user-captured API evidence;
it is not an independent workspace-authenticated read. A Super Admin need not
have a personal doctor profile to discover another eligible consulting doctor.
The saved doctor/user/location state and serving UAT revision remain outstanding;
the separate owning Clinic Admin comparison is recorded below.

The user then opened the same bounded doctor directory with only
`clinicId=99174216-168e-469a-995f-60b527d362bf&page=1&pageSize=20`
(omitting both `status` and `branchId`) in the signed-in Super Admin browser.
The supplied response was again:

```json
{"items":[],"total":0,"page":1,"pageSize":20,"totalPages":0}
```

Removing those requested filters did not restore any doctor. The narrower
booking request's location/status parameters alone therefore do not explain the
observed discrepancy. This does not prove that no persisted doctor exists:
serving-version defaults, account/profile projection, ownership/membership links,
retirement exclusions and source data have not been inspected on UAT. Do not
respond by creating another doctor or adding assignments. The owning account's
identity and matching directory response were therefore requested separately.

The user subsequently supplied the separate owning account comparison:
`user.id=3586790b-226c-4f10-8f6b-503eec3f5338`, `role=clinicAdmin`,
`clinicIds=[99174216-168e-469a-995f-60b527d362bf]`, and `doctorId=null`.
The clinic-only doctor query again returned `items=[]`, `total=0`,
`page=1`, `pageSize=20`, `totalPages=0`. These are user-captured UAT results;
the owner and Super Admin identities are distinct. The owner's administrative
clinic scope is present, but neither actor discovers doctors through the
clinic-filtered directory.

In the current workspace, `findUser` derives `doctorId` directly from the first
doctor row whose `userId` matches the account, independently of schedules or
clinical-location membership. Thus a missing schedule or sole location filter
does not explain that field being null under this implementation. This is a
comparison to workspace code, not proof of the serving UAT implementation or
absence of a saved row.

The user also supplied the Super Admin response to
`/api/doctors?managingAdminId=3586790b-226c-4f10-8f6b-503eec3f5338&page=1&pageSize=20`,
without clinic/location/status parameters. It again returned `items=[]`,
`total=0`, `page=1`, `pageSize=20`, `totalPages=0`. Both the clinic and
owner-managed API projections are empty. Further copies of these browser
responses cannot distinguish saved-row absence/mismatch from serving-code
behavior. Authorized persisted-row and serving-code inspection is necessary
rather than speculative record creation.

`docs/uat-owner-doctor-discovery-readonly.sql` supplies five narrowly scoped
read-only result sets for an authorized UAT maintainer: the owning account,
doctor rows linked directly by that account ID, selected clinic/location status
and ownership, and that account's assignments within this clinic. It selects no
names, credentials, contacts or patient records. The maintainer must confirm the
connection belongs to the running UAT API and execute the whole script in one
session; this workspace has not executed it on UAT. A missing column/table is
evidence of a schema difference, not authorization to alter the schema.


### User-supplied UAT persistence evidence

The uploaded terminal transcript
`attached_assets/Pasted--digiq-uat-BEGIN-TRANSACTION-ISOLATION-LEVEL-REPEATABLE_1792657848811.txt`
shows all five reads succeeding in a read-only transaction at a `digiq_uat`
prompt, followed by `ROLLBACK`:

| Scoped read | Observed result |
| --- | --- |
| Owner account | One row, expected account ID, `clinicAdmin`, `active` |
| Doctors where `user_id` equals that owner ID | **Zero rows**, without status or membership filters |
| Selected clinic | One row, expected owner `admin_id`, `active` |
| Selected location | One row, expected parent clinic, `active` |
| Owner assignments in selected clinic | One clinic-level row, `branch_id=NULL` |

This is user-executed database evidence, not an independent workspace connection
to UAT. It establishes the missing account-to-doctor relationship in the queried
database before directory filtering: there is no owner-linked doctor row from
which to project the expected consulting doctor. It is consistent with both
actors' empty directories and the owner's null `doctorId`. The clinic-level
assignment is the expected administrative shape; do not convert it into a
branch assignment to compensate for the missing clinical profile.

The transcript does not establish how or when the profile/link disappeared,
whether a matching profile exists under another account/owner, whether a
historically retired profile existed, or whether the running API connects to a
different database. Do not label this a reproduced onboarding bug or declare
that no doctor profile exists anywhere. Before proposing a separately approved
repair, inspect only raw doctor candidates managed by this owner or retaining
the selected location ID, then any necessary narrowly scoped historical evidence.
Do not create another account/doctor or reconstruct consent from this absence.

The user then executed the raw candidate check without status exclusions:
`doctors.owner_admin_id` equal to the known owner **or** saved
`data.branchIds` containing the exact selected location ID. It also returned
zero rows. Thus no current row matches the known account, managing owner or
retained consulting location. This is not a database-wide proof of no historical
profile: retirement/erasure or incorrect identities can remove those links.
Narrowly scoped historical evidence was then requested, rather than another
browser directory request or a speculative insert.

`docs/uat-owner-doctor-history-readonly.sql` selects only registration mode/actor
metadata, audit event identifiers/actions/timestamps for the exact owner,
clinic/location and its self-profile history, and doctor IDs retained in that
owner's `attachOwnDoctorProfile` audit events or
the location's linked schedule. In current workspace onboarding, the
`attachOwnDoctorProfile` audit is attributed to the owner even when a Super
Admin initiated clinic onboarding. Whether UAT emitted/retained that event is
not established. Missing receipts/events do not prove consent was absent.
The script has not been run on UAT by this workspace. Counts expose truncation
of its bounded result sets.

The user subsequently supplied its three result tables:

- The clinic receipt records `mode=self` and the known owner as registration
  actor; clinic creation is `2026-10-21 12:28:20.850118+05:30`.
- The scoped audit response contains exactly five events (reported total five,
  so not truncated): owner account registration, clinic creation/settings,
  location creation, and clinic registration. No self-profile attachment event
  appears in this available history.
- No doctor ID is retained by the selected audit/linked-schedule references.

Self-registration completion is established; historical consulting input and
serving code behavior are not. Absence of an attachment event does not prove
the user declined consulting, that the original payload lacked it, or that a
profile never existed. The source of the current discovery failure is the
missing persisted account-to-doctor relationship, upstream of listing and
rendering. The historical reason for that gap remains unverified.


### Precise recovery — approved scope, execution not yet confirmed

The workspace already has an owner-only `Enable My Doctor Profile` control,
backed by `POST /api/me/doctor-profile` and the transactional `attachOwnDoctor`
path. The user explicitly approved recovery on their server-hosted UAT for
the existing Kushan owner and dombivali only. This permits creating the missing
self-owned profile on the **existing** owning Clinic Admin
account for **only** the known dombivali location. It must not create another
login, change the account role, alter the administrative assignment, select
other locations, create schedules/appointments, or send notifications.
The handler serializes same-owner writes, reuses an existing account-linked
profile if one appears, and checks active owned locations and the existing
clinic-level assignment. Do not substitute direct SQL inserts or assume
the currently serving UAT route is identical without verifying the control and
response. If the control is absent, stop rather than deploying or improvising.

The verified workspace navigation for this control is the clinic workspace's
**Locations** section, under **My consulting locations**, not the personal
Profile page. For the known clinic, the path is
`/admin/clinics/99174216-168e-469a-995f-60b527d362bf/locations`.
The owner must check only dombivali and submit once. If UAT lacks the control,
shows another identity or extra selections, errors, or returns an uncertain
result, stop and reconcile the identity/directory before considering another
write. Do not blindly retry.

This recovery does not reconstruct historical qualifications, specialization
or sessions, and must not invent them. It is not a repair of the unknown
historical application cause. After an approved write, separately confirm both
actors' named discovery after reload/fresh sign-in; missing sessions remain a
distinct state. No such UAT write or acceptance has occurred yet.

A read-only anonymous `GET https://uat.digi-q.in/api/me` returned HTTP 401,
`{"error":"Sign in required","code":"REQUEST_FAILED"}`. The workspace has no
Replit-managed deployment; that does not mean the separately hosted UAT is absent.
No authenticated UAT session or authorized connection to its persistence is
available here. Workspace fixture credentials were **not** tried against UAT.
The reported manual JWT adaptation is not established by these anonymous reads.
JWT-session parity is covered by the separate companion work; the checks below
deliberately use the existing native-session fixture.

## Earlier finding (2026-10-21, historical)

The authenticated API and real-Preview browser journeys pass without changing
production authentication policy, application permissions, onboarding persistence, doctor projections, or directory
selection behavior.
Both self-registration and Super Admin onboarding persist one self-owned doctor
on the Clinic Admin account, with explicit consulting location IDs. There is no
reproduced application cause for the reported empty Doctor dropdown.
Do not describe these isolated checks as a repair of Kushan Clinic.

The browser did expose a separate self-registration transition issue: Open
Workspace stayed on “Checking secure access…” after registration deleted the
native lifecycle's authentication snapshot. `AuthAccess` intentionally has a
disabled query observer and does not fetch a replacement itself. The minimal
correction retains that status snapshot (the account remains Clinic Admin) while
preserving the existing invalidation of directory and other saved projections.
No role, assignment or doctor eligibility rule changed.


## Browser evidence (2026-10-21)

One real-Preview pass used both actual registration wizards, account verification,
invitation acceptance, staff password login, bare `/admin/book` routes and the
real API without interception:

- Both consulting owners appeared as the sole active doctor at their respective
  saved location, while retaining Clinic Admin access on the same account.
- Each owner created a new patient through booking, accepted consent and received
  a rendered ticket matching the independently inspected persisted appointment.
- The self-owner also used Patients → Add patient independently of booking.
- Fresh owner logins and the invited owner's hard reload retained the correct
  doctor. Changing actors did not retain the first owner's doctor label.
- A closed Wednesday showed no sessions while retaining the owner doctor.
  Selecting the configured future Monday exposed the saved session and allowed
  booking; missing sessions were not presented as a missing doctor.

The original browser pass used direct navigation to `/admin/book` after observing
the self-registration workspace transition issue. That transition correction was
then verified with a failing-before/passing-after lifecycle regression and an
actual React Query disabled observer, not a second browser pass. Do not claim a
post-fix browser check of the Open Workspace click. The saved Playwright regression
now explicitly requires that click to finish, without the workaround.

`artifacts/clinicflow/owner-booking-regression/` contains a reusable one-test
Playwright specification/configuration. Test discovery and a standalone TypeScript
check succeeded. The authored spec itself was not rerun end-to-end against fresh
fixtures; the completed browser journeys above were the actual verification.

## Supported-workspace JWT parity (2026-10-22)

The persisted API regression now runs the same consulting-owner suite in both
`AUTH_SESSION_MODE=native` and `AUTH_SESSION_MODE=jwt`, sequentially with a separate
freshly migrated, socket-only temporary PostgreSQL cluster per mode. The harness
generates a disposable signing key inside the test process; it never reads or
changes a workspace/deployment signing key or connects to the configured app DB.
Email is simulated, HTTP fetch is restricted to the disposable server's exact
loopback origin, and no delivery worker is started. Unexpected external fetches
fail the test. No live network or real account data is needed.

Both self-registration (including simulated email verification) and Super Admin
invitation acceptance exercise the real handlers. Invitation acceptance follows
the existing contract: set the password, then log in; it does not itself issue
a session. Each path finishes an immediate-session identity, scoped active
doctor discovery, independent patient creation and valid booking journey
**before** logging in again and repeating that entire journey with a fresh
session. Each ticket's clinic, doctor, location, patient, token and reference
are checked against persisted SQL records. The account remains Clinic Admin
with a same-account, self-owned doctor and exactly its saved consulting locations.

Every issued JWT is signature-verified using only the disposable key, and its
subject, purpose, fixed twelve-hour expiry and hashed database session binding
are checked. Native sessions are also checked for persisted identity and opaque
token format, so accidentally running JWT coverage in native mode cannot pass.
Both modes retain the unselected-location, foreign-clinic, inactive-profile,
inactive-account, admin-only and missing-session boundaries.

Additional authenticated-route rejection checks cover:

- Real logout persists session revocation; replaying that cookie receives 401
  on identity, scoped doctor discovery, patient creation and booking.
- In JWT mode, a correctly signed token names the other active owner while its
  hash is bound to the original owner's unrevoked, unexpired SQL session row.
  Requests for **either** clinic are rejected with 401. The test restores the
  original hash and confirms the original cookie still resolves its owner.
- Rejected requests leave patient and appointment row counts unchanged.

The focused run passes **13 persisted integration tests**: six native and seven
JWT. This is local API evidence for the workspace's supported JWT implementation,
not a JWT browser run, an adaptation of the earlier native browser evidence, or
verification of manually modified UAT. No production authentication code,
signing policy, keys or accounts were changed.

## Added regression coverage

`artifacts/api-server/src/owner-booking.integration.test.mjs` uses the checked-in
migrations in disposable PostgreSQL, real registration/invitation/password
handlers, actual session cookies, real authorization and resource/booking routes,
and simulated email. It does not authenticate through a test-user header.

The checks cover:

- Self-registration with required email verification and password confirmation.
- Super Admin onboarding, invitation acceptance and owner password login.
- Immediate identity and directory reads plus a fresh owner login.
- Clinic Admin role retained; doctor user and owner IDs equal that same identity.
- Stored consulting location IDs matching authenticated scoped doctor responses.
- Patient creation independently of booking, including with no sessions.
- A valid booking and its persisted doctor, location, patient, token and reference.
- Admin-only owners with no doctor profile.
- Unselected locations and foreign clinics excluded from discovery and booking.
- Inactive doctor profiles and inactive staff accounts excluded from active
  discovery and booking. Production ownership guards also reject deactivation of
  a still-owning Clinic Admin; the tests do not bypass that guard to construct an
  impossible inactive-owner record.
- Doctor discovery remains populated when consultation sessions are absent.

The existing booking-membership source assertion had fallen behind the newer
discovery/date gates. Its assertion now checks the required conjunctions without
requiring obsolete ordering or the old date input expression. This is a test
maintenance correction, not the cause of the reported dropdown failure.

## Passing focused checks

- Thirteen persisted API integration tests across native and supported JWT modes
  (the original native-only run contained five).
- Thirty-seven existing onboarding, SQL directory/authorization, pre-0008
  compatibility and booking-lookup privacy tests (passed in the combined run;
  initial failures in new fixture construction were corrected separately).
- Forty-seven directory, membership and session-lifecycle tests, including the
  registration authentication-snapshot regression.
- Shared-library build and API/frontend package typechecks.
- One comprehensive real-Preview browser pass described above.

## Commands

```sh
pnpm --filter @workspace/api-server test:owner-booking
# JWT-only persisted parity, using the same suite (native suite is skipped):
pnpm --filter @workspace/api-server test:owner-booking:jwt
# Existing signing, claim validation, revocation and mode-boundary unit checks:
pnpm --filter @workspace/api-server test:jwt

node --test --test-concurrency=1 \
  artifacts/api-server/src/registration-onboarding.integration.test.mjs \
  artifacts/api-server/src/list-query.test.mjs \
  artifacts/api-server/src/pre-0008-compatibility.test.mjs \
  artifacts/api-server/src/booking-lookup-privacy.integration.test.mjs

node --test \
  artifacts/clinicflow/src/lib/booking-doctor-membership.test.mjs \
  artifacts/clinicflow/src/lib/directory-cache.test.mjs \
  artifacts/clinicflow/src/lib/public-care-options.test.mjs \
  artifacts/clinicflow/src/lib/sole-option.test.mjs \
  artifacts/clinicflow/src/auth/session-lifecycle.test.mjs

pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/clinicflow run typecheck
```

## Disposable Preview fixture

### Booking dropdown correction

Normal staff Book Appointment now explicitly preserves the Clinic Group,
Location and Doctor dropdowns for zero, one or multiple eligible options.
A sole eligible option may still be automatically selected, but the control
does not turn into a read-only input. Loading/error states retain the dropdown
and the existing retry/empty-state feedback.

Location requests use the selected clinic group; doctor requests use that group
and its selected location. Freely selected doctors no longer filter the parent
clinic/location menus or their sole-option defaults. Changing the group clears
location and doctor, and changing location clears doctor. Genuine fixed doctor
workspaces/QR contexts retain their doctor restrictions; other callers of the
shared lookup and Queue default hook keep their existing behavior.

Verification actually executed for this revision:

- Two new rendering regression checks failed against the prior committed
  `ResourceLookup`, then passed with the correction.
- 44 rendering, scope, directory/cache, sole-option and membership tests passed.
- Frontend package typecheck and the retained browser-spec typecheck passed.
- The existing persisted browser spec was updated for dropdown labels rather
  than fixed text inputs. It was not rerun against a replacement Preview
  database. Earlier browser acceptance predates this dropdown-specific revision.
- No accounts, assignments, schedules, databases or UAT records were changed.
  Preview remains the ordinary application; no fixture opt-in was created.

The API development command recognizes the ignored opt-in file
`.local/owner-booking-browser-fixture`. When present, it starts
`src/test-support/owner-booking-browser.mjs` instead of the ordinary API server.
The ordinary production start command and production routers are unchanged.

This fixture:

- Builds a new migrated temporary PostgreSQL cluster, never the workspace DB.
- Seeds only a fictional Super Admin; owners are created through onboarding.
- Simulates all email and rejects external `fetch` calls.
- Exposes `/api/__owner-booking-evidence` only in this disposable server, for
  simulated email verification/invitation messages and persisted fictional data.
  No such inspection endpoint is added to application routers.
- Requires `NODE_ENV=development` and a workflow-provided `PORT`.
- Destroys its temporary cluster when the workflow stops.
- Provides a fixture-only doctor-status transition endpoint for measuring
  discovery after another actor changes an existing fictional doctor's status.
  Neither this endpoint nor the evidence endpoint is registered in production.

The fork's Preview was initially left in this fictional, delivery-disabled
mode. That rejected the user's ordinary Super Admin credentials because the
fixture uses a different database. The opt-in file has now been removed and the
managed API workflow restarted in ordinary mode. The normal server reports
listening on port 8080, `/api/auth/status` returns 200 and the fixture-only
evidence endpoint returns 404. No account/password or UAT record was changed.
Actual credential entry by the user remains separate from this readiness check.
The opt-in file is ignored and is not part of the merged application.

For a manual rerun, create the opt-in file, restart the existing API and web
workflows, and use the real Preview. The fixture's fictional Super Admin email is
`super@owner.test.invalid`; its public test password is `Fictional-Owner!2026`.
Remove the opt-in file and restart the API workflow to restore ordinary Preview.
Always restore ordinary Preview before handing it back for real-account use;
confirm the fixture-only endpoint is absent and normal API startup is logged.
Do not use real patient information in this fixture.

## Deployment boundary

Kushan Clinic was not found in the earlier read-only workspace investigation.
No Kushan, UAT or production records were altered, no app was published, and no
live notification delivery was attempted. The deployed version and reported
JWT adaptation may differ from this workspace. Successful local native-session
and supported-workspace JWT journeys cannot establish either that deployment's behavior or the cause of its
historical failure. Any later investigation should compare the saved owner/doctor
location IDs, the actual authenticated doctor-list request and response, and the
rendered selection at the first divergence; it must not infer missing consent or
automatically repair ownership/location records.

### Demonstrated local correction

The real `ResourceLookup` rendering previously displayed “Not assigned” on a
failed cold cardinality read, and continued to assert successful absence during
a pending refresh of a cached zero. The correction distinguishes checking,
failure, successful zero and ready states. A stale zero undergoing refresh
cannot display the absence explanation. A failure displays “Unable to verify
assignments” and retains the existing retry action. Saved labels remain display
data; they do not grant eligibility. Positive multi-option menus are not replaced
with a read-only control just because background refresh is running.

The rendered regression substitutes query results, **not** the control being
tested. Against `HEAD`'s original control, the pending-cached-zero and failed-read
assertions fail; with the correction all rendered and pure-state checks pass.
This is a real local display defect, **not a proven cause of Kushan's UAT zero**.


### Freshness contract

The existing signed-in boundary invalidates observed directory/menu/cardinality/
selected-name queries every 60 seconds, and refreshes expired context on focus
and route changes. Explicit application mutations already invalidate their
saved projections. Actor changes cancel/clear private queries.

The 60-second interval is a **foreground, active-observer target plus request
and rendering time**, not a delivery guarantee while offline or in a suspended
background tab. Directory requests have a 20-second transport timeout. Failed
reads remain failures, not evidence of absence; after a failed read use Retry.
No cache result overrides the server's booking validation.


### Exact missing read-only UAT evidence

Use an approved read-only authenticated inspection, not a live booking:

- The Super Admin actor ID/role, selected clinic/location IDs and successful-zero
  doctor response have now been supplied. Do not ask for those same identity
  fields or headers again, or guess IDs from displayed names.
- The bounded same-clinic doctor response without active-status/location
  parameters has also been supplied and is empty. Do not request the same
  Super Admin comparison again; inspect the owner's identity and saved clinical
  profile/projection next.
- If a later comparison returns doctors, retain only the necessary doctor
  ID/name/status/membership and rendered result. Do not collect cookies, bearer
  tokens, patient data or unrelated accounts.
- The owning Clinic Admin's separate identity and clinic-only doctor result have
  now been supplied: its administrative clinic scope is present, `doctorId` is
  null, and the directory is empty. Do not request that same comparison again.
- The scoped saved-state read has now been supplied: active owner/clinic/location,
  expected clinic ownership and clinic-only assignment, but zero account-linked
  doctor rows. Remaining evidence is any existing doctor candidate under this
  owner/location and, if needed, the historical profile/registration trail.
  Inspect existing consent; do not request it again or manufacture assignments.
- The serving application revision and effective identity/doctor-projection code
  corresponding to those responses, so deployed drift can be distinguished from
  persistence, filtering, response, or cache divergence.

Only after the first divergence is demonstrated should a precise repair or
rollout be proposed for separate approval. No live write or rollout is authorized
by this investigation.

# Reproduce the two actual rendering failures against the original control:
ASSIGNMENT_DISPLAY_BASELINE=1 node --test \
  artifacts/clinicflow/src/lib/assignment-display.render.test.mjs

### Trace established locally

1. `Booking` sends the selected **saved** `clinicId` and `branchId`, with
   `status=active`, to `CareLookup` for doctors. Session availability is a
   separate read and is not a discovery filter.
2. Staff `CareLookup` delegates to `ResourceLookup`; its menu and
   `useDirectoryCardinality` share the first bounded `directoryPage` read.
   Cardinality strips transport/search/selected-ID parameters, not clinic,
   branch, doctor, or status restrictions.
3. Generated `listDoctors` consumes the server's `{items,total,page}` response.
   The API's scoped SQL projection uses `managedDoctorLinks` for the saved
   consulting-owner locations, the real authenticated role for read scope, and
   account/profile status for active discovery. Super Admin has a different
   authorization predicate from Clinic Admin, not an assumed owner identity.
4. The actor (ID, role, doctor ID), resource and exact scope participate in cache
   keys. A successful `total=0` is what selected the screenshot's explanation.
   Neither the explanation nor an empty list proves omitted consulting consent,
   missing sessions, or damaged saved records.

Both fresh Super Admin sessions and both consulting owners' native sessions
return their saved consulting doctor by name in migrated disposable PostgreSQL.
Thus no backend assignment/ownership correction is supported by local evidence.
User-captured UAT evidence now establishes an actual server zero for the exact
saved clinic/location IDs, in contrast to the positive isolated fixtures.
The subsequent user-executed UAT reads establish the first persisted
discrepancy: no owner-linked doctor row, and no candidates through the known
managing owner or selected location. The historical reason and serving
revision remain unverified; do not substitute the positive local trace for
UAT repair or acceptance.

### Checks executed on the revised work

- The revised onboarding/owner suites passed 20 persisted tests, including seven
  new onboarding-contract tests and six owner-booking tests. These cover Super Admin discovery in initial
  and fresh sessions, separate owner identity, true zero/one/multiple cardinality,
  status changes in both roles, unselected/foreign locations, admin-only owners,
  inactive profiles/accounts, no sessions, fictional patients and persisted tickets.
- A further 30 scoped-directory, booking-privacy and pre-0008 compatibility
  tests passed against the revised backend, for 50 API tests in this verification.
- 53 frontend directory/cache/sole-option/membership/session/render tests passed.
- Shared-library build, API package typecheck and frontend package typecheck passed.
- Persisted browser acceptance is recorded below separately from these checks.
- After synchronizing with the main project's companion session tests, the
  combined owner-booking/registration-contract command passed 22 tests,
  retaining both native/JWT immediate/fresh-session, revocation and wrong-subject
  checks alongside this task's discovery and staff-addition coverage.
  Shared libraries were rebuilt before both package typechecks passed again.
  This is local compatibility evidence, not UAT JWT verification.
- The final completion-membership revision passed 31 onboarding/owner tests:
  nine registration-contract tests, seven onboarding tests and fifteen combined
  native/JWT owner-booking tests. The API package typecheck passed. These
  additionally prove that an existing profile without its saved consulting
  membership cannot satisfy completion, and that adding an administrative
  location does not expand the original clinical selection.


### Browser execution — local acceptance with saved-fixture continuations

The retained browser regression was actually executed against a freshly
migrated disposable PostgreSQL instance, using real rendered controls and
native sessions. External network delivery remained disabled.

The initial execution confirmed both actual onboarding requests carried
`ownDoctor:true`; the self-owner immediately entered the workspace, discovered
its own persisted doctor, registered a fictional patient and issued a persisted
ticket. A fresh self-owner session/reload retained discovery. Super Admin then
discovered that owner and issued a separate fictional persisted ticket.

The existing tester continued only the unfinished portions after correcting
harness mistakes: a cold-mount `count()` race skipped clinic selection, reloads
needed explicit scope reselection, and a staff row text locator matched both
the owner's Name and a colleague's Managing Admin cell. Exact persisted row IDs
now distinguish those rows. These were test failures, not demonstrated product
permission failures. No new tester, UAT session or real notification was used.

Observed remaining acceptance:

- Super Admin's active-to-inactive doctor change rendered after **59,871 ms**;
  inactive-to-active rendered after **59,885 ms**. These are observed foreground
  samples, not an offline/background maximum or an independent assignment-edit
  timing measurement.
- Adding a second fictional doctor made the actual menu plural, with both owner
  and colleague names. Creating a fictional receptionist did not hide the owner.
  Staff → Doctors showed the owner and colleague for Super Admin and for the
  freshly signed-in owner. The migrated-PostgreSQL tests additionally verify this
  for both self and administrator-created owners.
- The final continuation accepted the saved simulated invitation, signed in the
  administrator-created owner, issued and verified its persisted patient/ticket,
  then confirmed doctor discovery after fresh sign-in and page reload.

The final narrow continuation returned **1 passed**, 22.2 seconds (24.2 seconds
total). The whole retained scenario was covered across the initial run and
saved-fixture continuations; **a single uninterrupted clean run of the final
full script was not executed**. Earlier passing portions were not repeated.
The retained default command starts fresh; continuation options are only for
the same disposable fictional fixture, never real accounts.

Invited-owner ticket evidence:
`generated-artifacts/owner-booking-regression/owner-booking-real-self-ow-54211-ooking-patients-and-tickets/browser-admin-owner-ticket.png`.

**UAT recovery remains unconfirmed.** User-executed reads establish the missing
profile; local acceptance does not repair it or establish the historical cause.
There is no workspace-authenticated UAT session or serving-revision evidence.

# Expected exit 1: stale-zero pending and failed-read cases.

node --test --test-concurrency=1 \
  artifacts/api-server/src/owner-booking.integration.test.mjs \
  artifacts/api-server/src/owner-registration-contract.integration.test.mjs \
  artifacts/api-server/src/registration-onboarding.integration.test.mjs \
  artifacts/api-server/src/list-query.test.mjs \
  artifacts/api-server/src/pre-0008-compatibility.test.mjs \
  artifacts/api-server/src/booking-lookup-privacy.integration.test.mjs

node --test \
  artifacts/clinicflow/src/lib/assignment-display.test.mjs \
  artifacts/clinicflow/src/lib/assignment-display.render.test.mjs \
  artifacts/clinicflow/src/lib/registration-doctor-completion.test.mjs \
  artifacts/clinicflow/src/lib/booking-doctor-membership.test.mjs \
  artifacts/clinicflow/src/lib/directory-cache.test.mjs \
  artifacts/clinicflow/src/lib/public-care-options.test.mjs \
  artifacts/clinicflow/src/lib/sole-option.test.mjs \
  artifacts/clinicflow/src/auth/session-lifecycle.test.mjs

pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/clinicflow run typecheck

## Earlier finding (2026-10-21, historical)

The authenticated API and real-Preview browser journeys pass without changing
production authentication policy, application permissions, onboarding persistence, doctor projections, or directory
selection behavior.
Both self-registration and Super Admin onboarding persist one self-owned doctor
on the Clinic Admin account, with explicit consulting location IDs. There is no
reproduced application cause for the reported empty Doctor dropdown.
Do not describe these isolated checks as a repair of Kushan Clinic.

The browser did expose a separate self-registration transition issue: Open
Workspace stayed on “Checking secure access…” after registration deleted the
native lifecycle's authentication snapshot. `AuthAccess` intentionally has a
disabled query observer and does not fetch a replacement itself. The minimal
correction retains that status snapshot (the account remains Clinic Admin) while
preserving the existing invalidation of directory and other saved projections.
No role, assignment or doctor eligibility rule changed.


# Against the running, explicitly opted-in disposable Preview only:
OWNER_BOOKING_BASE_URL=http://127.0.0.1:80 pnpm exec playwright test \
  --config artifacts/clinicflow/owner-booking-regression/playwright.config.ts


# Exact final narrow continuation executed against the same fictional fixture:
OWNER_BOOKING_CONTINUE_AFTER_SUPER=1 \
OWNER_BOOKING_CONTINUE_AFTER_STAFF=1 \
OWNER_BOOKING_BASE_URL=http://127.0.0.1:80 pnpm exec playwright test \
  --config artifacts/clinicflow/owner-booking-regression/playwright.config.ts
```


### Consulting onboarding cannot silently omit its doctor

Both onboarding submitters already map the checkbox to `ownDoctor`. A distinct
demonstrated gap was that response/completion reconciliation could accept a
clinic result with `doctorId:null` despite the draft requesting a doctor.
The frontend now checks that invariant for preflight, direct response,
uncertain-response recovery and restored-draft recovery, retaining the draft
and refusing to present completed consulting setup when the ID is absent.

The server verifies all selected clinical memberships inside the onboarding
transaction before returning success; a deliberately corrupted profile causes
rollback, not a second enable instruction. New completion receipts retain the
explicit consulting request and original consulting location IDs. Completion
reads/replays verify the current eligible membership at those saved locations,
not merely the existence of a doctor ID. A later administrative location does
not silently become a consultation assignment. Old receipts without that flag
do not imply consent either way; reconciliation does not return a usable doctor
ID with missing clinic/location membership, and a retained frontend draft can
still enforce its explicit choice. No profile or membership is created
automatically by a completion read.

The nine new persisted contract tests exercise self/admin onboarding,
immediate same-account doctor identity, subsequent doctor/receptionist creation,
non-consulting owners, missing-profile completion and transactional rollback.
This is prospective protection, not proof of Kushan's historical cause, and
does not reconstruct the already-missing UAT profile.

### Completion blocker

The local prospective fixes and fictional verification are complete, but the
reported Kushan incident must remain open. The user approved existing-owner,
dombivali-only profile recovery; the last supplied owner identity still had
`doctorId:null`. The latest UAT screenshot was Staff → Doctors, not the
Locations section containing the recovery control. There is no confirmation
that the control exists in the serving build, that the approved recovery was
submitted, or that either actor subsequently discovered the named owner after
fresh sign-in. No direct authenticated UAT access is available in this workspace.
The concrete next step is to inspect the existing owner's Locations control,
perform the approved recovery only if it matches that scope, and obtain both
actors' minimal discovery results. Do not mark the incident resolved, create
another account, or substitute a Git rollout for that missing acceptance.

```sh
