import { sql, type SQL } from "drizzle-orm";
import { documentSql } from "./list-query";
import { statusGroups } from "./queue-order";
import { assert } from "./http";

/** Listing only. Caller must hold the existing queue lock and compute clinical summaries from FULL rows. */
export async function staffQueueList(conn: any, session: any, q: any, paginated: boolean) {
  const page = paginated ? q.page || 1 : 1, size = q.pageSize || 20;
  assert(Number.isInteger(page) && page >= 1 && page <= 100000,400,"Invalid queue page");
  assert(Number.isInteger(size) && size >= 1 && size <= 100,400,"Invalid queue page size");
  assert(!q.search || typeof q.search === "string" && q.search.length <= 200,400,"Queue search must be at most 200 characters");
  const scope = sql`r.doctor_id=${session.doctorId} and r.branch_id=${session.branchId} and r.date=${session.date}
    ${session.startTime ? sql`and r.data->>'startTime'=${session.startTime}` : session.sessionId ? sql`and r.data->>'sessionId'=${session.sessionId}` : sql``}`;
  const pattern = q.search ? `%${q.search.replace(/[\\%_]/g,"\\$&")}%` : null;
  const search = pattern ? sql`(doc->>'token' ilike ${pattern} or doc->>'reference' ilike ${pattern} or doc->>'patientName' ilike ${pattern} or doc->>'patientCode' ilike ${pattern})` : sql`true`;
  const group = q.statusGroup && q.statusGroup !== "all" ? statusGroups[q.statusGroup] : null;
  assert(!q.statusGroup || q.statusGroup === "all" || group,400,"Invalid queue status group");
  const status = sql`${group ? sql`doc->>'status' in (${sql.join(group.map(value=>sql`${value}`),sql`,`)})` : sql`true`}
    and ${q.status ? sql`doc->>'status'=${q.status}` : sql`true`}`;
  const rank = sql`coalesce((doc->>'queueRank')::numeric,(doc->>'tokenNumber')::numeric)`;
  const columns: Record<string,SQL> = {
    createdAt: sql`doc->>'createdAt'`, date: sql`doc->>'date'`, status: sql`doc->>'status'`,
    tokenNumber: sql`(doc->>'tokenNumber')::numeric`, queueRank: rank, waitingAt: sql`doc->>'waitingAt'`,
  };
  const sort = q.sort || "queueRank", key = sort.replace(/^-/, "");
  assert(columns[key],400,"Unsupported queue sort field");
  // Retain the existing reservation order default, including legacy waitingAt alias.
  const order = sort === "queueRank" || sort === "waitingAt"
    ? sql`${rank} asc nulls last, (doc->>'tokenNumber')::numeric asc nulls last, doc->>'id' asc`
    : sql`${columns[key]} ${sort.startsWith("-") ? sql`desc nulls last` : sql`asc nulls first`}, doc->>'id' asc`;
  const result = await conn.execute(sql`with scoped as (
      select ${documentSql("appointments")} as doc from appointments r where ${scope}
    ), searched as (select doc from scoped where ${search}),
    filtered as (select doc from searched where ${status}),
    page_rows as (select doc from filtered order by ${order} ${paginated ? sql`limit ${size} offset ${(page-1)*size}` : sql``})
    select (select count(*)::int from filtered) as total,
      coalesce((select jsonb_agg(doc) from page_rows),'[]'::jsonb) as entries,
      (select jsonb_build_object('all',count(*)::int,
        'active',(count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting','called','inConsultation')))::int,
        'waiting',(count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting')))::int,
        'absent',(count(*) filter(where doc->>'status'='noShow'))::int,
        'completed',(count(*) filter(where doc->>'status'='completed'))::int,
        'cancelled',(count(*) filter(where doc->>'status'='cancelled'))::int) from searched) as "statusCounts"`);
  const { entries, total, statusCounts } = result.rows[0];
  const pageSize = paginated ? size : Math.max(total,1);
  return { entries, entriesTotal: total, filteredTotal: total, page, pageSize, totalPages: Math.ceil(total/pageSize), statusCounts };
}