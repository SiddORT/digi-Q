# ClinicFlow user-message approval inventory

**Audit only — no application messages or behavior changed.**

## Decision requested
Approve specific stable MSG IDs (or ask for revisions). No cleanup task or implementation is authorized by this report. “Retain” is an explicit review decision, not a recommendation to delete warnings.

## Scope and evidence

All current App.tsx route declarations are mapped below, separating Superadmin and Clinic Admin. 106 role-route/alias rows; 17 nested-state groups. Static source extraction scanned 331 non-test TS/TSX/JS modules, 275 linked from main.tsx, producing 5592 source fragments. A module being linked does not prove every export or branch is rendered. Source-index fragments also contain headings, labels and implementation strings: they are evidence candidates, not additional findings.

**Evidence:** S = source branch and render sink traced; T = isolated fictional unit/static-render check; B = browser observation. This audit has no authenticated B coverage. No clinical/private records, credentials or live provider responses were read.

**Limitations:** No runtime role sessions; no camera/QR interaction; no responsive, keyboard/touch/screen-reader acceptance; no real provider readiness/acceptance/receipt tests; no live partial writes, deletion/handoff, exports of private data or production/UAT access. Permission-policy variations, actual provider state, ownership and dynamic API reasons remain source-only. An audit of route and source coverage is not a claim that every conditional state was observed in a browser.

## Review totals

- Remove: 5
- Shorten: 60
- Move to optional help/diagnostics: 13
- Retain: 39
- Excluded (unmounted): 1

118 stable review records; 78 proposed change candidates. MSG-089 is a confirmed unmounted fallback, excluded from current visible-copy approval. Counts are grouped recommendations, not occurrence counts; one ID may have several role/page consumers.

## Priorities

### First: correct misleading or technical ordinary-user messages
MSG-063, MSG-116, MSG-113, MSG-022, MSG-023, MSG-117, MSG-038, MSG-056, MSG-110, MSG-111

Recovery no-send claim contradicts the endpoint; invitation-only provider wording; raw exception sinks; developer vocabulary. Confirm intended recovery action before approving copy.

### Next: shorten registration and shared completion
MSG-001, MSG-002, MSG-005, MSG-007, MSG-008, MSG-009, MSG-010, MSG-012, MSG-014, MSG-016, MSG-017, MSG-018, MSG-019, MSG-060, MSG-061, MSG-062, MSG-114

Includes the original email-acceptance disclaimer and unavailable optional SMS notice, without weakening required proof or receipt uncertainty.

### Then: reduce persistent explanations and operator form density
MSG-024, MSG-025, MSG-026, MSG-032, MSG-033, MSG-036, MSG-064, MSG-076, MSG-078, MSG-080, MSG-086, MSG-087, MSG-090, MSG-091, MSG-092, MSG-096, MSG-112

Remove routine reassurance; move methodology/protocol to optional context. Preserve operator troubleshooting and source/time of results.

### Keep consequential messages visible
MSG-003, MSG-004, MSG-006, MSG-011, MSG-015, MSG-020, MSG-027, MSG-028, MSG-034, MSG-035, MSG-040, MSG-043, MSG-045, MSG-046, MSG-051, MSG-053, MSG-055, MSG-068, MSG-071, MSG-073, MSG-074, MSG-075, MSG-077, MSG-079, MSG-081, MSG-083, MSG-088, MSG-097, MSG-098, MSG-100, MSG-104, MSG-105, MSG-106, MSG-107, MSG-115, MSG-118

No global warning suppression, false-success wording or unqualified delivery claims.
## Inventory by page family


### Registration and authentication


#### MSG-001 — Shorten
- **Roles:** Guest → new Clinic Admin; staff on legacy setup; mobile-verifying guest
- **Page / section:** Register clinic → Verify email; set password completion; staff setup summary
- **Trigger:** Email outcome is provider_accepted
- **Current wording / exact source pattern:** "Provider accepted the message; delivery is not confirmed."
- **Source:** `artifacts/clinicflow/src/auth/SecurityChannelNotice.tsx:3`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Email accepted for sending. Check your inbox; arrival isn’t confirmed.
- **Reason / safeguard:** Keep the distinction between acceptance and receipt; remove provider terminology from ordinary-user copy. The channel and masked destination remain.


#### MSG-002 — Shorten
- **Roles:** Guest → new Clinic Admin; optional mobile-verifying guest
- **Page / section:** Register clinic → Verify email → optional SMS
- **Trigger:** Optional SMS status unavailable
- **Current wording / exact source pattern:** "Unavailable. Approved template and provider configuration may be required."
- **Source:** `artifacts/clinicflow/src/auth/SecurityChannelNotice.tsx:7`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** SMS is unavailable. You can continue with email verification.
- **Reason / safeguard:** The original registration example. Provider/template setup is an operator concern; optional SMS must not look like a required blocker. Use this replacement only in optional registration, not required SMS login or clinic prerequisites.


#### MSG-003 — Retain
- **Roles:** All users of SecurityChannelNotice and staff setup summary
- **Page / section:** Registration, password setup and staff legacy completion
- **Trigger:** Rejected, not sent, uncertain, disabled and not-requested channel outcomes
- **Current wording / exact source pattern:** "Outcome uncertain. Wait and check before requesting another message."
- **Source:** `artifacts/clinicflow/src/auth/SecurityChannelNotice.tsx:6`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** No change to uncertainty/retry warning. Optionally use “Delivery is uncertain. Check before requesting another message.”
- **Reason / safeguard:** Do not suppress uncertain outcomes or invite unsafe retries. Rejected/not-sent/disabled remain explicit; not_requested may be omitted only for a genuinely optional unrequested channel, after approval.


#### MSG-004 — Shorten
- **Roles:** All roles when a security action is disabled
- **Page / section:** Authentication and security action errors
- **Trigger:** SECURITY_DELIVERY_DISABLED mapped by friendlyError
- **Current wording / exact source pattern:** "Delivery for this action is disabled by the System Admin. Verification is still required; no message was sent. Contact the System Admin."
- **Source:** `artifacts/clinicflow/src/lib/friendly-error.ts:70`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** No message was sent because this verification channel is disabled. Verification is still required. Contact the System Admin.
- **Reason / safeguard:** Keep security gating and no-send fact visible; not an optional warning filter.


#### MSG-005 — Move to optional help/diagnostics
- **Roles:** Guest creating Clinic Admin
- **Page / section:** Register clinic → details/review/verify
- **Trigger:** Temporary account draft saved
- **Current wording / exact source pattern:** "Name, email and stage are temporarily saved in this tab for up to 24 hours. Re-enter passwords and codes after reload."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistration.tsx:143`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Inline: “Draft saved in this tab.” Help: “Saved for up to 24 hours. Passwords and codes must be re-entered after reload.”
- **Reason / safeguard:** Routine persistence detail dominates the form. Keep storage-unavailable and recovery failures visible.


#### MSG-006 — Retain
- **Roles:** Guest creating Clinic Admin
- **Page / section:** Register clinic → account draft
- **Trigger:** Browser storage unavailable
- **Current wording / exact source pattern:** "Browser storage is unavailable. Details remain only while this page is open."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistration.tsx:143`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Real risk of losing progress; not equivalent to ordinary saved-draft status.


#### MSG-007 — Remove
- **Roles:** Guest creating Clinic Admin
- **Page / section:** Register clinic → review → Password
- **Trigger:** Normal password review summary
- **Current wording / exact source pattern:** "Entered securely. Not displayed in this summary."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistration.tsx:133`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Use “Entered” or a masked value.
- **Reason / safeguard:** Explains an expected implementation detail rather than the user’s next step; do not reveal the password.


#### MSG-008 — Shorten
- **Roles:** Guest creating Clinic Admin
- **Page / section:** Register clinic → details and optional mobile proof
- **Trigger:** Optional mobile helper and proof explanation
- **Current wording / exact source pattern:** "Email verification is still required. You may continue without verifying a mobile. Only a verified mobile is saved for a new account. Existing accounts keep their saved mobile."
- **Source:** `artifacts/clinicflow/src/auth/RegistrationMobileProof.tsx:35`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Mobile verification is optional. Email verification is required. Only a verified mobile is added; existing accounts keep their saved number.
- **Reason / safeguard:** Keep contact-saving consequences and independent proof, remove repetition across the field and fieldset.


#### MSG-009 — Shorten
- **Roles:** Guest verifying optional mobile
- **Page / section:** Register clinic → mobile proof
- **Trigger:** Mobile verification succeeds
- **Current wording / exact source pattern:** "Mobile verified for this registration intent."
- **Source:** `artifacts/clinicflow/src/auth/RegistrationMobileProof.tsx:36`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Mobile verified.
- **Reason / safeguard:** “Registration intent” is internal terminology; authentication still depends on required email proof.


#### MSG-010 — Shorten
- **Roles:** Guest creating Clinic Admin
- **Page / section:** Register clinic → account footer
- **Trigger:** Always shown
- **Current wording / exact source pattern:** "This journey creates a new clinic-owner account."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistration.tsx:147`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** For new clinic owners. Already have a staff account? Sign in. Patient accounts can’t be converted here.
- **Reason / safeguard:** Keep eligibility restriction and existing-account path; remove journey terminology. Current following sentences remain part of this finding, not a proposal to remove the restriction.


#### MSG-011 — Retain
- **Roles:** Guest creating Clinic Admin
- **Page / section:** Register clinic → verification resume / resend
- **Trigger:** Expired challenge, reload, newest code
- **Current wording / exact source pattern:** "Verification could not be resumed. Your name and email are retained; re-enter your password to request a code."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistration.tsx:64`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Actionable recovery. Retain latest-code invalidation, invalid/expired challenge, cooldown and credential re-entry facts.


#### MSG-012 — Shorten
- **Roles:** Clinic Admin; Superadmin creating a clinic
- **Page / section:** Clinic setup wizard → draft status
- **Trigger:** Draft persistence explanation
- **Current wording / exact source pattern:** "Temporary setup saved in this browser tab for up to 24 hours. It is not a saved clinic. Passwords are never stored."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistrationWizard.tsx:216`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Draft saved in this tab; clinic not created yet.
- **Reason / safeguard:** Move 24-hour retention and no-password-storage details to adjacent help. Keep the “not a saved clinic” distinction visible.


#### MSG-013 — Shorten
- **Roles:** Clinic Admin; Superadmin
- **Page / section:** Clinic setup → URL validation and finish
- **Trigger:** Slug conflict before save
- **Current wording / exact source pattern:** "A Clinic URL name or Location URL name was taken before creation. Check Clinic identity and Locations; change the URL name or clear it and Continue to generate another. Review all links before finishing. Nothing is retried automatically."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistrationWizard.tsx:188`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** A clinic or location URL is no longer available. Change or clear it in Clinic identity or Locations, then continue and review the new links before finishing.
- **Reason / safeguard:** Retain the failure and deliberate retry. Technical word “slug” is not currently shown here; do not invent one.


#### MSG-014 — Move to optional help/diagnostics
- **Roles:** Clinic Admin; Superadmin
- **Page / section:** Clinic setup → Your practice / review
- **Trigger:** Owner also consults
- **Current wording / exact source pattern:** "The owner remains the sole Clinic Admin. A doctor profile adds clinical capabilities to this same account; it does not create another login or switch roles."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistrationWizard.tsx:243`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** One owner account can also consult as a doctor.
- **Reason / safeguard:** Keep full account/role explanation in help; selected practice mode and actual session-creation summary remain visible.


#### MSG-015 — Retain
- **Roles:** Clinic Admin; Superadmin
- **Page / section:** Clinic setup → finish and completion
- **Trigger:** Checking whether creation committed / reconciliation failed
- **Current wording / exact source pattern:** "Could not check saved registration. No new creation will be attempted."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistration.tsx:211`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Prevents duplicate clinics following an uncertain response. No success wording should replace an unresolved result.


#### MSG-016 — Shorten
- **Roles:** Clinic Admin; Superadmin
- **Page / section:** Clinic registration shared completion → booking readiness
- **Trigger:** Linked consultations saved
- **Current wording / exact source pattern:** "Linked doctor sessions saved for ${linked.length} location(s); opening hours are your consultation timetable. Check a future date before sharing the QR; capacity and booking rules still apply."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistrationComplete.tsx:21`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Consultation sessions saved for ${linked.length} locations. Check an available future date before sharing the QR.
- **Reason / safeguard:** Current text is a dynamic template pattern, not a witnessed registration. Preserve conditional no-doctor/no-session guidance separately; do not imply opening hours always create availability.


#### MSG-017 — Shorten
- **Roles:** Superadmin creating Clinic Admin; Clinic Admin completion
- **Page / section:** Clinic registration completion → invitation result
- **Trigger:** Legacy invitation accepted or uncertain
- **Current wording / exact source pattern:** "The provider accepted the account invitation email. Inbox delivery is not confirmed."
- **Source:** `artifacts/clinicflow/src/components/ClinicRegistrationComplete.tsx:22`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Invitation accepted for sending. Check receipt before sending another link.
- **Reason / safeguard:** Clinic saved and invitation result are separate; failed/unknown invitation must remain explicit. Ordinary self-registration does not automatically receive this optional prop.


#### MSG-018 — Shorten
- **Roles:** Patient / guest
- **Page / section:** Patient login → email/SMS code
- **Trigger:** Eligible account code requested
- **Current wording / exact source pattern:** "If this account is eligible, a code has been requested. Provider acceptance and delivery are not confirmed here."
- **Source:** `artifacts/clinicflow/src/auth/PatientLogin.tsx:62`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** If your account is eligible, check your email or SMS for a code. Arrival isn’t confirmed.
- **Reason / safeguard:** Preserve anti-enumeration and uncertain delivery; do not say “Code sent” or reveal whether an account exists.


#### MSG-019 — Shorten
- **Roles:** Staff, including Superadmin/Clinic Admin/doctor/receptionist
- **Page / section:** Set password / accept invitation → completion
- **Trigger:** Password saved; result authenticated
- **Current wording / exact source pattern:** "Your password is saved. Notification failure does not undo setup."
- **Source:** `artifacts/clinicflow/src/auth/PasswordFlows.tsx:79`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Password saved. You can continue to your workspace.
- **Reason / safeguard:** Keep the actual separate failed/unknown channel notice if returned. Do not reassure about a failure when none was reported.


#### MSG-020 — Retain
- **Roles:** Staff
- **Page / section:** Forgot password → requested result
- **Trigger:** Request accepted without exposing eligibility
- **Current wording / exact source pattern:** "If the account exists, check your email for a password reset link."
- **Source:** `artifacts/clinicflow/src/auth/PasswordFlows.tsx:34`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Appropriate anti-enumeration status; it does not confirm actual receipt.


#### MSG-113 — Shorten
- **Roles:** Guest healthcare provider; signed-in onboarding doctor intent
- **Page / section:** Register doctor / onboarding → provider invitation
- **Trigger:** Provider account introduction
- **Current wording / exact source pattern:** "Healthcare providers need an invitation from their clinic administrator."
- **Source:** `artifacts/clinicflow/src/App.tsx:61`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Ask your clinic administrator to set up your staff account.
- **Reason / safeguard:** Direct email/password creation is also supported in Users; invitation-only wording may mislead. Keep provider self-signup restriction. Mirror in onboarding’s invitation instruction; do not change account creation behavior.


### Shared shell, errors and controls


#### MSG-021 — Shorten
- **Roles:** All signed-in roles
- **Page / section:** Secure access gate
- **Trigger:** Current session lacks required staff-password verification
- **Current wording / exact source pattern:** "Your current session does not include staff password verification. Sign out and sign in with your staff password."
- **Source:** `artifacts/clinicflow/src/auth/AuthAccess.tsx:14`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Sign out, then sign in with your staff password to continue.
- **Reason / safeguard:** Keep restriction and next action. Do not remove the gate or enable access.


#### MSG-022 — Shorten
- **Roles:** All signed-in roles
- **Page / section:** Secure access gate → retry
- **Trigger:** status.error branch
- **Current wording / exact source pattern:** "Unable to verify access:"
- **Source:** `artifacts/clinicflow/src/auth/AuthAccess.tsx:50`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Unable to verify your access. Try again.
- **Reason / safeguard:** Current rendered pattern appends status.error.message directly. Native auth errors are usually already safe, but this sink is not independently translated; technical exposure is a source-level possibility, not observed live leakage.


#### MSG-023 — Shorten
- **Roles:** All signed-in roles
- **Page / section:** Global workspace search → per-source error
- **Trigger:** A category search fails
- **Current wording / exact source pattern:** "Unable to search ${SOURCE_LABEL[source].toLowerCase()}${error instanceof Error && error.message ? ` (${error.message})` : \"\"}. Access may be restricted or the service unavailable."
- **Source:** `artifacts/clinicflow/src/components/WorkspaceSearch.tsx:147`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Unable to search ${category}. Try again or check your access.
- **Reason / safeguard:** Direct exception message interpolation can produce verbose technical text. Keep category and retry; do not expose raw responses. Finding is a source sink, not proof of an actual secret or HTTP leak.


#### MSG-024 — Remove
- **Roles:** All signed-in roles
- **Page / section:** Sidebar / topbar / footer
- **Trigger:** Routine workspace chrome
- **Current wording / exact source pattern:** "Secure workspace"
- **Source:** `artifacts/clinicflow/src/clinic.tsx:210`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Decorative reassurance supplies no task-specific action. Independent location, role and sign-out controls must remain.


#### MSG-025 — Move to optional help/diagnostics
- **Roles:** All signed-in roles
- **Page / section:** Sidebar → live updates
- **Trigger:** Always shown
- **Current wording / exact source pattern:** "Live queue updates."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:210`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Keep “Refresh after reconnecting before acting on a visit” in contextual help.
- **Reason / safeguard:** Routine live-update reassurance is not a freshness guarantee. Keep real offline/stale banners visible. Patient variant is “Bookings update automatically.”


#### MSG-026 — Move to optional help/diagnostics
- **Roles:** All signed-in roles
- **Page / section:** Workspace footer
- **Trigger:** Always shown
- **Current wording / exact source pattern:** "All times follow your clinic's configured timezone."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:212`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Show relevant timezone beside dates/session selection; full explanation in help.
- **Reason / safeguard:** Generic footer repeats contextual date help and may not describe every page’s reporting timezone. Do not remove actual timezone labels.


#### MSG-027 — Retain
- **Roles:** All roles
- **Page / section:** Shared ErrorNotice, translated toasts and field errors
- **Trigger:** Network, 401/403/404/429/5xx, safe validation
- **Current wording / exact source pattern:** "Unable to reach DigiQ. Check your connection and try again."
- **Source:** `artifacts/clinicflow/src/lib/friendly-error.ts:15`
- **Evidence:** T: friendly-error tests + S: ErrorNotice/notify/auth-request callers
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Concise actionable failures. Safe human API messages and field errors can pass through; technical/stack/JSON text is filtered. No proposal for a global hide-errors filter.


#### MSG-028 — Retain
- **Roles:** All roles using forms
- **Page / section:** Field validation and native-validity adapters
- **Trigger:** Required, email, phone, password, numeric/date constraints
- **Current wording / exact source pattern:** "This field is required"
- **Source:** `artifacts/clinicflow/src/lib/validators.ts:8`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Necessary corrections. Keep local country/phone requirements, password checklist and invalid dates; do not hide validation in help.


#### MSG-029 — Shorten
- **Roles:** All roles after rendering failure
- **Page / section:** App-wide production error fallback
- **Trigger:** Error boundary catches an exception
- **Current wording / exact source pattern:** "This part of the app hit an error. The rest of the app is still"
- **Source:** `artifacts/clinicflow/src/components/error-boundary.tsx:46`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** This page couldn’t be displayed. Try again.
- **Reason / safeguard:** Boundary wraps the whole App; claiming the rest is still running may be misleading. Raw error.message is DEV-only and is excluded from production findings.


#### MSG-030 — Retain
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist; patient
- **Page / section:** List search, filters, dropdowns and selected-name lookup
- **Trigger:** No options / failed lookup / partial selected labels
- **Current wording / exact source pattern:** "Unable to load selected names. Your selection has been retained."
- **Source:** `artifacts/clinicflow/src/components/ResourceLookup.tsx:152`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Useful distinction between lost eligibility and failed name loading. Keep retry, no-scope options, unavailable selection and partial-load errors.


#### MSG-031 — Retain
- **Roles:** All roles with table controls
- **Page / section:** Columns / saved views → help and dialogs
- **Trigger:** Normal layout help
- **Current wording / exact source pattern:** "One column can be pinned to the left at a time; pinning another replaces it."
- **Source:** `artifacts/clinicflow/src/components/ListingViewControls.tsx:27`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Already optional, relevant control help; not unnecessary diagnostic content. Preserve private-data warning when naming saved views.


#### MSG-032 — Shorten
- **Roles:** All signed-in roles
- **Page / section:** Notifications drawer → bottom scope note
- **Trigger:** Unread/list bounds
- **Current wording / exact source pattern:** "Latest 60 appointment and queue updates and 30 system updates from the last 30 days. Unread counts and Mark All as Read apply to this list."
- **Source:** `artifacts/clinicflow/src/components/NotificationsPanel.tsx:51`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Showing recent updates from the last 30 days. Mark All as Read applies to this list.
- **Reason / safeguard:** Put exact 60/30 caps in adjacent help; preserve the list-limited action meaning.


#### MSG-033 — Move to optional help/diagnostics
- **Roles:** All signed-in roles
- **Page / section:** Global search → shortcuts
- **Trigger:** Normal storage explanation / storage unavailable
- **Current wording / exact source pattern:** "Favorites and recent pages are saved on this device; patient results and search terms are not saved."
- **Source:** `artifacts/clinicflow/src/components/WorkspaceSearch.tsx:228`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Keep in shortcut information help.
- **Reason / safeguard:** Useful privacy detail, not a standing search instruction. Retain the distinct storage-unavailable warning if persistence fails.


#### MSG-034 — Retain
- **Roles:** All staff and patients using edits
- **Page / section:** Dialogs, tab navigation, location switching, browser unload
- **Trigger:** Unsaved changes / destructive operations / pending save
- **Current wording / exact source pattern:** "You have unsaved changes on this page. Switching location discards them and clears the selected doctor and session."
- **Source:** `artifacts/clinicflow/src/components/WorkspaceBranch.tsx:76`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** User-consequential confirmation. Preserve AppDialog, ConfirmDialog and leave-guard warnings and whether drafts are retained or discarded; do not replace them all with a generic confirmation.


#### MSG-035 — Retain
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** Location scope gate
- **Trigger:** No active assignment, several clinics or loading failure
- **Current wording / exact source pattern:** "Your locations could not be loaded, so location-specific data is hidden."
- **Source:** `artifacts/clinicflow/src/components/WorkspaceBranch.tsx:121`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** A permission/readiness boundary is not an empty result or a technical distraction.


#### MSG-110 — Shorten
- **Roles:** All API-consuming forms
- **Page / section:** Shared API → ErrorNotice / field validation
- **Trigger:** Human 4xx validation or integrity conflict passes safety translator
- **Current wording / exact source pattern:** "Invalid input: "
- **Source:** `artifacts/api-server/src/lib/http.ts:62`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Check the highlighted fields. ${fieldLabel}: ${specificCorrection}
- **Reason / safeguard:** Current dynamic backend pattern joins raw issue paths/messages with semicolons. May reach UI through customFetch → friendlyError/fieldErrorsFrom if safe and under 240 characters. Exact runtime Zod text depends on input; not every backend exception is visible.


#### MSG-111 — Shorten
- **Roles:** All roles permitted to update referenced records
- **Page / section:** Shared API → visible save error
- **Trigger:** Database integrity conflict
- **Current wording / exact source pattern:** "Record conflicts with existing data or references"
- **Source:** `artifacts/api-server/src/lib/http.ts:62`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** This record conflicts with existing information. Refresh and review it before trying again.
- **Reason / safeguard:** Preserve conflict/failure, never show “Saved”. Do not invent a specific conflicting field when the server does not identify it.


#### MSG-115 — Retain
- **Roles:** Staff using bulk outcomes; other permitted bulk-action users
- **Page / section:** Staff bulk invitations / resource bulk status → consolidated toast
- **Trigger:** Some actions fail
- **Current wording / exact source pattern:** "and {s.failures.length - 6} more"
- **Source:** `artifacts/clinicflow/src/lib/notify.tsx:22`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Toast shows at most six failures and a remaining count. Preserve available full per-row results and success/failed counts; do not remove summary warning or describe the full batch as successful.


### Appointments, booking and queue


#### MSG-036 — Remove
- **Roles:** All signed-in roles
- **Page / section:** Dashboard → activity badge
- **Trigger:** Successful overview load
- **Current wording / exact source pattern:** "Live Data"
- **Source:** `artifacts/clinicflow/src/clinic.tsx:320`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Routine freshness badge can imply stronger timeliness than polling. Retain “Last Available” and stale/failed refresh warning.


#### MSG-037 — Shorten
- **Roles:** All signed-in roles
- **Page / section:** Dashboard → average wait help
- **Trigger:** Expanded help
- **Current wording / exact source pattern:** "Sum of recorded queue-wait minutes divided by visits with a recorded wait in this dashboard's scope."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:318`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Average recorded wait from booking or session start, whichever is later, to consultation. Not time since arrival.
- **Reason / safeguard:** Keep measurement semantics and missing-value behavior in optional methodology rather than one long tooltip.


#### MSG-038 — Shorten
- **Roles:** All signed-in roles
- **Page / section:** Appointments → stale banner
- **Trigger:** Offline or stale data disables actions
- **Current wording / exact source pattern:** "Offline or stale appointment data. Mutations are disabled until refreshed."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:405`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Appointments are offline or out of date. Refresh before making changes.
- **Reason / safeguard:** “Mutations” is developer terminology. Preserve disabled actions and Refresh button.


#### MSG-039 — Shorten
- **Roles:** All roles booking through staff/patient workspace
- **Page / section:** Book → visit details
- **Trigger:** Checking doctor assignment
- **Current wording / exact source pattern:** "Checking the selected doctor's clinic assignment. Your selection is retained."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:474`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Checking doctor availability…
- **Reason / safeguard:** Routine checking can be concise; retain separate failed/mismatched-assignment warnings and retained draft.


#### MSG-040 — Retain
- **Roles:** Doctor
- **Page / section:** Book → Patient details; Patients page
- **Trigger:** No new-patient creation permission
- **Current wording / exact source pattern:** "Doctors can book for existing patients in their scope. Ask reception or an administrator to register a new patient."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:487`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Explains the role-specific next step without implying a fault. Keep same restriction in patient directory.


#### MSG-041 — Shorten
- **Roles:** Patient
- **Page / section:** Book → required mobile prerequisite
- **Trigger:** Clinic requires independently verified mobile
- **Current wording / exact source pattern:** "This clinic explicitly requires mobile verification. Email sign-in does not verify your mobile. If the configured provider is unavailable, contact clinic staff. International format, for example +14155552671."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:489`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** This clinic requires mobile verification. Email sign-in does not verify your number. If SMS is unavailable, contact clinic staff.
- **Reason / safeguard:** Move international-format example to the phone field’s help. This is required, unlike optional registration SMS; do not remove it or permit continuation.


#### MSG-042 — Shorten
- **Roles:** Patient
- **Page / section:** Book → mobile code requested
- **Trigger:** OTP response returned
- **Current wording / exact source pattern:** "Verification requested. Expires at"
- **Source:** `artifacts/clinicflow/src/clinic.tsx:489`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Code requested. Expires ${expiry}. Arrival isn’t confirmed.
- **Reason / safeguard:** Current dynamic pattern: “Verification requested. Expires at ${formatted expiresAt}. This does not confirm message delivery.” Keep expiry and non-delivery guarantee.


#### MSG-043 — Retain
- **Roles:** All booking users
- **Page / section:** Book → review and completion
- **Trigger:** Cancellation cutoff, consent, session range, availability recheck
- **Current wording / exact source pattern:** "Cancellation closes {cutoff} minutes before the session starts, subject to visit status."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:469`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Current JSX dynamic pattern. Consequential policy and session-not-exact-time distinction are not removable boilerplate.


#### MSG-044 — Shorten
- **Roles:** Guest; patient; staff
- **Page / section:** Book → date discovery
- **Trigger:** Bounded next-date search finds nothing
- **Current wording / exact source pattern:** "No eligible advance session found from ${formatDate(nextVisitDate(from,1),preferences)} through ${formatDate(end,preferences)}. This does not rule out later sessions. Choose another date within the booking window or contact the clinic."
- **Source:** `artifacts/clinicflow/src/components/booking/BookingDiscovery.tsx:43`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** No bookable session found between ${start} and ${end}. Other dates may be available. Choose another date or contact the clinic.
- **Reason / safeguard:** Do not imply there are no weekly sessions or no later dates; retain bounded range and booking-window limits.


#### MSG-045 — Retain
- **Roles:** Guest; patient; staff
- **Page / section:** Booking / ticket confirmation → extended-hours warning
- **Trigger:** Session extends beyond usual location hours
- **Current wording / exact source pattern:** "Extended doctor hours: this session runs outside the location's usual opening hours. It is bookable; check entry arrangements with the clinic."
- **Source:** `artifacts/clinicflow/src/components/HoursWarning.tsx:4`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Actionable entry-arrangement warning. Not a reason to block allowed booking.


#### MSG-046 — Retain
- **Roles:** All booking users
- **Page / section:** Booking stage changes / token confirmation
- **Trigger:** Selected session changed after review
- **Current wording / exact source pattern:** "The selected visit changed. Choose Change Visit and review the current session before confirming."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:492`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Prevents stale confirmation; success must not be claimed before a token is issued.


#### MSG-047 — Shorten
- **Roles:** All roles with appointment rows
- **Page / section:** Appointment actions → success and explanation
- **Trigger:** Check-in/out update succeeds
- **Current wording / exact source pattern:** "Appointment updated. Check-out calls the next eligible patient; check-in starts their consultation."
- **Source:** `artifacts/clinicflow/src/components/appointments/AppointmentRows.tsx:84`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Appointment updated.
- **Reason / safeguard:** Keep operational distinction in existing action tooltip/confirmation, especially explicit check-in. Do not remove action confirmations.


#### MSG-048 — Shorten
- **Roles:** All roles viewing tickets; staff bulk exports
- **Page / section:** Ticket → QR / refresh help
- **Trigger:** Normal connected ticket
- **Current wording / exact source pattern:** "Status refreshes every 30 seconds while connected. Printed tickets do not update."
- **Source:** `artifacts/clinicflow/src/components/appointments/AppointmentTicket.tsx:59`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Printed tickets don’t update.
- **Reason / safeguard:** Move polling frequency to optional help; retain offline/stale restrictions and printed-ticket limitation.


#### MSG-049 — Move to optional help/diagnostics
- **Roles:** All ticket viewers
- **Page / section:** Ticket → privacy/validation explanation
- **Trigger:** Private QR shown
- **Current wording / exact source pattern:** "QR is for authorized staff validation, not public access to patient details. Staff check you in when your consultation begins."
- **Source:** `artifacts/clinicflow/src/components/appointments/AppointmentTicket.tsx:59`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Show under “About this QR”.
- **Reason / safeguard:** Useful privacy and check-in explanation already contextual; can be optional without hiding actual check-in restrictions.


#### MSG-050 — Shorten
- **Roles:** All roles allowed movement
- **Page / section:** Shift Time / Re-enter / Reschedule dialogs
- **Trigger:** Explain token vs position and destination
- **Current wording / exact source pattern:** "Shift Time moves this visit to a later pending position, including just one place later. Your token stays the same: a token is not a queue position, and no exact consultation time is promised."
- **Source:** `artifacts/clinicflow/src/components/appointments/MovementForm.tsx:56`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Move to a later waiting position. Your token stays the same; this does not promise an exact consultation time.
- **Reason / safeguard:** Keep called-patient release, no-displacement and failed-reschedule-original-booking protections visible; these are not diagnostic clutter.


#### MSG-051 — Retain
- **Roles:** Staff and permitted patient users
- **Page / section:** Appointments → cancel / absent / check-in/out / reschedule
- **Trigger:** Action confirmation, stale state or forbidden transition
- **Current wording / exact source pattern:** "This appointment changed. Close this dialog and review its current status."
- **Source:** `artifacts/clinicflow/src/components/appointments/AppointmentRows.tsx:107`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Keep cancellation irreversibility, cutoff recheck, explicit check-in and call release confirmations; a true transition failure cannot become a success toast.


#### MSG-052 — Shorten
- **Roles:** Staff; patients where selection permitted
- **Page / section:** Appointments → bulk selection / exports / cancellations
- **Trigger:** Page-local selection and partial failures
- **Current wording / exact source pattern:** "Only rows on this page are selected. Changing page, filters or sorting clears the selection. Rows on other pages are not included. Check-in and check-out are individual only."
- **Source:** `artifacts/clinicflow/src/components/appointments/BulkAppointments.tsx:77`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Only this page is selected. Changing page, filters or sorting clears selection. Check-in and check-out are individual.
- **Reason / safeguard:** Retain bulk result detail and individual failures, not just a global success count. Scope is a consequential limitation.


#### MSG-053 — Retain
- **Roles:** All users permitted to export tickets
- **Page / section:** Appointments → bulk ticket export result
- **Trigger:** Any selected ticket cannot be prepared
- **Current wording / exact source pattern:** "No tickets exported. All selected appointments must have an available personal QR. Review the results and retry."
- **Source:** `artifacts/clinicflow/src/components/appointments/BulkAppointments.tsx:70`
- **Evidence:** T: filtered-export tests cover failure semantics; S: bulk all-or-nothing branch
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** All-or-nothing export failure must remain. Do not deliver successful subset without explicit disclosure.


#### MSG-054 — Shorten
- **Roles:** Staff with ticket email permission
- **Page / section:** Appointment details → Email ticket dialog
- **Trigger:** Email dispatch outcome unknown
- **Current wording / exact source pattern:** "Outcome unknown. It may still arrive. Check before resending; a resend reuses the same request and will not duplicate."
- **Source:** `artifacts/clinicflow/src/components/appointments/TicketEmailDialog.tsx:61`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Delivery is uncertain. Check before retrying. Retrying this request won’t send a duplicate.
- **Reason / safeguard:** Keep uncertainty and exact retry behavior. Provider rejection and ineligible recipient remain failures.


#### MSG-055 — Retain
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** Queue → pending operation / offline / empty outcome
- **Trigger:** Action awaits server confirmation
- **Current wording / exact source pattern:** "… awaiting server confirmation. This does not start consultation."
- **Source:** `artifacts/clinicflow/src/components/queue/SessionQueue.tsx:96`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Do not imply check-in started. Also retain stale action lock, no patient called, earliest reservation review and paused-calling notices.


#### MSG-056 — Shorten
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** Queue → offline notice
- **Trigger:** Queue writes blocked
- **Current wording / exact source pattern:** "Mutations are disabled. Refresh after reconnecting."
- **Source:** `artifacts/clinicflow/src/components/queue/SessionQueue.tsx:99`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Changes are unavailable. Reconnect and refresh.
- **Reason / safeguard:** Replace developer terminology without hiding failure or enabling actions.


#### MSG-057 — Shorten
- **Roles:** Staff; patient queue view
- **Page / section:** Queue → wait estimate help
- **Trigger:** Approximate wait displayed
- **Current wording / exact source pattern:** "Token is not position. Approx. wait = patients ahead × ${q.expectedDurationMinutes??\"configured\"} minutes, updated by queue events, not a countdown."
- **Source:** `artifacts/clinicflow/src/components/queue/SessionQueue.tsx:109`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Your token is not your queue position. Wait time is an estimate, not a countdown; breaks and delays may increase it.
- **Reason / safeguard:** Move formula and actual-vs-expected duration methodology to optional detail; preserve approximation visibly.


#### MSG-058 — Shorten
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** Queue → consultation duration editor
- **Trigger:** Future-only vs selected running session
- **Current wording / exact source pattern:** "Future-only updates sessions that have not started, including future sessions with existing bookings."
- **Source:** `artifacts/clinicflow/src/components/queue/DurationEditor.tsx:18`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Applies to sessions that haven’t started, including those with bookings. Running and completed sessions are unchanged unless you confirm the running-session option.
- **Reason / safeguard:** Keep immediate wait-estimate impact and explicit running-session confirmation.


#### MSG-059 — Move to optional help/diagnostics
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** Queue → legacy guest requests
- **Trigger:** Requests predating immediate booking
- **Current wording / exact source pattern:** "These requests predate immediate booking and still need a decision. New bookings receive their ticket automatically."
- **Source:** `artifacts/clinicflow/src/components/queue/GuestRequests.tsx:39`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** These earlier requests need your decision.
- **Reason / safeguard:** Historical implementation explanation can be help; retain acceptance/full-session failure and stale-review warnings.


#### MSG-114 — Shorten
- **Roles:** Guest; signed-in patient or staff viewing their ticket
- **Page / section:** Guest confirmation; appointment ticket → confirmation email status
- **Trigger:** Provider accepted / no recipient / disabled / uncertain
- **Current wording / exact source pattern:** "Confirmation email accepted for sending. Inbox delivery is not guaranteed."
- **Source:** `artifacts/clinicflow/src/components/appointments/confirmation-email.ts:2`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Email accepted for sending; arrival isn’t confirmed.
- **Reason / safeguard:** This is actually rendered by GuestBooking and AppointmentTicket. Keep booking success independent from email outcome; preserve ticket and do-not-book-again advice when uncertain. Not a live email test.


#### MSG-117 — Shorten
- **Roles:** Staff or patient allowed to export selected tickets
- **Page / section:** Appointments → per-row PDF / bulk preparation result
- **Trigger:** PDF/request exception becomes visible result
- **Current wording / exact source pattern:** "${id}: failed — ${e instanceof Error?e.message:\"request rejected\"}"
- **Source:** `artifacts/clinicflow/src/components/appointments/BulkAppointments.tsx:64`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** ${reference}: could not prepare this ticket. ${safeActionableReason}
- **Reason / safeguard:** Raw Error.message appears in per-row results rather than centralized friendlyError. Keep failure identity and full failure counts; do not claim success. Companion sink: AppointmentRows rowPdf prefixing reference to exception.message.


### Clinic, staff, schedules and patient records


#### MSG-060 — Shorten
- **Roles:** Superadmin; Clinic Admin; doctor
- **Page / section:** Staff → Add / edit / saved record
- **Trigger:** Direct staff creation succeeded
- **Current wording / exact source pattern:** "Saved. This account is active and can sign in with its email and password."
- **Source:** `artifacts/clinicflow/src/lib/staff-account.ts:21`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Account created. They can sign in with their email and password.
- **Reason / safeguard:** Keep separate inactive-account outcome, welcome notification result, and login-vs-contact-verification distinction.


#### MSG-061 — Move to optional help/diagnostics
- **Roles:** Superadmin; Clinic Admin; doctor where staff creation allowed
- **Page / section:** Staff creation and clinic completion
- **Trigger:** Welcome notice appended to primary success
- **Current wording / exact source pattern:** "Your notice: email ${noticeLabel(notice.email).toLowerCase()}; SMS ${noticeLabel(notice.sms).toLowerCase()}."
- **Source:** `artifacts/clinicflow/src/lib/staff-account.ts:30`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Account created. [Notification status]
- **Reason / safeguard:** Normal accepted/queued status can be an optional disclosure. Failed, unknown or awaiting-required-verification outcomes must stay visible; do not convert “Not sent” into “Sent”.


#### MSG-062 — Move to optional help/diagnostics
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** First-login prompt / My Profile → contact verification
- **Trigger:** Welcome email/SMS status shown separately from proof
- **Current wording / exact source pattern:** "Welcome email:"
- **Source:** `artifacts/clinicflow/src/components/StaffContactVerification.tsx:43`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Place welcome-message outcomes in “Notification status”; keep Verified / Send Code next to each contact.
- **Reason / safeguard:** Welcome delivery does not establish contact verification. Preserve failed/unknown outcomes when relevant and do not remove required proof.


#### MSG-063 — Shorten
- **Roles:** Superadmin; Clinic Admin (drawer hidden from doctor)
- **Page / section:** Staff → account recovery drawer
- **Trigger:** Before clicking recovery action
- **Current wording / exact source pattern:** "Find staff recovery steps without sending email."
- **Source:** `artifacts/clinicflow/src/Users.tsx:261`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Request a password recovery email for the selected staff account.
- **Reason / safeguard:** High priority: the no-email claim conflicts with the invoked POST /users/:id/password-reset, which calls requestStaffReset and returns “Password recovery email requested.” Source trace only; never clicked. Confirm intended action before approving wording; changing dispatch behavior would require separate approval.


#### MSG-064 — Remove
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Clinic → Details / Policies
- **Trigger:** Routine policy footer
- **Current wording / exact source pattern:** "Saved notification preferences and delivery policies remain in effect."
- **Source:** `artifacts/clinicflow/src/components/ClinicSettings.tsx:176`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Unrelated reassurance while reviewing booking policy; actual delivery controls and real limitations remain elsewhere.


#### MSG-065 — Shorten
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Clinic → linked owner hours
- **Trigger:** Linking schedule explanation
- **Current wording / exact source pattern:** "Enabled linked schedules use location hours to maintain owner sessions. Booking availability is checked separately."
- **Source:** `artifacts/clinicflow/src/components/ClinicSettings.tsx:173`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Linked owner sessions follow location hours. Check availability before sharing booking links.
- **Reason / safeguard:** Keep actual linkage and separate booking readiness; do not imply hours guarantee capacity.


#### MSG-066 — Shorten
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Clinic → Locations → copy opening hours draft
- **Trigger:** Copy source selected / copy succeeds
- **Current wording / exact source pattern:** "Copying replaces this location's draft hours only. Contacts, timezone and doctor assignments are not copied. Review Changes checks linked sessions before anything is saved."
- **Source:** `artifacts/clinicflow/src/components/ClinicSettings.tsx:253`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Copies hours into this draft only; contacts, timezone and doctors stay unchanged. Review and Apply to save.
- **Reason / safeguard:** Retain draft-only vs persisted distinction and actual impact-review failures.


#### MSG-067 — Shorten
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Clinic → location opening-hour impact review
- **Trigger:** Preview, atomic apply and conflict
- **Current wording / exact source pattern:** "Nothing has been saved. Preview checks session changes and conflicts. Applying rechecks everything atomically; existing appointments will not be moved or cancelled."
- **Source:** `artifacts/clinicflow/src/components/LinkedScheduleControls.tsx:37`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Nothing saved yet. Review affected sessions, then Apply. Existing appointments won’t be moved or cancelled.
- **Reason / safeguard:** “Atomically” is unnecessary technical vocabulary; preserve revalidation, conflict blockers and destructive effects.


#### MSG-068 — Retain
- **Roles:** Superadmin; Clinic Admin; doctor
- **Page / section:** Weekly schedule → save and partial outcomes
- **Trigger:** One or more session changes failed
- **Current wording / exact source pattern:** "Partly saved: ${r.outcomes.length - failed.length} of ${r.outcomes.length} changes saved."
- **Source:** `artifacts/clinicflow/src/components/schedule/WeeklyScheduleEditor.tsx:130`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Full current pattern continues with failed labels/reasons and retained unsaved draft. Preserve counts, failed changes and retry instructions; never propose a generic “Saved” toast.


#### MSG-069 — Shorten
- **Roles:** Superadmin; Clinic Admin; doctor
- **Page / section:** Weekly schedule → customize linked day
- **Trigger:** Confirm conversion of selected weekdays
- **Current wording / exact source pattern:** "Only this doctor's selected weekdays at this location become custom. Clinic hours and other days are unchanged."
- **Source:** `artifacts/clinicflow/src/components/schedule/WeeklyScheduleEditor.tsx:152`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Only the selected days become custom. They won’t follow later clinic-hour changes. Existing appointments stay unchanged.
- **Reason / safeguard:** Keep explicit confirmation, day-off override preservation and failed/uncertain-save recovery; technical save identifiers can move to diagnostic detail.


#### MSG-070 — Shorten
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist read-only branches
- **Page / section:** Schedule → extended-hours explanation
- **Trigger:** Doctor hours outside usual location hours
- **Current wording / exact source pattern:** "This is allowed: clinics may extend hours for a doctor. Patients can book these times, and booking screens show the same warning."
- **Source:** `artifacts/clinicflow/src/components/schedule/WeeklyScheduleEditor.tsx:277`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Extended hours are allowed. Check entry arrangements with the clinic.
- **Reason / safeguard:** Keep protected closed days, overlaps and date exceptions in contextual validation; do not make a permitted session look invalid.


#### MSG-071 — Retain
- **Roles:** Superadmin; Clinic Admin; doctor
- **Page / section:** Weekly schedule → follow/copy/unlink location hours
- **Trigger:** Whole-location unlink confirmation
- **Current wording / exact source pattern:** "All remaining linked days at this location become custom. Existing day overrides, including days off, are kept even if following is enabled again."
- **Source:** `artifacts/clinicflow/src/components/schedule/FollowLocationHours.tsx:64`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Consequential future synchronization behavior; must remain in confirmation, not disappear into generic help.


#### MSG-072 — Shorten
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist where exceptions permitted
- **Page / section:** Schedule → exception editor
- **Trigger:** Legacy contradictory Day Off + Extra Interval record
- **Current wording / exact source pattern:** "This record was saved as both Day Off and Extra Interval. It works as an Extra Interval, so Day Off is shown cleared; saving keeps that behaviour."
- **Source:** `artifacts/clinicflow/src/resources.tsx:340`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** This older record is treated as an Extra Interval, not a Day Off. Saving keeps that behavior.
- **Reason / safeguard:** Explain actual semantic repair; retain contradictory-input validation and booking-impact warnings.


#### MSG-073 — Retain
- **Roles:** Staff; patient viewing own records
- **Page / section:** Patient details drawer → visits/activity/documents
- **Trigger:** Normal scoped history description
- **Current wording / exact source pattern:** "Appointment visits only; this is not a full clinical record."
- **Source:** `artifacts/clinicflow/src/components/PatientDetailsDrawer.tsx:35`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Scope limitation matters, particularly for doctors with profile visibility but no clinical/document permission. Empty, restricted, unavailable and failed states must stay distinct.


#### MSG-074 — Retain
- **Roles:** Permitted staff; patients for own read access
- **Page / section:** Patient documents → upload / download
- **Trigger:** Private file types and limits / failure
- **Current wording / exact source pattern:** "PDF, PNG, JPEG, WebP or text · up to 10 MB · stored privately."
- **Source:** `artifacts/clinicflow/src/components/PatientDocuments.tsx:64`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Concise actionable file constraint; retain explicit permission, upload and download failures. No private files were opened.


#### MSG-075 — Retain
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** QR management → readiness / regenerate
- **Trigger:** Public QR regeneration confirmation
- **Current wording / exact source pattern:** "Printed copies will stop working."
- **Source:** `artifacts/clinicflow/src/resources.tsx:445`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Irreversible effect on shared/printed links. Keep regenerated-reference confirmation and replace-printed-copies instruction.


#### MSG-109 — Shorten
- **Roles:** Superadmin; Clinic Admin; doctor; receptionist
- **Page / section:** Resource editor → session hours warning
- **Trigger:** Session extends beyond opening interval
- **Current wording / exact source pattern:** "This session extends outside a clinic opening interval. Review the times; existing server rules decide whether it can be saved."
- **Source:** `artifacts/clinicflow/src/resources.tsx:303`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** This session extends beyond clinic hours. Review the times and entry arrangements.
- **Reason / safeguard:** “Existing server rules decide” is unhelpful implementation detail. Keep actual validation failure and distinguish permitted extension from blocked closed days.


#### MSG-116 — Shorten
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Resource staff recovery assistance disclosure
- **Trigger:** Before clicking Get Recovery Steps
- **Current wording / exact source pattern:** "Select a linked staff account to view the secure account recovery steps. This action does not send an email."
- **Source:** `artifacts/clinicflow/src/resources.tsx:762`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Select a linked staff account to request a recovery email.
- **Reason / safeguard:** Same backend/action mismatch as MSG-063, in the shared resource fallback. Both sinks must be reviewed together. Do not click during audit or silently change the server action.


### Reports and operator settings


#### MSG-076 — Shorten
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Reports → Communication Usage → explanatory header
- **Trigger:** Always shown
- **Current wording / exact source pattern:** "Each count is one observed notification per channel and recipient occurrence, dated when first recorded (not its latest status transition)."
- **Source:** `artifacts/clinicflow/src/components/CommunicationUsage.tsx:115`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Recorded email and SMS activity, not confirmed delivery or billing.
- **Reason / safeguard:** Move counting/date methodology to adjacent help. Preserve visible best-effort/legacy/purged-history limitations where interpreting totals.


#### MSG-077 — Retain
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Reports → Communication Usage → empty/error
- **Trigger:** No records / query failure
- **Current wording / exact source pattern:** "Usage could not be loaded, so no totals are shown. This is not a count of zero."
- **Source:** `artifacts/clinicflow/src/components/CommunicationUsage.tsx:138`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Error must not read as zero usage. Empty-history disclaimer stays, but can be “No matching records. History may be incomplete.”


#### MSG-078 — Move to optional help/diagnostics
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Reports → Communication record drawer
- **Trigger:** Technical metadata fields
- **Current wording / exact source pattern:** "HTTP status"
- **Source:** `artifacts/clinicflow/src/components/CommunicationUsage.tsx:59`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Keep outcome, time and reason visible; group HTTP status, raw clinic ID and dispatch timestamps under “Technical details”.
- **Reason / safeguard:** Clinic Admin currently sees the same drawer schema as Superadmin (within authorized scope); ordinary doctor/receptionist/patient do not have a Reports route. Useful diagnostic data is not categorically removed.


#### MSG-079 — Retain
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Reports → live / operational / saved templates / export
- **Trigger:** Stale data, missing template, export failure or no matching results
- **Current wording / exact source pattern:** "This saved report template is unavailable. No substitute report has been opened."
- **Source:** `artifacts/clinicflow/src/components/reports/ReportsDashboard.tsx:201`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Keep unavailable-template, stale data and complete-export guarantees. Report Templates’ brief introduction already fits the concise-message rule; no new rewrite finding there.


#### MSG-080 — Shorten
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Notifications → page-wide overview
- **Trigger:** Activation/inheritance guidance
- **Current wording / exact source pattern:** "Platform security messages obey their own activation, not Optional Delivery or operational opt-outs."
- **Source:** `artifacts/clinicflow/src/components/NotificationTemplatesPage.tsx:101`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Security messages have separate controls. Optional Delivery affects operational messages only.
- **Reason / safeguard:** Full current multi-sentence guidance also explains inheritance, eligibility, drafts, provider setup and no replay. Keep relevant scope/off/read-only warnings inline; put general mechanics in existing info help.


#### MSG-081 — Retain
- **Roles:** Superadmin; Clinic Admin
- **Page / section:** Notifications → event group help
- **Trigger:** Group switch behavior
- **Current wording / exact source pattern:** "Group switches change all authorized options for that event, including filtered-out rows."
- **Source:** `artifacts/clinicflow/src/components/NotificationTemplatesPage.tsx:121`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Consequential bulk scope including invisible rows. Shorter help may retain mixed/on/off rules, optional gate unchanged and no replay; do not hide this scope before confirmation.


#### MSG-082 — Shorten
- **Roles:** Clinic Admin only
- **Page / section:** Notifications → Email template editor → owner booking mail history
- **Trigger:** Empty owner booking outcome list
- **Current wording / exact source pattern:** "Disabled templates, unavailable recipients or shared-address deduplication can prevent an outbox entry; an empty list is not proof of delivery."
- **Source:** `artifacts/clinicflow/src/components/BookingMailOutcomes.tsx:37`
- **Evidence:** T: fictional static-render tests + S: EmailTemplates mount guards
- **Proposed replacement:** No recorded owner booking emails. An empty history does not confirm delivery.
- **Reason / safeguard:** Move diagnostic causes to help. This component is actually mounted for Clinic Admin in EmailTemplates; not assumed visible to all staff or Superadmin.


#### MSG-083 — Retain
- **Roles:** Clinic Admin only
- **Page / section:** Notifications → owner booking email outcomes → status rows
- **Trigger:** Sending / unknown / accepted / failed configuration
- **Current wording / exact source pattern:** "Dispatch may have succeeded. This email will not be automatically resent."
- **Source:** `artifacts/clinicflow/src/components/BookingMailOutcomes.tsx:11`
- **Evidence:** T: fictional all-status render fixture
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Keep no-automatic-resend and uncertain delivery; status labels and technical retry exhaustion can be shorter but cannot disappear.


#### MSG-084 — Shorten
- **Roles:** Superadmin; Clinic Admin authorized template editors
- **Page / section:** Notifications → template edit/publish/reset
- **Trigger:** Conflict, published vs draft, logo validation
- **Current wording / exact source pattern:** "Publishing changes wording only, not activation or delivery readiness. No message is sent."
- **Source:** `artifacts/clinicflow/src/components/EmailTemplates.tsx:263`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Publishing updates wording only. It won’t enable delivery or send a message.
- **Reason / safeguard:** Keep unsaved draft warning, version conflict, unknown variables, reset effects, DLT approval and logo size/type constraints. Do not change template message bodies in this audit.


#### MSG-085 — Shorten
- **Roles:** Superadmin; Clinic Admin within test permission
- **Page / section:** Notifications → Test message dialog
- **Trigger:** Real send vs fictional security preview
- **Current wording / exact source pattern:** "Uses your current edits, including drafts and disabled templates, without publishing or enabling anything. No appointment is created and nothing is queued. Sends one real message to the recipient you enter."
- **Source:** `artifacts/clinicflow/src/components/EventTemplateTest.tsx:98`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Sends one real message using these edits to the recipient you enter. It won’t publish, enable notifications or create an appointment.
- **Reason / safeguard:** Real-send confirmation stays prominent. Security preview-only branch remains “Fictional preview only”; no live test was triggered.


#### MSG-086 — Shorten
- **Roles:** Superadmin only
- **Page / section:** Communication → Email Settings → diagnostics
- **Trigger:** Saved connection check help
- **Current wording / exact source pattern:** "Checks run only when requested, using saved settings rather than unsaved edits. Results clear when the saved configuration changes."
- **Source:** `artifacts/clinicflow/src/components/EmailDiagnostics.tsx:12`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Checks saved settings only; no email is sent.
- **Reason / safeguard:** Detailed config identity/expiry belongs in diagnostics. Retain result source/time and no sender-permission/inbox guarantee; ordinary users do not see this operator screen.


#### MSG-087 — Remove
- **Roles:** Superadmin only
- **Page / section:** Communication / Integrations → Connection Check Results drawer
- **Trigger:** Read-only diagnostic failed probe
- **Current wording / exact source pattern:** "Raw provider diagnostics are not exposed because they may contain secrets."
- **Source:** `artifacts/api-server/src/lib/integration-checks.ts:53`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Remove this explanatory sentence only, not the safely categorized failure, provider-permission next step, storage-probe limitation or diagnostic results. Traced via IntegrationConnectionCheck c.message, not treated as visible merely because it exists on server.


#### MSG-088 — Retain
- **Roles:** Superadmin only
- **Page / section:** Communication → Email Settings → saved/test/turn-off results
- **Trigger:** Acceptance disclaimer
- **Current wording / exact source pattern:** "Provider acceptance does not confirm inbox delivery."
- **Source:** `artifacts/clinicflow/src/components/EmailProviderPanel.tsx:143`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Relevant operator diagnostic beside a deliberate test. Unlike registration, operator vocabulary is appropriate. Keep explicit test failure, saved configuration, rate limit, manual receipt and turn-off effects.


#### MSG-089 — Excluded (unmounted)
- **Roles:** Superadmin only
- **Page / section:** NotificationSmsSettings non-inline fallback only
- **Trigger:** Save succeeded but no test sent; current Communication mount uses inline=true
- **Current wording / exact source pattern:** "Configuration saved. No test message was sent; readiness is not proof of delivery."
- **Source:** `artifacts/clinicflow/src/components/NotificationSmsSettings.tsx:107`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** This sentence is below the inline early return. Current CommunicationSettings mounts inline; no other production caller was found. Not an approval candidate for current visible copy. Actual provider-panel saved/test messages are covered separately.


#### MSG-090 — Move to optional help/diagnostics
- **Roles:** Superadmin only
- **Page / section:** Communication → SMS provider edit → custom mapping
- **Trigger:** Technical API compatibility description
- **Current wording / exact source pattern:** "This is data only: no scripts, other protocols, multi-step or OAuth flows. Compatibility is confirmed only by a successful test."
- **Source:** `artifacts/clinicflow/src/components/NotificationSmsSettings.tsx:61`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Keep endpoint/mapping constraints adjacent to corresponding fields.
- **Reason / safeguard:** Useful operator help, not ordinary-user copy; retain unsupported-mode constraints and do not claim compatibility without an authorized test.


#### MSG-091 — Shorten
- **Roles:** Superadmin only
- **Page / section:** Settings → Integrations → locking / source
- **Trigger:** Encryption-key readiness warning
- **Current wording / exact source pattern:** "Website editing is locked. Your server operator must configure INTEGRATIONS_ENCRYPTION_KEY (64 hexadecimal characters from 32 random bytes). Existing server-configured integrations remain available."
- **Source:** `artifacts/clinicflow/src/components/IntegrationSettings.tsx:53`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Website editing is locked until the server encryption key is configured. Existing server integrations remain available.
- **Reason / safeguard:** Keep exact variable and format under operator setup details; this report reads source names only, never values. Ordinary users do not see this warning.


#### MSG-092 — Shorten
- **Roles:** Superadmin only
- **Page / section:** Settings → Integrations / Communication → provider editor
- **Trigger:** Configuration inheritance and clearing
- **Current wording / exact source pattern:** "Saved website settings replace the whole .env configuration for this service."
- **Source:** `artifacts/clinicflow/src/components/IntegrationEditor.tsx:49`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Saved website settings replace this service’s server configuration; values aren’t mixed.
- **Reason / safeguard:** Keep whole-configuration semantics, blank-keeps-secret explanation and clear-config service-stoppage confirmation; move .env terminology to diagnostics.


#### MSG-093 — Shorten
- **Roles:** Superadmin only
- **Page / section:** Communication → Email → confirm test receipt
- **Trigger:** Manual receipt acknowledgement
- **Current wording / exact source pattern:** "Your confirmation only. This does not automatically verify inbox delivery or guarantee future emails."
- **Source:** `artifacts/clinicflow/src/components/SmtpTestReceipt.tsx:14`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** This records your receipt confirmation only; it doesn’t guarantee future delivery.
- **Reason / safeguard:** Keep configuration/test identity and pending/unaccepted dispatch blockers. A checked confirmation is not automated proof.


#### MSG-094 — Retain
- **Roles:** Superadmin only
- **Page / section:** Settings → Platform → expanded Integrations and Session Limits
- **Trigger:** Expanded informational disclosure
- **Current wording / exact source pattern:** "Session timeout is managed by the authentication service; platform preferences do not change your authentication session."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:604`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Already optional and explains why a setting cannot change session lifetime. Routine queue refresh/SMS readiness can stay here; do not promote it into page-wide banners.


#### MSG-095 — Shorten
- **Roles:** Superadmin only
- **Page / section:** Users → permissions / roles / effective permissions drawer
- **Trigger:** Limits and immediate policy effects
- **Current wording / exact source pattern:** "Enabling an action never grants more than the built-in rules: clinic ownership, assignments, record ownership and workflow state are still checked by the API on every operation."
- **Source:** `artifacts/clinicflow/src/components/AccessRules.tsx:92`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Permissions can restrict access, not extend it beyond clinic ownership and assignments. Super Admin can’t be restricted.
- **Reason / safeguard:** Keep workflow/record checks in optional detail; immediate changes and conflict draft retention remain visible. Current long explanation is already a tooltip, so lower priority.


#### MSG-096 — Move to optional help/diagnostics
- **Roles:** Superadmin only
- **Page / section:** Users → custom roles → introduction
- **Trigger:** Restriction-only and combined policy explanation
- **Current wording / exact source pattern:** "When several rules apply, the most restrictive wins, and a restricted action whose clinic is unclear requires a clinic to be chosen."
- **Source:** `artifacts/clinicflow/src/components/CustomRoles.tsx:78`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Brief introduction: “Create restricted variations of existing staff roles.”
- **Reason / safeguard:** Keep multi-rule semantics and ambiguous-clinic restriction in optional help. Destructive base-role changes, assignment removals and save confirmation remain visible.


#### MSG-097 — Retain
- **Roles:** Superadmin only
- **Page / section:** System users → permanent staff removal review / handoff
- **Trigger:** Review, unknown ownership, lost response, cleanup
- **Current wording / exact source pattern:** "Nothing is deleted until you review the impact and type delete. Patient care records and documents are never deleted with a staff account."
- **Source:** `artifacts/clinicflow/src/components/StaffDeletionReview.tsx:213`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Critical destructive-operation boundary; preserve all blockers, separate handoffs, uncertainty and operation receipt. Operation IDs are legitimate diagnostics here, unlike routine registration.


#### MSG-098 — Retain
- **Roles:** Superadmin only
- **Page / section:** Permanent staff removal → legacy history reconciliation
- **Trigger:** Ownership unknown / evidence restore
- **Current wording / exact source pattern:** "Ownership is unknown. Unknown ownership blocks removal; it is not proof that this account owns the record."
- **Source:** `artifacts/clinicflow/src/components/HistoryReconciliationReview.tsx:21`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Important uncertainty and safe-deletion requirement. Keep signed-original proof, unresolved blockers and no-history-deletion explanations.


#### MSG-099 — Shorten
- **Roles:** Superadmin; fictional demo users / guests
- **Page / section:** Settings → demo management; demo login; demo booking
- **Trigger:** Environment separation and privacy warnings
- **Current wording / exact source pattern:** "Setup applies only to the environment shown in your address bar. Preview and published accounts and clinics are separate. Never enter real patient details into the demo."
- **Source:** `artifacts/clinicflow/src/components/DemoClinicManagement.tsx:114`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Changes affect this environment only. Never enter real patient information.
- **Reason / safeguard:** Keep one-time-password/private-sharing and rotate-password confirmation in operator UI. Ordinary demo users see the privacy warning, not provider/configuration diagnostics; no credentials were read.


#### MSG-112 — Move to optional help/diagnostics
- **Roles:** Superadmin only
- **Page / section:** Communication → SMS Settings → Keep in Touch provider mode
- **Trigger:** Detailed protocol and acceptance rules
- **Current wording / exact source pattern:** "Uses POST with application/json and Bearer authorization."
- **Source:** `artifacts/clinicflow/src/components/SmsProviderPanel.tsx:118`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Keep Sender/Template ID fields and outcome uncertainty visible; put protocol, payload keys and response parsing in “Provider details”.
- **Reason / safeguard:** Actual render trace: CommunicationSettings → NotificationSmsSettings inline → SmsProviderPanel → provider-specific fields. Technical compatibility details are useful to operators, but do not need to occupy the main form; ordinary users do not see them.


#### MSG-118 — Retain
- **Roles:** Superadmin only
- **Page / section:** Communication → Notification Logs → result drawer and filter help
- **Trigger:** Historical provider outcomes and retained diagnostic fields
- **Current wording / exact source pattern:** "An empty list is not proof that nothing was sent."
- **Source:** `artifacts/clinicflow/src/components/NotificationLogs.tsx:65`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Keep incomplete-history, unknown/missing values and lost-retention warning. Exact-match filter instructions are task-relevant; verbose provider-status methodology can stay in optional diagnostic help. Ordinary staff do not see this log screen.


### Public and guest


#### MSG-100 — Retain
- **Roles:** Guest; any signed-in visitor using public booking
- **Page / section:** Guest booking → confirmation / recovery
- **Trigger:** Unconfirmed save or unavailable receipt
- **Current wording / exact source pattern:** "We did not receive confirmation that your booking was saved. Retry safely below; it will not create a second booking."
- **Source:** `artifacts/clinicflow/src/components/GuestBooking.tsx:136`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Keep uncertain booking result and safe retry contract. Do not relabel as booked or encourage a separate booking.


#### MSG-101 — Shorten
- **Roles:** Guest
- **Page / section:** Guest booking → ticket completion
- **Trigger:** Receipt only recoverable in current tab
- **Current wording / exact source pattern:** "Download or print your ticket now. It is recoverable only in this browser tab; there is no public name search. If it is lost, ask reception."
- **Source:** `artifacts/clinicflow/src/components/GuestBooking.tsx:137`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** Download or print your ticket. You can recover it only in this tab; if it’s lost, ask reception.
- **Reason / safeguard:** Receipt-loss warning is essential. Move “no public name search” privacy detail to help, not the recovery requirement.


#### MSG-102 — Shorten
- **Roles:** Guest
- **Page / section:** Guest booking → optional contact details
- **Trigger:** No contacts / family contact
- **Current wording / exact source pattern:** "Without contact details we cannot send updates. A family member's contact requires their permission and does not link this visit to their account."
- **Source:** `artifacts/clinicflow/src/components/GuestBooking.tsx:160`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** No contact details means no updates. Get permission before using someone else’s contact; this won’t link the visit to their account.
- **Reason / safeguard:** Retain consent and account-linking consequences, optional contact remains optional.


#### MSG-103 — Shorten
- **Roles:** Guest; patient; staff public entry
- **Page / section:** Public clinic / guest booking / direct QR booking
- **Trigger:** Clinic or QR not found, inactive or failed
- **Current wording / exact source pattern:** "This clinic booking QR may be invalid, inactive, or temporarily unavailable. Check the code with reception or choose a clinic for guest booking."
- **Source:** `artifacts/clinicflow/src/clinic.tsx:176`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** This booking QR is unavailable. Ask reception for the current code or choose Guest Booking.
- **Reason / safeguard:** PublicBooking also renders ErrorNotice for the same qr.error; consolidate prose only after approval, retaining distinction from account-context failure. No QR validity was live-tested.


#### MSG-104 — Retain
- **Roles:** All public visitors
- **Page / section:** Public clinic page → opening hours / averages / locations
- **Trigger:** No published hours or distinction from doctor availability
- **Current wording / exact source pattern:** "Opening hours do not guarantee doctor availability. Check booking for available sessions."
- **Source:** `artifacts/clinicflow/src/components/PublicClinicPage.tsx:132`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Patient-facing availability limitation. Keep actual-vs-planned consultation averages, no online access and no-session states.


#### MSG-105 — Retain
- **Roles:** Public reception display visitors
- **Page / section:** Public queue display → disconnected
- **Trigger:** Connection lost
- **Current wording / exact source pattern:** "Queue details are hidden until the connection returns."
- **Source:** `artifacts/clinicflow/src/components/ClinicDisplay.tsx:92`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Honest stale/hidden-data state; never replace with an empty queue or success.


#### MSG-106 — Retain
- **Roles:** Guests scanning booking QR; staff scanning private check-in QR
- **Page / section:** Patient scanner and check-in scanner
- **Trigger:** Wrong QR type, camera denied, invalid image, stale validation
- **Current wording / exact source pattern:** "Scanning only verifies the ticket. Confirm check-in explicitly when the patient enters consultation."
- **Source:** `artifacts/clinicflow/src/CheckIn.tsx:51`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Essential distinction between scanning and care action. Public scanner’s wrong-site/type guidance and staff-only boundary stay actionable; no camera/browser permission was exercised.


#### MSG-107 — Retain
- **Roles:** All users opening public links or QR helpers
- **Page / section:** Public website links → failed origin/configuration lookup
- **Trigger:** Public link unavailable while other work may continue
- **Current wording / exact source pattern:** "Public website links are unavailable. Other work can continue."
- **Source:** `artifacts/clinicflow/src/lib/public-website.tsx:42`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Concise actual readiness failure, not routine operator detail. Keep retry and do not substitute guessed hosts.


#### MSG-108 — Retain
- **Roles:** Public visitor
- **Page / section:** Published public server → fatal website handler
- **Trigger:** HTTP 500 fallback before app render
- **Current wording / exact source pattern:** "Website temporarily unavailable."
- **Source:** `lib/public-pages/src/server.ts:15`
- **Evidence:** S: source branch and render sink traced
- **Proposed replacement:** None — retain or excluded as explained.
- **Reason / safeguard:** Server-only visible response traced to send(). Not confused with server logs or startup PORT exception. Empty 404 handler has no message inventory item.


## Coverage by role and current route

Aliases are not independent pages. Each source-reviewed route includes the applicable shared auth, shell, controls and role-specific conditional states; nested-state checklist follows. Runtime limitations apply to every S row.


### Superadmin

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/admin` | Redirect → /admin/dashboard | Signed-out and wrong-role Guard redirects; auth/session loading and retry states shared | MSG-021, MSG-022, MSG-027 | S — alias, no independent page |
| `/admin/dashboard` | clinic.tsx → Dashboard / PatientBookingNotices | Overview loading/error/stale with last available data; appointment rows and expanded ticket; activity empty/feed; average-wait help; patient confirmation list | MSG-036, MSG-037, MSG-047, MSG-027 | S — source reviewed; runtime not exercised |
| `/admin/clinic` | components/ClinicSettings.tsx | Details; Locations; Staff; Policies; Activity History; clinic/contact/format edit dialogs; location hours copy and linked-session impact review; clinical profile/locations activation; QR and schedule links | MSG-064, MSG-065, MSG-066, MSG-067, MSG-075, MSG-035 | S — source reviewed; runtime not exercised |
| `/admin/clinics` | resources.tsx → ResourcePage(clinics); clinic.tsx → DoctorClinics for doctor | Search/filter/empty/loading/error; linked locations; status/ownership restrictions; add Clinic Admin wizard; bulk status/QR results; view details and edit path | MSG-012, MSG-015, MSG-016, MSG-030, MSG-060, MSG-075, MSG-115 | S — source reviewed; runtime not exercised |
| `/admin/branches` | Redirect → Clinic Locations (+ saved clinic/query context) | Details; Locations; Staff; Policies; Activity History; clinic/contact/format edit dialogs; location hours copy and linked-session impact review; clinical profile/locations activation; QR and schedule links | MSG-064, MSG-065, MSG-066, MSG-067, MSG-075, MSG-035 | S — alias |
| `/admin/users` | UsersWorkspace → Roles / Permissions / System users | Role editor/assignments; permission matrix/effective policy; System users and deletion review; unsaved cross-tab drafts; staff area query normalized to roles. This is NOT the staff list. | MSG-095, MSG-096, MSG-097, MSG-098, MSG-034 | S — source reviewed; runtime not exercised |
| `/admin/staff` | Users.tsx | Superadmin-only staff tabs/counts, search and filters; Add Staff; doctor edit + weekly schedule; invitation/recovery outcomes; status confirmation and partial bulk outcomes | MSG-060, MSG-061, MSG-063, MSG-068, MSG-115 | S — source reviewed; runtime not exercised |
| `/admin/patients` | resources.tsx → ResourcePage(patients) | List and filters; new/edit profile per role; registration-success notice; read-only doctor create restriction; drawer visits/activity/documents, permission/loading/empty/errors; complete/cancelled export | MSG-040, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/admin/masters` | Redirect → /admin/settings?area=masters | Reference category selector and parent lookup; create/edit/status; required/unique errors; bulk status results; no new technical-copy issue beyond shared controls | MSG-027, MSG-028, MSG-030, MSG-115 | S — alias |
| `/admin/appointments` | clinic.tsx → Appointments; components/appointments/* | Upcoming/past/all; list/calendar; calendar day panel; advanced filters; expanded rows, details/ticket; cancel, absent, check-in/out, shift, re-enter and reschedule; bulk selection/results; CSV/PDF/print/email; stale/permission/empty/error states | MSG-038, MSG-047, MSG-048, MSG-049, MSG-050, MSG-051, MSG-052, MSG-053, MSG-054, MSG-117 | S — source reviewed; runtime not exercised |
| `/admin/queue` | components/queue/SessionQueue.tsx | Staff/patient branches; selected doctor/date/session; snapshot-only sessions; pending call preview, paused/absent/present; blocked first reservation; individual check-in/out; duration editor; legacy requests; status/search/sort; disconnected/stale/empty/failed | MSG-055, MSG-056, MSG-057, MSG-058, MSG-059, MSG-051 | S — source reviewed; runtime not exercised |
| `/admin/reports` | components/reports/ReportsWorkspace.tsx; clinic.tsx → LegacyReports | Live report families/KPIs/trends/comparison; templates and saved views; filters; row detail; all-results exports; operational detail; Communication Usage totals/breakdowns, empty/error and record drawer (SA/CA only) | MSG-076, MSG-077, MSG-078, MSG-079, MSG-031 | S — source reviewed; runtime not exercised |
| `/admin/settings` | clinic.tsx → WorkspaceSettings / PlatformSettings | Platform booking/security defaults; expanded integration/session note; save/error/stale; Integrations services/storage/Twilio/email-link; Reference data; Audit log; Demo clinic | MSG-091, MSG-092, MSG-094, MSG-099, MSG-027 | S — source reviewed; runtime not exercised |
| `/admin/audit` | Redirect → /admin/settings?area=audit | Audit search, actor/clinic/date filters, row expansions; loading/empty/error; humanized summaries; no additional rewrite recommendation for factual audit data | MSG-027, MSG-030 | S — alias |
| `/admin/qrs` | resources.tsx → ResourcePage(qrs), BookingQrCard | QR cards, public link origin, readiness check; copy/download/display; regenerate confirmation/result; image failed/retry; schedule and capacity help | MSG-075, MSG-107, MSG-045 | S — source reviewed; runtime not exercised |
| `/admin/book` | clinic.tsx → Booking; components/booking/* | Staff advance/walk-in and patient branches; visit/patient/review stages; current scope and membership checks; required mobile proof; new-patient dialog where allowed; next-date search; owner profile recovery; session editor; issued-ticket completion | MSG-039, MSG-040, MSG-041, MSG-042, MSG-043, MSG-044, MSG-045, MSG-046, MSG-114, MSG-100 | S — source reviewed; runtime not exercised |
| `/admin/availability` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/* | Weekly list and add/edit; compact days/slots; capacity/break/queue tabs; copy, link/unlink, customize weekday/off; multi-location replace; save/partial/uncertain result; whole-schedule deactivate; stale context; read-only role variants | MSG-068, MSG-069, MSG-070, MSG-071, MSG-109, MSG-034 | S — source reviewed; runtime not exercised |
| `/admin/exceptions` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/ScheduleExceptions.tsx | Date exception list/add/edit; doctor/location/date context; day off/extra interval; impact preview and conflict validation; timing/breaks; legacy contradictory values; deactivate/partial result | MSG-072, MSG-028, MSG-034, MSG-068 | S — source reviewed; runtime not exercised |
| `/admin/profile` | clinic.tsx → Profile / ProfileEditor | Own person fields; staff contact verification and password change; owner clinical-profile inactive/reactivate; owned clinic facts; doctor clinic/schedule links; patient My Records drawer, documents and history; save success/error | MSG-062, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/admin/demo` | Redirect → /admin/settings?area=demo | Fictional demo setup/status, enable/disable, password rotation and one-time sharing; QR generation and public-sharing message; scope error; no credentials opened | MSG-099, MSG-075, MSG-107 | S — alias |
| `/admin/templates` | components/NotificationTemplatesPage.tsx; EmailTemplates.tsx | System-default vs clinic scope; event accordions and activation detail; email/SMS recipient branches (CA email only); filtered group toggles; edit/draft/publish/reset; logo/variables/DLT validation; test dialog real-send vs preview; conflict/discard; owner booking mail outcomes for CA | MSG-080, MSG-081, MSG-082, MSG-083, MSG-084, MSG-085, MSG-003, MSG-114 | S — source reviewed; runtime not exercised |
| `/admin/communication` | components/CommunicationSettings.tsx | SMS Settings inline → SmsProviderPanel (Keep in Touch/Twilio/custom modes); Email Settings/EmailDiagnostics/test receipt; Notification Logs and attempt drawer; saved vs unsaved configs; editing locks, read-only checks, explicit live-send confirmations | MSG-086, MSG-087, MSG-088, MSG-090, MSG-093, MSG-112, MSG-118 | S — source reviewed; runtime not exercised |
| `/admin/permissions` | Redirect → /admin/users?area=permissions (or roles) | Built-in/custom selected role; permissions matrix, optional tooltip, revision, changed draft, unknown role; conflict and confirm save; read-only Superadmin | MSG-095, MSG-034, MSG-027 | S — alias |
| `/admin/integrations` | Redirect → /admin/settings?area=integrations | Service chooser; Storage local/object panel; Twilio readiness/credentials drawer; email moved link; saved-config connection checks/results; clear configuration confirmation; locked configuration | MSG-087, MSG-091, MSG-092, MSG-086 | S — alias |
| `/admin/system-users` | Redirect → /admin/users?area=system | User counts, filters, effective permissions drawer; activation/deactivation and protected-owner restrictions; permanent staff deletion impact/handoffs/receipt lookup/cleanup; original-proof history reconciliation; unknown dependency blockers | MSG-095, MSG-097, MSG-098, MSG-034 | S — alias |
| `/admin/clinics/:clinicId/:section?` | ClinicSettings → Details / Locations / Staff / Policies / Activity History; qrs/sessions→locations, history→activity-history | Details; Locations; Staff; Policies; Activity History; clinic/contact/format edit dialogs; location hours copy and linked-session impact review; clinical profile/locations activation; QR and schedule links | MSG-064, MSG-065, MSG-066, MSG-067, MSG-075, MSG-035 | S — source reviewed; runtime not exercised |

### Clinic Admin

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/admin` | Redirect → /admin/dashboard | Signed-out and wrong-role Guard redirects; auth/session loading and retry states shared | MSG-021, MSG-022, MSG-027 | S — alias, no independent page |
| `/admin/dashboard` | clinic.tsx → Dashboard / PatientBookingNotices | Overview loading/error/stale with last available data; appointment rows and expanded ticket; activity empty/feed; average-wait help; patient confirmation list | MSG-036, MSG-037, MSG-047, MSG-027 | S — source reviewed; runtime not exercised |
| `/admin/clinic` | components/ClinicSettings.tsx | Details; Locations; Staff; Policies; Activity History; clinic/contact/format edit dialogs; location hours copy and linked-session impact review; clinical profile/locations activation; QR and schedule links | MSG-064, MSG-065, MSG-066, MSG-067, MSG-075, MSG-035 | S — source reviewed; runtime not exercised |
| `/admin/clinics` | resources.tsx → ResourcePage(clinics); clinic.tsx → DoctorClinics for doctor | Search/filter/empty/loading/error; linked locations; status/ownership restrictions; add Clinic Admin wizard; bulk status/QR results; view details and edit path | MSG-012, MSG-015, MSG-016, MSG-030, MSG-060, MSG-075, MSG-115 | S — source reviewed; runtime not exercised |
| `/admin/branches` | Redirect → /admin/clinic?section=locations (+ saved clinic/query context) | Details; Locations; Staff; Policies; Activity History; clinic/contact/format edit dialogs; location hours copy and linked-session impact review; clinical profile/locations activation; QR and schedule links | MSG-064, MSG-065, MSG-066, MSG-067, MSG-075, MSG-035 | S — alias |
| `/admin/users` | Redirect → /admin/clinic?section=staff (+ saved clinic/query context) | Details; Locations; Staff; Policies; Activity History; clinic/contact/format edit dialogs; location hours copy and linked-session impact review; clinical profile/locations activation; QR and schedule links | MSG-064, MSG-065, MSG-066, MSG-067, MSG-075, MSG-035 | S — alias |
| `/admin/staff` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/patients` | resources.tsx → ResourcePage(patients) | List and filters; new/edit profile per role; registration-success notice; read-only doctor create restriction; drawer visits/activity/documents, permission/loading/empty/errors; complete/cancelled export | MSG-040, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/admin/masters` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/appointments` | clinic.tsx → Appointments; components/appointments/* | Upcoming/past/all; list/calendar; calendar day panel; advanced filters; expanded rows, details/ticket; cancel, absent, check-in/out, shift, re-enter and reschedule; bulk selection/results; CSV/PDF/print/email; stale/permission/empty/error states | MSG-038, MSG-047, MSG-048, MSG-049, MSG-050, MSG-051, MSG-052, MSG-053, MSG-054, MSG-117 | S — source reviewed; runtime not exercised |
| `/admin/queue` | components/queue/SessionQueue.tsx | Staff/patient branches; selected doctor/date/session; snapshot-only sessions; pending call preview, paused/absent/present; blocked first reservation; individual check-in/out; duration editor; legacy requests; status/search/sort; disconnected/stale/empty/failed | MSG-055, MSG-056, MSG-057, MSG-058, MSG-059, MSG-051 | S — source reviewed; runtime not exercised |
| `/admin/reports` | components/reports/ReportsWorkspace.tsx; clinic.tsx → LegacyReports | Live report families/KPIs/trends/comparison; templates and saved views; filters; row detail; all-results exports; operational detail; Communication Usage totals/breakdowns, empty/error and record drawer (SA/CA only) | MSG-076, MSG-077, MSG-078, MSG-079, MSG-031 | S — source reviewed; runtime not exercised |
| `/admin/settings` | /admin/clinic | Retired settings redirects. CA legacy area=templates/events/notifications → Notifications. Doctor/receptionist/patient use Profile; not a second settings editor | MSG-062, MSG-027 | S — alias |
| `/admin/audit` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/qrs` | resources.tsx → ResourcePage(qrs), BookingQrCard | QR cards, public link origin, readiness check; copy/download/display; regenerate confirmation/result; image failed/retry; schedule and capacity help | MSG-075, MSG-107, MSG-045 | S — source reviewed; runtime not exercised |
| `/admin/book` | clinic.tsx → Booking; components/booking/* | Staff advance/walk-in and patient branches; visit/patient/review stages; current scope and membership checks; required mobile proof; new-patient dialog where allowed; next-date search; owner profile recovery; session editor; issued-ticket completion | MSG-039, MSG-040, MSG-041, MSG-042, MSG-043, MSG-044, MSG-045, MSG-046, MSG-114, MSG-100 | S — source reviewed; runtime not exercised |
| `/admin/availability` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/* | Weekly list and add/edit; compact days/slots; capacity/break/queue tabs; copy, link/unlink, customize weekday/off; multi-location replace; save/partial/uncertain result; whole-schedule deactivate; stale context; read-only role variants | MSG-068, MSG-069, MSG-070, MSG-071, MSG-109, MSG-034 | S — source reviewed; runtime not exercised |
| `/admin/exceptions` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/ScheduleExceptions.tsx | Date exception list/add/edit; doctor/location/date context; day off/extra interval; impact preview and conflict validation; timing/breaks; legacy contradictory values; deactivate/partial result | MSG-072, MSG-028, MSG-034, MSG-068 | S — source reviewed; runtime not exercised |
| `/admin/profile` | clinic.tsx → Profile / ProfileEditor | Own person fields; staff contact verification and password change; owner clinical-profile inactive/reactivate; owned clinic facts; doctor clinic/schedule links; patient My Records drawer, documents and history; save success/error | MSG-062, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/admin/demo` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/templates` | components/NotificationTemplatesPage.tsx; EmailTemplates.tsx | System-default vs clinic scope; event accordions and activation detail; email/SMS recipient branches (CA email only); filtered group toggles; edit/draft/publish/reset; logo/variables/DLT validation; test dialog real-send vs preview; conflict/discard; owner booking mail outcomes for CA | MSG-080, MSG-081, MSG-082, MSG-083, MSG-084, MSG-085, MSG-003, MSG-114 | S — source reviewed; runtime not exercised |
| `/admin/communication` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/permissions` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/integrations` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/system-users` | Guard → /admin/dashboard | Restricted before Portal renders; do not attribute Superadmin diagnostics to Clinic Admin | Reviewed — no page copy rendered; shared auth errors only | S — denied-route redirect, no runtime access attempt |
| `/admin/clinics/:clinicId/:section?` | ClinicSettings → Details / Locations / Staff / Policies / Activity History; qrs/sessions→locations, history→activity-history | Details; Locations; Staff; Policies; Activity History; clinic/contact/format edit dialogs; location hours copy and linked-session impact review; clinical profile/locations activation; QR and schedule links | MSG-064, MSG-065, MSG-066, MSG-067, MSG-075, MSG-035 | S — source reviewed; runtime not exercised |

### Doctor

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/doctor` | Redirect → /doctor/dashboard | Signed-out and wrong-role Guard redirects; auth/session loading and retry states shared | MSG-021, MSG-022, MSG-027 | S — alias, no independent page |
| `/doctor/dashboard` | clinic.tsx → Dashboard / PatientBookingNotices | Overview loading/error/stale with last available data; appointment rows and expanded ticket; activity empty/feed; average-wait help; patient confirmation list | MSG-036, MSG-037, MSG-047, MSG-027 | S — source reviewed; runtime not exercised |
| `/doctor/profile` | clinic.tsx → Profile / ProfileEditor | Own person fields; staff contact verification and password change; owner clinical-profile inactive/reactivate; owned clinic facts; doctor clinic/schedule links; patient My Records drawer, documents and history; save success/error | MSG-062, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/doctor/clinics` | DoctorClinicWorkspace → Clinics / Staff / Booking QR | Assigned clinics listing, public link facts and QR readiness; Staff tab doctor-only creation/assignment limits; Booking QR tab; loading/no-clinics/error; status and scoped records | MSG-040, MSG-060, MSG-061, MSG-068, MSG-075 | S — source reviewed; runtime not exercised |
| `/doctor/branches` | resources.tsx → ResourcePage(branches) | Assigned location listing; owner-only editor restrictions; inherited contacts; status and details; public URL/QR readiness; pagination and row expansions | MSG-030, MSG-035, MSG-075, MSG-109 | S — source reviewed; runtime not exercised |
| `/doctor/availability` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/* | Weekly list and add/edit; compact days/slots; capacity/break/queue tabs; copy, link/unlink, customize weekday/off; multi-location replace; save/partial/uncertain result; whole-schedule deactivate; stale context; read-only role variants | MSG-068, MSG-069, MSG-070, MSG-071, MSG-109, MSG-034 | S — source reviewed; runtime not exercised |
| `/doctor/exceptions` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/ScheduleExceptions.tsx | Date exception list/add/edit; doctor/location/date context; day off/extra interval; impact preview and conflict validation; timing/breaks; legacy contradictory values; deactivate/partial result | MSG-072, MSG-028, MSG-034, MSG-068 | S — source reviewed; runtime not exercised |
| `/doctor/appointments` | clinic.tsx → Appointments; components/appointments/* | Upcoming/past/all; list/calendar; calendar day panel; advanced filters; expanded rows, details/ticket; cancel, absent, check-in/out, shift, re-enter and reschedule; bulk selection/results; CSV/PDF/print/email; stale/permission/empty/error states | MSG-038, MSG-047, MSG-048, MSG-049, MSG-050, MSG-051, MSG-052, MSG-053, MSG-054, MSG-117 | S — source reviewed; runtime not exercised |
| `/doctor/queue` | components/queue/SessionQueue.tsx | Staff/patient branches; selected doctor/date/session; snapshot-only sessions; pending call preview, paused/absent/present; blocked first reservation; individual check-in/out; duration editor; legacy requests; status/search/sort; disconnected/stale/empty/failed | MSG-055, MSG-056, MSG-057, MSG-058, MSG-059, MSG-051 | S — source reviewed; runtime not exercised |
| `/doctor/patients` | resources.tsx → ResourcePage(patients) | List and filters; new/edit profile per role; registration-success notice; read-only doctor create restriction; drawer visits/activity/documents, permission/loading/empty/errors; complete/cancelled export | MSG-040, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/doctor/qrs` | resources.tsx → ResourcePage(qrs), BookingQrCard | QR cards, public link origin, readiness check; copy/download/display; regenerate confirmation/result; image failed/retry; schedule and capacity help | MSG-075, MSG-107, MSG-045 | S — source reviewed; runtime not exercised |
| `/doctor/book` | clinic.tsx → Booking; components/booking/* | Staff advance/walk-in and patient branches; visit/patient/review stages; current scope and membership checks; required mobile proof; new-patient dialog where allowed; next-date search; owner profile recovery; session editor; issued-ticket completion | MSG-039, MSG-040, MSG-041, MSG-042, MSG-043, MSG-044, MSG-045, MSG-046, MSG-114, MSG-100 | S — source reviewed; runtime not exercised |
| `/doctor/users` | Redirect → /doctor/clinics?area=staff | Doctor/receptionist/admin tabs according to actual role; direct creation credentials, role/clinic/location assignments; edit doctor schedule tab; bulk invitations/status; account recovery drawer; invitation outcomes | MSG-060, MSG-061, MSG-063, MSG-068, MSG-115, MSG-116 | S — alias |
| `/doctor/settings` | /doctor/profile | Retired settings redirects. CA legacy area=templates/events/notifications → Notifications. Doctor/receptionist/patient use Profile; not a second settings editor | MSG-062, MSG-027 | S — alias |

### Receptionist

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/receptionist` | Redirect → /receptionist/dashboard | Signed-out and wrong-role Guard redirects; auth/session loading and retry states shared | MSG-021, MSG-022, MSG-027 | S — alias, no independent page |
| `/receptionist/dashboard` | clinic.tsx → Dashboard / PatientBookingNotices | Overview loading/error/stale with last available data; appointment rows and expanded ticket; activity empty/feed; average-wait help; patient confirmation list | MSG-036, MSG-037, MSG-047, MSG-027 | S — source reviewed; runtime not exercised |
| `/receptionist/appointments` | clinic.tsx → Appointments; components/appointments/* | Upcoming/past/all; list/calendar; calendar day panel; advanced filters; expanded rows, details/ticket; cancel, absent, check-in/out, shift, re-enter and reschedule; bulk selection/results; CSV/PDF/print/email; stale/permission/empty/error states | MSG-038, MSG-047, MSG-048, MSG-049, MSG-050, MSG-051, MSG-052, MSG-053, MSG-054, MSG-117 | S — source reviewed; runtime not exercised |
| `/receptionist/queue` | components/queue/SessionQueue.tsx | Staff/patient branches; selected doctor/date/session; snapshot-only sessions; pending call preview, paused/absent/present; blocked first reservation; individual check-in/out; duration editor; legacy requests; status/search/sort; disconnected/stale/empty/failed | MSG-055, MSG-056, MSG-057, MSG-058, MSG-059, MSG-051 | S — source reviewed; runtime not exercised |
| `/receptionist/patients` | resources.tsx → ResourcePage(patients) | List and filters; new/edit profile per role; registration-success notice; read-only doctor create restriction; drawer visits/activity/documents, permission/loading/empty/errors; complete/cancelled export | MSG-040, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/receptionist/book` | clinic.tsx → Booking; components/booking/* | Staff advance/walk-in and patient branches; visit/patient/review stages; current scope and membership checks; required mobile proof; new-patient dialog where allowed; next-date search; owner profile recovery; session editor; issued-ticket completion | MSG-039, MSG-040, MSG-041, MSG-042, MSG-043, MSG-044, MSG-045, MSG-046, MSG-114, MSG-100 | S — source reviewed; runtime not exercised |
| `/receptionist/qrs` | resources.tsx → ResourcePage(qrs), BookingQrCard | QR cards, public link origin, readiness check; copy/download/display; regenerate confirmation/result; image failed/retry; schedule and capacity help | MSG-075, MSG-107, MSG-045 | S — source reviewed; runtime not exercised |
| `/receptionist/availability` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/* | Weekly list and add/edit; compact days/slots; capacity/break/queue tabs; copy, link/unlink, customize weekday/off; multi-location replace; save/partial/uncertain result; whole-schedule deactivate; stale context; read-only role variants | MSG-068, MSG-069, MSG-070, MSG-071, MSG-109, MSG-034 | S — source reviewed; runtime not exercised |
| `/receptionist/exceptions` | components/SchedulingWorkspace.tsx; resources.tsx; components/schedule/ScheduleExceptions.tsx | Date exception list/add/edit; doctor/location/date context; day off/extra interval; impact preview and conflict validation; timing/breaks; legacy contradictory values; deactivate/partial result | MSG-072, MSG-028, MSG-034, MSG-068 | S — source reviewed; runtime not exercised |
| `/receptionist/profile` | clinic.tsx → Profile / ProfileEditor | Own person fields; staff contact verification and password change; owner clinical-profile inactive/reactivate; owned clinic facts; doctor clinic/schedule links; patient My Records drawer, documents and history; save success/error | MSG-062, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/receptionist/settings` | /receptionist/profile | Retired settings redirects. CA legacy area=templates/events/notifications → Notifications. Doctor/receptionist/patient use Profile; not a second settings editor | MSG-062, MSG-027 | S — alias |

### Patient

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/patient` | Redirect → /patient/dashboard | Signed-out and wrong-role Guard redirects; auth/session loading and retry states shared | MSG-021, MSG-022, MSG-027 | S — alias, no independent page |
| `/patient/dashboard` | clinic.tsx → Dashboard / PatientBookingNotices | Overview loading/error/stale with last available data; appointment rows and expanded ticket; activity empty/feed; average-wait help; patient confirmation list | MSG-036, MSG-037, MSG-047, MSG-027 | S — source reviewed; runtime not exercised |
| `/patient/book` | clinic.tsx → Booking; components/booking/* | Staff advance/walk-in and patient branches; visit/patient/review stages; current scope and membership checks; required mobile proof; new-patient dialog where allowed; next-date search; owner profile recovery; session editor; issued-ticket completion | MSG-039, MSG-040, MSG-041, MSG-042, MSG-043, MSG-044, MSG-045, MSG-046, MSG-114, MSG-100 | S — source reviewed; runtime not exercised |
| `/patient/appointments` | clinic.tsx → Appointments; components/appointments/* | Upcoming/past/all; list/calendar; calendar day panel; advanced filters; expanded rows, details/ticket; cancel, absent, check-in/out, shift, re-enter and reschedule; bulk selection/results; CSV/PDF/print/email; stale/permission/empty/error states | MSG-038, MSG-047, MSG-048, MSG-049, MSG-050, MSG-051, MSG-052, MSG-053, MSG-054, MSG-117 | S — source reviewed; runtime not exercised |
| `/patient/queue` | components/queue/SessionQueue.tsx | Staff/patient branches; selected doctor/date/session; snapshot-only sessions; pending call preview, paused/absent/present; blocked first reservation; individual check-in/out; duration editor; legacy requests; status/search/sort; disconnected/stale/empty/failed | MSG-055, MSG-056, MSG-057, MSG-058, MSG-059, MSG-051 | S — source reviewed; runtime not exercised |
| `/patient/profile` | clinic.tsx → Profile / ProfileEditor | Own person fields; staff contact verification and password change; owner clinical-profile inactive/reactivate; owned clinic facts; doctor clinic/schedule links; patient My Records drawer, documents and history; save success/error | MSG-062, MSG-073, MSG-074, MSG-027, MSG-028 | S — source reviewed; runtime not exercised |
| `/patient/settings` | /patient/profile | Retired settings redirects. CA legacy area=templates/events/notifications → Notifications. Doctor/receptionist/patient use Profile; not a second settings editor | MSG-062, MSG-027 | S — alias |

### All public visitors

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/` | App.tsx route → named component in states | Home: landing description, booking help, provider banner and marketing sections; signed-in visitor redirects through Onboarding | Reviewed — no technical/status rewrite finding. Marketing prose is not a provider diagnostic. | S + B — fresh signed-out first-viewport screenshot only; no interaction |

### Superadmin / Clinic Admin / doctor / receptionist / invited staff

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/sign-in/*?` | App.tsx route → named component in states | StaffLogin: empty validation; credentials error; busy; passwordSet/passwordReset query notices; registration and patient links | MSG-027, MSG-028 | S — source reviewed; no interactive browser exercise |

### Guest / new Clinic Admin / Superadmin; other signed-in roles

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/register-clinic/*?` | App.tsx route → named component in states | RegistrationAccount details/review/verify; optional mobile proof; RegistrationIdentity role guards; full ClinicRegistrationWizard; completion; draft/resume/uncertain-create branches | MSG-001, MSG-002, MSG-003, MSG-004, MSG-005, MSG-006, MSG-007, MSG-008, MSG-009, MSG-010, MSG-011, MSG-012, MSG-013, MSG-014, MSG-015, MSG-016, MSG-017 | S — source reviewed; no interactive browser exercise |

### Patient / guest

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/patient-login` | App.tsx route → named component in states | Email/SMS request, eligible-account message, code error/resend cooldown, optional registration mobile proof, guest booking links | MSG-018, MSG-002, MSG-003, MSG-008 | S — source reviewed; no interactive browser exercise |

### Fictional demo staff / guest

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/demo-login` | App.tsx route → named component in states | Demo password entry, loading/failed sign-in and fictional-data disclaimer; designated-account-only warning | MSG-099 | S — source reviewed; no interactive browser exercise |

### Guest / public visitor

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/scan-qr` | App.tsx route → named component in states | PatientScanner camera/upload; unsupported permission and wrong-site/type messages; no QR / invalid image; guest alternative | MSG-106 | S — source reviewed; no interactive browser exercise |
| `/guest-booking` | App.tsx route → named component in states | GuestClinicFinder clinics/locations/doctor/session stages; online access failure; optional contacts and consent; issued ticket, safe retry, receipt recovery, legacy pending request | MSG-044, MSG-100, MSG-101, MSG-102, MSG-114 | S — source reviewed; no interactive browser exercise |

### Staff

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/forgot-password` | App.tsx route → named component in states | ForgotPassword form/validation/requested result/error; anti-enumeration response | MSG-020, MSG-027, MSG-028 | S — source reviewed; no interactive browser exercise |

### Invited staff / staff reset

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/set-password` | App.tsx route → named component in states | SetPassword with or without token; reset flow; error; validated password checklist; saved completion and channel notices | MSG-019, MSG-001, MSG-003, MSG-028 | S — source reviewed; no interactive browser exercise |

### Healthcare provider / guest

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/register-doctor` | App.tsx route → named component in states | Provider account invitation instruction and sign-in link | MSG-113 | S — source reviewed; no interactive browser exercise |

### Signed-in unonboarded patient / doctor intent / unassigned Clinic Admin

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/onboarding` | App.tsx route → named component in states | Patient profile editor and consent; provider invitation branch; existing owner redirection; loading/account creation failure | MSG-113, MSG-027, MSG-028 | S — source reviewed; no interactive browser exercise |

### Clinic staff only; other roles guarded

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/check-in` | App.tsx route → named component in states | Staff access verification; camera/upload/paste; QR invalid/stale/revoked; already checked in, cannot check in; explicit check-in/unknown-result retry; success | MSG-106, MSG-051 | S — source reviewed; no interactive browser exercise |

### Public reception display

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/display/:reference` | App.tsx route → named component in states | ClinicDisplay invalid/revoked branch QR; queue disconnect hides details; public booking QR fallback; no current sessions; current/next token | MSG-105, MSG-107 | S — source reviewed; no interactive browser exercise |

### Guest and every signed-in role using patient-facing QR entry

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/book/:reference` | App.tsx route → named component in states | QR resolution loading/failure; guest booking or signed-in patient-facing Booking (no workspace management tools); fictional demo branch; account/profile loading | MSG-103, MSG-100, MSG-101, MSG-102, MSG-041, MSG-043, MSG-044, MSG-045, MSG-046, MSG-114 | S — source reviewed; no interactive browser exercise |

### Public visitor / any role

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/:clinicSlug/:branchSlug` | App.tsx route → named component in states | PublicClinicPage location resolution; booking/display mode; doctor lists and actual/planned averages; opening hours; public live sessions; no online access; factual/demo notices | MSG-104, MSG-105, MSG-099, MSG-107 | S — source reviewed; no interactive browser exercise |
| `/:clinicSlug` | App.tsx route → named component in states | Same page at Clinic Group level; location chooser, public identity/doctor averages/opening hours; clinic not available/error/empty; booking/display links | MSG-104, MSG-099, MSG-107 | S — source reviewed; no interactive browser exercise |

### Any visitor

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `unmatched route (fallback)` | App.tsx route → named component in states | Page Not Found / This page is unavailable / Return Home; one- and two-segment unknown routes are consumed first by public clinic routes | Reviewed — no change finding; concise actionable fallback. | S — source reviewed; no interactive browser exercise |

### As permitted at target

| Route | Render target / alias | Important nested states | Findings / no-finding disposition | Evidence / limitation |
|---|---|---|---|---|
| `/sign-up/*?` | Redirect → With ticket → /set-password?token=…; otherwise /patient-login | Alias has no independent message UI; target auth/permission/loading/error branches apply | Reviewed — alias only; findings belong to destination | S — alias |
| `/reset-password` | Redirect → With token → /set-password?flow=reset&token=…; otherwise /forgot-password | Alias has no independent message UI; target auth/permission/loading/error branches apply | Reviewed — alias only; findings belong to destination | S — alias |
| `/login` | Redirect → /sign-in | Alias has no independent message UI; target auth/permission/loading/error branches apply | Reviewed — alias only; findings belong to destination | S — alias |
| `/register` | Redirect → /patient-login | Alias has no independent message UI; target auth/permission/loading/error branches apply | Reviewed — alias only; findings belong to destination | S — alias |
| `/admin/doctors` | Redirect → /admin/staff?tab=doctors | Alias has no independent message UI; target auth/permission/loading/error branches apply | Reviewed — alias only; findings belong to destination | S — alias |

## Important nested-state coverage

| Roles | Surface | States / branches inspected | Evidence / limitation | Review IDs |
|---|---|---|---|---|
| All roles | Auth access / role guards | Loading secure access, missing session, password-required gate, unauthorized redirects, status retry; signed-in direct public booking stays patient-facing | S | MSG-021, MSG-022, MSG-027 |
| Superadmin vs Clinic Admin | Shared /admin prefix | Guard denies SA-only destinations to CA; Clinic Admin templates email-only and owner history; CA’s doctor profile does not make it a Superadmin; demo flags not assumed unrestricted | S | MSG-080, MSG-082, MSG-095, MSG-099 |
| All workspace roles | Responsive shell / menus | Mobile sidebar and scrim, collapsed desktop navigation, profile menu, shortcuts, location menu and record search; HelpTip hover/focus/Escape/touch and OverflowText clipping branch examined in source only | S; no viewport, keyboard, touch or assistive-tech exercise | MSG-024, MSG-025, MSG-026, MSG-030, MSG-031, MSG-032, MSG-033, MSG-034, MSG-035 |
| All forms | Field and tabbed validation | FormField error/helper; native validity adapter; FormTabs errors on hidden tabs; email/phone/date/range/PIN and password checklist; unknown lookup names and partial options | S; no interactive validation submissions | MSG-028, MSG-030, MSG-109, MSG-110 |
| All dialogs | Dialog/drawer discard and pending states | AppDialog dirty/pending, ConfirmDialog danger, workspace leave/history guards; secret-field blank/preserve descriptions; draft-storage unavailable vs saved; unknown writes and receipt reconciliation | S; no mutations | MSG-006, MSG-015, MSG-034, MSG-097, MSG-100 |
| Staff + patient appointment owners | Expanded appointment / calendar day drawer | Details with factual reference/session/duration, notes, history; ticket renderer screen/HTML/PDF; clipboard/export errors; email recipients/results; privacy-hidden revoked appointment | S; ticket fixtures not opened in live app | MSG-048, MSG-049, MSG-051, MSG-053, MSG-054, MSG-117 |
| Staff + permitted patient/guest | Action-specific dialogs | Cancel/reason, absent, shift one place later, re-enter, reschedule new token, explicit call release; no-show/called/in-progress/complete restrictions and stale snapshot | S; no live transitions | MSG-050, MSG-051, MSG-055 |
| Staff + exports users | Bulk and partial completion | Page-only selection; partial status/invitation/cancel outcomes; six-failure toast cap + detail; all-or-nothing tickets; full filtered CSV cancellation/change verification | S + T (isolated export and bulk-summary helpers) | MSG-052, MSG-053, MSG-068, MSG-115, MSG-117 |
| Staff schedules | Weekly schedule nested editors | Doctor/location context refreshed before edit; weekly/day/slot; capacity/break/queue tabs; follow/copy/custom day/off; outside hours; preview/deactivate/partial and uncertain saves | S; no create/save/copy/link operations | MSG-068, MSG-069, MSG-070, MSG-071, MSG-072, MSG-109 |
| Clinic Admin / Superadmin | Registration completion variants | No doctor vs doctor custom sessions vs linked owner hours; missing branches; invitation sent/failed/notRequired; notice props; public-origin readiness | S; no registration or dispatch | MSG-015, MSG-016, MSG-017, MSG-061 |
| Staff / patient scope | Patient drawer nested tabs | Visits, activity, document empty/error/restricted branches; scoped counts vs no records; private file validation and upload/download failure; patient My Records; doctor registration restriction | S; no patient records or files read | MSG-040, MSG-073, MSG-074 |
| Superadmin / Clinic Admin | Notifications nested states | System default/clinic overrides; optional/security off; read-only activation; event group hidden-filter scope; status details; draft/published/reset/conflict/unknown variables; real-message confirm vs preview-only security; BookingMailOutcomes rows | S + T fictional channel/mail rendering (see test limitations) | MSG-001, MSG-003, MSG-080, MSG-081, MSG-082, MSG-083, MSG-084, MSG-085 |
| Superadmin | Provider diagnostics | SMS Keep in Touch protocol and plus-convention help; Twilio separate security credentials; encrypted storage warning; SMTP saved configuration/test/receipt; check results passed/failed/not_verified/source/time; partial/legacy logs | S; no connectivity checks, credential access or live tests | MSG-086, MSG-087, MSG-088, MSG-090, MSG-091, MSG-092, MSG-093, MSG-112, MSG-118 |
| Superadmin | User removal nested drawers | Impact fetch/blocked/unknown role; visit/clinic handoff previews and commit; lost response/receipt status; pending erasure cleanup; legacy signed-proof/unresolved ownership; all retained as safety-relevant | S; not opened on live users | MSG-097, MSG-098 |
| Superadmin / Clinic Admin | Report nested variants | Family filters; compare; zero vs unavailable; row details; charts empty/stale/error; saved report absent; usage record timestamp/reason/http metadata; best-effort history; CSV filters changed during export | S; no private report API requested | MSG-076, MSG-077, MSG-078, MSG-079 |
| Guest | Receipt completion and management | Immediate ticket vs earlier pending request; optional contact; no storage, uncertain save, failed refresh; safe retry, shifted/re-entered/cancelled/rescheduled receipt; session not promised exact time | S; no bookings created or receipt secrets read | MSG-100, MSG-101, MSG-102, MSG-043, MSG-050, MSG-114 |
| Public visitor | Website server response | lib/public-pages server error send() reviewed; startup errors/log-only exceptions excluded; route metadata not mistaken for visible content; no published URL lookup or production request | S | MSG-108 |

## Backend-to-visible-message trace

| UI sink | Producer / path | Visibility proof and boundary | IDs |
|---|---|---|---|
| auth/SecurityChannelNotice.tsx + Users securityChannelSummary | registration/start/resend/mobile and invitation/password completion → structured channels → copy map | authRequest returns parsed response; channel outcome enum/destination becomes UI text. Server logs and raw transport responses are not a message inventory by themselves. | MSG-001, MSG-002, MSG-003, MSG-017, MSG-019, MSG-061 |
| lib/auth-request.ts → auth/errors.ts / friendlyError.ts | safe AuthRequestError data/status/code → authErrorMessage or component error string | RegistrationMobileProof renders Error.message directly, but ordinary auth requests have already translated server errors. Do not equate this with raw provider exposure. | MSG-004, MSG-027, MSG-110 |
| lib/api.ts → shared generated API client customFetch → resources ErrorNotice | api-server/src/lib/http.ts errors() → 4xx body or generic 5xx → friendlyError | Safe short human field validation/conflict text survives; JSON/HTTP/SQL/stack/long strings may be replaced. Exact invalid-input wording depends on validation issue paths and runtime input. | MSG-027, MSG-110, MSG-111 |
| Users.tsx recovery.data.message / resources.tsx recovery.data.message | POST /users/:id/password-reset at api-server/src/routes/resources.ts:934 → requestStaffReset → 202 message | Backend response is “Password recovery email requested.” The frontend promise “without sending email” conflicts with this source trace. Request action was not executed. | MSG-063, MSG-116 |
| IntegrationConnectionCheck checks.map(c → c.message) | api-server/src/lib/integration-checks.ts + routes/integrations.ts saved configuration check | Every passed/failed/not_verified safe result is actually rendered in the diagnostic drawer. Source/time are useful operator evidence, not inbox proof. | MSG-086, MSG-087, MSG-088, MSG-091 |
| EmailProviderPanel / SmsProviderPanel test result; EventTemplateTest result | routes/integrations.ts → safe provider_accepted/rejected/unknown/not_dispatched category/message | Only explicit test actions send; not exercised. These visible operator diagnostics differ from ordinary registration copy. | MSG-085, MSG-088, MSG-093, MSG-112 |
| AppointmentTicket and GuestBooking → confirmationEmailMessage | appointment response confirmationEmail enum → local five-outcome mapper | Independent booking success plus accepted, unavailable, not_attempted/uncertain, disabled or no_recipient email state; server-only strings not indiscriminately inventoried. | MSG-114, MSG-100 |
| BookingMailOutcomes STATUS_COPY[item.status] | management booking-mail-outcomes read → local status label/detail map | Confirmed mount is CA EmailTemplates booking event. Fictional test renders cover pending/sending/accepted/unknown/configuration and other states. | MSG-082, MSG-083 |
| SessionSelector / queue / weekly schedule and linked impact panels | API reason / structured session outcome / failed-label message rendered in local row or HelpTip | Human domain reasons are intentionally visible. Not all dynamic reasons can be enumerated without input; pattern, sink and trigger are recorded in source index. No raw live reason was fetched. | MSG-030, MSG-044, MSG-055, MSG-068, MSG-072 |
| CommunicationUsage Detail / NotificationLogs Drawer | observed metadata reason, status, httpStatus, attribution and retained details → drawer fields | HTTP status and IDs really are UI fields here, unlike logged exceptions. CA sees usage schema, SA also sees provider logs; not public or ordinary clinical staff. | MSG-078, MSG-118 |

## Reviewed with no additional change finding

- Public landing: ordinary marketing/booking instructions and existing optional booking help, not technical system notices.
- Report Templates: “Open a live report or reuse a saved configuration.” and existing help already fit the brief-introduction requirement.
- Reference-data and audit listings: factual columns/values are data, not status boilerplate. Shared loading, field validation and failure messages retained.
- Profile factual owned-clinic summaries, patient visits/activity, and document type/size constraints: useful scoped data/help; no blanket removal.
- Standard loading/empty states in calendar day, live-session, chart, pagination, list and selected-name components: retain accurate distinctions between empty, no permission, failed and not loaded. No independent rewrite beyond linked IDs.
- Consent, destructive confirmation, unsaved draft, uncertain operation, incomplete export and security requirements: retain as identified. ErrorBoundary raw error rendering is DEV-only; console logging and startup exceptions are excluded.
- Low-level UI primitives, aria-only names, icon/action titles and factual dynamic identifiers were scanned in the source index but are not all message findings. This is not the separate repeated-controls/data audit.


## Safe representative validation

- Ran one isolated Node test batch (no browser, database, credentials or live provider calls): node --test artifacts/clinicflow/src/lib/friendly-error.test.mjs artifacts/clinicflow/src/auth/security-notifications.render.test.mjs artifacts/clinicflow/src/components/booking-mail-outcomes.test.mjs artifacts/clinicflow/src/components/appointments/filtered-export.test.mjs artifacts/clinicflow/src/components/permissions-logo.test.mjs.

- Result: 27 tests, 24 passed, 3 failed. Passing checks include fictional accepted/unknown/unavailable channel feedback; optional mobile separate from email proof; every booking-mail status and error/empty states; actionable auth/network/rate-limit errors; bulk summary and complete/partial/cancelled export helper semantics. These are unit/static-render confirmations, not browser or live delivery evidence.

- FAILED: “required event rules keep booking optional and security controls non-optional” — source assertion expected r.row.required && group.optional.length > 0 in NotificationTemplatesPage. It does not match current source. No permission behavior or delivery was exercised by that assertion.

- FAILED: “queue clear-all resets optional list filters, not required session or page size” — source assertion in filtered-export.test.mjs expected chips={filterChips}, which does not match current source. This failure does not itself prove clear-all behavior is wrong. No queue state was mutated.

- FAILED: “explains restriction-only semantics and Super Admin lockout protection” — source assertion expected filter(r => r !== SUPER_ADMIN) in AccessRules. Current editor instead displays a read-only Superadmin branch. No claim of full permission acceptance is made.

- No existing tests or application code were changed to make these checks pass. Source-only and unexercised branches remain labelled. No workflow restart is needed for report-only files; no production/UAT requests, provider checks, notifications, auth/account edits, registrations, bookings or file uploads were performed.

- A fresh signed-out screenshot of / confirmed the public landing’s first viewport rendered, with no browser errors reported. This is the only B observation; it did not interact with controls or exercise any signed-in, delivery, failure or nested-dialog state.

## Report files and approval boundary

- `reports/user-message-audit/review.html` — readable primary approval inventory with role/page tables and indexed findings.
- `reports/user-message-audit/review.md` — text equivalent.
- `reports/user-message-audit/findings.json` — structured stable records.
- `reports/user-message-audit/source-index.html` and `.json` — searchable/expendable source-fragment evidence, including unmounted candidates clearly labelled.
- `reports/user-message-audit/source-fingerprints.json` — source fingerprint baseline, not a production-data snapshot.

No cleanup, warning suppression, credential/settings change, delivery activation, permission edit, data mutation or deployment has been performed. Approval must identify the desired MSG IDs and any replacement changes. Further implementation, if approved later, must keep each role/trigger-specific safeguard; it must not blindly replace shared strings everywhere.

