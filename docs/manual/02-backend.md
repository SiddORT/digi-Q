# ClinicFlow backend manual

This document describes the backend that is present in this repository. It is an implementation reference, not a product roadmap. The HTTP implementation is in `artifacts/api-server/src`; the contract used to generate clients and Zod validators is `lib/api-spec/openapi.yaml`; the database model and migrations are in `lib/db/src/schema/core.ts` and `lib/db/drizzle`.

## 1. Runtime architecture

- The service is an Express application mounted under `/api`. `PORT` is mandatory and must be a positive number. [source: `artifacts/api-server/src/index.ts:4-24`; `artifacts/api-server/src/app.ts:13-64`]
- Request processing, in order, is: Pino HTTP logging; Helmet (CSP disabled); production Clerk frontend-API proxy; CORS; JSON (128 KiB limit) and URL-encoded parsing; Clerk authentication; global API rate limiting; mutation-origin checking; route dispatch; API 404; common error handling. [source: `artifacts/api-server/src/app.ts:15-64`]
- PostgreSQL access uses Drizzle. Most records split authorization/indexing fields into relational columns and optional/domain fields into a non-null JSONB `data` object. Store reads flatten `data` into the returned object and then overlay relational columns, so a relational column wins if the same key exists in JSON. [source: `artifacts/api-server/src/lib/store.ts:7-23`; `lib/db/src/schema/core.ts:4-75`]
- Collection operations currently select whole tables, enrich and authorize rows, filter, sort, and paginate in application memory. Dashboard and reports are likewise in-memory aggregates rather than SQL aggregates. [source: `artifacts/api-server/src/lib/store.ts:12,37-52`; `artifacts/api-server/src/routes/resources.ts:166-172`; `artifacts/api-server/src/routes/reporting.ts:16-43`]
- IDs are UUID strings generated with `crypto.randomUUID()`, except public QR references, which are 32 random bytes encoded as base64url. Appointment human references use 16 uppercase hexadecimal characters after `CF-`; generated clinic/branch/doctor/patient codes use the first eight characters of an ID. [source: `artifacts/api-server/src/lib/store.ts:1-6`; `artifacts/api-server/src/routes/resources.ts:124-141`; `artifacts/api-server/src/routes/appointments.ts:60-64`]

### HTTP and error behavior

- All routes below are relative to `/api`.
- JSON errors normally have `{error, code}`. Assertions default to code `REQUEST_FAILED`. Zod failures are HTTP 400/code `VALIDATION_ERROR`; PostgreSQL unique, foreign-key, and check failures (`23505`, `23503`, `23514`) become generic HTTP 409; unexpected failures become HTTP 500 with the public message `Service unavailable. Please retry.`. Unknown API routes return HTTP 404 `{error:"API route not found"}` without the common `code` field. [source: `artifacts/api-server/src/lib/http.ts:3-12,37-42`; `artifacts/api-server/src/app.ts:63-64`]
- Body dates named `date`, `from`, `to`, or `dateOfBirth` must be real `YYYY-MM-DD` dates. A body field named `mobile`, where present and truthy, must match E.164-like `^\+[1-9][0-9]{7,14}$`. Query `date`/`from`/`to` receive the same calendar validation and are normalized back to strings after generated-schema parsing. [source: `artifacts/api-server/src/lib/http.ts:9-35`]
- Generated Zod object schemas strip unknown object properties. The resource implementation uses each resource's **create** schema for both POST and PATCH, so PATCH requests must supply every field marked required below; they are not generic partial updates. [source: `artifacts/api-server/src/routes/resources.ts:14-24,177-183`; generated validators in `lib/api-zod/src/generated/api.ts`]
- Pagination defaults to page 1 and page size 20; schema maximum page size is 100. Results are `{items,total,page,pageSize}`. Default sort is `-createdAt`. Runtime-supported sort keys are only `createdAt`, `name`, `fullName`, `date`, `status`, `code`, `tokenNumber`, `sortOrder`, and `email`; a leading `-` reverses ordering. Sorting compares stringified values with numeric collation. [source: `lib/api-spec/openapi.yaml:432-444`; `artifacts/api-server/src/lib/store.ts:47-52`]
- Shared filters are exact matches for `clinicId`, `branchId`, `doctorId`, `patientId`, `status`, `role`, `category`, `parentId`, `gender`, `city`, `specializationId`, `source`, `entityType`, `actorId`, and `date`. For enriched users/doctors, clinic/branch filters also match membership arrays. `from`/`to` compare the record's `date`, or otherwise the UTC date portion of `createdAt`. Search is case-insensitive over `name`, `fullName`, `email`, `mobile`, `code`, `reference`, `patientName`, `doctorName`, and `summary`. Filters are applied only after authorization and cannot widen scope. [source: `artifacts/api-server/src/lib/store.ts:37-45`]

## 2. Authentication, security, and identity

### Clerk identity

Clerk middleware validates the authenticated identity. `requireIdentity` requires a Clerk `userId` (401 otherwise). `requireUser` additionally requires a linked ClinicFlow user and `status=active` (403 otherwise). On lookup, an unlinked Clerk identity can be attached to a pre-created user only when a verified Clerk email exactly matches the stored lower-case email and that user has no `clerkId`. [source: `artifacts/api-server/src/lib/auth.ts:7-30`]

The production-only `/api/__clerk` proxy targets Clerk's frontend API. It is inactive outside production and also becomes a no-op if the server-side Clerk key is absent. It derives the public host from the first `x-forwarded-host` value, sets Clerk proxy headers, forwards the first client IP, strips hop-by-hop response headers, and buffers length-unknown responses so a `Content-Length` can be emitted. [source: `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts:26-28,46-64,66-145`]

This backend never accepts a password and does not implement password storage. The “password reset” operation only tells the caller to use Clerk's sign-in recovery; it does not send an email itself. [source: `artifacts/api-server/src/routes/resources.ts:200-205`]

### Transport/request controls

- Helmet is enabled, but its content-security-policy middleware is disabled. [source: `artifacts/api-server/src/app.ts:35`]
- CORS is configured with credentials enabled and `origin:false`, so the API itself emits no permissive CORS origin. [source: `artifacts/api-server/src/app.ts:37`]
- `trust proxy` is set to one hop. [source: `artifacts/api-server/src/app.ts:34`]
- Every `/api` request is limited to 180 requests per 60 seconds by `express-rate-limit`; standard draft-8 headers are emitted and legacy headers are disabled. [source: `artifacts/api-server/src/app.ts:49`]
- A non-GET/HEAD/OPTIONS request is rejected when `Sec-Fetch-Site` is `cross-site`, or when `Origin`'s host differs from forwarded host/host. If no Origin is supplied, an `Authorization` header beginning exactly `Bearer ` is required. This is an origin/header check, not a CSRF token mechanism. [source: `artifacts/api-server/src/app.ts:50-61`]
- Request logging records request ID, method, URL without query string, and response status. OTP delivery explicitly avoids logging SMS payloads. [source: `artifacts/api-server/src/app.ts:15-33`; `artifacts/api-server/src/lib/otp-delivery.ts:16-17`]

### Onboarding and profile linkage

- `GET /me` requires Clerk identity but not onboarding. It returns `{clerkId,user,doctorId,patientId,needsOnboarding}`; `user` is null before onboarding. An existing inactive account is rejected. [source: `artifacts/api-server/src/routes/identity.ts:10-14`]
- `POST /onboarding` requires a verified primary Clerk email and no existing profile. Body: required `fullName` (non-empty); optional `intent` (`patient` default or `doctor`), `mobile`, and `termsAccepted`. `termsAccepted` is accepted but not enforced here. A transaction takes a Clerk-ID advisory lock, creates the user, then a doctor profile for doctor intent or patient profile otherwise, and writes an audit row. Patient is the fallback role. [source: `lib/api-spec/openapi.yaml:479-486`; `artifacts/api-server/src/routes/identity.ts:15-30`]
- `PATCH /me` body fields are optional `fullName` (non-empty), `mobile`, and `photoUrl`. It updates the user; mirrors name into a patient profile and resets mobile verification unless the number is unchanged; or merges the body into a doctor profile. The audit record is written against the pre-update user object. [source: `lib/api-spec/openapi.yaml:473-478`; `artifacts/api-server/src/routes/identity.ts:32-46`]

### OTP/mobile verification

OTP verifies a mobile number for an already authenticated, active ClinicFlow user; it does not authenticate the user.

- `POST /otp/request`: body `{mobile}` where mobile must match `^\+[1-9][0-9]{7,14}$`. The endpoint has the global limit plus an OTP-router limit of 30 requests per 15 minutes. Per user, an advisory lock enforces a 60-second resend cooldown and at most five challenges created in the preceding hour. Expiry comes from platform settings but is clamped to 60–900 seconds (default 300). A cryptographically generated six-digit code is stored only as HMAC-SHA256 of `challengeId:code`, keyed by the required `SESSION_SECRET`. Delivery occurs before the new row is inserted; all previous challenges for the user are then marked consumed. Response is `{challengeId,expiresAt,resendAfterSeconds:60,provider}` and `Cache-Control:no-store`. [source: `artifacts/api-server/src/routes/otp.ts:11-59`; `lib/api-spec/openapi.yaml:517-530`]
- `POST /otp/verify`: body requires `challengeId` and a 4–8 digit `code`. It locks per user and row-locks the matching challenge belonging to that user. Missing, consumed, or expired challenges fail; attempt limit comes from settings and is clamped to 1–10 (default 5). Every submitted code increments attempts before constant-time digest comparison, including the successful attempt. On success the challenge is consumed, the linked patient's mobile is set and verified, and the user's mobile is updated in one transaction. Response is `{verified:true,mobile,verifiedAt}` with `Cache-Control:no-store`. Failed attempt counts are deliberately returned from, rather than thrown within, the transaction so they commit. [source: `artifacts/api-server/src/routes/otp.ts:62-89`; `lib/api-spec/openapi.yaml:531-543`]
- Delivery is either an explicitly enabled development provider (`NODE_ENV=development` and `OTP_PROVIDER=development`) or Twilio through Replit Connectors when provider identifiers have the expected shape. Development mode returns `developmentCode`; production never does. Missing configuration and delivery rejection return coded 503 errors. The SMS includes the code, rounded-up expiry in minutes, and a do-not-share warning. [source: `artifacts/api-server/src/lib/otp-delivery.ts:4-37`; `artifacts/api-server/src/routes/otp.ts:54-59`]
- There is no challenge cleanup job in this source; consumed/expired rows remain stored. OTP request rate limiting is account-aware only for the database rules and IP-derived for `express-rate-limit`. Mobile numbers are not unique, and a request may target a number different from the user's current number. [source: `lib/db/src/schema/core.ts:71-75`; `artifacts/api-server/src/routes/otp.ts:20-53`]

## 3. Authorization and tenancy

### Scope model

`assignments` links a user to a clinic, optionally to a branch. A user's `clinicIds` is every distinct clinic in those rows; `branchIds` contains only non-null branch links. `superAdmin` bypasses scope. For everyone else a clinic must be in `clinicIds`. A branch restriction is enforced by the generic `scope` helper only for receptionists; clinic admins and doctors pass branch scope when the clinic is assigned. [source: `artifacts/api-server/src/lib/auth.ts:23-27,33-37`; `lib/db/src/schema/core.ts:18-21`]

Important observed tenancy boundaries:

- There is one shared database and shared platform settings singleton, not a database/schema/settings record per tenant.
- Masters are globally readable to every active authenticated user and globally writable only by super admins. [source: `artifacts/api-server/src/lib/auth.ts:38-40`; `artifacts/api-server/src/routes/resources.ts:36`]
- Clinic visibility is ownership or assignment. Branches and most clinic-owned resources use assignment scope. Doctors are visible to themselves, or clinic admins/receptionists with intersecting assignments; receptionists additionally need an intersecting doctor branch.
- A doctor can read only own appointments, schedules, availability exceptions, and QR rows; patient records are visible to a doctor only through an appointment with that doctor. A doctor's generic clinic/branch reads can nevertheless follow assigned clinic scope, and a doctor may create clinics and branches they own as described below. [source: `artifacts/api-server/src/lib/auth.ts:41-52`; `artifacts/api-server/src/routes/resources.ts:41-55`]
- A patient can read only their own patient row and own appointments. Masters are the exception because all authenticated users can read them. Queue access is a separate relationship check. [source: `artifacts/api-server/src/lib/auth.ts:39,42-49`; `artifacts/api-server/src/routes/queue.ts:15-26`]
- Patient registration has a single nullable `clinicId`/`branchId`; it is not a many-to-many tenancy model. Staff visibility may also arise from appointment relationship. Non-super-admin staff cannot move an existing patient registration to another clinic/branch. [source: `lib/db/src/schema/core.ts:29-33`; `artifacts/api-server/src/routes/resources.ts:46-51`]
- Assignments are replaced wholesale on user/doctor save. Each clinic ID creates a clinic-level row and each branch ID creates another row carrying its clinic, so duplicates at clinic level are possible by design and no database uniqueness constraint prevents duplicate assignments. A branch must belong to one of the submitted clinic IDs. [source: `artifacts/api-server/src/lib/auth.ts:58-69`; `lib/db/src/schema/core.ts:18-21`]

### Role capability matrix

“Scoped” below always includes the row-level rules above and active-account requirement.

| Capability | superAdmin | clinicAdmin | doctor | receptionist | patient |
|---|---:|---:|---:|---:|---:|
| Read public endpoints | yes | yes | yes | yes | yes |
| Read masters | yes | yes | yes | yes | yes |
| Mutate masters/settings | yes | no | no | no | no |
| List users | all | scoped, excludes super admins | no | no | no |
| Create/update/deactivate users | all; last active super admin protected | scoped; can administer doctor/receptionist/patient only; cannot change existing role | no | no | no |
| Read clinics/branches | all | scoped | owned/assigned scope | scoped, branch-restricted | no |
| Create clinic | yes | **no** | yes, becomes owner and assigned | no | no |
| Update/deactivate clinic | yes | scoped | owned only | no | no |
| Create/update/deactivate branch | yes | scoped | owned clinic only | no | no |
| Read doctors | all | scoped | self | scoped | no |
| Create doctor | yes | scoped admin | no | no | no |
| Update doctor | yes | scoped admin; rejected if doctor also assigned outside admin's clinics | self; cannot add assignments | no | no |
| Deactivate doctor | yes | scoped admin | self is technically authorized by the same write rule | no | no |
| Read patients | all | registration/appointment scope | appointment relationship | registration/appointment scope | self |
| Create patient | yes | scoped | no | scoped | no |
| Update patient | yes | registering scope | no | registering scope | self demographics only; no registration/status fields |
| Deactivate patient | yes | scoped | no | scoped | explicitly forbidden |
| Mutate schedules/exceptions | yes | scoped | own doctor ID | no | no |
| Mutate QRs | yes | scoped | own doctor ID when supplied/own-readable row | scoped receptionist | no |
| Book | any valid scope | valid scope | own doctor only | valid branch scope | self only, source `online` or `qr` |
| Appointment queue actions | all scoped | scoped | own | scoped | only cancel own |
| Read reports | yes | scoped | own appointment scope | scoped | no |
| Read audit logs | all | scoped clinic logs | no | no | no |
| Dashboard | scoped | scoped | scoped | scoped | own appointments and own patient count |

[source: `artifacts/api-server/src/lib/auth.ts:32-56`; `artifacts/api-server/src/routes/resources.ts:32-81,166-205`; `artifacts/api-server/src/routes/appointments.ts:21-24`; `artifacts/api-server/src/lib/appointments.ts:26-35`; `artifacts/api-server/src/routes/reporting.ts:16-48`]

## 4. Endpoint reference

All endpoints except those marked public require Clerk bearer/session authentication; most further require an active ClinicFlow user.

### Health and public discovery

| Method/path | Authentication | Inputs and behavior |
|---|---|---|
| `GET /healthz` | public | Returns `{status:"ok"}`. It does not query the database or integrations. |
| `GET /public/clinics` | public | Active clinics only. Query: `search`, `page`, `pageSize`. Removes `ownerId` but otherwise returns flattened clinic fields. |
| `GET /public/branches` | public | Active branches whose clinic is active. Query: `clinicId`, `page`, `pageSize`. |
| `GET /public/doctors` | public | Active doctor/account profiles with at least one active assigned branch; assignment arrays are reduced to active clinics/branches. Query: `search`, `clinicId`, `branchId`, `specializationId`, `page`, `pageSize`. Returns only `id`, `fullName`, `photoUrl`, `specializationName`, `qualificationNames`, `about`, `experienceYears`, `consultationFee`, `clinicIds`, `branchIds`. |
| `GET /public/availability` | public | Required query `doctorId`, `branchId`, `date`; returns computed availability described in §6. |
| `GET /public/qr/:reference` | public | Resolves an active QR plus active clinic, optional branch, and optional doctor/account. Returns identifiers/names only; invalid, revoked, or inactive context is 404. |

[source: `artifacts/api-server/src/routes/health.ts:6-9`; `artifacts/api-server/src/routes/public.ts:10-45`]

### Identity and OTP

`GET /me`, `PATCH /me`, `POST /onboarding`, `POST /otp/request`, and `POST /otp/verify` are specified in §2. `GET /me` and onboarding require only Clerk identity at entry; profile update and OTP require an active application user.

### Generic resources

The same runtime loop implements:

- `GET /{resource}` — scoped/filterable paginated list.
- `GET /{resource}/:id` — scoped item.
- `POST /{resource}` — create, HTTP 201.
- `PATCH /{resource}/:id` — validate using the full create schema, merge with old row, update.
- `DELETE /{resource}/:id` — soft-deactivate by setting relational `status="inactive"`, HTTP 204. There is no hard-delete endpoint.

Resources are `clinics`, `branches`, `doctors`, `users`, `patients`, `masters`, `schedules`, `availability-exceptions`, and `qrs`. Thus the implementation includes `GET /schedules/:id` and `GET /availability-exceptions/:id`, even though those two item reads are omitted from the current OpenAPI paths. [source: `artifacts/api-server/src/routes/resources.ts:14-24,166-199`; compare `lib/api-spec/openapi.yaml:264-307`]

Declared list query fields (in addition to the shared pagination behavior) are:

| Resource | Query fields |
|---|---|
| clinics | `search`, `status`, `city`, `page`, `pageSize`, `sort` |
| branches | `clinicId`, `search`, `status`, `page`, `pageSize`, `sort` |
| doctors | `search`, `clinicId`, `branchId`, `status`, `specializationId`, `page`, `pageSize`, `sort` |
| users | `search`, `role`, `clinicId`, `branchId`, `status`, `page`, `pageSize`, `sort` |
| patients | `search`, `clinicId`, `branchId`, `gender`, `page`, `pageSize`, `sort` |
| masters | `category`, `parentId`, `search`, `status`, `page`, `pageSize`, `sort` |
| schedules | `doctorId`, `clinicId`, `branchId`, `page`, `pageSize` |
| availability exceptions | `doctorId`, `branchId`, `from`, `to`, `page`, `pageSize` |
| QRs | `clinicId`, `branchId`, `doctorId`, `status`, `page`, `pageSize` |

[source: `lib/api-spec/openapi.yaml:96-99,122-125,148-151,176-179,210-214,237-241,264-267,286-289,361-364`]

#### Resource fields and validation

Fields not described as required are optional in the generated request schema. Because create schemas are reused, “required” applies to PATCH too.

| Resource | Required request fields | Optional request fields and constraints | Server behavior |
|---|---|---|---|
| clinics | `name` non-empty, `address` | `country`, `state`, `city`, `area`, `pincode`, `phone`, email-format `email`, `description`, `clinicTypeId`, `categoryId`, `status` active/inactive | Master references must be active categories `clinicType`/`clinicCategory`. Owner is creator and cannot be transferred. Code generated if absent. |
| branches | `clinicId`, `name` non-empty, `address` | `city`, `state`, `pincode`, `phone`, `timezone` default `Asia/Kolkata`, `status` | Timezone is validated by `Intl`; branch clinic/scope is checked; code generated. |
| doctors | `fullName` non-empty, email-format `email` | `mobile`, `photoUrl`, `gender`, real `dateOfBirth`, `specializationId`, `qualificationIds[]`, `registrationNumber`, integer `experienceYears>=0`, `about`, `consultationFee>=0`, `languages[]`, `clinicIds[]`, `branchIds[]`, `status` | Email lower-cased. Specialization and qualifications must be active correct-category masters. Creates/updates linked user role doctor. Assignments replaced wholesale. |
| users | `fullName` non-empty, email-format `email`, `role` | `mobile`, `status`, `clinicIds[]`, `branchIds[]` | Email lower-cased. New doctor/patient roles create typed profiles. Existing role cannot change. Linked doctor's status follows a supplied user status; linked patient's changed mobile resets verification. |
| patients | `fullName` non-empty, `mobile` | email-format `email`, real `dateOfBirth`, integer `age` 0–130, `gender`, `address`, emergency contact fields, `clinicId`, `branchId`, `status` | Mobile is additionally international-format validated and is mandatory in save. Code generated. Changing it resets `mobileVerified`. Patient self-update cannot submit clinic/branch/status. |
| masters | `category`, `name` non-empty, `code` non-empty | nullable `parentId`, integer `sortOrder`, `status` | Category enum: `country`, `state`, `city`, `area`, `pincode`, `clinicType`, `clinicCategory`, `clinicStatus`, `specialization`, `qualification`, `department`, `consultationType`, `appointmentStatus`, `appointmentType`, `bookingSource`, `cancellationReason`, `queueStatus`, `tokenPrefix`, `queueType`, `queuePriority`, `userRole`, `userStatus`. Parent must exist and cannot be self. |
| schedules | `doctorId`, `clinicId`, `branchId`, integer `dayOfWeek` 0–6 (Sunday 0), `isOpen`, `startTime`, `endTime`, `tokenPrefix` 1–8 chars, integer `maxTokens>=1`, integer `consultationMinutes>=1` | nullable `breakStart`/`breakEnd`; `timezone` default `Asia/Kolkata`; integer `bufferMinutes>=0` default 0; `queueMode` default `mixed` (`mixed`, `appointmentsOnly`, `walkInsOnly`); `queueOpenTime`, `queueCloseTime` | Doctor must be assigned/active at branch. Time/session and collision rules are in §6. Although OpenAPI regexes only `startTime`, runtime validates all used times as strict 24-hour `HH:mm`. |
| availability-exceptions | `doctorId`, `branchId`, real `date`, `isClosed`, `reason` | nullable `startTime`, `endTime`, `breakStart`, `breakEnd`, nullable integer `maxTokens>=1` | Unique per doctor/branch/date. Open overrides require a base weekly schedule and are time/cross-branch overlap checked; closed overrides skip time validation. |
| qrs | `name`, `clinicId` | nullable `branchId`, nullable `doctorId`, `status` | Creates a random immutable-until-regenerated `publicReference` and `bookingUrl=/book/{reference}`. Context consistency/scope is checked when IDs are truthy. |

[source: `lib/api-spec/openapi.yaml:544-735,851-869`; `artifacts/api-server/src/routes/resources.ts:32-164`; `artifacts/api-server/src/lib/availability.ts:4-31`]

Governed master categories accept only these codes: `userRole` = the five application roles; `appointmentStatus` and `queueStatus` = the eight appointment statuses; `bookingSource` = `online`, `walkIn`, `phone`, `qr`; `queueType` = `mixed`, `appointmentsOnly`, `walkInsOnly`; `userStatus` and `clinicStatus` = `active`, `inactive`. Existing governed category/code cannot be changed. Other master categories are not code-governed beyond category enum and uniqueness. [source: `artifacts/api-server/src/routes/resources.ts:25-31,76-80`]

Creating a doctor or user first looks for an existing DB email and refuses duplicates. It then links an existing Clerk user only if that Clerk account has that verified email and no DB profile; otherwise it asks Clerk to create an invitation. Clerk invitation/link lookup is external to the subsequent PostgreSQL transaction, so invitation creation and DB creation are not atomic. [source: `artifacts/api-server/src/routes/resources.ts:82-100`]

Additional endpoints:

- `POST /users/:id/password-reset`: super admin or scoped clinic admin; returns HTTP 202 explaining that the user must use `/sign-in` → Forgot password. It writes audit action `recoveryInstructions`, but sends nothing. [source: `artifacts/api-server/src/routes/resources.ts:200-205`]
- `POST /qrs/:id/regenerate`: authorized QR writer; replaces the public reference and booking URL transactionally and audits `regenerate`. The old reference immediately ceases to resolve because only the replacement is stored. [source: `artifacts/api-server/src/routes/resources.ts:206-214`]

### Appointments

- `GET /appointments`: active application user; scoped list. Query fields: `search`, `clinicId`, `branchId`, `doctorId`, `patientId`, `date`, `from`, `to`, appointment `status`, booking `source`, `page`, `pageSize`, `sort`.
- `GET /appointments/:id`: scoped item.
- `POST /appointments`: body requires `patientId`, `doctorId`, `clinicId`, `branchId`, real `date`, and source (`online`, `walkIn`, `phone`, `qr`). Optional: `appointmentTypeId`, `consultationTypeId`, `qrReference`, `requestId`, `termsAccepted`, and `notes` up to 1000 characters.
- `POST /appointments/:id/actions`: body requires action; optional `reason`, `cancellationReasonId`, `expectedStatus`. `cancellationReasonId` is accepted by validation but not looked up or used by transition logic. `reason`, when supplied, appears in the JSON history event but not the relational history row.

[source: `lib/api-spec/openapi.yaml:308-341,755-811`; `artifacts/api-server/src/routes/appointments.ts:12-72`; `artifacts/api-server/src/lib/appointments.ts:26-53`]

Booking rules:

1. Patients may book only their linked patient ID and only source `online` or `qr`; staff must pass scope, and doctors may book only themselves as doctor.
2. A transaction takes advisory locks for the doctor and doctor/branch/date queue.
3. `requestId`, when supplied, is idempotent per actor. If an original exists with the same patient/doctor/branch/date, it is returned; clinic/source and all other fields are not compared. A mismatched core tuple returns 409. Database uniqueness is `(actorId,requestId)`; PostgreSQL permits multiple null request IDs.
4. The same patient cannot have another non-terminal (`cancelled`, `completed`, `noShow` are terminal for this rule) appointment for the doctor/branch/date.
5. Patient, doctor account/profile, clinic, and branch must be active; doctor must have a branch assignment. Patient mobile must be valid international format. Staff must be able to read the patient.
6. Computed availability must be available and its branch-derived clinic must equal submitted `clinicId`.
7. Queue mode rejects walk-ins for `appointmentsOnly`, and rejects every non-walk-in source for `walkInsOnly`.
8. Walk-ins must be for the branch-local current date. Same-day booking must be before queue close. Walk-ins must additionally be after queue open (or session start) and outside the configured break. Online/phone/QR same-day bookings do not enforce queue-open time or break.
9. Platform mobile-verification policy is enforced. Patient-originated bookings require truthy `termsAccepted`; staff bookings do not.
10. QR source requires `qrReference`; the active QR's clinic must match and any QR branch/doctor constraints must match.
11. Appointment/consultation type IDs, if supplied, must be active masters of the correct category.
12. Token number is one greater than the maximum token ever allocated for that doctor/branch/date, including terminal appointments; cancelled tokens are not reused.

[source: `artifacts/api-server/src/routes/appointments.ts:21-65`; `lib/db/src/schema/core.ts:42-56`]

The stored appointment snapshots patient/doctor/clinic/branch names, patient code, timezone and session times, plus a generated reference/token and JSON status history. Later edits to those entities do not update the snapshot. `actorId` and `requestId` are deliberately removed from appointment API views. [source: `artifacts/api-server/src/routes/appointments.ts:61-64`; `artifacts/api-server/src/lib/appointments.ts:21-24`]

### Queue

- `GET /queue`: required `doctorId`, `branchId`, `date`; optional `appointmentId`. All callers need an active doctor/account/clinic/branch assignment context. Non-patients need scope and a doctor caller must be that doctor. A patient must have an appointment in that queue; if `appointmentId` is supplied, it must identify their matching appointment. Patients receive aggregates and `ownEntry`, but no `entries`; staff receive all queue appointment views.
- `POST /queue/call-next`: required body `doctorId`, `branchId`, `date`; super admin, clinic admin, doctor, or receptionist with queue scope. It locks the queue, rejects if any appointment is called/in consultation, then calls the first waiting appointment or returns `{appointment:null}`.

Waiting order is `waitingAt` falling back to `createdAt`, then token number. `currentToken` is the first row found in called/in-consultation state; `nextToken` is the first waiting token. Counts include all appointments for the queue date and `total` includes terminal/cancelled entries. A patient's `patientsAhead` includes waiting predecessors and one current called/in-consultation patient; booked/checked-in patients are placed behind all waiting entries; terminal/current own states report zero. Estimated wait is `patientsAhead * (weekly schedule consultationMinutes default 10 + bufferMinutes default 0)` and does not apply date exceptions or actual progress. Poll interval is hard-coded to 30 seconds. [source: `artifacts/api-server/src/routes/queue.ts:10-38`]

### Dashboard, reports, audit, and settings

- `GET /dashboard`: optional `date`, `clinicId`, `branchId`, `doctorId`. Date defaults to “today” in platform timezone. Appointment metrics are scoped then filtered. Active entity counts include only active rows and are separately scoped/filterable by clinic/branch. `activeQueues` counts distinct doctor/branch pairs with waiting/called/in-consultation rows. `currentToken` is the first active row, not explicitly sorted. Recent appointments are eight newest by `createdAt`. Recent activity is only included for super/clinic admins and is eight newest audit rows in scope. [source: `artifacts/api-server/src/routes/reporting.ts:11-25`]
- `GET /reports`: super admin, clinic admin, doctor, or receptionist. Optional `from`, `to`, `clinicId`, `branchId`, `doctorId`, `groupBy` (`date` default, `clinic`, `doctor`). Range defaults from first day of the platform-timezone current month through today and must be ordered. Metrics count appointments by current status and average only rows with numeric measured durations. Registrations are patient rows by `createdAt`. Date and clinic groups may be created from registrations without appointments; doctor groups are not. Doctor-group registrations count scoped registrations whose patient appears in one of that doctor's grouped appointments; clinic groups use patient registration clinic. Labels use the first appointment's snapshot name or key. [source: `artifacts/api-server/src/routes/reporting.ts:27-37`]
- `GET /audit-logs`: super admin or clinic admin. Query `search`, `entityType`, `actorId`, `clinicId`, `from`, `to`, `page`, `pageSize`. It enriches current actor name/role. Scope uses audit `clinicId`; super admin sees all, while clinic admin sees only assigned non-null clinic IDs. [source: `artifacts/api-server/src/routes/reporting.ts:39-44`; `artifacts/api-server/src/lib/auth.ts:33-37`]
- `GET /settings`: any active application user. Returns defaults merged with persisted singleton `settings.id="platform"`, plus live `otpProviderConfigured` and forced `queuePollSeconds:30`.
- `PATCH /settings`: super admin only. Optional fields: `platformName`; email-format `supportEmail`; `supportPhone`; valid IANA `timezone`; integer `bookingHorizonDays>=1`; integer `cancellationCutoffMinutes>=0`; `requireMobileVerification`; integer `otpExpirySeconds` 60–900; integer `otpMaxAttempts` 1–10; integer `sessionTimeoutMinutes>=5`; `notificationsEnabled`; `logoUrl`; `primaryColor`; `termsUrl`; `privacyUrl`. It merges and upserts the singleton and audits the update. `otpProviderConfigured` cannot be persisted.

Defaults are `platformName=ClinicFlow`, `timezone=Asia/Kolkata`, `bookingHorizonDays=60`, `cancellationCutoffMinutes=0`, `requireMobileVerification=false`, `otpExpirySeconds=300`, `otpMaxAttempts=5`, `sessionTimeoutMinutes=60`, `notificationsEnabled=false`, and `queuePollSeconds=30`. `sessionTimeoutMinutes` does not configure Clerk sessions in this source. `notificationsEnabled` is stored but no general notification dispatcher exists; implemented outbound messages are OTP SMS and Clerk invitations. [source: `artifacts/api-server/src/lib/store.ts:28-35`; `artifacts/api-server/src/routes/reporting.ts:45-54`; `lib/api-spec/openapi.yaml:937-962`]

## 5. Appointment state machine

| Action | Allowed from | Result | Timestamp/data effect |
|---|---|---|---|
| `checkIn` | `booked` | `checkedIn` | `checkedInAt` |
| `enqueue` | `checkedIn` | `waiting` | `waitingAt` |
| `call` | `waiting` | `called` | `calledAt` |
| `start` | `called` | `inConsultation` | `consultationStartedAt`; computes `waitMinutes` from `waitingAt` |
| `complete` | `inConsultation` | `completed` | `completedAt`; computes `consultationMinutesActual` from consultation start |
| `noShow` | `waiting`, `called` | `noShow` | no dedicated timestamp |
| `requeue` | `noShow` | `waiting` | replaces/sets `waitingAt` |
| `cancel` | `booked`, `checkedIn`, `waiting` | `cancelled` | `cancelledAt` |

Every transition:

- verifies row scope, takes queue advisory locks (unless the caller already holds them), reloads the row, validates the transition, and optionally enforces `expectedStatus`;
- permits patients only `cancel` on their own appointment; all other actions require a scoped staff role;
- revalidates active doctor/clinic/branch context for all actions except cancel, complete, and no-show;
- permits non-cancel queue actions only on the appointment's local current date;
- refuses call/start if a different row is called or in consultation;
- appends a JSON history event, inserts a relational `appointment_history` row, and inserts an audit summary in one transaction.

Cancellation computes minutes until appointment `startTime` using the appointment's stored timezone/date and requires that value to be at least `cancellationCutoffMinutes`. With the default cutoff 0, cancellation is accepted until the stored start minute. There is no transition out of completed/cancelled, and no direct skip between states. `allowedActions` in responses is derived only from current state and, for patients, reduced to cancel; for non-patients it does not pre-evaluate scope, date, cutoff, active-context, or one-current-patient rules, so an advertised action can still fail. [source: `artifacts/api-server/src/lib/appointments.ts:7-53`]

## 6. Availability, timezones, capacity, and concurrency

### Weekly schedules and exceptions

- Time strings used by runtime must be exactly `HH:mm` in 24-hour range. Open sessions require start before end; overnight sessions are unsupported. Break start/end must be both present or both absent, ordered, and within the session. Queue open must precede session end. Queue close must be at/before session end and after queue open or session start. Closed schedule/exception validation returns early. [source: `artifacts/api-server/src/lib/availability.ts:4-24`]
- A schedule collision check rejects another active schedule for the same doctor/day if it is the same branch regardless of open/closed state, or, when both are open, if time ranges overlap. Differing timezones are conservatively treated as collision rather than converted. There is no database unique constraint for schedules; this rule is transaction/advisory-lock enforced by application code. [source: `artifacts/api-server/src/routes/resources.ts:99-110`; `lib/db/src/schema/core.ts:34-37`]
- A non-closed date exception requires an active weekly base schedule at that branch/day. It overlays non-null submitted values, while nullable break fields may explicitly clear breaks, validates effective times, and rejects overlap with another branch's active open schedule. Closed exceptions do not require a base schedule in the save path. The database permits exactly one exception per doctor/branch/date. [source: `artifacts/api-server/src/routes/resources.ts:111-119`; `lib/db/src/schema/core.ts:38-41`]

### Computation

Availability validates the date, verifies active doctor profile, linked account, clinic, branch, and exact doctor-branch assignment, and selects the first active weekly schedule matching UTC weekday. It selects the first active matching exception. Exception overrides only `startTime`, `endTime`, `breakStart`, `breakEnd`, and `maxTokens`; it does not override timezone, token prefix, consultation/buffer minutes, queue mode, or queue open/close. Effective timezone is schedule timezone, else branch timezone, else `Asia/Kolkata`. [source: `artifacts/api-server/src/lib/availability.ts:25-42`]

Booked capacity counts every appointment on doctor/branch/date except `cancelled`; completed and no-show appointments therefore still consume capacity. Availability is false, with later checks able to replace earlier reasons, when there is no open weekly schedule, a closed exception, the session date/end is in the past, the date exceeds the platform booking horizon, or capacity is exhausted. No explicit lower-bound horizon check is needed because past dates are separately rejected. `maxTokens` defaults to 0, consultation minutes to 10, token prefix to `A`, queue mode to `mixed`, and buffer to 0 when values are missing/falsy. [source: `artifacts/api-server/src/lib/availability.ts:33-51`]

The runtime availability object contains `doctorId`, `branchId`, branch-derived `clinicId`, `date`, `available`, nullable `reason`, nullable start/end/break times, `timezone`, `maxTokens`, `bookedTokens`, `remainingTokens`, `consultationMinutes`, `tokenPrefix`, `queueMode`, optional queue open/close, and `bufferMinutes`. The current OpenAPI `Availability` schema does not declare the final four queue-related runtime properties. [source: `artifacts/api-server/src/lib/availability.ts:51`; `lib/api-spec/openapi.yaml:735-754`]

Dates and clock times are stored separately as text. “Now” is converted through `Intl.DateTimeFormat` in the effective IANA timezone. Weekday selection uses noon UTC for the supplied calendar date. Appointment transition timing durations use absolute UTC instants (`Date.now()` against stored ISO timestamps), while session/cutoff checks use local calendar date plus minute-of-day. [source: `artifacts/api-server/src/lib/availability.ts:8-13,33-36`; `artifacts/api-server/src/lib/appointments.ts:36-48`]

### Locking and database enforcement

Booking and queue changes take PostgreSQL transaction advisory locks on `schedules:{doctorId}` and `{doctorId}:{branchId}:{date}`. Schedule saves take a resource-derived doctor lock; exception saves additionally take the schedule doctor lock. Queue rows are re-read after locking. [source: `artifacts/api-server/src/lib/appointments.ts:17-20,26-31`; `artifacts/api-server/src/routes/resources.ts:99-102`]

Database constraints provide a second layer:

- unique token number per doctor/branch/date;
- positive token number;
- unique `(actorId,requestId)`;
- unique non-terminal appointment per patient/doctor/branch/date;
- at most one called or in-consultation appointment per doctor/branch/date;
- constrained appointment status values.

The idempotency lookup and insertion occur under the queue lock, and the unique actor/request index protects reuse across different queues as well. There is no generic optimistic version column; `expectedStatus` is the transition-specific stale-write guard. [source: `lib/db/src/schema/core.ts:47-56`; `artifacts/api-server/src/routes/appointments.ts:25-32`; `artifacts/api-server/src/lib/appointments.ts:29-32`]

## 7. Audit and reporting semantics

Audit rows are append-only by API convention: there are no audit mutation routes. Each contains actor, derived clinic scope, action, entity type/id, fixed summary text `${action} ${type} record`, and creation time. The helper derives clinic from `row.clinicId`, or from the clinic's own ID only when entity type is `clinics`. Consequently platform/user/master/settings audits generally have null clinic scope; clinic admins cannot see null-scoped logs. No old/new values, request ID, IP, reason, or payload are stored. The database foreign keys do not use cascade deletion. [source: `artifacts/api-server/src/lib/store.ts:25-27`; `lib/db/src/schema/core.ts:66-70`]

Audited operations are onboarding, self profile update, generic create/update/deactivate, appointment booking and every appointment transition, password-recovery instructions, QR regeneration, and settings update. OTP request/verify, reads, and failed writes are not audited. Generic deactivate audits the pre-deactivation object; self-profile update similarly passes the pre-update user; the summary does not distinguish those details. [source: `artifacts/api-server/src/routes/identity.ts:21-27,32-45`; `artifacts/api-server/src/routes/resources.ts:149-162,184-213`; `artifacts/api-server/src/routes/appointments.ts:63-65`; `artifacts/api-server/src/lib/appointments.ts:50-52`; `artifacts/api-server/src/routes/reporting.ts:46-53`]

Measured wait is recorded only at `start`, from the latest `waitingAt` (requeue resets it). Measured consultation duration is recorded only at `complete`. Reports average only rows with numeric values, return zero for no samples, and do not round. Status metrics are current-state counts rather than event counts. [source: `artifacts/api-server/src/lib/appointments.ts:46-50`; `artifacts/api-server/src/routes/reporting.ts:11-14`]

## 8. Database schema and migrations

All primary keys are text. Unless stated otherwise, foreign keys use PostgreSQL `NO ACTION` for update/delete. JSONB `data` columns are non-null and default to `{}`. `created_at` columns shown are timezone-aware, non-null, and default to `now()`. [source: `lib/db/src/schema/core.ts:4-75`; `lib/db/drizzle/0000_clinicflow_initial.sql:1-199`]

### `users`

- `id` PK; nullable unique `clerk_id`; unique non-null `email`; non-null `full_name`; nullable `mobile`; non-null `role`; non-null `status` default `active`; `data`; `created_at`.
- Check `role IN (superAdmin, clinicAdmin, doctor, receptionist, patient)`. There is no database check on status or mobile format.
- Referenced by clinic ownership, assignments, doctor/patient profiles, appointment actors/history, audit actors, and OTP challenges. [source: `lib/db/src/schema/core.ts:7-11`]

### `clinics`

- `id` PK; nullable `owner_id -> users.id`; non-null `status` default `active`; `data`; `created_at`.
- Index on `owner_id`. Referenced by branches, assignments, patients, schedules, appointments, QRs, and audit logs. [source: `lib/db/src/schema/core.ts:12-14`]

### `branches`

- `id` PK; non-null `clinic_id -> clinics.id`; non-null `status` default `active`; `data`; `created_at`.
- Index on `clinic_id`. Referenced by assignments, patients, schedules, exceptions, appointments, and QRs.
- The database does not enforce that a row elsewhere containing both clinic and branch uses the branch's clinic; application writes check this in several paths. [source: `lib/db/src/schema/core.ts:15-17`]

### `assignments`

- `id` PK; non-null `user_id -> users.id`; non-null `clinic_id -> clinics.id`; nullable `branch_id -> branches.id`.
- Indexes on `user_id` and `(clinic_id,branch_id)`.
- No created time, status, unique constraint, or database-level branch/clinic consistency constraint. [source: `lib/db/src/schema/core.ts:18-21`]

### `masters`

- `id` PK; non-null `category`; non-null `code`; nullable self-reference `parent_id -> masters.id`; non-null `status` default `active`; `data`.
- Unique index `(category,code)`. No created time. The self-reference was added by migration `0001`. [source: `lib/db/src/schema/core.ts:22-24`; `lib/db/drizzle/0001_clinicflow_integrity.sql:1`]

### `doctors`

- `id` PK; non-null unique `user_id -> users.id`; nullable `specialization_id -> masters.id`; non-null `status` default `active`; `data`.
- No created time. Clinic/branch membership is through the linked user's assignments, not doctor columns. [source: `lib/db/src/schema/core.ts:25-28`]

### `patients`

- `id` PK; nullable unique `user_id -> users.id`; nullable `clinic_id -> clinics.id`; nullable `branch_id -> branches.id`; non-null `mobile` default empty string; non-null `mobile_verified` default false; non-null `status` default `active`; `data`; `created_at`.
- Indexes on `(clinic_id,branch_id)` and `mobile`; mobile is not unique. Standalone staff-created patients may have no user identity. The mobile index was added in migration `0001`. [source: `lib/db/src/schema/core.ts:29-33`; `lib/db/drizzle/0001_clinicflow_integrity.sql:3`]

### `schedules`

- `id` PK; non-null `doctor_id -> doctors.id`; non-null `clinic_id -> clinics.id`; non-null `branch_id -> branches.id`; non-null integer `day_of_week`; non-null `status` default `active`; `data`.
- Index `(doctor_id,branch_id,day_of_week)`; check weekday 0–6. There is no database uniqueness or created time. Session details are JSONB. [source: `lib/db/src/schema/core.ts:34-37`]

### `availability_exceptions`

- `id` PK; non-null `doctor_id -> doctors.id`; non-null `branch_id -> branches.id`; non-null text `date`; non-null `status` default `active`; `data`.
- Unique `(doctor_id,branch_id,date)`. No created time and no database date-format check. [source: `lib/db/src/schema/core.ts:38-41`]

### `appointments`

- `id` PK; non-null foreign keys `patient_id`, `doctor_id`, `clinic_id`, `branch_id`; non-null text `date`; non-null integer `token_number`; non-null `status` default `booked`; nullable `request_id`; non-null `actor_id -> users.id`; `data`; `created_at`.
- Unique indexes: `(doctor_id,branch_id,date,token_number)`; `(actor_id,request_id)`; expression `(data->>'reference')`; partial `(patient_id,doctor_id,branch_id,date)` when status is not terminal; partial `(doctor_id,branch_id,date)` when status is called/in consultation.
- Indexes on `patient_id` and `(clinic_id,branch_id,date)`.
- Checks: status is one of the eight lifecycle values; token number > 0. The reference uniqueness and positive-token check were added in migration `0001`.
- Date, snapshot fields, source, names, token display string, timestamps/durations, and JSON history live in `data`. [source: `lib/db/src/schema/core.ts:42-56`; `lib/db/drizzle/0001_clinicflow_integrity.sql:2,4`]

### `appointment_history`

- `id` PK; non-null `appointment_id -> appointments.id`; non-null `actor_id -> users.id`; nullable `from_status`; non-null `to_status`; `created_at`.
- Index on `appointment_id`. It stores no action, reason, or payload snapshot. Status values are not database-checked here. [source: `lib/db/src/schema/core.ts:57-60`]

### `qrs`

- `id` PK; non-null `clinic_id -> clinics.id`; nullable `branch_id -> branches.id`; nullable `doctor_id -> doctors.id`; non-null unique `public_reference`; non-null `status` default `active`; `data`; `created_at`.
- Index `(clinic_id,branch_id)`. Display name and booking URL are JSONB fields. [source: `lib/db/src/schema/core.ts:61-65`]

### `audit_logs`

- `id` PK; nullable `actor_id -> users.id`; nullable `clinic_id -> clinics.id`; non-null `action`, `entity_type`, `entity_id`, `summary`; `created_at`.
- Index `(clinic_id,created_at)`. `entity_id` is deliberately not a foreign key because it is polymorphic. [source: `lib/db/src/schema/core.ts:66-69`]

### `settings`

- `id` text PK; `data` JSONB. No created/update time. Runtime uses the singleton ID `platform`. [source: `lib/db/src/schema/core.ts:70`; `artifacts/api-server/src/lib/store.ts:33-35`]

### `otp_challenges`

- `id` PK; non-null `user_id -> users.id`; non-null `mobile`; non-null `code_hash`; non-null timezone-aware `expires_at`; non-null integer `attempts` default 0; nullable timezone-aware `consumed_at`; `created_at`.
- Index `(user_id,created_at)`. No uniqueness, attempt-range check, or automatic expiry/deletion constraint. [source: `lib/db/src/schema/core.ts:71-75`]

### Migration history

- `0000_clinicflow_initial.sql` creates all 15 tables, initial foreign keys/checks/indexes.
- `0001_clinicflow_integrity.sql` adds the master parent foreign key, unique appointment JSON reference, patient mobile index, and positive appointment token check.
- Drizzle schema is the current source model; no runtime startup DDL or migration runner appears in the API server. [source: `lib/db/drizzle/0000_clinicflow_initial.sql`; `lib/db/drizzle/0001_clinicflow_integrity.sql`; `artifacts/api-server/src/index.ts:1-25`]

## 9. Current implementation boundaries

These are descriptive limits visible in source:

- The OpenAPI document is the intended generated contract, but runtime resource routing is broader in two item-read cases noted above, and runtime PATCH validation is full-input rather than partial. Some response properties declared by OpenAPI (for example clinic counts, user `lastLoginAt`, schedule display names) are not populated by the generic enrichment code unless already present in JSON. [source: `artifacts/api-server/src/lib/entities.ts:3-22`; `artifacts/api-server/src/routes/resources.ts:166-183`; `lib/api-spec/openapi.yaml:507-515,561-571,704-713`]
- In-memory whole-table reads are used extensively. This preserves authorization before pagination but does not provide database-side pagination/aggregation and will scale with total table size. [source: `artifacts/api-server/src/lib/store.ts:12,37-52`]
- Soft deactivation does not cascade. Existing appointments/history remain, but active-context checks can block future availability and most queue transitions. There is no reactivation-specific endpoint; an authorized full PATCH can set status active.
- Weekly availability supports one effective session and one optional break per doctor/branch/day. Runtime takes the first matching active schedule if inconsistent legacy rows exist. Overnight sessions and timezone-normalized cross-branch overlaps are not supported. [source: `artifacts/api-server/src/lib/availability.ts:15-24,33-51`]
- Availability exceptions do not override all scheduling fields; queue estimates ignore exceptions; queue polling is client-driven at a fixed 30 seconds. There is no websocket/SSE route. [source: `artifacts/api-server/src/lib/availability.ts:40-51`; `artifacts/api-server/src/routes/queue.ts:15-26`]
- General notifications, reminders, server-side export routes, clinical notes/prescriptions, payments, and file upload/storage routes are not present. Browser-side report CSV export is implemented by the frontend. Notification settings and branding/contact URLs are persisted configuration only.
- Clerk invitations are outside the DB transaction. Password recovery action does not trigger Clerk delivery. Session timeout configuration is informational to this backend. [source: `artifacts/api-server/src/routes/resources.ts:82-100,200-205`; `artifacts/api-server/src/routes/reporting.ts:45-54`]
- Audit is a summary trail, not a before/after or security-event log. OTP events and reads are absent. Audit rows with null clinic scope are visible only to super admins through the current endpoint scope logic.
- Database status checks exist for users' role and appointments' status, but most `status` columns and JSONB domain fields rely on API validation. Direct database writers could bypass application-only clinic/branch consistency, assignment uniqueness, schedule collision, mobile/date, and many enum rules. [source: `lib/db/src/schema/core.ts:7-75`]
- Public discovery and availability intentionally require no authentication and expose active clinic/branch data, selected professional doctor fields, QR context, and capacity/session details. They do not expose user emails/mobiles through the explicit public doctor projection. [source: `artifacts/api-server/src/routes/public.ts:10-45`; `artifacts/api-server/src/lib/entities.ts:20-22`]

## 10. Source map

- Server bootstrap/middleware: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`
- Route mounting: `artifacts/api-server/src/routes/index.ts`
- Identity and scope: `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/routes/identity.ts`
- Generic resources: `artifacts/api-server/src/routes/resources.ts`, `artifacts/api-server/src/lib/entities.ts`
- Availability and booking: `artifacts/api-server/src/lib/availability.ts`, `artifacts/api-server/src/routes/appointments.ts`
- State machine and queue locking: `artifacts/api-server/src/lib/appointments.ts`, `artifacts/api-server/src/routes/queue.ts`
- OTP: `artifacts/api-server/src/routes/otp.ts`, `artifacts/api-server/src/lib/otp-delivery.ts`
- Store/filter/audit/settings: `artifacts/api-server/src/lib/store.ts`
- Reporting: `artifacts/api-server/src/routes/reporting.ts`
- Validation/error normalization: `artifacts/api-server/src/lib/http.ts`
- Contract and generated validation basis: `lib/api-spec/openapi.yaml`, `lib/api-zod/src/generated/api.ts`
- Current schema/migrations: `lib/db/src/schema/core.ts`, `lib/db/drizzle/0000_clinicflow_initial.sql`, `lib/db/drizzle/0001_clinicflow_integrity.sql`