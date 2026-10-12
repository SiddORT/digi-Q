# Hybrid integration configuration

Database, session/signing secrets and the integration encryption master key belong in private server environment variables or a private `.env` file. `config/server.env.example` is the bootstrap checklist; `config/integrations.env.example` lists optional provider environment values. Never commit populated copies, serve them over HTTP or prefix credentials with `VITE_`.

Super Admin → Settings → Integrations supports encrypted SMTP and direct Twilio credential editing. The server requires `INTEGRATIONS_ENCRYPTION_KEY`: exactly 64 hexadecimal characters representing 32 cryptographically random bytes. Generate and store it privately on the server, separate from the database. Existing environment-configured delivery works without this key if no website configuration has been saved.

Each provider independently uses either the encrypted database record or the server environment. A saved record is a complete provider configuration; environment changes do not silently override it. Blank website fields preserve the selected configuration's existing value. The first save can inherit environment values. Selecting **Use server environment instead** deletes that provider's saved record after explicit confirmation and password verification; incomplete environment configuration will disable delivery. The site never rewrites `.env`.

AES-256-GCM encrypts provider records with fresh nonces, authenticated provider identity and an envelope version. Store the master key in a secure backup: losing or casually replacing it makes existing records unreadable. Do not rotate it without an explicit decrypt/re-encrypt migration. Corrupt records or a wrong key fail closed; no silent credential fallback occurs.

Changes require an active Super Admin session, existing CSRF protection, password re-verification, rate limits and a matching revision. Audit records contain only actor, provider, changed field names and chosen source—never values. No values or ciphertext are returned in the settings response. Mutations are transactional with their audit record.

## SMTP

Required: `SMTP_HOST`, `SMTP_PORT` (1–65535), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` (one address, optionally `DigiQ Doctors <address>`). Use the provider's verified sender. Port 465 defaults to implicit TLS; other ports require STARTTLS. Optional `SMTP_SECURE=true|false` overrides implicit TLS selection. Optional `SMTP_REQUIRE_TLS=true` documents the mandatory STARTTLS policy; `false` is rejected. Certificate validation is not bypassed. Transport timeouts bound connection and socket waits.

Restart through your normal operations process after changing environment configuration. Website changes apply to new sends without restart and across server instances; saving never sends a test. Ordinary password login does not require SMTP. Invitations, recovery, and email challenges still require it. The existing `smtpConfig` export and injectable auth email transport remain available.

## SMS and authentication

### Keep in Touch notification SMS preset

In **Communication Settings → SMS**, deliberately select **Keep in Touch**.
This affects optional notification SMS only, never Twilio OTP or security messages.
The preset uses the supplied endpoint:

`https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS`

Configure these write-only fields through the encrypted website editor, or privately
through server environment settings:

| Setting | Purpose |
| --- | --- |
| `NOTIFICATION_SMS_PROVIDER=keepInTouch` | Explicit provider selection; absent means the existing generic transport |
| `NOTIFICATION_SMS_BEARER_TOKEN` | `Authorization: Bearer <token>` |
| `NOTIFICATION_SMS_KEY` | Body `apiKey`; distinct from the Bearer token |
| `NOTIFICATION_SMS_CLIENT_ID` | Required body `clientId` |
| `NOTIFICATION_SMS_SENDER_ID` | Required default `senderId`; an event's Sender ID may override it |
| `NOTIFICATION_SMS_COUNTRY_CODE_FORMAT` | Required explicit choice: `digits` or `plus` |

No actual credentials were supplied. Do not assume the Bearer token and API key
are identical. Never put either in mapping static fields, URLs, documentation,
tests, screenshots or chat. Website saves require the server's existing
`INTEGRATIONS_ENCRYPTION_KEY`, current Super Admin password and current revision.
Blank protected fields preserve their previous value. Reads and readiness return
only presence/validity, not protected values; database settings are AES-256-GCM
encrypted, and audits contain field names only. Environment values are resolved
server-side and stay write-only in the settings response.

The preset always sends POST with `Content-Type: application/json` and exactly
seven **string** body fields: `countryCode`, `mobile`, `senderId`, `message`,
`apiKey`, `clientId`, `templateId`. The validated E.164 recipient is split using
phone-number metadata, not a guessed prefix: `+919876543210` becomes country code
`91` (or `+91`) and mobile `9876543210`. National leading zeros are preserved,
including Italian numbers. There is no DLT Entity ID requirement or entity field
on this wire contract. The selected event/recipient template's existing **DLT
Template ID** supplies `templateId` and is required for activation and sending.

**Unverified provider detail:** the supplied example used generic string
placeholders and did not establish whether `countryCode` includes `+`. The app
requires a bounded explicit `digits`/`plus` choice. Confirm it with the provider
before an authorized real test. The app never probes both formats, falls back to
another provider, or automatically resends an uncertain dispatch.

The preset's allowed successful HTTP status is **200**, with JSON boolean
`success: true`. Boolean `false` is rejection. Missing, nonboolean or malformed
`success`, unexpected successful statuses, server errors and uncertain network
outcomes are not successful delivery. Human `message` text is neither an
acceptance rule nor a raw diagnostic returned to administrators. HTTPS,
public-destination validation, DNS pinning, no redirects, request/response size
bounds and timeouts remain shared with the generic sender.

Saving or testing is **not activation**: event controls and the clinic notification
gate still apply. Existing generic mapping and URL values are retained until
explicitly edited; switching the preset does not rewrite them, enable events,
activate clinics or replay old jobs. Provider acceptance is not handset delivery.
Development verification uses disposable databases, fictional credentials and
fake transports only. Live sending, provider/DLT approval and deployment are
separate, explicitly authorized operational steps.

SMS delivery uses Twilio's direct HTTPS API, not a Replit connector. Required environment values: `OTP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_AUTH_TOKEN`. Website saves select Twilio automatically. Migrating an older connector-only installation requires adding its Twilio auth token privately; no credential is exported from a connector. Readiness does not verify provider permissions or delivery. `OTP_PROVIDER=development` works only from the environment with `NODE_ENV=development`, never from website settings. No SMS test is sent by this feature.

The template uses `AUTH_SESSION_MODE=native`, preserving existing opaque-cookie continuity. To enable app-issued JWT sessions, first configure a dedicated high-entropy `JWT_SIGNING_KEY` of at least 32 UTF-8 bytes through the private server secret store, then explicitly set `AUTH_SESSION_MODE=jwt`. Do not reuse another integration's credential as the signing key. Misconfigured session issuance can return HTTP 503 with `AUTH_SESSION_UNCONFIGURED`. Switching modes invalidates existing cookies and requires users to sign in again.

Both modes use database-revocable cookies with a **fixed 12-hour lifetime**, `HttpOnly`, `Secure`, and `SameSite=Lax`. There is **no refresh endpoint**, no 15-minute access-token/refresh-token stage, and no promised automatic session renewal. New passwords require at least 8 characters including ASCII letters and numbers, with a maximum of 1024 UTF-8 bytes enforced by the server. Existing credential verification is not retroactively subjected to password-creation policy. JWT authentication remains owned by the authentication implementation; no signing key is exposed by these settings endpoints.

## Super Admin checks

The SMS, consolidated Email and Event controls settings are documented in
[`notification-settings.md`](notification-settings.md). Notification SMS uses a separate
encrypted `notificationSms` provider and declarative HTTP mapping; the original Twilio
configuration remains exclusively for account/mobile verification.

Platform settings contains a masked configuration editor, readiness panel and an explicit SMTP test form:

- `GET /api/settings/integrations`: authenticated active Super Admin only; returns known key names and configured/missing/invalid/default statuses, never values or addresses. Readiness checks syntax/presence, not connectivity.
- `PUT /api/settings/integrations`: same authorization, password confirmation and strict provider/field allowlist. Five edit attempts per actor and twenty per IP per fifteen minutes. Includes provider, desired source, current revision, currentPassword and changed values. A stale revision returns 409 without overwriting another administrator's change.
- `POST /api/settings/integrations/smtp/test-email`: same authorization; accepts only `{ "recipient": "operator@example.invalid" }`. Exactly one strictly validated address; caller cannot control sender, subject, body, headers, attachments, host, or credentials. Sends a fixed DigiQ Doctors message only on explicit submission.
- All endpoints use `Cache-Control: no-store`, including authorization failures. Errors do not include transport diagnostics, recipients, or credentials. SMTP failures are generic.
- A successful test means the SMTP provider **accepted** the message, not that it reached an inbox. Check the recipient's inbox/spam folder and provider delivery records separately.
- Attempts, including invalid input/failures, are limited to 3 per authenticated user and 10 per IP per 15 minutes. Counters use the existing shared PostgreSQL rate-limit store across server instances. Retain provider quotas as defense in depth. IP accuracy relies on the application's existing trusted-proxy configuration.

Opening the settings panel does not send email or change credentials. The test form sends only on explicit submission. Ordinary registration, recovery and enabled booking-confirmation flows use the selected SMTP configuration; booking email failure never reverses a confirmed booking. Automated tests use a private disposable database and fake transports. No deployment is performed automatically. See `docs/self-hosting.md` for deployment setup.

## Verification of the hybrid implementation

- Nine isolated integration tests pass: permissions, password re-verification, invalid fields, encrypted storage, authenticated encryption/provider binding, wrong-key failure, stale revisions, audit redaction, SMTP resolution, direct Twilio transport and environment restoration.
- The broader backend run passed 204 tests. Two additional test files initially could not compile because their isolated database doubles lacked the newly introduced dependency; after updating those doubles, all nine tests in those files passed in a focused rerun. This is 213 covered tests across the broad run and focused rerun, not a claim of a single clean all-suite run. Earlier booking stalls were repaired by passing the active transaction into nested readiness queries; the affected 54-test suite passed.
- Workspace typechecking and the self-hosted build command passed. The API was rebuilt/restarted after the final password-confirmation response adjustment; the nine integration tests passed again.
- Fixture-browser checks passed for masked status/source display, SMTP request wiring and blank omission, save/refetch, failure retaining the draft while clearing confirmation, cancel, explicit environment restoration, locked editing and 390px reflow. The password-confirmation failure is 403, not a session-invalidating 401.
- Browser identities/responses and transport credentials were fictional. No real provider delivery, authenticated live-account operation or external-server deployment is claimed. Live website editing remains locked until the operator configures the encryption master key.