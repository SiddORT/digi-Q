# Approved management and uniform-controls scope

This is an implementation tracker, not a release certificate. The full approved
40-item scope is **not complete**. Existing functionality is not counted as new
work merely because it remains present.

## Current batch

| Area | Implemented in this batch | Remaining boundary |
|---|---|---|
| Navigation | Explicit clinic, location, user/staff, template, access-rules, integration and audit destinations for Super Admin; clinic templates for Clinic Admin | Unified all-user directory and full per-action effective-permission screen remain |
| Ownership | Super Admin can edit a self-owned Admin-doctor profile without reassigning its identity or ownership | Full transfer/deactivation acceptance matrix not newly certified |
| Phone entry | Country selector, national number, international paste, local formatting and country-aware validation | Full browser/caller acceptance required; server retains its existing international-format contract |
| Status controls | Shared active/inactive switch in staff and generic user editing/listing | Other binary settings and all control states still need complete inventory |
| Date inputs | Shared clinic-aware controls replacing selected native fields | Exhaustive every-channel date/time audit remains |
| Templates | Six predefined events; platform defaults and owner-scoped overrides; drafts, publish, reset, revisions, audit, safe rendering, readable previews | Logos use HTTPS URLs, not uploaded files; independent prefix/footer per template, not a global clinic brand editor |
| Delivery | Published booking template used by the existing booking-confirmation path | Onboarding/rescheduling/cancellation/completion/reminder automatic dispatch and durable scheduled outbox are not implemented |
| Permissions | Visible fixed-policy summary; existing backend scope checks retained | No configurable permission grants; not a full dynamic permission matrix |

## Original 40-item reconciliation

- **1:** Navigation implemented for available management modules.
- **2–6:** Existing user actions/safeguards retained; unified directory, detailed effective permissions and configurable permissions remain incomplete.
- **7–9:** Existing ownership/solo/staffed models retained; no new claim of complete live acceptance.
- **10:** Super Admin self-owned-doctor editing restriction adjusted; all mapping scenarios still require acceptance.
- **11:** Existing preservation/transfer guards retained, not rewritten.
- **12–15:** Shared phone implementation changed; final caller/browser verification is part of this batch.
- **16:** Universal email component/security email-change workflow not implemented in this batch.
- **17:** Date/time consistency improved, not declared globally complete.
- **18:** Existing administrator-only clinic configuration guards retained; timezone impact-review expansion remains.
- **19–21:** Template module, platform variables and clinic ownership implemented.
- **22:** Per-template logo URL, prefix and footer implemented; uploads and global branding remain.
- **23–24:** Clinic-readable previews, draft/publish/reset and validation implemented.
- **25:** Escaping, variable allowlist, URL validation and audit implemented; upload constraints are pending with uploads.
- **26:** Existing booking-confirmation pipeline resolves published template overrides.
- **27–31:** Editable predefined content exists; automatic event dispatch/reminders are pending.
- **32:** Durable outbox, retries, scheduling and obsolete-reminder cancellation are pending.
- **33–35:** Existing compact toolbar/context/draft patterns retained; complete caller standardization remains.
- **36:** Expanded setup readiness and duplicate-patient warnings are pending.
- **37–39:** Verification is scoped to changed code and reported results; not all-role or production certification.
- **40:** Full 137-point release checklist remains open; this tracker does not replace it.

## Safety boundaries

- No live messages, account resets, secrets changes, production queries/migrations or publishing.
- Template changes use the existing settings store, isolated keys and transactionally
  audited revisions. No additional application-table migration is needed for this batch.
- Drafts do not affect sends. Publishing template content does not enable a disabled
  notification channel, introduce new automatic event dispatch, or change SMTP sender identity.
- SMTP acceptance is not inbox delivery. Unknown delivery outcomes are not automatically resent.
- Clinic admins cannot edit another owner's templates or platform defaults.
- An external logo is loaded in editor preview only after an explicit click.
- Clinical/ownership restrictions and printed ticket/QR geometry must remain intact.

## Verification evidence for this batch

- Self-host build and workspace type checks passed.
- Combined serialized regression run: 394/402 passed initially. The eight failures
  were addressed; affected frontend files passed 83/83 and the affected backend
  ownership file passed 6/6 on focused reruns. These are not a second full-suite result.
- Notification tests use disposable PostgreSQL for real persistence, inheritance,
  ownership rejection, revision conflicts, resets and audit records.
- One browser pass verified template payloads/actions, error retention, scoped
  navigation/previews, international phone payloads and a 390px guest layout.
  Authentication, catalogs and writes in that pass were intercepted fixtures;
  it does not prove live-account access or end-to-end template delivery.
- Browser-reported stale mutation alerts on explicit reload were corrected, along
  with guest-phone guidance left over from the previous international-only field.
- No production deployment or real message delivery was attempted.