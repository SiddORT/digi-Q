export const queueFixtureSql = `
CREATE TABLE integration_credentials (provider text PRIMARY KEY, encrypted text NOT NULL, revision text NOT NULL);
  create table users(id text primary key, clerk_id text, password_hash text, email_verified_at timestamptz, password_changed_at timestamptz, email text, full_name text, mobile text, role text, managing_admin_id text, invitation_status text default 'notRequired',status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table auth_sessions(id text primary key, user_id text, token_hash text, created_at timestamptz default now(), expires_at timestamptz, revoked_at timestamptz);
  create table clinics(id text primary key,owner_id text,admin_id text,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table branches(id text primary key,clinic_id text,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create unique index clinic_slug_unique on clinics((data->>'slug'));
  create unique index branch_slug_clinic_unique on branches(clinic_id,(data->>'slug'));
  create table doctors(id text primary key,user_id text,owner_admin_id text,specialization_id text,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table assignments(id text primary key,user_id text,clinic_id text,branch_id text);
  create table patients(id text primary key,user_id text,clinic_id text,branch_id text,mobile text,mobile_verified boolean default false,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table schedules(id text primary key,doctor_id text,clinic_id text,branch_id text,day_of_week int,status text default 'active',data jsonb not null default '{}');
  create table availability_exceptions(id text primary key,doctor_id text,branch_id text,date text,status text default 'active',data jsonb not null default '{}');
  create table appointments(id text primary key,patient_id text,doctor_id text,clinic_id text,branch_id text,date text,token_number int,status text default 'booked',request_id text,actor_id text,data jsonb not null default '{}',created_at timestamptz default now());
  create unique index token_unique on appointments(doctor_id,branch_id,date,coalesce(data->>'startTime',''),token_number);
  create unique index active_patient_unique on appointments(patient_id,doctor_id,branch_id,date,coalesce(data->>'startTime','')) where status not in ('cancelled','completed','noShow');
  create unique index current_unique on appointments(doctor_id,branch_id,date,coalesce(data->>'startTime','')) where status in ('called','inConsultation');
  create unique index request_unique on appointments(actor_id,request_id);
  create table appointment_history(id text primary key,appointment_id text,actor_id text,from_status text,to_status text,created_at timestamptz default now());
  create table audit_logs(id text primary key,actor_id text,clinic_id text,branch_id text,action text,entity_type text,entity_id text,summary text,created_at timestamptz default now());
  create table settings(id text primary key,data jsonb not null default '{}');
  create table masters(id text primary key,category text,code text,parent_id text,status text default 'active',data jsonb not null default '{}');
  create table qrs(id text primary key,clinic_id text,branch_id text,doctor_id text,public_reference text,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table guest_requests(id text primary key,request_id text not null unique,receipt_hash text not null unique,input_hash text not null,clinic_id text,branch_id text,doctor_id text,date text,status text default 'pending',appointment_id text unique,decided_by text,data jsonb not null default '{}',created_at timestamptz default now());
`;

export async function seedQueueFixtures(api, t, database) {
  await database.exec("truncate users,auth_sessions,clinics,branches,doctors,assignments,patients,schedules,availability_exceptions,appointments,appointment_history,audit_logs,settings,masters,qrs,guest_requests");
  await api.put(t.users, { id: "du", email: "d@example.com", fullName: "Doctor", role: "doctor" });
  await api.put(t.users, { id: "du2", email: "d2@example.com", fullName: "Doctor Two", role: "doctor" });
  await api.put(t.users, { id: "admin", email: "admin@example.com", fullName: "Admin", role: "clinicAdmin" });
  await api.put(t.clinics, { id: "c", adminId: "admin", data: { name: "Clinic" } });
  for (const id of ["b", "b2"]) await api.put(t.branches, { id, clinicId: "c", data: { name: id, timezone: "UTC" } });
  for (const [id, userId, branchId] of [["d", "du", "b"], ["d2", "du2", "b2"]]) {
    await api.put(t.doctors, { id, userId, ownerAdminId: "admin" });
    await api.put(t.assignments, { id, userId, clinicId: "c", branchId });
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) await api.put(t.schedules, { id: id + dayOfWeek, doctorId: id, clinicId: "c", branchId, dayOfWeek,
      data: { isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "UTC", consultationMinutes: 10, bufferMinutes: 5, maxTokens: 10, tokenPrefix: id === "d" ? "A" : "B" } });
  }
  for (let i = 1; i <= 4; i++) await api.put(t.patients, { id: "p" + i, userId: "u" + i, clinicId: "c", branchId: "b", data: { fullName: "Patient " + i }, mobile: "+1555555000" + i });
  await api.put(t.settings, { id: "platform", data: { cancellationCutoffMinutes: 0, bookingHorizonDays: 60 } });
}