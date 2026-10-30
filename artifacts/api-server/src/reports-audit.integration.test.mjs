// Diagnosis only. All writes are to disposable PGlite, never the shared database.
import test from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

const day = "2026-10-26";
const families = ["appointments","doctors","noShow","patients","cancellations","activity","reschedules","clinicPerformance","patientActivity"];
const url = (extra="") => `/reports/analytics?from=${day}&to=${day}${extra}`;

test("Reports audit: independent source oracle, every family/role, combinations and complete exports", {timeout:120000}, async () => {
  const h = await createFeatureHarness({communicationUsage:true});
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(`
      update appointments set date='2020-01-01';
      update audit_logs set created_at='2020-01-01T00:00:00Z';
      update patients set created_at='2020-01-01T00:00:00Z';
      update branches set data=data||'{"timezone":"Asia/Kolkata"}' where id='b1';
      update patients set created_at='2026-10-25T18:45:00Z' where id='p1';
      update patients set created_at='2026-10-26T08:00:00Z' where id='p3';
      insert into branches(id,clinic_id,data) values('b4','c1','{"name":"Second Location","timezone":"UTC"}');
      insert into assignments(id,user_id,clinic_id,branch_id) values('audit-d1b4','docu','c1','b4');
      insert into users(id,email,full_name,role,status) values('doc4u','four@test.invalid','Second Doctor','doctor','active');
      insert into doctors(id,user_id,owner_admin_id) values('d4','doc4u','adm');
      insert into assignments(id,user_id,clinic_id,branch_id) values('audit-d4b1','doc4u','c1','b1');
      insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data) values
      ('audit-1','p1','d1','c1','b1','${day}',1,'completed','adm','{"waitMinutes":10,"consultationStartedAt":"2026-10-26T09:00:00Z","completedAt":"2026-10-26T09:20:00Z","startTime":"09:00","sessionId":"s1"}'),
      ('audit-2','p1','d1','c1','b1','${day}',2,'cancelled','adm','{"startTime":"09:00","sessionId":"s1"}'),
      ('audit-3','p1','d1','c1','b1','${day}',3,'noShow','adm','{"startTime":"09:00","sessionId":"s1"}'),
      ('audit-4','p3','d1','c1','b1','${day}',4,'waiting','adm','{"startTime":"14:00","sessionId":"s2"}'),
      ('audit-5','p1','d1','c1','b4','${day}',1,'booked','adm','{}'),
      ('audit-6','p1','d4','c1','b1','${day}',5,'completed','adm','{}'),
      ('audit-7','p3','d3','c3','b3','${day}',1,'booked','adm2','{}'),
      ('audit-prev','p1','d1','c1','b1','2026-10-25',1,'completed','adm','{}');
      insert into audit_logs(id,actor_id,clinic_id,branch_id,action,entity_type,entity_id,summary,created_at) values
      ('audit-r1','adm','c1','b1','reschedule','appointments','audit-1','fixture','2026-10-25T18:45:00Z'),
      ('audit-r2','adm','c1','b1','reschedule','appointments','audit-1','fixture','2026-10-26T08:00:00Z');
    `);
    // Independent oracle: raw relational rows, no report SQL/totals are reused.
    const raw = (await h.pg.query(`select patient_id,status,data from appointments where clinic_id='c1' and date='${day}'`)).rows;
    const expected = {
      appointments: raw.length, completed: raw.filter(r=>r.status==="completed").length,
      cancelled: raw.filter(r=>r.status==="cancelled").length, noShow: raw.filter(r=>r.status==="noShow").length,
      uniquePatients: new Set(raw.map(r=>r.patient_id)).size, registrations:1,
      waiting:raw.filter(r=>["waiting","booked"].includes(r.status)).length, checkedIn:0, averageWaitMinutes:10, averageConsultationMinutes:20,
      consultationMinutes:20, timedConsultations:1, reschedules:2, rescheduledAppointments:1, activity:2,
    };
    assert.equal(expected.appointments,6); assert.equal(expected.uniquePatients,2);
    const read = async (actor, extra="") => {
      const r = await h.call(actor,"GET",url(extra));
      assert.equal(r.status,200,`${actor} ${extra}: ${JSON.stringify(r.data)}`);
      return r.data;
    };
    const admin = await read("adm","&clinicId=c1&compare=true&pageSize=1");
    assert.deepEqual(admin.summary,expected);
    assert.equal(admin.previous.appointments,1);
    assert.equal(admin.previousFrom,"2026-10-25"); assert.equal(admin.previousTo,"2026-10-25");
    assert.equal(admin.rows.length,1); assert.equal(admin.total,9);
    assert.equal(admin.points[0].appointments,6);
    const sa = await read("sa","&clinicId=c1&compare=true&pageSize=1");
    for (const k of ["summary","previous","points","previousPoints","rows","total"]) assert.deepEqual(sa[k],admin[k],k);
    for (const actor of ["sa","adm","docu","rec"]) {
      for (const family of families) {
        const r = await read(actor,`&clinicId=c1&reportType=${family}&exportAll=true`);
        const restricted = ["docu","rec"].includes(actor)&&["activity","reschedules"].includes(family);
        assert.equal(r.total,restricted?0:1,`${actor}/${family}`);
        assert(r.rows.every(row=>row.family===family&&row.clinicId==="c1"));
        if(!restricted) {
          const count = family==="cancellations"?1:family==="noShow"?1:actor==="sa"||actor==="adm"?6:actor==="docu"?5:5;
          assert.equal(r.summary.appointments,count,`${actor}/${family}/visits`);
          assert.deepEqual(r.rows[0].metrics,r.summary,`${actor}/${family}/detail metrics`);
        }
      }
    }
    for (const groupBy of ["date","clinic","doctor"]) {
      const all = await read("adm",`&clinicId=c1&groupBy=${groupBy}&exportAll=true&pageSize=1&sort=-completed`);
      assert.equal(all.rows.length,all.total); assert.equal(new Set(all.rows.map(r=>r.id)).size,all.total);
      assert.equal(all.summary.appointments,6);
    }
    for (const status of ["available","noData"]) {
      const r=await read("adm",`&clinicId=c1&status=${status}&exportAll=true`);
      assert(r.rows.every(row=>row.status===status)); assert.deepEqual(r.summary,expected);
    }
    const combined=await read("adm","&clinicId=c1&branchId=b1&doctorId=d1&startTime=09%3A00&groupBy=doctor&reportType=appointments&exportAll=true");
    assert.equal(combined.summary.appointments,3); assert.equal(combined.total,1);
    assert.equal((await read("adm","&clinicId=c1&branchId=b4")).summary.appointments,1);
    const byName=await read("adm","&clinicId=c1&search=Lakeview");
    assert.deepEqual(byName.summary,expected);
    const byFamily=await read("adm","&clinicId=c1&search=Cancellation");
    assert.equal(byFamily.total,1); assert.equal(byFamily.summary.appointments,6);
    assert.equal(byFamily.rows[0].metrics.cancelled,1);
    const selectedFamily=await read("adm","&clinicId=c1&reportType=cancellations");
    assert.equal(selectedFamily.summary.appointments,1);
    // Search selects matching families but does not apply an outcome predicate.
    console.log("AUDIT search=Cancellation visits=6; reportType=cancellations visits=1 (distinct current semantics)");
    // Operational Detail uses separate legacy reads: diagnose, do not repair.
    for (const actor of ["adm","docu","rec"]) {
      const operational=await h.call(actor,"GET",`/reports?from=${day}&to=${day}&groupBy=clinic`);
      assert.equal(operational.status,200);
      const foreign=operational.data.rows.find(r=>r.key==="c3");
      assert(foreign && foreign.registrations===1,`${actor}: confirmed foreign registration summary leak`);
    }
    const operational=await h.call("adm","GET",`/reports?from=${day}&to=${day}&clinicId=c1&branchId=b1&doctorId=d1&startTime=09%3A00`);
    assert.equal(operational.status,200); assert.equal(operational.data.rows[0].appointments,3);
    const trend=await h.call("adm","GET",`/reports/trends?from=${day}&to=${day}&clinicId=c1&branchId=b1&doctorId=d1&startTime=09%3A00`);
    assert.equal(trend.status,200); assert.equal(trend.data.points[0].appointments,4);
    console.log("AUDIT confirmed Operational Detail: foreign registration row for admin/doctor/receptionist; session-filtered table visits=3 versus trend visits=4");
    assert.equal((await read("adm","&search=never-matches")).total,0);
    const empty=await h.call("adm","GET","/reports/analytics?from=2099-01-01&to=2099-01-01&clinicId=c1&compare=true");
    assert.equal(empty.status,200); assert.equal(empty.data.total,0); assert.equal(empty.data.summary.appointments,0);
    assert.equal(empty.data.summary.consultationMinutes,null);
    for (const actor of ["adm","docu","rec"]) for (const context of ["clinicId=c3","branchId=b3","doctorId=d3"]) {
      for (const exportQuery of ["","&exportAll=true"]) assert.equal((await h.call(actor,"GET",url(`&${context}${exportQuery}`))).status,403);
    }
    assert.equal((await h.call("rec","GET",url("&clinicId=c1&branchId=b4&exportAll=true"))).status,403);
    for (const actor of [null,"patu"]) for (const path of [url(),url("&exportAll=true"),"/reports","/reports/trends","/reports/communication-usage"]) {
      assert.equal((await h.call(actor,"GET",path)).status,actor?403:401);
    }
    for (const actor of ["docu","rec"]) assert.equal((await h.call(actor,"GET","/reports/communication-usage")).status,403);
    await h.pg.exec(`insert into settings(id,data) values('permission-policy','{"revision":1,"denied":["receptionist:reports:read"]}')`);
    for(const path of [url(),url("&exportAll=true"),"/reports","/reports/trends"]) assert.equal((await h.call("rec","GET",path)).status,403);
    await h.pg.exec(`delete from settings where id='permission-policy';
      insert into settings(id,data) values('custom-roles','{"revision":1,"roles":[{"id":"blocked","name":"No reports","baseRole":"doctor","denied":["reports:read"]}],"bindings":[{"userId":"docu","roleId":"blocked"}]}')`);
    assert.equal((await h.call("docu","GET",url("&exportAll=true"))).status,403);
    console.log("AUDIT role/family matrix, scope denial, custom policy, oracle totals, session/start, search and export checks passed");
  } finally { await h.close(); }
});

test("Reports audit reproduces historical numeric and timestamp failures without fixing backend", {timeout:120000}, async () => {
  const h = await createFeatureHarness();
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(`update appointments set date='${day}' where id='a1'`);
    assert.equal((await h.call("adm","GET",url("&clinicId=c1"))).status,200);
    for (const [name, data, code] of [
      ["non-numeric wait", {waitMinutes:"not-recorded"}, "22P02"],
      ["timestamp-shaped invalid consultation", {status:"completed",consultationStartedAt:"2026-99-99T09:00:00Z",completedAt:"2026-10-26T10:00:00Z"}, "22008"],
    ]) {
      await h.pg.query(`update appointments set data=$1::jsonb,status=$2 where id='a1'`,[JSON.stringify(data),data.status||"checkedIn"]);
      for (const actor of ["sa","adm","docu","rec"]) for (const family of families) {
        const r=await h.call(actor,"GET",url(`&clinicId=c1&reportType=${family}&exportAll=true`));
        // Outcome families legitimately exclude this checked-in/completed record.
        const included=!["noShow","cancellations"].includes(family);
        assert.equal(r.status,included?500:200,`${name}/${actor}/${family}`);
        if(included) {
          const cause=h.errors.at(-1)?.cause||h.errors.at(-1);
          assert.equal(cause.code,code,name);
        }
      }
      const cause=h.errors.at(-1)?.cause||h.errors.at(-1);
      console.log(`AUDIT confirmed ${name}: GET /reports/analytics, HTTP 500, SQLSTATE ${cause.code}; sanitized response only`);
      // Restore the isolated record between cases.
      await h.pg.exec(`update appointments set data='{}',status='checkedIn' where id='a1'`);
    }
  } finally { await h.close(); }
});
