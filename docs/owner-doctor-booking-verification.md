# Consulting-owner booking verification

## Finding

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

The fork's Preview was intentionally left in this fictional, delivery-disabled
mode rather than starting the normal server's notification worker. The opt-in
file is ignored and is not part of the merged application.

For a manual rerun, create the opt-in file, restart the existing API and web
workflows, and use the real Preview. The fixture's fictional Super Admin email is
`super@owner.test.invalid`; its public test password is `Fictional-Owner!2026`.
Remove the opt-in file and restart the API workflow to restore ordinary Preview.
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
