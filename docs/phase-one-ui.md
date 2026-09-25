# Phase 1 compact UI: shared FilterBar contract

Source: `artifacts/clinicflow/src/components/ListingControls.tsx`

```ts
<FilterBar
  children?      // PRIMARY controls. Always visible and never collapsed.
  advanced?      // SECONDARY controls, shown behind a "More filters" toggle (aria-expanded/aria-controls).
  onReset?       // Handler for "Clear filters". The button is disabled when `active` is false.
  active?        // Whether anything differs from the defaults (role-aware defaults count as not active).
  chips?         // {key,label,onRemove?}[]. A key prefixed with "adv:" adds to the advanced-count badge.
  defaultAdvancedOpen? // Opens the advanced panel on mount; it also re-opens when advanced chips become active.
  actions?       // Trailing buttons, e.g. export.
  label?         // Accessible section label (default "Filters").
/>
```

## Backwards compatibility
- Callers that pass only `children`, `onReset` and `active` (all of clinic.tsx today) render every control as primary and always visible. Nothing is hidden and no advanced toggle appears.
- **Required selectors must be passed as `children`, never `advanced`.** This covers queue clinic/branch/doctor/date, booking context, report date range, and any control a page cannot work without.
- Put only optional narrowing controls in `advanced`, such as status, sort, specialization and managing admin.

## Density conventions (index.css)
- Filter fields are 38px tall on desktop. Toggle and clear buttons are 44px on mobile.
- Tables inside `.panel.table-panel` scroll inside a container of up to 72vh, and `thead th` is sticky on desktop.
- Use the `th/td.col-actions` class for a sticky right-hand actions column, and `th.col-status` for the status column width.
- Rows are about 40px, so more than 10 rows are visible on desktop. Pagination defaults to 20 rows (options 10/20/50/100).
- Below 1024px, tables turn into labelled cards via `data-label`.

## Current consumers
- ResourcePage: the key selectors (clinic, branch, doctor, exception date, master category) are primary. Status, sort, day, dates and admin filters are advanced. On doctor schedules/exceptions, the doctor's own id is the default and is restored on reset.
- Users: clinic and branch are primary. Status, specialization, managing admin and sort are advanced.

## Note on assignmentTargetRole("admins") === "doctor"
This is intentional, not a bug. The `GetStaffAssignmentOptionsTargetRole` enum only allows `doctor|receptionist`. The admins tab never calls assignment lookups (the selectors are guarded by `tab !== "admins"`). The create/update payload role (`clinicAdmin`) comes separately from `staffInput`. The mapping is a safe fallback that the tests cover, so it was left unchanged.
