# Disposable saved-assignment browser verification

**Target:** `http://127.0.0.1:8099` (disposable app only; no workspace app/database used)  
**Date:** 2026-10-08  
**Result:** Reached saved-scope journeys passed. The initially stale doctor-profile field was corrected and passed the targeted refresh/draft recheck below.

## Identity and scope checks

All roles were verified with same-origin, credentialed `GET /api/me` in separate browser contexts:

- `adm@test.invalid`: `clinicAdmin`, clinics `c1` and `c2`.
- `rec@test.invalid`: `receptionist`, sole clinic/branch `c1`/`b1`.
- `docu@test.invalid`: `doctor`, `doctorId=d1`, clinics `c1`/`c2`, branches `b1`/`b2`.
- `sa@test.invalid`: `superAdmin`, no clinic or branch pin.
- `adm2@test.invalid`: `clinicAdmin`, only clinic `c3`.

`adm2` could read only the foreign `c3`/`d3` lists. Same-origin reads of `c1`, `b1`, and `d1` each returned HTTP 403, `Record outside your scope`.

## Patient saved scope

As `adm`, explicitly selected Lakeview Main, opened Add Patient, and verified the rebuilt editor displayed fixed Clinic Group/Clinic inputs. Both inputs were read-only, enabled, `tabIndex=0`, and focusable; neither scope container had a clear button. Created `Nora Vale Disposable Quartz` with no email/mobile and no linked user, then changed gender and saved. Same-origin readback returned `clinicId=c1`, `branchId=b1`, `userId=null`, `email=null`, `mobile=null`. Reopening Edit showed the same saved Lakeview names and the same read-only/focusable/non-clearable behavior.

Switched the admin workspace to Hillside Main. Nora disappeared from that location’s list, while same-origin readback still returned `c1`/`b1`.

Forged patient moves were rejected and left Nora unchanged:

- `branchId:null` with required `fullName` returned HTTP 400, `branchId Expected string, received null`.
- foreign `branchId=b3` returned HTTP 403, `Registration assignments cannot be moved`.

## Receptionist journey

The receptionist’s new-patient form prefilled Lakeview Clinic/Main in read-only, enabled, focusable, non-required scope inputs. No duplicate clinic/branch entry was exposed; contacts were optional. `/receptionist/book` showed fixed Lakeview context and a read-only doctor field; the only required booking input was the date. No appointment was created.

## Doctor cross-session refresh

Using the admin session, patched existing `d1`, `c1`, and `b1` records (same IDs; doctor email remained `docu@test.invalid`; branch remained under `c1`) and supplied required clinic/branch address values. All patches and subsequent reads returned HTTP 200. After a route navigation in the separate doctor session, the header/location labels showed the updated doctor, clinic, and branch names.

For the no-navigation/no-focus refresh check, left the doctor Profile page open with an unsaved Photo URL draft, applied a second distinct update from the admin session, and polled without doctor-page navigation/focus. The location selector updated to the Automatic labels after **24,625 ms**. The unsaved Photo URL draft remained intact.

**Initial inconsistency (subsequently resolved):** the doctor header/profile heading refreshed to the saved doctor name, but the Profile Full Name textbox remained `Dr Meera Rao` after navigation and after the timed refresh (server value was `Dr Meera Rao Automatic`). The targeted recheck below verifies the correction, including dirty-draft preservation and refreshing fields after a successful save.

## Super Admin booking and availability

The unpinned Super Admin’s `/admin/book` retained a Clinic Group selector with multiple choices. After choosing Lakeview, the Clinic and Doctor inputs became read-only and resolved to `Lakeview Main Automatic` / doctor `d1`. Reopening the group selector then offered only Lakeview and Hillside, excluding Foreign Clinic; selecting Hillside resolved to `Hillside Main` and the same doctor `d1`, consistent with `d1` assignments `c1/c2` and `b1/b2`. The doctor was auto-resolved and not manually selectable in this state.

Booking screens explicitly reported no doctor sessions and no availability response; Continue was disabled. The UI states that opening hours alone do not create bookable sessions. No weekly schedule or appointment was saved, and no appointment email/notification was triggered.

On `adm2` `/admin/availability`, the Weekly list was empty. Add Schedule nevertheless defaulted the sole assigned contexts `Dr Foreign`, `Foreign Clinic`, and `Foreign Main`; each was read-only, enabled, focusable, and not required. The form was canceled/discarded without saving a schedule.

## Screenshot references

- Patient edit with saved scope: `9y6tos`
- Single-location Add Patient scope fields: `2wq71c`
- Multi-choice Super Admin clinic-group selector: `7wb029`
- Sole-assignment Add Schedule defaults: `gh6gs1`
- No-session booking state: `g82e6m`
- Doctor profile with retained unsaved draft: `lfhvls`

No application source files were changed. This report records the browser observations and remaining doctor-profile stale-field issue.

## Narrow doctor-profile refresh recheck (fresh disposable fixture)

The disposable server/database had been rebuilt; this was a focused recheck only, using separate fresh `docu@test.invalid` and `adm@test.invalid` contexts. Same-origin `/api/me` confirmed docu was doctor `d1` and adm was Clinic Admin. The doctor selected Lakeview Main and opened `/doctor/profile`, which initially showed `Dr Meera Rao` / `docu@test.invalid`.

1. Entered unsaved Photo URL `https://example.invalid/recheck-unsaved.png`. Admin PATCHed existing d1 to `Dr Meera Rao First Refresh`, retaining the same email. With no doctor-page navigation/focus action after PATCH, both the untouched Full Name textbox and header updated in **28,203 ms**; the Photo URL draft survived.
2. Saved the doctor profile. The UI showed `Updated successfully`; admin-session readback returned the same `id=d1`, email `docu@test.invalid`, updated name, saved Photo URL, and unchanged `clinicIds=[c1,c2]` / `branchIds=[b1,b2]`.
3. Admin PATCHed d1 again to `Dr Meera Rao Second Refresh`, retaining the same email. With no doctor-page navigation/focus action, both Full Name textbox and header updated in **28,675 ms**; the saved Photo URL remained present. This confirms a submitted field was eligible for a later remote refresh.
4. Optional navigation check: navigated to Doctor Dashboard and back to Profile. The Full Name textbox, profile heading, and header remained `Dr Meera Rao Second Refresh`; Photo URL remained populated.

**Resolution:** The earlier stale Full Name field observation did not reproduce after the rebuilt editor's live initial sync / dirty-field handling and saved-revision update. Both unsaved-draft preservation and later refresh of the successfully saved field passed in this focused recheck.

Follow-up screenshots: first refresh with unsaved draft `jaj5j9`; successful profile save `f6y8o7`; second refresh `8hbq0g`; post-navigation final Profile `d8rmao`.
