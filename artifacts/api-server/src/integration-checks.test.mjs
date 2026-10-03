import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
test("integration checks report verified access separately from delivery and never send", async () => {
  const path = resolve(import.meta.dirname, `.integration-check-${process.pid}.mjs`);
  let verified = 0, fetched = 0;
  globalThis.checkVerify = async () => { verified++; };
  globalThis.checkFetch = async () => { fetched++; return { ok: true, json: async () => ({ status: "active", account_sid: "AC" + "a".repeat(32) }) }; };
  await build({ stdin: { contents: 'export {checkIntegration} from "./lib/integration-checks";', resolveDir: import.meta.dirname }, outfile: path, bundle: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "isolated", setup(b) {
    b.onResolve({ filter: /^(nodemailer)$|integration-vault$|objectStorage$|local-media$/ }, a => ({ path: a.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path === "nodemailer" ? "export default {createTransport:()=>({verify:globalThis.checkVerify,close(){},sendMail(){throw Error('Must not send')}})}" : path.endsWith("integration-vault") ? `export async function resolvedIntegration(){return {source:"database",env:{SMTP_HOST:"smtp.example.invalid",SMTP_PORT:"465",SMTP_USER:"fixture",SMTP_PASSWORD:"fixture",SMTP_FROM:"test@example.invalid",OTP_PROVIDER:"twilio",TWILIO_ACCOUNT_SID:"AC${"a".repeat(32)}",TWILIO_AUTH_TOKEN:"${"b".repeat(32)}",TWILIO_MESSAGING_SERVICE_SID:"MG${"c".repeat(32)}"}}}` : path.endsWith("local-media") ? 'export const mediaConfig=()=>({driver:"object"});' : 'export class ObjectStorageService{getPrivateObjectDir(){return "/fixture/private"}};export const objectStorageClient={bucket:()=>({getMetadata:async()=>[{}]})};' }));
  }}] });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = globalThis.checkFetch;
  try {
    const { checkIntegration } = await import(path);
    for (const provider of ["smtp", "sms", "storage"]) {
      const result = await checkIntegration(provider);
      assert.ok(result.checks.some(c => c.status === "passed"));
      assert.ok(result.checks.some(c => c.status === "not_verified"));
    }
    assert.equal(verified, 1); assert.equal(fetched, 2);
    globalThis.checkFetch = async () => { throw Error("secret provider diagnostics"); };
    globalThis.fetch = globalThis.checkFetch;
    const failed = await checkIntegration("sms");
    assert.equal(failed.checks[0].status, "failed");
    assert.ok(!JSON.stringify(failed).includes("secret provider diagnostics"));
  } finally { globalThis.fetch = oldFetch; delete globalThis.checkFetch; delete globalThis.checkVerify; await rm(path, { force: true }); }
});