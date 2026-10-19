// Explicit read-only development check. Never send mail or alter saved settings.
// node scripts/verify-digi-smtp.mjs
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (process.env.NODE_ENV === "production") {
  console.error("Blocked: this check is authorized for development only.");
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
const bundle = resolve(root, `artifacts/api-server/.verify-digi-smtp-${process.pid}.mjs`);
try {
  await require("esbuild").build({
    stdin: { resolveDir: resolve(root, "artifacts/api-server/src"), loader: "ts", contents: `
      import { pool } from "@workspace/db";
      import { resolvedIntegration } from "./lib/integration-vault";
      import { smtpEnvironment } from "./lib/integration-config";
      import { verifySmtp } from "./lib/smtp-verification";
      const known = new Set(["EAUTH","ETIMEDOUT","ENOTFOUND","ECONNREFUSED","ECONNRESET","ESOCKET","EDNS","ECONNECTION","ETLS","CERT_HAS_EXPIRED","DEPTH_ZERO_SELF_SIGNED_CERT","UNABLE_TO_VERIFY_LEAF_SIGNATURE","ERR_TLS_CERT_ALTNAME_INVALID","EMAIL_UNCONFIGURED","INTEGRATION_DECRYPT_FAILED","INTEGRATION_KEY_REQUIRED"]);
      const category = error => known.has(error?.code) ? error.code : "VERIFICATION_UNAVAILABLE";
      async function verify(scope, env) {
        try {
          await verifySmtp(env);
          console.log(JSON.stringify({scope,status:"passed",connectionTlsAuthentication:"verified",messagesSent:0,senderAuthorization:"not_verified",inboxDelivery:"not_verified"}));
        } catch(error) {
          console.log(JSON.stringify({scope,status:"failed",category:category(error),messagesSent:0}));
          process.exitCode = 1;
        }
      }
      try {
        await verify("DIGI_SMTP environment credentials", smtpEnvironment());
        // Inspect only the provider row; never load unrelated settings or expose values.
        let resolved;
        try {
          resolved = await resolvedIntegration("smtp");
          console.log(JSON.stringify({effectiveSource:resolved.source,savedSettingsChanged:false}));
        } catch(error) {
          console.log(JSON.stringify({scope:"application effective source",status:"blocked",category:category(error),messagesSent:0}));
          process.exitCode = 1;
        }
        if(resolved?.source === "database") await verify("application effective saved credentials",resolved.env);
        if(resolved?.source === "environment") console.log(JSON.stringify({scope:"application effective source",sameAsDigiEnvironment:true}));
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
