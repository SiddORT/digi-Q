# ClinicFlow — Role, Ownership and Assignment Integrity

Date: 22 September 2026

This report covers the role/clinic/branch assignment request and the user's subsequent clarification: **each clinic has exactly one Clinic Admin; each doctor has one explicitly recorded owning Clinic Admin; a doctor-created clinic inherits that admin.** This clarification supersedes the attachment's possible multiple-admin model.

## A. What changed

- Implemented explicit clinic and doctor ownership and automatic assignment cascades.
- Enabled scoped Clinic Admin clinic creation and Doctor clinic/branch/receptionist management.
- Required clinic assignment for newly created doctors and receptionists, and branch assignment for receptionists.
- Preserved existing assignments outside an editor's authorized scope rather than replacing them accidentally.
- Added database safeguards against duplicate mappings and invalid branch/clinic combinations.
- Enabled authorized peer-doctor schedule/exception management without granting access to another doctor's clinical appointments or queue.
- Added signed appointment QR display, resolution, and check-in using the existing appointment lifecycle.
- Fixed integration defects found during testing: ordinary edits carrying unchanged owner values; incomplete doctor creation through the generic Users endpoint; nested database conflicts returning 500; revoked-scope dashboard queries; and doctor/creator read shortcuts that bypassed current assignments.

## B. Database changes

Applied development migrations `0002` through `0004`, preserving existing tables and historical records:

- Required clinic `adminId` and doctor `ownerAdminId` foreign keys.
- Assignment uniqueness and composite branch/clinic referential integrity.
- Clinic and per-clinic branch name uniqueness.
- Ownership/role guards that prevent conflicting Clinic Admin mappings and unsafe owner deactivation or role changes.
- A unique active weekly schedule per doctor, branch and weekday.
- Branch context on audit events.

With explicit user approval, **four existing clinics and two existing doctors** were assigned to the existing Preview Clinic Admin as their admin/owner. Four corresponding Clinic Admin clinic scopes were created. No clinic or branch assignment was guessed for a doctor.

Post-migration checks found zero duplicate assignments and zero invalid branch/clinic links. The migration did not reset the database or delete appointment history.

## C. API and authorization changes

- Clinic creation derives the admin from the signed-in Clinic Admin or the doctor's recorded owner. Super Admin supplies an active Clinic Admin explicitly.
- Doctor creation derives its owner from the creating Clinic Admin; Super Admin selects the owner explicitly.
- Ownership transfers are explicit and restricted to Super Admin. Normal edits can retain existing ownership.
- The Doctors endpoint is the canonical doctor-creation path. Generic Users creation rejects `role: doctor` with guidance instead of inserting an ownerless profile.
- Assignment changes validate active clinics/branches, enforce branch membership, preserve inaccessible mappings, and reject unauthorized choices.
- Shared staff responses expose only assignment details within the viewer's scope; own-profile and Super Admin views remain complete.
- Doctor clinical reads require both their provider identity and current location authorization. Removing a location no longer leaves access through old appointment or creator relationships.
- Dashboard, reports and audit queries validate requested location/doctor context before returning records or aggregates.
- Availability writes serialize per doctor and check cross-location overlap using timezone-aware comparisons, including dated exceptions.
- Known database constraint conflicts return sanitized 409 responses, including wrapped database errors.

New appointment-QR endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /appointments/{id}/qr` | Authorized patient/staff obtain a signed QR payload and check-in URL. |
| `POST /appointment-qr/resolve` | Authorized staff validate the payload, scope, date and appointment state. |
| `POST /appointment-qr/check-in` | Check in and enqueue through existing transactional transitions; repeated eligible scans return an explicit already-checked-in result. |

The payload contains no patient contact details. Staff authorization is required before appointment details are returned. Public clinic/booking QR behavior remains separate and preserved.

## D. Frontend changes

- Scoped clinic/branch selection with searchable multi-select assignment controls.
- Mandatory mapping inputs and removal of incompatible selections.
- Existing selected inactive mappings remain visible for deliberate removal.
- Single-admin ownership selectors for Super Admin; server-derived ownership is not editable by other roles.
- Clinic/branch mapping labels in staff lists.
- Doctor receptionist-management navigation and Receptionist availability/exception navigation.
- Identity refresh and mutation invalidation for assignment changes.
- Appointment QR display/download from confirmation and appointment views.
- Staff check-in screen with camera scanning, image decoding and pasted payload fallback.
- Safe sign-in continuation for check-in URLs and base-path-aware QR URLs.
- Existing responsive layout preserved.

## E. Existing functionality verified

The live API audit exercised the connected creation/assignment cascade through availability, patient booking, appointment QR, check-in, queue consultation and retained patient history. It also exercised online, booking-QR, phone and walk-in entry paths.

Preserved:

- Clerk authentication and stored account roles.
- PostgreSQL/Drizzle and the existing assignment source of truth.
- Session/capacity scheduling rather than fixed appointment slots.
- The existing appointment/queue engine, lifecycle states and booking-time token allocation.
- Cancellation, no-show/requeue and queue concurrency protections.
- Patient privacy and server-side access enforcement.
- Existing public booking QR generation and resolution.

## F. Tests performed

- Relevant generated/shared-library, API, frontend and scripts typechecks passed.
- **14 isolated backend regression tests passed.** These include substituted persistence/authentication dependencies and are not presented as live database evidence.
- **141 authenticated live API/database assertions passed**, with zero remaining failures or skipped assertions in that defined suite.
- Live checks used real Clerk development sessions and isolated test records. They covered owner propagation, mandatory mappings, cross-scope denials, overlapping availability, concurrent duplicate branches/mappings, signed QR tampering/repeated scans, appointment lifecycle, revocation, CRUD/deactivation, persisted history and database constraints.
- Two live failures were fixed and rechecked: the duplicate-branch conflict response and revoked dashboard scope. The runner resumed from checkpoints rather than recreating the entire successful suite.
- Exact request-level evidence and initial-failure provenance are retained in `assignment-api-verification.md` and `.json`.
- Browser outcomes are documented separately in `assignment-browser-verification.md`; API outcomes are not counted as browser observations.
- Browser verification confirmed QR PNG download and image decoding, unchanged-token check-in, repeated-scan handling, doctor call/start/complete, patient completed history, cross-role visibility of a doctor-created clinic/branch, scoped receptionist choices, and tablet/mobile layouts.
- The browser found an optional-doctor-mobile field incorrectly required on edit. That validation was corrected afterward, along with role-specific form choices and required mappings. These final frontend corrections passed typechecking and source review; the browser pass was not repeated.
- Isolated fixture cleanup removed all test records and eight Clerk test identities. Snapshot checks verified that pre-existing database rows and the original Clerk account set were preserved. Approved ownership remained four clinics and two doctors.

## G. Remaining limitations and operational notes

- One pre-existing Preview Doctor had no clinic assignment. Its approved owning admin is now recorded, but a real location must be selected before it can operate there. Existing ownership approval did not authorize guessing its clinic/branch.
- The staged Clinic Admin onboarding exception is closed by Super Admin's **Set up Clinic Admin** flow on Users. It creates an active admin and a new first clinic together, with persisted scope immediately. Generic user creation no longer creates unassigned Clinic Admins. This flow never replaces an existing clinic's owner or changes doctor ownership; existing admins and explicit ownership transfers remain supported.
  - Focused verification: backend tests and workspace typechecks passed. An authenticated Super Admin browser pass confirmed required-field validation, duplicate-email rejection without partial records, successful setup, refreshed user listing, and persistence after reload.
  - Direct development database checks confirmed the new active admin, the new clinic's sole `adminId`, and exactly one matching clinic assignment immediately after creation. Existing doctor ownership was unchanged. New-admin sign-in was not separately tested.
  - Isolated test records and their audit event were removed afterward; the external Clerk invitation was separately found and revoked. No production changes were made.
- Production SMS delivery is not configured or verified; development OTP is not proof of phone ownership.
- Physical camera/device compatibility and production browser permissions require device-specific checks. Image decoding and pasted payload are supported alternatives.
- These are bounded functional/regression checks, not a production load test, penetration test, healthcare-compliance certification, or exhaustive timezone/DST proof.
- Database migration and legacy ownership updates described here were applied to development. No production data changes or publication were performed.

## Evidence files

- `assignment-backend.md`
- `assignment-contract.md`
- `assignment-frontend.md`
- `assignment-qr.md`
- `assignment-api-verification.md` / `.json`
- `assignment-browser-verification.md`