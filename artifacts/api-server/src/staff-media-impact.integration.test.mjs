import { test } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("exclusive-media proof protects shared aliases, deleted documents and encrypted historical messages", async () => {
  process.env.MEDIA_STORAGE = "local";
  process.env.MEDIA_ROOT = "/tmp/fictional-deletion-media";
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "4".repeat(64);
  const h = await createFeatureHarness({ postgres: true, deletion: true, fakeBookingMail: true });
  try {
    await seedFeatureFixtures(h.pg);
    const ids = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002", "10000000-0000-4000-8000-000000000003"];
    for (const id of ids) await h.pg.query(`insert into settings(id,data) values($1,$2)`, [
      `logo:${id}`, { provider: "local", ownerId: "docu", state: "ready", validatedPath: `${id}.png`, expiresAt: Date.now() + 900000 },
    ]);
    await h.pg.query(`update clinics set data=data || jsonb_build_object('logoUrl',$1::text) where id='c1'`, [`https://fictional.invalid/clinicflow/api/branding/logos/${ids[1]}?v=2`]);
    await h.pg.query(`insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key,status,deleted_at)
      values('protected-file','p1','c1','docu','Preserved clinical file','image/png',1,'local',$1,'deleted',now())`, [`${ids[2]}.png`]);
    const before = await h.mediaImpact("docu", ["d1"]);
    assert.deepEqual(before.exclusive.map(j => j.key), [`${ids[0]}.png`]);
    assert.equal(before.sharedLogoIds.length, 2);
    await h.recordHistory("fixture-asset-history", { channel: "email", event: "cancellation", source: "appointment", clinicId: "c1",
      reference: "fictional-ref", _sourceInput: { snapshot: { actorId: "sa" } } }, "sent",
      { sender: "fictional@example.test", recipient: "patient@example.test", subject: "Preserved message",
        body: `Logo https://fictional.invalid/api/branding/logos/${ids[0]}`, html: "", previousDetails: "" });
    const after = await h.mediaImpact("docu", ["d1"]);
    assert.equal(after.exclusive.length, 0);
    assert.equal(after.sharedLogoIds.length, 3);
    await h.pg.exec(`update settings set data=data || '{"unproven":"value"}'::jsonb where id like 'notification-history:%'`);
    await assert.rejects(h.mediaImpact("docu", ["d1"]), /Encrypted history prevents/);
    const input = { doctorId: "d1", doctorName: "Fictional doctor", doctorEmail: "staff@example.test",
      patientName: "Fictional doctor", notes: "Clinical narrative signed by Fictional doctor",
      history: [{ actorId: "docu", actorName: "Fictional doctor" }], unknown: { ownerId: "docu" } };
    const erased = h.attribution.eraseStaffAttribution(input, { userId: "docu", doctorIds: new Set(["d1"]) });
    assert.equal(erased.doctorName, "Deleted doctor");
    assert.equal(erased.doctorEmail, undefined);
    assert.equal(erased.notes, input.notes);
    assert.equal(erased.patientName, input.patientName);
    assert.equal(erased.history[0].deletedActor, true);
    assert.deepEqual(h.attribution.unresolvedStaffReferences(erased, "docu"), ["unknown.ownerId"]);
    assert.equal(input.doctorEmail, "staff@example.test", "review must not mutate a cached source object");
  } finally { await h.close(); }
});
