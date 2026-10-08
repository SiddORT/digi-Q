import test from "node:test";
import assert from "node:assert/strict";
import { soleBookable, soleAssigned } from "./sole-option.ts";
test("guest finder sole option uses bookable (slugged) rows of a complete list", () => {
  assert.equal(soleBookable({ total: 1, items: [{ id: "a", slug: "main" }] })?.id, "a");
  assert.equal(soleBookable({ total: 2, items: [{ id: "a", slug: "main" }, { id: "b", slug: null }] })?.id, "a"); // unslugged row no longer blocks
  assert.equal(soleBookable({ total: 2, items: [{ id: "a", slug: "x" }, { id: "b", slug: "y" }] }), null);
  assert.equal(soleBookable({ total: 30, items: [{ id: "a", slug: "x" }] }), null); // partial page never guesses
  assert.equal(soleBookable({ total: 1, items: [{ id: "a" }] }), null);
  assert.equal(soleBookable(undefined), null);
});
test("operational cardinality requires a complete active authorized result, not first page or failed data", () => {
  assert.equal(soleAssigned({total:1,items:[{id:"saved"}]})?.id,"saved");
  for(const list of [undefined,{total:40,items:[{id:"first"}]},{total:1,items:[]},{total:2,items:[{id:"a"},{id:"b"}]},{total:1,items:[{id:"inactive",status:"inactive"}]}])assert.equal(soleAssigned(list),null);
  assert.equal(soleAssigned({total:1,items:[{id:"old"}]},true),null,"failed refresh cannot invent defaults");
});
