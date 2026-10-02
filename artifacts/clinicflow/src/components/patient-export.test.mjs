import assert from "node:assert/strict";
import test from "node:test";
import { collectFilteredPatients, filteredPatientsCsv } from "./patient-export.ts";
const rows = n => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, code: `P${i}`, fullName: `Name ${i}`, userId: "u", mobileVerified: true, clinicId: "c", dateOfBirth: "1990-01-02", status: "active", createdAt: "2026-09-30T10:00:00Z" }));
const pager = (all, opts = {}) => { const seen = []; return { seen, load: async p => { seen.push(p); if (opts.failPage === p.page) throw new Error("x"); const total = opts.shift && p.page > 1 ? all.length + 1 : all.length; return { items: all.slice((p.page - 1) * p.pageSize, p.page * p.pageSize), total }; } }; };
const signal = () => new AbortController().signal;

test("loads all pages with the same filters and sort", async () => {
  const pg = pager(rows(230));
  const out = await collectFilteredPatients({ search: "na", status: "active", clinicId: "c", sort: "fullName", page: 3, pageSize: 20 }, pg.load, signal());
  assert.equal(out.length, 230); assert.equal(pg.seen.length, 3);
  for (const p of pg.seen) { assert.equal(p.sort, "fullName"); assert.equal(p.search, "na"); assert.equal(p.status, "active"); assert.equal(p.clinicId, "c"); assert.equal(p.pageSize, 100); }
});
test("a failed page aborts with no partial result", async () => {
  await assert.rejects(collectFilteredPatients({}, pager(rows(230), { failPage: 2 }).load, signal()));
});
test("total change mid-export aborts", async () => {
  await assert.rejects(collectFilteredPatients({}, pager(rows(230), { shift: true }).load, signal()), /changed/);
});
test("csv excludes metadata and uses provided date format", () => {
  const csv = filteredPatientsCsv(rows(1), d => `F${d}`, t => `T${t}`);
  assert.ok(!/mobileVerified|userId|true|"u"/.test(csv)); assert.ok(csv.includes('"F1990-01-02"')); assert.ok(csv.includes('"T2026-09-30T10:00:00Z"')); assert.ok(csv.startsWith("\uFEFF\"Patient code\""));
});
