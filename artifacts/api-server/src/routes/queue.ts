import { Router } from "express";
import { db, appointments } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, scope, roles } from "../lib/auth";
import { assert, parse, query } from "../lib/http";
import { all } from "../lib/store";
import { appointmentView, lockQueue, transition } from "../lib/appointments";
import { doctorContext } from "../lib/availability";
import { orderedReservations, pendingStatuses, queueSummary, sessionRows } from "../lib/queue-order";
export const queueRouter = Router();
async function authorizeQueue(user: any, q: any) {
  const { branch } = await doctorContext(q.doctorId, q.branchId);
  if (user.role !== "patient") assert(scope(user, branch.clinicId, branch.id) && (user.role !== "doctor" || user.doctorId === q.doctorId), 403, "Queue outside assigned scope");
}
queueRouter.get("/queue", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetQueueQueryParams, req); await authorizeQueue(user, q);
  // A single read provides a coherent summary/version. No other patient data leaves this handler.
  const rows = sessionRows(await all(appointments), q);
  const own = rows.find(a => a.patientId === user.patientId && (!q.appointmentId || a.id === q.appointmentId));
  if (user.role === "patient") assert(own, 403, "You do not have an appointment in this queue");
  const summary = queueSummary(rows, own);
  const page = q.page || 1, pageSize = q.pageSize || 20;
  const entries = orderedReservations(rows);
  res.json({ doctorId: q.doctorId, branchId: q.branchId, date: q.date, ...summary,
    pollIntervalSeconds: 30, updatedAt: new Date().toISOString(),
    ...(user.role === "patient" ? {} : { entries: entries.slice((page - 1) * pageSize, page * pageSize).map(a => appointmentView(a, user)), entriesTotal: entries.length, page, pageSize, totalPages: Math.ceil(entries.length / pageSize) }),
  });
});
queueRouter.post("/queue/call-next", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const body = parse(z.CallNextBody, req.body); await authorizeQueue(user, body);
  const appointment = await db.transaction(async tx => {
    await lockQueue(tx, body.doctorId, body.branchId, body.date);
    const rows = sessionRows(await all(appointments, tx), body);
    assert(!rows.some(a => ["called", "inConsultation"].includes(a.status)), 409, "Another patient is already called or in consultation");
    const next = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)))[0];
    assert(!next || next.status === "waiting", 409, "Earlier reservation has not joined the queue; check in or explicitly skip with a reason");
    return next ? transition(user, next.id, { action: "call", expectedStatus: "waiting" }, tx, true) : null;
  }); res.json({ appointment });
});