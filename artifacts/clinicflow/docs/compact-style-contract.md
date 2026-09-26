# DigiQ Doctors compact style contract

Compact is the only density. No Comfortable/Compact toggle (`.density-*` rules removed). Styles live in `src/compact-workspace.css` (scoped to `.workspace`); patient tickets, print, auth and public pages are unaffected.

| Class | Use |
|---|---|
| `.clinic-workspace` | Two-column wrapper: section nav + content. Collapses to one column at ≤900px. |
| `.workspace-section-nav` | Desktop section navigation (links/buttons, mark current with `aria-current="page"`). NOT tabs. Hidden ≤900px. |
| `.workspace-section-select` | Wrapper around a `<label>`+`<select>` mobile section picker. Shown ≤900px only. |
| `.resource-toolbar` | Row: `.search` (left, max 360px) → optional selects → `.resource-toolbar-actions` (right, `margin-left:auto`). |
| `.status-tabs` | The only tab pattern: Active/Inactive/All. `role="tablist"`, children `role="tab" aria-selected`. Optional `<span class="count">`. |
| `th[aria-sort] > .sort-button` | Full-width header button; put arrow icon (or `<span class="sort-arrow">`) at end. Arrow dim unless `aria-sort` is ascending/descending. |
| `.status-switch` | `<button role="switch" aria-checked class="status-switch"><span class="status-switch-track"/>Active</button>` or `<label class="status-switch"><input type="checkbox"><span class="status-switch-track"/>Active</label>`. Always visible text label. |
| `.button-group` | Primary + secondary actions together; `.danger` first child is pushed left, separated. |
| `.panel-heading` + `.panel-actions` | Title block left, actions right, vertically centred. |
| `.form-footer` / `.modal-footer` | Right-aligned: secondary (Cancel) then `.button` primary. `.danger` pushed left. Wraps full-width on mobile. |

Clinic settings (`components/clinic-settings.css`): `.clinic-settings-tabs` renders as a segmented section nav; use `aria-current` or `aria-pressed` for the active section.

Touch: all controls reach 44px on ≤767px or coarse pointers. Focus: 2px cyan `:focus-visible`. Reduced motion honoured.
