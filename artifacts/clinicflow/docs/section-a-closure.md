# Section A — Shared UI Consistency: Closure

Scope: layout, placement, density, help and feedback only. No Section B+ business rules, address API or
country defaults, schedule policy, mobile verification policy or QR behaviour were changed.

Evidence base: source review plus `npx tsc --noEmit -p .` (clean) and
`node --test $(find src -name "*.test.mjs")` (374 pass, 0 fail). Regression tests:
`src/components/section-a-consistency.test.mjs`, `src/components/compact-listing.test.mjs`.

## Checklist

| # | Requirement | Implementation evidence | Test evidence |
|---|---|---|---|
| A1 | Same journeys/controls for every role, permissions preserved | Shared `FormActions` (Users, ClinicSettings, Editor in resources.tsx, TicketEmailDialog, WeeklyScheduleEditor, AppointmentRows, CustomRoles, IntegrationSettings/Editor, EmailTemplates, ClinicRegistrationWizard); shared FilterBar/Pagination/RowMenu. No permission checks altered. | "shared FormActions adopted", "custom form surfaces use the shared action footer" |
| A2 | Equivalent placement of title/search/primary/filters/views/export/footer/pagination | One footer order: secondary left, Cancel/Back, primary right; booking + guest booking use the same `form-footer form-actions`. Lists keep FilterBar top, Pagination bottom. | "Editor uses shared FormActions with Cancel before Save", "booking and guest booking share action alignment" |
| A3 | Content-sized fields | `src/lib/field-width.ts` (xs/sm/md/lg/full) + 12-col container grid; `cf-auto` auto-fill grid for custom forms; phone (country + number) takes a full row / double track. | "editor fields sit in a semantic-width grid", "compound phone fields…" |
| A4 | Compact, readable, touch-safe | Shared density CSS; 44px touch targets on coarse pointers; mobile Locations action cell is full-width wrapping flex (no 24px clip); tablet appointment Actions 236px with table min-width 980px so Check Out scrolls instead of crowding neighbours. | "closure: action cells never clip/crowd…" |
| A5 | No duplicated generic counts/context | FilterBar count removed from resources, Appointments, Users, SystemUsers and Reports; Pagination shows the total once. | "listing toolbars do not repeat the record count", closure test |
| A6 | Sidebar Recent removed | `WorkspaceShell.tsx` renders Favorites only. | "sidebar no longer renders Recent" |
| A7 | Routine help on hover/focus/tap | HelpTip replaces routine paragraphs in Editor, IntegrationEditor, booking review. | "routine explanations are HelpTips…", "remaining Editor guidance is HelpTip" |
| A8 | Essential feedback visible | Validation, overlap/conflict alerts, save errors, offline/stale notices and integration warnings remain inline `role="alert"`/`role="note"`. | "integration warnings stay visible", HelpTip tests assert alerts remain |
| A9 | Back/Cancel preserve input/context; consistent failed-save/success | Cancel uses caller handler or AppDialog guarded close (discard confirm); failed saves keep form state; page-level footers are in normal flow so they never cover fields; dialog footers sticky with scroll padding. Appointments empty state now offers a real "Show All Visits" action instead of the stale "Try All visits" text. | "FormActions cancel can use the AppDialog guarded close", closure test |
| A10 | Theme unchanged | No colour/font token edits; new CSS uses existing `--dq-*` variables. | Source review |

## Verified
- TypeScript typecheck clean; full node test suite passing (374/0).
- Source-level assertions for every row above.
- Source sweep: no remaining bare `className="form-footer"` in tsx, no `listing-count` toolbar totals, no sidebar Recent, no "Try All visits".

## Browser verification
- Locations at 390px: action cell is full-width and both nested controls measure 44×44px without clipping.
- Locations at 640px: the intentional tablet table scrolls horizontally; header and row actions stay aligned and visible before/after scrolling.
- Appointments at 768px: Check In and Check Out remain visible in matching 236px sticky header/body columns before/after scrolling.
- Empty upcoming appointments: Show All Visits changes the view and the empty-state message; the button disappears in All Visits.
- Prior representative checks cover registration phone fields, dialog scrolling, date/time popovers, contextual help, cancelled edits and failed-save draft retention.
- Browser checks used fictional GET fixtures/intercepted failures, not live customer writes or delivery.

## Verification limits
- These are representative rendered checks, not every page/state combination or live-backend acceptance.
- Screen-reader announcement of HelpTips was not tested with assistive technology.
- An integration-editor browser form warning was observed earlier without nested forms or a reproduced interaction failure; its cause remains unconfirmed.
