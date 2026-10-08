import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(new URL("./ResourceLookup.tsx",import.meta.url),"utf8");
test("disabled dependent lookups do not claim an in-flight request",()=>{
  assert.match(source,/const loading = enabled &&/);
  assert.match(source,/loading=\{lookup.loading\}/);
  assert.match(source,/isLoading=\{lookup.loading\}/);
  assert.match(source,/selectedPending: enabled && missing.length > 0/);
});
test("option and selected-record reads remain bounded and retain manual retry",()=>{
  const cache=readFileSync(new URL("../lib/directory-cache.ts",import.meta.url),"utf8");
  assert.match(cache,/AbortSignal.timeout\(20000\)/);
  assert.match(cache,/AbortSignal.any\(\[signal,/);
  assert.match(source,/retry: false/);
  assert.match(source,/Retry Options/);
  assert.match(source,/Your selection has been retained/);
});
