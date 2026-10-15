# Appointment Email and SMS activation

## Current development registration result — 2026-10-15

This section supersedes the initial 17-ready/13-blocked snapshot below. The user
supplied full wording and template-specific DLT IDs, chose **11 supported appointment
SMS combinations with four unsupported combinations off**, and requested that all
15 appointment email defaults be saved unchanged in the database. The source's
older “approval pending” header was not independently verified against a provider;
approval relies on the user's explicit confirmation. No provider was contacted.

- **Applied:** 2026-10-15T12:27:14.519Z (17:57:14.519 Asia/Kolkata), development only.
- **Storage:** existing `settings.data` JSON, keyed by
  `notification-template:platform:<event>[:<recipient>]` for email and
  `sms-template:platform:<event>[:<recipient>]` for SMS. Patient is the omitted
  recipient suffix for appointment events. `published` is used for dispatch;
  `draft` remains separate. No new table, provider account or dispatch path.
- **Email:** 15 platform publications created from the exact effective built-in
  defaults. The existing receptionist email publication was retained, not duplicated.
- **SMS:** nine supported publications created; the two existing booking
  registrations retained their original IDs. Patient booking wording was aligned
  with the supplied full registered text: the old stored text omitted the date and
  differed in punctuation/spacing. Clinic Admin booking wording was already exact.
- **Unsupported SMS:** four explicit off publications prevent broad built-in
  enabled defaults from making staff reschedule/reminder messages appear active.
- **Readiness:** platform and each of nine clinics have 26 configuration-ready
  combinations (15 email + 11 SMS), four explicitly off SMS combinations and no
  other configuration blockers. Configuration-ready does not prove contact
  eligibility, provider acceptance or delivery.
- **Provider settings:** unchanged, including encrypted credentials and switches.
  All templates use the existing shared Keep in Touch configuration. No per-template
  sender/account was introduced; each registration retains its supplied DLT ID.
- **Safety:** existing prospective activation is reused atomically. New/aligned
  publications have a prospective cutoff. Historical jobs are not replayed,
  uncertain outcomes are not retried, and development automatic sends remain off.
- **Reruns:** a separate durable registration receipt makes later invocations
  non-mutating, preserving subsequent edits and opt-outs.

### Current redacted readiness matrix

Each cell names the recipients for that event/channel. “Off” is intentional and
does not mean a missing registration was invented.

| Event | Email: Patient / Clinic Admin / Doctor | SMS: Patient | SMS: Clinic Admin | SMS: Doctor |
|---|---|---|---|---|
| Booking | Ready / Ready / Ready | Ready | Ready | Ready |
| Rescheduled | Ready / Ready / Ready | Ready | Off — no supplied registration | Off — no supplied registration |
| Cancelled | Ready / Ready / Ready | Ready | Ready | Ready |
| Completed | Ready / Ready / Ready | Ready | Ready | Ready |
| Reminder | Ready / Ready / Ready | Ready | Off — source is patient-only | Off — source is patient-only |

The shared **team booking** registration legitimately covers Admin and Doctor
using identical approved wording. Team cancellation and completion likewise share
their own event's ID. No booking ID is copied to another event. Patient reschedules
use the supplied reschedule registration and updated appointment date/session
start, not a “new booking” notice. Time variables refer to clinic-formatted session
times; the approved text was not rewritten into a guaranteed consultation time.
Receptionist SMS, onboarding, login/registration OTP and security templates remain
outside this operation.

### Maintenance and verification

```sh
# Read-only, redacted inventory; no network/provider calls.
NODE_ENV=development node artifacts/api-server/src/appointment-template-registration.mjs

# Explicit atomic development application; later runs return alreadyApplied.
NODE_ENV=development node artifacts/api-server/src/appointment-template-registration.mjs --apply-workspace-development
```

The development post-merge script runs the second command. The source manifest is
maintenance input only, never a new runtime fallback or application-startup seed.
The operation fails atomically on stale configuration, conflicting existing DLT
IDs, unavailable shared provider configuration or audit failure. It reuses the
ordinary template publication schema, scope authorization and SMS metadata
validation; it preserves drafts and existing email/clinic publications.

Focused tests cover exact supplied text/IDs, all 30 publications, four off targets,
preserved drafts/branding/providers, post-import page projection/inheritance,
non-development rejection, stale configuration, late rollback and rerun safety.
Injected fake transports exercised 26 eligible deliveries and repeat-poll
deduplication in disposable PostgreSQL only. No real message or UAT write occurred.
All 54 focused activation/settings/booking tests passed across the verification
runs, as did the shared-library build and API-server TypeScript check. A development
rerun returned `alreadyApplied` and a complete settings fingerprint stayed unchanged.
The API workflow restarted cleanly and its health endpoint returned `{"status":"ok"}`.
The UAT HTML was useful status evidence but contained truncated previews and no
actual registration IDs. The full user-supplied text, not that HTML, provided the
approved registration mappings.

## Historical activation evidence

The remainder records the earlier activation operation and its initial catalog
snapshot. It is not the current readiness result.

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
