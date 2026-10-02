# DigiQ: UI/UX Standardization, Onboarding and Schedule Improvements, and QA Remediation (all 107 findings)

## 0. Context and attachments

You are working on DigiQ, an existing clinic queue and appointment application.

Reference material:

1. ClinicFlow UI/UX Standards (JSON). This is the only design system. It is APPROVED for implementation. Its "draft" status only meant it was waiting for my review, and that review is done. Treat implementationAuthorized as true.
2. DigiQ Testing Report (107 numbered findings, dated 29/09/2026 and 30/09/2026). The original .docx is attached and contains screenshots. Use the screenshots to identify the exact screen for each finding. If a finding is still unclear after checking the screenshot and the code, list it under "Needs clarification" in the report. Do not guess.

Product name: the user-facing name is DigiQ everywhere (UI, emails, tickets, file names, page titles). "ClinicFlow" is only the name of the design specification. Replace any user-visible "ClinicFlow" text.

## 1. Working mode

Work in this order and do not skip phases.

Phase 1, Audit report: read the code and the report. Produce the report described in section 11. Also answer the design-review questions in section 6A and give me your feedback on the schedule editor. Do not change code in this phase.

Phase 2, Shared foundation: build or refactor the shared components (section 7), apply the design tokens globally, and implement the clinic date and time format system (section 5).

Phase 3, Onboarding and fixes: apply the onboarding improvements (section 6), then work through the QA findings in section 8 by class. Prefer a shared fix over a per-screen fix.

Phase 4, Verify: re-test every finding and update the report with the final status.

After Phase 1, continue into Phases 2 to 4 without waiting, EXCEPT for items marked Q or P (explained in section 2), which stay as proposals until I approve them.

## 2. Hard rules

Design system
- Use only the ClinicFlow JSON values. Do not invent colors, spacing, type sizes, radii or shadows. Do not add alternative scales.
- Where the JSON says KEEP_CURRENT, keep what the app does today. Printed tickets and QR codes keep their current layout and size.
- The JSON has seven NEEDS_RECOMMENDATION values. Use the approved values in section 4.

What you may change
- UI, UX, copy, layout, validation presentation, error and success feedback, accessibility, performance and loading behavior.
- Functional bugs (class F) are in scope. Fix them so the app does what it was clearly meant to do, keeping the existing intended rules and outcomes.

The ONLY approved database change
- Adding the two clinic display-format settings described in section 5 (date format and time format) to the clinic settings, with a safe migration that gives every existing clinic the default values. No other schema changes without my approval.

What you may not change without my approval (class Q)
- Authentication, authorization and clinic access rules.
- Queue, appointment and scheduling rules.
- Ownership rules and existing workflow outcomes.
- Schedule data model changes (multiple sessions per day, schedule exceptions) beyond what the current data model already supports. See section 6A. Propose first, build after I approve.
- For these, investigate, explain the current behavior and give a recommendation in the report. You may add help text or friendlier wording, but do not change the behavior.

New features (class P): do not build them. Write a short proposal (screens, data impact, effort) in the report.

Always
- Explain the root cause of each F item in the report, not just the symptom.
- Never mask a failure with a success message. Never expose raw errors.
- If a fix would break an existing rule, stop and list it under "Needs clarification".

Class legend used in section 8:
- S = standardization (fixed through a shared component)
- F = functional bug (fix it, keep existing rules)
- Q = needs a product decision (investigate and recommend, no behavior change)
- P = new feature (proposal only)

## 3. Decisions already made (apply these)

- Pagination: required on every listing, server-side (for performance). Label "Showing X–Y of Z". Page sizes 10, 25, 50, 100. Keep the current default page size if one exists, otherwise 25.
- Password rule: minimum 8 characters, must include letters and numbers. Remove the 12-character rule. Enforce the same rule on the client and the server. Show the rule as helper text below the field. (Findings 1 and 7)
- Date and time format: chosen per clinic at onboarding. See section 5. This replaces any fixed global format. (Finding 17)
- User-facing term for a location: "Clinic". Use it consistently in labels, buttons, messages and help text. Code names do not need to change. Fix any misspelling. (Findings 100 and 101)
- Closing a dialog while saving: keep the spec rule (preventDismissalWhileSaving), but make it clear. Show a spinner and "Saving…" on the primary button and disable the close button with the tooltip "Saving in progress". The dialog becomes closable again as soon as the save succeeds or fails. (Finding 81)

## 4. Values for the NEEDS_RECOMMENDATION items

- colors.text.disabled: #7A889E
- colors.surfaces.hover (table row hover, list hover): #EEF4FB
- shadows.dropdown: 0 4px 12px rgba(23,42,74,0.12)
- shadows.dialog: 0 12px 32px rgba(23,42,74,0.18)
- contentAndFormatting.dateFormat and timeFormat: not a global value. They come from each clinic's setting (section 5). Use the defaults in section 5 where no clinic is known.
- terminology.branchOrLocation: "Clinic"

Put all of these in the central token file so they can be changed in one place.

## 5. Clinic date and time format (new, applies everywhere)

Goal: each clinic chooses how dates and times appear. Once chosen, that same format is used everywhere for that clinic, with no exceptions and no confusion. The system stores data in one canonical format only. Staff and patients can see which format the clinic uses.

### 5.1 Onboarding

In clinic onboarding, add a "Date and time format" step or section, placed next to the timezone field.

- Date format options (radio or select), each shown with a live example using today's date:
  - DD MMM YYYY, for example 30 Sep 2026 (default)
  - DD/MM/YYYY, for example 30/09/2026
  - MM/DD/YYYY, for example 09/30/2026
  - YYYY-MM-DD, for example 2026-09-30
- Time format options, each shown with a live example:
  - 12-hour with AM/PM, for example 9:00 AM (default)
  - 24-hour, for example 09:00
- Show a live preview line such as "Appointment on 30 Sep 2026, 9:00 AM – 2:00 PM" that updates as the options change.
- Include a short InfoTooltip: "This format is used for every date and time shown for this clinic, including for patients."
- This setting is editable later in Clinic settings. Changing it only changes how values are displayed. Show a confirmation dialog saying so, and never rewrite stored data.

### 5.2 Storage (one canonical format)

- Timestamps are stored in UTC in ISO 8601.
- Calendar dates are stored as YYYY-MM-DD.
- Clock times (session start and end) are stored as 24-hour HH:mm, interpreted in the clinic's timezone.
- Never store a formatted display string. Never parse a display string back into storage without going through the shared parser.
- Add the two settings (date format, time format) to the clinic settings using stable keys, for example dateFormat and timeFormat, with a migration that sets the defaults for existing clinics.

### 5.3 Display and input (one shared place)

- Build one shared formatter and one shared parser that take the clinic's settings. Every screen, dialog, table, toast, email, SMS, notification and downloaded file name must use them. Search the whole codebase and remove every hard-coded date or time format.
- Time ranges use the clinic's time format on both ends, for example 9:00 AM – 2:00 PM or 09:00 – 14:00.
- Date pickers and time pickers show values in the clinic's format and accept typed input in that format only, with an inline error and an example if the typed value is invalid.
- Public booking pages, patient emails and patient messages use the clinic's format and show the clinic's timezone name.
- On public booking pages, show a small note such as "Dates and times follow {clinic name}'s format (example: 30 Sep 2026, 9:00 AM)".
- Where one screen shows data from several clinics, each value uses its own clinic's format. Where no clinic is known (for example login, password reset), use the defaults.
- Tickets and QR receipts: the date and time text follows the clinic's format, but the print layout and QR size stay exactly as they are today.

## 6. Onboarding and entry-form UX improvements

Keep the existing steps, rules and outcomes. Improve how they are presented.

General for all onboarding and entry forms
1. Show a stepper with step titles and a progress indicator on multi-step flows. Provide Back and Next. Keep every entered value when going back (Finding 19).
2. Use two columns on desktop wherever two related fields fit in a row. One column below 640px.
3. Mark required fields with * and optional ones with "(optional)".
4. Show validation inline below each field. Focus the first invalid field. Trim input so spaces-only counts as empty.
5. Warn before leaving with unsaved changes, using the app dialog (never the browser's).
6. Add a final review summary before submitting, showing read-only values with an "Edit" link per section, if the flow is multi-step.
7. After a successful onboarding, show a completion screen with clear next actions (for example "Add doctors", "Share booking link").
8. Add an InfoTooltip next to every term a new user may not understand: cancellation cutoff, session duration, buffer minutes, max token, queue settings, notification settings, active/inactive status, advanced configuration, clinic.

Specific improvements
9. Date of birth: block future dates, and show age as a read-only field that updates automatically from the date of birth (Findings 62, 63). Use this everywhere date of birth is entered (patient registration, patient edit, booking).
10. Timezone: preselect the browser's timezone and use a searchable list with UTC offsets (Finding 14).
11. Phone numbers: country-code selector with a sensible default taken from the browser, formatted as the user types, validated (+ then country code and digits), stored in international format (Finding 43).
12. Address and location: searchable suggestions as the user types, with a clear message and a manual-entry fallback if suggestions are unavailable (Finding 87).
13. Working days and sessions: use the weekly schedule editor described in section 6A for both clinics and doctors.
14. Numeric settings (session duration, buffer minutes, max token, cancellation cutoff): number inputs with unit labels (minutes, hours), min and max, helper text and inline errors (Findings 83, 84, 28).
15. Passwords: show/hide toggle, rule shown as helper text, and live strength or rule checklist.
16. Patient registration: keep essential fields visible and put secondary fields under a "More details" section.
17. Selected values must always display in dropdowns, and dependent fields reset only when the old value is confirmed invalid (Findings 21, 47).

## 6A. Schedule and session editor, for clinics and doctors (design review, then build)

Goal: replace today's "pick a day from a dropdown, then enter the date and time" pattern with a weekly schedule editor, similar to the opening-hours editor in Google Business Profile.

Clinic weekly schedule
1. Show one row per day, Monday to Sunday, all visible together. No day dropdown.
2. Each row has an on/off toggle. Off means closed and the row says "Closed". When the toggle is turned on, the time controls appear in the same row straight away.
3. Time entry is a dual-handle range slider (opening to closing). Next to the slider, show the start and end times as editable time fields that stay in sync with the slider. Both are required: sliders are imprecise for exact times such as 7:30 PM or 8:32 PM, and keyboard and touch users need a typed alternative. The slider snaps to a step. Propose the step (I suggest 15 minutes) and confirm that exact minutes can still be typed.
4. Multiple sessions per day. An "Add session" action in the row adds Session 2, for example a morning session and an evening session. Each session has an optional name (Morning, Evening), its own slider and time fields, and a remove button. Propose a sensible maximum number of sessions per day.
5. Sessions cannot overlap and the end must be after the start. Show errors inline in the row, at the point where the session is created (Finding 18).
6. "Copy to all days" and "Copy to selected days" are available from any row (Finding 97).
7. Show a collapsed summary line, for example: "Mon–Fri: 9:00 AM – 1:00 PM, 4:00 PM – 7:30 PM. Sat: 9:00 AM – 1:00 PM. Sun: Closed." Use the clinic's time format (section 5). Store times in the canonical format.
8. Show the clinic's timezone above the editor.
9. On mobile, each day becomes a stacked card, sliders use the full width, and handles and buttons are at least 44px.
10. Use the multi-day selection pattern from Finding 15 for copying and bulk edits.

Doctor schedule (when adding or editing a doctor)
1. Use the same editor. Show the clinic's hours for each day as a shaded band behind the slider, and as text such as "Clinic: 9:00 AM – 7:30 PM".
2. Days on which the clinic is closed are shown disabled, with a tooltip explaining why.
3. By default the doctor's sessions snap inside the clinic's sessions.
4. If a doctor's schedule goes outside the clinic's hours (dragged or typed), do not block it silently. Show an inline warning and a confirmation dialog: "This time is outside {clinic}'s hours ({hours}). Do you want to save it as an exception?" Offer three actions: "Save as exception", "Adjust to clinic hours", and "Cancel".
5. Saved exceptions show an "Exception" badge, with an optional reason, and can be edited or removed.
6. A doctor can work at more than one clinic (Finding 98). Check that hours at different clinics cannot clash and report what you find.

Real-world case to support: a clinic closes at 7:30 PM but, when patients are still waiting, may run until 8:00 PM or 8:32 PM on some days. Clinic hours and doctor hours must be able to reflect this without breaking the normal rules.

Design review request (think about this and reply BEFORE building)
a. Does the current data model support multiple sessions per day, days off, and exceptions? Where do the schedule rules live (database, code, both)?
b. Give feedback on the slider-plus-typed-fields design: step size, accuracy, accessibility (WCAG 2.2 requires an alternative to dragging), and mobile behavior.
c. Propose an exception model. Cover at least: a doctor exception beyond clinic hours, a one-day "extend today's closing time" option for a clinic, whether exceptions are for one date or recurring, and who can create them.
d. Explain how exceptions affect: check-in after closing time (Finding 52), session generation (Findings 53, 54, 76), the queue, booking availability, notifications, and "Copy to all days".
e. List edge cases: sessions that cross midnight, timezone changes and daylight saving, migrating existing clinics' data, and shortening hours when appointments are already booked (warn, never silently delete).
f. Give effort and risk for each part.

After your feedback, build everything that fits the current data model (the toggle, slider, typed fields, multiple sessions if supported, copy actions, summary, mobile layout, warnings). Hold anything that needs a schema change until I approve it.

## 6B. Search, filters, sorting, pagination and dropdowns (explicit standard)

Apply to Doctors, Patients, Staff, Clinics, Appointments, Queue, and every other listing you find in the audit. List all of them in the report.

Search
- Place a search box at the top left of every listing, visible without scrolling or opening a menu. Placeholder "Search {items}…".
- Server-side search with a 300 ms debounce. Include a clear button. Keep the current filters and page size while searching.
- No results: show "No matching {items}" with a "Clear search" action.

Filters
- Evaluate every listing. At minimum consider: status (active or inactive), clinic, doctor (Finding 103), date range for Appointments and Queue, and group by Doctor or Clinic (Finding 85).
- Filter behavior stays as it is today where the spec says KEEP_CURRENT. Improve discoverability and presentation only, and fix the bugs in the findings.
- Show active filters as chips with a "Clear all" action.

Sorting
- Sortable columns with a clear direction indicator, applied server-side.

Pagination
- Server-side on every listing. Show "Showing X–Y of Z". Page sizes 10, 25, 50, 100.
- Place the page controls at the bottom of the table and keep them visible.
- Reset to page 1 when search or filters change. Keep the chosen page size.
- For bulk actions, show how many rows are selected and make clear what happens to selections on other pages.

Row actions and export
- Row actions are aligned right, in a sticky action column on desktop.
- Where it adds value (for example Appointments and Patients), offer export of the current filtered results, in the clinic's date and time format.

Dropdowns
- Every dropdown is searchable ("Search {field}…"), rendered in a portal above dialogs and never clipped.
- Large lists (patients, doctors, locations) use server search with pagination, not a full load.
- Keep the selected value during searching, loading and API errors. Show the loading, searching, empty, no-results and error-with-Retry states from the JSON.
- Multi-select shows removable chips and stays open after each selection.

In the report, list for each listing what it had before (search, sorting, filters, pagination, export, row actions) and what it has now, as plain bullet lists.

## 7. Shared components to build or standardize

1. PasswordInput: show/hide toggle (Eye and EyeOff icons) with an accessible name. Used on Login, Register, Reset, Change and Confirm Password.
2. FormField: label above, required *, (optional), helper text, inline error directly below the field, aria-invalid and aria-describedby.
3. Form validation hook: validate on submit, focus the first invalid field, keep entered values, revalidate corrected fields, trim input.
4. Shared validators: person name, phone (+ country code and digits), email, date of birth (not in the future), numeric ranges with min and max.
5. Select, MultiSelect and Combobox: searchable with "Search {field}…" and 300 ms debounce, rendered in a portal above dialogs, never clipped, selected checkmark, chips for multi-select, and the loading, searching, empty, no-results and error-with-Retry states from the JSON.
6. Dialog system (AppDialog, ConfirmDialog, DiscardChangesDialog): fixed header, scrolling body only, sticky footer, 44px close button, focus trap and restore, full screen on mobile for long forms. Replace every alert(), confirm(), prompt() and any browser-native close or leave confirmation with these.
7. Toast service: success (5 s), warning, and persistent critical errors. Supports one consolidated message for bulk actions.
8. Error translator: maps HTTP and API errors to friendly text. Never show 401, 403, 404, 500, stack traces or raw API messages. Examples: "Session expired", "Access denied", "Record not found", "Unable to save changes", "Something went wrong. Please try again."
9. DataTable framework: search at the top left, sorting, filters, server pagination (section 3), status badges, row actions on the right with a sticky action column, export where it makes sense, compact density, labeled cards on mobile. Apply to Doctors, Patients, Staff, Clinics, Appointments and Queue.
10. EmptyState (for example "No doctors found" with a next action), Skeleton and LoadingButton (stable width, spinner, blocks double submit).
11. InfoTooltip: Info icon with tooltip, reachable by keyboard, opens on hover and focus, closes on Escape, linked with aria-describedby.
12. DateTimeFormatter and DateTimeParser: the single source for all date and time display and input (section 5).
13. PageHeader with breadcrumbs and a Back link for nested pages.
14. Email and notification template: one branded HTML template (DigiQ name, details block, footer) with a plain-text fallback.
15. ScheduleEditor, SessionRow and TimeRangeSlider (with synced typed time fields): used for clinic and doctor schedules (section 6A).
16. ExceptionDialog: the "outside clinic hours, save as an exception?" confirmation (section 6A).
17. Table toolbar (search, filter chips, clear all) and PaginationBar (section 6B).

## 8. QA findings: one entry per finding

Format of each line: number, [class], finding, then the required resolution.

1. [S/F] Password should be 6 to alphanumeric. Apply the password decision in section 3.
2. [S] Remove "developer mode" line everywhere. Remove every user-visible developer-mode line and banner from all screens. Make sure it cannot appear in production builds.
3. [S/F] No option to select and typing is blocked. Use the shared Select. Find out why options are empty or the input is disabled, and fix it.
4. [S] Proper message if clinic not selected. Inline "Select a clinic" below the field.
5. [F] Email should use a template. Use the branded template (section 7, item 14) for all system emails.
6. [S] Name is not validated. Shared name validator (letters, spaces, hyphen, apostrophe, dot; trimmed; sensible min and max).
7. [S/F] Password validation is 12 characters. Same as 1.
8. [S] Password view option missing. PasswordInput.
9. [S/F] Resend Code option missing. Add "Resend code" with a visible cooldown timer. Reuse the existing send-code call. Toast on success.
10. [F] Code not received on this email. Trace the email sending path (sender configuration, swallowed errors, provider response). Report the root cause.
11. [S/F] No category list shown. Shared Select. Find out why the list is empty (data, permissions, request) and fix it.
12. [S/F] No list shown, typing not allowed. Same as 3.
13. [F] Hyphen typed on the keyboard is not inserted. Find the input filter or handler that drops it. Allow it where the rules allow hyphens.
14. [S] Timezone typed manually, should be a list. Searchable timezone Select with UTC offsets, defaulting to the browser timezone.
15. [S] Multiple days selection should show. Multi-select day chips (Mon to Sun) and the weekly editor in section 6A.
16. [S/F] No list given. Same as 3.
17. [S] Time format differs between pages. Solved by the clinic format system in section 5. Remove every hard-coded format.
18. [S] Session overlap message should show at session creation. Inline error in the session step when sessions overlap, using the existing overlap rule (section 6A).
19. [S] Same error keeps showing after going back. Clear form and server error state on navigation and on unmount.
20. [S] Remove "HTTP 401 Unauthorized". Use the error translator. Show only the validation message.
21. [F] Clinic selected but not showing. Fix the controlled value and label lookup so the selected clinic always displays.
22. [S] Close icon too small. 44px hit area for every dialog close button.
23. [F] One doctor in the list but it loads very slowly. Profile and fix (queries, N+1, over-fetching). Add skeleton loading and server pagination.
24. [F] Clicking "Schedule" shows this page. Find the intended destination and fix the route. If unclear, list under "Needs clarification".
25. [F] Self-booked appointment should notify in the portal. Create an in-app notification for the patient when they book.
26. [S] "How is this calculated?" Add an InfoTooltip with a plain-language formula. Identify the metric from the screenshot.
27. [S] Design should be proper. Audit that screen against the spec and fix every violation.
28. [S] What is cancellation cutoff? It is not shown while booking. InfoTooltip in settings. Show the cutoff on the booking page and confirmation (for example "Free cancellation until {time}") using the existing setting.
29. [F] Not able to add doctor. Reproduce and fix. Report the root cause.
30. [S] Spaces only and Save: no message, only a highlight. Trim input. Show inline "This field is required" for every mandatory field.
31. [S] Full Name not validated. Same as 6.
32. [S] UI overlaps the button section. Dialog with a sticky footer and a scrolling body only.
33. [S] Closing a popup shows the Chrome confirmation. Replace with DiscardChangesDialog.
34. [F] Error shown but the doctor is added, with a "Delivery Failed" status. Treat as partial success. Show one warning toast: "Doctor added, but the invitation could not be sent." Show an "Invitation not sent" badge and a Resend action. No contradictory error.
35. [F/S] Loading time is too much. Profile and fix. Skeletons for first load, keep existing content visible during refresh.
36. [S] Confirmation should be a system popup. ConfirmDialog.
37. [F/S] Inactivating a doctor is slow and the design is not proper. Update the row status immediately (optimistic with rollback on failure) with a row-level spinner. Apply the table and badge standards.
38. [S/F] Revoke is enabled for an inactive doctor, and the message shows above the list. Disable Revoke for inactive doctors with a tooltip. Show feedback as a toast or inline next to the action, not above the list.
39. [S] Confirmation should be a system popup. ConfirmDialog.
40. [F] Error when revoking multiple doctors. Reproduce and fix. Friendly message only if it genuinely fails.
41. [F] Same message for single revoke. Same as 40.
42. [S] No success message after edit and update. Toast "Updated successfully".
43. [S] Phone with only "+" is accepted. Phone validator and country-code selector (section 6, item 11).
44. [S] Delete confirmation popup design. ConfirmDialog, danger variant.
45. [F] Deleted record is not removed from the list. Fix cache invalidation or refetch so the list updates.
46. [F] Inactive doctors show in the list. Exclude inactive doctors from selection lists (booking, scheduling). Keep them in the Doctors table behind the status filter.
47. [S/F] Selecting a clinic removes the selected doctor and starts loading. Follow dependentFieldReset: clear the doctor only if it is confirmed invalid for the new clinic.
48. [S] Clicking a blank area deselects the checkbox. Only the checkbox toggles selection.
49. [S] Validation shows at the top of the popup. Inline below each field. Add a visible summary only for form-level errors.
50. [S] No success message on "Save changes". Toast.
51. [S] "What does this mean?" Add an InfoTooltip or help text. Identify the item from the screenshot.
52. [Q] Check-in is allowed after clinic closing time (2 PM). Report the current rule. Clinics sometimes run past closing time (section 6A), so recommend how check-in after closing should work (for example allowed only for already-booked patients when the day is extended or an exception exists). Make the message friendly. No rule change until I approve.
53. [F] Friday is open but no session can be selected. Fix session generation and lookup for that day. Check against the schedule model in section 6A.
54. [F] No Saturday session, but one is shown. Same area as 53. Show only valid sessions.
55. [S] Text is centered, so the box should be centered too. Align the container with its content using the spec layout.
56. [S] Meaning of Active/Inactive for a patient. InfoTooltip. Describe what it actually does today, based on the code.
57. [F] Inactive patient can be selected while booking. Exclude or disable inactive patients in booking selectors, with a clear reason.
58. [Q] No consent link, and why is consent given for reception? Investigate where and how consent is captured. Report the current flow and a recommendation. No change yet.
59. [F] "All Visits" filter shows 2 of 4 records. Fix the filter. Counts must match rows.
60. [F] "Notes for your visit" is not shown anywhere. Show it in appointment details and the queue row (truncated, with full text on hover).
61. [F] Patient "Deepa" is not in this list. Find the filter or query that excludes it and fix.
62. [S] Date of birth accepts a future date. Block future dates with an inline message.
63. [S] Age should auto-calculate from date of birth. Read-only age that updates from the date of birth.
64. [Q] Why is there a sign-in option if the appointment books directly? Report. Recommend relabeling it as optional ("Already have an account? Sign in").
65. [F] Reset password shows "Service unavailable". Trace and fix.
66. [F] Patient receives no message or email for the appointment. Trace and fix. Use the branded template and the clinic's date and time format.
67. [F] Error when selecting a clinic and saving. Reproduce and fix.
68. [F] Deleting a patient does not delete. Trace and fix, with correct feedback. See 88 for delete versus inactive.
69. [Q] Same doctor and day, different clinics: check-in works at both. Investigate and recommend. No change yet.
70. [F] Queue session should auto-select by current time. Default to the session that matches the current time.
71. [F] Both show as "Current Schedule". Make the labels distinguish current from other schedules.
72. [S] No option to go back to the list. Breadcrumb and Back link.
73. [F] Ticket file name should read "DigiQ…". Change the file name only, for example DigiQ-ticket-{number}. Do not change the print layout.
74. [S] Button name not showing, design not proper. Visible label plus accessible name. Fix the style per spec.
75. [Q] Reschedule is blocked for "Waiting, awaiting consultation". Report the current rule. Make the message friendly and explain why. No rule change yet.
76. [F] Sunday-only doctor: cannot make an entry. Reproduce and fix.
77. [F/S] It takes time to load. Same as 35.
78. [S] This section's purpose is not understandable. Section heading plus helper text. Use the screenshot to find the section.
79. [S] Bulk actions show multiple result messages. One consolidated toast (for example "5 of 5 updated") and a clear partial-failure summary.
80. [F] "Call Next Patient" changes to "Calling" and is slow. Update the button and queue state immediately, reconcile with the server, and roll back on failure.
81. [S] Cannot close a dialog until the button finishes loading. Apply the decision in section 3.
82. [S] Shows blank for all, but errors on save. Show the required marker and the inline error. Find which fields are affected.
83. [S] "Max Token" length is not fixed. Integer-only with min and max (reuse any existing server limit), helper text, inline error.
84. [S] "Buffer Minutes" length is not fixed. Same as 83.
85. [F] Filter does not work with group by "Doctor / Clinic". Fix.
86. [F] 13 appointments: 8 completed, 1 cancelled, 2 absent, where are the other 2? Make the status counts reconcile with the total (include every status, or an "Other" bucket).
87. [F] Location fields show a message but no list to search. Investigate the autocomplete source (missing key, endpoint or provider). Fix it or report the blocker.
88. [Q] Delete marks the record inactive instead of deleting. Report the current behavior. Make dialog wording match what actually happens. Recommend delete versus deactivate per entity.
89. [F] Doctors take too much time to load. Same as 23.
90. [P] Booking for a family member. Proposal only.
91. [Q] Staff screen only adds doctors, so where is a receptionist added? Check whether a receptionist role exists and how it is created. Report. If it does not exist, treat it as a proposal.
92. [F] Forgot password should work. Trace and fix.
93. [Q] "Please try later": how long, and what about emergencies? Show the real wait time if the existing limit provides it. Propose an emergency path in the report.
94. [S] Patient check-in time should show. Add a "Checked in at" column and detail field, in the clinic's time format.
95. [F] After marking the "Next Called" patient absent, the next waiting patient is not shown as "Called Next". Fix the queue state update.
96. [F] Ticket is not useful for completed appointments. Hide the ticket action for completed appointments.
97. [S] "Copy for all" should show. Add "Copy to all days" and "Copy to selected days" in the schedule editor (section 6A).
98. [Q] One doctor can visit multiple clinics. Investigate and recommend. No change yet.
99. [Q] "Review changes", then "Preview Changes", then "Apply reviewed changes". Make labels consistent now (sentence case, one name per step). Recommend whether the extra step can be merged.
100. [S] Wrong spelling of "Branch". Find and fix. Use "Clinic" per section 3.
101. [S] What is the use of "branch"? InfoTooltip or helper text.
102. [Q] No option to set its credentials. Identify which credentials are meant, report the current flow, and recommend.
103. [S] Add a Doctor filter. Add to the relevant tables.
104. [Q] If I change the status, whom do I inform? Add helper text describing what actually happens. Recommend whether notifications are needed.
105. [S] This takes too much space. Move the primary action into the PageHeader and give the list the full width.
106. [Q] "Mobile verified: No", but there is no way to verify and the field is optional. Report. Recommend hiding the field unless a verification flow exists.
107. [F] Reason entered is not shown anywhere. Show it in the relevant detail view and list row.

## 9. Global standards (from the JSON, enforce everywhere)

- Fonts: Manrope for headings, DM Sans for body. Page heading 24px, section heading 20px, body 14px, labels 13px, table body 13px, table heading 12px. No other sizes.
- Layout: workspace max width 1540px, sidebar 245px, desktop forms in 2 columns, mobile forms (below 640px) in 1 column. No page-level horizontal overflow.
- Spacing: only 4, 8, 12, 16, 20, 24, 32, 40, 48. Desktop page padding 24, card padding 20, form gap 16.
- Colors: primary #1552B0, accent #0E8FB3, page #F3F7FC, card #FFFFFF, plus the semantic and border tokens in the JSON.
- Radius: buttons, inputs and dropdowns 8px, cards 12px, dialogs 14px, badges 6px.
- Touch targets: at least 44px on coarse pointers. Icon buttons need accessible names.
- Status badges: use the JSON mapping. Always show a text label, never color alone.
- Icons: Lucide only.
- Reduce vertical scrolling and wasted space. Avoid single-field rows where two fields fit.
- Loading: skeletons for first load, spinners for actions, keep existing content visible during refresh.
- Empty states explain the absence and offer a next action.

## 10. Acceptance checks

- No alert, confirm, prompt or browser-native leave dialogs remain for in-app actions.
- Every successful create, update, delete, assign, revoke and bulk action produces a toast.
- No raw status codes or technical text in any user-visible message.
- All lists use the DataTable framework with server pagination.
- All dropdowns render above dialogs and are never clipped.
- Every date and time on every screen, email, message and file name comes from the shared formatter and matches the clinic's chosen format. A search of the codebase finds no hard-coded date or time format.
- Stored data is canonical (UTC timestamps, YYYY-MM-DD dates, 24-hour HH:mm times). Changing a clinic's format changes only the display.
- All icon-only buttons have accessible names. All touch targets are at least 44px.
- The clinic and doctor schedule editors work with a toggle per day, multiple sessions per day, slider plus typed times, copy actions, and the exception warning when a doctor's hours go outside the clinic's hours.
- Every listing has a visible search box, server-side pagination with "Showing X–Y of Z", page sizes 10, 25, 50, 100, and searchable dropdowns.
- A keyboard-only run through login, onboarding, booking, add doctor and queue works with a visible focus ring.
- Text at 200% zoom does not break layouts.
- Mobile forms are one column and tables become labeled cards.

## 11. Required report

Deliver the report as a markdown file in the repository (for example docs/digiq-ui-qa-report.md). Use one section per finding, all 107, each containing these lines:

- Finding number and title
- Screen
- Component
- QA finding
- Specification reference
- Current behavior
- Root cause
- Resolution
- Class (S, F, Q or P)
- Priority (P0 to P3)
- Status

Priority guidance: P0 blocks core use or loses or misleads data (cannot add a doctor, record not deleted, no emails, wrong queue state). P1 is broken or confusing core UX. P2 is inconsistency. P3 is polish.

Then add these sections:

1. Shared components standardized
2. Design system violations found (with file or screen)
3. Layout improvements
4. UX improvements (including the onboarding improvements in section 6)
5. Accessibility improvements
6. Estimated findings resolved through standardization versus functional fixes versus decisions and proposals (counts by class)
7. Clinic date and time format: files changed, migration details, and any places that could not be converted
8. Needs clarification (items you could not resolve from the code or screenshots)
9. Proposals for Q and P items, with a recommendation and effort for each
10. Schedule editor design-review feedback (section 6A, questions a to f)
11. Search, sorting, filter, pagination and dropdown coverage for every listing, before and after (section 6B)

Finish by restating anything you did not change and why.
