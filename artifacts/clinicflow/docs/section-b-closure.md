# Section B — Clinic Locations Management: Closure

Scope: Clinic Settings → Locations & Hours and the Add/Edit Location dialogs. Changes are limited to layout, labels and placement. Nothing else changed: no API calls, permission checks, country/address defaults (Section C), or save/business rules. The theme was kept; the new CSS uses the existing tokens and spacing scale.

Regression tests: `src/components/section-b-locations.test.mjs` (5 tests, one per item).

| # | Requirement | Implementation evidence | Test |
|---|---|---|---|
| B11 | Remove the duplicate "N locations" count beside the clinic selector; keep one useful list count | `ClinicSettings.tsx`: the `settings-scope-meta` count span is removed. `resources.tsx`: for `branches` only (`headingCount`), the shared `FilterBar` `title` shows "Locations · {total}". `FilterBar` places it on row 1, or in the count sub-row when the workspace page title owns row 1, so there is no duplicate heading. `Pagination` has a new optional `hideTotal` prop (default `false`), passed only for Locations: it keeps "Showing a–b", page size and page controls but drops "of {total}". All other lists are unchanged. The Section A test now enforces "no duplicated counts" (a heading total requires `hideTotal`) instead of forbidding heading counts. | "B11 …" |
| B12 | Make clinic-wide management scope clearly different from the operational location header, without an extra paragraph | `ClinicSettings.tsx`: the scope row now has a compact "Clinic-wide management" badge, with the explanation in a `HelpTip` (it says operational pages use the location chosen in the workspace header). The `listing-hint` paragraph above Locations is removed. CSS is `.settings-scope-badge` in `clinic-settings.css`. | "B12 …" |
| B13 | Locations list toolbar uses the same shared list controls | Locations render through the shared `ResourcePage` → `FilterBar` (search, filters, saved views, columns, Add Location) and `Pagination`. The only Locations-specific addition is the B11 heading total passed through `FilterBar`'s existing `title` prop. | "B13 …" |
| B14 | Add/Edit Location grouped into identity/address/contact, sized to content; clinic email/phone shown beside their own fields | `resources.tsx`: `LOCATION_EDITOR_GROUPS` (Identity / Address / Contact / Status), applied whenever the editor has `inheritEmail`, so both Add/Edit and the hours dialog get it. The order is Email → Use Clinic Email (clinic email), then Phone → Use Clinic Phone (clinic phone); the labels use the parent clinic's values. `field-width.ts`: the inherit toggles are `md` instead of full width; PIN stays `xs`. The "Effective contacts" notice paragraph is removed. | "B14 …" |
| B15 | Consistent title and Close; header and Cancel/Save footer stay in place; scrolling works; fields are not hidden | The hours dialog title is now `Edit Location · {name}`, matching the list's `Edit Location` / `Add Location`. Both use the `AppDialog` header and Close. `Editor`'s `FormActions` now sets `cancelClosesDialog`, so Cancel is always present and uses the guarded close (discard confirmation). The footer stays at the bottom of the scrolling `.app-dialog-body`, which now has `scroll-padding-bottom:96px` so a focused or invalid field is not hidden behind it. | "B15 …" |

## Verified
- `npx tsc --noEmit -p .` is clean.
- `node --test $(find src -name "*.test.mjs")`: 379 pass, 0 fail (after the B11 heading-count follow-up). This includes the existing Section A tests (toolbar has no title count, semantic grid, spacing scale).

## Browser verification
- At 1440px and 390px: single Locations heading total, pagination range without repeated total, clinic-wide badge, and shared responsive toolbar passed.
- Add/Edit Location grouping, inherited contact labels, and preserved overrides passed. Contact toggles stack beside their corresponding field groups on narrow screens.
- Dirty Cancel → Keep Editing retained draft inputs in Add and the location-hours editor. An intercepted failed Add save retained inputs and showed the error.
- Mobile dialogs kept header/footer visible and fields clear while scrolling.
- Fixed City/State/PIN icon overlap. Recheck measured 12px clearance between icon and text for all three inputs.
- All browser writes were intercepted; no customer data, delivery, or live save was exercised.

## Limits and shared behavior
- Browser coverage is representative, not every role or state. No live-backend acceptance is claimed.
- Editors in other dialogs that pass no `onCancel` (Clinic Details, Booking Policies) now also show a guarded Cancel button.
