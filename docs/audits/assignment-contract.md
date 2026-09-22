# Assignment and appointment QR contract

- `Clinic` responses require `adminId`; clinic create/update accepts optional `adminId`. Super admins may select it, while other roles are assigned by the server.
- `Doctor` responses require `ownerAdminId`; doctor create/update accepts optional `ownerAdminId`.
- `UserInput.clinicIds` and `DoctorInput.clinicIds` reject empty arrays when supplied. Role-dependent presence and assignment authorization remain server-enforced.
- Added authenticated appointment QR operations:
  - `GET /appointments/{id}/qr` (`getAppointmentQr`)
  - `POST /appointment-qr/resolve` (`resolveAppointmentQr`)
  - `POST /appointment-qr/check-in` (`checkInAppointmentQr`)
- Request bodies use the shared `AppointmentQrPayload` schema. Responses expose only the specified QR metadata, appointment, eligibility/idempotency flags, and message.