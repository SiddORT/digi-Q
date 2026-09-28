import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Keep the old operator command, but never accept an identity ID or password on argv.
if (process.argv.length !== 2) throw new Error("No command-line credentials accepted. Set SUPERADMIN_EMAIL, SUPERADMIN_NAME and SUPERADMIN_PASSWORD securely in the environment.");
if (!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_NAME || !process.env.SUPERADMIN_PASSWORD) {
  throw new Error("SUPERADMIN_EMAIL, SUPERADMIN_NAME and SUPERADMIN_PASSWORD must be set in the environment for bootstrap.");
}
const seed = fileURLToPath(new URL("../../lib/db/seed.mjs", import.meta.url));
const child = spawnSync(process.execPath, [seed], { env: process.env, stdio: "inherit" });
if (child.error || child.status !== 0) {
  throw new Error("Super administrator seed failed; no credentials were printed.");
}