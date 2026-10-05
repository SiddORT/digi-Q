import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const files = ["../clinic.tsx", "./ListingControls.tsx", "./ClinicSettings.tsx", "./LinkedScheduleControls.tsx", "./queue/DurationEditor.tsx"];
const controls = new Map();

for (const file of files) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  test(`${file} has valid TSX and no native select callers`, () => {
    assert.equal(tree.parseDiagnostics.length, 0);
    assert.doesNotMatch(source, /<select\b/);
  });
  function visit(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(tree) === "SearchableSelect") {
      const attributes = node.attributes.properties;
      const label = attributes.find(item => item.name?.getText(tree) === "label")?.initializer;
      if (label && ts.isStringLiteral(label)) {
        const props = Object.fromEntries(attributes.filter(item => ts.isJsxAttribute(item) && item.initializer && ts.isJsxExpression(item.initializer)).map(item => [item.name.getText(tree), item.initializer.expression?.getText(tree)]));
        controls.set(label.text, props);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}

function change(label, value, context) {
  const handler = controls.get(label)?.onChange;
  assert.ok(handler, `Missing onChange for ${label}`);
  const compiled = ts.transpileModule(`(${handler})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(compiled, context)(value);
}

test("navigation and sort selectors retain non-empty enum choices when cleared", () => {
  for (const [label, callback, value] of [
    ["Clinic Section", "selectView", "history"],
  ]) {
    const calls = [];
    const context = { [callback]: next => calls.push(next) };
    change(label, "", context);
    assert.deepEqual(calls, []);
    change(label, value, context);
    assert.deepEqual(calls, [value]);
  }
  // Sort Appointments now drafts into the filter drawer; clearing still keeps the existing choice.
  const calls = [];
  const context = { updateDraft: next => calls.push(next) };
  change("Sort Appointments", "", context);
  assert.deepEqual(calls, []);
  change("Sort Appointments", "-date", context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ sort: "-date" }]);
});

test("visit range selection resets dates only after choosing a non-empty view", () => {
  const calls = [];
  const context = { updateDraft: value => calls.push(value) };
  change("Visit Range", "", context);
  assert.deepEqual(calls, []);
  change("Visit Range", "all", context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ view: "all", from: "", to: "" }]);
});

test("page size remains numeric, retains caller-owned reset behavior, and ignores clear", () => {
  for (const resetPageOnSizeChange of [true, false]) {
    const calls = [];
    const context = { resetPageOnSizeChange, onPageSizeChange: value => calls.push(["size", value]), onPageChange: value => calls.push(["page", value]) };
    change("Rows per Page", "", context);
    assert.deepEqual(calls, []);
    change("Rows per Page", "25", context);
    assert.deepEqual(calls, resetPageOnSizeChange ? [["size", 25], ["page", 1]] : [["size", 25]]);
  }
  assert.match(controls.get("Rows per Page").options, /pageSizeOptions\(pageSize\)/);
});

test("linked booking mode keeps queue enums and existing schedule fields", () => {
  const calls = [];
  const value = { enabled: true, maxTokens: 25, queueMode: "mixed" };
  const context = { value, onChange: next => calls.push(next) };
  change("Booking Mode", "", context);
  assert.deepEqual(calls, []);
  change("Booking Mode", "walkInsOnly", context);
  assert.equal(calls[0].queueMode, "walkInsOnly");
  assert.equal(calls[0].maxTokens, 25);
  assert.equal(controls.get("Booking Mode").disabled, "disabled");
});

test("duration choices preserve numeric payloads and clear running-session confirmation", () => {
  for (const [label, callback, value, expected] of [
    ["New Expected Duration", "setMinutes", "60", 60],
    ["Apply Change", "setEffect", "runningSession", "runningSession"],
  ]) {
    const calls = [];
    const context = { [callback]: value => calls.push(value), setConfirm: value => calls.push(value) };
    change(label, "", context);
    assert.deepEqual(calls, []);
    change(label, value, context);
    assert.deepEqual(calls, [expected, false]);
    assert.equal(controls.get(label).disabled, "update.isPending");
  }
});