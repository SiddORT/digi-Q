import { db, appointments, patients, branches, clinics, appointmentHistory } from "@workspace/db";
import { sql } from "drizzle-orm";
import { all, one, change, put, uid, audit, getSettings } from "./store";
import { assert } from "./http";
import { canRead, roles } from "./auth";
import { localNow, minutes, doctorContext, operationalDoctorContext, sessionQueueWaitMinutes } from "./availability";
import { orderedReservations, pendingStatuses, queueVersion, rank, sessionRows } from "./queue-order";
import { isDoctorAvailable } from "./presence";
import { snapshotDuration } from "./session-duration";
import { clinicDisplayPreferences } from "./display-preferences";
import { movementReason, sourceSessionReason, assertSourceSessionOpen } from "./appointment-eligibility";
import { canEditBooking, bookingEditPermission } from "./appointment-booking-edit";
export const transitions: Record<string, { from: string[], to: string, stamp?: string }> = {
  checkIn: { from: ["booked", "checkedIn", "waiting", "called"], to: "inConsultation", stamp: "checkedInAt" },
  enqueue: { from: ["booked", "checkedIn"], to: "waiting", stamp: "waitingAt" },
  call: { from: ["booked", "checkedIn", "waiting"], to: "called", stamp: "calledAt" },
  start: { from: ["called"], to: "inConsultation", stamp: "consultationStartedAt" },
  complete: { from: ["inConsultation"], to: "completed", stamp: "completedAt" },
  noShow: { from: ["booked", "checkedIn", "waiting", "called"], to: "noShow" },
  requeue: { from: ["noShow"], to: "waiting", stamp: "waitingAt" },
  shift: { from: ["booked", "checkedIn", "waiting", "called"], to: "waiting" },
  cancel: { from: ["booked", "checkedIn", "waiting", "called"], to: "cancelled", stamp: "cancelledAt" },
};
export async function lockQueue(conn: any, doctorId: string, branchId: string, date: string) {
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + doctorId}))`);
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${`${doctorId}:${branchId}:${date}`}))`);
}
export function appointmentView(row: any, user: any) {
  const reason = movementReason(row, user);
  const allowedActions = Object.entries(transitions).filter(([action, rule]) => !["enqueue", "call", "start"].includes(action) && rule.from.includes(row.status) &&
    (action === "shift" ? !reason : action === "cancel" ? !row.checkedInAt && !row.consultationStartedAt : row.date === localNow(row.timezone || "Asia/Kolkata").date) &&
    (user.role !== "patient" || ["cancel", "shift"].includes(action)) &&
    (!["requeue", "noShow"].includes(action) || !sourceSessionReason(row, true) && !row.checkedInAt && !row.consultationStartedAt)).map(([a]) => a);
  const { actorId, requestId, ...view } = row;
  return { ...view, canEditBooking: canEditBooking(user, row), canReschedule: !reason, movementReason: reason, ...(user.role === "patient" && row.history ? { history: row.history.map(({ actorId: _actor, beforeOrder: _before, afterOrder: _after, ...event }: any) => event) } : {}), queueRank: rank(row), revision: row.revision || 0, expectedDurationMinutes: row.expectedDurationMinutes ?? null, allowedActions };
}
export async function appointmentViewWithBranch(row: any, user: any, conn: any = db) {
  const clinic = await one(clinics, row.clinicId, conn);
  const branch = row.branchAddress == null ? await one(branches, row.branchId, conn) : null;
  const view = appointmentView({ ...row, ...clinicDisplayPreferences(clinic), branchAddress: row.branchAddress ?? branch?.address ?? null }, user);
  return { ...view, canEditBooking: view.canEditBooking && (await bookingEditPermission(user, conn))(row) };
}
/** One map per relation for list responses, never one clinic query per appointment. */
export async function appointmentViews(rows: any[], user: any, conn: any = db) {
  if (!rows.length) return [];
  const clinicMap = new Map((await all(clinics, conn)).map(c => [c.id, c]));
  const branchMap = new Map((rows.some(r => r.branchAddress == null) ? await all(branches, conn) : []).map(b => [b.id, b]));
  const permitted = await bookingEditPermission(user, conn);
  return rows.map(row => {
    const view = appointmentView({ ...row, ...clinicDisplayPreferences(clinicMap.get(row.clinicId)),
      branchAddress: row.branchAddress ?? branchMap.get(row.branchId)?.address ?? null }, user);
    return { ...view, canEditBooking: view.canEditBooking && permitted(row) };
  });
}
export async function transition(user: any, id: string, body: any, conn: any = db, locked = false) {
  let row = await one(appointments, id, conn);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  if (!locked) {
    const original = row;
    await lockQueue(conn, row.doctorId, row.branchId, row.date); row = await one(appointments, id, conn);
    assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date && row.startTime === original.startTime, 409, "Appointment was rescheduled; refresh and retry");
  }
  const rule = transitions[body.action];
  if (body.action === "shift") {
    const reason = movementReason(row, user); assert(!reason, 409, reason || "");
  }
  if (body.action === "requeue" && row.status === "cancelled") assert(false, 409, "Cancelled bookings cannot re-enter");
  assert(rule && rule.from.includes(row.status), 409, "Invalid appointment state transition");
  assert(!body.expectedStatus || row.status === body.expectedStatus, 409, "Appointment changed; refresh and retry");
  assert(body.expectedRevision === undefined || (row.revision || 0) === body.expectedRevision, 409, "Appointment changed; refresh and retry");
  if (user.role === "patient") assert(["cancel", "shift"].includes(body.action) && row.patientId === user.patientId, 403, "Patients can only manage their own pending booking");
  else roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  if (!["cancel", "complete", "noShow"].includes(body.action)) await doctorContext(row.doctorId, row.branchId, conn);
  const now = localNow(row.timezone || "Asia/Kolkata");
   if (body.action === "cancel") {
    assert(!row.checkedInAt && !row.consultationStartedAt, 409, "Cannot cancel after consultation check-in");
    const config = await getSettings(conn, row.clinicId);
    const difference = (Date.parse(row.date) - Date.parse(now.date)) / 60000 + minutes(row.startTime || "00:00") - now.minute;
    assert(difference >= config.cancellationCutoffMinutes, 409, "Cancellation cutoff has passed");
  } else if (body.action !== "shift") assert(row.date === now.date, 409, "Queue actions are allowed only on the appointment date");
  const rows = sessionRows(await all(appointments, conn), row);
  const beforeOrder = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status))).map(a => a.id);
  if (["noShow", "requeue", "shift"].includes(body.action)) assert(typeof body.reason === "string" && body.reason.trim().length > 0 && body.reason.length <= 1000, 400, "A reason is required (at most 1000 characters)");
  if (["noShow", "requeue"].includes(body.action)) {
    assert(!row.checkedInAt && !row.consultationStartedAt, 409, "Consultation has already started");
    const reason = sourceSessionReason(row, true); assert(!reason, 409, reason || "");
  }
  if (["noShow", "requeue", "shift"].includes(body.action)) await assertSourceSessionOpen(row, conn);
  if (body.action === "shift") {
    const reason = movementReason(row, user); assert(!reason, 409, reason || "");
    if (row.status === "called") assert(user.role !== "patient" && body.releaseCallConfirmed === true, 409, "Confirm releasing the call and returning the unserved patient to pending");
  }
  if (["requeue", "shift"].includes(body.action)) {
    assert(body.expectedRevision !== undefined && body.expectedQueueVersion === queueVersion(rows), 409, "Queue changed; refresh and select the return position again");
    const ordered = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)));
    const oldPosition = row.status === "called" ? 0 : ordered.findIndex(a => a.id === id) + 1;
    const pending = ordered.filter(a => a.id !== id);
    assert(Number.isInteger(body.position) && body.position >= 1 && body.position <= pending.length + 1, 400, "Choose a valid return position");
    if (body.action === "shift") assert(body.position > oldPosition && (row.status !== "called" || body.position >= 2), 409, "Choose a strictly later pending position; the last patient cannot shift");
    // Integer ranks avoid floating point exhaustion; all affected writes share the session lock.
    pending.splice(body.position - 1, 0, row);
    for (const [index, entry] of pending.entries()) {
      entry.queueRank = index + 1;
      if (entry.id !== id) await change(appointments, entry.id, { data: { ...entry, revision: (entry.revision || 0) + 1 } }, conn);
    }
  }
  if (["call", "start", "checkIn"].includes(body.action)) {
    assert(await isDoctorAvailable(row, conn), 409, "Doctor is on break or away. Future bookings are unchanged.");
    const active = rows.some(a => a.id !== id && ["called", "inConsultation"].includes(a.status));
    assert(!active, 409, "Another patient is already called or in consultation");
    if (row.status !== "called") assert(orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)))[0]?.id === id, 409, "Earlier reservation must be served or explicitly skipped first");
  }
  const expectedDurationMinutes = await snapshotDuration(row, conn);
   const timestamp = new Date().toISOString(), data = { ...row, expectedDurationMinutes: row.expectedDurationMinutes === undefined ? expectedDurationMinutes : row.expectedDurationMinutes, revision: (row.revision || 0) + 1, ...(rule.stamp ? { [rule.stamp]: timestamp } : {}) };
  const toStatus = body.action === "shift" && row.status !== "called" ? row.status : rule.to;
  if (["shift", "requeue"].includes(body.action)) data.calledAt = null;
  if (["start", "checkIn"].includes(body.action)) {
    data.checkedInAt = timestamp;
    data.consultationStartedAt = timestamp;
    data.waitMinutes = sessionQueueWaitMinutes(row);
  }
  if (body.action === "complete" && row.consultationStartedAt) data.consultationMinutesActual = Math.max(0, (Date.now() - Date.parse(row.consultationStartedAt)) / 60000);
  data.history = [...(row.history || []), { status: toStatus, occurredAt: timestamp, actorId: user.id, actorKind: user.privateReceipt ? "privateReceipt" : user.role, action: body.action, ...(body.position ? { position: body.position, beforeOrder, afterOrder: orderedReservations(rows.filter(a => a.id !== id && pendingStatuses.includes(a.status)).concat({...row,queueRank:data.queueRank})).map(a=>a.id) } : {}), ...(body.reason ? { reason: body.reason.trim() } : {}), ...(body.releaseCallConfirmed ? { callReleased: true } : {}) }];
  const updated = await change(appointments, id, { status: toStatus, data }, conn);
  await put(appointmentHistory, { id: uid(), appointmentId: id, actorId: user.id, fromStatus: row.status, toStatus: toStatus }, conn);
  await audit(user, body.action, "appointments", updated, conn);
  if (["cancel", "complete"].includes(body.action)) {
    const { enqueueEvent } = await import("./notification-outbox");
    await enqueueEvent(conn, body.action === "cancel" ? "cancelled" : "completed", updated);
  }
  if (body.action === "complete") {
    const next = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)))[0];
    if (next) {
      const context = await operationalDoctorContext(next.doctorId, next.branchId, conn);
      if (context.active && context.assigned && await isDoctorAvailable(next, conn)) await transition(user, next.id, { action: "call", expectedStatus: next.status }, conn, true);
    }
  }
  return appointmentView(updated, user);
}