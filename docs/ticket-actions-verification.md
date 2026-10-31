# Shared ticket actions verification

## Delivered behavior

- Appointments rows, their expanded Booking tabs and off-page linked details
  reuse one `TicketActionsScope` and one dialog/error host. Standalone Details
  and Booking consumers explicitly acquire a local scope only when there is no
  enclosing owner. Scope and actor changes replace that owner.
- The ordered action definitions supply Download Ticket, Print Ticket, Email
  Ticket, SMS Booking Status Link, Get Directions and Open Live Ticket to both
  entry points, including the same availability rules and disabled explanations.
  The separate directions/live controls are not duplicated in the Booking tab.
- Closing an accordion or unmounting Booking does not destroy its email/SMS
  confirmation, results, click lock or request identity. Authorization failures
  from the private appointment observer suppress dialogs immediately. Late send
  responses are ignored after scope changes and cannot update another booking.
- Existing email acceptance/partial-result behavior is preserved. SMS now uses
  the same compact success presentation, green tick, focused high-contrast OK
  action and guarded close. Only explicit acceptance is successful. Unknown or
  malformed outcomes remain uncertain; checks reuse the original request ID.
  Recipient previews, server-authoritative recipients, explicit sending, rate
  limits and durable duplicate-send prevention are unchanged.
- Directions uses the shared Google Maps helper and the saved booked-branch
  address only. Directions and live tickets open separate tabs with no opener
  and no-referrer metadata. Popup/offline failures are friendly. Live issuance
  uses direct, uncached API calls and aborts/closes a pending tab when its scope
  disappears. Existing read-only capabilities and 30-second polling remain.
- The shared server estimate is patients ahead × saved per-patient duration,
  counting a called/in-consultation patient ahead in full. It never subtracts
  elapsed consultation time. Assigned token, patients ahead and approximate
  wait are distinct in the Booking view, ticket facts and emailed PDF.
  Saved breaks affect suggested arrival separately, not the displayed wait.
  Pre-session context, closing warnings, ready/called guidance and suppression
  for paused, terminal, unavailable, ended and stale states are retained.

## Checks performed

All UI messaging/API traffic was intercepted with fictional data. Backend
integration checks use isolated PostgreSQL clusters or mocked transports.
No real messages, agent-created patient bookings, delivery-configuration edits,
production data changes or deployment were performed.

- `pnpm typecheck:libs` and both ClinicFlow/API-server typechecks passed.
- The existing ticket-email browser cases passed on desktop and phone (48
  cases), including all permitted staff roles, denied patient sending, partial
  bulk results, missing recipients, unknown outcomes, repeated clicks, stable
  request IDs, OK contrast, focus and dismissal.
- The new `ticket-actions.spec.ts` cases passed on desktop and phone (30
  cases across the complete run and focused added-case run). These cover six
  matching controls, missing-address explanations, selected booking, standalone
  Booking, one shared dialog, tab/accordion lifecycle, authorization loss,
  late responses across replacement views, SMS acceptance/failure/unknown/
  ineligibility/offline states, same-request recovery, popup failures, new tabs,
  no opener, green tick, OK contrast and keyboard completion.
- The existing ticket/detail/Booking/live-ticket browser selection ran 109
  cases. Its 13 initial failures were old four-action/SMS assertions, an old
  error-host location, a direct-URL popup stub and changed PDF references.
  Those assertions/stubs were updated for the approved behavior. All 13 affected
  cases then passed focused reruns; the other 96 passed the original run.
- Bulk PDF references were inspected and refreshed for the renamed approximate
  wait and explicit session-start context. All three fictional tickets still
  retain their own identity, token and QR, readable text and safe live/map links.
  Existing QR decoding, mismatch rejection and all-or-nothing bulk checks remain.
- `pnpm test:live-tickets` passed, including the arrival-estimate cases and
  live-ticket/receipt privacy checks on PostgreSQL 15 and 16. Count cases verify
  3 → 2 ahead at 30 minutes gives 90 → 60, active-patient counting, elapsed-time
  invariance, session/break/closing boundaries and missing duration.
- The 8 focused backend SMS cases passed, including real PostgreSQL contention,
  recipient/permission checks and durable no-redispatch behavior.
- The focused backend email fixture initially failed to bundle because its
  old live-ticket dependency mock was missing. The fixture now isolates link
  issuance and supplies the current safe estimate projection; all 3 email cases
  passed, including actual PDF creation without sending and uncertain-claim
  duplicate protection. No email provider or policy implementation was changed.
- Both managed services restarted successfully; the frontend and server logs
  showed successful startup. The public app screenshot rendered without errors.
  Changed private dialogs/layouts were checked with intercepted browser fixtures,
  not by sending messages from a live signed-in account.
- The completion validation's full `pnpm test:tickets` run passed all 165 cases.
  Queue contention, appointment movement, communication usage, appointment detail
  compatibility, migrations and code review also passed. The live-ticket check
  initially retained the old emailed-PDF wait label; its text assertion now checks
  the explicit patients-ahead value and approximate-wait/session-start wording
  instead, preserving the private-field exclusion assertions.

## Render evidence

Inspected ignored local screenshots:

- `generated-artifacts/ticket-actions/sms-mobile.png`
- `generated-artifacts/ticket-email/accepted-mobile.png`
- Bulk PDF raster reference for the ticket with three patients ahead
- `generated-artifacts/ticket-actions/app-home.jpg`

The success dialogs show only a concise result, a green tick and a legible OK
button. Real Safari/Firefox popup policies and physical-device behavior are not
claimed by these Chromium desktop/phone-layout checks.
