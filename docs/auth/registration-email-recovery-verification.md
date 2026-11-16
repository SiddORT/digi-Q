# Clinic-owner registration email recovery

Verified locally on 2026-11-16. This work concerns `/register-clinic`, not staff
creation, invitations, DNS, or inbox placement.

## Findings and boundaries

- The supplied notice corresponds to `delivery_unknown`: neither successful
  submission nor definite rejection is established by that notice.
- Initial submission validates the effective SMTP configuration, creates a
  pending registration challenge containing a password **hash**, prepares the
  published security template, and sends through the security-email transport.
  Only email proof creates the Clinic Admin account and session.
- SMTP resolution uses the encrypted saved record when present, otherwise the
  canonical `SMTP_*` environment namespace. An unreadable saved record fails
  closed; it never silently falls back to environment credentials.
- A bounded, read-only development database query found **no saved SMTP override**.
  This establishes environment-source selection in Preview, not credential
  correctness, SMTP reachability, or UAT configuration. No credential values were
  read or compared.
- Explicit resend keeps the challenge ID, original expiry, attempt budget,
  pending owner details, and separate mobile proof. Its transaction rotates the
  code only after accepted submission; failed or uncertain transport rolls back
  to the previous code. No automatic resend was added.
- No evidence available here establishes the cause of the original UAT transport
  uncertainty. UAT is independently hosted; this change does **not** claim to fix
  or verify UAT email submission.

## Corrected behavior

- Resend success feedback now requires `channels.email.status ===
  "provider_accepted"`; an HTTP success alone is insufficient.
- Failed or uncertain resend clears stale email-acceptance/latest-code notices,
  retains entered codes, and does not emit a success toast. Independent mobile
  feedback is retained.
- A shared synchronous submission lock covers both resend and verification,
  preventing overlapping double-click submissions before React rerenders.
- Registration-local messages distinguish unsuccessful submission, uncertainty,
  incorrect/expired codes, ended sessions, disabled sending, and request limits.
  Recovery names the existing **Resend code** and **Change email** controls.
  Other authentication pages' error wording remains unchanged.
- The transport no longer mislabels explicit negative SMTP responses (including
  temporary 4xx responses) as uncertain acceptance. TLS negotiation failure and
  connection-stage timeout are classified as pre-dispatch failure. Timeouts or
  socket failures during DATA remain uncertain. None of these outcomes is retried
  automatically, and TLS enforcement is unchanged.
- Server logs retain fixed diagnostic categories only; no raw SMTP replies,
  credentials, OTPs, email bodies, or recipient details were added to diagnostics.
- Registration layout, steps, required email proof, optional SMS independence,
  expiry, single-use verification, and continuation to clinic setup are unchanged.

## Automated local evidence

Commands used:

```sh
node --test --test-concurrency=1 \
  artifacts/clinicflow/src/auth/security-notifications.render.test.mjs \
  artifacts/api-server/src/native-auth.integration.test.mjs \
  artifacts/api-server/src/integrations.integration.test.mjs \
  artifacts/api-server/src/owner-registration-contract.integration.test.mjs \
  artifacts/api-server/src/registration-onboarding.integration.test.mjs
pnpm run typecheck:libs
pnpm --filter @workspace/clinicflow run typecheck
pnpm --filter @workspace/api-server run typecheck
git diff --check
```

The four registration/auth/rendering/continuation suites passed **60 checks**.
Coverage includes mocked SMTP acceptance/rejection, authentication/sender/recipient
rejection categories, explicit negative DATA response, TLS/connect failure,
uncertain DATA failure, no automatic retry, preserved pending password hash,
resume capability, resend code rollback/replacement, original expiry and attempts,
single-use proof, absent/failed SMS, and clinic setup completion/recovery.
The five rendered notice/error checks also passed again after the final wording
adjustment. Both application type checks passed after rebuilding shared
declarations; initial checks against stale declarations were not used as the final
result. Both services restarted successfully; the public registration page rendered
without browser errors.

The Preview browser regression passed **3/3 tests**, using:

```sh
pnpm --filter @workspace/clinicflow exec playwright test \
  --config workspace-regression/register-email-recovery.config.ts
```

Every `/api/**` request was intercepted before navigation; unexpected writes were
blocked, with zero unexpected POSTs recorded. The browser verified uncertain and
rejected initial submission; accepted initial submission; unsuccessful, uncertain
and accepted resend; no misleading success/latest-code feedback; preserved codes
on failure; cleared codes only on accepted resend; rapid-click single submission;
incorrect/expired-code recovery; a 90-second server request limit; and Change email
retaining the name/email without retaining the password. Optional SMS and actual
account creation were covered by backend checks, not this mocked browser pass.
The browser tool's interactive clock helper disconnected; the same saved regression
ran successfully through the repository Playwright runner. No application failure
was found in that pass. Generated screenshots remain in the ignored output folder.

The supplementary `integrations.integration.test.mjs` suite passed 11 checks and
failed two outside the changed registration flow:

1. `strict recipient and fixed branded content; user abuse limit` expects the old
   `DigiQ Doctors` subject while the fixture receives
   `Digi-Q — SMTP configuration test`.
2. `notification SMS tests are authorized, validated, explicit and report sanitized outcomes without activating clinics`
   expects `provider_accepted` but receives `not_dispatched`.

Those checks were not weakened, skipped, or fixed as part of this registration
task. They concern the separate settings-test flow, not clinic-owner OTP submission.

## UAT evidence still needed

With separately authorized access, the server operator can correlate one reported
registration attempt's time and initial/resend action with the fixed server
diagnostic category, deployed code version, and whether saved or environment SMTP
configuration was selected. Share only sanitized categories and configuration
source metadata, never credentials, OTPs, message bodies, or raw provider replies.
That read-only evidence should determine the next action before authorizing any
live SMTP test, provider edit, or server change. No UAT deployment, live email/SMS,
SMTP probe, or credential/provider change was performed here.
