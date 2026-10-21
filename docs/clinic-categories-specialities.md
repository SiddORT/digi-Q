# Clinic categories and specialities

Clinic metadata describes a clinic. It is not a doctor's specialization,
qualification, accreditation, or a booking eligibility rule.

## Saved contract

- One category: either `categoryId` (a real `clinicCategory` master ID) or
  `customCategory` (clinic-owned text), never both nonempty.
- Selecting a category ID clears the custom category. Nonempty custom category
  text clears the category ID. Explicit `null` clears the supplied category
  representation; omitted fields leave that representation unchanged.
- Multiple specialities: `specialityIds` contains real `specialization` master
  IDs; `customSpecialities` contains clinic-owned strings.
- Text is trimmed, limited to 100 characters and excludes control characters.
  Specialities are limited to 30 combined standard/custom values. Repeated IDs
  and case-insensitive custom duplicates are normalized; a custom value
  duplicating a selected standard name is rejected.
- Empty custom speciality strings are rejected. `customSpecialities: []` clears
  custom specialities; `specialityIds: []` clears standard specialities.
- Retaining a saved inactive master ID is allowed. Newly assigning an inactive,
  missing or wrong-category master ID is rejected.
- Clinic-owned JSON metadata is additive; no column migration, reclassification,
  or updates to doctor specializations are required.

Both registration transactions and the generic clinic and Clinic Settings save
paths validate this contract. Completion fingerprints use the original submitted
payload; normalizing saved text must not mutate that payload or break a lost-
response retry. Clinic edits preserve the completion receipt.

Only the owning Clinic Admin or a Super Admin may edit existing clinic metadata.
Custom entry never writes master records. Ordinary clinic accounts cannot create
global vocabulary.

## Suggestions and upgrades

`pnpm --filter @workspace/scripts run seed-system` provisions the system
vocabulary. API startup also runs the same additive healthcare provisioner inside
a transaction so existing installations receive suggestions on upgrade.

Provisioning:

- Contains the healthcare categories and specialities specified for clinic setup.
- Matches equivalent existing codes/names, including the original `general`,
  `specialist` and `generalMedicine` vocabulary.
- Preserves existing IDs, operator-managed names, and inactive decisions.
- Inserts only missing suggestions, with a transaction lock and conflict-safe
  insert; never creates people, clinics, bookings or notifications.

Registration options return active saved masters without the previous silent
200-record truncation. Empty and failed lookup states remain distinct, include
retry actions, and never block clinic-owned custom entry. Historical saved
selections retain readable labels even when not in the active options.

## Read consistency

Clinic detail reads and scoped clinic lists resolve `categoryName` and
`specialityNames` from the saved metadata and masters, including inactive names.
Clinic Details, the owner's own profile, and the Super Admin's corresponding
Clinic Admin editor/detail views use those clinic reads. Each owned clinic
keeps its own values. Successful saves invalidate affected views; failed saves
leave the editor draft open.

## Verification

Run:

```sh
pnpm run typecheck
pnpm run test:clinic-metadata
```

These tests use disposable databases and fictional identities with intercepted
mail. They cover additive provisioning, empty/complete lookups, custom and mixed
metadata, explicit replacement/clearing, inactive selections, name consistency,
validation rejection, foreign-clinic and role rejection, and atomic/retry-safe
onboarding. Render checks cover lookup states, labels, historical selections,
custom controls, safe text rendering, and the shared clinic/profile facts.

For isolated browser verification, the existing development-only
`staff-removal-browser.mjs` fixture supports both `.local/clinic-workspace-browser-fixture`
and `.local/clinic-metadata-browser-fixture`. The latter adds a fictional new
owner and distinct metadata for a second owned clinic. No normal database,
live delivery provider, or App Storage is opened by this fixture.

The isolated browser pass verified native identities for the owner, Super Admin
and a verified new owner; both completed onboarding journeys; category and mixed
speciality persistence; edit/reopen, replacement and clearing; independent
metadata for two owned clinics on owner and Super Admin profile views; keyboard
search/selection; empty/failed lookup recovery; and no document overflow at
390px. Dirty values survived an observed save error and a retry succeeded, though
the forced-error interception counter was inconclusive.

No metadata failure was observed in that pass. Foreign-clinic and duplicate
rejection were verified by API tests rather than repeated in the browser.
Actual touch gestures were not separately emulated. The disposable fixture's
geography suggestions returned 404, so manual State/City/PIN entry was used.
Doctor sessions and booking readiness were not configured or claimed. No
production/UAT writes, live delivery or deployments were performed.
