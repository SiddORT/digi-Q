import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { captureFingerprint, compareFingerprint, applyFreshness, workspaceRoot } from "./ui-evidence-freshness.mjs";
import evidenceSetup from "../artifacts/clinicflow/workspace-regression/evidence-setup.mjs";

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), "ui-evidence-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, data) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof data === "string" ? data : JSON.stringify(data));
  };
  return { root, write };
}
const clone = data => JSON.parse(JSON.stringify(data));
function ledger(fingerprint) {
  return {
    notice: "Not UAT or cross-browser acceptance",
    runs: [{ fingerprints: fingerprint ? { start: fingerprint, end: fingerprint } : null }],
    routes: [
      { role: "doctor", path: "/doctor/dashboard", status: "passed", evidenceRun: 0, disposition: "rendered-initial-state", limitation: "Initial geometry only" },
      { role: "patient", path: "/patient/queue", status: "passed", evidenceRun: 0, disposition: "rendered-permitted-redirect", limitation: "Permitted redirect, not restricted body acceptance" },
      { role: "doctor", path: "/doctor/book", status: "failed", evidenceRun: 0, disposition: "blocked-fixture", limitation: "Missing fixture" },
    ],
    tests: [{ name: "limited local check", status: "passed", evidenceRun: 0, limitation: "Safari/Firefox Add Staff unverified" }],
    routePatterns: [
      { path: "/doctor/dashboard", samples: [{ role: "doctor", path: "/doctor/dashboard", disposition: "rendered-initial-state" }] },
      { path: "/set-password", samples: [], disposition: "unverified-route" },
    ],
    surfaces: [{ disposition: "unverified-per-instance", reasonCode: "conditional-owner" }],
    stateProfiles: { form: ["dirty", "invalid"] },
    numberedRequirements: [], functionalRequirements: [],
  };
}

test("content fingerprints are reproducible across roots and ignore mtime/output/secrets", t => {
  const a = sandbox(t), b = sandbox(t);
  for (const box of [a, b]) {
    box.write("artifacts/clinicflow/src/App.tsx", "export const RouteOwner = 'A'");
    box.write("artifacts/clinicflow/src/forms.css", ".field { color: red; }");
  }
  const before = captureFingerprint(a.root);
  utimesSync(join(a.root, "artifacts/clinicflow/src/App.tsx"), new Date(0), new Date(0));
  a.write("generated-artifacts/report.json", "not an input");
  a.write("artifacts/clinicflow/workspace-regression/test-results/trace.zip", "not an input");
  a.write("artifacts/clinicflow/workspace-regression/evidence/old.png", "not an input");
  a.write(".env", "FAKE_SETTING=ignored");
  assert.deepEqual(captureFingerprint(a.root), before);
  assert.deepEqual(captureFingerprint(b.root), before);
  assert.equal(before.algorithm, "sha256");
  assert.ok(Object.keys(before.files).every(path => !path.startsWith("/")));
});

for (const [label, path] of [
  ["route owner", "artifacts/clinicflow/src/App.tsx"],
  ["conditional owner without JSX changes", "artifacts/clinicflow/src/components/Staff.tsx"],
  ["state criteria", "scripts/compact-ui-inventory.mjs"],
  ["tested stylesheet", "artifacts/clinicflow/src/compact-ui.css"],
  ["fixture stylesheet", "artifacts/clinicflow/workspace-regression/workspace.css"],
  ["test criteria", "artifacts/clinicflow/workspace-regression/tests/app-wide-ui.spec.ts"],
  ["test config", "artifacts/clinicflow/workspace-regression/playwright.config.ts"],
  ["shared client", "lib/api-client-react/src/generated.ts"],
  ["lockfile", "pnpm-lock.yaml"],
]) test(`${label} byte changes invalidate evidence; additions and deletions are detected`, t => {
  const box = sandbox(t);
  box.write(path, "before");
  const before = captureFingerprint(box.root);
  box.write(path, "after");
  const changed = compareFingerprint(before, captureFingerprint(box.root));
  assert.equal(changed.status, "stale");
  assert.deepEqual(changed.changedInputs, [path]);
  rmSync(join(box.root, path));
  assert.equal(compareFingerprint(before, captureFingerprint(box.root)).status, "stale");
  box.write("artifacts/clinicflow/src/new-styles.css", ".new {}");
  assert.ok(compareFingerprint(before, captureFingerprint(box.root)).changedInputs.includes("artifacts/clinicflow/src/new-styles.css"));
});

test("stale passes are withdrawn while historical redirects, failures and limitations survive", t => {
  const box = sandbox(t), before = captureFingerprint(box.root), original = ledger(before);
  box.write("artifacts/clinicflow/src/App.tsx", "new owner");
  const stale = applyFreshness(clone(original), captureFingerprint(box.root));
  assert.equal(stale.freshness.status, "stale");
  assert.equal(stale.routes[0].disposition, "stale-evidence");
  assert.equal(stale.routes[0].historicalStatus, "passed");
  assert.equal(stale.routes[0].status, "stale-evidence");
  assert.equal(stale.routes[1].historicalDisposition, "rendered-permitted-redirect");
  assert.equal(stale.routes[1].limitation, original.routes[1].limitation);
  assert.equal(stale.routes[2].status, "failed");
  assert.equal(stale.routes[2].disposition, "blocked-fixture");
  assert.equal(stale.tests[0].status, "stale-evidence");
  assert.equal(stale.tests[0].limitation, original.tests[0].limitation);
  assert.deepEqual(stale.surfaces, original.surfaces);
  assert.equal(stale.routePatterns[1].disposition, "unverified-route");
  assert.equal(stale.routePatterns[0].samples[0].disposition, "stale-evidence");
  assert.deepEqual(applyFreshness(clone(stale), captureFingerprint(box.root)), stale);
  // Exact input restoration makes observations current, not broader acceptance.
  assert.equal(applyFreshness(stale, before).routes[1].disposition, "rendered-permitted-redirect");
});

test("legacy, missing provenance, corrupt and mid-run fingerprints fail closed", t => {
  const box = sandbox(t), current = captureFingerprint(box.root);
  assert.equal(applyFreshness(ledger(null), current).freshness.status, "stale");
  const corrupt = clone(current);
  corrupt.digest = "invalid";
  assert.equal(compareFingerprint(corrupt, current).status, "stale");
  const missing = ledger(current);
  delete missing.routes[0].evidenceRun;
  assert.equal(applyFreshness(missing, current).routes[0].freshness.reason, "missing-run-provenance");
  const changed = ledger(current);
  box.write("artifacts/clinicflow/src/a.css", "changed during run");
  changed.runs[0].fingerprints.end = captureFingerprint(box.root);
  assert.equal(applyFreshness(changed, current).freshness.status, "stale");
});

test("workspace setup captures both endpoints without starting a browser or server", () => {
  const config = { metadata: {} };
  const finish = evidenceSetup(config);
  assert.ok(config.metadata.uiEvidence.start.digest);
  assert.equal(config.metadata.uiEvidence.end, undefined);
  finish();
  assert.deepEqual(config.metadata.uiEvidence.start, config.metadata.uiEvidence.end);
});

test("real Playwright JSON reporter retains setup/teardown fingerprints without browser fixtures", t => {
  const box = sandbox(t);
  symlinkSync(join(workspaceRoot, "node_modules"), join(box.root, "node_modules"), "dir");
  box.write("playwright.config.mjs", `export default {
    testDir: "./tests", outputDir: "./test-results", reporter: "json",
    globalSetup: ${JSON.stringify(join(workspaceRoot, "artifacts/clinicflow/workspace-regression/evidence-setup.mjs"))}
  };`);
  box.write("tests/metadata.spec.ts", `import { test, expect } from "@playwright/test";
    test("metadata only; no page or live I/O", async ({}, info) => {
      expect(info.config.metadata.uiEvidence.start.digest).toMatch(/^[a-f0-9]{64}$/);
    });`);
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.config.mjs"], {
    cwd: box.root, encoding: "utf8", timeout: 30000,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: "", PLAYWRIGHT_JSON_OUTPUT_FILE: "", PLAYWRIGHT_JSON_OUTPUT_DIR: "" },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.stats.expected, 1);
  assert.deepEqual(output.config.metadata.uiEvidence.start, output.config.metadata.uiEvidence.end);
  assert.equal(output.config.metadata.uiEvidence.start.algorithm, "sha256");
});

function cliSandbox(t) {
  const box = sandbox(t);
  for (const file of ["app-wide-ui-ledger.mjs", "ui-evidence-freshness.mjs"]) {
    box.write(`scripts/${file}`, readFileSync(join(workspaceRoot, "scripts", file), "utf8"));
  }
  box.write("reports/digiq-master-checklist-137.md", Array.from({ length: 137 }, (_, i) => `${i + 1}. [UI] Criterion`).join("\n"));
  box.write("docs/functional-completion-acceptance.md", "| 1 | Patient view |");
  box.write("artifacts/clinicflow/src/App.tsx", "old owner");
  const run = (...args) => spawnSync(process.execPath, ["scripts/app-wide-ui-ledger.mjs", ...args], { cwd: box.root, encoding: "utf8" });
  const readLedger = () => JSON.parse(readFileSync(join(box.root, "docs/ui/app-wide-ui-ledger.json"), "utf8"));
  return { ...box, run, readLedger };
}
function report(fingerprint, paths) {
  return {
    config: { metadata: { uiEvidence: { start: fingerprint, end: fingerprint } } },
    stats: { expected: paths.length },
    suites: [{ specs: paths.map(path => ({
      title: `app-wide doctor ${path}`,
      tests: [{ results: [{ status: "passed", attachments: [{
        name: "route-result", body: Buffer.from(JSON.stringify({
          role: "doctor", path, missingContracts: [], results: [{ url: path, viewport: { width: 1024, height: 640 } }],
        })).toString("base64"),
      }] }] }],
    })) }],
  };
}

test("CLI binds narrow retests to their own run, checks read-only, and refreshes idempotently", t => {
  const box = cliSandbox(t), before = captureFingerprint(box.root);
  box.write("generated-artifacts/broad.json", report(before, ["/doctor/dashboard", "/doctor/book"]));
  box.write("artifacts/clinicflow/src/App.tsx", "new owner");
  const current = captureFingerprint(box.root);
  box.write("generated-artifacts/narrow.json", report(current, ["/doctor/book"]));
  box.write("docs/ui/surface-inventory.json", { sourceFingerprint: current, routes: [], surfaces: [], stateProfiles: {} });
  const result = box.run("generated-artifacts/broad.json", "generated-artifacts/narrow.json");
  assert.equal(result.status, 0, result.stderr);
  const output = box.readLedger();
  assert.equal(output.routes.find(r => r.path === "/doctor/dashboard").disposition, "stale-evidence");
  assert.equal(output.routes.find(r => r.path === "/doctor/book").disposition, "rendered-initial-state");
  assert.equal(output.routes.find(r => r.path === "/doctor/book").evidenceRun, 1);
  assert.match(output.runs[0].sha256, /^[a-f0-9]{64}$/);
  const json = readFileSync(join(box.root, "docs/ui/app-wide-ui-ledger.json"), "utf8");
  assert.equal(box.run("--check").status, 1);
  assert.equal(readFileSync(join(box.root, "docs/ui/app-wide-ui-ledger.json"), "utf8"), json);
  assert.equal(box.run("--refresh").status, 0);
  assert.equal(readFileSync(join(box.root, "docs/ui/app-wide-ui-ledger.json"), "utf8"), json);
  assert.match(readFileSync(join(box.root, "docs/ui/app-wide-route-evidence.md"), "utf8"), /Evidence freshness: STALE/);
});

test("CLI current evidence passes; stale inventory cannot be relabelled with today's source", t => {
  const box = cliSandbox(t), current = captureFingerprint(box.root);
  box.write("generated-artifacts/current.json", report(current, ["/doctor/book"]));
  box.write("docs/ui/surface-inventory.json", { sourceFingerprint: current, routes: [], surfaces: [], stateProfiles: {} });
  assert.equal(box.run("generated-artifacts/current.json").status, 0);
  assert.equal(box.run("--check").status, 0);
  box.write("artifacts/clinicflow/src/App.tsx", "another owner");
  assert.equal(box.run("--check").status, 1);
  const result = box.run("generated-artifacts/current.json");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source inventory is stale/);
});

test("fully superseded stale runs do not invalidate current replacement observations", t => {
  const box = sandbox(t), current = captureFingerprint(box.root);
  const data = ledger(current);
  data.runs.push({ fingerprints: null });
  assert.equal(applyFreshness(data, current).freshness.status, "current");
  assert.equal(data.freshness.runs[1].status, "stale");
});
