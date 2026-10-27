import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { clinicalMembership } from "./clinical-membership";
import { readScope } from "./list-query";
import { clinicDisplayPreferences } from "./display-preferences";

type OverviewQuery = {
  date: string;
  clinicId?: string;
  branchId?: string;
  doctorId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

/**
 * One bounded, read-only SQL snapshot. Never poll a queue per doctor or acquire
 * operational queue locks just to browse. Scope is applied before grouping,
 * including the doctor's own-doctor restriction and saved server workspace.
 */
export async function queueSessionOverview(user: any, q: OverviewQuery, conn: any = db) {
  const page = q.page ?? 1, pageSize = q.pageSize ?? 20;
  const weekday = new Date(`${q.date}T12:00:00Z`).getUTCDay();
  const filters = [
    readScope(user, "appointments"),
    clinicalMembership(sql`r.doctor_id`, sql`r.branch_id`, sql`r.clinic_id`),
  ];
  if (q.clinicId) filters.push(sql`r.clinic_id=${q.clinicId}`);
  if (q.branchId) filters.push(sql`r.branch_id=${q.branchId}`);
  if (q.doctorId) filters.push(sql`r.doctor_id=${q.doctorId}`);
  const search = q.search?.trim();
  // Escape wildcard characters: a patient-independent literal name search.
  if (search) {
    const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(sql`concat_ws(' ',c.data->>'name',b.data->>'name',u.full_name) ilike ${term}`);
  }
  const result = await conn.execute(sql`
    with effective_weekly as (
      select s.doctor_id,s.branch_id,s.clinic_id,s.id as session_id,
        coalesce(e.data->>'startTime',s.data->>'startTime') as start_time,
        coalesce(e.data->>'endTime',s.data->>'endTime') as end_time,
        coalesce(s.data->>'timezone',b.data->>'timezone','Asia/Kolkata') as timezone,
        false as snapshot_only,
        coalesce((s.data->>'isOpen')::boolean,false)
          and not coalesce((e.data->>'isClosed')::boolean,false) as available
      from schedules s join branches b on b.id=s.branch_id
      left join lateral (
        select ex.data from availability_exceptions ex
        where ex.doctor_id=s.doctor_id and ex.branch_id=s.branch_id
          and ex.date=${q.date} and ex.status='active'
          and not coalesce((ex.data->>'isExtra')::boolean,false)
          and (ex.data->>'sessionId'=s.id or ex.data->>'sessionId' is null)
        order by (ex.data->>'sessionId'=s.id) desc nulls last,ex.id limit 1
      ) e on true
      where s.status='active' and s.day_of_week=${weekday}
    ), extra_sessions as (
      select e.doctor_id,e.branch_id,b.clinic_id,e.id as session_id,
        e.data->>'startTime' as start_time,e.data->>'endTime' as end_time,
        coalesce(e.data->>'timezone',b.data->>'timezone','Asia/Kolkata') as timezone,
        false as snapshot_only,not coalesce((e.data->>'isClosed')::boolean,false) as available
      from availability_exceptions e join branches b on b.id=e.branch_id
      where e.status='active' and e.date=${q.date}
        and coalesce((e.data->>'isExtra')::boolean,false)
    ), snapshots as (
      select a.doctor_id,a.branch_id,a.clinic_id,min(a.data->>'sessionId') as session_id,
        a.data->>'startTime' as start_time,max(a.data->>'endTime') as end_time,
        coalesce(max(a.data->>'timezone'),'Asia/Kolkata') as timezone,
        true as snapshot_only,false as available
      from appointments a where a.date=${q.date}
      group by a.doctor_id,a.branch_id,a.clinic_id,a.data->>'startTime'
    ), candidates as (
      select * from effective_weekly union all select * from extra_sessions
      union all select * from snapshots
    ), authorized as (
      select distinct on (r.doctor_id,r.branch_id,r.start_time)
        r.*,c.data->>'name' as clinic_name,b.data->>'name' as branch_name,
        c.data->>'dateFormat' as date_format,c.data->>'timeFormat' as time_format,
        coalesce(u.full_name,'Doctor') as doctor_name
      from candidates r
      join branches b on b.id=r.branch_id and b.clinic_id=r.clinic_id
      join clinics c on c.id=r.clinic_id
      join doctors d on d.id=r.doctor_id
      join users u on u.id=d.user_id
      where ${sql.join(filters, sql` and `)}
      order by r.doctor_id,r.branch_id,r.start_time,r.snapshot_only,r.session_id
    ), counts as (
      select a.doctor_id,a.branch_id,a.data->>'startTime' as start_time,
        count(*)::integer as total,
        count(*) filter(where a.status in ('booked','checkedIn','waiting'))::integer as waiting,
        count(*) filter(where a.status in ('called','inConsultation'))::integer as in_consultation,
        count(*) filter(where a.status='completed')::integer as completed,
        count(*) filter(where a.status='cancelled')::integer as cancelled
      from appointments a
      where a.date=${q.date} and exists(select 1 from authorized r
        where r.doctor_id=a.doctor_id and r.branch_id=a.branch_id
          and r.start_time is not distinct from a.data->>'startTime')
      group by a.doctor_id,a.branch_id,a.data->>'startTime'
    ), page_rows as (
      select r.*,coalesce(n.total,0) as total,coalesce(n.waiting,0) as waiting,
        coalesce(n.in_consultation,0) as in_consultation,
        coalesce(n.completed,0) as completed,coalesce(n.cancelled,0) as cancelled
      from authorized r left join counts n
        on n.doctor_id=r.doctor_id and n.branch_id=r.branch_id
          and n.start_time is not distinct from r.start_time
      order by r.clinic_name,r.clinic_id,r.branch_name,r.branch_id,
        r.doctor_name,r.doctor_id,r.start_time nulls last,r.session_id nulls last
      limit ${pageSize} offset ${(page - 1) * pageSize}
    )
    select (select count(*)::integer from authorized) as total,
      coalesce((select jsonb_agg(jsonb_build_object(
        'clinicId',p.clinic_id,'clinicName',coalesce(p.clinic_name,'Clinic'),
        'branchId',p.branch_id,'branchName',coalesce(p.branch_name,'Location'),
        'doctorId',p.doctor_id,'doctorName',p.doctor_name,'date',${q.date}::text,
        'timezone',p.timezone,'sessionId',p.session_id,'startTime',p.start_time,
        'dateFormat',p.date_format,'timeFormat',p.time_format,
        'endTime',p.end_time,'snapshotOnly',p.snapshot_only,'available',p.available,
        'total',p.total,'waiting',p.waiting,'inConsultation',p.in_consultation,
        'completed',p.completed,'cancelled',p.cancelled
      ) order by p.clinic_name,p.clinic_id,p.branch_name,p.branch_id,
        p.doctor_name,p.doctor_id,p.start_time nulls last,p.session_id nulls last)
      from page_rows p),'[]'::jsonb) as items
  `);
  const row = result.rows[0];
  return {
    items: (row?.items ?? []).map((item: any) => ({ ...item, ...clinicDisplayPreferences(item) })),
    total: Number(row?.total ?? 0), page, pageSize,
  };
}
