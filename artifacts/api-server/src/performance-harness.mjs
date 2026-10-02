// Run directly, not in the full test suite. Private socket PostgreSQL only.
// --baseline replays the pre-optimization GET enrichment and assignment SQL.
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cpus, totalmem, platform, arch } from "node:os";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/node-postgres";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const baseline = process.argv.includes("--baseline");
const samples = Number(process.env.PERFORMANCE_SAMPLES || 30);
assert.ok(Number.isInteger(samples) && samples >= 5 && samples <= 200);
const root = import.meta.dirname, context = new AsyncLocalStorage();
const bundle = join(root, `.performance-${process.pid}.mjs`);
const harness = await createQueueHarness({ empty: true });
let statements = [], statementParams = [];
const db = drizzle(harness.control, { logger: { logQuery(query,params) { statements.push(query); statementParams.push(params); } } });
globalThis.performanceFixture = { db, context };
try {
  await harness.control.query(queueFixtureSql);
  await harness.control.query(`
    insert into users(id,email,full_name,role) values
      ('admin1','admin1@test.invalid','Admin One','clinicAdmin'),
      ('admin2','admin2@test.invalid','Admin Two','clinicAdmin');
    insert into clinics(id,admin_id,data) select 'c'||n,case when n<=100 then 'admin1' else 'admin2' end,
      jsonb_build_object('name','Clinic '||lpad(n::text,3,'0'),'dateFormat',case when n%2=0 then 'YYYY-MM-DD' else 'DD/MM/YYYY' end,'timeFormat',case when n%2=0 then '24h' else '12h' end)
      from generate_series(1,200) n;
    insert into branches(id,clinic_id,data) select 'b'||n,'c'||n,jsonb_build_object('name','Branch '||lpad(n::text,3,'0'),'timezone','UTC') from generate_series(1,200) n;
    insert into users(id,email,full_name,role) select 'u'||n,'doctor'||n||'@test.invalid','Doctor '||lpad(n::text,3,'0'),'doctor' from generate_series(1,400) n;
    insert into doctors(id,user_id,owner_admin_id) select 'd'||n,'u'||n,case when n<=200 then 'admin1' else 'admin2' end from generate_series(1,400) n;
    insert into users(id,email,full_name,role,managing_admin_id,password_hash) select 'r'||n,'staff'||n||'@test.invalid','Staff '||lpad(n::text,3,'0'),'receptionist',case when n<=100 then 'admin1' else 'admin2' end,case when n%2=0 then 'fixture-not-a-real-credential' else null end from generate_series(1,200) n;
    insert into assignments(id,user_id,clinic_id,branch_id) select 'ad'||n,'u'||n,'c'||(1+(n-1)/2),'b'||(1+(n-1)/2) from generate_series(1,400) n;
    insert into assignments(id,user_id,clinic_id,branch_id) select 'ar'||n,'r'||n,'c'||n,'b'||n from generate_series(1,200) n;
    insert into patients(id,clinic_id,branch_id,mobile,data) select 'p'||n,'c1','b1','fixture',jsonb_build_object('fullName','Patient '||n) from generate_series(1,10000) n;
    insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,data)
      select 'a'||n,'p'||n,case when n<=1000 then 'd1' else 'd201' end,case when n<=1000 then 'c1' else 'c101' end,case when n<=1000 then 'b1' else 'b101' end,
        '2030-01-05',n,case when n=1 then 'called' when n%5=0 then 'completed' else 'waiting' end,
        jsonb_build_object('patientName','Patient '||n,'patientCode','P-'||n,'token','T-'||n,'startTime','09:00','queueRank',10001-n,'consultationMinutes',10,'bufferMinutes',5,'timezone','UTC')
      from generate_series(1,10000) n;
    insert into settings(id,data) values ('platform','{}');
    create unique index assignment_user_clinic_only_unique on assignments(user_id,clinic_id) where branch_id is null;
    create unique index assignment_user_branch_unique on assignments(user_id,branch_id) where branch_id is not null;
    analyze;
  `);
  await build({
    stdin: { contents: `export { resourcesRouter } from "./routes/resources"; export {queueRouter} from "./routes/queue"; export {projectAssignmentScope} from "./lib/auth"; export {queryPage} from "./lib/list-query";`, resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "private-performance-database", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "fixture" }));
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: resolve(root, "../../../lib/api-zod/src/index.ts") }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db = new Proxy({}, {get:(_,key) => {
          const h=globalThis.performanceFixture, conn=h.context.getStore()?.db || h.db, value=conn[key];
          return typeof value === "function" ? value.bind(conn) : value;
        }});`, resolveDir: root }));
      b.onLoad({ filter: /lib\/auth\.ts$/ }, async a => ({ contents: (await readFile(a.path,"utf8")).replace(
        /export async function requireUser\(req: Request\) \{[\s\S]*?\n\}/,
        "export async function requireUser(req: Request) { return globalThis.performanceFixture.context.getStore().actor; }"), loader: "ts" }));
      if (baseline) b.onLoad({filter:/lib\/list-query\.ts$/},async a=>{
        const source=await readFile(a.path,"utf8");
        assert.ok(source.includes("cross join lateral"),"baseline assignment replay must match optimized source");
        // Exact pre-optimization sourceSql. documentSql's default remains the
        // original per-field aggregate; the #61 filter fix remains in BOTH runs.
        const original=`export function sourceSql(user: any, kind: string, extra: SQL = raw("true")) {
  assert(names[kind], 400, "Unsupported resource");
  let document = documentSql(kind);
  if (["users", "doctors"].includes(kind) && user.role !== "superAdmin") {
    const own = kind === "users" ? sql\`r.id=\${user.id}\` : sql\`r.id=\${user.doctorId || ""}\`;
    const peer = kind === "users" ? sql\`r.role='receptionist' and \${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=\${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}\` : raw("false");
    document = sql\`\${document} || case when (\${own} or (\${peer})) then '{}'::jsonb else jsonb_build_object(
      'clinicIds',coalesce((select jsonb_agg(distinct l.clinic_id) from (\${links(kind)}) l where \${inList(raw("l.clinic_id"), user.clinicIds)}),'[]'::jsonb),
      'branchIds',coalesce((select jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null) from (\${links(kind)}) l where \${operationalScope(user, raw("l.clinic_id"), raw("l.branch_id"))}),'[]'::jsonb)) end\`;
  }
  return sql\`select \${document} as doc from \${raw(names[kind])} r where (\${readScope(user, kind)}) and (\${extra})\`;
}`;
        return {contents:source.replace(/export function sourceSql\([\s\S]*?\n\}/,()=>original),loader:"ts"};
      });
      if (baseline) b.onLoad({ filter: /routes\/resources\.ts$/ }, async a => {
        let source = await readFile(a.path, "utf8");
        const optimized = `      const parentIds = [...new Set(result.items.map((row: any) => row.clinicId))] as string[];
      const parentRows = parentIds.length ? (await db.execute(sql\`select id, data from clinics where id in (\${sql.join(parentIds.map(id => sql\`\${id}\`), sql\`,\`)})\`)).rows : [];
      const parents = new Map(parentRows.map((row: any) => [row.id, { ...row.data, ...row }]));
      for (const row of result.items) {
        assert(parents.has(row.clinicId), 404, "Record not found");`;
        assert.ok(source.includes(optimized), "baseline branch replay must match exact optimized block");
        source = source.replace(optimized, `      const parents = new Map<string, any>();
      for (const row of result.items) {
        if (!parents.has(row.clinicId)) parents.set(row.clinicId, await one(clinics, row.clinicId));`);
        const comment = `      // queryPage already projects passwordEnabled from the credential column;
      // re-reading each user's credential would add one query per listed staff.`;
        assert.ok(source.includes(comment), "baseline staff replay must match exact optimized block");
        return { contents: source.replace(comment, "      result.items = await Promise.all(result.items.map((row: any) => withPasswordState(row)));"), loader: "ts" };
      });
    } }],
  });
  const api = await import(bundle);
  const admin = { id:"admin1",role:"clinicAdmin",clinicIds:Array.from({length:100},(_,n)=>`c${n+1}`),branchIds:[] };
  async function route(router, path, actor, query) {
    const layer = router.stack.find(l=>l.route?.path===path && l.route.methods.get);
    assert.ok(layer,path);
    let value;
    await context.run({actor},()=>layer.route.stack[0].handle({query},{json: result=>{value=result;}}));
    return value;
  }
  const results = [];
  async function measure(name, operation, check, expectedCount) {
    const times = [], counts = [], sqlSet = new Set();
    let cold;
    for (let i=0;i<=samples;i++) {
      statements = []; statementParams = [];
      const start = performance.now(), value = await operation(), elapsed = performance.now()-start;
      if (i===0) cold = { ms:elapsed,queries:statements.length };
      else { times.push(elapsed); counts.push(statements.length); }
      for (const statement of statements) sqlSet.add(statement);
      assert.ok(statements.every(statement=>!/^\s*(insert|update|delete|truncate)\b/i.test(statement)),`${name}: GET must not write`);
      assert.equal(statements.length,expectedCount,`${name}: fixed query budget`);
      check(value);
    }
    times.sort((a,b)=>a-b);
    const quantile=p=>times[Math.ceil(times.length*p)-1];
    let plan;
    if (["doctors-20","staff-20","branches-20"].includes(name)) {
      const explained=await harness.control.query("explain (analyze,buffers,format json) "+statements[0],statementParams[0]);
      const p=explained.rows[0]["QUERY PLAN"][0], scans=[];
      function walk(node) {
        if (node["Relation Name"]) scans.push({type:node["Node Type"],relation:node["Relation Name"],rows:node["Actual Rows"],loops:node["Actual Loops"]});
        for (const child of node.Plans||[]) walk(child);
      }
      walk(p.Plan);
      plan={planningMs:p["Planning Time"],executionMs:p["Execution Time"],sharedHits:p.Plan["Shared Hit Blocks"],sharedReads:p.Plan["Shared Read Blocks"],scans};
    }
    results.push({name,cold,warm:{samples,medianMs:quantile(.5),p95Ms:quantile(.95),minMs:times[0],maxMs:times.at(-1),queries:[...new Set(counts)]},statementShapes:sqlSet.size,...(plan?{plan}:{})});
  }
  for (const size of [1,20,100]) await measure(`doctors-${size}`,
    ()=>route(api.resourcesRouter,"/doctors",admin,{sort:"fullName",pageSize:String(size)}),
    value=>{
      assert.equal(value.total,200); assert.equal(value.items.length,size);
      assert.deepEqual(value.items.map(r=>r.id),Array.from({length:size},(_,n)=>`d${n+1}`));
      assert.ok(value.items.every(r=>r.clinicIds.every(id=>admin.clinicIds.includes(id)) && r.clinicNames.length && r.branchNames.length && r.passwordEnabled===false));
    },3);
  for (const size of [20,100]) {
    await measure(`staff-${size}`,
      ()=>route(api.resourcesRouter,"/users",admin,{role:"receptionist",sort:"fullName",pageSize:String(size)}),
      value=>{
        assert.equal(value.total,100); assert.equal(value.items.length,size);
        assert.ok(value.items.every(r=>r.managingAdminId==="admin1" && r.passwordEnabled===(Number(r.id.slice(1))%2===0)));
        assert.doesNotMatch(JSON.stringify(value),/fixture-not-a-real-credential|passwordHash|tokenHash/);
      },baseline ? 3+size : 3);
    await measure(`branches-${size}`,
      ()=>route(api.resourcesRouter,"/branches",admin,{sort:"name",pageSize:String(size)}),
      value=>{
        assert.equal(value.total,100); assert.equal(value.items.length,size);
        assert.ok(value.items.every(r=>admin.clinicIds.includes(r.clinicId) && r.dateFormat===(Number(r.id.slice(1))%2===0?"YYYY-MM-DD":"DD/MM/YYYY") && r.timeFormat===(Number(r.id.slice(1))%2===0?"24h":"12h")));
      },baseline ? 1+size : 2);
  }
  // Exact production queue GET: full session rows + existing lock/summaries.
  // Number of queue context queries is independent of displayed page size.
  const queueQuery={doctorId:"d1",branchId:"b1",date:"2030-01-05",startTime:"09:00",page:"1",pageSize:"20"};
  let firstQueue;
  const queueCount=20;
  for (const size of [20,100]) await measure(`queue-${size}`,
    ()=>route(api.queueRouter,"/queue",admin,{...queueQuery,pageSize:String(size)}),
    value=>{
      assert.equal(value.entriesTotal,1000); assert.equal(value.entries.length,size);
      assert.equal(value.statusCounts.all,1000); assert.equal(value.statusCounts.completed,200);
      assert.equal(value.currentToken,"T-1");
      assert.equal(value.nextToken,"T-999");
      firstQueue ||= value;
      assert.equal(value.queueVersion,firstQueue.queueVersion);
      assert.deepEqual(value.entries.map(r=>r.id),Array.from({length:size},(_,n)=>`a${1000-n}`));
      assert.ok(value.entries.every(r=>r.branchId==="b1" && r.doctorId==="d1"));
    },queueCount);
  const queueUnboundedCatalogReads=statements.filter(s=>/from "(users|doctors|assignments|branches|clinics)"/.test(s) && !/\bwhere\b/i.test(s)).map(s=>s.match(/from "([^"]+)"/)[1]);
  const initialQueue=JSON.stringify(firstQueue, (key,value)=>key==="updatedAt"?undefined:value);
  const repeated=await route(api.queueRouter,"/queue",admin,queueQuery);
  assert.equal(JSON.stringify(repeated,(key,value)=>key==="updatedAt"?undefined:value),initialQueue,"queue reads must not change version/current/next/summary/order");
  await assert.rejects(route(api.queueRouter,"/queue",{...admin,clinicIds:["c101"]},queueQuery),/outside assigned scope/);
  // #61: foreign registration plus local visits, unauthorized visit, own-doctor
  // restriction, and mismatched clinic/branch must not broaden patient scope.
  await harness.control.query(`
    update patients set clinic_id='c101',branch_id='b101' where id in ('p1','p2');
    update appointments set doctor_id='d2' where id='a2';
  `);
  const doctor={id:"u1",role:"doctor",doctorId:"d1",managingAdminId:"admin1",clinicIds:["c1"],branchIds:["b1"]};
  const patients=q=>api.queryPage(doctor,"patients",{...q,pageSize:100});
  assert.equal((await patients({clinicId:"c1",branchId:"b1",selectedIds:"p1"})).total,1,"own authorized visit discovers foreign registration");
  assert.equal((await patients({clinicId:"c1",branchId:"b1",selectedIds:"p2"})).total,0,"other doctor visit is not discoverable");
  assert.equal((await patients({clinicId:"c101",selectedIds:"p3"})).total,0,"own local visit cannot expose foreign location matches");
  assert.equal((await patients({clinicId:"c1",branchId:"b101",selectedIds:"p1"})).total,0,"dimensions must match same authorized visit");
  assert.equal((await api.queryPage(admin,"patients",{clinicId:"c1",branchId:"b1",selectedIds:"p1"})).total,1);
  // Existing scope projection is the oracle, including retained management-peer labels.
  for (const actor of [admin,{id:"super",role:"superAdmin",clinicIds:[],branchIds:[]},{id:"u1",role:"doctor",doctorId:"d1",managingAdminId:"admin1",clinicIds:["c1"],branchIds:["b1"]}]) {
    for (const kind of ["users","doctors"]) {
      const q=kind==="users"?{role:"receptionist",sort:"fullName",pageSize:"100"}:{sort:"fullName",pageSize:"100"};
      const value=await route(api.resourcesRouter,`/${kind}`,actor,q);
      for (const row of value.items) {
        const projected=await api.projectAssignmentScope(actor,kind,row);
        for (const key of ["clinicIds","branchIds","clinicNames","branchNames"]) assert.deepEqual(row[key],projected[key],`${actor.role}/${kind}/${key}`);
      }
    }
  }
  // No writes permitted in measured handlers.
  assert.ok(!results.some(r=>r.warm.queries.length!==1));
  const count=(await harness.control.query("select count(*)::int n from appointments")).rows[0].n;
  assert.equal(count,10000);
  console.log(JSON.stringify({
    mode:baseline?"baseline-replayed":"after",node:process.version,postgres:(await harness.control.query("select version() v")).rows[0].v,
    hardware:{platform:platform(),arch:arch(),cpuModel:cpus()[0]?.model,logicalCPUs:cpus().length,totalMemoryBytes:totalmem()},
    fixture:{clinics:200,branches:200,doctors:400,users:602,assignments:600,patients:10000,appointments:10000,selectedSession:1000,tenants:2},
    coldDefinition:"first invocation per scenario in one fresh process/cluster; earlier scenarios share warmed catalogs, no OS-cache eviction",
    queueUnboundedCatalogReads,results,assertions:"query budgets, tenant scopes, password/privacy, display inheritance, scope-label parity, queue current/next/version/summary/order stability, unauthorized queue rejected; #61 authorized visit/own-doctor/location-filter regression"
  },null,2));
} finally {
  delete globalThis.performanceFixture;
  await rm(bundle,{force:true});
  await harness.close();
}