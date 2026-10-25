# Staff accounts: creation and contact verification

## Account contract

Authenticated Add Staff uses email as the sign-in name, a create-time password,
mobile with country code, and inline role-specific work details. A Clinic Admin
owns a **new clinic**, optionally with their own consulting-doctor profile.
Locations belong to clinics; no extra hierarchy or ownership transfer is added.
Existing creator and single-managing-admin restrictions remain authoritative.

Password-ready active accounts can sign in immediately, without SMTP/SMS or
contact verification. New contacts start unverified. Legacy accounts without a
password keep their invitation/setup/recovery path; ordinary profile edits never
set or reset a password.

Direct-create request receipts are actor-scoped and contain identity references
and a password-free request digest, not credentials or submitted forms. Repeating
the same request recovers the saved account. A different draft cannot reuse a
committed request. Passwords remain only in the current form and request and are
excluded from browser drafts, role-switch snapshots and mutation variables.

## Verification and notices

The first staff workspace visit prompts for separate email/mobile verification,
with deferral and the same controls in My Profile. Neither creation nor login
sends an OTP automatically. Challenges are short-lived, single-use and bound to
actor, purpose, channel and exact contact, with hourly/request cooldown and
attempt limits. Editing mobile clears proof and invalidates old challenges.
General account editing still cannot replace or fabricate verified email.

One creating-admin occurrence commits with each new direct account. Only the
actual creator's verified destinations and eligible configured channels may
receive it. Each new staff account can receive one welcome per channel, only
after the corresponding proof. Legacy staff are not enrolled retrospectively.

Optional gates, published wording, personal preferences and provider controls
remain independent. SMS requires the configured provider and published approved
wording/registration; fixtures do not provide live approval. Links come from the
configured canonical application origin. Welcome/admin notices contain no
password, OTP or setup link. A claimed/uncertain dispatch is never automatically
retried. Skipped occurrences never become a backlog after re-enablement.

Account readiness, contact proof, and notice outcome are separate UI states.
“Accepted by provider” is not a claim of inbox delivery or receipt.

## Local evidence

- `pnpm --filter @workspace/api-server test:staff-accounts`: 27 passing tests,
  covering direct and legacy creation, all supported staff roles, native login,
  rollback, assignment/ownership restrictions, concurrent receipt recovery,
  independent OTP proofs, invalid/reused/expired/old-contact codes, deferral,
  per-channel welcome deduplication and uncertain-delivery handling.
- `node --test artifacts/api-server/src/auth-http.integration.test.mjs`: five
  passing real HTTPS/CSRF/session/compatibility checks with fake transports.
  Its bundle explicitly resolves workspace public-page modules; native Node's
  TypeScript stripping is not a substitute for workspace module resolution.
- The notification-settings suite and new staff lifecycle suite passed together
  (54 tests). Existing appointment notification tests explicitly retain their
  original six-event scope; staff events have separate lifecycle coverage.
- `pnpm typecheck` and 19 staff-input/account/control unit tests pass.
- Main app and API workflows start cleanly; staff sign-in was visually checked
  at 1024px. Authenticated form evidence uses fictional, intercepted fixtures,
  not workspace/UAT/production accounts.
- Fictional browser checks exercised valid doctor/receptionist payloads,
  mismatched-password focus, no setup dispatch for password-ready accounts,
  explicit independent contact proofs, cooldowns, deferral and Profile access.
  A local single-column admin modifier and uncontrolled-input checklist tracking
  fixed the two reported rendered defects. Focused screenshots confirm admin
  geometry at 1366/1024/768/390px and live checklist updates/clearing; see
  `docs/ui/compact-ui-coverage.md` for the precise browser evidence limits.

## Authorization boundary

No production/UAT deployment, real-account mutation, provider/DLT registration,
or live email/SMS test is part of this implementation. Hosted acceptance and
real delivery need separate approval and approved destinations. Local results
do not establish either.
