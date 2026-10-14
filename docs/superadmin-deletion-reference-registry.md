# Permanent staff deletion: reference registry and implementation gate

**Status: implemented as live, fail-closed review gates.** Each review checks the database's actual foreign keys, schemas, enabled guards and exact row contents against this registry. Unknown families, identifying untyped text, unattributed generated labels or unreadable/unproven encrypted rows block removal. Disposable relational/storage fixtures and authenticated role checks are documented in `superadmin-permanent-user-deletion-implementation-status.md`. No production/UAT data was inspected.

## Relational references

| Table / reference | Disposition | Required safeguard |
| --- | --- | --- |
| `users.id`, `users.clerk_id` | Remove target row and legacy proofs | Exclude patients, self and last active Superadmin. Lock account/credential and protected-admin boundaries. |
| `users.managing_admin_id` | Transfer other receptionists to an eligible Clinic Admin before deletion | Include inactive and unassigned users. Ownership and assignment triggers must still pass. |
| `clinics.admin_id` | Resolve through reviewed administrative handoff before removal | The admin is required and clinic-admin assignments are maintained by triggers. No automatic transfer. |
| `clinics.owner_id` | Anonymize historical creator; preserve clinic and current admin | Current create/save paths record the original creator, and current operational authorization and ownership guards use `admin_id`, not this creator. Preserve null on later edits; do not replace the creator with the editor. Unknown legacy meanings still block removal. |
| `doctors.user_id`, `doctors.owner_admin_id` | Retain retired anonymous clinical identity for the target; transfer all *other* managed profiles | Nullable login/owner only for retired profiles under narrow DB guards. Never reuse retired doctor ID. Consulting admin's self-owned profile must be retired only after owned clinics and open care are resolved. |
| `assignments.user_id` | Remove only target's assignment rows | Check every affected clinic and branch remains consistent with its owner. Do not recreate another person's assignments by inference. |
| `patients.user_id` | Block unexpected staff/patient dual-role mapping pending individual resolution | Preserve demographics, clinical JSON and patient ID. This staff-only API never deletes or silently detaches patient accounts. |
| `appointments.actor_id`, `appointment_history.actor_id`, `guest_requests.decided_by` | Anonymous historical actor, with explicit deleted-user state | Preserve statuses, references, tokens, patient, clinic, clinical content and operational history. Block unresolved doctor work. |
| `appointments.doctor_id`, `guest_requests.doctor_id` | Historical doctor ID remains; future open care needs reviewed handoff | Never point operational work to retired profile. Existing reschedule mutates current row in place; handoff needs verified immutable before/after trail and queue/notification consistency. |
| `schedules.doctor_id`, `availability_exceptions.doctor_id`, `qrs.doctor_id` | Remove exclusive availability, disable doctor-only QR links | Block linked opening-hours dependencies. Preserve clinic/branch links; retain historical session bookkeeping. |
| `audit_logs.actor_id`, `audit_logs.entity_id` | Anonymous shared evidence; erase proven authentication-only private activity | `entity_id` is untyped text; classify by event/entity taxonomy, not string replacement. |
| `auth_sessions.user_id`, `auth_challenges.user_id`, `otp_challenges.user_id` | Delete target-linked sessions and challenges | Include expired/consumed records, and classify unlinked challenges by purpose plus verified account identity. Native/JWT sessions must cease to authenticate at commit. |
| `staff_session_proofs.clerk_user_id` | Delete exact legacy mapping | No FK: missing/ambiguous mapping blocks review, never broad match. |
| `notification_reads.user_id` | Remove target-only markers | Keep notification-generating shared history. |
| `patient_documents.uploaded_by` | Anonymous historical uploader | Preserve bytes, metadata needed for clinical access, and document row. Sanitize filename only if derived from staff identity; never rewrite clinical contents. |
| `saved_views.user_id` | Delete personal; anonymize shared ownership | Preserve shared role/scopes and filters, removing target IDs only at known structured paths. |
| `auth_rate_limits.key` | Delete only provably account-exclusive keys | Shared IP/security counters stay. |

## Non-relational and derived references

| Family / producer | Disposition and known hazards |
| --- | --- |
| `workspace:<userId>` | Delete exact private preference. Concurrent workspace writes need deletion guard. |
| `custom-roles` bindings | Remove target-only binding under same revision lock as role saves. Role definitions and other bindings remain. |
| `logo:*` and uploaded variants | `ownerId` is uploader, not proof of exclusive ownership. Shared clinic/template logos retain bytes with anonymous uploader; exclusive unreferenced paths need reference graph and strict postcommit cleanup receipt. Pending upload expiry/finalization races block success. |
| `mail-outbox:*`, `sms-outbox:*` | Stop target recipient, anonymize staff in retained shared snapshots and previous details; preserve occurrence/deduplication. A committed `sending` claim may still dispatch; serialize provider completion with account deletion and conditionally persist results. |
| `notification-history:*`, occurrence/delivery claims | Verify all metadata and current/prior envelopes against provenance, erase related private envelopes to an immutable anonymous claim. Unclassified occurrence families and unreadable/unproven envelopes block removal. |
| `notification-history-reconciliation:*` | Strictly shaped anonymous review receipts only: record digest, reviewer fingerprint, timestamp and decision/counts. Preserve these; any added or unclassified field blocks removal. No archives, contacts, envelopes or raw account IDs are stored. |
| Notification templates, test dispatch, ticket-email claims | Classify revision/publisher, address hashes and stored snapshots; no substring-wide deletion. Retain shared content and deduplication. |
| `presence:*`, duration/session and token-counter settings | Active operations block; preserve historical queue/duration counters. A doctor ID in a key alone does not prove the row is disposable. |
| Clinic registration receipt, appointment JSON, guest request JSON | Erase target personal actor/input digest and generated attribution at known paths; preserve visits, clinic completion and patient clinical content. |
| React Query, exact-label, directory, tickets/reports and SQL projections | Cancel/purge target identity caches, refresh other sessions, and render `Deleted user` / `Deleted doctor` in historical projections without exposing new actor detail to patients. Already-downloaded files cannot be recalled. |

## Live stop conditions and verification requirements

1. Prove a complete SQL FK/constraint/trigger inventory against the actually applied migration chain, including handwritten functions; test retirement invariants with independent PostgreSQL connections.
2. Enumerate every settings ID family and JSON/encrypted writer/reader. For each concrete row in the review token, record its primary key and content revision/hash; **counts alone are insufficient**. Reject unclassified data rather than pretending it was cleaned.
3. Implement common credential, writer and per-recipient dispatch barriers before account deletion. A worker completion from pre-deletion memory must not restore an erased snapshot.
4. Implement durable exact-file receipts and strict storage removal only after database commit. Never claim complete if any exclusive-file removal or upload-expiry recheck is pending.
5. Compare surviving relationships and patient/document bytes on disposable fixtures before/after, then run authenticated multi-role and multi-connection tests. The shared action is enabled only for a fresh native-authorized review with no blockers; guard/reference drift disables it again.
