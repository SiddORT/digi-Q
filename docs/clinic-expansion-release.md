# Clinic expansion: migration readiness and release gate

## Decision

### Current release: reduced functionality, no custom-function migration

The owner authorized deferring consulting Clinic Admin capability to avoid the
unsupported production function migration. This supersedes the full-expansion
release decision below **only for the reduced release**. It is not approval of a
custom SQL workaround and does not mean the four new functions reached production.

- Clinic registration and Super Admin onboarding create a Clinic Admin, owned
  clinic, branches and clinic-only admin assignment, without an admin doctor profile.
- Consulting selection, attachment UI and admin clinical-profile navigation are
  removed. Ordinary doctor/receptionist workflows and admin clinic management stay.
- The server rejects consulting-profile requests with
  `409 CONSULTING_ADMIN_DISABLED`, including direct API requests and generic
  doctor-profile mutation bypasses. The restriction is fixed in code, not an
  environment switch. Existing records are preserved, not converted or deleted.
- The historical 0008 migration remains for future expansion. Neither startup nor
  build applies production DDL. The reduced release does not require its four
  replacements; the **full consulting feature remains blocked** until supported
  delivery, compatibility and rollback verification are established.

#### Reduced-release evidence and remaining operator steps

`node --test artifacts/api-server/src/pre-0008-compatibility.test.mjs` passed:
the isolated PostgreSQL harness installs the historical guard definitions and
verifies their four hashes exactly equal the observed production hashes. All ten
triggers remain enabled. Tests cover early rejection without writes, clinic-only
provisioning, ordinary doctor mappings, existing-record preservation, rejection
of admin branch mappings by the old SQL, and transactional rollback preserving
previously committed records. This is not a production restore rehearsal.

Read-only production aggregate checks on 2026-09-25 returned zero cross-owned
admin doctor profiles, invalid/inactive admin assignments, admin branch assignments,
clinic-slug duplicates, per-clinic branch-slug duplicates, and case-insensitive
per-clinic branch-name duplicates. These are point-in-time observations.
API/frontend typechecks passed; both development workflows started cleanly and
the registration page rendered. Successful Clerk-backed registration was not
rerun in this reduced-release pass; prior authenticated acceptance is recorded
below. No production writes or publication occurred.

The updated phase-one and PostgreSQL queue-contention suites passed all 57 tests.
Live development HTTP probes with a valid same-origin header returned
`409 CONSULTING_ADMIN_DISABLED` for both registration with `ownDoctor: true`
and direct doctor-profile attachment. Requests without an origin or bearer
identity were independently rejected by the existing request-origin protection.

For the reduced release, use only normal **user-controlled managed Publish**:

1. Review its actual current schema plan. The last confirmed plan replaces the
   ordinary session indexes and guest uniqueness constraints, adds slug/branch
   indexes, and omits function replacements. This task environment cannot recompute
   the platform diff; never treat the old plan as approval of a changed live plan.
   Retain all three guest uniqueness protections and the five same-session
   uniqueness semantics. Stop for unexpected data/table drops or missing replacements.
2. Confirm the platform-supported restore options before proceeding. Do not choose
   overwrite-production-data. Use an appropriate maintenance window for index/
   constraint changes. This release makes no custom-function change to roll back.
3. The user initiates Publish. Publication and subsequent production verification
   are still outstanding; successful development checks are not a deployment.
4. After Publish, compare the four function definitions and all ten enabled trigger
   attachments with the baseline below, and verify the ordinary indexes/guest
   uniqueness from the approved plan. Old function hashes are expected and
   compatible for this reduced release. Unexpected changes require investigation.
5. Verify ordinary registration, booking/queue and guest approval using authorized
   isolated fixtures, and verify consulting requests remain unavailable.

Rollback must not blindly restore older cross-session unique indexes after
separate sessions have accumulated equal tokens. Preserve records and assess
conflicts first. Application rollback does not undo the managed schema diff.
Keep the consulting restriction during any rollback; never publish a version
that exposes consulting assignments against the old guards.

### Historical full-expansion gate (still applies before enabling consulting)

**2026-09-25 release-preparation recheck: BLOCKED on supported custom-function
delivery.** Core authenticated registration, booking/queue, guest approval, and
cross-role acceptance have now passed per the current release handoff. Earlier
acceptance-pending notes below are historical, not the current feature status.
This does not clear the production database gate.

Fresh read-only production catalog queries returned exactly the four expected
function signatures and the same four **old** SHA-256 values in the fingerprint
table below. Full definitions confirm the semantic differences, including the
old prohibition on every Clinic Admin branch assignment. All ten ownership trigger
attachments remain enabled (`O`); the four constraint triggers remain deferrable
and initially deferred. No production changes or publication occurred, so these
are pre-release observations, **not post-migration verification**.

Official documentation searches for a supported custom-function migration,
transaction, and rollback procedure found no explicit procedure. General SQL
runner documentation is insufficient authorization. The schema-diff callback is
unavailable in this task environment; the confirmed prior Publish diff remains
the evidence for omitted functions, not a newly recomputed plan.

### External dependency required to proceed

The project owner must obtain platform confirmation of the supported delivery
mechanism for these four managed-production function replacements. Confirmation
must specify:

- Who executes the change and through which supported platform surface; whether
  Publish can include it or a platform operator must coordinate it.
- How the exact four 0008 replacements are applied atomically while preserving
  all ten enabled attachments, and how failures abort without partial changes.
- How writes are held during the operation and application publication; whether
  subsequent Publish preserves the custom definitions.
- How the actual pre-change function definitions are captured and restored, and
  what supported restore mechanism protects production records.

This is a requirements checklist for platform confirmation, not a supported
execution procedure or an instruction to paste DDL into a production SQL runner.
Once confirmed, validate that procedure and old/new application compatibility in
an isolated rehearsal, including a rollback rehearsal. Repeat aggregate data
preconditions near the approved window. The user retains control of Publish.
After the supported change and publication, repeat the read-only full-definition,
hash, and trigger comparison; require all four intended bodies and all ten
unchanged enabled attachments before lifting the gate. Until those steps are
possible, this release-preparation task remains incomplete.

**Final mobile verification passed; isolated DEV clinical cleanup DONE.** Ownership,
patient-creation evidence, and inbound/outbound references were checked before
transactional deletion. Zero owned clinical records, zero staff session proofs,
and zero usable test identities remain; all three provider deletions were verified
by subsequent 404 responses. Private credentials and the browser manifest were
removed. One anonymized inactive local actor must remain for the unchanged
existing-record edit/correction audit foreign keys (two local users deleted).
This is the explicit exception to zero local fixture rows, not an active account.
The existing clinic contact remains restored. Counts-only cleanup evidence:
`/tmp/clinic-expansion-cleanup-result.json`. No production SQL or disabled guards.

**Test isolation incident corrected; acceptance still pending.** A browser worker
changed an existing clinic contact field rather than a test-owned record. A
fixture-actor-audited, phone-only compare-and-set restored the original value and
preserved the original audit with an additional correction audit. Fixture-actor
audit review found no other existing-record edits. Evidence:
`/tmp/clinicflow-test-isolation-correction.json` (non-secret manifest).
Follow-up finished and isolated identities were removed subject to the audit-only
retention exception above. Require role/record-ownership checks before any future
test mutation. This incident is not a passed acceptance case.

**Not cleared for production rollout.** Production was inspected READ ONLY.
No publish, production DDL, shared-database reset, or deployment configuration edit
was performed. After the initial audit, explicitly authorized development-only
constraint reconciliation was completed as recorded below.

The checked-in migration chain is now reproducible on disposable PostgreSQL,
but that is **not evidence that Publish executes those files**. The live
development omissions found below have been repaired; production custom-function
delivery remains unresolved.

## Observed deployment and actual build path

`getDeploymentInfo()` returned a public, successful autoscale deployment at
`https://clinic-flow-new-platform.replit.app`. This reports the current published
build, not readiness of the pending source.

Checked-in configuration:

- API artifact production build: `pnpm --filter @workspace/api-server run build`;
  its package invokes `node ./build.mjs`. That file runs esbuild on `src/index.ts`;
  it does not read the migration journal or execute SQL.
- API production run: `node --enable-source-maps artifacts/api-server/dist/index.mjs`.
- Web artifact production build: `pnpm --filter @workspace/clinicflow run build`;
  static output is `artifacts/clinicflow/dist/public`.
- `.replit` selects autoscale and its post-build hook only prunes the pnpm store.
- `scripts/post-merge.sh` invokes `pnpm --filter db push`; the database package's
  `push` command is `drizzle-kit push --config ./drizzle.config.ts`.
  That configuration reads `src/schema/index.ts`, not `drizzle/*.sql`.
- `lib/db/src/index.ts` connects to `DATABASE_URL` via a pg Pool. No alternative
  external-production connection or documented external migration workflow was
  found in these configuration paths or `replit.md`.

Replit's managed Publish flow introspects live development and production schemas;
it is separate from these build commands. The production metadata observations
below are from the documented managed production read replica.

`explainSchemaDiff()` was attempted after reading its reference, but the callback
is unavailable in this subagent (`not defined`; documented build-agent-only).
The owning build agent subsequently reported its actual pre-reconciliation diff:
guest uniqueness drops without replacements, five session-index replacements,
two slug-index additions, and guest FK renames. **No function definitions were
included**, confirming that required 0008 function delivery is a rollout blocker.
The build agent must rerun the diff after the development reconciliation below.
Catalog comparison is not a replacement for the interactive Publish plan.

The build agent's **post-reconciliation** diff now includes all three replacement
guest UNIQUE constraints (`*_unique`) alongside the old `*_key` drops, and adds
the branch-name index. It reports no structural data loss. This fixes the
previous silent-removal risk; review ordering/atomicity of replacements in the
actual Publish UI. **It still includes no function definitions.**

## Deterministic migration evidence

Run:

```sh
node --test artifacts/api-server/src/migration-readiness.test.mjs
```

The test reuses the existing `postgres-queue.mjs` disposable cluster harness in
new empty mode: private temporary initdb directory, unique Unix socket, no TCP
listener, explicit test user/database, no DATABASE_URL or PG environment targeting,
and cleanup on success/failure. It never recreates a shared schema.

Evidence:

1. The original **0000–0010 all applied successfully** to an empty PostgreSQL
   database using the real Drizzle migrator and checked-in journal.
2. The second actual migrator call left the migration ledger and catalog unchanged.
   This is runner idempotence, **not** a claim that replaying every raw SQL file is safe.
3. Comparing PostgreSQL catalogs with a second disposable database built from
   current Drizzle schema revealed one real contract omission:
   `patients.mobile` remained NOT NULL with default `''`, while current schema and
   both live environments permit NULL and have no default.
4. Added **0011_patient_mobile_nullable.sql** and journal entry, leaving historical
   migrations unchanged. It only drops NOT NULL/default; it neither deletes nor
   rewrites stored mobile values. Existing empty strings remain empty strings.
5. The complete **12-file chain (0000–0011)** passes, then a second runner call
   applies zero migrations. Schema column types/nullability/defaults, ordinary
   constraints, and indexes match current Drizzle exactly.
6. All ten custom trigger attachments are present and survive runner replay.
   Constraint triggers are intentionally compared separately because Drizzle
   does not represent them. Tests exercise valid self-owned consulting-admin
   branch assignment and reject assignment into another admin's clinic.
7. Nullable patient data and pre-existing empty-string data survive replay and
   repeating the additive 0011 repair.

The expected-schema database uses Drizzle's generated DDL, with generated foreign
keys executed after indexes because its empty-snapshot generator emits a composite
FK before its referenced unique index. Actual migration-file order is untouched.

Historical 0002 contains installation-specific ownership backfill IDs and refuses
incomplete ownership. Fresh-empty success does not make it a generic migration
for arbitrary populated legacy installations. Do not replay it against production.
Snapshots stop at 0005; the journal, not snapshot presence, determines runner coverage.

## Live read-only catalog comparison

Catalog-only queries inspected tables, columns, constraints, index definitions,
trigger attachments, and SHA-256 of `pg_get_functiondef`; no patient/staff records,
credentials, or secret values were read. Aggregate duplicate preflight exposed
counts only.

- Both environments have 17 public tables, including `guest_requests` and
  `staff_session_proofs`; production is not missing those tables.
- No production/development column definition difference was found.
- Production lacks `clinic_slug_unique` and `branch_slug_clinic_unique`.
- Production still has pre-expansion keys for `schedule_active_location_day_unique`,
  `exception_date_idx`, `appointment_token_idx`, `appointment_active_patient_idx`,
  and `appointment_one_consult_idx`. Development includes session startTime/sessionId
  in those keys, matching 0009.
- **Both live databases lack `branch_name_clinic_unique`**, despite its presence in
  checked-in schema and migration 0002 (initial audit; development repaired below).
- **Development lacks all three guest-request unique protections**
  (`request_id`, `receipt_hash`, `appointment_id`). Production has them under
  PostgreSQL names ending `_key`; fresh migration/schema names end `_unique`.
  Development has schema-style guest FK names; production has equivalent
  definitions under `_fkey` names. This initial development omission is now repaired.
- Consequently, publishing today's live development schema may remove existing
  production guest-request uniqueness. **Do not approve such drops.** The `CREATE
  TABLE IF NOT EXISTS` in 0010 does not repair constraints on an already-existing
  table. Its verified purpose is fresh-chain completeness.
- Production aggregate duplicate groups at audit time: clinic slug **0**, branch
  slug within clinic **0**, case-insensitive branch name within clinic **0**.
  These are point-in-time checks, not a lock or an ongoing guarantee.

### Authorized development reconciliation

After explicit approval, development-only aggregate duplicate preflight returned
zero groups for guest request IDs, receipt hashes, non-null appointment IDs, and
case-insensitive branch names within clinic. A single transaction added:

- `guest_requests_request_id_unique` on `request_id`;
- `guest_requests_receipt_hash_unique` on `receipt_hash`;
- `guest_requests_appointment_id_unique` on `appointment_id`;
- `branch_name_clinic_unique` on `(clinic_id, lower(data->>'name'))`.

The transaction used a five-second lock timeout and 30-second statement timeout.
Post-commit catalog verification confirmed all four unique indexes. No records
were deleted or rewritten. Existing development guest foreign keys already match
the schema's exact names and reference definitions; no rename was necessary.
Production was not modified; its differently named equivalent guest protections
still require review in the managed Publish diff.

The full-chain test optionally accepts `CLINICFLOW_CATALOG_DIAGNOSTIC_FILE`, a
JSON array of catalog rows fetched separately through the read-only database
skill. It compares that static snapshot with the fresh schema catalog and reports
missing/extra objects. This is an audit-only test input, not application runtime
configuration or a connection to either live database.
After reconciliation, the 253-row live development catalog snapshot passed this
comparison with **zero missing and zero extra objects**. The same test run applied
all 12 migrations from empty and replayed the runner unchanged.

### Custom SQL fingerprint gate

Production has all ten trigger attachments but still has the older four function
bodies replaced by **0008**. Development matches the fresh migration chain for
these four:

| Function | Production SHA-256 | Required development/fresh SHA-256 |
|---|---|---|
| `clinicflow_assert_staff_owner` | `d8c72a37bbd4881f82755133b5738eef38bc3bc7adaf41b0e53cffd4e4cf8b5a` | `56c4c70c65c81b440b06feb947d7d9b4306fd770a308fad8ad7004b37ddfa841` |
| `enforce_clinicflow_assignment` | `2f07199e1ac353b5f7e5cce218edad564743b6cbd1278f07074894099c43d6c2` | `77a169eff17133df6909b533a79c93bd499fca54e9eab33483ba48d921007317` |
| `enforce_clinicflow_doctor_owner` | `23ae5bdcc80e8122186bad3eab9c302ed160610823b983fb5116da3bd2124b8a` | `649e9813a72ec021b3364ffb4e02361ba3b67b97d4cff6bc388f16e2297aea86` |
| `protect_clinicflow_admin_account` | `e619d399445435eb831a0b138456f91da5a761a61b24cbdab9360233af63f648` | `f7219126c04ea20dd3780526e115c346439820396e79d263af83a4084338bcd1` |

The 0006 safe `clinicflow_staff_manager_guard` already matches production,
development, and fresh chain:
`6fea3156b61be8f43c5e756b8a55bba5b829a35d5a8190765fde1d8aedaa4c6f`.
`clinicflow_clinic_owner_guard` differs in textual formatting between fresh chain
(`73c1202a...`) and both live databases (`72ed0d51...`); its inspected live body is
semantically the same guard. A hash mismatch alone is not proof of semantic change.

The canonical full custom SQL is checked in, not generated from Drizzle:
0002 creates ownership/admin functions and six trigger attachments; 0005 adds
staff-owner functions and four deferred constraint triggers; 0006 repairs the
table-specific manager guard; 0008 replaces four function bodies while preserving
attachments. Do not assume schema push applies any of these function definitions.

## Supported production boundary

The database skill and `database-migrations-on-publish.md` document **only
user-initiated managed Publish** for production schema changes. They do not
document a separate agent-supported mechanism to apply arbitrary custom
function/trigger SQL to managed production, nor guarantee those objects are
covered by Publish's introspector.

Therefore: obtain the actual supported platform diff and confirm it includes the
required custom bodies, or obtain Replit platform/support confirmation of the
supported handling. Until then, custom SQL delivery is a **release blocker**.
No production migration runner, production connection script, deploy-build DDL,
startup-time DDL, or direct SQL workaround should be introduced. Permission alone
does not establish a documented supported mechanism.

### Official documentation follow-up

The documented `searchReplitDocs` callback was asked specifically about manual,
transactional function/trigger DDL against managed production. It cites:

- [Work with your data](https://docs.replit.com/features/data-and-storage/work-with-your-data)
- [Development and production](https://docs.replit.com/features/data-and-storage/development-and-production)

Its response confirms general arbitrary-SQL runner capability but **does not
establish explicit support for transactional production function/trigger migration**
or give a supported exact procedure for this case. General SQL-runner availability
must not be presented as that missing guarantee. The database skill expressly
prohibits authoring custom managed-production migration scripts, including
deployment/startup workarounds. Accordingly no production-targeting apply or
rollback script has been added, even for manual execution. The checked-in 0008
remains the canonical development/disposable-test SQL for the required four bodies.

### Read-only preconditions and rollback planning

A subsequent production metadata query verified **all ten listed trigger
attachments have `tgenabled = 'O'`**. Aggregate compatibility checks returned zero
admin doctor profiles owned by another admin, zero admin assignments into an
unowned clinic or belonging to an inactive admin, and zero admin branch assignments.
These checks read no personal fields and cannot prevent subsequent changes.

Before any separately supported and explicitly authorized custom-function change,
the operator must capture the actual current definitions, not reconstruct a
rollback from historical migration text. The following is a **read-only metadata
snapshot query**, not an apply/rollback script:

```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') AS sha256,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND p.proname IN (
    'clinicflow_assert_staff_owner', 'enforce_clinicflow_assignment',
    'enforce_clinicflow_doctor_owner', 'protect_clinicflow_admin_account'
  )
ORDER BY p.proname;
```

Require exactly four expected signatures (`text` for the assertion helper, no
arguments for the three trigger functions), and each hash must match either its
known old or intended new hash above. Unexpected definitions mean **stop**.
Recheck all ten enabled trigger names, attachment tables, timing and deferrability
against the audited definitions. Capture definitions and their hashes together
in a restricted operational record; this snapshot contains metadata, not patient
records. A supported operator procedure would need one transaction, fail-closed
preconditions, bounded lock/statement timeouts, replacement of only these four
bodies, verification before commit, and rollback on any failure. No such production
transaction has been executed or supplied here.

After expansion data exists, restoring old functions is not necessarily safe:
old assignment/account guards reject legitimate consulting-admin branch
assignments. Freeze writes and assess that data first; never remove assignments
or patient records to make a rollback succeed.

### Ordering and compatibility

0008 preserves ownership and expands valid own-doctor/own-branch assignments, but
also tightens checks on inactive admins and cross-owned admin doctor profiles.
Therefore it is **not proven universally backward compatible** simply because
old code usually creates only branch-null admin assignments. The zero-count
production preflight reduces known risks; it does not validate every old-app path.

Do not enable expansion registration/clinical assignment flows while old function
bodies remain installed. Once a supported custom-SQL procedure is confirmed,
coordinate a maintenance window that prevents new writes during both schema and
function changes, verify all gates, and reopen only after both are complete.
Functions-first before app publication can avoid exposing new routes to old guards,
but requires explicit old-app compatibility testing and platform confirmation that
Publish will preserve the replacements. Publish-first is acceptable only with
traffic/writes held until custom functions are verified. Neither ordering is an
authorization to publish or modify production in this audit.

## Safe rollout sequence (plan only; no Publish performed)

1. Keep the expansion unreleased. Preserve a verified restore point through the
   platform's supported backup/rollback UI; do not select overwrite-production-data.
2. In development only, inspect duplicates before restoring the three guest unique
   constraints and branch-name unique index from schema source. Resolve any
   conflicting records explicitly; never delete them automatically. Verify current
   live development catalog matches the source after the normal dev schema flow.
3. Rerun the disposable migration test and feature/auth/concurrency regressions.
   Verify custom development function definitions against 0006/0008.
4. Have the owning build agent run `explainSchemaDiff()` read-only. Review the
   exact platform plan and Publish UI. Accept no guest uniqueness loss, table/data
   drops, or unconfirmed rename. Guest FK/unique naming differences require review,
   not permission to drop stored data.
5. Explicitly verify custom function/trigger delivery through the supported
   platform flow, with the required 0008 bodies and existing enabled attachments.
   If unsupported or omitted, stop and escalate to Replit support; do not bypass.
6. Repeat aggregate production slug/name uniqueness checks close to the eventual
   approved release. Index creation validates existing data and can lock tables;
   use a suitable maintenance window. The five session-key changes loosen older
   cross-session constraints but must retain same-session uniqueness.
7. Only after all gates and explicit owner authorization may the **user** initiate
   Publish. This audit neither authorizes nor performs that action.
8. Post-release, use read-only catalog queries to verify indexes/uniqueness,
   function hashes and triggers, then authorized functional smoke checks in a
   designated test clinic. Confirm own-clinic consulting behavior, cross-clinic
   rejection, guest idempotency, and session-isolated booking/queue behavior.
9. On failure, halt rollout and use a reviewed platform rollback/restore decision.
   Do not blindly reapply old indexes: once separate sessions hold equal tokens,
   the old cross-session unique indexes may fail. Application rollback alone does
   not restore custom database functions or constraint semantics.