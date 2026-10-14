# Permanent staff deletion: implementation and verification

The approved plan remains the acceptance contract. The permanent staff-removal
API and both Superadmin entry points are connected. **No real account was
removed, no live messages sent, and nothing deployed.**

## Delivered boundaries

- Native, active, non-demo Superadmin sessions only; exact lowercase `delete`;
  short-lived actor/session/target/action-bound approval of exact live rows and
  content, not counts. Self, final active Superadmin and patient deletion are
  forbidden. Generic DELETE still deactivates.
- Separate signed visit and Clinic Admin handoff reviews/commits. Same
  patient/clinic/private ticket, ordinary availability/cutoff/capacity and token
  allocation, immutable original/replacement coordinates and idempotent replay.
  Admin handoff includes inactive/unassigned managed staff, preserves assignments
  and statuses, and requires explicit resolution of a self-consulting profile.
- Open/overdue clinical work, guest requests, active presence, linked opening
  hours, unresolved ownership and active/uncertain dispatch are blockers.
- Atomic account deletion, private preferences/views/bindings/auth artifacts and
  account-specific limiter cleanup, retirement of stable anonymous doctor IDs,
  anonymous shared actor/uploader/view ownership, generated JSON attribution
  cleanup and verified encrypted-history erasure. Unknown SQL/text/JSON/schema
  references and unproven encrypted envelopes fail closed.
- Clinical documents, storage bytes, patient identity/narratives, signed names
  inside clinical contents, visit history and shared clinics remain. Doctor QR
  discovery bindings become inactive; retained clinical ticket references do not
  change. Handoff preserves the source doctor's historical visit-based access
  until account removal; replacement access follows existing same-clinic
  profile/document rules, never global patient reassignment.
- Credential/provider barriers and database identity/asset fences prevent late
  writes from recreating erased accounts, messages, metadata or upload aliases.
  Commit obtains a short exclusive write boundary; an already-busy writer causes
  a bounded conflict rather than a deadlock or partial removal.
- Verified exclusive media only, including raw/validated variants, shared links,
  soft-deleted documents, all proven encrypted-history envelopes and upload
  expiry. Encrypted durable receipts commit with account removal. File work is
  postcommit, checks references again, verifies absence and retries at most three
  jobs per request with bounded storage waits. Pending cleanup never means that
  the removed account survived or should be deleted again.
- Shared accessible dialog, explicit transfer controls, lost-response status
  reconciliation, persistent actor-scoped pending receipt controls and full
  query cancellation/refresh. Native session polling propagates an opaque
  removal revision so other signed-in clients reset stale projections.

## Verification

`pnpm --filter @workspace/api-server test:staff-removal` covers isolated relational,
storage and stub-delivery fixtures; real independent PostgreSQL connections with
observed lock waits; native role authorization, stale/exact reviews, rollback,
late writers, dispatch, receipts, media sharing, retirement, handoff and privacy.
`staff-visit-handoff.integration.test.mjs` exercises actual handoff HTTP routes and
old/new doctor profile, activity, document list/download/upload before/after
handoff and removal, including cross-clinic denial and retained byte hashes.

Additional checks:

- Workspace `pnpm run typecheck`, OpenAPI code generation, API and web builds.
- After synchronization with main, all 37 affected authentication, invitation and
  notification-settings tests passed with the required security templates and
  permanent-removal dispatch barriers preserved. The removal suite had one
  native Node/Wasm teardown crash; its affected file passed both tests when
  rerun alone, with the other 29 suite cases passing in the combined run.
- Existing native/JWT/auth contention, ownership/administration, feature-policy,
  functional-feature, queue/schedule contention and notification regressions.
- `pnpm test:tickets`: 52 browser regression cases.
- Native auth lifecycle tests include cross-client removal cache reset.
- One authenticated disposable Preview browser pass verified both staff
  entrypoints, exact/cancel confirmation, successful fictional removal and
  receipt/list refresh/reload, removed-account login rejection, unresolved doctor
  care, and actual Clinic Admin/doctor/receptionist/patient role denial.
  Patient authorization used an explicitly pre-seeded disposable native session,
  not a claim to have tested the unchanged patient OTP login.

## Operation and limitations

Guard installation after development schema push is required:
`node scripts/install-dev-deletion-guards.mjs --development`.
Do not replay the migration journal on a ledgerless existing database.
Missing guards, unknown schema/references and legacy history without trustworthy
provenance block the live review; they never silently authorize cleanup.
Storage configuration changes, unavailable/unreadable jobs or unexpired upload
capabilities leave an explicit cleanup-pending receipt for a later retry.

To reproduce the disposable browser fixture, explicitly create the ignored
`.local/staff-removal-browser-fixture` flag before restarting the API development
workflow. It uses its own temporary PostgreSQL cluster, local media and stub
mail, with external fetch disabled. Remove the flag and restart to restore the
normal preview. This mode is not part of production startup.

Already-delivered messages, provider logs, backups, remote links and downloaded
or offline browser copies cannot be remotely erased. Preserved clinical file
contents and narratives are deliberately not rewritten.
