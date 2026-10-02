# DigiQ prompt completion — point-by-point progress

This tracks the remaining requirements in `attached_assets/DigiQ_Replit_Prompt_v3_1790958493686.md`, including its cross-cutting sections, not just its 107 numbered findings. The earlier register's “zero local pending” did not establish full prompt compliance.

## Current implementation pass

| Point | Requirement | Status |
|---|---|---|
| 1 | Doctor Monday–Sunday editor: toggles, multiple sessions, exact times, copy and safe saves | Implemented and fixture-browser verified: seven days, >4 soft warning, exact 08:32, selected-day copy, failed-draft retention and retry without duplicate creates; linked Details escape fixed with regression guard |
| 2 | Remaining searchable dropdowns | Nine callers and resource sorting converted; focused caller tests pass; not every popup browser-certified |
| 3 | Patient secondary fields under More details | Implemented and fixture-browser verified; edit auto-opens populated details and collapsed invalid phone reopens/focuses with no POST |
| 4 | Account registration progress and review/edit before requesting a code | Implemented; three source-contract checks and fixture-browser review/edit/send/error/back/mobile checks pass; no real email sent |
| 5 | Explicit visual tokens and typography | Main workspace CSS implemented; six static contracts pass; printed ticket/QR geometry excluded; other component-specific styles and full visual acceptance not certified |
| 6 | Listing coverage and filtered exports | Patient/appointment filtered exports, supported report/assigned-clinic sorting, queue chips/reset/empty search and public-directory server search/sort/pagination implemented; see remaining boundaries below |
| 7 | Verification and current report | Root typecheck passed; initial 43 focused frontend tests and two isolated public-directory SQL tests passed; final patient/schedule/export/submission suite 21/21 and UI typecheck passed; CSS suite 7/7 passed. Registration, weekly editor and patient fixture-browser checks pass. Full all-findings acceptance remains pending; no tests/workers remain running. |

## Browser evidence for this pass

- Registration: details → review does not send a request; normalized identity is shown without the password; Edit preserves draft values; one fake send starts verification; error/back clears challenge state and requires password re-entry. Heading focus and 390px reflow passed.
- Doctor weekly editor: all seven days, five sessions with a soft warning, exact 08:32, copy that preserves linked records, inline overlap feedback and keyboard day toggling passed. Failed update/create plus one successful create retained unsaved work; retry created only the remaining record. Two PATCH attempts and three POST attempts yielded exactly two created fixture records, without duplicates.
- The first weekly browser check found a linked-row Details route to an editable generic dialog. The weekly entry point was removed/guarded for linked active and closed records; dedicated regression tests passed. Existing server refusal of linked writes remains.
- At 390×844 both registration and weekly editor measured document width 375px: no document horizontal overflow.
- All browser identities, data and mutations were intercepted fictional responses. These checks prove UI behavior against fixtures, not live authorization, durable server writes, real email or authenticated UAT.
- Patient browser testing found collapsed secondary controls could skip validation. Fields now remain mounted and a pre-submit validator blocks invalid retained values. Retest confirmed the dialog stays open, More details expands, invalid phone is focused and the POST count does not increase.
- Patient edit auto-opens populated secondary values. Keyboard search/selection of page size 50 updates the request and URL. A filtered two-page CSV contains only matching patient-facing fields with formatted dates; a failed second page yields an error and no download.
- Schedule-table Capacity overlap was repaired with a narrowly scoped wrapping rule; seven CSS contracts pass. The repair has not received a separate rendered recheck.
- Reported test groups overlap; their totals must not be added together. No clean rerun of the entire historical 333-test suite is claimed in this pass.

## Remaining listing/acceptance boundaries

- Doctor-network server sorting is now implemented for name and creation date in both directions, with stable scoped ordering and page-reset behavior.
- Report composite Outcomes and Other sorting is now implemented after the same filtering/grouping as the displayed counts, with stable group-key tie-breaks. Outcomes compares cancelled, no-show and residual Other in displayed order.
- Patient and appointment CSV exports fetch authorized pages, detect incomplete/changing counts or duplicate traversal and abort on failures. They do not guarantee a point-in-time snapshot if records change without their IDs/count changing.
- Dashboard bounded previews, operational feeds, public queues and embedded summaries are not all-purpose listings. No private/public access expansion was introduced to impose blanket listing controls.
- Full literal compliance across all component CSS, all listing contexts and all browser callers remains uncertified; scoped fixes must not be relabeled complete global acceptance.

## Latest acceptance continuation

- Sorting implementation: 22 targeted API tests passed; six existing report-outcome UI tests passed; regenerated API contracts and API/UI typechecks passed. Report grouping now uses PostgreSQL-safe grouping expressions.
- Main verification: project-wide typecheck passed; final frontend suite passed 185/185 with UI typecheck clean, including public navigation and toolbar-overflow regression checks. Overlapping test groups are not summed.
- Public directory fixture-browser checks passed: server search/sort/page/pageSize request wiring, debounce, page reset, URL reload preservation, empty-state Clear search, doctor sorting, keyboard searchable controls and visible focus. Layouts at 1024px and 390px had no document overflow.
- That browser pass found Choose another clinic lost booking mode. The link now preserves book/display mode while leaving doctor-directory filters behind. Its regression test covers both modes and ordinary browsing.
- Public fixtures did not perform booking submission. Accessible names were inspected, but neither a real screen reader nor genuine browser 200% zoom was exercised.
- Appointment browser checks passed: active filters survived sorting, a two-page export downloaded 150 matching records, and failed-page/cancelled exports produced no file.
- Report browser checks passed: Outcomes and Other in both directions preserved search/grouping/dates; accessible header sort state, filtered CSV and Escape/focus return worked.
- Queue search/status/token sorting passed. Mobile checking found the status strip widened the document to 524px; its flex bounds were fixed. Retest measured document width 375px at a 390px viewport, and the final tab was reachable by internal strip scrolling.
- Clinic Groups and locations rendered as compact tables at 1024px and contained cards at 390px, without document overflow. The location Add label's singularization typo was also corrected.
- Doctor-network sorting passed in a separate fictional doctor context: name descending, created ascending and created descending generated the correct assignment-options requests and displayed matching fixture order.
- No workers remain running. These checks cover the changed journeys, not formal sign-off of every original finding, every component style or every role's accessibility matrix.

## Separate boundaries

- Live email/inbox checks, original deployed incident attribution, deployed performance and actual-target account/recovery readiness remain unverified.
- The full all-role keyboard, screen-reader and actual browser-zoom acceptance matrix is not certified by existing scoped fixture checks.
- Consent/family booking, after-hours powers, cross-clinic policy changes, new numerical limits, permanent deletion and other Q/P extensions remain approval-held.
- Four sessions per day is a proposed soft warning only, not an approved hard limit.
- Existing dated doctor exceptions are already supported. New authority to exceed clinic opening hours is not implied by that support.
- No account/password/permission/schema changes, real email sends or publishing are authorized by this progress record.