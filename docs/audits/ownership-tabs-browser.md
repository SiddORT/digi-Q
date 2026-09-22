# ClinicFlow ownership/tabs browser audit

## Scope

- Fixture: private mode-600 ownership audit fixture; no credentials, tokens, email
  addresses, or phone numbers recorded here.
- Browser authentication used the approved `signInClerkUser` helper in a fresh
  isolated context for `adminA`; no Clerk UI or auth bypass was used.
- Exactly two app profiles were created through the UI (reserved Browser
  Doctor and Browser Receptionist). No other API mutations, deletions, or
  deactivations were performed.

## Checked

- ClinicFlow root and API workflows were reachable.
- Admin fixture loaded in a fresh context. Clerk was loaded and signed in,
  the Clerk user ID matched the fixture, and `/api/me.user.role` was
  `clinicAdmin`.
- `/admin/users` opened with Doctors selected by default.
- Clinic Admin context showed Receptionists as the other tab, with no Admins
  tab and no separate Doctors sidebar item.
- Existing doctor list loaded; the reserved Browser Doctor profile was created
  with blank optional Experience Years, mobile, Clinic A/B, and Branch A1/B1.
- The reserved Browser Receptionist profile was created with Owner Managed
  Unassigned + Branch U1.

## Historical blockers resolved during this pass

The initial Add Doctor attempt was blocked because both Clinics and Branches
assignment catalogs displayed `No matches`. After the parent runtime-enum fix,
the catalog populated and Clinic A/B plus Branch A1/B1 were selected.

The first resumed create attempt failed validation because the optional
`Experience Years` field was serialized as null:

`HTTP 400 : Invalid input: experienceYears Expected number, received null`

The parent serialization fix then allowed creation with Experience Years blank;
no workaround value was entered.

The original catalog request was:

`GET /api/staff-assignment-options?targetRole=doctors`

The API workflow log recorded HTTP 400 for that request (twice), which was
resolved by the parent runtime-enum fix.

Observed evidence screenshots: `go2cpd` (empty assignment catalogs in the
original attempt) and `qc3ft8` (selected clinics/branches with the exact
validation error).

## Resolved branch-restoration finding

After the optional-number fix, the reserved Browser Doctor was created
successfully with blank Experience Years. The unchanged edit save succeeded,
and deselecting Clinic B correctly pruned Branch B1 in the live form. A later
instrumented reproduction clicked B1 exactly once with A1 already selected:
the PATCH targeted the marker doctor ID, submitted two branch IDs, returned
HTTP 200 with two branches including B1, and the persisted detail/API/DB/UI
state showed Branch A1 and Branch B1. The earlier table-only discrepancy was
resolved by this final verified save.

## Findings and final status

The intentional missing-receptionist-branch submission initially produced no
visible validation message; selecting valid Branch U1 then succeeded. This was
observed as a UX-copy gap before the parent inline-error fix and is retained as
a minor finding.

After the parent Doctor Clinics contract fix, Doctor `/doctor/clinics`
correctly showed Clinic A/B under Assigned Clinics and Owner Managed
Unassigned, Clinic C, and Ownership Race under Available in Network. Doctor
Book appointment offered only assigned Clinic A/B; selecting Clinic A exposed
only Branch A1. Doctor Live queue exposed only Branch A1/B1. No clinical
records were submitted or changed.

Fresh Browser Doctor and Browser Receptionist contexts passed isolated Clerk
identity/role checks. Receptionist booking persisted the scoped catalog after
refresh: only Owner Managed Unassigned and Branch U1 were available, with no
Users/admin navigation. AdminB could not see either marker-created staff;
AdminA and SuperAdmin could see the expected ownership-scoped rows. SuperAdmin
Users exposed all three tabs, and `/admin/doctors` redirected to
`/admin/users?tab=doctors`. The SA Add Clinic Admin staging notice stated:
`Admin accounts have no clinic access until clinic ownership is assigned.`

At 390px and 768px, Users/tabs/forms remained accessible with no document-level
horizontal overflow; at 768px, wide table overflow was confined to the table
container. AdminA recovery guidance for the new Browser Doctor stated:
`Open /sign-in and select Forgot password to start secure Clerk recovery. No
recovery email has been sent by this action.`

Final status: the requested scoped journey completed after the parent fixes,
with the missing-branch validation copy recorded as the only minor UX finding.

### Implementation resolution of the validation-copy finding

The parent added visible `role="alert"` form errors and explicit per-clinic
receptionist branch validation. Frontend typecheck passed after that correction.
The observation above records the earlier missing-message state; the browser
did not repeat that negative submission after the correction. No additional
browser verification is claimed for the updated error copy.

## Fixture cleanup

After browser verification completed, the guarded marker-validated cleanup
removed both UI-created profiles (one Doctor and one Receptionist), all other
marker-owned application records, and all marker Clerk identities. Remaining
marker counts are zero, the private credential manifest was removed, and the
pre-existing data and approved ownership snapshots matched their baselines.
Cleanup completed with no exceptions.