import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { filterSql, sourceSql, metricSql } from "./list-query";
import { assert } from "./http";

export const reportFamilies = {
  appointments: ["Daily Appointment Summary", "Appointments"],
  doctors: ["Doctor Utilization", "Doctors"],
  noShow: ["No-show Analysis", "Appointments"],
  patients: ["Patient Registration", "Patients"],
  cancellations: ["Cancellation Report", "Appointments"],
  activity: ["Clinic Activity", "Activity"],
  reschedules: ["Reschedule Analysis", "Appointments"],
  clinicPerformance: ["Clinic Performance", "Clinics"],
  patientActivity: ["Patient Activity", "Patients"],
} as const;

export function previousRange(from: string, to: string) {
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  const shift = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
  return { from: shift(from, -days), to: shift(from, -1) };
}
const zeros = () => ({ appointments: 0, completed: 0, cancelled: 0, noShow: 0,
  uniquePatients: 0, registrations: 0, waiting: 0, checkedIn: 0, averageWaitMinutes: null as number | null,
  averageConsultationMinutes: null as number | null, consultationMinutes: null as number | null,
  timedConsultations: 0, reschedules: 0, rescheduledAppointments: 0, activity: 0 });

/** Reporting reads aggregate in PostgreSQL, not in the browser and not from a paged list.
 * All component datasets share one SQL statement/MVCC snapshot, including exports. */
export async function reportAnalytics(user: any, q: any, timezone: string, conn: any = db) {
  const previous = previousRange(q.from, q.to);
  const first = q.compare ? previous.from : q.from;
  const scope = { clinicId: q.clinicId, branchId: q.branchId, doctorId: q.doctorId, sessionId: q.sessionId, startTime: q.startTime };
  const familyEntries = Object.entries(reportFamilies).filter(([id]) => q.reportType === "all" || id === q.reportType);
  const search = (q.search || "").trim().toLowerCase();
  const nameMatch = familyEntries.filter(([, names]) => names.some(n => n.toLowerCase().includes(search)));
  const selected = search && nameMatch.length ? nameMatch : familyEntries;
  const groupSearch = search && !nameMatch.length ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null;
  const dimension = q.groupBy === "doctor" ? sql`doc->>'doctorId'` : q.groupBy === "clinic" ? sql`doc->>'clinicId'` : sql`doc->>'date'`;
  const label = q.groupBy === "doctor" ? sql`coalesce(doc->>'doctorName','Unknown Doctor')` : q.groupBy === "clinic" ? sql`doc->>'clinicName'` : sql`doc->>'date'`;
  const duration = sql`case when doc->>'status'='completed'
    and doc->>'consultationStartedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and doc->>'completedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and (doc->>'completedAt')::timestamptz >= (doc->>'consultationStartedAt')::timestamptz
    then extract(epoch from ((doc->>'completedAt')::timestamptz - (doc->>'consultationStartedAt')::timestamptz))/60 end`;
  // Appointment dates already represent local session days. Timestamp-based
  // sources use the location timezone, falling back to the platform timezone.
  const dated = (kind: string) => sql`select doc || jsonb_build_object('date',
    to_char((doc->>'createdAt')::timestamptz at time zone coalesce(
      (select data->>'timezone' from branches where id=doc->>'branchId'),${timezone}), 'YYYY-MM-DD')) as doc
    from (${sourceSql(user, kind)}) s`;
  const outcome = q.reportType === "noShow" ? "noShow" : q.reportType === "cancellations" ? "cancelled" : undefined;
  const recordFilter = filterSql({ ...scope, from: first, to: q.to, status: outcome });
  const result = await conn.execute(sql`with
    appointments_visible as (${sourceSql(user, "appointments")}),
    appointment_context as (select doc from appointments_visible where ${filterSql(scope)}),
    appointment_records as (select doc || jsonb_build_object('clinicName',
      coalesce((select data->>'name' from clinics where id=doc->>'clinicId'),'Unknown Clinic'),
      'doctorName',coalesce((select u.full_name from doctors d left join users u on u.id=d.user_id where d.id=doc->>'doctorId' and d.status<>'retired'),doc->>'doctorName','Deleted Doctor')) as doc
      from appointments_visible where ${recordFilter}),
    patients_visible as (${dated("patients")}),
    patient_records as (select doc || jsonb_build_object('clinicName',
      coalesce((select data->>'name' from clinics where id=doc->>'clinicId'),'Unknown Clinic')) as doc
      from patients_visible where ${filterSql({ from: first, to: q.to, clinicId: q.clinicId, branchId: q.branchId })}
      -- Profile visibility through a local visit does not grant access to the
      -- patient's registration event at another clinic or location.
      and exists (select 1 from (${sourceSql(user, "clinics")}) registration_clinic
        where registration_clinic.doc->>'id'=patients_visible.doc->>'clinicId')
      and (nullif(doc->>'branchId','') is null or exists (
        select 1 from (${sourceSql(user, "branches")}) registration_branch
        where registration_branch.doc->>'id'=patients_visible.doc->>'branchId'))
      and ${q.doctorId || q.sessionId || q.startTime ? sql`exists(select 1 from appointment_context a where a.doc->>'patientId'=patients_visible.doc->>'id')` : sql`true`}),
    audit_visible as (${["superAdmin", "clinicAdmin"].includes(user.role) ? dated("audit-logs") : sql`select null::jsonb as doc where false`}),
    audit_records as (select doc || jsonb_build_object('clinicName',
      coalesce((select data->>'name' from clinics where id=doc->>'clinicId'),'Unknown Clinic'),
      'doctorId',(select a.doc->>'doctorId' from appointments_visible a where a.doc->>'id'=doc->>'entityId' limit 1),
      'doctorName',(select a.doc->>'doctorName' from appointments_visible a where a.doc->>'id'=doc->>'entityId' limit 1)) as doc
      from audit_visible where ${filterSql({ from: first, to: q.to, clinicId: q.clinicId, branchId: q.branchId, activityType: "operational" })}
      and ${q.doctorId || q.sessionId || q.startTime ? sql`exists(select 1 from appointment_context a where a.doc->>'id'=audit_visible.doc->>'entityId')` : sql`true`}),
    sources as (
      select 'appointment' as source, doc from appointment_records
      union all select 'patient',doc from patient_records
      union all select 'audit',doc from audit_records),
    matching as (select * from sources where ${groupSearch ? sql`(${label} ilike ${groupSearch} or doc->>'clinicName' ilike ${groupSearch} or doc->>'date' ilike ${groupSearch})` : sql`true`}),
    dimensions as (
      select source,doc,doc->>'date'>=${q.from} as current,
        d.kind,d.key,d.clinic,d.label
      from matching cross join lateral (values
        ('row',${dimension},doc->>'clinicId',${label}),
        ('day',doc->>'date','',''),
        ('total','','','')) d(kind,key,clinic,label)
      where d.key is not null),
    aggregates as (select source,current,kind,key,clinic,max(label) as label,
      max(doc->>'clinicName') as "clinicName",max(doc->>'date') as date,
      ${metricSql}, count(distinct doc->>'patientId')::int as "uniquePatients",
      avg((doc->>'waitMinutes')::numeric)::float as "actualAverageWait",
      sum(${duration})::float as "consultationMinutes",
      count(${duration})::int as "timedConsultations",
      count(*) filter(where doc->>'action'='reschedule')::int as reschedules,
      count(distinct doc->>'entityId') filter(where doc->>'action'='reschedule')::int as "rescheduledAppointments"
      from dimensions group by source,current,kind,key,clinic)
    select coalesce(jsonb_agg(to_jsonb(aggregates)),'[]'::jsonb) as groups from aggregates`);
  const groups = result.rows[0].groups as any[];
  const metrics = (g?: any) => {
    const value = zeros();
    if (!g) return value;
    if (g.source === "appointment") {
      for (const k of ["appointments", "completed", "cancelled", "noShow", "uniquePatients", "waiting", "checkedIn", "averageConsultationMinutes", "consultationMinutes", "timedConsultations"] as const) (value as any)[k] = g[k];
      value.averageWaitMinutes = g.actualAverageWait;
    } else if (g.source === "patient") value.registrations = g.appointments;
    else { value.activity = g.appointments; value.reschedules = g.reschedules; value.rescheduledAppointments = g.rescheduledAppointments; }
    return value;
  };
  const merge = (list: any[]) => {
    const value = zeros();
    for (const g of list) {
      const m = metrics(g);
      if (g.source === "appointment") Object.assign(value, m);
    }
    for (const g of list) {
      const m = metrics(g);
      if (g.source === "patient") value.registrations = m.registrations;
      if (g.source === "audit") { value.activity = m.activity; value.reschedules = m.reschedules; value.rescheduledAppointments = m.rescheduledAppointments; }
    }
    return value;
  };
  const summary = (current: boolean) => merge(groups.filter(g => g.kind === "total" && g.current === current));
  const points = (from: string, to: string, current: boolean) => {
    const out = [];
    for (let time = Date.parse(from); time <= Date.parse(to); time += 86400000) {
      const date = new Date(time).toISOString().slice(0, 10);
      const m = metrics(groups.find(g => g.source === "appointment" && g.kind === "day" && g.current === current && g.key === date));
      out.push({ date, appointments: m.appointments, completed: m.completed, cancelled: m.cancelled, noShow: m.noShow, waiting: m.waiting });
    }
    return out;
  };
  const rows: any[] = [];
  const contexts = [...new Map(groups.filter(g => g.current && g.kind === "row" && g.key != null)
    .map(g => [JSON.stringify([g.clinic, g.key]), g])).values()];
  for (const [family, [name, type]] of selected) {
    if (["activity", "reschedules"].includes(family) && !["superAdmin", "clinicAdmin"].includes(user.role)) continue;
    const source = family === "patients" ? "patient" : ["activity", "reschedules"].includes(family) ? "audit" : "appointment";
    for (const g of contexts) {
      const same = groups.filter(other => other.current && other.kind === "row" && other.clinic === g.clinic && other.key === g.key);
      const m = merge(same);
      const events = family === "noShow" ? m.noShow : family === "cancellations" ? m.cancelled : family === "reschedules" ? m.reschedules : source === "patient" ? m.registrations : source === "audit" ? m.activity : m.appointments;
      const status = events ? "available" : "noData";
      if (q.status && q.status !== "all" && q.status !== status) continue;
      rows.push({ id: JSON.stringify([family, g.clinic, g.key]), date: q.groupBy === "date" ? g.key : q.to,
        label: name, group: g.label || g.key, clinicId: g.clinic || "", clinic: g.clinicName || "Not Recorded",
        family, type, status, metrics: m });
    }
  }
  const sort = q.sort || "-date", key = sort.replace(/^-/, ""), direction = sort.startsWith("-") ? -1 : 1;
  rows.sort((a, b) => {
    const left = a[key] ?? a.metrics[key], right = b[key] ?? b.metrics[key];
    if (left == null || right == null) return left == null && right == null ? a.id.localeCompare(b.id) : left == null ? 1 : -1;
    return direction * (typeof left === "number" ? left - right : String(left).localeCompare(String(right))) || a.id.localeCompare(b.id);
  });
  const page = q.page || 1, pageSize = q.pageSize || 20;
  const notes = [
    "Available means a live summary calculated from recorded data, not a completed report run. Report families can share visits; do not sum visit counts across families.",
    "Availability filters report rows, not appointment outcomes or dashboard KPIs. No Data means no recorded source events for that family within an otherwise observed group. Entirely unobserved ranges have no rows.",
    "KPIs count scoped visits once, not report rows. No-show and Cancellation selections restrict visits to that outcome. Other families describe the same scoped visit population.",
    "Unique patients are distinct patient IDs among visits. Registrations use their recorded creation day in the location timezone, not the first attended visit.",
    "Consultation time uses completed visits with valid start/end timestamps. Missing durations are unavailable, not zero. Scheduled capacity utilization is not inferred from opening hours.",
    "Activity and reschedules use retained operational audit events on the action day. The number of reschedule actions differs from the number of distinct appointments changed. Historical omissions cannot be reconstructed.",
    "Doctor/session activity attribution uses the appointment's current scope where recorded audit events lack historical doctor/session coordinates.",
  ];
  if (!["superAdmin", "clinicAdmin"].includes(user.role)) notes.push("Operational audit activity is restricted to administrators; activity and reschedule reports are unavailable for this role.");
  return { from: q.from, to: q.to, timezone, generatedAt: new Date().toISOString(),
    summary: summary(true), previous: q.compare ? summary(false) : null,
    previousFrom: previous.from, previousTo: previous.to,
    points: points(q.from, q.to, true), previousPoints: q.compare ? points(previous.from, previous.to, false) : [],
    rows: q.exportAll ? rows : rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length, page, pageSize, notes };
}
