// Content-addressed local inputs only: no environment values, browser artifacts,
// database access or generated evidence. Broad scope intentionally errs stale.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const trees = [
  "artifacts/clinicflow/src",
  "artifacts/clinicflow/public",
  "artifacts/clinicflow/workspace-regression",
  "lib/api-client-react/src",
  "lib/api-zod/src",
  "lib/public-pages/src",
];
const configFiles = [
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json",
  "artifacts/clinicflow/package.json", "artifacts/clinicflow/index.html",
  "artifacts/clinicflow/vite.config.ts", "artifacts/clinicflow/tsconfig.json",
  ...["api-client-react", "api-zod", "public-pages"].flatMap(name => [
    `lib/${name}/package.json`, `lib/${name}/tsconfig.json`,
  ]),
  "scripts/compact-ui-inventory.mjs", "scripts/app-wide-ui-ledger.mjs",
  "scripts/ui-evidence-freshness.mjs",
  "reports/digiq-master-checklist-137.md", "docs/functional-completion-acceptance.md",
];
const hash = value => createHash("sha256").update(value).digest("hex");
const digestFiles = files => hash(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, "en"))));

export function captureFingerprint(root = workspaceRoot) {
  const paths = new Set(configFiles);
  function walk(dir) {
    if (!existsSync(join(root, dir))) return;
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (/^(?:node_modules|test-results|playwright-report|dist|generated-artifacts|evidence|screenshots|traces)$/.test(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) paths.add(path);
    }
  }
  trees.forEach(walk);
  const files = Object.fromEntries([...paths].sort().map(path => [
    path.split("\\").join("/"),
    existsSync(join(root, path)) ? hash(readFileSync(join(root, path))) : null,
  ]));
  return { schemaVersion: 1, algorithm: "sha256", scope: "conservative-shared-ui", digest: digestFiles(files), files };
}

export function compareFingerprint(recorded, current) {
  if (recorded?.schemaVersion !== 1 || recorded?.algorithm !== "sha256" ||
      !recorded.files || digestFiles(recorded.files) !== recorded.digest) {
    return { status: "stale", reason: "missing-or-invalid-run-fingerprint", changedInputs: [] };
  }
  const changedInputs = [...new Set([...Object.keys(recorded.files), ...Object.keys(current.files)])]
    .filter(path => recorded.files[path] !== current.files[path]).sort();
  return changedInputs.length
    ? { status: "stale", reason: "source-or-criteria-changed", changedInputs }
    : { status: "current", reason: "recorded-inputs-match", changedInputs: [] };
}

export function assessRun(run, current) {
  const start = compareFingerprint(run?.fingerprints?.start, current);
  const end = compareFingerprint(run?.fingerprints?.end, current);
  if (start.status === "stale") return start;
  if (end.status === "stale") return { ...end, reason: `run-end-${end.reason}` };
  return start;
}

export function applyFreshness(ledger, current = captureFingerprint()) {
  const runs = (ledger.runs || []).map(run => assessRun(run, current));
  const assess = record => runs[record.evidenceRun] || {
    status: "stale", reason: "missing-run-provenance", changedInputs: [],
  };
  for (const record of [...ledger.routes, ...ledger.tests]) {
    record.freshness = assess(record);
    record.historicalStatus ??= record.status;
    record.status = record.freshness.status === "stale" && record.historicalStatus === "passed"
      ? "stale-evidence" : record.historicalStatus;
    // Keep the original observation, including failures and redirects. Freshness
    // is not acceptance and cannot upgrade a failed/unverified result.
    if ("disposition" in record) {
      record.historicalDisposition ??= record.disposition;
      record.disposition = record.freshness.status === "stale" && /^rendered-/.test(record.historicalDisposition)
        ? "stale-evidence" : record.historicalDisposition;
    }
  }
  for (const pattern of ledger.routePatterns) {
    for (const sample of pattern.samples) {
      const route = ledger.routes.find(r => r.role === sample.role && r.path === sample.path);
      if (route) sample.disposition = route.disposition;
    }
    pattern.freshness = {
      status: pattern.samples.length
        ? pattern.samples.every(sample => ledger.routes.find(r => r.role === sample.role && r.path === sample.path)?.freshness.status === "current")
          ? "current" : "stale"
        : "unverified",
    };
  }
  ledger.freshness = {
    status: [...ledger.routes, ...ledger.tests].length &&
      [...ledger.routes, ...ledger.tests].every(record => record.freshness.status === "current") ? "current" : "stale",
    scope: "Conservative shared UI dependency set. Any tracked input change invalidates the run, not just one guessed owner.",
    notice: "Matching fingerprints establish input freshness only, never state acceptance, authorization, browser coverage or hosted UAT.",
    runs,
  };
  return ledger;
}

export function reportDigest(path) {
  return hash(readFileSync(path));
}
