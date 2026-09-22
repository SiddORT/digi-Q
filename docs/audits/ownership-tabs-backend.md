# Ownership tabs backend audit

## Established contract

`GET /api/staff-assignment-options`

- Query: `targetRole` (required, `doctor | receptionist`), `doctorId` (optional edit target), `userId` (optional edit target).
- Response: `{ clinics: Clinic[], branches: Branch[], managingAdmins: { id: string, fullName: string }[] }`.
- `doctorId` is valid only for `targetRole=doctor`; `userId` is valid only for `targetRole=receptionist`; they are mutually exclusive.
- Super Admin receives active clinics grouped by their explicit active owners for a new target. Editing is fixed to the target's existing managing admin.
- Clinic Admin receives their owned active clinics. Doctor receives their managing admin's active clinics and may request receptionist options only.
- This is a management catalog. Reading it does not add an assignment or broaden appointment, queue, schedule, patient, QR, or other clinical access.

Common staff response fields are `managingAdminId`, `managingAdminName`, `invitationStatus`, and `createdAt`. `invitationStatus` is exactly `sent | failed | notRequired`. Clinic responses include `adminName`. Branch and doctor responses include nullable `createdAt` for legacy compatibility. `ownerAdminId` remains the canonical persisted Doctor owner and remains in the Doctor contract; `managingAdminId` is its common DTO alias.

Create/update inputs do not require manual owner selection. Doctor `ownerAdminId` and receptionist `managingAdminId` remain backward-compatible optional inputs only; when supplied, each must equal the owner derived from all selected clinics. Every selected clinic must have the same explicit active owner. Receptionists require at least one valid selected branch in every selected clinic.

`POST /api/users/{id}/resend-invitation` retries the existing Clerk invitation for an authorized, scoped, unlinked staff profile. It returns the updated `User`; it does not alter role, owner, clinic, or branch mappings. Already linked accounts return a conflict.

## Development data inventory and migration decision

The pre-migration aggregate inventory contained 7 users, 1 Clinic Admin, 2 Doctor users, 1 Receptionist, 4 clinics, 2 Doctor profiles, and 11 assignments. It found zero ownerless clinics, invalid/inactive clinic owners, invalid Doctor owners, cross-owner Doctor mappings, orphan Receptionist mappings, invalid branch mappings, or unassigned Receptionists.

The Receptionist backfill audit found one safe candidate and zero ambiguous Receptionists. Its mapped clinics all had one identical explicit active Clinic Admin owner. The safe row was backfilled; no ownership was inferred from a Doctor or a shared relationship. No ambiguous rows were changed. The post-migration aggregate audit found zero missing/invalid Receptionist managers, cross-owner staff mappings, invalid branch mappings, or invalid invitation states.

Migration `0005_ancient_ultron.sql` was applied to the development database only. Production was not modified.

## Integrity and authorization decisions

- `doctors.owner_admin_id` remains canonical. Only Receptionists store nullable `users.managing_admin_id`.
- Deferred constraint triggers validate assignment targets, Receptionist manager changes, Doctor owner changes, and clinic owner changes at transaction commit.
- New Doctor/Receptionist API writes cannot be orphaned. Existing unassigned legacy Doctors remain representable.
- Self-onboarding now creates patient profiles only; a Doctor must use the authorized invitation flow with complete owner and clinic mappings.
- Super Admin is not exempt from the same-owner assignment invariant.
- Edits preserve the current manager unless Super Admin explicitly transfers an existing Doctor; selected mappings must already fit the requested owner.
- Existing clinic ownership changes remain Super Admin-only and are rejected when dependent staff would conflict. No location is silently removed.
- A Doctor can manage a Receptionist with the same managing admin even when they share no operational branch. This management authorization does not change operational authorization.
- Doctor branch creation uses the management catalog but does not implicitly assign the Doctor to that branch. Doctor-created clinic behavior remains the explicit exception: the clinic is owned by the Doctor's canonical owner and mapped to that Doctor.

## Invitation transaction behavior

Identity lookup/invitation occurs only after the database role, owner, and assignments commit. The stored outcome is updated truthfully:

- `notRequired`: a linked or verified existing Clerk identity is used.
- `sent`: Clerk accepted the existing invitation flow.
- `failed`: delivery/identity integration failed; the committed scoped profile remains retryable.

No verifier email or test invitation was sent during this work.

## Remaining ownership ambiguities

None were found in the development aggregate inventory. If future legacy data has zero owners, multiple owners, inactive/invalid owners, or partial Receptionist branch coverage, it must remain unchanged until explicitly resolved; the migration intentionally has no guessing fallback.