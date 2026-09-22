import { Router } from "express";
import { db, appointments, doctors, clinics, branches, patients, auditLogs, settings, users } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, roles, scoped, scope } from "../lib/auth";
import { parse, query, assert } from "../lib/http";
import { all, getSettings, filtered, paginate, audit } from "../lib/store";
import { enrich } from "../lib/entities";
import { appointmentView } from "../lib/appointments";
import { localNow } from "../lib/availability";
export const reportingRouter = Router();
function metrics(rows: any[]) {
  const count = (status: string) => rows.filter(a => a.status === status).length;
  const waits = rows.filter(a => typeof a.waitMinutes === "number"), consultations = rows.filter(a => typeof a.consultationMinutesActual === "number");
  return { appointments: rows.length, waiting: count("waiting"), checkedIn: count("checkedIn"), completed: count("completed"), noShow: count("noShow"), cancelled: count("cancelled"), averageWaitMinutes: waits.length ? waits.reduce((s,a) => s + a.waitMinutes, 0) / waits.length : 0, averageConsultationMinutes: consultations.length ? consultations.reduce((s,a) => s + a.consultationMinutesActual, 0) / consultations.length : 0 };
}
reportingRouter.get("/dashboard", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetDashboardQueryParams, req), config = await getSettings();
  q.date ||= localNow(config.timezone).date;
  const rows = filtered(await scoped(user, "appointments", await all(appointments)), q), stats = metrics(rows);
  const counts: any = {};
  for (const [kind, table, key] of [["doctors", doctors, "totalDoctors"], ["clinics", clinics, "totalClinics"], ["branches", branches, "totalBranches"], ["patients", patients, "totalPatients"]] as const) {
    const data = await Promise.all((await all(table)).filter(r => r.status === "active").map(r => enrich(kind, r)));
    counts[key] = filtered(await scoped(user, kind, data), { clinicId: q.clinicId, branchId: q.branchId }).length;
  }
  res.json({ ...counts, ...stats, todayAppointments: rows.length, activeQueues: new Set(rows.filter(a => ["waiting", "called", "inConsultation"].includes(a.status)).map(a => `${a.doctorId}:${a.branchId}`)).size, currentToken: rows.find(a => ["called", "inConsultation"].includes(a.status))?.token || null, recentAppointments: rows.sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0,8).map(a => appointmentView(a,user)), recentActivity: ["superAdmin", "clinicAdmin"].includes(user.role) ? (await all(auditLogs)).filter(a => scope(user, a.clinicId)).sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0,8) : [] });
});
reportingRouter.get("/reports", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q = query(z.GetReportsQueryParams, req), config = await getSettings(), today = localNow(config.timezone).date;
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