# Workspace compact-layout / overlay completion matrix

Legend: **Implemented** = code changed · **Inspected** = code read without a required change. Implementation status is not a claim of full browser acceptance.

Final validation: TypeScript passes and all 227 unit/style tests pass. The intercepted-fixture browser pass recorded 63 administration route/viewport measurements at 1440, 1024 and 390 pixels, plus populated appointment/search and representative drawer checks. It was interrupted by browser-worker failures before full role-isolated and form-state acceptance. The `/admin/profile` grid entry redirects to the dashboard and does not verify the actual Profile view.

See `screenshots/compact-workspace-acceptance/acceptance-summary.md` for the verified subset and remaining gaps. The earlier `report.json` is stale, not final evidence. No real authentication, authorization, delivery or persistence claims follow from these intercepted fixtures. The real signed-out mobile patient-login screen was also visually checked.

Still unverified: isolated role flows, populated three-step booking, guided setup clean/dirty/busy states, all nested-menu dismissal and filter reset/apply paths, delayed/error/retry/scope-change search, remaining permissions/recovery/assignment/config drawers, full custom-role Keep/Discard/busy states, Settings editors and template draft persistence.

Checks run (third pass): `tsc --noEmit` passes. `node --test` over all `*.test.mjs` gives 227 passed, 0 failed. Assertions updated to the new contract: system-users drawer, Users recovery dialog, scheduling copy-hours drawer (linked-schedules-ui), and removal of the Settings-area select (searchable-select-callers).

## Shared primitives
| Item | Status | Notes |
|---|---|---|
| `useAppDialogClose()` | Implemented | Exported from AppDialog. Gives dialog content the guarded close (dirty/busy aware); returns null outside a dialog. |
| ListingControls `SearchInput` | Implemented | The local definition was removed. It now re-exports `SearchInput`/`SearchInputProps` from `LiveSearchInput.tsx` (owned by main). |
| `listingSuggestions()` helper | Implemented | Turns rows from the current scoped query into `{id,label,description,value}`, capped at 8. Rows with no searchable value are skipped. |
| FilterBar advanced panel | Implemented | Portalled AppDialog right-side drawer, full-width on phones, with focus trapping, safe nested selectors, Reset/Apply/Done and focus restoration. Does not expand the listing or get clipped by parent overflow. |
| AppDialog `variant="drawer"` | Implemented | Docks to the right edge and goes full-screen below 640px. It keeps the same dirty/busy/discard lifecycle, focus trap and Escape handling. |

## Live-search wiring (every `<SearchInput>` usage)
| Site | Status | Value / scopeKey |
|---|---|---|
| Appointments (clinic.tsx) | Implemented | value = reference. scopeKey = params without search/page. settled = debounced. |
| Reports | Implemented | value = row label. scopeKey = report params. |
| DoctorClinics, assigned clinics | Implemented | value = clinic name |
| DoctorClinics, network clinics | Implemented | value = clinic name. total = network pagination total. |
| Users (staff tabs) | Implemented | value = fullName. scopeKey includes the tab. Suggestions are suppressed while placeholder data from the previous scope is showing. |
| ResourcePage (patients/clinics/locations/masters/QR/audit/schedules) | Implemented | value = fullName, then name, then reference, then summary. scopeKey = resource + list params. |
| SystemUsers | Implemented | value = fullName |
| SessionQueue | Implemented | Uses the actual session `entries`. value = reference. scopeKey includes doctor/branch/date/session/startTime. |
| GuestRequests | Implemented | value = fullName |
| PublicClinicPage directory | Implemented | value = clinic or doctor name. settled = committed URL search. |

## Pages
| Page | Status | Detail |
|---|---|---|
| Appointments | Implemented | Header actions now hold the inline "Updated" timestamp, the export (inline group, status messages are inline spans) and sort, all on the right. The separate metadata line and export toolbar above the table were removed. |
| Queue | Implemented | Sort is inline in the FilterBar. `SessionSelector`/`OperationalSessionSelector` render as a compact inline bar: the selector is capped at 340px and notices sit beside it. `.sq-context` padding was reduced. |
| Weekly schedules / exceptions | Implemented | Removed the back-link, the "Schedule" h2 and the full-width section select. There is now one bar: labelled section navigation ("Schedule": Weekly sessions / Date exceptions, `aria-current`, underline style, not tabs), and actions on the right (Copy opening hours, Edit linked owner hours). Copy opening hours opens an AppDialog drawer instead of an inline `<details>`. The schedule-vs-opening-hours and QR readiness notices became one-line `.listing-hint`. |
| SystemUsers | Implemented | The effective-permissions drawer from the first pass. |
| Users | Implemented | Recovery drawer and guided Clinic Admin setup dialog. The setup wizard reports actual dirty and pending state; clean and completed forms close without false discard prompts. |
| Clinics / locations / patients / masters / audit / QR | Implemented | When a status tab is selected, the Status column is hidden (users keep their access switch) and the status chip is suppressed. Long text wraps inside cells; status, created and actions cells stay on one line on desktop. Empty states inside table panels are compact, with no hero icon. |
| Reports | Implemented | From/To dates sit beside search in the primary row. Sort, a methodology HelpTip (replacing the `<details>` block) and Export sit together on the right. |
| Settings | Implemented | One scope row: for Super Admin, labelled section navigation "Settings": Clinic workspace / Platform settings (replacing the full-width select; `aria-current`, not tabs), then the Clinic Group lookup and the location count. The General section is a single summary panel with facts (web address, contacts, date/time display, linked owner hours) and its actions on the right. The duplicate date/time panel and stray paragraph were removed. The Locations intro panel became a one-line hint. Section editors still open as modal dialogs (unchanged). |
| Templates | Implemented | Removed the duplicate "Email templates" h2 and the delivery banner. They are now one muted intro line with a HelpTip (`text-delivery-limit` kept). Publish, drafts, reset and the conflict flow are unchanged. |
| AccessRules / CustomRoles | Implemented | Duplicate "Role"/"Module" text labels removed (SearchableSelect labels remain). The disclosure became a HelpTip. Custom-role editing (with assignments) opens in an AppDialog drawer over the role list. RoleEditor reports unapplied local edits as dirty; the drawer close, Escape, outside click and the editor's own Close button all go through the AppDialog discard confirmation. The save bar stays on the page. |
| Integrations | Implemented | Header has the title on the left and Service/Provider fields grouped on the right, with labels above the controls. Status row: readiness badge and source on the left; Refresh, Configure and Send test email on the right. Configure opens a dirty/busy-aware drawer (IntegrationEditor reports dirty and busy); its Cancel button calls the dialog's guarded close via the new `useAppDialogClose()` context hook, so unsaved values prompt before discard. The SMTP test is a dialog that keeps the explicit "Yes, send a real email" confirmation. |
| Dashboard | Implemented | Empty appointment and activity lists are one-line inline messages. The operational activity paragraph moved into a HelpTip. |
| Profile | Implemented | The generic "Your profile" h2 (duplicate of the page h1) was replaced by the account name and a role badge. |
| Demo clinic | Implemented | Configured state: the access badge and toggle/rotate actions are in the header. Links are a facts list. The sharing message and QR sit side by side; the QR is still 220px. |
| Booking steps / selectors | Implemented | Step 1 heading and the binary Booking source share one row; source is a labelled radio toggle (Phone / advance, Walk-in today) instead of a dropdown. Panel padding, step header spacing, h2 size and form-grid gap tightened. Step 2/3 content and all booking logic unchanged. Guest booking not changed. |
| Public/auth pages | Inspected + one fix | Sign-in, patient login, demo login, password flows, access check and clinic registration all use AuthShell consistently. Confirmed defect: /register-doctor used a hand-built layout with inline styles and a second "Return to home" link. Now uses AuthShell + AuthCard; copy and the Staff login destination preserved. No auth logic touched. |

All of the above is **Unverified** in a browser.
