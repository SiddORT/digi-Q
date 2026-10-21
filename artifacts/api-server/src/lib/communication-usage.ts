import { db, clinics } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { assert } from "./http";
import { DEMO_FIXTURE } from "./demo-policy";
import { historyRecords, projection } from "./notification-history";

const events = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"] as const;
const buckets = ["accepted", "pending", "failed", "unknown", "skipped"] as const;
const filters = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  channel: z.enum(["sms", "email"]).optional(),
  event: z.enum([...events, "provider_test"]).optional(),
  status: z.enum(buckets).optional(),
  clinicId: z.string().min(1).max(100).optional(),
  source: z.enum(["automatic", "test"]).default("automatic"),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(1000).optional(),
}).strict();
const numberAt = (field: string) => sql`case when data->>${field} ~ '^-?[0-9]{1,15}$' then (data->>${field})::bigint else null end`;
const idPattern = /^(notification-history:[a-f0-9]{64}|legacy:(mail|sms)-outbox:[A-Za-z0-9:_-]{1,170})$/;

/** Only recorded operational source coordinates establish attribution. Never
 * match current contacts, doctor memberships, names or a user's clinicIds cache.
 * Legacy outboxes are the operational source themselves; captured envelopes
 * without source provenance stay unattributed (and never become clinic-visible).
 */
function records(now: number, metadataOnly = true, selection: Parameters<typeof historyRecords>[1] = {}) {
  return sql`with raw as materialized (${historyRecords(metadataOnly, selection)}),
    classified as (
      select id, data, ${numberAt("createdAt")} as occurred_at,
        case when data->>'status'='sending' and
          (${numberAt("dispatchAt")} is null or ${numberAt("dispatchAt")} < ${now - 300000})
          then 'delivery_unknown' else coalesce(data->>'status','unknown') end as state,
        case when data->>'source'='automatic'
          and data->>'event' in (${sql.join(events.map(e => sql`${e}`), sql`,`)})
          and data->>'recipientGroup' in ('patient','doctor','clinicAdmin','receptionist')
          and (data->>'legacy'='true' or data->'provenance'->>'version'='2')
          then nullif(data->>'clinicId','') else null end as attributed_clinic
      from raw where coalesce(data->>'erased','false') <> 'true'
        and data->>'channel' in ('sms','email')
    ), records as (
      select *, case
        when state='provider_accepted' then 'accepted'
        when state in ('pending','sending') then 'pending'
        when state in ('provider_rejected','pre_dispatch_failed','configuration_failed','preparation_failed') then 'failed'
        when state in ('not_attempted','disabled','obsolete','no_recipient') then 'skipped'
        else 'unknown' end as bucket
      from classified
    )`;
}

async function scope(user: any, conn: any) {
  assert(["superAdmin", "clinicAdmin"].includes(user.role) && !user.demo && user.demoFixture !== DEMO_FIXTURE,
    403, "Administrator reporting access required");
  if (user.role === "superAdmin") return null;
  const result = await conn.execute(sql`select id, data->>'name' as name from clinics where admin_id=${user.id} order by id`);
  assert(result.rows.length > 0, 403, "Current clinic ownership required");
  return {
    ids: result.rows.map((row: any) => row.id as string),
    id: result.rows.length === 1 ? result.rows[0].id : null,
    name: result.rows.length === 1 ? result.rows[0].name : `All currently owned clinics (${result.rows.length})`,
  };
}
function ownership(user: any) {
  // Re-evaluated inside EVERY read, including details, after the initial check.
  return user.role === "clinicAdmin"
    ? sql`attributed_clinic in (select id from clinics where admin_id=${user.id})`
    : sql`true`;
}
function metadata(row: any) {
  const d = row.data;
  const timestamp = (k: string) => Number.isSafeInteger(d[k]) ? d[k] : null;
  return {
    id: row.id, channel: d.channel, event: d.event || "unknown", status: row.state,
    bucket: row.bucket, clinicId: row.attributed_clinic || null,
    recipientGroup: d.recipientGroup || "unknown", createdAt: row.occurred_at == null ? null : Number(row.occurred_at),
    dispatchAt: timestamp("dispatchAt"), completedAt: timestamp("completedAt"),
    queuedAt: timestamp("queuedAt"), dueAt: timestamp("dueAt"),
    httpStatus: Number.isInteger(d.httpStatus) && d.httpStatus >= 100 && d.httpStatus <= 599 ? d.httpStatus : null,
    legacy: !!d.legacy, recipient: null as string | null,
    // Never expose arbitrary persisted/provider text through this projection.
    reason: row.bucket === "unknown" ? "Outcome not confirmed" :
      ["failed", "skipped"].includes(row.bucket) ? row.state.replace(/_/g, " ") : null,
  };
}
const cursorTime = sql`coalesce(occurred_at, -9007199254740991)`;

export async function communicationUsage(user: any, input: unknown, conn: any = db, now = Date.now()) {
  const owned = await scope(user, conn);
  const parsed = filters.safeParse(input);
  assert(parsed.success, 400, "Invalid communication usage filters");
  const q = parsed.data!;
  assert(!q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), 400, "Invalid date range");
  if (owned) {
    assert(q.source === "automatic" && (!q.clinicId || owned.ids.includes(q.clinicId)), 403, "Current clinic scope required");
  }
  const base = [ownership(user), sql`data->>'source'=${q.source}`];
  if (q.clinicId) base.push(q.clinicId === "unattributed" ? sql`attributed_clinic is null` : sql`attributed_clinic=${q.clinicId}`);
  const conditions = [...base];
  if (q.from) conditions.push(sql`occurred_at >= ${Date.parse(q.from)}`);
  if (q.to) conditions.push(sql`occurred_at <= ${Date.parse(q.to)}`);
  if (q.channel) conditions.push(sql`data->>'channel'=${q.channel}`);
  if (q.event) conditions.push(sql`data->>'event'=${q.event}`);
  if (q.status) conditions.push(sql`bucket=${q.status}`);
  const matching = sql.join(conditions, sql` and `);
  // One SQL statement supplies one MVCC snapshot for counts and the bounded page.
  let seek = sql`true`;
  if (q.cursor) {
    let c: any;
    try { c = JSON.parse(Buffer.from(q.cursor, "base64url").toString()); } catch { /* validated below */ }
    assert(Array.isArray(c) && c.length === 2 && Number.isSafeInteger(c[0]) &&
      typeof c[1] === "string" && idPattern.test(c[1]), 400, "Invalid communication cursor");
    seek = sql`(${cursorTime},id) < (${c[0]}::bigint,${c[1]}::text)`;
  }
  const rawClinicId = owned?.id || (q.clinicId !== "unattributed" ? q.clinicId : undefined);
  const result = await conn.execute(sql`${records(now, true, { clinicId: rawClinicId, source: q.source, ownerId: owned ? user.id : undefined })},
    matching as (select * from records where ${matching}),
    counts as (
      select data->>'channel' as channel, bucket, attributed_clinic as "clinicId",
        (select data->>'name' from clinics where id=attributed_clinic) as "clinicName", count(*)::float8 as count
      from matching group by data->>'channel', bucket, attributed_clinic
    ), page as (
      select id, data, state, bucket, occurred_at, attributed_clinic from matching where ${seek}
      order by ${cursorTime} desc, id desc limit ${q.pageSize + 1}
    )
    select
      coalesce((select jsonb_agg(to_jsonb(page) order by coalesce(occurred_at,-9007199254740991) desc,id desc) from page),'[]') as page,
      coalesce((select jsonb_agg(to_jsonb(counts)) from counts),'[]') as counts,
      (select count(*)::float8 from matching) as total,
      (select min(occurred_at)::float8 from records where ${sql.join(base, sql` and `)}) as earliest,
      (select count(*)::float8 from matching where data->>'legacy'='true') as legacy,
      (select count(*)::float8 from matching where attributed_clinic is null) as unattributed`);
  const r = result.rows[0];
  const page = r.page.slice(0, q.pageSize), last = page.at(-1);
  return {
    items: page.map(metadata), counts: r.counts, total: r.total,
    nextCursor: r.page.length > q.pageSize ? Buffer.from(JSON.stringify([last.occurred_at == null ? -9007199254740991 : Number(last.occurred_at), last.id])).toString("base64url") : null,
    timezone: "Asia/Kolkata", earliestAvailableAt: r.earliest,
    legacyCount: r.legacy, unattributedCount: r.unattributed,
    scopeClinicId: owned?.id || null, scopeClinicName: owned?.name || null,
  };
}

export async function communicationUsageDetail(user: any, id: string, conn: any = db, now = Date.now()) {
  await scope(user, conn);
  assert(idPattern.test(id), 400, "Invalid communication record ID");
  const result = await conn.execute(sql`${records(now, false, { id })}
    select * from records where id=${id} and ${ownership(user)}`);
  const row = result.rows[0];
  assert(row, 404, "Communication record unavailable");
  const safe = metadata(row);
  // No platform/security snapshots are decrypted, even for this report's SA view.
  if (row.attributed_clinic && row.data.encrypted) {
    const log = projection(row, now);
    const contact = (log as any).recipient;
    if (typeof contact === "string" && contact) {
      safe.recipient = contact.includes("@") ? `${contact.slice(0, 1)}***@***` : `***${contact.replace(/\D/g, "").slice(-2)}`;
    }
  }
  return safe;
}
