# Uniform Layout Correction — Coverage

Source of route inventory: `src/App.tsx` (public routes + `routes` map per role) and the page switch in `clinic.tsx` `PortalWorkspace`.
Legend: **Changed** = source edited in this pass. **Shared** = picks up an app-wide shared change (TableColumns column classes, bounded table CSS, one-line `.row-actions`, uniform `.section-head`) without page-specific edits; verified by typecheck/source tests only, not by rendered inspection. **N/A** = no table/menu/section pattern affected.

## Shared mechanisms changed
- `components/TableColumns.tsx`: every column cell now carries `col-<key>`, enabling bounded widths per table. Saved layouts unchanged (keys preserved; new appointment keys appear unless a saved view hides them).
- `components/RowMenu.tsx` (new): secondary actions in a fixed-position body portal (escapes `table-scroll` clipping), Escape/outside close, focus return, destructive items separated below a divider.
- `components/uniformity.css` (appended block): fixed table layout ≥1025px with single-line ellipsis cells, one-line `.row-actions` (no wrap), aligned expansion `<dl>` grid, uniform `.section-head` header, compact activity feed, ticket hierarchy styles.

## Pass 2 shared changes
- `RowMenu` now supports link items (`href`), hints, arrow/Home/End navigation; used by every listing that has secondary row actions.
- Fixed table layout limited to `.appt-table`, where every truncating cell is an `OverflowText` (full value on hover/focus/tap). Other tables: header nowrap, cells bounded at 320px with wrapping, container scrolls horizontally (`overflow-x:auto`) — no silent cut-off.
- `td.col-actions` is shrink-to-fit and nowrap everywhere; `.row-actions-end` replaces inline styles.
- `.section-head` uniform style applied workspace-wide; added to SessionQueue, WeeklyScheduleEditor, ClinicSessionSetup, clinic assigned/network panels, ReportChart; ReportTrends inline font-size replaced by `.section-subhead`.
- All dialogs already route through `AppDialog` (27 files; no raw dialogs except WorkspaceSearch/NotificationsPanel/DateFormatInput popovers). Uniform `.form-footer` (right-aligned, divider) added for all 10 dialog forms.

## Route / page families
| Route family | Status | Notes |
|---|---|---|
| `/*/appointments`, `/*/dashboard`, `/*/queue` | Changed (pass 1) | See above; Queue section head unified in pass 2. |
| Appointment ticket dialog | Changed (pass 1); owned by main now | Top-right status/actions in VisitTicket left to main agent. |
| `/admin/clinics`, `/admin/branches`, `/doctor/clinics`, `/doctor/branches` (resources.tsx) | Changed | Bespoke location menu replaced by shared `RowMenu` with identical items (Open Booking, Queue Display, Manage QR Codes, Configure clinic & opening hours [admin], Doctor Sessions) plus Deactivate as separated danger item. Edit stays primary icon. |
| `/admin/patients`, `/doctor/patients`, `/receptionist/patients`, `/admin/masters`, `/*/qrs`, `/admin/audit` and other ResourcePage lists | Changed | Deactivate moved from inline trash icon into `RowMenu` (danger, same confirmation + hint + disabled rules). Patient details / QR view / Edit stay inline icons. Expansion rows use aligned dl grid. Audit has no row actions (detail drawer unchanged). |
| `/admin/users`, `/doctor/users` (Users.tsx) | Changed | Edit inline; Resend Invitation moved into `RowMenu` with same restriction hint, disabled rule and confirmation. |
| `/admin/system-users` | Verified (source) | Single Permissions button + columns toggle already one line; gets col classes and section styles. |
| `/admin/permissions` custom roles | Changed | Delete moved to `RowMenu` danger; inline style removed. |
| `/admin/reports` | Changed | Chart header uses section-head; trend subheading tokenized; table uses shared bounded/scroll rules. |
| `/*/availability`, `/*/exceptions` | Changed | WeeklyScheduleEditor/ClinicSessionSetup headings unified; picker/drawer untouched; row-actions in editor are inline form controls (not a listing), kept. |
| `/admin/settings` (ClinicSettings, Platform Preferences), `/admin/integrations`, `/admin/templates`, `/admin/demo` | Verified (source) | Already use `section-head`; now inherit uniform heading + dialog footer styles. No row menus present. |
| `/*/profile`, `/patient/records` | Verified (source) | Forms/drawer; dialog footer + headings shared. |
| Public `/:clinicSlug…`, `/book/:ref`, `/guest-booking`, `/display/:ref`, `/check-in`, `/scan-qr`, marketing `/` | N/A for listing rules | Public, non-workspace surfaces with their own card headings; no tables or row actions. Left unchanged deliberately so public branding is untouched. |
| Auth `/sign-in`, `/patient-login`, `/demo-login`, `/forgot-password`, `/set-password`, `/register-*`, `/onboarding` | N/A for listing rules | Forms only; no tables/menus. Not changed. |

## Final Verification
- Ticket status and Print/Download controls are in the on-screen header; Open Booking Status is beside the bold current-booking heading. Delivery warnings occupy their own row. Print/export document geometry remains unchanged.
- Broad fixture-only browser pass rendered overview, appointments, detail/column drawers, expanded rows, ticket, clinics, patients, staff, custom roles, reports and schedules. It found a tablet header/cascade defect; subsequent targeted checks covered the fixes.
- Final targeted checks: seven passed at 1280px, 1024px and 390px. Default/saved columns, single-line actions, expansion, patient action menus and ticket hierarchy verified. Tablet tables scroll internally; mobile appointments use paired detail cells with an internally scrollable action strip.
- Ticket print/download/QR regression: 24 passed after the ticket header changes.
- Final frontend typecheck and all 317 source regression checks pass, including the last responsive CSS corrections.
- Evidence: `scripts/uniform-layout-browser-check.mjs`, `screenshots/uniform-layout-check/`, and `screenshots/uniform-layout-targeted/`. Initial screenshots/results retain the failures; targeted evidence supersedes them for corrected states.
- Only fictional Super Admin identities were used, with every API request intercepted and zero writes. Other role variants inherit the shared components but were not separately browser-tested. This is not live authorization, physical-device or screen-reader certification.
- No publishing, real booking/account mutations, email sends or changes to clinical rules.

## Pass 3 (browser findings 1024px / 1280px)
- Defect: at 641–1024px the appointment table fell back to legacy tablet rules (`overflow-wrap:anywhere`, 3-col grid actions), so "Visit Date" fragmented and rows reached ~290px. Fix: legacy stacked rules now apply only ≤640px (index.css); bounded fixed layout, nowrap cells/headers, 44px header and 56px row targets, and `min-width:1260px` with internal horizontal scroll apply from 641px (uniformity.css). Admin listing actions likewise stay nowrap until 640px.
- Defect: 1280 actions column (252px) squeezed Check In/More and pushed the expansion toggle to a second line. Fix: actions column 340px, action items `flex:0 0 auto`, toggle (32px, labelled via aria-label) moved inside `.row-actions` in AppointmentRows, SystemUsers and ResourcePage (resources keep it in the select cell only when a table has no actions column). Users.tsx already had it inside. Colspans unchanged.
- Resource listings: admin-listing actions column widened 132→200px so icon actions + More fit on one line (test assertion updated accordingly).
- Pending: targeted browser confirmation at 1024/1280 by main agent.
