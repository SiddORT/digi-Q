// Explicit operator-only action; never used by workflows or the read-only checker.
// Usage: node scripts/send-approved-smtp-test.mjs --confirm-send-one recipient
// Read-only sender comparison: node scripts/send-approved-smtp-test.mjs --inspect-sender
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!(process.argv.length === 3 && process.argv[2] === "--inspect-sender") && (process.argv.length !== 4 || process.argv[2] !== "--confirm-send-one")) {
  console.error("Explicit --confirm-send-one and one approved recipient are required.");
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
const { build } = createRequire(resolve(root, "artifacts/api-server/package.json"))("esbuild");
const bundle = resolve(root, `artifacts/api-server/.approved-smtp-test-${process.pid}.mjs`);
try {
  await build({
    stdin: { resolveDir: resolve(root, "artifacts/api-server/src"), loader: "ts", contents: `
      import nodemailer from "nodemailer";
      import { pool } from "@workspace/db";
      import { resolvedIntegration } from "./lib/integration-vault";
      import { smtpConfig, validEmailAddress } from "./lib/integration-config";
      let transport, started = false;
      try {
        const resolved = await resolvedIntegration("smtp");
        const cfg = smtpConfig(resolved.env);
        if (process.argv[2] === "--inspect-sender") {
          const fromAddress = (cfg.from.match(/<([^<>]+)>/)?.[1] || cfg.from).trim().toLowerCase();
          console.log(JSON.stringify({ source: resolved.source, senderMatchesLogin: fromAddress === cfg.user.trim().toLowerCase(), loginIsEmailAddress: validEmailAddress(cfg.user), attempts: 0 }));
        } else {
        const recipient = process.argv[3];
        if (!validEmailAddress(recipient)) throw Error("Invalid recipient");
        transport = nodemailer.createTransport({
          host: cfg.host, port: cfg.port, secure: cfg.secure, requireTLS: !cfg.secure && cfg.requireTLS,
          auth: { user: cfg.user, pass: cfg.password },
          connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
          logger: false, debug: false,
        });
        started = true;
        const result = await transport.sendMail({
          from: cfg.from, to: recipient,
          subject: "DigiQ Doctors — SMTP configuration test",
          text: "This is a test email requested by a DigiQ Doctors Super Admin to check SMTP configuration. No patient or account information is included.",
          disableFileAccess: true, disableUrlAccess: true,
        });
        console.log(JSON.stringify({
          status: result.accepted?.length && !result.rejected?.length ? "provider_accepted" : "not_accepted",
          source: resolved.source,
          acceptedCount: result.accepted?.length || 0, rejectedCount: result.rejected?.length || 0,
          inboxDelivery: "not_verified", attempts: 1
        }));
        }
      } catch (error: any) {
        // Report protocol facts and classified reasons only, never raw server text,
        // account addresses, hosts, credentials, or message contents.
        const response = typeof error.response === "string" ? error.response : "";
        const knownCodes = ["EAUTH","EENVELOPE","EMESSAGE","ESOCKET","ETIMEDOUT","ECONNECTION","ETLS","EDNS"];
        const command = ["CONN","AUTH PLAIN","AUTH LOGIN","AUTH","STARTTLS","MAIL FROM","RCPT TO","DATA"].includes(error.command) ? error.command : "not_reported";
        const responseCode = Number.isInteger(error.responseCode) ? error.responseCode : null;
        const enhancedCode = response.match(/\\b[245]\\.\\d{1,3}\\.\\d{1,3}\\b/)?.[0] || null;
        const reason = enhancedCode === "5.2.252" || /SendAsDenied|not allowed to send as/i.test(response) ? "send_as_permission_denied"
          : /not verified|unverified|verify (your|the) (sender|domain)/i.test(response) ? "sender_or_domain_verification_required"
          : /daily|quota|rate limit|too many/i.test(response) ? "provider_sending_limit"
          : /not authorized|not authorised|access denied|permission|not permitted/i.test(response) ? "provider_permission_denied"
          : /relay.*denied|relaying.*denied/i.test(response) ? "relay_denied"
          : /spam|blacklist|blocklist/i.test(response) ? "provider_filter_or_blocklist"
          : /policy|rejected/i.test(response) ? "provider_policy_rejection"
          : "provider_reason_not_classified";
        console.log(JSON.stringify({
          status: !started ? "configuration_failure" : responseCode >= 400 && responseCode < 600 ? "provider_rejected" : "outcome_uncertain",
          attempts: started ? 1 : 0, code: knownCodes.includes(error.code) ? error.code : "OTHER",
          responseCode, enhancedCode, command, reason, retried: false
        }));
        process.exitCode = 1;
      } finally { transport?.close(); await pool.end(); }
    ` },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "workspace-database", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: resolve(root, "lib/db/src/index.ts") }));
      b.onResolve({ filter: /^pg$/ }, () => ({ path: createRequire(resolve(root, "lib/db/package.json")).resolve("pg"), external: true }));
    } }],
  });
  await import(pathToFileURL(bundle).href);
} catch {
  console.error("Test runner failed. Delivery status is unknown; do not retry automatically.");
  process.exitCode = 1;
} finally {
  await rm(bundle, { force: true });
}