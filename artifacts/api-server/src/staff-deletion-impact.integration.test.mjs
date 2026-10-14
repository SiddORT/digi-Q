import { test } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("impact is live, role-gated, versioned and fails closed on new references", async () => {
  const h = await createFeatureHarness({ deletion: true });
  try {
    await seedFeatureFixtures(h.pg);
    for (const actor of [null, "adm", "docu", "rec", "patu"])
      await assert.rejects(h.staffDeletionImpact(actor, "docu"), /Real Superadmin/);
    const first = await h.staffDeletionImpact("sa", "docu");
    assert.equal(first.ready, false);
    assert.ok(first.blockers.some(b => b.code === "IMPLEMENTATION_GATED"));
    assert.ok(first.blockers.some(b => b.code === "OPEN_VISITS" && b.ids.includes("a1")));
    assert.ok(!first.blockers.some(b => b.code === "UNKNOWN_RELATION"));
    assert.equal(first.groups.find(g => g.source === "doctor:appointments").count, 4);
    assert.equal(first.version, (await h.staffDeletionImpact("sa", "docu")).version);
    await h.pg.exec(`update appointment_history set from_status='called' where id='h2'`);
    assert.notEqual((await h.staffDeletionImpact("sa", "docu")).version, first.version, "same row counts must not validate stale review");
    await h.pg.exec(`create table unexpected_staff_links (id text primary key, user_id text references users(id))`);
    const unknown = await h.staffDeletionImpact("sa", "docu");
    assert.ok(unknown.blockers.some(b => b.code === "UNKNOWN_RELATION" && b.source === "unexpected_staff_links.user_id"));
    await h.pg.exec(`create schema integration_shadow;
      create table integration_shadow.staff_links(id text primary key,user_id text references public.users(id));`);
    assert.ok((await h.staffDeletionImpact("sa", "docu")).blockers.some(b =>
      b.code === "UNKNOWN_RELATION" && b.source === "integration_shadow.staff_links.user_id"));
    await h.pg.exec(`insert into settings(id,data) values ('future-feature','{"createdBy":"docu"}'),('notification-history:unknown','{"encrypted":"unreadable"}')`);
    const json = await h.staffDeletionImpact("sa", "docu");
    assert.ok(json.blockers.some(b => b.code === "JSON_REFERENCE_REVIEW"));
    assert.ok(json.blockers.some(b => b.code === "ENCRYPTED_HISTORY_REVIEW"));
    assert.equal((await h.pg.query(`select count(*)::int n from users`)).rows[0].n, 10, "read-only planning never removes data");
    const self = await h.staffDeletionImpact("sa", "sa");
    assert.ok(self.blockers.some(b => b.code === "SELF_DELETION"));
    assert.ok(self.blockers.some(b => b.code === "LAST_SUPERADMIN"));
    assert.ok((await h.staffDeletionImpact("sa", "patu")).blockers.some(b => b.code === "PATIENT_ACCOUNT"));
  } finally {
    await h.close();
  }
});
