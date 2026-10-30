import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

const root = resolve(import.meta.dirname, "../../..");
const migrations = resolve(root, "lib/db/drizzle");

test("tracked migration chain applies to an empty isolated cluster and preserves ownership guards", { timeout: 150000 }, async () => {
  // Direct invocation must also select an explicit major, not whatever is on PATH.
  assert.match(process.env.CLINICFLOW_TEST_PG_MAJOR ?? "", /^[1-9]\d*$/);
  assert.ok(process.env.CLINICFLOW_TEST_PG_BIN);
  const journal = JSON.parse(await readFile(resolve(migrations, "meta/_journal.json"), "utf8"));
  const names = journal.entries.map(entry => `${entry.tag}.sql`);
  assert.ok(names.length > 0);
  assert.equal(new Set(names).size, names.length, "no duplicated journal entries");
  assert.deepEqual((await readdir(migrations)).filter(name => name.endsWith(".sql")).sort(), [...names].sort(),
    "every SQL migration must appear in the real journal; no untracked extras or skipped files");
  const expected = await Promise.all(journal.entries.map(async (entry, index) => {
    assert.equal(entry.idx, index);
    if (index) assert.ok(entry.when > journal.entries[index - 1].when, "journal timestamps strictly increase");
    return {
      hash: createHash("sha256").update(await readFile(resolve(migrations, `${entry.tag}.sql`), "utf8")).digest("hex"),
      created_at: String(entry.when),
    };
  }));
  const h = await createQueueHarness({ empty: true });
  try {
    const { rows: [server] } = await h.control.query(`
      select version() as version, current_setting('server_version_num') as number,
        current_setting('data_directory') as data, current_setting('listen_addresses') as listen,
        inet_server_addr() as address
    `);
    assert.equal(Math.floor(Number(server.number) / 10000), Number(process.env.CLINICFLOW_TEST_PG_MAJOR));
    assert.equal(server.data, resolve(h.temp, "data"));
    assert.equal(server.listen, "");
    assert.equal(server.address, null);
    assert.equal((await h.control.query("select count(*)::int as n from pg_tables where schemaname not in ('pg_catalog','information_schema')")).rows[0].n, 0);
    console.log(`Server evidence: ${server.version}; server_version_num=${server.number}; private socket=${h.temp}; TCP disabled`);

    function migrate() {
      const env = Object.fromEntries(Object.entries(process.env).filter(
        ([key]) => key !== "DATABASE_URL" && !key.startsWith("PG"),
      ));
      // The only connection URL passed to the real CLI is constructed here from
      // the newly created harness; never read a development/hosted URL.
      env.DATABASE_URL = `postgresql://queue_test@localhost/postgres?host=${encodeURIComponent(h.temp)}&port=5432`;
      const result = spawnSync("pnpm", ["--filter", "@workspace/db", "run", "migrate"], {
        cwd: root, env, encoding: "utf8", timeout: 60000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `tracked migration command failed:\n${result.stdout}\n${result.stderr}`);
    }
    const ledger = async () => (await h.control.query(
      "select hash, created_at::text from drizzle.__drizzle_migrations order by id",
    )).rows;
    migrate();
    assert.deepEqual(await ledger(), expected, "every tracked file applied with its exact hash and timestamp");
    migrate();
    assert.deepEqual(await ledger(), expected, "second migrate is a no-op");

    // Inspect enabled attachments, not merely function names. These are the
    // custom ownership guards from the tracked chain, never fixture copies.
    const guards = {
      clinics_admin_guard: ["clinics", "enforce_clinicflow_admin_ownership", false],
      clinics_admin_assignment: ["clinics", "sync_clinicflow_admin_assignment", false],
      assignments_admin_guard: ["assignments", "enforce_clinicflow_assignment", false],
      assignments_admin_delete_guard: ["assignments", "protect_clinicflow_admin_assignment", false],
      doctors_owner_guard: ["doctors", "enforce_clinicflow_doctor_owner", false],
      users_admin_account_guard: ["users", "protect_clinicflow_admin_account", false],
      assignment_owner_guard: ["assignments", "clinicflow_assignment_owner_guard", true],
      receptionist_manager_guard: ["users", "clinicflow_staff_manager_guard", true],
      doctor_manager_guard: ["doctors", "clinicflow_staff_manager_guard", true],
      clinic_owner_guard: ["clinics", "clinicflow_clinic_owner_guard", true],
    };
    const triggers = (await h.control.query(`
      select t.tgname, c.relname, p.proname, t.tgenabled,
        t.tgdeferrable, t.tginitdeferred
      from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      join pg_proc p on p.oid=t.tgfoid
      where not t.tgisinternal and n.nspname='public'
    `)).rows;
    for (const [name, [table, fn, deferred]] of Object.entries(guards)) {
      const trigger = triggers.find(row => row.tgname === name && row.relname === table);
      assert.ok(trigger, `missing ownership trigger ${name}`);
      assert.equal(trigger.proname, fn);
      assert.equal(trigger.tgenabled, "O");
      assert.equal(trigger.tgdeferrable, deferred);
      assert.equal(trigger.tginitdeferred, deferred);
    }

    await h.control.query(`
      insert into users(id,email,full_name,role) values
        ('owner','owner@example.invalid','Synthetic owner','clinicAdmin'),
        ('foreign','foreign@example.invalid','Synthetic foreign owner','clinicAdmin');
      insert into clinics(id,admin_id) values ('clinic','owner');
    `);
    assert.equal((await h.control.query("select count(*)::int as n from assignments where user_id='owner' and clinic_id='clinic' and branch_id is null")).rows[0].n, 1);
    await assert.rejects(h.control.query("delete from assignments where user_id='owner'"),
      /clinic administrator assignment cannot be removed/);
    await assert.rejects(h.control.query("update users set status='inactive' where id='owner'"),
      /Transfer clinic and doctor ownership/);
    await assert.rejects(h.control.query("insert into assignments(id,user_id,clinic_id) values('bad-admin','foreign','clinic')"),
      /assignment must match the active clinic administrator/);

    // Positive controls ensure deferred guards do not simply reject all staff,
    // and the final consulting-owner replacement remains installed.
    await h.control.query("begin");
    try {
      await h.control.query(`
        insert into users(id,email,full_name,role,managing_admin_id)
          values('valid-staff','valid-staff@example.invalid','Synthetic staff','receptionist','owner');
        insert into assignments(id,user_id,clinic_id) values('valid-staff-assignment','valid-staff','clinic');
        insert into doctors(id,user_id,owner_admin_id) values('own-profile','owner','owner');
        insert into branches(id,clinic_id) values('branch','clinic');
        insert into assignments(id,user_id,clinic_id,branch_id) values('own-branch','owner','clinic','branch');
      `);
      await h.control.query("commit");
    } finally {
      await h.control.query("rollback");
    }

    // Exercise a deferred guard at COMMIT: valid manager, wrong clinic owner.
    await h.control.query("begin");
    try {
      await h.control.query("insert into users(id,email,full_name,role,managing_admin_id) values('staff','staff@example.invalid','Synthetic staff','receptionist','foreign')");
      await h.control.query("insert into assignments(id,user_id,clinic_id) values('bad-staff','staff','clinic')");
      await assert.rejects(h.control.query("commit"), error =>
        error.code === "23514" && /outside managing administrator ownership/.test(error.message));
    } finally {
      await h.control.query("rollback");
    }
    console.log(`Applied and hash-verified ${expected.length} migrations; repeat is a no-op; enabled ownership attachments and immediate/deferred rejection verified`);
  } finally {
    await h.close();
    await assert.rejects(access(h.temp), { code: "ENOENT" });
    console.log(`Cleanup verified: disposable cluster stopped and ${h.temp} removed`);
  }
});
