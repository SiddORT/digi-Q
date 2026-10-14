import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("dispatch claims are durable before sending, remain barriers on uncertainty, and never dispatch to an absent login", async () => {
  const h = await createFeatureHarness({ postgres: true, deletion: true });
  let gate;
  try {
    await seedFeatureFixtures(h.pg);
    gate = await h.pool.connect();
    await gate.query("begin");
    await gate.query(`select pg_advisory_xact_lock(hashtext('auth-credentials:rec2'))`);
    let sent = 0;
    const operation = h.staffDispatch(["rec2"], async () => {
      sent++;
      const rows = await h.pg.query(`select count(*)::int n from settings where id like 'staff-dispatch:%' and data->>'state'='sending'`);
      assert.equal(rows.rows[0].n, 1, "provider callback starts only after a durable commit");
    });
    let waiting = false;
    for (let n = 0; n < 500; n++) {
      const rows = await h.pg.query(`select count(*)::int n from pg_locks where locktype='advisory' and not granted`);
      if (rows.rows[0].n) { waiting = true; break; }
      await delay(10);
    }
    assert.ok(waiting, "dispatch must contend on an independent PostgreSQL backend");
    assert.equal(sent, 0);
    await gate.query("commit");
    await operation;
    assert.equal(sent, 1);
    await assert.rejects(h.staffDispatch(["rec2"], async () => { throw new Error("Uncertain provider outcome"); }), /Uncertain/);
    const impact = await h.staffDeletionImpact("sa", "rec2");
    assert.ok(impact.blockers.some(b => b.code === "DISPATCH_IN_PROGRESS"));
    const rows = await h.pg.query(`select data from settings where id like 'staff-dispatch:%' order by data->>'createdAt'`);
    assert.deepEqual(rows.rows.map(r => r.data.state).sort(), ["completed", "delivery_unknown"]);
    await assert.rejects(h.staffDispatch(["missing"], async () => { sent++; }), /no longer available/);
    assert.equal(sent, 1, "missing login cannot dispatch");
    await assert.rejects(h.staffDispatch(["patu"], async () => { sent++; }), /no longer available/);
    assert.equal(sent, 1, "patient identities never use the staff-removal barrier");
  } finally {
    if (gate) { await gate.query("rollback"); gate.release(); }
    await h.close();
  }
});
