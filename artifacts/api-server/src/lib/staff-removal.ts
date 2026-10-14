import { randomUUID, createHash } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { assert, HttpError } from "./http";
import { computeStaffDeletionImpact, userReferences } from "./staff-deletion-impact";
import { assertLiveRemovalActor, lockStaffCredentials } from "./staff-removal-auth";
import { issueRemovalReview, verifyRemovalReview, removalProposalDigest } from "./staff-removal-review";
import { classifyStaffSetting, exactStaffValue } from "./staff-settings-erasure";
import { eraseStaffAttribution, unattributedStaffLabels } from "./staff-attribution-erasure";
import { planStaffMedia, staffMediaGraph } from "./staff-media-impact";
import { eraseStaffRelationalRows } from "./staff-relational-erasure";
import { prepareDeletionReceipt, commitDeletionReceipt, getDeletionReceipt, processDeletionReceipt } from "./staff-deletion-receipts";
import { historyAssetSnapshots } from "./notification-history";
import type { ExclusiveLogoJob } from "./exclusive-media-cleanup";

type Context = { actorId: string; targetId: string; sessionHash: string };
const ident = (s: string) => sql.raw(`"${s.replaceAll('"', '""')}"`);
const fingerprint = (s: string) => createHash("sha256").update(s).digest("hex");
const proposal = { kind: "staff-account-removal" };
const personalLimiterFamilies = ["document-upload", "logo-upload", "staff-invite", "template-edit",
  "event-control", "template-preview", "template-test", "template-test:sms", "ticket-email",
  "integration-check", "integration-edit:actor", "sms-test:actor", "smtp-test:actor"];
const read = async (tx: any, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as any[];

/** Rare administrative operation: freeze all public reference writers, including
 * legacy JSON writers without row FKs. Bound waits; deadlock/timeout rolls back.
 * No physical file IO is performed in the account-removal transaction. */
export async function lockRemovalGraph(tx: any) {
  await tx.execute(sql`set local lock_timeout='5s'`);
  await tx.execute(sql`set local statement_timeout='30s'`);
  const tables = await read(tx, sql`select tablename from pg_tables where schemaname='public' order by tablename`);
  for (const { tablename } of tables) {
    try { await tx.execute(sql`lock table ${ident(tablename)} in share row exclusive mode nowait`); }
    catch (error: any) {
      if ((error.cause?.code ?? error.code) === "55P03")
        throw new HttpError(409, "The system is processing another write. Refresh this review and retry after it finishes.");
      throw error;
    }
  }
}

async function inspect(tx: any, context: Context) {
  const base = await computeStaffDeletionImpact(tx, context.actorId, context.targetId);
  const [target] = await read(tx, sql`select * from users where id=${context.targetId}`);
  const doctorRows = await read(tx, sql`select id from doctors where user_id=${context.targetId}`);
  const doctorIds = doctorRows.map(r => r.id);
  const attribution = { userId: target.id, doctorIds: new Set<string>(doctorIds),
    email: target.email, mobile: target.mobile, fullName: target.full_name, clerkId: target.clerk_id };
  const blockers = base.blockers.filter(b => !["IMPLEMENTATION_GATED", "JSON_REFERENCE_REVIEW", "ENCRYPTED_HISTORY_REVIEW"].includes(b.code));
  const warn = (code: string, message: string, source?: string, ids?: string[]) => blockers.push({ code, message, source, ids });
  if (!["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(target.role))
    warn("UNSUPPORTED_ROLE", "Only recognized staff accounts can be removed.");
  const schemas = await read(tx, sql`select nspname from pg_namespace where nspname not in
    ('public','information_schema','drizzle') and nspname not like 'pg_%'
    and exists(select 1 from pg_class c where c.relnamespace=pg_namespace.oid and c.relkind in ('r','p'))`);
  if (schemas.length) warn("UNKNOWN_DATA_SCHEMA", "An additional data schema requires explicit reference classification.");
  const guards = await read(tx, sql`select c.relname,
    bool_or(t.tgname='erased_staff_reference_guard' and t.tgenabled='O') as identity_guard,
    bool_or(t.tgname='erased_asset_reference_guard' and t.tgenabled='O') as asset_guard
    from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_trigger t on t.tgrelid=c.oid and not t.tgisinternal
    where n.nspname='public' and c.relkind in ('r','p') and c.relname not in
    ('staff_erased_assets','staff_erased_identities','staff_deletion_receipts','integration_credentials','__drizzle_migrations')
    group by c.relname order by c.relname`);
  const required = await read(tx, sql`select to_regclass('public.staff_erased_assets') as assets,
    to_regclass('public.staff_erased_identities') as identities,to_regclass('public.staff_deletion_receipts') as receipts`);
   const criticalNames = [
     ["settings", "erased_claim_immutable"], ["settings", "handoff_marker_immutable"],
     ["staff_deletion_receipts", "staff_receipt_removed_account"], ["staff_deletion_receipts", "staff_receipt_immutable"],
     ["users", "users_removed_identity_guard"], ["staff_erased_assets", "asset_fence_immutable"],
     ["staff_erased_identities", "identity_fence_immutable"], ["appointment_transitions", "transition_immutable"],
     ["appointment_transitions", "transition_validate"], ["appointments", "transition_preserve_visit"],
     ["doctors", "doctors_retirement_work_guard"], ["appointments", "appointments_retired_doctor_guard"],
     ["guest_requests", "guest_requests_retired_doctor_guard"], ["schedules", "schedules_retired_doctor_guard"],
     ["qrs", "qrs_retired_doctor_guard"],
   ];
   const installedCritical = await read(tx, sql`select c.relname,t.tgname from pg_trigger t
     join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and t.tgenabled='O'`);
   const missingCritical = criticalNames.filter(([table,name]) =>
     !installedCritical.some(row => row.relname === table && row.tgname === name));
  if (!required[0]?.assets || !required[0]?.identities || !required[0]?.receipts ||
       guards.some(g => !g.identity_guard || !g.asset_guard) || missingCritical.length)
    warn("WRITE_GUARDS_MISSING", "Required identity and media write fences are not installed.");
  const settingsRows = await read(tx, sql`select * from settings order by id`);
  let media: Awaited<ReturnType<typeof planStaffMedia>> | undefined;
  try { media = await planStaffMedia(tx, target.id, doctorIds); }
  catch { warn("MEDIA_PROOF_UNAVAILABLE", "Exclusive personal-file ownership cannot currently be proved."); }
  const changes: { id: string; action: string; data?: any }[] = [];
  for (const row of settingsRows) {
    const decision = classifyStaffSetting(row, attribution, media);
    if (decision.action === "resolve") warn("SETTINGS_REFERENCE_REVIEW", decision.reason!, "settings", [row.id]);
    else if (decision.action !== "preserve") changes.push({ id: row.id, action: decision.action, data: decision.data });
  }
  const graph = media?.evidence ?? (await staffMediaGraph(tx)).map(g => ({ table: g.table, row: g.row }));
   const privateTables = new Set(["settings", "auth_sessions", "auth_challenges", "otp_challenges",
    "staff_session_proofs", "auth_rate_limits", "notification_reads", "assignments"]);
  for (const { table, row } of graph) {
     if (table === "settings" || table === "users" && row.id === target.id ||
       table === "doctors" && doctorIds.includes(row.id) ||
       privateTables.has(table) && row.user_id === target.id) continue;
    if (table === "saved_views" && row.user_id === target.id && !row.shared_role) continue;
    for (const [column, value] of Object.entries(row)) {
       if (typeof value === "string" && [target.id, target.clerk_id].filter(Boolean).includes(value)) {
         const registered = userReferences.some(ref => ref.table === table && ref.columns.includes(column));
         const generatedAuditEntity = table === "audit_logs" && column === "entity_id" &&
           ["users", "staff", "system_users"].includes(row.entity_type);
         if (!registered && !generatedAuditEntity)
           warn("TEXT_REFERENCE_REVIEW", "An unclassified text relationship requires individual resolution.", `${table}.${column}`, row.id ? [row.id] : undefined);
       }
      if (!value || typeof value !== "object") continue;
       const contextual = column === "data" && doctorIds.includes(row.doctor_id) && !(value as any).doctorId
         ? { ...value, doctorId: row.doctor_id } : value;
       const sanitized = ["users", "doctors"].includes(table) || privateTables.has(table)
         ? value : eraseStaffAttribution(contextual, attribution);
      if (exactStaffValue(sanitized, new Set([target.id, target.clerk_id].filter(Boolean))))
        warn("JSON_REFERENCE_REVIEW", "A structured relationship requires explicit classification.", `${table}.${column}`, row.id ? [row.id] : undefined);
       if (unattributedStaffLabels(sanitized, attribution))
         warn("ATTRIBUTION_REFERENCE_REVIEW", "A copied staff label has no proven identity relationship.", `${table}.${column}`, row.id ? [row.id] : undefined);
    }
    if (table === "branches" && row.data?.linkedSchedule?.enabled && doctorIds.includes(row.data.linkedSchedule.doctorId))
      warn("LINKED_OPENING_HOURS", "Unlink this branch's opening hours from the doctor before removal.", table, [row.id]);
  }
  // Unlinked challenges may belong to a different registration/patient flow.
  // Only these staff-only purposes are attributable by normalized address.
  const challenges = await read(tx, sql`select * from auth_challenges where user_id is null and lower(email)=lower(${target.email}) order by id`);
  if (challenges.some(c => !["invitation", "reset"].includes(c.purpose)))
    warn("UNLINKED_CHALLENGE_REVIEW", "A shared-address registration or patient challenge needs individual resolution.");
  const groups = base.groups.filter(g => !g.source.startsWith("settings:"));
   const linkedChallenges = await read(tx, sql`select id,purpose from auth_challenges where user_id=${target.id}`);
   const limiterKeys = [...personalLimiterFamilies.map(family => `${family}:${target.id}`),
     `staff-login:account:${target.email.toLowerCase()}`, `change-password:account:${target.id}`,
     ...[...challenges.filter(c => ["invitation","reset"].includes(c.purpose)), ...linkedChallenges].map(c => `${c.purpose}:token:${c.id}`)];
   const limiterIds = (await read(tx, sql`select key from auth_rate_limits where key in
     (${sql.join(limiterKeys.map(key => sql`${fingerprint(key)}`), sql`,`)}) order by key`)).map(r => r.key);
   if (limiterIds.length) groups.push({ source: "auth_rate_limits:personal", action: "erase", ids: limiterIds, count: limiterIds.length });
  for (const action of ["erase", "anonymize"] as const) {
    const ids = changes.filter(c => c.action === action).map(c => c.id);
    if (ids.length) groups.push({ source: "settings:classified", action, ids, count: ids.length });
  }
  if (media?.exclusive.length) groups.push({ source: "media:verified-exclusive", action: "erase",
     ids: media.exclusiveLogoIds, count: media.exclusiveLogoIds.length });
   const version = removalProposalDigest({ base: base.version, guards, required, missingCritical, challenges, changes, groups,
    graph: graph.map(g => ({ table: g.table, row: g.row })).sort((a, b) =>
      `${a.table}:${removalProposalDigest(a.row)}`.localeCompare(`${b.table}:${removalProposalDigest(b.row)}`)),
    media: media && { jobs: media.exclusive, shared: media.sharedLogoIds, exclusive: media.exclusiveLogoIds }, blockers });
   return { impact: { ...base, version, groups, blockers, ready: blockers.length === 0 }, target, doctorIds, attribution, changes, media, limiterIds };
}

export async function reviewStaffRemoval(context: Context, conn: any = db) {
  return conn.transaction(async (tx: any) => {
    await tx.execute(sql`set transaction isolation level repeatable read`);
    await assertLiveRemovalActor(tx, context.actorId, context.sessionHash);
    const current = await inspect(tx, context), operationId = current.impact.ready ? randomUUID() : null;
    return { ...current.impact, operationId, reviewToken: operationId ? issueRemovalReview({
      mode: "delete", ...context, version: current.impact.version, proposal, operationId,
    }) : null };
  });
}

export async function commitStaffRemoval(context: Context, input: { confirmation: string; version: string; reviewToken: string }, conn: any = db) {
  assert(input.confirmation === "delete", 400, "Type exactly delete in lowercase");
  const review = verifyRemovalReview(input.reviewToken, { mode: "delete", ...context, proposal });
  assert(input.version === review.version, 409, "The deletion review changed");
  return conn.transaction(async (tx: any) => {
    await lockStaffCredentials(tx, [context.actorId, context.targetId]);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('custom-roles'))`);
    await lockRemovalGraph(tx);
    await assertLiveRemovalActor(tx, context.actorId, context.sessionHash);
    const existing = await read(tx, sql`select id,account_fingerprint from staff_deletion_receipts where id=${review.operationId}`);
    if (existing.length) {
      assert(existing[0].account_fingerprint === fingerprint(context.targetId), 409, "Removal operation mismatch");
      return getDeletionReceipt(tx, review.operationId);
    }
    const current = await inspect(tx, context);
    assert(current.impact.ready && current.impact.version === review.version, 409, "The account impact changed; review every current dependency again");
    verifyRemovalReview(input.reviewToken, { mode: "delete", ...context, proposal });
    // Encryption/storage configuration must validate before destructive writes.
    const receipt = prepareDeletionReceipt(context.targetId, review.version, current.media!.exclusive, review.operationId);
    for (const change of current.changes) {
      if (change.action === "erase") await tx.execute(sql`delete from settings where id=${change.id}`);
      else if (change.id.split(":").some(part => [context.targetId, current.target.clerk_id].filter(Boolean).includes(part))) {
        // The old key itself can contain native identity. Replace it with an
        // opaque claim; identity fences prevent recreating its original key.
        await tx.execute(sql`insert into settings(id,data) values(${"removed-claim:" + fingerprint(change.id)},${JSON.stringify(change.data)}::jsonb)`);
        await tx.execute(sql`delete from settings where id=${change.id}`);
      } else await tx.execute(sql`update settings set data=${JSON.stringify(change.data)}::jsonb where id=${change.id}`);
    }
    await tx.execute(sql`delete from audit_logs where actor_id=${context.targetId}
      and entity_id=${context.targetId} and entity_type='users' and action='changePassword'`);
    await eraseStaffRelationalRows(tx, context.targetId);
    await tx.execute(sql`delete from auth_challenges where user_id is null and lower(email)=lower(${current.target.email}) and purpose in ('invitation','reset')`);
    for (const id of current.limiterIds) await tx.execute(sql`delete from auth_rate_limits where key=${id}`);
    // Generic store audits contain action/type, not copied clinical narratives.
    await tx.execute(sql`update audit_logs set entity_id='deleted-user',summary='Staff account removed'
      where entity_id=${context.targetId} and entity_type in ('users','staff','system_users')`);
    const unresolvedAudit = await read(tx, sql`select id from audit_logs where entity_id=${context.targetId}`);
    assert(!unresolvedAudit.length, 409, "An audit target needs explicit classification");
    await tx.execute(sql`delete from users where id=${context.targetId}`);
    await commitDeletionReceipt(tx, receipt);
    for (const identity of [context.targetId, current.target.clerk_id].filter(Boolean))
      await tx.execute(sql`insert into staff_erased_identities(identity_fingerprint,operation_id) values(${fingerprint(identity)},${receipt.id})`);
    const assetAliases = new Set<string>();
    for (const id of current.media!.exclusiveLogoIds) assetAliases.add(id.slice(5).toLowerCase());
    for (const job of current.media!.exclusive) {
      const alias = job.key.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)?.[0];
      if (alias) assetAliases.add(alias.toLowerCase());
    }
    for (const alias of assetAliases)
      await tx.execute(sql`insert into staff_erased_assets(asset_fingerprint,operation_id) values(${fingerprint(alias)},${receipt.id})`);
    await tx.execute(sql`insert into audit_logs(id,actor_id,action,entity_type,entity_id,summary)
      values(${randomUUID()},${context.actorId},'permanent_removal','staff_removal_receipt',${receipt.id},'Staff account removed; shared care records preserved')`);
    await tx.execute(sql`set constraints all immediate`);
    return getDeletionReceipt(tx, receipt.id);
  });
}

/** Physical removal only after commit. Reference writers remain fenced across
 * the fresh whole-graph check and storage operation. Failures leave receipts
 * pending; receipt encryption is discarded only after verified absence. */
export async function retryStaffFileCleanup(operationId: string, conn: any = db, remove?: any) {
  return conn.transaction(async (tx: any) => {
    await lockRemovalGraph(tx);
    const graph = await staffMediaGraph(tx);
    const referenced = async (job: ExclusiveLogoJob) => {
      const alias = job.key.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)?.[0]?.toLowerCase();
      if (!alias) return true;
      for (const item of graph) {
        if (item.table === "staff_erased_assets" || item.table === "staff_erased_identities") continue;
        const snapshots = item.table === "settings" && item.row.id?.startsWith("notification-history:") && !item.row.data?.erased
          ? historyAssetSnapshots(item.row.id, item.row.data) : null;
        const text = JSON.stringify([item.row, snapshots]).toLowerCase().replace(/%2d|&#45;|&#x2d;/g, "-");
        if (text.includes(alias)) return true;
      }
      return false;
    };
    return processDeletionReceipt(tx, operationId, referenced, remove);
  });
}
