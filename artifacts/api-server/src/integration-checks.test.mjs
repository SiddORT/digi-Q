import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
test("integration checks report verified access separately from delivery and never send", async (t) => {
  const path = resolve(import.meta.dirname, `.integration-check-${process.pid}.mjs`);
  let verified = 0, fetched = 0;
  globalThis.smtpClosed = 0;
  globalThis.checkVerify = async () => { verified++; };
  globalThis.checkFetch = async () => { fetched++; return { ok: true, json: async () => ({ status: "active", account_sid: "AC" + "a".repeat(32) }) }; };
  await build({ stdin: { contents: 'export {checkIntegration} from "./lib/integration-checks"; export {verifySmtp} from "./lib/smtp-verification";', resolveDir: import.meta.dirname }, outfile: path, bundle: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "isolated", setup(b) {
    b.onResolve({ filter: /^(nodemailer)$|integration-vault$|objectStorage$|local-media$/ }, a => ({ path: a.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path === "nodemailer" ? "export default {createTransport:options=>{globalThis.smtpOptions=options;return {verify:globalThis.checkVerify,close(){globalThis.smtpClosed++},sendMail(){throw Error('Must not send')}}}}" : path.endsWith("integration-vault") ? `export async function resolvedIntegration(){return {source:"database",env:{SMTP_HOST:"smtp.example.invalid",SMTP_PORT:"465",SMTP_USER:"fixture",SMTP_PASSWORD:"fixture",SMTP_FROM:"test@example.invalid",OTP_PROVIDER:"twilio",TWILIO_ACCOUNT_SID:"AC${"a".repeat(32)}",TWILIO_AUTH_TOKEN:"${"b".repeat(32)}",TWILIO_MESSAGING_SERVICE_SID:"MG${"c".repeat(32)}"}}}` : path.endsWith("local-media") ? 'export const mediaConfig=()=>({driver:"object"});' : 'export class ObjectStorageService{getPrivateObjectDir(){return "/fixture/private"}};export const objectStorageClient={bucket:()=>({iam:{testPermissions:async()=>[globalThis.storagePermissions || {"storage.objects.get":true,"storage.objects.create":true}]},getMetadata(){throw Error("Bucket metadata permission is not required")}})};' }));
  }}] });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = globalThis.checkFetch;
  try {
    const { checkIntegration, verifySmtp } = await import(path);
    for (const provider of ["smtp", "sms", "storage"]) {
      const result = await checkIntegration(provider);
      assert.ok(result.checks.some(c => c.status === "passed"));
      assert.ok(result.checks.some(c => c.status === "not_verified"));
    }
    assert.equal(verified, 1); assert.equal(fetched, 2);
    assert.equal(globalThis.smtpClosed, 1);
    assert.equal(globalThis.smtpOptions.secure, true);
    assert.equal(globalThis.smtpOptions.requireTLS, false);
    assert.equal(globalThis.smtpOptions.debug, false);
    assert.equal(globalThis.smtpOptions.logger, false);
    globalThis.checkVerify = async () => { throw Object.assign(Error("private-provider-reply"), { code: "EAUTH" }); };
    const smtpFailed = await checkIntegration("smtp");
    assert.equal(smtpFailed.source, "database");
    assert.equal(smtpFailed.checks[0].status, "failed");
    assert.match(smtpFailed.checks[0].message, /Authentication was rejected/);
    assert(!JSON.stringify(smtpFailed).includes("private-provider-reply"));
    assert.equal(globalThis.smtpClosed, 2);
    globalThis.checkVerify = () => new Promise(() => {});
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = verifySmtp({ SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_USER: "fixture", SMTP_PASSWORD: "fixture", SMTP_FROM: "test@example.invalid" });
    const timedOut = assert.rejects(pending, { code: "ETIMEDOUT" });
    t.mock.timers.tick(35000);
    await timedOut;
    t.mock.timers.reset();
    assert.equal(globalThis.smtpClosed, 3);
    assert.equal(globalThis.smtpOptions.secure, false);
    assert.equal(globalThis.smtpOptions.requireTLS, true);
    globalThis.storagePermissions = { "storage.objects.get": true, "storage.objects.create": false };
    const denied = await checkIntegration("storage");
    assert.equal(denied.checks.find(c => c.name === "Read objects").status, "passed");
    assert.equal(denied.checks.find(c => c.name === "Create objects").status, "failed");
    globalThis.checkFetch = async () => { throw Error("secret provider diagnostics"); };
    globalThis.fetch = globalThis.checkFetch;
    const failed = await checkIntegration("sms");
    assert.equal(failed.checks[0].status, "failed");
    assert.ok(!JSON.stringify(failed).includes("secret provider diagnostics"));
  } finally { t.mock.timers.reset(); globalThis.fetch = oldFetch; delete globalThis.checkFetch; delete globalThis.checkVerify; delete globalThis.storagePermissions; delete globalThis.smtpClosed; delete globalThis.smtpOptions; await rm(path, { force: true }); }
});