# Native authentication: operator migration checklist

This is a **data-preserving auth migration**, not a new account database. The immutable application `users.id`, roles (`superAdmin`, `clinicAdmin`, `doctor`, `receptionist`, `patient`), clinic ownership, assignments, patient records, bookings, QR URLs, history and audit records must remain unchanged. Existing provider passwords cannot be recovered from the old `users` table; do not guess or reuse provider password hashes. Never publish a reset token, code, password, email recipient list or session cookie in a log or report.

## Before deployment

1. Restrict this operation to an authorized operator with a maintenance window. Inventory active staff/patient counts, invitation state, existing sessions and pending requests. Ensure a functioning transactional email provider for invitations, recovery, registration/email verification and patient email-code login. Normal staff password login creates a session directly and does not require SMTP or email MFA.
2. Obtain a PostgreSQL backup and **rehearse restore on an isolated instance**. Preserve user and business IDs. Snapshot schema version, role/status counts, assignment and booking counts, and audit history; store backups securely with restricted access.
3. Run the read-only preflight against the intended database: `pnpm --filter @workspace/scripts run preflight-native-auth`. It outputs aggregate counts only: case-insensitive email collisions, emails needing normalization, and password-setup counts per role/status. A collision returns a nonzero exit code. Investigate and resolve collisions with the account owners before enforcing a case-insensitive unique identity; do **not** auto-merge patients or staff by email. Run against a staging clone first.
4. Test the complete migration on a staging clone with **synthetic** credentials, including applying all versioned Drizzle SQL migrations from an empty disposable database and from a copy of the old schema. Verify email delivery with a controlled destination, never a real patient's email in test. Read `docs/native-auth-contract.md` for the application endpoint contract.

## VPS configuration and sequence

Configure `DATABASE_URL` to the exact intended PostgreSQL instance and TLS/HTTPS at the reverse proxy. Ensure the API knows its trusted proxy configuration and origin so it issues `Secure; HttpOnly; SameSite` session cookies on the actual site. Choose a shared secret-store/SMTP configuration; backend expects `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` for email verification, password recovery, invitations and patient email-code login. SMTP failure must reject setup/recovery/code requests, not pretend a code was delivered; normal staff password login must not depend on SMTP. No local/test codes in production.

For the **first** Super Admin, provide `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME` and a strong random `SUPERADMIN_PASSWORD` as protected environment secrets. Never pass the password on a command line, check it into a file, echo it, or paste it into a ticket. Once provisioned, remove the initial password secret from the runtime environment and use the authenticated change-password/recovery flow for rotation. Preserve the established administrator's role, status and password on repeat deploys. If a matching existing active Super Admin has no native password hash, the controlled seed may initialize that *same* row once; a different email or non-admin must never be silently promoted or overwritten.

On a VPS where **Drizzle migrations are the schema authority**, after a successful backup run:

```sh
pnpm --filter @workspace/scripts run preflight-native-auth
pnpm --filter @workspace/db run deploy:prepare
# Then start the deployed API and web artifact using the existing process manager.
```

`deploy:prepare` must perform **migrations first, then the idempotent seed**; startup must not expose an API before either step succeeds. Do not run `drizzle-kit push`, `push-force` or schema-sync at runtime. Native credential tables/columns should initially be additive; do not drop existing provider identity columns or old proof tables as part of first deployment.

**Replit-managed database exception:** Publish applies its managed development-to-production schema diff before application startup. Do **not** add a competing Drizzle migration or `db:push` in Replit's build/startup; run only the idempotent seed *after* Publish has applied its schema diff. Review any publish-time rename/drop warnings rather than assuming migration parity.

## Password re-enrollment

- Existing provider passwords are **not** in PostgreSQL. A user without a native hash cannot use their old password merely because the role and email exist locally.
- Existing staff should use an authorized single-use password-setup invitation or generic forgot-password email to establish a new hash. Links/codes must expire, be stored hashed, be consumed atomically once and only be delivered to the verified recipient. Keep roles/assignments server-owned and unchanged; do not derive privileged roles from a reset URL or client input.
- Patient email-code login remains **separate** from staff password login. Successful staff Argon2id password verification creates a session directly and returns `{authenticated:true,user:{id,email,fullName,role,status}}`, with no new-device email challenge or SMTP dependency. The existing authenticated mobile SMS verification is a distinct workflow and must remain intact.
- Historical provider-mutating CLI fixtures/audits are deliberately fail-closed. Their historical evidence under `docs/audits/` is preserved; use `pnpm --filter @workspace/api-server run test:auth` for native regression checks. Do not run old provider tests against live customer data.

## Acceptance before cutting over

- Real staging logins for every role, including a Clinic Admin with an owner-doctor profile, only return authorized data; inactive staff, revoked/expired sessions, invalid passwords and wrong-role access fail closed.
- Verify staff password login works without SMTP; verify recovery, setup/invite, registration email verification, patient email login and separate mobile verification with their configured delivery providers. Test provider/email delivery failures explicitly for email-sending flows. No reset/OTP code or token is returned in production API responses or logs. Existing account sessions are **not** implicitly migrated; users authenticate anew.
- Verify Argon2id hashes and reset/session tokens never appear in `/me`, user list/detail/exports, registration and CRUD responses, audit records or serialized errors. No local hash is stored for patient email-code-only accounts unless they deliberately have a password.
- Exercise cookie attributes, CSRF protection, origin validation, login/recovery throttling across instances, logout revocation, password-reset session invalidation and session rotation.
- Retest guest booking/public QR pages without login, clinic/branch data scope, queue/check-in/out, appointments, patient privacy, onboarding, invitation acceptance and demo restrictions. Confirm no active code path attempts any provider API/proxy, and scan for old secrets only by **key names**, never print values.
- Compare user/clinic/assignment/patient/booking/history counts to the preflight snapshot. Monitor login failure rates, 401/403, delivery failures, and account lockouts after release.

## Rollback and cleanup

Deploy initially with additive schema. Keep a tested application rollback package and backup. In case of an auth regression, stop public access or revert application traffic to the last compatible release while preserving newly created business rows; do **not** restore the old database snapshot over later bookings. A rollback that depends on old provider credentials is only possible while that provider remains available and the old version's prerequisites are intact.

Only after an authorized acceptance and retention review, revoke old sessions/invitations and obsolete provider secrets, remove remaining provider packages/runtime calls, and perform a **separately reviewed** migration to drop obsolete identity columns and proof rows. Never delete historical user/booking/audit records to make a migration pass. A README or green unit test alone is not evidence that the live VPS database and email provider have been migrated.