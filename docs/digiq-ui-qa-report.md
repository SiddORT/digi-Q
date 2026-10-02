> Implementation update: This report is the Phase 1 source-audit snapshot. See docs/digiq-progress.md for subsequent implementation and test results. Findings 1/7 (password policy), 33 (native discard confirmation), and shared close-control portions of 22/81 have now received changes; none of this certifies full UAT resolution. SMTP configuration/test controls and an explicit fixed-duration JWT option are implemented, but activation and live delivery remain unverified.

# DigiQ UI/UX and QA audit — Phase 1

## Scope, evidence and approval boundary

Audit only. No application, configuration, dependency, schema, secret or deployment changes; no test execution, database access, email sends or live requests. “Current” means inspected workspace source, not reproduced UAT behavior. UAT is authoritative; the user reports a manually deployed JWT implementation, whereas workspace code uses native opaque database sessions. Neither token format nor deployed behavior was independently verified. This report does not authorize an authentication migration.

References: `attached_assets/DigiQ_Replit_Prompt_v3_1790945121673.md` (sections cited as §), `reports/digiq-master-checklist-137.md`, and `.agents/memory/{clinic-admin-ownership,booking-readiness,native-auth-boundary,patient-booking-contract,digiq-standardization-decisions}.md`. Text from `attached_assets/2026-10-01-DigiQ_Testing_Report_1790946281158.docx` was inspected read-only. Embedded screenshots were **not visually reviewed** in this restricted pass; ambiguous screen/metric identification remains explicitly provisional. No signed-in UI, keyboard, mobile or performance reproduction is claimed.

Evidence shorthand (paths relative to repository):

- **UI** = `artifacts/clinicflow/src/`; **API** = `artifacts/api-server/src/`; **DB** = `lib/db/src/schema/core.ts`; **ZOD** = `lib/api-zod/src/generated/api.ts`.
- **R** = UI `resources.tsx` (resource definitions, Editor, RelationInput, ResourcePage).
- **U** = UI `Users.tsx` (staff tabs, UserEditor, row/bulk operations).
- **C** = UI `clinic.tsx` (Dashboard, Appointments, Booking, DoctorClinics, Reports, Profile).
- **D** = UI `components/AppDialog.tsx`; **L** = UI `components/ListingControls.tsx`.
- **AV** = API `lib/availability.ts`; **AR** = API `lib/appointments.ts`; **RR** = API `routes/resources.ts`.
- **QAPI** = API `routes/queue.ts`; **LP** = API `lib/list-query.ts`.
- Each shorthand is a file reference, not evidence of live reproduction. A suspected cause is not recorded as established.

“Pending — static gap” means a mismatch is visible in source, but remediation and retest remain pending. “Not reproduced” means the symptom/root cause needs controlled reproduction; it does not mean the finding is invalid or fixed. Priorities follow the reported impact. Q/P resolutions below are proposals only. Mixed source classifications are preserved.

## Individual findings

### 1. Password requirement
- Screen: Staff registration/password setup.
- Component: Password inputs; API `lib/native-auth.ts:passwordInput`.
- QA finding: Password requirement is inconsistent.
- Specification reference: §3, §7.1/4; checklist 118.
- Current behavior: Server requires 12 characters; UI `auth/PasswordFlows.tsx` uses `minLength={12}`.
- Root cause: Explicit duplicated 12-character rules; server does not enforce the approved letters-and-numbers composition.
- Resolution: Shared minimum-eight, letters-and-numbers rule; preserve existing hashes and login compatibility.
- Class: S/F.
- Priority: P1.
- Status: Pending — static gap.

### 2. Developer-mode text
- Screen: Booking verification; other screens require inventory.
- Component: C `Booking`.
- QA finding: Developer-mode text should not appear.
- Specification reference: §8.2.
- Current behavior: UI renders “Development-only code” when response includes `developmentCode`.
- Root cause: Conditional user-visible development response rendering exists; production exposure not reproduced.
- Resolution: Remove production-visible developer text without weakening verification or exposing codes elsewhere.
- Class: S.
- Priority: P1.
- Status: Pending — static candidate; production exposure unverified.

### 3. Unusable selection
- Screen: Provisional clinic selection; exact screenshot needed.
- Component: UI `components/ResourceLookup.tsx`, `SearchableSelect.tsx`.
- QA finding: No options and typing blocked.
- Specification reference: §6.17, §7.5.
- Current behavior: Shared search/lookup infrastructure exists; failing field/request not identified.
- Root cause: Not established; empty data, scope and disabled dependencies must be distinguished.
- Resolution: Reproduce with field and role; preserve selection and show loading/empty/error/Retry states.
- Class: S/F.
- Priority: P1.
- Status: Not reproduced — needs screenshot mapping.

### 4. Missing clinic message
- Screen: Clinic-dependent form; exact instance provisional.
- Component: R `RelationInput`, `Editor`.
- QA finding: Missing clinic selection needs a proper message.
- Specification reference: §6.4, §7.2.
- Current behavior: Required relations exist; exact error placement not visually verified.
- Root cause: Not established for reported screen.
- Resolution: Inline “Select a clinic”, associated with the field; focus first invalid control.
- Class: S.
- Priority: P1.
- Status: Pending — presentation audit/retest.

### 5. Email template
- Screen: System email.
- Component: API `lib/auth-email.ts:sendAuthEmail`.
- QA finding: Email lacks a template.
- Specification reference: §7.14.
- Current behavior: `sendMail` receives subject and plain text, no HTML.
- Root cause: Shared sender contract accepts text only.
- Resolution: Branded DigiQ HTML with equivalent plain text; reuse for existing channels only.
- Class: F.
- Priority: P2.
- Status: Pending — static gap.

### 6. Name validation
- Screen: Registration.
- Component: UI `components/ClinicRegistration.tsx`; shared validators to consolidate.
- QA finding: Name not validated.
- Specification reference: §7.2–4.
- Current behavior: Multiple independent form paths; comprehensive common name validation not established.
- Root cause: Reported invalid value not reproduced.
- Resolution: Trim and validate letters/spaces/hyphen/apostrophe/dot with approved length guidance and inline errors.
- Class: S.
- Priority: P1.
- Status: Pending — shared validation review.

### 7. Twelve-character validation
- Screen: Reset/setup password.
- Component: UI `auth/PasswordFlows.tsx`; API `lib/native-auth.ts`.
- QA finding: Twelve-character minimum conflicts with decision.
- Specification reference: §3; finding 1.
- Current behavior: Client and server explicitly require 12.
- Root cause: Existing hard-coded minimum.
- Resolution: Same shared change as 1/118; do not rotate credentials.
- Class: S/F.
- Priority: P1.
- Status: Pending — static gap.

### 8. Password visibility
- Screen: Login/reset/setup.
- Component: UI `auth/StaffLogin.tsx`, `auth/PasswordFlows.tsx`.
- QA finding: Missing password view option.
- Specification reference: §7.1.
- Current behavior: Plain `type="password"` inputs in inspected paths.
- Root cause: No visibility control at these inputs.
- Resolution: Shared accessible Eye/EyeOff toggle, autocomplete retained.
- Class: S.
- Priority: P1.
- Status: Pending — static gap.

### 9. Resend code
- Screen: Patient/registration verification; exact reported flow provisional.
- Component: UI `auth/PatientLogin.tsx`, `components/ClinicRegistration.tsx`.
- QA finding: No resend option.
- Specification reference: §8.9.
- Current behavior: PatientLogin already has “Resend code” and visible cooldown.
- Root cause: Not established; reported flow may differ from current workspace.
- Resolution: Reuse existing send endpoint where missing, retain limits, add success toast; do not reintroduce mandatory staff-login email.
- Class: S/F.
- Priority: P1.
- Status: Not reproduced — patient capability already present.

### 10. Verification email not received
- Screen: Email verification.
- Component: API `lib/auth-email.ts`, `routes/auth.ts`.
- QA finding: Code not received.
- Specification reference: §8.10.
- Current behavior: SMTP configuration absence throws `EMAIL_UNCONFIGURED`; send failure throws `EMAIL_DELIVERY_FAILED`.
- Root cause: Delivery failure cause not established; no secrets/provider logs/live send inspected.
- Resolution: Controlled authorized delivery trace, redacted provider acceptance/rejection evidence, friendly retry; never claim delivered from request success.
- Class: F.
- Priority: P0.
- Status: Not reproduced — delivery verification pending.

### 11. Category list empty
- Screen: Clinic onboarding/category selection.
- Component: R master fields; UI `components/ClinicRegistrationWizard.tsx`.
- QA finding: No category list.
- Specification reference: §6.17, §7.5.
- Current behavior: Master-backed category lookup exists; master data not queried.
- Root cause: Not established; distinguish missing catalog from permission/request error.
- Resolution: Show explicit data/error state and retry; no invented category seed data.
- Class: S/F.
- Priority: P1.
- Status: Not reproduced.

### 12. Empty non-typable list
- Screen: Onboarding; exact field needs screenshot.
- Component: UI `components/SearchableSelect.tsx`, R relations.
- QA finding: No list and typing disallowed.
- Specification reference: §7.5.
- Current behavior: Searchable components exist; target unknown.
- Root cause: Not established.
- Resolution: Identify field, inspect request and enabled conditions; shared searchable portal control.
- Class: S/F.
- Priority: P1.
- Status: Not reproduced — clarification required.

### 13. Hyphen input
- Screen: Onboarding identifier/name; exact field unconfirmed.
- Component: UI `components/ClinicRegistrationWizard.tsx`, `editor-input.ts`.
- QA finding: Keyboard hyphen is dropped.
- Specification reference: §8.13.
- Current behavior: No proven responsible handler identified.
- Root cause: Not established; must not broaden slug or identity rules speculatively.
- Resolution: Reproduce exact input; allow hyphen where existing rules permit; test typing/paste.
- Class: F.
- Priority: P1.
- Status: Not reproduced — exact field needed.

### 14. Timezone picker
- Screen: Clinic/schedule edit.
- Component: R branch and availability `f("timezone")`.
- QA finding: Timezone is manual text.
- Specification reference: §6.10.
- Current behavior: Generic resource definitions use text timezone fields.
- Root cause: Timezone has no dedicated control in generic Editor.
- Resolution: Searchable IANA list with offsets/browser suggestion; retain saved location timezone.
- Class: S.
- Priority: P1.
- Status: Pending — static gap.

### 15. Multiple days
- Screen: Weekly scheduling.
- Component: R availability; UI `components/ClinicRegistrationHours.tsx`.
- QA finding: Multi-day selection missing.
- Specification reference: §6A, §6.13.
- Current behavior: Generic doctor editor selects one weekday; weekly overview/copy infrastructure also exists.
- Root cause: Editing patterns differ across workflows.
- Resolution: Mon–Sun rows and chips for copy/bulk edits, preserving distinct session IDs.
- Class: S.
- Priority: P1.
- Status: Pending — static gap.

### 16. Missing list
- Screen: Session/onboarding relation; exact target provisional.
- Component: R relations; UI `components/CareLookup.tsx`.
- QA finding: No options supplied.
- Specification reference: §7.5.
- Current behavior: Lookup infrastructure exists; failing request not known.
- Root cause: Not established.
- Resolution: Identify target and data scope; explicit empty/error/Retry states rather than fabricated options.
- Class: S/F.
- Priority: P1.
- Status: Not reproduced — clarification required.

### 17. Inconsistent time format
- Screen: All clinic-context surfaces.
- Component: UI `lib/date-time.ts`, C, UI `components/queue/SessionSelector.tsx`.
- QA finding: 12-hour and raw 24-hour displays differ.
- Specification reference: §5.
- Current behavior: Locale timestamp formatter plus raw `startTime–endTime`; no clinic format argument.
- Root cause: Display formatting is distributed, not preference-driven.
- Resolution: Parent Clinic Group formats inherited by Clinics; canonical parser/formatter, defaults and additive settings migration only.
- Class: S.
- Priority: P1.
- Status: Pending — static gap.

### 18. Overlap feedback timing
- Screen: Schedule session step.
- Component: RR schedule validation; UI weekly editor.
- QA finding: Overlap error arrives too late.
- Specification reference: §6A.5.
- Current behavior: RR checks `weeklySessionsOverlap`; linked plan also rejects collisions.
- Root cause: Server validation exists; precise client timing not reproduced.
- Resolution: Mirror existing overlap checks inline while retaining server authority and cross-clinic checks.
- Class: S.
- Priority: P1.
- Status: Pending — UI timing unverified.

### 19. Errors persist on Back
- Screen: Registration wizard.
- Component: UI `components/ClinicRegistrationWizard.tsx`, `ClinicRegistration.tsx`.
- QA finding: Same error remains after navigation.
- Specification reference: §6.1/4.
- Current behavior: Multi-step components exist; state sequence not exercised.
- Root cause: Not established.
- Resolution: Clear stale submission errors on step change/unmount; keep entered data and current relevant validation.
- Class: S.
- Priority: P1.
- Status: Not reproduced.

### 20. Raw HTTP error
- Screen: Forms/authentication.
- Component: R `ErrorNotice`; UI `auth/errors.ts`.
- QA finding: HTTP 401 Unauthorized shown.
- Specification reference: §7.8.
- Current behavior: Generic ErrorNotice prints `error.message`; auth has a separate translator.
- Root cause: Generic error presentation has no friendly boundary.
- Resolution: Central safe translation; field errors remain inline; never suppress real failure.
- Class: S.
- Priority: P1.
- Status: Pending — static exposure path; exact message unverified.

### 21. Selected clinic label lost
- Screen: Staff/doctor editor, provisional.
- Component: UI `components/ResourceLookup.tsx`, `relation-validity.ts`; U.
- QA finding: Selected clinic not displayed.
- Specification reference: §6.17.
- Current behavior: Lookup and relation-validity helpers exist.
- Root cause: Not established; cannot infer controlled-state fault without sequence.
- Resolution: Retain ID/label through paging, search, loading/error; reset only after authoritative invalidity.
- Class: F.
- Priority: P1.
- Status: Not reproduced.

### 22. Close target
- Screen: Dialogs.
- Component: D; UI `components/ui/dialog.tsx`, `app-dialog.css`.
- QA finding: Close icon too small.
- Specification reference: §7.6, §9.
- Current behavior: Shared Radix-based dialog exists; hit area not rendered/measured.
- Root cause: Visual target dimensions unverified.
- Resolution: Standard 44px close hit area, accessible name/focus, saving tooltip.
- Class: S.
- Priority: P2.
- Status: Pending — visual verification.

### 23. Doctor list slow
- Screen: Doctors.
- Component: U; LP `queryPage/documentSql`.
- QA finding: One doctor loads slowly.
- Specification reference: §6B, §8.23.
- Current behavior: Staff listing uses server pagination; SQL enriches doctors/assignments.
- Root cause: Not established without timing/query plan; do not label N+1 as proven.
- Resolution: Profile authorized isolated scenario, separate auth/network/query/render cost; preserve refresh content.
- Class: F.
- Priority: P1.
- Status: Not reproduced — performance baseline pending.

### 24. Schedule destination
- Screen: Doctor Schedule link.
- Component: UI `App.tsx`, `components/SchedulingWorkspace.tsx`.
- QA finding: Schedule opens wrong page.
- Specification reference: §8.24.
- Current behavior: Availability/exceptions workspace routes exist.
- Root cause: Intended destination cannot be established from text alone.
- Resolution: Map screenshot/link target and scope; fix route only after intended destination confirmed.
- Class: F.
- Priority: P1.
- Status: Not reproduced — needs clarification.

### 25. Self-booking portal notification
- Screen: Patient booking/portal.
- Component: C Booking/Dashboard; API `routes/appointments.ts`.
- QA finding: Booking not notified in portal.
- Specification reference: §8.25, §7.14.
- Current behavior: Appointment creation/listing and immediate ticket paths exist; dedicated in-app notification path not established.
- Root cause: Reported absent notification not reproduced.
- Resolution: Refresh patient booking state and reuse existing notice channel; propose persistence/schema if a new notification system is necessary.
- Class: F.
- Priority: P1.
- Status: Pending — channel/capability clarification.

### 26. Metric formula
- Screen: Dashboard/report metric, provisional.
- Component: C Dashboard/Reports; LP metrics; AV `sessionQueueWaitMinutes`.
- QA finding: Calculation unclear.
- Specification reference: §7.11.
- Current behavior: Queue-wait and actual consultation methodology text exists.
- Root cause: Exact screenshot metric unconfirmed; cannot assume it is average wait.
- Resolution: Map metric; keyboard-accessible formula tooltip consistent with current calculation.
- Class: S.
- Priority: P2.
- Status: Pending — screenshot clarification.

### 27. Screen design
- Screen: Unidentified screenshot.
- Component: UI `index.css`, `compact-workspace.css`.
- QA finding: Design not proper.
- Specification reference: §9.
- Current behavior: Multiple legacy sizes/colors coexist; exact affected screen unknown.
- Root cause: No specific rendered violation proven for this finding.
- Resolution: Identify screen and apply approved tokens/layout; do not invent missing JSON values.
- Class: S.
- Priority: P2.
- Status: Pending — needs screenshot mapping.

### 28. Cancellation cutoff
- Screen: Settings, booking and confirmation.
- Component: API `lib/reschedule.ts`, AR cancellation; C Booking.
- QA finding: Meaning/cutoff not shown while booking.
- Specification reference: §6.8/14, §8.28.
- Current behavior: Server computes minutes before session start using `cancellationCutoffMinutes`.
- Root cause: Business constraint exists; complete patient presentation not established.
- Resolution: Explain existing cutoff, display deadline/timezone on booking and confirmation; no rule change.
- Class: S.
- Priority: P1.
- Status: Pending — presentation gap review.

### 29. Cannot add doctor
- Screen: Staff > Doctors.
- Component: U UserEditor; RR staff creation.
- QA finding: Doctor creation blocked.
- Specification reference: §8.29.
- Current behavior: Creation includes ownership/assignment and invitation handling.
- Root cause: Not reproduced; no failing response/account scope captured.
- Resolution: Controlled reproduction; distinguish validation, ownership rejection, and saved-record/invitation partial success.
- Class: F.
- Priority: P0.
- Status: Not reproduced — high-priority verification.

### 30. Whitespace-only required fields
- Screen: All entry forms.
- Component: R Editor; U UserEditor.
- QA finding: Highlight without explanatory message.
- Specification reference: §6.4, §7.2–4.
- Current behavior: Required attributes and form validation exist; whitespace-only sequence untested.
- Root cause: Exact missing trim/error path not established.
- Resolution: Shared trimmed required validation, inline “This field is required”, focus and value preservation.
- Class: S.
- Priority: P1.
- Status: Pending — shared validation.

### 31. Full name
- Screen: Doctor/patient edit.
- Component: R person fields; U; UI `staff-input.ts`.
- QA finding: Full name not validated.
- Specification reference: §7.4; finding 6.
- Current behavior: Person fields shared at definition level, not a proven universal validator.
- Root cause: Invalid input sequence not reproduced.
- Resolution: Apply common name validator everywhere; preserve legitimate international names.
- Class: S.
- Priority: P1.
- Status: Pending.

### 32. Footer overlap
- Screen: Long editor dialog.
- Component: D; UI `components/app-dialog.css`.
- QA finding: Content overlaps buttons.
- Specification reference: §7.6.
- Current behavior: Shared dialog exists; reported viewport not exercised.
- Root cause: Rendered overflow/cascade cause unverified.
- Resolution: Fixed header/footer, body-only scrolling; desktop/mobile/200% zoom checks.
- Class: S.
- Priority: P1.
- Status: Not reproduced — visual QA pending.

### 33. Browser discard confirmation
- Screen: Dirty editor dialog.
- Component: D `handleOpenChange`.
- QA finding: Chrome confirmation instead of app dialog.
- Specification reference: §7.6.
- Current behavior: Explicit `window.confirm` when dirty.
- Root cause: Native confirmation is called by shared dialog.
- Resolution: Accessible DiscardChangesDialog; preserve focus/state; separate browser unload limitation.
- Class: S.
- Priority: P1.
- Status: Pending — static gap.

### 34. Doctor saved but invitation failed
- Screen: Doctors.
- Component: U; RR; API `lib/auth-email.ts`, `invitation-metadata.ts`.
- QA finding: Error despite added doctor and Delivery Failed.
- Specification reference: §8.34.
- Current behavior: Invitation status/password readiness are projected into doctor list by LP.
- Root cause: Exact save/delivery response sequence not reproduced; SMTP failure is not proof of record rollback.
- Resolution: One partial-success warning, “Invitation not sent” badge and Resend; no duplicate doctor creation on retry.
- Class: F.
- Priority: P0.
- Status: Not reproduced — partial-success contract review required.

### 35. Loading delay
- Screen: Reported staff/list screen, provisional.
- Component: U/R query/render paths.
- QA finding: Excessive loading.
- Specification reference: §7.10.
- Current behavior: Server list pagination exists.
- Root cause: Not established without timing.
- Resolution: Measure cold/refetch separately; skeleton first load, stable data during refresh; targeted optimization.
- Class: F/S.
- Priority: P1.
- Status: Not reproduced.

### 36. Confirmation appearance
- Screen: Staff operation, provisional.
- Component: U; UI `components/AdminListing.tsx`; D.
- QA finding: Confirmation should be in-app.
- Specification reference: §7.6.
- Current behavior: Native confirmation remains at least in shared dirty-close path.
- Root cause: Exact action's confirmation not mapped.
- Resolution: Shared ConfirmDialog with clear action and cancel.
- Class: S.
- Priority: P2.
- Status: Pending.

### 37. Doctor deactivation latency
- Screen: Doctors.
- Component: U; UI `components/admin-listing-data.ts:statusInput`.
- QA finding: Slow status update and poor design.
- Specification reference: §8.37.
- Current behavior: Status payload helper preserves relevant fields; latency unmeasured.
- Root cause: Not established.
- Resolution: Row-scoped pending status, optimistic visual update with rollback; maintain session revocation and server authority.
- Class: F/S.
- Priority: P1.
- Status: Not reproduced.

### 38. Revoke on inactive doctor
- Screen: Doctors.
- Component: U staff controls; UI `staff-controls.ts`.
- QA finding: Revoke enabled and feedback above list.
- Specification reference: §8.38.
- Current behavior: Staff operation helpers exist; exact inactive action sequence untested.
- Root cause: Not established.
- Resolution: Disable per specified status with tooltip; local/toast feedback without changing revocation access rules.
- Class: S/F.
- Priority: P1.
- Status: Not reproduced.

### 39. Revoke confirmation
- Screen: Doctors.
- Component: U; D.
- QA finding: Native confirmation.
- Specification reference: §7.6.
- Current behavior: Confirmation patterns are not yet unified.
- Root cause: Action-specific call not proven in this pass.
- Resolution: ConfirmDialog shared with single/bulk revoke, selected count and clear scope.
- Class: S.
- Priority: P2.
- Status: Pending.

### 40. Bulk revoke error
- Screen: Doctors bulk actions.
- Component: U; API `routes/resources.ts`.
- QA finding: Revoke multiple doctors errors.
- Specification reference: §8.40, §7.7/8.
- Current behavior: Native session revocation exists; no failing bulk request captured.
- Root cause: Not established; cannot presume obsolete provider call.
- Resolution: Reproduce mixed eligible/ineligible selection; consolidate results and preserve authorization.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 41. Single revoke error
- Screen: Doctors row action.
- Component: U; API `lib/native-auth.ts:revokeUserSessions`.
- QA finding: Same error for one doctor.
- Specification reference: §8.41.
- Current behavior: Workspace session ownership is native, not Clerk.
- Root cause: Not established; deployed JWT divergence may matter but is not a proven cause.
- Resolution: Trace exact action/response on authoritative build before changing any authentication behavior.
- Class: F.
- Priority: P0.
- Status: Not reproduced — auth-sensitive boundary.

### 42. Edit success feedback
- Screen: Staff edit.
- Component: U mutation callbacks.
- QA finding: No success message.
- Specification reference: §7.7.
- Current behavior: Feedback varies by action; no visual test.
- Root cause: Exact missing callback/toast not established.
- Resolution: Single “Updated successfully” toast only after confirmed update.
- Class: S.
- Priority: P2.
- Status: Pending.

### 43. Phone validation
- Screen: Staff/patient forms.
- Component: R telephone fields; UI `staff-input.ts`.
- QA finding: Inadequate international number accepted.
- Specification reference: §6.11, §7.4.
- Current behavior: Text/tel fields are used; no shared country selector at R definitions.
- Root cause: Browser `type=tel` alone cannot enforce country-code validity; reported input not reproduced.
- Resolution: Editable country suggestion, international digits validation, canonical storage, no assumed country from language alone.
- Class: S.
- Priority: P1.
- Status: Pending — control gap.

### 44. Delete dialog
- Screen: Resource lists.
- Component: R ResourcePage; D.
- QA finding: Confirmation design inconsistent.
- Specification reference: §7.6.
- Current behavior: Delete API generally deactivates (RR).
- Root cause: Presentation and operation semantics need alignment.
- Resolution: Danger ConfirmDialog with truthful deactivate wording; permanent deletion remains Q88.
- Class: S.
- Priority: P1.
- Status: Pending.

### 45. Deleted row remains
- Screen: Resource list; entity unconfirmed.
- Component: R list invalidation; RR delete handler.
- QA finding: Record remains after delete.
- Specification reference: §8.45; Q88.
- Current behavior: RR sets status inactive, so an unfiltered list can legitimately retain the row.
- Root cause: Cache failure not established; soft deactivation is an evidenced alternative explanation.
- Resolution: Reproduce filter state, reconcile row/status immediately; do not hard-delete to satisfy symptom.
- Class: F.
- Priority: P0.
- Status: Not reproduced — semantic dependency on 88.

### 46. Inactive doctor selector
- Screen: Booking/scheduling.
- Component: UI `components/CareLookup.tsx`; AV `doctorContext`.
- QA finding: Inactive doctors selectable.
- Specification reference: §8.46.
- Current behavior: Backend rejects inactive doctor/account/clinic/location; selector behavior not reproduced.
- Root cause: Not established.
- Resolution: Filter/disable inactive selection options while preserving historical display and management status filter.
- Class: F.
- Priority: P1.
- Status: Not reproduced.

### 47. Dependent doctor reset
- Screen: Booking/schedule editor.
- Component: R RelationInput; UI `components/relation-validity.ts`.
- QA finding: Selecting Clinic removes doctor and reloads.
- Specification reference: §6.17.
- Current behavior: Dependency-validity helper exists; race sequence not exercised.
- Root cause: Not established.
- Resolution: Retain doctor until authoritative membership rejects it; retain labels during loading/error.
- Class: S/F.
- Priority: P1.
- Status: Not reproduced.

### 48. Blank-area checkbox toggle
- Screen: Editor selection, provisional.
- Component: R Editor; UI select/multiselect.
- QA finding: Blank click changes checkbox.
- Specification reference: §8.48.
- Current behavior: Exact clickable wrapper not identified.
- Root cause: Not established; label bubbling is only a hypothesis.
- Resolution: Limit toggle surface to intended checkbox/associated label, verify pointer and Space behavior.
- Class: S.
- Priority: P2.
- Status: Not reproduced — screenshot needed.

### 49. Validation at top
- Screen: Generic editor.
- Component: R Editor/ErrorNotice.
- QA finding: Field errors only above form.
- Specification reference: §7.2/3.
- Current behavior: Generic form-level ErrorNotice prints messages; per-field coverage not complete by audit.
- Root cause: Error translation/field binding is not a universal shared contract.
- Resolution: Map validation paths to fields; summary reserved for form errors.
- Class: S.
- Priority: P1.
- Status: Pending.

### 50. Save changes toast
- Screen: Resource edit.
- Component: R ResourcePage.
- QA finding: No success feedback.
- Specification reference: §7.7.
- Current behavior: No end-to-end toast observation.
- Root cause: Not established.
- Resolution: Standard success toast after mutation completion, including inline editors.
- Class: S.
- Priority: P2.
- Status: Pending.

### 51. Unexplained item
- Screen: Unknown screenshot.
- Component: UI `components/HelpTip.tsx` candidate.
- QA finding: Meaning unclear.
- Specification reference: §6.8, §7.11.
- Current behavior: Shared HelpTip exists; target term is unknown.
- Root cause: Cannot identify from text alone.
- Resolution: Confirm screenshot target; describe actual current behavior, not intended future policy.
- Class: S.
- Priority: P2.
- Status: Needs clarification.

### 52. Check-in after closing
- Screen: Queue/check-in.
- Component: AR `transition`; AV availability.
- QA finding: Check-in permitted after 2 PM closing.
- Specification reference: §6A, §8.52.
- Current behavior: Transition checks appointment date, active context, presence/order and session concurrency; it does not reuse booking closing-time validation. Check-in starts consultation.
- Root cause: Distinct booking-availability and queue-transition rules, not necessarily a defect.
- Resolution: Propose booked-patient-only extension under explicitly approved exception policy; explain current behavior first.
- Class: Q.
- Priority: P1.
- Status: HOLD — decision required.

### 53. Friday missing session
- Screen: Booking/session picker.
- Component: AV `availabilitySessions`; UI `components/queue/SessionSelector.tsx`.
- QA finding: Open Friday has no session.
- Specification reference: §6A; booking-readiness memory.
- Current behavior: Only active doctor schedules for exact weekday generate sessions; clinic hours alone are insufficient.
- Root cause: Not established; missing doctor setup is a possibility, not a proven bug.
- Resolution: Compare location hours, doctor templates, exception and timezone; explicit owner setup, never infer capacity.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 54. Unexpected Saturday session
- Screen: Session picker.
- Component: AV; QAPI `/session-contexts`.
- QA finding: Saturday session shown despite no session.
- Specification reference: §6A.
- Current behavior: Operational contexts retain snapshot-only sessions from existing appointments; booking generator uses weekday schedules.
- Root cause: Not established; historical queue context must not be mistaken for bookable availability.
- Resolution: Reproduce with picker type; preserve history, exclude invalid booking choices and clarify saved-session labels.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 55. Centered container
- Screen: Confirmation/empty box, provisional.
- Component: C; UI `index.css`.
- QA finding: Centered text but misaligned box.
- Specification reference: §9 layout.
- Current behavior: Exact box/viewport unknown.
- Root cause: Not established.
- Resolution: Center intended container within approved layout without changing ticket dimensions.
- Class: S.
- Priority: P3.
- Status: Needs screenshot clarification.

### 56. Patient active/inactive
- Screen: Patients.
- Component: R patients; RR status/deletion; API booking routes.
- QA finding: Status meaning unclear.
- Specification reference: §6.8.
- Current behavior: Patient status is stored; deletion sets inactive. Do not describe it as account deletion.
- Root cause: Insufficient contextual explanation; complete downstream effect requires traced booking authorization.
- Resolution: Help text distinguishing record availability from historical retention and account authentication.
- Class: S.
- Priority: P1.
- Status: Pending — final wording depends on verified effects.

### 57. Inactive patient booking
- Screen: Staff booking.
- Component: C Booking; UI `components/ResourceLookup.tsx`; API `routes/appointments.ts`.
- QA finding: Inactive patient selectable.
- Specification reference: §8.57.
- Current behavior: Booking has a patient relation; failing inactive selection not exercised.
- Root cause: Not established.
- Resolution: Active-only/disabled selector with reason, preserve historical appointments, verify server behavior without changing access policy.
- Class: F.
- Priority: P1.
- Status: Not reproduced.

### 58. Consent link and reception
- Screen: Patient registration/booking.
- Component: C Booking/Onboarding; UI `components/GuestBooking.tsx`.
- QA finding: Consent text lacks link and reception rationale.
- Specification reference: §8.58.
- Current behavior: Multiple guest/patient/staff entry paths; legal consent contract not established by this pass.
- Root cause: Product/legal policy uncertainty, not a proven implementation cause.
- Resolution: Review exact consent statement, subject, capture/audit fields and approved policy URL; separate staff acknowledgement from patient consent.
- Class: Q.
- Priority: P1.
- Status: HOLD — product/legal decision.

### 59. All Visits count
- Screen: Appointments.
- Component: C Appointments; LP `queryAppointmentPage`.
- QA finding: Two of four visible under All Visits.
- Specification reference: §6B.
- Current behavior: “All” removes implicit upcoming/past bounds; other filters/session scope and page remain relevant. Status counts share base matching SQL.
- Root cause: Not reproduced; no four-row fixture/filter state inspected.
- Resolution: Reproduce exact scope, show active chips, reconcile count and paged rows without broadening authorized access.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 60. Visit notes hidden
- Screen: Appointment details/queue.
- Component: UI `components/appointments/AppointmentRows.tsx`, `queue/SessionQueue.tsx`; booking inputs.
- QA finding: Collected notes not displayed.
- Specification reference: §8.60.
- Current behavior: Action/detail rendering needs end-to-end field trace; no note payload inspected.
- Root cause: Lost-at-storage versus missing-render distinction not established.
- Resolution: Trace field through API, show truncated notes with accessible full detail; avoid leaking notes to public display.
- Class: F.
- Priority: P1.
- Status: Not reproduced.

### 61. Missing patient Deepa
- Screen: Patient picker/list, provisional.
- Component: LP scoped resource query; R patients.
- QA finding: Expected patient absent.
- Specification reference: §8.61.
- Current behavior: Lists are role/clinic scoped and paginated.
- Root cause: Not established; no account/record lookup performed.
- Resolution: Authorized fixture reproduction with filters/status/pages; never remove ownership boundaries to expose a record.
- Class: F.
- Priority: P1.
- Status: Not reproduced — record/scope evidence needed.

### 62. Future date of birth
- Screen: Patient registration/edit/booking.
- Component: R person DOB; ZOD dateOfBirth.
- QA finding: Future DOB accepted.
- Specification reference: §6.9.
- Current behavior: Generic DOB uses date input; generated schemas include coerced dates without an evident shared future-date rule.
- Root cause: Generic date control is not a DOB validator; exact route acceptance untested.
- Resolution: Shared calendar-date DOB check and inline error, client and server presentation contract.
- Class: S.
- Priority: P1.
- Status: Pending — static validation gap candidate.

### 63. Age auto-calculation
- Screen: Patient edit.
- Component: R patients fields.
- QA finding: Age should derive from DOB.
- Specification reference: §6.9.
- Current behavior: `age` is an independent number field alongside DOB.
- Root cause: Resource definition treats age as editable rather than derived.
- Resolution: Read-only calendar-based age; clarify fallback for age-only legacy patients without inventing DOB.
- Class: S.
- Priority: P1.
- Status: Pending — static gap.

### 64. Optional sign-in
- Screen: Public booking.
- Component: C PublicBooking; UI `components/GuestBooking.tsx`.
- QA finding: Why sign in when direct booking works?
- Specification reference: §8.64; patient booking memory.
- Current behavior: Anonymous Book Now issues ticket; “Already have an account?” and “Sign in to book” coexist.
- Root cause: Two legitimate paths, with optionality imperfectly expressed.
- Resolution: Recommend “Already have an account? Sign in”; retain immediate guest booking and optional contacts.
- Class: Q.
- Priority: P2.
- Status: HOLD — copy proposal; no workflow change.

### 65. Reset service unavailable
- Screen: Forgot/reset password.
- Component: UI `auth/PasswordFlows.tsx`; API `routes/auth.ts`, `lib/auth-email.ts`.
- QA finding: Service unavailable.
- Specification reference: §8.65; native-auth memory.
- Current behavior: Email sender distinguishes unconfigured SMTP and transport failure.
- Root cause: Actual reset failure not established; UAT code may diverge.
- Resolution: Trace endpoint/provider safely, show friendly failure; preserve IP/token protections and SMTP-independent staff login.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 66. Appointment message/email
- Screen: Patient appointment confirmation.
- Component: API `routes/appointments.ts`, `routes/public.ts`; API `lib/auth-email.ts`.
- QA finding: No email/message after booking.
- Specification reference: §7.14, §5.
- Current behavior: Immediate ticket path exists; appointment delivery integration not established in inspected creation routes.
- Root cause: No demonstrated delivery attempt/failure; cannot blame SMTP without evidence.
- Resolution: Trace existing configured channel, distinguish optional guest contact; proposal required if new transport/storage infrastructure is needed.
- Class: F.
- Priority: P0.
- Status: Not reproduced — channel boundary unresolved.

### 67. Clinic selection save error
- Screen: Patient edit, provisional.
- Component: R patients/RelationInput; RR.
- QA finding: Save fails after selecting Clinic.
- Specification reference: §8.67.
- Current behavior: Patient has clinicId/branchId fields and scoped write validation.
- Root cause: No failing payload/response captured.
- Resolution: Reproduce dependency/scoping issue and translate validation inline; preserve ownership rules.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 68. Patient delete
- Screen: Patients.
- Component: RR generic delete; R.
- QA finding: Delete does not delete.
- Specification reference: §8.68/88.
- Current behavior: Generic resource deletion sets inactive.
- Root cause: Hard deletion is not current workflow; separate stale state is unproven.
- Resolution: Truthful deactivate feedback and row refresh; hard deletion policy held under 88.
- Class: F.
- Priority: P0.
- Status: Pending — functional interpretation blocked by Q88.

### 69. Check-in at two Clinics
- Screen: Queue/check-in across locations.
- Component: AR transition; QAPI; RR schedule collision checks.
- QA finding: Same doctor/day can check in at both Clinics.
- Specification reference: §8.69.
- Current behavior: Active-consultation check in AR is scoped to session rows; weekly schedule validation separately rejects overlaps.
- Root cause: Session-scoped transition invariant differs from doctor-global clinical concurrency; live case unverified.
- Resolution: Decide doctor-global concurrent consultation policy and emergency/late-running exceptions before enforcement.
- Class: Q.
- Priority: P0.
- Status: HOLD — rule decision.

### 70. Current-time session default
- Screen: Queue.
- Component: UI `components/queue/session-scope.ts`, `SessionSelector.tsx`.
- QA finding: Session should auto-select by time.
- Specification reference: §8.70.
- Current behavior: `resolveSessionContext` resolves explicit initial match or a sole session, not current-time match.
- Root cause: Resolver has no time-based selection branch.
- Resolution: Select unique time-matching valid session when no explicit selection; retain deliberate choice and saved context; ask on ambiguity.
- Class: F.
- Priority: P1.
- Status: Pending — static gap.

### 71. Current Schedule labels
- Screen: Operational session picker.
- Component: UI `components/queue/SessionSelector.tsx`.
- QA finding: Both options say Current Schedule.
- Specification reference: §8.71.
- Current behavior: Every non-snapshot context gets “Current schedule”.
- Root cause: Label denotes live template versus saved snapshot, not time-current session.
- Resolution: Distinguish scheduled session, currently running, upcoming/past and saved appointment session using actual context.
- Class: F.
- Priority: P1.
- Status: Pending — static gap.

### 72. Back navigation
- Screen: Nested schedule/detail route, provisional.
- Component: UI `components/WorkspaceNav.tsx`, `SchedulingWorkspace.tsx`.
- QA finding: No way back to list.
- Specification reference: §7.13.
- Current behavior: Workspace navigation exists; exact missing nested back link unconfirmed.
- Root cause: Not established.
- Resolution: PageHeader breadcrumb/Back preserving list filters and page.
- Class: S.
- Priority: P2.
- Status: Pending — screenshot mapping.

### 73. Ticket filename
- Screen: Ticket download.
- Component: UI `components/appointments/AppointmentTicket.tsx`, `components/tickets/VisitTicket.tsx`.
- QA finding: Filename must read DigiQ.
- Specification reference: §8.73; KEEP_CURRENT print geometry.
- Current behavior: Ticket/export components exist; downloaded filename not exercised.
- Root cause: Exact offending filename literal not established.
- Resolution: Audit all ticket single/bulk downloads; DigiQ safe filename only, no layout/QR changes.
- Class: F.
- Priority: P2.
- Status: Pending — filename verification.

### 74. Invisible button label
- Screen: Queue/ticket action, provisional.
- Component: UI `components/appointments/AppointmentRows.tsx`, UI CSS.
- QA finding: Button name missing.
- Specification reference: §9, §7.10.
- Current behavior: Exact action/viewport unknown.
- Root cause: Cannot distinguish icon-only intent from contrast/clipping without screenshot.
- Resolution: Visible action label plus accessible name; approved token contrast.
- Class: S.
- Priority: P1.
- Status: Needs clarification.

### 75. Waiting reschedule blocked
- Screen: Appointment reschedule.
- Component: API `lib/reschedule.ts`.
- QA finding: Waiting/awaiting-consultation cannot reschedule.
- Specification reference: §8.75.
- Current behavior: Allows booked/checkedIn/waiting/called only when no `checkedInAt`, before cutoff and within same parent clinic; availability/scope/revision checks remain.
- Root cause: Status label alone does not determine eligibility; failing constraint unknown.
- Resolution: Friendly specific reason, explain existing eligibility; relaxing check-in/cutoff/location policy requires approval.
- Class: Q.
- Priority: P1.
- Status: HOLD — rule/copy review.

### 76. Sunday-only doctor
- Screen: Schedule/booking.
- Component: DB weekday check; AV; R dayOfWeek.
- QA finding: Cannot make entry.
- Specification reference: §6A.
- Current behavior: Schema accepts 0–6; AV uses UTC-noon `getUTCDay()`; Sunday 0 is supported.
- Root cause: No evidence Sunday is unsupported; falsy-zero client bug remains hypothesis only.
- Resolution: Reproduce Sunday create/edit/book with explicit doctor capacity/session; preserve numeric 0.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 77. Load delay
- Screen: Queue/list, provisional.
- Component: UI `components/queue/SessionQueue.tsx`; QAPI.
- QA finding: Slow load.
- Specification reference: §7.10.
- Current behavior: Queue fetch scopes rows then filters/slices server-side; polling/freshness logic exists.
- Root cause: No timing evidence; in-memory server slicing is a scalability risk, not measured cause.
- Resolution: Profile and optimize query/serialization without weakening coherent queue snapshots.
- Class: F/S.
- Priority: P1.
- Status: Not reproduced.

### 78. Unclear section
- Screen: Unknown screenshot.
- Component: Shared heading/HelpTip candidate.
- QA finding: Section purpose unclear.
- Specification reference: §6.8.
- Current behavior: Target cannot be identified from text.
- Root cause: Not established.
- Resolution: Identify section then add concise heading/help reflecting current semantics.
- Class: S.
- Priority: P2.
- Status: Needs clarification.

### 79. Bulk result spam
- Screen: Bulk staff/appointments.
- Component: UI `components/AdminListing.tsx`, `appointments/BulkAppointments.tsx`; U.
- QA finding: Multiple result messages.
- Specification reference: §7.7, §6B bulk selection.
- Current behavior: Multiple bulk consumers; exact duplicate message sequence not exercised.
- Root cause: Not established.
- Resolution: One aggregate success/warning with succeeded/failed/skipped counts and failure detail; no false all-success.
- Class: S.
- Priority: P1.
- Status: Pending.

### 80. Call Next latency
- Screen: Queue.
- Component: QAPI call-next; UI `components/queue/SessionQueue.tsx`.
- QA finding: Calling state takes too long.
- Specification reference: §8.80.
- Current behavior: Server locks session and rejects competing called/in-consultation patient.
- Root cause: Latency not measured; lock contention not established.
- Resolution: Immediate pending visual state and guarded optimistic preview; reconcile authoritative result, rollback, prevent duplicate write/replay.
- Class: F.
- Priority: P0.
- Status: Not reproduced — preserve concurrency safeguards.

### 81. Busy dialog cannot close
- Screen: Saving dialogs.
- Component: D.
- QA finding: Cannot close during loading.
- Specification reference: §3 decision, §7.6.
- Current behavior: `busy` explicitly prevents close, Escape and outside dismissal.
- Root cause: Intended save-protection rule; presentation fails to explain it consistently.
- Resolution: Keep guard; spinner/“Saving…”, disabled close with “Saving in progress”; release on success/failure.
- Class: S.
- Priority: P1.
- Status: Pending — preserve behavior.

### 82. Blank fields fail save
- Screen: Schedule/settings editor, provisional.
- Component: R Editor; ZOD.
- QA finding: Blank values appear optional but save errors.
- Specification reference: §6.3/4.
- Current behavior: Required metadata varies by generic field definition; target fields unknown.
- Root cause: Not established.
- Resolution: Align required markers/helper/errors with server input contract; do not invent defaults for capacity.
- Class: S.
- Priority: P1.
- Status: Needs field/screenshot clarification.

### 83. Max Token bounds
- Screen: Schedule editor.
- Component: R maxTokens; ZOD schedule inputs.
- QA finding: Length/range unbounded.
- Specification reference: §6.14.
- Current behavior: Generic schedule schema has integer minimum 1, no maximum; linked onboarding has a separate bounded contract.
- Root cause: Numeric contracts differ; text length is not a numeric bound.
- Resolution: Expose existing min/max where present; propose missing generic upper bound rather than inventing a scheduling limit.
- Class: S.
- Priority: P1.
- Status: Pending — new maximum needs decision.

### 84. Buffer Minutes bounds
- Screen: Schedule editor.
- Component: R bufferMinutes; ZOD schedule inputs.
- QA finding: Length/range not fixed.
- Specification reference: §6.14.
- Current behavior: Integer minimum/default exists in generated schedule schema; no generic maximum evident.
- Root cause: Missing shared input/unit/range presentation; upper policy is unspecified.
- Resolution: Integer/min/unit/helper validation; approve any new maximum first.
- Class: S.
- Priority: P1.
- Status: Pending — limit clarification.

### 85. Grouping/filter bug
- Screen: Reports.
- Component: C Reports; API `routes/reporting.ts`.
- QA finding: Filter fails grouped by Doctor/Clinic.
- Specification reference: §6B, §8.85.
- Current behavior: Query params include groupBy, clinic/branch/doctor/date/session and pagination.
- Root cause: Not reproduced; no mismatching request/result captured.
- Resolution: Deterministic grouped fixture, compare table/count/export predicates, preserve scope.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 86. Status total mismatch
- Screen: Reports.
- Component: C Reports; LP `metricSql`.
- QA finding: Thirteen total but only eleven explained.
- Specification reference: §8.86.
- Current behavior: Reports render completed/cancelled/no-show but not every active status alongside total.
- Root cause: Outcome presentation is incomplete; exact two records not inspected.
- Resolution: Display every status or explicit Other bucket, reconcile grouped totals and exports.
- Class: F.
- Priority: P0.
- Status: Pending — static presentation gap.

### 87. Address suggestions absent
- Screen: Clinic/address entry.
- Component: R `MasterTextInput`; UI `components/SuggestionInput.tsx`.
- QA finding: Message but no searchable list.
- Specification reference: §6.12.
- Current behavior: Suggestions come from active masters by category/search; free-text fallback explicitly exists.
- Root cause: No evidence of a missing geocoding key; catalog emptiness/request failure unverified.
- Resolution: Explain catalog/manual entry, show retry for errors; external geocoder is a separate provider proposal if desired.
- Class: F.
- Priority: P1.
- Status: Not reproduced — source identified.

### 88. Delete versus deactivate
- Screen: Resource lists.
- Component: RR DELETE loop.
- QA finding: Delete sets inactive.
- Specification reference: §8.88.
- Current behavior: Handler updates status inactive; doctor handling also may deactivate linked non-owner account.
- Root cause: Deliberate soft-deactivation path, not evidence of failed deletion.
- Resolution: Recommend deactivate for clinical/staff history; any hard-delete/retention/purge per entity requires explicit policy.
- Class: Q.
- Priority: P1.
- Status: HOLD — wording safe, behavior unchanged.

### 89. Slow doctors
- Screen: Doctors/picker.
- Component: U; UI `components/CareLookup.tsx`; LP.
- QA finding: Excessive doctor load.
- Specification reference: §8.23/89.
- Current behavior: Shared paginated queries exist; target full list versus dropdown uncertain.
- Root cause: Not established.
- Resolution: Separate picker/list traces, profile with actual scoped volume; no blind indexes or access-rule shortcuts.
- Class: F.
- Priority: P1.
- Status: Not reproduced.

### 90. Family booking
- Screen: Patient booking/account.
- Component: Proposed family-member selector/details.
- QA finding: Book for family member.
- Specification reference: §2 P, §8.90.
- Current behavior: No approved family relationship workflow established.
- Root cause: New capability, not a defect.
- Resolution: Proposal: member selector and proxy consent; relationship/access/audit data, guardian/duplicate rules; medium-large effort (5–10 days design/build plus security QA).
- Class: P.
- Priority: P2.
- Status: HOLD — proposal only.

### 91. Receptionist creation
- Screen: Staff.
- Component: U `staffTypes`; R users roles.
- QA finding: Only doctor can be added.
- Specification reference: §8.91; ownership memory.
- Current behavior: Clinic Admins, Doctors and Receptionists tabs exist; receptionist role is supported.
- Root cause: Role visibility/UAT drift or discoverability unverified; not a missing-role feature.
- Resolution: Verify role-scoped tab/access; clarify create entry point, never broaden managing-admin ownership.
- Class: Q.
- Priority: P1.
- Status: HOLD — investigate visibility, no new role.

### 92. Forgot password
- Screen: Forgot password.
- Component: UI `auth/PasswordFlows.tsx`; API `routes/auth.ts`.
- QA finding: Recovery should work.
- Specification reference: §8.92; checklist 119–125.
- Current behavior: Native recovery exists; UI uses non-enumerating confirmation.
- Root cause: Delivery/transport/token failure not established.
- Resolution: Controlled full recovery verification on authoritative implementation; no per-account recovery cap or Clerk fallback.
- Class: F.
- Priority: P0.
- Status: Not reproduced.

### 93. Try later/emergencies
- Screen: Rate-limit/recovery/booking message, exact target unconfirmed.
- Component: API `lib/native-auth.ts` limiter; auth error presentation.
- QA finding: Wait time and emergency path unclear.
- Specification reference: §8.93.
- Current behavior: Limits exist; applicable retry metadata for reported response unverified.
- Root cause: No captured endpoint/response.
- Resolution: Display actual available retry duration, not invented time; propose clinic contact/emergency guidance, not a security bypass.
- Class: Q.
- Priority: P1.
- Status: HOLD — target/policy clarification.

### 94. Check-in time display
- Screen: Appointments/queue details.
- Component: AR checkedInAt; UI `components/appointments/AppointmentRows.tsx`.
- QA finding: Missing check-in timestamp.
- Specification reference: §5, §8.94.
- Current behavior: Transition stores `checkedInAt` and `consultationStartedAt` together.
- Root cause: Data exists; display coverage incomplete/unverified.
- Resolution: Add formatted field/column, truthfully identify consultation check-in rather than physical arrival.
- Class: S.
- Priority: P1.
- Status: Pending.

### 95. Absent next-called patient
- Screen: Queue.
- Component: AR transition; QAPI call-next.
- QA finding: Next waiting patient not Called Next after absent.
- Specification reference: §8.95; §2 scheduling/queue hold.
- Current behavior: AR auto-next branch is conditioned on complete, not noShow.
- Root cause: Current transition implementation does not auto-call after absence; intended rule needs reconciliation.
- Resolution: Refresh next candidate immediately; before adding an automatic clinical transition, confirm whether “shown next” means candidate display or auto-call. Keep locks/revision checks.
- Class: F.
- Priority: P0.
- Status: Pending — rule ambiguity escalated, no behavior change.

### 96. Completed ticket action
- Screen: Appointment actions.
- Component: UI `components/appointments/AppointmentRows.tsx`, `AppointmentTicket.tsx`.
- QA finding: Ticket action unhelpful for completed visits.
- Specification reference: §8.96.
- Current behavior: Ticket functionality is shared; completed-state visibility not visually tested.
- Root cause: Exact action gating not established.
- Resolution: Hide completed appointment ticket action per finding; retain history and print layout.
- Class: F.
- Priority: P2.
- Status: Pending — state verification.

### 97. Copy schedule days
- Screen: Weekly editor.
- Component: UI `components/schedule/copy-plan.ts`, `WeeklyOverview.tsx`.
- QA finding: Copy for all missing.
- Specification reference: §6A.6/10.
- Current behavior: Copy-planning infrastructure exists; uniform editor actions not established.
- Root cause: Shared presentation gap, not absence of all copy support.
- Resolution: Copy to all/selected days with preview and overlap checks; never copy dated exceptions or overwrite protected bookings silently.
- Class: S.
- Priority: P1.
- Status: Pending.

### 98. Doctor at multiple Clinics
- Screen: Assignments/scheduling.
- Component: DB assignments/schedules; RR; API `lib/clinical-membership.ts`.
- QA finding: Doctor can visit multiple Clinics.
- Specification reference: §6A.6, §8.98; ownership memory.
- Current behavior: Multi-location assignments/schedules supported; cross-location weekly overlap checks exist.
- Root cause: Product question, not absent schema capability.
- Resolution: Keep one owning admin and actual assigned clinical scope; review DST/cross-location exception conflicts before changes.
- Class: Q.
- Priority: P1.
- Status: HOLD — no ownership/rule expansion.

### 99. Review/preview/apply labels
- Screen: Linked schedule/settings.
- Component: UI `components/LinkedScheduleControls.tsx`, `ClinicSettings.tsx`; API `lib/linked-schedules.ts`.
- QA finding: Review step naming inconsistent.
- Specification reference: §8.99.
- Current behavior: Linked changes use preview/apply protections for booked history/exceptions.
- Root cause: Multiple labels represent protected staged operations; extra-step necessity not evaluated in UI.
- Resolution: Consistent sentence-case copy; merging steps proposed only, preserve concurrency/impact review.
- Class: Q.
- Priority: P2.
- Status: HOLD — label-only cleanup eligible later.

### 100. Branch spelling/term
- Screen: All location references.
- Component: R branch resource; C; UI `components/ClinicSettings.tsx`.
- QA finding: Misspelling and inconsistent location term.
- Specification reference: §3, §4.
- Current behavior: User-facing branch terms remain alongside Clinic.
- Root cause: Internal entity terminology leaks into generated labels/messages.
- Resolution: Clinic for location, Clinic Group recommended for parent; no internal identifier rename needed.
- Class: S.
- Priority: P2.
- Status: Pending — exact misspelling not located.

### 101. Explain Clinic/location
- Screen: Onboarding/settings.
- Component: R; UI `components/ClinicRegistrationWizard.tsx`.
- QA finding: Purpose of branch unclear.
- Specification reference: §6.8, §4.
- Current behavior: Parent clinics and branches are distinct data entities.
- Root cause: UI naming does not consistently explain hierarchy.
- Resolution: Help text: a Clinic is a physical care location in its parent group, retaining own timezone/hours.
- Class: S.
- Priority: P2.
- Status: Pending.

### 102. Credentials for entity
- Screen: Unknown screenshot, possibly Clinic/staff.
- Component: U; API `routes/auth.ts`.
- QA finding: No option to set its credentials.
- Specification reference: §8.102.
- Current behavior: Native credentials belong to users; staff invitation/setup flow exists, not a shared Clinic login.
- Root cause: Entity meant by “its” unconfirmed.
- Resolution: Identify entity; prefer named staff invitations, not shared clinic credentials; auth behavior changes require approval.
- Class: Q.
- Priority: P1.
- Status: HOLD — needs screenshot clarification.

### 103. Doctor filter
- Screen: Relevant listings, exact reported table unconfirmed.
- Component: C Appointments/Reports; R filters; QAPI.
- QA finding: Add Doctor filter.
- Specification reference: §6B.
- Current behavior: Appointments/Reports already send doctorId; generic listing coverage varies.
- Root cause: Not a universally absent capability.
- Resolution: Expose role-appropriate Doctor filter where meaningful; preserve doctor self-scope and active chips.
- Class: S.
- Priority: P1.
- Status: Pending — per-list coverage review.

### 104. Status-change notifications
- Screen: Status edit, entity unconfirmed.
- Component: RR status update/session revocation; U/R.
- QA finding: Whom should user inform?
- Specification reference: §8.104.
- Current behavior: Deactivation can revoke native sessions; no universal stakeholder notification contract established.
- Root cause: Unspecified communication policy.
- Resolution: Explain verified effects per entity; propose recipients/channels/trigger policy, not automatic new notification infrastructure.
- Class: Q.
- Priority: P1.
- Status: HOLD — product decision.

### 105. Wasted layout space
- Screen: Listing/create section, provisional.
- Component: R ResourcePage; C page headings.
- QA finding: Section takes too much space.
- Specification reference: §7.13, §9.
- Current behavior: Listing/header patterns vary; exact screenshot not mapped.
- Root cause: Not established visually.
- Resolution: Primary create action in PageHeader, full-width list, retain discoverability/mobile stacking.
- Class: S.
- Priority: P3.
- Status: Pending — screenshot clarification.

### 106. Optional mobile verification
- Screen: Patient list/profile.
- Component: R patients `mobileVerified`; C Booking; API `routes/otp.ts`.
- QA finding: “Mobile verified: No” but no way to verify.
- Specification reference: §8.106.
- Current behavior: MobileVerified column exists; conditional mobile prerequisite and OTP request/verify path exist when clinic requires it.
- Root cause: Global negative badge can mislead where optional/provider unavailable; not proof no verification exists.
- Resolution: Hide/qualify optional negative field, disclose requirement only where configured; no new OTP provider or mandatory verification.
- Class: Q.
- Priority: P2.
- Status: HOLD — presentation decision.

### 107. Reason not shown
- Screen: Appointment action detail/history, provisional.
- Component: AR transition history; API `lib/reschedule.ts`; UI `components/appointments/AppointmentRows.tsx`.
- QA finding: Entered reason disappears from views.
- Specification reference: §8.107.
- Current behavior: Transition/reschedule reasons are stored in embedded history; generic date exceptions already have reason column.
- Root cause: A blanket “not stored” conclusion is false; exact missing rendering path unconfirmed.
- Resolution: Identify reason type; render appropriate latest reason/detail history with privacy-aware list truncation.
- Class: F.
- Priority: P1.
- Status: Pending — storage evidence found, display reproduction needed.

## 1. Shared components standardized

**None changed in Phase 1.** Existing assets to refactor, not duplicate:

- PasswordInput/common validation: consolidate StaffLogin, PasswordFlows, registration, profile/change-password and confirmation paths.
- FormField/validation: R Editor, U UserEditor, `components/ui/form.tsx`; common trim, described errors and first-invalid focus.
- Select/MultiSelect/Combobox: `SearchableSelect.tsx`, `SearchableMultiSelect.tsx`, `ResourceLookup.tsx`, `CareLookup.tsx`, `SuggestionInput.tsx`; retain current ID resolution and authorization.
- Dialog: AppDialog + Radix primitives; replace `window.confirm` and C logout `window.alert`; shared Confirm/Discard UI, busy tooltip, scroll-body/sticky-footer.
- Feedback: `hooks/use-toast.ts`, Sonner/toast primitives exist; unify consumers, friendly ErrorNotice replacement, bulk partial-success contract, LoadingButton.
- Listings: ListingControls, AdminListing, R ResourcePage, U and appointment/queue bespoke tables; converge through shared toolbar/pagination/table rather than replacing working query scopes.
- HelpTip/tooltip, skeleton, empty state and PageHeader: standardize semantics, keyboard behavior and consistent empty/no-results distinction.
- DateTimeFormatter/Parser: existing `lib/date-time.ts` is timestamp-only and locale-driven; extend with approved preference-aware calendar/clock/instant APIs.
- Branded email: auth sender currently plain-text only; add HTML alongside text without adding channels.
- ScheduleEditor/SessionRow/TimeRangeSlider: reuse weekly/copy/linked infrastructure. ExceptionDialog must not expose a bypass of existing containment rules.

## 2. Design system violations found

- UI `index.css` includes legacy literal font sizes (8/9/10/11/18/26/27px etc.), spacing, green-toned borders, auth-card 34px padding, and public hero sizes beyond §9. Later CSS may override some; computed violations need render verification.
- UI `components/SuggestionInput.tsx` uses slate utilities/radius choices outside a proven approved token mapping; inspect cascade rather than replacing with invented alternatives.
- L offers 10/20/50/100 while §3 calls for 10/25/50/100 and preservation of existing default. Existing default 20 should remain unless user resolves the mismatch: recommend retaining 20 as legacy selectable/default alongside required choices, not silently switching default.
- R ErrorNotice exposes arbitrary messages; D uses native confirmation. Both are evidenced shared foundation gaps.
- R timezone/age definitions are generic text/number instead of dedicated standardized controls.
- Branding must cover emails, public demo text, QR/ticket/export filenames and document titles; C explicitly contains user-visible “ClinicFlow DEMO Clinic”. Preserve compatibility comparisons separately from displayed brand.
- Prompt is approved source per memory. Referenced semantic/border/status mappings not fully enumerated in prompt: do not invent a new palette or silently treat older attachment JSON as overriding. Obtain missing values or identify existing approved mapping.
- KEEP_CURRENT tickets/QR geometry overrides blanket typography/layout normalization. Public-page typography exception is not assumed approved; flag before changing marketing hierarchy.

## 3. Layout improvements

Pending only: workspace maximum 1540px, sidebar 245px, page/card padding 24/20px; two-column related form fields, one column below 640px; page-level overflow prevention; sticky right actions; labeled mobile table cards. Reuse existing responsive rules but audit CSS precedence. Long forms need fixed dialog header/footer with body-only scrolling. Move primary create actions into headers (105) only after screenshot target mapping. Printed tickets remain physically unchanged.

## 4. UX improvements

Pending: consistent titled steppers/progress, Back/Next retaining input, error reset without data loss (19), inline trimmed validation, review/Edit summary and completion actions. Preserve atomic Clinic Admin + first-clinic onboarding and single-account consulting owner capability. Registration success is not booking readiness: linked owner doctor sessions require explicit capacity/duration; never backfill doctor sessions from location hours silently.

Use browser timezone as an editable suggestion, searchable timezone offsets, international phone selector/validator, master-backed address suggestions with manual fallback, derived DOB age, optional secondary patient details, and numeric units/existing constraints. Add tooltips for cutoff/duration/buffer/token/status/settings terms. Keep dependency selections until authoritative invalidity. Public Book Now remains immediate and does not require reception approval or contact details.

## 5. Accessibility improvements

Pending, not verified: visible keyboard focus; aria-invalid/describedby; labels and errors; named 44px coarse-pointer/close/icon targets; focus trap/restore; Escape behavior; live status announcements; non-color-only status text; keyboard/touch alternative to slider dragging; no-results and error Retry focus handling; 200% zoom/reflow and mobile labeled cards. Radix infrastructure is a starting point, not proof each composed screen passes WCAG. Browser tab close/reload cannot display a custom app dialog: distinguish in-app navigation from browser-controlled unload behavior.

## 6. Counts and estimated remediation split

Original classifications retained exactly: **45 S, 36 F, 9 S/F, 3 F/S, 13 Q, 1 P = 107**. There are 12 mixed findings, not 24 distinct items.

- Standardization candidates: 45 S plus shared portions of 12 mixed = **57 touched**.
- Functional investigation candidates: 36 F plus functional portions of 12 mixed = **48 touched**.
- Decisions/proposals: **14 held** (13 Q, 1 P).
- These overlapping estimates are not resolved counts. **Resolved this phase: 0; all 107 pending/held/not reproduced.**
- #95 and notification infrastructure required by #25/#66 may additionally cross approval boundaries despite original F class. Missing numeric maxima and contradictory pagination defaults likewise need explicit treatment.

## 7. Clinic date and time format

**Application files changed: none. Migration executed: none.**

Ownership decision: parent `clinics` (Clinic Group) owns dateFormat/timeFormat; each `branches` location (Clinic) inherits display preferences but retains timezone. Defaults DD MMM YYYY and 12-hour; alternatives DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD and 24-hour. Only these two settings are approved schema/data additions; exact storage through current settings contract and additive migration must be designed before coding, with idempotent defaults for every existing parent.

Files requiring later coordinated work:

- DB/settings persistence plus API/OpenAPI/generated contracts; inspect existing settings representation before adding columns.
- UI `lib/date-time.ts`, R/C, registration/settings/completion, public booking, queue selectors, reports, Profile, staff audit dates, ticket components and exports.
- API email templates and existing notification messages; any new channels remain held.
- Mixed-clinic rows require record-specific parent format and location timezone, not the current user's clinic preference.

Canonical review: DB has structured calendar dates/weekday indexes and JSON schedule data; AV validates HH:mm, date strings and interprets IANA timezone. AR generates UTC ISO timestamps. Generated ZOD `dateOfBirth` uses `zod.coerce.date()`: calendar-date roundtrip must be reviewed before a universal parser is claimed safe. Legacy data was not queried or rewritten. Existing raw local formatting, direct HH:mm ranges and locale timestamps have **not** been converted. Avoid replacing internal computational `Intl` calls with display formatting; “no hard-coded display format” does not mean removing canonical date/time arithmetic. Filenames need safe separators, not slashes from DD/MM display.

## 8. Needs clarification / verification blockers

- Embedded DOCX screenshots not visually inspected; exact mapping particularly needed for 3/4/12/13/16/21/24/26/27/48/51/55/61/67/72/74/78/82/93/102/105/107. Provisional screens are not conclusions.
- Missing referenced semantic/border/status tokens; public-heading exception versus §9; page-size 20 preservation versus exclusive-looking 10/25/50/100 options.
- Clarify whether #95 requests next-candidate UI refresh or an automatic no-show→call-next rule. Only complete currently auto-advances.
- Confirm existing patient notification contract for 25/66 before adding persistent notification tables or delivery infrastructure.
- Confirm new maximum limits for generic maxTokens/buffer; existing minimum is not permission to invent a cap.
- DOB-only versus age-only legacy patients: never fabricate dates.
- #45/#68 must be evaluated against current deactivate semantics, not “fixed” through destructive deletion.
- UAT JWT source divergence is acknowledged, not solved here. No repeated demand for unavailable deployment files, no claim that workspace tests prove UAT.
- Real email reception, runtime latency, role-specific UI, all original reported datasets, mobile/zoom/keyboard and browser cookie behavior remain unverified.

## 9. Q/P proposals and approval holds

Estimates are engineering days after requirements/evidence, excluding provider/legal approval and rollout. No proposal implemented.

| Finding | Recommendation / screens | Data and approval impact | Effort / risk |
|---|---|---|---|
| 52 | Explain current consultation check-in; consider booked-patient continuation under explicit dated extension | Closing/check-in authorization change held; location extension may need new data | 3–5d, high clinical workflow risk |
| 58 | Separate patient consent from staff acknowledgement; approved policy link on entry/booking | Capture semantics/legal retention may need approved fields | 2–4d plus legal review, high |
| 64 | Clearly optional account sign-in beside immediate Book Now | Copy only; no new gate/contact requirement | <1d, low |
| 69 | Decide one doctor-global consultation at a time versus location/session independence | Cross-location transition locking/policy change held | 3–5d plus contention tests, high |
| 75 | Explain current cutoff/check-in restrictions; preserve waiting-state eligibility logic | No rule change until approval | 1d copy; 2–4d approved rule work, high |
| 88 | Deactivate staff/patients/clinical entities with history; separately define retention and any safe purge | Hard deletion/schema/retention policies held | 1–2d truthful UI; purge separate, high |
| 90 | Family member selector, relationship/guardian consent, proxy booking/history | New data/access model and screens; P hold | 5–10d plus security QA, high |
| 91 | Make existing Receptionists tab/create path discoverable within role scope | No new role needed; ownership unchanged | 1–2d review, medium |
| 93 | Real Retry-After/countdown where supplied; clinic contact and emergency guidance | Never bypass auth/rate limits; emergency process approval | 1–2d copy; process separate, medium |
| 98 | Expose existing multi-Clinic assignments and schedule conflict feedback | One owning admin; no inferred operational access | 2–4d UX/verification, high DST/conflict risk |
| 99 | Consistent Review changes / Apply changes naming; do not merge safety preview silently | Preserve impact token/concurrency workflow | <1d copy; 2–3d if merge approved, medium |
| 102 | Named user invitation/password setup, not shared Clinic credentials | Identify intended entity first; auth hold | 1d discovery, implementation unestimated |
| 104 | Entity-specific effect help; propose recipient/channel matrix for future notifications | Notification policy/infrastructure held | 1–2d copy; 3–5d channel work if approved |
| 106 | Hide misleading optional “No” or label “Not requested”; show actionable required state | Existing optional/required mobile policy unchanged | 1–2d, medium provider sensitivity |

### Authentication checklist 108–137: conditional review, not proven gaps

All remain **pending reconciliation/verification**, no authentication or deployment edits. Workspace native hashing/sessions are intentional; do not restore Clerk. Preserve ownership, native password hashes, legacy IDs, patient passwordless separation and SMTP-independent ordinary staff login.

| Item | Audit disposition / next evidence |
|---|---|
|108|Workspace native opaque sessions evidenced by API `lib/native-auth.ts` and DB authSessions; deployed JWT remains user-reported. Reconcile, not automatically migrate.|
|109|Workspace session lifetime constant is 12 hours; proposed JWT 15-minute access/12-hour maximum is a decision, not current verified UAT behavior.|
|110|JWT algorithm/issuer/audience/type validation conditional on authoritative JWT implementation; not applicable as a missing workspace feature.|
|111|Signing-key startup/rotation/compromise review held; no secret/config values read.|
|112|Inventory staff login, legacy challenge, invitation, registration, patient and demo session issuers in API auth/demo routes before any approved token change.|
|113|Keep live database role/status/clinic checks in API `lib/auth.ts`; never authorize solely from stale JWT claims.|
|114|Refresh rotation/reuse/lifetime proposal conditional on JWT selection; any new schema separately approved.|
|115|`revokeUserSessions` exists and RR deactivation calls it; full logout/reset/demo revocation coverage not executed.|
|116|UI `auth/native-auth.tsx`, `lib/auth-request.ts`, CSRF helpers need expiry/logout/private-cache review against actual transport.|
|117|OpenAPI/generated clients and manual auth calls need reconciliation together; no generated edits in audit.|
|118|Proven 12-character conflict in server and reset/setup UI; approved eight-character composition rule, hashes preserved.|
|119|Password/challenge/session atomicity and login-reset races need isolated security tests later; none executed here.|
|120|Recovery credential supersession policy needs review; no tokens queried or consumed.|
|121|Compare admin-assisted target cap with no-per-account forgot-password policy; preserve IP/token controls.|
|122|Endpoint and multi-instance rate-limit semantics pending review; no abuse/live requests.|
|123|Email collision aggregates/preflight require authorized data access; do not auto-merge or add uniqueness migration.|
|124|Verified email-change/revocation behavior remains product/auth proposal.|
|125|StaffLogin retains challenge UI; ordinary staff login must remain SMTP-independent. Remove dormant flows only after approved inventory.|
|126|Deployment/database aggregate readiness inventory not performed; no account data or credential lists accessed.|
|127|Former-provider native enrollment must preserve hashes/IDs/roles; no enrollment/reset performed.|
|128|Session/refresh schema changes are not covered by the two approved display fields. HOLD.|
|129|Dormant Clerk compatibility cleanup requires inventory; no provider code/scripts reactivated or removed.|
|130|No provider secrets/config/tenant/account changes; retirement only after target build verification.|
|131|Old-session cutoff and compatible rollback require approved deployment plan; no destructive restore.|
|132|JWT security suite conditional; native session suite otherwise. No tests executed in this audit.|
|133|Staff/patient/demo/invitation/recovery/delivery matrix pending controlled verification, not inferred from fixtures.|
|134|Role/Clinic/owner-doctor/guest/demo boundaries pending isolated tests; memory rules retained.|
|135|HTTPS cookies/CSRF/bootstrap/logout need real-browser evidence; no live or handler requests here.|
|136|UAT authoritative; exact deployed versions/proxy/scripts unknown. No deployment inspection or changes claimed.|
|137|Backup/rehearsal/real email/count comparison/monitoring pending separately approved release work; publishing not authorized.|

## 10. Schedule editor design-review feedback (§6A a–f)

### a. Actual model and rule locations

- **Multiple sessions already supported**, not a proposed new table: DB `schedules` has active uniqueness on doctorId/branchId/dayOfWeek/**data.startTime**, and weekday 0–6. AV enumerates same-day schedules; RR validates collision across sessions. Do not incorrectly characterize model as one-session-per-day.
- **Days off already representable:** absent/inactive schedule or `isOpen=false`; branch openingHours array defines location days/sessions. An enabled location day does not create doctor capacity.
- **Dated doctor exceptions already supported:** DB `availability_exceptions` unique doctor/location/date/coalesced sessionId; AV applies session-specific override before all-session override, including start/end/break/maxTokens and `isClosed`. R has exception reason and optional session selector. Existing global exceptions are bound to a prior sole session when RR introduces a second weekly session.
- **Existing exception support is not permission for out-of-hours exceptions.** AV rejects effective sessions outside branch openingHours or different timezone, and cannot generate a bookable session from a date exception without a weekly schedule. A standalone location-level one-date closing extension is not established by this model.
- Rules live **both in database and code**: DB indexes/weekday checks; AV time/weekday/containment/booking horizon/queue cutoff/capacity; RR overlap and write validation; linked-schedules preview/protected-history logic; AR queue transition/date/presence/order. Existing SQL migrations/custom guards also require preservation; no migration executed.
- Doctor can have multiple clinic/location assignments. RR uses `weeklySessionsOverlap` across a doctor's active sessions, converting timezone instants; it is not simply same-location comparison. Weekly helper samples reference weeks around January 2030, so “all DST transitions proven safe” would be unjustified.

### b. Slider and exact entry design

Recommend 15-minute slider snap for quick editing, but typed HH:mm accepts **every minute**, including 20:32; syncing slider must not round valid typed values on blur/save. Two independently labeled start/end controls and explicit keyboard increments provide non-drag alternatives (WCAG 2.2 dragging). Announce bounds/current values, distinguish handles, maintain contrast beyond colored bands. Show actual location session bands (including gaps), not a single misleading full-day envelope.

Monday–Sunday rows with closed toggle; mobile stacked cards, full-width slider, >=44px targets. Collapsed formatted summary plus timezone above editor. “Add session” adds a presentation row mapped to distinct existing schedule record. Recommend a **soft UX warning at four sessions/day**, not a new hard server maximum without approval; four covers common split shifts while preserving existing larger datasets. Optional session names need schema/contract review before persistence; do not invent an approved field.

### c. Exception proposal

Reuse current doctor/date/session exception representation for changes already accepted by existing rules. For **outside-location-hours**, propose a dated location-hours extension first, then a scoped doctor session exception; record actor, reason, date, original/effective hours and impact. Current containment must remain until approval. Recurring changes belong in weekly schedule; recurring exception series is a separate feature/model decision.

Propose location owner/admin authorization for clinic-wide extension, with doctor request/approval rather than unapproved receptionist/doctor powers. Existing permitted exception roles stay unchanged during UI standardization. ExceptionDialog's Save as exception must be absent/disabled for unsupported bypass, with truthful explanation, until rules/data approved. “Adjust to clinic hours” must respect split-session gaps and display exact proposed result.

### d. Downstream effects

- #52: consultation check-in and new booking closing checks are distinct. Decide whether extension permits new booking or only already-booked care, with explicit end time; never open unrestricted after-hours booking incidentally.
- #53/#54/#76: use weekday doctor schedules + date overrides in clinic timezone; keep historical snapshot sessions available operationally but not bookable; Sunday=0 retained.
- Queue: retain token/session identity and snapshots, revision locks, duration/capacity rules; moving startTime can split session keys and must not silently migrate appointments.
- Booking: recompute availability only under approved effective-hours policy; location hours cannot supply missing capacity/duration.
- Notifications: proposal must define recipients and channels for actual changes; existing notification absence cannot be solved by assuming a new provider.
- Copy: copies weekly template intent only, never dated exceptions, permissions, completed history or active queues; show conflicts and preview linked doctor impact.

### e. Edge cases

- Overnight sessions currently explicitly rejected by AV `validateTimes`; retain rejection, propose split-across-days policy separately.
- DST gaps/folds need explicit ambiguous/nonexistent wall-time handling; sampled weekly overlap helper is not comprehensive year-round proof.
- Timezone changes must preserve appointment instants/history and warn on future schedule effects; display-format preference must never modify timezone.
- Existing data: stable IDs, multiple sessions, global/session exceptions, linked relationships, canonical HH:mm, nullable breaks and legacy snapshots must survive UI migration. No silent inferred doctor sessions.
- Shortening/removing hours: linked planner rejects booked history or date-exception impacts; preview and warn, no silent cancellations/deletion. Preserve unlink behavior.
- Capacity below already-booked tokens, overlapping copied sessions, adjacent sessions, exact end/start boundaries, simultaneous editors, 00:00/23:59 and alias-equivalent IANA zones require tests later.

### f. Effort and risk

| Part | Estimate | Approval / risk |
|---|---|---|
| Shared weekly rows/toggles/typed fields/summary/copy | 4–6d | Existing model only; medium state/ID risk |
| Accessible dual slider + mobile/keyboard | 2–3d | Presentation only; medium a11y risk |
| Inline overlap and existing doctor-hours warnings | 2–3d | Preserve server rules; high cross-timezone correctness |
| Existing exception UI clarity/badges/reasons | 1–2d | Only already-supported semantics |
| Location dated extension + outside-hours override | 4–7d + QA | HOLD: data/rule/permission approval |
| Recurring exceptions/overnight support | Separate estimate after policy | HOLD, high migration/booking risk |
| Deterministic timezone/linked/history regressions | 3–5d | Isolated fixtures later; no live mutations |

## 11. Search, sorting, filter, pagination and dropdown coverage

This is a source-derived inventory of primary data listings and embedded/public collections found in the route/component inventory, not a claim that every rendered state was inspected. **After for every entry is unchanged**, because Phase 1 performs no implementation. Additional dynamically exposed listings discovered during role walkthrough must be appended, not declared compliant by omission.

### Shared listing baseline (B)

- Before: R ResourcePage uses visible SearchInput, debounced server list query, URL-backed filters/page/sort, filter chips, sortable supported columns, server `queryPage`, and L Showing X–Y of Z. Defaults/options use 20 (10/20/50/100), not required 25 option. AdminListing handles bulk/export/actions; capabilities gated by resource/role.
- After: unchanged. Need required page sizes, standard empty/no-results, sticky action column, universal dropdown state/accessibility and consistent toast/export formatting. LP search/sort keys are allowlisted; adding UI columns does not automatically support server sorting.

### Clinics / parent Clinic Groups — R `clinics`, LP
- Before: B search/sort; status/location/admin-related filters; server pagination; management row/bulk/export infrastructure.
- After: unchanged. Distinguish parent group versus Clinic location, format ownership and role-scoped filters; verify actual enabled export/action set by role.

### Clinic locations — R `branches`, ClinicSettings embedded ResourcePage
- Before: B; parent/status/doctor scope. LP specially resolves doctor membership for branches instead of nonexistent doctorId column. Settings wrappers may preselect a sole parent.
- After: unchanged. Retain scoped query, add terminology/date preferences display; do not mistake sole-parent discovery request (`pageSize:2`) for list pagination.

### Doctors — U Doctors tab; legacy R doctors
- Before: search, status/clinic/branch/manager/specialization context; sorting and server pagination, default 20; row edit/status/invitation/revoke and bulk infrastructure.
- After: unchanged. Profile before optimization; preserve selected IDs/labels; verify export/current-filter and action enablement; no blanket “pagination missing” claim.

### Staff Clinic Admins — U admins tab
- Before: scoped search/filter/sort/page context and row/bulk controls; shares staff table, role-specific creation.
- After: unchanged. Preserve atomic admin + first-clinic creation and exactly-one-owner rules.

### Staff Receptionists — U receptionists tab
- Before: role exists; shared staff search/filter/sort/server pagination; assignment/row/bulk controls.
- After: unchanged. Discoverability under actual role needs verification, not creation of new role.

### Patients — R patients
- Before: B search/sort/filter/server page and CRUD/bulk infrastructure; columns include mobileVerified, omit explicit status from listed columns.
- After: unchanged. Status discoverability, inactive selector behavior, DOB/age, current-filter export format and conditional verification display pending.

### Weekly doctor schedules — R availability / SchedulingWorkspace
- Before: B plus doctor/clinic/day filters and weekly overview; paginated server records; create/edit/remove/copy-related infrastructure. Generic one-day editor remains.
- After: unchanged. Weekly editor must coexist with searchable paginated schedule management; no overwrite of linked/history constraints.

### Date exceptions — R exceptions / SchedulingWorkspace
- Before: B; doctor/location/date scope; reason/session/time/capacity columns; server list and edit/deactivate.
- After: unchanged. Clear date/session scope; distinguish existing exception from proposed outside-hours capability.

### Master values — R masters
- Before: B; category/status/parent/sortOrder concepts; searchable server list; CRUD operations.
- After: unchanged. No invented seed values; expose no-results vs unavailable catalog and required standard pagination.

### Booking QR codes — R qrs
- Before: B with card/QR-specific rendering, status/clinic/doctor/location scope; download/copy/public-link/display actions; management CRUD.
- After: unchanged. Keep QR geometry; format filenames; distinguish booking QR from private patient ticket QR; cards still need equivalent list controls.

### Audit/security events — R audit
- Before: B read-only table; actor/action/entity/summary columns, server filters including activityType in LP; no edit/delete.
- After: unchanged. Friendly date/time per record, security privacy retained; do not add meaningless row mutations.

### Appointments (all staff/patient variants) — C Appointments
- Before: server search, date range/Clinic/doctor/session/status tabs, upcoming/past/all view; server sort and page; action/ticket/bulk components. Search placeholder differs from §6B template. Native Visit range select remains.
- After: unchanged. Verify filter/count equivalence (59), notes/reasons/check-in fields, completed ticket visibility; exports/bulk tickets need shared format. Patient privacy/own-only scope unchanged.

### Queue reservations — UI `components/queue/SessionQueue.tsx`, QAPI
- Before: search/status/session/doctor/location/date context and pagination; sorting supported server-side, scoped rows filtered/sliced in server memory; clinical actions and stale-data guards.
- After: unchanged. Not database-level paginated query yet; performance work must preserve coherent queue version and locking. Do not replace reservation order semantics with arbitrary default sorting.

### Earlier guest requests — UI `components/queue/GuestRequests.tsx`
- Before: pending scoped requests; server pagination default 10; no visible search or sortable headers; approve/decline, no export; section hides when empty.
- After: unchanged. Add discoverable search/sort only consistent with historic workflow; new bookings must not be converted back into approval requests.

### Reports/grouped rows — C Reports; API `routes/reporting.ts`
- Before: date/group/Clinic/doctor/session filters, server page; CSV iterates pages of filtered results; no top-left search or sortable header interaction apparent in Reports JSX; outcome columns incomplete.
- After: unchanged. Add applicable search/server sorting, reconcile statuses, ensure export snapshot consistency; new grouping/export capabilities beyond existing contract may need proposal.

### Doctor assigned Clinics — C DoctorClinics assigned section
- Before: search, active-only query, server page default 20, fixed name sort; navigational/location cards/actions; no explicit interactive sort/export evidenced.
- After: unchanged. Preserve operational membership scope; add applicable listing controls, not a broader assignment catalog.

### Doctor management network/catalog — C DoctorClinics network section
- Before: separate search/page context and assignment-options query; role-scoped catalog; default size 20; no general export evidenced.
- After: unchanged. Management catalog must not grant appointment/queue access to all owned locations.

### Public Clinic finder and clinic/location/doctor collections
- Before: UI `components/GuestClinicFinder.tsx`, `PublicClinicPage.tsx`, `PublicClinicLive.tsx`, `GuestBooking.tsx` use public scoped endpoints/lookups; sole-option detection uses pageSize 2; rendered public details/doctor collections are not uniformly DataTable listings. No management actions/export.
- After: unchanged. Inventory each visible collection in later public walkthrough; paginate/search large directories without turning public detail summaries into inappropriate admin tables.

### Dashboard recent appointments
- Before: C Dashboard shows bounded recentAppointments with View all; no local search/sort/filter/page toolbar; appointment row actions reused.
- After: unchanged. Decide “every listing” treatment for bounded previews: recommend explicit recent-summary label and paginated View all destination, not silently claiming exemption.

### Dashboard operational activity
- Before: bounded recentActivity feed, timestamp/actor/summary; no local search/sort/page/export; security events intentionally separate.
- After: unchanged. Link to appropriately scoped searchable paginated audit/activity view or approve preview exception.

### Public queue display / patient own queue
- Before: `ClinicDisplay.tsx`, `PublicClinicLive.tsx`, C Queue/SessionQueue show curated live queue summaries; intentionally not full patient directory; no public export/administrative actions.
- After: unchanged. Preserve privacy/KEEP_CURRENT display geometry where applicable; public listing search/sort requirement needs contextual interpretation, never expose patient rows to satisfy it.

### Embedded schedule summaries and linked-change previews
- Before: WeeklyOverview, ClinicRegistrationHours, ClinicSettings/LinkedScheduleControls render bounded seven-day/session/impact collections, not remote catalog search. Review/apply actions protect booked history.
- After: unchanged. Weekly row/copy UX applies; do not impose meaningless server pagination on fixed weekdays. Explicitly resolve any literal “every listing” conflict for bounded review summaries.

### Dropdown/lookup coverage across all listings/forms
- Before: `ResourceLookup`/`CareLookup` plus `SearchableSelect`/`SearchableMultiSelect` provide server lookup/paging and portal-based UI infrastructure. `SuggestionInput` provides keyboard navigation and manual text fallback. R `MasterTextInput` queries masters with pageSize 20. L page size and C Visit range remain native selects; generic R timezone remains text.
- After: unchanged. Audit all static selects, status/role/day filters, timezone, Clinic/doctor/patient/master lookups, session pickers and bulk multi-selects. Required: searchable portal above dialog, 300ms debounce, retained selected label, checkmark/chips, loading/searching/empty/no-results/error Retry. Existing helper names are not proof all consumers meet every state. Show selection count and whether selections are page-local or retained across pages; prevent stale-scope bulk mutations.

## Unchanged and why

Only this audit report and a pending-status progress checklist were created. No source/package/config/secrets/schema/deployment changes, workflows, tests, requests, account changes, emails or database mutations. No behavior was “fixed” based solely on symptoms. Q/P, authentication reconciliation, new exception powers, new providers/notifications, hard deletion and any migration beyond two display preferences remain held. All implementation, reproduction and verification statuses remain pending; this report is a planning/evidence baseline, not a completion or release certificate.