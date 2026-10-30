import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

// Resolve once, then never mix initdb/pg_ctl/postgres from different PATH entries.
export function resolvePostgresTools({
  bin = process.env.CLINICFLOW_TEST_PG_BIN,
  expectedMajor = process.env.CLINICFLOW_TEST_PG_MAJOR,
} = {}) {
  if (bin) assert.ok(isAbsolute(bin), "CLINICFLOW_TEST_PG_BIN must be an absolute bin directory");
  else bin = dirname(realpathSync(execFileSync("which", ["postgres"], { encoding: "utf8" }).trim()));
  bin = realpathSync(bin);
  const tools = {};
  const versions = [];
  for (const name of ["initdb", "pg_ctl", "postgres"]) {
    tools[name] = join(bin, name);
    const output = execFileSync(tools[name], ["--version"], { encoding: "utf8", timeout: 10000 });
    const version = output.match(/\(PostgreSQL\) (\d+(?:\.\d+)+)/)?.[1];
    assert.ok(version, `Cannot identify PostgreSQL version: ${tools[name]}`);
    versions.push(version);
  }
  assert.equal(new Set(versions).size, 1, `Mixed PostgreSQL tools in ${bin}: ${versions.join(", ")}`);
  const major = Number(versions[0].split(".")[0]);
  if (expectedMajor !== undefined) {
    assert.match(String(expectedMajor), /^[1-9]\d*$/, "Expected PostgreSQL major must be an integer");
    assert.equal(major, Number(expectedMajor), `Expected PostgreSQL ${expectedMajor}, found ${versions[0]} in ${bin}`);
  }
  return { ...tools, bin, major, version: versions[0] };
}
