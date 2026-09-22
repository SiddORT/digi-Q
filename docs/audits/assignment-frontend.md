# ClinicFlow Assignment & QR Frontend Audit

## 1. UI Gaps in Assignment & Scoping
- **Searchable Multiselect:** The current `RelationInput` uses a native `<select multiple>` which is difficult to use for many clinics/branches. We need a proper searchable multiselect component for `clinicIds`, `branchIds`, etc.
- **Assignment Preservation:** When a user with limited scope edits a user/doctor who has assignments outside their scope, the form currently only loads accessible options. Submitting the form might erase the inaccessible assignments because they aren't in the selected values. We need to preserve unseen assignments during edit.
- **Admin Ownership:** Clinic creation needs to assign or display the single Clinic Admin owner. The `clinics` resource fields do not currently surface an `adminId` or ownership label. For SuperAdmin, selecting the single admin owner during clinic creation is missing.
- **Role-based Filtering in Forms:** 
  - Doctors creating Receptionists must be forced/limited to selecting from their own `clinicIds` and `branchIds`.
  - The UI currently doesn't reflect the "Exactly ONE Clinic Admin per clinic" constraint clearly.
- **Visibility:** We need to surface "ownership visible" and "map labels" clearly in user lists and details.

## 2. Appointment QR Gaps
- **QR Display:** Appointments do not currently display an Appointment QR code on confirmation, history, or details. We need a way to fetch `GET /api/appointments/:id/qr` and display the `payload`/`checkInUrl` as a QR code.
- **Universal Check-in Route:** Missing `/check-in` route in `App.tsx`. It needs to be staff-only (Admin, Doctor, Receptionist), preserve the `?payload=` parameter through Clerk auth, and provide scanning functionality.
- **Scanner UI:** We lack a QR scanner component. It must use native `BarcodeDetector` if available, and fall back to file upload/pasted payload decoding using a working JS library (like `jsqr` or `html5-qrcode`).
- **Resolve/Check-in flow:** The scanner must call `POST /api/appointment-qr/resolve` to validate and then allow calling `POST /api/appointment-qr/check-in` with appropriate status/error handling.

## 3. General Architecture
- **Responsive Tables:** Must ensure the multiselect and QR scanner do not break responsive table scrolls or modal layouts.
- **Auth Guarding:** Need to ensure doctors don't accidentally get access to `masters`, `settings`, `users` (super admin scope) while managing receptionists. Receptionist management for doctors should probably be a tailored view or securely scoped in the `users` resource.
