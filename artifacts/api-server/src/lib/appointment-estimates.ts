import { db, appointments } from "@workspace/db";
import { sql } from "drizzle-orm";
import { flatten } from "./store";
import { readDuration, sessionKey } from "./session-duration";
import { getPresence } from "./presence";
import { arrivalEstimate } from "./arrival-estimate";
import { operationalDoctorContext } from "./availability";

/** Bounded to the booked doctor/location/day, not a displayed page of queue rows. */
export async function estimateContext(row: any, conn: any = db) {
  const rows = (await conn.select().from(appointments).where(sql`${appointments.doctorId}=${row.doctorId} and ${appointments.branchId}=${row.branchId} and ${appointments.date}=${row.date}`)).map(flatten);
  const duration = await readDuration(row, conn);
  const presence = await getPresence(row, conn);
  const operational = await operationalDoctorContext(row.doctorId, row.branchId, conn);
  if (!operational.active || !operational.assigned) presence.status = "away";
  return { rows, duration, presence };
}
export async function withEstimates(rows: any[], conn: any = db) {
  const contexts = new Map<string, ReturnType<typeof estimateContext>>();
  const now = Date.now();
  return Promise.all(rows.map(async row => {
    const key = sessionKey(row);
    if (!contexts.has(key)) contexts.set(key, estimateContext(row, conn));
    const context = await contexts.get(key)!;
    return { ...row, estimate: arrivalEstimate(row, context.rows, context.duration, context.presence.status, now) };
  }));
}
