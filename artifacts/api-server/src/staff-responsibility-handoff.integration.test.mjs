import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("clinic handoff atomically keeps all existing scopes and inactive/unassigned dependents", async () => {
  process.env.SESSION_SECRET = "fictional-responsibility-handoff-signing-key-only";
  const h = await createFeatureHarness({ deletion: true, postgres: true });
  try {
    await seedFeatureFixtures(h.pg);
    const hash = createHash("sha256").update("fixture-native-superadmin").digest("hex");
    await h.pg.query(`insert into auth_sessions(token_hash,user_id,expires_at) values($1,'sa',now()+interval '1 day')`, [hash]);
    await h.pg.exec(`insert into users(id,email,full_name,role,status,managing_admin_id)
      values('unassigned-inactive','unassigned@test.invalid','Fixture inactive receptionist','receptionist','inactive','adm');`);
    const before = (await h.pg.query(`select id,user_id,clinic_id,branch_id from assignments where user_id in ('docu','rec','unassigned-inactive') order by id`)).rows;
    const care = (await h.pg.query(`select * from appointments order by id`)).rows;
    const context = { actorId: "sa", sessionHash: hash, targetId: "adm" };
    const review = await h.responsibilityHandoffs.review(context, "adm2");
    assert.ok(review.proposal.staffIds.includes("unassigned-inactive"));
    const result = await h.responsibilityHandoffs.commit(context, review.proposal, review.reviewToken);
    assert.equal(result.clinicCount, 2); assert.equal(result.accountRemoved, false);
    assert.deepEqual((await h.pg.query(`select id,user_id,clinic_id,branch_id from assignments where user_id in ('docu','rec','unassigned-inactive') order by id`)).rows, before);
    assert.deepEqual((await h.pg.query(`select * from appointments order by id`)).rows, care);
    assert.equal((await h.pg.query(`select managing_admin_id,status from users where id='unassigned-inactive'`)).rows[0].status, "inactive");
    assert.equal((await h.pg.query(`select count(*)::int n from doctors where owner_admin_id='adm' and user_id<>'adm'`)).rows[0].n, 0);
    assert.equal((await h.pg.query(`select count(*)::int n from clinics where admin_id='adm'`)).rows[0].n, 0);
    assert.deepEqual(await h.responsibilityHandoffs.commit(context, review.proposal, review.reviewToken), result);
    await assert.rejects(h.pg.exec(`delete from settings where id='staff-handoff:${review.operationId}'`), /cannot be deleted/);
    await assert.rejects(h.pg.exec(`update settings set data=jsonb_set(data,'{sourceFingerprint}',to_jsonb(repeat('0',64))) where id='staff-handoff:${review.operationId}'`), /immutable/);
    assert.equal((await h.pg.query(`select count(*)::int n from users where id='adm'`)).rows[0].n, 1, "handoff is not deletion");
  } finally { await h.close(); }
});
