import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadModule } from "../test/load-module.mjs";

const pref = await loadModule(new URL("./page-size-preference.tsx", import.meta.url));
const store = await loadModule(new URL("./workspace-preferences.ts", import.meta.url));

test("without opt-in, preserve every existing surface default", () => {
  for (const fallback of [10, 20, 25]) assert.equal(pref.resolvePageSize(fallback, null), fallback);
  assert.equal(pref.resolvePageSize(10, 50), 50);
});
test("explicit URL or saved-view sizes outrank the preference, including legacy 20", () => {
  for (const size of pref.APPROVED_PAGE_SIZES) {
    assert.equal(pref.resolvePageSize(20, 100, String(size)), size);
  }
  for (const value of ["", null, undefined, "garbage", "15", -1, 0, Infinity]) {
    assert.equal(pref.resolvePageSize(20, 50, value), 50);
  }
});
test("limited public-directory sizes never broaden to unsupported preference 20", () => {
  const publicSizes = [10, 25, 50, 100];
  assert.equal(pref.resolvePageSize(25, 20, undefined, publicSizes), 25);
  assert.equal(pref.resolvePageSize(25, 100, 10, publicSizes), 10);
});
test("stored sizes require approved numeric values", () => {
  for (const size of pref.APPROVED_PAGE_SIZES) assert.equal(pref.sanitizePageSize(size), size);
  for (const value of ["50", 15, {}, [], null, undefined, -1, 0, NaN]) assert.equal(pref.sanitizePageSize(value), null);
});
test("account storage is isolated, reloadable, resettable and rejects corrupt values", () => {
  const values = new Map();
  const oldStorage = globalThis.localStorage, oldWindow = globalThis.window, oldEvent = globalThis.CustomEvent;
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event) };
  try {
    const a = pref.pageSizePreferenceKey("account-a"), b = pref.pageSizePreferenceKey("account-b");
    const read = key => store.readPreference(key, null, pref.sanitizePageSize);
    assert.equal(read(a), null);
    assert.equal(store.writePreference(a, 50), true);
    assert.equal(read(a), 50);
    assert.equal(read(b), null);
    store.writePreference(b, 10);
    assert.equal(read(b), 10);
    assert.equal(read(a), 50);
    assert.equal(events[0].detail, a);
    store.writePreference(a, null);
    assert.equal(read(a), null);
    assert.equal(read(b), 10);
    values.set(a, "{broken");
    assert.equal(read(a), null);
    values.set(a, "999");
    assert.equal(read(a), null);
    globalThis.localStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
    assert.equal(read(b), null);
    assert.equal(store.writePreference(b, 100), false);
  } finally {
    globalThis.localStorage = oldStorage; globalThis.window = oldWindow; globalThis.CustomEvent = oldEvent;
  }
});
test("profile offers explicit opt-in and a return to original defaults", () => {
  const html = renderToStaticMarkup(createElement(pref.PageSizePreferenceControl));
  assert.match(html, /Use each list/);
  assert.match(html, /<option value="" selected=""/);
  for (const size of pref.APPROVED_PAGE_SIZES) assert.match(html, new RegExp(`<option value="${size}">${size}</option>`));
});
test("only existing size-enabled surfaces adopt the preference", () => {
  const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
  for (const path of ["../clinic.tsx", "../Users.tsx", "../resources.tsx", "../components/PublicClinicPage.tsx", "../components/queue/SessionQueue.tsx", "../components/queue/GuestRequests.tsx", "../components/reports/ReportsDashboard.tsx"]) {
    assert.match(read(path), /use(?:PreferredPageSize|PageSizeState)/, path);
  }
  const controls = read("../components/ListingControls.tsx");
  assert.match(controls, /onPageSizeChange &&/);
  assert.match(controls, /preference.size !== null/);
  assert.match(read("../components/PageSizeAccountBoundary.tsx"), /key=\{actor \|\| "guest"\}/);
  assert.match(read("../resources.tsx"), /pageSize:view.filters.pageSize\|\|20/);
});
