> Historical baseline: Sections 1–11 and the original individual findings below preserve the Phase 1 audit; their “pending”, “unchanged”, and “not visually reviewed” statements describe that pass only. The **Current disposition register — all 137 items** appended below supersedes those statuses for the inspected workspace. See `docs/digiq-final-status.md` for current limits and actionable gaps. Neither document certifies UAT resolution, activation, delivery, or release readiness.

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

---

## Current disposition register — all 137 items

**Reconciliation: 2 October 2026, final current closure evidence.** Root typecheck **passed**. Main reports the latest recursive API/UI source run had **333 tests: 332 passed and one stale repository-double failure**. After correcting the test fixture to reproduce production SQL's `passwordEnabled` boolean projection, the full targeted backend-flow file passed **38/38**. Thus **333 tests are verified across combined + targeted runs**, not a fabricated clean single full run; overlapping totals are not added. No production credential reread was restored. Earlier 321/321 and browser evidence remain historical below. Current browser continuation passed within the scope below; no work remains running. No code, global tests, workflows or browser sessions were run by this documentation worker.

### Evidence and status semantics

- `implemented-awaiting-browser`: relevant caller is wired in current source; not a claim of full UI, accessibility, performance or UAT verification.
- `verified-with-test-evidence`: the identified behavior has a recorded passing test result in `docs/digiq-progress.md` or explicitly supplied by the main agent below; evidence is limited to that test's scope.
- `existing-behavior-verified`: source tracing establishes the existing behavior; this is **not** a new browser pass or confirmation of the reported live incident.
- `held-product-decision`: an optional behavior, schema or authentication-policy extension remains approval-held. A completed current-policy recommendation is not relabeled an unimplemented required feature merely because an extension is possible.
- `blocked-external`: needed deployment, data, provider or real-delivery evidence is outside the inspected workspace. This does not block unrelated implementation.
- `pending-implementation`: a known local implementation/investigation gap remains. None is currently established in this closure pass; browser verification limits use the separate status above.

UI/API/R/U/C/AV/AR/RR shorthand remains as defined above. Newly referenced component paths are relative to UI unless prefixed API. New test files are **coverage candidates, not passing execution evidence** absent an explicit recorded result. The current register is a source/scoped-evidence disposition, not a browser coverage list or a resolution percentage.

**Current local closure evidence:** [performance](digiq-performance.md) records measured list-only repairs and queue diagnosis for23/35/77/89; [action/data diagnostics](digiq-remaining-diagnostics.md) records invitation-replacement semantics, failures/partial results, patient SQL repair and local-master errors for38/40/41/61/87; [auth compatibility](digiq-auth-compatibility.md) records repository retirement and disposable single-key/compromise rehearsal for111/125/129. All twelve previously pending local tasks have work/evidence; original UAT incidents and browser coverage are not thereby all closed. [Accessibility coverage](digiq-accessibility-coverage.md) records eight passing source-contract checks and a caller sweep, not interactive keyboard/zoom certification.

**Final register validation:**137 unique dispositions, none missing: **52 verified-with-test-evidence**, **59 implemented-awaiting-browser**, **6 existing-behavior-verified**, **10 held-product-decision**, **10 blocked-external**, **0 pending-implementation**. These categories describe scoped source/test evidence, not52 browser-covered findings,59 missing implementations, a completion percentage or all137 resolved.

**Development/external evidence:** [release readiness](digiq-release-readiness.md) records14/14 active development staff without password material, not published-account proof. Initially missing three booking guards were restored only after explicit authorization, zero collisions and locked transaction preflight using exact existing migration definitions: now3/3 booking guards and7/7 source-named unique guards, unchanged row counts/mappings and no row changes. Disposable source-migrated backup/restore **passed**; actual-target backup, delivery, cutover and provider retirement remain unverified. Anonymous UAT root/sign-in/status/health GETs succeeded; status was anonymous/no-store, API HSTS present but HTML HSTS absent. This is no authenticated parity/security proof. User owns Publish; no blind schema repair or password resets are authorized.

**Current browser evidence supplied by main:** patient listing shows no unsupported mobile-verification badge; shared select keyboard Gender selection passed; required FormField inline error/ARIA/focus passed; draft discard and resend confirmation copy passed;390px/640px checks found no document overflow. The same fixture page's narrow invitation continuation **passed** after the last dedicated CSRF route corrected generic-route precedence (fixture error, not app failure). Single resend made one actual app POST to `/users/:id/resend-invitation` with fake sent response and showed row plus toast “Set-password invitation sent”. Bulk three selected produced one fake success, one503 failure and one password-enabled skip: “1 of3 sent”, per-row results and summary. Patient own upcoming booking notice, reload persistence and details link `/patient/appointments?view=all&search=REF` matching the request **passed**; actual app request uses `statusGroup=waiting` without a client-supplied patient ID. Cross-tab logout **passed** with fake shared-server auth and BroadcastChannel: other private tab reached sign-in and one-second settle showed no rebroadcast loop. All intercepted records/responses were fictional; no real email. Real-server revocation is proved only by separate isolated tests, not this browser fixture. Visit-linked staff booking patient lookup and actual200% zoom remain untested. Component-level checks do not promote every caller to full browser coverage, live UAT parity or original SMTP-incident resolution.

Earlier worker evidence relayed by the main agent: **13 authentication-contention tests passed**, including registration resend/backend protections; **6 appointment-confirmation tests passed with fake email transport**. These support isolated behavior only, not real delivery or unexercised browser scenarios. The main agent also reports completed onboarding/back-error, searchable-select, weekly-day/copy/exact-minute slider/clinic-band and external `aria-invalid` work; their current caller changes are not treated as live UAT certification.

**Test chronology:** earlier root run was **280/284**; corrected source expectations passed targeted **8**, and the real first-receipt `confirmationEmail` mismatch/intended nonpatient date-preference allowlist corrections passed **phase-one + notification 58**. These historical failures are now superseded by **321/321**, not erased or added together. Typecheck and final source-test evidence: `/tmp/replit-shell-output-logs/T2YACJF5WN1AM491ZZZRG/log`. Ticket **24/24** evidence: `/tmp/ticket-regression-approved-formats.txt`, after approved-format fixture corrections and a mixed-clinic test. The workflow card may show an older ticket failure; passing CLI evidence is current.

**Historical browser evidence supplied by main:** availability rendered and accepted `08:32`; `31 Feb` blocked Continue; registration Back retained values/format preview and cleared validation; password reveal/required passed; completed row had no Ticket action. Mobile registration overflow was found, repaired and **retested successfully at 390×844 on Locations and Opening hours** (document width 375, viewport 390). Protected-action 401 replaced private workspace with `/sign-in`, **one POST only, no write retry**. Initial missing mock-CSRF fixture was corrected before the actual 401 behavior passed. No real users/email used. Cross-tab/logout and patient-notification visuals were not tested in that earlier pass; the current scoped fixture checks above now pass. Fixture evidence is not live UAT or proof of the original availability incident's cause.

**Selected actual passing tests in the 321 run** (assertion scope, not global feature certification):

| Evidence | Actual passing test names / scope |
|---|---|
|Formats/details|“all display formats roundtrip without date/timezone conversion”; “DST transitions use the actual instant, never browser-local interpretation”; “private detail renders notes, reasons and consultation check-in without actor IDs or raw HTML”; “date and time inputs preserve external invalid state and error descriptions”.|
|Scheduling|“weekday availability uses the selected calendar date including Sunday zero and split Friday sessions”; “stored numeric weekdays match string options, including Sunday zero”; “weekly sessions preserve exact minutes, allow adjacent sessions, reject overlap and invalid clocks”; “exception session requirement mirrors the existing multi-session override rule”.|
|Booking notices/mail|“portal notices are patient-only, persisted-query-backed, and link to authorized appointment details”; “enabled confirmation uses parent display settings and excludes clinical notes”; “SMTP failure cannot undo booking and retries cannot send again”; “concurrent retries claim once and preserve unknown outcome after dispatch storage failure”.|
|Queue/listing|“staff SQL queue pages preserve full-session next/version/counts and default full compatibility”; “filtered SQL queue page and concurrent Call Next share the authoritative queue lock”; “guest search is bounded, literal, sorted and restricted to staff assignments”; “real SQL immediate waiting preserves reservation order and explicit skip”.|
|Scope/privacy|“actual SQL authorization equals prior canRead across all roles and resource families”; “600 appointments/patients: clinic, branch, own doctor, status, date and patient isolation”; “clinic admin retains ordinary doctors with scoped patient and visit route totals”; “patient queue response does not disclose status tabs”.|
|Lifecycle/contracts|“protected mutation 401 clears private identity/cache immediately and never replays the write”; “logout succeeds across tabs without credentials or rebroadcast loops; failed logout stays signed in”; “status checks are single-flight, do not renew or clear healthy caches, and detect expiry”; “auth status requires no CSRF token and queue preserves omitted pagination”.|
|Auth transport/security|“actual HTTPS frontend transport completes Argon2 staff login, session and logout with all SMTP settings absent”; “origin gate rejects cross-site mutations even with valid CSRF; patient OTP shares transport”; strict JWT claims/tampering/default-mode tests and thirteen credential-contention/resend tests.|

The original screenshots at `/tmp/digiq-finding-{24,26,51,55,61,74,78,82,87,102,105,107}.png` were visually inspected for this reconciliation. They establish target screens, not current behavior. In particular: 24 is an error boundary at `/admin/availability`, **not evidence of a wrong destination**; 26 is dashboard average queue wait; 51 is schedule capacity; 55 is the booking-confirmation ticket container; 61 is the booking patient lookup; 74 is the bulk-cancel submit button; 78 is multi-doctor quick switch; 82 is the exception session field; 87 is master-backed address suggestions; 102 concerns location credentials; 105 is the dashboard booking side card; 107 concerns appointment action reasons.

### Findings 1–27

| # | Status | Current evidence, cause and remaining limit |
|---|---|---|
|1|verified-with-test-evidence|API `lib/native-auth.ts` and `auth/PasswordFlows.tsx` replace the duplicated 12-character rule with eight plus letters/numbers. Prior authentication suite passed; new registration caller still needs browser verification.|
|2|implemented-awaiting-browser|No `developmentCode` or “Development-only” display remains in inspected UI production source. Verify production bundle and all verification screens; legitimate fictional-demo warnings remain.|
|3|implemented-awaiting-browser|`ResourceLookup` → `SearchableSelect` now retains selected records and exposes fetch/error/retry states. Original empty field's live data/role cause is not established.|
|4|implemented-awaiting-browser|R `RelationInput` registers required relations and emits “Select a clinic” inline. Generic Editor and staff caller use it; exercise each dependent form.|
|5|implemented-awaiting-browser|API `lib/auth-email.ts` calls `systemEmailTemplate` for existing system mail, including integration tests' caller. HTML escaping/plain text implemented; no real send or exact missing-JSON certification.|
|6|implemented-awaiting-browser|R Editor, U UserEditor and registration account/wizard call shared person-name validation, trimming and inline errors. Verify Unicode/allowed punctuation and server parity.|
|7|verified-with-test-evidence|Same policy and historical authentication test evidence as 1; preserves Argon2id and existing valid hashes.|
|8|verified-with-test-evidence|PasswordInput callers include StaffLogin, PasswordFlows and ClinicRegistration. Main's fixture-browser pass verified password toggle and required behavior; complete auth-screen keyboard matrix remains outstanding.|
|9|verified-with-test-evidence|ClinicRegistration RegistrationAccount calls new `registration/resend`, displays 60-second cooldown and success toast, and replaces challenge ID/code without extending original expiry. Main reports 13 contention tests passed; UI timer/browser interaction awaits final pass.|
|10|blocked-external|Auth mail path now checks delivery errors/provider response and readiness; actual reported recipient/provider transaction is unavailable. Do not label missing SMTP configuration the proven incident cause.|
|11|existing-behavior-verified|321 run passes “signup reference data only exposes active allowlisted names and IDs”; wizard consumes those references through shared select. Original empty catalog remains a data/context diagnostic, not a proved missing list implementation.|
|12|implemented-awaiting-browser|Shared lookup fixes reach R relations and booking care lookups. Empty-data provenance for the original field remains unproven; test its actual role/context.|
|13|verified-with-test-evidence|Main reports proven slug trailing-hyphen keystroke fix: live normalization previously stripped a just-typed trailing hyphen before the next character. Draft slug now retains it while final slug validation remains; not merely a permissive name-validator change.|
|14|implemented-awaiting-browser|R timezone fields and onboarding/settings call `TimezoneSelect`; searchable timezone/offset presentation replaces generic text entry. Check browser default and keyboard behavior.|
|15|implemented-awaiting-browser|Registration hours and doctor WeeklyOverview show Mon–Sun context/copy actions; exact typed minutes, slider and clinic-hour bands are wired into schedule UX. Existing record model/overlap protections retained; no new scheduling powers introduced.|
|16|implemented-awaiting-browser|R static and relation fields call searchable controls; selected-label caching added to ResourceLookup/CareLookup. Confirm original field/request rather than assuming the shared fix covers missing data.|
|17|verified-with-test-evidence|321 run passes display roundtrip/DST, per-parent appointment preferences and DateFormatInput external-invalid tests; tickets 24/24 include mixed formats. Resource timestamp caller uses configured formatting. This does not certify every unexercised channel or full JSON styling.|
|18|implemented-awaiting-browser|R Editor queries peer sessions and validates overlap inline; registration hours validates exact-minute overlap before progression. Cross-clinic authoritative server rules are preserved.|
|19|verified-with-test-evidence|Wizard Back clears stale errors while retaining input; main's fixture-browser pass confirmed Back preserves values and clears validation. R create/edit reset is source-traced; all rejected-request/navigation permutations are not claimed.|
|20|implemented-awaiting-browser|Shared friendly translator reaches App ErrorNotice, auth, Users, R and registration. Raw transport prefix suppressed at these callers; retain useful validation message.|
|21|implemented-awaiting-browser|ResourceLookup/CareLookup cache selected records separately from current page. Root cause addressed: selected label could disappear when search/pagination replaced options; cache does not grant scope validity.|
|22|implemented-awaiting-browser|Shared AppDialog close hit area updated and used by resource/staff/appointment dialogs. Inspect bespoke controls too; component coverage is not an all-dialog measurement.|
|23|verified-with-test-evidence|Disposable production-handler measurement confirms and repairs repeated SQL assignment enrichment and list-only staff/branch N+1 queries. Doctor20 warm median69.65→32.20ms, staff20 queries23→3, branch100 queries101→2; scoped SQL regressions12/12 pass. No original one-doctor incident, network, browser-render or deployed latency resolution claimed; see performance report.|
|24|existing-behavior-verified|Main's fixture browser rendered intended `/admin/availability` and accepted exact `08:32`. Original screenshot's error-boundary incident was not reproduced; no root cause or UAT routing repair claimed. Diagnose only if original deployment/data case reproduces.|
|25|verified-with-test-evidence|Isolated tests pass patient-only persisted-query-backed notices/authorized details and exclusion of terminal/consultation records. Current fixture browser passes own upcoming notice, reload persistence and details link /patient/appointments?view=all&search=REF matching the request; app queries statusGroup=waiting without client patientID. No new center/schema, real delivery or live-UAT claim; other dataset variations unexercised.|
|26|implemented-awaiting-browser|C Dashboard average-wait HelpTip explains recorded wait sum/count, anchor and excluded visits. Screenshot metric is identified; check against API dashboard aggregation, not queue's separate wait estimate.|
|27|implemented-awaiting-browser|Shared layout applied; actual mobile registration overflow repaired and final 390×844 Locations/Opening-hours check passed (375px document within 390px viewport). Status reflects remaining screen-wide visual/keyboard/200%-zoom scope, not a still-broken mobile page. Exact JSON certification unavailable.|

### Findings 28–54

| # | Status | Current evidence, cause and remaining limit |
|---|---|---|
|28|implemented-awaiting-browser|C Booking displays existing cancellation cutoff before booking and on confirmation; R setting helper explains minutes. Status/permission rules unchanged; verify public/guest parity.|
|29|verified-with-test-evidence|321 passes staff role-specific payload/ownership guards, invitation-after-profile-commit and scoped management tests; U creation handles invitation partial success. Original “cannot add doctor” incident remains unreproduced, not a proven outstanding create defect or identified incident root cause.|
|30|implemented-awaiting-browser|R/U/registration invoke required validator on trimmed strings and show inline text rather than only highlights. Check every mandatory field caller.|
|31|implemented-awaiting-browser|U UserEditor invokes shared person-name validation; no claim based solely on validator existence. Server/patient/profile parity still needs matrix verification.|
|32|implemented-awaiting-browser|Shared AppDialog body/footer layout and forms' footer classes are wired. Browser scrolling, long errors and mobile/zoom required.|
|33|verified-with-test-evidence|Historical focused browser pass verified custom discard/keep/Escape/backdrop and retained values in AppDialog. Tab unload remains native by browser design.|
|34|verified-with-test-evidence|321 passes invitation delivery after profile commit and native enrollment behavior; U result caller distinguishes failed delivery with one warning/badge/resend. Original contradictory outcome is addressed without rolling back the saved profile; browser toast placement remains unchecked.|
|35|verified-with-test-evidence|Local API before/after profiling and list-query repairs are measured; retained-content/loading callers remain implemented. See performance report for fixture, sampling and scope. Network/render timing and original UAT delay remain unmeasured, not a missing local investigation.|
|36|implemented-awaiting-browser|U status-change caller now awaits shared ConfirmDialog instead of `window.confirm`. Ownership/self-deactivation protections retained.|
|37|implemented-awaiting-browser|U status mutation snapshots query cache, optimistically updates affected rows and restores on failure; row pending indicator present. Measure latency and browser rollback.|
|38|verified-with-test-evidence|Original screenshot confirms invitation replacement, not staff/session deactivation. Source eligibility/semantics and current fixture interaction pass: one actual app resend POST/fake sent response shows row-local plus toast success; confirmation/discard copy checked. Inactive/enrolled/unlinked protections remain. No real email or original SMTP cause/delivery certification.|
|39|implemented-awaiting-browser|U invitation confirmation and `AdminListing` bulk status confirmation use in-app dialogs. Confirm exact original action and keyboard focus.|
|40|verified-with-test-evidence|Original selected-row screenshot shows invitation resend503, not proof of a batch endpoint failure. Isolated helper/routes and current fixture interaction pass: three selected give one fake success, one503 and one password-enabled skip;1 of3 sent plus per-row results/summary. No real email; original delivery503 cause remains unverified.|
|41|verified-with-test-evidence|Isolated resend503 marks invitation failed without deactivating/revoking sessions; error propagates and fixture retry succeeds. Current single/bulk browser interaction confirms row/toast success and mixed failure/skip summary after fixture CSRF precedence correction. Original actual SMTP failure/inbox receipt remains unverified, not certified fixed.|
|42|implemented-awaiting-browser|U update close handler and R save success now call `notifySuccess("Updated successfully")`; test successful response and failed response separately.|
|43|implemented-awaiting-browser|U/R phone fields call PhoneInput/phone validator and normalization; bare “+” fails. Country selector and registration callers need browser coverage.|
|44|implemented-awaiting-browser|R destructive action calls danger ConfirmDialog with truthful deactivation wording; U no longer offers misleading inactive-account hard-delete action.|
|45|existing-behavior-verified|R invalidates after deactivation; inactive row remains intentionally in All while active filter excludes it. No established cache defect remains from source tracing; verify original filter/context if incident recurs. Permanent deletion remains held in 88.|
|46|implemented-awaiting-browser|Booking care lookups request active selection candidates; Doctors management table retains status tabs. Verify schedule relation scope as well as booking; do not broaden role access.|
|47|verified-with-test-evidence|321 passes scope-load selection preservation, unknown/error metadata retention, private/public exact membership and no eager parent reset tests. C/R call these helpers; browser delayed-option rendering still needs scoped check.|
|48|existing-behavior-verified|R/U selection is supplied by AdminListing checkbox handlers, not blank-row click handlers. No source basis proves reported blank-area deselection fixed; browser pointer reproduction still needed.|
|49|implemented-awaiting-browser|R/U and registration wire field-specific errors through FormField/relations, keeping request-level errors separate. Test server field-error mapping and first-invalid focus.|
|50|implemented-awaiting-browser|R update and ClinicSettings success paths now issue shared toasts. Actual failed saves must not trigger success.|
|51|implemented-awaiting-browser|Screenshot is schedule capacity. R `renderComputed("capacity")` HelpTip explains max patients, token prefix and consultation minutes; no longer an unidentified metric.|
|52|held-product-decision|Current time/session/queue checks do not imply automatic clinic closing lockout. Retain historical recommendation: controlled extended-day exception for already-booked patients, subject to approval.|
|53|verified-with-test-evidence|321 passes selected-calendar-date availability including split Friday sessions, independent session capacity and date exceptions. Original Friday incident is unreproduced; request exact timezone/data only if still failing in UAT, rather than declaring generation unimplemented.|
|54|verified-with-test-evidence|Same weekday/date/session tests pass with closed-day/hours constraints in 321. No original phantom-Saturday reproduction or incident root cause claimed; deployed schedule/exception data may still require comparison.|

### Findings 55–81

| # | Status | Current evidence, cause and remaining limit |
|---|---|---|
|55|implemented-awaiting-browser|Screenshot targets booking-confirmation ticket wrapper. `tickets/visit-ticket.css` presentation changes center the screen container; print/QR geometry must remain unchanged and be rechecked.|
|56|implemented-awaiting-browser|R patient Editor now explains active booking selection, inactive historical retention and distinction from linked login credentials. Verify discoverability in actual edit/create dialogs.|
|57|implemented-awaiting-browser|C Booking patient CareLookup now requests active patients; test manual/stale selection and authoritative API rejection without changing patient visibility rules.|
|58|held-product-decision|Historical consent investigation/proposal remains; no new consent capture/link or receptionist-consent policy authorized. Explain actual stored consent provenance before changing workflow.|
|59|verified-with-test-evidence|321 passes scoped appointment rows/counts before status/pagination and 600-record isolation/filter tests; C All visits clears stale date bounds. Exact original four-record UI case is not independently reproduced.|
|60|verified-with-test-evidence|321 passes private detail notes/reasons/check-in rendering and honest missing-note/timestamp behavior. AppointmentRows/SessionQueue reuse presentation and detail callers; long-note hover/mobile access remains visual scope.|
|61|verified-with-test-evidence|Authorized visit-linked patients registered elsewhere were excluded by generic registration-only location filters. Coordinated queryPage repair matches registration or same authorized visit while preserving readScope/operational/own-doctor restrictions. Isolated role/status/pagination SQL scenarios pass; original Deepa record/actor/deployed data remains inaccessible, so exact UAT incident cause is not certified.|
|62|verified-with-test-evidence|321 passes shared future-DOB validation and formatted parser overflow rejection; R invokes validator/input. Fixture browser also blocks invalid 31 Feb booking progression. Every DOB browser variant is not claimed.|
|63|verified-with-test-evidence|321 passes “date of birth blocks future and computes age”; R watches DOB/read-only age and retains age-only legacy values. Uncovered birthday/timezone cases remain test extensions, not missing implementation.|
|64|implemented-awaiting-browser|Public booking now says “Sign in to your account” while preserving immediate guest booking. Current optional-sign-in copy recommendation is done; no new account/contact gate authorized. Browser discoverability is not certified.|
|65|blocked-external|Workspace reset flow is implemented and mail errors sanitized; actual deployed “Service unavailable” requires UAT configuration/provider/deployed-route evidence. No real reset/send executed.|
|66|verified-with-test-evidence|API appointment/guest creation calls `lib/appointment-confirmation.ts` through existing SMTP/template. Outcomes persist in appointment JSON; notification setting/no-recipient/failure/unknown remain honest and do not undo booking. Main reports six fake-transport tests passed. Provider acceptance is not inbox delivery; no new SMS/center.|
|67|verified-with-test-evidence|321 passes shared settings roundtrip for both admins, foreign staff denial and owner-only generic update guards. Original selected-clinic/save failure is not reproduced; obtain exact rejected payload before changing ownership rules.|
|68|existing-behavior-verified|R operation deactivates and refreshes with truthful feedback; it is not physical deletion. Original expectation needs active/All filter comparison, not a presumed failed delete. Hard deletion remains held under 88.|
|69|held-product-decision|Cross-clinic doctor check-in rules must be investigated with authoritative session/date/presence context; no global cross-clinic prohibition introduced.|
|70|verified-with-test-evidence|321 passes “unique clinic-local running session is the default, but explicit choices and ambiguity win”; SessionSelector uses helper. Distinct snapshots remain preserved rather than blindly selecting first option.|
|71|implemented-awaiting-browser|SessionSelector distinguishes current, upcoming/other and historical schedule context instead of labeling every option current. Check multiple same-day sessions.|
|72|implemented-awaiting-browser|C Booking confirmation includes list/back navigation; workspace breadcrumbs already exist. Original target needs browser confirmation; not a blanket claim for every detail screen.|
|73|verified-with-test-evidence|AppointmentTicket/VisitTicket uses DigiQ download naming; main reports latest ticket suite 24/24 passed including mixed clinic formats. Only assertions exercised by that suite are certified; protected ticket/QR geometry remains the requirement.|
|74|implemented-awaiting-browser|Screenshot resolves to bulk-cancel submit. BulkAppointments uses visible loading/confirmation label and danger styling; verify contrast, label and accessible name in open dialog.|
|75|implemented-awaiting-browser|Appointment action now explains unavailable rescheduling when existing canReschedule rejects called/in-consultation visits. Current explanatory recommendation is done; eligibility/server permissions unchanged. Any rule relaxation is a separate optional extension.|
|76|verified-with-test-evidence|321 passes stored numeric weekday/string options including Sunday zero and backend selected-date Sunday availability. Original Sunday-only account incident is not reproduced; no further source defect established from it.|
|77|verified-with-test-evidence|Queue GET measured with production handler/lock/full summary and1000-visit fixture:20 SQL statements for pages20/100, no attributed speedup. Five broad shared-membership catalog reads are diagnosed, not silently rewritten. Network/render/load/deployed latency remain unmeasured; skeletons alone do not certify speed.|
|78|implemented-awaiting-browser|SessionQueue quick-switch section now explains viewing another doctor's session, distinct from calling/check-in. Screenshot target is resolved; keyboard/mobile discoverability awaits final pass.|
|79|implemented-awaiting-browser|AdminListing and BulkAppointments use consolidated result summary/shared toast with partial failures. Verify no duplicate per-item success toasts under mixed outcomes.|
|80|implemented-awaiting-browser|SessionQueue immediately previews candidate token as requesting/awaiting-server, scope-binds feedback and clears pending presentation after response/failure; authoritative queue refresh remains. This deliberately does not falsely mark a patient called before server approval. Literal optimistic committed queue-state mutation is not implemented; latency improvement unmeasured.|
|81|implemented-awaiting-browser|AppDialog blocks dismissal while saving, exposes disabled close and busy semantics; historical browser saving-close passed, pending-save Escape was not independently verified. Retest after newer caller changes.|

### Findings 82–107

| # | Status | Current evidence, cause and remaining limit |
|---|---|---|
|82|implemented-awaiting-browser|Screenshot is exception Session: “optional/all” contradicted existing server requirement for multi-session timing override. R ExceptionSessionInput now determines requirement from date sessions, marks required and validates inline; all-session closure remains allowed.|
|83|implemented-awaiting-browser|Existing positive-integer minimum and helper are present. Current policy recommendation is satisfied without inventing a general maxTokens maximum or borrowing duration-setting1000. A new maximum is optional policy scope, not a required missing implementation.|
|84|implemented-awaiting-browser|Existing nonnegative-integer minimum and units/helper are present. No general bufferMinutes maximum is in the current API contract; a maximum would require separate policy approval. Browser validation presentation remains unverified.|
|85|verified-with-test-evidence|321 passes report query allowlist/search/sort, draft appointment/report filter wiring and scoped SQL filtering tests. C/API pass grouping/doctor/clinic/search/sort together; specific UAT dataset remains unreproduced.|
|86|verified-with-test-evidence|321 passes “reported 13 visits reconcile including the two unlisted outcomes”, residual UI/CSV parity and explicit inconsistent-total errors. Active/other buckets account for missing outcomes rather than hiding discrepancies.|
|87|implemented-awaiting-browser|Local-master category/search/active/empty SQL tests pass. R/SuggestionInput distinguish empty versus unavailable requests, show actual friendly error plus Retry, preserve manual text and explain local catalog (not geocoder). No speculative catalog seeding. Original UAT category inventory/response and interactive rendering remain unverified; see remaining diagnostics.|
|88|implemented-awaiting-browser|Current recommended deactivate-with-history behavior and truthful R/U wording are already done. No permanent-delete/retention change was authorized; that optional extension is separate from completed current scope.|
|89|verified-with-test-evidence|Same measured local list investigation/repair as23: doctor20 median improves54% in the stated fixture only, with real SQL scope/privacy and query-budget assertions. Original UAT, network and browser timing remain unproven.|
|90|held-product-decision|Family-member booking remains proposal only; relationship/consent/identity and patient-access data impact unresolved. No implicit registration on another person's behalf added.|
|91|existing-behavior-verified|Receptionist role exists and U staff tabs/role-specific creation support it; no new role needed. Verify access/navigation discovery for the reported account, not permission expansion.|
|92|blocked-external|Same deployment/delivery limit as 65. Workspace reset implementation and isolated tests do not prove authoritative UAT forgot-password delivery.|
|93|implemented-awaiting-browser|Manual auth wrapper reads actual Retry-After and patient login displays the resulting cooldown/countdown. Current retry explanation is implemented; no fabricated wait or rate-limit bypass. Emergency process remains an optional policy extension; countdown interaction awaits browser evidence.|
|94|verified-with-test-evidence|321 passes consultation check-in detail/presentation and missing-timestamp handling; AppointmentRows/details use record format. This timestamp is consultation check-in, not presumed physical arrival.|
|95|verified-with-test-evidence|321 passes real SQL reservation order/explicit skip, CURRENT/NEXT generated wire response and independent queue contention/skip-vs-check-in tests. Original absent-promotion screen incident is not reproduced; full suite supports existing ordering, not a business-rule change.|
|96|verified-with-test-evidence|Shared presentation guard hides completed tickets; main's fixture browser explicitly confirmed completed row has no Ticket action. Latest ticket suite 24/24 also passed; no hidden action is claimed for untested variants.|
|97|implemented-awaiting-browser|ClinicRegistrationHours and doctor WeeklyOverview callers expose copy-to-all and selected-days; schedule UX retains exact typed minutes and clinic bands. Verify partial failure/overlap handling and protected linked changes.|
|98|held-product-decision|Multiple clinic assignments already exist; cross-clinic schedule overlap/operational access rules remain. Recommendations do not authorize new simultaneous-consultation behavior.|
|99|implemented-awaiting-browser|LinkedScheduleControls labels were reconciled without removing review/apply safeguards. Merging protected review steps remains product-held.|
|100|implemented-awaiting-browser|U assignment labels and R location picker/filter labels now use Clinic/Clinic Group; shared title mappings distinguish parent and location. Internal identifiers remain intentionally unchanged; final visible-string sweep required.|
|101|implemented-awaiting-browser|R location Editor explains physical care location within Clinic Group, address/timezone/hours/link and contact inheritance versus staff login/notification configuration. Current helpers replace the identified ambiguity; browser discoverability remains.|
|102|implemented-awaiting-browser|Location helper now explicitly explains no standalone clinic/location login: named staff use accounts, assignments and invitations. Current clarification is done, not an SMTP gap or a requirement for shared clinic passwords.|
|103|implemented-awaiting-browser|C appointment/report filter callers and R schedules/exceptions expose Doctor selectors; role-fixed doctor scope is preserved. Verify every relevant table from original listing inventory.|
|104|implemented-awaiting-browser|Entity-specific status-effects helpers are done and explain actual access/history consequences without promising delivery. Automatic recipient/channel notifications are a separate optional extension, not a required unimplemented helper.|
|105|implemented-awaiting-browser|C Workspace page heading now owns dashboard primary booking CTA; Dashboard list uses full width and former booking side card is removed. Exact requested placement is wired, awaiting visual check.|
|106|verified-with-test-evidence|Unsupported mobileVerified patient listing/export column was removed in source; current fixture browser confirms no unsupported badge on the patient listing. Database/verification behavior unchanged; no SMS service authorized. Export removal is source-traced, not a separate browser export check.|
|107|implemented-awaiting-browser|Screenshot refers to reschedule/skip/cancel reasons. API appointment serialization plus AppointmentRows/AppointmentDetails surface stored reasons/history, avoiding actor IDs for patients; verify each action and legacy empty history.|

### Authentication review 108–137

These are review/conditional-remediation tasks, not 30 independently demonstrated defects. Fixed-duration JWT is opt-in; native default, existing IDs/hashes/roles/ownership remain. No activation or live UAT test is asserted.

| # | Status | Current evidence, cause and remaining limit |
|---|---|---|
|108|blocked-external|Workspace supports explicit JWT/native selection; actual manually changed UAT build/token middleware still unavailable for comparison. No deployed parity conclusion.|
|109|held-product-decision|Current option retains fixed 12-hour database-backed lifetime/cookie transport. Proposed 15-minute access plus renewal is not approved/implemented.|
|110|verified-with-test-evidence|Historical authentication/JWT suite in progress report passed strict algorithm/signature/issuer/audience/type/timestamps and identity checks. Live activation not tested.|
|111|verified-with-test-evidence|Disposable coordinated single-key cutover/compromise rehearsal passed in33/33 auth-retirement run: old-key rejection, new-key fixed12h login, database revocation and rollback-resurrection hazard/cutoff. Overlap/refresh is not required by current policy. Actual key activation/replacement remains authorized operator scope; native default unchanged.|
|112|implemented-awaiting-browser|Auth routes use shared session issuance across login, challenge, invitation, registration, patient and demo paths; current transaction-aware changes need full end-to-end matrix, not just helper inspection.|
|113|verified-with-test-evidence|Historical isolated JWT middleware tests preserve live-session/active-account checks and strict mode handling. Not deployed UAT proof.|
|114|held-product-decision|No refresh credentials/rotation/reuse model added. Depends on short-access policy and separately approved schema; fixed-duration session does not silently renew.|
|115|implemented-awaiting-browser|Password transactions revoke sessions; session issuance shares credential lock, protecting concurrent login/reset. Logout/deactivate/demo revocation still require full current matrix.|
|116|verified-with-test-evidence|Isolated lifecycle tests cover protected401 cache/identity clearing,60-second single-flight status and cross-tab/stale/abort safety. Fixture browser401 reached sign-in after one POST/no retry; current cross-tab logout with fake shared-server auth/BroadcastChannel sends other private tab to sign-in, no rebroadcast loop after1s. Real-server revocation only isolated-tested, not live UAT. No renewal required in fixed-duration mode.|
|117|verified-with-test-evidence|AuthStatus OpenAPI CSRF contract corrected; generated/manual metadata and “auth status requires no CSRF token…” contract test pass in 321. Main additionally reports seven CSRF tests passed separately; they are not added to 321. No claim of universal API security certification.|
|118|verified-with-test-evidence|Historical password-rule tests passed eight-character letters/numbers policy; Argon2id preserved. New forms call shared policy; no forced reset of existing valid hashes.|
|119|verified-with-test-evidence|API native-auth/auth routes serialize credential changes and session issuance with transaction advisory locks, atomic challenge consumption and session invalidation. Main reports 13 contention tests passed, including login/reset ordering and rollback; not live deployment verification.|
|120|verified-with-test-evidence|Password-update transaction consumes outstanding setup/reset credentials and revokes sessions under same user lock; main-reported 13-test contention suite covers token replay/rollback and supersession. No credential data exposed.|
|121|implemented-awaiting-browser|RR administrator-assisted reset removes target-account rate-limit call while retaining request/IP/token protections. Review parity with forgot-password policy in tests.|
|122|verified-with-test-evidence|`consumeRateLimit` uses database atomic upsert; SMTP test limiter uses it. Main-reported contention suite covers independent-client limit enforcement and resend concurrency. Complete endpoint inventory/production topology review remains.|
|123|blocked-external|Development read-only normalized-email collision groups/accounts0/0; actual UAT/VPS inventory unverified. No uniqueness migration or automatic merge performed; clean current aggregates do not prove atomic uniqueness.|
|124|held-product-decision|Verified email-change notifications and revocation policy remain approval-held; do not silently treat general profile update as verified ownership change.|
|125|verified-with-test-evidence|Repository retirement complete: unreachable device form/helper removed; verify-device tombstone410 issues no credentials/cookie/email and retains CSRF/origin/no-store. Historical valid challenges cannot grant access.33/33 rehearsal covers retired path and SMTP-independent staff login; deployed stale callers remain unverified.|
|126|blocked-external|Development aggregate inventory complete:14/14 active staff lack password material; role/mapping/counts preserved. This is DEVELOPMENT-only and not evidence about published accounts. Actual-target enrollment/password/invitation readiness remains external; no resets performed.|
|127|blocked-external|Controlled former-provider native enrollment not exercised against actual affected accounts. Preserve IDs/native hashes and obtain target deployment inventory first.|
|128|held-product-decision|No refresh/session schema change inferred from UI approval. Display preferences only use parent JSON; other auth schema requires separate approval.|
|129|verified-with-test-evidence|Repository device/provider compatibility inventory and safe retirement complete; dead helper/commented provisioning removed and stale operator copy corrected. Defensive guards/tombstones/redaction plus historical mappings/schema/audits preserved.33/33 rehearsal includes source retirement assertions; actual provider configuration remains unmodified/unverified.|
|130|blocked-external|Unused Clerk configuration retirement depends on verifying target deployed build. No provider tenant/account/config deletion performed.|
|131|held-product-decision|Explicit session cutoff/re-login and compatible rollback require deployment approval; no indefinite native/JWT/provider fallback added.|
|132|verified-with-test-evidence|Historical321 passes strict JWT issuance/tampering/claims/expiry/revocation/native-no-fallback plus contention races;33/33 retirement rehearsal now covers current single-key cutover/compromise response. Refresh/reuse/overlap remains conditional optional policy, not a missing fixed-duration test requirement.|
|133|verified-with-test-evidence|321 passes native staff/patient/registration/invitation/recovery/demo, used/expired challenge, missing SMTP and provider-failure tests. Real delivery/enrollment remains external; fixture assertions do not prove live email completion.|
|134|verified-with-test-evidence|321 includes actual SQL authorization equivalence across all roles/resource families, scoped large datasets, owner-doctor, guest/QR/demo and inactive restrictions. Not a complete live-browser permission matrix; no rule changes inferred.|
|135|verified-with-test-evidence|Isolated actual HTTPS transport/cross-origin/CSRF tests pass, plus seven separate CSRF tests. Fixture protected401 reaches sign-in with one POST/no replay; additive current cross-tab logout/BroadcastChannel passes with fake shared-server auth and no1s rebroadcast loop. Patient notice/reload/link also fixture-pass with waiting request/no client patientID. Actual server revocation remains separate isolated evidence; deployed proxy/authenticated UAT parity unverified.|
|136|blocked-external|Exact UAT/VPS deployed revisions, scripts, proxy, migrations and signing-key readiness are unavailable; do not substitute workspace build for deployment inspection.|
|137|blocked-external|Development aggregates/guard restoration and source-migrated disposable backup/restore passed (14 migrations, matching schema/counts and8 guard-rejection assertions). Actual-target backup/recoverability, real delivery/cutover and rollout monitoring remain unverified. User owns publication; local fixture evidence is not release readiness.|

### Shared-standard reconciliation (not additional findings)

- **Display schema/data:** two preference values live in parent Clinic Group JSON; Clinics inherit, retaining each timezone. Main agent reports approved **development-only default backfill of nine clinics**. Production unchanged. Default fallback does not prove all records/channels use preferences; see 17. Canonical date/time storage and ticket geometry must remain unchanged.
- **Design source:** full approved JSON unavailable. Existing tokens plus supplied approved recommendations retained; this blocks exact standard certification, not ordinary functional/copy repairs. Newly styled controls/email are not claimed pixel-certified.
- **Listings/accessibility:** U/R/appointments preserve content; reports filters/counts and queue SQL paging are tested. Source sweep inventories native finite selectors and bounded previews, repairs label/error/reflow/focus/Load-more controls and passes8/8 source contracts. This does not certify literal every-dropdown-searchable/every-collection standards, opened controls, screen readers or200%-zoom. Queue privacy/lock/full-summary behavior unchanged.
- **Schedules:** existing weekly/multiple-session/date-exception model preserved; doctor weekday overview, clinic bands, exact-minute typed input/slider and selected/all-day copy UX implemented. No approved out-of-hours, extended-day, midnight/DST or session-cap policy change inferred.
- **Notifications:** existing SMTP/template serves appointment/guest creation and persists outcome without changing booking success. Patient Dashboard notices derive from own authorized persisted appointment records, without a new center. Existing mail-enable setting remains respected. No SMS, inbox confirmation or automatic retry of uncertain sends is claimed.
- **Verification:** current root typecheck passed;333 tests verified across combined332/333 plus targeted backend-flow38/38 after fixture correction, not a clean single full run. Historical321/321, tickets24/24, seven CSRF tests and mobile/protected401 fixture checks are retained without summation. Current browser evidence is the explicit scoped list above, including passing invitation continuation; no comprehensive accessibility, all-findings browser closure or live authenticated UAT claim. No work remains running.
- **Development backfill integrity:** main reports before/after aggregate counts identical: **17 users, 9 clinics, 6 branches, 7 doctors, 3 appointments**. Only nine development Clinic JSON display defaults were backfilled; production unchanged. Migration-runner tests used a disposable database, not an additional production/development data migration.