# Role layouts and navigation — implementation comparison

## Scope and evidence rules

This is an implementation checklist, not approval for a second redesign or for
production/UAT changes. All records used for browser acceptance are fictional.
No transport activation, live notifications, credential reads, slug changes or
database migrations are part of this change.

**Reference provenance**

- Clinic: `.local/tasks/standard-clinic-page-readable-urls.md` identifies
  `attached_assets/image_1792584988995.png` and the accompanying approved
  `Pasted--DigiQ-Doctors-Standard-Clinic-Page-Redesign-Functional_1792585194348.txt`.
  The image was inspected at its supplied resolution. It is the **details**
  reference, not permission to replace the directory with a new design.
- Directory/header: retain the existing finalized administrative `ResourcePage`,
  `FilterBar`, `ResourceRecord`, `ListingRegion`, pagination and Notifications
  presentation. The approval does not require recreating finalized pages.
- Tabs: `attached_assets/image_1793026842063.png`, inspected. Clinic tabs now use
  `WorkspaceTabs`, including guarded automatic keyboard activation and panel IDs.
- Schedule: `attached_assets/image_1793452115079.png`, inspected. Consume the
  existing full-week editor; its fields, copying, duration, exception layers,
  partial-save/retry and revision checks are not reimplemented here.

**Evidence legend:** `S` = inspected active source/dispatch, not a rendered
acceptance claim; `U` = executed focused unit/source/render-to-string check;
`F` = actual Chromium rendering against fail-closed fictional API responses;
`A` = actual authenticated local disposable database; `N` = not executed in this
change. A screenshot reference is not proof of an interactive flow. Old workflow
logs are not counted as tests executed for this change.

The **before** column below records observed source differences. No historical
before screenshots were captured; the approved attachments remain visual
references, not fabricated before evidence.

## Page-family / role comparison

SA = Super Admin; CA = Clinic Admin; D = Doctor; R = Receptionist; P = Patient;
G = Guest / signed-out. Role wrappers continue to restrict authority and record
scope. “Shared already” means retained, not rebuilt.

| # | Family and roles | Reference / previous alternate or shared layout | Resulting implementation | Verification |
|---|---|---|---|---|
| 1 | Shell, sidebar, mobile navigation: SA/CA/D/R/P | Existing Workspace shell; SA Clinic linked to directory while CA used separate selector | Same `PortalWorkspace`, `WorkspaceNav`; admin Clinic links both enter `/admin/clinics`; Staff and Users remain distinct | S, U; F results below |
| 2 | Profile menu, favorites, recent pages, quick actions: all signed in | Shared already; manually constructed leaf URLs | Same menu and preference store; canonical destination builder for favorites, quick actions and search page links; no search terms/records persisted | S, U; individual menu/touch states N unless listed below |
| 3 | Global search: SA/CA/D/R/P | Category eligibility incorrectly depended on standalone sidebar items; SA staff links entered Users administration | Actual identity's supported functions include nested destinations. Staff sources: SA admin/doctor/receptionist; CA doctor/receptionist; D receptionist. Existing server endpoints enforce scope, rejection never triggers broader fallback | S, U; F results below |
| 4 | Clinic directory and selection: SA/CA | SA `ResourcePage`; CA `ClinicScopeList` plus automatic single-clinic entry | Removed alternate selector and auto-entry. Same approved list/search/status/sort/columns/return journey; only SA sees ownership column/create action; CA records remain server-scoped | S, U; F results below |
| 5 | Selected Clinic overview/details/return: SA/CA | Shared `ClinicSettings` already, but Back appeared only for SA | Same overview, Basic/Contact cards, linked-hours presentation and five sections; both roles have safe Back to Clinics; original record IDs/slugs retained | S, U; F results below |
| 6 | Locations and location editor: SA/CA; D authorized browsing | Shared `ResourcePage`, `BranchSettings`, address/hours/contact controls | Retained. Exact location search carries authoritative clinic + branch into Locations. Global location continuation stays a scoped list rather than treating location text as clinic search | S, U; full edit/save/reload N unless below |
| 7 | Doctor clinic workspace/network: D | Separate assigned-clinic table plus distinct authorized network catalog | Assigned clinics reuse read-only `ResourcePage`; Staff reuses `Users`; Booking QR reuses `ResourcePage`. Network catalog retained because administrator-network eligibility is NOT clinical assignment | S, U; F results below |
| 8 | Staff list/details/assignments/editing: SA/CA/D | Same `Users` implementation already; navigation/search not equivalent | Same authoritative list and editors across global, clinic and doctor entry points. Tab is URL-backed rather than raw history replacement; exact links/reload/Back select correct staff category | S, U; F results below |
| 9 | Users, roles, permissions and system users: SA | `UsersWorkspace` already shared but misleading staff search entry | Retained Roles/Permissions/System users; explicit explanation and Staff handoff. Legacy Users links carrying a staff tab go to Staff, not Roles | S, U; detailed role-rule mutation N |
| 10 | Patients directory and profile details: SA/CA/D/R | Shared `ResourcePage`, `PatientDetailsDrawer`, `ProfileCompletion` | Retained; D still cannot create/edit patient records; no account ownership inference | S; unchanged workflows N |
| 11 | Patient records/activity/documents: authorized staff/P | Shared drawer, paged record/history/document implementations | Retained; patient self access and staff clinical access remain distinct; no broadened profile visibility | S; upload/delete/history paging N |
| 12 | Profile/contact verification: SA/CA/D/R/P | Common `ProfileEditor`/`Editor`, but inline edits did not register leaving state | Shared inline draft guard adds anchor/programmatic/Back/Forward/query-context/page-exit protection; same Editor validation and per-record API; failed edits remain, saved response advances baseline | S, U; F results below |
| 13 | Staff and signed-in patient booking: SA/CA/D/R/P | Shared staged booking already; patient-registration dialog unconditionally dirty | Preserve booking steps/authorized care context. Dialog dirtiness now comes from the same `PatientEditor` actual draft, not `dirty=true`; pending state retained | S; registration dialog browser status below |
| 14 | Public/guest booking and patient registration: G/P, staff using public patient intent | Shared GuestBooking/public patient entry, contact versus account boundaries | Retained public shell/purpose and shared PatientEditor; no administrative shell imposed on QR patient entry; guest receipt authority unchanged | S; complete guest lifecycle N |
| 15 | Appointments/list/calendar/details/history: SA/CA/D/R/P | Shared Appointments/Calendar/AppointmentRows and expanded Booking/Details/History | Retained; no copied appointment markup; existing query parsing, history and ticket composition unchanged | S; retained regression coverage not re-run wholesale |
| 16 | Operational versus patient queue: SA/CA/D/R vs P | Shared operational SessionQueue vs intentionally different private PatientQueueList | Retained; count/wait/consultation actions not combined with patient or public display | S; queue actions N |
| 17 | Full-week schedule: SA/CA/D/R permitted operations | Completed shared SchedulingWorkspace/full-week/contextual editor | Retained same editor and server authority; no duplicate schedule form created | S; persistence/concurrency suite not re-run here |
| 18 | Date exceptions/contextual editors: staff | Shared exception forms, impact preview and schedule context | Retained separate exception intent, review and concurrency checks; not merged into weekly defaults | S; exception writes N |
| 19 | Booking QR, staff check-in and patient scanning: staff/P/G | Shared QR ResourcePage; public scanners differ by purpose | Doctor QR links now canonicalize into doctor Clinic/Booking QR. Shared QR tools retained; staff validation still different from public booking scanning | S, U; physical camera/phone N |
| 20 | Tickets/live tickets/send/export/guest receipts: staff/P/G capability holders | Shared ticket model, send/export controls and separate capability pages | Retained; tokens/private QR untouched, read-only live tickets not equated with guest booking-management receipts | S; no new ticket implementation |
| 21 | Live Reports/templates/Operational Detail: SA/CA | Shared ReportsWorkspace/filter/results/export, separate metrics by purpose | Retained all report tabs, templates and metric meanings; no report removed or merged | S; report exports N |
| 22 | Communication Usage: SA/CA | Shared report but native categorical selects beside shared controls | Same `SearchableSelect` for channel/outcome/event/source/group/attribution and existing Staff User picker; all options preserved, filter drawer remains transactional | S, U; F results below |
| 23 | Notification inbox and management: signed-in inbox; SA/CA management | Shared NotificationsPanel/templates/event/channel/settings components | Retained finalized Notifications layout and existing scope/activation layers; no delivery testing or provider activation | S; live delivery intentionally excluded |
| 24 | Platform/integrations/providers/reference data/audit/demo: SA; authorized clinic audit CA | Shared consolidated settings tabs, platform inline editor lacked draft guard | Existing tabs retained; same inline guard protects Platform Preferences including query tab/history changes; successful response refreshes baseline; audit exact links go to Settings/Audit | S, U; F results below; provider mutation N |
| 25 | Login/OTP/recovery/setup/onboarding/clinic registration: relevant staff/P/G | Shared auth cards and onboarding/wizard controls with intentional account-purpose differences | Retained native PostgreSQL staff authentication, shared controls and registration recovery; no auth contract or credentials modified | S; full auth journeys N |
| 26 | Public clinic/finder/display; common controls/dialogs/capability states: G/P and authorized staff | PublicHeader/PublicClinicPage/Finder/Display; shared phone/address/date/time/select/dialog/confirm controls | Retained public purpose and private no-index routes. Shared WorkspaceTabs replaces Clinic's equivalent tab markup; no role CSS fork/new design system introduced | S, U; browser states listed below, exhaustive states N |

## Seven destination / search checks

| Check | Roles / canonical and compatible entries | Before | After / evidence |
|---|---|---|---|
| Clinic entry and list return | SA/CA sidebar `/admin/clinics`; `/admin/clinic` compatibility; `/admin/clinics/:id/:section` | CA single-clinic auto-entry and different list | One list; `clinicDetailsHref` saves only list controls, selected sections retain safe local return; arbitrary origins, fragments and path escapes rejected. U |
| Staff exact record and continuation | SA/CA `/admin/staff?tab=doctors|admins|receptionists&search=…&open=…`; D `/doctor/clinics?area=staff&tab=receptionists&…` | `/admin/users` opened role administration | `staffHref`, `recordHref`, `sourceListingHref`; CA has no admin search source, D has no doctor/admin source. U |
| Legacy staff/account split | SA `/admin/users?tab=…` or `area=staff`; CA `/admin/users`; D `/doctor/users`; account `/admin/users?area=roles|permissions|system` | Legacy staff links entered wrong workspace/tab | Staff aliases converge on existing shared Staff; account categories retained; query handoff remains explicit. S/U |
| Clinic search including nested doctor workspace | SA/CA exact → clinic details; D exact → assigned-clinic read-only drawer | CA/D category omitted by sidebar-derived eligibility | Role function catalog, existing `listClinics`/`getClinic`; never replace failed assigned lookup with network catalog. U |
| Location handoff | SA/CA exact `/admin/clinics/:clinicId/locations?branchId=:id`; continuation `/admin/branches?search=…`; scoped old `/admin/branches?clinicId=…` | Category omitted for SA; generic record link lacked editor scope | Exact handoff supplies both IDs; existing selected-clinic check rejects unavailable branch; global scoped list remains usable. S/U |
| Audit handoff | SA `/admin/settings?area=audit&open=…&search=…`; old `/admin/audit` compatible; CA selected-clinic Activity History | SA category omitted without standalone audit sidebar | Existing authorized audit endpoint; exact/scoped scan preserved; no audit category for D/R/P. U |
| Nested pages, QR and ordinary shortcuts | D `/doctor/clinics?area=qrs`; SA Settings areas and Staff; profile/quick actions/favorites | Page search omitted nested functions; links built separately | Canonical `workspaceHref`/`staffHref` shared by sidebar/favorites/quick actions/search. Legacy deep links and purpose-specific token/public paths unchanged. U |

`/admin/doctors` remains compatible with the existing Staff/Doctors route.
`/admin/permissions`, `/admin/system-users`, `/admin/masters`, `/admin/audit`,
`/admin/demo`, `/admin/integrations`, retired communication settings areas and
`/reset-password`, `/login`, `/register`, `/sign-up` retain their existing alias
contracts. `/book/:reference`, `/display/:reference`, `/live-ticket` and public
clinic/location slugs are not rewritten by the new navigation helpers.

## Tab / section / popup checklist

Every row retains the existing authoritative form. `S` is not an assertion that
all role/device/state combinations were browser-tested.

| Surface | Roles / sections or important overlays | Shared implementation / exception | Evidence |
|---|---|---|---|
| Shell | collapsed rail, mobile drawer, profile menu, scope switch, search tabs/More/results, quick QR | WorkspaceNav/Shell/Search; capability hints never authorize reads | S/U; F below |
| Clinic | Details/Locations/Staff/Policies/Activity History; clinic selector; Edit Clinic, date/time, policy, branch editor | ClinicSettings + WorkspaceTabs + Editor/AppDialog; dirty and busy gates retained | S/U; F below |
| Location hours | opening-day disclosures, copy hours, linked schedule review/preview/apply; consultation location selection | Existing BranchSettings/LinkedScheduleControls/ClinicChangeReview; global/clinic/doctor layers not merged | S; transactional writes N |
| Staff | role selector; Add Staff/role switch; assignments; exact details/edit; profile completion; schedule; recovery; deactivate/remove review; invitation confirmation | One Users/StaffAccountFields/doctor editor; SA-only permanent removal; no live invitations tested | S/U; rendered changed journey below |
| Account administration | Roles/Permissions/System users; rule switch; custom role editor; system-user state confirmations | Existing CustomRoles/AccessRules/SystemUsers; NOT a staff directory | S/U |
| Patient | Add/Edit, extra demographics, records drawer, activity/history pages, documents/actions, completion | Existing PatientEditor/PatientDetailsDrawer/ProfileCompletion; no account creation inferred | S; writes N |
| Profile | inline Editor tabs/sections, contact proof dialogs, patient records, owned clinic information | Editor/useInlineDraftGuard; proof remains separate from visit mobile | S/U; F below |
| Booking | Visit/Patient/Review, patient registration, schedule setup/recovery, confirmation and ticket | StagedBooking + same PatientEditor; pristine dialog no false dirty flag | S; changed registration interaction status below |
| Appointments | List/Calendar; calendar day; Booking/Details/History; edit/cancel/reschedule/move review; bulk exports | Existing shared appointment components and dialog stack retained | S; full action matrix N |
| Queue | session selector, pause/call/start/finish/return/absent confirmations; patient private list | Existing queue components; staff operational and patient purposes distinct | S; mutation matrix N |
| Schedule | weekly/contextual/Add Schedule, copy, exceptions, impact/partial-save/retry feedback | Existing completed full-week editor, no copies | S; no new schedule test claims |
| QR | booking link/QR/download/copy/display, staff validation popup, patient/guest scan | Existing ResourcePage/CheckIn/PatientScanner | S; real camera N |
| Tickets | send dialog, preview, download/print, selection completeness, live-ticket and guest-receipt management | Existing ticket components; capabilities intentionally distinct | S; delivery N |
| Reports | live dashboard, saved templates, Operational Detail; scope/range/date filters; columns/export; usage breakdown and detail drawer | Shared listing/filter primitives; unlike metrics stay separate; usage selects standardized | S/U; F below |
| Notifications | inbox; management event sections; default/clinic scopes; Email/SMS/editor/history/details; activation/test receipt confirmations | Existing final components and authorized layers retained; live tests/activation excluded | S |
| Platform | Platform/Integrations/Reference data/Audit/Demo; provider/private-storage editors and receipt dialogs | Platform draft guard added, other sections retained | S/U; F below; provider changes N |
| Auth/onboarding | login methods, password visibility, OTP, forgot/set password, access/intent, registration wizard/hours/recovery | Existing auth and wizard components; security validation unchanged | S; full auth lifecycle N |
| Public | clinic/location choices, finder, booking intent, display, guest receipt; privacy/error states | Public components retain public shell; no privileged UI imposed | S; full public/browser states N |
| Common | SearchableSelect popovers, filter drawer apply/cancel/reset, date/time/address/phone, AppDialog close/Escape/focus/busy, useConfirm, tooltips | Shared implementations only; Clinic tabs now use common focus-after-commit behavior | S/U; sampled F below; exhaustive device matrix N |

## Executed results

- Frontend typecheck: `pnpm --filter @workspace/clinicflow typecheck` **passed**
  after `pnpm exec tsc -b lib/api-client-react` refreshed existing generated
  declaration outputs. No generated API/source contract or toolchain was changed.
- Focused Node checks: `workspace-navigation.test.mjs`,
  `clinic-navigation.test.mjs`, `enterprise-interactions.test.mjs`,
  `communication-usage.test.mjs`, `saved-scope.test.mjs`: **23 passed**.
- Broader `search-links.test.mjs` run: changed navigation tests passed; **two
  unrelated existing source assertions failed**, for the former ticket markup
  shape and plain `new Error` in the scoped scan (current scan attaches HTTP 404).
  Neither ticket behavior nor record scanning was changed to appease stale tests.
- Managed frontend and API workflows restarted and reported ready. Existing
  unrelated test workflow logs are not reclassified as this task's executions.
- Browser acceptance, executed through one tester and narrow failed-flow
  follow-ups:
  - **6/6 F passed:** SA, CA and D each at **390 × 844** and **1366 × 844**.
    Actual App rendering, fail-closed fictional API data: one-clinic directory
    remains discoverable; administrators can select all five sections and return;
    D has the shared assigned-clinic list and nested Staff/QR without clinic
    management; nested staff/clinic search groups appear; SA also has
    location/audit groups; no unexpected API writes or missing read contracts.
  - **1/1 F passed:** Communication Usage shared selector interaction,
    transactional filter apply/reopen and selected accessible value.
  - **2/2 F passed after correction:** Profile and Platform pristine exit,
    repeated Back → Cancel preserving edits, Platform tab Cancel, failed-save
    draft retention, pending double submission (only one additional write) and
    successful-save navigation without a false prompt.
  - **1/1 A passed after fixing a real client baseline defect:** actual native
    session/CSRF/routers against isolated disposable PostgreSQL using a fictional
    SA, `/api/me` role verified before UI. Profile saves persist and reopen
    without a false dirty prompt. Platform saves persist; Cancel retains the
    draft, Discard restores saved values and reopening preserves the saved
    baseline. No workspace database/credential/provider was used.
  - The initial save fixture lacked CSRF and the initial error assertion expected
    raw 503 wording despite intentional friendly-error sanitization. Those were
    fixture/assertion issues, not successful save tests. The native run then
    exposed an actual stale dirty-baseline defect; a successful response now
    advances the shared inline editor revision. A status-only doctor
    reactivation is not allowed to clear unrelated profile edits.
  - Authenticated saved Platform screenshot:
    `generated-artifacts/role-layouts-auth/results/role-layouts-auth-authenti-0e54c-ngs-context-remains-guarded-role-layouts-auth/authenticated-platform.png`.
    Inspected: persisted fictional name, no open modal or visible error.
    Initial six role screenshots were captured by the passing run but its
    workspace output directory was subsequently cleared by narrow Playwright
    runs; they are **not durable retained image evidence**. The executed result
    above is recorded here without claiming those files still exist.
  - Sign-in preview screenshot inspected at 1366 × 844: app loads, native Staff
    Login and public/auth separation remain intact; no browser error in capture.

For the matrix and popup rows marked “F results below”, F is limited to the
specific interactions above. Do not infer native backend verification for the
three fixture roles: A covered the SA save flow only. Exact staff search-link
construction/category continuation, role-source allowlists, selected location
and audit URL handoffs were executed as U checks, not browser-click claims.

### Reproduce changed-flow checks

```sh
node --test artifacts/clinicflow/src/lib/workspace-navigation.test.mjs \
  artifacts/clinicflow/src/components/clinic-navigation.test.mjs \
  artifacts/clinicflow/src/components/enterprise-interactions.test.mjs \
  artifacts/clinicflow/src/components/communication-usage.test.mjs \
  artifacts/clinicflow/src/components/saved-scope.test.mjs
pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/playwright.config.ts \
  role-layouts.spec.ts --project workspace
ROLE_LAYOUTS_AUTH=1 pnpm exec playwright test \
  --config artifacts/clinicflow/workspace-regression/playwright.config.ts \
  role-layouts-auth.spec.ts --project role-layouts-auth
```

Do not run these against a published host. The native runner starts and removes
its own PostgreSQL cluster; the fixture runner intercepts every API request.
Profile/Platform register shared busy/dirty state; workspace switching is disabled
with an explanation until those edits are saved/discarded, preventing a server
scope mutation before an eventual page-exit prompt.

## Explicit exceptions and limitations

Network-eligible clinics are not clinical assignments. Staff administration is
not roles/system-user administration. Live report metrics are not Operational
Detail metrics. Global policy defaults are not clinic overrides. Profile contact
proof is not visit contact. Public/private/guest capability pages are not
administrative workspaces. These differences are retained intentionally.

Source-only rows and unexecuted device/error/forbidden combinations remain
unverified, not “passed because a component exists.” No claim is made about
production/UAT appearance, delivery, actual phone camera use, exhaustive
assistive-technology coverage or arbitrary future custom-permission policies.
