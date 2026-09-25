import { Router } from "express";
import { db, doctors, appointments, assignments, settings, branches, schedules } from "@workspace/db";
import { clinicalBranchIds } from "../lib/clinical-membership";
import * as z from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { requireUser, roles, scope } from "../lib/auth";
import { assert, parse } from "../lib/http";
import { all, one, change, audit } from "../lib/store";
import { configuredDuration, sessionKey, freezeDoctorSessions } from "../lib/session-duration";
import { sessionRows, queueVersion } from "../lib/queue-order";
import { doctorContext, localNow, minutes, availability } from "../lib/availability";

export const durationRouter = Router();
async function authorize(user: any, doctorId: string, clinicId: string, conn: any = db) {
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const doctor = await one(doctors, doctorId, conn);
  assert(scope(user, clinicId) && (user.role !== "doctor" || user.doctorId === doctorId), 403, "Duration outside assigned scope");
  const clinicalBranches = await clinicalBranchIds(doctor.id, conn);
  const branchRows = await all(branches, conn);
  assert(clinicalBranches.some(id => branchRows.some(b => b.id === id && b.clinicId === clinicId) && (!["doctor", "receptionist"].includes(user.role) || user.branchIds.includes(id))), 403, "Doctor is not assigned within your branch scope");
  return doctor;
}
durationRouter.get("/doctors/:id/duration/:clinicId", async (req, res) => {
  const user = await requireUser(req), p = parse(z.GetDoctorDurationParams, req.params);
  await authorize(user, p.id, p.clinicId);
  res.json({ doctorId: p.id, clinicId: p.clinicId, expectedDurationMinutes: await configuredDuration(p.id, p.clinicId) });
});
durationRouter.patch("/doctors/:id/duration/:clinicId", async (req, res) => {
  const user = await requireUser(req), p = parse(z.UpdateDoctorDurationParams, req.params), body = parse(z.UpdateDoctorDurationBody, req.body);
  assert(p.clinicId === body.clinicId, 400, "Clinic mismatch");
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + p.id}))`);
    const doctor = await authorize(user, p.id, p.clinicId, tx);
    await freezeDoctorSessions(p.id, tx);
    if (body.effect === "runningSession") {
      assert(body.confirmRunningSession === true && body.branchId && body.date && body.expectedQueueVersion, 400, "Confirm the warning and select a running session");
      const { branch } = await doctorContext(p.id, body.branchId, tx);
      assert(branch.clinicId === p.clinicId && scope(user, p.clinicId, branch.id), 403, "Session outside assigned scope");
      const available = body.startTime ? { startTime: body.startTime, sessionId: body.sessionId } : await availability(p.id, body.branchId, body.date, tx, body);
      const session = { doctorId: p.id, branchId: body.branchId, date: body.date, startTime: available.startTime, sessionId: available.sessionId };
      const rows = sessionRows(await all(appointments, tx), session);
      assert(rows.length > 0, 409, "No snapshotted session to update");
      const now = localNow(rows[0].timezone || branch.timezone || "Asia/Kolkata");
      assert(body.date === now.date && now.minute >= minutes(rows[0].startTime) && now.minute < minutes(rows[0].endTime), 409, "Session is not currently running");
      assert(queueVersion(rows) === body.expectedQueueVersion, 409, "Queue changed; review the duration warning again");
      await tx.insert(settings).values({ id: sessionKey(session), data: { expectedDurationMinutes: body.expectedDurationMinutes } }).onConflictDoUpdate({ target: settings.id, set: { data: { expectedDurationMinutes: body.expectedDurationMinutes } } });
      for (const row of rows) await change(appointments, row.id, { data: { ...row, expectedDurationMinutes: body.expectedDurationMinutes, revision: (row.revision || 0) + 1 } }, tx);
    }
    // The explicit staff change applies to every not-yet-started session in this
    // doctor/clinic, including sessions with reservations already on the books.
    // Running and historical snapshots remain immutable unless confirmed above.
    const doctorRows = (await all(appointments, tx)).filter(a => a.doctorId === p.id && a.clinicId === p.clinicId);
    const clinicBranches = (await all(branches, tx)).filter(b => b.clinicId === p.clinicId);
    const doctorSchedules = (await all(schedules, tx)).filter(s => s.doctorId === p.id && s.status === "active");
    const sessions = new Map<string, any>();
    for (const row of doctorRows) sessions.set(sessionKey(row), row);
    // A rescheduled-away reservation can leave an empty but durable snapshot.
    // Include it so a later booking does not resurrect the former duration.
    const prefix = `session:${p.id}:`;
    for (const snapshot of (await all(settings, tx)).filter(s => s.id.startsWith(prefix))) {
      const match = /^([^:]+):(\d{4}-\d{2}-\d{2})(?::(\d{2}:\d{2}))?$/.exec(snapshot.id.slice(prefix.length));
      if (!match) continue;
      const [, branchId, date, startTime] = match;
      if (clinicBranches.some(b => b.id === branchId)) sessions.set(snapshot.id, { doctorId: p.id, branchId, date, startTime });
    }
    for (const [key, session] of sessions) {
      const rows = sessionRows(doctorRows, session), branch = clinicBranches.find(b => b.id === session.branchId);
      const schedule = doctorSchedules.find(s => s.branchId === session.branchId && s.dayOfWeek === new Date(session.date + "T12:00:00Z").getUTCDay() && (!session.startTime || s.startTime === session.startTime));
      const timezone = rows[0]?.timezone || schedule?.timezone || branch?.timezone || "Asia/Kolkata";
      const now = localNow(timezone), startTime = rows[0]?.startTime || schedule?.startTime;
      const hasStarted = rows.some(a => a.calledAt || a.consultationStartedAt || ["called", "inConsultation", "completed"].includes(a.status));
      const startsLater = session.date > now.date || session.date === now.date && startTime && now.minute < minutes(startTime);
      if (!startsLater || hasStarted) continue;
      await tx.insert(settings).values({ id: key, data: { expectedDurationMinutes: body.expectedDurationMinutes } }).onConflictDoUpdate({ target: settings.id, set: { data: { expectedDurationMinutes: body.expectedDurationMinutes } } });
      for (const row of rows) if (row.expectedDurationMinutes !== body.expectedDurationMinutes) await change(appointments, row.id, { data: { ...row, expectedDurationMinutes: body.expectedDurationMinutes, revision: (row.revision || 0) + 1 } }, tx);
    }
    await change(doctors, p.id, { data: { ...doctor,
      durationHistory: [...(doctor.durationHistory || []), { ...body, actorId: user.id, occurredAt: new Date().toISOString(), previousConfiguredMinutes: doctor.expectedDurations?.[p.clinicId] ?? null }],
      expectedDurations: { ...doctor.expectedDurations, [p.clinicId]: body.expectedDurationMinutes } } }, tx);
    await audit(user, `duration:${body.effect}:${body.expectedDurationMinutes}`, "doctors", { id: p.id, clinicId: p.clinicId, branchId: body.branchId }, tx);
  });
  res.json({ doctorId: p.id, clinicId: p.clinicId, expectedDurationMinutes: body.expectedDurationMinutes });
});