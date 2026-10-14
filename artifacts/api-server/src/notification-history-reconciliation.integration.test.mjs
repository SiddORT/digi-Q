// Real isolated PostgreSQL, native sessions, actual routers. No real records or transports.
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32);
let h;
const tokens = new Map();
const path = "/management/system-users/docu/notification-history-review";
const headers = actor => actor ? { cookie: `digiq_session=${tokens.get(actor)}` } : {};
const call = (method, suffix = "", body, actor = "sa", target = "docu") =>
  h.call(null, method, `/management/system-users/${target}/notification-history-review${suffix}`, body, headers(actor));
const row = async id => (await h.pg.query("select data from settings where id=$1", [id])).rows[0]?.data;
async function capture(job, snapshots = false) {
  const id = "notification-history:" + createHash("sha256").update(job).digest("hex");
  const entry = { channel: "sms", event: "booking", source: "automatic", clinicId: "c1", recipientGroup: "patient",
    _sourceInput: { snapshot: { doctorId: "d1", actorId: "rec" }, recipientGroup: "patient" } };
  await h.recordHistory(job, entry, "sending", { recipient: "patient@test.invalid", message: "Original fictional visit" });
  if (snapshots) {
    await h.recordHistory(job, entry, "pre_dispatch_failed");
    await h.recordHistory(job, entry, "sending", { recipient: "patient@test.invalid", message: "Earlier and current captures must both be covered" });
  }
  const original = await row(id);
  assert(h.historyProvenance.verifyHistorySubjects(id, original));
  const current = structuredClone(original);
  delete current.provenance;
  await h.pg.query("update settings set data=$2 where id=$1", [id, JSON.stringify(current)]);
  const version = (await call("GET")).data.items.find(item => item.id === id)?.version;
  assert(version, "fixture must appear in the bounded review page");
  return { id, original, current, input: { historyId: id, version, evidence: JSON.stringify({ id, data: original }) } };
}
before(async () => {
  h = await createFeatureHarness({ administration: true, bookingLookups: true, deletion: true, postgres: true });
  await seedFeatureFixtures(h.pg);
  for (const actor of ["sa", "adm", "docu", "rec", "patu"]) {
    const value = randomBytes(32).toString("base64url"); tokens.set(actor, value);
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",
      [createHash("sha256").update(value).digest("hex"), actor, new Date(Date.now() + 3600000)]);
  }
});
beforeEach(async () => { await h.pg.query("delete from auth_rate_limits"); });
after(async () => { if (h) await h.close(); });

test("review and all write endpoints require an active native non-demo Superadmin; projections contain no private snapshots", async () => {
  const f = await capture("authorization");
  for (const actor of [null, "adm", "docu", "rec", "patu"])
    assert.equal((await call("GET", "", undefined, actor)).status, actor ? 403 : 401);
  for (const action of ["preview", "restore", "unresolved", "scan"])
    assert.equal((await call("POST", `/${action}`, f.input, "adm")).status, 403);
  const response = await call("GET");
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
  const serialized = JSON.stringify(response.data);
  for (const privateValue of ["patient@test.invalid", "Original fictional", f.current.encrypted, "recipientHash", "senderHash"])
    assert(!serialized.includes(privateValue));
  assert.equal((await call("GET", "", undefined, "sa", "patu")).status, 400);
  await h.pg.query("update users set data=data||'{\"demo\":true}'::jsonb where id='sa'");
  assert.equal((await call("GET")).status, 403);
  await h.pg.query("update users set data=data-'demo' where id='sa'");
});

test("complete original signed captures restore ownership without deleting or altering care or envelopes", async () => {
  const f = await capture("matching-original", true);
  const before = await row(f.id);
  const impacts = await h.call(null, "GET", "/management/system-users/docu/deletion-impact", undefined, headers("sa"));
  assert(impacts.data.blockers.some(b => b.code === "ENCRYPTED_HISTORY_REVIEW" && b.ids.includes(f.id)));
  const result = await call("POST", "/preview", f.input);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.status, "eligible"); assert.equal(result.data.ownership, "includes_target");
  assert(result.data.envelopeCount >= 3); assert.equal(result.data.subjectCount, 2);
  assert.deepEqual(await row(f.id), before, "preview is strictly read-only");
  assert.equal((await call("POST", "/restore", { ...f.input, reviewToken: result.data.reviewToken, confirmation: "restore" })).status, 200);
  const restored = await row(f.id);
  assert.deepEqual(restored, f.original, "restore copies the original MAC only");
  assert.equal(h.historyProvenance.classifyHistoryForRemoval(f.id, restored, h.historyProvenance.accountSubjectFingerprint("docu")), "erase");
  assert.equal(h.historyProvenance.classifyHistoryForRemoval(f.id, restored, h.historyProvenance.accountSubjectFingerprint("adm")), "preserve");
  assert.equal((await h.pg.query("select count(*)::int n from users where id='docu'")).rows[0].n, 1);
  const refreshed = await h.call(null, "GET", "/management/system-users/docu/deletion-impact", undefined, headers("sa"));
  assert(!refreshed.data.blockers.some(b => b.code === "ENCRYPTED_HISTORY_REVIEW" && b.ids.includes(f.id)));
});

test("unsigned, mismatched, partial historical, cross-record and conflicting source evidence never receives a new proof", async () => {
  const f = await capture("unsafe-evidence", true);
  const variants = [
    { id: f.id, data: f.current },
    { id: f.id, data: { ...f.original, clinicId: "different-clinic" } },
    { id: f.id, data: { ...f.original, snapshots: [] } },
    { id: "notification-history:" + "f".repeat(64), data: f.original },
  ];
  const conflicting = structuredClone(f.original);
  conflicting.provenance = h.historyProvenance.signHistorySubjects(f.id, conflicting, ["adm"]);
  variants.push([{ id: f.id, data: f.original }, { id: f.id, data: conflicting }]);
  const removedSubject = structuredClone(f.original);
  removedSubject.provenance = h.historyProvenance.signHistorySubjects(f.id, removedSubject, ["docu", "removed-earlier"]);
  variants.push({ id: f.id, data: removedSubject });
  for (const evidence of variants) {
    const response = await call("POST", "/preview", { ...f.input, evidence: JSON.stringify(evidence) });
    assert.equal(response.status, 200);
    assert.equal(response.data.status, "unresolved"); assert.equal(response.data.reviewToken, null);
    assert.deepEqual(await row(f.id), f.current);
  }
  assert.equal((await call("POST", "/restore", { ...f.input, reviewToken: "invented", confirmation: "restore" })).status, 409);
  const unreadable = { ...f.current, encrypted: "unreadable-envelope" };
  unreadable.provenance = h.historyProvenance.signHistorySubjects(f.id, unreadable, ["docu"]);
  await h.pg.query("update settings set data=$2 where id=$1", [f.id, JSON.stringify({ ...unreadable, provenance: undefined })]);
  const current = (await call("GET")).data.items.find(x => x.id === f.id);
  const response = await call("POST", "/preview", { historyId: f.id, version: current.version, evidence: JSON.stringify({ id: f.id, data: unreadable }) });
  assert.equal(response.data.status, "unresolved"); assert.match(response.data.reason, /envelope/);
});

test("explicit unresolved decisions are safe metadata only and never clear a deletion blocker", async () => {
  const f = await capture("unresolved");
  assert.equal((await call("POST", "/unresolved", { historyId: f.id, version: f.input.version, reason: "original_missing" })).status, 200);
  assert.deepEqual(await row(f.id), f.current);
  const listed = (await call("GET")).data.items.find(x => x.id === f.id);
  assert.equal(listed.status, "unresolved"); assert.equal(listed.unresolvedReason, "original_missing");
  const notes = (await h.pg.query("select data from settings where id like 'notification-history-reconciliation:%'")).rows;
  for (const note of notes) {
    const text = JSON.stringify(note.data);
    assert(!text.includes(f.current.encrypted)); assert(!text.includes("patient@test.invalid"));
    assert(!text.includes('"sa"')); assert(!text.includes('"docu"'));
  }
  const impact = await h.call(null, "GET", "/management/system-users/docu/deletion-impact", undefined, headers("sa"));
  assert(impact.data.blockers.some(b => b.code === "ENCRYPTED_HISTORY_REVIEW" && b.ids.includes(f.id)));
  await h.pg.query("update settings set data=data||'{\"lateMetadata\":\"changed\"}'::jsonb where id=$1", [f.id]);
  assert.equal((await call("GET")).data.items.find(x => x.id === f.id).status, "blocked", "a decision cannot carry over to changed data");
  assert.equal((await call("POST", "/unresolved", { historyId: f.id, version: f.input.version, reason: "original_missing" })).status, 409);
});

test("fresh confirmation binds original evidence, target, session and full record; concurrent writers fail closed", async () => {
  const f = await capture("late-writer");
  const reviewed = await call("POST", "/preview", f.input);
  const commit = { ...f.input, reviewToken: reviewed.data.reviewToken, confirmation: "restore" };
  const { createHmac } = await import("node:crypto");
  const expired = JSON.parse(Buffer.from(commit.reviewToken.split(".")[0], "base64url").toString());
  expired.expiresAt = Date.now() - 1;
  const expiredBody = Buffer.from(JSON.stringify(expired)).toString("base64url");
  const expiredMac = createHmac("sha256", Buffer.from("ab".repeat(32), "hex")).update("history-reconciliation:" + expiredBody).digest("hex");
  assert.equal((await call("POST", "/restore", { ...commit, reviewToken: expiredBody + "." + expiredMac })).status, 409);
  assert.equal((await call("POST", "/restore", { ...commit, confirmation: "delete" })).status, 400);
  assert.equal((await call("POST", "/restore", commit, "sa", "rec")).status, 409);
  const otherEvidence = JSON.stringify([{ id: f.id, data: f.original }, { id: f.id, data: f.original }]);
  assert.equal((await call("POST", "/restore", { ...commit, evidence: otherEvidence })).status, 409);
  const secondToken = randomBytes(32).toString("base64url");
  await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,'sa',$2)",
    [createHash("sha256").update(secondToken).digest("hex"), new Date(Date.now() + 3600000)]);
  assert.equal((await h.call(null, "POST", path + "/restore", commit, { cookie: `digiq_session=${secondToken}` })).status, 409);
  const writer = await h.pool.connect();
  try {
    await writer.query("begin");
    await writer.query("select pg_advisory_xact_lock(hashtext($1))", [f.id]);
    assert.equal((await call("POST", "/restore", commit)).status, 409, "a competing writer must not be waited on");
    await writer.query("rollback");
    await writer.query("begin");
    await writer.query("select data from settings where id=$1 for update", [f.id]);
    assert.equal((await call("POST", "/restore", commit)).status, 409, "an old writer with only a row lock must also fail fast");
    await writer.query("update settings set data=data||'{\"lateMetadata\":\"changed\"}'::jsonb where id=$1", [f.id]);
    await writer.query("commit");
  } finally { await writer.query("rollback"); writer.release(); }
  assert.equal((await call("POST", "/restore", commit)).status, 409, "the old token cannot cover a late field or envelope");
  assert.equal(h.historyProvenance.verifyHistorySubjects(f.id, await row(f.id)), null);
});

test("malformed legacy records stay reviewable and malformed anonymous receipts cannot inherit a preservation exemption", async () => {
  const id = "notification-history:" + "b".repeat(64);
  await h.pg.query("insert into settings(id,data) values($1,'null'::jsonb)", [id]);
  const record = (await call("GET")).data.items.find(x => x.id === id);
  assert.equal(record.channel, "unknown");
  assert.equal((await call("POST", "/unresolved", { historyId: id, version: record.version, reason: "unreadable_archive" })).status, 200);
  assert.equal(await row(id), null);
  const note = (await h.pg.query("select id,data from settings where id like 'notification-history-reconciliation:%' limit 1")).rows[0];
  await h.pg.query("update settings set data=data||'{\"extraPrivateField\":\"do not erase\"}'::jsonb where id=$1", [note.id]);
  const impact = await h.call(null, "GET", "/management/system-users/docu/deletion-impact", undefined, headers("sa"));
  assert(impact.data.blockers.some(b => b.code === "SETTINGS_REFERENCE_REVIEW" && b.ids.includes(note.id)));
  await h.pg.query("update settings set data=$2 where id=$1", [note.id, JSON.stringify(note.data)]);
});

test("bounded scans expose later blockers even when the first page contains only verified records", async () => {
  const marker = h.historyProvenance.erasedHistoryMarker();
  for (let i = 0; i < 30; i++)
    await h.pg.query("insert into settings(id,data) values($1,$2)", ["notification-history:" + i.toString(16).padStart(64, "0"), JSON.stringify(marker)]);
  let result = await call("GET");
  assert.equal(result.data.items.length, 0); assert.equal(result.data.scannedCount, 25); assert(result.data.nextCursor);
  result = await call("POST", "/scan", { cursor: result.data.nextCursor });
  assert(result.data.items.length > 0);
  assert.equal((await call("POST", "/scan", { cursor: "invalid" })).status, 400);
});
