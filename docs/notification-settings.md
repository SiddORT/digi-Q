# SMS, Email and Event controls

## Access and safe defaults

Real Superadmins can open **Settings** from their profile menu or the sidebar:

- `/admin/settings?area=sms`: notification SMS provider and templates
- `/admin/settings?area=email`: existing SMTP configuration and email templates
- `/admin/settings?area=events`: published event/recipient activation

Platform settings, Integrations (including storage and Twilio OTP), reference data,
audit and demo management remain available. Legacy `area=templates`, `/admin/templates`
and `/admin/integrations` links still work. Clinic Admins retain their existing
owned-clinic email template editor; they cannot read global credentials, change SMS
or Event controls, or send template tests. API authorization is independent of menu visibility.

All notification SMS templates start **off**. Configuring a provider, saving a draft,
publishing disabled wording or opening a preview sends nothing. Enabling affects
future eligible events and never enables clinic notifications or replays old bookings.
Do not activate existing clinics as part of development or a configuration check.

## Credential storage

The existing integration vault uses AES-256-GCM with a provider-specific authentication
boundary. A private `INTEGRATIONS_ENCRYPTION_KEY` (64 hexadecimal characters / 32 random
bytes) is required for website editing. Keep this key outside Git and outside the UI;
retain it securely when restoring the database. An unreadable encrypted record fails
closed rather than falling back to environment credentials.

Notification SMS uses provider `notificationSms` with:

- `NOTIFICATION_SMS_URL`: HTTPS POST endpoint, public destination, port 443
- `NOTIFICATION_SMS_KEY`: write-only API credential
- `NOTIFICATION_SMS_MAPPING`: bounded declarative JSON mapping

These are **not** `OTP_PROVIDER` or `TWILIO_*`: account/mobile verification is unchanged.
SMTP uses the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, write-only
`SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE` and `SMTP_REQUIRE_TLS` configuration.
SMTP always requires TLS; port 465 defaults to implicit TLS, other supported ports
use STARTTLS unless implicit TLS is explicitly selected.

Website saves require the current Superadmin password and matching configuration
revision. Blank fields keep existing values; edit the advanced mapping to replace it
as a whole. Saved website configuration replaces that service's whole environment
configuration, never a mix of both. Explicitly selecting server environment removes
the saved override and does not write `.env`.

Read responses contain readiness, source, revision and known key statuses, never
credential values, URLs or mappings. Browser storage and audit text do not retain
credentials. Readiness means valid configuration, **not** a successful provider test.

## Supported SMS HTTP providers

A URL and key cannot accommodate every provider. Only one bounded HTTPS POST is supported:

```json
{
  "encoding": "json",
  "authMode": "header",
  "authField": "X-API-Key",
  "fields": {
    "recipient": "to",
    "message": "message",
    "senderId": "sender",
    "dltEntityId": "entity_id",
    "dltTemplateId": "template_id"
  },
  "staticFields": { "route": "transactional" },
  "acceptedStatuses": [200, 202],
  "responseField": "result.status",
  "responseValue": "accepted",
  "dltRequired": true
}
```

- Encoding: JSON or `application/x-www-form-urlencoded`.
- Authentication: an API-key header, `Authorization: Bearer …`, or one named body field.
- Payload fields: flat, distinct identifiers for recipient, rendered message and
  optional Sender/DLT metadata. At most ten bounded **non-secret** static fields.
- Acceptance: explicitly selected 2xx statuses. Optionally require a bounded JSON
  dot-path value to equal the configured string; ambiguous/malformed responses are unknown.
- Limits: message 1,600 characters, request/response 16 KB, DNS 3 seconds,
  request 10 seconds, key 2,048 characters, mapping 8 KB.
- URL credentials, query strings, non-HTTPS protocols, non-443 ports, redirects,
  private/reserved IPv4 and IPv6, transition/mapped addresses and DNS rebinding are rejected.
  Every resolved DNS answer must be public; the TLS request pins a validated address.

There is no arbitrary code, scripts, GET/query credentials, SDK/signature-based protocol,
OAuth exchange, delivery webhook, failover, campaign or delivery guarantee. Check your
provider's documentation against these constraints before a controlled test.
No provider compatibility or DLT approval is implied by saving settings.

## Templates and one activation policy

The six operational events are booking, clinic onboarding, rescheduled, cancelled,
completed and reminder. Appointment events can target patient, owning Clinic Admin,
appointment doctor and assigned receptionists. Clinic onboarding targets **only**
the owning Clinic Admin. Unsupported operational events are not presented.

Effective published precedence is:

1. clinic-published override, including explicit `enabled: false`;
2. platform-published content and activation;
3. existing email defaults, or SMS defaults (all disabled).

Drafts never change delivery. Numeric revisions protect template and activation edits.
Reset removes local published/draft content and restores inheritance without resetting
the numeric revision to zero. Event-control changes update the published `enabled`
field, preserve existing unpublished drafts, and are the **same** policy as the template
switch. Switching that switch is only local editing until Publish is confirmed.

The clinic-wide `notificationsEnabled` gate still applies, including clinic policies
over platform defaults. This page shows but never changes it. Existing published email
records, staff defaults, explicit opt-outs and branding remain compatible.

SMS supports clickable approved placeholders, message text, Sender ID, DLT Entity ID
and DLT Template ID. If `dltRequired` is selected, an enabled publish or activation needs
all three metadata fields. Drafts can retain incomplete metadata for review. The IDs
must actually match provider-approved content before operation; DigiQ does not register
or approve them. SMS costs and provider quotas still apply.

Email retains subject, prefix, body, footer, internal logo uploads/HTTPS logo links,
recipient selection, drafts and readable previews. Account/security messages (patient
codes, OTP/mobile verification, staff invitations, password recovery) remain separate,
not disable-able appointment events.

## Controlled preview and test

Every template has a Superadmin-only test action for its **current editable content**,
including drafts and disabled templates. It never publishes, activates, creates an
appointment or inserts an ordinary notification job.

1. Enter bounded sample values for **exactly** the placeholders used by that channel.
2. Render a server preview (no send).
3. Enter one explicit phone number or email address you control.
4. Confirm one real send, then submit. Channel configuration must be ready and required
   DLT metadata must be present even when testing a disabled template.

Do not enter real patient data or send real messages during development. The legacy
fixed SMTP connection-test message is still available; all SMTP sends reuse the
existing email sender.

Test attempts are limited to 3 per actor and 10 per IP every 15 minutes through the
existing shared database rate limiter. Preview limits are separate. Tests bind the
template's current numeric revision and an actor-scoped UUID request ID. A durable
claim prevents double-submit/request replay from sending twice; a replay with changed
input is rejected. A crash after the claim returns an uncertain outcome, not a resend.
Only the request digest and sanitized status are persisted, not recipient/sample text.
Audit records channel, event, recipient group and outcome, not secrets or raw provider data.

## Automatic delivery and outcomes

All creation entry points capture booking event jobs only at creation; the separately
claimed patient booking email is not duplicated. Existing reschedule, cancellation,
completion and onboarding entry points capture their events, and the worker schedules
reminders one hour before **session start in the session timezone**, not a guaranteed
consultation time.

SMS and email have channel-specific durable jobs and deduplication. Shared addresses or
phone numbers receive one message per event within each channel. Missing optional contact
skips that recipient. Before dispatch, the worker checks current contact, account status,
ownership/assignment, published policy, clinic gate, appointment revision/status and
reminder timing. Obsolete/revoked jobs do not send. SMS preparation failures and transport
failures cannot roll back a committed booking or prevent email processing.

Automatic worker operation and the separately claimed default patient booking sender
are **production-only**; development captures no ordinary event jobs. Explicit administrator
template tests remain available with confirmation. New SMS jobs are not created while
the channel is unconfigured or its template is disabled. Disabling/re-enabling a template
does not resurrect queued events from before its activation. Enabling does not replay
past bookings; future reminder occurrences remain subject to current eligibility.

Outcomes have distinct meanings:

- **provider_accepted**: provider accepted; not confirmed handset/inbox delivery;
- **provider_rejected**: explicit provider rejection;
- **pre_dispatch_failed**: dispatch did not begin;
- **delivery_unknown**: dispatch may have occurred; never automatically resend.

Durable `sending` after a crash is also uncertain and never automatically reclaimed.
Preparation retries are bounded and only apply before the dispatch claim. Existing
patient booking response fields remain compatible; a failure never changes the booking.
No development fixture result proves delivery to a real handset/inbox or readiness of
a separately deployed environment.

## Verification

`notification-settings.integration.test.mjs` uses a disposable PostgreSQL cluster,
synthetic credentials and fake senders. It covers encryption/redaction, provider binding,
request mapping, SSRF/address restrictions, acceptance classification, DLT activation,
revision conflict, inheritance/opt-outs, draft tests, replay, all six event jobs,
missing contacts, timing/status/contact/assignment checks and independent channels.
The existing integration, notification-template, appointment-confirmation and booking
regressions remain relevant. Frontend checks use fictional identities/providers; browser
checks must not enter credentials, activate clinics or send real recipients.

Preview UI verification used intercepted, fictional API responses, not a live staff
login or real provider. It verified role-specific menu visibility, clinic-admin email
access, the three layouts at 1366/1024/768/390 pixels, keyboard switch confirmation,
preview substitution, one request on fake-send double-click, uncertain-result wording,
and dirty tab/sidebar navigation. A targeted follow-up verified repeated browser
Back/Cancel/Discard and draft retention after fixing history handling. Full browser
SMTP delivery and draft/publish conflict scenarios were not exercised; corresponding
sender, draft isolation and revision behavior were checked with isolated backend and
component tests instead. None of these fixtures establish handset/inbox delivery.

Queued reminders tolerate up to five minutes beyond their narrow scheduling window
to account for worker polling and transaction-commit delays. This allowance does not
capture new reminders or replay old events; current status, revision, check-in state,
session timezone and recipient eligibility are still checked before dispatch.
