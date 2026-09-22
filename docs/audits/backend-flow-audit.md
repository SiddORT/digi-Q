# Backend flow audit

## Pre-change findings (recorded before implementation)

Sources: full supplied end-to-end audit attachment; current backend source; `docs/manual/02-backend.md`, user guide, operations manual, backend interface and existing schema. The attachment supersedes the old implementation description where it explicitly changes walk-in behavior.

1. **Walk-in stays booked** (`routes/appointments.ts`): current validation correctly enforces today, open queue, break, capacity and mode, but all sources finish at booked. Attachment §§12,14,16,35 require immediate queue entry for walk-ins through the same lifecycle. Correction: invoke existing checkIn and enqueue inside the same booking transaction.
2. **Staff duplicate patient creation** (`routes/resources.ts`): patient creation has no mobile matching guard. §11 requires existing-patient reuse. Existing manual explicitly permits non-unique mobile (households), so no global uniqueness or merge is appropriate. Correction authorized by owning agent: reject staff patient creation when mobile already exists in the same authorized clinic; return a useful search/select message, without disclosing inaccessible records.
3. **Availability advertises closed bookings** (`lib/availability.ts`): booking rejects queue-close but public availability still says available. §§7–8 require consistent availability and reasons. Correction: expose existing queue-close rule in availability, without applying walk-in-only queue-open/break rules to advance booking.
4. **QR assignment consistency** (`routes/resources.ts`, `routes/public.ts`): a doctor-only QR without branch does not validate doctor clinic assignment; a doctor may create a QR without their doctor ID which they then cannot read; resolution does not recheck assignment after reassignment. §§4,9 require valid context and own doctor scope. Correction: validate clinic/branch relationships on save and resolution, requiring a doctor's own context on doctor QR writes.
5. **Idempotency source mismatch** (`routes/appointments.ts`): replay compares patient/doctor/branch/date but not clinic/source; a retry changing advance booking to walk-in can return booked. §§7,12,37 require consistent booking semantics. Correction: include clinic and source in the existing replay identity check.
6. **Availability response contract omission** (confirmed by frontend after initial audit): existing backend returns `queueMode`, `queueOpenTime`, and `queueCloseTime` but OpenAPI Availability omitted them, requiring a local frontend type extension. Attachment §§7–8,26 require consistent UI/backend availability. Owning agent authorized contract reconciliation: add these existing response fields as optional metadata (times may be absent), then regenerate clients/validators. No runtime behavior changes.

## Preservation / scope

No database schema, migrations, Clerk, OTP provider, token policy, status vocabulary or booking engine replacement. Generated API changes are restricted to the authorized existing availability response metadata reconciliation. Token allocation remains booking-time, monotonic across terminal rows, serialized with existing doctor/queue advisory locks. Household mobile sharing remains possible in other registration contexts; no existing patient is merged or modified by the duplicate guard.

## Fixes completed

All six pre-change findings above received the described minimal correction. Walk-in creation writes booked/check-in/waiting history and audit events using the existing transition service inside the existing transaction; a failed transition rolls back the booking on PostgreSQL. No additional appointment or queue store was introduced.

## Verification actually performed

Command: `node --test artifacts/api-server/src/backend-flow.test.mjs` — **7 tests passed**. The harness bundles the real route handlers, generated validators, authorization helpers, availability logic, QR resolution and transition service. Persistence and Clerk identity lookup are isolated in-memory substitutes; time is fixed to avoid time-of-day flakiness. These are service/handler regression checks, **not live HTTP, Clerk, PostgreSQL or browser end-to-end verification**. No fixture is installed in a production path or existing database.

Covered:

- Advance booking remains booked; walk-in gets the next shared token and checked-in/waiting timestamps/history; retry returns the same appointment; source-changing idempotency replay rejects.
- Booking rejects wrong clinic scope, unassigned doctor, inactive doctor/account/clinic/branch/patient, duplicate active booking, full capacity, past date, horizon violation, closed-date exception, required mobile verification, closed queue, unopened queue, break, incompatible queue mode and future walk-in.
- Call-next selects oldest waiting entry; another active called record blocks calling; start/complete and no-show/requeue use the same record; cancellation removes normal transitions.
- Patient aggregate queue response has no `entries`, counts the active patient ahead, and rejects another patient's selected appointment. Doctor cannot read/transition another doctor's appointment; receptionist branch scope excludes other branches.
- QR booking returns a normal booked appointment; old/regenerated and inactive references reject, including old reference at final booking; removed assignment invalidates context; doctor QR writes reject missing/other doctor and clinic-unassigned doctor.
- Same-clinic accessible duplicate mobile rejects without changing existing patient; a new mobile creates normally; clinic admin cannot write masters.
- Unexpected and database conflict error responses do not include internal messages.

Command: `pnpm --filter @workspace/api-server typecheck` — **passed**.

Authorized contract follow-up: `pnpm --filter @workspace/api-spec codegen` — **passed**, including generated-library typecheck; API-server and ClinicFlow typechecks — **passed** after generation. Existing Availability `queueMode` is an optional enum (`mixed`, `appointmentsOnly`, `walkInsOnly`), and queue open/close times are optional strings, matching the existing response's metadata without requiring schedule-only fields when absent. Generated client and Zod output were regenerated rather than hand-edited.

## Reviewed and intentionally unchanged

- Authorization: Super Admin global scope; Clinic Admin assigned clinics, no administrator-role grants/master/settings writes; Receptionist assigned branch; Doctor own appointments/schedules/exceptions/QR/patient relationships; Patient own records. Public discovery exposes doctor display fields rather than private operational rows.
- Clinic admin scoped audit **read** remains existing behavior; no audit administration mutation endpoint exists. The manual explicitly documents this and the new requirement forbids platform audit administration, not explicitly scoped read.
- Availability: one active weekly session per doctor/branch/day; active assignment/account/location requirements; date exception timing/capacity overrides; booking horizon; active patient and international mobile; queue mode; duplicate active patient booking.
- One booking endpoint for all four sources; phone uses the same platform `requireMobileVerification` policy and remains booked. OTP still verifies the authenticated user's linked patient, not arbitrary staff-selected patients.
- QR random references, row lock at final booking, regeneration/deactivation, public identifiers/names-only response, and no invented expiry duration.
- Queue transition graph, booking-time monotonic token assignment, doctor plus queue advisory locks, unique token/reference/idempotency indexes and partial unique active-consultation/active-patient indexes. Call-next sorts by waiting timestamp then token; requeue gets a fresh waiting timestamp.
- Cancellation cutoff applies to staff and patients as before. No-show only from waiting/called; no-show/cancelled records do not count as waiting/completed. Estimate remains patients-ahead × (consultation + buffer), not a guarantee.
- Dashboard/report appointment metrics use scoped persisted appointments and exact statuses. Patient queue returns aggregates/own entry only. Existing dashboard entity counts and platform-local date default retained.
- Existing HTTP errors sanitize unknown/database failures; no database schema/auth changes. Availability response metadata is the only authorized contract correction.

## Remaining limitations / confirmation

- No live PostgreSQL concurrency, transaction rollback, index enforcement, browser role session, Clerk login or production SMS test was performed. Advisory lock/index behavior was source-reviewed only. Parent owns integration/browser verification.
- Household members sharing a mobile are not auto-merged. The narrow staff registration guard covers accessible same-clinic records only. Global household matching, cross-clinic sharing and onboarding matching **require business-rule confirmation**; no global mobile unique constraint was added.
- Staff cannot OTP-verify an arbitrary patient through the existing authenticated-self OTP service. If policy requires verification, that patient's existing verified record is required; no new OTP mechanism was invented.
- Patient queue lookup without appointmentId still uses the first own record for the queue (existing behavior). Clients should send appointmentId, especially when cancelled/no-show and later bookings coexist.
- Doctor/clinic assignment or active-status edits are not uniformly serialized with booking across every resource-write route. No new global locking policy was invented; live adversarial assignment-change/booking races remain unverified.
- Existing all-table reads/in-memory filtering and aggregate calculations remain a scaling limitation, not a correctness refactor target.