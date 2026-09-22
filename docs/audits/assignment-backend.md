# Assignment backend audit

## Pre-change findings

- `assignments` was the existing single source of clinic/branch scope, but had no uniqueness constraint and no database constraint proving that an assigned branch belonged to the assigned clinic.
- Clinics had a creator-style `owner_id`, not a required Clinic Admin relationship. Doctors had no persisted owning Clinic Admin.
- Clinic Admin clinic creation was prohibited. Doctor clinic creation mapped only the doctor and could not propagate access to the original Admin.
- Doctor-created receptionist accounts were prohibited. Receptionists could not manage availability.
- Scoped assignment edits deleted every assignment for the target user, including mappings outside the actor's scope.
- Doctor branch authorization treated every branch in an assigned clinic as accessible. Schedule overlap checks rejected different timezones imprecisely and did not apply other location exceptions.
- Development data contained four clinics, two doctors, and exactly one active Clinic Admin (`ce7bb2fa-a30b-4016-83f4-cbb0ed271a79`). The approved Admin had no assignments. One existing doctor had no clinic assignment; no clinic can be inferred for that doctor from approved data.

## Implemented model

- Every clinic has one required `admin_id`; every doctor has one required `owner_admin_id`.
- The approved Admin was backfilled as Admin for the exact four existing clinics and owner for the exact two existing doctors. Four clinic-level Admin assignments were inserted.
- Partial unique indexes prevent duplicate clinic-only and branch assignments. A composite foreign key enforces assignment branch/clinic consistency. Clinic and per-clinic branch names are case-insensitively unique.
- A partial unique index preserves one active weekly session per doctor/branch/day; doctor-level advisory locking plus timezone-aware checks protect cross-location overlap writes.
- Database triggers require active Clinic Admin owners, synchronize the sole Admin assignment on explicit clinic ownership transfer, reject extra Clinic Admin mappings, protect the required mapping, validate doctor owners, and prevent deactivation/role change while ownership remains.
- Audit records now persist branch context as well as actor, action, entity, clinic context, and timestamp; ownership transfers use an explicit audit action.
- Generic assignment edits cannot transfer ownership. Clinic and doctor ownership changes are explicit and SuperAdmin-only.
- Serialized unchanged `adminId`/`ownerAdminId` values are tolerated on ordinary edits; only a value change invokes the SuperAdmin-only transfer path.
- ClinicAdmin/Doctor clinic creation derives the Admin server-side. SuperAdmin must select an existing active Clinic Admin. Doctor-created clinics map the doctor and use the doctor's persisted owner.
- Doctor/receptionist assignments require clinics; receptionist assignments require branches. Doctor-created receptionist management is limited to exact active doctor scope. Scoped edits retain out-of-scope mappings.
- Revoked doctor scopes no longer retain creator/owner access to clinics, patients, appointments, or QR records. Shared user/doctor responses project assignment IDs and names to the requesting actor's current scope while preserving hidden mappings in storage.
- Dashboard, report, and audit queries validate every explicit clinic/branch/doctor context before aggregation. Dashboard entity counts and recent activity apply the selected context and projected current assignments.
- Clinic Admins can create clinics and receive the database-synchronized self mapping. Doctors can create branches only in assigned scope and receive the new exact branch mapping.
- Clinic Admin, doctor, and receptionist availability writes require a shared exact active location. Schedule writes are doctor-locked and compare real UTC instants across location timezones; dated exceptions are included in exception collision validation.

## Admin onboarding decision and remaining data gap

Because each clinic has exactly one Admin, assigning a newly created Clinic Admin through generic `clinicIds` would silently replace an owner. SuperAdmin may therefore pre-provision an unassigned Clinic Admin, then explicitly transfer a clinic by changing its `adminId`. Transfer atomically removes the old Admin mapping and creates the new one. The API refuses generic Clinic Admin assignment edits.

This pending identity is temporarily unassigned until transfer; it has no clinic access. This is the smallest non-destructive bootstrap path in the existing generic resource API. There is no separate activation/acceptance workflow.

One pre-existing doctor (`2405dea7-8726-4377-acaf-b13f8f4c3fc0`) remains without a clinic assignment. Its approved `owner_admin_id` was backfilled, but assigning a clinic would require inventing data that the user did not approve.

## Verification

- Development migration applied without resetting or deleting historical data: 4 clinics and 2 doctors backfilled; 4 Admin assignments inserted.
- Post-migration query: 4/4 clinics and 2/2 doctors use the approved Admin; duplicate assignments `0`; invalid branch/clinic assignments `0`; invalid owners `0`.
- Direct database guard probes confirmed duplicate assignment rejection, cross-clinic branch rejection, and owning Admin deactivation rejection.
- Library and API Server TypeScript checks pass.
- Existing backend flow regression suite passes all 14 tests, including appointment, QR, check-in, queue, revoked dashboard context, scoped aggregates and assignment projection, doctor-own-provider enforcement, wrapped database conflict handling, ownership serialization, cross-timezone overlap, privacy, capacity, and error-sanitization coverage.