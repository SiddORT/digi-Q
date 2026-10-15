# Appointment Email and SMS activation

## Applied scope and evidence

- **Environment:** this workspace's development database, not the separately
  hosted UAT. The user confirmed development-only changes; they push their
  UAT patch through GitHub.
- **Cutover:** 2026-10-15T11:45:49.304Z (17:15:49.304 Asia/Kolkata).
- **Scope:** platform policy plus all nine existing clinics. All ten scopes now
  have their optional delivery gate on and all 30 requested policy combinations
  enabled. Future clinics inherit the platform policies.
- **Before:** platform and all nine effective clinic gates off. Seven requested
  template activations were on; no requested combination was delivery-ready.
- **After:** per scope, 17 combinations are configuration-ready and 13 SMS
  combinations are blocked by absent event-specific DLT Template IDs in this
  development snapshot. Those 13 use built-in, enabled policy defaults; no guarded
  publication was forced, no template registration ID was invented, and no ID
  was copied from another template.
- The operation changed four platform template activation records and no
  provider channel switches. These changes include protection of previously
  gate-blocked, non-target options, so opening the gate does not enable
  receptionist booking or onboarding notices.
- All three originally saved template publications, their branding, metadata
  and drafts were checked by content fingerprints before/after; only activation
  changed. In particular, patient booking and owner booking retain their
  **different** DLT Template IDs.
- A second invocation returned `alreadyApplied: true` and the original cutoff.
  No subsequent administrative choice is reset by later invocations or merges.
- No provider connection check, test message, historical resend, UAT login,
  UAT setting change or deployment was performed.

## Shared communication configuration

Every appointment SMS resolves the **same Keep in Touch configuration managed at
`/admin/communication`**: provider endpoint, API key, separate Bearer token,
Client ID, configured Sender ID and country-code format. No additional sender
or approval mechanism was added. Each template retains its own DLT Template ID.
Keep in Touch does not require or send Entity ID.

Both optional channel switches were already permissive and both configured
providers passed local presence/syntax checks; no provider credentials or
switches were replaced in the applied development operation.

The approved SMS catalog shown in the user's UAT screenshot is not the same
saved data as development. A page lists inherited defaults as well as saved
publications: two saved SMS overrides does **not** mean only two catalog entries.
The initial inventory/reporting conflated these and was corrected. Neither
workspace settings nor the applied receipt are automatically copied into a
separately hosted database by pushing code.

## Redacted completion matrix

The following matrix applies identically to platform and each of the nine
development clinic scopes; no clinic identities or contact details are included.

**Enabled-ready** means enabled policy, open effective gate and local provider /
template metadata readiness, not provider acceptance or recipient delivery.
**Blocked — DLT ID** means the development effective template has no valid
event-specific DLT Template ID. The shared Keep in Touch configuration is present.

| Event | Channel | Recipient | Effective policy | Configuration result |
|---|---|---|---|---|
| Booking | Email | Patient | Enabled | Enabled-ready |
| Booking | Email | Owning Clinic Admin | Enabled | Enabled-ready |
| Booking | Email | Assigned Doctor | Enabled | Enabled-ready |
| Booking | SMS | Patient | Enabled | Enabled-ready |
| Booking | SMS | Owning Clinic Admin | Enabled | Enabled-ready |
| Booking | SMS | Assigned Doctor | Enabled | Blocked — DLT ID |
| Rescheduled | Email | Patient | Enabled | Enabled-ready |
| Rescheduled | Email | Owning Clinic Admin | Enabled | Enabled-ready |
| Rescheduled | Email | Assigned Doctor | Enabled | Enabled-ready |
| Rescheduled | SMS | Patient | Enabled | Blocked — DLT ID |
| Rescheduled | SMS | Owning Clinic Admin | Enabled | Blocked — DLT ID |
| Rescheduled | SMS | Assigned Doctor | Enabled | Blocked — DLT ID |
| Cancelled | Email | Patient | Enabled | Enabled-ready |
| Cancelled | Email | Owning Clinic Admin | Enabled | Enabled-ready |
| Cancelled | Email | Assigned Doctor | Enabled | Enabled-ready |
| Cancelled | SMS | Patient | Enabled | Blocked — DLT ID |
| Cancelled | SMS | Owning Clinic Admin | Enabled | Blocked — DLT ID |
| Cancelled | SMS | Assigned Doctor | Enabled | Blocked — DLT ID |
| Completed | Email | Patient | Enabled | Enabled-ready |
| Completed | Email | Owning Clinic Admin | Enabled | Enabled-ready |
| Completed | Email | Assigned Doctor | Enabled | Enabled-ready |
| Completed | SMS | Patient | Enabled | Blocked — DLT ID |
| Completed | SMS | Owning Clinic Admin | Enabled | Blocked — DLT ID |
| Completed | SMS | Assigned Doctor | Enabled | Blocked — DLT ID |
| Reminder | Email | Patient | Enabled | Enabled-ready |
| Reminder | Email | Owning Clinic Admin | Enabled | Enabled-ready |
| Reminder | Email | Assigned Doctor | Enabled | Enabled-ready |
| Reminder | SMS | Patient | Enabled | Blocked — DLT ID |
| Reminder | SMS | Owning Clinic Admin | Enabled | Blocked — DLT ID |
| Reminder | SMS | Assigned Doctor | Enabled | Blocked — DLT ID |

For every event, capture/dispatch still require eligible active recipients,
current patient/account contacts, current clinic ownership or assigned-doctor
membership, valid destination, personal opt-in and destination deduplication.
Those are per-appointment prerequisites, not a claim that every patient or staff
member currently has a usable contact. Missing prerequisites remain separate
from disabled policy on Notifications.

## Prospective behavior and safety

- The durable activation receipt supplies the cutoff to **all requested**
  resolved templates, including templates that were already enabled but only
  blocked by a gate/channel.
- Unclaimed, pre-cutover target pending jobs are terminally disabled. Old skipped,
  cancelled, sending, uncertain and other terminal jobs are not returned to
  pending. Delayed legacy patient booking confirmations cannot bypass cutoff.
- Reminder capture excludes sessions whose one-hour-before-start instant falls
  before cutover, including a poll in the same minute. Sessions are interpreted
  in their session timezone. Ordinary upcoming reminders remain eligible; the
  existing narrow capture window and bounded dispatch allowance remain intact.
- Capture claims, personal preference epochs, queue/staff dispatch barriers and
  terminal uncertain-outcome behavior remain in the existing infrastructure.
- Email/SMS channel preparation and polling remain independent.
- Receptionist, Superadmin appointment recipient policies, onboarding,
  authentication/OTP/setup messages and personal opt-outs were not activated.
- Production-only automatic workers and all development no-send guards remain.

## Running the development operation

From the repository root:

```sh
# Read-only, redacted policy/metadata inventory (no providers contacted).
NODE_ENV=development node artifacts/api-server/src/appointment-notification-activation.mjs

# Explicit one-time development settings application.
NODE_ENV=development node artifacts/api-server/src/appointment-notification-activation.mjs --apply-workspace-development
```

This command is development-restricted. Do not point it at UAT or production or
change an external server's runtime mode to bypass the restriction. The
development post-merge script invokes this same receipt-protected operation so
the main development workspace receives the authorized settings change after
merge. It is **not** part of application startup.

A separate UAT rollout needs its own authorized settings cutover against that
environment's actual published templates and policies after the user's GitHub
patch process. No UAT configuration readiness is claimed by this report.

The initial/applied redacted JSON inventories are generated under ignored
`generated-artifacts/`; they contain no credentials, template bodies,
recipient contacts or clinic identities.

## Verification

- `node --test --test-concurrency=1` over
  `appointment-notification-activation.integration.test.mjs`,
  `notification-settings.integration.test.mjs` and
  `booking-notifications.integration.test.mjs`: **49 passed**.
- Disposable socket-only PostgreSQL and synthetic credentials only. All sends
  used injected fake transports or isolated fake provider-network responses.
- Covers all 30 combinations, staff/patient/public guest booking parity for both
  channels, reschedule/cancel/completion, timezone reminder timing, contact and
  metadata failures, lost assignments, personal opt-outs, duplicate destinations,
  independent channels, security invariance, draft/content preservation, existing
  explicit off settings, transaction interruption/retry, stale revisions,
  gate-only cutover and later disables surviving reruns.
- The effective Notifications API projection is re-read twice after activation
  in disposable tests. This verifies refresh data, not a signed-in browser view.
- API-server and ClinicFlow TypeScript checks passed; post-merge shell syntax
  passed.
- Eighteen focused frontend notification/communication logic tests passed.
- Configured queue-contention regression: **20 passed** after making its
  communication opt-out explicit. Its deliberately partial patient fixtures
  previously relied on the old default-off gate; production recipient checks
  were not weakened to accommodate them.
- Configured `pnpm test:tickets` browser regression: **78 passed** during task
  completion validation. These fixture-based checks are not authenticated UAT
  access or proof of real delivery.
- Both managed application workflows restarted cleanly, `/api/healthz` returned
  `{"status":"ok"}`, and the app preview rendered the expected sign-in boundary
  without browser errors. The screenshot does not verify the signed-in settings
  view; that view's refreshed data was verified through the shared API projection.

The PostgreSQL test driver reports an existing queued-query deprecation warning;
it did not prevent assertions from running. Deliberate fault-injection tests
emit expected history/preparation warnings. No real delivery was tested.
