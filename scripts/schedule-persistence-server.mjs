// Local-only test server. Real migrations, routers, authorization and PostgreSQL.
// No workspace database, hosted credentials, object storage or notification transports.
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createFeatureHarness } from "../artifacts/api-server/src/test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "../artifacts/api-server/src/test-support/feature-fixtures.mjs";

process.env.AUTH_SESSION_MODE = "native";
const h = await createFeatureHarness({administration:true,registration:true,bookingLookups:true,postgres:true,simulatedMail:true});
await seedFeatureFixtures(h.pg);
await h.pg.exec("truncate appointments cascade");
await h.pg.query("update clinics set data=data||$1::jsonb where id='c1'",[JSON.stringify({timezone:"Asia/Kolkata",timeFormat:"24h",dateFormat:"YYYY-MM-DD"})]);
const hours=[1,3,5].map(dayOfWeek=>({dayOfWeek,startTime:"08:00",endTime:"20:00"}));
await h.pg.query("update branches set data=data||$1::jsonb where id='b1'",[JSON.stringify({timezone:"Asia/Kolkata",openingHours:hours})]);
await h.pg.query("insert into settings(id,data) values('platform',$1) on conflict(id) do update set data=excluded.data",[JSON.stringify({notificationsEnabled:false})]);
const actors=["sa","adm","docu","rec","patu","doc3u","rec3"];
const control=createServer(async(req,res)=>{
  res.setHeader("Content-Type","application/json");
  try{
    const path=new URL(req.url,"http://localhost").pathname.replace("/__schedule-evidence","");
    if(path.startsWith("/actor/")){
      const id=path.slice(7);if(!actors.includes(id))throw new Error("Unknown fictional actor");
      const token=randomBytes(32).toString("base64url");
      await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[createHash("sha256").update(token).digest("hex"),id]);
      return res.end(JSON.stringify({token}));
    }
    if(path==="/reset"){
      await h.pg.exec("delete from schedules; delete from settings where id like 'schedule-day-%'");
      await h.pg.query("update branches set data=(data-'linkedSchedule'-'scheduleDayOverrides') where id='b1'");
      return res.end("{}");
    }
    if(path==="/linked"){
      const data={doctorId:"d1",branchId:"b1",clinicId:"c1",dayOfWeek:1,startTime:"09:00",endTime:"12:00",isOpen:true,timezone:"Asia/Kolkata",maxTokens:10,consultationMinutes:20,tokenPrefix:"L",queueMode:"mixed",linkedBranchId:"b1"};
      await h.pg.query("insert into schedules(id,doctor_id,clinic_id,branch_id,day_of_week,data) values('linked','d1','c1','b1',1,$1)",[data]);
      await h.pg.query("update branches set data=data||$1::jsonb where id='b1'",[JSON.stringify({linkedSchedule:{enabled:true,doctorId:"d1",maxTokens:10,consultationMinutes:20,tokenPrefix:"L",queueMode:"mixed"}})]);
      return res.end("{}");
    }
    if(path==="/rows"){
      const {rows}=await h.pg.query("select id,doctor_id,branch_id,day_of_week,status,data from schedules order by branch_id,day_of_week,data->>'startTime'");
      return res.end(JSON.stringify(rows));
    }
    if(path==="/counts"){
      const {rows}=await h.pg.query("select (select count(*)::int from schedules) schedules,(select count(*)::int from clinics) clinics,(select count(*)::int from appointments) appointments,(select count(*)::int from settings where id like 'mail-outbox:%' or id like 'sms-outbox:%') outbox");
      return res.end(JSON.stringify(rows[0]));
    }
    res.statusCode=404;res.end("{}");
  }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.message}));}
});
await new Promise(resolve=>control.listen(43722,"127.0.0.1",resolve));
const vite=spawn("pnpm",["--filter","@workspace/clinicflow","exec","vite","--config","workspace-regression/vite.config.ts"],{stdio:"inherit",env:{...process.env,SCHEDULE_TEST_API:new URL(h.base).origin}});
let closing=false;
async function close(){if(closing)return;closing=true;vite.kill("SIGTERM");control.close();await h.close();process.exit(0);}
process.on("SIGTERM",close);process.on("SIGINT",close);
vite.on("exit",close);
