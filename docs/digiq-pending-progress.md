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

- Doctor network directory remains fixed to server name ordering: its assignment-options endpoint does not expose arbitrary sort parameters.
- Composite report Outcomes/Other headers lack a server aggregate-sort field; supported individual outcomes remain sortable.
- Patient and appointment CSV exports fetch authorized pages, detect incomplete/changing counts or duplicate traversal and abort on failures. They do not guarantee a point-in-time snapshot if records change without their IDs/count changing.
- Dashboard bounded previews, operational feeds, public queues and embedded summaries are not all-purpose listings. No private/public access expansion was introduced to impose blanket listing controls.
- Full literal compliance across all component CSS, all listing contexts and all browser callers remains uncertified; scoped fixes must not be relabeled complete global acceptance.

## Separate boundaries

- Live email/inbox checks, original deployed incident attribution, deployed performance and actual-target account/recovery readiness remain unverified.
- The full all-role keyboard, screen-reader and actual browser-zoom acceptance matrix is not certified by existing scoped fixture checks.
- Consent/family booking, after-hours powers, cross-clinic policy changes, new numerical limits, permanent deletion and other Q/P extensions remain approval-held.
- Four sessions per day is a proposed soft warning only, not an approved hard limit.
- Existing dated doctor exceptions are already supported. New authority to exceed clinic opening hours is not implied by that support.
- No account/password/permission/schema changes, real email sends or publishing are authorized by this progress record.