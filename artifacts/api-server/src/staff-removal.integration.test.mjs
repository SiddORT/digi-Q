import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
async function fixture() {
  process.env.SESSION_SECRET = "disposable-staff-removal-fixture-signing-secret-only";
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "ed".repeat(32);
  process.env.MEDIA_STORAGE = "local";
  process.env.MEDIA_ROOT = "/tmp/disposable-staff-removal-fixture-media";
  const h = await createFeatureHarness({ postgres: true, deletion: true, administration: true, bookingLookups: true, fakeBookingMail: true });
  await seedFeatureFixtures(h.pg);
  const tokens = {};
  for (const id of ["sa", "adm", "docu", "rec", "patu"]) {
    tokens[id] = randomBytes(32).toString("base64url");
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",
      [hash(tokens[id]), id, new Date(Date.now() + 3600000)]);
  }
  const call = (actor, method, path, body) => h.call(null, method, path, body, { cookie: `digiq_session=${tokens[actor]}` });
  return { h, call, tokens };
}
test("native-only reviewed removal commits anonymous shared care and a replayable receipt, rejecting late identity writes", async () => {
  const { h, call } = await fixture();
  try {
    const path = "/management/system-users/rec";
    for (const role of ["adm", "docu", "rec", "patu"])
      assert.equal((await call(role, "GET", path + "/deletion-impact")).status, 403);
    assert.equal((await h.call("sa", "GET", path + "/deletion-impact")).status, 401, "test actor header is not a native session");
    await h.pg.exec(`insert into settings(id,data) values ('workspace:rec','{"private":"preferences"}'),
      ('custom-roles','{"revision":0,"roles":[],"bindings":[{"userId":"rec","roleId":"custom"},{"userId":"rec2","roleId":"other"}]}');
      insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key)
      values('preserved-document','p1','c1','rec','Clinical findings','application/pdf',17,'local','clinical-kept');`);
    const clinicalBefore = (await h.pg.query(`select id,patient_id,doctor_id,clinic_id,branch_id,date,status,token_number,data
      from appointments order by id`)).rows;
    const impact = await call("sa", "GET", path + "/deletion-impact");
    assert.equal(impact.status, 200, JSON.stringify({ body: impact.data, errors: h.errors.map(e => e.message) }));
    assert.equal(impact.data.ready, true, JSON.stringify(impact.data.blockers));
    const input = { version: impact.data.version, reviewToken: impact.data.reviewToken, confirmation: "delete" };
    for (const confirmation of ["Delete", "DELETE", " delete", "delete ", ""]) {
      assert.equal((await call("sa", "POST", path + "/permanent-removal", { ...input, confirmation })).status, 400);
      assert.equal((await h.pg.query(`select count(*)::int n from users where id='rec'`)).rows[0].n, 1);
    }
    const result = await call("sa", "POST", path + "/permanent-removal", input);
    assert.equal(result.status, 200, JSON.stringify({ body: result.data, errors: h.errors.map(e => e.message) }));
    assert.equal(result.data.accountRemoved, true);
    assert.equal(result.data.state, "complete");
    assert.equal(result.data.operationId, impact.data.operationId);
    assert.equal((await h.pg.query(`select count(*)::int n from users where id='rec'`)).rows[0].n, 0);
    assert.equal((await h.pg.query(`select count(*)::int n from auth_sessions where user_id='rec'`)).rows[0].n, 0);
    assert.deepEqual((await h.pg.query(`select id,patient_id,doctor_id,clinic_id,branch_id,date,status,token_number,data
      from appointments order by id`)).rows, clinicalBefore);
    assert.ok((await h.pg.query(`select actor_id,deleted_actor from appointment_history where id='h1'`)).rows.every(r => r.actor_id === null && r.deleted_actor));
    const document = (await h.pg.query(`select * from patient_documents where id='preserved-document'`)).rows[0];
    assert.equal(document.uploaded_by, null); assert.equal(document.deleted_uploader, true);
    assert.equal(document.name, "Clinical findings"); assert.equal(document.storage_key, "clinical-kept");
    assert.deepEqual((await h.pg.query(`select data from settings where id='custom-roles'`)).rows[0].data.bindings, [{ userId: "rec2", roleId: "other" }]);
    assert.equal((await call("rec", "GET", "/management/system-users")).status, 401);
    assert.deepEqual((await call("sa", "POST", path + "/permanent-removal", input)).data, result.data);
    assert.deepEqual((await call("sa", "GET", "/management/staff-removals/" + result.data.operationId)).data, result.data);
    await assert.rejects(h.pg.exec(`insert into settings(id,data) values('workspace:rec','{}')`), /removed staff identity/);
    await assert.rejects(h.pg.exec(`insert into settings(id,data) values('late-private','{"actorId":"rec"}')`), /removed staff identity/);
    // A fresh identity using the same contact is not the deleted identity.
    await h.pg.exec(`insert into users(id,email,full_name,role,status,managing_admin_id)
      values('new-native-rec','rec@test.invalid','New fictional staff','receptionist','inactive','adm')`);
  } finally { await h.close(); }
});

test("same-count changes, lost sessions, blockers and protected targets reject without removing accounts", async () => {
  const { h, call } = await fixture();
  try {
    const path = "/management/system-users/rec";
    const review = (await call("sa", "GET", path + "/deletion-impact")).data;
    await h.pg.exec(`update appointment_history set from_status='waiting' where id='h1'`);
    const stale = await call("sa", "POST", path + "/permanent-removal",
      { version: review.version, reviewToken: review.reviewToken, confirmation: "delete" });
    assert.equal(stale.status, 409, JSON.stringify(stale.data));
    for (const target of ["sa", "patu", "docu", "adm"]) {
      const result = await call("sa", "GET", `/management/system-users/${target}/deletion-impact`);
      assert.equal(result.data.ready, false, target);
      assert.equal(result.data.reviewToken, null);
    }
    const current = (await call("sa", "GET", path + "/deletion-impact")).data;
    await h.pg.exec(`update auth_sessions set revoked_at=now() where user_id='sa'`);
    assert.equal((await call("sa", "POST", path + "/permanent-removal",
      { version: current.version, reviewToken: current.reviewToken, confirmation: "delete" })).status, 401);
    assert.equal((await h.pg.query(`select count(*)::int n from users where id='rec'`)).rows[0].n, 1);
  } finally { await h.close(); }
});

test("a failure after relational and private cleanup rolls every account and shared-record write back", async () => {
  const { h, tokens } = await fixture();
  try {
    await h.pg.exec(`insert into settings(id,data) values('workspace:rec','{"private":"kept on rollback"}');
      create function fixture_abort_removal() returns trigger language plpgsql as $$ begin
        if OLD.id='rec' then raise exception 'injected final-delete failure'; end if; return OLD; end $$;
      create trigger fixture_abort before delete on users for each row execute function fixture_abort_removal();`);
    const before = (await h.pg.query(`select jsonb_build_object('users',(select jsonb_agg(to_jsonb(r) order by id) from users r),
      'sessions',(select jsonb_agg(to_jsonb(r) order by token_hash) from auth_sessions r),
      'settings',(select jsonb_agg(to_jsonb(r) order by id) from settings r),
      'visits',(select jsonb_agg(to_jsonb(r) order by id) from appointments r),
      'history',(select jsonb_agg(to_jsonb(r) order by id) from appointment_history r)) as snapshot`)).rows[0].snapshot;
    const context = { actorId: "sa", targetId: "rec", sessionHash: hash(tokens.sa) };
    const review = await h.removals.review(context);
    assert.equal(review.ready, true, JSON.stringify(review.blockers));
    await assert.rejects(h.removals.commit(context, { version: review.version, reviewToken: review.reviewToken,
      confirmation: "delete" }), error => /injected final-delete failure/.test(error.cause?.message || error.message));
    const after = (await h.pg.query(`select jsonb_build_object('users',(select jsonb_agg(to_jsonb(r) order by id) from users r),
      'sessions',(select jsonb_agg(to_jsonb(r) order by token_hash) from auth_sessions r),
      'settings',(select jsonb_agg(to_jsonb(r) order by id) from settings r),
      'visits',(select jsonb_agg(to_jsonb(r) order by id) from appointments r),
      'history',(select jsonb_agg(to_jsonb(r) order by id) from appointment_history r)) as snapshot`)).rows[0].snapshot;
    assert.deepEqual(after, before);
    assert.equal((await h.pg.query("select count(*)::int n from staff_deletion_receipts")).rows[0].n, 0);
    assert.equal((await h.pg.query("select count(*)::int n from staff_erased_identities")).rows[0].n, 0);
  } finally { await h.close(); }
});

test("independent reference writers visibly wait on the removal graph and active dispatch prevents removal", async () => {
  const { h, tokens } = await fixture();
  const context = { actorId: "sa", targetId: "rec", sessionHash: hash(tokens.sa) };
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const dispatch = h.staffDispatch(["rec"], async () => { started(); await held; return "done"; });
  try {
    await entered;
    let current = await h.removals.review(context);
    assert.equal(current.ready, false);
    assert.ok(current.blockers.some(b => /dispatch|operation.*active|uncertain/i.test(b.message)));
    release(); await dispatch;
    current = await h.removals.review(context);
    assert.equal(current.ready, true, JSON.stringify(current.blockers));
    const earlierWriter = await h.pool.connect();
    try {
      await earlierWriter.query("begin");
      await earlierWriter.query(`update users set full_name='Uncommitted fictional edit' where id='rec'`);
      const beforeBusy = Date.now();
      await assert.rejects(h.removals.commit(context, { version: current.version,
        reviewToken: current.reviewToken, confirmation: "delete" }), /processing another write/);
      assert.ok(Date.now() - beforeBusy < 2500, "must reject rather than deadlock behind a pre-existing write");
    } finally { await earlierWriter.query("rollback"); earlierWriter.release(); }
    let unlock, locked;
    const graphReady = new Promise(resolve => { locked = resolve; });
    const graphHeld = new Promise(resolve => { unlock = resolve; });
    const barrier = h.removals.lock(async () => { locked(); await graphHeld; });
    await graphReady;
    const writer = await h.pool.connect();
    try {
      const pid = (await writer.query("select pg_backend_pid() as pid")).rows[0].pid;
      const write = writer.query(`insert into settings(id,data) values('late-pii','{"actorId":"rec"}')`);
      let observed = false;
      for (let i = 0; i < 40; i++) {
        const state = await h.pg.query("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
        if (state.rows[0]?.wait_event_type === "Lock") { observed = true; break; }
        await new Promise(r => setTimeout(r, 25));
      }
      assert.equal(observed, true, "must observe a real independent PostgreSQL lock wait, not concurrent promises");
      unlock(); await barrier; await write;
    } finally { unlock(); writer.release(); }
    await assert.rejects(h.removals.commit(context, { version: current.version,
      reviewToken: current.reviewToken, confirmation: "delete" }), /impact changed/);
    assert.equal((await h.pg.query(`select count(*)::int n from users where id='rec'`)).rows[0].n, 1);
  } finally { release(); await dispatch.catch(() => {}); await h.close(); }
});

test("exclusive files have durable postcommit pending receipts, shared files survive and encrypted history cannot resurrect", async () => {
  const { h, tokens } = await fixture();
  const context = { actorId: "sa", targetId: "rec", sessionHash: hash(tokens.sa) };
  try {
    const exclusive = "20000000-0000-4000-8000-000000000001", shared = "20000000-0000-4000-8000-000000000002";
    for (const id of [exclusive, shared])
      await h.pg.query(`insert into settings(id,data) values($1,$2)`, ["logo:" + id,
        { ownerId: "rec", provider: "local", state: "ready", objectPath: id + ".png", expiresAt: 0 }]);
    await h.pg.query(`update clinics set data=data || $1::jsonb where id='c1'`, [{ logoUrl: `https://fixture.invalid/api/logos/${shared}` }]);
    const notification = { channel: "email", source: "appointment", event: "booking", clinicId: "c1",
      _sourceInput: { snapshot: { id: "a1", actorId: "rec", doctorId: "d1" } }, recipientGroup: "patient" };
    await h.recordHistory("fixture-shared-history", notification, "sent", { body: "Fictional generated notice", recipient: "patient@test.invalid" });
    const review = await h.removals.review(context);
    assert.equal(review.ready, true, JSON.stringify(review.blockers));
    const receipt = await h.removals.commit(context, { version: review.version, reviewToken: review.reviewToken, confirmation: "delete" });
    assert.equal(receipt.accountRemoved, true); assert.equal(receipt.state, "cleanup_pending"); assert.equal(receipt.files, 1);
    const sharedRow = (await h.pg.query("select data from settings where id=$1", ["logo:" + shared])).rows[0].data;
    assert.equal(sharedRow.ownerId, null); assert.equal(sharedRow.deletedOwner, true);
    assert.equal((await h.pg.query("select count(*)::int n from settings where id=$1", ["logo:" + exclusive])).rows[0].n, 0);
    const attempted = [];
    const pending = await h.removals.retry(receipt.operationId, async (job, referenced) => {
      attempted.push(job.key); assert.equal(await referenced(job), false);
      return { state: "pending", reason: "STORAGE_UNAVAILABLE" };
    });
    assert.equal(pending.state, "cleanup_pending");
    assert.deepEqual(attempted, [exclusive + ".png"]);
    const completed = await h.removals.retry(receipt.operationId, async (job, referenced) => {
      assert.equal(await referenced(job), false); return { state: "complete" };
    });
    assert.equal(completed.state, "complete"); assert.equal(completed.verifiedFiles, 1);
    const rawReceipt = (await h.pg.query("select encrypted_jobs from staff_deletion_receipts where id=$1", [receipt.operationId])).rows[0];
    assert.equal(rawReceipt.encrypted_jobs, null);
    const history = (await h.pg.query(`select id,data from settings where id like 'notification-history:%'`)).rows;
    assert.ok(history.length);
    for (const row of history) {
      assert.deepEqual(row.data, { erased: true, reason: "staff_account_removed" });
      await assert.rejects(h.pg.query(`delete from settings where id=$1`, [row.id]), /Erased message claims/);
    }
    await h.recordHistory("fixture-shared-history", notification, "sent", { body: "Late cached private name", recipient: "patient@test.invalid" });
    assert.deepEqual((await h.pg.query("select data from settings where id=$1", [history[0].id])).rows[0].data, history[0].data);
    await assert.rejects(h.staffDispatch(["rec"], async () => assert.fail("must not send after account removal")), /no longer available/);
    await assert.rejects(h.pg.query(`update clinics set data=data || $1::jsonb where id='c1'`,
      [{ logoUrl: `https://fixture.invalid/api/logos/${exclusive}` }]), /erased asset/);
  } finally { await h.close(); }
});
