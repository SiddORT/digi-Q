# Preview administrator recovery — 2026-10-12

## Target and evidence

- The running Preview API's database configuration matched the workspace connection. A read-only database-name fingerprint matched the explicitly selected development database; both contained 17 users. Preview `/api/auth/status` was reachable through the development HTTPS proxy.
- Exactly one account matched the authorized recovery identity: an active Super Admin with no native password hash and no password-change timestamp.
- That account's creation and sole pre-recovery user audit entry (`onboard`) were dated 2026-09-22. Git history shows the earlier user schema lacked native password fields; the additive native-auth migration adds nullable password fields without enrolling existing users.
- Missing native credentials are therefore compatible with a pre-migration account. The current audit evidence does **not** establish why the previously reported recovery is absent, whether a database restore occurred, or whether earlier recovery used another target. No credential-loss cause is asserted without evidence.

## Recovery and preservation

The authorized retained Preview recovery secret was used privately from the environment. No seed/bootstrap command, public bypass, account creation, role change, startup rotation, or application-authentication redesign was used.

The operator-only recovery used the application's password validation, Argon2id hashing, credential advisory lock, row lock, and transactional credential revocation. The complete account baseline was rechecked under lock before writing. Only the existing account's missing password hash and password-change timestamp were initialized. A sanitized `initializePreviewPassword` audit entry was committed in the same transaction.

Transactional assertions confirmed:

- The account's identity, role, status, email verification, invitation state, and other metadata were unchanged.
- All other user rows and all clinic and assignment rows were unchanged.
- There were no existing native sessions; three outstanding staff authentication challenges were consumed and their challenge data cleared.
- The retained password verified successfully; an incorrect password was rejected.

UAT, production, SMTP configuration, and the retained recovery secret were not changed.

## Separate acceptance results

1. **Credential verification:** passed against the confirmed development database.
2. **Actual Preview browser:** passed in a fresh Chromium context using the real HTTPS development Preview `/sign-in` frontend. The form submitted to the real `/api/auth/login`, which returned HTTP 200 and authenticated the intended account. Browser-origin `/api/auth/status` and `/api/me` confirmed the intended active Super Admin; `/admin/dashboard` loaded visibly without an error page.
3. **User confirmation:** on 2026-10-12, the user separately confirmed, “Yes, sign-in works.”

The delegated browser checker could not access the retained secret, so it did not attempt authentication. Its initial `/staff-login` probe was not the application's login route. The successful verification instead ran in the workspace browser, supplying the secret directly from the process environment without printing or saving it. This was not an isolated fixture server or mocked API.

## Cleanup

The browser logged out successfully and confirmed an unauthenticated session. Only that browser's exact agent-created session row was deleted, using its privately computed digest. The fresh browser context was closed. Temporary recovery source and generated bundle were removed; the retained recovery secret remains available.

No passwords, password hashes, challenge tokens, session cookies, or database connection strings are included in this report.
