# Compact administration and management

## Workspace
The staff workspace uses a compact header/sidebar, grouped toolbars, dense tables and accessible help disclosures. Appointments show their bulk-action bar only with selected rows. Large resource dialogs use wider two-column layouts; long custom-role and template editors remain inline. Mobile layouts preserve scrolling and touch targets.

## System users and roles
Administration → System users is a staff-only directory, with search, role, status and clinic filters and pagination. Patients remain in their existing module; linked identities and existing staff-management workflows are not converted or deleted.

Roles & permissions retains platform baseline restrictions and adds named custom roles. A custom role inherits a Clinic Admin, Doctor or Receptionist base role and can remove capabilities, not bypass built-in ownership or workflow checks. Only active staff with the matching base role can receive it. Assignments apply either across that user's existing scope or to one clinic they already belong to. Multiple denials combine; Super Admin cannot be restricted. Assigned roles must be removed before deleting their definition. Saves use revision checks and audit records.

System users → Permissions shows effective baseline/custom-role restrictions and their sources. Select a clinic to include clinic-specific assignments. “Not restricted” is not a guarantee of access to a particular record: existing ownership and workflow rules still apply. Where an operation cannot safely establish a clinic scope, a clinic restriction fails closed rather than being ignored.

## Recipient templates
Templates are separate by event, recipient group and platform/clinic scope. Patient templates remain the default for appointment events; clinic onboarding belongs to the clinic owner. Additional clinic-admin, appointment-doctor and assigned-receptionist recipients are initially disabled. Publishing an enabled template opts that channel into actual production delivery, subject to notification settings.

Drafts do not affect sending. Clinic publication overrides the same platform event/recipient; resetting restores inheritance. The queue checks current staff membership before dispatch and deduplicates repeated event enqueueing and shared staff addresses. Unknown SMTP outcomes are never blindly retried. Booking patients retain their existing durable confirmation path. Development does not run automatic delivery.

## Integrations
Select Email/SMTP, SMS/Twilio or Storage. Unsupported providers are not presented as working integrations.

Saved encrypted administrator credentials replace the whole environment configuration for that service at runtime. Blank secret fields preserve the existing value when saving; switching to Environment removes the saved override. An unreadable encrypted record fails explicitly—there is no silent environment fallback. Credential changes require the current administrator password; API responses expose configuration status, not secret values.

Storage remains configured in the private server environment, as required by the storage design: MEDIA_STORAGE, MEDIA_ROOT and MEDIA_URL for persistent local hosting, or existing private object-storage configuration. Switching defaults does not migrate uploaded files. Do not use ephemeral deployment disk for durable uploads.

Connection checks perform SMTP TLS/authentication, Twilio account/service reads, or storage object-permission/filesystem-access checks. Object-storage permission probes check read/create permissions without requiring unrelated bucket-administration metadata access. They do not send messages, upload objects or prove end-to-end delivery. Each result separates Passed, Failed and Not verified. The SMTP test email requires an explicit confirmation checkbox and reports provider acceptance, not inbox delivery.

Operators can run `node scripts/check-integrations.mjs` for all read-only checks, or append `smtp`, `sms` or `storage` to check one service. It uses the application's effective configuration and prints only configuration-key status and sanitized results, never credential values.

## Verification boundary
Database/HTTP tests use disposable PostgreSQL and fictional data. Browser acceptance uses intercepted fictional identities and responses, not the creator's signed-in UAT browser. These checks do not certify live SMTP/Twilio delivery or UAT deployment configuration. No production migration, account reset, publication or real test message was part of this change.

### Acceptance evidence
- Local browser checks covered all 20 administration destinations, available create dialogs, assigned-role deletion with acknowledgement, recipient-specific template drafts/publication and retained edits after a conflict.
- Integration controls covered SMTP/Twilio credential masking, read-only checks for each service, explicit SMTP-send confirmation, retained configuration fields/cleared password after a conflict, and acknowledged restoration of environment settings.
- Clinic Admin checks covered redirects away from platform-only management and clinic-scoped template draft saving. The template editor was also checked at 390px with its actual form loaded.
- These were focused local reruns after correcting test-fixture response shapes and locators; they are not a claim that the initial remote browser run completed successfully. Screenshots are under `screenshots/management-acceptance/`. The reusable intercepted runner is `node scripts/management-browser-check.mjs`; `CHECK_FILTER` selects a focused scenario.
- Read-only checks against the configured services verified SMTP TLS/authentication and storage object-read/create permission grants. No actual object was uploaded. Twilio was unconfigured; website credential editing was locked because the integration encryption key was absent. Real email delivery still requires an explicitly approved recipient and send, and published-account UAT remains separate.