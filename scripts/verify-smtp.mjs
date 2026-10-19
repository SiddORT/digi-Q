// Read-only development readiness: node scripts/verify-smtp.mjs
// Only with separate authorization: node scripts/verify-smtp.mjs --verify-connection
// Never sends mail or alters settings. No credential values or raw errors are output.
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (process.env.NODE_ENV === "production") {
  console.error("Blocked: this check is authorized for development only.");
  process.exit(1);
}
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--verify-connection")) {
  console.error("Usage: node scripts/verify-smtp.mjs [--verify-connection]");
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
const bundle = resolve(root, `artifacts/api-server/.verify-smtp-${process.pid}.mjs`);
try {
  await require("esbuild").build({
    stdin: { resolveDir: resolve(root, "artifacts/api-server/src"), loader: "ts", contents: `
      import { pool } from "@workspace/db";
      import { resolvedIntegration } from "./lib/integration-vault";
      import { smtpEnvironment, integrationReadiness, smtpConfig } from "./lib/integration-config";
      import { verifySmtp } from "./lib/smtp-verification";
      const connect = ${args.includes("--verify-connection")};
      const known = new Set(["EAUTH","ETIMEDOUT","ENOTFOUND","ECONNREFUSED","ECONNRESET","ESOCKET","EDNS","ECONNECTION","ETLS","CERT_HAS_EXPIRED","DEPTH_ZERO_SELF_SIGNED_CERT","UNABLE_TO_VERIFY_LEAF_SIGNATURE","ERR_TLS_CERT_ALTNAME_INVALID","EMAIL_UNCONFIGURED","INTEGRATION_DECRYPT_FAILED","INTEGRATION_KEY_REQUIRED"]);
      const category = error => known.has(error?.code) ? error.code : "VERIFICATION_UNAVAILABLE";
      async function inspect(scope, env) {
        const readiness = integrationReadiness(env).smtp;
        let securityTransportReady = true;
        try { smtpConfig(env); } catch { securityTransportReady = false; }
        console.log(JSON.stringify({scope,configurationReady:readiness.ready,securityTransportReady,
          keys:readiness.keys,connectionTlsAuthentication:"not_verified",messagesSent:0,
          senderAuthorization:"not_verified",inboxDelivery:"not_verified"}));
        if(!readiness.ready) process.exitCode = 1;
        if(!connect) return;
        try {
          await verifySmtp(env);
          console.log(JSON.stringify({scope,status:"passed",connectionTlsAuthentication:"verified",messagesSent:0,senderAuthorization:"not_verified",inboxDelivery:"not_verified"}));
        } catch(error) {
          console.log(JSON.stringify({scope,status:"failed",category:category(error),messagesSent:0}));
          process.exitCode = 1;
        }
      }
      try {
        await inspect("SMTP environment configuration", smtpEnvironment());
        // Inspect only the provider row; never load unrelated settings or expose values.
        let resolved;
        try {
          resolved = await resolvedIntegration("smtp");
          console.log(JSON.stringify({effectiveSource:resolved.source,savedSettingsChanged:false}));
        } catch(error) {
          console.log(JSON.stringify({scope:"application effective source",status:"blocked",category:category(error),messagesSent:0}));
          process.exitCode = 1;
        }
        if(resolved?.source === "database") await inspect("application effective saved configuration",resolved.env);
        if(resolved?.source === "environment") console.log(JSON.stringify({scope:"application effective source",sameAsSmtpEnvironment:true}));
      } finally { await pool.end(); }
    ` },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "workspace-database", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: resolve(root, "lib/db/src/index.ts") }));
      b.onResolve({ filter: /^pg$/ }, () => ({ path: createRequire(resolve(root, "lib/db/package.json")).resolve("pg"), external: true }));
    } }],
  });
  await import(pathToFileURL(bundle).href);
} catch {
  console.error("SMTP verification blocked: setup unavailable. No credentials or raw provider responses disclosed.");
  process.exitCode = 1;
} finally {
  await rm(bundle, { force: true });
}
