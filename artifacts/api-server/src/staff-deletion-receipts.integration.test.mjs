import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("removed-account receipts preserve partial verified cleanup, retry safely and retain no completed file keys", async () => {
  // Fictional encryption key, isolated process/database, no real files or cloud calls.
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "12".repeat(32);
  const h = await createFeatureHarness({ deletion: true });
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(`insert into users(id,email,full_name,role,status) values('receipt-target','cleanup@example.test','Synthetic cleanup staff','superAdmin','inactive')`);
    const files = [0, 1].map(() => ({ provider: "local", key: `${randomUUID()}.png`, configuration: "b".repeat(64), notBefore: 0 }));
    const prepared = h.receipts.prepare("receipt-target", "c".repeat(64), files);
    assert(!JSON.stringify(prepared).includes("receipt-target"));
    assert(files.every(f => !JSON.stringify(prepared).includes(f.key)), "pending keys must be encrypted");
    await assert.rejects(h.receipts.commit(prepared), /has not been removed/);
    assert.equal((await h.pg.query(`select count(*)::int n from staff_deletion_receipts`)).rows[0].n, 0);
    // Only the newly created, unrelated fictional target is deleted here.
    await h.pg.exec(`delete from users where id='receipt-target'`);
    await h.receipts.commit(prepared);
    const first = await h.receipts.get(prepared.id);
    assert.equal(first.accountRemoved, true); assert.equal(first.state, "cleanup_pending");
    assert.equal(first.files, 2); assert.equal(first.verifiedFiles, 0);
    const attempts = [];
    const remove = async job => {
      attempts.push(job.key);
      if (job.key === files[1].key) return { state: "pending", reason: "STORAGE_UNAVAILABLE" };
      return { state: "complete" };
    };
    const partial = await h.receipts.process(prepared.id, async () => false, remove);
    assert.equal(partial.state, "cleanup_pending"); assert.equal(partial.verifiedFiles, 1);
    assert.deepEqual(partial.pendingReasons, ["STORAGE_UNAVAILABLE"]);
    assert.equal((await h.pg.query(`select count(*)::int n from users where id='receipt-target'`)).rows[0].n, 0,
      "storage failure cannot report or perform account rollback");
    const completed = await h.receipts.process(prepared.id, async () => false, async job => {
      attempts.push(job.key); return { state: "complete" };
    });
    assert.equal(completed.state, "complete"); assert.equal(completed.verifiedFiles, 2);
    assert.deepEqual(attempts, [files[0].key, files[1].key, files[1].key], "verified jobs are not replayed");
    const stored = (await h.pg.query(`select * from staff_deletion_receipts where id=$1`, [prepared.id])).rows[0];
    assert.equal(stored.encrypted_jobs, null);
    assert(!JSON.stringify(stored).includes(files[0].key));
    await h.receipts.process(prepared.id, async () => false, async () => { throw new Error("must not run"); });
    await assert.rejects(h.pg.exec(`update staff_deletion_receipts set verified_count=0 where id='${prepared.id}'`),
      /immutable|staff_receipt_state/);
    await assert.rejects(h.pg.exec(`delete from staff_deletion_receipts where id='${prepared.id}'`), /permanent/);
    await assert.rejects(h.pg.exec(`insert into users(id,email,full_name,role,status) values('receipt-target','recreated@example.test','Recreated identity','superAdmin','inactive')`),
      /removed staff identity cannot be recreated/);
    await h.pg.exec(`insert into users(id,email,full_name,role,status) values('new-independent-identity','cleanup@example.test','New identity','superAdmin','inactive')`);
  } finally { await h.close(); }
});

test("independent PostgreSQL cleanup retries wait on the receipt lock and do not repeat verified jobs", async () => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "56".repeat(32);
  const h = await createFeatureHarness({ deletion: true, postgres: true });
  let release = () => {}, first, second;
  try {
    await seedFeatureFixtures(h.pg);
    const prepared = h.receipts.prepare("absent-concurrent-fictional-staff", "f".repeat(64), [
      { provider: "local", key: `${randomUUID()}.png`, configuration: "b".repeat(64), notBefore: 0 },
    ]);
    await h.receipts.commit(prepared);
    const blocked = new Promise(resolve => { release = resolve; });
    let entered; const started = new Promise(resolve => { entered = resolve; });
    let attempts = 0;
    first = h.receipts.process(prepared.id, async () => false, async () => {
      attempts++; entered(); await blocked; return { state: "complete" };
    });
    await started;
    second = h.receipts.process(prepared.id, async () => false, async () => {
      attempts++; return { state: "complete" };
    });
    let observation = [];
    for (let i = 0; i < 200; i++) {
      observation = (await h.pg.query(`select pid,state,wait_event_type from pg_stat_activity
        where pid<>pg_backend_pid() and datname=current_database() and query like '%staff_deletion_receipts%'
        and state in ('active','idle in transaction')`)).rows;
      if (observation.some(r => r.wait_event_type === "Lock")) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert(observation.some(r => r.wait_event_type === "Lock"), "retry must observably wait in PostgreSQL, not just in JavaScript");
    assert(new Set(observation.map(r => r.pid)).size >= 2, "cleanup retries must use independent PostgreSQL backends");
    release();
    const results = await Promise.all([first, second]);
    assert(results.every(r => r.state === "complete")); assert.equal(attempts, 1);
  } finally {
    release(); await Promise.allSettled([first, second].filter(Boolean)); await h.close();
  }
});

test("receipt encryption is bound to its operation and unreadable receipts stay pending", async () => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "34".repeat(32);
  const h = await createFeatureHarness({ deletion: true });
  try {
    await seedFeatureFixtures(h.pg);
    const file = { provider: "local", key: `${randomUUID()}.png`, configuration: "b".repeat(64), notBefore: 0 };
    const a = h.receipts.prepare("already-absent-fictional-a", "c".repeat(64), [file]);
    const b = h.receipts.prepare("already-absent-fictional-b", "d".repeat(64), [file]);
    await h.receipts.commit(a); await h.receipts.commit(b);
    await h.pg.query(`update staff_deletion_receipts set encrypted_jobs=$1 where id=$2`, [a.encryptedJobs, b.id]);
    let calls = 0;
    const result = await h.receipts.process(b.id, async () => false, async () => { calls++; return { state: "complete" }; });
    assert.equal(result.state, "cleanup_pending"); assert.equal(result.accountRemoved, true);
    assert.deepEqual(result.pendingReasons, ["RECEIPT_UNAVAILABLE"]); assert.equal(calls, 0);
    const complete = h.receipts.prepare("already-absent-fictional-c", "e".repeat(64), []);
    await h.receipts.commit(complete);
    assert.equal((await h.receipts.get(complete.id)).state, "complete");
  } finally { await h.close(); }
});
