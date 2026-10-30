import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPostgresVersionMatrix } from "./postgres-version-matrix.mjs";

test("matrix preflights both roles and propagates failures from either child without skipping the other", () => {
  const dir = mkdtempSync(join(tmpdir(), "clinicflow-pg-matrix-"));
  const marker = join(dir, "runs");
  const fixture = join(dir, "child.mjs");
  const versions = { minimum: 15, current: 16 };
  const bins = {};
  const previous = Object.fromEntries(Object.values(versions).map(major => {
    const key = `CLINICFLOW_TEST_PG${major}_BIN`;
    return [key, process.env[key]];
  }));
  try {
    for (const major of Object.values(versions)) {
      const bin = join(dir, String(major));
      mkdirSync(bin);
      bins[major] = bin;
      for (const name of ["initdb", "pg_ctl", "postgres"])
        writeFileSync(join(bin, name), `#!/bin/sh\nprintf '%s\\n' '${name} (PostgreSQL) ${major}.1'\n`, { mode: 0o700 });
      process.env[`CLINICFLOW_TEST_PG${major}_BIN`] = bin;
    }
    const run = () => runPostgresVersionMatrix({ label: "Matrix contract fixture", testFiles: [fixture], versions });
    const child = (failure = "") => writeFileSync(fixture, `
      import { appendFileSync } from "node:fs";
      import assert from "node:assert/strict";
      const major = process.env.CLINICFLOW_TEST_PG_MAJOR;
      assert.equal(process.env.CLINICFLOW_TEST_PG_BIN, ${JSON.stringify(bins)}[major]);
      appendFileSync(${JSON.stringify(marker)}, major + "\\n");
      ${failure}
    `);
    child();
    process.env.CLINICFLOW_TEST_PG16_BIN = join(dir, "missing");
    assert.throws(run, /ENOENT/);
    assert.equal(existsSync(marker), false, "no child starts with an unavailable required major");
    process.env.CLINICFLOW_TEST_PG16_BIN = bins[16];
    assert.equal(run(), 0);
    assert.equal(readFileSync(marker, "utf8"), "15\n16\n");
    for (const major of [15, 16]) {
      rmSync(marker);
      child(`assert.notEqual(major, "${major}", "intentional child assertion failure");`);
      assert.equal(run(), 1);
      assert.equal(readFileSync(marker, "utf8"), "15\n16\n");
    }
    rmSync(marker);
    child('process.kill(process.pid, "SIGTERM");');
    assert.equal(run(), 1, "signalled child cannot pass");
    assert.equal(readFileSync(marker, "utf8"), "15\n16\n");
    for (const invalid of [{ minimum: 15 }, { minimum: "15", current: 16 }, { minimum: 15, current: 0 }])
      assert.throws(() => runPostgresVersionMatrix({ label: "Invalid", testFiles: [fixture], versions: invalid }));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
