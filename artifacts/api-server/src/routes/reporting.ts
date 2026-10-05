import { Router } from "express";
import { db, appointments, doctors, clinics, branches, patients, auditLogs, settings, users } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, roles, scoped, scope, canRead, projectAssignmentScope } from "../lib/auth";
import { parse, query, assert } from "../lib/http";
import { all, one, getSettings, filtered, paginate, audit } from "../lib/store";
import { enrich } from "../lib/entities";
import { appointmentViews } from "../lib/appointments";
import { localNow } from "../lib/availability";
import { sql } from "drizzle-orm";
import { reportListControls, reportOrder } from "../lib/report-order";
import { queryPage, queryMetrics, sourceSql, filterSql, pageParams, metricSql } from "../lib/list-query";
export const reportingRouter = Router();
export { reportListControls } from "../lib/report-order";
async function authorizeReportContext(user: any, q: any) {
  if (user.role === "patient") {
    if (q.clinicId || q.branchId || q.doctorId) {
      const own = await queryPage(user, "appointments", { ...q, date: undefined, pageSize: 1 });
      assert(own.total, 403, "Dashboard context outside your scope");
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
    const doctor = (await queryPage(user, "doctors", { selectedIds: q.doctorId, pageSize: 1 })).items[0];
    assert(doctor, 403, "Doctor outside your scope");
    if (q.branchId) assert(doctor.branchIds.includes(q.branchId), 400, "This doctor is not assigned to the selected branch");
    else if (clinicId) assert(doctor.clinicIds.includes(clinicId), 400, "This doctor is not assigned to the selected clinic");
  }
}
reportingRouter.get("/dashboard", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetDashboardQueryParams, req), config = await getSettings();
  await authorizeReportContext(user, q);
  q.date ||= localNow(config.timezone).date;
  const stats = await queryMetrics(user, q);
  const recent = await queryPage(user, "appointments", { ...q, pageSize: 8, sort: "-createdAt" });
  const counts: any = {};
  for (const [kind, table, key] of [["doctors", doctors, "totalDoctors"], ["clinics", clinics, "totalClinics"], ["branches", branches, "totalBranches"], ["patients", patients, "totalPatients"]] as const) {
    const filters: any = { status: "active", clinicId: q.clinicId, branchId: q.branchId, pageSize: 1 };
    if (kind === "clinics") { delete filters.clinicId; delete filters.branchId; }
    if (kind === "branches") delete filters.branchId;
    let extra = sql`true`;
    if (kind === "clinics" && q.clinicId) extra = sql`r.id=${q.clinicId}`;
    if (kind === "branches" && q.branchId) extra = sql`r.id=${q.branchId}`;
    if (kind === "doctors" && q.doctorId) extra = sql`r.id=${q.doctorId}`;
    if (kind === "patients" && q.doctorId) extra = sql`r.id in (select doc->>'patientId' from (${sourceSql(user, "appointments")}) v where ${filterSql(q)})`;
    counts[key] = (await queryPage(user, kind, filters, extra)).total;
  }
  const recentActivity = ["superAdmin", "clinicAdmin"].includes(user.role)
    ? (await queryPage(user, "audit-logs", { clinicId: q.clinicId, branchId: q.branchId, activityType: "operational", pageSize: 8 })).items
    : [];
  res.json({ ...counts, ...stats, todayAppointments: stats.appointments, recentAppointments: await appointmentViews(recent.items,user), recentActivity });
});
reportingRouter.get("/reports", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q = { ...query(z.GetReportsQueryParams, req), ...query(reportListControls, req) }, config = await getSettings(), today = localNow(config.timezone).date;
  await authorizeReportContext(user, q);
  q.from ||= today.slice(0,7) + "-01"; q.to ||= today; assert(q.from <= q.to, 400, "Invalid report date range");
  const groupBy = q.groupBy || "date", { page, pageSize } = pageParams(q);
  const group = groupBy === "date" ? sql`doc->>'date'` : sql`doc->>${groupBy + "Id"}`;
  const registrationGroup = groupBy === "date" ? sql`left(doc->>'createdAt',10)` : sql`doc->>'clinicId'`;
  // Search the grouped view, not patient-level data. Filtering and pagination
  // share the same CTE so the returned count and exported pages agree.
  const search = q.search ? `%${q.search.replace(/[\\%_]/g, "\\$&")}%` : null;
  const searchPredicate = search ? sql`(key ilike ${search} or label ilike ${search})` : sql`true`;
   const order = reportOrder(q.sort);
  const result = await db.execute(sql`with appointments_scoped as (${sourceSql(user, "appointments")}),
    records as (select doc from appointments_scoped where ${filterSql({ ...q, search: undefined })}),
    patients_scoped as (${sourceSql(user, "patients")}),
    registrations as (select doc from patients_scoped where ${filterSql({ from: q.from, to: q.to, clinicId: q.clinicId, branchId: q.branchId })}),
     grouped as (select ${group} as key, coalesce(min(doc->>${groupBy + "Name"}),min(${group})) as label, ${metricSql} from records group by 1),
    keys as (select key from grouped union select ${registrationGroup} from registrations where ${groupBy !== "doctor"} and ${registrationGroup} is not null),
    results as (select k.key, coalesce(g.label,k.key) as label, coalesce(g.appointments,0) as appointments, coalesce(g.waiting,0) as waiting, coalesce(g."checkedIn",0) as "checkedIn", coalesce(g.completed,0) as completed, coalesce(g."noShow",0) as "noShow", coalesce(g.cancelled,0) as cancelled, coalesce(g."averageWaitMinutes",0) as "averageWaitMinutes", g."averageConsultationMinutes",
      (select count(*)::int from registrations p where ${groupBy === "doctor" ? sql`exists(select 1 from records a where a.doc->>'doctorId'=k.key and a.doc->>'patientId'=p.doc->>'id')` : groupBy === "date" ? sql`left(p.doc->>'createdAt',10)=k.key` : sql`p.doc->>'clinicId'=k.key`}) as registrations
      from keys k left join grouped g using(key)),
    filtered_results as (select * from results where ${searchPredicate}),
     page_rows as (select * from filtered_results order by ${order} limit ${pageSize} offset ${(page - 1) * pageSize})
    select (select count(*)::int from filtered_results) as total, coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb) as rows`);
  const { rows, total } = result.rows[0] as any;
  res.json({ from: q.from, to: q.to, groupBy, rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});
reportingRouter.get("/reports/trends", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q: any = query(z.GetReportTrendsQueryParams, req), today = localNow((await getSettings()).timezone).date;
  await authorizeReportContext(user, q);
  q.from ||= today.slice(0, 7) + "-01"; q.to ||= today;
  assert(q.from <= q.to, 400, "Invalid report date range");
  assert((Date.parse(q.to) - Date.parse(q.from)) / 86400000 <= 366, 400, "Trend range is limited to one year");
  const result = await db.execute(sql`with records as (select doc from (${sourceSql(user, "appointments")}) s where ${filterSql({ from: q.from, to: q.to, clinicId: q.clinicId, branchId: q.branchId, doctorId: q.doctorId })}),
    grouped as (select doc->>'date' as date, ${metricSql} from records group by 1)
    select to_char(d, 'YYYY-MM-DD') as date, coalesce(g.appointments,0) as appointments, coalesce(g.completed,0) as completed, coalesce(g.cancelled,0) as cancelled, coalesce(g."noShow",0) as "noShow", coalesce(g.waiting,0) as waiting
    from generate_series(${q.from}::date, ${q.to}::date, interval '1 day') d left join grouped g on g.date = to_char(d, 'YYYY-MM-DD') order by 1`);
  res.json({ from: q.from, to: q.to, points: result.rows });
});
reportingRouter.get("/audit-logs", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin", "clinicAdmin"]);
  const q = query(z.ListAuditLogsQueryParams, req);
  await authorizeReportContext(user, q);
  res.json(await queryPage(user, "audit-logs", q));
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