// Retain small, reviewable, credential-free audit evidence in tracked docs.
// Usage: node scripts/dependency-audit-evidence.mjs before|after [f01|f02]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) throw Error("Specify before or after");
const label = process.argv[3] || "f01";
if (!["f01", "f02"].includes(label)) throw Error("Specify f01 or f02");
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "artifacts/clinicflow-project-deck/package.json"));
const lockText = await readFile(resolve(root, "pnpm-lock.yaml"), "utf8");
const lock = require("yaml").parse(lockText);
const audit = spawnSync("pnpm", ["audit", "--json"], { cwd: root, encoding: "utf8", timeout: 60000 });
if (audit.error) throw audit.error;
const raw = JSON.parse(audit.stdout);
if (!raw.advisories || !raw.metadata) throw Error(`Audit unavailable: ${audit.stdout}`);
const advisories = Object.values(raw.advisories).map(a => ({
  id: a.github_advisory_id, package: a.module_name, severity: a.severity,
  vulnerable: a.vulnerable_versions, patched: a.patched_versions, title: a.title, url: a.url,
  paths: a.findings.flatMap(f => f.paths),
}));
const packages = Object.keys(lock.packages).sort();
const counts = {};
for (const a of advisories) counts[a.package] = (counts[a.package] || 0) + 1;
const evidence = {
  capturedAt: new Date().toISOString(), node: process.version,
  lockfileSha256: createHash("sha256").update(lockText).digest("hex"),
  source: "pnpm audit --json (npm registry); lockfile findings, not proof of exploitation",
  metadata: raw.metadata, advisoryCounts: counts, advisories, lockedPackages: packages,
};
await mkdir(resolve(root, "docs/security"), { recursive: true });
await writeFile(resolve(root, `docs/security/${label}-audit-${phase}.json`), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ phase, vulnerabilities: raw.metadata.vulnerabilities, advisoryCounts: counts }));
