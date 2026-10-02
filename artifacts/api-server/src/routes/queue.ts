import { Router } from "express";
import { db, appointments } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireUser, scope, roles } from "../lib/auth";
import { assert, parse, query } from "../lib/http";
import { all, flatten } from "../lib/store";
import { appointmentView, appointmentViewWithBranch, lockQueue, transition } from "../lib/appointments";
import { doctorContext, localNow, availability, availabilitySessions } from "../lib/availability";
import { orderedReservations, pendingStatuses, queueSummary, sessionRows } from "../lib/queue-order";
import { readDuration } from "../lib/session-duration";
import { getPresence } from "../lib/presence";
import { clinicDisplayPreferences } from "../lib/display-preferences";
import { staffQueueList } from "../lib/queue-list";
export const queueRouter = Router();
async function selectQueue(q: any, conn: any, scopedRows?: any[]) {
  const rows = sessionRows(scopedRows ?? await all(appointments, conn), { doctorId: q.doctorId, branchId: q.branchId, date: q.date });
  if (q.appointmentId) {
    const own = rows.find(a => a.id === q.appointmentId);
    assert(own && (!q.sessionId || q.sessionId === own.sessionId) && (!q.startTime || q.startTime === own.startTime), 404, "Appointment is not in the selected session");
    return { ...q, startTime: own.startTime, sessionId: own.sessionId };
  }
  const matches = rows.filter(a => (!q.sessionId || a.sessionId === q.sessionId) && (!q.startTime || a.startTime === q.startTime));
  const starts = [...new Set(matches.map(a => a.startTime))];
  if (q.startTime) return q;
  assert(starts.length <= 1 || q.sessionId, 409, "Select a session for this queue");
  if (starts.length === 1) return { ...q, startTime: starts[0] };
  const a = await availability(q.doctorId, q.branchId, q.date, conn, q);
  return { ...q, startTime: a.startTime, sessionId: a.sessionId };
}
async function authorizeQueue(user: any, q: any) {
  const context = await doctorContext(q.doctorId, q.branchId), { branch } = context;
  if (user.role !== "patient") assert(scope(user, branch.clinicId, branch.id) && (user.role !== "doctor" || user.doctorId === q.doctorId), 403, "Queue outside assigned scope");
  return context;
}
queueRouter.get("/session-contexts", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q = query(z.GetSessionContextsQueryParams, req);
  const context = await authorizeQueue(user, q);
  const current = await availabilitySessions(q.doctorId, q.branchId, q.date);
  const contexts: any[] = current.map(s => ({ ...s, snapshotOnly: false }));
  const rows = (await db.select().from(appointments).where(sql`${appointments.doctorId}=${q.doctorId} and ${appointments.branchId}=${q.branchId} and ${appointments.date}=${q.date}`)).map(flatten);
  for (const row of rows) {
    if (contexts.some(s => s.startTime === (row.startTime ?? null))) continue;
    const members = sessionRows(rows, { ...row, startTime: row.startTime });
    contexts.push({ doctorId: q.doctorId, branchId: q.branchId, clinicId: row.clinicId, ...clinicDisplayPreferences(context.clinic), date: q.date,
      sessionId: row.sessionId ?? null, startTime: row.startTime ?? null, endTime: row.endTime ?? null,
      timezone: row.timezone || "Asia/Kolkata", available: false, snapshotOnly: true,
      reason: "Persisted appointment session; not available for new bookings",
      maxTokens: 0, bookedTokens: members.filter(a => a.status !== "cancelled").length, remainingTokens: 0 });
  }
  res.set("Cache-Control", "no-store").json(contexts.sort((a,b) => (a.startTime || "").localeCompare(b.startTime || "")));
});
queueRouter.get("/queue", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetQueueQueryParams, req), context = await authorizeQueue(user, q);
  // A single read provides a coherent summary/version. No other patient data leaves this handler.
  let selected: any = q;
  let duration: number | null = null;
  let listing: Awaited<ReturnType<typeof staffQueueList>> | undefined;
  const paginated = req.query?.page !== undefined || req.query?.pageSize !== undefined;
  const rows = await db.transaction(async tx => {
    await lockQueue(tx, q.doctorId, q.branchId, q.date);
     const candidates = (await tx.select().from(appointments).where(sql`${appointments.doctorId}=${q.doctorId} and ${appointments.branchId}=${q.branchId} and ${appointments.date}=${q.date}`)).map(flatten);
     selected = await selectQueue(q, tx, candidates);
     const initial = sessionRows(candidates, selected);
    if (user.role === "patient") assert(initial.some(a => a.patientId === user.patientId && (!q.appointmentId || a.id === q.appointmentId)), 403, "You do not have an appointment in this queue");
    if (initial.length) duration = await readDuration(initial[0], tx);
    if (user.role !== "patient") listing = await staffQueueList(tx,selected,q,paginated);
    return initial;
  });
  const own = user.role === "patient"
    ? rows.find(a => a.patientId === user.patientId && (!q.appointmentId || a.id === q.appointmentId))
    : q.appointmentId ? rows.find(a => a.id === q.appointmentId) : undefined;
  if (user.role === "patient") assert(own, 403, "You do not have an appointment in this queue");
  const summary = queueSummary(rows, own, duration);
  res.json({ doctorId: q.doctorId, branchId: q.branchId, date: q.date, ...clinicDisplayPreferences(context.clinic), sessionId: selected.sessionId || rows[0]?.sessionId || null, startTime: selected.startTime || null, presence: await getPresence(selected), ...summary,
    pollIntervalSeconds: 30, updatedAt: new Date().toISOString(),
     ...(listing ? { ...listing, entries: listing.entries.map((row:any) => appointmentView({ ...row, ...clinicDisplayPreferences(context.clinic), branchAddress: row.branchAddress ?? context.branch.address ?? null },user)) } : {}),
  });
});
queueRouter.post("/queue/call-next", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const body = parse(z.CallNextBody, req.body); await authorizeQueue(user, body);
  const { branch } = await doctorContext(body.doctorId, body.branchId);
  assert(body.date === localNow(branch.timezone || "Asia/Kolkata").date, 409, "Queue actions are allowed only on the appointment date");
  const appointment = await db.transaction(async tx => {
    await lockQueue(tx, body.doctorId, body.branchId, body.date);
    const selected = await selectQueue(body, tx);
    const rows = sessionRows(await all(appointments, tx), selected);
    assert(!rows.some(a => ["called", "inConsultation"].includes(a.status)), 409, "Another patient is already called or in consultation");
    const next = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)))[0];
    return next ? transition(user, next.id, { action: "call", expectedStatus: next.status }, tx, true) : null;
  }); res.json({ appointment: appointment ? await appointmentViewWithBranch(appointment, user) : null });
});