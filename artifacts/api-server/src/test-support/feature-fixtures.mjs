// Fictional fixtures only (.test.invalid addresses). Two clinics owned by one admin, one foreign clinic.
export const TODAY = new Date().toISOString().slice(0, 10);
export const PAST = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
export const OLD = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
export async function seedFeatureFixtures(pg) {
  await pg.exec(`
    insert into users(id,email,full_name,role,status) values
      ('sa','sa@test.invalid','Super Admin','superAdmin','active'),
      ('adm','adm@test.invalid','Asha Admin','clinicAdmin','active'),
      ('adm2','adm2@test.invalid','Other Admin','clinicAdmin','active'),
      ('docu','docu@test.invalid','Dr Meera Rao','doctor','active'),
      ('doc3u','doc3u@test.invalid','Dr Foreign','doctor','active'),
      ('patu','patu@test.invalid','Ravi Kumar','patient','active'),
      ('pat3u','pat3u@test.invalid','Foreign Patient','patient','active');
    insert into users(id,email,full_name,role,status,managing_admin_id) values
      ('rec','rec@test.invalid','Rina Desk','receptionist','active','adm'),
      ('rec2','rec2@test.invalid','Rahul Desk','receptionist','active','adm'),
      ('rec3','rec3@test.invalid','Foreign Desk','receptionist','active','adm2');
    insert into clinics(id,admin_id,owner_id,data) values
      ('c1','adm','adm','{"name":"Lakeview Clinic","slug":"lakeview","timezone":"UTC"}'),
      ('c2','adm','adm','{"name":"Hillside Clinic","slug":"hillside","timezone":"UTC"}'),
      ('c3','adm2','adm2','{"name":"Foreign Clinic","slug":"foreign","timezone":"UTC"}');
    insert into branches(id,clinic_id,data) values
      ('b1','c1','{"name":"Lakeview Main","slug":"main"}'),('b2','c2','{"name":"Hillside Main","slug":"main"}'),('b3','c3','{"name":"Foreign Main","slug":"main"}');
    -- Clinic admin assignments are created by the 0006 ownership trigger.
    insert into assignments(id,user_id,clinic_id,branch_id) values
      ('as4','rec','c1','b1'),('as5','rec2','c1','b1'),('as6','rec3','c3','b3'),
      ('as7','docu','c1','b1'),('as8','docu','c2','b2'),('as9','doc3u','c3','b3')
      on conflict do nothing;
    insert into doctors(id,user_id,owner_admin_id) values ('d1','docu','adm'),('d3','doc3u','adm2');
    insert into patients(id,user_id,clinic_id,branch_id,mobile,data) values
      ('p1','patu','c1','b1','9000000001','{"fullName":"Ravi Kumar"}'),
      ('p3','pat3u','c3','b3','9000000003','{"fullName":"Foreign Patient"}');
    insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data) values
      ('a1','p1','d1','c1','b1','${TODAY}',7,'checkedIn','rec','{"reference":"REF-A1"}'),
      ('a2','p1','d1','c2','b2','${PAST}',3,'completed','adm','{"reference":"REF-A2"}'),
      ('a3','p3','d3','c3','b3','${TODAY}',7,'booked','rec3','{"reference":"REF-A3"}'),
      ('a4','p1','d1','c1','b1','${PAST}',4,'cancelled','rec','{"reference":"REF-A4"}'),
      ('a5','p1','d1','c1','b1','${OLD}',1,'completed','rec','{"reference":"REF-A5"}');
    insert into appointment_history(id,appointment_id,actor_id,from_status,to_status,created_at) values
      ('h1','a1','rec','booked','checkedIn',now() - interval '1 hour'),
      ('h2','a2','docu','inConsultation','completed',now() - interval '2 hours'),
      ('h3','a3','rec3',null,'booked',now() - interval '1 hour'),
      ('h4','a4','adm','booked','cancelled',now() - interval '3 hours'),
      ('h5','a5','rec','booked','completed',now() - interval '60 days');
    insert into audit_logs(id,actor_id,clinic_id,action,entity_type,entity_id,summary) values
      ('al1','adm2','c3','update','clinics','c3','Foreign clinic updated'),
      ('al2','rec','c1','update','branches','b1','Lakeview branch hours updated');`);
}
