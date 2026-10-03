import test from "node:test";
import assert from "node:assert/strict";
import { visibleSearchMatches } from "./live-search-state.ts";

const suggestions = [{ id: "fixture", label: "Fictional patient", value: "CF-FIXTURE" }];
test("search hides previous-query records during debounce", () => {
  assert.deepEqual(visibleSearchMatches({ value: "new", settledQuery: "old", suggestions }), { pending: true, matches: [] });
});
test("search hides placeholder records while the scoped query fetches", () => {
  assert.deepEqual(visibleSearchMatches({ value: "patient", settledQuery: "patient", loading: true, suggestions }), { pending: true, matches: [] });
});
test("search does not present cached records after an error", () => {
  assert.deepEqual(visibleSearchMatches({ value: "patient", error: "Unavailable", suggestions }).matches, []);
});
test("clearing input removes the suggestion list", () => {
  assert.deepEqual(visibleSearchMatches({ value: "  ", suggestions }).matches, []);
});
test("ready matches preserve the backend-supported selection value", () => {
  assert.deepEqual(visibleSearchMatches({ value: "patient", settledQuery: "patient", suggestions }), { pending: false, matches: suggestions });
});
test("suggestion limit never replaces the listing's paginated results", () => {
  const records = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, label: `Record ${i}`, value: `Record ${i}` }));
  assert.equal(visibleSearchMatches({ value: "Record", suggestions: records }).matches.length, 8);
  assert.equal(records.length, 20);
});