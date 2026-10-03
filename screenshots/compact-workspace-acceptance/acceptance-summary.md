# ClinicFlow compact workspace acceptance — partial run

**Run status: incomplete.** Browser fallback executions repeatedly exited with code `-1` before the script reached its final reporting block. The remote Playwright worker was also lost after a 45-second route-grid timeout. Do not treat this as full acceptance.

## Verified in the intercepted browser

- The acceptance script syntax-checks and intercepts `/api/**`; all records and mutation responses are fictional. No real API mutations, credentials, bookings, or messages were used.
- All 21 admin destinations, including Profile, were measured at 1440, 1024, and 390px: 63 route/viewport records in `layout-metrics.json`. On the completed grid run, each route had a visible workspace, no “Something went wrong” boundary, and no page-level horizontal overflow; Live queue rendered at all three widths.
- The populated appointments screen showed three intercepted appointments, the long patient name wrapped in its table cell, the status view was “All” (other visible statuses were Active, Waiting, Absent, Completed, Cancelled), and the compact header placed the update timestamp, export, and sort controls with the listing. Search suggestions were selected with ArrowDown/Enter and no-result suggestions were verified.
- The advanced filter drawer opened without shifting the table, Escape closed it, and focus returned to the toggle.
- The weekly schedule Copy opening hours drawer opened and closed without saving.
- Custom-role editing opened in a drawer and Escape reached its unsaved-changes guard.
- The integration test-email confirmation dialog appeared; it was closed without confirmation, and no test-email API request was issued.
- Template editing appeared with one “Email templates” heading. Settings, schedule, permissions, integrations, and templates were visually captured.
- Patient listing search returned a matching fictional row and a no-match empty state.
- Public/auth route screenshots were captured in a run, but two early generic-fixture mismatches (access-check and clinic slug resolution) prevent treating those views as fully verified.

## Not completed / verification gaps

- Role-isolated clinicAdmin, doctor, receptionist, and patient flows were not completed.
- Booking was only route-grid rendered; its three-step populated progression was not exercised.
- Admin setup wizard clean-start/dirty/busy behavior, role recovery/assignment drawers, nested-dropdown Escape, full reset/apply/close filter flows, delayed/error/retry/scope-change live search, Settings selectors/editors, custom-role Keep/Discard and busy state, and template draft persistence were not completed.
- The test did not verify real authorization, email delivery, booking creation, authentication, or database persistence; it deliberately used intercepted fixtures.
- `report.json` is from an earlier interrupted execution and is not the final run report. Use `layout-metrics.json` plus this summary for the completed observations; rerun the script in a stable browser worker for the remaining acceptance plan.