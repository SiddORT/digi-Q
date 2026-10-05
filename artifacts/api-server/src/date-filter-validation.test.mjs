import { test, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { unlink } from "node:fs/promises";
import { z } from "zod";

const target = new URL(`.date-validation-${process.pid}.mjs`, import.meta.url);
await build({ entryPoints: [new URL("./lib/http.ts", import.meta.url).pathname], outfile: target.pathname,
  bundle: true, platform: "node", format: "esm", packages: "external", logLevel: "silent" });
const { query } = await import(target.href);
after(() => unlink(target));
const schema = z.object({ from: z.date().optional(), to: z.date().optional(), date: z.date().optional() });

test("filter dates reject impossible calendar dates instead of normalizing them", () => {
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "01/02/2026", "not-a-date"]) {
    assert.throws(() => query(schema, { query: { date } }), e => e.status === 400);
  }
});
test("filter dates accept leap days and canonicalize valid dates", () => {
  assert.deepEqual(query(schema, { query: { date: "2028-02-29" } }), { date: "2028-02-29" });
});
test("date ranges reject reversed boundaries but allow equal and historical boundaries", () => {
  assert.throws(() => query(schema, { query: { from: "2026-10-06", to: "2026-10-05" } }), e => e.status === 400);
  for (const [from, to] of [["2020-01-01", "2020-01-01"], ["2020-01-01", "2020-12-31"]]) {
    assert.deepEqual(query(schema, { query: { from, to } }), { from, to });
  }
});
test("optional open-ended date ranges remain supported", () => {
  assert.deepEqual(query(schema, { query: {} }), {});
  assert.deepEqual(query(schema, { query: { from: "2026-01-01" } }), { from: "2026-01-01" });
});
