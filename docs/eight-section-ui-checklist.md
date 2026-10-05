# DigiQ eight-section UI checklist

> Historical UI-pass record. The former unavailable backend surfaces have since been implemented. Current point-by-point status and deferred acceptance are in [functional completion acceptance](functional-completion-acceptance.md); implementation details are in [the functional report](functional-completion-implementation.md). Older “not connected” and browser-pending statements below describe that earlier pass, not current functionality.

Frontend only (`artifacts/clinicflow`). No backend, API, data, auth, clinical order or status changes. Bulk check-in is still rejected.

Status key:
- **Changed**: the source was edited in this pass.
- **Verified**: final TypeScript check and all 280 frontend tests pass; `git diff --check` is clean.
- **Browser pending at source handoff**: historical status recorded before testing; the final rendered results below supersede this column.

This document does not claim a full browser audit of every state.

## Requested section coverage

1. Shared rules: Title Case, consistent buttons, compact desktop layout, hamburger navigation and accessible truncation implemented.
2. Public/auth pages: casing and controls updated, public navigation replaced with a single-row responsive header.
3. Shared workspace: existing navigation/search/profile controls standardized. Notification tabs and workspace-scope interfaces now render, with explicit unavailable actions where backend support is absent.
4. Operational pages: listings, patient/appointment/queue controls and report labels standardized. Patient appointment timelines and current-page report charts use existing APIs; document storage and broader clinical/analytics services remain unavailable.
5. Administration: staff, clinics, locations, settings, templates, permissions, integrations, audit and demo surfaces updated.
6. Patient workspace: existing navigation, booking, appointment, queue and profile interfaces updated without changing clinical behavior.
7. Interaction states: shared controls, focus restoration, hover/focus/tap disclosure and responsive action panels implemented; no exhaustive live CRUD-state certification.
8. Verification: role-route sweep and targeted interaction/viewport checks completed as detailed below. Backend-dependent requirements and native browser zoom remain outside the verified results.

## Implementation details

1. **Casing.** Interface headings, labels, buttons, links, tabs, table headers, badges and navigation use Title Case. These acronyms keep their capitals: QR, OTP, SMS, API, PDF, CSV, SMTP.
   - The shared `title()` helper (`resources.tsx`) now runs through `lib/title-case.ts`. That covers field labels, role names, statuses and audit actions.
   - Explanatory paragraphs and errors stay in sentence case.
   - Accessible names (`aria-label`) keep their original wording.
2. **No casing CSS on interface text.** All `text-transform: uppercase/capitalize` rules were removed from `index.css`, `uniformity.css`, `listing-view-controls.css` and `email-templates.css`. Text that used to be written in hard capitals (eyebrows, queue stat labels, auth eyebrows) was rewritten as Title Case. There are no exceptions any more: uppercase was also removed from `clinic-display.css` and `visit-ticket.css`. The waiting-room display and on-screen ticket labels are now Title Case (Scan to Book, Now Serving, Up Next, Visit Ticket, Waiting Number). Ticket values, the QR code and the reference are unchanged. Hard-capital eyebrows (Patient Access, Super Admin Only, Clinic Group & Clinic, Your Care, Connected) were rewritten as Title Case.
3. **Desktop/laptop priority (1920, 1440, 1366, 1280).**
   - The workspace topbar is always one row with `nowrap`. The breadcrumb shortens with an ellipsis.
   - At 1366px and below, the "Secure workspace" label is hidden. Sign out and quick actions remain in the profile menu.
   - At 900px and below, only the hamburger, the current page, search and the profile menu remain.
4. **Compact table toolbars.** The shared `FilterBar` sends its new `secondary` slot through `components/ResponsiveActionGroup.tsx`. Primary actions such as Add and Book stay visible at every width.
   - **1280px and wider:** secondary actions (Export, Columns, Saved Views, Recovery, Roles & Permissions) sit inline in the top row.
   - **Below 1280px, including phones:** secondary actions collapse behind a "More" button. Laptop header actions stay on one line; phones retain primary actions without overlapping secondary labels.
   - **How the panel works:** it is a disclosure group with `role=group`, not a menu. Its contents are mounted once and are never moved or portalled, so export progress, open dialogs and Columns/Views forms keep their state.
   - **Closing:** an outside click or Escape closes the panel. Clicks inside a dialog opened from the panel are ignored.
   - **Where it is used:** Appointments, Reports, Staff Users, System Users, and every ResourcePage, including the Patients export.
   - **Toolbars outside FilterBar:** CheckIn, GuestRequests and the SessionQueue summary were checked. They contain only search, select or scanner controls and no secondary actions, so they need no menu.
5. **Truncation with access to the full value.** New `components/OverflowText.tsx` (also exported as `FullValueText`) uses Radix Popover.
   - The full value opens on hover, keyboard focus (Enter, Space or Escape) and tap.
   - The popup only appears when text is actually cut off. Layout measurement, ResizeObserver and font readiness make clipped values keyboard-reachable before the first mouse interaction.
   - The text itself is never changed or recased.
6. **Uniform action family.** `.button.small` and row-action buttons and links share a 32px minimum height, 15px icons and an 8px gap. On touch screens the existing 44px rule still applies.
7. **Drawers, forms and list states.** Editor labels, submit/confirm labels, ternary busy labels ("Saving…" / "Save Changes") and empty-state buttons were recased. Empty, loading and error copy stays in sentence case.
8. **Backend-dependent features.** Interface panels now exist, with clearly unavailable states for unsupported operations. They do not fabricate records, successful actions or notification counts. See the workspace surfaces table below.

## Listings where OverflowText was applied

| Listing | Fields |
|---|---|
| ResourcePage (clinics, locations, doctors, patients, users, masters, QR codes, schedules, exceptions, audit) | Primary record, secondary line, string cells, array cells, audit summary |
| Appointments and queue (`AppointmentRows`) | Patient, doctor, location, booking reference |
| Staff users | Member, specialization, managing admin |
| System users | Name, email |
| Reports | Group label |
| Doctor clinics | Clinic name |
| Dashboard activity | Activity summary |
| Public clinic directory | Location name, address (2 lines), doctor name |

Details drawers, row expansion, CSV export and tickets still show the complete value.

## Routes and roles

| Route | Roles | Changed | Source Verification | Browser Pending at Source Handoff |
|---|---|---|---|---|
| `/` landing | Public | Static headings, eyebrows, footer and art cards in Title Case; PublicHeader integrated by main | Tests | Yes |
| `/sign-in`, `/login`, `/patient-login`, `/demo-login` | Public | Eyebrows (Staff Workspace, Patient Access, Demo Staff Access), buttons | Tests | Yes |
| `/forgot-password`, `/reset-password`, `/set-password` | Public | Staff Password Recovery and Staff Invitation eyebrows, buttons | Tests | Yes |
| `/register-clinic`, `/sign-up`, `/register` | Public | Register a Clinic, step headings, completion badges | Tests | Yes |
| `/register-doctor` | Public | Provider Account, Staff Login | Tests | Yes |
| `/onboarding` | New patient | Eyebrows, submit label | Tests | Yes |
| `/scan-qr`, `/check-in` | Staff, patient | Validate Appointment QR, Clinic Staff, Scan Again; scanner geometry unchanged | Tests | Yes |
| `/guest-booking`, `/book/:ref` | Public | Labels and buttons; Sign In to Your Account | Tests | Yes |
| `/:clinicSlug`, `/:clinicSlug/:branchSlug` | Public | Your Care Team, Today at This Location, OverflowText on cards | Tests | Yes |
| `/display/:ref` | Public display | Uppercase removed; labels in Title Case | Tests | Yes |
| `/{role}/dashboard` | All roles | Stat labels, panel headings, activity OverflowText | Tests | Yes |
| `/{role}/appointments` | admin, doctor, receptionist, patient | Column headers, action labels (Check In, Check Out, Skip Absent), status badges, sort/range labels | Tests | Yes |
| `/{role}/queue` | admin, doctor, receptionist, patient | Current Token and stat labels, Call Next Patient | Tests | Yes |
| `/{role}/patients` | admin, doctor, receptionist | ResourcePage cells and editor labels | Tests | Yes |
| `/admin/clinics`, `/admin/branches` | superAdmin, clinicAdmin | Cells and editor groups | Tests | Yes |
| `/admin/users` | superAdmin, clinicAdmin | Column labels, status sub-badges, filters | Tests | Yes |
| `/admin/system-users` | superAdmin | Name and email OverflowText, labels | Tests | Yes |
| `/{role}/availability`, exceptions | admin, doctor, receptionist | Add Session, Copy to Selected Days, Preview Changes | Tests | Yes |
| `/admin/reports` | admin | Group OverflowText, labels | Tests | Yes |
| `/admin/masters`, `/admin/audit` | superAdmin | Cells, audit action via `title()` | Tests | Yes |
| `/admin/settings` | superAdmin, clinicAdmin | Clinic Section, Booking Mode, section buttons | Tests | Yes |
| `/admin/templates` | superAdmin, clinicAdmin | Chip capitalize CSS removed; labels | Tests | Yes |
| `/admin/permissions` | superAdmin | Labels and buttons | Tests | Yes |
| `/admin/integrations` | superAdmin | Labels; SMTP and SMS acronyms kept | Tests | Yes |
| `/admin/demo` | superAdmin | Enable Demo Access and other buttons | Tests | Yes |
| `/{role}/profile`, `/patient/book` | doctor, patient | Labels and buttons | Tests | Yes |
| 404 | Any | Page Not Found, Return Home | Tests | Yes |

## Final rendered verification

- Fictional, intercepted API responses only; no live data writes or clinical actions.
- Route sweeps: Super Admin 21 destinations, Clinic Admin 13, Doctor 12, Receptionist 8 and Patient 5. All settled without application errors, unwanted sign-in redirects or page-level overflow in the tested laptop contexts.
- Public landing verified at 1920, 1440, 1366, 1280, 1024 and 390 CSS pixels. Narrow navigation opens, closes with Escape and restores focus; logo and hamburger stay in one row.
- Public authentication, registration, scanner, booking, directory and invalid-slug states sampled. This does not certify real sign-in, camera scanning, every CRUD/error state or live API authorization.
- Sign In and Start Camera verified at 40px desktop and 44px coarse-pointer touch.
- A 109-character patient name clips with ellipsis and reveals its full value by hover, keyboard focus and true touch tap; short text adds no focus stop.
- More includes Export, Columns and Views; Columns settings and open dialog state survive 1024-to-1366 resizing, and Escape restores focus.
- At 911×600 CSS pixels, Book Appointment stays visible and document overflow is eliminated. This is a zoom-equivalent viewport test, not native 150% browser zoom.
- Final 390px check: More panel labels do not overlap, Book Appointment stays visible, Columns is reachable, and document scroll width equals the viewport width.
- Ticket reference, token, date/location, clinic/doctor and readable QR remain visible. No bulk check-in action was performed or introduced.
- Browser-discovered regressions were fixed and checked narrowly; unchanged route sweeps were not repeated.
- New panels verified separately: notification tabs, mobile containment, full unavailable explanations, Escape/focus return and outside dismissal; workspace identity scope; patient visit pagination, page loading, error/retry, forbidden and empty states; disabled documents with explanations; current-page report charts and rejection of inconsistent counts.
- Doctor patient rows expose Details but not Create/Edit/Deactivate, matching existing server write restrictions. The final targeted browser check confirmed Details present and Edit/Deactivate absent without making writes.
- Patient Timeline dates, times and status history use each appointment's configured date/time preferences and timezone. Page changes do not display previous-page records under a new page label.

## Workspace surfaces: what works now and what needs a backend

All of these are frontend only. No server, API or permission changes were made.

**Shared pieces:**
- **`components/CapabilityState.tsx`** provides:
  - the `Capability<T>` type, with the states loading, loaded, empty, error (with retry), forbidden and unavailable;
  - `fromQuery()`, which maps a real query result to one of those states (401/403 becomes forbidden);
  - `CapabilityView`, which renders the matching state;
  - `UnavailableAction`, a disabled button that shows its reason.
- **No placeholder data:** "Unavailable" means no API exists. It is never displayed as an empty list, and no mock data exists.

| Surface | Works now | Not connected (no API) |
|---|---|---|
| Notifications (topbar bell, `NotificationsPanel.tsx`) | Opens a panel with All, Appointments, System and Mentions tabs, plus Escape and outside-click close. | No notification service is passed in, so every tab shows the Notifications Not Connected state. There is no count badge and no records. Mark All as Read is disabled, with a visible reason. The panel accepts a typed `NotificationAdapter` once an API exists. |
| Workspace switcher (profile menu, `WorkspaceScope`) | Shows the current role and scope from the signed-in user: Platform-Wide, Your Patient Account, the clinic name, or N Clinics. Multi-clinic staff see their real memberships; names come from `useListClinics`, with a fallback label and a retry on error. | Switch Workspace is disabled with a visible reason. No switch API exists and no scope change is simulated. |
| Patient details: Timeline (`PatientDetailsDrawer.tsx`, opened from the patient row) | That patient's appointments from the existing `listAppointments?patientId=` API, 25 per page, newest first, with Newer Visits and Older Visits paging and a "Visits X–Y of N" label. This is labelled as appointment visits only, not a full clinical record. It shows a true empty state, an error state with retry, and a forbidden state for 401/403. | — |
| Patient details: Activity | Real `StatusEvent` history for the visits on the current Timeline page only, and labelled that way. | If the listing omits `history`, it shows an unavailable state rather than an empty clinical history. |
| Patient details: Documents | — | Upload, Download and Delete are disabled with a visible explanation. There is no storage API, no file input and no side effects. |
| Report chart (`ReportChart.tsx`, Reports page) | A stacked bar chart of outcomes per group (Completed, Absent, Cancelled, Other), drawn from the report rows already loaded for the table, for the current page only and capped at 20 groups. It shows an empty state when there are no rows. It shows Chart Unavailable, not a clamped chart, when any count is missing, negative or inconsistent. Recharts `accessibilityLayer` is on, and the table remains the full accessible source. | A trend over time needs a time-series API that does not exist, so no trend chart was drawn. |
| Saved views | Unchanged and still private: search text, `q`, page and any free text are removed before storage (`sanitizeViewFilters`). The dialog says that search text is never saved. Navigation history is untouched. | — |

**Patient details access:** the Details button shows for every role that can already list patients. Edit and Deactivate still require update permission. The column group, header and expansion column span all follow the same `hasActions` flag. Backend rights are unchanged; the API's `list-query.ts` scopes the `patientId` filter by role.

## Known limits

- On wide desktops, Columns and Saved Views now sit in the top-row action group. They used to be in the second (filter) row.
- **Glossary:** `lib/ui-glossary.ts` holds the approved casing for known action phrases (Sign In, Check In, Set Up, Book Appointment, Roles & Permissions and others). `titleCase` applies it, and `lib/ui-glossary.test.mjs` fails if any static label uses a different casing.
- Behaviour tests: `lib/title-case.test.mjs` (acronyms, minor words, brand casing) and `components/overflow-text.test.mjs` (source contract for keyboard measuring). Real focus and popup behaviour still need a browser check.
- Email templates: field labels, confirm dialogs, chips (source/delivery enum codes shown through `titleCase`) and event options are now Title Case. The template text (subject, body, footer) is never changed.

- Stored names, emails, URLs, IDs and free text are never passed to `titleCase`.

## Casing source audit: template literals and conditional labels

Method: I grepped all `*.tsx` outside `components/ui/` for:
- template literals in `label`, `title`, `submitLabel`, `confirmLabel`, `alt`, `placeholder` and JSX text;
- ternary string pairs (`?"…":"…"`);
- `label:` and `title:` object literals;
- short JSX text inside `button`, `a`, `Link`, `th`, `h1`–`h4`, `legend`, `summary`, `label` and `option`.

I reviewed every hit by hand. In template literals only the fixed words were changed; interpolated data (`${name}`, `${email}`, `${reference}`, counts, dates) passes through untouched.

**Changed to Title Case (visible labels):**
- **AppointmentRows:** row tooltips View Ticket for … and More Actions for ….
- **WeeklyScheduleEditor:** Save Weekly Schedule (…) button and the Deactivate Removed Sessions? dialog.
- **WeeklyOverview:** Copy Doctor Sessions? dialog.
- **ClinicRegistration:** Code Emailed to … field label.
- **ClinicRegistrationHours:** … Session N slider label.
- **ClinicRegistrationWizard:** Discard Clinic Setup? dialog.
- **Users:** Resend Invitations for N Selected Staff?, Resend Invitation?, Deactivate Staff Member? and Save Changes.
- **CustomRoles:** Staff Member (…), Edit … / Custom Role.
- **SystemUsers:** Effective Permissions · … drawer title and the Platform (All-Scope Assignments Only) option.
- **AdminListing:** Activate/Deactivate Selected Records?
- **PublicClinicPage:** Clinic Information | DigiQ document title.
- **PasswordInput:** Hide/Show Password tooltip; the accessible name is unchanged.
- **EmptyState:** No Matching …
- **PublicClinicBookingQr:** Open Booking Link.
- **WorkspaceSearch:** Search Pages and Permitted Records.
- **DemoLogin:** Demo Password.
- **DemoClinicManagement:** Create Demo Clinic? and Rotate Demo Password? dialogs.
- **resources.tsx:** Deactivate User?, Regenerate QR Code?, Deactivate Record?, Discard Changes? dialogs; Open Queue Display / Open Clinic Booking; the Session (Optional; Blank Applies to All) field.
- **SessionQueue:** In Consultation / Called Next / No Patient Called.
- **GuestBooking:** You're Booked / Booking Not Available / Booking Received / Issuing Your Ticket heading; Available Session / Session Unavailable.
- **ClinicSettings:** Clinic Details / Booking Policies; Manage Clinical Locations / Enable My Doctor Profile.
- **LinkedScheduleControls:** Walk-Ins Only (No Online Bookings).
- **IntegrationSettings:** Server Environment (Private).
- **Dashboard:** stat labels Today's Appointments, Waiting in Queue, Completed Visits, Average Queue Wait; heading Your/Today's Appointments; badge Last Available / Live Data.
- **Appointments:** Today & Upcoming, Visit Date: Earliest/Latest First, All/Past Visits chip.
- **Reports:** every sort label and column header, including Average Queue Wait and TAT · Actual Average Consultation. The CSS `data-label` selectors for tabular numerals were updated to match.
- **Also:** Sign In, Sign Out, Book Appointment, Check In — Enter Consultation, Roles & Permissions, Try Again, More Actions.

**Kept in sentence case on purpose:**
- **Accessible names only:** every `aria-label`, including the HelpTip and StatusSwitch labels, which render as `aria-label`.
- **Text that is not a label:** `alt` text, placeholders, helper text and help tooltips that are full sentences ("Turn off to stop sessions on …", "Check in only when …"), and validation and error messages ("Enter a valid … for example …").
- **Consent statements:** the checkbox consent sentence.
- **Headlines:** display headlines written as sentences with a full stop ("Sign in to your workspace.", "Care begins with an invitation.").
- **Countdown labels:** "Resend in Ns". This already follows the minor-word rule.

**Not changed:** stored names, emails, URLs, references, IDs, template subject/body/footer text, and exported ticket values.

`SystemUsers.tsx` line 100 trailing whitespace removed.
