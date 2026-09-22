# ClinicFlow browser verification

## Earlier connected checks (same coordinated audit)

- Fresh browser contexts verified real patient, Super Admin, Doctor, and Receptionist identities against `/api/me` and their mapped roles. Initial patient-session uncertainty was resolved without changing authentication code.
- Public mobile landing and fixed public QR clinic/branch/doctor context rendered at 390 × 844.
- The patient's first attempted booking correctly returned a duplicate-active-booking conflict. No duplicate appointment was created.
- Patient queue UI showed its own token and aggregate counts without another patient's name or mobile number.
- Doctor UI started and completed the existing audit appointment; the patient dashboard retained Completed after reload, and Receptionist displayed the same completed record.
- The initial mobile dashboard revealed an overflowing raw fractional average-wait value. A display-only precision/containment correction was made separately. Internal table scrolling is retained.
- Screenshot evidence identifiers: `zjtfc1` (public QR), `c3nd97` (authenticated QR), `gwtp77` (duplicate conflict), `db96ai` (patient queue), `2r0jqf` (doctor completion), `gysgxn` (patient history), `zibpbj` (receptionist).

## Targeted final pass

- **UI (patientA):** Reused the authenticated patient fixture context and opened the current QR reference for Clinic A / Branch A1 / doctorA on 2026-09-22. The fixed context was displayed and the form reported 15 available places.
- **UI (patientA):** Submitted exactly one booking through the QR flow. Details and review steps rendered, consent was required and checked, and confirmation succeeded with token `A23-06`, reference `CF-EA4F579FEB684C0C`, and status `Booked`.
- **UI (patientA):** Opened My Appointments and reloaded once. The new A23-06 appointment persisted as `Booked` for Clinic A / Branch A1 / doctorA; the prior A23-04 remained `Completed`.
- **UI (receptionist):** Opened the staff appointments list, located the exact new reference/token, clicked only its `Check In`, verified `Checked In`, then clicked only its `Enqueue` and verified `Waiting` with token `A23-06`. Did not call-next or complete it.
- **UI (receptionist):** Opened the receptionist booking form without submitting. Verified source options `Phone / advance booking` and `Walk-in — today`. Selecting Clinic A exposed only Branch A1; selecting Branch A1 exposed only doctorA. The form remained on step 1 and no second booking was created.
- **Optional UI (clinicAdmin):** Attempted the settings redirect check with a fresh helper context. Navigation ended at `/sign-in` rather than `/admin/settings`; no settings were changed and no further auth attempt was made.

## API / non-UI

- No API suite was rerun.
- No authenticated API mutation or setup call was made in this targeted pass.
- Browser API responses were only observed indirectly through UI actions; the successful booking and lifecycle transitions were verified from rendered UI state.

## Deliberate omissions

- No repeat of prior login, patient queue, doctor start/complete, or broad role checks.
- No call-next or complete action for the new A23-06 appointment.
- No additional phone/walk-in booking was submitted.
- No existing user data was canceled or otherwise altered.

## Responsive note

At 390x844, the appointment table is intentionally internally scrollable but its columns wrap/clip until scrolled. The targeted booking, check-in, and enqueue controls remained accessible and rendered without modal or error overlap.