import { db, appointments } from "@workspace/db";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { assert } from "./http";
import { flatten } from "./store";

export const HISTORY_PAGE_SIZE = 30;
const { data: _data, ...appointmentColumns } = getTableColumns(appointments);

/** Never transfer the full embedded event array when reading a private visit. */
export async function privateAppointmentRow(id: string, conn: any = db) {
  const [row] = await conn.select({
    ...appointmentColumns,
    data: sql<any>`${appointments.data} - 'history'`,
    hasHistory: sql<boolean>`jsonb_typeof(${appointments.data}->'history') = 'array'`,
  }).from(appointments).where(eq(appointments.id, id));
  assert(row, 404, "Record not found");
  const { hasHistory, ...fields } = row;
  return { ...flatten(fields), ...(hasHistory ? { history: [] } : {}) };
}

type Cursor = { time: number | null; ordinal: number };
function decodeCursor(value: unknown): Cursor | null {
  if (value === undefined) return null;
  assert(typeof value === "string" && value.length <= 2048 && /^[A-Za-z0-9_-]+$/.test(value), 400, "Invalid history cursor");
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    assert(decoded && (decoded.time === null || typeof decoded.time === "number" && Number.isFinite(decoded.time)) &&
      Number.isSafeInteger(decoded.ordinal) && decoded.ordinal > 0, 400, "Invalid history cursor");
    return decoded;
  } catch {
    assert(false, 400, "Invalid history cursor");
    return null;
  }
}

/** Keyset over the event's recorded instant and JSON array ordinal. Later writes win equal-time ties. */
export async function appointmentHistoryPage(id: string, cursorValue?: unknown, conn: any = db) {
  const cursor = decodeCursor(cursorValue);
  const result = await conn.execute(sql`
    with parsed as (
      select event, ordinal::integer as ordinal,
        -- JSONPath's silent datetime parser also exists before PostgreSQL 16.
        -- Restrict to calendar dates/timestamps so a valid time-only value cannot
        -- reach the timestamptz cast. Normalize Z: automatic JSONPath parsing
        -- otherwise rejects fractional-second UTC timestamps on older servers.
        case when event->>'occurredAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([Tt ].*)?$'
          then jsonb_path_query_first(
            to_jsonb(regexp_replace(event->>'occurredAt', '[zZ]$', '+00:00')),
            '$.datetime()', '{}'::jsonb, true) #>> '{}'
          else null end as parsed_time
      from ${appointments} a
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(a.data->'history') = 'array' then a.data->'history' else '[]'::jsonb end
      ) with ordinality as h(event, ordinal)
      where a.id = ${id}
    ), events as (
      select event, ordinal,
        extract(epoch from parsed_time::timestamptz)::double precision as instant
      from parsed
    )
    select event, ordinal, instant from events
    ${cursor ? sql`where (coalesce(instant, '-Infinity'::double precision), ordinal)
      < (coalesce(${cursor.time}::double precision, '-Infinity'::double precision), ${cursor.ordinal})` : sql``}
    order by instant desc nulls last, ordinal desc
    limit ${HISTORY_PAGE_SIZE + 1}`);
  const rows = result.rows as { event: any; ordinal: number; instant: number | null }[];
  const page = rows.slice(0, HISTORY_PAGE_SIZE);
  const last = page.at(-1);
  return {
    events: page.map(r => r.event),
    nextCursor: rows.length > HISTORY_PAGE_SIZE && last
      ? Buffer.from(JSON.stringify({ time: last.instant, ordinal: Number(last.ordinal) })).toString("base64url")
      : null,
  };
}
