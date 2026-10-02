import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selectedIdBatches, validDependentIds, retainSelectedRecords } from "./relation-validity.ts";

const editor = readFileSync(new URL("../resources.tsx", import.meta.url), "utf8");
const lookup = readFileSync(new URL("./ResourceLookup.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("../auth/native-auth.tsx", import.meta.url), "utf8");

test("dependent selections keep matching rows, reject confirmed mismatches, and retain unknowns", () => {
  const branches = [{ id: "a", clinicId: "clinic-a" }, { id: "b", clinicId: "clinic-b" }];
  assert.deepEqual(validDependentIds("branches", ["a", "b", "unknown"], branches, ["clinic-a"]), ["a", "unknown"]);
  assert.deepEqual(validDependentIds("branches", ["a"], branches, ["clinic-a", "clinic-b"]), ["a"]);
  assert.deepEqual(validDependentIds("doctors", ["d", "other"], [{ id: "d", clinicIds: ["clinic-a"], branchIds: ["a"] }, { id: "other", clinicIds: ["clinic-b"], branchIds: ["b"] }], ["clinic-a"], "a"), ["d"]);
  assert.deepEqual(validDependentIds("branches", ["a"], [], ["clinic-b"]), ["a"]);
  // Both list and detail doctor endpoints expose these assignment arrays.
  assert.deepEqual(validDependentIds("doctors", ["d"], [{ id: "d", clinicIds: ["clinic-a", "clinic-b"], branchIds: ["a", "b"] }], ["clinic-b"], "b"), ["d"]);
  assert.deepEqual(validDependentIds("doctors", ["d"], [{ id: "d", clinicIds: ["clinic-a"], branchIds: ["a"] }], ["clinic-b"], "a"), []);
});

test("selected hydration respects the API 100-ID and 100-row caps", () => {
  const ids = Array.from({ length: 225 }, (_, index) => `branch-${index}`);
  assert.deepEqual(selectedIdBatches(ids).map(batch => batch.length), [100, 100, 25]);
  assert.deepEqual(selectedIdBatches(ids).flat(), ids);
  assert.deepEqual(selectedIdBatches(["a", "a", "b"]), [["a", "b"]]);
  assert.ok(lookup.includes("selectedIdBatches(missing)"));
  assert.ok(lookup.includes("Selected options were only partially loaded"));
});

test("editor only clears proven invalid dependents, not on parent selection", () => {
  assert.ok(!editor.includes('if(["clinicId","clinicIds"].includes(field.key)){'));
  assert.ok(editor.includes("validDependentIds("));
  assert.ok(editor.includes('&& !value?.length') || editor.includes('&&!value?.length'));
});

test("lookup is search-stable and does not poll option or selected lists", () => {
  assert.ok(!lookup.includes("refetchInterval:"));
  const cached=retainSelectedRecords(new Map(),["selected"],[{id:"selected",name:"Known clinic"},{id:"unselected",name:"Other"}]);
  assert.deepEqual([...cached.keys()],["selected"]);
  assert.equal(retainSelectedRecords(cached,["selected"],[]).get("selected").name,"Known clinic");
  assert.equal(retainSelectedRecords(cached,["selected"],[{id:"selected",name:"Updated clinic"}]).get("selected").name,"Updated clinic");
  assert.equal(retainSelectedRecords(cached,[],[]).size,0);
  assert.ok(lookup.includes("retainSelectedRecords(retained.current,selected,merged)"));
  assert.ok(lookup.includes("selectedRecords: [...rows, ...selectedRows]"));
  assert.ok(lookup.includes("selected.filter(id => !rows.some"));
  assert.ok(lookup.includes("staleTime: 120000"));
  assert.ok(lookup.includes("[scopeKey, recordsKey, missingKey"));
  assert.ok(lookup.includes("[scopeKey, selectedKey, missingKey"));
  assert.ok(auth.includes("queryClient.clear()"));
});