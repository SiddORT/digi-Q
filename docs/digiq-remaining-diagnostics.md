# Remaining action/data diagnostics — findings 38, 40, 41, 61 and 87

## Scope and evidence limits

The original DOCX descriptions and embedded screenshots were inspected. The screenshot accompanying 39 supplies the inactive-action evidence for 38; the screenshot accompanying 41 supplies the shared error evidence for 40/41. Existing extracted images for 61 and 87 were inspected directly. No running browser, workflow, production database, real account, role, assignment, email delivery or real catalog was changed or tested. Test data below is isolated and disposable.

## 38 / 40 / 41: identify the action before changing it

The original `/admin/settings?...&section=staff&tab=doctors` screenshot's confirmation says **“Revoke any pending invitation and send a new set-password invitation?”** The send icon's tooltip describes the same operation. This is invitation replacement, not account deactivation and not session revocation. The bulk bar visible in the error screenshot offers Activate and Deactivate, not a bulk invitation button. Two selected rows do not establish that the failed request was a batch API request. The visible error is HTTP 503 Service Unavailable; no response trace or SMTP diagnostic accompanies it.

Changes:

- Inactive, enrolled and unlinked-account invitations are disabled with a specific explanation. Row confirmation distinguishes replacement from account/session changes.
- Single-action results are beside the affected row and in a toast, not solely above the list.
- An explicit **Resend selected invitations** action confirms the selected count, sends sequentially through the existing individual API, skips ineligible records and consolidates successes/failures. It does not pretend to be atomic; individual failures do not undo successful sends.
- The mutation API rejects inactive accounts before rate-limit/delivery work and retains management-role boundaries: doctors manage receptionist invitations only, Clinic Admins cannot manage another administrator's invitation, and normal record scope still applies.
- A failed delivery now marks the invitation `failed` rather than leaving a superseded invitation shown as `sent`. The actual error still propagates. No authentication/session routine was changed for this task.

Reproduction:

1. A fixture invitation starts `sent` with a pending challenge and an active session. Injecting a delivery 503 consumes the superseded challenge, returns the error, marks the invitation `failed`, and leaves account status and session unchanged.
2. Removing the injected fixture failure lets retry issue exactly one new outstanding invitation. It still does not deactivate or sign out staff.
3. A mixed selection of eligible, inactive, enrolled, delivery-failing and unlinked records produces one success and four explained failures; only the two eligible linked accounts invoke the API.
4. Direct inactive, password-enabled and unauthorized requests fail before delivery.

**Unresolved actual-UAT dependency:** the original delivery 503's cause cannot be certified without authorized, redacted delivery/configuration diagnostics from that deployment. This work deliberately does not configure SMTP or send real mail. Successful fixture delivery is not proof of inbox receipt.

## 61: Deepa is missing from the staff booking patient picker

The screenshot is `/admin/book`, step **Your details**, with a selected clinic and an open patient picker. It is not the Patients table. The UI sends active-status, clinic and branch filters.

The list authorization contract already permits Clinic Admins/receptionists to read a patient through an authorized visit, even when their registration location differs. Doctors additionally need their own authorized doctor/clinic/branch visit; registration alone does not grant doctor visibility. Before the coordinated SQL repair, generic clinic/branch filtering matched only registration fields. Thus an authorized visit-linked patient could disappear specifically from the booking picker.

The performance worker implemented the coordinated repair in `queryPage`: retain `readScope`, match registration **or an authorized visit**, apply requested clinic and branch to the **same visit**, and retain operational scope and own-doctor constraints. This task did not alter the worker-owned SQL implementation.

The isolated PostgreSQL/WASM regression covers:

- registration in another tenant plus an authorized visit at the requested clinic/branch;
- same-clinic registration without a visit, own-doctor versus another doctor's visit, and another branch;
- inactive records excluded by the active picker, preserved when status filtering is removed;
- unrelated/global profiles and removed assignments remaining inaccessible;
- patient self-service's existing profile-filter behavior remaining unchanged;
- accurate filtered totals and pagination after relationship matching.

**Unresolved actual-UAT dependency:** the original Deepa record, actor identity/role, registration clinic/branch, authorized appointments and deployed request parameters were not accessible in this task. The fixture proves a real filtering defect and its repair, not that it was the sole cause of this specific person's omission. Do not alter that person's mappings/status to make a screenshot pass.

## 87: local address masters, not a proven external provider failure

The screenshot is Add Clinic. City, state, country and area are marked; city contains “Mumbai” and shows “No matching suggestions. You can keep your own text.”

Those fields query active local masters using the exact categories `city`, `state`, `country`, `area` (and `pincode` for postal suggestions). There is no geocoder/key dependency in this path. An empty filtered result is not evidence that a provider integration failed.

Changes:

- The control identifies its local-catalog/manual-entry contract.
- With no search it says no active values; with search it says no matching active values. It does not assert that the entire catalog is empty from a searched response.
- Request failures display the friendly actual error and Retry while preserving typed text. The dropdown displays an unavailable state, not a misleading empty-match result; stale cached options are hidden on failure.
- Arbitrary typed text remains accepted; no catalog values were invented or seeded.

Isolated SQL tests verify all five location categories, case-insensitive name search, inactive exclusion, genuine unmatched results and an empty category.

**Unresolved actual-UAT dependency:** the deployed category inventory and the original failed/empty response are unavailable here. Determine catalog emptiness, inactive values, name mismatch or request failure from that deployment's authorized response before importing legitimate catalog data. An external address provider remains a separate proposal.

## Additional approved UI-only changes

- Removed `mobileVerified` from the patient listing/export column definition only; the database and verification behavior remain intact.
- Location helper text now explains that clinics have no separate login: named staff use accounts, assignments and invitations. Location contact inheritance does not provision staff credentials.

## Validation performed

- Targeted backend invitation regressions: **5 passed**, including two existing invitation supersession/eligibility tests and three new single/batch/authorization tests.
- Targeted patient relationship and location-master SQL regressions: **2 passed**, using isolated PostgreSQL/WASM without an application database connection.
- SuggestionInput static component-render regressions: **2 passed**, covering empty, unmatched, error/Retry/manual text, loading and populated states with a test-only popover shell. These are not interactive browser evidence.
- ClinicFlow TypeScript check: **passed**.
- No full-suite, workflow, live browser or actual-UAT verification was performed. Interactive focus/layout and real inbox delivery are not certified.