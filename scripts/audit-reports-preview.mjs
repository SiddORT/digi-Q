// Read-only report investigation via ordinary native authentication.
// Credentials/cookies stay in process memory; no HAR, trace or response bodies.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const requireDb = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = requireDb("pg");
const populatedOnly = process.argv.includes("--populated");
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const jar = new Map();
let csrf;
async function request(path, body) {
  const res = await fetch(origin + "/api" + path, {
    method: body ? "POST" : "GET", redirect:"error",
    headers: { cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "), ...(body ? { "content-type":"application/json","x-csrf-token":csrf,origin } : {}) },
    ...(body ? {body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(30000),
  });
  for(const c of res.headers.getSetCookie()) { const [pair] = c.split(";"); const i=pair.indexOf("="); jar.set(pair.slice(0,i),pair.slice(i+1)); }
  let data; try { data=await res.json(); } catch {}
  return {status:res.status,data,correlation:res.headers.get("x-request-id")||null};
}
const results=[];
for(const account of [
  {role:"superAdmin",email:"SUPERADMIN_EMAIL",password:"PREVIEW_SUPERADMIN_RECOVERY_PASSWORD"},
  {role:"clinicAdmin",email:"UAT_CLINIC_ADMIN_EMAIL",password:"UAT_CLINIC_ADMIN_PASSWORD"},
].filter(account => !populatedOnly || account.role === "superAdmin")) {
  jar.clear();
  const entry={role:account.role,environment:"development Preview",requests:[]};
  results.push(entry);
  if(!process.env[account.email]||!process.env[account.password]) {entry.blocked="Credential unavailable in workspace process";continue;}
  try {
    const token=await request("/auth/csrf"); csrf=token.data?.csrfToken;
    const auth=await request("/auth/login",{email:process.env[account.email],password:process.env[account.password]});
    entry.loginStatus=auth.status;
    if(auth.status!==200) {entry.blocked="Existing credential not accepted in this Preview; no password/account changed";continue;}
    const me=await request("/me");
    entry.identityVerified=me.status===200&&me.data?.user?.role===account.role;
    if(!entry.identityVerified){entry.blocked="Authenticated role did not match intended role";continue;}
    const clinics=await request("/clinics?pageSize=1");
    const clinicId=populatedOnly?undefined:clinics.data?.items?.[0]?.id;
    for(const date of populatedOnly?["2026-10-24"]:["2026-10-26","2026-10-30"]) {
      const to=populatedOnly?"2026-10-30":date;
      const query=new URLSearchParams({from:date,to,groupBy:populatedOnly?"clinic":"date",reportType:populatedOnly?"appointments":"all",status:populatedOnly?"available":"all",compare:String(populatedOnly),page:"1",pageSize:"20",...(clinicId?{clinicId}:{})});
      const res=await request(`/reports/analytics?${query}`);
      const safe={from:date,to,groupBy:query.get("groupBy"),reportType:query.get("reportType"),status:query.get("status"),compare:populatedOnly,clinicScoped:!!clinicId,httpStatus:res.status,correlation:res.correlation};
      entry.requests.push(safe);
      if(res.status===200) {
        safe.summary=res.data.summary; safe.total=res.data.total;
        safe.trendAppointments=res.data.points.reduce((n,p)=>n+p.appointments,0);
        const exported=await request(`/reports/analytics?${query}&exportAll=true`);
        safe.exportStatus=exported.status;
        safe.exportComplete=exported.status===200&&exported.data.rows.length===exported.data.total&&new Set(exported.data.rows.map(r=>r.id)).size===exported.data.total;
        if(process.env.DATABASE_URL) {
          const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
          try {
            await pool.query("BEGIN READ ONLY");
            // Accounts checked above: administrator and server-authorized selected clinic only.
            if(clinicId) {
              const source=await pool.query(`select count(*)::int as appointments,
                count(*) filter(where status='completed')::int as completed,
                count(*) filter(where status='cancelled')::int as cancelled,
                count(*) filter(where status='noShow')::int as "noShow"
                from appointments where clinic_id=$1 and date=$2`,[clinicId,date]);
              safe.independentSource=source.rows[0];
              safe.kpisReconciled=Object.entries(source.rows[0]).every(([k,v])=>res.data.summary[k]===v);
            } else if(populatedOnly && account.role==="superAdmin") {
              const source=await pool.query(`select clinic_id,
                count(*)::int as appointments,
                count(*) filter(where status='completed')::int as completed,
                count(*) filter(where status='cancelled')::int as cancelled,
                count(*) filter(where status='noShow')::int as "noShow"
                from appointments where date between $1 and $2 group by clinic_id`,[date,to]);
              safe.independentSource=Object.fromEntries(["appointments","completed","cancelled","noShow"].map(k=>[k,source.rows.reduce((n,r)=>n+r[k],0)]));
              safe.kpisReconciled=Object.entries(safe.independentSource).every(([k,v])=>res.data.summary[k]===v);
              safe.groupRowsReconciled=source.rows.every(r=> {
                const row=exported.data.rows.find(row=>row.clinicId===r.clinic_id);
                return row && Object.keys(safe.independentSource).every(k=>row.metrics[k]===r[k]);
              }) && exported.data.rows.length===source.rows.length;
              const previous=await pool.query(`select count(*)::int as appointments from appointments where date between $1 and $2`,[res.data.previousFrom,res.data.previousTo]);
              safe.independentPreviousAppointments=previous.rows[0].appointments;
              safe.previousReconciled=res.data.previous?.appointments===previous.rows[0].appointments;
            }
            await pool.query("ROLLBACK");
          } catch {safe.sourceBlocked="Read-only database comparison unavailable";} finally {await pool.end();}
        }
      }
    }
  } catch { entry.blocked="Preview request unavailable; no sensitive request details retained"; }
  finally { if(jar.size) await request("/auth/logout",{}).catch(()=>{});jar.clear(); }
}
await mkdir("generated-artifacts/reports-audit",{recursive:true});
await writeFile(`generated-artifacts/reports-audit/preview-${populatedOnly?"populated":"summary"}.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
