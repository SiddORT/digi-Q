// Disposable in-memory PostgreSQL (PGlite) with the ACTUAL checked-in migration journal applied.
// Real routers, real SQL and authorization; only document byte storage is replaced by an in-memory map.
// Never reads DATABASE_URL, never sends email, never touches object storage.
import { readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";
import { createQueueHarness } from "./postgres-queue.mjs";
import { createRequire } from "node:module";
import { drizzle as postgresDrizzle } from "drizzle-orm/node-postgres";

const root = resolve(import.meta.dirname, "../../../..");
const migrations = resolve(root, "lib/db/drizzle");
let harnessSequence = 0;

export async function createFeatureHarness({administration=false, simulatedMail=false, bookingLookups=false, postgres=false, fakeBookingMail=false, registration=false, deletion=false, notificationSettings=false}={}) {
  const cluster=postgres?await createQueueHarness({empty:true}):null;
  const {Pool}=postgres?createRequire(resolve(root,"lib/db/package.json"))("pg"):{};
  const pool=postgres?new Pool({host:cluster.temp,port:5432,user:"queue_test",database:"postgres",password:"",ssl:false,max:8,statement_timeout:10000}):null;
  const pg = postgres?{exec:text=>cluster.control.query(text),query:(text,args)=>cluster.control.query(text,args),close:async()=>{await pool.end();await cluster.close();delete globalThis.__featurePostgresDb;}}:new PGlite();
  if(postgres)globalThis.__featurePostgresDb=postgresDrizzle(pool);
  const journal = JSON.parse(await readFile(join(migrations, "meta/_journal.json"), "utf8"));
  for (const entry of journal.entries) {
    const text = await readFile(join(migrations, `${entry.tag}.sql`), "utf8");
    for (const stmt of text.split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
  }
  globalThis.__featurePglite = pg;
  const errors = [];
  globalThis.__featureErrors = errors;
  const blobs = new Map();
  globalThis.__featureBlobs = blobs;
  const mail = { fail: false, messages: [] };
  if (simulatedMail || fakeBookingMail) globalThis.__featureMail = mail;
   // A new database requires a new module URL. Reusing a process-local bundle
   // path returns Node's cached exports, still attached to the closed old DB.
   const bundle = resolve(import.meta.dirname, `../../.feature-harness-${process.pid}-${++harnessSequence}.mjs`);
  async function failedSetup(error) {
    await pg.close();
    await rm(bundle, { force: true });
    throw error;
  }
  await build({
    stdin: { resolveDir: resolve(import.meta.dirname, ".."), contents: `
      import express from "express";
      import { workspaceFeaturesRouter } from "./routes/workspace-features";
      import { patientRecordsRouter } from "./routes/patient-records";
      import { reportingRouter } from "./routes/reporting";
      ${notificationSettings ? `import { notificationSettingsRouter } from "./routes/notification-settings";
      import { notificationTemplatesRouter } from "./routes/notification-templates";` : ""}
      export { listOwnerBookingMailOutcomes } from "./lib/notification-outbox";
       ${deletion ? `import { db as deletionDb } from "@workspace/db";
       import { computeStaffDeletionImpact } from "./lib/staff-deletion-impact";
       import { prepareDeletionReceipt, commitDeletionReceipt, processDeletionReceipt, getDeletionReceipt } from "./lib/staff-deletion-receipts";
       import { withStaffDispatch } from "./lib/staff-dispatch-barrier";
       export * as historyProvenance from "./lib/notification-history-provenance";
       export * as removalReviews from "./lib/staff-removal-review";
       import { planStaffMedia } from "./lib/staff-media-impact";
       import { eraseStaffAttribution, unresolvedStaffReferences } from "./lib/staff-attribution-erasure";
       export const mediaImpact = (target, doctors) => planStaffMedia(deletionDb, target, doctors);
       export const attribution = { eraseStaffAttribution, unresolvedStaffReferences };
       import { eraseStaffRelationalRows } from "./lib/staff-relational-erasure";
       import { reviewStaffRemoval, commitStaffRemoval, retryStaffFileCleanup, lockRemovalGraph } from "./lib/staff-removal";
       export const removals = {
         review: context => reviewStaffRemoval(context, deletionDb),
         commit: (context,input) => commitStaffRemoval(context,input,deletionDb),
         retry: (id,remove) => retryStaffFileCleanup(id,deletionDb,remove),
         lock: work => deletionDb.transaction(async tx => { await lockRemovalGraph(tx); return work(); }),
       };
       export const relationalErasure = (target) => deletionDb.transaction(tx => eraseStaffRelationalRows(tx, target));
       import { reviewStaffVisitHandoff, commitStaffVisitHandoff } from "./lib/staff-visit-handoff";
       import { reviewStaffResponsibilityHandoff, commitStaffResponsibilityHandoff } from "./lib/staff-responsibility-handoff";
       export const visitHandoffs = {
         review: (context, moves) => reviewStaffVisitHandoff(context, moves, deletionDb),
         commit: (context, proposal, token) => commitStaffVisitHandoff(context, proposal, token, deletionDb),
       };
       export const responsibilityHandoffs = {
         review: (context, replacementId) => reviewStaffResponsibilityHandoff(context, replacementId, deletionDb),
         commit: (context, proposal, token) => commitStaffResponsibilityHandoff(context, proposal, token, deletionDb),
       };
       import { recordNotification } from "./lib/notification-history";
       export const recordHistory = (...args) => recordNotification(deletionDb, ...args);
       export const staffDeletionImpact = (actor, target) => computeStaffDeletionImpact(deletionDb, actor, target);
       export const staffDispatch = (ids, work) => withStaffDispatch(ids, "notification", work, deletionDb);
       export const receipts = {
         prepare: prepareDeletionReceipt,
         commit: (prepared) => deletionDb.transaction(tx => commitDeletionReceipt(tx, prepared)),
         process: (id, referenced, remove) => processDeletionReceipt(deletionDb, id, referenced, remove),
         get: (id) => getDeletionReceipt(deletionDb, id),
       };` : ""}
      ${bookingLookups ? `import { publicRouter } from "./routes/public";
      import { db } from "@workspace/db";
      import { processNotifications } from "./lib/notification-outbox";
      export const dispatchOutbox = () => processNotifications(db);
      import { processSmsNotifications } from "./lib/notification-sms-outbox";
      export const dispatchSmsOutbox = (send) => processSmsNotifications(db, send);
      import { appointmentsRouter } from "./routes/appointments";
      import { queueRouter } from "./routes/queue";
      import { guestRequestsRouter } from "./routes/guest-requests";
      import { appointmentQrRouter } from "./routes/appointment-qr";
      import { resourcesRouter as lookupResourcesRouter } from "./routes/resources";` : ""}
      ${administration || bookingLookups ? `import { nativeSession } from "./lib/native-auth";` : ""}
      ${administration ? `import { resourcesRouter } from "./routes/resources";
      ${registration ? `import { clinicExpansionRouter } from "./routes/clinic-expansion";` : ""}
      import { identityRouter } from "./routes/identity";
      import { systemUsersRouter } from "./routes/system-users";
      import { permissionPolicyRouter } from "./routes/permission-policy";
      ${simulatedMail ? `import { authRouter } from "./routes/auth";` : ""}` : ""}
      import { errors } from "./lib/http";
      export function createApp() {
        const app = express();
         app.use((req, _res, next) => { req.log = { error() {} }; next(); });
        ${administration || bookingLookups ? `app.use(nativeSession);` : ""}
        ${!bookingLookups ? `app.use((req, _res, next) => { const id = req.get("x-test-user"); if (id) { req.authUserId = id; req.authSessionHash = "test-session-" + id; } next(); });` : ""}
        app.use(express.json());
        app.use("/api", workspaceFeaturesRouter, patientRecordsRouter, reportingRouter);
        ${notificationSettings ? `app.use("/api", notificationSettingsRouter);
        app.use("/api", notificationTemplatesRouter);` : ""}
        ${administration ? `app.use("/api", resourcesRouter, identityRouter, systemUsersRouter, permissionPolicyRouter);` : ""}
        ${registration ? `app.use("/api", clinicExpansionRouter);` : ""}
        ${bookingLookups ? `app.use("/api", publicRouter, appointmentsRouter, guestRequestsRouter, appointmentQrRouter, lookupResourcesRouter, queueRouter);` : ""}
        ${simulatedMail ? `app.use("/api", authRouter);` : ""}
         // Fixture-only diagnostics capture the underlying error before the
         // production handler deliberately masks private database parameters.
         app.use((error, _req, _res, next) => { globalThis.__featureErrors.push(error); next(error); });
         app.use(errors);
        return app;
      }` },
    outfile: bundle, bundle: true, platform: "node", format: "esm", logLevel: "error",
    external: ["argon2", "pg", "pg-native", "@electric-sql/pglite", "@google-cloud/storage", "express", "pino", "pino-http", "libphonenumber-js/max",
      ...((bookingLookups || registration) ? ["qrcode", "jspdf", "sharp", "express-rate-limit"] : []),
      ...(bookingLookups && !simulatedMail ? ["nodemailer"] : [])],
    plugins: [{ name: "feature-fixtures", setup(b) {
      if (fakeBookingMail) {
        b.onResolve({filter:/\/appointment-confirmation$/},()=>({path:"confirmation",namespace:"booking-confirmation"}));
        b.onLoad({filter:/.*/,namespace:"booking-confirmation"},()=>({resolveDir:resolve(root,"artifacts/api-server/src"),contents:`
          export * from "${resolve(root,"artifacts/api-server/src/lib/appointment-confirmation.ts")}";
          import {confirmAppointmentEmail as real} from "${resolve(root,"artifacts/api-server/src/lib/appointment-confirmation.ts")}";
          import {sendAuthEmail} from "./lib/auth-email";
          export const confirmAppointmentEmail=(id,conn)=>real(id,conn,(...args)=>sendAuthEmail(...args));
        `}));
        b.onResolve({ filter: /\/auth-email$/ }, () => ({ path: "mail", namespace: "booking-mail" }));
        b.onLoad({ filter: /.*/, namespace: "booking-mail" }, () => ({ contents: `
          export const smtpConfig = () => ({});
          export async function sendAuthEmail(to, subject, text) {
            if (globalThis.__featureMail.fail) throw new Error("Simulated uncertain dispatch");
            globalThis.__featureMail.messages.push({to,subject,text});
          }` }));
      }
      if (bookingLookups && !simulatedMail) {
        b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "disabled-mail", namespace: "disabled-mail" }));
        b.onLoad({ filter: /.*/, namespace: "disabled-mail" }, () => ({ contents: `export default {createTransport(){return {async sendMail(){throw new Error("Mail disabled in disposable booking tests");}}}};` }));
      }
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
        export const db = ${postgres?"globalThis.__featurePostgresDb":"drizzle(globalThis.__featurePglite, { schema })"};
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
  }).catch(failedSetup);
   const { createApp, dispatchOutbox, dispatchSmsOutbox, listOwnerBookingMailOutcomes, staffDeletionImpact, staffDispatch, receipts, historyProvenance, recordHistory, removalReviews, visitHandoffs, responsibilityHandoffs, mediaImpact, attribution, relationalErasure, removals } = await import(bundle).catch(failedSetup);
  const server = createApp().listen(0);
  await new Promise(r => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function call(user, method, path, body, headers = {}) {
    const init = { method, headers: { ...(user ? { "x-test-user": user } : {}), ...headers } };
    if (body instanceof Buffer) { init.body = body; init.headers["content-type"] ||= "application/octet-stream"; }
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers["content-type"] = "application/json"; }
    const res = await fetch(base + path, {...init,signal:AbortSignal.timeout(20000)});
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
   return { pg, call, blobs, mail, base, pool, errors, dispatchOutbox, dispatchSmsOutbox, listOwnerBookingMailOutcomes, staffDeletionImpact, staffDispatch, receipts, historyProvenance, recordHistory, removalReviews, visitHandoffs, responsibilityHandoffs, mediaImpact, attribution, relationalErasure, removals, beforeTransaction(hook) { globalThis.__featureBeforeTransaction=hook; }, async close() { globalThis.__featureBeforeTransaction=null;delete globalThis.__featureErrors;if(simulatedMail||fakeBookingMail)delete globalThis.__featureMail;server.close(); await pg.close(); await rm(bundle, { force: true }); } };
}
