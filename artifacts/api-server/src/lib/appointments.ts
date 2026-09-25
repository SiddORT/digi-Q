import { db, appointments, patients, appointmentHistory } from "@workspace/db";
import { sql } from "drizzle-orm";
import { all, one, change, put, uid, audit, getSettings } from "./store";
import { assert } from "./http";
import { canRead, roles } from "./auth";
import { localNow, minutes, doctorContext } from "./availability";
import { orderedReservations, pendingStatuses, queueVersion, rank, sessionRows } from "./queue-order";
export const transitions: Record<string, { from: string[], to: string, stamp?: string }> = {
  checkIn: { from: ["booked"], to: "checkedIn", stamp: "checkedInAt" },
  enqueue: { from: ["checkedIn"], to: "waiting", stamp: "waitingAt" },
  call: { from: ["waiting"], to: "called", stamp: "calledAt" },
  start: { from: ["called"], to: "inConsultation", stamp: "consultationStartedAt" },
  complete: { from: ["inConsultation"], to: "completed", stamp: "completedAt" },
  noShow: { from: ["booked", "checkedIn", "waiting", "called"], to: "noShow" },
  requeue: { from: ["noShow"], to: "waiting", stamp: "waitingAt" },
  cancel: { from: ["booked", "checkedIn", "waiting"], to: "cancelled", stamp: "cancelledAt" },
};
export async function lockQueue(conn: any, doctorId: string, branchId: string, date: string) {
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + doctorId}))`);
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${`${doctorId}:${branchId}:${date}`}))`);
}
export function appointmentView(row: any, user: any) {
  const allowedActions = Object.entries(transitions).filter(([action, rule]) => rule.from.includes(row.status) && (user.role !== "patient" || action === "cancel") && (action !== "requeue" || ["superAdmin", "clinicAdmin", "receptionist"].includes(user.role))).map(([a]) => a);
  const { actorId, requestId, ...view } = row;
  return { ...view, queueRank: rank(row), revision: row.revision || 0, expectedDurationMinutes: row.expectedDurationMinutes ?? null, allowedActions };
}
export async function transition(user: any, id: string, body: any, conn: any = db, locked = false) {
  let row = await one(appointments, id, conn);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  if (!locked) {
    const original = row;
    await lockQueue(conn, row.doctorId, row.branchId, row.date); row = await one(appointments, id, conn);
    assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date, 409, "Appointment was rescheduled; refresh and retry");
  }
  const rule = transitions[body.action];
  assert(rule && rule.from.includes(row.status), 409, "Invalid appointment state transition");
  assert(!body.expectedStatus || row.status === body.expectedStatus, 409, "Appointment changed; refresh and retry");
  assert(body.expectedRevision === undefined || (row.revision || 0) === body.expectedRevision, 409, "Appointment changed; refresh and retry");
  if (user.role === "patient") assert(body.action === "cancel" && row.patientId === user.patientId, 403, "Patients can only cancel their own booking");
  else roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  if (!["cancel", "complete", "noShow"].includes(body.action)) await doctorContext(row.doctorId, row.branchId, conn);
  const now = localNow(row.timezone || "Asia/Kolkata");
  if (body.action === "cancel") {
    const config = await getSettings(conn);
    const difference = (Date.parse(row.date) - Date.parse(now.date)) / 60000 + minutes(row.startTime || "00:00") - now.minute;
    assert(difference >= config.cancellationCutoffMinutes, 409, "Cancellation cutoff has passed");
  } else assert(row.date === now.date, 409, "Queue actions are allowed only on the appointment date");
  const rows = sessionRows(await all(appointments, conn), row);
  if (["noShow", "requeue"].includes(body.action)) assert(typeof body.reason === "string" && body.reason.trim().length > 0, 400, "A reason is required");
  if (body.action === "requeue") {
    roles(user, ["superAdmin", "clinicAdmin", "receptionist"]);
    assert(body.expectedRevision !== undefined && body.expectedQueueVersion === queueVersion(rows), 409, "Queue changed; refresh and select the return position again");
    const pending = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)));
    assert(Number.isInteger(body.position) && body.position >= 1 && body.position <= pending.length + 1, 400, "Choose a valid return position");
    // Integer ranks avoid floating point exhaustion; all affected writes share the session lock.
    pending.splice(body.position - 1, 0, row);
    for (const [index, entry] of pending.entries()) {
      entry.queueRank = index + 1;
      if (entry.id !== id) await change(appointments, entry.id, { data: { ...entry, revision: (entry.revision || 0) + 1 } }, conn);
    }
  }
  if (["call", "start"].includes(body.action)) {
    const active = rows.some(a => a.id !== id && ["called", "inConsultation"].includes(a.status));
    assert(!active, 409, "Another patient is already called or in consultation");
    if (body.action === "call") assert(orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)))[0]?.id === id, 409, "Earlier reservation must be served or explicitly skipped first");
  }
  const timestamp = new Date().toISOString(), data = { ...row, revision: (row.revision || 0) + 1, ...(rule.stamp ? { [rule.stamp]: timestamp } : {}) };
  if (body.action === "start" && row.waitingAt) data.waitMinutes = Math.max(0, (Date.now() - Date.parse(row.waitingAt)) / 60000);
  if (body.action === "complete" && row.consultationStartedAt) data.consultationMinutesActual = Math.max(0, (Date.now() - Date.parse(row.consultationStartedAt)) / 60000);
  data.history = [...(row.history || []), { status: rule.to, occurredAt: timestamp, actorId: user.id, action: body.action, ...(body.position ? { position: body.position } : {}), ...(body.reason ? { reason: body.reason.trim() } : {}) }];
  const updated = await change(appointments, id, { status: rule.to, data }, conn);
  await put(appointmentHistory, { id: uid(), appointmentId: id, actorId: user.id, fromStatus: row.status, toStatus: rule.to }, conn);
  await audit(user, body.action, "appointments", updated, conn);
  return appointmentView(updated, user);
}