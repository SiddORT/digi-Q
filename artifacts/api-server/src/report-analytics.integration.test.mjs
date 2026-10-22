import test from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures, TODAY, PAST } from "./test-support/feature-fixtures.mjs";

test("local visit visibility never exposes a foreign patient registration clinic", { timeout: 60000 }, async () => {
  const h = await createFeatureHarness({ administration: true });
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(`update patients set created_at='${TODAY}T09:00:00Z' where id in ('p1','p3');
      insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data)
      values ('registration-cross-visit','p3','d1','c1','b1','${TODAY}',8,'waiting','rec','{"reference":"REG-CROSS"}')`);
    for (const actor of ["adm", "docu", "rec"]) {
      assert.equal((await h.call(actor,"GET","/patients/p3")).status,200,`${actor} can view the locally visiting patient profile`);
      for (const suffix of ["", "&exportAll=true", "&reportType=patients&exportAll=true", "&groupBy=clinic&exportAll=true"]) {
        const r=await h.call(actor,"GET",`/reports/analytics?from=${TODAY}&to=${TODAY}${suffix}`);
        assert.equal(r.status,200,`${actor}${suffix}`);
        assert.equal(r.data.summary.appointments,2,"local visits remain included");
        assert.equal(r.data.summary.registrations,1,"foreign registration excluded independently of profile visibility");
        assert(r.data.rows.every(row=>row.clinicId!=="c3" && !row.clinic.includes("Foreign")),`${actor}${suffix}`);
      }
      assert.equal((await h.call(actor,"GET",`/reports/analytics?from=${TODAY}&to=${TODAY}&clinicId=c3`)).status,403);
    }
    const global=await h.call("sa","GET",`/reports/analytics?from=${TODAY}&to=${TODAY}&reportType=patients&exportAll=true`);
    assert.equal(global.status,200);
    assert.equal(global.data.summary.registrations,2,"global authority retains both genuine registrations");
    assert(global.data.rows.some(row=>row.clinicId==="c3" && row.metrics.registrations===1));
  } finally { await h.close(); }
});

test("live reports share scope across totals, comparison, families, paging and exports", { timeout: 120000 }, async () => {
  const h = await createFeatureHarness();
  try {
    await seedFeatureFixtures(h.pg);
    const read = async (who = "adm", query = "") => {
      const r = await h.call(who, "GET", `/reports/analytics?from=${PAST}&to=${TODAY}${query}`);
      assert.equal(r.status, 200, JSON.stringify(r.data));
      return r.data;
    };
    const all = await read("adm", "&compare=true&pageSize=1");
    assert.equal(all.rows.length, 1);
    assert.equal(all.summary.appointments, 3);
    assert.equal(all.summary.uniquePatients, 1);
    assert.equal(all.summary.cancelled, 1);
    assert.equal(all.summary.completed, 1);
    assert.equal(all.points.reduce((n, p) => n + p.appointments, 0), 3);
    assert.equal(all.previousPoints.length, all.points.length);
    assert(all.total > 1);
    assert.equal(all.summary.consultationMinutes, null);
    await h.pg.exec(`update appointments set data=data || '{"consultationStartedAt":"${PAST}T09:00:00Z","completedAt":"${PAST}T09:15:00Z"}'::jsonb where id='a2';
      insert into audit_logs(id,actor_id,clinic_id,branch_id,action,entity_type,entity_id,summary,created_at) values
      ('report-r1','adm','c1','b1','reschedule','appointments','a4','reschedule appointments record','${TODAY}T01:00:00Z'),
      ('report-r2','adm','c1','b1','reschedule','appointments','a4','reschedule appointments record','${TODAY}T02:00:00Z')`);
    const movement = await read("adm", "&reportType=reschedules");
    assert.equal(movement.summary.reschedules, 2);
    assert.equal(movement.summary.rescheduledAppointments, 1);
    assert(movement.rows.some(r => r.metrics.reschedules === 2 && r.metrics.rescheduledAppointments === 1));
    const timed = await read("adm", "&reportType=doctors&groupBy=doctor");
    assert.equal(timed.summary.consultationMinutes, 15);
    assert.equal(timed.summary.timedConsultations, 1);
    assert.equal(timed.summary.averageConsultationMinutes, 15);
    const notCompared = await read("adm", "&compare=false&exportAll=false&pageSize=1");
    assert.equal(notCompared.previous,null);
    assert.equal(notCompared.rows.length,1);
    const exported = await read("adm", "&exportAll=true&pageSize=1");
    assert(exported.rows.length >= all.total);
    assert.equal(exported.summary.appointments, all.summary.appointments);
    assert.equal(new Set(exported.rows.map(r => r.id)).size, exported.total);
    for (const family of ["appointments", "doctors", "noShow", "patients", "cancellations", "activity", "reschedules", "clinicPerformance", "patientActivity"]) {
      const r = await read("adm", `&reportType=${family}`);
      assert(r.rows.every(row => row.family === family && ["available", "noData"].includes(row.status)));
    }
    const cancelled = await read("adm", "&reportType=cancellations");
    assert.equal(cancelled.summary.appointments, 1);
    assert.equal(cancelled.summary.cancelled, 1);
    const none = await read("adm", "&status=noData");
    assert(none.rows.every(r => r.status === "noData"));
    assert.equal(none.summary.appointments, all.summary.appointments);
    const available = await read("adm", "&status=available&exportAll=true");
    assert(available.rows.every(r => r.status === "available"));
    assert(available.rows.every(r => typeof r.clinicId === "string" && typeof r.clinic === "string"));
    const search = await read("adm", "&search=Foreign");
    assert.equal(search.total, 0);
    assert.equal(search.summary.appointments, 0);
    const byDoctor = await read("adm", "&groupBy=doctor");
    assert(byDoctor.rows.every(r => r.group !== "Unknown Doctor" || r.family === "patients"));
    assert.equal((await h.call("adm", "GET", `/reports/analytics?clinicId=c3&from=${PAST}&to=${TODAY}`)).status, 403);
    assert.equal((await h.call("patu", "GET", "/reports/analytics")).status, 403);
    const doctor = await read("docu");
    assert.equal(doctor.summary.appointments, 3);
    assert(!doctor.rows.some(r => r.family === "activity" || r.family === "reschedules"));
    const day = await h.call("adm", "GET", `/reports/analytics?from=${TODAY}&to=${TODAY}`);
    assert.equal(day.status, 200, JSON.stringify(day.data));
    assert.equal(day.data.points.length, 1);
    assert.equal((await h.call("adm", "GET", `/reports/analytics?from=${TODAY}&to=${PAST}`)).status, 400);
    assert.equal((await h.call("adm", "GET", "/reports/analytics?from=2020-01-01&to=2026-01-01")).status, 400);
    assert.equal((await h.call("adm", "GET", "/reports/analytics?from=2026-02-31&to=2026-03-04")).status, 400);
    assert.equal((await h.call("adm", "GET", "/reports/analytics?compare=maybe")).status, 400);
  } finally { await h.close(); }
});
