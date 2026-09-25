# Patient access and Preview demo

Updated 2026-09-25.

## Entry points

- Home and `/patient-login` offer **Scan QR code** and **Guest booking**.
- `/scan-qr` scans via camera or uploaded QR image without login.
- `/guest-booking` selects a public clinic and location without login.
- Existing patient email-code login remains separate.
- Patient booking QRs are not appointment check-in QRs; check-in remains a staff operation.

New guest submissions are immediate bookings: Book Now issues a waiting number
and a private visit ticket without reception approval. Email and phone are
optional. Historical pending receipts remain readable and are handled separately.
The acceptance evidence below describes the older flow before this change.

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

The synthetic provider identity and its local credentials were retired. The
existing Clinic Admin and self-owned doctor profile were retained, and a
development-tenant staff invitation for an owner-controlled mailbox was
created with email notifications enabled. The application records the invitation
as sent and the provider reports it pending; neither status proves inbox
delivery, password setup, or a completed sign-in. The recipient should follow
the private invitation to set their own password, then use Preview `/sign-in`.
No email address, credentials, or invitation tickets belong in this document
or downloadable QR. Production provisioning must use authorized application
onboarding, not direct production SQL or weakened authentication.

## Acceptance evidence

One browser pass verified:

- Guest clinic/location selection and doctor/session details.
- One fictional request without email or mobile.
- Pending receipt survives reload.
- Actual QR image decoding opens the correct booking page.
- Camera-denied and non-QR-image errors provide recovery instructions.
- Before the staff handoff, the isolated development test identity and real
  password proof established the expected Clinic Admin and linked doctor.
- That test identity approved the request in Live queue, producing token D-01 and one
  waiting appointment for Fictional QR Flow Test Patient 2026 (2026-09-25).

The labelled test appointment and requested demo fixture were intentionally
retained. Physical phone-camera scanning and production invitation delivery were
not verified. External-URL rejection is covered by parser tests, not this browser
pass. Frontend/API typechecks, 41 API phase-one tests and two QR parser tests passed.