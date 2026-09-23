import { Router } from "express";
import { db, appointments, branches, schedules } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, scope, roles } from "../lib/auth";
import { assert, parse, query } from "../lib/http";
import { all, one } from "../lib/store";
import { appointmentView, lockQueue, transition } from "../lib/appointments";
import { doctorContext } from "../lib/availability";
import { sql } from "drizzle-orm";
import { queryPage, sourceSql, filterSql } from "../lib/list-query";
import { flatten } from "../lib/store";
export const queueRouter = Router();
async function authorizeQueue(user: any, q: any) {
  const { branch } = await doctorContext(q.doctorId, q.branchId);
  if (user.role !== "patient") assert(scope(user, branch.clinicId, branch.id) && (user.role !== "doctor" || user.doctorId === q.doctorId), 403, "Queue outside assigned scope");
}
function ordered(rows: any[]) { return rows.sort((a,b) => String(a.waitingAt || a.createdAt).localeCompare(String(b.waitingAt || b.createdAt)) || a.tokenNumber - b.tokenNumber); }
queueRouter.get("/queue", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetQueueQueryParams, req); await authorizeQueue(user, q);
  // authorizeQueue validates this session before aggregate access. Patients only receive their own entry.
  const session = { doctorId: q.doctorId, branchId: q.branchId, date: q.date };
  const sessionUser = { role: "superAdmin" };
  const own = user.patientId ? (await queryPage(sessionUser, "appointments", { ...session, patientId: user.patientId, pageSize: 1 }, q.appointmentId ? sql`r.id=${q.appointmentId}` : undefined)).items[0] : undefined;
  if (user.role === "patient") assert(own, 403, "You do not have an appointment in this queue");
  const aggregate = await db.execute(sql`with visible as (${sourceSql(sessionUser, "appointments")}), entries as (select doc from visible where ${filterSql(session)})
    select count(*)::int as total,
    count(*) filter(where doc->>'status'='waiting')::int as waiting,
    count(*) filter(where doc->>'status'='inConsultation')::int as "inConsultation",
    count(*) filter(where doc->>'status'='completed')::int as completed,
    count(*) filter(where doc->>'status'='noShow')::int as "noShow",
    count(*) filter(where doc->>'status'='waiting' and (coalesce(doc->>'waitingAt',doc->>'createdAt'),(doc->>'tokenNumber')::int) < (${own?.waitingAt || own?.createdAt || ""},${own?.tokenNumber || 0}))::int as ahead,
    (select doc from entries where doc->>'status' in ('called','inConsultation') order by doc->>'id' limit 1) as current,
    (select doc->>'token' from entries where doc->>'status'='waiting' order by coalesce(doc->>'waitingAt',doc->>'createdAt'),(doc->>'tokenNumber')::int limit 1) as "nextToken"
    from entries`);
  const counts = aggregate.rows[0] as any, current = counts.current;
  const [scheduleRow] = await db.select().from(schedules).where(sql`${schedules.doctorId}=${q.doctorId} and ${schedules.branchId}=${q.branchId} and ${schedules.dayOfWeek}=${new Date(q.date + "T12:00:00Z").getUTCDay()} and ${schedules.status}='active'`).limit(1);
  const s = flatten(scheduleRow);
  let ahead = own ? counts.ahead : 0;
  if (own && ["booked", "checkedIn"].includes(own.status)) ahead = counts.waiting;
  ahead = Math.max(0, ahead) + (current && current.id !== own?.id ? 1 : 0);
  if (own && ["completed", "cancelled", "noShow", "called", "inConsultation"].includes(own.status)) ahead = 0;
  const page = user.role !== "patient" ? await queryPage(user, "appointments", { ...q, sort: q.sort || "waitingAt" }) : null;
  res.json({ doctorId: q.doctorId, branchId: q.branchId, date: q.date, currentToken: current?.token || null, nextToken: counts.nextToken || null, waiting: counts.waiting, inConsultation: counts.inConsultation, completed: counts.completed, noShow: counts.noShow, total: counts.total, pollIntervalSeconds: 30, updatedAt: new Date().toISOString(), ownEntry: own ? { appointmentId: own.id, token: own.token, status: own.status, patientsAhead: ahead, estimatedWaitMinutes: ahead * ((s?.consultationMinutes || 10) + (s?.bufferMinutes || 0)) } : null, ...(page ? { entries: page.items.map((a: any) => appointmentView(a, user)), entriesTotal: page.total, page: page.page, pageSize: page.pageSize, totalPages: page.totalPages } : {}) });
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