// Real PostgreSQL execution in isolated WASM memory. Never connects to application data.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = await mkdtemp(join(tmpdir(), "clinicflow-sql-"));
await build({
  entryPoints: [join(import.meta.dirname, "lib/list-query.ts")], outfile: join(dir, "query.mjs"),
  bundle: true, platform: "node", format: "esm",
  plugins: [{ name: "no-application-database", setup(b) {
    b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
    b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ contents: "export const db = {execute: (...args) => globalThis.fixtureExecute(...args)};" + ["users","doctors","assignments","branches","clinics","settings","auditLogs"].map(t=>`export const ${t}="${t}";`).join("") }));
  } }],
});
const { queryPage, queryMetrics, assignmentCatalogPredicate, sourceSql } = await import(join(dir, "query.mjs"));
await build({
  stdin: { contents: 'export {canRead} from "./auth";', resolveDir: join(import.meta.dirname, "lib") },
  outfile: join(dir, "legacy-scope.mjs"), bundle: true, platform: "node", format: "esm",
  plugins: [{ name: "scope-only-fixtures", setup(b) {
    b.onResolve({ filter: /^@workspace\/db$|\/store$/ }, a => ({ path: a.path, namespace: "scope-fixture" }));
    b.onLoad({ filter: /.*/, namespace: "scope-fixture" }, a => {
      if (a.path.endsWith("/store")) return { contents: "export const all=async t=>globalThis.scopeFixtures[t]||[]; export const one=async(t,id)=>(await all(t)).find(r=>r.id===id); export const flatten=r=>r; export const uid=()=>'';" };
      return { contents: "export const db={};" + ["users","doctors","patients","assignments","branches","clinics","appointments","staffSessionProofs","settings"].map(t=>`export const ${t}="${t}";`).join("") };
    });
  } }],
});
const { canRead } = await import(join(dir, "legacy-scope.mjs"));
const database = new PGlite(), dialect = new PgDialect();
const executed = [];
const conn = { execute: async statement => {
  const compiled = dialect.sqlToQuery(statement);
  executed.push(compiled.sql);
  return database.query(compiled.sql, compiled.params);
} };
globalThis.fixtureExecute = conn.execute;
await database.exec(`
  create table users(id text primary key, clerk_id text, password_hash text, full_name text, email text, mobile text, role text, managing_admin_id text, invitation_status text default 'failed', status text default 'active', data jsonb default '{}', created_at timestamptz default now());
  create table clinics(id text primary key, admin_id text, owner_id text, status text default 'active', data jsonb, created_at timestamptz default now());
  create table branches(id text primary key, clinic_id text, status text default 'active', data jsonb, created_at timestamptz default now());
  create table assignments(id text, user_id text, clinic_id text, branch_id text);
  create table doctors(id text primary key, user_id text, owner_admin_id text, specialization_id text, status text default 'active', data jsonb default '{}', created_at timestamptz default now());
  create table masters(id text primary key, category text, code text, status text, data jsonb);
  create table patients(id text primary key, user_id text, clinic_id text, branch_id text, mobile text, status text default 'active', data jsonb, created_at timestamptz default '2030-01-05');
  create table appointments(id text primary key, patient_id text, doctor_id text, clinic_id text, branch_id text, date text, token_number int, status text, data jsonb, created_at timestamptz default '2030-01-05');
  create table audit_logs(id text, actor_id text, clinic_id text, branch_id text, action text, entity_type text, entity_id text, summary text, created_at timestamptz default now());
  create table schedules(id text, doctor_id text, clinic_id text, branch_id text, day_of_week int, status text default 'active', data jsonb default '{}');
  create table availability_exceptions(id text, doctor_id text, branch_id text, date text, status text default 'active', data jsonb default '{}');
  create table qrs(id text, doctor_id text, clinic_id text, branch_id text, public_reference text, status text default 'active', data jsonb default '{}', created_at timestamptz default now());
  insert into users(id,full_name,email,role) values ('admin1','Admin One','admin1@test.invalid','clinicAdmin'),('admin2','Admin Two','admin2@test.invalid','clinicAdmin');
  insert into clinics select 'c'||n,case when n<=60 then 'admin1' else 'admin2' end,null,'active',jsonb_build_object('name','Clinic '||lpad(n::text,3,'0'),'city','Pune'),now() from generate_series(1,120) n;
  insert into branches select 'b'||n,'c'||n,'active',jsonb_build_object('name','Branch '||n),now() from generate_series(1,120) n;
  insert into users(id,full_name,email,role) select 'u'||n,'Doctor '||lpad(n::text,3,'0'),'doctor'||n||'@test.invalid','doctor' from generate_series(1,120) n;
  insert into doctors(id,user_id,owner_admin_id) select 'd'||n,'u'||n,case when n<=60 then 'admin1' else 'admin2' end from generate_series(1,120) n;
  insert into users(id,full_name,email,role,managing_admin_id) select 'r'||n,'Receptionist '||lpad(n::text,3,'0'),'reception'||n||'@test.invalid','receptionist',case when n<=60 then 'admin1' else 'admin2' end from generate_series(1,120) n;
  insert into assignments select 'ad'||n,'u'||n,'c'||n,'b'||n from generate_series(1,120) n;
  insert into assignments select 'ar'||n,'r'||n,'c'||n,'b'||n from generate_series(1,120) n;
  insert into patients select 'p'||n,null,'c'||(1+(n-1)%120),'b'||(1+(n-1)%120),'+919000'||n,'active',jsonb_build_object('fullName','Patient '||n), '2030-01-05' from generate_series(1,600) n;
  insert into appointments select 'a'||n,'p'||n,'d'||(1+(n-1)%120),'c'||(1+(n-1)%120),'b'||(1+(n-1)%120),'2030-01-05',n,case when n%2=0 then 'completed' else 'waiting' end,jsonb_build_object('patientName','Patient '||n,'doctorName','Doctor '||(1+(n-1)%120),'token','T-'||n), '2030-01-05' from generate_series(1,600) n;
  insert into audit_logs values ('audit1','admin1','c1','b1','verifyStaffPassword','users','admin1','security event',now()),('audit2','admin1','c1','b1','book','appointments','a1','book appointment',now());
  insert into schedules select 's'||n,'d'||n,'c'||n,'b'||n,n%7,'active','{}' from generate_series(1,120) n;
  insert into availability_exceptions select 'e'||n,'d'||n,'b'||n,'2030-01-05','active','{}' from generate_series(1,120) n;
  insert into qrs select 'q'||n,'d'||n,'c'||n,'b'||n,'ref'||n,'active',jsonb_build_object('name','QR '||n),now() from generate_series(1,120) n;
`);
const admin = { id: "admin1", role: "clinicAdmin", clinicIds: Array.from({ length: 60 }, (_, n) => `c${n+1}`), branchIds: [] };
const doctor = { id: "u1", role: "doctor", doctorId: "d1", managingAdminId: "admin1", clinicIds: ["c1"], branchIds: ["b1"] };
after(async () => { delete globalThis.fixtureExecute; delete globalThis.scopeFixtures; await database.close(); await rm(dir, { recursive: true, force: true }); });

test("booking patient lookup matches authorized visit location as well as registration without widening read scope", async () => {
  await database.exec(`
    insert into patients(id,clinic_id,branch_id,status,data) values
      ('diag-visit','c61','b61','active','{"fullName":"Diagnostic Deepa visit"}'),
      ('diag-registration','c1','b1','active','{"fullName":"Diagnostic Deepa registration"}'),
      ('diag-other-doctor','c61','b61','active','{"fullName":"Diagnostic Deepa other doctor"}'),
      ('diag-other-branch','c61','b61','active','{"fullName":"Diagnostic Deepa other branch"}'),
      ('diag-unrelated','c61','b61','active','{"fullName":"Diagnostic Deepa unrelated"}'),
      ('diag-inactive','c61','b61','inactive','{"fullName":"Diagnostic Deepa inactive"}'),
      ('diag-global',null,null,'active','{"fullName":"Diagnostic Deepa global"}'),
      ('diag-no-branch','c1',null,'active','{"fullName":"Diagnostic Deepa no branch"}');
    insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,status,data) values
      ('diag-ap-visit','diag-visit','d1','c1','b1','2030-01-05','completed','{}'),
      ('diag-ap-doctor','diag-other-doctor','d2','c1','b1','2030-01-05','completed','{}'),
      ('diag-ap-branch','diag-other-branch','d1','c1','b2','2030-01-05','completed','{}'),
      ('diag-ap-inactive','diag-inactive','d1','c1','b1','2030-01-05','completed','{}');
  `);
  try {
    const receptionist={id:"r1",role:"receptionist",clinicIds:["c1"],branchIds:["b1"]};
    const q={search:"Diagnostic Deepa",clinicId:"c1",branchId:"b1",status:"active",sort:"fullName",pageSize:100};
    const ids=async(actor,params=q)=>(await queryPage(actor,"patients",params,undefined,conn)).items.map(row=>row.id).sort();
    assert.deepEqual(await ids(admin),["diag-other-doctor","diag-registration","diag-visit"]);
    assert.deepEqual(await ids(receptionist),["diag-other-doctor","diag-registration","diag-visit"]);
    assert.deepEqual(await ids(doctor),["diag-visit"]);
    assert.deepEqual(await ids({...receptionist,clinicIds:[],branchIds:[]}),[]);
    assert.deepEqual(await ids({...doctor,clinicIds:[],branchIds:[]}),[]);
    // Patient self-service retains its existing profile filter contract, not staff lookup behavior.
    assert.deepEqual(await ids({id:"patient",role:"patient",patientId:"diag-visit",clinicIds:[],branchIds:[]}),[]);
    assert.deepEqual(await ids({id:"patient",role:"patient",patientId:"diag-visit",clinicIds:[],branchIds:[]},{...q,clinicId:undefined,branchId:undefined}),["diag-visit"]);
    assert.deepEqual(await ids({id:"patient",role:"patient",patientId:"diag-unrelated",clinicIds:[],branchIds:[]}),[]);
    assert.deepEqual(await ids(doctor,{...q,status:undefined}),["diag-inactive","diag-visit"]);
    assert.deepEqual(await ids(admin,{...q,branchId:undefined}),["diag-no-branch","diag-other-branch","diag-other-doctor","diag-registration","diag-visit"]);
    const paged=await queryPage(admin,"patients",{...q,pageSize:1,page:2},undefined,conn);
    assert.equal(paged.total,3);assert.equal(paged.items.length,1);
    assert.deepEqual(await ids(receptionist,{...q,clinicId:"c61",branchId:"b61"}),["diag-other-doctor","diag-visit"]);
  } finally {
    await database.exec("delete from appointments where id like 'diag-%'; delete from patients where id like 'diag-%';");
  }
});

test("address suggestions use exact active local-master category and search; empty responses are genuine", async () => {
  await database.exec(`
    insert into masters(id,category,code,status,data) values
      ('diag-city','city','diag-city','active','{"name":"Fixture Mumbai"}'),
      ('diag-city-inactive','city','diag-city-inactive','inactive','{"name":"Fixture Hidden"}'),
      ('diag-state','state','diag-state','active','{"name":"Fixture Maharashtra"}'),
      ('diag-country','country','diag-country','active','{"name":"Fixture India"}'),
      ('diag-area','area','diag-area','active','{"name":"Fixture Karanjade"}'),
      ('diag-pincode','pincode','diag-pincode','active','{"name":"Fixture 410206"}');
  `);
  try {
    for(const category of ["city","state","country","area","pincode"]){
      const result=await queryPage(doctor,"masters",{category,status:"active",search:"Fixture",pageSize:20},undefined,conn);
      assert.equal(result.total,1);
      assert.equal(result.items[0].category,category);
      assert.equal(result.items[0].status,"active");
    }
    assert.equal((await queryPage(admin,"masters",{category:"city",status:"active",search:"Fixture Mumbai"},undefined,conn)).total,1);
    assert.equal((await queryPage(admin,"masters",{category:"city",status:"active",search:"Fixture Missing"},undefined,conn)).total,0);
    assert.equal((await queryPage(admin,"masters",{category:"qualification",status:"active"},undefined,conn)).total,0);
    assert.equal((await queryPage(admin,"masters",{category:"city",status:"active",search:"Hidden"},undefined,conn)).total,0);
  } finally {
    await database.exec("delete from masters where id like 'diag-%';");
  }
});

test("120-clinic scoped combined search/filter/sort, boundaries, empty page and accurate totals", async () => {
  const q = { search: "Clinic 0", city: "Pune", status: "active", sort: "name", page: 3, pageSize: 20 };
  const result = await queryPage(admin, "clinics", q, undefined, conn);
  assert.equal(result.total, 60); assert.equal(result.totalPages, 3);
  assert.equal(result.items.length, 20); assert.equal(result.items[0].id, "c41");
  const empty = await queryPage(admin, "clinics", { ...q, page: 4 }, undefined, conn);
  assert.equal(empty.total, 60); assert.deepEqual(empty.items, []);
  assert.equal((await queryPage(admin, "clinics", { search: "Clinic 100" }, undefined, conn)).total, 0);
});
test("120 doctors and receptionists retain role and management boundaries", async () => {
  const doctors = await queryPage(admin, "doctors", { sort: "fullName", pageSize: 10, page: 6 }, undefined, conn);
  assert.equal(doctors.total, 60); assert.equal(doctors.items[0].fullName, "Doctor 051");
  const staff = await queryPage(doctor, "users", { role: "receptionist", sort: "fullName", pageSize: 20, page: 3 }, undefined, conn);
  assert.equal(staff.total, 60); assert.equal(staff.items.length, 20);
  assert.ok(staff.items.every(r => r.managingAdminId === "admin1"));
  assert.equal((await queryPage(admin, "doctors", { clinicId: "c61" }, undefined, conn)).total, 0);
});
test("600 appointments/patients: clinic, branch, own doctor, status, date and patient isolation", async () => {
  const page = await queryPage(admin, "appointments", { status: "waiting", date: "2030-01-05", sort: "-tokenNumber", pageSize: 20, page: 2 }, undefined, conn);
  assert.equal(page.total, 150); assert.equal(page.items.length, 20);
  assert.ok(page.items.every(r => admin.clinicIds.includes(r.clinicId) && r.status === "waiting"));
  const own = await queryPage(doctor, "patients", { search: "Patient" }, undefined, conn);
  assert.equal(own.total, 5);
  assert.equal((await queryPage(doctor, "appointments", { branchId: "b2" }, undefined, conn)).total, 0);
  const patient = { id: "patientUser", role: "patient", patientId: "p500", clinicIds: [], branchIds: [] };
  assert.equal((await queryPage(patient, "appointments", {}, undefined, conn)).items[0].id, "a500");
  assert.equal((await queryPage(patient, "patients", {}, undefined, conn)).total, 1);
});
test("manual token lookup searches the token without leaking another tenant", async () => {
  await database.exec(`update appointments set data=data || jsonb_build_object('token','MANUAL-LOOKUP-01') where clinic_id='c1'`);
  const found = await queryPage(admin, "appointments", { search: "MANUAL-LOOKUP-01", pageSize: 20 }, undefined, conn);
  assert.ok(found.total > 0);
  assert.ok(found.items.every(row => row.clinicId === "c1"));
  assert.equal((await queryPage({ ...admin, id: "admin2", clinicIds: ["c61"] }, "appointments", { search: "MANUAL-LOOKUP-01" }, undefined, conn)).total, 0);
});
test("audit separation retains security records; dashboard aggregates scoped SQL counts", async () => {
  assert.equal((await queryPage(admin, "audit-logs", {}, undefined, conn)).total, 2);
  assert.equal((await queryPage(admin, "audit-logs", { activityType: "operational" }, undefined, conn)).items[0].id, "audit2");
  assert.equal((await queryPage(admin, "audit-logs", { activityType: "security" }, undefined, conn)).items[0].id, "audit1");
  const metrics = await queryMetrics(admin, { date: "2030-01-05" });
  assert.equal(metrics.appointments, 300); assert.equal(metrics.waiting, 150);
});
test("bound parameters resist SQL injection, bounded results and invalid pagination rejected", async () => {
  assert.equal((await queryPage(admin, "clinics", { search: "' OR true --" }, undefined, conn)).total, 0);
  await assert.rejects(queryPage(admin, "clinics", { pageSize: 1000 }, undefined, conn));
  await assert.rejects(queryPage(admin, "clinics", { sort: "name;drop table users" }, undefined, conn));
  assert.ok(executed.filter(q => q.includes("page_rows")).every(q => /limit \$\d+ offset \$\d+/.test(q) && q.includes("count(*)")));
});
test("actual SQL retains schedule weekday/name, exception date, QR search and registration date filters", async () => {
  const result = await queryPage(admin, "schedules", { dayOfWeek: 0, search: "Doctor", sort: "-createdAt" }, undefined, conn);
  assert.equal(result.total, 8);
  assert.ok(result.items.every(r=>r.dayOfWeek===0 && r.doctorName));
  assert.equal((await queryPage(admin,"schedules",{weekday:0},undefined,conn)).total,8);
  assert.equal((await queryPage(admin,"availability-exceptions",{date:"2030-01-05",search:"Doctor 001"},undefined,conn)).total,1);
  assert.equal((await queryPage(admin,"qrs",{search:"QR 50",sort:"name"},undefined,conn)).total,1);
  assert.equal((await queryPage(admin,"patients",{from:"2030-01-06"},undefined,conn)).total,0);
});
test("native password enrollment filter is role-specific and branch doctor lookups resolve assignments", async () => {
  await database.exec("update users set password_hash='$argon2id$fixture-only', data=jsonb_build_object('passwordHash','must-not-appear','tokenHash','also-private') where id='r1'");
  assert.equal((await queryPage(admin,"users",{role:"receptionist",linkedOnly:true},undefined,conn)).total,1);
  assert.equal((await queryPage(admin,"users",{role:"doctor",linkedOnly:true},undefined,conn)).total,0);
  const enrolled = (await queryPage(admin,"users",{role:"receptionist",linkedOnly:true},undefined,conn)).items[0];
  assert.equal(enrolled.passwordEnabled, true);
  assert.equal(enrolled.invitationStatus, "notRequired");
  for (const secret of ["passwordHash", "password_hash", "tokenHash", "clerkId"]) assert.equal(secret in enrolled, false, `${secret} must not be serialized`);
  assert.doesNotMatch(JSON.stringify(enrolled), /argon2id|must-not-appear|also-private/);
  assert.deepEqual((await queryPage(admin,"branches",{doctorId:"d1"},undefined,conn)).items.map(r=>r.id),["b1"]);
  assert.equal((await queryPage(admin,"branches",{doctorId:"d61"},undefined,conn)).total,0);
  assert.equal((await queryPage({role:"superAdmin"},"branches",{doctorId:"d1",selectedIds:"b2"},undefined,conn)).total,0);
});
test("selected assignment hydration includes only retained inactive assignments within the managing owner", async () => {
  await database.exec(`insert into clinics(id,admin_id,status,data) values ('retained','admin1','inactive','{"name":"Retained"}'),('not-retained','admin1','inactive','{"name":"Not retained"}'),('foreign-retained','admin2','inactive','{"name":"Foreign"}');
    insert into branches(id,clinic_id,status,data) values ('retained-b','retained','inactive','{"name":"Retained branch"}');
    insert into assignments values ('retain1','r1','retained','retained-b'),('retain2','r1','foreign-retained',null)`);
  const q={selectedIds:"retained,not-retained,foreign-retained"};
  assert.equal((await queryPage({role:"superAdmin"},"clinics",q,assignmentCatalogPredicate("clinics","admin1"),conn)).total,0);
  const retained=await queryPage({role:"superAdmin"},"clinics",q,assignmentCatalogPredicate("clinics","admin1","r1"),conn);
  assert.deepEqual(retained.items.map(r=>r.id),["retained"]);
  assert.equal((await queryPage({role:"superAdmin"},"branches",{selectedIds:"retained-b"},assignmentCatalogPredicate("branches","admin1","r1"),conn)).total,1);
  assert.equal((await queryPage({role:"superAdmin"},"clinics",{...q,status:"active"},undefined,conn)).total,0);
});
test("actual SQL authorization equals prior canRead across all roles and resource families", async () => {
  // Include a legacy inconsistent foreign-managed receptionist sharing a branch:
  // ownership must still take precedence over the shared assignment.
  await database.exec("insert into assignments values ('legacy-foreign','r61','c1','b1')");
  const fixture={};
  for (const kind of ["users","doctors","clinics","branches","patients","appointments","schedules","availability-exceptions","qrs","masters"]) {
    fixture[kind]=(await conn.execute(sourceSql({role:"superAdmin"},kind))).rows.map(r=>r.doc);
  }
  fixture.assignments=(await database.query('select id,user_id as "userId",clinic_id as "clinicId",branch_id as "branchId" from assignments')).rows;
  globalThis.scopeFixtures=fixture;
  const actors=[{id:"super",role:"superAdmin",clinicIds:[],branchIds:[]},admin,doctor,{...doctor,id:"r1",role:"receptionist",doctorId:null},{id:"patient",role:"patient",patientId:"p1",clinicIds:[],branchIds:[]},{...doctor,clinicIds:[],branchIds:[]}];
  for(const actor of actors) for(const kind of ["users","doctors","clinics","branches","patients","appointments","schedules","availability-exceptions","qrs","masters"]) {
    const expected=[];
    for(const row of fixture[kind]) if(await canRead(actor,kind,row)) expected.push(row.id);
    const actual=(await conn.execute(sourceSql(actor,kind))).rows.map(r=>r.doc.id);
    assert.deepEqual(actual.sort(),expected.sort(),`${actor.role}/${kind}/${actor.clinicIds.length}`);
  }
});