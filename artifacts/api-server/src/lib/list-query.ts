import { db } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";
import { assert } from "./http";
import { statusGroups } from "./queue-order";
import { clinicalMembership, managedDoctorLinks } from "./clinical-membership";

const names: Record<string, string> = { users: "users", doctors: "doctors", clinics: "clinics", branches: "branches", patients: "patients", masters: "masters", schedules: "schedules", "availability-exceptions": "availability_exceptions", qrs: "qrs", appointments: "appointments", "audit-logs": "audit_logs" };
const raw = sql.raw;
const inList = (value: SQL, ids: string[]) => ids?.length ? sql`${value} in (${sql.join(ids.map(id => sql`${id}`), raw(","))})` : raw("false");
function operationalScope(user: any, clinic: SQL, branch: SQL): SQL {
  if (user.role === "superAdmin") return raw("true");
  return sql`(${inList(clinic, user.clinicIds)} and (${branch} is null or ${!["doctor", "receptionist"].includes(user.role)} or ${inList(branch, user.branchIds)}))`;
}
function links(kind: string) {
  if (kind === "doctors") return managedDoctorLinks(raw("r.id"));
  return raw(`select a.*, c.data->>'name' as clinic_name, b.data->>'name' as branch_name from assignments a join clinics c on c.id=a.clinic_id left join branches b on b.id=a.branch_id where a.user_id=r.${kind === "doctors" ? "user_id" : "id"} and c.status='active' and (a.branch_id is null or b.status='active')`);
}
export function readScope(user: any, kind: string): SQL {
  if (user.role === "superAdmin" || kind === "masters") return raw("true");
  if (kind === "users" || kind === "doctors") {
    const assigned = sql`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.clinic_id"), user.clinicIds)})`;
    const branch = !["doctor", "receptionist"].includes(user.role) ? raw("true") : sql`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.branch_id"), user.branchIds)})`;
    if (kind === "doctors") return sql`(r.id=${user.doctorId || ""} or (${["clinicAdmin", "doctor", "receptionist"].includes(user.role)} and ${assigned} and ${branch}))`;
    return sql`(r.id=${user.id} or (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}) or (not (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)}) and r.role<>'superAdmin' and ${assigned} and ${branch}))`;
  }
  if (kind === "patients") {
    if (user.role === "patient") return sql`r.id=${user.patientId || ""}`;
    const ownClinic = user.role === "doctor" ? raw("false") : operationalScope(user, raw("r.clinic_id"), raw("r.branch_id"));
    return sql`(${ownClinic} or exists(select 1 from appointments ap where ap.patient_id=r.id and ${operationalScope(user, raw("ap.clinic_id"), raw("ap.branch_id"))} ${user.role === "doctor" ? sql`and ap.doctor_id=${user.doctorId || ""}` : raw("")}))`;
  }
  if (kind === "clinics") return operationalScope(user, raw("r.id"), raw("null"));
  if (user.role === "patient") return kind === "appointments" ? sql`r.patient_id=${user.patientId || ""}` : raw("false");
  const clinic = kind === "availability-exceptions" ? raw("(select clinic_id from branches where id=r.branch_id)") : raw("r.clinic_id");
  const branch = kind === "branches" ? raw("r.id") : raw("r.branch_id");
  let result = operationalScope(user, clinic, branch);
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) result = sql`${result} and r.doctor_id=${user.doctorId || ""}`;
  if (["schedules", "availability-exceptions"].includes(kind)) result = sql`${result} and ${clinicalMembership(raw("r.doctor_id"), raw("r.branch_id"))}`;
  return result;
}
export function documentSql(kind: string): SQL {
  // Transform physical columns to the public camelCase contract; JSON data remains extensible.
  let doc = raw(`coalesce(to_jsonb(r)->'data','{}'::jsonb) || (select jsonb_object_agg((select string_agg(case when n=1 then word else initcap(word) end,'' order by n) from unnest(string_to_array(k,'_')) with ordinality t(word,n)),v) from jsonb_each(to_jsonb(r)-'data'-'password_hash'-'token_hash') e(k,v))`);
  // Users use a credential column, not extensible data. Never project that
  // column through generic list/export serialization.
  if (kind === "users") doc = sql`(${doc}) - 'passwordHash' - 'password_hash' - 'tokenHash' - 'token_hash' - 'clerkId'`;
  if (["users", "doctors"].includes(kind)) doc = sql`${doc} || jsonb_build_object('clinicIds',coalesce((select jsonb_agg(distinct l.clinic_id) from (${links(kind)}) l),'[]'::jsonb),'branchIds',coalesce((select jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null) from (${links(kind)}) l),'[]'::jsonb))`;
  if (kind === "doctors") doc = sql`${doc} || (select jsonb_build_object('fullName',u.full_name,'email',u.email,'mobile',coalesce(u.mobile,''),'passwordEnabled',u.password_hash is not null,'managingAdminId',r.owner_admin_id,'managingAdminName',(select full_name from users where id=r.owner_admin_id),'invitationStatus',case when u.password_hash is not null then 'notRequired' else u.invitation_status end,'status',case when u.status<>'active' then 'inactive' else r.status end) from users u where u.id=r.user_id) || jsonb_build_object('specializationName',(select data->>'name' from masters where id=r.specialization_id),'qualificationNames',coalesce((select jsonb_agg(data->>'name') from masters where id in (select jsonb_array_elements_text(coalesce(r.data->'qualificationIds','[]'::jsonb)))),'[]'::jsonb))`;
  if (kind === "users") doc = sql`${doc} || jsonb_build_object('mobile',coalesce(r.mobile,''),'passwordEnabled',r.password_hash is not null,'managingAdminName',(select full_name from users where id=r.managing_admin_id),'invitationStatus',case when r.password_hash is not null then 'notRequired' else r.invitation_status end)`;
  if (kind === "clinics") doc = sql`${doc} || jsonb_build_object('adminName',(select full_name from users where id=r.admin_id))`;
  if (kind === "branches") doc = sql`${doc} || jsonb_build_object('clinicName',(select data->>'name' from clinics where id=r.clinic_id),
    'inheritEmail',coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null),
    'inheritPhone',coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null),
    'effectiveEmail',case when coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null) then (select data->>'email' from clinics where id=r.clinic_id) else r.data->>'email' end,
    'effectivePhone',case when coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null) then (select data->>'phone' from clinics where id=r.clinic_id) else r.data->>'phone' end)`;
  if (["schedules", "availability-exceptions", "qrs"].includes(kind)) doc = sql`${doc} || jsonb_build_object('doctorName',(select u.full_name from doctors d join users u on u.id=d.user_id where d.id=r.doctor_id),'branchName',(select data->>'name' from branches where id=r.branch_id))`;
  if (kind === "qrs") doc = sql`${doc} || jsonb_build_object('reference',r.public_reference)`;
  if (kind === "audit-logs") doc = sql`${doc} || jsonb_build_object('actorName',(select full_name from users where id=r.actor_id),'actorRole',(select role from users where id=r.actor_id))`;
  return doc;
}
export function filterSql(q: any): SQL {
  const filters: SQL[] = [raw("true")];
  const weekday = q.dayOfWeek ?? q.weekday;
  if (weekday !== undefined) {
    assert(Number.isInteger(Number(weekday)) && Number(weekday) >= 0 && Number(weekday) <= 6, 400, "Invalid weekday");
    filters.push(sql`doc->>'dayOfWeek'=${String(weekday)}`);
  }
  if (q.linkedOnly === true) filters.push(sql`doc->>'passwordEnabled'='true'`);
  if (q.statusGroup && q.statusGroup !== "all") {
    assert(statusGroups[q.statusGroup], 400, "Invalid status group");
    filters.push(inList(raw("doc->>'status'"), statusGroups[q.statusGroup]));
  }
  for (const key of ["clinicId", "branchId", "doctorId", "patientId", "adminId", "managingAdminId", "status", "role", "category", "parentId", "gender", "city", "specializationId", "source", "entityType", "actorId", "date", "sessionId", "startTime"]) {
    if (q[key] !== undefined) filters.push(sql`(doc->>${key}=${q[key]} or coalesce(doc->${key === "clinicId" ? "clinicIds" : key === "branchId" ? "branchIds" : "__none"},'[]'::jsonb) ? ${q[key]})`);
  }
  if (q.search) filters.push(sql`exists(select 1 from jsonb_each_text(doc) e where e.key in ('name','fullName','email','mobile','code','reference','token','patientName','doctorName','summary','specializationName') and e.value ilike ${"%" + String(q.search).replace(/[\\%_]/g, "\\$&") + "%"})`);
  if (q.from) filters.push(sql`coalesce(doc->>'date',left(doc->>'createdAt',10))>=${q.from}`);
  if (q.to) filters.push(sql`coalesce(doc->>'date',left(doc->>'createdAt',10))<=${q.to}`);
  const security = sql`doc->>'action' in ('verifyStaffPassword','recoveryInstructions','invitationResent','invitationNotRequired','invitationFailed')`;
  if (q.activityType === "operational") filters.push(sql`not (${security})`);
  if (q.activityType === "security") filters.push(security);
  if (q.selectedIds) {
    const ids = String(q.selectedIds).split(",");
    assert(ids.length <= 100, 400, "At most 100 selected IDs may be resolved");
    filters.push(inList(raw("doc->>'id'"), ids));
  }
  return sql.join(filters, raw(" and "));
}
export function sourceSql(user: any, kind: string, extra: SQL = raw("true")) {
  assert(names[kind], 400, "Unsupported resource");
  let document = documentSql(kind);
  if (["users", "doctors"].includes(kind) && user.role !== "superAdmin") {
    const own = kind === "users" ? sql`r.id=${user.id}` : sql`r.id=${user.doctorId || ""}`;
    const peer = kind === "users" ? sql`r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}` : raw("false");
    document = sql`${document} || case when (${own} or (${peer})) then '{}'::jsonb else jsonb_build_object(
      'clinicIds',coalesce((select jsonb_agg(distinct l.clinic_id) from (${links(kind)}) l where ${inList(raw("l.clinic_id"), user.clinicIds)}),'[]'::jsonb),
      'branchIds',coalesce((select jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null) from (${links(kind)}) l where ${operationalScope(user, raw("l.clinic_id"), raw("l.branch_id"))}),'[]'::jsonb)) end`;
  }
  return sql`select ${document} as doc from ${raw(names[kind])} r where (${readScope(user, kind)}) and (${extra})`;
}
export const metricSql = sql`count(*)::int as appointments,
  count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting'))::int as waiting,
  count(*) filter(where doc->>'status'='inConsultation')::int as "checkedIn",
  count(*) filter(where doc->>'status'='completed')::int as completed,
  count(*) filter(where doc->>'status'='noShow')::int as "noShow",
  count(*) filter(where doc->>'status'='cancelled')::int as cancelled,
  coalesce(avg((doc->>'waitMinutes')::numeric),0)::float as "averageWaitMinutes",
  avg(case when doc->>'status'='completed'
    and doc->>'consultationStartedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and doc->>'completedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and (doc->>'completedAt')::timestamptz >= (doc->>'consultationStartedAt')::timestamptz
    then extract(epoch from ((doc->>'completedAt')::timestamptz - (doc->>'consultationStartedAt')::timestamptz))/60 end)::float as "averageConsultationMinutes"`;
export async function queryMetrics(user: any, q: any) {
  const result = await db.execute(sql`with visible as (${sourceSql(user, "appointments")}) select ${metricSql},
    count(distinct (doc->>'doctorId',doc->>'branchId',doc->>'date',doc->>'startTime')) filter(where doc->>'status' in ('booked','checkedIn','waiting','called','inConsultation'))::int as "activeQueues",
    min(doc->>'token') filter(where doc->>'status' in ('called','inConsultation')) as "currentToken"
    from visible where ${filterSql(q)}`);
  return result.rows[0];
}
export function pageParams(q: any) {
  const page = Number(q.page || 1), pageSize = Number(q.pageSize || 20);
  assert(Number.isInteger(page) && page > 0 && Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100, 400, "Invalid pagination");
  return { page, pageSize };
}
const statusCountsSql = sql`jsonb_build_object(
  'all', count(*)::int,
  ${sql.join(Object.entries(statusGroups).map(([group, statuses]) =>
    sql`${group}::text, count(*) filter(where ${inList(raw("doc->>'status'"), statuses)})::int`), raw(","))})`;
export async function queryPage(user: any, kind: string, q: any = {}, extra?: SQL, conn: any = db, withStatusCounts = false) {
  assert(!withStatusCounts || kind === "appointments" && user.role !== "patient", 400, "Status counts require staff appointments");
  const { page, pageSize } = pageParams(q), sort = q.sort || "-createdAt", key = sort.replace(/^-/, "");
  assert(["createdAt", "name", "fullName", "date", "status", "code", "tokenNumber", "sortOrder", "email", "waitingAt"].includes(key), 400, "Unsupported sort field");
  const direction = raw(sort.startsWith("-") ? "desc" : "asc");
  const value = key === "waitingAt" ? sql`coalesce(doc->>'waitingAt',doc->>'createdAt')` : ["tokenNumber", "sortOrder"].includes(key) ? sql`nullif(doc->>${key},'')::numeric` : sql`doc->>${key}`;
  const secondary = key === "waitingAt" ? sql`(doc->>'tokenNumber')::int ${direction},` : raw("");
  // Branches have no doctorId column: resolve the real assignment relationship.
  let effectiveQuery = q;
  if (kind === "branches" && q.doctorId) {
    extra = sql`(${extra || raw("true")}) and ${clinicalMembership(sql`${q.doctorId}`, raw("r.id"))}`;
    effectiveQuery = { ...q, doctorId: undefined };
  }
  const source = sourceSql(user, kind, extra), filter = filterSql(effectiveQuery);
  const matching = withStatusCounts
    ? sql`base_matching as (select doc from visible where ${filterSql({ ...effectiveQuery, status: undefined, statusGroup: undefined })}), matching as (select doc from base_matching where ${filterSql({ status: effectiveQuery.status, statusGroup: effectiveQuery.statusGroup })})`
    : sql`matching as (select doc from visible where ${filter})`;
  const result = await conn.execute(sql`with visible as (${source}), ${matching}, page_rows as (select doc from matching order by ${value} ${direction} nulls last, ${secondary} doc->>'id' ${direction} limit ${pageSize} offset ${(page - 1) * pageSize}) select (select count(*)::int from matching) as total, coalesce((select jsonb_agg(doc) from page_rows),'[]'::jsonb) as items ${withStatusCounts ? sql`, (select ${statusCountsSql} from base_matching) as "statusCounts"` : raw("")}`);
  const { items, total, statusCounts } = result.rows[0];
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), ...(withStatusCounts ? { statusCounts } : {}) };
}
export function queryAppointmentPage(user: any, q: any, conn: any = db) {
  return queryPage(user, "appointments", q, undefined, conn, user.role !== "patient");
}
export function assignmentCatalogPredicate(kind: "clinics" | "branches", manager?: string, retainedUserId?: string) {
  const retained = retainedUserId ? sql`exists(select 1 from assignments a where a.user_id=${retainedUserId} and ${kind === "clinics" ? sql`a.clinic_id=r.id` : sql`a.branch_id=r.id and a.clinic_id=r.clinic_id`})` : raw("false");
  if (kind === "clinics") return sql`(${manager ? sql`r.admin_id=${manager}` : raw("true")}) and (r.status='active' or ${retained})`;
  return sql`exists(select 1 from clinics c where c.id=r.clinic_id and (${manager ? sql`c.admin_id=${manager}` : raw("true")}) and ((r.status='active' and c.status='active') or ${retained}))`;
}