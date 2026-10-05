import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("./OverflowText.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./overflow-text.css", import.meta.url), "utf8");

// Contract only; real keyboard and pointer behaviour is verified in the browser by main.
test("measures before interaction so keyboard users can reach truncated values", () => {
  assert.match(src, /useLayoutEffect\(/);
  assert.match(src, /new ResizeObserver\(measure\)/);
  assert.match(src, /document\.fonts\.ready/);
  assert.match(src, /observer\.disconnect\(\)/);
  assert.match(src, /tabIndex=\{truncated \? 0 : -1\}/);
  assert.doesNotMatch(src, /MutationObserver/);
});
test("full value opens on focus, hover, tap and keys; Escape closes", () => {
  for (const s of ["onFocus={show}", "onMouseEnter={show}", "onPointerDown", 'e.key === "Escape"', 'e.key === "Enter"', 'role="tooltip"', "aria-label={truncated ? text : undefined}"]) assert.ok(src.includes(s), s);
});
test("display only: value is not recased and no casing CSS is applied", () => {
  assert.doesNotMatch(src, /titleCase|toUpperCase|toLowerCase/);
  assert.doesNotMatch(css, /text-transform/);
  assert.match(css, /text-overflow:\s*ellipsis/);
});
