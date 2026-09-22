import { Router } from "express";
import { db, appointments, doctors, clinics, branches, patients, auditLogs, settings, users } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, roles, scoped, scope, canRead, projectAssignmentScope } from "../lib/auth";
import { parse, query, assert } from "../lib/http";
import { all, one, getSettings, filtered, paginate, audit } from "../lib/store";
import { enrich } from "../lib/entities";
import { appointmentView } from "../lib/appointments";
import { localNow } from "../lib/availability";
export const reportingRouter = Router();
function metrics(rows: any[]) {
  const count = (status: string) => rows.filter(a => a.status === status).length;
  const waits = rows.filter(a => typeof a.waitMinutes === "number"), consultations = rows.filter(a => typeof a.consultationMinutesActual === "number");
  return { appointments: rows.length, waiting: count("waiting"), checkedIn: count("checkedIn"), completed: count("completed"), noShow: count("noShow"), cancelled: count("cancelled"), averageWaitMinutes: waits.length ? waits.reduce((s,a) => s + a.waitMinutes, 0) / waits.length : 0, averageConsultationMinutes: consultations.length ? consultations.reduce((s,a) => s + a.consultationMinutesActual, 0) / consultations.length : 0 };
}
async function authorizeReportContext(user: any, q: any) {
  if (user.role === "patient") {
    if (q.clinicId || q.branchId || q.doctorId) {
      const own = (await all(appointments)).some(a => a.patientId === user.patientId && (!q.clinicId || a.clinicId === q.clinicId) && (!q.branchId || a.branchId === q.branchId) && (!q.doctorId || a.doctorId === q.doctorId));
      assert(own, 403, "Dashboard context outside your scope");
    }
    return;
  }
  let clinicId = q.clinicId;
  if (q.branchId) {
    const branch = await one(branches, q.branchId);
    assert(!clinicId || branch.clinicId === clinicId, 400, "This branch does not belong to the selected clinic");
    clinicId = branch.clinicId;
  }
  if (clinicId) {
    await one(clinics, clinicId);
    assert(scope(user, clinicId, q.branchId), 403, "Dashboard context outside your scope");
  }
  if (q.doctorId) {
    const doctor = await enrich("doctors", await one(doctors, q.doctorId));
    assert(await canRead(user, "doctors", doctor), 403, "Doctor outside your scope");
    if (q.branchId) assert(doctor.branchIds.includes(q.branchId), 400, "This doctor is not assigned to the selected branch");
    else if (clinicId) assert(doctor.clinicIds.includes(clinicId), 400, "This doctor is not assigned to the selected clinic");
  }
}
function matchesContext(kind: string, row: any, q: any) {
  if (kind === "doctors") return (!q.doctorId || row.id === q.doctorId) && (!q.clinicId || row.clinicIds?.includes(q.clinicId)) && (!q.branchId || row.branchIds?.includes(q.branchId));
  if (kind === "clinics") return !q.clinicId || row.id === q.clinicId;
  if (kind === "branches") return (!q.clinicId || row.clinicId === q.clinicId) && (!q.branchId || row.id === q.branchId);
  return (!q.clinicId || row.clinicId === q.clinicId) && (!q.branchId || row.branchId === q.branchId);
}
reportingRouter.get("/dashboard", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetDashboardQueryParams, req), config = await getSettings();
  await authorizeReportContext(user, q);
  q.date ||= localNow(config.timezone).date;
  const rows = filtered(await scoped(user, "appointments", await all(appointments)), q), stats = metrics(rows);
  const counts: any = {};
  for (const [kind, table, key] of [["doctors", doctors, "totalDoctors"], ["clinics", clinics, "totalClinics"], ["branches", branches, "totalBranches"], ["patients", patients, "totalPatients"]] as const) {
    const data = await Promise.all((await all(table)).filter(r => r.status === "active").map(r => enrich(kind, r)));
    const visible = await scoped(user, kind, data);
    const projected = await Promise.all(visible.map(row => projectAssignmentScope(user, kind, row)));
    counts[key] = projected.filter(row => matchesContext(kind, row, q) && (kind !== "patients" || !q.doctorId || rows.some(a => a.patientId === row.id))).length;
  }
  const recentActivity = ["superAdmin", "clinicAdmin"].includes(user.role)
    ? filtered((await all(auditLogs)).filter(a => scope(user, a.clinicId, a.branchId)), { clinicId: q.clinicId, branchId: q.branchId }).sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0,8)
    : [];
  res.json({ ...counts, ...stats, todayAppointments: rows.length, activeQueues: new Set(rows.filter(a => ["waiting", "called", "inConsultation"].includes(a.status)).map(a => `${a.doctorId}:${a.branchId}`)).size, currentToken: rows.find(a => ["called", "inConsultation"].includes(a.status))?.token || null, recentAppointments: rows.sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0,8).map(a => appointmentView(a,user)), recentActivity });
});
reportingRouter.get("/reports", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q = query(z.GetReportsQueryParams, req), config = await getSettings(), today = localNow(config.timezone).date;
  await authorizeReportContext(user, q);
  q.from ||= today.slice(0,7) + "-01"; q.to ||= today; assert(q.from <= q.to, 400, "Invalid report date range");
  const data = filtered(await scoped(user, "appointments", await all(appointments)), q);
  const registrations = filtered(await scoped(user, "patients", await all(patients)), { from: q.from, to: q.to, clinicId: q.clinicId, branchId: q.branchId });
  const groupBy = q.groupBy || "date", groups = new Map<string, any[]>();
  for (const row of data) { const key = groupBy === "date" ? row.date : row[groupBy + "Id"]; groups.set(key, [...(groups.get(key) || []), row]); }
  if (groupBy !== "doctor") for (const p of registrations) { const key = groupBy === "date" ? new Date(p.createdAt).toISOString().slice(0,10) : p.clinicId; if (key && !groups.has(key)) groups.set(key, []); }
  const rows = [...groups].map(([key, records]) => ({ key, label: groupBy === "date" ? key : records[0]?.[groupBy + "Name"] || key, ...metrics(records), registrations: registrations.filter(p => groupBy === "date" ? new Date(p.createdAt).toISOString().slice(0,10) === key : groupBy === "clinic" ? p.clinicId === key : records.some(a => a.patientId === p.id)).length })).sort((a,b) => a.key.localeCompare(b.key));
  res.json({ from: q.from, to: q.to, groupBy, rows });
});
reportingRouter.get("/audit-logs", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin"]);
  const q = query(z.ListAuditLogsQueryParams, req), accounts = await all(users);
  await authorizeReportContext(user, q);
  const rows = (await all(auditLogs)).filter(a => scope(user, a.clinicId)).map(a => { const actor = accounts.find(u => u.id === a.actorId); return { ...a, actorName: actor?.fullName, actorRole: actor?.role }; });
  res.json(paginate(filtered(rows, q), q));
});
reportingRouter.get("/settings", async (req, res) => { await requireUser(req); res.json(await getSettings()); });
reportingRouter.patch("/settings", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin"]);
  const body = parse(z.UpdateSettingsBody, req.body); if (body.timezone) localNow(body.timezone);
  await db.transaction(async tx => {
    const config = { ...await getSettings(tx), ...body }; delete (config as any).otpProviderConfigured;
    await tx.insert(settings).values({ id: "platform", data: config }).onConflictDoUpdate({ target: settings.id, set: { data: config } });
    await audit(user, "update", "settings", { id: "platform" }, tx);
  }); res.json(await getSettings());
});