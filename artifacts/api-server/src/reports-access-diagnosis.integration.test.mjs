// Diagnosis only: actual Express routes/policies and disposable PGlite.
// Fixture identity bypasses native login; this is not hosted/session evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

const paths = ["/reports", "/reports/analytics", "/reports/trends", "/reports/communication-usage"];
const scopeMessage = "Select a clinic scope before using this operation with your assigned role";
const clinicMessage = "Your assigned role does not allow this action in this clinic";
const globalMessage = "Your assigned role does not allow this action";
const missingRecord = "/reports/communication-usage/notification-history:" + "0".repeat(64);

test("diagnosis: saved clinic-bound report denials lose scope only on nested real routes", { timeout: 120000 }, async t => {
  const h = await createFeatureHarness({ communicationUsage: true });
  const set = async (id, data) => h.pg.query(
    "insert into settings(id,data) values($1,$2::jsonb) on conflict(id) do update set data=excluded.data",
    [id, JSON.stringify(data)],
  );
  const read = (actor, path, scope = "") => h.call(actor, "GET", path +
    (path.includes("communication-usage") ? "?from=2026-10-26T00%3A00%3A00Z&to=2026-10-26T23%3A59%3A59Z" : "?from=2026-10-26&to=2026-10-26") + scope);
  const check = async (actor, path, scope, status, message) => {
    const r = await read(actor, path, scope);
    assert.equal(r.status, status, `${actor} ${path}${scope}: ${JSON.stringify(r.data)}`);
    if (message) assert.equal(r.data.error, message);
    return r;
  };
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec("insert into assignments(id,user_id,clinic_id,branch_id) values('access-rec-c2','rec','c2','b2')");
    // Both local clinics really are accessible before adding the restriction.
    for (const actor of ["adm", "docu", "rec"]) for (const path of paths) {
      for (const clinic of ["c1", "c2"]) {
        await check(actor, path, `&clinicId=${clinic}`, path.endsWith("communication-usage") && actor !== "adm" ? 403 : 200);
      }
      await check(actor, path, "&clinicId=c3", 403);
    }
    for (const [actor, role] of [["adm", "clinicAdmin"], ["docu", "doctor"], ["rec", "receptionist"]]) {
      const config = {
        revision: 1,
        roles: [{ id: "restricted", name: "Restricted Reports", baseRole: role, denied: ["reports:read"] }],
        bindings: [{ userId: actor, roleId: "restricted", clinicId: "c2" }],
      };
      await set("custom-roles", config);
      await check(actor, "/reports", "&clinicId=c1", 200);
      await check(actor, "/reports", "&clinicId=c2", 403, clinicMessage);
      await check(actor, "/reports", "", 403, scopeMessage);
      await check(actor, "/reports", "&branchId=b1", 200);
      await check(actor, "/reports", "&branchId=b2", 403, clinicMessage);
      for (const path of paths.slice(1)) {
        for (const scope of ["&clinicId=c1", "&clinicId=c2", "&branchId=b1", "&clinicId=c1&branchId=b1", ""]) {
          await check(actor, path, scope, 403, scopeMessage);
        }
      }
      await check(actor, "/reports/analytics", "&clinicId=c1&exportAll=true", 403, scopeMessage);
      await check(actor, missingRecord, "&clinicId=c1", 403, scopeMessage);
      // A saved workspace narrows authority, but does not restore the erased request scope.
      await set(`workspace:${actor}`, { clinicId: "c1" });
      await check(actor, "/reports", "&clinicId=c1", 200);
      await check(actor, "/reports/analytics", "&clinicId=c1", 403, scopeMessage);
      await h.pg.query("delete from settings where id=$1", [`workspace:${actor}`]);
      // Other users and Super Admin are unaffected by this account's binding.
      await check("sa", "/reports/analytics", "&clinicId=c2", 200);
      await check("adm2", "/reports/analytics", "&clinicId=c3", 200);
      config.bindings = [{ userId: actor, roleId: "restricted" }];
      await set("custom-roles", config);
      for (const path of paths) await check(actor, path, "&clinicId=c1", 403, globalMessage);
      await h.pg.exec("delete from settings where id='custom-roles'");
      await set("permission-policy", { revision: 1, denied: [`${role}:reports:read`] });
      for (const path of paths) await check(actor, path, "&clinicId=c1", 403, "This operation is disabled by your administrator");
      await check(actor, "/reports/analytics", "&clinicId=c1&exportAll=true", 403, "This operation is disabled by your administrator");
      await check("sa", "/reports/analytics", "&clinicId=c1", 200);
      await h.pg.exec("delete from settings where id='permission-policy'");
      t.diagnostic(`${role}: allowed top-level clinic/branch succeeds; nested explicit scope erased; global denials intentional; workspace does not repair scope`);
    }
    for (const actor of [null, "patu"]) for (const path of paths) await check(actor, path, "&clinicId=c1", actor ? 403 : 401);
    await check("adm", missingRecord, "&clinicId=c1", 404);
  } finally { await h.close(); }
});

test("diagnosis: Operational paging/search/group totals and session mismatch across eligible roles", { timeout: 120000 }, async () => {
  const h = await createFeatureHarness();
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(`
      update appointments set date='2026-10-26', data=data||'{"startTime":"09:00","sessionId":"morning"}' where clinic_id='c1';
      update appointments set date='2026-10-27' where id='a4';
      insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data)
      values('access-afternoon','p1','d1','c1','b1','2026-10-26',8,'waiting','rec','{"startTime":"14:00","sessionId":"afternoon"}');
      update patients set created_at='2020-01-01T00:00:00Z';
    `);
    const raw = (await h.pg.query("select date,status from appointments where clinic_id='c1' and date between '2026-10-26' and '2026-10-27'")).rows;
    const base = "/reports?from=2026-10-26&to=2026-10-27&clinicId=c1&branchId=b1&doctorId=d1";
    for (const actor of ["sa", "adm", "docu", "rec"]) {
      for (const group of ["date", "clinic", "doctor"]) {
        const first = await h.call(actor, "GET", base + `&groupBy=${group}&pageSize=1&sort=-key`);
        assert.equal(first.status, 200);
        const pages = [];
        for (let page = 1; page <= first.data.totalPages; page++) {
          const r = await h.call(actor, "GET", base + `&groupBy=${group}&pageSize=1&sort=-key&page=${page}`);
          assert.equal(r.status, 200);
          assert.equal(r.data.total, first.data.total);
          pages.push(...r.data.rows);
        }
        assert.equal(pages.length, first.data.total);
        assert.equal(new Set(pages.map(r => r.key)).size, pages.length);
        assert.equal(pages.reduce((n, r) => n + r.appointments, 0), raw.length);
        assert.equal(pages.reduce((n, r) => n + r.cancelled, 0), raw.filter(r => r.status === "cancelled").length);
      }
      const searched = await h.call(actor, "GET", base + "&search=2026-10-27");
      assert.equal(searched.status, 200);
      assert.equal(searched.data.total, 1);
      assert.equal(searched.data.rows[0].appointments, raw.filter(r => r.date === "2026-10-27").length);
      const none = await h.call(actor, "GET", base + "&search=never-matches");
      assert.equal(none.status, 200); assert.equal(none.data.total, 0);
      const scoped = "?from=2026-10-26&to=2026-10-26&clinicId=c1&branchId=b1&doctorId=d1&startTime=09%3A00";
      const table = await h.call(actor, "GET", "/reports" + scoped);
      const trend = await h.call(actor, "GET", "/reports/trends" + scoped);
      assert.equal(table.status, 200); assert.equal(trend.status, 200);
      assert.equal(table.data.rows[0].appointments, 2);
      assert.equal(trend.data.points[0].appointments, 3);
    }
  } finally { await h.close(); }
});
