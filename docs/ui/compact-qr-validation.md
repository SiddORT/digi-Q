# Compact appointment QR validation

## Scope and shared presentation

All existing **staff appointment validation** actions open one controlled
`AppDialog` over the current workspace. Its body is the same `ScannerCore` used
by printed `/check-in?payload=…` links. No new navigation item was added.
The dialog is capped at 480 CSS pixels; camera height is bounded at 120–240
pixels rather than a page-width square. The upload target has a compact minimum
height, not an aspect ratio. The shared dialog owns focus trapping, Escape,
scroll locking, one visible close control and internal overflow on short screens.
Closing unmounts scanner work; it does not navigate or rebuild the listing.

## Entry-point and role checklist

Source audit: `rg 'openQrInline|Validate.*QR|/check-in'` across application TS/TSX.
Browser evidence and limitations: [acceptance results](../verification/compact-qr-test-results.md).

| Existing entry | Super Admin | Clinic Admin | Doctor | Receptionist | Patient / anonymous |
|---|---|---|---|---|---|
| Queue **session** header → Validate QR | Same shared host | Same shared host | Same shared host | Same shared host | Not offered |
| Workspace search → Quick Actions → Validate Appointment QR | Same shared host | Same shared host | Same shared host | Same shared host | Not offered |
| Profile/account menu → Validate Appointment QR | Same shared host | Same shared host | Same shared host | Same shared host | Not offered |
| Existing ticket link `/check-in?payload=…` | Shared scanner | Shared scanner | Shared scanner | Shared scanner | Staff-only notice / sign-in redirect |

The queue overview lists sessions; users must open a session before its
validation action exists. The source audit found **no additional validator in
main navigation, row overflow or More Actions**. The search “More” control changes
search categories, not QR validation. Booking QR actions and the public
`/scan-qr` booking scanner are separate functions and are unchanged.

## Outcome and mutation contract

- Camera, Image File and Paste Code normalize input locally, then submit the
  opaque signed payload to the existing server resolver. Links are never followed;
  existing current/canonical-origin and path checks remain in effect.
- An eligible server result announces **QR verified** in a status region with a
  check icon and readable text. It shows patient, doctor, location, token, visit
  date and session; the icon is decorative, not the sole success signal.
- A queue-blocked ticket or started consultation instead says **Ticket recognized
  — check-in unavailable** and retains the server explanation. It does not offer
  an enabled check-in action or claim a new successful check-in.
- Invalid/tampered, missing, inaccessible, unauthenticated, date/status-restricted
  and technical failures say **QR not verified** with a safe explanation. Retry
  verification and Scan Another remain available. Expired sessions get a staff
  sign-in link retaining the code.
- Validation does not write. Only **Check In — Enter Consultation** invokes the
  existing check-in mutation. Pending state locks repeat actions and dialog
  dismissal; failure is explicit and retry-safe. Existing transactional queue
  locks, fresh-state checks, date/status/authorization restrictions, and
  already-started idempotency remain unchanged.

## Lifecycle fixes

Rejected unrelated camera links now continue scanning rather than stopping the
detection loop. Native detector construction, synchronous throws and asynchronous
failure can fall back to jsQR. Camera startup/detection callbacks use live
cancellation state; cleanup cancels animation frames, stops every track and
detaches the preview. Canonical-origin loading refreshes camera parsing context.

Image selections have their own generation, progress indication and URL/handler
cleanup. Changing modes, choosing another file, reset and unmount discard stale
image results. Server resolution also has a generation guard; closing/reopening
cannot display a prior ticket's delayed response.

Quick actions that disappear with a menu/search dialog restore focus to the
stable profile/search launcher instead of an unmounted action.

## Repeatable checks

`pnpm test:qr-validation` starts a loopback-only acceptance server with a
disposable migrated PostgreSQL cluster. Fictional staff use normal password
sign-in and verify `/api/me`; no identity-header bypass is used. Its API checks
exercise real signed/tampered/unknown codes, staff scope, patient/anonymous
denial, date/terminal/queue restrictions, read-only snapshots and explicit
idempotent consultation check-in. A normally created booking supplies a real
server-issued ticket. Synthetic state cases preserve saved appointment snapshots.

Camera permission and native detector failure scenarios are labelled browser
simulations. Actual PNG pixels and synthetic video frames are decoded by jsQR;
these are not evidence of physical phone optics, permission prompts or native
BarcodeDetector support. Responsive Chromium evidence is separate from native
tab zoom and device evidence; see the acceptance report for what was run.

Generated images/traces live under ignored `generated-artifacts/qr-validation/`.
The tracked report preserves results without credentials or bearer codes.
