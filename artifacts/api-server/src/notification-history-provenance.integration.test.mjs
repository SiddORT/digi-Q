import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("source proofs cover all historical envelopes and capture staff identities without storing native IDs", async () => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32); // Disposable fixture key only.
  const h = await createFeatureHarness({ deletion: true });
  try {
    await seedFeatureFixtures(h.pg);
    const p = h.historyProvenance;
    const id = "notification-history:" + "1".repeat(64);
    const body = { channel: "email", event: "booking", source: "automatic", clinicId: "c1",
      recipientGroup: "patient", createdAt: 123, encrypted: "current-envelope",
      snapshots: [{ at: 120, encrypted: "earlier-envelope" }], senderHash: "sender-hash" };
    body.provenance = p.signHistorySubjects(id, body, ["docu", "rec"]);
    assert.deepEqual(p.verifyHistorySubjects(id, body), ["docu", "rec"].map(p.accountSubjectFingerprint).sort());
    assert.equal(p.classifyHistoryForRemoval(id, body, p.accountSubjectFingerprint("docu")), "erase");
    assert.equal(p.classifyHistoryForRemoval(id, body, p.accountSubjectFingerprint("adm2")), "preserve");
    for (const alter of [
      x => { x.encrypted = "changed"; },
      x => { x.snapshots[0].encrypted = "changed"; },
      x => { x.clinicId = "c3"; },
      x => { x.senderHash = "copied-contact"; },
      x => { x.provenance.subjects = []; },
    ]) {
      const copy = structuredClone(body); alter(copy);
      assert.equal(p.classifyHistoryForRemoval(id, copy, p.accountSubjectFingerprint("docu")), "blocked");
    }
    assert.equal(p.verifyHistorySubjects(id.replace("1", "2"), body), null);
    assert.equal(p.classifyHistoryForRemoval(id, { encrypted: "legacy" }, p.accountSubjectFingerprint("docu")), "blocked");

    const job = "fixture-booking-history", historyId = "notification-history:" + createHash("sha256").update(job).digest("hex");
    const entry = { channel: "email", event: "booking", source: "automatic", clinicId: "c1", recipientGroup: "patient",
      _sourceInput: { snapshot: { doctorId: "d1", doctorName: "Dr Meera Rao", actorId: "rec" }, recipientGroup: "patient" } };
    await h.recordHistory(job, entry, "sending", { recipient: "patient@test.invalid", subject: "Visit", message: "Fictional visit snapshot" });
    const stored = (await h.pg.query(`select data from settings where id=$1`, [historyId])).rows[0].data;
    assert.ok(p.verifyHistorySubjects(historyId, stored).includes(p.accountSubjectFingerprint("docu")));
    assert.ok(!JSON.stringify(stored).includes('"docu"'));
    assert.ok(!Object.hasOwn(stored, "_sourceInput"));
    await h.pg.query(`update settings set data=$2 where id=$1`, [historyId, JSON.stringify(p.erasedHistoryMarker())]);
    await h.recordHistory(job, entry, "provider_accepted", { message: "Stale private completion" });
    assert.deepEqual((await h.pg.query(`select data from settings where id=$1`, [historyId])).rows[0].data, p.erasedHistoryMarker());
    await h.recordHistory("late-missing-actor", {
      ...entry, _sourceInput: { snapshot: { actorId: "removed-fixture-user" } },
    }, "sending", { message: "Must not be stored" });
    assert.equal((await h.pg.query(`select count(*)::int n from settings where id=$1`, [
      "notification-history:" + createHash("sha256").update("late-missing-actor").digest("hex"),
    ])).rows[0].n, 0);

    const testJob = "fixture-explicit-test", testId = "notification-history:" + createHash("sha256").update(testJob).digest("hex");
    await h.recordHistory(testJob, { ...entry, source: "test", recipientGroup: "explicit",
      _sourceInput: { snapshot: { actorId: "sa" } } }, "sending", { recipient: "docu@test.invalid", message: "Explicit fixture test" });
    const explicit = (await h.pg.query(`select data from settings where id=$1`, [testId])).rows[0].data;
    assert.ok(p.verifyHistorySubjects(testId, explicit).includes(p.accountSubjectFingerprint("docu")));
  } finally { await h.close(); }
});
