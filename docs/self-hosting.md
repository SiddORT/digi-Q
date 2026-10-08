# DigiQ self-hosting configuration

## Prerequisites

Use Node.js 22+, pnpm, PostgreSQL, HTTPS and a reverse proxy/static web server.
Replit Secrets is not required on your own server. This guide does not migrate or
publish anything automatically, and workspace tests do not certify your live server.

## Build and private bootstrap

On your own server, install the repository's dependencies with `pnpm install --frozen-lockfile`,
then run `pnpm build:selfhost`. This builds ClinicFlow at `/` and its API, not the deck or sandbox.

Privately copy `config/server.env.example` to `.env` at the repository root.
Give it owner-only permissions (`chmod 600 .env`) and fill the placeholders using your
server's secure editor. Never paste live values into chat, commit this file or put it
under the frontend's public directory. Environment variables already set by your
service manager take precedence over Node's `--env-file`.

Required: your existing `DATABASE_URL`, the correct session secret, public HTTPS origin,
server port and authentication mode. Preserve existing session/signing keys and mode;
changing them can invalidate sessions or break recovery tokens.

For a fresh database, configure `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME` and
`SUPERADMIN_PASSWORD` privately in the same file before the first start. Use a
bootstrap password of at least 12 characters, including letters and numbers.
There is no default account or password. Do not use the preview recovery secret
as a deployment setting. Once provisioned, the seed preserves existing
administrators and never rotates their passwords on restart.

For website integration editing, generate an independent random 32-byte key as 64 hex
characters using your server's cryptographic tooling (for example `openssl rand -hex 32`
in a private terminal), and store it as `INTEGRATIONS_ENCRYPTION_KEY`. Keep a separate,
access-controlled backup of this key. Database backups alone cannot recover credentials.
Do not reuse a database password, session secret or JWT key for encryption.

Optional: add the SMTP/Twilio keys from `config/integrations.env.example` to the same
private file when you want environment-managed integrations. Without these, a Super
Admin can supply supported provider credentials through the website after bootstrap.

## Database and service

The additive schema change is `lib/db/drizzle/0015_integration_credentials.sql`.
It creates only the dedicated encrypted-credential table. An operator must reconcile
and apply schema changes to the identified external database through the approved
migration process after backing it up. Do not blindly run all historical migrations
against an existing database. No startup DDL is included.

For Replit-managed production, use the Publish schema review instead; do not apply
this external-server procedure to it. Development schema changes do not establish
external production parity.

Run `pnpm start:selfhost` from the repository root under your process/service manager.
It always runs the idempotent superadmin seed before starting the API; a seed
failure prevents the API from starting. Schema migrations must already have
succeeded using the approved deployment process. This startup runs no migrations.
Alternatively keep the private file outside the repository:

    node --env-file=/etc/digiq/server.env lib/db/seed.mjs && exec node --env-file=/etc/digiq/server.env --enable-source-maps artifacts/api-server/dist/index.mjs

Serve `artifacts/clinicflow/dist/public` as the **only** static document root.
Use SPA fallback to `index.html` for frontend paths and reverse-proxy `/api/` to the API
port on the private interface. Do not strip `/api/` from requests. Terminate HTTPS,
restrict direct access to the backend port, and retain the app's trusted-proxy policy.
Never serve the repository root, configuration directory, source maps or `.env` files.

## Website workflow

1. Sign in using an already-provisioned active Super Admin account.
2. Open Settings → Integrations and choose Configure SMTP or Configure SMS.
3. Enter provider details; blank fields retain configured values.
4. Confirm your Super Admin password and save.
5. Check the displayed source and readiness status. Saving does not contact providers.
6. When ready, explicitly send an SMTP test. Provider acceptance is not inbox delivery.

Twilio now needs a direct auth token, even if an older deployment used a Replit connector.
There is no automatic extraction of connector credentials or automatic SMS test.

Website settings override environment settings for the selected provider only.
To return to environment management, select Use server environment instead, acknowledge
the warning and confirm your password. Restart after changing the server `.env`;
website-saved provider changes apply to new sends without restart.

## Release checks still required

Verify the actual target's schema, existing account/password readiness, HTTPS/cookies,
authenticated roles, provider delivery and backup restoration. Do not reset accounts,
switch auth modes or restore development data over live data as part of this setup.
The settings feature does not provision an initial administrator or bypass authentication.