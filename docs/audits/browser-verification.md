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
- **Optional UI (clinicAdmin), initial attempt:** Navigation ended at `/sign-in` rather than `/admin/settings`; this attempt did not establish role-specific redirect behavior. The isolated verification below subsequently closed this gap.

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

## Isolated Clinic Admin verification — 2026-09-22

**Result: passed.** This was a new, narrowly scoped browser pass, not a rerun of the earlier API suite. Earlier audit fixtures were not reused. No application code, Clerk configuration, schema, role rules, or layouts were changed.

### Identity gate

A fresh browser context used the supported programmatic Clerk sign-in helper with the newly isolated fixture identity. Before checking protected routes:

- Browser Clerk reported `loaded=true` and `signedIn=true`.
- Actual Clerk user ID was `user_3JgS18QRjj3rvWbXyERn4VWjtPI`; the intended fixture email matched the signed-in identity.
- Authenticated `/api/me` returned HTTP 200, app user `338ced0b-58fb-4b8b-8e45-a6175b842c7a`, role `clinicAdmin`, active status, and `needsOnboarding=false`.
- The mapped clinic was `1a04ceec-58ac-4c5e-8eee-6fc2391a9177` and branch was `337a14af-99b5-483a-99de-e95787396f94`.
- `/admin/dashboard` rendered the Clinic Admin header and fixture audit activity. Screenshot: `z3n8u5`.

### Browser route results

Each navigation settled after the brief workspace-loading transition. No unauthorized editor or management content was exposed.

| Requested route | Settled route | Screenshot |
|---|---|---|
| `/admin/settings` | `/admin/dashboard` | `7i258e` |
| `/admin/masters` | `/admin/dashboard` | `fz6rca` |
| `/admin/users` | `/admin/dashboard` | `zmp113` |
| `/admin/audit` | `/admin/dashboard` | `b4gaa4` |

### Authorized records

- `/admin/clinics` displayed exactly one fixture row: `CF-BROWSER-20260922124319-feba80 Clinic`, Pune, Active. Screenshot: `mryhio`.
- `/admin/branches` displayed exactly one fixture row: `CF-BROWSER-20260922124319-feba80 Branch`, associated with that clinic, timezone `Asia/Kolkata`, Active. Screenshot: `46xynq`.

### Cleanup and scope

Only the newly marker-owned Clerk identity and exact database fixture rows (user, clinic, branch, assignment, and audit record) were removed. Post-cleanup checks found zero remaining fixture user, clinic, and branch rows and zero matching Clerk identities. No pre-existing records were altered.

No passwords, tokens, cookies, or other credentials are included in this evidence. The only observed browser warning was Clerk's normal development-key warning. No reproducible application defect was found. The previous authenticated API mutation-denial result remains valid and was not rerun.