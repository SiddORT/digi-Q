import { sql } from "drizzle-orm";
import { assert } from "./http";

/** Staff represented in a prepared notification, not only its recipient. */
export async function notificationStaffSubjects(conn: any, data: any): Promise<string[]> {
  const ids = new Set<string>();
  if (data.recipientUserId && data.recipientGroup !== "patient") ids.add(data.recipientUserId);
  // Reschedule messages include the former clinician in previous_details.
  // Guard both contexts; checking only the new visit leaves the former
  // clinician's cached identity outside the account-removal barrier.
  for (const row of [data.snapshot || {}, data.previousSession || {}]) {
  if (row.actorId) {
    const result = await conn.execute(sql`select role from users where id=${row.actorId}`);
    // An absent previously saved actor must not silently become unguarded.
    if (!result.rows[0] || result.rows[0].role !== "patient") ids.add(row.actorId);
  }
  if (row.doctorId) {
    const result = await conn.execute(sql`select user_id,status from doctors where id=${row.doctorId}`);
    const doctor = result.rows[0];
    assert(doctor, 409, "Notification doctor reference is no longer available");
    if (doctor.user_id) ids.add(doctor.user_id);
    else assert(doctor.status === "retired" && row.doctorName === "Deleted doctor", 409, "Notification requires anonymous historical doctor details");
  }
  }
  return [...ids].sort();
}
