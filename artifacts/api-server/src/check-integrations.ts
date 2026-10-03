// Read-only operational check. Uses the same effective configuration as the API.
// Never sends messages, creates files/objects, or prints provider credentials.
import { pool } from "@workspace/db";
import { checkIntegration } from "./lib/integration-checks";
import { integrationSettings } from "./lib/integration-vault";

try {
  const requested = process.argv[2];
  const providers = ["smtp", "sms", "storage"] as const;
  if (requested && !(providers as readonly string[]).includes(requested)) throw Error("Unsupported provider");
  if (!requested) console.log(JSON.stringify({ configuration: await integrationSettings() }, null, 2));
  for (const provider of providers.filter(p => !requested || p === requested)) {
    console.log(JSON.stringify(await checkIntegration(provider), null, 2));
  }
} catch {
  console.error("Integration checks could not load the effective configuration. No credentials or provider diagnostics were printed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}