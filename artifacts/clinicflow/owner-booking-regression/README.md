# Owner booking regression (real Preview / isolated harness)

This is one opt-in Playwright end-to-end regression for the self-registration
and Super Admin invitation journeys. It uses the real ClinicFlow UI and API.
It deliberately does **not** intercept `/api`, stub identities/directories, or
write ownership through the database. The only direct API reads are:

- `GET /api/__owner-booking-evidence` for simulated email codes/links and
  persisted-record reconciliation.
- `GET /api/me` and the clinic/branch/status-scoped `GET /api/doctors` to
  verify the current owner's actual profile and directory.

Run against the isolated disposable PostgreSQL/API harness and its real Preview
origin only. Start with a fresh/reset harness because the spec uses the fixed
fictional addresses `browser-self@owner.test.invalid` and
`browser-admin@owner.test.invalid`.

```sh
cd artifacts/clinicflow
OWNER_BOOKING_BASE_URL=https://<preview-host> \
  pnpm exec playwright test \
  --config owner-booking-regression/playwright.config.ts
```

Optional overrides:

- `OWNER_BOOKING_PASSWORD` (default: `Fictional-Owner!2026`)
- `OWNER_BOOKING_SUPER_EMAIL` (default: `super@owner.test.invalid`)
- `OWNER_BOOKING_SUPER_PASSWORD` (default: `Fictional-Owner!2026`)

Without `OWNER_BOOKING_BASE_URL` the test is skipped; the config does not start
or replace any application workflow. The fixture database/mail harness must
already be running. Screenshots and traces are written to the ignored
`generated-artifacts/owner-booking-regression` directory at the workspace root.

The initial real-Preview browser pass completed both journeys manually. The
saved spec was discovered and typechecked, but was not executed end-to-end in
that pass. It now requires Open Workspace to finish without hard-navigation
fallback, protecting the related self-registration access-status correction.

## Recovered-owner viewport acceptance

`owner-recovery.spec.ts` additionally covers explicit recovery of a fictional
owner's missing profile, persistence and fresh sign-in as owner and Super Admin.
It creates an eligible session through the real authenticated schedule API after
recovery, then exercises enabled Continue through to patient details at
1024×640, 1366×768 and 390×844. It does not submit an appointment.

At each size it checks page width, reachable controls, adjacent help positioning,
keyboard focus, Escape, touch opening/outside dismissal, and doctor-directory
pending → failure → successful retry. Only this spec intercepts doctor-directory
reads, temporarily, to make those transient states deterministic; successful
retries resume real API reads. All other requests use the real fixture API.
The directory's picker and assignment-readiness errors are retried separately.

Run this spec alone against a **fresh disposable fixture**:

```sh
# Workspace root: explicitly opt in, then restart the managed API workflow.
touch .local/owner-booking-browser-fixture
OWNER_BOOKING_BASE_URL="https://$REPLIT_DEV_DOMAIN" \
  pnpm exec playwright test \
  --config artifacts/clinicflow/owner-booking-regression/playwright.config.ts \
  owner-recovery.spec.ts
# Always remove the marker and restart the managed API workflow afterward.
rm .local/owner-booking-browser-fixture
```

The API workflow is `artifacts/api-server: API Server`. Restart it between
attempts: even a failed test may already have committed the fictional recovery.
Never point this test at UAT or live bookings. The fixture uses disposable
PostgreSQL, simulated mail and blocked outbound delivery. The saved recovery
spec has been executed successfully across all three viewports.
