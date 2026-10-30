# Task 368 — ClinicFlow close/dismiss placement browser audit

> **Final interpretation:** the early “no defect” conclusion below was superseded by the expanded layer inspection at the end of this ledger. See [the findings report](README.md) for C1 and [durable screenshots](evidence/). Early observations are retained to distinguish the default-close hypothesis from the confirmed selector layering defect.

**Mode:** read-only. No application/source/test/fixture implementation was changed. This note is the audit artifact; screenshot JPEGs are not saved here. Managed app route `/` was first checked without auth and showed the public landing page. Authenticated surfaces below used separate browser contexts with fictional identities and intercepted `/api/**` requests; non-GET/HEAD methods were rejected before reaching the backend. This is fixture testing, not real/native authentication.

## Main journey — Add Schedule dirty close/discard

### `superAdmin` — `/admin/availability`, desktop 1440×900

- Rendered profile: `Fictional superAdmin` / `Super Admin`; mocked `/api/me` was requested and returned the matching fictional role.
- Weekly schedule list was empty. Add Schedule opened the actual `AppDialog` (`src/components/AppDialog.tsx`) with Schedule, Timing & Break, Capacity, and Queue Settings tabs. This fixture had no assigned clinic-group options, so Doctor and Clinic were disabled; the form stated “No active assigned clinic groups are available in this scope.”
- Selected Monday in Day of Week (local draft only). Header Close opened `Discard unsaved changes?` with “The changes you made in this form will be lost.” Keep editing closed only the prompt and preserved Monday. Footer Cancel also opened the same confirmation. Discard changes closed the form; the schedule list remained empty. No save was clicked; the recorded API calls contained no non-read request.
- AppDialog measured x=310, y=176.92, 820×546.16. Its custom close button was x=1077, y=181.92, 48×44. The discard confirmation was centered in the screenshot; button alignment appeared normal.

### `superAdmin` — `/admin/availability`, mobile 390×844

- Add Schedule occupied nearly the viewport, x≈0–390 and y≈34–810, with the header X and footer Cancel/Add Schedule visible. No horizontal document overflow was observed.
- Selected Monday locally and activated Close. The nested alertdialog measured x=17, y=330.30, 356×183.39; Keep editing and Discard changes buttons were both inside the viewport (y≈444.69). Discard closed both layers; list remained at zero.
- The open weekday picker was crowded over part of the form but stayed within the modal and had its own scroll area. In both the weekday selector and Rows per Page selector, visible X and chevron/picker marks corresponded to the SearchableSelect clear and dropdown affordances. No unrelated glyph was observed inside the discard confirmation. These were not confirmed defects.

### `clinicAdmin` — `/admin/availability`, desktop 1440×900

- Rendered profile: `Fictional clinicAdmin` / `Clinic Admin`; mocked `/api/me` returned `role: clinicAdmin`. This test-only fixture initially lacked a branch-list response; an in-browser GET-only fictional branch response was added (no files changed) to render the Schedule page.
- Add Schedule opened. The fixture still showed no active assigned clinic group and disabled Doctor/Clinic selectors. Monday was selected locally and Close opened the same discard alertdialog. Direct DOM geometry: x=530, y=368.45, 380×163.09. Discard closed it; `ca.seen` contained no non-read methods.
- ClinicAdmin dialog DOM was directly inspected; its close button measured the same 48×44 custom control. A clinicAdmin screenshot was not captured by the browser tool’s active-page screenshot limit.

## Other rendered dismissible surfaces checked

- **Mobile navigation**, `superAdmin`, `/admin/availability`, 390×844: hamburger opened the off-canvas sidebar with a dedicated `Close navigation` button and dim scrim. The dedicated close button returned to the schedule without navigation.
- **Notifications**, same context/route/viewport: panel opened with empty fixture data, explicit Close notifications, category tabs, and disabled Mark All as Read. It was closed explicitly; no state change or write.
- **Profile menu**, same context/route/viewport: displayed fictional superAdmin role and account actions, remained within the viewport, and had no close X; Escape dismissed it without activating an item or signing out.
- **Time picker**, `superAdmin` Add Schedule > Timing & Break, desktop 1440×900: Start/End/Break Start/Break End text inputs with `Open time list` triggers. Start Time picker opened at x=328, y=406.88, 190×291.80, with hour/minute, AM/PM, Clear, and Done controls. Escape closed only the picker; parent AppDialog remained open. No time was changed. No date picker was available on this schedule form.
- **Public guest booking**, `/guest-booking`, intercepted fixture: rendered “Patient Access · No Account Required / Guest Booking,” “No clinics found,” and “No clinics are accepting online bookings yet.” No booking was submitted.

## Identity and role/route coverage

All entries are fictional intercepted identities; they do not represent native accounts or live backend data.

| Role | Actual rendered route | Rendered role | Mock `/api/me` |
|---|---|---|---|
| superAdmin | `/admin/availability` | Fictional superAdmin / Super Admin | `role: superAdmin`, `id: fictional-superAdmin` |
| clinicAdmin | `/admin/availability` | Fictional clinicAdmin / Clinic Admin | `role: clinicAdmin`, `id: fictional-clinicAdmin` |
| doctor | `/doctor/availability` | Fictional doctor / Doctor | `role: doctor`, `id: fictional-doctor`, `doctorId: d1` |
| receptionist | `/receptionist/availability` | Fictional receptionist / Receptionist | `role: receptionist`, `id: fictional-receptionist` |
| patient | `/patient/appointments?size=20` | Fictional patient / Patient | `role: patient`, `id: fictional-patient`, `patientId: p1` |

Doctor and receptionist surfaces were identity-checked only; the generic fixture returned an empty branch list and did not support a valid active location for schedule editing. Patient appointments used an empty fixture list. No custom roles were exercised; a custom-role fixture response was empty, and role permissions were not changed.

## Close geometry / cascade assessment

- The rendered Add Schedule AppDialog had one visible close control: `.app-dialog-close`, `display:flex`, 48×44, within the header. The Radix default close node supplied by `components/ui/dialog.tsx` was present in the DOM but measured 0×0 and `display:none`. No visible duplicate close X was found.
- The nested discard confirmation fit and was centered in both tested viewports. Its buttons were aligned side-by-side and in bounds.
- Source inspection found the custom close rules in `components/app-dialog.css`; `components/uniformity.css` had no close-button rule implicated by this observation. No computed-style evidence supports a uniformity.css cascade defect.
- The supplied annotation’s apparent “random icons” was not reproduced as stray dialog-close icons. The selector controls exposed their own clear X and dropdown affordances. No confirmed close-placement issue was observed in the exercised Add Schedule occurrences.

## Not covered / limits

- The delegated browser initially produced session screenshot observations only, not saved files. The main audit subsequently persisted three privacy-safe reproductions in [evidence](evidence/), using a one-off read-only capture of the full app with intercepted fictional responses. No app/test/fixture implementation was added.
- Appointment detail/edit/reschedule, patient editor, filters, clinic/staff/settings/users editors, row/profile menus beyond the profile menu above, drawer variants, SearchableSelect clear action, date picker, and toast timing were not audited. The fictional fixture did not provide the records/contracts needed for several of these; they are not source-only “clear” findings.
- No actual records, messages, emails, bookings, or notifications were accessed or created. All write methods were blocked; Add Schedule and booking submission were never activated.

## Browser screenshot observation references (not persisted image files)

- `gmahfp`: desktop Add Schedule open.
- `30vu66`: desktop Monday draft selected.
- `xbzbf5`: desktop discard alert.
- `x1m2dg`: desktop Keep editing preserved draft.
- `9ders6`: desktop discard returned to empty list.
- `2cszq2`, `ifeu6b`: mobile Add Schedule and Monday draft.
- `nbum7y`: mobile discard alert; `eqwqx0`: mobile after discard.
- `tfsca1`, `f5b47x`: mobile nav open/closed.
- `i7l2n9`, `26hflc`: notifications open/closed.
- `2cuzfo`, `citu2x`: profile menu open/Escape-dismissed.

## Expanded browser pass — role, route, surface, viewport ledger

All identities and records below were fictional browser fixtures. The existing full-app fixtures rejected every non-GET/HEAD request; the audit read logs for superAdmin, clinicAdmin, doctor, receptionist, patient, and public contexts, and each non-read request list was empty. No application, source, test, or fixture implementation was changed. This pass did not send email/SMS/OTP, create a clinic/staff/patient/appointment, save a form, or change an account.

| Role | Route / surface | Viewport | Result and evidence |
|---|---|---:|---|
| superAdmin | `/admin/patients` — Add Patient dirty draft | 1440×900 | Filled only fictional Full Name, clicked header X, and saw one `Discard unsaved changes?` alertdialog with Keep editing / Discard changes; discarded the local draft. No save or patient write. `ed8d3h`, `8it4hr`, `adenf4`. |
| superAdmin | `/admin/patients` — PhoneInput during discard | 1440×900 | The phone-country clear X remained bright under the scrim. It was at x=423, y≈483 (24×24); wrapper z-index 20 vs scrim z-index 10; alert at x=530, y≈368, 380×163. Vertical overlap was 24px but there was no horizontal overlap; body was inert and `elementFromPoint` returned the scrim, not the clear button. This is a distinct, non-hit-testable paint-layer observation, not another obscured alert button. `fgvxze`. |
| superAdmin | `/admin/patients` — Filter patients drawer | 1440×900 | Right-docked drawer showed Status, Sort, date range, Clinic and Registration clinic selectors, Reset/Apply; closed with X without changes. `o348w3`, `kleihc`. |
| superAdmin | `/admin/patients` — Filter patients drawer | 390×844 | Nearly full-screen drawer, vertical form and Reset/Apply footer fit within a scrollable panel; closed with X without changes. `q3wq8f`, `qcrtru`. |
| superAdmin | `/admin/appointments?size=20` — appointment detail | 1440×900 | Fictional booked appointment `a1` expanded on Booking; Details/History tabs and ticket/QR shown. Edit Booking Details opened with visit phone and notes, disabled Save, then closed via Cancel. `ktd3qb`, `61ffyo`, `3m5eip`. |
| superAdmin | `/admin/appointments?size=20` — Reschedule and Cancel | 1440×900 | Row menu exposed both. Reschedule opened a centered dialog with visit identity and Close/Back/Confirm but no date/session controls under this limited fixture; closed via X, so options/submit were not tested. Cancel opened with an empty required-reason field and disabled Confirm; closed via Back. Booking remained Booked. `nj53cv`, `uvtnhg`, `d6dbpg`, `snp4m0`. |
| superAdmin | `/admin/users?area=roles` — custom role editor | 1440×900 | In-browser GET-only custom role `doctor` had the long name “Limited desk with a long descriptive role name.” Editor drawer measured 960×900; header X measured 48×44 at x≈1387, and separate inner Close measured ≈69×39 at x≈497. The permission table was horizontally scrollable. Closed with inner Close; no role changes. `2oauwg`, `yru2ps`. |
| superAdmin | `/admin/users?area=system` — effective permissions, status, removal review | 1440×900 | Read-only Effective Permissions drawer showed 0 denied of 12 and closed with X. Deactivate confirmation was opened then Cancelled. Removal review initially hit an error boundary because the generic test fallback did not match `StaffDeletionImpact`; after adding a compatible in-browser GET-only blocked impact fixture, it rendered the fictional blocker and disabled Permanently remove, then closed via Cancel. No removal/status change. The fixture count summary (All 1, Active 1, Inactive 1) disagreed with its single Active row; treat as fixture-shape noise, not a product result. `5tbex6`, `uvkvp0`, `bg86d9`, `yez4kf`. |
| clinicAdmin | `/admin/clinics/c1/details` — Clinic Details editor | 1440×900 | Fictional clinic overview rendered; editor showed a long, scrollable form and fixed Cancel/Save footer. Closed via Cancel, unchanged. `3mg3nk`, `u71zcn`, `2pc6tk`. |
| clinicAdmin | `/admin/clinics/c1/policies` — Booking Policies | 1440×900 | Opened the 30-day horizon / 0-minute cutoff form and cancelled unchanged. `s3b7zr`, `cs0xoq`, `1kkh14`. |
| clinicAdmin | `/admin/clinics/c1/staff?tab=receptionists` — staff, Add Staff, Recovery | 1440×900 | Doctor and Receptionist lists were empty in fixture. Add Staff opened Account Details/Work Assignment with verification labels and empty required location, then Cancelled. Account Recovery Assistance stated it finds steps without sending email; no account selected and Get recovery steps disabled; closed with X. No staff or recovery message. `obvhgy`, `9s4mnc`, `buio4v`, `8bfm1s`, `huud80`, `ut2je9`. |
| doctor | `/doctor/dashboard`, `/doctor/appointments`, `/doctor/availability` | 1440×900 | Shell/profile rendered, but appointment and schedule content showed “No active location assigned”; no detail/editor available. `zrob3j`, `5kt27u`, `mi7vt7`. |
| doctor | `/doctor/clinics`, `?area=staff`, `?area=qrs`, `/doctor/profile` | 1440×900 | No active clinics assigned; one fictional network clinic. Receptionist and QR lists empty. Profile remained accessible; Date of Birth picker opened and closed without selecting or saving. `p62z0p`, `6yuz46`, `mf0zbf`, `bd9kj6`, `h971yw`. |
| receptionist | `/receptionist/dashboard`, `/patients`, `/appointments`, `/queue`, `/availability` | 1440×900 | Shell accessible, but patient/appointment/queue/schedule content was location-gated by “No active location assigned.” `vy3jap`, `c29xjs`, `vqxusz`, `lnvqf5`, `f7ejcs`. |
| receptionist | `/receptionist/profile` | 1440×900 | Profile accessible with contact verification, Full Name, Mobile, Photo URL, and rows-per-page preference; no fields changed/saved. `9shsjz`. |
| patient | `/patient/dashboard` and mobile workspace navigation | 390×844 | Dashboard had Unavailable metrics and empty appointments/activity. Navigation drawer opened with Close navigation and closed without route change. `fxi4k4`, `2bajor`, `7haxgw`. |
| patient | `/patient/appointments?size=20` — empty list/filter drawer | 390×844 | No upcoming appointments. Filters drawer showed Status, Visit Range, Sort, date inputs, Clinic and prerequisite-disabled Location/Doctor; closed via X without applying. `zs0v45`, `c6y3j2`, `6jagjf`. |
| patient | `/patient/profile` | 390×844 | Personal & Contact and Additional Details tabs both operable; the mobile tab row scrolls horizontally. Additional Details showed blank address/emergency-contact fields; no profile save. `rjwjg5`, `mf4ilw`. |
| public | `/` mobile Navigation | 390×844 | Public homepage and full-height Navigation drawer rendered; links included Register a Clinic and Guest Booking; drawer X closed to `/` without navigation. `bo5kvh`, `hun3sk`, `sokc2n`. |
| public | `/register-clinic` account-details stage | 390×844 | Inputs (Name, Email, Password, optional mobile/country) rendered. Entered only fictional name/email. Back to home navigated directly with no leave prompt; returning to registration restored the non-secret draft. Explicit Discard account draft cleared it immediately, also without a confirmation. API log showed only GET website-config/auth-status and localStorage had no registration draft afterward. No password, OTP, or send was used. This is specifically the anonymous account-details stage; the post-verification setup wizard was not reached because that would require sending an OTP. `kv0hv5`, `l5olbk`, `zi02ok`, `vcaewy`, `tf3e4o`, `r7fc8o`. |

## Expanded pass — confirmed finding and limitations

- **Confirmed visual/interaction overlap remains limited to the earlier diagnostic Add Schedule state**: superAdmin `/admin/availability`, 390×500, with the form body at maximum scroll. The SearchableSelect clear X occupied `[273, 289.16, 44, 44]` over the red Discard changes button in the alertdialog. Its ancestor z-index was 20 above the scrim’s 10, body was inert, and `elementFromPoint` resolved to `button-discard-changes`, not the clear control. No control was activated; the local draft was later discarded with no non-read request. Screenshot `qz3il2`. Do not generalize this overlap to other callers; the Patient Add PhoneInput observation above did not overlap the alert horizontally.
- **Registration leave behavior is stage-specific**: on the anonymous account-details route, no leave prompt was observed for Back to home and the explicit draft-discard action cleared immediately. Non-secret draft persistence was confirmed on return and cleared afterward. The authenticated clinic-setup wizard's separate leave behavior remains untested because reaching it would require a real verification step; no OTP was sent.
- **Fixture gaps were resolved or recorded without treating them as product bugs**: system-user counts were not status-filter faithful; deletion-review initially received the generic empty-list shape and only rendered after a correct fictional impact response was supplied; appointment Reschedule lacked session controls in the limited list fixture; Clinic Admin staff, Doctor location-dependent surfaces, and Patient appointments had no matching records/active location. These are verification limits, not demonstrated failures.
