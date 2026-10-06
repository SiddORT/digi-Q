# Sections C–H progress

## Final consolidated status

Sections C–G have implementation and automated regression evidence below. Section H is **partial, not accepted**. Historical implementation-pass notes below are superseded by their subsequent review corrections.

- Latest checks: 402 frontend tests; 71 targeted backend tests (phase-one, geography, appointment presentation); both typechecks, codegen and both builds pass.
- Separate backend-flow test bundle remains blocked by outdated test doubles; it is not included in the passing total.
- Current public registration entry page renders at 390px without application errors. This does not verify later signed-in onboarding steps.
- Browser fixture coverage passed for guest visit→patient→confirmation→ticket, Back retaining input, pasted international phone, synthetic failed-save/retry, receipt refresh and PDF download; standalone QR resolve/return checked without check-in.
- Browser fixture coverage does not prove persisted booking or delivery. No live records were mutated or messages sent.
- The observed sole-clinic finder issue was addressed with bookable-option selection and automated regression coverage.
- Initial address browser evidence was superseded by the final unified component. Current staff staging, schedule/onboarding changes and cross-role table behavior remain without browser acceptance.
- Signed-in browser fixtures encountered 401/sign-in redirection, so the tester did not establish valid staff/patient identities. This is a test-access blocker, not evidence that app role authorization passed or failed.
- No claim of exhaustive desktop/tablet/mobile/keyboard/touch acceptance or the full authenticated schedule→booking journey.
- Reference-data caveats: offline postal snapshot is dated and suggestions require explicit choice. Existing country-state-city GPL dependency needs redistribution/licensing review; hosting versus distribution obligations are not certified here.

Status key: **Implemented** = code plus an automated check. **Browser: not verified** applies to every row. This agent did no browser or screenshot testing; the main agent owns the combined H pass. No live records, messages or deployments were touched.

## C — Address and phone
| Requirement | Status | Evidence |
|---|---|---|
| New phone numbers default to +91 (IN); pasted international numbers are recognised | Implemented | `PhoneInput.tsx` uses `DEFAULT_PHONE_COUNTRY`; `joinPhone`/`splitPhone` paste handling (`lib/phone.test.mjs`). |
| New address country defaults to IN; saved international values are kept | Implemented | `lib/address.ts` `geoScope`; `lib/address.test.mjs`. |
| Selected country code is compact; full country names stay searchable | Implemented | `SearchableSelect` `selectedLabel` shows "+91 IN". |
| One shared address layout (wide address line; content-sized country/state/city/PIN) | Implemented; persistence verified | `addressFields()` in `resources.tsx` is used by clinics/locations, patients, doctors and staff users, and `components/AddressFields.tsx` by public registration (branch payload includes state, pincode and country). **Persistence test** `phase-one.test.mjs` "section C: optional address fields persist and reload": create and edit a patient, patch a doctor, patch a staff user through `resourcesRouter`, then reload the stored row; address, country, state, city and pincode round-trip. Resource GET returns the stored row through `projectAssignmentScope` (code trace; no HTTP GET assertion). |
| Public screens use a safe read-only directory | Implemented | `GET /public/geography` and `GET /public/pincode/{pin}`: no authentication, read-only, at most 20 names or 50 localities, cache headers, and an in-memory per-IP limiter (`lib/public-limit.ts`, 120 requests/minute, returns 429). The signed-in `/geography` route is unchanged. Test: `geography.test.mjs`. |
| Searchable State/UT; cities filtered by state; incompatible child values cleared | Implemented | Earlier pass (`lib/geography.ts`, `MasterTextInput`). `AddressFields` clears the city when the state changes. |
| PIN assistance with several selectable localities; district/post office never substituted for city; dated state never auto-filled | Implemented | `PinLocalities.tsx`: picking a locality only fills Area or adds it to the address line. The **State/UT is never auto-filled**, even when empty. When every locality for a PIN agrees on one state, the UI says "India Post directory (dated snapshot) lists this PIN in X. Check before using." and offers a **Use X** button; the user must press it. When localities disagree (for example PIN 396230, split between Gujarat and the merged UT), no suggestion is shown. The city is never written; the district is shown as context only. Tests: `sections-c-g.test.mjs`, `geography.test.mjs`. |
| Manual entry when data is missing or the service fails | Implemented | A failed lookup, a missing dataset (`available:false`), an unknown PIN or a 429 each show a short notice. All inputs stay free text. |
| Provider assessment, licensing, provenance and caching | Implemented | **Source:** India Post "All India Pincode Directory", <https://www.data.gov.in/catalog/all-india-pincode-directory>. **Licence:** Government Open Data License – India, <https://www.data.gov.in/Godl>: use, adaptation and redistribution with attribution, which is returned with every response and shown in the UI. Input CSV sha256 `fda0bf07…d467` (columns officename … statename). Output `api-server/data/india-pincodes.json.gz` (19,097 PINs, sha256 `24418a64…6f44`) is built by `scripts/build-pincodes.py` and cached in memory, so lookups never depend on an outside service. **Snapshot correction:** the directory predates the 2014–2020 reorganisations. The importer changes only mappings that are exact in law or India Post practice: every 50xxxx PIN becomes Telangana (Telangana postal circle; AP Reorganisation Act 2014); Leh and Kargil districts become Ladakh (J&K Reorganisation Act 2019); Dadra & Nagar Haveli and Daman & Diu become the merged UT (2020); official spellings Chhattisgarh, Puducherry, Jammu and Kashmir, Andaman and Nicobar Islands. District names stay historic, which is why they are context only. Test: `geography.test.mjs` (Telangana, Ladakh, AP unchanged, merged UT). Rejected: `api.postalpincode.in`, which publishes no licence, SLA or rate limit. **Not done:** I have not checked against a current India Post release for PIN reassignments after the snapshot date; the state suggestion always needs confirmation. |
| Existing `country-state-city` data (GPL-3.0) | Documented risk, not resolved | Using it only on the server does **not** make GPL obligations go away for every distribution model. GPL-3.0 conditions apply when the software is conveyed: shipping the server to customers, self-hosted or on-premise installs, or redistributing builds. Those would require GPL-compatible licensing of the combined work and offering its source. Hosting a SaaS without conveying the software does not trigger copyleft under GPL (unlike AGPL), but the owner must check this against how they actually distribute. Recommended fix: replace it with an openly licensed source, for example the GeoNames CC-BY-4.0 data or the official LGD state and district lists (GODL), using the same offline importer pattern as the PIN data. |

## D — Tables
| Requirement | Status | Evidence |
|---|---|---|
| Compact, distinct Check In/Out icons with accessible names, tooltips and touch sizing | Implemented | `AppointmentRows.tsx` uses `IconAction`. |
| Predictable order (primary → Details → More overflow) | Implemented | `sections-c-g.test.mjs`. Doctor rows now offer the overflow items Weekly Schedule and Date Exceptions. |
| No column collisions; dates, doctor and location shown as visible lines | Implemented (static) | `components/table-collisions.test.mjs`: every key column has a defined width, tables scroll horizontally, the actions column has `nowrap` and is sticky, and date/doctor/location are rendered as text. The real visual layout needs the H browser check. |
| Shared cancel/reschedule wording across history and queue | Existing shared `AppointmentRows` | No new change. |

## E — Booking and patient registration
| Requirement | Status | Evidence |
|---|---|---|
| Shared staged Visit details → Patient details → Confirmation → Ticket flow for every role, including guests | Implemented | New `components/booking/StagedBooking.tsx` provides `StagedBooking` (step bar plus three stage panels that stay mounted, so Back keeps every input), `BookingStageActions` (shared Back / Change Visit / primary footer) and `BookingSummary`. **Guest:** the old single form with an immediate "Book Now" is replaced. Visit (location, doctor, date, session, availability) → Patient (name, optional contacts, permission, validated by `form.trigger`) → Confirmation (summary, then **Confirm Booking**, the only submit) → Ticket (existing receipt). `submit()` returns unless `step===3`, so pressing Enter early cannot book. **Staff and patient** (`clinic.tsx`) already had three conditional stages with parent-held state; all three footers now use `BookingStageActions`, and the ticket screen shows step 4. Tests: `sections-c-g.test.mjs`, updated `section-a-consistency.test.mjs`. |
| Shared patient form from Patients and from booking; the new patient comes back selected | Implemented | `PatientEditor` in `resources.tsx` uses the same fields and validation as the Patients page (`resourceName="patients"`). Booking's "Register and Select Patient" calls `setPatient(p.id)` on success. The `canRegisterPatient` permission gate is unchanged, so no new permissions are granted. |
| Contact vs notification vs sign-in kept separate | Implemented | One `PATIENT_CONTACT_RULE` text is shown in every patient editor. The backend contact and notification rules are unchanged. |
| No internal ID labels while loading | Implemented | `SearchableSelect` shows "Loading…" or "Selected item unavailable". |

## F — Schedule
| Requirement | Status | Evidence |
|---|---|---|
| Doctor hours outside location hours accepted with a warning, both when saving and in booking (location 9–5; doctor 8–12 and 3–6) | Implemented | `phase-one.test.mjs`. |
| **Absent hours are never treated as a closure** | Implemented (rule corrected) | `branchDayStatus` returns: `unconfigured` when `openingHours` is null or absent (legacy access); `closed` **only** for `[]`, the documented explicit all-closed flag (`docs/clinic-expansion-operations.md`); `outside` for a weekday the plan simply omits, which is accepted with a warning because the product has no per-day closed flag. The previous pass blocked omitted weekdays; that is reverted. The weekly editor matches: a day is blocked only under an all-closed plan, and an omitted weekday shows "Off · clinic usually closed" and can be enabled with a warning (`outsideHours(..., configured)`). Tests: `phase-one.test.mjs` and `week-plan.test.mjs`. |
| Explicit closures, timezones, conflicts and bookings protected | Implemented | `[]` returns 409. Day-off exceptions still close. Timezone and overlap checks are unchanged. Extra intervals are checked against weekly sessions, overrides and other extras. Bookings are never deleted. |
| One editor reused from schedule navigation and doctor profiles | Implemented | `WeeklyScheduleEditor` saves sessions directly; there is no separate create-sessions step. Doctor row overflow links to Weekly Schedule and Date Exceptions with the doctor and clinic preselected. |
| Follow location hours vs copy once | Implemented (labelling) | "Follow Location Hours (Linked)" means future location changes flow through and custom hours are kept. "Copy Location Hours Once" creates custom sessions that do not follow later changes. Both have explanatory titles. Test: `linked-schedules-ui.test.mjs`. |
| Date Exceptions beside Weekly Schedule: day off, changed hours, extra interval, with a booking-impact preview | Implemented | `isExtra` exception sessions are built inside `availability()` and `availabilitySessions()` (`lib/availability.ts`). Code trace confirms every booking and session caller goes through those two functions: staff booking (`presence.ts`), guest requests (`guest-requests.ts`), public availability and QR context (`public.ts`), queue (`queue.ts`), and duration/reschedule (`duration.ts`, which uses `availability()` when no explicit start time is given and otherwise reads appointment and session snapshots). Test: `phase-one.test.mjs` books into an extra interval by session ID and checks the weekly session is unchanged. `ExceptionImpactPreview` is read-only. |
| Concise readiness | Implemented | `scheduleReadiness`: no open sessions, zero capacity, or an all-closed plan. Absent location hours appear as a note ("not configured"), never as closed. Location hours alone never imply availability. |

## G — QR
| Requirement | Status | Evidence |
|---|---|---|
| In-app validation dialog; explicit new-tab public booking; safe return | Implemented | Earlier pass (`CheckIn.tsx`, `LocationActions`). |

## H — Automated focused checks
- Frontend: `sections-c-g.test.mjs` (10), `table-collisions.test.mjs` (4), `week-plan.test.mjs` (+3), `lib/address.test.mjs`, plus the updated `linked-schedules-ui.test.mjs`.
- Backend: `geography.test.mjs` (+2: PIN directory, limiter), `phase-one.test.mjs` (Section F rule correction plus the extra interval).
- `appointment-presentation.test.mjs` was traced and fixed. Its outdated esbuild fixture stubbed `../resources` without `ErrorNotice`, which `AppointmentTicket` now imports, and it marked `@workspace/api-client-react` as external, which Node cannot load because of extensionless TypeScript imports. The fixture now stubs `ErrorNotice` and bundles the API client from source. All 4 tests pass and no assertions changed.

## Commands and results
- `cd lib/api-spec && pnpm run codegen` → pass
- `cd artifacts/clinicflow && npx tsc --noEmit -p .` → pass
- `node --test $(find src -name "*.test.mjs")` (clinicflow) → 401/401 pass
- `cd artifacts/api-server && npx tsc --noEmit -p .` → pass
- `node --test src/geography.test.mjs src/appointment-presentation.test.mjs` → 10/10 pass
- `node --test src/phase-one.test.mjs src/appointment-presentation.test.mjs` → 62/62 pass
- `node --test src/geography.test.mjs` → 7/7 pass
- `cd artifacts/api-server && node build.mjs` → pass; `dist/data/india-pincodes.json.gz` copied. The build **fails** if the asset is missing or under 100 KB. At runtime the server logs "PIN directory loaded" or warns at startup, and `lookupPincode` logs an error if the file is missing or unreadable, so the failure is never silent.
- `cd artifacts/clinicflow && PORT=5999 BASE_PATH=/ pnpm run build` → pass
- Browser/visual verification: **none performed**.

## Notes for the main agent
- The registration street address keeps the test id `registration-branch-{i}-address`. The new ids are `-address-country`, `-address-state`, `-address-city` and `-address-pincode`. The separate `registration-branch-{i}-city` input is replaced by `-address-city`.
- The PIN asset is copied to `dist/data/` by the build; the lookup searches `dist/data`, then the working directory, then the repo `data/`.
- Guest booking test IDs: new `button-guest-continue-visit` and `button-guest-continue-patient`; `button-submit-guest` is now the Confirmation-stage "Confirm Booking". Staff: `button-booking-continue-visit`, `button-booking-continue-patient`, `button-booking-back`, `button-booking-change-visit`; `button-confirm-booking` is unchanged.

## Honest list of what is still not done
1. **No browser or responsive verification** for any row (H is owned by the main agent).
2. Staff/patient booking stages in `clinic.tsx` are still rendered conditionally, not through the `StagedBooking` container. Their inputs survive Back because the state lives in the parent component, and the footers and step bar are shared. Moving the remaining stage bodies into `StagedBooking` is a mechanical refactor of a very long JSX line, and I did not do it.
3. Address reload is proven at the DB/router-save level. There is no HTTP GET assertion, and doctor list enrichment from the linked user record was not separately checked.
4. The PIN directory has not been checked against post-snapshot PIN reassignments. Only the exact state splits and renames listed above are normalised, and district names stay historic.
5. The `country-state-city` GPL-3.0 dependency is still present (a documented risk; replacing it is the owner's decision).
6. The D column-collision checks are static CSS and markup assertions only.

## Review pass: one address component, doctor address on GET, staff staged booking
- C: `components/AddressFields.tsx` is the only address UI. It's built on SearchableSelect for country (dropdown searches full names, the closed control shows the ISO code such as "IN", saved values that aren't ISO codes are kept as "(saved value)") and on SuggestionInput for State/UT and City/Town. It has a PIN input with PinLocalities, and HelpTips replace the long help lines. There's no datalist. The resources Editor binds it through `EditorAddress` (field types `address`/`addressPart`), so locations, clinics, patients, doctors, users and patient booking all share it, and the registration wizard uses `directory="public"`. The geo and PIN code was removed from MasterTextInput (Area only). A child field is cleared only after a user changes its parent, the change settles for 700ms and a directory check confirms the mismatch. Outside value changes never clear anything. Onboarding now sends state, pincode and country. The wizard validates the PIN.
- Doctor address: the doctor create/edit path mirrors address parts into the linked user's data. User edits mirror into the linked doctor. `enrich("doctors")` falls back to the account address for older rows. Test: GET /patients/:id, /doctors/:id and /users/:id return the saved address. A user edit appears on doctor GET, and a doctor edit appears on user GET.
- E: staff/patient booking in `clinic.tsx` now uses `<StagedBooking testId="staff-staged-booking">`. Stages stay mounted, and Confirmation renders only at step 3.
- Checks: clinicflow 401/401, api 69/69, both tsc clean, both builds and codegen pass. No browser testing was done.

## Review pass: Section F weekly editor, guest finder sole option
- F: the separate "copy location hours" tool (the ClinicSessionSetup drawer in SchedulingWorkspace) has been deleted. "Copy Location Hours Once" now sits inside WeeklyScheduleEditor and uses `prefillFromHours`. It only changes the draft: linked sessions are kept, existing session ids are reused, a weekday with no location hours is left alone, and only `openingHours: []` turns days off. The user saves through the editor's normal plan. "Follow Location Hours (Linked)" is also inside the editor for clinicAdmin/superAdmin, each with a HelpTip. The unit test is in week-plan.test.mjs.
- Guest finder: the real cause was the public data. `/public/clinics` listed clinics with no active location (3 of 7 in the dev data), and some locations had no slug. The sole-option check counted those rows. Fixes:
  - The server now lists only clinics that have an active location (API test added).
  - The client picks the sole option only from rows that have a public slug, and only when the whole list is loaded (`lib/sole-option.ts` plus a test).
- Gaps still open:
  - Onboarding and public registration don't use the weekly editor. Before sign-in they only send `ownerSchedule` (linked to location hours, with capacity and duration). Custom pre-auth intervals would need an API contract change, and the editor saves per record and needs a doctorId.
  - The old drawer could copy hours into several locations at once. The editor works on one doctor and one location at a time.
  - `SchedulingWorkspace.onLinkOwner` is now unused.
  - Section H browser checks were blocked by an authenticated 401. Nothing has been browser-verified.

## Section F completion: one weekly editor everywhere
- **Shared editor:** `schedule/WeeklyDraftDays.tsx` is the only Mon–Sun day/interval editor. It edits a draft only (it never saves). It covers:
  - several intervals per day, with a slider plus exact-time inputs;
  - clinic-hour bands and the outside-hours warning;
  - copying a day to selected days or to all days.
- **Saved schedules:** `WeeklyScheduleEditor` uses it. "Copy Location Hours Once", the Follow (linked) link and a restored **"Copy to Other Locations"** control sit inside the editor. Copy to Other Locations uses the new `applyWeekTo`, then `planWeek`/`executePlan` for each selected location, with a confirmation. It requires the current week to be saved first, keeps linked sessions at the target, and reuses existing record ids.
- **Onboarding and public registration:** `ClinicRegistrationWizard` step 3 still defaults to linked hours. With "custom" chosen, it shows `OwnerWeeklySessions`: the same `WeeklyDraftDays`, Copy Location Hours Once and Copy to Other Locations, per new location. The capacity and duration fields are shared. `ownerSchedulePayload` is the single mapping both callers use: linked → `ownerSchedule`, custom → `ownerCustomSchedule` (never both). Nothing is saved until Finish, and the sessions are sent once.
- **API contract:** new `OwnerCustomSchedule` in the spec (on both onboarding bodies), codegen run. `createOwnedClinic` rejects linked plus custom together and rejects custom without the owner profile. After the doctor is created, `createOwnerCustomSessions` validates each session in the same transaction: valid times, branch timezone, an all-closed location refused, no overlap within a location and day, and branch index in range. Then it inserts the schedules. Public registration still requires the verified session plus password re-check, and the advisory lock and existing-clinic check are unchanged.
- **Cleanup:** the unused `SchedulingWorkspace.onLinkOwner` prop and its caller are removed.
- **Tests:**
  - phase-one "section F: onboarding saves custom weekly sessions once…": 3 sessions across 2 locations; overlap, bad index, linked plus custom and no owner profile are each rejected with full rollback (users, clinics and schedules unchanged).
  - week-plan `applyWeekTo`/`toOwnerSessions`.
  - Updated mapping assertions.
- **Checks:** clinicflow tsc + 402/402 + build; api tsc + 71/71 + build; codegen. `backend-flow.test.mjs` fails to bundle (stale drizzle and list-query stubs). This is the same on the unmodified tree, so it was not caused by this change.
