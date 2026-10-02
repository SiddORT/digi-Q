# DigiQ release readiness — development evidence and operator gates

## Decision and authority

**Not ready for an unconditional authentication cutover or production publish.** The development inventory matches the existing data baseline, but all 14 active staff lack native password material. The three initially missing source-defined booking concurrency indexes were safely restored in development after explicit authorization and zero-violation preflight; that development safety gap is now resolved. These are development findings, not assertions about UAT or the actual VPS.

This is a non-executing release guide. The user owns publication and target authorization. No production query or DDL, environment/secret inspection or change, live backup, account mutation, live SMTP, provider cleanup, key rotation or publish was performed. The only application-database mutation was separately authorized restoration of three existing declared development indexes. This document does not authorize further operations.

Evidence sources:

- Read `.local/skills/database/SKILL.md`, `scripts/src/preflight-native-auth.ts` and `docs/digiq-auth-compatibility.md` before inventory.
- Development aggregate reads through the documented database callback, explicitly selecting `development`.
- New `scripts/src/preflight-release-readiness.sql`: repeatable-read, read-only transaction, bounded statement/lock timeouts, aggregate-only projections and rollback. It has no connection discovery, credentials, writes or email delivery. Target selection remains the authorized caller's responsibility; SQL cannot certify that a caller selected development.
- A separate disposable PostgreSQL 16 backup/restore rehearsal using the existing socket-only test harness with `empty: true`; no application process was launched.
- Unauthenticated UAT GET observations supplied by the main agent, clearly separated below from this worker's checks.

No email addresses, identity values, password/hash values, tokens or credentials are included in results. Fixture values were synthetic test-only inputs, never live account data.

## Development inventory

All current counts came from the post-repair read-only snapshot, compared with the pre-repair snapshot; concurrent future changes can invalidate this baseline.

| Aggregate | Observed | Assessment |
| --- | ---: | --- |
| Users / clinics / branches / doctors / appointments | 17 / 9 / 6 / 7 / 3 | Existing baseline verified |
| Normalized-email collision groups / accounts affected | 0 / 0 | No current collision; not proof of future race protection |
| Emails needing normalization / empty emails | 0 / 0 | Current values satisfy normalization preflight |
| Active staff / active staff needing password setup | 14 / 14 | Native staff password readiness **not established** |
| Active staff with Argon2id-format hash / other hash format | 0 / 0 | Presence/format only; no passwords tested |
| Retained provider mappings / legacy session-proof rows | 12 / 6 | Preserve until approved reconciliation; counts do not establish provider usage or proof validity |
| Clinics mapped to Clinic Admin / invalid clinic-admin mappings | 9 / 0 | Current mapping check passes |
| Orphan clinic owners / orphan branches | 0 / 0 | Current referential inventory passes |
| Doctors mapped to doctor-or-consulting-Clinic-Admin identities / invalid doctor mappings | 7 / 0 | Own-consulting compatibility included |
| Assignments / invalid assignment mappings | 27 / 0 | Existing scope mappings preserved |
| Invalid appointment reference/scope mappings | 0 | References and branch-to-clinic scope checked; not a complete booking-policy audit |
| Public tables / native-and-legacy user columns | 20 / 4 | Additive native fields and retained provider column present |
| Source-named unique guards present | 7 of 7 | Initially 4 of 7; three existing declared guards restored |
| Booking concurrency guards present | 3 of 3 | Initially 0 of 3; exact definitions validated and all three valid/ready/unique |
| Selected integrity constraints / enabled application triggers | 3 / 10 | Catalog presence only; not proof of all behavior |
| Normalized-email unique index under the conventional name | 0 | Not implemented by the reviewed additive native-auth migration; zero collisions does not prove atomic normalized-email uniqueness |

General guard inventory is catalog/name-based. For the three repaired guards, post-repair canonical index definitions were additionally compared exactly against the existing source definitions, and validity/readiness/uniqueness were checked. A focused pre-repair check found zero alternative unique guards beyond the retained request/reference guards and the primary key. Further schema changes still require separate target reconciliation and authorization.

### Authorized development-only booking-guard restoration

After the initial read-only report, the user explicitly authorized non-destructive restoration of the three existing rules, conditional on zero violations and no alternative guards or ambiguity. Definitions were taken unchanged from `0009_public_slugs_session_isolation.sql` and confirmed against `lib/db/src/schema/core.ts`.

- Preflight grouped appointments by the exact token, active-patient and one-consultation index keys, including the original `coalesce` start-time expression and original status predicates. Collision-group counts were **0 / 0 / 0**. Target guard objects present: **0**. Alternative unique guards: **0**.
- Repair used the documented database callback with explicit `development`, one transaction, a 3-second lock timeout and 15-second statement timeout. A table share lock prevented concurrent writes while duplicate and unexpected-index checks were repeated before DDL.
- Only the three existing declared unique indexes were created. No rows were inserted, updated, deleted or reset; no table definitions, custom trigger functions, consulting capability or credentials were changed. The transaction committed successfully without a confirmation request.
- Post-repair guards present / exact definitions matching source / valid-ready-unique guards: **3 / 3 / 3**. Source-named guard count changed **4 → 7**; booking guard count changed **0 → 3**.
- Before/after baseline remained **17 / 9 / 6 / 7 / 3**; Clinic Admin mappings **9**, consulting identity mappings **7**, assignments **27**, retained provider mappings **12**, legacy proofs **6**, and all checked invalid/orphan mapping counts **0**. Selected integrity constraints remained **3** and enabled application triggers **10**.

This repair is development-only evidence. It does not establish production schema parity and is not a production migration or publish operation.

### Role/status aggregates

| Role | Status | Accounts | Without password material |
| --- | --- | ---: | ---: |
| Clinic Admin | Active | 5 | 5 |
| Doctor | Active | 4 | 4 |
| Patient | Active | 2 | 2 |
| Receptionist | Active | 2 | 2 |
| Super Admin | Active | 3 | 3 |
| Super Admin | Inactive | 1 | 1 |

Patients use their separate email-code flow; absence of a patient password is not a staff-password migration defect. Missing staff hashes do not authorize resetting credentials or treating provider IDs as native login credentials. No live login, invitation, setup or recovery was attempted.

## Isolated backup/restore rehearsal — passed

The rehearsal created a unique temporary Unix-socket-only PostgreSQL cluster through `createQueueHarness({ empty: true })`. TCP listening was disabled. Connections used explicit private socket/database/user settings rather than the application's connection URL. Backup/restore subprocesses used a minimal environment without inherited `PG*` connection configuration.

Procedure actually rehearsed, entirely on synthetic disposable data:

1. Apply all 14 checked-in SQL migrations in order to an empty local fixture.
2. Insert a small synthetic Clinic Admin/consulting-doctor, patient, clinic, branch, assignment and appointment graph. No passwords, live identifiers, sessions or email delivery required.
3. Create a PostgreSQL custom-format dump from the private source database using noninteractive, explicit socket arguments.
4. Restore into a second initially empty database in the same private cluster with stop-on-error and a single transaction; no clean/drop operation against any live target.
5. Compare aggregate manifests and schema-only dumps. Only the PostgreSQL client's random `restrict` guard key was excluded from the textual schema comparison.
6. Verify duplicate appointment token rejection, positive-token check, allowed-status check and clinic-admin ownership enforcement both before and after restore.
7. Close fixture clients, stop the disposable cluster, and delete its temporary directory and synthetic dump. Cleanup completed.

| Evidence | Source fixture | Restored fixture |
| --- | ---: | ---: |
| Users / clinics / branches / doctors / appointments | 2 / 1 / 1 / 1 / 1 | 2 / 1 / 1 / 1 / 1 |
| Public tables / indexes / constraints / enabled application triggers | 20 / 67 / 80 / 10 | 20 / 67 / 80 / 10 |
| Schema-only comparison | Matched | Matched |
| Expected rejected invalid writes | 4 | 4 |

Eight total guard-rejection assertions passed. Live database reads by the rehearsal, live backup operations and SMTP calls were all zero. The separate development inventory above did read development aggregates.

**Limit:** this validates the checked-in migration chain and a local PostgreSQL dump/restore mechanism, not actual-VPS recoverability, backup encryption/access control, retention, capacity, external role/extension availability, point-in-time recovery, production migration compatibility or production recovery time. No real backup file was requested, accessed or retained.

## UAT evidence and explicit unknowns

The main agent supplied these unauthenticated GET observations:

| Surface | Observation | What it establishes |
| --- | --- | --- |
| Root and sign-in HTML | HTTP 200; no HSTS on those HTML responses | Public HTML reachable; HSTS coverage differs by surface |
| `/api/healthz` | HTTP 200; HSTS present | Public health endpoint reachable |
| `/api/auth/status` | HTTP 200; `no-store`, anonymous role, HSTS present | Anonymous status response/cache policy observed |

These are not credential, middleware, CSRF, token, cookie, authorization, session-expiry or authenticated-browser proof. They do not establish deployed-source parity or correct HSTS at the edge across the site.

Actual VPS account/mapping inventory, installed schema/build, running configuration, real staff login/recovery, patient-code delivery, invitation/setup delivery, external SMTP deliverability and production backup/restore remain **unverified**. No unavailable files or credentials are requested as a substitute for these checks.

Read `docs/digiq-auth-compatibility.md` for the fixed 12-hour session model, compatibility surfaces, auth-status contract discrepancy and remaining cache/expiry/cross-tab gaps. Its historical “no live accounts accessed” scope describes that earlier source review; this document adds only development aggregate evidence and an isolated rehearsal.

## Non-executing release sequence — operator-owned

1. **Authorize and identify the target.** Record the intended deployed version and whether production is Replit-managed PostgreSQL or an external VPS database. Workspace development evidence is not an actual-VPS inventory.
2. **Resolve remaining development gates without overwriting users.** Review missing native staff setup, preserving account roles, IDs, ownership, assignments and retained mappings. The known three-index booking drift has been repaired and verified in development; recheck for recurrence rather than treating it as still open. Approve any further credential/setup or schema work separately. Repeat the aggregate preflight after approved remediation.
3. **Reconcile compatibility and regression evidence.** Check native endpoint contracts, Clinic Admin access/consulting scope, booking/queue concurrency, printing/downloads, session expiry/logout/revocation and private-cache lifecycle. Isolated fixture success must not be presented as authenticated UAT success.
4. **Complete actual-target inventory and delivery gates under explicit authorization.** Use aggregate redacted checks and approved disposable identities. Verify deployed auth mode/build, staff password readiness, invitation/setup/recovery and patient-code delivery. Ordinary staff password login must not depend on SMTP. Preserve provider mapping/schema compatibility until reconciliation is approved.
5. **Approve recoverability before cutover.** An operator must establish an actual-target backup and a restore test on a distinct authorized destination, with access controls, encryption, retention, restoration permissions, schema/guard verification, measured recovery time and rollback checkpoints. Never test restore against the live service.
6. **Review migration mechanism.** Replit-managed production schema changes belong to the user-controlled Publish schema-diff/rename-review flow, not custom production migration scripts or startup DDL. For external production, use the documented, separately authorized operator migration process after confirming the target; Replit Publish does not migrate an external VPS database.
7. **User decides whether to publish.** Review any destructive diff or rename, operational communication and rollback triggers. No unattended publish, provider retirement or credential/key changes are authorized by this guide.
8. **Operator validates after authorized release.** Check public HTML/API headers including the HSTS discrepancy, authenticated role/scope behavior, staff login without SMTP, patient/setup/recovery delivery when approved, concurrency guards and cache/session behavior. Stop or roll back through the approved process if acceptance gates fail.

Rollback must preserve data and compatibility rather than overwrite actual accounts with the development or synthetic fixture. Do not implicitly switch session modes, rotate the challenge secret, restore a compromised signing key or erase legacy mappings. Review the single-key replacement caveats in the compatibility document for any separately approved key operation.

This evidence supports a gated operator review, not a claim that production is ready or that external delivery/recovery has been proven.