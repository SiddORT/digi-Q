# Preview superadmin recovery

## Scope and safeguards

- Recovery was restricted to the existing matching active superadmin in the development database.
- The running preview API's database connection matched the recovery process. Its database name and account-identity fingerprint matched the explicitly selected development database.
- No bootstrap, seed, account creation, role change, authentication endpoint change, SMTP configuration, production database query, or deployment operation was used.
- The new password was supplied through the workspace secret flow and validated and hashed using the existing password policy and Argon2id helper.
- Recovery used the existing per-account credential lock, row lock and transactional credential invalidation.
- Only the password hash and password-change timestamp were updated on the account. A sanitized `previewPasswordRecovery` audit entry was recorded in the same transaction.

## Actual verification

- New password accepted by the application's password verifier.
- Account identity, role, status, email verification state and other metadata preserved.
- Other users, clinics, doctor relationships and clinic assignments unchanged.
- No pre-existing session records were present for the target account.
- Three outstanding staff authentication challenges were consumed and their payloads cleared.
- Actual preview HTTPS login succeeded through the normal CSRF and password-login endpoints.
- The resulting session reported the superadmin role.
- The verification session was logged out, rejected on subsequent status lookup, and explicitly revoked during cleanup.
- No lasting authenticated agent session was retained.
- The temporary recovery script was removed.

## User verification and secret cleanup

The user confirmed that preview sign-in worked with the privately supplied new password. This is user-reported browser success, separate from the agent's observed HTTPS login verification.

The user explicitly requested retaining the temporary recovery password in workspace Secrets instead of deleting it. This is an approved change from the original cleanup plan. The recovery script and in-process recovery material were removed; the retained secret is not used by deployment seeding. No secret value, password hash, reset link or token is included in this report.

## Requested first-deployment seeding

- Reused the existing idempotent superadmin seed rather than creating a second bootstrap path.
- Confirmed Replit production startup already runs the seed before the API.
- Updated `start:selfhost` to run the seed with the private environment file before starting the API. Seed failure prevents API startup.
- Documented separate `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME` and `SUPERADMIN_PASSWORD` configuration for a fresh deployment.
- Existing administrator credentials, metadata and inactive status remain preserved. No account is elevated by seeding.
- Verification: `pnpm --filter @workspace/db run test:seed` passed all 16 tests, including isolated startup-order/failure checks and preservation of a password changed after first provisioning.
- The first test attempt exceeded its two-minute limit; the complete suite passed with a longer limit.
- Startup-order tests use harmless subprocess fixtures; seed behavior tests use disposable embedded PostgreSQL. They do not verify real multi-process PostgreSQL lock contention.
- No seed was executed against the workspace account for this change, and no deployment or production database was modified. Real first-deployment provisioning still requires securely configured bootstrap values and deployment.

## Completion validation

The first completion attempt passed queue-contention validation and code review, but `pnpm test:tickets` failed: 25 tests passed and six hit the 30-second test limit during fixture navigation/rendering.

A retry temporarily used one browser worker and a bounded 60-second test limit without changing assertions. It still produced browser-test timeouts; queue-contention validation also failed during disposable PostgreSQL `initdb` setup with `ETIMEDOUT`, before exercising queue behavior. Code review passed again. The ticket-test configuration was restored to its original settings rather than retaining an ineffective unrelated change.

Completion is blocked by required workspace validation. Recovery and seed-specific verification remain as reported above; neither a code review nor their passing checks replaces the required validation commands.

The user supplied all three bootstrap settings through Secrets. Their presence and seed-policy validity were checked without displaying values, running the seed, or accessing a database.

On the user-requested verification retry, syncing with newer project changes required resolving the ticket-test configuration. The newer shared configuration (90-second bounded test timeout, two workers) was preserved rather than overwritten by this task's earlier temporary adjustment or its revert. The required checks are being retried against that synced state.

That retry passed queue-contention validation and code review. The ticket suite could not start because another active Playwright ticket-test run owned its fixed test port. The active run and its server were not terminated. Completion remains blocked pending a nonconflicting ticket-test run.
