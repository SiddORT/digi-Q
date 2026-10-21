# Receptionist visibility investigation

## Incident status

The reported existing account was positively identified in the operator's
subsequent UAT query output. It is active, has the receptionist role, and its
physical managing-administrator ID exactly matches the assigned clinic's owner
ID. Both returned rows have the same user ID and clinic ID: one is a clinic-level
assignment and one is a branch assignment. These are not duplicate staff
accounts. Missing/wrong manager is ruled out for this supplied snapshot; no
ownership correction is warranted from this evidence.

Earlier environment checks:
Read-only inspection of the development database returned no receptionist name
matching the reported name and no assigned Clinic Admin matching the reported
clinic name. The exact account email and UAT site were subsequently supplied by
the user. A second development lookup by that exact email also returned no account.
The first production read-only attempt was blocked by unavailable authenticated
database access. On the user's subsequent request, production inspection
succeeded: exact-email lookup, trimmed-email/name cross-check and clinic-name
lookup all returned zero matching rows. This establishes absence from the
accessible Replit production database, not absence from UAT's database.

The subsequent two UAT screenshots both show the Super Admin role. Clinic →
Staff is displaying Clinic Admins (confirmed by its search placeholder and
Owned clinics column), whereas System Users lists both the clinic administrator
and the receptionist. This confirms a staff-type mismatch between the two shown
views, not an ownership exclusion. The original assertion about a signed-in
Clinic Admin session was not demonstrated by these screenshots.

The owner's actual Clinic Admin UAT session and its API list/detail responses
remain unverified. The operator's query output did not include clinic/branch
active status or session identity.
The deployment service reports no Replit deployment for this workspace. UAT is
not verified as a managed Replit database target. Read-only HTTP probes to the
user-specified UAT site returned 200 for authentication status, but 401 for
identity and the exact-email receptionist list. No authenticated UAT staff
session or explicitly identified external UAT database connection is available.
Workspace bootstrap credentials were not reused against another environment.

Historical missing/wrong manager is not supported by the UAT snapshot. The
screenshots establish different list categories for the shown comparison; any
additional owner-session failure or deployed-code divergence remains unverified.
No data correction, account duplication, ownership transfer,
password change, invitation resend, live notification, or deployment was performed.

## Confirmed independent UI defect

The selected Staff Type was hidden inside the Filter Staff drawer. It is now a
visible, labeled toolbar selector using the existing role-restricted options.
Clearing list filters keeps the current staff type instead of silently switching
Receptionists back to Clinic Admins/Doctors. URL search is also cleared so a
reload does not restore a supposedly removed search. The type is mandatory, so
the picker does not offer the shared component's nested Clear selection button.

Creating a receptionist from another Staff view could leave that view selected
when post-commit invitation failure kept the saved-record editor open. Previous
filters could also exclude a successfully created account.

On first committed save the parent now selects the saved staff role, resets that
role's list filters and page, and removes prior search/exact-record URL state.
The fixed clinic boundary remains unchanged. Invitation failure still leaves
the saved identity in the editor with an explicit warning; closing it never
creates another account or automatically resends an invitation.
Ordinary edits do not reset the listing.

No backend authorization change or shared-clinic visibility fallback was added.

## Verification

- Invitation integration suite: seven passing tests using real Express routes,
  migrated disposable PostgreSQL-compatible storage and intercepted mail.
  Covers creation with sent and failed invitation outcomes; repeated owner,
  Superadmin and unrelated-admin list/detail reads; search/status/clinic/location
  exclusions; duplicate rejection; mixed-owner creation rejection; and attempted
  implicit ownership transfer rejection with unchanged saved mappings.
- SQL list suite: sixteen passing tests. The added regression verifies that
  missing/wrong managers do not grant access to the clinic owner based on shared
  assignments or selected workspace, and reads do not repair/reassign ownership.
  Existing list/detail-policy parity also passes. Two stale fixture dependencies
  were aligned with the production contract (deleted-actor audit field and the
  scope fixture's SQL executor); no application schema changed.
- Staff control and listing UX checks: twenty passing tests, including first-save
  callback wiring, visible staff type, and role-preserving filter reset.
- Shared-library build and ClinicFlow typecheck pass. The first frontend check
  saw stale generated declarations; rebuilding shared libraries resolved it.
- Fixture-backed browser check passed the Clinic Admin journey: Doctors view →
  add Receptionist → one intercepted successful save with failed invitation →
  saved warning remains open → close without resend → saved row → open → reload.
  Status choices after reload were All (1), Active (1), Inactive (0).
  Separate fixture-role contexts displayed the Superadmin record and the
  unrelated-admin empty list/denied detail. These intercepted responses verify UI
  behavior, not real authentication or backend authorization.
- A targeted follow-up to the same browser tester verified the screenshot-driven
  fix: embedded Superadmin Clinic Admins → visible picker → Receptionists →
  edit/reload, with captured requests retaining the fixed clinic and receptionist
  role. Mismatching search plus Inactive status followed by Clear Filters kept
  Receptionists selected and restored the row. Separate Clinic Admin/Doctor
  fixtures retained their restricted role options. At 390px the picker/menu fit
  without horizontal overflow. A persistent intercepted browser regression was
  added and passed; it is not proof of authenticated UAT authorization.
- Follow-up source checks cover the final removal of the redundant clear button
  and URL-search reset; no additional browser pass was run for these small fixes.
- The normal preview workflow restarted cleanly; a screenshot confirmed the
  public landing page loads. That screenshot does not verify signed-in Staff.

## Optional UAT confirmation and diagnostic support

The exact account's UAT ownership is now confirmed by the supplied SQL output.
An authenticated owner-session check remains a live acceptance limitation, not
evidence that a data correction is needed. If further inspection is authorized,
the operator can
run `scripts/receptionist-visibility-readonly.sql` using their existing UAT
connection and the `account_email` psql variable. It is a read-only transaction
with a five-second statement timeout, returns only the exact account's ownership,
assignments, related administrators' scope/workspace and recent audit metadata,
and never returns credentials or message content. Compare:

1. Account role/status and physical managing administrator.
2. Each saved assignment's actual clinic owner and branch/clinic pairing.
3. Creation/assignment audit events, without trusting displayed clinic labels.
4. The actual signed-in `/me` identity, selected workspace, Receptionists query,
   status/search/clinic/location filters and list/detail responses.

If ownership is inconsistent, prepare a correction only for that existing
account, with before/after evidence and an audit entry. Stop for explicit
approval before any production write; ambiguous ownership is not repairable
by guessing or granting access based on assignment labels.
