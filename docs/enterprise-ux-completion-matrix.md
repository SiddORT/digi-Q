# DigiQ enterprise UX: completion matrix

Frontend only (`artifacts/clinicflow`). No backend, data or auth changes. Preferences are stored on the device and scoped by user, role and table.

## Listing controls

| Listing | Columns (show/hide) | Reorder | Pin (exactly one column) | Row expansion (hidden data only) | Saved views (filters + column snapshot) | Sticky actions |
|---|---|---|---|---|---|---|
| Generic ResourcePage lists (clinics, locations, doctors, patients, users, masters, QR codes, schedules, exceptions, audit) | Yes | Yes | Yes | Yes | Yes | Yes |
| Appointments (page and dashboard) | Yes | Yes | Yes | Yes | Yes (`APPOINTMENT_VIEW_KEYS`) | Yes |
| Session queue | Yes | No (fixed operational order) | No | Yes | Not offered (clinical scope comes from the session selection) | Yes |
| Staff users (per tab) | Yes | Yes | Yes | Yes | Yes (`STAFF_VIEW_KEYS`) | Yes |
| System users | Yes | Yes | Yes | Yes | Yes (`SYSTEM_USER_VIEW_KEYS`) | Yes |
| Reports | Yes | Yes | Yes | Yes | Yes (`REPORT_VIEW_KEYS`) | Expand toggle only (reports have no row actions) |

- The order of records in the queue is never changed. Column preferences affect presentation only.
- Pinning is limited to one column, which always renders first. Where there is a selection checkbox, that column is sticky at `left:0` and the pinned column is offset by the fixed select width, so they cannot overlap. Below 900px wide (which includes 150% zoom), sticky positioning is turned off.
- Row expansion lists hidden data columns only. Row actions are never repeated there.

## Saved view safety

- Only allowlisted keys are saved, and values must match `SAFE_VALUE` (IDs, statuses, ISO dates, sort keys, numbers; no spaces; 80 characters max). Search text, page number and free text are never stored.
- Column snapshots are checked against the columns the user is currently allowed to see. Views saved before snapshots existed have none and still load, keeping the current layout.
- The view name input uses `useId`, announces a successful save through a live region, and warns users not to enter patient details.

## Navigation

| Feature | Status |
|---|---|
| Sidebar favorites and recent pages (shared store with WorkspaceSearch) | Done |
| Profile menu with permitted quick actions and sign out | Done |
| Search suggestions and page-only navigation history (no search terms stored) | Done |
| Bulk check-in | Blocked. `assertIndividualCheckIn` raises an explicit error, and the UI states that check-in is individual only |

## Accessibility and responsive audit

- Touch targets: 32px on desktop, 44px on mobile or touch screens (`pointer:coarse` or width up to 767px).
- Visible focus rings on the new controls. Reduced-motion support is respected.
- Below 900px: forms drop to one column, form footers wrap and stay at the bottom, and filter and row actions wrap. Long text in table cells wraps.
- Field-level fixes:
  - The staff Edit button now has a specific label naming the staff member.
  - The check-in scan mode buttons have a button type and report their pressed state.
  - The camera preview has an accessible label.
  - A source scan found no unlabeled form inputs; every input sits inside a `<label>` or has an `aria-label`.

## Verification

- TypeScript passes; the full frontend run passed 263 tests. After the shared drawer focus fix and mobile CSS corrections, 23 focused tests passed, including a new opener-focus regression contract.
- Fixture-based browser checks exercised column visibility/order/single pin, hidden-data expansion, saved-view apply/delete/reload and tab/table isolation.
- Sidebar and search favorites stayed synchronized; profile quick navigation and outside dismissal worked.
- Controlled drawers now capture and restore their opener on close. Reports Columns and WorkspaceSearch Escape behavior were verified.
- Queue column settings do not reorder records; selection exposes the individual-only check-in notice and no bulk check-in action.
- Narrow viewport checks at 390 and 683px found no page-level horizontal overflow. The table may scroll inside its container. Magnification was checked with a 1.5 visual scale and a separate reduced CSS viewport; native browser zoom shortcuts did not alter browser zoom.
- Final targeted checks confirmed queue toolbar controls and header/body selection targets at 44px or greater at both widths. Stacked cards no longer render a vertical SELECT pseudo-label.
- All browser API traffic was fictional/intercepted. No live writes occurred. Real logout persistence and report-row expansion were not verified in this pass (the report fixture was empty). This is not a claim that every form state or live authorization path was browser-tested.

## Performance

Table virtualization is not needed. Every listing uses the existing server pagination (at most 100 rows per page), so the number of rendered rows stays bounded.

## Requires backend (not built)

- Notification center.
- Workspace switching.
- Saved views synced across devices, or shared team-wide by role.
- Search over queue and report content.
- Patient timelines and documents.
