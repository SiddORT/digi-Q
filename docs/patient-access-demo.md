# Patient access and Preview demo

Updated 2026-09-25.

## Entry points

- Home and `/patient-login` offer **Scan QR code** and **Guest booking**.
- `/scan-qr` scans via camera or uploaded QR image without login.
- `/guest-booking` selects a public clinic and location without login.
- Existing patient email-code login remains separate.
- Patient booking QRs are not appointment check-in QRs; check-in remains a staff operation.

Guest submissions are requests, not confirmed appointments. Reception/authorized
staff must approve them before a token and queue place are allocated.

## Retained fictional development fixture

- Clinic: DEMO Care Clinic 8c157094de.
- Location: DEMO Main Location.
- Doctor: Dr. Demo Doctor, on the same Clinic Admin account.
- Public clinic path: `/demo-care-8c157094de/main-location`.
- Booking path: `/demo-care-8c157094de/main-location?book=1`.
- Sessions: every day, 08:00–23:50 Asia/Kolkata, 31 tokens per session.
- QR image: `attached_assets/demo-patient-test/preview-clinic-booking-qr.png`.

The QR encodes a development Preview URL. Keep the Preview running. It is not a
production QR and the fixture does not exist in the published database.
No production records were written. Do not assume publishing code copies this
fixture or its authentication identity into production.

The fixture's synthetic provider identity is for automated development testing,
not a usable human email inbox. A controlled real email is needed to finish
staff-access handoff. No credentials belong in this document or downloadable QR.
Live provisioning must use authorized application onboarding, not direct
production SQL or weakened authentication.

## Acceptance evidence

One browser pass verified:

- Guest clinic/location selection and doctor/session details.
- One fictional request without email or mobile.
- Pending receipt survives reload.
- Actual QR image decoding opens the correct booking page.
- Camera-denied and non-QR-image errors provide recovery instructions.
- Exact real development provider identity and real password proof established
  the expected Clinic Admin and linked doctor.
- That account approved the request in Live queue, producing token D-01 and one
  waiting appointment for Fictional QR Flow Test Patient 2026 (2026-09-25).

The labelled test appointment and requested demo fixture were intentionally
retained. Physical phone-camera scanning and production invitation delivery were
not verified. External-URL rejection is covered by parser tests, not this browser
pass. Frontend/API typechecks, 41 API phase-one tests and two QR parser tests passed.