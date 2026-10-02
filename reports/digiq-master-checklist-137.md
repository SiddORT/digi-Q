# DigiQ — Master checklist (137 items)

This master list combines all 107 original QA findings with 30 authentication review items, numbered 108–137. Original findings and classifications remain unchanged. UAT at https://uat.digi-q.in is authoritative. The user reports that authentication was manually changed from Clerk to JWT after deployment; workspace source still uses opaque database sessions. The live JWT implementation has not been independently verified. Added items are review and conditional remediation work, not 30 proven missing features. No application implementation or publishing is authorized by this document.

## Original QA findings: 1–107

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

## Authentication review: 108–137

108. [Authentication review] Reconcile the user-reported deployed JWT implementation with workspace native opaque sessions. Determine which checklist items already exist before proposing any implementation; team familiarity motivated the deployed JWT choice.

109. [Authentication review] If JWT is chosen, define cookie transport, access lifetime, refresh behavior and maximum session lifetime. Proposed baseline: 15-minute access and a 12-hour overall session, subject to approval.

110. [Authentication review] Implement strict JWT signing/verification with a maintained library, permitted algorithm, issuer, audience, token type and timestamps; minimal claims with stable user/session IDs, no patient data.

111. [Authentication review] Configure dedicated signing keys, startup validation, rotation overlap and a compromise response; never expose signing secrets to the browser.

112. [Authentication review] Migrate all six existing session-creation sites: staff login, legacy device verification, invitation acceptance, registration verification, patient verification and demo login. Remove the legacy site if approved.

113. [Authentication review] Replace opaque-session middleware and staff proof checks with verified JWT/session identity, preserving live database authorization and active-account checks.

114. [Authentication review] For short access tokens with renewal, add hashed refresh credentials, atomic rotation, reuse detection and a maximum lifetime that renewal cannot extend indefinitely.

115. [Authentication review] Preserve immediate revocation on logout, reset/change password, deactivation and demo disable/rotation using server-side session state; do not rely solely on JWT expiry.

116. [Authentication review] Update frontend expiry/renewal/logout handling, single-flight refresh and private-cache clearing. Do not put access credentials in localStorage or blindly replay writes.

117. [Authentication review] Update OpenAPI session/security contracts and regenerate API clients/validators; align manually written auth requests and retain cookie/CSRF protection.

118. [Authentication review] Apply the prompt-approved minimum-eight-character letters-and-numbers password rule consistently on client/server; retain Argon2id and existing valid password hashes.

119. [Authentication review] Make password updates, challenge consumption and session invalidation atomic/concurrency-safe, including concurrent login versus password reset.

120. [Authentication review] Invalidate superseded outstanding recovery credentials following password changes/resets under an explicit policy; retain single-use expiring invitations and recovery links.

121. [Authentication review] Reconcile the remaining administrator-assisted reset target-account cap with the no-per-account recovery-cap policy; preserve IP and token abuse protection.

122. [Authentication review] Review endpoint-specific limits for password changes, registration verification, challenges and refresh; ensure limits behave correctly across server instances.

123. [Authentication review] Preflight case-insensitive email collisions and normalization, then propose safe uniqueness enforcement. Never auto-merge accounts.

124. [Authentication review] Define and implement verified email-change behavior, notification and session/link revocation policy after approval.

125. [Authentication review] Resolve stale device-verification UI/endpoints. Ordinary staff password login must remain independent of SMTP; preserve patient email-code separation.

126. [Authentication review] Inventory each actual deployment/database using aggregate account, password-readiness, invitation and collision counts; do not expose account lists or credentials.

127. [Authentication review] Complete controlled native-password enrollment for former Clerk users without native hashes; preserve existing native passwords, account IDs, roles and ownership.

128. [Authentication review] Approve additive session/refresh schema changes separately from the UI prompt’s two display-format fields. Preserve assignments, bookings, records and legacy IDs.

129. [Authentication review] Clean dormant Clerk code, helpers, fixtures and misleading docs only after identifying their compatibility purpose. Archive rather than reactivate provider scripts.

130. [Authentication review] Retire unused Clerk configuration after the target deployed build is verified independent. Do not delete the provider tenant/accounts or legacy columns as an incidental cleanup.

131. [Authentication review] Plan explicit old-session cutoff/re-login and a compatible rollback; no indefinite provider/native fallback or destructive database restore over newer bookings.

132. [Authentication review] Test JWT tampering, claims, expiry, key rotation, renewal races, refresh reuse and revocation if JWT is selected; adapt security tests appropriately if opaque sessions remain.

133. [Authentication review] Test staff/patient/demo login, logout, registration, invitation, reset/change password, expired/used links, delivery failures and staff login without SMTP.

134. [Authentication review] Test every role and Clinic boundary, inactive users, owner-doctor relationships, guest/QR access and demo restrictions without changing business rules.

135. [Authentication review] Test real HTTPS browser transport, cookie flags/path, CSRF/bootstrap concurrency, expiry, logout and reverse-proxy origin handling; do not substitute handler tests for browser checks.

136. [Authentication review] Identify authoritative live host and exact deployed versions; inspect the actual VPS deployment script, migrations, proxy configuration, signing-key readiness and release gates without exposing secrets.

137. [Authentication review] Rehearse backup restore/migration, verify controlled real email delivery, compare preserved aggregate data counts, and monitor rollout with redacted logs. Publishing requires separate approval.

All appended items: audit pending; verify what already exists in UAT and implement only approved gaps.

## Shared standards (not additional numbered findings)

- Produce the complete audit: each of 107 findings gets screen, component, current behavior, root cause where established, resolution, class, priority and status. Do not infer causes from screenshots alone.

- Use DigiQ user-facing branding; recommend Clinic Group for parent and Clinic for location. Keep internal identifiers unless a technical reason requires change.

- Reconcile section 9 typography/spacing with explicitly preserved ticket layout and any approved public-page exceptions; identify missing semantic/border/status tokens without inventing them.

- Implement shared accessible password inputs, field labels/helpers/errors, validation, searchable portal selects, multi-selects and dependent-value preservation.

- Implement friendly in-app confirmation/discard dialogs, scrolling bodies/sticky footers, focus handling and saving-state dismissal rules. Browser tab-close/reload cannot be intercepted with a custom dialog.

- Standardize success/warning/error feedback, bulk partial-success summaries, friendly error translation, skeletons and loading buttons; never falsely report success.

- Add Clinic Group date/time preferences inherited by Clinics; retain each Clinic timezone. Defaults DD MMM YYYY and 12-hour; four date options and two time options; safe defaults for existing records.

- Centralize format/parsing across UI, inputs, emails, existing messages, tickets and downloads. Use each record’s own group format on mixed screens, defaults when unknown and safe filename separators.

- Audit canonical timestamp/date/time storage first. Display-setting changes must not rewrite data; obtain approval for any other migration. Preserve ticket geometry and QR size.

- Improve multi-step onboarding: titled stepper, Back/Next preserving input, inline errors, review/edit summary, completion actions and helpful explanations.

- Improve entry fields: DOB/age, timezone selector, editable phone-country suggestion, international phone validation, address-suggestion fallback, numeric units and existing limits. Propose missing limits/providers.

- Audit schedule model and rules before redesign. Propose slider step/session maximum; support exact typed minutes, Mon–Sun toggles, copy actions, summaries and mobile cards only within approved behavior.

- Propose schedule exceptions separately: one-date versus recurring, permissions, out-of-hours doctors, extended closing, midnight/DST/timezone effects and already-booked appointments. Do not equate schema support with product approval.

- Inventory every listing. Standardize visible search, 300ms debounce, server-side search/sort/pagination, page sizes 10/25/50/100 and existing default or 25; reset page on filters/search.

- Preserve approved filter behavior, selected values and explicit bulk selection semantics; add specified Doctor filters and active-filter chips. Propose genuinely new export/grouping capabilities if scope is unclear.

- Apply responsive/accessibility standards: 2-column desktop and 1-column below 640px, mobile labeled table cards, keyboard operation, visible focus, 44px touch targets, 200% zoom and no horizontal page overflow.

- Apply branded email/plain-text templates and current clinic formats to existing notification channels; do not create new SMS/notification infrastructure implicitly.

- Investigate each Q item and propose each P item without behavior changes; retest all findings after approved implementation and document partial, blocked and unchanged items.
