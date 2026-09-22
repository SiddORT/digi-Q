# ClinicFlow

Multi-clinic appointments and live queues, built with React/TypeScript, a Node REST API, PostgreSQL, Clerk identity, and generated OpenAPI clients. This is the implementation plan and contract, not a claim that every integration is deployed.

## Architecture and implementation order

1. Establish relational entities and migrations: User (Clerk identity, database role, clinic/branch assignments), Clinic, Branch, Doctor, Patient, Master, Schedule, AvailabilityException, Appointment, status history, QR configuration, settings and immutable AuditLog.
2. Enforce authentication and tenancy in the API before building role-specific screens. `/me` bridges Clerk to the database. `/onboarding` accepts patient/doctor intent only before a profile exists; ordinary registration is patient. No public admin claim: bootstrap the first administrator through a controlled CLI with verified email/Clerk ID. Clerk handles passwords, recovery and logout.
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

Public routes: `/login`, `/register`, `/forgot-password`, `/book/:publicReference`. Frontend route guards improve UX but never replace API authorization. Doctor/receptionist selectors use role-filtered records.

## Appointment and queue lifecycle

`booked → checkedIn → waiting → called → inConsultation → completed`.
Cancellation is allowed before consultation according to configured policy; waiting/called entries may become `noShow`, with authorized requeue to `waiting`. Each transition is validated and audited. Booking and check-in are distinct; token allocation is transactional and unique per doctor/branch/date. Call-next atomically selects the oldest eligible waiting entry and prevents simultaneous active consultations. Terminal history is preserved; deletion means deactivation where history exists.

## Availability and QR architecture

Schedules belong to a doctor, clinic and branch, with weekday, timezone, start/end, optional break, token prefix/capacity, consultation minutes, buffer and queue mode. Date exceptions override weekly availability. Booking checks branch assignments, open hours, breaks, exceptions, source policy and remaining capacity inside a transaction.

QRs contain only revocable random public references. Public resolution returns clinic/branch/doctor context, never patient information. Regeneration invalidates the prior reference. Booking proceeds through identity/profile, mobile verification where required, consent and confirmation containing reference/token. OTP uses an external SMS provider or an explicitly enabled development-only provider; **production SMS integration is pending**. The development provider may return `developmentCode` only when `NODE_ENV=development`. Never expose OTPs in production responses.

## API conventions

`lib/api-spec/openapi.yaml` is the source of truth; base URL `/api`. Typed camelCase entities, ISO dates/timestamps, string identifiers, paginated `{ items, total, page, pageSize }` lists, and `{ error, code? }` failures. Public discovery is under `/public`; all other business routes require Clerk identity and database authorization. Lists support search/filter/sort. Queue views poll every **30 seconds**; patients receive only aggregate counts and their own token/position, never other patients' identities.

API families: `/me`, `/onboarding`, `/otp`, `/clinics`, `/branches`, `/doctors`, `/users`, `/patients`, `/masters`, `/schedules`, `/availability-exceptions`, `/appointments`, `/queue`, `/qrs`, `/dashboard`, `/reports`, `/audit-logs`, `/settings`.

Generate schemas/hooks after changes:

```sh
pnpm --filter @workspace/api-spec run codegen
```

Deployment requires PostgreSQL `DATABASE_URL`, provisioned Clerk server/public configuration, and a connected SMS provider for production mobile verification. Versioned SQL files document schema changes; for the managed database, Publish applies the development-to-production schema diff. Do not run production DDL at server startup. Do not commit credentials or invent development account passwords.

## Starting with real accounts

The system seed does not create doctor, patient, receptionist, or administrator accounts. Separate development-only test accounts were subsequently created through the explicit preview-account provisioning script; their passwords are not stored in repository documentation.

1. Register and verify an email through the application. Doctor registration has a separate onboarding path; existing users cannot switch roles themselves.
2. To establish the first administrator, create a verified Clerk identity but do not finish patient/doctor onboarding. An authorized project operator runs:
   `pnpm --filter @workspace/scripts bootstrap-admin --clerk-id <verified-clerk-user-id>`
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
- General notification delivery beyond mobile OTP and Clerk account invitations is not connected.
- Authentication session lifetime is controlled by Clerk; a stored platform session-timeout value does not reconfigure Clerk.
- Lists currently filter and paginate authorized persisted records in the server process; SQL-level pagination and aggregation should precede larger deployments.
- Weekly schedules support one session and one break per branch/day, with date overrides. Overnight sessions are rejected.
- The separate visual wireframe was not attached; the written journeys are the reference used here.