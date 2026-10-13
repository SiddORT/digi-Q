# Superadmin permanent user deletion — approval plan

## Status and authorization

**Planning only. Implementation is not approved.** This document records a source-code inventory and a proposed design, not a working deletion feature or a production-data audit. No application code, schema, credentials, provider configuration or user data is changed by this deliverable.

The approved data boundary is **user-owned data only**. Delete the staff login account and exclusively personal data. Preserve clinics, branches, patient profiles, appointments, clinical documents, shared operational history and other staff accounts. Never reinterpret the existing resource DELETE endpoints: those remain deactivation operations for their existing scoped roles. Native PostgreSQL authentication remains authoritative, including database revocation for native and optional JWT cookie modes.

Implementation may begin only after explicit approval of this plan. All implementation validation must use disposable fixtures, stubbed delivery and isolated storage, never production/UAT records or live provider sends.

## 1. Inventory and disposition

The following inventory is based on the current schema and application writers/readers. Counts must be calculated for the selected account at runtime; this plan does not invent counts or assume cascading deletes.

| Data/reference | Current evidence | Proposed treatment |
| --- | --- | --- |
| Staff account | `users`: credentials, legacy provider ID, contacts, profile JSON, invitation state | Physically delete. Do not leave a disabled authenticatable tombstone or transfer its actions to another account. Patients are not eligible targets. |
| Sessions and challenges | `auth_sessions`, `auth_challenges`, `otp_challenges`; credential locks in `native-auth.ts` | Delete target-linked rows, including consumed/expired challenges. Identify account-exclusive unlinked setup/reset challenges by known purpose and address; do not indiscriminately delete another patient's/registration challenge because its contact matches. |
| Legacy session proofs | `staff_session_proofs.clerk_user_id`, no FK to users | Remove proofs matching the target's legacy provider ID before removing the account. No provider reintroduction. Unknown legacy mappings must be resolved or block the operation. |
| Assignments and read markers | `assignments`, `notification_reads` | Delete only the target's rows. Keep all other staff assignments and shared history generating the notifications. |
| Personal UI state | `workspace:<userId>` settings; saved listing views and browser state | Remove private views and personal workspace/preferences. Preserve role-shared views as anonymous shared records; shared-view ownership must become nullable with explicit deleted-owner state. Remove target IDs from structured shared filters where safe, without granting broader scope. |
| Custom roles | `settings["custom-roles"].bindings` | Remove only target bindings and advance the revision under the same lock used by role saves. Keep role definitions and other bindings. |
| Clinic responsibilities | `clinics.admin_id`, `clinics.owner_id`; ownership/assignment guards in SQL migrations | Block until actual ownership is explicitly transferred. Preserve clinic and branch rows. Classify legacy `owner_id` semantics before deciding it is historical attribution; unresolved ownership is a blocker, not permission to null it. |
| Other staff responsibility | `users.managing_admin_id`, `doctors.owner_admin_id` | Block while target manages other users or doctors, including inactive/unassigned dependents. Do not silently transfer or null operational ownership. A self-owned consulting profile can be retired with its own account after all other responsibilities are transferred. |
| Linked clinical profile | Unique, currently non-null `doctors.user_id`; profile JSON, specialization, owner | Retain the stable doctor ID as a retired anonymous clinical reference, detach login, remove private biography/contact/photo/address/qualification metadata and exclude it from operational directories. Never reuse its ID for a different doctor. |
| Patient profile linked to a staff account | Nullable `patients.user_id`, demographic/clinical JSON | Preserve the patient record and clinical data; detach the account link. Any genuine patient demographics are retained patient data, not staff-account metadata. Unexpected dual-role mappings require explicit classification before eligibility. |
| Shared appointment creator/action references | `appointments.actor_id`, `appointment_history.actor_id`, `guest_requests.decided_by` | Preserve visits, history, receipts, statuses, token numbers, references and clinical content; detach actor links with explicit anonymous attribution. No deletion merely because the staff member created or acted on the record. |
| Clinical document uploader | `patient_documents.uploaded_by` is non-null; bytes in local/object private storage | Preserve document bytes, access policy and document records. Detach uploader and display “Deleted user.” Do not delete a document because the target uploaded it. Sanitize uploader-derived application metadata only, not clinical content. |
| Audit evidence | `audit_logs.actor_id`, entity ID, summary; source SQL and activity displays | Erase proven personal authentication-only activity; preserve shared business/security evidence with anonymous actor/target references. Do not treat every event by the target as personal. Explicit event taxonomy required. No contact or profile snapshot in the new deletion audit record. |
| Doctor availability and links | `schedules`, `availability_exceptions`, doctor-scoped `qrs`; branch `linkedSchedule` JSON | Remove exclusive availability/exceptions and disable/remove doctor-specific booking QR links. Preserve clinic-wide and branch-wide links. A branch's linked-hours dependency blocks deletion until explicitly unlinked; never silently rewrite shared opening hours. |
| Doctor operational work | Unresolved appointments, pending guest requests, presence/session data | Block for any nonterminal visit (`booked`, `checkedIn`, `waiting`, `called`, `inConsultation`), including overdue unresolved visits, and pending doctor-specific guest requests. Block active consultation, outstanding operational obligations or active linked-hours dependencies. Historical terminal visits remain. |
| Queue/session bookkeeping | Duration, presence and token-counter JSON settings keyed by doctor/session | Preserve historical duration/token bookkeeping needed to read visits and maintain queue integrity. Anonymize actor references; remove only proven future/exclusive state after blockers are resolved. A doctor ID inside a key does not make the row disposable. |
| Registration receipts | `clinics.data.registrationReceipt` stores actor, request and input digest | Preserve clinic; erase obsolete target-owned personal receipt fields or replace with anonymous completion metadata. Do not retain private profile hashes as anonymous evidence. Preserve retries for other actors. |
| Email/SMS queues | `mail-outbox:*`, `sms-outbox:*` settings, recipient IDs/contact hashes, visit snapshots and previous details | Stop pending delivery to the target. Sanitize target identity in retained shared visit notifications, including previous-session/previous-details text. Preserve occurrence/deduplication claims so cleanup cannot trigger a resend. |
| Recipient history | `notification-history:*`, encrypted main snapshot and snapshot arrays, keyed contact hashes | Remove target's personal recipient details; retain anonymous shared outcome/timeline evidence. Sanitize doctor attribution in other recipients' application-held snapshots. Never log decrypted content. Unclassifiable/unreadable encrypted identity-bearing data blocks clean completion. |
| Notification/test metadata | Notification occurrence claims, test-dispatch records, template revision/publisher metadata, ticket-email claims | Inventory known writers and sanitize target references without erasing shared template content, deduplication or unrelated recipients. No deletion based solely on a matching substring. |
| Media registrations | `logo:*` settings with `ownerId`, `clinicId`, object/raw/validated paths; HTTPS image links | Uploader is not proof of exclusive ownership. Keep shared clinic/template logos and anonymize uploader metadata. Erase only proven exclusive unused uploads; check every shared reference to both raw and validated object variants. Do not delete remote HTTPS resources. |
| Abuse-protection state | `auth_rate_limits` hashed keys | Remove only derivable account-exclusive keys. Keep shared IP/security limits; never clear the table or weaken unrelated account protection. |
| Cached names and generated output | React Query, selected-name/directory caches, storage and client-generated/downloaded tickets | Invalidate shared observers and exact-label caches; server reads and newly generated downloads must use anonymous attribution. Previously downloaded client files cannot be recalled. |

### Inventory completeness gate

Before coding cleanup, produce an explicit reference registry covering each FK, JSON path/key family, encrypted payload, file reference and name-producing read path. Cross-check against `core.ts`, all applied SQL migrations (including handwritten triggers), all settings writers and serializers. Inspect only isolated fixtures for legacy variants. Unknown target-linked data must be reported as a blocker, not silently retained or deleted.

Relevant additional surfaces under `artifacts/api-server/src` include `lib/list-query.ts`, `lib/entities.ts`, `lib/clinical-membership.ts`, `lib/appointments.ts`, `lib/appointment-confirmation.ts`, `lib/session-duration.ts`, `lib/notification-history.ts`, `lib/notification-test-dispatch.ts`, `lib/notification-template-store.ts`, `lib/registration-completion.ts`, `routes/patient-records.ts`, `routes/workspace-features.ts`, `routes/logos.ts`, `routes/public.ts`, `routes/guest-requests.ts`, `routes/presence.ts`, and `routes/duration.ts`.

## 2. Anonymous history and schema proposal

Use **nullable identity references plus explicit deleted-identity state**, not a synthetic users row and never a real replacement actor.

1. Allow null creator/actor/uploader references on retained appointments, appointment history, documents and shared saved views. Existing nullable audit/guest references need explicit deletion attribution to distinguish “Deleted user” from a system/unknown actor.
2. Add a retired/deleted identity marker to doctors, permit a null login reference only in that state, and enforce inactive/no-operational-assignment invariants. Keep ordinary active-doctor ownership requirements. If a consulting admin retires their self-owned profile, allow its owner link to be detached only for that retired profile; other managed profiles remain blockers.
3. Amend the existing deferred ownership functions/guards narrowly for retired profiles. Preserve exactly-one-clinic-admin rules and ordinary active doctor/staff validation. Add migrations; do not rewrite historical migrations, disable triggers globally or use broad cascades.
4. Update SQL projections and object enrichment together. `enrich("doctors")` currently requires a user lookup; several history/notification projections join users directly. Retired doctor reads must succeed without that account and return **“Deleted doctor”**; explicit deleted actor/uploader reads return **“Deleted user.”** Preserve existing role privacy rules (do not expose actors to patients where currently hidden).
5. Staff/public doctor directories and selected-ID hydration must exclude retired identities from eligibility, even with explicit inactive/ID filters. Historical appointment/report filters need a separate anonymous historical projection so retained visits remain readable.
6. Sanitize authoritative doctor/actor snapshots at known application JSON paths, including rendered notification text and current/previous confirmation snapshots. Do not globally replace names across patient medical notes: that can corrupt clinical content or change another person's name.

**Clinical-content limitation:** a clinician's signed name inside a preserved uploaded PDF or medical narrative is part of the retained clinical document, not merely an uploader/doctor reference. The plan preserves that content. The confirmation must not promise those bytes are scrubbed. If the requirement is literal erasure of every name inside clinical content, it conflicts with preserving documents unchanged and requires a separate user decision before implementation. Application-generated attribution, filenames derived from the staff profile and metadata remain in scope for anonymization.

## 3. Proposed protected API contract

Introduce dedicated routes under the existing Superadmin-only management namespace; do not repurpose `DELETE /users/:id` or `DELETE /doctors/:id`.

- `GET /management/system-users/:id/deletion-impact`: authenticated active Superadmin/session proof, `Cache-Control: no-store`. Return target identity/role/status, eligibility, safe blockers with resolution guidance, counts by remove/anonymize/preserve category, verified exclusive-storage counts, exclusions and a short-lived opaque review token. Do not return credentials, storage keys, recipient contacts or decrypted messages.
- `POST /management/system-users/:id/permanent-delete`: CSRF-protected, strict body `{ confirmation: "delete", reviewToken, requestId }`. Exact equality without case folding, trimming or coercion. Authorize again inside the transaction; a revoked/inactive/demoted actor cannot rely on earlier middleware approval.
- `GET /management/user-deletions/:operationId`: Superadmin-only receipt/status for ambiguous responses or storage cleanup pending. Minimize stored receipt metadata; no deleted full name/email/mobile/legacy provider ID or credentials.

Review tokens are actor/target scoped, server-generated and expire; they are not authorization. Bind them to a canonical manifest of exact affected rows, revisions/content hashes, blocker evidence and exclusive file references, not just category totals. Two different records can have equal counts. Bind target profile/role/status and last-active-admin/ownership eligibility as well. Recompute under locking before write; return `409 DELETION_REVIEW_REQUIRED` and clear confirmation on any changed impact or eligibility. Counts and labels must come from the same fresh snapshot.

Suggested error categories: `DELETION_SELF_FORBIDDEN`, `DELETION_LAST_SUPERADMIN`, `DELETION_OWNERSHIP_BLOCKED`, `DELETION_DOCTOR_WORK_BLOCKED`, `DELETION_IMPACT_UNAVAILABLE`, `DELETION_REVIEW_REQUIRED`, `DELETION_ALREADY_IN_PROGRESS`. Return actionable safe text, not raw database/provider errors. Anonymous actors receive 401; authenticated non-Superadmins receive 403 before seeing impact.

Store one receipt per actor/request/target binding. Same request replays only that operation/status; a different request after deletion returns an explicit already-removed/not-found response with no new cleanup. Reject request-ID reuse for another target. Receipt retention must not recreate a private identity directory.

## 4. Atomicity, races and delivery boundary

### Database operation

Acquire a documented common lock order and revalidate the current actor/session, target and impact. Reuse `super-admin-protection` for all deletion/deactivation checks affecting active Superadmins, the `auth-credentials:<id>` boundary for login/reset/invitation issuance, and assignment/doctor/schedule/queue locks as appropriate. Lock target and actor rows and shared JSON rows before mutation.

Advisory locks only protect cooperating writers. Add narrow database-backed retired/deletion guards and make affected writers participate: profile edits, ownership transfers, assignment creation, doctor booking/guest capture, queue actions, schedule edits, logo uploads, custom-role saves, native session/challenge creation and notification preparation/dispatch. Foreign keys alone do not prevent a new booking against a preserved retired doctor. Serializable transactions with bounded serialization/deadlock handling are an additional protection, not a replacement for these guards. A retry must recompute the manifest and must never silently accept a newly broadened impact.

In one database transaction:

1. Reject self-delete, patient targets, final active Superadmin, responsibilities and unresolved doctor work.
2. Verify the exact confirmation and reviewed manifest; reject stale review without writes.
3. Stop target-specific pending delivery and sanitize shared actor/doctor/recipient data.
4. Delete only exclusive auth/challenge/proof/assignment/read-marker/preferences/private-activity rows and remove custom-role bindings.
5. Retire the linked doctor, remove exclusive availability and doctor booking links, detach retained actor/uploader/patient-account links, and anonymize historical application metadata.
6. Physically delete the user account. Write a minimal anonymous deletion audit and operation receipt/file-cleanup manifest.

Any precommit error rolls back all database changes. Cleanup operations must not swallow integrity errors.

### Notification and authentication races

Current email/SMS workers commit a `sending` claim before sending, then write a completion snapshot from memory. Merely deleting pending rows cannot stop an in-flight send and that completion can restore erased identity data.

Implement a per-recipient dispatch barrier that spans claim through provider completion and is also acquired by deletion; all sends to staff, including invitation/reset sends and notification test delivery, must use it. Lock ordering must avoid credential/dispatch deadlocks. Obtain bounded exclusive barriers before cleanup, recheck current account and operation state immediately before dispatch, and prevent late worker completions from restoring private snapshots. Use conditional updates against current operation/revision state, not unconditional replacement from stale memory.

If dispatch is active or an uncertain claim cannot be safely reconciled, block deletion with guidance rather than claiming no later delivery. A provider-accepted message may reach an inbox after deletion and cannot be recalled; disclose this limitation. Native/JWT sessions, setup/reset/device challenges and legacy proofs must all be ineffective after commit, and concurrently issued credentials must serialize with deletion.

### External file cleanup: explicit two-phase result

PostgreSQL cannot atomically roll back local/object storage deletion. Do not remove bytes before database commit: a rollback could otherwise lose a shared file. Do not use the existing `removeDocument` behavior for a permanent-erasure worker because it suppresses all storage errors.

- First commit account removal/anonymization with a durable, restricted, exact exclusive-file cleanup manifest.
- Then clean only verified exclusive assets through strict removal helpers: verified not-found is idempotent success; permission, network and filesystem errors are retryable failures.
- Return **completed** only when exclusive storage cleanup is verified. If it fails after commit, return **account removed; personal file cleanup pending**, not a generic “failed, unchanged” response and not unqualified success. Block access immediately; retries resume the same operation rather than repeating deletion.
- Manifest status must expose safe counts/errors to Superadmins, not raw paths or identity. Retain restricted storage locators only until cleanup completes. Conditional completion writes must not reintroduce erased JSON.
- Preserve patient-document bytes and shared logos regardless of uploader. Outstanding signed upload URLs may remain usable until expiry: disable application finalization, track expiry and recheck exclusive object cleanup after that window before claiming completion. External HTTPS assets are excluded.

This explicitly separates database rollback failures (unchanged account/data) from postcommit storage failures (account already removed, cleanup visibly pending); the UI must not promise an impossible cross-system rollback.

## 5. Confirmation and entry points

Use one shared deletion action/dialog component from System users and existing Superadmin staff listings/drawers, including embedded Clinic Staff screens. Doctor rows resolve their linked account ID; do not send a doctor ID to the user endpoint. Other roles receive no action and remain forbidden at the API. Retired historical doctors receive no edit/invite/schedule/delete-account action.

The distinct labeled destructive action is **Delete user**, not the activation switch or existing generic Delete/deactivation action. Its dialog:

- Identifies the freshly loaded target by name, email and role.
- Loads impact on every open; loading/error/blocked states cannot submit. Retry reloads the review and clears typed confirmation.
- Separates **Removed**, **Anonymized**, **Preserved**, **Cannot erase externally**, and **Must resolve first** sections with server counts and categories.
- Explains permanent loss of login access, no undo, no automatic ownership transfer and no cancellation/deletion of patient visits.
- Requires the exact lowercase word `delete` in a labeled input; reject `Delete`, `DELETE`, spaces, other words and empty input on client and server. Never auto-fill it.
- Clears confirmation and requires fresh review when target/impact changes or after a conflict. Do not automatically submit after refreshing.
- Uses focus trapping, descriptive accessible title, error/status announcements, initial focus on safe/cancel controls, keyboard operation, visible disabled state, mobile scrolling and focus return to the trigger.
- Cancel/Escape before submission causes no deletion. During submission prevent double clicks, Enter re-entry and misleading cancellation; an ambiguous response offers Check status rather than submitting a new operation.

Suggested warning: “This permanently removes this staff account and the personal data listed below. They lose login access immediately when account removal commits. Shared clinics, patients, appointments and clinical documents remain, with application attribution shown as Deleted user or Deleted doctor. Resolve the listed responsibilities first. There is no undo. Already-delivered messages, external-provider logs, backups and previously downloaded files are not erased; preserved clinical documents are not rewritten.”

## 6. Refresh and privacy verification

On database removal, cancel outstanding target reads and purge target identity caches before invalidation so stale results cannot repopulate labels. Refresh system/staff lists and counts, role bindings, assignments, effective permissions, exact drawers, search results, ResourceLookup/CareLookup/selected-label caches, public discovery/QR contexts, notifications, patient documents/history, appointments/reports/ticket generation. Keep current filters and clamp empty pages.

Deletion receipts may show pending cleanup, but staff directories must stop displaying the removed account as soon as account removal commits. Historical visits/documents remain accessible within unchanged permissions with anonymous attribution. Verify both direct enrichment and SQL projections; sanitizing one response path does not protect downloads or notification histories. Already-open clients need refreshed server results and a deletion invalidation signal/polling; do not claim offline/browser-downloaded copies are remotely erased.

## 7. Implementation sequence after approval

1. Complete the reference registry and strict impact classifier; freeze API/manifest/error semantics and the clinical-content/storage limitations above.
2. Add additive schema/trigger changes and historical read projections, with migration-fixture tests for active ownership invariants and anonymous doctor reads.
3. Add dispatch/credential/write barriers and retirement checks to all affected writers before enabling deletion routes.
4. Implement atomic cleanup, strict external cleanup tracking, exact review checks and replay/status recovery; update OpenAPI and generated client/schema packages.
5. Add the shared accessible dialog/action across Superadmin entry points, then dependent-cache invalidation.
6. Execute the full destructive-boundary suite below on isolated data; keep the action disabled until all mandatory acceptance checks pass.

No new transfer workflow, bulk deletion, patient deletion, undo, deployment or real-data cleanup belongs in these steps.

## 8. Verification matrix and release gates

| Area | Mandatory checks |
| --- | --- |
| Permissions | Each of Superadmin, Clinic Admin, doctor, receptionist, patient, inactive/anonymous actor; direct GET/POST/status calls; real native session/CSRF boundary; revoked/demoted actor racing commit. |
| Confirmation | Exact word, wrong case/spacing, loading failure, cancel, changed user/role/impact with same counts, expired/wrong-actor/wrong-target review; double submit and keyboard re-entry. |
| Ownership | Self, final active Superadmin, inactive target, clinic admin/legacy owner, other managed doctors/receptionists, self-owned consulting profile, inactive dependents, linked-hours dependency; no transfer/cascade. |
| Doctor operations | Upcoming and overdue unresolved visits, called/in-consultation, pending guest requests and presence/work dependencies block. Historical completed/cancelled/no-show visits, history, QR tickets and documents stay readable anonymously. |
| Personal removal | Physical users absence; sessions/challenges/OTP/proofs/private views/workspace/read markers/custom bindings/account-specific limiter keys gone; invitation/reset/device/native/JWT access rejected. |
| Shared preservation | Compare before/after clinical-content hashes, row counts, visit statuses/tokens/references, shared views, clinics/branches/other users/assignments, shared links/logos, document storage bytes and scoped access. |
| Identity leakage | Doctor/actor/uploader JSON, current/previous snapshots, encrypted history and snapshot arrays, hashes, audit summaries, registration receipts, template/test metadata, name caches, downloads/search/public directories; shared contact/name collisions do not erase others. |
| Rollback and external failures | Inject errors at each cleanup stage; precommit fixtures unchanged. Inject local/object permission/timeout failures; account removed state accurately reports pending cleanup, retry resumes, shared bytes untouched. Upload expiry/recreation tested. |
| Multi-connection races | Observable PostgreSQL lock waits for concurrent Superadmin deletions/deactivations, target edits, owner transfer, assignment/custom-role saves, schedule/booking/guest/queue creation, credential issuance and dispatch completion. One legal result; no deadlocks/unbounded retries, partial/broader deletion or restored private snapshots. |
| Replay/network recovery | Lost HTTP response after commit, repeat same request, cross-target ID reuse, separate new request after deletion, polling/status authorization, pending cleanup retry and completed replay. |
| Browser | All Superadmin entry points, no lower-role action, desktop/mobile layout, focus trapping/return, screen-reader labels/status, Enter/Escape behavior, cancel, failed loading, blockers/conflicts and directories/counts refresh. Use fictional disposable accounts only. |
| Existing behavior | Generic DELETE remains deactivation with existing role permissions; existing auth, ownership, schedule, booking, queue, ticket, notification history and document regressions remain green. |

Use the existing isolated users-administration/native-auth/functional-feature harnesses for relational assertions, but do not mistake PGlite concurrency promises for multi-connection PostgreSQL coverage. Extend the disposable-cluster approach used for queue/schedule contention with actual independent connections and observed waits. Browser verification must exercise authenticated disposable role sessions; a sign-in screenshot cannot prove the confirmation works.

Proposed commands after implementation: workspace typecheck/build; existing users-administration test file, `test:auth`, `test:staff-invitations`, `test:features`, `test:queue-contention`, `test:schedules`, `test:tickets`; plus new named permanent-deletion integration/contention/browser checks. Register exact new commands when tests exist, not before.

**Current validation limitation:** this deliverable is a plan. No migrations, deletion endpoints, UI actions or deletion tests have been implemented or executed. No runtime/privacy/concurrency acceptance result is claimed. Existing suite reliability issues must be reported separately and never converted into a deletion pass.

## Approval requested

Approve implementation of **staff user-owned data deletion with anonymous retained shared history**, including the explicit postcommit cleanup-pending status and preservation of clinical document contents. Approval of this plan is not authorization to delete real accounts or deploy. If deletion must also remove names embedded within retained clinical files/narratives, resolve that conflicting scope before implementation.
