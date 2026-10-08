// Disposable in-memory PostgreSQL (PGlite) with the ACTUAL checked-in migration journal applied.
// Real routers, real SQL and authorization; only document byte storage is replaced by an in-memory map.
// Never reads DATABASE_URL, never sends email, never touches object storage.
import { readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../../../..");
const migrations = resolve(root, "lib/db/drizzle");

export async function createFeatureHarness({administration=false, simulatedMail=false}={}) {
  const pg = new PGlite();
  const journal = JSON.parse(await readFile(join(migrations, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries) {
    const text = await readFile(join(migrations, `${entry.tag}.sql`), "utf8");
    for (const stmt of text.split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
  }
  globalThis.__featurePglite = pg;
  const blobs = new Map();
  globalThis.__featureBlobs = blobs;
  const mail = { fail: false, messages: [] };
  if (simulatedMail) globalThis.__featureMail = mail;
  const bundle = resolve(import.meta.dirname, `../../.feature-harness-${process.pid}.mjs`);
  await build({
    stdin: { resolveDir: resolve(import.meta.dirname, ".."), contents: `
      import express from "express";
      import { workspaceFeaturesRouter } from "./routes/workspace-features";
      import { patientRecordsRouter } from "./routes/patient-records";
      import { reportingRouter } from "./routes/reporting";
      ${administration ? `import { resourcesRouter } from "./routes/resources";
      import { identityRouter } from "./routes/identity";
      import { systemUsersRouter } from "./routes/system-users";
      import { permissionPolicyRouter } from "./routes/permission-policy";
      import { nativeSession } from "./lib/native-auth";
      ${simulatedMail ? `import { authRouter } from "./routes/auth";` : ""}` : ""}
      import { errors } from "./lib/http";
      export function createApp() {
        const app = express();
        ${simulatedMail ? `app.use((req, _res, next) => { req.log = { error() {} }; next(); });` : ""}
        ${administration ? `app.use(nativeSession);` : ""}
        app.use((req, _res, next) => { const id = req.get("x-test-user"); if (id) { req.authUserId = id; req.authSessionHash = "test-session-" + id; } next(); });
        app.use(express.json());
        app.use("/api", workspaceFeaturesRouter, patientRecordsRouter, reportingRouter);
        ${administration ? `app.use("/api", resourcesRouter, identityRouter, systemUsersRouter, permissionPolicyRouter);` : ""}
        ${simulatedMail ? `app.use("/api", authRouter);` : ""}
        app.use(errors);
        return app;
      }` },
    outfile: bundle, bundle: true, platform: "node", format: "esm", logLevel: "error",
    external: ["argon2", "pg", "pg-native", "@electric-sql/pglite", "@google-cloud/storage", "express", "pino", "pino-http"],
    plugins: [{ name: "feature-fixtures", setup(b) {
      if (simulatedMail) {
        b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "simulated-mail" }));
        b.onLoad({ filter: /.*/, namespace: "simulated-mail" }, () => ({ contents: `
          export default { createTransport() { return { async sendMail(options) {
            if (globalThis.__featureMail.fail) throw new Error("Simulated provider failure");
            globalThis.__featureMail.messages.push(options);
            return { accepted: [options.to], rejected: [] };
          } }; } };` }));
      }
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "pglite-db" }));
      b.onLoad({ filter: /.*/, namespace: "pglite-db" }, () => ({ resolveDir: resolve(root, "lib/db"), contents: `
        import { drizzle } from "drizzle-orm/pglite";
        import * as schema from "./src/schema";
        export * from "./src/schema";
        export const pool = null;
        export const db = drizzle(globalThis.__featurePglite, { schema });
        ${administration ? `const transaction = db.transaction.bind(db);
        db.transaction = async (...args) => {
          const hook = globalThis.__featureBeforeTransaction;
          globalThis.__featureBeforeTransaction = null;
          if (hook) await hook();
          return transaction(...args);
        };` : ""}` }));
      b.onResolve({ filter: /\/document-storage$/ }, () => ({ path: "storage", namespace: "memory-storage" }));
      b.onLoad({ filter: /.*/, namespace: "memory-storage" }, () => ({ contents: `
        let n = 0;
        export async function saveDocument(bytes) { const key = "mem-" + (++n); globalThis.__featureBlobs.set(key, Buffer.from(bytes)); return { provider: "memory", key }; }
        export async function readDocument(_p, key) { const b = globalThis.__featureBlobs.get(key); if (!b) throw Object.assign(new Error("gone"), { status: 404 }); return b; }
        export async function removeDocument(_p, key) { globalThis.__featureBlobs.delete(key); }` }));
    } }],
  });
  const { createApp } = await import(bundle);
  const server = createApp().listen(0);
  await new Promise(r => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(user, method, path, body, headers = {}) {
    const init = { method, headers: { ...(user ? { "x-test-user": user } : {}), ...headers } };
    if (body instanceof Buffer) { init.body = body; init.headers["content-type"] ||= "application/octet-stream"; }
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers["content-type"] = "application/json"; }
    const res = await fetch(base + path, init);
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  return { pg, call, blobs, mail, beforeTransaction(hook) { globalThis.__featureBeforeTransaction=hook; }, async close() { globalThis.__featureBeforeTransaction=null;if(simulatedMail)delete globalThis.__featureMail;server.close(); await pg.close(); await rm(bundle, { force: true }); } };
}
