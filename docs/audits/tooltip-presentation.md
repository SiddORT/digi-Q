# Tooltip presentation review

## Rule and source coverage

Remove label/heading/value repetition, not useful help. Keep one measured full-value reveal for clipped text. Keep calculation definitions, consequences, unfamiliar actions, restrictions and disabled reasons. Ordinary text is preferable for essential instructions and non-sensitive contextual data.

Reviewed the route map and workspace dispatcher in `App.tsx` / `clinic.tsx`, then the explicit `HelpTip`, `NotificationInfo`, Radix tooltip, native DOM `title`, `OverflowText` and `FullValueText` consumers under `src`. Component props called `title` on dialogs, form sections, charts and cards are visible headings, not native tooltips; those were not stripped. Library chart point tooltips and icon-only sidebar help are not redundant page-title help.

This is source coverage across Super Admin, Clinic Admin, doctor, receptionist, patient and public routes, including consolidated tabs and contextual drawers. It is **not** a claim that every route/role/state was exercised in an authenticated browser.

## Changed locations

| Surface | Decision |
| --- | --- |
| Notifications preview rows | Remove adjacent full-preview information icon. `OverflowText` alone reveals measured clipping; short text is not a help trigger. |
| Notifications group headers | Keep event timing only, rather than repeating switch policy per event. A noninteractive spacer preserves the existing grid where there is no timing help. |
| Notifications group instructions | One visible explanation covers all optional options, including filtered-out rows, Mixed/All Enabled behavior, unchanged Optional Delivery/readiness, required exclusions and future-only changes. Group controls reference it accessibly. |
| Notifications row status | Actual activation source, saved activation/required behavior and actual blocked reasons. General eligibility, provider and wording-inheritance policy remains once under Optional Delivery rather than repeated per row. Blockers remain visible in the row. |
| Template drawer | Placeholder syntax instruction stays visible in both compact and noncompact drawers. Available variable names remain in their existing summary; format/timezone/code-safety explanation stays help. |
| Appointment date cells | Remove repeated clinic/location/session help. Date and session remain visible; clinic/location columns, expanded Booking/Details and Ticket remain unchanged. |
| Queue location address | Ordinary visible text replaces the address-only help icon. Scope and permissions are unchanged. |
| Earlier guest requests | Measured name reveal replaces unconditional native name title. Both contacts and doctor/date/location/timezone remain visible; no unique information is discarded with the detail icon. Rows may wrap. |
| Created listing cells | Remove native full-timestamp title: its formatted date and time are already visible. |
| Compact searchable selects | Remove duplicate native title; retain measured full-value reveal and existing control accessible name. Clipped labels can receive pointer input despite the decorative label layer. |
| Location chooser options | Replace unconditional repeated name/group native title with measured full-value components. Selection control and permission-scoped options remain unchanged. |
| Profile | Move verification-reset help from role badge to the Mobile field label, for the shared self-profile editor only. |
| Shared help/full-value components | Coordinate dismissal across help types; opening a new reveal dismisses an older pinned or hovered bubble. Escape/outside dismissal, keyboard focus and touch remain supported. |

## Useful help intentionally retained

| Routes / components reviewed | Retained reason |
| --- | --- |
| Dashboard, Reports, PublicClinicPage, ReportTrends | Queue-wait / actual consultation / TAT / outcome definitions and chart values are not label repetition. |
| App shell, WorkspaceNav, WorkspaceShell, WorkspaceSearch, PublicHeader, NotificationsPanel | Icon-only controls, collapsed navigation and shortcut discovery. No help was added to page titles. |
| Appointments, AppointmentRows, Ticket, ReceiptManagement, movement/reschedule dialogs | Token-to-reference relation, booking-created versus visit time, action consequences, cancellation/requeue restrictions and private-link destination. Repeated date-cell context alone was removed. |
| Queue, SessionSelector, DurationEditor, GuestRequests | Wait approximation, token versus position, explicit check-in semantics, session scope, duration restrictions, legacy request explanation and stale/disabled states. |
| Users, SystemUsers, AccessRules, CustomRoles, CustomRolePermissions, StaffDeletionReview | Login/account versus invitation status, ownership, access boundaries, destructive consequences and unavailable actions. |
| resources/Editor, ResourceRecord, RecordDetails, PatientDetailsDrawer, PatientActivity/Documents | Derived age, legacy duration, capacity definition, closures versus extra intervals, permanent slugs, active patient eligibility, exact details and clipped fields. |
| ClinicSettings, registration, schedules, exceptions, booking | Inheritance, opening-hours versus sessions, linked/copy/custom distinctions, unsaved-draft restrictions, availability recheck and booking format/timezone explanation. |
| CommunicationSettings, EventControls, EmailTemplates, integration/provider editors/checks, TemplateDrawerFields | No-send versus real test-send consequences, source replacement, credential non-display, required security boundaries, DLT/provider blockers, template variable semantics and draft/publish/reset effects. No delivery behavior changed. |
| FormField, IconAction, RowMenu, ListingControls, ListingViewControls, AppDialog, StatusSwitch, CapabilityState, date/password/address inputs, PinLocalities | Accessible action names, disabled reasons, export/filter/column scope, saved-device preferences, field restrictions and district-versus-city explanation. |
| Auth pages / public booking / scanner / display | No redundant heading tooltips identified; retain unfamiliar action names and public calculation help. |

## Verification boundary

Targeted Playwright regressions use the **real presentation components** with intercepted, fictional API responses; they do not authenticate, deliver notifications, inspect patient data, or prove production readiness. Responsive/input findings and final command results are recorded in the completion summary. The managed application's public landing page was also captured after restart; that capture does not verify signed-in screens.

Actual authenticated role sessions, assistive-technology speech output, iOS Safari/Android browser differences, and production/UAT delivery are not verified by Chromium fixtures. No backend/domain, permission, provider, persisted configuration or template wording changes belong to this cleanup.

### Observed results

- `pnpm typecheck:libs` and `pnpm --filter @workspace/clinicflow typecheck`: passed. The first frontend-only attempt found stale built API declarations; rebuilding the existing shared libraries resolved those declaration errors.
- Notification accordion plus new tooltip regressions: 13 passed.
- New appointment-date cases: 3 passed (1280, 820, 390px).
- Existing notification-management information/responsive/touch cases: 6 passed (including 1440, 1024, 768, 390px rendering).
- Additional synthetic browser probes: 4 passed, covering repeated touch dismissal, long-label reveal versus ordinary location selection, and queue address rendering with retained wait help across 1280, 820, 390px.
- Fictional queue and shared-help screenshots were inspected; generated evidence stays in ignored `generated-artifacts/tooltip-checks/`. Queue screenshots contain synthetic assignment-unavailable notices because that probe supplied only the scope needed for address/wait presentation; they do not verify assignment selection or queue operations.
- The automatically started broad ticket workflow ran during edits (77 passed, 4 failed). Three failures expected the old repeated group-policy text; those assertions now check event timing and the single visible instruction. The fourth was the touch toggle fixed by trigger-specific outside dismissal. All six affected information/touch cases subsequently passed. Do not interpret that partial workflow run as a final full-system pass.
- The first final validation reached 90 of 91 ticket tests; the shared instruction paragraph pushed the Super Admin's first event below the existing compact-header height budget. Its spacing now uses the notification page's label sizing and a small margin, retaining every instruction and the original layout assertion. Screenshot output from appointment regressions now goes to the ignored generated-artifacts directory rather than rewriting tracked reference images.
