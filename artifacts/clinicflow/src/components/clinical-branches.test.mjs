import assert from "node:assert/strict";
import test from "node:test";
import { clinicalBranchSelection } from "./clinical-branches.ts";

test("retains active branches in other owned clinics when removing last current clinic selection", () => {
  const branches = [{id:"current",status:"active"},{id:"other",status:"active"}];
  const selected = clinicalBranchSelection(["other"], branches);
  assert.equal(selected.canSave, true);
  assert.deepEqual(selected.branchIds, ["other"]);
});

test("selected inactive branches remain visible for removal and cannot be resubmitted", () => {
  const branches = [{id:"current",status:"active"},{id:"inactive-other",status:"inactive"}];
  const selected = clinicalBranchSelection(["current","inactive-other"], branches);
  assert.deepEqual(selected.inactive, ["inactive-other"]);
  assert.equal(selected.canSave, false);
  assert.equal(clinicalBranchSelection(["current"], branches).canSave, true);
});

test("unresolved selected branches block saves rather than silently disappearing", () => {
  const selected = clinicalBranchSelection(["current","unresolved"], [{id:"current",status:"active"}]);
  assert.deepEqual(selected.unknown, ["unresolved"]);
  assert.equal(selected.canSave, false);
  assert.equal(clinicalBranchSelection([], [{id:"current",status:"active"}]).canSave, false);
});