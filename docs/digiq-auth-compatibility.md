# Authentication compatibility and retirement inventory

## Scope and evidence

Read-only source review of findings 116, 117, 125 and 129, plus operational guidance for the existing single-key JWT implementation. This document does not authorize deployment, provider cleanup, database changes, key activation or credential rotation. No secrets, live accounts, SMTP delivery or UAT data were accessed. UAT (`https://uat.digi-q.in`) remains authoritative; workspace source does not establish its deployed implementation.

The current policy is native PostgreSQL identity and Argon2id staff passwords, separate patient email-code login, and fixed 12-hour database-backed sessions. Optional JWT transport uses one dedicated signing key and the same lifetime/revocation model. Ordinary staff password login does not require SMTP. No refresh endpoint, refresh schema or overlapping-key policy is implemented or implicitly required for this fixed-lifetime mode.

## 116 — Frontend transport, session expiry and private caches

| Surface | Observed implementation | Assessment |
| --- | --- | --- |
| `artifacts/clinicflow/src/lib/auth-request.ts` | Manual auth calls use `csrfFetch`, relative `/api/auth/...` URLs and JSON. Errors become plain `Error` messages. | Cookie/CSRF transport is correct. Status, error code and response headers are discarded; callers cannot inspect `Retry-After` or distinguish structured auth failures without extending the wrapper. |
| `src/lib/csrf.ts` | Same-origin credentials, no-store, single-flight CSRF bootstrap shared by overlapping requests. Mutations obtain the current cookie's token. Only explicit 403 `INVALID_CSRF` is replayed, once. | Does not replay password failures or arbitrary writes. This single-flight mechanism is for CSRF, not token refresh. |
| `src/lib/api.ts` and `lib/api-client-react/src/custom-fetch.ts` | Generated clients register the same CSRF getter; cookie credentials default to same-origin. Only CSRF middleware rejection is retried once. `ApiError` retains status/body/headers. | Generated and handwritten transports preserve the same security boundary. The generic bearer-token getter is not configured by this web app. |
| `src/auth/native-auth.tsx` | Startup/explicit status refresh; successful refresh clears React Query cache even for a same-role account switch. A 401 after a signed-in state clears it. Logout waits for server success, then clears cache and signed-in state. | Explicit refresh/logout clear private cached state. No access credential is stored in localStorage/sessionStorage by these auth modules. |
| `src/auth/AuthAccess.tsx` | Auth-status query has zero stale time and focus refetch. A role-null response triggers provider refresh and redirects to sign-in. | Expiry is discovered at status checks/focus; no fixed-expiry timer or global 401-to-provider transition was found. |
| `src/clinic.tsx` | Logout has an in-flight guard, error feedback, cache clearing and full navigation after success. | Does not falsely claim successful logout if the request fails. |
| `src/App.tsx` | Query default retries once; no mutation retry policy is installed here. | Read retries are not token renewal or a license to replay mutations. |

**Genuine remaining gaps, not refresh requirements**

- An already-open, continuously focused page can retain private cached rendering after server expiry/revocation until a status refetch. An ordinary protected API 401 is surfaced as an error but does not centrally clear identity/cache immediately. The server still checks session revocation and active identity; this is an expiry UX/private-rendering lifecycle gap, not evidence of server access being granted.
- No cross-tab logout/account-change broadcast was found in the reviewed auth transport. Other tabs discover the changed cookie/session on subsequent status checks; their existing rendering can remain stale in between.
- The manual auth wrapper loses structured cooldown information. Registration resend currently uses a client timer and server error message, not the actual `Retry-After` header. Server cooldown enforcement remains authoritative.
- The legacy staff-password confirmation sign-out button in `AuthAccess.tsx` lacks the normal shell's explicit logout error handling. Current native status always reports `requiresStaffPassword:false`, so that branch is compatibility-only.

Recommended follow-up: a shared, non-replaying unauthorized-session notification that cancels/clears private queries and refreshes identity, plus reviewed cross-tab invalidation and expiry tests. Exclude expected anonymous/login credential failures from indiscriminate redirects. Do not automatically resend writes. These recommendations were not implemented in this documentation pass.

**Conditional/deferred work:** single-flight token renewal, rotating refresh credentials and refresh reuse detection apply only if a separately approved refresh design is adopted. Their absence is not a defect in the chosen fixed-12-hour mode. Frontend “refresh” currently means fetching session status, not extending session lifetime.

## 117 — Request and contract alignment

Manual callers inspected:

- `StaffLogin.tsx`: `login` sends `{email,password}`; current successful response is `{authenticated:true,user}`.
- `PatientLogin.tsx`: `patient/start` sends `{email}`, then `patient/verify` sends `{challengeId,code}`.
- `PasswordFlows.tsx`: recovery sends `{email}`; reset/setup send `{token,password}`.
- `ClinicRegistration.tsx`: `register/start` sends `{email,fullName,password}`, `register/verify` sends `{challengeId,code}`, and `registration/resend` sends only `{challengeId}`. The pending password hash remains server-side.
- Provider logout sends `{}` to `logout`; session status uses GET without issuing another CSRF cookie.

The OpenAPI source now includes these native endpoints and the registration resend path. Resend returns the stable challenge ID, retains original expiry, and declares cooldown 429/`Retry-After`. Contract-generated clients coexist with handwritten form requests; generation alone does not prove those manual callers use generated validators.

**Confirmed contract discrepancy:** at review time `lib/api-spec/openapi.yaml` describes `/auth/status` as returning a CSRF token and makes `AuthStatus.csrfToken` required. `routes/auth.ts` intentionally returns only `{role,staffPasswordVerified,requiresStaffPassword}`; `/auth/csrf` exclusively owns token issuance to prevent overlapping first-visit responses from replacing the cookie. `docs/native-auth-contract.md` documents the actual split correctly. Correct the OpenAPI response description/schema and regenerate clients/validators in a contract-owned follow-up; do not “fix” this by restoring status-cookie issuance.

The manual auth callers reviewed obtain CSRF via the proper bootstrap, so this discrepancy is not a confirmed critical request-authentication failure. Some auth errors are documented incompletely compared with runtime 400/401/403/429/503 responses. Keep error metadata consistent in a later contract pass.

## 125 — Device verification compatibility

- Current `/auth/login` authenticates active staff with a local password and immediately creates a session. It does not create a device challenge.
- `StaffLogin.tsx` still supports a conditional `requiresVerification/challengeId` response and a device-code screen. The current login handler does not return that branch.
- `/auth/verify-device` remains implemented and rate-limited. It only consumes an existing valid HMAC-bound device challenge for the same active staff identity, and session issuance is atomic with consumption. Password changes invalidate outstanding device challenges.
- OpenAPI still exposes device verification; `AuthAccess.tsx` retains the old staff-proof confirmation branch.

These are dormant compatibility surfaces, not mandatory MFA. Inventory actual UAT callers and any independent challenge issuer before removing them. After explicit reconciliation, retire the unused UI response branch and endpoint/contract together, with stale-client error handling and regression tests. Do not make SMTP a staff-login prerequisite or allow patient codes to authenticate staff.

## 129 — Dormant provider inventory and safe retirement

| Location | Purpose/status | Safe recommendation |
| --- | --- | --- |
| `scripts/src/audit-auth-flows.ts`, `audit-manual-invitation.ts`, `audit-flow.ts`, `audit-assignments.ts`, `audit-ownership-tabs.ts` | Fail-fast retired entry points; historical provider-backed fixture/audit runners no longer execute their former operations. | Keep tombstones or archive with an index after operator references are checked. Never restore provider session creation to make old tests pass. |
| `scripts/src/create-preview-accounts.ts`, `create-isolated-staff-fixture.ts`, `investigate-manual-invitation-delivery.ts` | Fail-fast retirement guards for provider provisioning/delivery investigation. | Preserve the safety guard until all runbooks/callers are retired. Native isolated tests are the replacement. |
| `scripts/src/bootstrap-admin.ts`, `seed-system.ts`, `preflight-native-auth.ts` | Current native operator tooling, not dormant provider integration. Bootstrap can write credentials; preflight reports aggregate counts. | Do not delete based on historical names. Running either still needs separately authorized target/configuration; neither was run here. |
| `artifacts/api-server/src/routes/resources.ts` | A block-commented historical conflict-resolution implementation contains `provisionIdentity`/`provisionedClerkId`. | Non-executable historical text; archive/remove in a reviewed cleanup after checking history, not as an auth behavior change. |
| `lib/db/src/schema/core.ts`: `users.clerkId`, `staffSessionProofs`; historical migrations/snapshots | Additive migration/rollback compatibility. `0012_native_auth_additive.sql` explicitly preserves the old fields/table. | Do not drop columns, rewrite migrations, remove provider accounts or erase mappings incidentally. Schema retirement requires separate reconciliation/migration approval. |
| `src/lib/store.ts`, `src/lib/list-query.ts` | Strip legacy provider IDs and credential fields from response projections. | Retain defensive redaction even while legacy columns exist. These are not live provider authentication. |
| Native/queue/backend test fixtures and browser regression harnesses | Legacy-shaped data columns and comments; isolated local fixtures, not provider authentication. | Keep fixtures that exercise real schema compatibility. Update misleading labels independently; do not mistake comments mentioning Clerk for active SDK use. |
| `docs/audits/*`, restoration/operations/manual documents, `lib/db/README.md` | Historical evidence and some stale instructions. In particular the DB README still describes verified Clerk signup/linking for seed bootstrap. | Mark historical reports as evidence, not current runbooks. Replace stale operational instructions only after reviewing current native bootstrap behavior; never follow provider-linking instructions to provision production users. |

The reviewed API/frontend package manifests and active auth modules do not establish an active Clerk SDK login path. Absence in workspace source does not prove removal from UAT configuration, provider tenant or deployed assets. Retire provider deployment variables only after the deployed build and rollback plan have been verified; do not inspect or publish their values.

## Existing single-key JWT replacement procedure (proposal, not executed)

This procedure describes current behavior; it adds no old-key acceptance or retention policy.

1. Obtain explicit operational approval and verify the target build/mode. In default native mode, replacing `JWT_SIGNING_KEY` does not invalidate opaque native sessions. Do not switch modes as an incidental rotation step.
2. Schedule the expected forced reauthentication and notify operators. Confirm local password readiness, recovery availability and the isolated regression baseline. Review rollback compatibility without touching account IDs, roles, ownership or passwords.
3. Generate a dedicated, cryptographically random replacement through approved secret-management tooling. Current validation requires at least 32 UTF-8 bytes and no surrounding whitespace; length alone is not entropy. Never put the value in source, logs, screenshots, documentation or command arguments.
4. Replace the configured signing key on **all** serving instances in one coordinated cutover/restart strategy. Do not leave old-key and new-key instances serving concurrently: they cannot validate each other's cookies and users would see intermittent authentication failures. There is no key ring, `kid` selection or overlap support.
5. Verify public routes stay available, an old JWT is rejected, a newly authenticated JWT works across every instance, and logout/database revocation still work. Use approved disposable identities and redacted checks; do not send real email without separate authorization.
6. The old JWT's signature no longer verifies after replacement, even if its hashed session row has not expired. Users must sign in again; the new JWT still has the fixed 12-hour maximum. Database rows do not make an old signature valid.
7. Do not rotate `SESSION_SECRET` incidentally: it separately authenticates one-time challenges, so changing it invalidates pending codes/links. Do not restore a compromised signing key as rollback. Restoring any previous key could make still-unexpired, unrevoked old JWTs valid again; a rollback requiring a durable old-session cutoff needs separately approved database revocation/cutoff handling.
8. Record target version, cutover time and verification outcomes without credentials. Old-key disposal/retention and any future overlap design require explicit security/operations approval; this document prescribes neither an overlap window nor old-key storage.

## Completion boundary

This inventory completes the requested read-only analysis, not all implementation in findings 116/117/125/129. The status-schema mismatch, centralized expiry/cache handling, cross-tab handling, conditional UI retirement and stale runbook cleanup remain explicitly open. No critical server authentication bypass was confirmed. Live UAT reconciliation, real-browser expiry/cross-tab checks and authorized key replacement remain unperformed.