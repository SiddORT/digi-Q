import { appointments, doctors, branches, appointmentHistory } from "@workspace/db";
import { all, one, change, audit, put, uid, getSettings } from "./store";
import { canRead, scope, roles } from "./auth";
import { assert } from "./http";
import { availability, localNow, minutes } from "./availability";
import { lockQueue, appointmentView } from "./appointments";
import { allocateToken, snapshotDuration } from "./session-duration";
import { sessionRows, rank } from "./queue-order";
import { enrich } from "./entities";

export async function reschedule(user: any, id: string, body: any, tx: any) {
  let row = await one(appointments, id, tx);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  if (user.role !== "patient") roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const original = row;
  // Deterministic doctor order prevents opposite-direction transfers from deadlocking.
  const locks = [row, body].sort((a,b) => `${a.doctorId}:${a.branchId}:${a.date}`.localeCompare(`${b.doctorId}:${b.branchId}:${b.date}`));
  for (const session of locks) await lockQueue(tx, session.doctorId, session.branchId, session.date);
  row = await one(appointments, id, tx);
  assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date && (row.revision || 0) === body.expectedRevision, 409, "Appointment changed; refresh and retry");
  assert(["booked", "checkedIn", "waiting", "called"].includes(row.status) && !row.checkedInAt, 409, "Only appointments before check-in can be rescheduled");
  const config = await getSettings(tx, row.clinicId), now = localNow(row.timezone || "Asia/Kolkata");
  const difference = (Date.parse(row.date) - Date.parse(now.date)) / 60000 + minutes(row.startTime || "00:00") - now.minute;
  assert(difference >= config.cancellationCutoffMinutes, 409, "Cancellation cutoff has passed");
  const branch = await one(branches, body.branchId, tx);
  assert(branch.clinicId === row.clinicId, 403, "Rescheduling must stay within the same clinic");
  if (user.role !== "patient") assert(scope(user, row.clinicId, branch.id) && (user.role !== "doctor" || body.doctorId === user.doctorId), 403, "Destination outside assigned scope");
  const available = await availability(body.doctorId, body.branchId, body.date, tx, body);
  body = { ...body, sessionId: available.sessionId, startTime: available.startTime };
  assert(row.doctorId !== body.doctorId || row.branchId !== body.branchId || row.date !== body.date || row.startTime !== body.startTime, 400, "Choose a different destination session");
  assert(available.available, 409, available.reason || "Destination unavailable");
  assert(available.queueMode !== "walkInsOnly", 409, "Destination accepts walk-ins only");
  const destination = { ...body, clinicId: row.clinicId };
  const rows = sessionRows(await all(appointments, tx), destination);
  assert(!rows.some(a => a.patientId === row.patientId && !["cancelled", "completed", "noShow"].includes(a.status)), 409, "Patient already has an active booking for the destination");
  await snapshotDuration(row, tx);
  await allocateToken(row, tx, false);
  const duration = await snapshotDuration(destination, tx), tokenNumber = await allocateToken(destination, tx);
  const doctor = await enrich("doctors", await one(doctors, body.doctorId, tx), tx);
  const timestamp = new Date().toISOString();
  const data = { ...row, doctorId: body.doctorId, branchId: body.branchId, date: body.date, sessionId: body.sessionId,
    token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`, tokenNumber,
    doctorName: doctor.fullName, branchName: branch.name, timezone: available.timezone,
    startTime: available.startTime, endTime: available.endTime,
    expectedDurationMinutes: duration, queueRank: Math.max(0, ...rows.map(rank)) + 1, revision: (row.revision || 0) + 1,
    waitingAt: timestamp, calledAt: null,
    history: [...(row.history || []), { status: "waiting", action: "reschedule", occurredAt: timestamp, actorId: user.id, reason: body.reason,
      from: { doctorId: row.doctorId, branchId: row.branchId, date: row.date, sessionId: row.sessionId, startTime: row.startTime, token: row.token, tokenNumber: row.tokenNumber },
      to: { doctorId: body.doctorId, branchId: body.branchId, date: body.date, sessionId: body.sessionId, startTime: body.startTime, token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`, tokenNumber } }],
  };
  const updated = await change(appointments, id, { status: "waiting", doctorId: body.doctorId, branchId: body.branchId, date: body.date, tokenNumber, data }, tx);
  await put(appointmentHistory, { id: uid(), appointmentId: id, actorId: user.id, fromStatus: row.status, toStatus: "waiting" }, tx);
  await audit(user, "reschedule", "appointments", updated, tx);
  return appointmentView(updated, user);
}