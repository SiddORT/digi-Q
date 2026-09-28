# ClinicFlow

Multi-clinic appointments and live queues, built with React/TypeScript, a Node REST API, PostgreSQL-native authentication, and generated OpenAPI clients. VPS operators: follow [the native-auth migration checklist](docs/auth/native-auth-migration.md) before deploying this release.

## Architecture and implementation order

1. Establish relational entities and migrations: User (local identity, database role, clinic/branch assignments), Clinic, Branch, Doctor, Patient, Master, Schedule, AvailabilityException, Appointment, status history, QR configuration, settings and immutable AuditLog.
2. Enforce local password/email-code authentication and tenancy in the API before building role-specific screens. `/me` resolves the local authenticated user. `/onboarding` accepts eligible registration intent only before a profile exists; no public admin claim. Initialize the first administrator through the controlled environment-based seed.
3. Build administration, doctor profiles and assignments; then recurring availability and date exceptions; then atomic booking/token allocation and queue transitions; then patient QR booking, reporting and responsive interfaces.
4. Render only persisted data. Empty databases yield useful empty states, never fabricated fixtures. Development seeds must be explicitly opt-in and must not be required for operation.

## Role matrix and navigation

| Role | Scope | Navigation |
|---|---|---|
| Super admin | All records; users, masters, platform settings and audit | `/admin/{dashboard,clinics,branches,doctors,users,patients,masters,appointments,queue,reports,settings}` |
| Clinic admin, if enabled | Assigned clinics only; no platform role grants | Assigned administration and reports |
| Doctor | Own profile/schedules/appointments, assigned or owned clinics, relevant patients | `/doctor/{dashboard,profile,clinics,availability,appointments,queue,patients}` |
| Receptionist | Assigned clinics/branches; registration, booking, check-in and queue | `/receptionist/{dashboard,appointments,queue,patients}` |
| Patient | Own profile and appointments; aggregate queue only | `/patient/{dashboard,book,appointments,queue,profile}` |

Public routes include `/sign-in` (`/login` redirects), `/patient-login`, `/register-clinic`, `/forgot-password`, and `/book/:publicReference`. Frontend route guards improve UX but never replace API authorization. Doctor/receptionist selectors use role-filtered records.

## Appointment and queue lifecycle

`booked → checkedIn → waiting → called → inConsultation → completed`.
Cancellation is allowed before consultation according to configured policy; waiting/called entries may become `noShow`, with authorized requeue to `waiting`. Each transition is validated and audited. Booking and check-in are distinct; token allocation is transactional and unique per doctor/branch/date. Call-next atomically selects the oldest eligible waiting entry and prevents simultaneous active consultations. Terminal history is preserved; deletion means deactivation where history exists.

## Availability and QR architecture

Schedules belong to a doctor, clinic and branch, with weekday, timezone, start/end, optional break, token prefix/capacity, consultation minutes, buffer and queue mode. Date exceptions override weekly availability. Booking checks branch assignments, open hours, breaks, exceptions, source policy and remaining capacity inside a transaction.

QRs contain only revocable random public references. Public resolution returns clinic/branch/doctor context, never patient information. Regeneration invalidates the prior reference. Booking proceeds through identity/profile, mobile verification where required, consent and confirmation containing reference/token. OTP uses an external SMS provider or an explicitly enabled development-only provider; **production SMS integration is pending**. The development provider may return `developmentCode` only when `NODE_ENV=development`. Never expose OTPs in production responses.

## API conventions

`lib/api-spec/openapi.yaml` is the source of truth; base URL `/api`. Typed camelCase entities, ISO dates/timestamps, string identifiers, paginated `{ items, total, page, pageSize }` lists, and `{ error, code? }` failures. Public discovery is under `/public`; protected business routes require an authenticated local session and database authorization. Lists support search/filter/sort. Queue views poll every **30 seconds**; patients receive only aggregate counts and their own token/position, never other patients' identities.

API families: `/me`, `/onboarding`, `/otp`, `/clinics`, `/branches`, `/doctors`, `/users`, `/patients`, `/masters`, `/schedules`, `/availability-exceptions`, `/appointments`, `/queue`, `/qrs`, `/dashboard`, `/reports`, `/audit-logs`, `/settings`.

Generate schemas/hooks after changes:

```sh
pnpm --filter @workspace/api-spec run codegen
```

Deployment requires PostgreSQL `DATABASE_URL` and configured SMTP delivery for password setup, recovery, patient login and device verification. Production mobile SMS verification additionally needs its configured SMS provider. Versioned SQL files document schema changes; for Replit-managed databases, Publish applies the development-to-production schema diff. On a VPS running migration-based deployment, run Drizzle migrations before the seed and start the API only after both succeed. Do not run ad-hoc production DDL at server startup or commit credentials.

## Starting with real accounts

Deployment initializes a Super Admin with `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME`
and secret `SUPERADMIN_PASSWORD`. The seed hashes the password with Argon2id,
never logs or stores it in plaintext, and does not rotate an existing password
on repeat execution. An already seeded matching Super Admin with no hash may
be initialized once under the controlled seed. An existing non-admin is never
promoted and an inactive account is never silently activated.
Replit-managed startup seeds after Publish migrations. On a migration-based
VPS, `pnpm --filter @workspace/db run deploy:prepare` runs migrations and then
the seed. See [database seed instructions](lib/db/README.md) and
[VPS checklist](docs/auth/native-auth-migration.md).

The separate system vocabulary seed does not create accounts. Historical provider-backed test fixtures are retired; use native regression tests, not old fixtures, for new verification.

1. Register and verify an email through the application. Doctor registration has a separate onboarding path; existing users cannot switch roles themselves.
2. To initialize the first administrator, set the three `SUPERADMIN_*` values in the deployment's secure secret store and run `pnpm --filter @workspace/scripts bootstrap-admin` (or the deployment seed). Passwords are never accepted on CLI arguments.
3. The administrator can invite staff and assign clinics/branches. Doctors can create their clinics, branches and schedules. Patient bookings use those actual schedules.

System master values can be initialized idempotently with `pnpm --filter @workspace/scripts seed-system`. See `docs/backend-interface.md` for server operations and `docs/otp-operations.md` for development verification versus real SMS.

## Complete documentation

For the subsequent controlled business-flow corrections and current verification evidence, see [Business Flow and Role Integration Audit](docs/audits/flow-integrity-report.md). It distinguishes the 92 live API checks, isolated regression tests, actual browser observations, and remaining verification gaps. Earlier system-manual statements describe the pre-audit snapshot where they differ.

See [ClinicFlow System Documentation](docs/ClinicFlow-System-Documentation.md) for the full role-by-role guide, screen/field reference, backend rules, database dictionary, operations manual, requirements comparison, and exact API contract. The [offline HTML edition](docs/ClinicFlow-System-Documentation.html) includes a table of contents and print/Save as PDF styling.

Source chapters are maintained in `docs/manual/`. Regenerate both editions with:

```sh
node scripts/export-documentation.mjs
```

## Release boundaries

This build needs multi-account acceptance, security and concurrency testing before handling real patient information. No claim of healthcare regulatory compliance is made.

- Production SMS delivery needs an authorized Twilio account, approved sender and configured messaging service.
- Email delivery for password setup, recovery, patient email codes and staff device verification requires a configured SMTP provider; no code or reset link may be returned to the browser when delivery is unavailable.
- Authentication session expiration and revocation belong to local PostgreSQL sessions; stored platform settings do not bypass session security policy.
- Lists currently filter and paginate authorized persisted records in the server process; SQL-level pagination and aggregation should precede larger deployments.
- Weekly schedules support one session and one break per branch/day, with date overrides. Overnight sessions are rejected.
- The separate visual wireframe was not attached; the written journeys are the reference used here.