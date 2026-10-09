# Public QR booking regression evidence

## Evidence boundary

The browser checks render the actual App routes, native-auth provider,
PublicBooking and shared booking/schedule components. Every API response is
intercepted with fictional fixtures. This proves rendered route intent and
request behavior, not real staff authentication, database persistence or live
UAT acceptance. No supplied live clinic was changed and nothing was deployed.

## Checks

- Valid clinic and location QR resolution for anonymous, patient, Doctor,
  Clinic Admin, receptionist and Super Admin sessions.
- Staff schedule capability deliberately returns `allowed: true`; direct QR
  entry, reload, availability refresh, next-date review, stage changes and
  confirmation contain no schedule control, doctor-profile action or editor.
- Public QR journeys make no schedule-access, schedule or exception requests.
  Ordinary booking availability requests and ticket issuance continue.
- Location QR journeys issue exactly one fictional ticket for each role at
  390px and 1366px, without logout or horizontal overflow.
- Client-side navigation from an open workspace schedule dialog to public QR
  unmounts the editor. Crossing its 30-second polling interval makes no further
  management request. Returning to the workspace requires explicitly reopening
  the dialog. All four staff roles are covered.
- A denied capability keeps internal schedule management unavailable.
- Existing staff schedule-editor checks retain save, reopen, validation,
  discard, pending-save and responsive-layout behavior.

## Commands and results

`pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/playwright.config.ts booking-discovery.spec.ts availability-editor.spec.ts`

59 cases: 56 initially passed; three patient QR tests needed their normal
explicit location/doctor selection added to the fixture.

`pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/playwright.config.ts booking-discovery.spec.ts --grep 'QR patient|workspace dialog'`

7 passed, including the three corrected patient cases.

`pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/playwright.config.ts booking-discovery.spec.ts --grep 'workspace dialog'`

4 passed after adding the polling-interval assertion.

`pnpm run typecheck:libs && pnpm --filter @workspace/clinicflow typecheck`

Passed. Building shared declarations resolved stale generated API types.

The development frontend and API workflows started cleanly. The supplied UAT
reference returns 404 in the development database, so it is not claimed as a
successful real-context reproduction. Valid QR resolution is covered by the
fictional route fixtures above.
