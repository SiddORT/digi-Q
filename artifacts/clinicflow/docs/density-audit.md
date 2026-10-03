# Density audit (staff workspace)

Shared screen spacing is owned by the final screen block in `src/index.css`; toolbar layout and control geometry are owned by `src/compact-workspace.css`. The final index rules are NOT layered and previously overrode compact spacing. Competing new spacing overrides were removed rather than relying on import order. Tokens: `--cw-ctl` 36→32px, `--cw-ctl-sm` 30→28px, `--cw-pad` 12px, `--type-panel` 16px. Existing section headings remain 20px; panel/dialog headings use 16px.

| Finding | Old | New | Pages |
|---|---|---|---|
| FilterBar grid forced status onto row 2; at <=1100px title/tools, primary, status = 3 rows | grid areas, 2–3 rows | one flex row (title, status left; primary/search + tools right), wraps only when needed | every FilterBar listing: appointments, resources, Users, clinic, SystemUsers, queue, scheduling, reports, audit |
| Panel heading padding/size (index.css final + compact both 20px) | padding 20px, h2 20px, min-h 48 | padding 8px 12px, h2 16px, min-h 40 | all workspace panels incl settings/templates/permissions/integrations |
| Mixed control heights 30/34/36/38/40 | mixed | 32 controls / 28 small, via tokens | toolbar, filters, section nav, search, status tabs, disclosures |
| AppDialog sections 20px, form gaps 16 | header/body 20px, gap 16, footer 16 | header 12/16, body 12/16, gap 12, footer 8/16, title 16px | all staff dialogs |
| Form grid/footer | gap 16, mt 16, pt 12 | gap 12, mt 12, pt 8 | workspace forms |
| Shell | final topbar 52, content 16/20, h1 24 | topbar 44, content 12/16, h1 20; phone content keeps 16px | all workspace pages |
| Stat/padded/notices/pagination | 20 / 12x16 / 40 min | 12 / 8x12 / 36 min, buttons 28 | dashboard, settings, all listings |

Additional findings fixed during rendered verification:
- A later 300px cap on titled toolbars forced System Users filters into a vertical stack despite available width. Removed the conflicting cap.
- Searchable selects retained a separate 43px minimum and large padding. Added a component hook and scoped compact geometry, without changing public controls.
- Sort labels added height to listing action groups. Labels remain accessible but are visually hidden; selected sort text remains visible.
- Pagination's rows-per-page label stacked above the selector. It now sits beside it.

Scope: shared workspace and AppDialog surfaces. Public marketing, sign-in, native authentication behavior, OTP, ticket and QR print geometry were not redesigned. Mobile and coarse-pointer rules preserve larger targets; compact desktop sizing is not applied indiscriminately to public controls. Status, field and action meaning is preserved.

## Verification

- Frontend TypeScript check passed; 137 component/style tests passed.
- Intercepted browser rendering covered 20 administration destinations at 1440, 1024 and 390px (60 page/viewport combinations). No page-level horizontal overflow or undersized tested mobile toolbar controls.
- Seven available create dialogs opened with no horizontal overflow: clinics, locations, patients, master data, QR codes, weekly schedules and exceptions.
- Final desktop toolbar heights: clinics/locations/patients/QR/audit 34px; users 38px; appointments/reports/System Users 59px; queue 57px. Weekly schedules and exceptions retain needed filter wrapping (125px); permissions keeps its labelled filter form (81px).
- These are fictional-data checks, not production UAT or every populated/edit/error state. Nothing was sent, saved to live data, or published.
- Evidence: `screenshots/management-acceptance/density-metrics.json` and `density-*.png`. Run `DENSITY_AUDIT=1 CHECK_FILTER='Density audit' node scripts/management-browser-check.mjs`.
