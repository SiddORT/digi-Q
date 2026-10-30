# Close/dismiss audit — source inventory

Date: 2026-10-30. Product: ClinicFlow / DigiQ only. This inventory is **source coverage**, not a claim that every entry was rendered or that every role has backend permission. See [the report](README.md) and [browser observations](browser-notes.md) for actual verification.

## Status and role vocabulary

- **S** = Superadmin, actual role `superAdmin`, URL prefix `/admin`.
- **A** = Clinic Admin, actual role `clinicAdmin`, URL prefix `/admin`.
- **D** = Doctor, `doctor`, prefix `/doctor`.
- **R** = Receptionist, `receptionist`, prefix `/receptionist`.
- **P** = Patient, `patient`, prefix `/patient`.
- **G** = public/guest, no workspace identity required.
- A route existing does not imply that its API supports every operation for that role. Ownership, assignments, location gates, record state and action restrictions still apply.
- Custom roles are **restrictions of clinicAdmin, doctor or receptionist**, not extra URL prefixes. The model supports per-person/per-clinic bindings; multiple restrictions can apply. Neither a custom Patient nor custom Superadmin is supported by `custom-roles.ts`. Configured bindings cannot be inferred from source.

Source anchors: `src/App.tsx` (`routes`, `Guard`, `Providers`); `src/clinic.tsx` (`navConfig`, `PortalWorkspace`, `legacyDestination`, `WorkspaceSettings`, `DoctorClinicWorkspace`); `src/lib/clinic-navigation.ts`; `src/lib/communication-routes.ts`; `src/components/custom-roles.ts`. Paths below are relative to `artifacts/clinicflow`.

## Complete registered workspace page/role model

Cells describe routing/applicability, **not browser results**. `—` means no such registered workspace route for the role; `redirect` means a registered alias, not a second independent page. All actual verification remains separately itemized in the report.

| Page suffix | S | A | D | R | P | Dismissible surfaces / restrictions |
|---|---|---|---|---|---|---|
| dashboard | yes | yes | yes | yes | yes | Shell; care pickers for staff; patient booking notices; table controls where present |
| clinic | redirect to clinics unless context supplied | yes | — | — | — | Clinic selection; Details, Locations, Staff, Policies, Activity History; nested editors |
| clinics | resource list | resource list | clinic/staff/QR tabs | — | — | Resource filters, details, menus; D clinic informational and staff scope differs from A |
| branches | redirect to clinic Locations | redirect to clinic Locations | branch resource | — | — | Location details/editor, inherited owner-only restrictions |
| users | Roles/Permissions/System users | redirect to clinic Staff | redirect to doctor Clinics/Staff | — | — | Custom-role dialog, assignment controls, navigation confirmations, system-user drawers |
| staff | yes | redirect dashboard | — | — | — | Staff tabs, editor, recovery drawer, doctor schedule, deletion review, assignment summary |
| patients | yes | yes | scoped, no create | yes | — | Filters, detail drawer, add/edit (where permitted), row menu, selection/bulk results |
| masters | redirect to Settings/Reference data | redirect dashboard | — | — | — | Reference-data resource editor, exact record, filters, status confirmation |
| appointments | yes | yes | yes | yes | own visits | Filters; view menu; calendar day; details expansion; edit/movement/cancel dialogs subject to permissions/state; ticket dialogs |
| queue | yes | yes | yes | yes | own queue display | Staff session controls, expected duration, guest-request decline, movement/action confirmations; P has no staff queue mutations |
| reports | yes | yes | — | — | — | Dashboard/templates tabs, report detail, date ranges; communication usage record drawer |
| settings | platform tabs | redirect to clinic | redirect profile | redirect profile | redirect profile | S: Platform, Integrations, Reference data, Audit log, Demo clinic |
| audit | redirect to Settings/Audit log | redirect dashboard | — | — | — | Audit event drawer, filters, technical details disclosure |
| qrs | yes | yes | yes | registered | — | QR preview/action dialog, QR editor, exact record, regenerate confirmation subject to permission |
| book | yes | yes | yes | yes | yes | Care/session pickers; register patient for eligible staff, not D/P; schedule setup/recovery for eligible owner |
| availability | yes | yes | yes | registered | — | Add Schedule, Edit Schedule where permitted; filters, weekday/session controls, date/time pickers, unsaved confirmations |
| exceptions | yes | yes | yes | registered | — | Date-exception editor, filters, session/date/time selectors, nested confirmations |
| profile | yes | yes | yes | yes | yes | Address/date/selection pickers, staff contact proof prompts for staff, notification preferences/help |
| demo | redirect to Settings/Demo clinic | redirect dashboard | — | — | — | Demo controls, confirmations; no demo rebuild/reset action authorized for audit |
| templates | yes | own clinic scope | — | — | — | Template editor drawer, unsaved/publish/reset/activation confirmations, server rendering drawer, event information |
| communication | yes | redirect dashboard | — | — | — | SMS/Email/Logs tabs; provider drawers, check/results, delivery details, manual receipt confirmation |
| permissions | redirect Users/Permissions | redirect dashboard | — | — | — | Role selector, restriction help, navigation confirmations |
| integrations | redirect Settings/Integrations | redirect dashboard | — | — | — | Provider credential drawers, connection-check results; no real check dispatched |
| system-users | redirect Users/System users | redirect dashboard | — | — | — | Account drawer/recovery/status and deletion review subject to permitted actions |

Additional workspace routes:

- `/{admin,doctor,receptionist,patient}` redirects to that prefix's dashboard after access checks.
- `/admin/doctors` redirects to `/admin/staff?tab=doctors`.
- `/admin/clinics/:clinicId/:section?` supports `details`, `locations`, `staff`, `policies`, `activity-history`; historical `qrs` and `sessions` normalize to `locations`, `history` to `activity-history`. This is private clinic-ID routing, not the public slug route.
- `/admin/clinic?clinicId=…&section=…` and contextual legacy Settings/Branches/Users links consolidate into the clinic workspace.
- S legacy `settings?area=sms|email|smtp` redirects to Communication; S/A `area=events|templates|notifications` to Templates. Non-S Settings has no remaining independent settings page.
- D Clinics has `?area=clinics|staff|qrs`. S Users has `?area=roles|permissions|system`. S Settings has `?area=platform|integrations|masters|audit|demo`.
- The sidebar is a subset of registered routes. For example Book and Exceptions can be reached by actions/tabs although not separate sidebar items. Do not use sidebar-only coverage as a complete inventory.
- Wrong built-in-role prefixes redirect to the actual role's dashboard. A cannot open S-only staff, reference data, audit, demo, integrations, permissions, system-user or Communication administration via URL. Source does not authorize trying forbidden endpoints.

## Complete public/authentication route inventory

These are G-accessible entries unless stated otherwise; a signed-in user can take a different branch.

| Route | Main surface and dismissible controls to inspect | Applicability / limitations |
|---|---|---|
| `/` | Public mobile Navigation drawer; explanatory help | Signed-in Home redirects through Onboarding |
| `/sign-in/*?`, `/login` | Staff login, validation/help/password controls | `/login` is an alias; no OTP/email action authorized |
| `/patient-login` | Login/signup/access variants; verification prompts/help | No signup or verification delivery authorized |
| `/sign-up/*?`, `/register` | Redirect to patient signup | Alias, not separate popup implementation |
| `/register-clinic/*?` | Registration wizard; address/metadata/timezone/time selectors; leave/discard confirmation | No submit/OTP/send/clinic creation authorized |
| `/register-doctor` | Provider invitation information and sign-in link | No independent editor dialog in route component |
| `/forgot-password`, `/reset-password`, `/set-password` | Recovery/reset forms and help; invalid-token states | Reset redirects to set-password when token supplied; no recovery send or password update authorized |
| `/demo-login` | Fictional demo access form | No demo state changes authorized |
| `/onboarding` | Profile completion and selectors | Requires signed-in identity; no profile submission authorized |
| `/scan-qr` | Patient scanner, camera/upload/inline help and stop/back controls | Camera/device permission dependent; no real patient QR capture |
| `/check-in` | Staff check-in scanner/inline host | Actual access/context dependent; no check-in authorized |
| `/display/:reference` | Public queue display | Valid reference dependent; avoid persisting real queue screenshots |
| `/book/:reference` | Public booking; guest or signed-in patient-facing branch | Valid context dependent; staff sign-in does not convert this to staff workspace booking |
| `/guest-booking` | Clinic finder/GuestBooking; searchable care, dates/sessions, guest receipt management | No Book Now, OTP, cancel, shift or reschedule submission |
| `/live-ticket` | Read-only live status, owner upgrade; existing guest receipt management only with its own capability | No fabricated access capabilities, real private URLs or tokens in evidence |
| `/:clinicSlug`, `/:clinicSlug/:branchSlug` | Public clinic landing/booking, selectors/help | Existing valid public slugs required; not all arbitrary URLs are real clinic pages |
| unmatched/invalid URLs | Not-found/error/retry states | Dynamic clinic catch-all means invalid one/two-segment paths may render clinic-unavailable rather than final generic not-found |

## Shared dismissible surfaces and caller expansion

This is the review queue for browser inspection. A single shared-component finding must not be asserted as a verified occurrence in each row.

| Family / implementation | Source callers and actual page/role occurrences | States to verify |
|---|---|---|
| AppDialog + underlying Radix DialogContent | `AppDialog.tsx`, `ui/dialog.tsx`, `app-dialog.css`; all callers below | Custom header X vs primitive default X, short/long title, modal/drawer, long-body scroll, dirty close, busy state, nested alertdialog |
| Confirmation | `ConfirmDialog.tsx`; `resources.tsx`, `Users.tsx`, ClinicSettings, WeeklyScheduleEditor, AccessRules, CustomRoles, CustomRolePermissions, SystemUsers, StaffDeletionReview, WorkspaceBranch, leave guards, registration and template/notification controls | Close/Cancel/Keep editing placement above correct layer; no confirm execution |
| Resource editing | `resources.tsx` | S/A clinic/resource editors; S/A/R patient create/edit; D patient detail only at list create boundary; S/A/D schedule editor variants; R schedule routes may be read-only; S reference data; QR editors as authorized |
| ExactRecordDrawer / RecordDetails | `resources.tsx`, `RecordDetails.tsx` | Clinics, branches, doctors, users, schedules, exceptions, QR details when exact loader and permitted scope exist |
| PatientDetailsDrawer | `resources.tsx`, `clinic.tsx`, `PatientDetailsDrawer.tsx` | Patients, reporting/appointment-linked patient access according to role and record permissions; long patient name and drawer scroll |
| Audit drawer | `resources.tsx` | S Settings/Audit log only; technical payload expands in place, not a separate dismissible popup |
| QR dialogs | `resources.tsx` | Booking QR preview (dynamic long title), Open Queue Display / Open Clinic Booking dialog; S/A clinic and D Clinics/Booking QR; R only if action available |
| Staff | `Users.tsx`, `AssignmentSummary.tsx`, `StaffDeletionReview.tsx`, `SystemUsers.tsx` | S Staff / Users-System; A Clinic-Staff; D Clinics-Staff for permitted receptionist management. Account Recovery Assistance excludes D; Edit Doctor Schedule contextual dialog |
| Clinic settings | `ClinicSettings.tsx` | S/A Clinic Details, Booking Policies, Edit Location (dynamic title); location-hour changes/review confirmations. Embedded staff and location/schedule/QR operations retain their own role restrictions |
| Schedule | `ScheduleDayDialog.tsx`, `schedule/WeeklyScheduleEditor.tsx`, `schedule/ScheduleExceptions.tsx`, `SchedulingWorkspace.tsx` | S/A/D Edit Schedule; Add Schedule via resource form; Date Exceptions list and nested Add/Edit Date Exception; Doctor Hours Beyond Clinic Hours; dirty tab/weekday/context changes; R only surfaces actually available |
| Booking recovery/setup | `booking/BookingScheduleSetup.tsx`, `booking/OwnerBookingRecovery.tsx`, `clinic.tsx` | Staff Book, owner schedule setup and recovery; Register a New Patient only S/A/R eligibility, not Doctor/Patient; public patient-facing branch must not inherit staff controls |
| Appointment editing/action | `appointments/AppointmentRows.tsx`, `AppointmentDetailsPanel.tsx`, `AppointmentBookingTab.tsx`, `CalendarDayPanel.tsx` | Staff/own-patient appointments as permission/state allows: Reschedule, Shift Time, Re-enter, state action/cancellation; Edit Patient, Edit Booking Details; calendar day close; nested editors/detail tabs |
| Tickets/bulk actions | `appointments/TicketEmailDialog.tsx`, `ticket-actions.tsx`, `BulkAppointments.tsx` | Email Ticket(s), SMS Booking Status Link, bulk cancellation reason; row action menu and bulk selection Clear. Open-only checks; no send/export/cancel required |
| Guest receipt management | `appointments/ReceiptManagement.tsx` | Existing private guest receipt's Shift Time, Reschedule, Cancel Booking, separate from public live share; fictional capability fixture required |
| Staff queue | `queue/DurationEditor.tsx`, `queue/GuestRequests.tsx` | Expected Duration drawer and nested confirmation; Decline Request dialog; staff-only states; Patient queue is not this surface |
| Reports | `reports/ReportsDashboard.tsx`, `CommunicationUsage.tsx` | S/A report details (dynamic title), Communication record drawer, filters/date ranges, templates/report menus |
| Notification wording | `NotificationTemplatesPage.tsx`, `EmailTemplates.tsx`, `EventControls.tsx` | S/A permitted scope: Edit Template drawer, separate Discard Unsaved Changes dialog, publish/reset/activation confirmation, Server Rendering drawer, preview iframe boundaries |
| Communication/provider administration | `CommunicationSettings.tsx`, `EmailProviderPanel.tsx`, `SmsProviderPanel.tsx`, `NotificationSmsSettings.tsx`, `IntegrationSettings.tsx`, `IntegrationConnectionCheck.tsx` | S provider configuration, Twilio credentials, test prerequisites, manual email receipt and connection result drawer. Result-after-check states blocked unless purely fictional; do not dispatch checks or sends to obtain them |
| Delivery history | `NotificationLogs.tsx`, `CommunicationUsage.tsx` | S Communication/Logs; S/A Reports/usage metadata; long-header and nested detail help |
| FilterBar | `ListingControls.tsx` | Resource lists, Staff, Appointments, Reports, Communication/Logs, Users/system and Reference data/Audit where advanced fields supplied; right drawer X, Cancel/Done/Apply/Reset, chips |
| Listing tools | `ListingViewControls.tsx`, `AdminListing.tsx`, `ResponsiveActionGroup.tsx` | Columns, saved views, overflow tools; bulk result dismiss and selection Clear across supported resource/appointment/report listings. No requirement for X on every menu |
| Shell | `clinic.tsx`, `WorkspaceSearch.tsx`, `WorkspaceShell.tsx`, `NotificationsPanel.tsx`, `LocationMenu.tsx`, `WorkspaceBranch.tsx` | S/A/D/R/P actual navigation, workspace search dialog, profile menu, notifications panel, mobile navigation X; staff location menu/gate where applicable. Notifications mark-read may write: intercept or avoid |
| Search/select | `SearchableSelect.tsx`, `SearchableMultiSelect.tsx`, `SuggestionInput.tsx`, `LiveSearchInput.tsx`; ResourceLookup/CareLookup wrappers, AddressFields/TimezoneSelect | All consumers above and public/auth forms. Clear selection/search, remove selected chips, clear-all; popup dismissed by selection/Escape/outside action. Intentional no-X is not defective |
| Date/time/range | `DateFormatInput.tsx`, `DateRangeInput.tsx`, `appointments/VisitRangePicker.tsx` | Schedule/exception/profile/booking/registration date/time; list/report/appointment ranges; day/month/year switching, time Done, calendar Close, range Cancel/Apply/Clear, nested portal owner, scrolling |
| Menus | `RowMenu.tsx`, profile/shortcuts, appointment view and listing menus | All eligible rows/shells, overflow toolbars and workspace search categories; outside/Escape closing without mandatory X; menus inside dialogs have special portal host |
| Help | `HelpTip.tsx`, `OverflowText.tsx`, `PageDescription.tsx` | All relevant pages; clipped-value and info help popovers, focus/touch/outside dismissal, long headings/text |
| Toasts | `ToastHost.tsx`, `lib/notify.ts` | All routes: Sonner top-right notifications, explicit closeButton, up to three visible. Only safe local fictional notification triggers; no operation solely to obtain a toast |
| Scanner/inline QR | `CheckIn.tsx`, `PatientScanner.tsx` | Staff inline scan host and public scanning; camera/upload/device dependent, stop/back/dismiss controls where mounted |

## Library-only versus production usage

`ui/dialog.tsx` supplies a default primitive close as well as the custom AppDialog close supplied by its wrapper. Its CSS-hidden presence is an investigation lead, not proof of duplication. `ui/command.tsx` also wraps DialogContent; `ui/sidebar.tsx` wraps SheetContent. Merely finding these shadcn library definitions is not proof that a production route mounts CommandDialog or SidebarProvider. Likewise UI toast/sheet/drawer/context-menu primitives must have live callers before being counted as product occurrences. The actual app toast host uses Sonner.

## Browser coverage protocol

For each inspected occurrence record actual role (or fictional fixture identity), route, exact popup, trigger, viewport, scrolling/nesting/dirty states, observed versus expected close placement and evidence. Separate:

1. confirmed rendered defect;
2. checked-clear **only in the stated tested state**;
3. source-only suspect;
4. unavailable/blocked/not exercised;
5. genuinely inapplicable route/role combination.

Do not replace missing role coverage with Superadmin results, missing data with existing customer edits, unavailable configured roles with invented server permissions, or unavailable native sign-in with an undocumented bypass. Fixture-backed rendering can establish pixels but not server authorization.
