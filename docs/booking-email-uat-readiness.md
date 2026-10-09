# Booking-recipient email readiness: UAT

## Decision

**Not cleared for live booking-email activation.** This is a read-only review, not a change request or evidence of message delivery. No templates were published, settings changed, deployment performed, bookings created, or messages sent.

## Observations

- Authorized target: `https://uat.digi-q.in`. A read-only request to `/` returned HTTP 200 and `/api/healthz` returned HTTP 200. `/api/management/templates?recipient=patient` and `/api/settings/integrations` returned HTTP 401 without a session. Health and authentication responses do **not** prove the running UAT code matches this workspace, SMTP is ready, or booking emails are enabled.
- The UAT database, host environment, and authorized administrator session were not available for this review. Replit's managed production database and workspace secrets cannot establish UAT values, especially where UAT may have a separately deployed implementation. No live template, policy, credential, or recipient was inspected.

## Workspace contract to verify against UAT

See `docs/booking-appointment-contract.md`, `artifacts/api-server/src/lib/notification-template-store.ts`, `notification-outbox.ts`, `notification-templates.ts`, `appointment-confirmation.ts`, `integration-vault.ts`, and `integration-config.ts`.

| Check | Expected behavior; UAT status |
| --- | --- |
| `booking/patient` | Default enabled; clinic-published override takes priority over platform-published override, then default. A published disabled override remains disabled. Patient confirmation uses the committed appointment and valid saved patient/account email, with a durable at-most-once claim. **UAT effective template and recipient not verified.** |
| `booking/clinicAdmin` | Default enabled; same published-override precedence. On booking, the outbox targets the current active owning Clinic Admin with a valid email, rechecks ownership/status and template at dispatch, and deduplicates identical patient/admin addresses. **UAT effective template, owner and outbox not verified.** |
| Notification policy | Platform default is `notificationsEnabled: false`; clinic policy can override it. Effective false prevents booking mail and blocks pending outbox sends. Explicit clinic opt-outs must remain authoritative. **UAT platform and each clinic's effective policy not verified.** |
| Content | Default patient confirmation refers to the confirmed booking, visit details and reference; default admin mail includes patient, doctor, visit details and reference. Published content may differ, so each effective preview, enabled flag, source and clinic display format must be reviewed. Session ranges must not be represented as exact consultation times. **UAT effective content not verified.** |
| SMTP | Effective credentials can come from encrypted website settings *instead of* server environment. Presence/syntax checks alone do not establish connection, sender authorization or inbox delivery. Development's automatic outbox worker is off; production runs it asynchronously. **UAT SMTP source, syntax, TLS/authentication, worker, sender rights and inbox delivery not verified.** |

Booking success and ticket validity do not depend on email. Provider acceptance is not confirmed inbox delivery; uncertain dispatch must not be automatically retried. The patient claim and admin outbox are separate, intentional paths. This review does not cover staff password-recovery emails.

## Required owner decisions before any activation

1. **Platform template/policy owner (Super Admin):** sign in to UAT and review the effective platform `booking/patient` and `booking/clinicAdmin` published templates, enabled flags, content and platform notification policy. Explicitly approve any platform publication or enabling; do not silently replace disabled published content.
2. **Each affected clinic's owning Clinic Admin** (or a Super Admin acting with that clinic's approval): review clinic-specific effective templates, clinic policy/opt-out, displayed visit details, and the active owning-admin email. Explicitly approve that clinic's activation. Clinic opt-outs are not overridden by a general platform go-ahead.
3. **UAT operations/SMTP owner, with Super Admin:** inspect the authenticated integration readiness view for the *effective* SMTP source and redacted key statuses, then, with separate authorization, run the non-email SMTP connection/TLS/authentication check. Sender authorization and actual inbox delivery need a separately permitted controlled test email to agreed recipients; neither follows from `healthz` or configuration presence.
4. **Release owner:** confirm which UAT clinics and recipient groups are approved, that the deployed code and worker match the intended contract, and authorize any subsequent change/deployment separately. Use a separately authorized controlled acceptance run before declaring live delivery ready.

**No activation approval was granted in this review.** Leave explicitly disabled published templates and clinic opt-outs unchanged. Do not infer readiness for UAT from Replit deployment metadata, a workspace test, or workspace secret existence.
