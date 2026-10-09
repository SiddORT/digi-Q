# Schedule-to-booking verification

## Incident-specific uncertainty

No affected real doctor, location or booking date was supplied or safely identified. The original incident was **not reproduced** and its cause is **not established**. No live schedule or patient records were inspected, repaired or booked.

The editor reads persisted weekly sessions. Booking reads sessions for an exact doctor/location/date, with dated closures, timing changes and extra sessions applied. A different weekday or location can legitimately return no daily sessions; that does not prove that the weekly schedule is absent. Unsaved drafts and legitimate account/assignment/mode/time/capacity restrictions remain other possible explanations for the original report.

## Executed database evidence

`node --test artifacts/api-server/src/booking-discovery.integration.test.mjs` passes six cases using a private disposable multi-connection PostgreSQL cluster, checked-in migrations, actual routers, native sessions and the actual ticket allocator:

- Save by Super Admin, reopen by the owning Clinic Admin, matching-date availability without a reload; nonmatching weekday/location remain empty.
- Location-owned date/window metadata on empty dates, including UTC versus Pacific/Kiritimati midnight/year boundaries. Public response contains only timezone/today/window-end, not weekly configuration.
- Contextual management capability for Super Admin, owning Clinic Admin, assigned Doctor and Receptionist; rejection for patient, foreign Clinic Admin, anonymous callers and restricted administrator policies.
- Multiple sessions, dated closures and time overrides, inactive rows, extra dated sessions.
- Actual appointment creation and private ticket QR retrieval for all four permitted staff roles and the signed-in patient; guest receives an immediately issued ticket. A subsequent full-session attempt fails without over-allocation.

The embedded single-connection fixture was unsuitable for the nested schedule-write path; these tests therefore use the existing socket-only PostgreSQL cluster foundation. No changes were made to production database selection or schema.

## Other executed checks

- Seven date/search eligibility unit checks: calendar rollover and invalid dates; advance versus walk-in eligibility; opening/break restrictions; first eligible date; bounded 14-day/horizon requests; stale-search cancellation; failure propagation.
- Eight existing booking directory/privacy SQL regressions passed.
- API and frontend TypeScript checks passed; frontend production build passed.
- Both managed API and web workflows restarted successfully. Public application screenshot renders normally.

## Browser evidence

Rendered component regressions and isolated real-server role journeys are recorded separately under `screenshots/booking-discovery/`. HTTP-intercepted fixtures demonstrate component behavior but do not establish actual persistence, identity or ticket allocation. The acceptance server has its own temporary PostgreSQL cluster, fictional users and a fake mail transport. The patient uses a seeded native test session; this does not test patient code delivery/login.

The real controlled journey exposed a separate contextual-editor reopen defect: cached location query success did not establish a fresh post-open location read, so the editor's frozen authoring scope remained unhydrated and appeared empty. This was corrected by verifying related locations freshly and keeping a loading state until hydration completes. An open editor retains its verified target through background booking-membership refreshes; server write checks still use current permissions. This is **not established as the cause of the original reported missing booking slot**.

Executed rendered evidence:

- Eleven intercepted component cases passed, plus the focused cache-aware reopen regression (one case). These cover all six caller roles' empty-date discovery and explicit next-date review, lookup failure/retry, multiple-session selection, walk-in today-only UI, cancellation, bounded no-results, and guest review-before-confirmation.
- Real isolated browser identities were verified through same-origin `/api/me` for each staff role and the seeded patient. Super Admin reopened the saved Saturday session (2026-10-10); owning Clinic Admin, Doctor and Receptionist saved/reopened Sunday, Monday and Tuesday respectively (2026-10-11 through 2026-10-13). Each showed the persisted 10:00–12:00 session, matching-date refreshed availability and an immediately issued private ticket for its own fictional fixture patient.
- Receptionist walk-in mode forced 2026-10-09, disabled date changes and removed future search. No walk-in appointment was submitted.
- The seeded patient reviewed the explicit next-date result 2026-10-15 before confirming their own ticket. A signed-out QR guest reviewed 2026-10-10, left optional contacts blank, and received a Booked ticket immediately after review/consent. Neither had a management link.
- Staff next-date actions were verified with rendered HTTP fixtures rather than repeated in the narrowed real-server continuation. Incompatible-mode messages and break/open-time rules have unit evidence, not a separate real-browser mode-restriction test. No claim is made that patient code login or external notification delivery was tested.

## Contract maintained

- Advance search is explicit, observes real daily availability, stops at the first eligible date, checks at most fourteen subsequent dates within the booking horizon, and requires a separate review action before changing the date.
- Walk-in discovery remains today-only in the verified location timezone. It does not suggest future dates or appointment-only sessions.
- Failed/stale lookup, missing context/selection, empty daily result, incomplete capacity setup, full/unavailable session and incompatible booking mode are distinguishable. The booking server remains authoritative at confirmation.
- Management reuses the existing focused editor with verified saved scope and preserves the surrounding booking draft. It does not create guessed sessions or capacities.
- Confirmation still directly issues the ticket after Visit details → Patient details → Review/confirm. Session hours are not a promised exact consultation time.
