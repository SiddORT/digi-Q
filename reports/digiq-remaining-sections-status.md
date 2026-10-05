# DigiQ remaining-section implementation and verification status

Source: the 2026-10-05 testing report (135 findings). This is not the older 137-item authentication checklist.

## Changes made in this pass

- Registration timetable review now uses the selected time format instead of raw 24-hour values (#17).
- Weekly-session Copy to All selects every destination day, excluding the source; existing confirmation, per-session outcomes and duplicate/overlap handling remain (#97).
- Record search now classifies and sorts “today” using the location timezone, falling back to clinic and platform configuration. Added positive/negative timezone-boundary tests. This is a concrete date/filter correction, not proof that every report-filter complaint is resolved.

## Remaining areas reviewed

| Area | Findings to retain in acceptance testing | Workspace evidence / limitation |
|---|---|---|
| Schedules and availability | 15, 17–19, 24, 46–50, 52–54, 76, 82–85, 97, 103, 105, 107, 117, 125 | Existing weekly/copy-plan, date-filter, linked-schedule and session-context tests pass. Copy selection and review formatting corrected. Reproduce the exact reported session setups before closing these findings. |
| Patients and booking | 25–28, 51, 56–64, 68, 88, 90, 106, 121–123 | Existing frontend validation, booking and role-control tests pass; isolated patient activity, document and permission integration checks pass. The reported role-specific edit/delete denials still require the original identity and assignments. Do not weaken authorization to suppress a denial. |
| Appointments, details and tickets | 59–60, 72–75, 94, 96, 119, 127 | Existing frontend detail, export, range and presentation tests pass. Notes and recorded change reasons have detail views. This pass did not rerun real-browser PDF/print/download tests. |
| Queue operations | 69–71, 77–80, 86, 95 | All 20 isolated multi-connection contention tests pass, including check-in exclusivity, call-next and reschedule races. Existing queue-context frontend tests pass. Deployed latency and the exact reported queue states remain acceptance checks. |
| Reports, filters and search | 59, 85–86, 103, 124, 133 | Isolated scope/trend/search tests pass. Location-local “today” bug corrected and timezone-boundary coverage added. Screenshot-specific filters and grouping must still be checked against the reported data. |
| Notifications and email | 5, 25, 66, 118, 131 | Template, recipient, opt-out and ticket-mail tests pass with isolated/fake transports. Existing confirmation copy distinguishes provider acceptance from delivery. No real inbox delivery or deployment configuration has been verified. |
| Shared forms, dialogs and layout | 22, 27, 30–33, 36, 39, 42–43, 48–50, 55, 74, 78–79, 81, 108–113, 119, 124, 126, 128–130 | Shared frontend regression suite passes. Exact screenshot/viewport/interaction complaints are not closed by source or unit tests. No visual redesign was attempted without locating those states. |

## Checks performed

- 339 frontend tests passed; frontend and backend typechecks passed.
- 22 feature-policy/integration tests passed against disposable data.
- 20 PostgreSQL contention tests passed against a disposable cluster.
- 22 date-filter/email-template/notification-template tests passed.
- 3 ticket-email tests passed when run from their required repository-root working directory.
- No production data was changed, no real recipients were contacted, and nothing was published.

## Still open

Live email delivery, deployed performance, exact reported authorization/save failures, geographic-catalog coverage, and screenshot-specific interaction/layout reproduction. Earlier sections' unresolved items remain open too. Passing local regression tests is not a claim that all 135 findings have passed acceptance.
