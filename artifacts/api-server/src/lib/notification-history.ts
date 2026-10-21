import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash } from "node:crypto";
import { assertNoErasedAssetReference } from "./erased-asset-guard";
import { db, settings, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { assert } from "./http";
import { DEMO_FIXTURE } from "./demo-policy";
import { logger } from "./logger";
import { notificationStaffSubjects } from "./notification-staff-subjects";
import { signHistorySubjects, verifyHistorySubjects } from "./notification-history-provenance";
import { explicitNotificationSubjects } from "./notification-explicit-subjects";

// History retention is independent of permanent dispatch/idempotency claims.
export const HISTORY_RETENTION_DAYS = 90;
const prefix = "notification-history:";
export const historyId = (key: string) => prefix + createHash("sha256").update(key).digest("hex");
const states = ["pending", "sending", "provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "configuration_failed", "preparation_failed", "disabled", "obsolete", "no_recipient", "not_attempted"] as const;
type State = typeof states[number];
type Snapshot = { sender?: string; recipient?: string; subject?: string; message?: string; templateId?: string; templateRevision?: number; templateScope?: string; dltTemplateId?: string; provider?: string };
type Entry = { channel: "email" | "sms"; event: string; source?: "automatic" | "test"; clinicId?: string; reference?: string; recipientGroup: string; occurrence?: string; createdAt?: number; dueAt?: number; _sourceInput?: any; preparationReason?: string };
function key() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw new Error("History encryption unavailable");
  return Buffer.from(raw, "hex");
}
export function safeNotificationText(value: string) {
  // No private booking links, bearer QR values, security codes or arbitrary HTML.
  return value.replace(/https?:\/\/[^\s<>"']+/gi, "[link withheld]")
    .replace(/\/(?:book|ticket|check-in|checkin|appointments\/verify)\/[^\s<>"']+/gi, "[private link withheld]")
    .replace(/\b(?:token|apiKey|authorization|bearer|password|secret)\s*[:=]\s*[^\s]+/gi, "[protected value withheld]")
    .slice(0, 24000);
}
function protect(id: string, value: Snapshot, secrets: string[]) {
  const clean = { ...value };
  for (const field of ["subject", "message", "sender", "recipient", "dltTemplateId", "templateId", "provider"] as const) {
    if (clean[field] !== undefined) {
      let text = String(clean[field]);
      for (const secret of secrets.filter(Boolean)) text = text.split(secret).join("[credential withheld]");
      clean[field] = safeNotificationText(text);
    }
  }
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(id));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(clean)), cipher.final()]);
  return [nonce.toString("base64"), cipher.getAuthTag().toString("base64"), bytes.toString("base64")].join(".");
}
function reveal(id: string, encrypted: string): Snapshot {
  const [nonce, tag, body] = encrypted.split(".");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(nonce, "base64"));
  cipher.setAAD(Buffer.from(id)); cipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(body, "base64")), cipher.final()]).toString("utf8"));
}
/** Internal erasure graph only; never expose decrypted snapshots through impact
 * or receipts. All historical envelopes matter, not just the newest message. */
export function historyAssetSnapshots(id: string, data: any): Snapshot[] {
  return [data.encrypted, ...(data.snapshots ?? []).map((s: any) => s.encrypted)]
    .filter(Boolean).map((encrypted: string) => reveal(id, encrypted));
}
const contactHash = (v: string) => createHmac("sha256", key()).update(v.trim().toLowerCase()).digest("hex");
/** A savepoint isolates any history write failure from the operational transaction.
 * Snapshot is immutable after the first sending claim. No exception data is logged. */
export async function recordNotification(conn: any, job: string, entry: Entry, status: State, snapshot?: Snapshot, secrets: string[] = [], now = Date.now(), httpStatus?: number, initialOnly = false) {
  try {
    await conn.transaction(async (tx: any) => {
      const id = historyId(job);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
      const [prior] = await tx.select().from(settings).where(eq(settings.id, id));
      const old = prior?.data;
      // A permanent-erasure marker is authoritative over stale completions.
      // It contains no envelope or private snapshot and must never be revived.
      if (old?.erased === true) return;
      const previousSubjects = old?.provenance ? verifyHistorySubjects(id, old) : null;
      if (old?.provenance && !previousSubjects) throw new Error("Historical source proof is invalid");
      // This context is process-local only: never store raw subject IDs or a
      // duplicate appointment snapshot in the history payload.
      const { _sourceInput, ...publicEntry } = entry;
      const subjects = _sourceInput ? await notificationStaffSubjects(tx, _sourceInput) : null;
      if (subjects && entry.source === "test" && snapshot?.recipient)
        subjects.push(...await explicitNotificationSubjects(tx, entry.channel, snapshot.recipient));
      // Hold native identities through the write. A cached completion cannot
      // introduce a new private envelope after its account has disappeared.
      for (const subject of [...new Set(subjects ?? [])].sort()) {
        const [native] = await tx.select({ id: users.id }).from(users).where(eq(users.id, subject)).for("share");
        if (!native) throw new Error("Notification subject account is unavailable");
      }
      const previousStatus = old?.status;
      if (initialOnly && old) return;
      const data: any = old || { ...publicEntry, source: entry.source || "automatic", createdAt: entry.createdAt ?? now, status, timeline: [] };
      const unprovenHistoricalEnvelope = !!old && !previousSubjects &&
        !!(old.encrypted || old.snapshots?.length || old.senderHash || old.recipientHash);
      if (previousStatus === status && (!snapshot || status === "sending")) return;
      if (snapshot && (status !== "sending" ? !data.dispatchAt : previousStatus !== "sending")) {
        await assertNoErasedAssetReference(tx, snapshot);
        try {
          data.encrypted = protect(id, snapshot, secrets);
          data.senderHash = snapshot.sender ? contactHash(snapshot.sender) : undefined;
          data.recipientHash = snapshot.recipient ? contactHash(snapshot.recipient) : undefined;
          data.detailsUnavailable=false;
          if(status==="sending")data.snapshots=[...(data.snapshots||[]),{at:now,encrypted:data.encrypted}].slice(-30);
        } catch {
          // Explicit incomplete-history indicator, never plaintext fallback.
          delete data.encrypted;delete data.senderHash;delete data.recipientHash;
          data.detailsUnavailable=true;
          logger.warn("Notification sensitive snapshot unavailable; metadata only retained");
        }
      }
      data.status = status;
      data.reason = status === "pending" || status === "sending" || status === "provider_accepted" ? null :
        status === "preparation_failed" && entry.preparationReason ? entry.preparationReason : status;
      if (status === "pending") { data.queuedAt ??= now; data.dueAt = entry.dueAt ?? data.dueAt ?? now; delete data.completedAt; }
      if (status === "sending" && previousStatus !== "sending") data.dispatchAt = now;
      if (!["pending", "sending"].includes(status)) data.completedAt = now;
      if (httpStatus && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) data.httpStatus = httpStatus;
      data.timeline = [...data.timeline, { status, at: now, reason: data.reason }].slice(-30);
      // Existing unproven envelopes must not acquire a retrospective identity
      // claim from today's doctor, owner, or recipient. They stay fail-closed.
      if (subjects && !unprovenHistoricalEnvelope) {
        try { data.provenance = signHistorySubjects(id, data, subjects, previousSubjects ?? []); }
        catch { delete data.provenance; data.provenanceUnavailable = true; }
      }
      await tx.insert(settings).values({ id, data }).onConflictDoUpdate({ target: settings.id, set: { data } });
    });
  } catch { logger.warn("Notification history unavailable; operational dispatch state preserved"); }
}
export const recordDecision = (conn: any, job: string, entry: Entry, state: State, snapshot?: Snapshot, secrets: string[] = []) =>
  recordNotification(conn, job, entry, state, snapshot, secrets, Date.now(), undefined, true);
/** Permanent capture claim: skipped decisions are never a backlog, even after history expiry. */
export async function claimNotificationOccurrence(conn: any, channel: string, event: string, row: any) {
  const inserted=await conn.insert(settings).values({
    id:`notification-occurrence:${channel}:${event}:${row.id}:${row.revision||0}`,
    data:{createdAt:Date.now()},
  }).onConflictDoNothing().returning({id:settings.id});
  return inserted.length>0;
}
export function notificationEntry(data: any, channel: "email" | "sms"): Entry {
  return { channel, event: data.event, clinicId: data.clinicId, reference: data.snapshot?.reference,
    recipientGroup: data.recipientGroup || "patient", occurrence: `${data.event}:${data.appointmentId || data.snapshot?.id || data.clinicId}:${data.snapshot?.revision || 0}`,
    createdAt: data.createdAt, dueAt: data.dueAt, _sourceInput: data };
}
export function templateSnapshot(template: any, event: string, group: string, channel: string) {
  return { templateId: `${channel}:${event}:${group}`, templateScope: template.source, templateRevision: template.effectiveRevision ?? template.local?.revision ?? 0 };
}
const querySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
  channel: z.enum(["email", "sms"]).optional(), event: z.enum(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "provider_test"]).optional(),
  status: z.enum(states).optional(), clinicId: z.string().min(1).max(100).optional(),
  recipientGroup: z.enum(["patient", "clinicAdmin", "doctor", "receptionist", "explicit"]).optional(),
  source: z.enum(["automatic", "test"]).optional(), sender: z.string().min(1).max(254).optional(), recipient: z.string().min(1).max(254).optional(),
  reference: z.string().min(1).max(100).optional(), cursor: z.string().max(1000).optional(), pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export function authorizeNotificationHistory(user: any) {
  assert(user.role === "superAdmin" && !user.demo && user.demoFixture !== DEMO_FIXTURE, 403, "Real Superadmin access required");
}
function projection(row: any, now: number) {
  const d = row.data;
  const status = d.status === "sending" && d.dispatchAt < now - 300000 ? "delivery_unknown" : d.status;
  let snapshot: Snapshot = {};
  if (d.encrypted) snapshot = reveal(row.id, d.encrypted); // Fail explicitly, never silently lose stored details.
  const timeline = [...(d.timeline || [])];
  if (status !== d.status) timeline.push({ status, at: d.dispatchAt + 300000, reason: "abandoned_dispatch_claim" });
  return { id: row.id, channel: d.channel, event: d.event, status, source: d.source, occurrence: d.occurrence || null,
    clinicId: d.clinicId || null, reference: d.reference || null, recipientGroup: d.recipientGroup,
    ...Object.fromEntries(["provider", "sender", "recipient", "subject", "message", "templateId", "templateRevision", "templateScope", "dltTemplateId"].map(k => [k, (snapshot as any)[k] ?? null])),
    createdAt: d.createdAt ?? null, queuedAt: d.queuedAt ?? null, dueAt: d.dueAt ?? null, dispatchAt: d.dispatchAt ?? null,
    completedAt: d.completedAt ?? null, reason: status !== d.status ? "abandoned_dispatch_claim" : d.reason || null,
    httpStatus: d.httpStatus ?? null, providerId: null, legacy: !!d.legacy, detailsUnavailable: !!d.detailsUnavailable, timeline };
}
// Legacy outboxes expose only data they actually recorded. No rendered content,
// contact or current configuration is substituted for unknown historical fields.
const legacyIdPattern=/^legacy:(mail|sms)-outbox:[A-Za-z0-9:_-]{1,170}$/;
const historyRecords = (from:number,to?:number) => sql`
  select id, data from settings where id like 'notification-history:%'
  union all
  select 'legacy:' || s.id as id,
    jsonb_build_object(
      'channel',case when s.id like 'sms-outbox:%' then 'sms' else 'email' end,
      'event',s.data->>'event','status',s.data->>'state','source','automatic',
      'clinicId',s.data->>'clinicId','reference',s.data->'snapshot'->>'reference',
      'recipientGroup',coalesce(s.data->>'recipientGroup','patient'),
      'createdAt',s.data->'createdAt','dueAt',s.data->'dueAt',
      'dispatchAt',s.data->'claimedAt','completedAt',s.data->'finishedAt','legacy',true
    ) as data
  from settings s where (s.id like 'mail-outbox:%' or s.id like 'sms-outbox:%')
    and (s.data->>'createdAt')::bigint >= ${from}
    ${to===undefined?sql``:sql`and (s.data->>'createdAt')::bigint <= ${to}`}
    and not exists (
      select 1 from settings h where h.id =
        'notification-history:' || encode(sha256(convert_to(coalesce(s.data->>'historyKey',s.id),'UTF8')),'hex')
    )`;
export async function listNotificationLogs(user: any, input: unknown, conn: any = db, now = Date.now()) {
  authorizeNotificationHistory(user);
  const parsed = querySchema.safeParse(input); assert(parsed.success, 400, "Invalid notification history filters");
  const q = parsed.data!;
  assert(!q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), 400, "Invalid date range");
  const conditions = [sql`${settings.id} like ${prefix + "%"}`, sql`coalesce(${settings.data}->>'erased','false') <> 'true'`, sql`(${settings.data}->>'createdAt')::bigint >= ${now - HISTORY_RETENTION_DAYS * 86400000}`];
  for (const field of ["channel", "event", "clinicId", "recipientGroup", "source", "reference"] as const)
    if (q[field]) conditions.push(sql`${settings.data}->>${field} = ${q[field]}`);
  const statusExpr = sql`case when ${settings.data}->>'status' = 'sending' and (${settings.data}->>'dispatchAt')::bigint < ${now - 300000} then 'delivery_unknown' else ${settings.data}->>'status' end`;
  if (q.status) conditions.push(sql`${statusExpr} = ${q.status}`);
  if (q.from) conditions.push(sql`(${settings.data}->>'createdAt')::bigint >= ${Date.parse(q.from)}`);
  if (q.to) conditions.push(sql`(${settings.data}->>'createdAt')::bigint <= ${Date.parse(q.to)}`);
  for (const field of ["sender", "recipient"] as const) if (q[field]) conditions.push(sql`${settings.data}->>${field + "Hash"} = ${contactHash(q[field]!)}`);
  if (q.cursor) {
    let cursor: any;
    try { cursor = JSON.parse(Buffer.from(q.cursor, "base64url").toString()); } catch { assert(false, 400, "Invalid cursor"); }
    assert(Array.isArray(cursor) && cursor.length === 2 && Number.isSafeInteger(cursor[0]) && typeof cursor[1] === "string" && (/^notification-history:[a-f0-9]{64}$/.test(cursor[1])||legacyIdPattern.test(cursor[1])), 400, "Invalid cursor");
    conditions.push(sql`((${settings.data}->>'createdAt')::bigint, ${settings.id}) < (${cursor[0]}::bigint, ${cursor[1]}::text)`);
  }
  // Alias preserves the same parameterized filter expressions across both sources.
  conditions[0]=sql`true`;
  const from=Math.max(now-HISTORY_RETENTION_DAYS*86400000,q.from?Date.parse(q.from):0);
  const result=await conn.execute(sql`with notification_records as (${historyRecords(from,q.to?Date.parse(q.to):undefined)})
    select settings.id, settings.data from notification_records settings
    where ${sql.join(conditions,sql` and `)}
    order by (${settings.data}->>'createdAt')::bigint desc, ${settings.id} desc limit ${q.pageSize+1}`);
  const rows=result.rows;
  const selected = rows.slice(0, q.pageSize), last = selected.at(-1);
  return { items: selected.map((r: any) => projection(r, now)), nextCursor: rows.length > q.pageSize ? Buffer.from(JSON.stringify([last.data.createdAt, last.id])).toString("base64url") : null, timezone: "Asia/Kolkata" };
}
export async function getNotificationLog(user: any, id: string, conn: any = db, now = Date.now()) {
  authorizeNotificationHistory(user);
  assert(/^notification-history:[a-f0-9]{64}$/.test(id)||legacyIdPattern.test(id), 400, "Invalid notification log ID");
  let row:any;
  if(id.startsWith("legacy:")){
    const [original]=await conn.select().from(settings).where(eq(settings.id,id.slice(7)));
    const [captured]=original?await conn.select().from(settings).where(eq(settings.id,historyId((original.data as any).historyKey||original.id))):[];
    if(original&&!captured){
      const d=original.data as any;
      row={id,data:{channel:original.id.startsWith("sms-")?"sms":"email",event:d.event,status:d.state,source:"automatic",
        clinicId:d.clinicId,reference:d.snapshot?.reference,recipientGroup:d.recipientGroup||"patient",createdAt:d.createdAt,
        dueAt:d.dueAt,dispatchAt:d.claimedAt,completedAt:d.finishedAt,legacy:true}};
    }
  }else [row]=await conn.select().from(settings).where(eq(settings.id,id));
  assert(row && row.data.erased !== true && row.data.createdAt >= now - HISTORY_RETENTION_DAYS * 86400000, 404, "Notification log unavailable");
  return projection(row, now);
}
export async function cleanupNotificationHistory(conn: any = db, now = Date.now()) {
  // Bounded batches; never delete mail-outbox, sms-outbox or test claims.
  await conn.execute(sql`delete from settings where id in (select id from settings where id like ${prefix + "%"} and coalesce(data->>'erased','false') <> 'true' and (data->>'createdAt')::bigint < ${now - HISTORY_RETENTION_DAYS * 86400000} order by id limit 500)`);
}
