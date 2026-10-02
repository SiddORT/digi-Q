# DigiQ — complete checklist recheck

Date: 3 October 2026. Verdict: NOT signed off for live patient/staff release. Buildable is not the same as release-ready.

## Scope and method

All 137 numbered entries (107 QA findings + 30 authentication review items) were reconciled against the existing finding register, subsequent implementation reports, current automated checks and targeted current-source inspection. The 26 grouped shared-requirement checks below cover the cross-cutting prompt as well. This is NOT 137 fresh end-to-end browser tests. No live database/account queries, secrets inspection, credential changes, messages, publishing or application fixes were performed. The screenshot checks only the public preview landing page. Original DOCX screenshots were not re-reviewed in this pass; earlier interpretations are explicitly carried forward as historical evidence.

## Numbered-item status totals

- Scoped evidence: **53**
- Acceptance pending: **56**
- External gate: **10**
- Existing behavior: **6**
- Partial implementation: **2**
- Approval held: **10**

These categories total 137. Scoped evidence means limited assertions passed, NOT fully accepted in production. Existing behavior means the feature/rule exists, NOT that the reported incident was independently reproduced and closed. Acceptance pending is not synonymous with an unfixed defect. Approval-held work must not be implemented silently. No percentage-complete claim is justified.

## What is pending before release

1. **Actual target and login readiness:** identify the deployment/build/auth mode and verify real staff roles/password readiness. Historical development inventory reported 14/14 active staff without native password material; this is not a fresh observation and says nothing definitive about production. Do not reset accounts or switch authentication to make a test pass.
2. **Email delivery:** last documented development send was rejected with SMTP 554 at DATA (sender authorization/rejection). Correct/authorize the provider sender, then explicitly approve and verify invitation, setup, recovery and patient-code delivery. Tests use fake transports. Ordinary existing staff password login can work without SMTP; the email-dependent journeys cannot be signed off.
3. **Integration bootstrap:** securely configure/back up INTEGRATIONS_ENCRYPTION_KEY if website credential editing is required. This key is not needed for environment-only delivery with no saved encrypted record. Verify direct Twilio configuration only if SMS is enabled. No current secret presence or value was inspected.
4. **Target database:** review the integration_credentials additive table and all required constraints/custom trigger functions. Current disposable migration tests pass but do not prove target parity. Review any DROP/ADD changes; never blindly replay historical migrations against live data.
5. **HTTPS, cookies, roles and recovery:** verify actual target transport, revocation, per-clinic authorization and a backup restore on a separate safe destination. The prior HTML/API HSTS discrepancy remains a target check, not a newly observed defect.
6. **Literal specification gaps:** clinic-format date inputs and browser-locale refresh-time output are not globally standardized; phone input normalizes on blur rather than formatting as typed. Correct these or explicitly accept a narrower release.
7. **Acceptance coverage:** complete the remaining role/form/list/dialog checks, keyboard journeys, screen-reader checks, genuine 200% zoom and target performance measurements. Existing scoped tests do not replace those.
8. **Product-held extensions:** consent/family booking, new after-hours authority, cross-clinic policy changes, short-lived/refresh sessions, verified email change and rollout cutoff/rollback need explicit decisions. They are not automatically prerequisites for releasing the currently approved narrower behavior, but cannot be called completed.

## Fresh verification results

- pnpm build:selfhost: PASS, including workspace typecheck, frontend production build and API build. Build warnings do not establish measured live performance.
- Combined Node run: 393 reported tests, 388 passed, 5 failures, no skips. Failures comprised a file-level esbuild EAGAIN/process-start failure and four PostgreSQL connection-reset/termination failures.
- Focused rerun of the two affected backend files, after other heavy work finished: 26/26 PASS. No application change. These overlap the original run; do not add 26 to 388 as a unique total or call the original run clean.
- Ticket/QR browser run: 21/24 PASS, three navigation/page-setup timeouts. Focused retry with one worker: 3/3 PASS. All 24 cases have passing evidence across run and retry, not one clean all-24 run.
- This is consistent with transient test-environment pressure; exact causal attribution of every initial failure is not proven.
- The separate TypeScript csrf.test.ts suite was not included by the *.test.mjs command; its earlier evidence is historical, not freshly rerun.
- Current migration test applied 15 migrations, found no schema difference and applied zero on replay, all on disposable PostgreSQL. This is not a new live backup/restore rehearsal.
- Public preview landing page rendered without a visible error. No authenticated live-browser UAT, provider delivery, real screen reader or true 200% zoom test was performed.

## Evidence provenance

Original list: reports/digiq-master-checklist-137.md. Prompt: attached_assets/DigiQ_Replit_Prompt_v3_1790958493686.md. Historical per-item evidence: docs/digiq-ui-qa-report.md. Later scoped work: docs/digiq-pending-progress.md and docs/integrations-configuration.md. Operator gates: docs/digiq-release-readiness.md and docs/self-hosting.md. Earlier performance improvements documented in docs/digiq-performance.md are distinct from the later performance proposals that remain unimplemented.

Historical statements such as “awaiting browser,” old test counts, 14-migration rehearsals, “no SMS authorized,” or “JSON unavailable” describe their original pass, not today's entire project. The prompt is the approved visual reference; missing unspecified details do not excuse explicit prompt requirements. Current integration work adds direct Twilio support, but no real SMS proof.

## Shared requirements (outside the 137 numbered entries)

### S01. Branding and Clinic / Clinic Group terms
**Status:** Acceptance pending

DigiQ labels and shared title mappings exist; final all-screen wording audit is not signed off.

### S02. Clinic-owned date/time settings and location timezones
**Status:** Scoped evidence

Parent preferences and inherited formatting are tested; no timestamp rewrite is authorized. Production defaults/schema parity still need target review.

### S03. Every date/time input follows clinic format
**Status:** Partial implementation

Native type=date controls remain in guest booking, rescheduling, queue and resource filters. Their visible format is browser-controlled.

### S04. Every visible time uses shared formatting
**Status:** Partial implementation

ClinicDisplay refresh timestamp uses browser-locale toLocaleTimeString. Canonical internal conversions are not themselves display defects; each remaining caller needs classification.

### S05. Canonical storage and format-only changes
**Status:** Scoped evidence

Date/time parsing, DST and display-contract tests exist. Current migrations pass on disposable PostgreSQL; live stored data is not inspected.

### S06. Printed tickets and private QR integrity
**Status:** Scoped evidence

Existing 24-case browser suite covers signed QR, changed revisions, print/download, failure handling and mixed clinic formats. See fresh run/retry results.

### S07. Onboarding stepper, back, review/edit and completion
**Status:** Scoped evidence

Source contracts and historical fixture checks cover registration review, no premature send, retained drafts and mobile reflow; real enrollment remains a live gate.

### S08. Inline validation, trimming and first-invalid focus
**Status:** Acceptance pending

Shared validators/FormField and focused tests exist; every form, server error and role is not browser-certified.

### S09. DOB, age and patient More details
**Status:** Scoped evidence

Validation and historical patient fixture checks cover future dates, computed age, retained collapsed values and invalid-field focus.

### S10. Timezone search and editable calling-code suggestion
**Status:** Acceptance pending

TimezoneSelect and PhoneInput exist; exhaustive defaults and keyboard interactions remain unchecked.

### S11. Format phone numbers as typed
**Status:** Partial implementation

PhoneInput forwards raw input on change and normalizes on blur. This is not the literal as-you-type requirement.

### S12. Address suggestions with manual fallback
**Status:** Acceptance pending

Local master catalog, retry and manual text are implemented; original deployed catalog incident is not reproduced. No external geocoder was implied.

### S13. Numeric units and limits
**Status:** Approval held

Existing positive/nonnegative limits and helpers retained. New numerical maxima need approval; four sessions is only a soft recommendation.

### S14. Weekly toggles, multiple sessions, exact typed time, slider and copy
**Status:** Scoped evidence

New weekly editor and tests cover seven days, exact minutes, copy preservation and failed-save retries. Not a blanket certification of every editor/caller.

### S15. Out-of-hours exception powers and extended closing
**Status:** Approval held

Warning/adjust/cancel behavior exists; Submit as entered remains subject to existing server restrictions. A new Save as exception power is not implemented/approved.

### S16. Search, filters, sorting and page sizes on all listings
**Status:** Acceptance pending

Major lists, reports and public directory have focused coverage. Bounded summaries/feeds and every contextual listing are not blanket-certified.

### S17. Filtered patient/appointment CSV exports
**Status:** Scoped evidence

Tests and historical fixture checks cover all matching pages, failed-page/cancel aborts and formats. Not a point-in-time snapshot under concurrent edits.

### S18. Searchable portal dropdowns, retained labels and retry
**Status:** Acceptance pending

Converted callers and shared controls have contracts; every open popup, overlay, multi-select and keyboard state is not browser-certified.

### S19. In-app discard/confirmation and saving-state dismissal
**Status:** Scoped evidence

Shared dialog tests cover busy/dirty behavior; browser tab closure remains a platform-native boundary, not a custom dialog promise.

### S20. Toasts, bulk summaries, friendly errors and loading states
**Status:** Acceptance pending

Implemented shared infrastructure and focused contracts do not prove every successful/failed action has correct feedback.

### S21. Tokens, typography, compact layout, icons and status mapping
**Status:** Acceptance pending

Workspace style tests pass; approved compact-density changes supersede earlier dimensions. Full component-by-component literal visual acceptance remains incomplete.

### S22. Mobile cards, one-column forms, 44px targets and visible focus
**Status:** Acceptance pending

Several 390px fixture checks passed historically; exhaustive touch-target and all-screen measurements remain pending.

### S23. Keyboard-only journeys, screen reader and genuine 200% zoom
**Status:** Acceptance pending

No new full login/onboarding/booking/add-doctor/queue keyboard run, real screen-reader run or genuine 200% zoom certification.

### S24. Branded email, clinic formatting and successful delivery
**Status:** External gate

Templates/fake transports are tested. Last documented real SMTP send was rejected; inbox receipt and recovery/invitation delivery remain unproven.

### S25. Hybrid website credentials and private bootstrap
**Status:** External gate

Encrypted SMTP/Twilio settings are implemented/tested. Operator must configure and back up the master key, apply target schema and verify providers; no secrets were inspected here.

### S26. Exact target, account readiness, schema guards and backup
**Status:** External gate

Build/tests are not target readiness. Verify actual accounts, preserved ownership/constraints, HTTPS, auth mode, restore and rollback before live release.
## All 137 numbered items

### 1. Password requirement

**Current disposition:** Scoped evidence

**Original requirement:** [S/F] Password should be 6 to alphanumeric. Apply the password decision in section 3.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** API `lib/native-auth.ts` and `auth/PasswordFlows.tsx` replace the duplicated 12-character rule with eight plus letters/numbers. Prior authentication suite passed; new registration caller still needs browser verification.

### 2. Developer-mode text

**Current disposition:** Acceptance pending

**Original requirement:** [S] Remove "developer mode" line everywhere. Remove every user-visible developer-mode line and banner from all screens. Make sure it cannot appear in production builds.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** No `developmentCode` or “Development-only” display remains in inspected UI production source. Verify production bundle and all verification screens; legitimate fictional-demo warnings remain.

### 3. Unusable selection

**Current disposition:** Acceptance pending

**Original requirement:** [S/F] No option to select and typing is blocked. Use the shared Select. Find out why options are empty or the input is disabled, and fix it.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** `ResourceLookup` → `SearchableSelect` now retains selected records and exposes fetch/error/retry states. Original empty field's live data/role cause is not established.

### 4. Missing clinic message

**Current disposition:** Acceptance pending

**Original requirement:** [S] Proper message if clinic not selected. Inline "Select a clinic" below the field.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R `RelationInput` registers required relations and emits “Select a clinic” inline. Generic Editor and staff caller use it; exercise each dependent form.

### 5. Email template

**Current disposition:** Acceptance pending

**Original requirement:** [F] Email should use a template. Use the branded template (section 7, item 14) for all system emails.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** API `lib/auth-email.ts` calls `systemEmailTemplate` for existing system mail, including integration tests' caller. HTML escaping/plain text implemented; no real send or exact missing-JSON certification.

### 6. Name validation

**Current disposition:** Acceptance pending

**Original requirement:** [S] Name is not validated. Shared name validator (letters, spaces, hyphen, apostrophe, dot; trimmed; sensible min and max).

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R Editor, U UserEditor and registration account/wizard call shared person-name validation, trimming and inline errors. Verify Unicode/allowed punctuation and server parity.

### 7. Twelve-character validation

**Current disposition:** Scoped evidence

**Original requirement:** [S/F] Password validation is 12 characters. Same as 1.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Same policy and historical authentication test evidence as 1; preserves Argon2id and existing valid hashes.

### 8. Password visibility

**Current disposition:** Scoped evidence

**Original requirement:** [S] Password view option missing. PasswordInput.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** PasswordInput callers include StaffLogin, PasswordFlows and ClinicRegistration. Main's fixture-browser pass verified password toggle and required behavior; complete auth-screen keyboard matrix remains outstanding.

### 9. Resend code

**Current disposition:** Scoped evidence

**Original requirement:** [S/F] Resend Code option missing. Add "Resend code" with a visible cooldown timer. Reuse the existing send-code call. Toast on success.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** ClinicRegistration RegistrationAccount calls new `registration/resend`, displays 60-second cooldown and success toast, and replaces challenge ID/code without extending original expiry. Main reports 13 contention tests passed; UI timer/browser interaction awaits final pass.

### 10. Verification email not received

**Current disposition:** External gate

**Original requirement:** [F] Code not received on this email. Trace the email sending path (sender configuration, swallowed errors, provider response). Report the root cause.

**Current reconciliation:** Latest documented development send failed with SMTP 554 at DATA (sender rejection/authorization); no successful delivery was established. No new send in this review.

**Carried-forward item evidence (historical; not a fresh live test):** Auth mail path now checks delivery errors/provider response and readiness; actual reported recipient/provider transaction is unavailable. Do not label missing SMTP configuration the proven incident cause.

### 11. Category list empty

**Current disposition:** Existing behavior

**Original requirement:** [S/F] No category list shown. Shared Select. Find out why the list is empty (data, permissions, request) and fix it.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 run passes “signup reference data only exposes active allowlisted names and IDs”; wizard consumes those references through shared select. Original empty catalog remains a data/context diagnostic, not a proved missing list implementation.

### 12. Empty non-typable list

**Current disposition:** Acceptance pending

**Original requirement:** [S/F] No list shown, typing not allowed. Same as 3.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Shared lookup fixes reach R relations and booking care lookups. Empty-data provenance for the original field remains unproven; test its actual role/context.

### 13. Hyphen input

**Current disposition:** Scoped evidence

**Original requirement:** [F] Hyphen typed on the keyboard is not inserted. Find the input filter or handler that drops it. Allow it where the rules allow hyphens.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Main reports proven slug trailing-hyphen keystroke fix: live normalization previously stripped a just-typed trailing hyphen before the next character. Draft slug now retains it while final slug validation remains; not merely a permissive name-validator change.

### 14. Timezone picker

**Current disposition:** Acceptance pending

**Original requirement:** [S] Timezone typed manually, should be a list. Searchable timezone Select with UTC offsets, defaulting to the browser timezone.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R timezone fields and onboarding/settings call `TimezoneSelect`; searchable timezone/offset presentation replaces generic text entry. Check browser default and keyboard behavior.

### 15. Multiple days

**Current disposition:** Scoped evidence

**Original requirement:** [S] Multiple days selection should show. Multi-select day chips (Mon to Sun) and the weekly editor in section 6A.

**Current reconciliation:** Later weekly-editor fixture checks passed seven-day toggles, exact 08:32 entry, copy actions and failed-save retry without duplicate creates. Out-of-hours authority remains held; not full scheduling acceptance.

**Carried-forward item evidence (historical; not a fresh live test):** Registration hours and doctor WeeklyOverview show Mon–Sun context/copy actions; exact typed minutes, slider and clinic-hour bands are wired into schedule UX. Existing record model/overlap protections retained; no new scheduling powers introduced.

### 16. Missing list

**Current disposition:** Acceptance pending

**Original requirement:** [S/F] No list given. Same as 3.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R static and relation fields call searchable controls; selected-label caching added to ResourceLookup/CareLookup. Confirm original field/request rather than assuming the shared fix covers missing data.

### 17. Inconsistent time format

**Current disposition:** Partial implementation

**Original requirement:** [S] Time format differs between pages. Solved by the clinic format system in section 5. Remove every hard-coded format.

**Current reconciliation:** Fresh source check finds native date inputs in GuestBooking, RescheduleAppointment, SessionQueue and resource filters. Browser-controlled presentation does not guarantee the chosen clinic format. Full literal display/input compliance is PARTIAL, despite formatter/ticket tests.

**Carried-forward item evidence (historical; not a fresh live test):** 321 run passes display roundtrip/DST, per-parent appointment preferences and DateFormatInput external-invalid tests; tickets 24/24 include mixed formats. Resource timestamp caller uses configured formatting. This does not certify every unexercised channel or full JSON styling.

### 18. Overlap feedback timing

**Current disposition:** Acceptance pending

**Original requirement:** [S] Session overlap message should show at session creation. Inline error in the session step when sessions overlap, using the existing overlap rule (section 6A).

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R Editor queries peer sessions and validates overlap inline; registration hours validates exact-minute overlap before progression. Cross-clinic authoritative server rules are preserved.

### 19. Errors persist on Back

**Current disposition:** Scoped evidence

**Original requirement:** [S] Same error keeps showing after going back. Clear form and server error state on navigation and on unmount.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Wizard Back clears stale errors while retaining input; main's fixture-browser pass confirmed Back preserves values and clears validation. R create/edit reset is source-traced; all rejected-request/navigation permutations are not claimed.

### 20. Raw HTTP error

**Current disposition:** Acceptance pending

**Original requirement:** [S] Remove "HTTP 401 Unauthorized". Use the error translator. Show only the validation message.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Shared friendly translator reaches App ErrorNotice, auth, Users, R and registration. Raw transport prefix suppressed at these callers; retain useful validation message.

### 21. Selected clinic label lost

**Current disposition:** Acceptance pending

**Original requirement:** [F] Clinic selected but not showing. Fix the controlled value and label lookup so the selected clinic always displays.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** ResourceLookup/CareLookup cache selected records separately from current page. Root cause addressed: selected label could disappear when search/pagination replaced options; cache does not grant scope validity.

### 22. Close target

**Current disposition:** Acceptance pending

**Original requirement:** [S] Close icon too small. 44px hit area for every dialog close button.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Shared AppDialog close hit area updated and used by resource/staff/appointment dialogs. Inspect bespoke controls too; component coverage is not an all-dialog measurement.

### 23. Doctor list slow

**Current disposition:** Scoped evidence

**Original requirement:** [F] One doctor in the list but it loads very slowly. Profile and fix (queries, N+1, over-fetching). Add skeleton loading and server pagination.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Disposable production-handler measurement confirms and repairs repeated SQL assignment enrichment and list-only staff/branch N+1 queries. Doctor20 warm median69.65→32.20ms, staff20 queries23→3, branch100 queries101→2; scoped SQL regressions12/12 pass. No original one-doctor incident, network, browser-render or deployed latency resolution claimed; see performance report.

### 24. Schedule destination

**Current disposition:** Existing behavior

**Original requirement:** [F] Clicking "Schedule" shows this page. Find the intended destination and fix the route. If unclear, list under "Needs clarification".

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Main's fixture browser rendered intended `/admin/availability` and accepted exact `08:32`. Original screenshot's error-boundary incident was not reproduced; no root cause or UAT routing repair claimed. Diagnose only if original deployment/data case reproduces.

### 25. Self-booking portal notification

**Current disposition:** Scoped evidence

**Original requirement:** [F] Self-booked appointment should notify in the portal. Create an in-app notification for the patient when they book.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Isolated tests pass patient-only persisted-query-backed notices/authorized details and exclusion of terminal/consultation records. Current fixture browser passes own upcoming notice, reload persistence and details link /patient/appointments?view=all&search=REF matching the request; app queries statusGroup=waiting without client patientID. No new center/schema, real delivery or live-UAT claim; other dataset variations unexercised.

### 26. Metric formula

**Current disposition:** Acceptance pending

**Original requirement:** [S] "How is this calculated?" Add an InfoTooltip with a plain-language formula. Identify the metric from the screenshot.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** C Dashboard average-wait HelpTip explains recorded wait sum/count, anchor and excluded visits. Screenshot metric is identified; check against API dashboard aggregation, not queue's separate wait estimate.

### 27. Screen design

**Current disposition:** Acceptance pending

**Original requirement:** [S] Design should be proper. Audit that screen against the spec and fix every violation.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Shared layout applied; actual mobile registration overflow repaired and final 390×844 Locations/Opening-hours check passed (375px document within 390px viewport). Status reflects remaining screen-wide visual/keyboard/200%-zoom scope, not a still-broken mobile page. Exact JSON certification unavailable.

### 28. Cancellation cutoff

**Current disposition:** Acceptance pending

**Original requirement:** [S] What is cancellation cutoff? It is not shown while booking. InfoTooltip in settings. Show the cutoff on the booking page and confirmation (for example "Free cancellation until {time}") using the existing setting.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** C Booking displays existing cancellation cutoff before booking and on confirmation; R setting helper explains minutes. Status/permission rules unchanged; verify public/guest parity.

### 29. Cannot add doctor

**Current disposition:** Scoped evidence

**Original requirement:** [F] Not able to add doctor. Reproduce and fix. Report the root cause.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes staff role-specific payload/ownership guards, invitation-after-profile-commit and scoped management tests; U creation handles invitation partial success. Original “cannot add doctor” incident remains unreproduced, not a proven outstanding create defect or identified incident root cause.

### 30. Whitespace-only required fields

**Current disposition:** Acceptance pending

**Original requirement:** [S] Spaces only and Save: no message, only a highlight. Trim input. Show inline "This field is required" for every mandatory field.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R/U/registration invoke required validator on trimmed strings and show inline text rather than only highlights. Check every mandatory field caller.

### 31. Full name

**Current disposition:** Acceptance pending

**Original requirement:** [S] Full Name not validated. Same as 6.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** U UserEditor invokes shared person-name validation; no claim based solely on validator existence. Server/patient/profile parity still needs matrix verification.

### 32. Footer overlap

**Current disposition:** Acceptance pending

**Original requirement:** [S] UI overlaps the button section. Dialog with a sticky footer and a scrolling body only.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Shared AppDialog body/footer layout and forms' footer classes are wired. Browser scrolling, long errors and mobile/zoom required.

### 33. Browser discard confirmation

**Current disposition:** Scoped evidence

**Original requirement:** [S] Closing a popup shows the Chrome confirmation. Replace with DiscardChangesDialog.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Historical focused browser pass verified custom discard/keep/Escape/backdrop and retained values in AppDialog. Tab unload remains native by browser design.

### 34. Doctor saved but invitation failed

**Current disposition:** Scoped evidence

**Original requirement:** [F] Error shown but the doctor is added, with a "Delivery Failed" status. Treat as partial success. Show one warning toast: "Doctor added, but the invitation could not be sent." Show an "Invitation not sent" badge and a Resend action. No contradictory error.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes invitation delivery after profile commit and native enrollment behavior; U result caller distinguishes failed delivery with one warning/badge/resend. Original contradictory outcome is addressed without rolling back the saved profile; browser toast placement remains unchecked.

### 35. Loading delay

**Current disposition:** Scoped evidence

**Original requirement:** [F/S] Loading time is too much. Profile and fix. Skeletons for first load, keep existing content visible during refresh.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Local API before/after profiling and list-query repairs are measured; retained-content/loading callers remain implemented. See performance report for fixture, sampling and scope. Network/render timing and original UAT delay remain unmeasured, not a missing local investigation.

### 36. Confirmation appearance

**Current disposition:** Acceptance pending

**Original requirement:** [S] Confirmation should be a system popup. ConfirmDialog.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** U status-change caller now awaits shared ConfirmDialog instead of `window.confirm`. Ownership/self-deactivation protections retained.

### 37. Doctor deactivation latency

**Current disposition:** Acceptance pending

**Original requirement:** [F/S] Inactivating a doctor is slow and the design is not proper. Update the row status immediately (optimistic with rollback on failure) with a row-level spinner. Apply the table and badge standards.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** U status mutation snapshots query cache, optimistically updates affected rows and restores on failure; row pending indicator present. Measure latency and browser rollback.

### 38. Revoke on inactive doctor

**Current disposition:** Scoped evidence

**Original requirement:** [S/F] Revoke is enabled for an inactive doctor, and the message shows above the list. Disable Revoke for inactive doctors with a tooltip. Show feedback as a toast or inline next to the action, not above the list.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Original screenshot confirms invitation replacement, not staff/session deactivation. Source eligibility/semantics and current fixture interaction pass: one actual app resend POST/fake sent response shows row-local plus toast success; confirmation/discard copy checked. Inactive/enrolled/unlinked protections remain. No real email or original SMTP cause/delivery certification.

### 39. Revoke confirmation

**Current disposition:** Acceptance pending

**Original requirement:** [S] Confirmation should be a system popup. ConfirmDialog.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** U invitation confirmation and `AdminListing` bulk status confirmation use in-app dialogs. Confirm exact original action and keyboard focus.

### 40. Bulk revoke error

**Current disposition:** Scoped evidence

**Original requirement:** [F] Error when revoking multiple doctors. Reproduce and fix. Friendly message only if it genuinely fails.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Original selected-row screenshot shows invitation resend503, not proof of a batch endpoint failure. Isolated helper/routes and current fixture interaction pass: three selected give one fake success, one503 and one password-enabled skip;1 of3 sent plus per-row results/summary. No real email; original delivery503 cause remains unverified.

### 41. Single revoke error

**Current disposition:** Scoped evidence

**Original requirement:** [F] Same message for single revoke. Same as 40.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Isolated resend503 marks invitation failed without deactivating/revoking sessions; error propagates and fixture retry succeeds. Current single/bulk browser interaction confirms row/toast success and mixed failure/skip summary after fixture CSRF precedence correction. Original actual SMTP failure/inbox receipt remains unverified, not certified fixed.

### 42. Edit success feedback

**Current disposition:** Acceptance pending

**Original requirement:** [S] No success message after edit and update. Toast "Updated successfully".

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** U update close handler and R save success now call `notifySuccess("Updated successfully")`; test successful response and failed response separately.

### 43. Phone validation

**Current disposition:** Partial implementation

**Original requirement:** [S] Phone with only "+" is accepted. Phone validator and country-code selector (section 6, item 11).

**Current reconciliation:** Fresh source check: PhoneInput has editable country code and validates international format, but normalizes on blur rather than formatting as typed. This literal prompt requirement is PARTIAL.

**Carried-forward item evidence (historical; not a fresh live test):** U/R phone fields call PhoneInput/phone validator and normalization; bare “+” fails. Country selector and registration callers need browser coverage.

### 44. Delete dialog

**Current disposition:** Acceptance pending

**Original requirement:** [S] Delete confirmation popup design. ConfirmDialog, danger variant.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R destructive action calls danger ConfirmDialog with truthful deactivation wording; U no longer offers misleading inactive-account hard-delete action.

### 45. Deleted row remains

**Current disposition:** Existing behavior

**Original requirement:** [F] Deleted record is not removed from the list. Fix cache invalidation or refetch so the list updates.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R invalidates after deactivation; inactive row remains intentionally in All while active filter excludes it. No established cache defect remains from source tracing; verify original filter/context if incident recurs. Permanent deletion remains held in 88.

### 46. Inactive doctor selector

**Current disposition:** Acceptance pending

**Original requirement:** [F] Inactive doctors show in the list. Exclude inactive doctors from selection lists (booking, scheduling). Keep them in the Doctors table behind the status filter.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Booking care lookups request active selection candidates; Doctors management table retains status tabs. Verify schedule relation scope as well as booking; do not broaden role access.

### 47. Dependent doctor reset

**Current disposition:** Scoped evidence

**Original requirement:** [S/F] Selecting a clinic removes the selected doctor and starts loading. Follow dependentFieldReset: clear the doctor only if it is confirmed invalid for the new clinic.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes scope-load selection preservation, unknown/error metadata retention, private/public exact membership and no eager parent reset tests. C/R call these helpers; browser delayed-option rendering still needs scoped check.

### 48. Blank-area checkbox toggle

**Current disposition:** Existing behavior

**Original requirement:** [S] Clicking a blank area deselects the checkbox. Only the checkbox toggles selection.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R/U selection is supplied by AdminListing checkbox handlers, not blank-row click handlers. No source basis proves reported blank-area deselection fixed; browser pointer reproduction still needed.

### 49. Validation at top

**Current disposition:** Acceptance pending

**Original requirement:** [S] Validation shows at the top of the popup. Inline below each field. Add a visible summary only for form-level errors.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R/U and registration wire field-specific errors through FormField/relations, keeping request-level errors separate. Test server field-error mapping and first-invalid focus.

### 50. Save changes toast

**Current disposition:** Acceptance pending

**Original requirement:** [S] No success message on "Save changes". Toast.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R update and ClinicSettings success paths now issue shared toasts. Actual failed saves must not trigger success.

### 51. Unexplained item

**Current disposition:** Acceptance pending

**Original requirement:** [S] "What does this mean?" Add an InfoTooltip or help text. Identify the item from the screenshot.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Screenshot is schedule capacity. R `renderComputed("capacity")` HelpTip explains max patients, token prefix and consultation minutes; no longer an unidentified metric.

### 52. Check-in after closing

**Current disposition:** Approval held

**Original requirement:** [Q] Check-in is allowed after clinic closing time (2 PM). Report the current rule. Clinics sometimes run past closing time (section 6A), so recommend how check-in after closing should work (for example allowed only for already-booked patients when the day is extended or an exception exists). Make the message friendly. No rule change until I approve.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Current time/session/queue checks do not imply automatic clinic closing lockout. Retain historical recommendation: controlled extended-day exception for already-booked patients, subject to approval.

### 53. Friday missing session

**Current disposition:** Scoped evidence

**Original requirement:** [F] Friday is open but no session can be selected. Fix session generation and lookup for that day. Check against the schedule model in section 6A.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes selected-calendar-date availability including split Friday sessions, independent session capacity and date exceptions. Original Friday incident is unreproduced; request exact timezone/data only if still failing in UAT, rather than declaring generation unimplemented.

### 54. Unexpected Saturday session

**Current disposition:** Scoped evidence

**Original requirement:** [F] No Saturday session, but one is shown. Same area as 53. Show only valid sessions.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Same weekday/date/session tests pass with closed-day/hours constraints in 321. No original phantom-Saturday reproduction or incident root cause claimed; deployed schedule/exception data may still require comparison.

### 55. Centered container

**Current disposition:** Acceptance pending

**Original requirement:** [S] Text is centered, so the box should be centered too. Align the container with its content using the spec layout.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Screenshot targets booking-confirmation ticket wrapper. `tickets/visit-ticket.css` presentation changes center the screen container; print/QR geometry must remain unchanged and be rechecked.

### 56. Patient active/inactive

**Current disposition:** Acceptance pending

**Original requirement:** [S] Meaning of Active/Inactive for a patient. InfoTooltip. Describe what it actually does today, based on the code.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R patient Editor now explains active booking selection, inactive historical retention and distinction from linked login credentials. Verify discoverability in actual edit/create dialogs.

### 57. Inactive patient booking

**Current disposition:** Acceptance pending

**Original requirement:** [F] Inactive patient can be selected while booking. Exclude or disable inactive patients in booking selectors, with a clear reason.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** C Booking patient CareLookup now requests active patients; test manual/stale selection and authoritative API rejection without changing patient visibility rules.

### 58. Consent link and reception

**Current disposition:** Approval held

**Original requirement:** [Q] No consent link, and why is consent given for reception? Investigate where and how consent is captured. Report the current flow and a recommendation. No change yet.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Historical consent investigation/proposal remains; no new consent capture/link or receptionist-consent policy authorized. Explain actual stored consent provenance before changing workflow.

### 59. All Visits count

**Current disposition:** Scoped evidence

**Original requirement:** [F] "All Visits" filter shows 2 of 4 records. Fix the filter. Counts must match rows.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes scoped appointment rows/counts before status/pagination and 600-record isolation/filter tests; C All visits clears stale date bounds. Exact original four-record UI case is not independently reproduced.

### 60. Visit notes hidden

**Current disposition:** Scoped evidence

**Original requirement:** [F] "Notes for your visit" is not shown anywhere. Show it in appointment details and the queue row (truncated, with full text on hover).

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes private detail notes/reasons/check-in rendering and honest missing-note/timestamp behavior. AppointmentRows/SessionQueue reuse presentation and detail callers; long-note hover/mobile access remains visual scope.

### 61. Missing patient Deepa

**Current disposition:** Scoped evidence

**Original requirement:** [F] Patient "Deepa" is not in this list. Find the filter or query that excludes it and fix.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Authorized visit-linked patients registered elsewhere were excluded by generic registration-only location filters. Coordinated queryPage repair matches registration or same authorized visit while preserving readScope/operational/own-doctor restrictions. Isolated role/status/pagination SQL scenarios pass; original Deepa record/actor/deployed data remains inaccessible, so exact UAT incident cause is not certified.

### 62. Future date of birth

**Current disposition:** Scoped evidence

**Original requirement:** [S] Date of birth accepts a future date. Block future dates with an inline message.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes shared future-DOB validation and formatted parser overflow rejection; R invokes validator/input. Fixture browser also blocks invalid 31 Feb booking progression. Every DOB browser variant is not claimed.

### 63. Age auto-calculation

**Current disposition:** Scoped evidence

**Original requirement:** [S] Age should auto-calculate from date of birth. Read-only age that updates from the date of birth.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes “date of birth blocks future and computes age”; R watches DOB/read-only age and retains age-only legacy values. Uncovered birthday/timezone cases remain test extensions, not missing implementation.

### 64. Optional sign-in

**Current disposition:** Acceptance pending

**Original requirement:** [Q] Why is there a sign-in option if the appointment books directly? Report. Recommend relabeling it as optional ("Already have an account? Sign in").

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Public booking now says “Sign in to your account” while preserving immediate guest booking. Current optional-sign-in copy recommendation is done; no new account/contact gate authorized. Browser discoverability is not certified.

### 65. Reset service unavailable

**Current disposition:** External gate

**Original requirement:** [F] Reset password shows "Service unavailable". Trace and fix.

**Current reconciliation:** Provider delivery is still unresolved. Credential editing does not prove forgot-password mail delivery.

**Carried-forward item evidence (historical; not a fresh live test):** Workspace reset flow is implemented and mail errors sanitized; actual deployed “Service unavailable” requires UAT configuration/provider/deployed-route evidence. No real reset/send executed.

### 66. Appointment message/email

**Current disposition:** Scoped evidence

**Original requirement:** [F] Patient receives no message or email for the appointment. Trace and fix. Use the branded template and the clinic's date and time format.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** API appointment/guest creation calls `lib/appointment-confirmation.ts` through existing SMTP/template. Outcomes persist in appointment JSON; notification setting/no-recipient/failure/unknown remain honest and do not undo booking. Main reports six fake-transport tests passed. Provider acceptance is not inbox delivery; no new SMS/center.

### 67. Clinic selection save error

**Current disposition:** Scoped evidence

**Original requirement:** [F] Error when selecting a clinic and saving. Reproduce and fix.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes shared settings roundtrip for both admins, foreign staff denial and owner-only generic update guards. Original selected-clinic/save failure is not reproduced; obtain exact rejected payload before changing ownership rules.

### 68. Patient delete

**Current disposition:** Existing behavior

**Original requirement:** [F] Deleting a patient does not delete. Trace and fix, with correct feedback. See 88 for delete versus inactive.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R operation deactivates and refreshes with truthful feedback; it is not physical deletion. Original expectation needs active/All filter comparison, not a presumed failed delete. Hard deletion remains held under 88.

### 69. Check-in at two Clinics

**Current disposition:** Approval held

**Original requirement:** [Q] Same doctor and day, different clinics: check-in works at both. Investigate and recommend. No change yet.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Cross-clinic doctor check-in rules must be investigated with authoritative session/date/presence context; no global cross-clinic prohibition introduced.

### 70. Current-time session default

**Current disposition:** Scoped evidence

**Original requirement:** [F] Queue session should auto-select by current time. Default to the session that matches the current time.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes “unique clinic-local running session is the default, but explicit choices and ambiguity win”; SessionSelector uses helper. Distinct snapshots remain preserved rather than blindly selecting first option.

### 71. Current Schedule labels

**Current disposition:** Acceptance pending

**Original requirement:** [F] Both show as "Current Schedule". Make the labels distinguish current from other schedules.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** SessionSelector distinguishes current, upcoming/other and historical schedule context instead of labeling every option current. Check multiple same-day sessions.

### 72. Back navigation

**Current disposition:** Acceptance pending

**Original requirement:** [S] No option to go back to the list. Breadcrumb and Back link.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** C Booking confirmation includes list/back navigation; workspace breadcrumbs already exist. Original target needs browser confirmation; not a blanket claim for every detail screen.

### 73. Ticket filename

**Current disposition:** Scoped evidence

**Original requirement:** [F] Ticket file name should read "DigiQ…". Change the file name only, for example DigiQ-ticket-{number}. Do not change the print layout.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** AppointmentTicket/VisitTicket uses DigiQ download naming; main reports latest ticket suite 24/24 passed including mixed clinic formats. Only assertions exercised by that suite are certified; protected ticket/QR geometry remains the requirement.

### 74. Invisible button label

**Current disposition:** Acceptance pending

**Original requirement:** [S] Button name not showing, design not proper. Visible label plus accessible name. Fix the style per spec.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Screenshot resolves to bulk-cancel submit. BulkAppointments uses visible loading/confirmation label and danger styling; verify contrast, label and accessible name in open dialog.

### 75. Waiting reschedule blocked

**Current disposition:** Acceptance pending

**Original requirement:** [Q] Reschedule is blocked for "Waiting, awaiting consultation". Report the current rule. Make the message friendly and explain why. No rule change yet.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Appointment action now explains unavailable rescheduling when existing canReschedule rejects called/in-consultation visits. Current explanatory recommendation is done; eligibility/server permissions unchanged. Any rule relaxation is a separate optional extension.

### 76. Sunday-only doctor

**Current disposition:** Scoped evidence

**Original requirement:** [F] Sunday-only doctor: cannot make an entry. Reproduce and fix.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes stored numeric weekday/string options including Sunday zero and backend selected-date Sunday availability. Original Sunday-only account incident is not reproduced; no further source defect established from it.

### 77. Load delay

**Current disposition:** Scoped evidence

**Original requirement:** [F/S] It takes time to load. Same as 35.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Queue GET measured with production handler/lock/full summary and1000-visit fixture:20 SQL statements for pages20/100, no attributed speedup. Five broad shared-membership catalog reads are diagnosed, not silently rewritten. Network/render/load/deployed latency remain unmeasured; skeletons alone do not certify speed.

### 78. Unclear section

**Current disposition:** Acceptance pending

**Original requirement:** [S] This section's purpose is not understandable. Section heading plus helper text. Use the screenshot to find the section.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** SessionQueue quick-switch section now explains viewing another doctor's session, distinct from calling/check-in. Screenshot target is resolved; keyboard/mobile discoverability awaits final pass.

### 79. Bulk result spam

**Current disposition:** Acceptance pending

**Original requirement:** [S] Bulk actions show multiple result messages. One consolidated toast (for example "5 of 5 updated") and a clear partial-failure summary.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** AdminListing and BulkAppointments use consolidated result summary/shared toast with partial failures. Verify no duplicate per-item success toasts under mixed outcomes.

### 80. Call Next latency

**Current disposition:** Acceptance pending

**Original requirement:** [F] "Call Next Patient" changes to "Calling" and is slow. Update the button and queue state immediately, reconcile with the server, and roll back on failure.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** SessionQueue immediately previews candidate token as requesting/awaiting-server, scope-binds feedback and clears pending presentation after response/failure; authoritative queue refresh remains. This deliberately does not falsely mark a patient called before server approval. Literal optimistic committed queue-state mutation is not implemented; latency improvement unmeasured.

### 81. Busy dialog cannot close

**Current disposition:** Acceptance pending

**Original requirement:** [S] Cannot close a dialog until the button finishes loading. Apply the decision in section 3.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** AppDialog blocks dismissal while saving, exposes disabled close and busy semantics; historical browser saving-close passed, pending-save Escape was not independently verified. Retest after newer caller changes.

### 82. Blank fields fail save

**Current disposition:** Acceptance pending

**Original requirement:** [S] Shows blank for all, but errors on save. Show the required marker and the inline error. Find which fields are affected.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Screenshot is exception Session: “optional/all” contradicted existing server requirement for multi-session timing override. R ExceptionSessionInput now determines requirement from date sessions, marks required and validates inline; all-session closure remains allowed.

### 83. Max Token bounds

**Current disposition:** Acceptance pending

**Original requirement:** [S] "Max Token" length is not fixed. Integer-only with min and max (reuse any existing server limit), helper text, inline error.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Existing positive-integer minimum and helper are present. Current policy recommendation is satisfied without inventing a general maxTokens maximum or borrowing duration-setting1000. A new maximum is optional policy scope, not a required missing implementation.

### 84. Buffer Minutes bounds

**Current disposition:** Acceptance pending

**Original requirement:** [S] "Buffer Minutes" length is not fixed. Same as 83.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Existing nonnegative-integer minimum and units/helper are present. No general bufferMinutes maximum is in the current API contract; a maximum would require separate policy approval. Browser validation presentation remains unverified.

### 85. Grouping/filter bug

**Current disposition:** Scoped evidence

**Original requirement:** [F] Filter does not work with group by "Doctor / Clinic". Fix.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes report query allowlist/search/sort, draft appointment/report filter wiring and scoped SQL filtering tests. C/API pass grouping/doctor/clinic/search/sort together; specific UAT dataset remains unreproduced.

### 86. Status total mismatch

**Current disposition:** Scoped evidence

**Original requirement:** [F] 13 appointments: 8 completed, 1 cancelled, 2 absent, where are the other 2? Make the status counts reconcile with the total (include every status, or an "Other" bucket).

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes “reported 13 visits reconcile including the two unlisted outcomes”, residual UI/CSV parity and explicit inconsistent-total errors. Active/other buckets account for missing outcomes rather than hiding discrepancies.

### 87. Address suggestions absent

**Current disposition:** Acceptance pending

**Original requirement:** [F] Location fields show a message but no list to search. Investigate the autocomplete source (missing key, endpoint or provider). Fix it or report the blocker.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Local-master category/search/active/empty SQL tests pass. R/SuggestionInput distinguish empty versus unavailable requests, show actual friendly error plus Retry, preserve manual text and explain local catalog (not geocoder). No speculative catalog seeding. Original UAT category inventory/response and interactive rendering remain unverified; see remaining diagnostics.

### 88. Delete versus deactivate

**Current disposition:** Acceptance pending

**Original requirement:** [Q] Delete marks the record inactive instead of deleting. Report the current behavior. Make dialog wording match what actually happens. Recommend delete versus deactivate per entity.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Current recommended deactivate-with-history behavior and truthful R/U wording are already done. No permanent-delete/retention change was authorized; that optional extension is separate from completed current scope.

### 89. Slow doctors

**Current disposition:** Scoped evidence

**Original requirement:** [F] Doctors take too much time to load. Same as 23.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Same measured local list investigation/repair as23: doctor20 median improves54% in the stated fixture only, with real SQL scope/privacy and query-budget assertions. Original UAT, network and browser timing remain unproven.

### 90. Family booking

**Current disposition:** Approval held

**Original requirement:** [P] Booking for a family member. Proposal only.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Family-member booking remains proposal only; relationship/consent/identity and patient-access data impact unresolved. No implicit registration on another person's behalf added.

### 91. Receptionist creation

**Current disposition:** Existing behavior

**Original requirement:** [Q] Staff screen only adds doctors, so where is a receptionist added? Check whether a receptionist role exists and how it is created. Report. If it does not exist, treat it as a proposal.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Receptionist role exists and U staff tabs/role-specific creation support it; no new role needed. Verify access/navigation discovery for the reported account, not permission expansion.

### 92. Forgot password

**Current disposition:** External gate

**Original requirement:** [F] Forgot password should work. Trace and fix.

**Current reconciliation:** Same live recovery/delivery blocker as 65; no new send or account reset.

**Carried-forward item evidence (historical; not a fresh live test):** Same deployment/delivery limit as 65. Workspace reset implementation and isolated tests do not prove authoritative UAT forgot-password delivery.

### 93. Try later/emergencies

**Current disposition:** Acceptance pending

**Original requirement:** [Q] "Please try later": how long, and what about emergencies? Show the real wait time if the existing limit provides it. Propose an emergency path in the report.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Manual auth wrapper reads actual Retry-After and patient login displays the resulting cooldown/countdown. Current retry explanation is implemented; no fabricated wait or rate-limit bypass. Emergency process remains an optional policy extension; countdown interaction awaits browser evidence.

### 94. Check-in time display

**Current disposition:** Scoped evidence

**Original requirement:** [S] Patient check-in time should show. Add a "Checked in at" column and detail field, in the clinic's time format.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes consultation check-in detail/presentation and missing-timestamp handling; AppointmentRows/details use record format. This timestamp is consultation check-in, not presumed physical arrival.

### 95. Absent next-called patient

**Current disposition:** Scoped evidence

**Original requirement:** [F] After marking the "Next Called" patient absent, the next waiting patient is not shown as "Called Next". Fix the queue state update.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes real SQL reservation order/explicit skip, CURRENT/NEXT generated wire response and independent queue contention/skip-vs-check-in tests. Original absent-promotion screen incident is not reproduced; full suite supports existing ordering, not a business-rule change.

### 96. Completed ticket action

**Current disposition:** Scoped evidence

**Original requirement:** [F] Ticket is not useful for completed appointments. Hide the ticket action for completed appointments.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Shared presentation guard hides completed tickets; main's fixture browser explicitly confirmed completed row has no Ticket action. Latest ticket suite 24/24 also passed; no hidden action is claimed for untested variants.

### 97. Copy schedule days

**Current disposition:** Scoped evidence

**Original requirement:** [S] "Copy for all" should show. Add "Copy to all days" and "Copy to selected days" in the schedule editor (section 6A).

**Current reconciliation:** Later fixture checks cover selected-day copying, protected linked sessions, partial failure retention and safe retry. Full clinic/doctor acceptance matrix remains outstanding.

**Carried-forward item evidence (historical; not a fresh live test):** ClinicRegistrationHours and doctor WeeklyOverview callers expose copy-to-all and selected-days; schedule UX retains exact typed minutes and clinic bands. Verify partial failure/overlap handling and protected linked changes.

### 98. Doctor at multiple Clinics

**Current disposition:** Approval held

**Original requirement:** [Q] One doctor can visit multiple clinics. Investigate and recommend. No change yet.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Multiple clinic assignments already exist; cross-clinic schedule overlap/operational access rules remain. Recommendations do not authorize new simultaneous-consultation behavior.

### 99. Review/preview/apply labels

**Current disposition:** Acceptance pending

**Original requirement:** [Q] "Review changes", then "Preview Changes", then "Apply reviewed changes". Make labels consistent now (sentence case, one name per step). Recommend whether the extra step can be merged.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** LinkedScheduleControls labels were reconciled without removing review/apply safeguards. Merging protected review steps remains product-held.

### 100. Branch spelling/term

**Current disposition:** Acceptance pending

**Original requirement:** [S] Wrong spelling of "Branch". Find and fix. Use "Clinic" per section 3.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** U assignment labels and R location picker/filter labels now use Clinic/Clinic Group; shared title mappings distinguish parent and location. Internal identifiers remain intentionally unchanged; final visible-string sweep required.

### 101. Explain Clinic/location

**Current disposition:** Acceptance pending

**Original requirement:** [S] What is the use of "branch"? InfoTooltip or helper text.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** R location Editor explains physical care location within Clinic Group, address/timezone/hours/link and contact inheritance versus staff login/notification configuration. Current helpers replace the identified ambiguity; browser discoverability remains.

### 102. Credentials for entity

**Current disposition:** Acceptance pending

**Original requirement:** [Q] No option to set its credentials. Identify which credentials are meant, report the current flow, and recommend.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Location helper now explicitly explains no standalone clinic/location login: named staff use accounts, assignments and invitations. Current clarification is done, not an SMTP gap or a requirement for shared clinic passwords.

### 103. Doctor filter

**Current disposition:** Acceptance pending

**Original requirement:** [S] Add a Doctor filter. Add to the relevant tables.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** C appointment/report filter callers and R schedules/exceptions expose Doctor selectors; role-fixed doctor scope is preserved. Verify every relevant table from original listing inventory.

### 104. Status-change notifications

**Current disposition:** Acceptance pending

**Original requirement:** [Q] If I change the status, whom do I inform? Add helper text describing what actually happens. Recommend whether notifications are needed.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Entity-specific status-effects helpers are done and explain actual access/history consequences without promising delivery. Automatic recipient/channel notifications are a separate optional extension, not a required unimplemented helper.

### 105. Wasted layout space

**Current disposition:** Acceptance pending

**Original requirement:** [S] This takes too much space. Move the primary action into the PageHeader and give the list the full width.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** C Workspace page heading now owns dashboard primary booking CTA; Dashboard list uses full width and former booking side card is removed. Exact requested placement is wired, awaiting visual check.

### 106. Optional mobile verification

**Current disposition:** Scoped evidence

**Original requirement:** [Q] "Mobile verified: No", but there is no way to verify and the field is optional. Report. Recommend hiding the field unless a verification flow exists.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Unsupported mobileVerified patient listing/export column was removed in source; current fixture browser confirms no unsupported badge on the patient listing. Database/verification behavior unchanged; no SMS service authorized. Export removal is source-traced, not a separate browser export check.

### 107. Reason not shown

**Current disposition:** Acceptance pending

**Original requirement:** [F] Reason entered is not shown anywhere. Show it in the relevant detail view and list row.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Screenshot refers to reschedule/skip/cancel reasons. API appointment serialization plus AppointmentRows/AppointmentDetails surface stored reasons/history, avoiding actor IDs for patients; verify each action and legacy empty history.

### 108. Deployed authentication parity

**Current disposition:** External gate

**Original requirement:** [Authentication review] Reconcile the user-reported deployed JWT implementation with workspace native opaque sessions. Determine which checklist items already exist before proposing any implementation; team familiarity motivated the deployed JWT choice.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Workspace supports explicit JWT/native selection; actual manually changed UAT build/token middleware still unavailable for comparison. No deployed parity conclusion.

### 109. Session lifetime policy

**Current disposition:** Approval held

**Original requirement:** [Authentication review] If JWT is chosen, define cookie transport, access lifetime, refresh behavior and maximum session lifetime. Proposed baseline: 15-minute access and a 12-hour overall session, subject to approval.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Current option retains fixed 12-hour database-backed lifetime/cookie transport. Proposed 15-minute access plus renewal is not approved/implemented.

### 110. JWT claim validation

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Implement strict JWT signing/verification with a maintained library, permitted algorithm, issuer, audience, token type and timestamps; minimal claims with stable user/session IDs, no patient data.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Historical authentication/JWT suite in progress report passed strict algorithm/signature/issuer/audience/type/timestamps and identity checks. Live activation not tested.

### 111. Signing-key cutover

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Configure dedicated signing keys, startup validation, rotation overlap and a compromise response; never expose signing secrets to the browser.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Disposable coordinated single-key cutover/compromise rehearsal passed in33/33 auth-retirement run: old-key rejection, new-key fixed12h login, database revocation and rollback-resurrection hazard/cutoff. Overlap/refresh is not required by current policy. Actual key activation/replacement remains authorized operator scope; native default unchanged.

### 112. Common session issuance

**Current disposition:** Acceptance pending

**Original requirement:** [Authentication review] Migrate all six existing session-creation sites: staff login, legacy device verification, invitation acceptance, registration verification, patient verification and demo login. Remove the legacy site if approved.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Auth routes use shared session issuance across login, challenge, invitation, registration, patient and demo paths; current transaction-aware changes need full end-to-end matrix, not just helper inspection.

### 113. JWT middleware

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Replace opaque-session middleware and staff proof checks with verified JWT/session identity, preserving live database authorization and active-account checks.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Historical isolated JWT middleware tests preserve live-session/active-account checks and strict mode handling. Not deployed UAT proof.

### 114. Refresh-token model

**Current disposition:** Approval held

**Original requirement:** [Authentication review] For short access tokens with renewal, add hashed refresh credentials, atomic rotation, reuse detection and a maximum lifetime that renewal cannot extend indefinitely.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** No refresh credentials/rotation/reuse model added. Depends on short-access policy and separately approved schema; fixed-duration session does not silently renew.

### 115. Immediate revocation

**Current disposition:** Acceptance pending

**Original requirement:** [Authentication review] Preserve immediate revocation on logout, reset/change password, deactivation and demo disable/rotation using server-side session state; do not rely solely on JWT expiry.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Password transactions revoke sessions; session issuance shares credential lock, protecting concurrent login/reset. Logout/deactivate/demo revocation still require full current matrix.

### 116. Frontend session lifecycle

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Update frontend expiry/renewal/logout handling, single-flight refresh and private-cache clearing. Do not put access credentials in localStorage or blindly replay writes.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Isolated lifecycle tests cover protected401 cache/identity clearing,60-second single-flight status and cross-tab/stale/abort safety. Fixture browser401 reached sign-in after one POST/no retry; current cross-tab logout with fake shared-server auth/BroadcastChannel sends other private tab to sign-in, no rebroadcast loop after1s. Real-server revocation only isolated-tested, not live UAT. No renewal required in fixed-duration mode.

### 117. API authentication contracts

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Update OpenAPI session/security contracts and regenerate API clients/validators; align manually written auth requests and retain cookie/CSRF protection.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** AuthStatus OpenAPI CSRF contract corrected; generated/manual metadata and “auth status requires no CSRF token…” contract test pass in 321. Main additionally reports seven CSRF tests passed separately; they are not added to 321. No claim of universal API security certification.

### 118. Password policy

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Apply the prompt-approved minimum-eight-character letters-and-numbers password rule consistently on client/server; retain Argon2id and existing valid password hashes.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Historical password-rule tests passed eight-character letters/numbers policy; Argon2id preserved. New forms call shared policy; no forced reset of existing valid hashes.

### 119. Atomic password/session updates

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Make password updates, challenge consumption and session invalidation atomic/concurrency-safe, including concurrent login versus password reset.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** API native-auth/auth routes serialize credential changes and session issuance with transaction advisory locks, atomic challenge consumption and session invalidation. Main reports 13 contention tests passed, including login/reset ordering and rollback; not live deployment verification.

### 120. Recovery-token supersession

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Invalidate superseded outstanding recovery credentials following password changes/resets under an explicit policy; retain single-use expiring invitations and recovery links.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Password-update transaction consumes outstanding setup/reset credentials and revokes sessions under same user lock; main-reported 13-test contention suite covers token replay/rollback and supersession. No credential data exposed.

### 121. Recovery rate-limit policy

**Current disposition:** Acceptance pending

**Original requirement:** [Authentication review] Reconcile the remaining administrator-assisted reset target-account cap with the no-per-account recovery-cap policy; preserve IP and token abuse protection.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** RR administrator-assisted reset removes target-account rate-limit call while retaining request/IP/token protections. Review parity with forgot-password policy in tests.

### 122. Distributed abuse protection

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Review endpoint-specific limits for password changes, registration verification, challenges and refresh; ensure limits behave correctly across server instances.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** `consumeRateLimit` uses database atomic upsert; SMTP test limiter uses it. Main-reported contention suite covers independent-client limit enforcement and resend concurrency. Complete endpoint inventory/production topology review remains.

### 123. Normalized email uniqueness

**Current disposition:** External gate

**Original requirement:** [Authentication review] Preflight case-insensitive email collisions and normalization, then propose safe uniqueness enforcement. Never auto-merge accounts.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Development read-only normalized-email collision groups/accounts0/0; actual UAT/VPS inventory unverified. No uniqueness migration or automatic merge performed; clean current aggregates do not prove atomic uniqueness.

### 124. Verified email change

**Current disposition:** Approval held

**Original requirement:** [Authentication review] Define and implement verified email-change behavior, notification and session/link revocation policy after approval.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Verified email-change notifications and revocation policy remain approval-held; do not silently treat general profile update as verified ownership change.

### 125. Retired device verification

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Resolve stale device-verification UI/endpoints. Ordinary staff password login must remain independent of SMTP; preserve patient email-code separation.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Repository retirement complete: unreachable device form/helper removed; verify-device tombstone410 issues no credentials/cookie/email and retains CSRF/origin/no-store. Historical valid challenges cannot grant access.33/33 rehearsal covers retired path and SMTP-independent staff login; deployed stale callers remain unverified.

### 126. Target account readiness

**Current disposition:** External gate

**Original requirement:** [Authentication review] Inventory each actual deployment/database using aggregate account, password-readiness, invitation and collision counts; do not expose account lists or credentials.

**Current reconciliation:** Historical development inventory is not a fresh database query and must not be treated as current production readiness.

**Carried-forward item evidence (historical; not a fresh live test):** Development aggregate inventory complete:14/14 active staff lack password material; role/mapping/counts preserved. This is DEVELOPMENT-only and not evidence about published accounts. Actual-target enrollment/password/invitation readiness remains external; no resets performed.

### 127. Former-provider enrollment

**Current disposition:** External gate

**Original requirement:** [Authentication review] Complete controlled native-password enrollment for former Clerk users without native hashes; preserve existing native passwords, account IDs, roles and ownership.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Controlled former-provider native enrollment not exercised against actual affected accounts. Preserve IDs/native hashes and obtain target deployment inventory first.

### 128. Additional authentication schema

**Current disposition:** Approval held

**Original requirement:** [Authentication review] Approve additive session/refresh schema changes separately from the UI prompt’s two display-format fields. Preserve assignments, bookings, records and legacy IDs.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** No refresh/session schema change inferred from UI approval. Display preferences only use parent JSON; other auth schema requires separate approval.

### 129. Dormant provider code

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Clean dormant Clerk code, helpers, fixtures and misleading docs only after identifying their compatibility purpose. Archive rather than reactivate provider scripts.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Repository device/provider compatibility inventory and safe retirement complete; dead helper/commented provisioning removed and stale operator copy corrected. Defensive guards/tombstones/redaction plus historical mappings/schema/audits preserved.33/33 rehearsal includes source retirement assertions; actual provider configuration remains unmodified/unverified.

### 130. Provider configuration retirement

**Current disposition:** External gate

**Original requirement:** [Authentication review] Retire unused Clerk configuration after the target deployed build is verified independent. Do not delete the provider tenant/accounts or legacy columns as an incidental cleanup.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Unused Clerk configuration retirement depends on verifying target deployed build. No provider tenant/account/config deletion performed.

### 131. Cutover and rollback

**Current disposition:** Approval held

**Original requirement:** [Authentication review] Plan explicit old-session cutoff/re-login and a compatible rollback; no indefinite provider/native fallback or destructive database restore over newer bookings.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Explicit session cutoff/re-login and compatible rollback require deployment approval; no indefinite native/JWT/provider fallback added.

### 132. JWT security tests

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Test JWT tampering, claims, expiry, key rotation, renewal races, refresh reuse and revocation if JWT is selected; adapt security tests appropriately if opaque sessions remain.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Historical321 passes strict JWT issuance/tampering/claims/expiry/revocation/native-no-fallback plus contention races;33/33 retirement rehearsal now covers current single-key cutover/compromise response. Refresh/reuse/overlap remains conditional optional policy, not a missing fixed-duration test requirement.

### 133. Authentication journey tests

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Test staff/patient/demo login, logout, registration, invitation, reset/change password, expired/used links, delivery failures and staff login without SMTP.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 passes native staff/patient/registration/invitation/recovery/demo, used/expired challenge, missing SMTP and provider-failure tests. Real delivery/enrollment remains external; fixture assertions do not prove live email completion.

### 134. Role and clinic boundaries

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Test every role and Clinic boundary, inactive users, owner-doctor relationships, guest/QR access and demo restrictions without changing business rules.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** 321 includes actual SQL authorization equivalence across all roles/resource families, scoped large datasets, owner-doctor, guest/QR/demo and inactive restrictions. Not a complete live-browser permission matrix; no rule changes inferred.

### 135. HTTPS/cookie/CSRF behavior

**Current disposition:** Scoped evidence

**Original requirement:** [Authentication review] Test real HTTPS browser transport, cookie flags/path, CSRF/bootstrap concurrency, expiry, logout and reverse-proxy origin handling; do not substitute handler tests for browser checks.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Isolated actual HTTPS transport/cross-origin/CSRF tests pass, plus seven separate CSRF tests. Fixture protected401 reaches sign-in with one POST/no replay; additive current cross-tab logout/BroadcastChannel passes with fake shared-server auth and no1s rebroadcast loop. Patient notice/reload/link also fixture-pass with waiting request/no client patientID. Actual server revocation remains separate isolated evidence; deployed proxy/authenticated UAT parity unverified.

### 136. Actual deployment inventory

**Current disposition:** External gate

**Original requirement:** [Authentication review] Identify authoritative live host and exact deployed versions; inspect the actual VPS deployment script, migrations, proxy configuration, signing-key readiness and release gates without exposing secrets.

**Current reconciliation:** No new item-specific browser/UAT closure in this review. Historical evidence below remains limited to its stated scope.

**Carried-forward item evidence (historical; not a fresh live test):** Exact UAT/VPS deployed revisions, scripts, proxy, migrations and signing-key readiness are unavailable; do not substitute workspace build for deployment inspection.

### 137. Backup, delivery and rollout

**Current disposition:** External gate

**Original requirement:** [Authentication review] Rehearse backup restore/migration, verify controlled real email delivery, compare preserved aggregate data counts, and monitor rollout with redacted logs. Publishing requires separate approval.

**Current reconciliation:** Fresh migration test now applies 15 migrations and verifies replay/schema equivalence on disposable PostgreSQL; this does not update the old 14-migration backup rehearsal or prove target restore readiness.

**Carried-forward item evidence (historical; not a fresh live test):** Development aggregates/guard restoration and source-migrated disposable backup/restore passed (14 migrations, matching schema/counts and8 guard-rejection assertions). Actual-target backup/recoverability, real delivery/cutover and rollout monitoring remain unverified. User owns publication; local fixture evidence is not release readiness.
