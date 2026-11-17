// Structural compatibility guard, not evidence of native Windows execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// YAML is already a declared dependency of the deck; no new tooling resolution.
const require = createRequire(new URL("../artifacts/clinicflow-project-deck/package.json", import.meta.url));
const { parse } = require("yaml");
export const targets = [
  { parent: "@tailwindcss/oxide", windows: "@tailwindcss/oxide-win32-x64-msvc", linux: "@tailwindcss/oxide-linux-x64-gnu" },
  { parent: "esbuild", windows: "@esbuild/win32-x64", linux: "@esbuild/linux-x64" },
  { parent: "lightningcss", windows: "lightningcss-win32-x64-msvc", linux: "lightningcss-linux-x64-gnu" },
  { parent: "rollup", windows: "@rollup/rollup-win32-x64-msvc", linux: "@rollup/rollup-linux-x64-gnu" },
];

export function checkWindowsDependencies(workspace, lock) {
  assert.deepEqual(lock.overrides, workspace.overrides, "workspace/lockfile overrides disagree");
  for (const [selector, value] of Object.entries(workspace.overrides ?? {})) {
    const child = selector.split(">").at(-1);
    for (const { windows } of targets) {
      assert.ok(!(value === "-" && (child === windows || child.startsWith(`${windows}@`))),
        `forbidden Windows exclusion: ${selector}`);
    }
  }
  const checked = [];
  for (const { parent, windows, linux } of targets) {
    const prefix = `${parent}@`;
    const parents = Object.keys(lock.packages ?? {}).filter(key => key.startsWith(prefix));
    assert.ok(parents.length, `missing parent package: ${parent}`);
    const snapshots = Object.keys(lock.snapshots ?? {}).filter(key => key.startsWith(prefix));
    for (const parentKey of parents) {
      assert.ok(snapshots.some(key => key.split("(")[0] === parentKey), `missing parent snapshot: ${parentKey}`);
    }
    for (const snapshotKey of snapshots) {
      const parentKey = snapshotKey.split("(")[0];
      assert.ok(Object.hasOwn(lock.packages, parentKey), `missing parent package: ${parentKey}`);
      const version = parentKey.slice(prefix.length);
      for (const [child, os] of [[windows, "win32"], [linux, "linux"]]) {
        const childKey = `${child}@${version}`;
        assert.equal(lock.snapshots[snapshotKey].optionalDependencies?.[child], version,
          `missing/mismatched optional edge: ${snapshotKey} -> ${childKey}`);
        const record = lock.packages[childKey];
        assert.ok(record, `missing native package: ${childKey}`);
        assert.match(record.resolution?.integrity ?? "", /^sha512-\S+$/, `missing integrity: ${childKey}`);
        assert.deepEqual(record.os, [os], `wrong OS: ${childKey}`);
        assert.deepEqual(record.cpu, ["x64"], `wrong CPU: ${childKey}`);
        assert.ok(Object.hasOwn(lock.snapshots, childKey), `missing native snapshot: ${childKey}`);
        assert.equal(lock.snapshots[childKey].optional, true, `native snapshot is not optional: ${childKey}`);
      }
      checked.push(snapshotKey);
    }
  }
  return checked;
}

export function readPolicies(root = fileURLToPath(new URL("../", import.meta.url))) {
  return {
    workspace: parse(readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8")),
    lock: parse(readFileSync(resolve(root, "pnpm-lock.yaml"), "utf8")),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { workspace, lock } = readPolicies();
  const checked = checkWindowsDependencies(workspace, lock);
  console.log(`Windows x64 + Linux x64 optional records and edges verified for ${checked.length} parent snapshots.`);
}
