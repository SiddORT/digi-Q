# Owner registration SMS request allowances

## Scope

Both public clinic-owner signup and Superadmin-led owner mobile proof use:

| Counter | Total requests | Existing fixed window |
| --- | ---: | --- |
| Browser registration subject / signed-in Superadmin subject | 5 | 1 minute |
| Exact mobile, shared across subjects and flows | 10 | 1 hour |
| Source IP, shared across subjects and mobiles | 60 | 10 minutes |

The initial request counts. Preparation failures, disabled/unavailable SMS,
rejection and unknown delivery still consume allowances before delivery.
Existing hashed keys and expiry data are retained. No counter reset, migration,
configuration screen or allowance refund is part of this change.

## Response and interface

`POST /auth/owner-mobile/start` returns `requestGuidance` with
`subjectMinute`, `mobileHour` and `sourceIp` snapshots, each containing only
`remaining` and `resetAfterSeconds`. Its `retryAfterSeconds` is the longest
exhausted-window wait, or at least 60 seconds after an uncertain send.
An exhausted request returns the same guidance with HTTP 429 and `Retry-After`.
No key, actor, contact, OTP, provider response or private diagnostic is included.

Counter admission is serialized on deterministic per-key locks in PostgreSQL.
IP → subject → phone consumption order is retained: an exhausted counter does
not consume itself or later counters; earlier counters remain consumed. Counters
commit before message preparation. The shared authentication limiter and
verification attempts are unchanged.

The owner form labels minute and mobile-hour snapshots separately. All limits
apply; the button and wait text use one countdown. Expired snapshots are removed
rather than locally inventing fresh allowances. Changing the mobile or flow
clears old proof and guidance. The next explicit request rechecks the server.
In-flight clicks are locked. Unknown/lost delivery responses require waiting
and checking the phone, never automatic retries. Provider acceptance is not
proof of handset receipt.

Notification preparation uses the active proof transaction's connection,
avoiding pool starvation when concurrent requests exceed the pool size.

## Local verification

- `node --test artifacts/api-server/src/owner-mobile.integration.test.mjs`:
  21 passed against disposable multi-connection PostgreSQL and fake SMS/email.
  Includes exact minute/hour/IP boundaries, controlled database expiry,
  concurrent subjects and cross-browser phone/IP contention, observed lock waits
  with admission-time windows, failed-send
  consumption, unchanged five wrong-code attempts/expiry/binding, and both
  optional-email skip paths through final clinic creation without SMTP or email
  activation. Skipped email remains unverified.
- `node --test --test-concurrency=1 artifacts/api-server/src/auth-http.integration.test.mjs artifacts/api-server/src/native-auth.integration.test.mjs artifacts/clinicflow/src/auth/owner-mobile-guidance.test.mjs`:
  49 passed, including actual HTTPS/CSRF error transport and privacy whitelisting.
- API server and ClinicFlow TypeScript checks passed; OpenAPI generation and the
  shared-library build passed.
- `pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/owner-mobile.config.ts`:
  12 passed with every API request mocked, covering both owner interfaces,
  rendered budgets and countdowns, phone edits, accepted/rejected/unknown
  delivery, in-flight double-click protection and both optional-email paths.
  No live messages or clinic writes were made. A fresh public registration
  screenshot also rendered without browser errors.

## Rollout boundary

This is local workspace verification only. Supplied UAT screenshots do not prove
that these changes are installed there. No live SMS/email, UAT deployment,
hosted data/configuration edit, template publication or historical replay was
authorized or performed. After a separately approved rollout, inspect the
installed version and safe response guidance without assuming local results
certify live delivery. Existing persisted windows must not be cleared to
demonstrate the new totals.
