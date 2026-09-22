import { Router } from "express";
import { db, appointments, branches, schedules } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, scope, roles } from "../lib/auth";
import { assert, parse, query } from "../lib/http";
import { all, one } from "../lib/store";
import { appointmentView, lockQueue, transition } from "../lib/appointments";
import { doctorContext } from "../lib/availability";
export const queueRouter = Router();
async function authorizeQueue(user: any, q: any) {
  const { branch } = await doctorContext(q.doctorId, q.branchId);
  if (user.role !== "patient") assert(scope(user, branch.clinicId, branch.id) && (user.role !== "doctor" || user.doctorId === q.doctorId), 403, "Queue outside assigned scope");
}
function ordered(rows: any[]) { return rows.sort((a,b) => String(a.waitingAt || a.createdAt).localeCompare(String(b.waitingAt || b.createdAt)) || a.tokenNumber - b.tokenNumber); }
queueRouter.get("/queue", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetQueueQueryParams, req); await authorizeQueue(user, q);
  const rows = (await all(appointments)).filter(a => a.doctorId === q.doctorId && a.branchId === q.branchId && a.date === q.date);
  const own = rows.find(a => a.patientId === user.patientId && (!q.appointmentId || a.id === q.appointmentId));
  if (user.role === "patient") assert(own, 403, "You do not have an appointment in this queue");
  const waiting = ordered(rows.filter(a => a.status === "waiting")), current = rows.find(a => ["called", "inConsultation"].includes(a.status));
  const s = (await all(schedules)).find(s => s.doctorId === q.doctorId && s.branchId === q.branchId && s.dayOfWeek === new Date(q.date + "T12:00:00Z").getUTCDay() && s.status === "active");
  let ahead = own ? waiting.findIndex(a => a.id === own.id) : 0;
  if (own && ["booked", "checkedIn"].includes(own.status)) ahead = waiting.length;
  ahead = Math.max(0, ahead) + (current && current.id !== own?.id ? 1 : 0);
  if (own && ["completed", "cancelled", "noShow", "called", "inConsultation"].includes(own.status)) ahead = 0;
  res.json({ doctorId: q.doctorId, branchId: q.branchId, date: q.date, currentToken: current?.token || null, nextToken: waiting[0]?.token || null, waiting: waiting.length, inConsultation: rows.filter(a => a.status === "inConsultation").length, completed: rows.filter(a => a.status === "completed").length, noShow: rows.filter(a => a.status === "noShow").length, total: rows.length, pollIntervalSeconds: 30, updatedAt: new Date().toISOString(), ownEntry: own ? { appointmentId: own.id, token: own.token, status: own.status, patientsAhead: ahead, estimatedWaitMinutes: ahead * ((s?.consultationMinutes || 10) + (s?.bufferMinutes || 0)) } : null, ...(user.role !== "patient" ? { entries: ordered(rows).map(a => appointmentView(a, user)) } : {}) });
});
queueRouter.post("/queue/call-next", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const body = parse(z.CallNextBody, req.body); await authorizeQueue(user, body);
  const appointment = await db.transaction(async tx => {
    await lockQueue(tx, body.doctorId, body.branchId, body.date);
    const rows = (await all(appointments, tx)).filter(a => a.doctorId === body.doctorId && a.branchId === body.branchId && a.date === body.date);
    assert(!rows.some(a => ["called", "inConsultation"].includes(a.status)), 409, "Another patient is already called or in consultation");
    const next = ordered(rows.filter(a => a.status === "waiting"))[0];
    return next ? transition(user, next.id, { action: "call", expectedStatus: "waiting" }, tx, true) : null;
  }); res.json({ appointment });
});