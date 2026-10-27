import { appointments, doctors, branches, appointmentHistory } from "@workspace/db";
import { all, one, change, audit, put, uid, getSettings } from "./store";
import { canRead, scope, roles } from "./auth";
import { assert } from "./http";
import { availability, localNow, minutes } from "./availability";
import { lockQueue, appointmentView } from "./appointments";
import { allocateToken, snapshotDuration } from "./session-duration";
import { sessionRows, rank } from "./queue-order";
import { enrich } from "./entities";
import { recordStaffHandoffTransition } from "./staff-handoff-transition";
import { movementReason, assertSourceSessionOpen } from "./appointment-eligibility";
import { rescheduleDisplaySnapshot } from "./reschedule-display-snapshot";

export async function reschedule(user: any, id: string, body: any, tx: any, staffHandoff?: { operationId: string; targetUserId: string }) {
  let row = await one(appointments, id, tx);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  if (user.role !== "patient") roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const original = row;
  // Deterministic doctor order prevents opposite-direction transfers from deadlocking.
  const locks = [row, body].sort((a,b) => `${a.doctorId}:${a.branchId}:${a.date}`.localeCompare(`${b.doctorId}:${b.branchId}:${b.date}`));
  for (const session of locks) await lockQueue(tx, session.doctorId, session.branchId, session.date);
  row = await one(appointments, id, tx);
  assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date && (row.revision || 0) === body.expectedRevision, 409, "Appointment changed; refresh and retry");
  const blocked = movementReason(row, user); assert(!blocked, 409, blocked || "");
  await assertSourceSessionOpen(row, tx);
  if (row.status === "called") assert(user.role !== "patient" && body.releaseCallConfirmed === true, 409, "Confirm releasing the call and returning the unserved patient to pending");
  if (staffHandoff) {
    assert(user.role === "superAdmin", 403, "Superadmin handoff required");
    const sourceDoctor = await one(doctors, row.doctorId, tx);
    assert(sourceDoctor.userId === staffHandoff.targetUserId, 409, "Visit no longer belongs to the reviewed staff account");
    assert(row.status === "booked" && !row.checkedInAt && row.timezone,
      409, "Resolve overdue, waiting or in-progress care and incomplete original coordinates before a staff handoff");
    assert(body.doctorId !== row.doctorId, 400, "Choose a different eligible doctor");
  }
  const config = await getSettings(tx, row.clinicId), now = localNow(row.timezone || "Asia/Kolkata");
  const difference = (Date.parse(row.date) - Date.parse(now.date)) / 60000 + minutes(row.startTime || "00:00") - now.minute;
  if (staffHandoff) assert(difference >= config.cancellationCutoffMinutes, 409, "Cancellation cutoff has passed");
  const branch = await one(branches, body.branchId, tx);
  assert(branch.clinicId === row.clinicId, 403, "Rescheduling must stay within the same clinic");
  if (user.role !== "patient") assert(scope(user, row.clinicId, branch.id) && (user.role !== "doctor" || body.doctorId === user.doctorId), 403, "Destination outside assigned scope");
  const available = await availability(body.doctorId, body.branchId, body.date, tx, body);
  body = { ...body, sessionId: available.sessionId, startTime: available.startTime };
  assert(row.doctorId !== body.doctorId || row.branchId !== body.branchId || row.date !== body.date || row.startTime !== body.startTime, 400, "Same session: use Shift Time to choose a later pending position");
  assert(available.available, 409, available.reason || "Destination unavailable");
  assert(available.queueMode !== "walkInsOnly", 409, "Destination accepts walk-ins only");
  const destination = { ...body, clinicId: row.clinicId };
  const rows = sessionRows(await all(appointments, tx), destination);
  assert(!rows.some(a => a.patientId === row.patientId && !["cancelled", "completed", "noShow"].includes(a.status)), 409, "Patient already has an active booking for the destination");
  const originalDuration = await snapshotDuration(row, tx);
  await allocateToken(row, tx, false);
  const duration = await snapshotDuration(destination, tx), tokenNumber = await allocateToken(destination, tx);
  const doctor = await enrich("doctors", await one(doctors, body.doctorId, tx), tx);
  const fromDisplay = await rescheduleDisplaySnapshot(row.doctorId, row.branchId, tx);
  const toDisplay = await rescheduleDisplaySnapshot(body.doctorId, body.branchId, tx);
  const timestamp = new Date().toISOString();
  const data = { ...row, doctorId: body.doctorId, branchId: body.branchId, date: body.date, sessionId: body.sessionId,
    token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`, tokenNumber,
    doctorName: doctor.fullName, branchName: branch.name, branchAddress: branch.address ?? null, timezone: available.timezone,
    startTime: available.startTime, endTime: available.endTime, breakStart: available.breakStart ?? null, breakEnd: available.breakEnd ?? null,
    expectedDurationMinutes: duration, queueRank: Math.max(0, ...rows.map(rank)) + 1, revision: (row.revision || 0) + 1,
    waitingAt: timestamp, calledAt: null,
    history: [...(row.history || []), { status: "waiting", action: "reschedule", occurredAt: timestamp, actorId: user.id, actorKind: user.privateReceipt ? "privateReceipt" : user.role, reason: body.reason, ...(row.status === "called" ? { callReleased: true } : {}),
      from: { doctorId: row.doctorId, branchId: row.branchId, ...fromDisplay, date: row.date, sessionId: row.sessionId, startTime: row.startTime, endTime: row.endTime, timezone: row.timezone, token: row.token, tokenNumber: row.tokenNumber },
      to: { doctorId: body.doctorId, branchId: body.branchId, ...toDisplay, date: body.date, sessionId: body.sessionId, startTime: available.startTime, endTime: available.endTime, timezone: available.timezone, token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`, tokenNumber } }],
  };
  const updated = await change(appointments, id, { status: "waiting", doctorId: body.doctorId, branchId: body.branchId, date: body.date, tokenNumber, data }, tx);
  if (staffHandoff)
    await recordStaffHandoffTransition(tx, staffHandoff.operationId, user.id, row, updated, originalDuration, duration);
  await put(appointmentHistory, { id: uid(), appointmentId: id, actorId: user.id, fromStatus: row.status, toStatus: "waiting" }, tx);
  await audit(user, "reschedule", "appointments", updated, tx);
  const { enqueueEvent } = await import("./notification-outbox");
  await enqueueEvent(tx, "rescheduled", updated, row);
  return appointmentView(updated, user);
}