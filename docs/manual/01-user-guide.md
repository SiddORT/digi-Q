# ClinicFlow frontend user guide

> **Basis and status of this guide.** This guide documents the frontend as implemented in the current source, not an aspirational product design. “Wired” means the UI calls a generated API client or Clerk flow in code. It does **not** mean that the feature was exercised against a configured deployment. Items marked **Limitation / unverified** either have no frontend control, depend on deployment configuration or third-party delivery, or were not runtime-tested during this documentation pass.

## 1. What ClinicFlow provides

ClinicFlow has:

- a public marketing home page;
- Clerk-hosted sign-in, sign-up, and account-recovery experiences;
- first-time patient or doctor onboarding;
- public QR booking links that hand off to authenticated booking;
- role-specific workspaces for platform administrators, clinic administrators, doctors, receptionists, and patients;
- appointment booking, status transitions, and live queue views;
- administration of clinics, branches, doctors, patients, users, master values, schedules, exceptions, and booking QR codes;
- reports, CSV export, audit records, platform settings, and self-service profiles.

The frontend sends API calls through `/api`. The generated contract says data is persisted and authorization-scoped: super administrators can access all records; clinic administrators and receptionists are assignment-scoped; doctors access their own/relevant resources; patients access themselves. UI visibility is an additional convenience, not the security boundary.

## 2. Routes, redirects, and access

### 2.1 Public and authentication routes

| Route | Behavior |
|---|---|
| `/` | Public home when signed out. A signed-in visitor is immediately redirected to `/onboarding`. |
| `/sign-in` and nested Clerk paths | Clerk sign-in UI. On success, forcibly redirects to `/onboarding`. |
| `/sign-up` and nested Clerk paths | Clerk sign-up UI. On success, forcibly redirects to `/onboarding`. |
| `/login` | Alias that redirects to `/sign-in`. |
| `/register` | Alias that redirects to `/sign-up`. |
| `/forgot-password` | Redirects to `/sign-in`; recovery itself is selected inside Clerk’s sign-in UI. There is no standalone ClinicFlow recovery form. |
| `/register-doctor` | Stores a browser-session `doctor` onboarding intent and redirects to `/sign-up`. |
| `/onboarding` | Connects an authenticated Clerk identity to a ClinicFlow patient or doctor profile. |
| `/book/:reference` | Resolves a public booking QR reference. The clinic/branch/doctor context may be preselected and locked. Authentication is required before booking. |
| Any unmatched route | “Page not found” with a Return home link. |

The public home’s header has **How it works**, **For clinics**, **Sign in**, and **Get started**. The main calls to action are **Book an appointment** (patient sign-up) and **I’m a healthcare provider** / **Join as a doctor** (doctor-intent sign-up).

### 2.2 Workspace route model

All workspace routes are guarded. While Clerk or the current ClinicFlow identity is loading, the page says **Preparing your workspace…**. Signed-out users go to `/login`. A missing ClinicFlow user or `needsOnboarding` identity goes to `/onboarding`. An identity error is shown with **Try again**.

The API roles `superAdmin` and `clinicAdmin` both use the `/admin/...` URL family and admin shell. If a user enters the wrong role family, the guard redirects to that user’s actual dashboard. Visiting `/admin`, `/doctor`, `/receptionist`, or `/patient` redirects to that role’s `/dashboard`.

All registered workspace routes are:

- `/admin/dashboard`, `/admin/clinics`, `/admin/branches`, `/admin/doctors`, `/admin/users`, `/admin/patients`, `/admin/masters`, `/admin/appointments`, `/admin/queue`, `/admin/reports`, `/admin/settings`, `/admin/audit`, `/admin/qrs`, `/admin/book`
- `/doctor/dashboard`, `/doctor/profile`, `/doctor/clinics`, `/doctor/branches`, `/doctor/availability`, `/doctor/exceptions`, `/doctor/appointments`, `/doctor/queue`, `/doctor/patients`, `/doctor/qrs`, `/doctor/book`
- `/receptionist/dashboard`, `/receptionist/appointments`, `/receptionist/queue`, `/receptionist/patients`, `/receptionist/book`
- `/patient/dashboard`, `/patient/book`, `/patient/appointments`, `/patient/queue`, `/patient/profile`

### 2.3 Navigation visibility by role

The sidebar order and visibility are:

| Role | Visible sidebar items |
|---|---|
| Super administrator | Overview; Appointments; Live queue; Clinics; Branches; Doctors; Patients; Users; Booking QR codes; Reports; Master data; Audit log; Settings |
| Clinic administrator | Overview; Appointments; Live queue; Clinics; Branches; Doctors; Patients; Booking QR codes; Reports |
| Doctor | Overview; Appointments; Live queue; Patients; Clinics; Branches; Weekly schedule; Date exceptions; Booking QR codes; Profile |
| Receptionist | Overview; Appointments; Live queue; Patients |
| Patient | Overview; Book appointment; Appointments; Live queue; Profile |

Clinic administrators are explicitly redirected away from `/admin/users`, `/admin/masters`, `/admin/settings`, and `/admin/audit`, even if those URLs are entered manually.

**Book route discoverability.** Admin, doctor, and receptionist sidebars do not contain **Book appointment**, but the route is registered. Most page headings show a **Book appointment** shortcut; it is suppressed only on Book, Profile, and Settings. Patients also have Book in their sidebar. Thus staff booking is wired but often reached from a page-heading shortcut or dashboard card rather than sidebar navigation.

**Limitation / unverified:** frontend routes and menus are not a complete statement of server permission. For example, a doctor can see Clinics and Branches, but the API can reject edits outside owned scope. Receptionist QR write permission exists in the API implementation but no receptionist QR route or navigation item exists in this frontend.

## 3. Authentication, onboarding, and session behavior

### Sign-in and sign-up

The auth layout uses Clerk components and includes a back-to-home link. Sign-in links to sign-up and vice versa. Clerk controls credential fields, verification, forgot-password steps, session duration, and related validation; those exact fields vary with the configured Clerk instance and are not defined by ClinicFlow source.

After sign-in/sign-up, the user is sent through `/onboarding`. If the ClinicFlow identity already exists, onboarding redirects to:

- `/admin/dashboard` for `superAdmin` or `clinicAdmin`;
- `/<role>/dashboard` for doctor, receptionist, or patient; or
- `/book/:reference` if a QR reference remains in session storage.

When the Clerk user changes, the React Query cache is cleared. Sign out also clears cached queries and calls Clerk sign-out, redirecting to the application base URL.

### First-time onboarding

The onboarding form contains:

- **Full name** — required; initialized from the Clerk full name when available.
- **Mobile** — optional telephone input.
- **I consent to the use of my information for appointment management** — required checkbox.
- **Complete my profile** submit button, shown as disabled with **Saving…** semantics while the request is pending.

Normal registration defaults to the **patient** intent. Entering through `/register-doctor` sets a session-only doctor intent. Successful onboarding clears that intent.

**Limitations / unverified:**

- Doctor intent is stored in `sessionStorage`, so it is browser-tab/session dependent. Entering `/sign-up` directly creates the patient intent.
- The onboarding screen displays API errors but does not present a dedicated recovery path beyond returning to Clerk sign-in.
- Clerk session timeout is not controlled by the ClinicFlow settings screen.

### QR handoff during authentication

Opening `/book/:reference` stores the reference in session storage and resolves it before authentication. A signed-out user sees the resolved clinic context and **Sign in to book**. After sign-in and any required onboarding, the browser returns to the QR booking route. A successful booking removes the stored QR reference.

## 4. Shared workspace behavior

The desktop workspace has a fixed sidebar, current-page breadcrumb, “Secure workspace” marker, initials avatar, name/role, and sign-out control. On small screens the sidebar becomes a toggleable drawer. Tables scroll horizontally; two-column forms collapse to one column; QR cards collapse to one column.

Page headings show the current localized weekday/month/day. Dashboard greetings vary by local browser hour. The footer states that all times follow the configured clinic timezone, although browser-local formatting is used for several displayed timestamps.

### Errors, loading, and empty states

- API errors generally appear inline in a red alert box using the API error message.
- Resource lists show **Loading [resource]…** while loading and **No [resource] yet** when empty.
- Dashboard statistic values show `…` during load and `—` when absent; its appointment panel shows **Loading appointments…**.
- Appointment lists show **Loading appointments…**.
- Queue shows **Updating live queue…** only after both doctor and branch are selected. Before a valid selection/data response it shows **No selected queue yet**.
- Booking shows **Checking availability…** while availability loads and a “No session…”/server reason when unavailable. An empty public clinic result has its own empty state.
- Public QR resolution shows **Finding your clinic…**.
- Onboarding shows **Connecting your account…**.
- Profile shows **Loading profile…** until data arrives.
- Settings shows its integration notice immediately but has no separate loading skeleton for the settings form.
- Reports has no explicit loading indicator: before/without rows it displays the empty report-results state.
- QR image-generation errors, QR regeneration errors, form-save errors, delete/deactivate errors, OTP errors, and appointment-transition errors are displayed inline.
- A top-level React error boundary is present for caught rendering failures.

### Generic search and pagination

Clinics, branches, doctors, patients, users, master data, and audit logs have a search box. Search is sent server-side as the user types, with no submit button or debounce, and resets the page to 1. Weekly schedules, date exceptions, and QR codes do not offer search.

Generic resource lists request 10 records per page. The footer shows total records and current page. **Previous** is disabled on page 1; **Next** is disabled when `page × 10 >= total`. There is no page-number picker, page-size selector, or sort control.

Appointments have separate server-side search, date, and status filters, also with 10 rows per page. Changing any filter resets page 1. The status dropdown contains All statuses plus: `booked`, `checkedIn`, `waiting`, `called`, `inConsultation`, `completed`, `noShow`, and `cancelled`. Search is described as patient/reference search.

### Lookup dropdown behavior

Relation fields are native selects populated from API records. Multi-value fields (keys ending in `Ids`) are native multi-selects and instruct desktop users to hold Ctrl/Command. Lookup loading is indicated in the first option; lookup errors appear below the control.

Lookup loaders fetch all available records in pages of 100, fetching up to four later pages concurrently per batch. Generic editor relation lists are not dynamically narrowed by earlier choices in the same form. In particular, a Branch relation can show branches beyond a selected Clinic; invalid combinations may be rejected by the API.

City/state/pincode/country/area text fields use datalist suggestions from active matching master values. They remain free-text inputs; selecting a suggestion is not mandatory.

## 5. Overview dashboard

All roles use the same dashboard layout, with API data scoped to their identity:

1. Four statistic cards:
   - Today’s appointments
   - Waiting in queue
   - Completed visits
   - Average wait in minutes
2. A recent appointments table: labeled **Your appointments** for patients and **Today’s appointments** for staff, with **View all**.
3. A booking card linking to the role’s Book route.
4. **Workspace activity**, showing summary, actor, and localized timestamp, or an empty state.

The dashboard appointment table uses the same appointment actions as the full list. The API currently returns recent audit activity only to administrator roles, so other roles normally see an empty activity state.

## 6. Appointment list and appointment actions

Each appointment row displays:

- patient name and booking reference;
- doctor, clinic, and branch;
- date and token;
- status;
- only the next actions returned as allowed by the API.

Possible action labels are **Check in**, **Enqueue**, **Call**, **Start**, **Complete**, **No show**, **Requeue**, and **Cancel**. The current server state flow is:

`booked → checkedIn → waiting → called → inConsultation → completed`

Additional flows are:

- `waiting` or `called` → `noShow`;
- `noShow` → `waiting` via requeue;
- `booked`, `checkedIn`, or `waiting` → `cancelled`.

Cancel and No show open a browser prompt requesting a reason. Cancelling the prompt aborts the action; submitting an empty reason is permitted by the frontend. Buttons are disabled while a transition is pending. The frontend includes the currently displayed status as `expectedStatus`, allowing the API to reject stale transitions. Patients receive only Cancel for their own eligible booking; staff actions are API-scoped.

Appointments poll automatically every **30,000 ms (30 seconds)**. Dashboard recent appointments do not set their own polling interval. Actions invalidate cached queries, causing affected data to refetch according to React Query behavior.

**Limitations / unverified:**

- There is no appointment details page, history/timeline UI, manual refresh button, direct appointment editor, or standalone appointment-delete control.
- Queue actions may be server-restricted to the appointment date; cancellation may be rejected after the configured cutoff.
- The reason prompt is a basic browser dialog, not a controlled form or cancellation-reason dropdown.

## 7. Booking an appointment

Booking is a three-step workflow. A client-generated request ID is reused for the mounted booking form to support idempotent submission.

### Step 1 — Choose your care

Fields:

- **Clinic** — public clinic records.
- **Branch** — disabled until a clinic is selected.
- **Doctor** — disabled until a branch is selected.
- **Visit date** — defaults to today and cannot select an earlier date in the browser.

Changing clinic clears branch and doctor. Changing branch clears doctor. Public branch and doctor queries are filtered using the current clinic/branch values. Availability is fetched only when doctor, branch, and date are present.

When available, the screen shows remaining places, session start/end, timezone, and optional break. It explains that appointments are queue-based and do not guarantee an exact consultation time. Continue is disabled while availability is fetching, when unavailable, or when fewer than one token remains.

With a QR booking context, any encoded clinic, branch, and doctor selections are prefilled and disabled. A QR may encode only clinic, clinic+branch, or clinic+branch+doctor.

### Step 2 — Your details

For a patient:

- the visit is fixed to the signed-in patient profile;
- **Mobile number** is initialized from the user profile;
- **Send code** requests an OTP;
- after an OTP challenge, the provider and localized expiry time are displayed;
- **Verification code** accepts numeric input;
- **Verify** submits the challenge and code;
- successful verification shows **Mobile verified**;
- a development-only code is shown only if the API explicitly returns one in development mode;
- **Notes for your visit** is optional and capped at 1,000 characters.

The expected mobile format shown to users is international E.164 style (leading `+`; API contract permits 8–15 digits after it). Verification codes are 4–8 digits per the API contract.

For staff:

- **Patient** selects from all authorized patients;
- **Register a new patient** toggles an inline patient registration form;
- successful registration selects the new patient and closes the form;
- **Notes for your visit** is optional and capped at 1,000 characters.

The staff inline patient form contains all patient fields listed in [Patients](#patients), prefilled with the selected clinic and branch.

**Important OTP limitation:** the frontend does not require `verify.data.verified` before allowing Review or Confirm. Whether verification is mandatory is ultimately enforced by API/platform configuration. The UI also does not implement a visible resend countdown from `resendAfterSeconds`; Send code is disabled only during the pending request or when mobile is empty.

### Step 3 — Review & book

The review shows clinic/location, doctor, date/session window, and patient. The user must check:

**I consent to appointment management and the clinic’s booking policy.**

The confirm button is disabled without consent or during submission and changes to **Confirming…**. Availability is checked again by the API. Booking source is submitted as:

- `qr` from a resolved QR link;
- `online` for a patient’s ordinary booking;
- `walkIn` for staff booking.

Although `phone` exists in the API contract, this frontend never selects it.

### Confirmation

Success shows doctor, clinic, branch, assigned token, date, booking reference, and the reminder that booking and check-in are separate. The live Queue component is embedded below and initialized to the newly booked appointment.

There is no email/SMS confirmation control, calendar-file download, payment step, or print-confirmation control in the current frontend.

## 8. Live queue

The queue API is polled every **30,000 ms (30 seconds)** whenever doctor and branch are selected. The screen also prints **Refreshes every 30 seconds** and shows the server-provided last-updated time formatted in the browser locale.

### Patient queue

Patients choose **Your appointment** from authorized appointments for the selected queue date. Each option shows token, doctor, and branch. Selecting one sets appointment, doctor, and branch. Patients can also change Queue date.

The result shows:

- Now serving token, or `—` / “No active consultation”;
- Up next token, or `—`;
- waiting and completed counts;
- if returned, **Your token**, patients ahead, estimated wait in minutes, and status.

The API contract omits the full queue `entries` list for patients. The frontend therefore gives a personal position/status rather than exposing other patients.

### Staff queue

Administrators, doctors, and receptionists select Doctor, Branch, and Queue date. A doctor defaults to their own doctor ID; an appointment confirmation can also initialize all queue filters.

Staff additionally see:

- **Call next patient**, disabled while pending;
- the queue entries table, including names/references and allowed appointment actions.

The API picks/advances the next patient and can reject invalid scope, date, or active-consultation conditions.

**Limitations:**

- Doctor and Branch are independent all-record dropdowns in the queue; the frontend does not filter branch by doctor or validate the pairing before requesting.
- Changing a patient’s date does not explicitly clear a previously selected appointment.
- There is no pause queue, manual reorder, priority editor, sound/notification, or dedicated manual refresh.
- The UI text uses a fixed 30 seconds rather than reading `pollIntervalSeconds` dynamically, though the current contract also fixes it at 30.

## 9. Resource administration

All resource pages use the same patterns:

- table rows are the only read/list view; there is no separate details view;
- **Add** opens a modal with a create form;
- pencil opens the same modal with existing data;
- trash asks **Delete or deactivate this record? Records with history are preserved.**
- the wired DELETE API deactivates records rather than providing a destructive frontend hard-delete flow;
- create/edit/deactivate errors are shown inline;
- successful create/edit closes the modal and refreshes queries;
- successful deactivate refreshes queries;
- required fields show an asterisk and browser/form-level “Please complete this field.”

Not every underlying API rule is reproduced in the form. Server validation and authorization remain authoritative.

### Clinics

**Visible to:** super administrator, clinic administrator, doctor.

Table: Name, Code, City, Phone, Status.

Create/edit fields:

- Name *; Address *
- City, State, Pincode, Country, Area (free text with active master-value suggestions)
- Phone; Email; Description
- Clinic type (master-value dropdown)
- Category (clinic-category master-value dropdown)
- Status: Active or Inactive

Create, edit, and deactivate are wired. The API may prevent a clinic administrator from creating a clinic and may restrict doctors to owned clinics.

### Branches

**Visible to:** super administrator, clinic administrator, doctor.

Table: Name, Clinic name, City, Timezone, Status.

Create/edit fields:

- Clinic *
- Name *; Address *
- City, State, Pincode (free text with suggestions)
- Phone; Timezone
- Status: Active or Inactive

Create, edit, and deactivate are wired. Clinic and branch scope/ownership are server-validated.

### Doctors

**Visible to:** super administrator and clinic administrator. Doctors manage themselves through Profile rather than the Doctors list.

Table: Full name, Specialization name, Email, Mobile, Status.

Create/edit fields:

- Full name *; Mobile *; Email *
- Date of birth; Gender: Female, Male, Other, Prefer not to say
- Photo URL
- Specialization
- Registration number; Experience years; Consultation fee
- About
- Clinics (multi-select); Branches (multi-select)
- Qualifications (multi-select)
- Languages (comma-separated; trimmed into an array)
- Status: Active or Inactive

Creating a doctor is wired to account/profile provisioning and therefore depends on Clerk invitation/configuration. No credentials are entered or displayed in this form. Edit and deactivate are wired.

### Patients

**Visible to:** super administrator, clinic administrator, doctor, receptionist. Patients use Profile rather than the list.

Table: Full name, Code, Mobile, Gender, Mobile verified.

Create/edit fields:

- Full name *; Mobile *
- Email; Date of birth
- Gender: Female, Male, Other, Prefer not to say
- Age; Address
- Emergency contact name; Emergency contact phone
- Clinic; Branch
- Status: Active or Inactive

Create, edit, and deactivate are wired for staff subject to API scope. The table renders Mobile verified as Yes/No. Changing mobile can reset verification server-side.

### Users

**Visible to:** super administrator only in this frontend. Clinic administrators are explicitly blocked from the page despite some assignment-scoped API support.

Table: Full name, Email, Role, Status.

Create/edit fields:

- Full name *; Email *
- Mobile
- Role *: Doctor, Receptionist, Clinic admin, Patient
- Clinics (multi-select); Branches (multi-select)
- Status: Active or Inactive

Super administrator is not offered as a create/edit role in the UI. Account creation is wired to identity matching/invitation and can fail if Clerk is unavailable or an identity/email conflicts. Existing roles may be immutable server-side even though the edit form displays Role. Deactivation is wired; server protections can prevent deactivating the final active super administrator.

#### Account recovery

The Users page includes an **Account recovery** panel:

1. Select a user from the **current page’s results**.
2. Click **Request recovery instructions**.
3. On success, read the returned message and use **Open secure sign-in and select Forgot password**.

The request is audited but explicitly does **not** itself send a recovery email. The actual password recovery is Clerk’s secure sign-in flow. No password, reset token, or secret is displayed or edited by ClinicFlow.

### Master data

**Visible to:** super administrator only.

Table: Name, Category, Code, Status.

Create/edit fields:

- Category *: Country, State, City, Area, Pincode, Clinic type, Clinic category, Clinic status, Specialization, Qualification, Department, Consultation type, Appointment status, Appointment type, Booking source, Cancellation reason, Queue status, Token prefix, Queue type, Queue priority, User role, User status
- Name *; Code *
- Parent (master-value dropdown)
- Sort order
- Status: Active or Inactive

Create, edit, and deactivate are wired. Some categories have governed codes and the API may reject unsupported or changed codes.

### Weekly schedules (`/doctor/availability`)

**Visible to:** doctor. A doctor-linked identity opens new schedules with its Doctor preselected and `isOpen` true.

Table: Doctor name, Branch name, Day of week, Start time, End time, Max tokens.

Create/edit fields:

- Doctor *; Clinic *; Branch *
- Day of week *: Sunday through Saturday
- Is open
- Start time *; End time *
- Break start; Break end
- Timezone
- Token prefix *
- Max tokens *; Consultation minutes *; Buffer minutes
- Queue mode: Mixed, Appointments only, Walk ins only
- Queue open time; Queue close time

The modal warns: one session and optional break per branch/day; overnight sessions are unsupported. Create, edit, and deactivate are wired. API validation handles time validity and overlapping sessions.

The list has pagination but no search.

### Date exceptions (`/doctor/exceptions`)

**Visible to:** doctor.

Table: Date, Reason, Is closed, Start time, End time.

Create/edit fields:

- Doctor *; Branch *
- Date *
- Is closed
- Reason *
- Start time; End time
- Break start; Break end
- Max tokens

Use Is closed for closures; for an override, enter replacement timing/capacity. Create, edit, and deactivate are wired. The API can require an underlying weekly schedule and reject overlaps.

The list has pagination but no search.

### Audit log

**Visible to:** super administrator only in this frontend.

Table: Created at, Actor name, Action, Entity type, Summary.

Audit is read-only: there is search and pagination, but no create, edit, deactivate, details, date filter, or export control. Timestamps are rendered as returned in the generic table (not explicitly locale-formatted here).

## 10. Booking QR codes

**Visible to:** super administrator, clinic administrator, and doctor.

Table: Name, Reference, Status. It has pagination but no search.

### Generate

**Add QR code** opens fields:

- Name *
- Clinic *
- Branch (optional)
- Doctor (optional)
- Status: Active or Inactive

Saving is wired to QR creation. The API generates the public reference; the user never types the reference. Branch/doctor context is optional, enabling progressively less specific links.

### View and download

Every active QR in the current result page is also rendered as a card below the table. The browser generates a 400-pixel data-URL QR image for the full `/book/:reference` URL. The card shows the QR image, name, clickable public URL (new tab), and **Download PNG**, which downloads `[QR name]-qr.png`.

Inactive QR rows remain visible in the table but do not render cards.

### Regenerate

**Regenerate reference** asks for confirmation that printed copies will stop working. On confirmation it calls the regeneration API and refreshes queries. The resulting reference/link and QR image change. Regeneration errors are shown on the card.

### Deactivate

The table’s trash action uses the generic deactivate confirmation. The wired API marks the QR inactive; after refresh it disappears from the active-card grid. Edit can also set Status to Inactive.

### Print status

**Limitation:** there is no QR-specific Print button, print stylesheet, or `window.print()` action in the current frontend. Users may download the PNG and print it using browser/operating-system tools. Regeneration invalidates prior printed/downloaded codes by replacing their reference.

## 11. Reports and CSV export

**Visible to:** super administrator and clinic administrator in the frontend.

Filters:

- From date — defaults to today
- To date — defaults to today
- Group by — Date, Clinic, or Doctor

Results columns:

- Group
- Appointments
- Completed
- Cancelled
- No-show
- Registrations
- Average wait (minutes)

Changing a filter directly changes the report query; there is no Apply button. An API error is shown inline. No rows produces **No report results yet**.

**Export CSV** is enabled only when rows exist. It creates a local `clinicflow-report.csv` containing `label`, `appointments`, `completed`, `cancelled`, `noShow`, `registrations`, and `averageWaitMinutes`. Values are quoted and embedded quotes escaped. Export uses the currently loaded grouped rows, not a separate export endpoint.

**Limitations:** no charts, print report, PDF/XLSX export, clinic/branch filter, scheduled report, custom filename, or explicit loading indicator. Checked-in/waiting and average consultation metrics may exist in API data but are not shown/exported by this UI.

## 12. Platform settings

**Visible to:** super administrator only.

The settings form is loaded from and saved to the API. Fields shown:

- Platform name
- Support email
- Support phone
- Timezone
- Booking horizon days
- Cancellation cutoff minutes
- Require mobile verification
- OTP expiry seconds
- OTP max attempts
- Terms URL
- Privacy URL

Successful save shows **Settings saved.** The notice displays whether an SMS provider is configured and states Queue refresh: 30 seconds.

**Explicit boundaries:**

- General notifications are not connected.
- Session timeout is managed by Clerk; settings here do not change the authentication session.
- Although the API settings schema includes session timeout, notifications, logo URL, and primary color, this frontend does not expose those fields.
- The form provides required-field checks only where configured; numeric ranges and valid timezone/URL/email rules may be rejected by the API.

## 13. Profiles

### Patient profile

Fields:

- Full name *
- Mobile *
- Email
- Date of birth
- Gender: Female, Male, Other, Prefer not to say
- Age
- Address
- Emergency contact name
- Emergency contact phone

Clinic, Branch, and Status are deliberately omitted from self-edit. Saving is wired to the patient update API. Changing mobile resets verification server-side.

### Doctor profile

Fields:

- Full name *
- Mobile *
- Email *
- Date of birth
- Gender
- Photo URL
- Specialization
- Registration number
- Experience years
- Consultation fee
- About
- Clinics (multi-select)
- Branches (multi-select)
- Qualifications (multi-select)
- Languages (comma-separated)

Status is omitted. Saving is wired to the doctor update API; server rules can prevent doctors from adding assignments.

### Fallback user profile

If an identity has neither doctor nor patient profile, fields are Full name *, Mobile, and Photo URL, saved through the current-user profile endpoint. The registered role routes normally expose Profile only to doctor and patient.

All profile types show a note that mobile changes reset verification, inline errors, and a **Your profile has been saved** success notice.

## 14. Feature status and known frontend limitations

### Clearly wired in source

- Clerk sign-in, sign-up, sign-out, and handoff to Clerk recovery.
- Identity-aware redirects, onboarding, and patient/doctor intent.
- Scoped dashboard API.
- Resource list/create/edit/deactivate calls.
- Appointment list, filters, 30-second polling, and state transitions.
- Three-step booking, availability checks, idempotency key, patient registration, OTP request/verify, consent, confirmation.
- Public QR resolution and auth return path.
- Queue selection, patient-own entry, staff entries, Call next, and 30-second polling.
- QR create/edit/deactivate, client-side image generation, PNG download, and reference regeneration.
- Reports and browser-side CSV export.
- Settings read/update.
- Audit list.
- User recovery-instruction request.
- Doctor/patient/current-user profile update.

### Pending, absent, or deployment-dependent

- No runtime verification was performed for this documentation; successful delivery depends on API, database, Clerk, and optional SMS configuration.
- No frontend-specific print function for QR codes, appointments, queue, confirmations, or reports.
- No general notification center, email/SMS booking confirmation control, or queue push notifications.
- SMS OTP delivery is deployment-dependent. A development provider may return a development-only code; this is not delivered SMS.
- OTP completion is not a frontend gate to booking; API settings/enforcement decide whether verification is required.
- No read-only detail pages for resources or appointments; tables are the read presentation.
- No sorting controls, adjustable page sizes, numbered-page jump, saved filters, or search debounce.
- No hard-delete user workflow. The generic action and server behavior are deactivation-oriented.
- No dedicated reactivate action; records with editable Status can be set Active in Edit if allowed, while resources without a Status field may require another operational path.
- No QR card for inactive records and no frontend preview of a QR before creation.
- No report loading state or report auto-refresh interval.
- Only Appointments and Live queue explicitly poll, each every exactly 30 seconds. Other screens use normal query caching/refetch/invalidation; global query defaults are one retry and 15-second stale time.
- Browser locale is used for headings and several timestamps, while clinic-configured timezone governs server scheduling. Display-zone differences should be considered.
- Native multi-select interaction is desktop-oriented; the Ctrl/Command instruction is not tailored for touch devices.

## 15. Source map

Primary implementation references:

- Route registration, role-route guards, public home, Clerk auth, and redirects: `artifacts/clinicflow/src/App.tsx` (especially lines 10–17, 25–65).
- Onboarding, public QR handoff, role navigation, dashboards, appointments, booking, queue, profiles, settings, and reports: `artifacts/clinicflow/src/clinic.tsx` (lines 10–95).
- Resource definitions, every editor field, generic CRUD/search/pagination, user recovery, QR rendering/download/regeneration, profile/settings field lists: `artifacts/clinicflow/src/resources.tsx` (lines 10–86).
- Responsive behavior and visible state styling: `artifacts/clinicflow/src/index.css` (especially lines 6–10).
- Generated roles, statuses, field constraints, queue contract, QR context, reports, and settings types: `lib/api-client-react/src/generated/api.schemas.ts` (notably lines 28–69, 78–169, 172–683).
- API contract scope/error/polling summary: `lib/api-client-react/src/generated/api.schemas.ts` lines 1–11.
- API error-message behavior: `lib/api-client-react/src/custom-fetch.ts` lines 151–199 and 325–370.

The source pointers are included so operators and testers can distinguish frontend behavior from assumptions and re-check this guide when the implementation changes.