import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("registry upgrade preserves preexisting metadata, old provider keys and deletion history", async () => {
  const pg = new PGlite();
  try {
    const directory = new URL("../../../lib/db/drizzle/", import.meta.url);
    const journal = JSON.parse(await readFile(new URL("meta/_journal.json", directory), "utf8"));
    const upgrade = journal.entries.findIndex(e => e.tag === "0024_private_file_registry");
    assert.ok(upgrade > 0);
    for (const entry of journal.entries.slice(0, upgrade))
      await pg.exec(await readFile(new URL(entry.tag + ".sql", directory), "utf8"));
    await seedFeatureFixtures(pg);
    await pg.exec(`insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key,status,deleted_at)
      values ('old-local','p1','c1','rec','old.txt','text/plain',7,'local','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','active',null),
      ('old-object','p1','c1','rec','old.pdf','application/pdf',10,'object','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','deleted',now())`);
    const before = (await pg.query("select * from patient_documents order by id")).rows;
    await pg.exec(await readFile(new URL("0024_private_file_registry.sql", directory), "utf8"));
    const after = (await pg.query("select * from patient_documents order by id")).rows;
    for (let i = 0; i < before.length; i++) {
      for (const [key, value] of Object.entries(before[i])) assert.deepEqual(after[i][key], value, key);
      assert.equal(after[i].registry_version, 0);
      assert.equal(after[i].deleted_from, null);
      assert.equal(after[i].digest, null, "no invented proof of historical bytes");
    }
    await pg.exec(await readFile(new URL("0025_private_file_s3.sql", directory), "utf8"));
    assert.deepEqual((await pg.query("select * from patient_documents order by id")).rows, after,
      "S3 provider allowlist extension leaves all historical data unchanged");
    assert.equal((await pg.query(`select count(*)::int n from pg_trigger where tgrelid='patient_documents'::regclass and tgname in
      ('erased_asset_reference_guard','erased_staff_reference_guard','private_file_identity_guard')`)).rows[0].n, 3);
  } finally { await pg.close(); }
});
