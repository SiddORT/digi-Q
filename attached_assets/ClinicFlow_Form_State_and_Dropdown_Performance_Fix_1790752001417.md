# CLINICFLOW — FORM STATE & DROPDOWN PERFORMANCE FIX

## Objective

Fix two system-wide issues in ClinicFlow:

1. Selected dropdown values disappear while the user continues filling a form.
2. Dropdowns load extremely slowly, repeatedly buffer, or make the application sluggish.

Fix the actual root cause. Do not redesign ClinicFlow or change existing business logic.

## 1. Fix disappearing dropdown values

Audit the existing form and dropdown implementation for:

- `value` / `defaultValue` conflicts.
- Form state being recreated or overwritten during re-renders.
- `useEffect` calls resetting fields unnecessarily.
- API responses overwriting current user selections.
- Components being remounted because of changing `key` values.
- Parent components replacing child form state.
- Dropdown loading states clearing selected values.
- Search state interfering with form state.

Use one reliable source of truth for each form field.

When a user selects a value, keep it selected while they:

- edit other fields,
- open another dropdown,
- search another dropdown,
- wait for another API request,
- trigger normal component re-renders.

Do not reset unrelated fields.

## 2. Handle dependent dropdowns correctly

Respect existing ClinicFlow dependencies such as:

`Clinic → Branch`

If a parent value changes, clear a dependent value only when that value is genuinely no longer valid.

Example:

- Clinic A + Branch A selected.
- Changing an unrelated field must not clear either value.
- Changing Clinic A to Clinic B may clear Branch A if Branch A does not belong to Clinic B.

Do not use broad form resets to implement dependent dropdowns.

## 3. Fix dropdown loading performance

Inspect the network/API behaviour and determine why dropdowns are slow.

Look for:

- repeated requests on every render,
- duplicate simultaneous requests,
- unnecessary refetching,
- unstable query dependencies,
- unnecessary query invalidation,
- component remounts,
- fetching the same data in multiple components,
- loading large datasets unnecessarily,
- search requests being sent too frequently.

Fix the underlying cause.

Reuse already-loaded dropdown data where appropriate and safe.

Respect existing authentication, authorization, clinic scope and branch scope when caching or reusing data.

Do not expose data outside the user's existing permissions.

## 4. Searchable dropdowns

Keep the existing searchable-dropdown requirement.

Search must not reset form values.

For large datasets, use the existing backend/search capability rather than loading unnecessary records into the browser.

If server-side search is used, debounce requests appropriately so every keystroke does not create an unnecessary API call.

Do not add artificial delays just to make the UI appear smoother.

## 5. Loading, error and empty states

Dropdowns must distinguish between:

- Loading
- Successfully loaded
- Empty result
- API error

Do not clear a valid selected value merely because options are refreshing.

Do not leave a dropdown buffering indefinitely.

Do not silently hide API failures.

## 6. Create and edit forms

Verify both create and edit forms.

For edit forms:

- Existing dropdown values must load correctly.
- Changing one field must not overwrite other fields.
- Refreshing dropdown data must not replace the user's current edits.

For create forms:

- Selected values must remain until the user changes them, resets the form, or a legitimate dependency makes the value invalid.

After a failed submission, preserve the user's entered values.

After a successful submission, retain the existing intended reset behaviour.

## 7. Do not change unrelated ClinicFlow functionality

Do not change:

- Authentication.
- Authorization.
- Clerk configuration.
- Staff email/password login.
- Patient email OTP login.
- Clinic/branch ownership rules.
- Doctor/receptionist mappings.
- Availability.
- Appointment logic.
- Patient logic.
- Queue logic.
- QR/check-in functionality.

Do not redesign the UI.

Do not introduce unnecessary libraries or complicated architecture.

Do not hardcode dropdown data.

Do not hide loading indicators.

Do not bypass APIs or authorization to make dropdowns faster.

## 8. Verify the actual reported bug

Test this exact flow:

1. Open a form with multiple dropdowns.
2. Select a value in the first dropdown.
3. Move to another field.
4. Select another dropdown value.
5. Enter/edit another field.
6. Open another dropdown or search within it.
7. Return to the first dropdown.

Expected result:

> The first selected value is still selected.

Then repeat the test with dependent dropdowns and edit forms.

## 9. Verify network behaviour

Inspect representative forms before and after the fix.

Confirm:

- The same dropdown data is not unnecessarily fetched repeatedly.
- Unrelated form changes do not trigger dropdown requests.
- Opening a dropdown repeatedly does not cause unnecessary requests.
- Search does not generate excessive requests.
- Background refresh does not reset form state.
- Slow API/database queries are investigated if they are the actual bottleneck.

Do not invent performance numbers. Report only what was actually observed.

## 10. Final checks

Before completing the task, verify:

- Dropdown selections persist.
- Multiple dropdowns work together.
- Dependent dropdowns behave correctly.
- Create forms work.
- Edit forms work.
- Search works.
- Loading/error/empty states work.
- No unnecessary duplicate requests remain.
- Existing authorization still works.
- Existing ClinicFlow workflows still work.

## 11. Final report

After implementation, provide:

### Root Cause
What actually caused the disappearing values and slow dropdowns.

### Changes Made
Files/components changed and what was fixed.

### Performance
What unnecessary requests or loading problems were found and fixed.

### Testing
Actual tests performed and their results.

### Remaining Issues
Clearly state anything that could not be verified.

## Final instruction

Do not stop at a visual fix.

**Inspect → reproduce → identify root cause → fix → test → inspect network behaviour → retest → regression check → report.**

Keep the solution simple, reliable and consistent with the existing ClinicFlow implementation.
