import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = await mkdtemp(join(tmpdir(), "clinicflow-status-counts-"));
const database = new PGlite(), dialect = new PgDialect();
const conn = { execute: statement => {
  const compiled = dialect.sqlToQuery(statement);
  return database.query(compiled.sql, compiled.params);
} };
await database.exec(`
  create table appointments(id text primary key, patient_id text, doctor_id text, clinic_id text, branch_id text, date text, token_number integer default 1, status text, data jsonb default '{}', created_at timestamptz default now());
  insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,status,data) values
    ('a1','p1','d1','c1','b1','2030-01-01','waiting','{"patientName":"Search Person"}'),
    ('a2','p2','d1','c1','b1','2030-01-01','called','{"patientName":"Search Person"}'),
    ('a3','p3','d1','c1','b1','2030-01-01','noShow','{"patientName":"Search Person"}'),
    ('a4','p4','d1','c1','b1','2030-01-01','completed','{"patientName":"Search Person"}'),
    ('a5','p5','d1','c1','b1','2030-01-01','cancelled','{"patientName":"Search Person"}'),
    ('a6','p6','d1','c1','b1','2030-01-02','waiting','{"patientName":"Search Person"}'),
    ('a7','p7','d2','c2','b2','2030-01-01','completed','{"patientName":"Search Person"}'),
    ('a8','p8','d1','c1','b1','2030-01-01','waiting','{"patientName":"Other Person"}');
`);
await build({
  stdin: {contents:'export * from "./lib/list-query"; export * from "./lib/queue-list";',resolveDir:import.meta.dirname}, outfile: join(dir, "query.mjs"),
  bundle: true, platform: "node", format: "esm",
  plugins: [{ name: "isolated-db", setup(b) {
    b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const db = {};" + ["settings", "auditLogs", "clinics", "doctors", "users", "assignments", "branches"].map(name => `export const ${name}='${name}';`).join("") }));
  } }],
});
const { queryAppointmentPage, staffQueueList } = await import(join(dir, "query.mjs"));
const staff = { role: "receptionist", clinicIds: ["c1"], branchIds: ["b1"] };

test("appointment tabs count scoped matching rows before status and pagination", async () => {
  const q = { date: "2030-01-01", search: "Search Person", statusGroup: "waiting", page: 2, pageSize: 1 };
  const result = await queryAppointmentPage(staff, q, conn);
  assert.equal(result.total, 1);
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.statusCounts, { all: 5, active: 2, waiting: 1, absent: 1, completed: 1, cancelled: 1 });
  const byStatus = await queryAppointmentPage(staff, { ...q, statusGroup: "all", status: "completed" }, conn);
  assert.equal(byStatus.total, 1);
  assert.deepEqual(byStatus.statusCounts, result.statusCounts);
  const narrowed = await queryAppointmentPage(staff, { ...q, doctorId: "d2" }, conn);
  assert.deepEqual(narrowed.statusCounts, { all: 0, active: 0, waiting: 0, absent: 0, completed: 0, cancelled: 0 });
});

test("patient appointment results omit unfiltered status aggregates", async () => {
  const result = await queryAppointmentPage({ role: "patient", patientId: "p1" }, { status: "completed" }, conn);
  assert.equal(result.total, 0);
  assert.equal(Object.hasOwn(result, "statusCounts"), false);
});

// Exercise the actual GET handler with a selected session; queue tab counts must
// not inherit the status filter, alter the operational summary, or reach patients.
await build({
  entryPoints: [join(import.meta.dirname, "routes/queue.ts")], outfile: join(dir, "queue.mjs"),
  bundle: true, platform: "node", format: "esm",
  plugins: [{ name: "queue-fixtures", setup(b) {
    b.onResolve({ filter: /^express$|^@workspace\/db$|^@workspace\/api-zod$|^\.\.\/lib\/(auth|http|store|appointments|availability|session-duration|presence|queue-list)$/ }, a => ({ path: a.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, a => {
      const code = {
        express: `export const Router=()=>({stack:[],get(path,handle){this.stack.push({route:{path,stack:[{handle}]}})},post(){}});`,
        "@workspace/db": `export const appointments={doctorId:"doctor_id",branchId:"branch_id",date:"date"}; export const db={transaction:fn=>fn({execute:(...args)=>globalThis.queueFixture.execute(...args),select:()=>({from:()=>({where:async()=>globalThis.queueFixture.rows})})})};`,
        "@workspace/api-zod": "export const GetQueueQueryParams={}; export const GetSessionContextsQueryParams={}; export const CallNextBody={};",
        "../lib/auth": "export const requireUser=async()=>globalThis.queueFixture.user; export const scope=()=>true; export const roles=()=>{};",
        "../lib/http": "export const query=()=>globalThis.queueFixture.q; export const assert=(v,s,m)=>{if(!v) throw Error(m)}; export const parse=x=>x;",
        "../lib/store": "export const all=async()=>{throw Error('Queue GET must use scoped SQL')}; export const flatten=x=>x;",
        "../lib/appointments": "export const lockQueue=async()=>{}; export const appointmentView=x=>x; export const appointmentViewWithBranch=async x=>x; export const transition=async()=>{};",
        "../lib/availability": "export const doctorContext=async()=>({branch:{clinicId:'c1',id:'b1'}}); export const localNow=()=>({date:'2030-01-01'}); export const availability=async()=>({}); export const availabilitySessions=async()=>[];",
        "../lib/session-duration": "export const readDuration=async()=>null;",
        "../lib/presence": "export const getPresence=async()=>null;",
        "../lib/queue-list": "export const staffQueueList=(...args)=>globalThis.queueFixture.staffQueueList(...args);",
      };
      return { contents: code[a.path] };
    });
  } }],
});
const { queueRouter } = await import(join(dir, "queue.mjs"));
const queueGet = queueRouter.stack.find(layer => layer.route?.path === "/queue").route.stack[0].handle;
const queueRows = [
  { id: "a1", doctorId: "d1", branchId: "b1", date: "2030-01-01", startTime: "09:00", patientId: "p1", status: "waiting", token: "X-1", tokenNumber: 1, patientName: "Search Person" },
  { id: "a2", doctorId: "d1", branchId: "b1", date: "2030-01-01", startTime: "09:00", patientId: "p2", status: "called", token: "X-2", tokenNumber: 2, patientName: "Search Person" },
  { id: "a3", doctorId: "d1", branchId: "b1", date: "2030-01-01", startTime: "09:00", patientId: "p3", status: "noShow", token: "X-3", tokenNumber: 3, patientName: "Search Person" },
  { id: "a4", doctorId: "d1", branchId: "b1", date: "2030-01-01", startTime: "09:00", patientId: "p4", status: "completed", token: "X-4", tokenNumber: 4, patientName: "Other Person" },
];
async function getQueue(user, q) {
  await database.exec("delete from appointments");
  for (const r of queueRows) await database.query("insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,data) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",[r.id,r.patientId,r.doctorId,"c1",r.branchId,r.date,r.tokenNumber,r.status,JSON.stringify(r)]);
  globalThis.queueFixture = { user, q: { doctorId: "d1", branchId: "b1", date: "2030-01-01", startTime: "09:00", ...q }, rows: queueRows, execute:conn.execute, staffQueueList };
  let response;
  await queueGet({query:q}, { json: body => { response = body; } });
  return response;
}
test("staff queue tabs honor search but not status, with whole-session summary", async () => {
  const result = await getQueue({ role: "receptionist" }, { search: "Search", statusGroup: "waiting", page: 2, pageSize: 1 });
  assert.deepEqual(result.statusCounts, { all: 3, active: 2, waiting: 1, absent: 1, completed: 0, cancelled: 0 });
  assert.equal(result.entriesTotal, 1);
  assert.equal(result.filteredTotal, 1);
  assert.equal(result.entries.length, 0);
  assert.equal(result.total, 4);
  assert.equal(result.completed, 1);
  const byStatus = await getQueue({ role: "receptionist" }, { search: "Search", status: "called" });
  assert.deepEqual(byStatus.statusCounts, result.statusCounts);
});
test("patient queue response does not disclose status tabs", async () => {
  const result = await getQueue({ role: "patient", patientId: "p1" }, { search: "Other" });
  assert.equal(Object.hasOwn(result, "statusCounts"), false);
  assert.equal(Object.hasOwn(result, "entries"), false);
});
after(async () => { await database.close(); await rm(dir, { recursive: true, force: true }); });