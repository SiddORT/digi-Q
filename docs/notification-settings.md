# Notification settings, delivery policy and providers

For reproducible before/after evidence and local-only limitations, see
[Notifications management verification](notification-management-verification.md).

## Access and safe defaults

**Notifications** (`/admin/templates`, retaining the compatible URL) is the single
administrative destination for overall optional delivery, per-template activation
and wording. One scope selector applies to all three. Legacy Settings
`area=notifications`, `area=events` and `area=templates` links redirect here for
Superadmins and Clinic Admins. Doctors, receptionists and patients keep their
existing permitted landing pages, never restricted Communication credentials.

The old Settings delivery matrix is removed. Saved personal preferences, explicit opt-outs, inherited
defaults, clinic/platform gates, revisions, templates and notification history
remain unchanged. No preferences are reset and no policy matrix is moved into
provider configuration. The notification inbox, read markers and unread counts
continue to use the existing server policy.

Absent preferences inherit **On**: allow currently eligible behavior, not permission
to bypass clinic, template, provider, contact or membership restrictions. Personal
**Off** affects only that event/channel. In-app appointments/queue categories, and system updates
for administrators, are separate from outbound Email/SMS. Hidden categories are
excluded from unread counts and Mark All as Read without deleting history or
changing existing read markers.

The existing policy endpoint still saves the overall gate transactionally, including
pending-unclaimed cancellation safeguards. Row switches use the existing
revision-protected activation endpoint. Both paths refresh the same saved views.
No page-entry writes, defaults, migrations, inheritance reset or delivery algorithms
are added. Turning a gate off does not turn template switches off. Required security
messages are protected and independent of optional gates. Inherited gate and
activation values are identified separately from explicit overrides.

Clinic Admins retain their owned-clinic overall gate and email wording rights;
they cannot change event activation, SMS, providers or System Admin recipients.
The removed personal-preferences interface is not restored; stored preferences,
inbox enforcement and opt-outs are unchanged and distinct from administration.
Editing locks delivery actions; scope changes ask before discarding unsaved
wording. Saved unpublished drafts survive activation changes. Delivery confirmations
hold the selected scope and revision, block repeated actions and scope changes,
and only acknowledge a successful save after reading the saved state back.

Advanced provider configuration and wording remain secondary:

- `/admin/communication?tab=sms`: notification SMS provider;
- `/admin/communication?tab=email`: the single SMTP editor and confirmed test-email
  flow, plus Diagnostics with saved readiness/source, safe key statuses, refresh and
  a manual connection check. Checks never run automatically on entry and send no
  email. They use saved settings, not unsaved edits; saved configuration changes
  clear old results. A successful connection does not prove inbox delivery;
- `/admin/communication?tab=logs`: outbound history;
- `/admin/templates`: Notifications, with existing accordions, filters and wording drawer.

Legacy Settings `area=sms`, `area=email`, `area=smtp`, `area=events` and `area=templates`
links still redirect to the corresponding existing pages.

Platform settings, Integrations (including storage and Twilio OTP), reference data,
audit and demo management remain available. Legacy `area=templates`, `/admin/templates`
and `/admin/integrations` links still work. Clinic Admins retain their existing
owned-clinic email template editor; they cannot read global credentials, change SMS
or Event controls, or send template tests. API authorization is independent of menu visibility.

Platform contains only its existing preferences, not an embedded Integrations panel.
Integrations links email users to Communication → Email Settings; it no longer
offers SMTP editing or test sends. Twilio authentication and storage controls remain
in Integrations. Operational SMS Settings and Notification Logs remain in Communication.

Optional operational SMS templates start **off**. Required security events are
separate: patient SMS login is existing-account-only; optional registration phone
proof and staff setup notices require approved published security SMS content.
See [the five-scenario report and operating guide](registration-setup-notifications.md).
Configuring a provider, saving a draft,
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

These are **not** `OTP_PROVIDER` or `TWILIO_*`: existing Twilio mobile verification
remains unchanged. Registration's separate intent-bound optional phone code uses
the existing notification SMS transport with approved platform security content;
it never replaces email proof or creates a phone-only identity.
SMTP website/vault fields retain `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, write-only
`SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE` and `SMTP_REQUIRE_TLS`. Server environment
configuration uses the same `SMTP_*` names (including optional sender name and notification
flag); `DIGI_SMTP_*` values are ignored without fallback. Saved encrypted settings take precedence.
See `integrations-configuration.md` for defaults and explicit source switching.
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
appointment doctor and assigned receptionists. Clinic onboarding supports the
owning Clinic Admin and the platform Superadmin group. Unsupported combinations
are not presented.

Effective published precedence is:

1. clinic-published override, including explicit `enabled: false`;
2. platform-published content and activation;
3. existing email defaults, or SMS defaults (all disabled).

The shared platform gate still defaults to **false**. Existing clinic overrides
and explicit published opt-outs are retained. A checked personal or published
checkbox does not establish delivery eligibility. Provider readiness is a
configuration check, not proof of provider acceptance or delivery.

Personal opt-outs are enforced during capture (including the separate patient
booking-confirmation path) and again inside the durable dispatch claim. Linked
patient accounts are resolved from saved relations; unlinked guest contacts keep
their existing behavior. Opt-out cancels matching pending jobs and advances a
durable channel/event epoch. Re-enabling affects new occurrences only, never old
skipped/cancelled jobs or durable occurrence claims. Already-sending and uncertain
jobs are not recalled or retried. Login OTP, verification, invitations and password
recovery never pass through optional preference enforcement.

Preferences use dedicated namespaced records in the existing PostgreSQL settings
store, not user profile JSON or browser storage. No new database migration or
provider credentials are needed. `/me/notification-settings` derives its owner
only from the authenticated account; `/management/notification-settings` separately
checks real administrator role and current clinic ownership. Gate updates merge
only the notification gate; activation updates preserve unpublished drafts.

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
It also covers personal inheritance, revision conflicts, channel-specific capture,
linked/guest patient confirmation, pending cancellation, required-message exemptions,
in-app filtering/read-state preservation, authenticated self ownership, and two
observed multi-connection PostgreSQL race orderings (capture/opt-out and
dispatch/opt-out). Staff-removal coverage includes owned preference-record cleanup.
The existing integration, notification-template, appointment-confirmation and booking
regressions remain relevant. Frontend checks use fictional identities/providers; browser
checks must not enter credentials, activate clinics or send real recipients.

Notifications-area browser verification used real native sessions for five fictional
roles against a disposable PostgreSQL API, with fake senders and external network
disabled. It checked role navigation, required controls, grouped saving and reload,
one scope-named activation confirmation, patient keyboard operation, unsaved-leave
Cancel/Discard and tablet/mobile layouts. The disposable fixture initially omitted
the existing templates router; after mounting it, authenticated requests confirmed
both owned Clinic Admin template catalogs load. Authenticated request checks also
confirmed new-session persistence, two-choice grouped saving, ordinary-role management
denial and feed/count hide/restore without changing read state.

The earlier wording/provider-editor checks used intercepted fictional responses
for accordion layout, preview substitution, draft/test safeguards and dirty navigation.
No verification used real recipients, provider credential changes or live delivery.
The exact browser request count and all role-by-breakpoint combinations were not
measured; grouped writes are additionally covered by the route tests. None of these
fixtures establish handset/inbox delivery or separately deployed readiness.

Queued reminders tolerate up to five minutes beyond their narrow scheduling window
to account for worker polling and transaction-commit delays. This allowance does not
capture new reminders or replay old events; current status, revision, check-in state,
session timezone and recipient eligibility are still checked before dispatch.

## Keep in Touch endpoint and protected notification history

Superadmin SMS Settings supports a dedicated editable
`NOTIFICATION_SMS_KEEP_IN_TOUCH_URL`. Its absence preserves the existing
`https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS` endpoint.
The Custom API URL/mapping remain separate; switching provider never copies the
generic URL into the preset. Both saved endpoint types are checked for public
HTTPS syntax, and dispatch applies the same DNS/public-address checks, pinned
TLS destination, no-redirect rule, size limit and timeout. No save or check probes
the provider's country-code convention.

Bearer token, body API key, Client ID, Sender ID and explicitly selected
digits/plus country-code format are required independently. Blank protected
fields preserve existing encrypted values. Each enabled event/recipient uses
its effective published wording and DLT Template ID from Notifications.
The preset accepts only HTTP 200 with boolean `success: true`; acceptance is not
handset delivery. Provider and template tests require explicit confirmation and
a UUID request ID. Their permanent claim is committed before transport; identical
requests replay the saved result, changed requests conflict, and uncertain sends
are not retried. Test requests do not enable notification switches or templates.

The existing settings workspace has a deep link:
`/admin/communication?tab=logs`. Its list and detail APIs are
`GET /api/management/notification-logs` and
`GET /api/management/notification-logs/:id`; both independently require a real,
non-demo Superadmin and return `Cache-Control: no-store`. Clinic Admin booking
email history remains separate with its existing visibility restrictions.

History captures prospective Email/SMS decisions for booking, clinic onboarding,
reschedule, cancellation, completion and session-relative reminders, including
the separate patient booking confirmation and explicit provider/template tests.
Disabled configuration/templates/clinic gates, missing contacts, deduplicated
addresses and preparation failures are non-send records, not replayable jobs.
Permanent per-event/channel capture claims prevent polling from reconsidering
skips after policy changes. Operational outboxes and the patient confirmation
claim remain the dispatch authority; a history write failure is contained in a
savepoint and cannot roll back a visit or permit another transport attempt.

Contacts, actual dispatch sender, safe subject/text and effective template
identity/revision/scope/Template ID are AES-256-GCM snapshots, bound to the stable
log ID, using the existing integration encryption key. Each dispatch attempt
retains its protected snapshot; later contact, provider or draft edits do not
rewrite it. Published revisions are tracked separately from unpublished drafts.
Contact searches use keyed HMAC hashes and exact, case-normalized matching.
Credentials, authentication headers, raw provider bodies, HTML and private URLs
are not exposed. Known credential values and all web/private booking links are
removed from rendered text before storage. If a snapshot cannot be protected,
only metadata is retained, with an explicit incomplete-details warning; there
is no plaintext fallback. History is not included in ordinary audit messages,
console diagnostics or browser storage.

Date/time filters refer to occurrence creation time. They accept ISO instants;
the UI explicitly interprets date inputs and displays timestamps in
Asia/Kolkata (IST, UTC+05:30). Other bounded server filters are channel, event,
status, clinic ID, recipient group, automatic/test source, exact sender/recipient
and exact appointment reference. Pagination uses descending creation time plus
stable ID, not offset paging. New indexes support time, clinic/channel and
contact-hash searches; available legacy outboxes have a separate time index.

Historical outboxes are read-only, marked legacy and expose only timestamps and
outcomes actually stored. Missing sender, recipient, rendered content or revision
remain unavailable; today's templates/contacts are never substituted. Legacy
records without a stored creation timestamp are not included in date-paged
history. A sending claim older than five minutes appears as uncertain, including
an abandoned-claim timeline note, without reclaiming or resending it.

**Retention:** the list/detail window is 90 days from creation. The production
worker deletes at most 500 expired protected-history rows per email-worker tick
(30 seconds). This bounds both each cleanup transaction and the read window.
Operational Email/SMS outboxes, booking outcomes, test claims and event-capture
claims are never removed by history retention. They preserve at-most-once
safeguards after detailed history expires. No migration replays old events or
activates clinics/templates.
