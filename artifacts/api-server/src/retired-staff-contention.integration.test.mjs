// Real independent PostgreSQL connections in a disposable cluster. No live DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

async function assertWaiting(h, pid) {
  for (let n = 0; n < 500; n++) {
    const rows = await h.pg.query("select 1 from pg_locks where pid=$1 and not granted", [pid]);
    if (rows.rows.length) return;
    await delay(10);
  }
  assert.fail("independent PostgreSQL worker must enter a real lock wait");
}
test("new operational work and retirement serialize in both orders", async () => {
  const h = await createFeatureHarness({ postgres: true });
  let gate, worker;
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(`update appointments set status='completed' where id in ('a1','a3')`);
    gate = await h.pool.connect();
    worker = await h.pool.connect();
    const gatePid = (await gate.query("select pg_backend_pid() pid")).rows[0].pid;
    const workerPid = (await worker.query("select pg_backend_pid() pid")).rows[0].pid;
    assert.notEqual(gatePid, workerPid);
    await gate.query("begin");
    await gate.query(`update doctors set status='retired',user_id=null,owner_admin_id=null,retired_at=now() where id='d1'`);
    const afterRetire = worker.query(`insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id)
      values ('late','p1','d1','c1','b1','2030-01-01',99,'waiting','sa')`).then(() => ({ ok: true }), error => ({ error }));
    await assertWaiting(h, workerPid);
    await gate.query("commit");
    assert.match((await afterRetire).error?.message || "", /Retired doctor cannot accept/);
    assert.equal((await h.pg.query(`select count(*)::int n from appointments where id='late'`)).rows[0].n, 0);

    await gate.query("begin");
    await gate.query(`insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id)
      values ('before','p3','d3','c3','b3','2030-01-01',99,'waiting','sa')`);
    const afterWork = worker.query(`update doctors set status='retired',user_id=null,owner_admin_id=null,retired_at=now() where id='d3'`)
      .then(() => ({ ok: true }), error => ({ error }));
    await assertWaiting(h, workerPid);
    await gate.query("commit");
    assert.match((await afterWork).error?.message || "", /Resolve open doctor work/);
    assert.equal((await h.pg.query(`select status from doctors where id='d3'`)).rows[0].status, "active");
  } finally {
    if (gate) { await gate.query("rollback"); gate.release(); }
    worker?.release();
    await h.close();
  }
});
