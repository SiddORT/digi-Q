import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

test("change-clinic link preserves booking/display mode without carrying doctor filters", () => {
  const text = readFileSync(new URL("./PublicClinicPage.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("PublicClinicPage.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let href;
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.attributes.properties.some(prop =>
      ts.isJsxAttribute(prop) && prop.name.getText(source) === "data-testid" &&
      prop.initializer && ts.isStringLiteral(prop.initializer) && prop.initializer.text === "public-change-branch")) {
      const attr = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === "href");
      href = attr.initializer.expression.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(href, "change-clinic link must exist");
  const resolve = new Function("clinicSlug", "mode", `return (${href});`);
  assert.equal(resolve("sample-clinic", "book"), "/sample-clinic?book=1");
  assert.equal(resolve("sample-clinic", "display"), "/sample-clinic?display=1");
  assert.equal(resolve("sample-clinic", null), "/sample-clinic");
});