import { test } from "node:test";
import assert from "node:assert/strict";
import { targets, checkWindowsDependencies, readPolicies } from "./check-windows-dependencies.mjs";

// Small, synthetic two-version fixture catches guards that inspect only the
// first matching parent. Mutations never touch the real policy or lockfile.
function fixture() {
  const workspace = { overrides: { esbuild: "0.28.2", "other>unused-platform": "-" } };
  const lock = { overrides: { ...workspace.overrides }, packages: {}, snapshots: {} };
  for (const { parent, windows, linux } of targets) {
    for (const version of ["1.0.0", "2.0.0"]) {
      const key = `${parent}@${version}`;
      lock.packages[key] = {};
      lock.snapshots[`${key}(peer@1.0.0)`] = { optionalDependencies: { [windows]: version, [linux]: version } };
      for (const [child, os] of [[windows, "win32"], [linux, "linux"]]) {
        lock.packages[`${child}@${version}`] = { resolution: { integrity: "sha512-fixture" }, os: [os], cpu: ["x64"] };
        lock.snapshots[`${child}@${version}`] = { optional: true };
      }
    }
  }
  return { workspace, lock };
}

test("checked-in workspace and lockfile preserve Windows and Linux x64 support", () => {
  const { workspace, lock } = readPolicies();
  assert.ok(checkWindowsDependencies(workspace, lock).length >= 4);
});

test("accepts multiple versions and peer contexts without broad platform-policy checks", () => {
  const { workspace, lock } = fixture();
  assert.equal(checkWindowsDependencies(workspace, lock).length, 8);
});

for (const target of targets) {
  for (const selector of [
    `${target.parent}>${target.windows}`,
    `${target.parent}@^1>${target.windows}`,
    target.windows,
  ]) {
    test(`rejects restored exclusion ${selector}`, () => {
      const { workspace, lock } = fixture();
      workspace.overrides[selector] = lock.overrides[selector] = "-";
      assert.throws(() => checkWindowsDependencies(workspace, lock), /forbidden Windows exclusion/);
    });
  }
  for (const platform of ["windows", "linux"]) {
    const child = target[platform];
    for (const mutation of ["edge", "version", "package", "snapshot", "optional", "os", "cpu", "integrity"]) {
      test(`rejects ${target.parent} ${platform} ${mutation} regression in second version`, () => {
        const { workspace, lock } = fixture();
        const key = `${child}@2.0.0`;
        const edges = lock.snapshots[`${target.parent}@2.0.0(peer@1.0.0)`].optionalDependencies;
        if (mutation === "edge") delete edges[child];
        if (mutation === "version") edges[child] = "1.0.0";
        if (mutation === "package") delete lock.packages[key];
        if (mutation === "snapshot") delete lock.snapshots[key];
        if (mutation === "optional") delete lock.snapshots[key].optional;
        if (mutation === "os") lock.packages[key].os = ["darwin"];
        if (mutation === "cpu") lock.packages[key].cpu = ["arm64"];
        if (mutation === "integrity") delete lock.packages[key].resolution.integrity;
        assert.throws(() => checkWindowsDependencies(workspace, lock));
      });
    }
  }
  for (const mutation of ["package", "snapshot", "all"]) {
    test(`rejects missing ${target.parent} parent ${mutation}`, () => {
      const { workspace, lock } = fixture();
      for (const version of ["1.0.0", "2.0.0"]) {
        if (mutation !== "snapshot") delete lock.packages[`${target.parent}@${version}`];
        if (mutation !== "package") delete lock.snapshots[`${target.parent}@${version}(peer@1.0.0)`];
      }
      assert.throws(() => checkWindowsDependencies(workspace, lock), /missing parent/);
    });
  }
}

for (const side of ["workspace", "lock"]) {
  test(`rejects override disagreement introduced in ${side}`, () => {
    const data = fixture();
    data[side].overrides.esbuild = "0.0.1";
    assert.throws(() => checkWindowsDependencies(data.workspace, data.lock), /overrides disagree/);
  });
}
