import { test } from "node:test";
import assert from "node:assert/strict";
import { tabListKeyDown, menuKeyDown } from "../lib/tabs-a11y.ts";

const fakeEvent = (key, tabs = []) => { const e = { key, prevented: false, preventDefault() { this.prevented = true; }, currentTarget: { querySelectorAll: () => tabs } }; return e; };
test("arrow keys, Home and End move between tabs and wrap", () => {
  const ids = ["a", "b", "c"]; let picked = "";
  const focused = []; const tabs = ids.map(id => ({ focus: () => focused.push(id) }));
  tabListKeyDown(fakeEvent("ArrowRight", tabs), ids, "c", v => picked = v); assert.equal(picked, "a");
  tabListKeyDown(fakeEvent("ArrowLeft", tabs), ids, "a", v => picked = v); assert.equal(picked, "c");
  tabListKeyDown(fakeEvent("Home", tabs), ids, "b", v => picked = v); assert.equal(picked, "a");
  tabListKeyDown(fakeEvent("End", tabs), ids, "a", v => picked = v); assert.equal(picked, "c");
  assert.deepEqual(focused, ["a", "c", "a", "c"]);
  const other = fakeEvent("x", tabs); tabListKeyDown(other, ids, "a", () => assert.fail()); assert.equal(other.prevented, false);
});
test("menu arrow keys skip nothing when no items", () => {
  const e = fakeEvent("ArrowDown", []); menuKeyDown(e); assert.equal(e.prevented, false);
});
