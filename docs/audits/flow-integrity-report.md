# ClinicFlow — Business Flow and Role Integration Audit

**Date:** 22 September 2026  
**Scope:** Existing ClinicFlow application; the supplied 40-section end-to-end business-logic audit request.  
**Method:** Inspect existing code and contracts first, record a concrete mismatch, apply a targeted correction, and verify at the appropriate layer. No rebuild or replacement architecture.

## A. Issues found

1. **Walk-ins stopped at Booked.** The backend checked today's session and queue rules but did not advance a walk-in into the existing waiting queue.
2. **Patient registration could create a same-clinic duplicate mobile record.** Staff had no existing-patient check or instruction to search/select the accessible record.
3. **Availability and booking disagreed after queue close.** Availability could advertise a session which booking would reject under the existing closing-time rule.
4. **QR context could outlive a valid doctor assignment.** Doctor-only QR context and subsequent reassignment were not consistently checked.
5. **Idempotent retries could change booking meaning.** The replay check did not compare clinic and booking source.
6. **Availability metadata was missing from the generated contract.** The server already returned queue mode and opening/closing times, but client types omitted them.
7. **Dependent form choices could retain invalid relationships.** Clinic, branch, doctor, and patient selections needed consistent filtering and reset behavior in booking and resource editors.
8. **Staff booking did not distinguish phone booking from walk-in.** The existing single form needed an explicit source choice, not a second booking engine.
9. **Partial QR contexts and optional context clearing were inconsistent.** A fixed doctor with an unfixed branch needed constrained continuation; clearing optional fields needed the correct nullable request values.
10. **Some operational views could retain stale state.** Dashboard freshness, patient queue selection, availability refresh, and confirmation state needed alignment with persisted server responses.
11. **Authorized existing workflows were not consistently reachable.** Administrative schedules/date exceptions and existing receptionist QR operations needed navigation aligned with backend permissions.
12. **Doctors were offered patient-registration controls they could not use.** The backend already prohibited this operation.
13. **Mobile dashboard metrics could overflow.** The browser check observed a raw fractional average-wait value widening the metric grid and clipping content.
14. **Stale server processes blocked managed startup.** Old API and frontend listeners held their configured ports even though their managed workflows showed failed.

## B. Issues fixed

| Issue | Targeted correction |
|---|---|
| Walk-in queue entry | Run the existing `checkIn` and `enqueue` transitions inside the appointment transaction. The same appointment, token, history, and queue rules are retained. |
| Same-clinic duplicate patient registration | Reject an accessible same-clinic mobile match with an instruction to search/select the existing patient. No automatic merge or global unique-mobile constraint. |
| Closed availability | Return the existing queue-closing restriction in availability feedback. |
| QR assignment validity | Validate doctor/clinic/branch relationships on save and public resolution; retain booking-time validation and revocation. |
| Replay mismatch | Compare clinic and source as part of the existing idempotency identity. |
| Contract mismatch | Add existing optional availability queue fields to OpenAPI and regenerate client/validation outputs. |
| Dependent selectors | Filter scoped directories and reset incompatible selections; constrain branch options to clinic and doctor options to assignments. |
| Phone versus walk-in | Add a minimal source choice to the shared staff booking form; phone stays Booked, eligible walk-in returns Waiting. |
| QR continuation | Preserve fixed context through authentication and allow only unconstrained choices; send explicit nulls when optional context is cleared. |
| Freshness and displayed state | Use server status/action eligibility and consistent polling/invalidation; reset stale patient queue selections. |
| Navigation | Expose already-authorized existing operations without adding new permission grants. |
| Doctor registration mismatch | Hide prohibited patient-creation controls and direct the doctor to reception/admin. |
| Mobile metric containment | Format displayed waiting-time precision and constrain responsive grid content; leave server calculations unchanged. |
| Startup | Stop only the identified stale API/frontend listeners and restart their existing managed workflows. No duplicate workflow or port redesign. |

Detailed before/after evidence is in `backend-flow-audit.md` and `frontend-flow-audit.md`.

## C. Existing logic preserved

- Clerk identity and account-bound roles; no role switcher or authentication bypass.
- PostgreSQL, Drizzle, the existing schema, and the current API architecture.
- One appointment record as the source of queue state; no new queue or QR appointment table.
- One booking engine for online, QR, phone, and walk-in entry points.
- Existing booking-time token allocation, doctor/branch/date token scope, unique references, and idempotency.
- Existing lifecycle: Booked → Checked In → Waiting → Called → In Consultation → Completed.
- Existing cancellation, no-show, requeue, and one-active-consultation rules.
- Check-in remains required for advance online/phone/QR bookings; only the explicitly requested walk-in behavior changes.
- Public QR links, regeneration, deactivation, image generation, and download.
- Existing mobile OTP service and explicit development-provider distinction.
- Scope enforcement on the server; frontend filtering is not treated as authorization.
- Existing responsive layout and visual design, apart from correcting observed overflow.
- No EMR, billing, prescriptions, telemedicine, AI, extra notification system, or new workflow statuses.

## D. Verification performed

### Static and isolated regression checks

- API-server, frontend, generated/shared libraries, and script TypeScript checks passed for the relevant implementation batches.
- Code generation succeeded after the availability-contract correction.
- Seven isolated backend service/route regression tests passed.
- Those seven tests substitute persistence and authenticated identity dependencies; they are **not** the live database or browser evidence.
- Existing API and frontend workflows were restarted and came up successfully.

### Authenticated live API checks

**92 passed; 0 failed; 0 skipped.**

The runner used real Clerk development identities, real Bearer-authenticated HTTP requests, and the development PostgreSQL database. Business fixtures were isolated from existing records. Identity/profile linkage was provisioned for the test; clinics, branches, assignments, schedules, bookings, and transitions were exercised through actual APIs.

Verified checks included:

- Clinic/branch creation and doctor/staff assignments.
- Development mobile OTP request and verification for both test patients.
- Online booking remaining Booked before check-in.
- The same appointment being readable by its patient, assigned receptionist, doctor, Clinic Admin, and Super Admin.
- Booked → Checked In → Waiting → Called → In Consultation → Completed, with retained history.
- Persisted completion reflected in all five role dashboards.
- Walk-in immediately reaching Waiting through the same state machine.
- Future phone booking remaining Booked; permitted cancellation and rejection of consultation after cancellation.
- QR generation/resolution, regeneration, old-reference rejection, booking, and the same completion lifecycle.
- No-show, requeue, and subsequent consultation.
- Patient queue responses containing own/aggregate data and omitting staff entries.
- Doctor-to-doctor, clinic-to-clinic, patient-to-patient, and Clinic Admin/platform access denials.
- Invalid past/closed/horizon/inactive cases, capacity limits, idempotent replay, and conflicting replay rejection.
- Concurrent Call Next serialization under the tested two-request scenario.

The exact request outcomes are retained in `api-verification.md` and `api-verification.json`. These are bounded regression checks, not a load test or security certification.

### Browser verification

Browser evidence is recorded separately in `browser-verification.md`. An API success is not counted as a browser success.

Actual browser observations:

- Public landing and public QR context rendered at 390 × 844.
- Patient, Super Admin, Doctor, and Receptionist identities were established and checked against the mapped API roles. An initially unauthenticated patient test context was resolved by using a fresh isolated context; no authentication code was changed.
- An authenticated patient saw the fixed QR clinic/branch/doctor context and valid availability. An existing active fixture booking correctly caused a 409 duplicate-booking response instead of creating another record.
- After the existing fixture was completed, one new QR booking succeeded through the UI with a confirmation token and **Booked** status. It persisted after navigating to My Appointments and reloading.
- Receptionist UI actions changed that exact new appointment from **Booked → Checked In → Waiting**, retaining its token.
- The doctor UI changed the earlier audit appointment from **Called → In Consultation → Completed**. Patient reload/history and Receptionist views showed that same completed record.
- The patient queue displayed the patient's own token and aggregate progress without other patients' names/mobile numbers.
- Receptionist booking exposed Phone/advance and Walk-in choices in the same form; Clinic A offered only Branch A1 and its assigned doctor.
- Mobile controls used in the booking, confirmation, appointment, and queue checks remained usable. Wide tables intentionally have internal horizontal scrolling.
- The previously unverified Clinic Admin browser check **passed on 2026-09-22** in a fresh isolated context. Browser Clerk identity matched the new fixture and authenticated `/api/me` returned the active `clinicAdmin` role before navigation. `/admin/settings`, `/admin/masters`, `/admin/users`, and `/admin/audit` each redirected to `/admin/dashboard`; the fixture clinic and branch records remained reachable. See `browser-verification.md` for identity, route, screenshot, and cleanup evidence. The earlier live API platform-settings mutation denial remains separate evidence; its suite was not rerun.

The newly created QR appointment was not also run through doctor completion in the browser: that portion had already been exercised on another isolated fixture, and the API run covered the complete lifecycle. Browser password-entry/email-delivery behavior was not tested; the browser helper established real test identities programmatically.

## E. Remaining limitations and rules requiring confirmation

- Production SMS is not connected or live-delivery tested. Development mobile OTP is not evidence of phone ownership.
- Shared household numbers and cross-clinic patient matching need business confirmation. No automatic merge or global mobile uniqueness has been introduced.
- The existing OTP endpoint verifies the signed-in account's mobile. It is not an arbitrary staff-operated OTP service for another patient's phone.
- Assignment edits concurrent with booking, sustained high-contention booking traffic, and broader database/operational race scenarios are not established by the bounded checks above.
- Thirty-second polling is retained; this is near-real-time refresh, not instantaneous push.
- Existing one-session/one-break scheduling and overnight/timezone restrictions remain.
- Existing in-memory list processing, notification limitations, and Clerk-governed session lifetime remain outside this correction scope.
- Browser-authentication tooling limitations, if unresolved, must be reported as blocked verification—not silently classified as an application defect or a passing user journey.
- This audit does not establish healthcare regulatory compliance, production readiness, backup restoration, or comprehensive penetration-test coverage.

## F. No-change items

The following were inspected and retained rather than replaced:

| Area | Evidence / reason for no replacement |
|---|---|
| Patient entity selection | Booking already references patient profiles, not generic users. Filtering was corrected without changing the entity model. |
| Appointment action validation | The existing backend transition engine controls allowed actions and rejects invalid transitions; isolated and live API checks exercise it. |
| Server authorization | Existing role/scope checks enforce access; negative live API checks confirm the tested boundaries. |
| Token/reference integrity | Existing schema constraints and allocation logic remain; no second token system. |
| Queue privacy | Existing patient projection omits staff entries; live API privacy assertion passed, with defensive UI rendering retained. |
| Persisted dashboard source | Cards already use backend aggregates; freshness and numeric presentation were corrected, not the source of truth. |
| QR storage/model | Existing random references and ordinary appointment creation are retained. |
| Authentication cache isolation | Existing identity-change/sign-out cache clearing remains. Browser role-switch verification is separately qualified. |
| Core responsive design | Public mobile landing/QR context rendered successfully. Only observed metric overflow was targeted. |

## Reproduction and evidence

- Isolated backend checks: `node --test artifacts/api-server/src/backend-flow.test.mjs`
- Live integration runner: `NODE_ENV=development pnpm --filter @workspace/scripts exec tsx ./src/audit-flow.ts`
- The live runner is development/test-instance guarded and creates new isolated test fixtures. It is not a read-only command.
- Cleanup is explicit, marker-scoped, and must target only fixtures created by this runner; do not repurpose it to delete application data.
- Temporary test credentials are deliberately excluded from this report and all repository documentation.

### Audit-fixture cleanup

After verification, the runner's two isolated clinic scopes and their descendants—including the browser-created appointment—were removed. All seven isolated Clerk identities were deleted and lookup-verified. The cleanup check found zero marker-owned database rows, confirmed that the original five preview accounts remain, and confirmed that the temporary credential file was removed. The 92-check evidence was retained. No pre-existing user records were deleted.