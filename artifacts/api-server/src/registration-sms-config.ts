import { readFile, writeFile } from "node:fs/promises";
import { db, pool, settings, integrationCredentials } from "@workspace/db";
import { configurationDigest, inspectRegistrationSms, installRegistrationSms, approvedRegistrationSms } from "./lib/approved-registration-sms";
import { notificationTemplateKey } from "./lib/notification-template-store";

// Explicit operator CLI only. Not imported by app startup or seed.mjs.
async function main() {
  const args = process.argv.slice(2);
  const value = (flag: string) => args[args.indexOf(flag) + 1];
  const mode = args[0];
  const environment = value("--environment");
  const planFile = value("--plan");
  if (!["check", "apply"].includes(mode) || !args.includes("--environment") ||
      !["workspace", "uat", "production"].includes(environment) || !args.includes("--plan") || !planFile)
    throw new Error("Use check|apply --environment workspace|uat|production --plan <file> [--actor-id <id> --confirm-environment <name>]");
  const url = new URL(process.env.DATABASE_URL!);
  const target = configurationDigest([url.hostname, url.port || "5432", url.pathname]);
  const targets = new Set(approvedRegistrationSms.map(p => notificationTemplateKey("registration_mobile_otp", undefined, p.recipient, "sms")));
  targets.add("configuration-install:approved-registration-sms");
  const snapshot = async () => {
    const all = await db.select().from(settings).orderBy(settings.id);
    const unrelated = all.filter(r => !targets.has(r.id));
    return { settingsCount: unrelated.length, settingsDigest: configurationDigest(unrelated),
      providersDigest: configurationDigest(await db.select().from(integrationCredentials).orderBy(integrationCredentials.provider)),
      approvedCount: unrelated.filter(r => /^(sms|notification)-template:/.test(r.id) && !!r.data?.published).length };
  };
  if (mode === "check") {
    const result = await inspectRegistrationSms(db, environment, target);
    await writeFile(planFile, JSON.stringify(result.plan, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    process.stdout.write(JSON.stringify({ environment, targetFingerprint: target, ...result, preservation: await snapshot(), sends: 0 }, null, 2) + "\n");
  } else {
    if (value("--confirm-environment") !== environment || !args.includes("--actor-id"))
      throw new Error("Apply requires --actor-id and --confirm-environment matching --environment.");
    const plan = JSON.parse(await readFile(planFile, "utf8"));
    const before = await snapshot();
    const result = await installRegistrationSms(db, value("--actor-id"), plan, environment, target);
    const after = await snapshot();
    process.stdout.write(JSON.stringify({ environment, targetFingerprint: target, ...result,
      preservation: { before, after, unchanged: configurationDigest(before) === configurationDigest(after) }, sends: 0 }, null, 2) + "\n");
  }
}
try { await main(); }
catch (error: any) {
  // Only known application errors have safe messages; never expose SQL/connection/provider errors.
  process.stderr.write((error?.status ? error.message : "Configuration command failed. Check arguments, plan-file access and database connectivity; no credentials were printed.") + "\n");
  process.exitCode = 1;
} finally { await pool.end(); }
