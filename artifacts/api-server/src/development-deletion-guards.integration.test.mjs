import { test } from "node:test";
import assert from "node:assert/strict";
import { developmentGuardSql, sqlStatements } from "../../../scripts/install-dev-deletion-guards.mjs";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("guard extraction preserves function bodies and ignores schema DDL", () => {
  const statements = sqlStatements(`-- leading comment
    CREATE TABLE x(a text);
    CREATE FUNCTION guard() RETURNS trigger AS $body$
    BEGIN PERFORM 'semi;quote''s'; /* nested ; */ RETURN NEW; END;
    $body$ LANGUAGE plpgsql;
    CREATE TRIGGER t BEFORE INSERT ON x FOR EACH ROW EXECUTE FUNCTION guard();`);
  assert.equal(statements.length, 3);
  assert(statements[1].includes("PERFORM 'semi;quote''s'"));
  assert.throws(() => sqlStatements("CREATE FUNCTION x() AS $$ unterminated"), /Unterminated/);
});

test("post-push guard installation is idempotent and preserves strict ownership and retirement", async () => {
  const guards = await developmentGuardSql();
  assert(!/\b(?:ALTER TABLE|CREATE TABLE|CREATE INDEX)\b/i.test(guards.ddl));
  assert(guards.triggers.some(t => t.name === "branches_retired_linked_hours_guard"));
  const h = await createFeatureHarness();
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(guards.ddl); await h.pg.exec(guards.ddl);
    await assert.rejects(h.pg.exec(`update doctors set owner_admin_id='rec' where id='d3'`), /active Clinic Admin/);
    await assert.rejects(h.pg.exec(`update doctors set status='retired',user_id=null,owner_admin_id=null,retired_at=now() where id='d1'`), /Resolve open doctor work/);
    await assert.rejects(h.pg.exec(`update branches set data=data||'{"linkedSchedule":{"enabled":true,"doctorId":"missing-doctor"}}'::jsonb where id='b1'`), /Linked doctor is unavailable/);
  } finally { await h.close(); }
});
