# ClinicFlow assignment + appointment QR browser verification

**Date:** 2026-09-22 (UTC)  
**Fixture marker:** `CF-ASSIGN-20260922131518-807f59`  
**Scope:** one coordinated browser pass; API suite was not rerun. No API mutations or fixture deletions were performed. The only mutations were the requested UI-created clinic/branch and the retained audit appointment lifecycle.

## Auth identity proof

Each role used a fresh isolated browser context and the documented `signInClerkUser` helper; no Clerk UI was used. Before protected assertions, `window.Clerk.loaded/isSignedIn`, fixture Clerk ID, and `/api/me.user.role` were checked.

| Role | Clerk ID (safe non-secret proof) | `/api/me` role | Result |
|---|---|---|---|
| Patient | `user_3JgVv8mAIZrMvbiG4Bd1EpbYlYK` | `patient` (patient workspace; `/api/me` 200) | verified |
| ReceptionistB | `user_3JgVv11pTLY4tPmzVitYfLOfELl` | `receptionist`; branch/clinic scope present | verified |
| DoctorA | `user_3JgVukGgvWFnl2SbbadZB6FnmgT` | `doctor`; DoctorA scope present | verified |
| AdminA | `user_3JgVuQj8st9vSSurPXI8gYvf27V` | `clinicAdmin`; clinic scope included created clinic | verified |
| SuperAdmin | `user_3JgVuLp2aELD7jJoimHg02ib0dZ` | `superAdmin` | verified |

No passwords, cookies, JWTs, or sign-in URLs were recorded.

## Appointment QR and lifecycle

- Patient `/patient/appointments` showed the retained Booked Branch B1 appointment (`CF-98866068BFAC4182`, token `BF59-04`).
- **Show Appointment QR** opened a rendered QR image and `Download QR`; the downloaded file was saved as `/tmp/clinicflow-assignment-audit-qr.png`, 7,801 bytes, valid PNG signature.
- ReceptionistB `/check-in` had Camera/Image File modes. Camera fallback was inspected; this environment has no camera and produced `NotFoundError: Requested device not found`, so physical camera hardware was not tested.
- Uploading the downloaded PNG through the actual Image File input/jsQR path resolved the retained patient/DoctorA/Branch B1 appointment. Confirming produced `Checked In`; patient reload showed the existing appointment in `Waiting` with unchanged token `BF59-04` (no new booking/token).
- Uploading the same QR again produced the explicit duplicate response: `This appointment is already checked in.` No duplicate confirmation was allowed.
- DoctorA queue, scoped to Branch B1, showed the retained oldest eligible `Waiting` appointment. Call -> Start -> Complete transitioned only this audit appointment; token remained `BF59-04`.
- Patient reload/history then showed the retained appointment `Completed`.
- A tampered PNG copy (`/tmp/clinicflow-assignment-audit-qr-tampered.png`) was rejected with the exact alert `No QR code found in image`; no appointment mutation occurred. The message was an alert rather than inline page text and was auto-dismissed by Playwright.
- Patient navigation to `/check-in` showed `Staff Access Required` and `The check-in scanner is available for clinic staff only`; no scanner/upload controls were exposed.

## UI management cascade

Using DoctorA UI only:

1. Created exactly one clinic: `CF-ASSIGN-20260922131518-807f59 UI Clinic` (`d9e55bd3-b26d-4ed2-94e9-fdb3ac159dcf`, code `CLN-d9e55bd3`), Active.
2. Created exactly one branch: `CF-ASSIGN-20260922131518-807f59 UI Branch` (`f968dcaf-04e3-4eac-9b75-539a4baafbb1`), linked to the new clinic, Active, timezone `Asia/Kolkata`.
3. AdminA fresh scoped view listed the created clinic and branch. SuperAdmin fresh global views also listed both. The environment contains additional pre-existing API-test records (for example, Admin/SuperAdmin views showed 8 clinics and 10 branches); those were not changed.
4. DoctorA Add User/Add Receptionist form:
   - required fields visibly marked: Full Name, Email, Role;
   - role choices restricted to Receptionist, Clinic Admin, Patient (no Doctor/SuperAdmin);
   - clinic choices restricted to DoctorA scope (Clinic A, Clinic B, UI Clinic);
   - selecting only UI Clinic exposed only UI Branch as the dependent branch choice;
   - form was closed without creating a user.
5. AdminA DoctorA edit form preserved owner/clinic/branch selections, but an unchanged save was blocked by the existing blank required Mobile field with `Please complete this field.` No profile or ownership values were changed.
6. ReceptionistB Weekly schedule and Date exceptions routes were accessible. Weekly schedule showed 3 scoped records; Date exceptions showed one scoped closure (`2026-10-01`, marker reason, closed Yes).
7. Cleanup completed through DoctorA UI only: the created UI Branch was removed/deactivated first, then the created UI Clinic was removed/deactivated. Seeded Clinic A/B and Branch A1/B1 remained.

## Responsive checks

Date exceptions was inspected at desktop 1280, tablet 768, and mobile 390. At 768:
`innerWidth=768`, `scrollWidth=768`, `bodyScrollWidth=768`. At 390:
`innerWidth=390`, `scrollWidth=390`, `bodyScrollWidth=390`.
There was no full-page horizontal overflow; the wide tables used internal horizontal scrolling. Mobile navigation remained available via the nav toggle and the Add exception/Book appointment controls remained accessible.

## Evidence screenshots

### Post-pass corrections

The doctor-mobile validation blocker was corrected after this browser run: doctor mobile remains optional, while patient mobile requirements are preserved. Final role-specific creation options and mapping validation were also aligned with the API; doctors require a clinic, receptionists require clinic and branch, and admin ownership is not edited through generic mappings. The frontend typecheck and source review passed after these corrections. This browser run was not repeated, so it does not independently verify the corrected edit submission.

The browser's invalid-image check established rejection of an undecodable image, not cryptographic signature-tampering validation; signed-payload tampering was covered in the API suite. UI cleanup soft-deactivated the newly created clinic/branch. Subsequent marker-validated fixture cleanup removed those rows and all isolated test identities, preserving pre-existing records.

- `0yhnto` – authenticated Patient dashboard and retained appointment.
- `52t1ii`, `5dkswq` – patient QR modal and downloaded QR.
- `3w7lxe`, `gttlpr`, `ooyo4x`, `ql4tbp` – staff scanner, decoded QR, successful check-in, duplicate rejection.
- `9yo30j`, `xzjd8v`, `admrhi`, `2jra48`, `2a7i77`, `wyjgqb` – Waiting, DoctorA queue call/start/complete, and patient Completed history.
- `xdd91v`, `dcuk46` – tampered QR rejection state and patient staff-only denial.
- `2v1zeo`, `99ma8k`, `v8ey7z`, `7ghujw`, `fb22eo`, `wj1e3z` – clinic/branch creation and AdminA/SuperAdmin visibility.
- `ap061d` – restricted Add Receptionist clinic-dependent branch choices.
- `np6n1f` – safe DoctorA unchanged-save validation blocker.
- `phiwxa`, `6ojz6b`, `ft6hyg`, `1hpxbi` – Receptionist schedule/exceptions and tablet/mobile layouts.
- `norfn4`, `9bjbrw` – post-cleanup seeded branch/clinic lists.
