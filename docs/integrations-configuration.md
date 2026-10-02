# Environment-only integrations

Configure values privately in the server's development or production secret/environment store. The placeholder file `config/integrations.env.example` is a checklist, not a runnable configuration. Never commit populated copies or prefix credentials with `VITE_`. No database record stores integration credentials, and the application provides no runtime credential editor.

## SMTP

Required: `SMTP_HOST`, `SMTP_PORT` (1–65535), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` (one address, optionally `DigiQ Doctors <address>`). Use the provider's verified sender. Port 465 defaults to implicit TLS; other ports require STARTTLS. Optional `SMTP_SECURE=true|false` overrides implicit TLS selection. Optional `SMTP_REQUIRE_TLS=true` documents the mandatory STARTTLS policy; `false` is rejected. Certificate validation is not bypassed. Transport timeouts bound connection and socket waits.

Restart through your normal operations process after changing environment configuration. Ordinary password login does not require SMTP. Invitations, recovery, and email challenges still require it. The existing `smtpConfig` export and injectable auth email transport remain available.

## SMS and authentication

Existing SMS delivery uses `OTP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_MESSAGING_SERVICE_SID`, and the existing Replit Twilio connector. Environment readiness does **not** verify that connector or provider permissions. `OTP_PROVIDER=development` works only with `NODE_ENV=development` and is not production SMS. No SMS test is sent by this feature.

`AUTH_SESSION_MODE=native|jwt` in the template means choose one mode, not the literal pipe-separated string. The default `native` preserves existing opaque-cookie continuity. To enable app-issued JWT sessions, first configure a dedicated high-entropy `JWT_SIGNING_KEY` of at least 32 UTF-8 bytes through the private server secret store, then explicitly set `AUTH_SESSION_MODE=jwt`. Do not reuse another integration's credential as the signing key. Misconfigured session issuance can return HTTP 503 with `AUTH_SESSION_UNCONFIGURED`. Switching modes invalidates existing cookies and requires users to sign in again.

Both modes use database-revocable cookies with a **fixed 12-hour lifetime**, `HttpOnly`, `Secure`, and `SameSite=Lax`. There is **no refresh endpoint**, no 15-minute access-token/refresh-token stage, and no promised automatic session renewal. New passwords require at least 8 characters including ASCII letters and numbers, with a maximum of 1024 UTF-8 bytes enforced by the server. Existing credential verification is not retroactively subjected to password-creation policy. JWT authentication remains owned by the authentication implementation; no signing key is exposed by these settings endpoints.

## Super Admin checks

Platform settings contains a read-only readiness panel and an explicit SMTP test form:

- `GET /api/settings/integrations`: authenticated active Super Admin only; returns known key names and configured/missing/invalid/default statuses, never values or addresses. Readiness checks syntax/presence, not connectivity.
- `POST /api/settings/integrations/smtp/test-email`: same authorization; accepts only `{ "recipient": "operator@example.invalid" }`. Exactly one strictly validated address; caller cannot control sender, subject, body, headers, attachments, host, or credentials. Sends a fixed DigiQ Doctors message only on explicit submission.
- Both endpoints use `Cache-Control: no-store`, including authorization failures. Errors do not include transport diagnostics, recipients, or credentials. SMTP failures are generic.
- A successful test means the SMTP provider **accepted** the message, not that it reached an inbox. Check the recipient's inbox/spam folder and provider delivery records separately.
- Attempts, including invalid input/failures, are limited to 3 per authenticated user and 10 per IP per 15 minutes. The in-memory counters are per server process and reset on restart. Multi-instance deployments need a shared rate-limit store before relying on these as global quotas; retain provider quotas as defense in depth. IP accuracy relies on the application's existing trusted-proxy configuration.

No provider connectivity check, real test email, migration, environment mutation, or deployment is performed automatically. Automated tests use a private disposable database and fake SMTP transport.