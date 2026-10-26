# Preview OTP delivery diagnosis — 26 October 2026

## Evidence and limits

- The earlier authorized inspection supplied with this task found an SMS login
  request at **05:58:40 UTC**, no patient matching the reported mobile in either
  local or +91 form, and no SMS challenge. The old implementation returned an
  opaque fake challenge for non-unique matches, explaining the unusable code step.
  No reported contact identifiers have been copied into tests or this report.
- A bounded read-only inspection of Preview challenge metadata confirmed a
  registration challenge created at **06:02:20.022 UTC**, expiring ten minutes
  later, with **zero verification attempts** and no consumption at inspection.
  A challenge proves preparation, not provider acceptance or inbox delivery.
- The supplied screenshot shows required email `provider_rejected`. The old SMTP
  boundary merged authentication, envelope and several SMTP response failures.
  The original request's serving-process logs were not available in this fork.
  Therefore its precise authentication/sender/recipient cause cannot be recovered.
- Preview has **no saved SMTP integration row**. The effective source is the
  canonical `SMTP_*` server environment, not an encrypted website override.
  All required SMTP fields pass the application's presence/syntax checks;
  optional SMTP controls use defaults. These checks do not establish valid
  credentials, sender authorization, recipient acceptance or inbox receipt.
- SMS is not configured or expected for this clinic-registration incident.
  Its absence is not an email-delivery defect and requires no SMS setup.

## Changes

- Non-unique patient-mobile matches now return a throttled, actionable eligibility
  error with an Email OTP sign-in/registration alternative. Unregistered, inactive
  and ambiguous matches use identical public wording without names, email
  addresses, account counts or shared-number details. The UI stays at mobile entry.
- Unique active patients retain real hashed, expiring, single-use SMS challenges,
  bounded code attempts, credential locking and fresh identity checks. SMS does
  not create accounts or verify email.
- SMTP errors preserve bounded authentication, sender and recipient rejection
  categories internally while retaining the existing `EMAIL_REJECTED` contract.
  Security-email warnings contain only the event, channel and allowlisted category:
  `authentication_rejected`, `sender_rejected`, `recipient_rejected`,
  `provider_rejected`, `configuration_unavailable`, `preparation_failed`,
  `pre_dispatch_failed`, `disabled` or `delivery_unknown`.
  They do not include error objects, raw responses, recipient identities,
  credentials, OTPs, bodies or a rendered security-message history.
- Required registration email failures appear as alerts with safe Admin/resend
  instructions. Expected absent optional SMS is not presented as a configuration
  defect. Unexpected optional-phone preparation errors cannot strand an already
  issued email challenge.
- Resend rejection and non-dispatch have distinct safe user-facing explanations.
  Unknown outcomes advise waiting/checking first. There is no automatic retry.
  Draft details, the prior valid code, original expiry and attempt budget survive
  failed resends; successful resends rotate the code without extending expiry.
  The UI waits through a cooldown after failed as well as successful resends.
  Email proof remains mandatory.

## Verification

- **45 focused checks passed:** native authentication integration tests using
  disposable PostgreSQL and mocked SMTP/SMS, SMTP configuration tests and rendered
  security-notice tests. Coverage includes unique/non-unique SMS eligibility,
  throttling, single-use verification, safe SMTP categories, unconfigured optional
  SMS, required-email independence and failed-resend rollback.
- **Four mocked browser cases passed:** unregistered and ambiguous SMS entry,
  eligible SMS code submission, and registration email rejection/resend/reload
  recovery. Every API request is intercepted; no live delivery is involved.
  The registration-only rerun corrected test-clock scheduling and an intervening
  development hot reload, not a production resend failure.
- Shared-library, API and frontend TypeScript checks passed. Managed Preview
  services started cleanly, and the public patient login page rendered correctly.
- The broader `integrations.integration.test.mjs` run had **12 passes and one
  failure** in `notification SMS tests are authorized, validated, explicit and
  report sanitized outcomes without activating clinics`: its notification-SMS
  fixture returned `not_dispatched` instead of `provider_accepted`. That case is
  outside these changed authentication paths; it has not been fixed or counted
  as passing.

## Supported next action

A System Admin can review the effective Preview email configuration and, with
explicit live-delivery authorization, trigger a new registration/resend attempt.
The new bounded serving-log category can distinguish authentication rejection,
sender rejection, recipient rejection, preparation failure and uncertainty.
An authentication rejection alone does not prove an incorrect password; provider
policy can also reject authentication.

Correct only the configuration supported by that evidence. Do not change SMTP
secrets or providers on the basis of this historical screenshot alone. User
confirmation of email receipt is separate from provider acceptance.

If the original challenge has expired, use **Change Details** and re-enter the
password to start a fresh email challenge. Do not bypass email verification or
use optional SMS as replacement proof. No live messages, SMTP probes, settings
changes, UAT changes or deployments were performed for this diagnosis.
