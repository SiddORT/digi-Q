import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

const root = resolve(import.meta.dirname, "../../..");
const folder = resolve(root, "lib/db/drizzle");
const { generateDrizzleJson, generateMigration } = createRequire(resolve(root, "lib/db/package.json"))("drizzle-kit/api");
const catalogSql = `
SELECT 'column' AS kind, table_name || '.' || column_name AS name,
  json_build_array(data_type, is_nullable, column_default)::text AS definition
FROM information_schema.columns WHERE table_schema='public'
-- 0012 uses PostgreSQL's inline-reference names; Drizzle's equivalent DDL uses
-- explicit names. Normalize only these two historical aliases, never definitions.
UNION ALL SELECT 'constraint', c.relname || '.' || CASE
  WHEN c.relname = 'auth_sessions' AND con.conname = 'auth_sessions_user_id_fkey' THEN 'auth_sessions_user_id_users_id_fk'
  WHEN c.relname = 'auth_challenges' AND con.conname = 'auth_challenges_user_id_fkey' THEN 'auth_challenges_user_id_users_id_fk'
  ELSE con.conname END, pg_get_constraintdef(con.oid)
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND con.contype <> 't'
UNION ALL SELECT 'index', tablename || '.' || indexname, indexdef FROM pg_indexes WHERE schemaname='public'
ORDER BY kind, name`;

test("actual full journal migrates empty PostgreSQL, replays unchanged, and matches current schema", async () => {
  const h = await createQueueHarness({ empty: true });
  const bundle = resolve(root, `artifacts/api-server/.migration-schema-${process.pid}.mjs`);
  try {
    const journal = JSON.parse(await readFile(resolve(folder, "meta/_journal.json"), "utf8"));
    const files = (await readdir(folder)).filter(f => f.endsWith(".sql")).sort();
    assert.deepEqual(journal.entries.map(e => `${e.tag}.sql`), files, "all checked-in SQL is journaled in order");
    await migrate(h.db, { migrationsFolder: folder });
    const first = (await h.control.query(catalogSql)).rows;
    const ledger = (await h.control.query("select hash, created_at from drizzle.__drizzle_migrations order by created_at")).rows;
    assert.equal(ledger.length, files.length);
    const customBefore = (await h.control.query(`
      SELECT tgname, pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY tgname`)).rows;
    assert.equal(customBefore.length, 10, "all custom guard triggers installed");
    await h.control.query("INSERT INTO patients(id,mobile) VALUES ('migration-preserved',''),('migration-null',NULL)");
    await migrate(h.db, { migrationsFolder: folder });
    assert.deepEqual((await h.control.query(catalogSql)).rows, first);
    assert.deepEqual((await h.control.query("select hash, created_at from drizzle.__drizzle_migrations order by created_at")).rows, ledger);
    assert.deepEqual((await h.control.query(`
      SELECT tgname, pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY tgname`)).rows, customBefore);
    assert.deepEqual((await h.control.query("SELECT id,mobile FROM patients ORDER BY id")).rows,
      [{ id: "migration-null", mobile: null }, { id: "migration-preserved", mobile: "" }]);
    // Settings live in the already-existing JSON document: runtime can read old
    // records before migration without selecting any not-yet-existing columns.
    await h.control.query("INSERT INTO users(id,email,full_name,role) VALUES ('formats-admin','formats@example.test','Format Admin','clinicAdmin')");
    await h.control.query(`INSERT INTO clinics(id,admin_id,data) VALUES
      ('formats-default','formats-admin','{"name":"Format Default","timezone":"Asia/Kolkata"}'),
      ('formats-custom','formats-admin','{"name":"Format Custom","dateFormat":"MM/DD/YYYY","timeFormat":"24h"}'),
      ('formats-partial','formats-admin','{"name":"Format Partial","dateFormat":"YYYY-MM-DD"}')`);
    const formatMigration = await readFile(resolve(folder, "0013_clinic_display_preferences.sql"), "utf8");
    await h.control.query(formatMigration);
    const formatRows = (await h.control.query("SELECT id,data FROM clinics WHERE id LIKE 'formats-%' ORDER BY id")).rows;
    assert.deepEqual(formatRows.map(r => [r.id, r.data.dateFormat, r.data.timeFormat]), [
      ["formats-custom", "MM/DD/YYYY", "24h"], ["formats-default", "DD MMM YYYY", "12h"], ["formats-partial", "YYYY-MM-DD", "12h"],
    ]);
    assert.equal(formatRows[1].data.timezone, "Asia/Kolkata");
    await h.control.query(formatMigration);
    assert.deepEqual((await h.control.query("SELECT id,data FROM clinics WHERE id LIKE 'formats-%' ORDER BY id")).rows, formatRows);
    // The additive contract repair is itself safe to repeat and preserves data.
    await h.control.query(await readFile(resolve(folder, "0011_patient_mobile_nullable.sql"), "utf8"));
    assert.deepEqual((await h.control.query("SELECT id,mobile FROM patients ORDER BY id")).rows,
      [{ id: "migration-null", mobile: null }, { id: "migration-preserved", mobile: "" }]);
    await build({ entryPoints: [resolve(root, "lib/db/src/schema/index.ts")], outfile: bundle,
      bundle: true, platform: "node", format: "esm", packages: "external" });
    const schema = await import(bundle);
    const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
    await h.control.query("CREATE DATABASE schema_expected");
    const expected = await h.connect("schema_expected");
    // Drizzle's empty snapshot generator emits composite FKs before the unique
    // indexes they reference; execute that generated DDL in dependency order.
    for (const statement of statements.filter(s => !s.includes("FOREIGN KEY"))) await expected.query(statement);
    for (const statement of statements.filter(s => s.includes("FOREIGN KEY"))) await expected.query(statement);
    const wanted = (await expected.query(catalogSql)).rows;
    // Optional audit-only input: a catalog JSON snapshot obtained separately via
    // the read-only database skill. Never connect tests/runtime to a live DB.
    if (process.env.CLINICFLOW_CATALOG_DIAGNOSTIC_FILE) {
      const live = JSON.parse(await readFile(process.env.CLINICFLOW_CATALOG_DIAGNOSTIC_FILE, "utf8"));
      const missing = wanted.filter(a => !live.some(b => JSON.stringify(a) === JSON.stringify(b)));
      const extra = live.filter(a => !wanted.some(b => JSON.stringify(a) === JSON.stringify(b)));
      console.log("Live catalog snapshot diagnostic:", JSON.stringify({ missing, extra }, null, 2));
      assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, "audited live catalog matches schema");
    }
    const differences = [
      ...first.filter(a => !wanted.some(b => JSON.stringify(a) === JSON.stringify(b))).map(row => ({ migrationOnly: row })),
      ...wanted.filter(a => !first.some(b => JSON.stringify(a) === JSON.stringify(b))).map(row => ({ schemaOnly: row })),
    ];
    console.log("Schema differences:", JSON.stringify(differences, null, 2));
    console.log("Function fingerprints:", JSON.stringify((await h.control.query(`
      SELECT proname, encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS sha256
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND prokind='f' ORDER BY proname`)).rows));
    assert.deepEqual(differences, []);
    // Exercise 0006 and 0008 against the real complete chain, not fixture DDL.
    await h.control.query(`BEGIN;
      INSERT INTO users(id,email,full_name,role) VALUES
        ('migration-admin','migration-admin@example.invalid','Migration admin','clinicAdmin'),
        ('migration-other','migration-other@example.invalid','Other admin','clinicAdmin');
      INSERT INTO clinics(id,admin_id) VALUES ('migration-clinic','migration-admin');
      INSERT INTO branches(id,clinic_id) VALUES ('migration-branch','migration-clinic');
      INSERT INTO doctors(id,user_id,owner_admin_id) VALUES
        ('migration-doctor','migration-admin','migration-admin');
      INSERT INTO assignments(id,user_id,clinic_id,branch_id) VALUES
        ('migration-assignment','migration-admin','migration-clinic','migration-branch');
      COMMIT;`);
    await assert.rejects(h.control.query(`INSERT INTO assignments(id,user_id,clinic_id,branch_id)
      VALUES ('migration-invalid','migration-other','migration-clinic','migration-branch')`),
      /Clinic Admin assignment must match the active clinic administrator/);
    console.log(`Applied ${ledger.length} actual migrations; second runner pass applied zero.`);
  } finally {
    await h.close();
    await unlink(bundle).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
});