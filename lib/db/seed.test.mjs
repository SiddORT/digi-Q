import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import argon2 from "argon2";
import { SeedError, seedConfig, seedSuperAdmin, seedWithPool } from "./seed-core.mjs";

const databases = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

async function fixture() {
  const database = new PGlite();
  databases.push(database);
  await database.exec(`
    CREATE TABLE users (
      id text PRIMARY KEY, email text NOT NULL UNIQUE, full_name text NOT NULL,
       role text NOT NULL, status text NOT NULL DEFAULT 'active', clerk_id text UNIQUE,
       password_hash text, password_changed_at timestamptz, email_verified_at timestamptz,
      invitation_status text NOT NULL DEFAULT 'failed'
    );
  `);
  const statements = [];
  const client = {
    async query(sql, params) {
      statements.push(sql);
      // PGlite has PostgreSQL DML/transactions, but not advisory/table locks.
      // Assert their presence and order while executing the rest against disposable PG.
      if (sql === "select pg_advisory_xact_lock(hashtext('bootstrap-admin'))" ||
          sql === "LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE") return { rows: [] };
      return database.query(sql, params);
    },
  };
  return { database, client, statements };
}

const env = { SUPERADMIN_EMAIL: " Admin@Example.COM ", SUPERADMIN_NAME: "  Site Owner  ",
  SUPERADMIN_PASSWORD: "disposable super admin passphrase 123" };

test("creates a password-authenticated administrator with UUID; reruns preserve it", async () => {
  const { database, client, statements } = await fixture();
  assert.equal((await seedSuperAdmin(client, env)).status, "created");
  assert.deepEqual(statements.slice(0, 3), [
    "BEGIN",
    "select pg_advisory_xact_lock(hashtext('bootstrap-admin'))",
    "LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE",
  ]);
  const rows = (await database.query("SELECT * FROM users")).rows;
  assert.equal(rows.length, 1);
  assert.match(rows[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(rows[0].email, "admin@example.com");
  assert.equal(rows[0].full_name, "Site Owner");
  assert.equal(rows[0].role, "superAdmin");
  assert.equal(rows[0].status, "active");
  assert.equal(rows[0].clerk_id, null);
  assert.match(rows[0].password_hash, /^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
  assert.equal(rows[0].invitation_status, "notRequired");
  assert.equal((await seedSuperAdmin(client, env)).status, "skipped");
  assert.equal((await seedSuperAdmin(client, { SUPERADMIN_EMAIL: "other@example.com", SUPERADMIN_NAME: "Other" })).status, "skipped");
  assert.equal((await database.query("SELECT count(*)::int AS total FROM users")).rows[0].total, 1);
});

test("initializes a previously passwordless administrator once at the exact configured email", async () => {
  const { database, client } = await fixture();
  await database.query("INSERT INTO users (id,email,full_name,role) VALUES ('old','admin@example.com','Old','superAdmin')");
  assert.equal((await seedSuperAdmin(client, env)).status, "initialized");
  const first = (await database.query("SELECT password_hash FROM users WHERE id='old'")).rows[0].password_hash;
  assert.match(first, /^\$argon2id\$/);
  assert.equal(await argon2.verify(first, env.SUPERADMIN_PASSWORD), true);
  assert.deepEqual((await database.query("SELECT id,email,full_name,role,status FROM users")).rows,
    [{ id: "old", email: "admin@example.com", full_name: "Old", role: "superAdmin", status: "active" }]);
  assert.equal((await seedSuperAdmin(client, { ...env, SUPERADMIN_PASSWORD: "different secure password 123" })).status, "skipped");
  assert.equal((await database.query("SELECT password_hash FROM users WHERE id='old'")).rows[0].password_hash, first);
});

test("initializes the configured admin even when another administrator was inserted first", async () => {
  const { database, client } = await fixture();
  await database.query(`INSERT INTO users (id,email,full_name,role) VALUES
    ('other','other@example.com','Other','superAdmin'),
    ('target','ADMIN@EXAMPLE.COM','Existing Owner','superAdmin')`);
  assert.equal((await seedSuperAdmin(client, env)).status, "initialized");
  const rows = (await database.query("SELECT * FROM users ORDER BY id")).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].password_hash, null);
  assert.equal(rows[1].id, "target");
  assert.equal(rows[1].full_name, "Existing Owner");
  assert.equal(await argon2.verify(rows[1].password_hash, env.SUPERADMIN_PASSWORD), true);
});

test("missing password reports the reason without changing the configured admin", async () => {
  const { database, client } = await fixture();
  await database.query("INSERT INTO users (id,email,full_name,role) VALUES ('old','admin@example.com','Old','superAdmin')");
  const before = (await database.query("SELECT * FROM users")).rows;
  const { SUPERADMIN_PASSWORD, ...withoutPassword } = env;
  const result = await seedSuperAdmin(client, withoutPassword);
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /SUPERADMIN_PASSWORD was not supplied/);
  assert.deepEqual((await database.query("SELECT * FROM users")).rows, before);
});

test("an inactive configured admin remains completely unchanged with a supplied password", async () => {
  const { database, client } = await fixture();
  await database.query("INSERT INTO users (id,email,full_name,role,status) VALUES ('old','admin@example.com','Old','superAdmin','inactive')");
  const before = (await database.query("SELECT * FROM users")).rows;
  assert.equal((await seedSuperAdmin(client, env)).status, "skipped");
  assert.deepEqual((await database.query("SELECT * FROM users")).rows, before);
});

test("ambiguous case-insensitive configured identities fail closed", async () => {
  const { database, client } = await fixture();
  await database.query(`INSERT INTO users (id,email,full_name,role) VALUES
    ('one','admin@example.com','One','superAdmin'),
    ('two','ADMIN@EXAMPLE.COM','Two','superAdmin')`);
  const before = (await database.query("SELECT * FROM users ORDER BY id")).rows;
  await assert.rejects(seedSuperAdmin(client, env), /multiple accounts/);
  assert.deepEqual((await database.query("SELECT * FROM users ORDER BY id")).rows, before);
});

test("an existing super admin at another email is preserved without inserting", async () => {
  const { database, client } = await fixture();
  await database.query("INSERT INTO users (id,email,full_name,role) VALUES ('old','old@example.com','Old','superAdmin')");
  const result = await seedSuperAdmin(client, env);
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /already exists/);
  assert.deepEqual((await database.query("SELECT id FROM users")).rows, [{ id: "old" }]);
});

test("inactive super admin is preserved, never reactivated", async () => {
  const { database, client } = await fixture();
  await database.query("INSERT INTO users (id,email,full_name,role,status) VALUES ('old','old@example.com','Old','superAdmin','inactive')");
  const result = await seedSuperAdmin(client, env);
  assert.equal(result.status, "skipped");
  assert.match(result.reason, /inactive.*not reactivated/);
  assert.deepEqual((await database.query("SELECT id,status FROM users")).rows, [{ id: "old", status: "inactive" }]);
});

test("new administrator cannot be seeded without a configured password", async () => {
  const { database, client } = await fixture();
  await assert.rejects(seedSuperAdmin(client, { SUPERADMIN_EMAIL: "new@example.com", SUPERADMIN_NAME: "New" }),
    /SUPERADMIN_PASSWORD is required/);
  assert.equal((await database.query("SELECT count(*)::int AS total FROM users")).rows[0].total, 0);
});

test("case-insensitive email collision never promotes an existing nonadmin; rolls back", async () => {
  const { database, client, statements } = await fixture();
  await database.query("INSERT INTO users (id,email,full_name,role) VALUES ('patient','ADMIN@EXAMPLE.COM','Patient','patient')");
  await assert.rejects(seedSuperAdmin(client, env), /refusing to promote/);
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.deepEqual((await database.query("SELECT id,role,email FROM users")).rows,
    [{ id: "patient", role: "patient", email: "ADMIN@EXAMPLE.COM" }]);
});

test("absent env skips without DB access; partial, empty and invalid env fail before DB access", async () => {
  const pool = { connect() { throw Error("must not connect"); } };
  assert.equal((await seedWithPool(pool, {})).status, "skipped");
  for (const invalid of [
    { SUPERADMIN_EMAIL: "a@example.com" },
    { SUPERADMIN_NAME: "A" },
    { SUPERADMIN_EMAIL: "", SUPERADMIN_NAME: "A" },
    { SUPERADMIN_EMAIL: "a@example.com", SUPERADMIN_NAME: "  " },
    { SUPERADMIN_EMAIL: "a@b", SUPERADMIN_NAME: "A" },
    { SUPERADMIN_EMAIL: "a@b..com", SUPERADMIN_NAME: "A" },
    { SUPERADMIN_EMAIL: "a@example.com\n", SUPERADMIN_NAME: "A" },
    { SUPERADMIN_EMAIL: 123, SUPERADMIN_NAME: "A" },
    { SUPERADMIN_EMAIL: "a@example.com", SUPERADMIN_NAME: "A", SUPERADMIN_PASSWORD: "short" },
    { SUPERADMIN_EMAIL: "a@example.com", SUPERADMIN_NAME: "A", SUPERADMIN_PASSWORD: "x".repeat(1025) },
  ]) {
    assert.throws(() => seedConfig(invalid), SeedError);
    await assert.rejects(seedWithPool(pool, invalid), SeedError);
  }
});

test("insert failure rolls back; pool releases client on success and failure", async () => {
  const { database, client, statements } = await fixture();
  let releases = 0;
  const pool = { async connect() { return { ...client, release() { releases++; } }; } };
  await database.exec(`CREATE FUNCTION reject_admin() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'test rejection'; END
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER reject_admin BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION reject_admin();`);
  await assert.rejects(seedWithPool(pool, env), /test rejection/);
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.equal(releases, 1);
  assert.equal((await database.query("SELECT count(*)::int AS total FROM users")).rows[0].total, 0);
  await database.exec("DROP TRIGGER reject_admin ON users");
  assert.equal((await seedWithPool(pool, env)).status, "created");
  assert.equal(releases, 2);
  assert.equal(statements.at(-1), "COMMIT");
});