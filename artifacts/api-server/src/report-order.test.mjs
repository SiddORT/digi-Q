import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const dir = await mkdtemp(join(tmpdir(), "report-sort-"));
await build({
  stdin: { contents: 'export * from "./lib/report-order"; export {metricSql} from "./lib/list-query";', resolveDir: import.meta.dirname },
  outfile: join(dir, "sort.mjs"), bundle: true, platform: "node", format: "esm",
  plugins: [{ name: "isolated-db", setup(b) {
    b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
    b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ contents: 'export const db={};' + ["users","doctors","assignments","branches","clinics","settings","auditLogs"].map(name=>`export const ${name}="${name}";`).join("") }));
  } }],
});
const { reportOrder, reportListControls, metricSql } = await import(join(dir, "sort.mjs"));
const database = new PGlite(), dialect = new PgDialect();
after(async()=>{await database.close();await rm(dir,{recursive:true,force:true});});
await database.exec("create table visits(doc jsonb)");
// A has no terminal outcomes, B has a cancellation, C has a no-show.
// Called/inConsultation/legacy statuses must remain in residual Other.
for (const [key, statuses] of [["a",["completed","called","inConsultation","legacy"]],["b",["completed","cancelled","booked"]],["c",["noShow","waiting"]],["d",["completed","called","inConsultation","legacy"]]]) {
  for (const status of statuses) await database.query("insert into visits values ($1)", [JSON.stringify({status,clinicId:key,doctorId:key,date:key,branchId:"visible",sessionId:"selected"})]);
}
await database.query("insert into visits values ($1)", [JSON.stringify({status:"cancelled",clinicId:"a",doctorId:"a",date:"a",branchId:"hidden",sessionId:"different"})]);
async function rows(groupBy, sort, page=1, search="") {
  const statement=sql`with grouped as (
    select doc->>${groupBy} as key, ${metricSql} from visits
    where doc->>'branchId'='visible' and doc->>'sessionId'='selected'
    group by 1
  ) select * from grouped where key like ${`%${search}%`}
    order by ${reportOrder(sort)} limit 2 offset ${(page-1)*2}`;
  const compiled=dialect.sqlToQuery(statement);
  return (await database.query(compiled.sql,compiled.params)).rows;
}
test("Other sorts residual displayed counts in both directions, after filters and grouping",async()=>{
  for(const group of ["clinicId","doctorId","date"]){
    assert.deepEqual((await rows(group,"other")).map(r=>r.key),["b","c"]);
    assert.deepEqual((await rows(group,"other",2)).map(r=>r.key),["a","d"]);
    const descending=await rows(group,"-other");
    assert.deepEqual(descending.map(r=>r.key),["a","d"]);
    assert.equal(descending[0].appointments-descending[0].completed-descending[0].cancelled-descending[0].noShow,3);
    assert.deepEqual((await rows(group,"-other",1,"b")).map(r=>r.key),["b"]);
  }
});
test("composite Outcomes uses displayed cancelled, no-show, Other tuple with stable group-key ties",async()=>{
  assert.deepEqual((await rows("date","outcomes")).map(r=>r.key),["a","d"]);
  assert.deepEqual((await rows("date","outcomes",2)).map(r=>r.key),["c","b"]);
  assert.deepEqual((await rows("date","-outcomes")).map(r=>r.key),["b","c"]);
  assert.deepEqual((await rows("date","-outcomes",2)).map(r=>r.key),["a","d"]);
});
test("sort validation rejects unknown fields and injection; existing field sorting remains",async()=>{
  for(const sort of ["city","--other","other desc; drop table visits"])assert.equal(reportListControls.safeParse({sort}).success,false);
  assert.deepEqual((await rows("date","-appointments")).map(r=>r.key),["a","d"]);
});
test("route orders grouped filtered results on the server without changing authorization",()=>{
  const source=readFileSync(new URL("./routes/reporting.ts",import.meta.url),"utf8");
  assert.match(source,/await authorizeReportContext\(user, q\)/);
  assert.match(source,/sourceSql\(user, "appointments"\)/);
  assert.match(source,/filtered_results order by \$\{order\} limit/);
  assert.match(source,/roles\(user, \["superAdmin", "clinicAdmin", "doctor", "receptionist"\]\)/);
});
test("network sorting uses its narrow contract without altering catalog scope",()=>{
  const source=readFileSync(new URL("./routes/resources.ts",import.meta.url),"utf8");
  assert.match(source,/sort: q.sort \|\| "name"/);
  assert.match(source,/Doctors may request receptionist assignment options only/);
  assert.match(source,/assignmentCatalogPredicate\("clinics", managingAdminId, retained\)/);
  assert.match(source,/assignmentCatalogPredicate\("branches", managingAdminId, retained\)/);
});