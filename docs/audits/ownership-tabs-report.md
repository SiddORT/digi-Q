# ClinicFlow — Users tabs and managing-admin ownership

This report covers `Pasted-Yes-Based-on-everything-we-have-discussed-I-would-take-_1790086357750.txt`. Its ownership boundary supersedes the earlier assignment audit wherever the requirements differ.

## Implemented

- One Users navigation item with role-specific Admins, Doctors and Receptionists tabs. Super Admin sees all three, Clinic Admin sees Doctors/Receptionists, and Doctor sees Receptionists. Patients remain separate.
- Role-specific creation, editing, status actions, search, filters, newest-first pagination, mapping labels and permitted account recovery. The old admin Doctors route redirects to the Doctors tab.
- Staff managing admins are derived from selected clinics with one common owner. Mixed-owner selections are rejected, including requests from Super Admin. Existing staff cannot silently acquire a different manager through mapping edits.
- Doctors retain their existing canonical ownership relationship. Receptionists now have an explicit persisted managing admin. Staff responses include readable manager information.
- Receptionist branches are grouped by clinic, with branch coverage required for each selected clinic. Doctor clinic assignment is mandatory; doctor branch assignment remains optional.
- A doctor can manage receptionists within the managing admin's clinic catalog without receiving clinical access to unassigned clinics. Current location assignments and provider identity still govern appointments, patients, availability and queue operations.
- Clinic/doctor ownership changes that invalidate dependent staff are rejected. Concurrent overlapping ownership changes detect stale state rather than silently overwriting another change.
- Staff provisioning commits its role and mappings before external invitation delivery. Invitation outcomes are reported as sent, failed or not required. Scoped retry is serialized and idempotent; verified-identity conflicts remain conflicts rather than being disguised as delivery failures.
- Provider self-signup no longer creates an unowned doctor. Unprovisioned providers receive invitation guidance; patient onboarding remains available, and provisioned staff continue to link through verified Clerk identities.

## Database and migration

The development inventory contained four explicitly owned clinics, two doctors with valid recorded owners, and one receptionist whose complete mapping set identified exactly one valid clinic owner. That receptionist's managing admin was backfilled deterministically; no conflicting owner was chosen.

Added a receptionist managing-admin foreign key and deferred ownership guards across staff, assignments and clinic ownership. A follow-on migration corrected a cross-table PostgreSQL trigger record-field error discovered by the live audit. The correction was checked with a real rollback-scoped database probe, not only schema inspection.

No production migration, publication, data reset or historical deletion was performed. The pre-existing doctor without operational clinic assignments was not assigned a guessed location.

## API contract

- `GET /staff-assignment-options?targetRole=doctor|receptionist&doctorId?&userId?`
  returns server-authorized clinics, branches and manager labels for staff management.
- `POST /users/{id}/resend-invitation`
  retries authorized invitation delivery and returns the actual outcome.
- Staff response fields include `managingAdminId`, `managingAdminName`, `invitationStatus` and creation time. Clinics include an admin label.
- Existing user/doctor listing APIs support the role-specific search and ownership/location/status filters before pagination.

The management catalog is not an alternative authorization source for clinical operations.

## Verification

- **21 backend regression tests passed**, including injected invitation failure/concurrency/identity-conflict checks.
- An additional focused regression passed for doctor self-profile updates preserving ownership and assignments while rejecting self-assignment changes.
- **4 frontend request-construction tests passed**, covering singular role values, blank optional numbers, read-only field exclusion and explicit empty branch selections.
- **93 authenticated live API/database assertions passed** across 14 checkpoints, with no remaining failures in the defined suite.
- The live ownership race returned **200/409**, leaving one clinic owner and one canonical owner assignment.
- Booking, signed appointment QR, check-in, queue and completion passed in the live regression.
- Related API, library, scripts and frontend typechecks passed.
- The browser journey passed staff creation, mapping edit/prune/restore, role isolation, management-catalog versus clinical access, filtering, recovery guidance, old-route redirection and 390px/768px layouts. Browser findings are recorded separately in `ownership-tabs-browser.md`; API checks are not counted as browser observations.

The live runner preserves the initial trigger failure and test-harness/checkpoint provenance separately from the final passing results. It resumed incomplete checkpoints instead of rerunning the full successful suite.

Guarded cleanup removed every temporary Clerk identity and application fixture,
including the two browser-created staff profiles. No marker users, role profiles,
clinics, branches or audit rows remain. The pre-existing database and approved
ownership snapshots match exactly, and the private credential manifest was removed.

## Limitations and separate work

- Atomic Clinic Admin-plus-first-clinic onboarding is being delivered by the separate in-progress/merging task. This change does not duplicate that implementation. Until it is merged, the staged-admin form explains that clinic ownership must be assigned before clinic access is granted.
- The existing unassigned doctor still needs an explicit clinic selection.
- Live tests use isolated verified Clerk development identities to avoid sending real invitations. Provider failure and concurrent delivery behavior are verified with injected tests, not production mailbox-delivery evidence.
- Production SMS delivery, physical camera compatibility, load testing and healthcare-compliance certification are not claimed.

## Evidence

- `ownership-tabs-backend.md`
- `ownership-tabs-api.md` and `ownership-tabs-api.json`
- `ownership-tabs-browser.md`