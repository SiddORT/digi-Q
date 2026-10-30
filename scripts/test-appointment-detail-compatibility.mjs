import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePostgresTools } from "../artifacts/api-server/src/test-support/postgres-tools.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const versions = JSON.parse(readFileSync(new URL("./appointment-detail-postgres-versions.json", import.meta.url), "utf8"));
const selected = [];
// Preflight both versions before starting any cluster. Never silently skip one.
for (const [role, major] of Object.entries(versions)) {
  const key = `CLINICFLOW_TEST_PG${major}_BIN`;
  let bin = process.env[key];
  if (!bin) {
    try {
      // Test-only Nix store output: no profile/module or application DB changes.
      const output = execFileSync("nix-build", [
        "<nixpkgs>", "-A", `postgresql_${major}`, "--no-out-link",
      ], { encoding: "utf8", timeout: 240000, stdio: ["ignore", "pipe", "inherit"] }).trim();
      bin = resolve(output, "bin");
    } catch (cause) {
      throw new Error(`PostgreSQL ${major} (${role}) is required. Set ${key} to its absolute bin directory or provide nix-build with <nixpkgs>.`, { cause });
    }
  }
  selected.push({ role, ...resolvePostgresTools({ bin, expectedMajor: major }) });
}
let failed = false;
for (const tools of selected) {
  console.log(`\nAppointment detail compatibility: ${tools.role} PostgreSQL ${tools.version}, tools=${tools.bin}`);
  const result = spawnSync(process.execPath, [
    "--test", "--test-concurrency=1",
    "artifacts/api-server/src/appointment-detail-loading.integration.test.mjs",
  ], {
    cwd: root, stdio: "inherit",
    env: { ...process.env, CLINICFLOW_TEST_PG_BIN: tools.bin, CLINICFLOW_TEST_PG_MAJOR: String(tools.major) },
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
