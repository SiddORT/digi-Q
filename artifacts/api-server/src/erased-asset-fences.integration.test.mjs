import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("asset tombstones prevent plain and encrypted reintroduction without retaining paths", async () => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "5".repeat(64);
  const h = await createFeatureHarness({ postgres: true, deletion: true, fakeBookingMail: true });
  try {
    await seedFeatureFixtures(h.pg);
    const assetId = "20000000-0000-4000-8000-000000000001";
    const sha = value => createHash("sha256").update(value).digest("hex");
    const operation = "20000000-0000-4000-8000-000000000002";
    await h.pg.query(`insert into staff_deletion_receipts(id,account_fingerprint,review_hash,state,file_count,verified_count,completed_at)
      values($1,$2,$3,'complete',0,0,now())`, [operation, sha("fictional-already-removed"), "a".repeat(64)]);
    await h.pg.query(`insert into staff_erased_assets(asset_fingerprint,operation_id) values($1,$2)`, [sha(assetId), operation]);
    const variants = [assetId, assetId.toUpperCase(), assetId.replaceAll("-", "%2D"), assetId.replaceAll("-", "&#45;")];
    for (const value of variants) {
      await assert.rejects(h.pg.query(`update clinics set data=data || jsonb_build_object('logoUrl',$1::text) where id='c1'`,
        [`https://fictional.invalid/api/branding/logos/${value}`]), /erased asset cannot be referenced/);
    }
    await assert.rejects(h.pg.exec(`delete from staff_erased_assets`), /immutable/);
    await h.recordHistory("late-cached-asset", { channel: "email", event: "cancellation", source: "appointment",
      clinicId: "c1", _sourceInput: { snapshot: { actorId: "sa" } } }, "sent",
      { sender: "fictional@example.test", recipient: "patient@example.test", subject: "Cached render",
        body: `https://fictional.invalid/api/branding/logos/${assetId}` });
    assert.equal((await h.pg.query(`select count(*)::int as n from settings where id like 'notification-history:%'`)).rows[0].n, 0,
      "a stale private envelope must not hide an erased locator from database guards");
    assert.deepEqual(Object.keys((await h.pg.query(`select * from staff_erased_assets`)).rows[0]).sort(),
      ["asset_fingerprint", "created_at", "operation_id"]);
    await h.pg.exec(`update clinics set data=data || '{"unrelated":"preserved"}'::jsonb where id='c1'`);
  } finally { await h.close(); }
});
