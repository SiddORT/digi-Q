// Disposable exact-case browser target. Never connects to the workspace DB.
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import {createRequire} from "node:module";
import {drizzle} from "drizzle-orm/node-postgres";
import express from "express";
import argon2 from "argon2";
import { createHash } from "node:crypto";
const root=import.meta.dirname;
const harness=await createQueueHarness({empty:true});
const migrations=resolve(root,"../../../lib/db/drizzle");
const journal=JSON.parse(await readFile(join(migrations,"meta/_journal.json"),"utf8"));
for(const entry of journal.entries){
  const text=await readFile(join(migrations,`${entry.tag}.sql`),"utf8");
  for(const statement of text.split("--> statement-breakpoint")) if(statement.trim())await harness.control.query(statement);
}
await seedFeatureFixtures({exec:sql=>harness.control.query(sql)});
// Opt-in schedule-to-booking fixtures only; this server always uses its own disposable cluster.
if(process.env.ACCEPTANCE_BOOKING_FIXTURES==="1"){
  await harness.control.query("update branches set data=data||$1::jsonb where id='b1'",[JSON.stringify({timezone:"UTC",openingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,startTime:"08:00",endTime:"20:00"}))})]);
  await harness.control.query("update patients set mobile='+919000000001' where id='p1'");
  for(let day=0;day<7;day++)await harness.control.query("insert into schedules(id,doctor_id,clinic_id,branch_id,day_of_week,data) values($1,'d1','c1','b1',$2,$3)",[`booking-day-${day}`,day,{isOpen:true,startTime:"09:00",endTime:"12:00",timezone:"UTC",maxTokens:30,tokenPrefix:"B",consultationMinutes:20,queueMode:"mixed"}]);
  for(const role of ["sa","adm","docu","rec"])await harness.control.query("insert into patients(id,clinic_id,branch_id,data) values($1,'c1','b1',$2)",[`booking-patient-${role}`,{fullName:`Fictional Booking Patient ${role}`,code:`BP-${role}`}]);
  await harness.control.query("insert into qrs(id,clinic_id,branch_id,doctor_id,public_reference,data) values('booking-qr','c1','b1','d1','booking-discovery-fixture','{}')");
  // Public test-only native patient session, not a production credential or login bypass in the app.
  const token=createHash("sha256").update("disposable-booking-browser-patient").digest("base64url");
  await harness.control.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,'patu',now()+interval '1 hour')",[createHash("sha256").update(token).digest("hex")]);
}
// Public, disposable fixture credential: never used by a persisted account.
const password="Disposable browser verification 2026!";
await harness.control.query("update users set password_hash=$1,email_verified_at=now() where role <> 'patient'",[await argon2.hash(password)]);
process.env.NODE_ENV="development";
process.env.SESSION_SECRET="disposable-acceptance-signing-key-not-a-real-secret";
process.env.AUTH_SESSION_MODE="native";
process.env.CLINICFLOW_PUBLIC_ORIGIN="https://acceptance.test.invalid";
// Satisfy invitation setup using public dummy values. The bundled nodemailer
// replacement below simulates delivery without making any external request.
Object.assign(process.env,{SMTP_HOST:"mail.test.invalid",SMTP_PORT:"587",SMTP_USER:"disposable-fixture",SMTP_PASSWORD:"disposable-fixture",SMTP_FROM:"noreply@test.invalid",SMTP_SECURE:"false",SMTP_REQUIRE_TLS:"true"});
const {Pool}=createRequire(resolve(root,"../../../lib/db/package.json"))("pg");
const pool=new Pool({host:harness.temp,port:5432,user:"queue_test",database:"postgres",password:"",ssl:false,max:8});
// HTTP requests need independent transaction connections, like the real app.
// Sharing the migration/control connection creates false concurrency failures.
globalThis.acceptanceDb=drizzle(pool);
const bundle=join(root,`.acceptance-${process.pid}.mjs`);
await build({entryPoints:[join(root,"app.ts")],outfile:bundle,bundle:true,platform:"node",format:"esm",packages:"external",plugins:[{name:"isolated-acceptance",setup(b){
  b.onResolve({filter:/^@workspace\/db$/},()=>({path:"db",namespace:"acceptance"}));
  b.onLoad({filter:/.*/,namespace:"acceptance"},()=>({contents:`export * from "${resolve(root,"../../../lib/db/src/schema/core.ts")}"; export const db=globalThis.acceptanceDb;`,resolveDir:root}));
  b.onResolve({filter:/^@workspace\/api-zod$/},()=>({path:resolve(root,"../../../lib/api-zod/src/index.ts")}));
  b.onResolve({filter:/^nodemailer$/},()=>({path:"mail",namespace:"no-mail"}));
  b.onLoad({filter:/.*/,namespace:"no-mail"},()=>({contents:`export default {createTransport(){return {async sendMail(options){if(process.env.ACCEPTANCE_MAIL_FAIL==="1")throw new Error("Simulated email failure");return {accepted:[options.to],rejected:[]};}}}};`}));
}}]});
const {default:app}=await import(bundle);
const frontend=resolve(root,"../../clinicflow/dist/public");
app.use(express.static(frontend));
app.get("/{*path}",(_req,res)=>res.sendFile(join(frontend,"index.html")));
const server=app.listen(8099,"127.0.0.1",()=>console.log("Disposable acceptance ready http://127.0.0.1:8099"));
async function stop(){await rm(bundle,{force:true});server.closeAllConnections();await new Promise(done=>server.close(done));await pool.end();await harness.close();process.exit(0);}
process.once("SIGTERM",stop);process.once("SIGINT",stop);
