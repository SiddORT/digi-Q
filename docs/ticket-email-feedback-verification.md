# Ticket email feedback verification

## Scope and behavior

- Appointment More actions and expanded Booking Ticket & QR both use
  `useAppointmentTicketActions`, which opens `TicketEmailDialog`.
- Bulk Email Tickets uses the same dialog. No role checks or server code changed.
  The server permits Superadmin, Clinic Admin, Doctor and Receptionist; patients
  and out-of-scope requests remain denied.
- Only explicit `provider_accepted` responses qualify for success. Complete
  single/bulk success replaces recipients/results with the requested short alert.
  Missing/malformed result states are treated as uncertain, never as success.
- Partial results retain only affected tickets. Existing recipient confirmation,
  server PDF generation, request IDs, click locks and manual same-request recovery
  remain. OK only closes the dialog.
- The former standalone Done button matched the shared sticky-footer rule
  `.app-dialog-body > .button:last-child`, giving it a white background while its
  primary text stayed white. Completion now uses `FormActions` inside the existing
  `AppDialogActions` footer instead of changing application-wide CSS.

## Automated checks

Focused browser suite:

```sh
pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/ticket-email.config.ts
```

The final suite contains 50 desktop/phone cases covering:

- Real row More, Booking Ticket & QR, and bulk entry points for all four permitted
  staff role contexts; explicit mocked denial for patients on all three entry points.
- Recipient confirmation before any request; accepted single/bulk outcomes;
  unknown, invalid, absent, failed and conflicting responses; missing recipients;
  recipient-preview retry; mixed bulk outcomes and affected-only feedback.
- Repeated-click protection, no success before response acceptance, Escape blocked
  during sending, same request ID recovery without resending accepted rows, OK
  focus, keyboard dismissal and launcher-focus restoration.
- No technical summaries, visible OK within desktop/phone bounds and at least
  4.5:1 settled foreground/background contrast.

The initial 50-case run passed 46 checks; four sampled the shared 180 ms button
color transition. The contrast helper now waits for settled computed contrast
without lowering its threshold, and those four cases passed a focused rerun.
Positive patient fixture permutations were then replaced with explicit denial
coverage to match the server's actual role contract; all six new desktop/phone
denial cases passed a targeted run.
All API calls in this suite are intercepted, with fictional `.invalid` addresses.
No real accounts or email transports were used.

Screenshots inspected:

- `generated-artifacts/ticket-email/accepted-desktop.png`
- `generated-artifacts/ticket-email/accepted-mobile.png`

Both show the requested concise alert and a readable branded OK button.
Generated evidence is intentionally ignored by Git.

Other checks:

- `pnpm typecheck:libs` — passed.
- `pnpm --filter @workspace/clinicflow typecheck` — passed after the library build.
- Focused `bulk toolbar` and `shared FormActions adopted` source regressions —
  passed.
- Full `refinement.test.mjs` / `section-a-consistency.test.mjs` include unrelated
  pre-existing source-shape assertions that do not match current appointment
  column and guidance/layout markup. Those assertions were not broadened or hidden.
- Existing backend `ticket-email.test.mjs` cannot currently bundle because its
  older fake database/store modules omit exports now required by transitive
  appointment/availability dependencies. No server implementation was changed to
  work around that unrelated harness failure.
- Managed frontend restarted successfully; public page screenshot rendered.
  Live API calls on that page were unavailable because the backend workflow was
  not running. Changed-dialog verification used the isolated intercepted browser
  fixtures, not live delivery.
