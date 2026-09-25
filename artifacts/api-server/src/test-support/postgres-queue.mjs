// Dedicated, socket-only PostgreSQL cluster: never reads DATABASE_URL or PG*.
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/node-postgres";
import { queueFixtureSql, seedQueueFixtures } from "./queue-fixtures.mjs";

const root = resolve(import.meta.dirname, "..");
const { Client } = createRequire(resolve(root, "../../../lib/db/package.json"))("pg");

export async function createQueueHarness({ empty = false, pre0008 = false } = {}) {
  const temp = await mkdtemp(join(tmpdir(), "clinicflow-contention-"));
  const data = join(temp, "data");
  const bundle = join(root, `.contention-${process.pid}.mjs`);
  const context = new AsyncLocalStorage();
  const clients = new Set();
  let started = false;
  const pg = (command, args) => execFileSync(command, args, {
    encoding: "utf8", timeout: 20000, stdio: "pipe",
  });
  async function connect(database = "postgres") {
    const client = new Client({
      host: temp, port: 5432, user: "queue_test", database,
      password: "", ssl: false, connectionTimeoutMillis: 5000,
      statement_timeout: 10000, lock_timeout: 8000,
      application_name: "clinicflow-disposable-contention",
    });
    await client.connect();
    clients.add(client);
    return client;
  }
  async function disconnect(client) {
    await client.end();
    clients.delete(client);
  }
  async function close() {
    try {
      await Promise.all([...clients].map(disconnect));
    } finally {
      // If stop fails, retain the directory for diagnosis rather than delete
      // files underneath a possibly running postmaster.
      if (started) {
        pg("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
        started = false;
      }
      await rm(temp, { recursive: true, force: true });
      await rm(bundle, { force: true });
      delete globalThis.queueContentionContext;
    }
  }
  try {
    pg("initdb", ["-D", data, "-U", "queue_test", "-A", "trust", "--no-locale", "--encoding=UTF8"]);
    // The private Unix socket directory is unique; no TCP port is opened.
    pg("pg_ctl", ["-D", data, "-l", join(temp, "postgres.log"),
      "-o", `-k ${temp} -c listen_addresses='' -c max_connections=12`, "-w", "start"]);
    started = true;
    const control = await connect();
    const db = drizzle(control);
    // Migration tests require an actually empty private database, not fixtures.
    if (empty) return { control, db, connect, close, temp };
    globalThis.queueContentionContext = { db, context };
    await build({
      stdin: { contents: `
        export * from "./lib/appointments";
        export * from "./lib/reschedule";
        export * from "./lib/queue-order";
        export * from "./lib/store";
        export * from "./lib/clinic-expansion";
        export * from "./routes/appointments";
        export * from "./routes/queue";
        export { authorizeWrite, createClinicAdminOnboarding } from "./routes/resources";
        export { clinicExpansionRouter } from "./routes/clinic-expansion";
        export * as tables from "@workspace/db";
      `, resolveDir: root },
      outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
      plugins: [{ name: "disposable-postgres", setup(b) {
        b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
        b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: resolve(root, "../../../lib/api-zod/src/index.ts") }));
        b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ contents: `
          export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
          export const db = new Proxy({}, {get:(_, key) => {
            const h = globalThis.queueContentionContext;
            const conn = h.context.getStore()?.db || h.db;
            const value = conn[key];
            return typeof value === "function" ? value.bind(conn) : value;
          }});
        `, resolveDir: root }));
        b.onLoad({ filter: /lib\/auth\.ts$/ }, async a => ({
          contents: (await readFile(a.path, "utf8")).replace(
            /export async function requireUser\(req: Request\) \{[\s\S]*?\n\}/,
            "export async function requireUser(req: Request) { return globalThis.queueContentionContext.context.getStore().actor; }",
          ), loader: "ts",
        }));
      } }],
    });
    const api = await import(bundle), t = api.tables;
    await control.query(queueFixtureSql);
    // Execute the exact historical triggers, then the additive compatibility
    // migration, so fixture-only schemas cannot conceal live ownership guards.
    const legacyOwnership = await readFile(resolve(root, "../../../lib/db/drizzle/0002_sad_texas_twister.sql"), "utf8");
    await control.query("create unique index assignment_user_clinic_only_unique on assignments(user_id,clinic_id) where branch_id is null; create unique index assignment_user_branch_unique on assignments(user_id,branch_id) where branch_id is not null;");
    await control.query(legacyOwnership.slice(legacyOwnership.indexOf("CREATE OR REPLACE FUNCTION enforce_clinicflow_admin_ownership()")));
    const staffOwnership = await readFile(resolve(root, "../../../lib/db/drizzle/0005_ancient_ultron.sql"), "utf8");
    await control.query(staffOwnership.slice(staffOwnership.indexOf("CREATE OR REPLACE FUNCTION clinicflow_assert_staff_owner(")));
    await control.query(await readFile(resolve(root, "../../../lib/db/drizzle/0006_safe_staff_manager_guard.sql"), "utf8"));
    if (!pre0008) await control.query(await readFile(resolve(root, "../../../lib/db/drizzle/0008_consulting_admin_assignments.sql"), "utf8"));
    const staff = { id: "r", role: "receptionist", clinicIds: ["c"], branchIds: ["b", "b2"] };
    const patient = { id: "u1", role: "patient", patientId: "p1", clinicIds: [], branchIds: [] };
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    async function route(router, method, path, actor, body = {}, params = {}, query = {}, tx) {
      const layer = router.stack.find(l => l.route?.path === path && l.route.methods[method]);
      assert.ok(layer, path);
      let result;
      const response = { status: () => response, json: value => { result = value; } };
      // Routes open transactions themselves; within a raced transaction these
      // are savepoints on that connection, never transactions on the control DB.
      return context.run({ actor, db: tx || context.getStore()?.db || db }, async () => {
        await layer.route.stack[0].handle({ body, params, query }, response);
        return result;
      });
    }
    async function race(operations, { doctorIds = ["d"], lockKeys = [] } = {}) {
      const gate = await connect();
      const workers = await Promise.all(operations.map(() => connect()));
      let results;
      try {
        await gate.query("begin");
        for (const id of [...doctorIds].sort()) {
          await gate.query("select pg_advisory_xact_lock(hashtext($1))", [`schedules:${id}`]);
        }
        for (const key of [...lockKeys].sort()) await gate.query("select pg_advisory_xact_lock(hashtext($1))", [key]);
        const pids = await Promise.all(workers.map(async c => (await c.query("select pg_backend_pid() as pid")).rows[0].pid));
        assert.equal(new Set(pids).size, operations.length, "independent PostgreSQL backends");
        results = Promise.allSettled(workers.map((client, index) => {
          const actor = { ...staff, id: `staff-${index}` };
          return drizzle(client).transaction(tx =>
            context.run({ db: tx, actor }, () => operations[index](tx, actor)));
        }));
        const deadline = performance.now() + 5000;
        let waiting = 0;
        while (performance.now() < deadline) {
          const activity = await control.query(
            "select count(distinct pid)::int as count from pg_locks where pid = any($1::int[]) and locktype = 'advisory' and not granted", [pids]);
          waiting = activity.rows[0].count;
          if (waiting === workers.length) break;
          await delay(10);
        }
        assert.equal(waiting, workers.length, "every contender must overlap at an actual PostgreSQL advisory-lock wait");
        await gate.query("commit");
        return await results;
      } finally {
        await gate.query("rollback");
        if (results) await results;
        await Promise.all([gate, ...workers].map(disconnect));
      }
    }
    return {
      api, t, staff, patient, today, tomorrow, db, control, route, race, close,
      seed: () => db.transaction(tx => context.run({db:tx}, () => seedQueueFixtures(api, t, { exec: sql => control.query(sql) }))),
      rows: () => api.all(t.appointments),
      act: (id, body, actor = staff) => db.transaction(tx => api.transition(actor, id, body, tx)),
      book: (patientId = "p1", date = today, extra = {}, { actor = staff, tx } = {}) =>
        route(api.appointmentsRouter, "post", "/appointments", actor,
          { patientId, doctorId: "d", branchId: "b", clinicId: "c", date, source: "phone", ...extra },
          {}, {}, tx),
    };
  } catch (error) {
    await close();
    throw error;
  }
}