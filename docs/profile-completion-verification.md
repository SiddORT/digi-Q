# Missing profile-field completion verification

## Boundaries

- Patient, doctor and applicable staff/account profile fields use existing authorized resource and self-account writers.
- Focused saves compare the open editor's saved field baseline and update only its selected field/group. DOB and approximate-age baselines are checked together.
- Profile contact completion does not create accounts, verify contacts, change visit contacts or send messages.
- Approximate-age reference dates are server-owned. Unknown legacy reference dates remain unknown; exact DOB remains the source for calculated age.

## Checks

### Real routes and disposable PostgreSQL

`node --test artifacts/api-server/src/profile-completion.integration.test.mjs`

Six tests pass using actual routes, authorization, migrations and SQL in a disposable PGlite database:

- Patient contact, address, emergency contact and demographic groups persist without clearing unrelated fields.
- Exact DOB validation, zero approximate age, legacy reference semantics and explicit exact/approximate switching.
- Invalid input, unsupported fields, access denial/revocation and stale baseline rejection.
- Doctor/staff updates retain assignments and login identity.
- Specialization, qualifications, photo and address updates; interleaved demographic changes are rejected.
- Appointment private details reflect saved patient demographics without altering visit contact data.

Existing patient-registration tests and demographic/validator unit tests also pass. API and ClinicFlow TypeScript checks pass.

### Isolated browser UI

`pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/profile-completion.config.ts`

All eight scenarios passed across the initial pass and narrowly targeted follow-up checks:

- Focused DOB/approximate-age input, invalid age, cancel, zero save/reload and exact DOB save.
- Email validation, failed-save draft retention, retry and fixture reload; gender, phone, address and emergency-contact input focus.
- Doctor text, multiline, master lookup, multi-select, photo and numeric inputs; zero fee save/reload.
- Read-only missing values, denied access and permission revocation retain safe behavior.
- Four saved-DOB removal checks cover typed deletion and calendar Clear in both full and focused editors. Cancelling confirmation does not invoke the save callback; accepting invokes it. These four checks deliberately use a local callback fixture to isolate the destructive-transition gate.

The browser fixture intercepts all API requests and persists its fictional state across page reloads. It verifies UI behavior, **not a signed-in Preview-to-database round trip**; the separate real-route tests verify database persistence and private appointment projection. No real patient data or live messaging was used.

The browser checks caught and confirmed a fix for an open editor being unmounted when its access query refreshed. Open drafts now remain mounted; every save still rechecks server authorization and baseline.

The completion review also identified two corrected safety gaps: every removal of a saved DOB now requires confirmation at submission, including typed deletion and calendar Clear; patient DOB/age updates require both baseline keys even when only one value is changed. Real-route tests reject incomplete demographic baselines and stale changes to either member of the pair.

Real-route regression coverage also confirms that clearing an exact DOB through the full-editor request shape preserves an unchanged estimate's original reference date, including an unknown date. Only a newly entered or changed estimate receives today's server date; client-supplied reference dates cannot backdate a legacy estimate.

## Running application

API and ClinicFlow workflows were restarted successfully, with clean startup logs. A public Preview screenshot rendered normally. No production deployment was performed.
