# Uniform headers and pagination

## Contract

The horizontal title/search/tools/actions composition is the default, not a
resource or role opt-in. FilterBar retains its old `compactToolbar` argument only
as an ignored compatibility argument; true and false render the same header.
Existing quick filters/status and active chips remain secondary controls.
Exports stay inline beside the primary action. No search, exports, records,
permissions, context defaults or page-size defaults were added.

The shell delegates its title to the active listing/tab. PageHeader provides the
same heading/action alignment for non-list content and form sections. Eagerly
mounted, hidden user tabs receive no title ownership. Context headings remain
above nested lists; a nested list does not create another page h1.

ListingRegion uses a minimum available block size, not a fixed/max table height.
Its pagination or cursor footer is an ordinary flex child pushed to the bottom.
Long rows and expanded content grow the panel and remain in document/panel
scrolling. An enclosing scrolling panel, when present, supplies the available
height instead of the browser. No footer is positioned over records or controls.
Zero results retain a truthful 0–0 footer with disabled navigation. Initial
loading, placeholder pages and errors do not announce an invented record range.

## Route and consumer inventory

Inventory traced from App's role route registry, PortalWorkspace dispatch,
legacy redirects, contextual workspace tabs, public routes, and every production
FilterBar/Pagination callsite. Role-dependent actions remain in their existing
owners; layout does not authorize any action or widen any query.

| Surface / entry point | Existing controls and title owner | Body/footer |
| --- | --- | --- |
| Appointments, all permitted staff/patient roles; List/Calendar | Shared FilterBar owns shell h1; search, filter drawer, table columns, saved views, export and Book as permitted. List/Calendar navigation and freshness remain separate operational controls. | List uses ListingRegion + Pagination; calendar retains calendar geometry. AppointmentRows and approved Booking/ticket/detail content unchanged. |
| Patients | ResourcePage default header, search/filter/columns/views/actions as permitted | Shared region + numbered footer |
| Clinics directory | ResourcePage default header; required ownership/type selectors retained | Shared region + numbered footer |
| Doctor Clinics: Assigned / Network | Independent filters migrated to the same header; both descriptive headings/help retained; first visible header owns h1, nested network header remains h2 | Separate panel-local regions/footers |
| Clinic management: Details, Locations, Staff, Policies, Activity History | Parent Clinic PageHeader retains scope selector; tab headers/controls remain within their panels. Locations and Activity use ResourcePage; Staff uses Users. | Listing tabs use regions; details/policies stay forms, with no artificial paging |
| Branches/Locations legacy destinations | Redirect/context handling unchanged; ResourcePage header whenever a listing is rendered | Shared region/footer, count retained |
| Doctors, staff/receptionists/clinic admins, fixed-clinic Staff | ResourcePage or Users shared header, Staff Type, existing search/filter/options/export/Add | Shared region/footer; contextual schedule dialogs retain doctor context |
| Users workspace: Custom Roles / Permissions / System Users | Visible tab owns one h1 through PageHeader or FilterBar. Hidden mounted tabs cannot claim it. Existing New Role, permission explanations, account actions retained. | System Users uses region/footer; role/policy editors remain unpaginated editors |
| Weekly Schedules / Date Exceptions standalone, doctor/location/staff contextual entry points | SchedulingWorkspace/ResourcePage shared header, existing required selections, tabs, search/filter/options/Add | Both resource tables use regions; existing single-page-navigation policy retained |
| QR Codes, including doctor workspace and location entry points | ResourcePage default header and existing QR actions | Region/footer; QR booking/ticket contents unchanged |
| Reference Data, Audit; legacy aliases and Settings tabs | ResourcePage default header replaces shell-only title; existing category/scope/search/options retained | Region/footer |
| Reports: Live Dashboard / Operational / Templates / Communication Usage | ReportsDashboard FilterBar; legacy Operational FilterBar; ReportTemplates PageHeader; CommunicationUsage FilterBar | Dashboard/Operational result tables use regions; templates remain non-list configuration; usage retains cursor footer and coverage warnings |
| Queue staff/patient; nested session appointments | PageHeader for Queue context/actions, FilterBar for session search/status/sort. Required session selection and patient-only distinctions retained. | Staff entries region/footer, unavailable states reserve region; patient's own queue card remains a card without artificial pagination |
| Queue Earlier Booking Requests | FilterBar with existing count/help/search/sort/refresh; approval workflow unchanged | Own region/numbered footer, not browser-fixed; existing absence when no unfiltered requests preserved |
| Notifications activation/wording | FilterBar consolidates title, event search, channel/recipient/status filters and scope/optional-delivery controls | Unpaginated event region; warnings, accordion and edit workflow retained; no delivery actions used for tests |
| Communication: SMTP / SMS / Delivery Logs | Provider forms retain shared section-head alignment and actions; Logs FilterBar owns active listing title with existing search/filter/refresh | Logs region + existing cursor navigation; no invented total/page-size feature |
| Public clinic location directory / branch specialist directory | Identity PageHeader retains care/booking/display actions. Directory FilterBar owns existing title/search/sort; no duplicate Specialists heading | Card listings use their own region and grouped range/size/navigation. Initial unavailable states reserve geometry with disabled footer. |
| Public discovery/guest booking | Existing discovery selectors are form controls, not a fabricated directory table. AuthCard/PageHeader aligns title and actual controls. | Forms stay forms; no artificial paging, record rows or removed required selections |
| Dashboard / Profile / Workspace and platform Settings / Demo setup / Integration panels | Existing horizontal shell page-heading / common section-head composition; PageHeader additionally used for Clinic, custom-role/permission headings, notification settings and shared FormSection/AuthCard | Dashboards, forms and detail content retain their structure; primary submit/cancel action bars remain associated with their forms |
| Login / signup / registration / password recovery / invitation / patient scanner | Shared AuthCard PageHeader; existing public/auth context and navigation retained | No fabricated list controls or pagination |
| Public queue display, live/read-only ticket, guest receipt, scan/check-in, appointment detail/ticket tabs | Operational headings remain associated with their actual content/controls; no change to approved ticket/receipt layouts | Not converted to tables; no new navigation, sharing authority, authentication or delivery behavior |
| Marketing homepage / not-found / access-denied / workspace bootstrap | Retain content/identity hierarchy and actual links/actions using the same responsive heading/action alignment; no fake listing header | No list pagination |

The standalone project deck and design canvas were not modified.

## Regression coverage

`workspace-regression/header-pagination.config.ts` runs:

- **header-consumers.spec.ts:** actual App router and actual consumer components,
  24 route/tab/role cases plus active hidden-user-tab ownership and a scoped
  Queue/nested Guest Requests case (zero session entries, two pending requests). Fictional
  superAdmin, clinicAdmin, doctor, receptionist, patient and anonymous identities.
  Each route is inspected at 1440, 768 and 390 px. Unknown reads fail closed;
  writes are rejected and counted. Checks include one visible h1, shared header
  presence, no legacy separate FilterBar title row, document overflow and
  panel-local static footer containment.
- **header-pagination.spec.ts:** production controls under real shell ancestry and
  title delegation at 390, 768, 1024 and 1440 px. Exercises zero/two/full/short
  final-page results, empty/loading/error geometry, unavailable navigation,
  page-size changes, search, filter application/chips, keyboard open/Escape,
  expanded content, nested tabs and a non-list form header. Compares header
  rectangles, footer/body positions and short-page panel bounds.
- Node render/source contracts in `components/listing-region.test.mjs`,
  `components/uniformity.test.mjs`, and `listing-ux.test.mjs`.

First browser pass: 25 routed-consumer/tab checks passed. Four primitive cases
initially stopped at a fixture-only invalid icon name; the icon was corrected.
The page-size interaction was corrected to use the actual button trigger and
keyboard activation instead of assuming a combobox or clicking its clear icon.
The mobile consumer screenshot was captured during the existing sidebar's resize
transition; a focused recheck waited for its measured right edge to be offscreen
and confirmed the header was fully visible. Primitive checks subsequently passed
at 390, 768 and 1024 px. The desktop expanded-content check caught a legacy table
height cap; that cap was removed so expansion grows the panel naturally.
The targeted 1440 px recheck then passed the complete state/interaction sequence.
The additional real Queue/nested Guest Requests case also passed, including
separate zero-result and two-request footers without a context-selection bypass.

Final result: **30 distinct browser cases passed across the initial pass and
focused follow-ups**, plus **22 Node checks**, the frontend TypeScript check,
and the production build. The build reports the existing large-chunk warning.
Frontend and API development workflows are running; their final logs are clean.
No production deployment was performed.

Configured completion validation additionally exposed outdated communication
test fixtures (missing the new region export) and a Notifications compactness
regression. The fixtures now preserve header actions and stub the region
explicitly. Notifications' existing selectors use the toolbar's secondary slot
rather than sharing the search input's flex sizing. Both existing notification
density cases pass unchanged (first event at about 219 px, below their original
240/280 px limits), and the expanded focused Node run passes all 35 checks.
Passing initial evidence is retained separately under
`generated-artifacts/headers/initial-pass`; focused follow-up results are kept in
`generated-artifacts/headers/focused-first`,
`generated-artifacts/headers/primitive-keyboard-final`,
`generated-artifacts/headers/desktop-expanded-final`, and
`generated-artifacts/headers/queue-final`.

## Verification boundaries

- Chromium is the available tested browser engine. Safari and Firefox are not
  claimed as passed.
- These are mocked-identity layout checks, not real sign-in or live permission
  verification. No live records, provider sends or patient data were used.
- The primitive state matrix verifies shared geometry; it is not a claim that
  every data count/state was reproduced on every real route or live account.
- The inventory includes non-list and operational surfaces without imposing
  artificial controls or changing approved booking/ticket presentation.
- TypeScript references must be built first in a fresh workspace
  (`pnpm exec tsc -b lib/api-client-react`); otherwise stale declaration outputs
  can report missing already-existing API fields unrelated to this layout.

Build command: `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`.
The environment values here are non-secret build inputs, not deployment changes.
