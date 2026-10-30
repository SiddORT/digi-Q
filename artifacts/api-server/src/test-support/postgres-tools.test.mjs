import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePostgresTools } from "./postgres-tools.mjs";

test("tool selection fails closed for missing, mixed and wrong-major binaries", () => {
  const bin = mkdtempSync(join(tmpdir(), "clinicflow-pg-tools-"));
  const tool = (name, version) => writeFileSync(join(bin, name),
    `#!/bin/sh\nprintf '%s\\n' '${name} (PostgreSQL) ${version}'\n`, { mode: 0o700 });
  try {
    assert.throws(() => resolvePostgresTools({ bin, expectedMajor: 15 }), /ENOENT/);
    for (const name of ["initdb", "pg_ctl", "postgres"]) tool(name, "15.13");
    const selected = resolvePostgresTools({ bin, expectedMajor: 15 });
    assert.equal(selected.version, "15.13");
    assert.equal(selected.postgres, join(bin, "postgres"));
    assert.throws(() => resolvePostgresTools({ bin, expectedMajor: 16 }), /Expected PostgreSQL 16/);
    tool("pg_ctl", "16.10");
    assert.throws(() => resolvePostgresTools({ bin, expectedMajor: 15 }), /Mixed PostgreSQL tools/);
    assert.throws(() => resolvePostgresTools({ bin: "relative/bin" }), /absolute bin directory/);
  } finally { rmSync(bin, { recursive: true, force: true }); }
});
