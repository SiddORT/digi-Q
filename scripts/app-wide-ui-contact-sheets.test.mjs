import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  collectIndex, freshnessFor, sheetHtml, generateSheets, checkIndex,
} from "./app-wide-ui-contact-sheets.mjs";
import { captureFingerprint, workspaceRoot } from "./ui-evidence-freshness.mjs";

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=", "base64");
async function fixture(t) {
  const parent = join(workspaceRoot, "generated-artifacts/contact-sheet-tests");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, "case-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (path, data) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), Buffer.isBuffer(data) || typeof data === "string" ? data : JSON.stringify(data));
  };
  const fingerprint = captureFingerprint(root);
  const result = { role: "doctor", path: "/doctor/dashboard", sourceFingerprintDigest: fingerprint.digest };
  const run = { sha256: "a".repeat(64), fingerprints: { start: fingerprint, end: fingerprint } };
  const ledger = { routes: [{ route: result, evidenceRun: 0 }], runs: [run] };
  const input = "generated-artifacts/captures";
  const source = `${input}/app-wide-ui-doctor`;
  await write(`${source}/route-result.json`, result);
  await write(`${source}/1366.png`, image);
  await write("docs/ui/app-wide-ui-ledger.json", ledger);
  return { root, write, result, ledger, fingerprint, input, source };
}

test("fresh provenance carries originating and report digests; current inputs never imply acceptance", async t => {
  const box = await fixture(t);
  const index = await collectIndex(box);
  assert.equal(index.status, "current");
  assert.equal(index.records[0].sourceFingerprintDigest, box.fingerprint.digest);
  assert.equal(index.records[0].freshness.reportDigest, "a".repeat(64));
  const html = sheetHtml(index);
  assert.match(html, /CURRENT INPUTS AT GENERATION ONLY — NOT ACCEPTANCE/);
  assert.match(html, /Frozen snapshot/);
  assert.match(html, new RegExp(box.fingerprint.digest));
  assert.match(html, /hosted UAT/);
  assert.match(html, /default-src 'none'/);
});

test("changed source, stylesheet or configuration yields STALE rather than copying ledger freshness", async t => {
  const box = await fixture(t);
  for (const path of ["artifacts/clinicflow/src/App.tsx", "artifacts/clinicflow/src/style.css", "pnpm-lock.yaml"]) {
    await box.write(path, "changed");
    const index = await collectIndex(box);
    assert.equal(index.status, "stale");
    assert.ok(index.records[0].freshness.changedInputs.includes(path));
    assert.match(sheetHtml(index), /WARNING: STALE UI EVIDENCE/);
  }
});

test("legacy, malformed, unmatched and missing run endpoints remain UNKNOWN; mismatched origin is STALE", async t => {
  const box = await fixture(t);
  const assess = (result, ledger = box.ledger) => freshnessFor(result, ledger, box.fingerprint);
  assert.equal(assess({ role: "doctor" }).status, "unknown");
  assert.equal(assess({ ...box.result, sourceFingerprintDigest: "invalid" }).status, "unknown");
  assert.equal(assess(box.result, null).status, "unknown");
  assert.equal(assess({ ...box.result, path: "/other" }).status, "unknown");
  assert.equal(assess({ ...box.result, sourceFingerprintDigest: "b".repeat(64) }).status, "stale");
  const noEnd = structuredClone(box.ledger);
  delete noEnd.runs[0].fingerprints.end;
  assert.equal(assess(box.result, noEnd).status, "unknown");
  noEnd.runs[0].fingerprints.end = { ...box.fingerprint, digest: "corrupt" };
  assert.equal(assess(box.result, noEnd).status, "unknown");
  await box.write("docs/ui/app-wide-ui-ledger.json", "{malformed");
  assert.equal((await collectIndex(box)).status, "unknown");
});

test("mid-run changes and narrow replacements cannot freshen old captures", async t => {
  const box = await fixture(t);
  await box.write("artifacts/clinicflow/src/App.tsx", "new source");
  const current = captureFingerprint(box.root);
  const midRun = structuredClone(box.ledger);
  midRun.runs[0].fingerprints.end = current;
  assert.equal(freshnessFor(box.result, midRun, box.fingerprint).status, "stale");
  const newResult = { ...box.result, sourceFingerprintDigest: current.digest };
  const replacement = {
    runs: [{ fingerprints: { start: current, end: current } }],
    routes: [{ route: newResult, evidenceRun: 0 }],
  };
  assert.equal(freshnessFor(box.result, replacement, current).status, "stale");
  assert.equal(freshnessFor(newResult, replacement, current).status, "current");
});

test("incomplete or empty directories are visible UNKNOWN, and labels are escaped", async t => {
  const box = await fixture(t);
  await box.write(`${box.input}/app-wide-ui-incomplete/route-result.json`, {});
  const index = await collectIndex(box);
  assert.equal(index.status, "unknown");
  assert.equal(index.skipped.length, 1);
  assert.match(sheetHtml(index), /incomplete captures omitted \(not accepted\)/);
  index.records[0].label = '<script>alert("x")</script>';
  assert.doesNotMatch(sheetHtml(index), /<script>/);
  assert.match(sheetHtml(index), /&lt;script>/);
  const empty = await collectIndex({ root: box.root, input: "generated-artifacts/absent" });
  assert.equal(empty.status, "unknown");
  assert.match(sheetHtml(empty), /WARNING: UNKNOWN UI EVIDENCE/);
});

test("offline rendering writes labelled sheets and self-contained indexes only under generated-artifacts; check is read-only", async t => {
  const box = await fixture(t);
  const out = join(box.root, "generated-artifacts/app-wide-ui/contact-sheets");
  await box.write("generated-artifacts/app-wide-ui/contact-sheets/sheet-99.jpg", image);
  const index = await generateSheets(box);
  assert.equal(index.status, "current");
  assert.deepEqual((await readdir(out)).sort(), ["index.html", "index.json", "sheet-01.jpg"]);
  const jpg = await readFile(join(out, "sheet-01.jpg"));
  assert.equal(jpg.subarray(0, 2).toString("hex"), "ffd8");
  const before = await readFile(join(out, "index.json"), "utf8");
  const manifest = JSON.parse(before);
  assert.equal(manifest.records[0].image, undefined);
  assert.equal(manifest.records[0].sourceFingerprintDigest, box.fingerprint.digest);
  assert.match(await readFile(join(out, "index.html"), "utf8"), /data:image\/png;base64,/);
  assert.equal((await checkIndex(box.root)).status, "current");
  await box.write("artifacts/clinicflow/src/App.tsx", "new UI");
  assert.equal((await checkIndex(box.root)).status, "stale");
  assert.equal(await readFile(join(out, "index.json"), "utf8"), before);
  await rm(join(box.root, "artifacts/clinicflow/src/App.tsx"));
  await box.write(`${box.source}/1366.png`, Buffer.concat([image, Buffer.from("changed")]));
  assert.equal((await checkIndex(box.root)).records[0].freshness.reason, "capture-replaced-since-index-generation");
  await rm(join(box.root, box.source, "1366.png"));
  assert.equal((await checkIndex(box.root)).status, "unknown");
});

test("missing index cannot pass the offline check", async t => {
  const box = await fixture(t);
  assert.equal((await checkIndex(box.root)).status, "unknown");
});
