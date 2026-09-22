# ClinicFlow operations and developer manual

> **Document basis and confidence.** This manual describes the repository as inspected, not a claimed deployment state. It is based on the package manifests, workspace/build/Vite/artifact configuration, API and web sources, database schema and SQL files, operator scripts, `README.md`, `replit.md`, the existing files under `docs/`, and the attached original text specification. No application was started, no tests were run, no environment was read, and no database or identity-provider state was inspected or changed while preparing it. “Implemented in source” below therefore does not mean “runtime-verified” or “released.”

## 1. System boundary

ClinicFlow is a pnpm/TypeScript monorepo containing:

- a React 19/Vite web application;
- an Express 5 REST API;
- PostgreSQL access through Drizzle ORM;
- Clerk account authentication and account recovery;
- a separate, authenticated ClinicFlow mobile-number OTP flow;
- an OpenAPI contract with generated React Query and Zod code;
- development schema synchronization and operator-only bootstrap/seed scripts.

The web application and API are separate artifacts routed through the same public application. The web client calls relative `/api` URLs. API business routes use Clerk identity plus the ClinicFlow `users` record for role and tenancy checks. The implementation uses polling, not WebSocket or SSE, for queue refresh.

The repository does **not** establish that any production deployment currently exists, is current, has production secrets, has had migrations applied, or has a working SMS sender. Do not infer deployment health from committed build output.

## 2. Repository and source-of-truth map

| Path | Purpose / authority |
|---|---|
| `package.json` | Root install guard and aggregate `typecheck`/`build` scripts. |
| `pnpm-lock.yaml` | Locked dependency graph. |
| `pnpm-workspace.yaml` | Workspace membership, dependency catalog, release-age policy, overrides. |
| `tsconfig.base.json`, `tsconfig.json` | Shared strict TypeScript settings and library project references. |
| `.replit` | Node 24 module, artifact routing/deployment target, run-button workflow name, post-merge hook, development OTP provider selection. |
| `artifacts/clinicflow/` | Production web artifact. `src/App.tsx` owns top-level routes/guards; `src/clinic.tsx` owns onboarding, portal, booking, appointment, queue, profile, settings and report flows; `src/resources.tsx` owns generic resource CRUD UI; `src/index.css` owns application styling. |
| `artifacts/clinicflow/vite.config.ts` | Vite plugins, required port/base path, build output, aliases and preview settings. |
| `artifacts/clinicflow/.replit-artifact/artifact.toml` | Web artifact route `/`, development command and static production output/SPA rewrite. |
| `artifacts/api-server/` | Express API artifact. |
| `artifacts/api-server/src/app.ts` | HTTP middleware order, Clerk middleware/proxy, API rate limit, mutation-origin defense, router and error handler. |
| `artifacts/api-server/src/routes/` | Actual HTTP implementations grouped as health, public discovery, identity, OTP, resources, appointments, queue and reporting. |
| `artifacts/api-server/src/lib/` | Authorization/scope, availability, queue transitions, persistence helpers, HTTP validation/errors, OTP delivery and logging. |
| `artifacts/api-server/build.mjs` | esbuild ESM bundle and Pino worker handling; outputs `dist/*.mjs` plus source maps. |
| `artifacts/api-server/.replit-artifact/artifact.toml` | API artifact route `/api`, development/build/run commands and startup health path. |
| `lib/api-spec/openapi.yaml` | API contract source of truth. |
| `lib/api-spec/orval.config.ts` | React Query and Zod generation configuration; generated API base URL is `/api`. |
| `lib/api-client-react/src/generated/` | Generated web client/hooks. Do not hand-edit. |
| `lib/api-client-react/src/custom-fetch.ts` | Shared fetch/error behavior and optional bearer/base-URL hooks. |
| `lib/api-zod/src/generated/` | Generated request/response validation schemas and types. Do not hand-edit. |
| `lib/db/src/schema/core.ts` | Current Drizzle schema authority. |
| `lib/db/drizzle/0000_clinicflow_initial.sql` | Initial versioned SQL artifact. |
| `lib/db/drizzle/0001_clinicflow_integrity.sql` | Integrity additions: parent FK, appointment-reference uniqueness, patient-mobile index and positive-token check. |
| `lib/db/drizzle/meta/` | Drizzle snapshots and journal for the two SQL artifacts. |
| `lib/db/drizzle.config.ts` | Development Drizzle connection/schema configuration. |
| `scripts/src/bootstrap-admin.ts` | Controlled first-super-admin bootstrap. |
| `scripts/src/seed-system.ts` | Idempotent system vocabulary/settings seed; no people, clinics or appointments. |
| `scripts/src/create-preview-accounts.ts` | Explicit development/test-Clerk preview identity provisioning; not exposed as a package script. |
| `scripts/post-merge.sh` | Post-merge install/schema command; see the warning in §5. |
| `README.md` | Architecture, role/lifecycle summary and declared release boundaries. |
| `docs/backend-interface.md` | Backend integration notes and known implementation limitations. |
| `docs/otp-operations.md` | Existing OTP operational boundary. |
| `.conversation/attached_assets/Pasted--CLINICFLOW-COMPLETE-NEW-SYSTEM-DEVELOPMENT-IMPORTANT-R_1790057679029.txt` | Original written product specification used for the comparison in §14. It is a requirement source, not proof of implementation. |
| `artifacts/mockup-sandbox/` | Separate design/canvas artifact at `/__mockup`; it is not the production ClinicFlow web artifact. |

### Database model at a glance

`lib/db/src/schema/core.ts` defines `users`, `clinics`, `branches`, `assignments`, `masters`, `doctors`, `patients`, `schedules`, `availability_exceptions`, `appointments`, `appointment_history`, `qrs`, `audit_logs`, `settings`, and `otp_challenges`.

Core identity, scope, queue state and token fields are relational. Several optional demographics and configuration fields are stored in JSONB `data`. Queue state is represented on `appointments`; there is no separate queue-entry table. Important database constraints include unique Clerk/email identities, unique doctor profile per user, unique exception per doctor/branch/date, unique token per doctor/branch/date, idempotency by actor/request ID, unique appointment reference, one active patient booking per session, and at most one called/in-consultation appointment per doctor/branch/date.

## 3. Prerequisites and installation

### Supported repository toolchain

- Node.js 24 in the Replit module configuration.
- pnpm; the root `preinstall` script rejects npm/yarn installation.
- PostgreSQL available through `DATABASE_URL`.
- Clerk configuration for authentication and identity administration.
- Twilio through the Replit connector only when real mobile OTP delivery is required.

Run commands from the repository root unless a command explicitly changes directory.

### Clean deterministic install

```sh
pnpm install --frozen-lockfile
```

Use `pnpm install` without `--frozen-lockfile` only when intentionally changing dependencies and the lockfile. Do not create or retain `package-lock.json` or `yarn.lock`.

### Exact static checks and builds

```sh
# Library project references, then artifact and scripts package checks
pnpm run typecheck

# Libraries only
pnpm run typecheck:libs

# Typecheck first, then every workspace package that defines build
pnpm run build

# Individual packages
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/clinicflow run typecheck
pnpm --filter @workspace/clinicflow run build
pnpm --filter @workspace/scripts run typecheck
```

Package-script inventory (including scripts not used in the normal ClinicFlow release path):

| Package | Declared scripts |
|---|---|
| root | `build`, `typecheck:libs`, `typecheck` and the pnpm-only `preinstall` guard |
| `@workspace/api-server` | `dev`, `build`, `start`, `typecheck` |
| `@workspace/clinicflow` | `dev`, `build`, `serve`, `typecheck` |
| `@workspace/mockup-sandbox` | `dev`, `build`, `preview`, `typecheck` |
| `@workspace/api-spec` | `codegen` |
| `@workspace/db` | `push`, `push-force` |
| `@workspace/scripts` | `hello`, `bootstrap-admin`, `seed-system`, `typecheck` |
| `@workspace/api-client-react`, `@workspace/api-zod` | no package scripts |

Because the root recursive commands include artifact packages with matching scripts, root typechecking/building also includes the separate canvas artifact. It is not part of the production ClinicFlow web UI, but a failure there can still fail the aggregate command.

There is no test script in the inspected package manifests. A successful typecheck/build is not a substitute for the acceptance checks in §15.

### API contract code generation

After any change to `lib/api-spec/openapi.yaml`, run:

```sh
pnpm --filter @workspace/api-spec run codegen
```

This runs Orval, cleans and regenerates both generated trees, formats generated output, then runs the root library TypeScript build. Review generated changes in:

- `lib/api-client-react/src/generated/`
- `lib/api-zod/src/generated/`

Never patch generated files as the primary change. Change the OpenAPI contract and/or generator configuration, regenerate, then update server/web consumers.

## 4. Environment variable inventory

This section intentionally lists **names and purposes only**. Never put values in this manual, tickets, screenshots, source, or logs.

| Name | Consumer | Purpose / operational note |
|---|---|---|
| `DATABASE_URL` | `lib/db` and Drizzle config; API/scripts transitively | PostgreSQL connection string. Required before database-backed server or operator commands can work. |
| `PORT` | API entry point and Vite config | Listening port. API production artifact declares its port; web artifact declares its own. Vite/API fail fast if missing or invalid. |
| `BASE_PATH` | ClinicFlow and canvas Vite config | Public base path used for asset and router URLs. |
| `NODE_ENV` | API, Vite, preview provisioning | Selects development/production behavior, logger transport, Clerk frontend proxy behavior, and development-OTP eligibility. The API `dev` script sets development; artifact production commands set production. |
| `CLERK_SECRET_KEY` | Clerk server SDK and production Clerk proxy; preview script gate | Server-side Clerk identity management/authentication. Preview provisioning additionally requires a Clerk **test** key. Secret. |
| `CLERK_PUBLISHABLE_KEY` | API Clerk middleware fallback | Server-side publishable-key fallback used with host-derived Clerk configuration. Not a secret, but still configure deliberately. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Web client | Build-time web Clerk publishable-key fallback. Vite exposes `VITE_` variables to client code; never put a secret in this name. |
| `VITE_CLERK_PROXY_URL` | Web client | Optional Clerk frontend API proxy URL passed to `ClerkProvider`; production proxy route is `/api/__clerk`. |
| `OTP_PROVIDER` | API OTP delivery | Selects the mobile-OTP delivery backend. The development backend is additionally gated by the runtime environment. |
| `SESSION_SECRET` | OTP routes | HMAC secret for stored OTP challenge digests. Required for both development and Twilio mobile-verification challenges. Secret. |
| `TWILIO_ACCOUNT_SID` | OTP delivery | Twilio account identifier checked before delivery and used in connector API requests. |
| `TWILIO_MESSAGING_SERVICE_SID` | OTP delivery | Approved Twilio Messaging Service identifier/sender configuration. |
| `LOG_LEVEL` | API logger | Pino logging threshold; defaults to `info`. |
| `REPL_ID` | Vite | Enables Replit development-only cartographer/dev-banner plugins when present outside production. |
| `REPLIT_DEPLOYMENT` | Preview account script | Deployment guard; preview provisioning refuses the deployment environment. |
| `CI` | `.replit` post-build declaration | Marks the deployment post-build `pnpm store prune` environment as CI. |

Do not read or print current environment values merely to “verify” setup. Confirm presence through the platform’s secret/configuration UI and validate behavior using non-sensitive health/acceptance checks. `OTP_PROVIDER` is also declared as development-only configuration in `.replit`; that declaration does not prove any other required variable is configured.

## 5. Database schema operations and data safety

### Development schema synchronization

The only normal schema command exposed by `@workspace/db` is:

```sh
pnpm --filter @workspace/db run push
```

It runs `drizzle-kit push` against `DATABASE_URL` and is documented for **development only**. Inspect the intended schema change before accepting it. Do not point this command at production.

The package also exposes:

```sh
pnpm --filter @workspace/db run push-force
```

This passes `--force` and can approve destructive reconciliation. It is not part of the normal procedure. Use it only for an explicitly disposable development database after review and authorization; never treat it as a recovery tool.

### Versioned SQL and published environments

Two versioned SQL artifacts and corresponding Drizzle metadata are committed under `lib/db/drizzle/`. They document schema evolution. However:

- there is **no package script that applies those SQL files as a migration chain**;
- there is no migration table/runner documented in this repository;
- the API performs no startup DDL;
- existing project documentation says the managed Replit **Publish** flow applies the development-to-production schema diff;
- this manual makes no claim that a publish has occurred or that any published schema matches the current source.

For a published change, review `lib/db/src/schema/core.ts`, the committed SQL/metadata change, data compatibility, and the Publish schema diff. Do not manually run development `push` against a published database and do not add startup DDL as an operational shortcut.

### Post-merge hook warning

`scripts/post-merge.sh` runs:

```sh
pnpm install --frozen-lockfile
pnpm --filter db push
```

The actual package name is `@workspace/db`; the filter in this hook does not match the documented/manual command. Treat the hook’s schema step as **unverified and not an authoritative migration procedure**. Do not rely on it for release or recovery.

### Seed semantics

Initialize system vocabulary and the singleton platform settings record with:

```sh
pnpm --filter @workspace/scripts run seed-system
```

The script uses conflict-safe inserts and is intended to be repeatable. It seeds workflow vocabulary, limited medical/clinic masters, and default settings. It does **not** seed people, identities, clinics, branches, schedules, patients, appointments or preview records. Existing rows are not updated by `onConflictDoNothing`; changing defaults in source will not migrate an existing settings row.

### Backup and restore gap

No versioned backup script, restore script, retention policy, backup verification command, point-in-time-recovery procedure, or disaster-recovery runbook is implemented in this repository. Therefore no project-specific backup/restore command can be safely documented.

Before handling real patient data, the operator must establish a provider-approved, versioned procedure that covers at minimum:

1. scheduled encrypted database backups;
2. retention and access control;
3. backup version/schema identification;
4. restore into an isolated environment;
5. integrity and application smoke validation after restore;
6. Clerk/Twilio external-system reconciliation;
7. periodic restore drills and recorded recovery objectives.

Do not improvise `pg_dump`/`psql` production commands from this manual; ownership, credentials, managed-service constraints and recovery targets are not defined in the repository.

## 6. Running the services

### Development

The configured artifact commands are:

```sh
# API: selects development runtime behavior, rebuilds, then starts the bundle
pnpm --filter @workspace/api-server run dev

# Web Vite development server
pnpm --filter @workspace/clinicflow run dev
```

The API development artifact is routed under `/api`. The web artifact uses its declared service port and base path. Avoid hardcoding local ports in client code; generated clients use relative `/api`.

The API `dev` script is build-and-start, not watch mode. Source changes require another build/start cycle by the owning workflow/operator.

Useful direct commands:

```sh
# Run an already-built API bundle
pnpm --filter @workspace/api-server run start

# Preview an already-built web bundle with Vite
pnpm --filter @workspace/clinicflow run serve
```

### Production artifact contract

- API build: `pnpm --filter @workspace/api-server run build`
- API run: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- API startup health path: `/api/healthz`
- Web build: `pnpm --filter @workspace/clinicflow run build`
- Web output: `artifacts/clinicflow/dist/public`
- Web serving: static, with `/*` rewritten to `/index.html` for SPA routes

The repository also has a root `pnpm run build`, which runs typechecking before package builds. Prefer that aggregate gate for release candidates.

Do not infer current publish status from `.replit-artifact/artifact.toml`; it describes the artifact contract only.

## 7. Authentication, account creation and setup journeys

### Two distinct verification systems

**Clerk account authentication**

- Owns sign-up, sign-in, password handling, recovery, sessions and logout.
- Establishes the Clerk identity consumed by API middleware.
- Requires a verified primary email for ClinicFlow onboarding.
- Test-instance email verification may use Clerk’s documented test-address convention: an address containing `+clerk_test`, with verification code `424242`. This is for a Clerk **development/test instance only**. Never use that convention or code in production.
- ClinicFlow does not store or hash account passwords itself because password authentication is delegated to Clerk.

**ClinicFlow mobile OTP**

- Is a separate challenge available only after Clerk sign-in and ClinicFlow onboarding.
- Verifies the mobile attached to the current ClinicFlow patient/user.
- Uses `POST /api/otp/request` and `POST /api/otp/verify`.
- Stores an HMAC digest, not the plaintext code, and applies expiry, resend, hourly request, attempt and single-use controls.
- In development-provider mode, the API returns the newly generated `developmentCode`; it is not the Clerk code `424242` and proves no ownership of the phone number.
- In Twilio mode, the code is sent through the connector and is never returned by the API.

Never confuse Clerk’s fixed test-instance email-verification code with the randomized ClinicFlow mobile OTP.

### Ordinary patient setup

1. Open `/register` (redirects to Clerk `/sign-up`).
2. Complete Clerk sign-up and verify the primary email.
3. The application redirects to `/onboarding`.
4. With no explicit doctor intent, onboarding creates a ClinicFlow `patient` user and linked patient profile.
5. Complete/update profile and mobile details.
6. If platform settings require mobile verification, complete the separate mobile OTP before booking.
7. Book from `/patient/book` or a valid `/book/:reference`; accept booking consent; retain the returned reference/token.

### Doctor self-registration

1. Start at `/register-doctor`. This stores a session-scoped doctor intent and redirects to Clerk sign-up.
2. Verify the primary Clerk email.
3. `/onboarding` creates a ClinicFlow `doctor` user and linked doctor profile.
4. Complete professional profile details.
5. Create a clinic where permitted or receive clinic/branch assignments from an administrator.
6. Create branches if the doctor owns the clinic.
7. Configure weekly schedule, capacity, token prefix, queue mode and optional date exceptions.
8. Only active, assigned doctors with an open, available branch session become bookable.

Doctor intent is held in browser `sessionStorage`. Beginning a normal registration instead creates a patient. Existing users cannot self-switch roles.

### Invited staff and managed users

Super administrators, and clinic administrators within their restrictions, can create managed users. The server either links an existing verified Clerk identity or creates a Clerk invitation, then writes the ClinicFlow profile/assignments. A Clerk invitation and the PostgreSQL transaction cannot be atomic: if the database write fails after invitation creation, an unassigned invitation may remain and needs operator reconciliation.

The “password reset” administrative API records an audit event and tells the user to use Clerk’s Forgot password flow. It does not send recovery mail itself.

### First super administrator bootstrap

There is no public super-admin claim and the system seed does not create an administrator.

Prerequisites:

- the intended operator identity already exists in Clerk;
- its primary email is verified;
- it has not completed patient/doctor onboarding;
- `DATABASE_URL` and server-side Clerk configuration are available to the command;
- no active super administrator exists.

Preferred command:

```sh
pnpm --filter @workspace/scripts run bootstrap-admin -- --clerk-id <verified-clerk-user-id>
```

The script also supports verified-primary-email lookup:

```sh
pnpm --filter @workspace/scripts run bootstrap-admin -- --email <verified-primary-email>
```

Prefer immutable Clerk ID to avoid ambiguous operational input. The script:

- looks up the Clerk identity and requires its verified primary email;
- takes a PostgreSQL advisory transaction lock;
- refuses to run if an active super administrator exists;
- refuses silent promotion of an existing non-admin ClinicFlow profile;
- creates/activates the super-admin record and writes an audit event;
- generates no password and changes no Clerk credentials.

After success, sign in through Clerk with the same identity. There is no supported “rerun to promote another user” path; use authorized administration while retaining last-active-super-admin protection.

### Development-only preview accounts

`create-preview-accounts.ts` is operator-only and is never run at startup/deploy. It has no package alias, so the exact repository command is:

```sh
pnpm --filter @workspace/scripts exec tsx ./src/create-preview-accounts.ts
```

Safety gates require all of the following:

- the runtime environment is configured as development;
- a Clerk test-instance secret key;
- not running in a Replit deployment environment;
- none of the fixed preview profiles already exists in PostgreSQL;
- none of the matching identities already exists in Clerk.

It provisions one identity/profile for each supported role, plus linked doctor/patient records where applicable. It generates strong random passwords, prints the newly generated credentials once to the invoking operator, and does not store passwords in project files. Do not paste that output into this manual, source control, chat, tickets or logs. Store it only in an approved development credential channel, then clear terminal history/output according to local policy.

The generated test addresses use Clerk’s `+clerk_test` convention. When an interactive Clerk test-instance email challenge is presented, use Clerk’s development-only code `424242`; do **not** use that code for ClinicFlow mobile OTP. Never run this procedure against a production Clerk instance or published environment.

The script attempts to delete newly created Clerk identities if later provisioning fails, but cleanup itself can fail; follow any emitted identity IDs in the Clerk test administration UI. The script intentionally refuses updates and is not a reset command. Remove preview identities/data using an explicitly reviewed development cleanup process; none is implemented here.

## 8. Routing, services and authorization

### Web routes

Public/authentication routes:

- `/` — landing page; signed-in users are redirected to onboarding/role resolution.
- `/sign-in/*` and `/sign-up/*` — Clerk components.
- `/login`, `/register`, `/forgot-password` — redirects into Clerk routes.
- `/register-doctor` — records doctor intent, then redirects to sign-up.
- `/onboarding` — authenticated ClinicFlow profile creation.
- `/book/:reference` — resolves a revocable public QR reference; sign-in/onboarding is required before booking.

Protected portal routes:

- Admin shell: `/admin/{dashboard,clinics,branches,doctors,users,patients,masters,appointments,queue,reports,settings,audit,qrs,book}`
- Doctor: `/doctor/{dashboard,profile,clinics,branches,availability,exceptions,appointments,queue,patients,qrs,book}`
- Receptionist: `/receptionist/{dashboard,appointments,queue,patients,book}`
- Patient: `/patient/{dashboard,book,appointments,queue,profile}`

`superAdmin` and `clinicAdmin` share the `/admin` shell, but clinic admins are redirected away from users, masters, settings and audit pages. Client guards are user experience only; API authorization remains authoritative.

### API surface

All API routes are under `/api`. The OpenAPI operation inventory is:

| Family | Methods and paths |
|---|---|
| Health | `GET /healthz` |
| Identity | `GET/PATCH /me`; `POST /onboarding` |
| Mobile OTP | `POST /otp/request`; `POST /otp/verify` |
| Public discovery | `GET /public/clinics`; `/public/branches`; `/public/doctors`; `/public/availability`; `/public/qr/{reference}` |
| Clinics | `GET/POST /clinics`; `GET/PATCH/DELETE /clinics/{id}` |
| Branches | `GET/POST /branches`; `GET/PATCH/DELETE /branches/{id}` |
| Doctors | `GET/POST /doctors`; `GET/PATCH/DELETE /doctors/{id}` |
| Users | `GET/POST /users`; `GET/PATCH/DELETE /users/{id}`; `POST /users/{id}/password-reset` |
| Patients | `GET/POST /patients`; `GET/PATCH/DELETE /patients/{id}` |
| Masters | `GET/POST /masters`; `GET/PATCH/DELETE /masters/{id}` |
| Schedules | `GET/POST /schedules`; `PATCH/DELETE /schedules/{id}` |
| Date exceptions | `GET/POST /availability-exceptions`; `PATCH/DELETE /availability-exceptions/{id}` |
| Appointments | `GET/POST /appointments`; `GET /appointments/{id}`; `POST /appointments/{id}/actions` |
| Queue | `GET /queue`; `POST /queue/call-next` |
| QR | `GET/POST /qrs`; `GET/PATCH/DELETE /qrs/{id}`; `POST /qrs/{id}/regenerate` |
| Dashboard/reporting | `GET /dashboard`; `GET /reports`; `GET /audit-logs` |
| Settings | `GET/PATCH /settings` |

For request/response bodies, query parameters, enums and response codes, use `lib/api-spec/openapi.yaml`; do not infer payloads from this summary.

### Request handling and security controls in source

- Pino request logging runs first and redacts authorization, cookie and set-cookie headers.
- Helmet is enabled, but its content-security-policy feature is explicitly disabled.
- JSON bodies are limited to 128 KiB.
- Clerk middleware establishes identity.
- `/api` has a general 180 requests/minute limiter.
- `/otp` has an additional 30 requests/15 minutes limiter.
- Mutating methods reject cross-site browser requests and require either matching origin/host or bearer authentication.
- Validation uses generated Zod schemas plus date/mobile checks.
- Known validation/conflict errors receive controlled messages; unexpected server errors are logged and returned as a generic service-unavailable response.
- Public endpoints expose active discovery data and QR context, not patient data.

### Roles and tenancy

- `superAdmin`: global scope.
- `clinicAdmin`: assigned clinic scope; cannot grant administrator roles and does not receive platform users/masters/settings/audit UI.
- `doctor`: own doctor context and relevant assigned/owned clinic, schedule, appointment, patient and queue data.
- `receptionist`: assigned clinic/branch scope.
- `patient`: own profile, own appointments and own queue projection.

API checks are implemented in `src/lib/auth.ts` and per-route write authorization. Assignment validation ensures selected branches belong to selected clinics. Collection reads currently load records, enrich them, authorize/filter them, then sort/page them in the server process.

## 9. Core service behavior

### Availability

Availability requires an active doctor account/profile, active clinic/branch, branch assignment, an open weekly schedule, no closing exception, a non-past session, a date inside the booking horizon, and remaining token capacity. Weekly schedules support one session with one optional break per doctor/branch/day. Overnight sessions are rejected. Different timezones across potentially overlapping branch schedules are conservatively rejected.

Date exceptions can close a date or override times/break/capacity. An open-time override requires an existing weekly schedule. The implementation does not model multiple sessions in one branch/day.

### Booking and tokens

Booking is revalidated inside a database transaction using advisory locks. The service validates actor scope, patient status/mobile, doctor availability, queue mode, capacity, optional mobile-verification policy, consent for patient bookings, and QR context. Request IDs provide actor-scoped idempotency. Tokens are allocated sequentially per doctor/branch/date and protected by unique constraints.

Supported source codes are `online`, `walkIn`, `phone`, and `qr`; the current portal booking UI submits staff-created bookings as `walkIn`. Walk-ins are restricted to today and queue-open/break rules. The UI does not expose an explicit staff selector distinguishing phone from walk-in.

### Queue lifecycle

Implemented transitions:

```text
booked -> checkedIn -> waiting -> called -> inConsultation -> completed
waiting|called -> noShow -> waiting
booked|checkedIn|waiting -> cancelled
```

Transitions are validated, scoped, history/audit recorded, and protected with queue locks. Queue actions other than cancellation occur only on the appointment’s local date. A doctor/branch/date cannot have another `called` or `inConsultation` record. `call-next` picks the oldest waiting record.

Queue views refresh every 30 seconds. Staff receive entries; patients receive aggregate values and their own entry only. Estimated wait is patients ahead multiplied by configured consultation plus buffer minutes; it is an estimate, not a prediction model.

### QR booking

QR records contain a random public reference and clinic with optional branch/doctor context. The web UI renders/downloads PNGs. Public resolution returns context only. Regeneration replaces the reference, invalidating printed/old links. Deactivation uses the generic inactive status path. A QR booking is matched to the locked QR context again at booking time.

### Audit and reports

Important CRUD, onboarding, booking, transitions, QR regeneration, settings and bootstrap events write `audit_logs`. Reports group scoped appointment metrics by date, clinic or doctor and can export CSV in the browser. Dashboard/report calculations are performed from persisted rows in the API process.

Audit records currently contain actor, clinic scope, action, entity type/ID, summary and timestamp. They do not implement the original specification’s complete old value, new value or client IP record.

## 10. Mobile OTP and Twilio status

### Development provider

Configure the environment variable names documented in §4 for the development runtime and development OTP backend. `SESSION_SECRET` is still required. A request returns a randomized `developmentCode` only when both development gates are active. The code exercises digest, expiration, resend, request-limit, attempt-limit and one-time-consumption logic, but does not deliver a message and does not prove possession of the phone.

Never expose development-provider responses publicly and never configure development OTP in production. Production mode cannot enable it.

### Twilio provider

Twilio mode requires:

- the OTP backend selector named in §4 to select the production SMS backend;
- the Twilio account and Messaging Service variables named in §4;
- an authorized Replit Twilio connector;
- an approved sender/service with appropriate regional permissions;
- `SESSION_SECRET`.

The application submits through `@replit/connectors-sdk`, reports unavailable/rejected delivery as an explicit 503, and does not silently fall back to development verification.

**Current documented status:** production SMS integration is pending and has not been live-delivery tested. Do not mark mobile OTP production-ready until sender authorization, delivery, failure modes, regional restrictions, recovery and the end-to-end patient booking journey are verified in the target environment.

OTP behavior in source:

- mobile format is international E.164-like (`+` plus 8–15 digits);
- expiry is setting-driven but clamped to 60–900 seconds;
- resend cooldown is 60 seconds;
- maximum five requests/account/hour;
- route limit is 30 requests/15 minutes;
- attempts are setting-driven but clamped to 1–10;
- a new challenge consumes prior challenges;
- successful verification updates patient and user mobile state transactionally;
- changing a patient mobile resets verification.

## 11. Observability and troubleshooting

### Available observability

- `GET /api/healthz` is the configured API startup probe.
- The API emits Pino logs. Development uses `pino-pretty`; production uses structured output.
- `LOG_LEVEL` controls severity.
- HTTP log serializers include request ID, method, URL path without query string, and response status.
- Sensitive authorization/cookie response/request headers are redacted.
- Unexpected request failures are logged server-side; clients receive a generic message.
- Source maps are generated and enabled by the production API command.
- Audit events provide business-operation history, not infrastructure telemetry.

There is no repository implementation for metrics, distributed traces, uptime alerting, log retention, dashboards, paging, error aggregation or audit export retention.

### Troubleshooting sequence

1. **Separate infrastructure from identity from business rules.** Check `/api/healthz`; then Clerk sign-in; then `/api/me`; then the specific business endpoint.
2. **API will not start:** confirm that `PORT` is configured and valid, database configuration is available, and the API bundle exists. Rebuild with the package build command. Do not inspect or print secret values.
3. **Web Vite will not start/build:** confirm `PORT` and `BASE_PATH` names are configured; ensure the lockfile install completed; typecheck the web package.
4. **401 “Sign in required”:** the Clerk session/token did not reach the API. Check same-origin routing and Clerk client/proxy configuration names.
5. **403 “Complete onboarding first”:** Clerk identity exists but no ClinicFlow user is linked. Complete `/onboarding`, accept an invitation with the matching verified email, or use the controlled first-admin procedure as appropriate.
6. **403 “Account inactive” / permission denied / outside scope:** inspect the user’s persisted status, role and clinic/branch assignments through authorized admin UI. Do not bypass API authorization.
7. **Clerk invitation succeeded but profile creation failed:** because Clerk and PostgreSQL are not transactional together, reconcile the invitation and database record before retrying.
8. **No public clinics/doctors:** only active records are returned; doctors also need active branch assignments. Create/activate real records and schedules rather than fixtures.
9. **Availability says unavailable:** check doctor/account/clinic/branch active states, assignment, weekday schedule, date exception, local timezone/date, booking horizon, session end and remaining capacity.
10. **Schedule conflict:** only one branch/day session is supported, overlaps are rejected, and differing-timezone cross-branch schedules are treated conservatively.
11. **Booking 409:** refresh availability and inspect active duplicate booking, capacity, queue mode, closing time, QR context and idempotency-key reuse.
12. **Queue action 409:** refresh first; verify expected state, local appointment date and whether another entry is called/in consultation.
13. **Patient cannot view queue:** the selected appointment must belong to the signed-in patient and match the requested doctor/branch/date.
14. **OTP unavailable:** confirm configuration names and mode, `SESSION_SECRET`, then provider readiness. In Twilio mode inspect connector/provider authorization without logging code/body payloads.
15. **OTP throttled/expired:** observe the 60-second resend cooldown, hourly/request route limits, configured attempts and expiry; request a new challenge rather than altering persisted counters.
16. **Old QR fails:** regeneration/deactivation is intentionally revocable. Generate/distribute the current QR.
17. **Lists slow at scale:** current list/report logic is in-process after broad database reads. This is an architectural limit, not a browser-cache problem.
18. **Stale UI after account switch:** the web client clears React Query cache on Clerk user changes; if behavior persists, sign out fully and verify the active Clerk identity rather than changing roles in data.

Never log OTP bodies/codes, credentials, cookies, bearer tokens, database URLs, Clerk keys or preview-account output.

## 12. Known operational and product limitations

1. Production Twilio SMS delivery is pending and unverified.
2. Notifications beyond mobile OTP and Clerk invitations are not implemented. Persisted notification settings do not deliver reminders, email, WhatsApp or in-app notifications.
3. Clerk governs session lifetime. `sessionTimeoutMinutes` in settings is informational and does not reconfigure Clerk.
4. Collection authorization/filtering/sorting/pagination and report/dashboard aggregation happen in server memory after broad reads. SQL-side queries are needed before larger deployments.
5. One weekly session and one optional break per doctor/branch/weekday; no split sessions or overnight sessions.
6. Cross-branch overlap checks with differing timezones are conservative.
7. Clerk invitations and PostgreSQL writes cannot be atomic.
8. Queue “live” behavior is 30-second polling, not push.
9. There is no repository test suite/script or recorded acceptance evidence.
10. There is no implemented backup/restore runbook or automated restore verification.
11. There is no committed migration runner for applying versioned SQL; development uses schema push and published schema changes are delegated to Replit Publish.
12. Generic resource UI supports search and pagination for many lists, but not every page exposes all API filters or a sort control.
13. The generic UI hardcodes some workflow/form choices (for example roles, status, gender, queue mode) even though masters exist. This does not fully meet the original “all master values dynamic” requirement.
14. Seeded masters are a limited vocabulary. Country/state/city/area/pincode records are not populated by `seed-system`.
15. Administrative password-reset action only directs the user to Clerk recovery; it does not trigger a reset email.
16. The staff booking screen does not explicitly distinguish phone booking from walk-in; current staff portal submission uses `walkIn`.
17. Audit events do not preserve complete old/new snapshots or request IP.
18. The database has no separate roles, permissions, user-role, queue-entry or notification tables; role is a constrained user field and queue state resides on appointments.
19. Some optional domain fields/configuration live in JSONB rather than fully normalized columns.
20. Content Security Policy is disabled in Helmet configuration; security review is required.
21. No healthcare regulatory compliance claim is made. Security, privacy, retention and legal review remain release prerequisites.
22. The repository documentation says the separate visual wireframe was not available as an implementation reference; pixel-level conformance is unverified.
23. Preview account creation has no package script alias or cleanup command.
24. The post-merge database filter is inconsistent with the actual package name and must not be relied on.

## 13. Change procedures

### API contract or endpoint change

1. Update `lib/api-spec/openapi.yaml`.
2. Run the codegen command.
3. Implement/update the relevant API router and authorization.
4. Update web consumers.
5. Run typecheck/build gates.
6. Review generated diff for unexpected removals and validate role/tenancy behavior in acceptance testing.

### Database change

1. Update `lib/db/src/schema/core.ts`.
2. Create/review a versioned SQL and Drizzle metadata change using the project’s approved schema workflow; do not handwave a temporary runtime DDL script.
3. Review backward compatibility, constraints and existing data.
4. Use `push` only against development.
5. Update OpenAPI/server/web and seed logic as needed.
6. For published environments, review the managed Publish diff and record approval; do not claim it was applied without deployment evidence.
7. Ensure backup/restore readiness before destructive production changes—currently a documented gap.

### Role/authorization change

Review together:

- schema role constraint;
- `auth.ts` scope/can-read rules;
- route write authorization;
- OpenAPI role enums/descriptions;
- generated clients/Zod;
- frontend route map/navigation/guards;
- `seed-system.ts` governed vocabulary;
- bootstrap/preview scripts;
- cross-role negative acceptance cases.

Frontend hiding is never sufficient.

## 14. Original specification compared with the inspected project

Status vocabulary:

- **Source evidence** — implementation is present in inspected source, but runtime behavior was not tested for this manual.
- **Partial** — some required behavior exists, with a material omission or narrower implementation.
- **Unmet/gap** — required behavior/procedure is absent in inspected source.
- **Unverified** — cannot be established without running acceptance/security/deployment checks or having the referenced design evidence.

No row should be interpreted as a release certification.

| Original specification area | Status against inspected project |
|---|---|
| New React/TypeScript, Node REST, PostgreSQL architecture | **Source evidence.** Separate web/API artifacts, Drizzle schema and generated contract exist. |
| Real authentication, logout, recovery | **Source evidence / unverified runtime.** Clerk owns these flows. Password storage/hashing is delegated rather than implemented locally. |
| Genuine backend RBAC and tenancy | **Source evidence / unverified security.** API role/scope checks exist for all five roles; penetration and multi-account negative tests remain unverified. |
| No production role switcher | **Source evidence.** No role-switching control is present; roles come from persisted users. |
| Super admin | **Source evidence / unverified journey.** Admin shell, APIs and controlled bootstrap exist. |
| Clinic admin | **Partial.** Real constrained role/scope exists, but it shares the admin shell and is intentionally excluded from users, masters, settings and audit; full original clinic-admin matrix has not been demonstrated. |
| Doctor registration/profile/clinic management | **Source evidence / unverified journey.** Doctor intent onboarding, profile and owned/assigned clinic behavior exist. |
| Receptionist login/dashboard/assigned scope | **Source evidence / unverified journey.** Clerk login is shared rather than a dedicated authentication backend; scoped pages/actions exist. |
| Patient registration/profile | **Source evidence / unverified journey.** |
| User management fields/actions | **Partial.** CRUD/status/role/assignment and Clerk invitation exist. Last-login data is absent; reset action provides recovery instructions only; existing role switching is intentionally blocked. |
| Master management and dynamic usage | **Partial/unmet strict criterion.** CRUD/search/pagination and seeded vocabulary exist, but several UI/workflow enums remain hardcoded and location masters are not seeded. |
| Clinic and branch CRUD | **Source evidence / unverified journey.** Deletion is status deactivation. |
| Doctor management and assignments | **Source evidence / unverified journey.** |
| Weekly availability, break, capacity, clinic-specific schedule | **Source evidence.** Limited to one session/one break/day and no overnight sessions. |
| Leave/holiday/modified-time exceptions | **Source evidence.** Date exceptions support close or overrides. |
| Queue settings | **Partial.** Capacity, prefix, queue mode, duration, buffer and queue open/close exist per schedule; broader standalone settings/master behavior is narrower. |
| Appointment, walk-in, phone, QR, online sources | **Partial.** API source enum supports all; UI supports online/QR and submits staff booking as walk-in, without an explicit phone-booking choice. |
| Multi-step appointment booking with real availability | **Source evidence / unverified concurrency journey.** |
| QR generate/view/download/regenerate/deactivate and functional booking | **Source evidence / unverified scan journey.** |
| Patient search by required fields/history | **Partial.** Generic search covers name/mobile/code/email and appointment listing exists, but the exact combined result/history screen is not established. |
| Queue state machine, call next, no-show, requeue | **Source evidence / unverified concurrent use.** |
| Patient aggregate queue, token, ahead, estimate, auto-refresh | **Source evidence.** Uses 30-second polling and formula-based estimate. |
| Dynamic dashboards | **Source evidence / unverified accuracy.** Values derive from persisted API data; role presentation is shared and not every original metric is shown. |
| Reports | **Source evidence / partial.** Scoped grouped metrics and CSV export exist; not every originally listed report is a separate report. |
| Settings | **Partial.** Core platform/booking/OTP/terms fields exist; branding/notifications are not connected, and session timeout cannot control Clerk. |
| Audit logging | **Partial.** Important events are logged; full old/new/IP details are absent. |
| Database entities, FKs and indexes | **Partial.** Core relational model and integrity indexes exist; separate permissions, queue entries and notifications are absent; optional data uses JSONB. |
| Generated IDs/references/tokens | **Source evidence.** Backend generates IDs, codes, random appointment references and sequential tokens; exact human-readable formats differ from examples in the specification. |
| Search/filter/sort/pagination on all major tables | **Partial.** API supports shared filtering/sorting/pagination, but processing is in memory and UI controls are not exhaustive. |
| Empty/loading/error/retry states | **Partial.** Common states exist; retry is not consistently exposed on every API page. |
| Notifications | **Unmet/gap** beyond Clerk invitations and OTP. |
| Near-real-time synchronization | **Partial.** Controlled 30-second polling is implemented; no WebSocket/SSE. |
| Responsive/mobile experience and accessibility | **Source evidence / unverified.** Responsive CSS/components and labels/focus semantics are present, but WCAG and device acceptance were not run. |
| Security controls | **Partial/unverified.** Clerk, validation, parameterized ORM, rate limits, same-origin mutation checks, secure QR references, audit and secret-based config exist. CSP is disabled; no security assessment was run. |
| Development seed/demo accounts | **Partial.** System seed is non-demo; explicit development preview provisioning exists but is not automatic and credentials are deliberately not documented. This safely diverges from the request to publish passwords in README. |
| Migrations/reproducible database | **Partial.** Versioned SQL artifacts exist, but no migration-apply package command is implemented; development uses Drizzle push. |
| README/API/deployment documentation | **Partial.** README and OpenAPI exist; this manual expands operations. Backup/restore and definitive deployment-state evidence remain absent. |
| Exact wireframe/screen conformance | **Unverified.** Project documentation states the separate visual wireframe was not available; the written journeys were used. |
| Production-ready claim | **Unmet/unverified.** SMS, backup/restore, scale, security, privacy/compliance and full acceptance testing are outstanding. |

## 15. Acceptance and release checklist

This is a checklist to execute and record before release; it is **not** a statement that tests have been run.

### Build and contract

- [ ] Clean `pnpm install --frozen-lockfile` succeeds with the approved Node/pnpm toolchain.
- [ ] `pnpm run typecheck` succeeds.
- [ ] `pnpm run build` succeeds.
- [ ] Generated clients/Zod match the reviewed OpenAPI contract; no hand-edited generated files.
- [ ] Database schema diff, versioned SQL/metadata and compatibility review are approved.
- [ ] No secrets, preview credentials, patient data or OTPs appear in source, build output or logs.

### Environment and operations

- [ ] Required environment variable **names** are configured in the target environment through approved secret/configuration management.
- [ ] Development-only OTP and preview provisioning are disabled in every published environment.
- [ ] Health probe succeeds through the public router.
- [ ] Structured logs, retention, access, alerting and incident ownership are configured.
- [ ] Database backup policy exists and a restore drill has succeeded against the exact release schema.
- [ ] Rollback/data-recovery decision points are documented.
- [ ] Published schema application evidence is recorded; no speculative “migration complete” claim.

### Identity and authorization

- [ ] Sign-up, verified email, sign-in, logout and Clerk recovery work.
- [ ] Patient and doctor onboarding create the correct immutable role/profile.
- [ ] First-admin bootstrap is exercised only in an isolated acceptance environment.
- [ ] Super admin, clinic admin, doctor, receptionist and patient each see only intended routes/data/actions.
- [ ] Cross-clinic, cross-branch, cross-doctor and cross-patient API access is denied even with direct requests.
- [ ] Inactive accounts and records are denied appropriately.
- [ ] Last-active-super-admin protection works.
- [ ] Invitation/database partial-failure reconciliation is rehearsed.

### Core end-to-end journey

- [ ] Super admin creates a clinic and branch and assigns staff.
- [ ] Doctor signs in, completes profile, receives/creates permitted clinic context, and configures weekly availability.
- [ ] Date closures and modified-time exceptions affect discovery/booking.
- [ ] Receptionist sees only assigned doctors/patients and registers/searches a patient.
- [ ] Patient sees only active, assigned, available options.
- [ ] Online and walk-in bookings generate unique references/tokens; phone source behavior is either implemented or explicitly excluded from release.
- [ ] Capacity, duplicate booking, booking horizon, queue mode, queue open/close, break and concurrency conflicts are enforced.
- [ ] QR generation/download/open, context restriction, booking, regeneration invalidation and deactivation work.
- [ ] Check-in, enqueue, call-next, start, complete, no-show, requeue and cancellation transitions work; invalid/stale transitions fail.
- [ ] Doctor, receptionist and patient polling views converge; patient data never appears in another patient’s response.
- [ ] Dashboard/report/audit values reflect persisted changes.

### Mobile OTP and communications

- [ ] Development mobile OTP is tested only in a non-public development environment and is clearly labeled.
- [ ] Clerk `+clerk_test`/`424242` testing is kept distinct from ClinicFlow mobile OTP.
- [ ] Twilio sender/service is approved and connector access is authorized.
- [ ] Real SMS delivery, expiration, cooldown, hourly limits, attempt limits, replacement and single use work in the target region.
- [ ] Provider outage/rejection returns an explicit failure and never bypasses verification.
- [ ] Changing mobile resets verification.
- [ ] If Twilio remains pending, production mobile-verification-dependent workflows are not released as complete.
- [ ] Notification features not implemented are not advertised.

### Quality, security and release decision

- [ ] Original nine end-to-end acceptance scenarios are executed with independent real accounts and recorded evidence.
- [ ] Concurrent booking/token and queue-transition tests pass.
- [ ] Validation, rate-limit, same-origin/CSRF, XSS, dependency and authorization security review passes.
- [ ] CSP decision is reviewed and documented.
- [ ] Responsive desktop/tablet/mobile and keyboard/accessibility checks pass.
- [ ] Empty, loading, error, retry and unavailable-provider states are reviewed.
- [ ] In-memory list/report performance is measured with expected production volume or release is constrained accordingly.
- [ ] Privacy, retention, audit, healthcare/legal and incident-response reviews approve the intended data use.
- [ ] Every item classified partial, unmet or unverified in §14 is closed or explicitly accepted as a release limitation by the accountable owner.

## 16. Primary source pointers

- Commands/workspace: `package.json`; `pnpm-workspace.yaml`; each package’s `package.json`.
- Artifact lifecycle: `.replit`; `artifacts/*/.replit-artifact/artifact.toml`.
- Web route/role maps: `artifacts/clinicflow/src/App.tsx` (`routes`, `Guard`); `artifacts/clinicflow/src/clinic.tsx` (`navConfig`, `Onboarding`, `Booking`, `Queue`).
- Resource UI and hardcoded choices: `artifacts/clinicflow/src/resources.tsx` (`resources`, `ResourcePage`).
- API middleware/security: `artifacts/api-server/src/app.ts`; `src/lib/http.ts`; `src/lib/logger.ts`.
- Authentication/tenancy: `artifacts/api-server/src/lib/auth.ts`; `src/routes/identity.ts`; `src/routes/resources.ts`.
- Availability/booking/queue: `src/lib/availability.ts`; `src/routes/appointments.ts`; `src/lib/appointments.ts`; `src/routes/queue.ts`.
- OTP/Twilio: `src/routes/otp.ts`; `src/lib/otp-delivery.ts`; `docs/otp-operations.md`.
- API contract/codegen: `lib/api-spec/openapi.yaml`; `lib/api-spec/orval.config.ts`.
- Schema/SQL: `lib/db/src/schema/core.ts`; `lib/db/drizzle/`; `lib/db/package.json`.
- Operator scripts: `scripts/src/bootstrap-admin.ts`; `scripts/src/seed-system.ts`; `scripts/src/create-preview-accounts.ts`.
- Declared limitations: `README.md` (“Release boundaries”); `docs/backend-interface.md`.
- Original requirement baseline: `.conversation/attached_assets/Pasted--CLINICFLOW-COMPLETE-NEW-SYSTEM-DEVELOPMENT-IMPORTANT-R_1790057679029.txt`.