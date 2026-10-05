# DigiQ enterprise standardization: progress

Current UI interaction completion is documented in `docs/enterprise-ux-completion-matrix.md` at the workspace root. The historical pending list below predates the column controls, saved views and shell work now delivered. Backend-dependent capabilities remain pending; bulk check-in is prohibited by the user's later decision.

Scope: visual and token standardization of the existing UI (v3 spec plus HIGH_DENSITY_OPERATIONAL). No backend or auth logic changed.

## Tokens (single source: `src/index.css` `:root`)
- Font: `--font-sans: 'Inter', system-ui, sans-serif`. `--font-heading` and `--font-body` both alias it. `--font-mono` is a system monospace stack used for ticket numbers and refs. The DM Sans, Manrope and Space Mono imports and literals have been removed from every CSS file.
- Type: page 24, section 20, card 18, body-lg 16, body 14, label/table 13, table heading 13, caption 12. `--weight-heading: 600` applies to h1 to h4 in both the base and workspace layers.
- Spacing: 4/8/12/16/24/32/40/48. `--space-5` was 20px and is now an alias for 24px; it is marked legacy.
- Radius: badge 6, control 8, card 12, dialog 16, pill 999. Legacy `--radius` now points to the control radius (it was .75rem).
- Heights: `--control-sm/md/lg/xl` = 32/40/44/48. The off-scale 34/35/36/38px heights were migrated to tokens. `--cw-ctl` and `--cw-ctl-sm` are now 32. The list-header control height is 32 (it was 38).
- Heading weights of 750 and 800 now use the token. The brand wordmark is the only exception.

## Density family rules (index.css, screen-only)
- The stat grid uses auto-fit columns (minimum 180px), so a single metric no longer spans a full row. Gaps are tighter.
- Dashboard panels no longer have a forced minimum height of 328px.
- Empty states are left-aligned with compact padding and a 32px icon.
- At 1280px and wider, forms use multiple columns, including `.form-grid.single` (2 columns). On mobile they still use 1 column.
- Table headers use 13/600. Captions and badges use 12px.
- Topbar: wraps, has a minimum height of 44px and keeps user name and role visible on mobile. The secure label is hidden below 640px.

## Topbar integration
- `clinic.tsx` renders `WorkspaceSearch`, which is owned by main, in `.topbar-right` before the secure label. It is keyed per user and role. This was a layout-only edit.

## Route / role coverage
These shared token and family rules reach every route in `App.tsx`:
- **Public:** `/`, `/:clinicSlug`, `/:clinicSlug/:branchSlug`, `/book/:reference`, `/guest-booking`, `/scan-qr`, `/check-in`, `/display/:reference`, `/register-clinic`, `/register-doctor`
- **Auth:** sign-in, patient-login, demo-login, forgot and set password. Fonts and heights change through tokens only; auth files were not edited.
- **Admin:** all 21 pages
- **Doctor:** 12 pages
- **Receptionist:** 8 pages
- **Patient:** 5 pages

Ticket and QR geometry, and the export/print HTML, are unchanged. Only the font family on the on-screen ticket follows the token.

## Round 2 (governance across public/auth)
- Every literal px, rem and clamp font size in the governed CSS has been mapped to the nearest approved token. This covers index base, auth, landing, registration, guest booking, shared feedback, listing, settings, email templates, help tips and dialogs; 256 or more declarations in total. Sizes of 8–11px were raised to the 12px caption size, never shrunk.
- Landing hero `h1` (61/51/49/42px), journey, provider banner, auth aside, auth card, page heading and onboarding headings now follow the approved hierarchy: 24/20/18 at weight 600 with no negative tracking. Negative letter-spacing has been removed from the governed CSS.
- **Display variant (documented):** `--type-display-sm/md/lg` (clamp). Only ClinicDisplay `.cd-*`, the queue-display banner and the booking confirmation token use it, so they stay readable from a distance. Small text on ClinicDisplay is no smaller than 14px.
- **Control heights:** primary list-header search and actions (`--lh-h`) and page-heading primary buttons are 40px (`--control-md`). Compact 32px (`--control-sm`) is used for secondary/table controls, filters and pagination.
- Dialog titles are 18/600.
- Empty states (`EmptyState`, `.empty`, `.et-empty`) are left-aligned with compact padding and a 32px icon. This was migrated at the source (`shared-feedback.css`, `uniformity.css`), not added as another override.
- **Forms:** a 3rd column is added at 1280px and wider only when a form has 5 or more children. Forms marked `.single` and short forms are not forced wider. Textarea/notes, password fields and checklists, `.wide`, `.span-2`, section labels and footers always span the full width. Mobile uses 1 column.
- **Contract tests:** `src/enterprise-tokens.test.mjs` checks fonts, the scale tokens, the absence of literal font sizes and off-scale heights, the 40px header, the empty-state alignment and the full-width form exceptions.

## Round 3 (closing the existing-style scope)
- **Spacing:** every margin, padding and gap in authored CSS uses 0/4/8/12/16/24/32/40/48. This includes index base, landing, auth, registration, display, the integration/email/settings CSS and the shared components. Values above 48px are capped at 48px. A script did the conversion (rem values were converted to px first). Excluded: ticket, QR, scanner and OTP-slot rules, keyframes, positioning offsets, icon dimensions, 1px borders and calc/clamp expressions.
- **Radius:** every radius uses 6/8/12/16, or 999 and percentages for pills and circles.
- **Colours:** hex values that match a named token exactly (blue, cyan, ink, soft, background, surface-hover, disabled text) and plain white backgrounds now use the token (`--dq-blue`, `--dq-cyan`, `--ink`, `--soft`, `--dq-bg`, `--surface-hover`, `--text-disabled`, `--dq-surface`). Status and semantic colours were deliberately left unchanged.
- **Landing:** the decorative grid, orbits and stethoscope disc are hidden. The header is 48px high; the hero, journey cards and provider banner use a dense two-column grid and the workspace width. All text and links are kept.
- **Inline styles:** spacing and font size in inline styles in `AppointmentDetails`, `GuestBooking`, `ClinicAdminOnboarding`, `CheckIn`, `clinic.tsx` and `resources.tsx` now match the scale. Left as they are on purpose: `VisitTicket` (print/export), `LiveSearchInput` icon offsets, `BrandLogo` dimensions, and the CheckIn scanner frame geometry.
- **Assertions updated** because the approved scale supersedes them: `compact-listing.test.mjs` (table cell padding from 6px to 8px) and `uniformity.test.mjs` (secondary button background is now `var(--dq-surface)`).
- **Contract tests:** `enterprise-tokens.test.mjs` now also checks the spacing and radius scales in all governed CSS, and that the landing hides the decorative art while keeping its text.

## Not verified
- Live backend authorization and every possible data/state combination were not re-tested. Browser checks used fictional intercepted APIs, not production patients.

## Browser verification
- All 14 focused checks passed: representative Super Admin, Clinic Admin, Doctor, Receptionist and Patient routes; desktop/mobile layouts; 40px header controls; ticket fit; command search and scoped links; device-local favorites; password visibility and concealed saved credentials.
- Normal ticket at 1024×640 had matching body scroll/client heights of 541px. No unnecessary scroll.
- No API writes and no page errors. Evidence: `screenshots/enterprise-check/results.json` and accompanying screenshots.
- Screenshot inspection also identified legacy patient-name ellipsis; primary record names, audit summaries, activity names and guest-request text now wrap instead of truncating. This small CSS fix was source-checked after the browser pass.

## Pending features (NOT implemented; visual availability does not imply them)
- Table capabilities: sticky action columns, bulk selection everywhere, column visibility, pinning and reordering, saved views, row expansion, virtualization.
- Implemented by main: shared sensitive-field show/hide, Ctrl/Cmd+K palette, permission-scoped grouped record searches, user/role-scoped page favorites and recent pages, staff-search deep links. Saved secrets are never fetched for display.
- Still pending: saved searches/filters/views, search suggestions/history (patient-query retention requires a privacy design), searchable queue/report content, sidebar placement of favorites/recent pages, notification center, profile menu/workspace switching, expanded dashboards/charts and report exports, patient documents/timelines/activity, and expanded bulk workflows. Existing booking and single-current-patient queue semantics remain unchanged.
- Dark mode, a component library extraction and tooltip system are not in scope.
- No second status was added for Absent/noShow.

## Tests
- Typecheck passes. All `src/*.test.mjs` and `src/components/*.test.mjs` pass.
- Assertions updated because the approved tokens supersede them:
  - `workspace-style-tokens.test.mjs`: font, table-heading 13, dialog radius 16, the new tokens, and the spacing scale.
  - `uniformity.test.mjs`: primary list-header height is now `var(--control-md)` (40px).
- Consolidated frontend regression run: all 253 tests passed; no skips. This does not prove backend or every possible UI state.
