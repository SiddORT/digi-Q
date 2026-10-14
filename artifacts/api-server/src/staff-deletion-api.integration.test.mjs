import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("live impact API requires a real active native Superadmin session and issues no removal authority while gated", async () => {
  const h = await createFeatureHarness({ administration: true, bookingLookups: true });
  const tokens = new Map();
  try {
    await seedFeatureFixtures(h.pg);
    for (const actor of ["sa", "adm", "docu", "rec", "patu"]) {
      const token = randomBytes(32).toString("base64url"); tokens.set(actor, token);
      await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",
        [createHash("sha256").update(token).digest("hex"), actor, new Date(Date.now() + 3600000)]);
    }
    const get = actor => h.call(null, "GET", "/management/system-users/docu/deletion-impact", undefined,
      actor ? { cookie: `digiq_session=${tokens.get(actor)}` } : {});
    assert.equal((await get(null)).status, 401);
    for (const actor of ["adm", "docu", "rec", "patu"]) assert.equal((await get(actor)).status, 403);
    const impact = await get("sa");
    assert.equal(impact.status, 200, h.errors.map(e => e.message).join("; "));
    assert.match(impact.headers.get("cache-control"), /no-store/);
    assert.equal(impact.data.target.id, "docu");
    assert.equal(impact.data.ready, false); assert.equal(impact.data.reviewToken, null);
    assert(impact.data.blockers.some(b => b.code === "OPEN_VISITS"));
    assert.equal((await h.pg.query(`select count(*)::int n from users where id='docu'`)).rows[0].n, 1);
    await h.pg.exec(`update auth_sessions set revoked_at=now() where user_id='sa'`);
    assert.equal((await get("sa")).status, 401, "revoked sessions cannot reuse a cached role");
  } finally { await h.close(); }
});
