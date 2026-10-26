// Offline inspection only. Reads local evidence; never navigates to an app.
import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { assessRun, captureFingerprint, workspaceRoot } from "./ui-evidence-freshness.mjs";

const defaultInput = "artifacts/clinicflow/workspace-regression/test-results/workspace";
const output = "generated-artifacts/app-wide-ui/contact-sheets";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const validDigest = digest => typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest);
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export const notice = "Offline inspection aid only — NOT acceptance, authorization, hosted UAT, delivery or cross-browser evidence.";
const snapshotNotice = "Frozen snapshot: freshness is checked only when generated. Before relying on these images, rerun this offline script or run node scripts/app-wide-ui-contact-sheets.mjs --check. No application requests are made.";

export function freshnessFor(result, ledger, current) {
  const digest = result.sourceFingerprintDigest;
  if (!validDigest(digest)) return { status: "unknown", reason: "missing-or-invalid-originating-run-digest" };
  // A starting digest alone cannot prove that inputs stayed unchanged at run end.
  // Bind the exact attachment, not just role/path or the latest narrow retest.
  const matches = (ledger?.routes || []).filter(route => isDeepStrictEqual(route.route, result));
  const runs = matches.map(route => ledger?.runs?.[route.evidenceRun]).filter(Boolean);
  const run = runs.find(candidate => candidate.fingerprints?.start?.digest === digest);
  if (!run) return {
    status: digest === current.digest ? "unknown" : "stale",
    reason: digest === current.digest ? "missing-matching-run-provenance" : "originating-inputs-no-longer-match",
  };
  const assessed = assessRun(run, current);
  if (assessed.reason.includes("missing-or-invalid")) return {
    status: "unknown", reason: assessed.reason, reportDigest: run.sha256 || null,
  };
  return { ...assessed, reportDigest: run.sha256 || null, fingerprints: run.fingerprints };
}

export async function collectIndex({ root = workspaceRoot, input = defaultInput } = {}) {
  const current = captureFingerprint(root);
  let ledger;
  try {
    ledger = JSON.parse(await readFile(join(root, "docs/ui/app-wide-ui-ledger.json"), "utf8"));
  } catch { /* Legacy/missing ledger is explicitly UNKNOWN, never current. */ }
  let dirs;
  try { dirs = await readdir(resolve(root, input)); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    dirs = [];
  }
  const records = [], skipped = [];
  for (const dir of dirs.sort()) {
    if (!dir.startsWith("app-wide-ui-")) continue;
    const source = resolve(root, input, dir);
    try {
      const result = JSON.parse(await readFile(join(source, "route-result.json"), "utf8"));
      const image = await readFile(join(source, "1366.png"));
      records.push({
        label: `${result.role} ${result.path}`,
        source, sourceFingerprintDigest: result.sourceFingerprintDigest || null,
        routeResultDigest: sha256(JSON.stringify(result)), imageDigest: sha256(image),
        freshness: freshnessFor(result, ledger, current),
        image: image.toString("base64"),
      });
    } catch (error) {
      skipped.push({ source, reason: `Incomplete/unreadable route capture (${error.code || error.name})` });
    }
  }
  records.sort((a, b) => a.label.localeCompare(b.label) || a.source.localeCompare(b.source));
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    checkedInputDigest: current.digest, notice, snapshotNotice,
    status: overallStatus(records, skipped), records, skipped,
  };
}

function overallStatus(records, skipped) {
  if (records.some(record => record.freshness.status === "stale")) return "stale";
  if (!records.length || skipped.length || records.some(record => record.freshness.status !== "current")) return "unknown";
  return "current";
}

function warning(status) {
  return status === "current"
    ? "CURRENT INPUTS AT GENERATION ONLY — NOT ACCEPTANCE"
    : `WARNING: ${status.toUpperCase()} UI EVIDENCE — DO NOT RELY ON THIS AS CURRENT UI`;
}

export function sheetHtml(index, records = index.records) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>Offline UI inspection — ${escape(index.status)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#ddd;color:#111;font:13px sans-serif}
.banner{padding:14px;background:${index.status === "current" ? "#fff3cd" : "#ffe0dc"};border-bottom:3px solid #803000}
p{margin:5px 0;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:repeat(3,512px)}
section{padding:8px;border:1px solid #aaa;background:#eee;overflow-wrap:anywhere}
img{display:block;width:494px;margin-top:8px}code{font-size:11px}h1{font-size:19px;margin:0 0 8px}
</style></head><body><header class="banner"><h1>${escape(warning(index.status))}</h1>
<p>${escape(notice)}</p><p>${escape(snapshotNotice)}</p>
<p>Checked: ${escape(index.generatedAt)} · Current input SHA-256: <code>${escape(index.checkedInputDigest)}</code></p>
<p>${index.records.length} captures; ${index.skipped.length} incomplete captures omitted (not accepted).</p></header>
<main class="grid">${records.map(record => `<section><strong>${escape(record.label)}</strong>
<p>${escape(warning(record.freshness.status))}</p>
<p>Originating run input SHA-256: <code>${escape(record.sourceFingerprintDigest || "UNKNOWN — legacy/missing provenance")}</code></p>
<p>Report SHA-256: <code>${escape(record.freshness.reportDigest || "UNKNOWN")}</code></p>
<p>${escape(record.freshness.reason)}</p>
<img alt="${escape(record.label)}" src="data:image/png;base64,${record.image}"></section>`).join("")}</main>
${index.skipped.map(record => `<p>UNKNOWN: ${escape(record.source)} — ${escape(record.reason)}</p>`).join("")}
</body></html>`;
}

export async function generateSheets(options = {}) {
  const root = options.root || workspaceRoot;
  const index = await collectIndex(options);
  const out = join(root, output);
  await mkdir(out, { recursive: true });
  // Never leave obsolete pages from a previous, larger index beside the new run.
  for (const name of await readdir(out)) {
    if (/^sheet-\d+\.jpg$/.test(name)) await rm(join(out, name));
  }
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1536, height: 650 } });
    await page.route("**/*", route => route.abort());
    index.sheets = [];
    // Even an empty run gets a visible UNKNOWN sheet, not a silent success.
    for (let i = 0; i < Math.max(index.records.length, 1); i += 6) {
      const name = `sheet-${String(i / 6 + 1).padStart(2, "0")}.jpg`;
      await page.setContent(sheetHtml(index, index.records.slice(i, i + 6)));
      await page.locator("img").evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
      await page.screenshot({ path: join(out, name), type: "jpeg", quality: 85, fullPage: true });
      index.sheets.push(name);
    }
  } finally { await browser.close(); }
  await writeFile(join(out, "index.html"), sheetHtml(index));
  // Images are self-contained in HTML; the manifest carries hashes/provenance only.
  await writeFile(join(out, "index.json"), JSON.stringify({
    ...index, records: index.records.map(({ image, ...record }) => record),
  }, null, 2) + "\n");
  return index;
}

export async function checkIndex(root = workspaceRoot) {
  let index;
  try { index = JSON.parse(await readFile(join(root, output, "index.json"), "utf8")); }
  catch { return { status: "unknown", reason: "missing-or-unreadable-index", notice }; }
  if (index.schemaVersion !== 1 || !Array.isArray(index.records) || !index.records.length) {
    return { status: "unknown", reason: "missing-or-invalid-index-provenance", notice };
  }
  const current = captureFingerprint(root);
  const records = [];
  for (const record of index.records) {
    let freshness = record.freshness || { status: "unknown", reason: "missing-provenance" };
    if (record.sourceFingerprintDigest && record.sourceFingerprintDigest !== current.digest) {
      freshness = { status: "stale", reason: "originating-inputs-no-longer-match" };
    } else if (freshness.fingerprints) {
      freshness = assessRun({ fingerprints: freshness.fingerprints }, current);
    }
    try {
      const result = JSON.parse(await readFile(join(record.source, "route-result.json"), "utf8"));
      const image = await readFile(join(record.source, "1366.png"));
      if (sha256(JSON.stringify(result)) !== record.routeResultDigest || sha256(image) !== record.imageDigest) {
        freshness = { status: "stale", reason: "capture-replaced-since-index-generation" };
      }
    } catch { freshness = { status: "unknown", reason: "capture-no-longer-readable" }; }
    records.push({ source: record.source, freshness });
  }
  return { status: overallStatus(records, index.skipped || []), records, notice };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0]?.startsWith("--") && args[0] !== "--check")) {
    throw Error("Usage: node scripts/app-wide-ui-contact-sheets.mjs [local-capture-directory | --check]");
  }
  if (args[0] === "--check") {
    const result = await checkIndex();
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "current") process.exitCode = 1;
  } else {
    const index = await generateSheets({ input: args[0] || defaultInput });
    console.log(`${warning(index.status)}\n${index.records.length} captures, ${index.skipped.length} incomplete; output: ${output}\n${notice}`);
  }
}
