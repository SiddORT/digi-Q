// Fail closed: preflight every declared major before creating any cluster.
// No application connection URL is used or accepted by this runner.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePostgresTools } from "../artifacts/api-server/src/test-support/postgres-tools.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const versions = JSON.parse(readFileSync(new URL("./appointment-detail-postgres-versions.json", import.meta.url), "utf8"));
assert.deepEqual(Object.keys(versions).sort(), ["current", "minimum"]);
assert.ok(Number.isInteger(versions.minimum) && versions.minimum > 0);
assert.ok(Number.isInteger(versions.current) && versions.current > versions.minimum);
const selected = [];
for (const [role, major] of Object.entries(versions)) {
  const key = `CLINICFLOW_TEST_PG${major}_BIN`;
  let bin = process.env[key];
  if (!bin) {
    try {
      // Test-only Nix store output; does not alter modules or database versions.
      bin = resolve(execFileSync("nix-build", [
        "<nixpkgs>", "-A", `postgresql_${major}`, "--no-out-link",
      ], { encoding: "utf8", timeout: 240000, stdio: ["ignore", "pipe", "inherit"] }).trim(), "bin");
    } catch (cause) {
      throw new Error(`PostgreSQL ${major} (${role}) is required. Set ${key} to its absolute bin directory or provide nix-build with <nixpkgs>.`, { cause });
    }
  }
  selected.push({ role, ...resolvePostgresTools({ bin, expectedMajor: major }) });
}
let failed = false;
for (const tools of selected) {
  console.log(`\nMigration rehearsal: ${tools.role} PostgreSQL ${tools.version}, tools=${tools.bin}`);
  const env = Object.fromEntries(Object.entries(process.env).filter(
    ([key]) => key !== "DATABASE_URL" && !key.startsWith("PG"),
  ));
  const result = spawnSync(process.execPath, [
    "--test", "--test-concurrency=1",
    "artifacts/api-server/src/postgres-migrations.integration.test.mjs",
  ], {
    cwd: root, stdio: "inherit",
    env: { ...env, CLINICFLOW_TEST_PG_BIN: tools.bin, CLINICFLOW_TEST_PG_MAJOR: String(tools.major) },
    timeout: 180000,
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
