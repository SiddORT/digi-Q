import test from "node:test";
import assert from "node:assert/strict";
import { soleBookable } from "./sole-option.ts";
test("guest finder sole option uses bookable (slugged) rows of a complete list", () => {
  assert.equal(soleBookable({ total: 1, items: [{ id: "a", slug: "main" }] })?.id, "a");
  assert.equal(soleBookable({ total: 2, items: [{ id: "a", slug: "main" }, { id: "b", slug: null }] })?.id, "a"); // unslugged row no longer blocks
  assert.equal(soleBookable({ total: 2, items: [{ id: "a", slug: "x" }, { id: "b", slug: "y" }] }), null);
  assert.equal(soleBookable({ total: 30, items: [{ id: "a", slug: "x" }] }), null); // partial page never guesses
  assert.equal(soleBookable({ total: 1, items: [{ id: "a" }] }), null);
  assert.equal(soleBookable(undefined), null);
});
