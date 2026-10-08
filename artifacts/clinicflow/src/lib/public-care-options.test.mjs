import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { QueryClient, InfiniteQueryObserver } from "@tanstack/react-query";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const root = import.meta.dirname, bundle = resolve(root, `.public-care-options-${process.pid}.mjs`);
const clients = [];
let api;
const guest = ["anonymous", "", ""];
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
function client() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(c);
  return c;
}
before(async () => {
  await build({
    stdin: { contents: 'export * from "./directory-cache"; export * from "./sole-option"; export * from "./context-refresh";', resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
  });
  api = await import(bundle);
});
after(async () => { clients.forEach(c => c.clear()); await rm(bundle, { force: true }); });
function observers(c, options) {
  const picker = new InfiniteQueryObserver(c, options);
  const defaults = new InfiniteQueryObserver(c, { ...options, select: data => data.pages[0] });
  const stop = [picker.subscribe(() => {}), defaults.subscribe(() => {})];
  // React reads an optimistic result on render. Raw observers constructed
  // before another observer starts a refresh need their result recomputed.
  picker.updateResult();
  defaults.updateResult();
  return { picker, defaults, stop: () => stop.forEach(fn => fn()) };
}

test("guest finder and booking menus/defaults share one cold bounded request per enabled resource", async () => {
  for (const [resource, scope] of [
    ["clinics", {}],
    ["branches", { clinicId: "c" }],
    ["branches", { clinicId: "c", doctorId: "fixed-doctor" }],
    ["doctors", { clinicId: "c", branchId: "b" }],
  ]) {
    const c = client();
    let requests = 0, release;
    const wait = new Promise(resolve => { release = resolve; });
    const options = api.publicCareOptions(guest, resource, scope, async (params, signal) => {
      requests++;
      assert.deepEqual(params, { status: "active", ...scope, search: "", page: 1, pageSize: 20 });
      assert.equal(signal.aborted, false);
      await wait;
      return { items: Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, slug: `slug-${i}` })), total: 10_000 };
    });
    const pair = observers(c, options);
    assert.equal(requests, 1, `${resource}: picker and defaults coalesce while pending`);
    release();
    await c.fetchInfiniteQuery(options);
    assert.equal(pair.picker.getCurrentResult().data.pages[0].items.length, 20);
    assert.equal(pair.defaults.getCurrentResult().data.total, 10_000);
    assert.equal(api.soleAssigned(pair.defaults.getCurrentResult().data), null);
    assert.equal(api.soleBookable(pair.defaults.getCurrentResult().data), null);
    pair.stop();
    const reopened = observers(c, api.publicCareOptions(guest, resource, { ...scope, status: "active" }, optionsLoad));
    function optionsLoad() { throw new Error("fresh navigation must not request again"); }
    assert.equal(reopened.defaults.getCurrentResult().data.total, 10_000);
    assert.equal(requests, 1);
    reopened.stop();
    assert.equal(c.getQueryCache().getAll().length, 1, "no cardinality, complete-catalog or nested page cache");
  }
});

test("search and later pages cannot replace the unsearched first-page sole authority", async () => {
  const c = client(), requests = [], scope = { clinicId: "c", branchId: "b" };
  const load = async p => {
    requests.push(p);
    return p.search
      ? { items: [{ id: "matched", slug: "matched" }], total: 1 }
      : { items: Array.from({ length: 20 }, (_, i) => ({ id: `${p.page}-${i}`, slug: `${p.page}-${i}` })), total: 100 };
  };
  const options = api.publicCareOptions(guest, "doctors", scope, load), pair = observers(c, options);
  await c.fetchInfiniteQuery(options);
  await c.fetchInfiniteQuery(api.publicCareOptions(guest, "doctors", scope, load, "matched"));
  assert.equal(pair.defaults.getCurrentResult().data.total, 100);
  assert.equal(api.soleAssigned(pair.defaults.getCurrentResult().data), null);
  await pair.picker.fetchNextPage();
  assert.equal(pair.picker.getCurrentResult().data.pages.length, 2);
  assert.equal(pair.defaults.getCurrentResult().data.items[0].id, "1-0");
  assert.deepEqual(requests.map(p => [p.search, p.page, p.pageSize]), [["", 1, 20], ["matched", 1, 20], ["", 2, 20]]);
  pair.stop();
});

test("shared defaults preserve exact-one booking and complete slugged-bookable finder semantics", async () => {
  for (const [page, assigned, bookable] of [
    [{ items: [], total: 0 }, null, null],
    [{ items: [{ id: "only", slug: "only" }], total: 1 }, "only", "only"],
    [{ items: [{ id: "only" }], total: 1 }, "only", null],
    [{ items: [{ id: "book", slug: "book" }, { id: "offline", slug: null }], total: 2 }, null, "book"],
    [{ items: [{ id: "a", slug: "a" }, { id: "b", slug: "b" }], total: 2 }, null, null],
    [{ items: [{ id: "first", slug: "first" }], total: 21 }, null, null],
  ]) {
    const c = client(), options = api.publicCareOptions(guest, "branches", { clinicId: "c" }, async () => page);
    const pair = observers(c, options);
    await c.fetchInfiniteQuery(options);
    const first = pair.defaults.getCurrentResult().data;
    assert.equal(api.soleAssigned(first)?.id || null, assigned);
    assert.equal(api.soleBookable(first)?.id || null, bookable);
    pair.stop();
  }
});

test("public pages never borrow a different actor, resource, parent, filter, selection or private response", async () => {
  const c = client(), scope = { clinicId: "c", branchId: "b", doctorId: "d", status: "active" };
  let requests = 0;
  const load = async () => { requests++; return { items: [{ id: "public" }], total: 1 }; };
  await api.directoryPage(c, guest, "doctors", { ...scope, page: 1, pageSize: 20 }, load);
  for (const [actor, resource, params] of [
    [guest, "doctors", scope],
    [["patient", "patient", ""], "doctors", scope],
    [guest, "branches", scope],
    [guest, "doctors", { ...scope, clinicId: "other" }],
    [guest, "doctors", { ...scope, branchId: "other" }],
    [guest, "doctors", { ...scope, doctorId: "other" }],
    [guest, "doctors", { ...scope, doctorId: undefined }],
    [guest, "doctors", { ...scope, status: "inactive" }],
    [guest, "doctors", { ...scope, specialty: "restricted" }],
    [guest, "doctors", { ...scope, selectedIds: "saved" }],
  ]) await c.fetchInfiniteQuery(api.publicCareOptions(actor, resource, params, load));
  assert.equal(requests, 11);
});

test("public freshness and shared invalidation refresh once; failed refresh cannot prove a sole default", async () => {
  const c = client();
  let requests = 0, fail = false;
  const options = api.publicCareOptions(guest, "clinics", {}, async () => {
    requests++;
    if (fail) throw new Error("Offline");
    return { items: [{ id: "only", slug: "only" }], total: 1 };
  });
  await c.fetchInfiniteQuery(options);
  c.setQueryData(options.queryKey, c.getQueryData(options.queryKey), { updatedAt: Date.now() - api.DIRECTORY_FRESH_MS });
  await c.fetchInfiniteQuery(options);
  assert.equal(requests, 2, "expired data is fetched again");
  const pair = observers(c, options);
  await api.refreshSignedInContext(c);
  assert.equal(requests, 2, "fresh navigation needs no refresh");
  await Promise.all([api.refreshSignedInContext(c, true), api.refreshSignedInContext(c, true)]);
  assert.equal(requests, 3, "overlapping invalidations share one refresh");
  fail = true;
  await c.invalidateQueries({ queryKey: options.queryKey });
  assert.equal(requests, 4, "failed reads are not silently retried");
  const failed = pair.defaults.getCurrentResult();
  assert.equal(failed.isError, true);
  assert.equal(api.soleAssigned(failed.data, failed.isError), null);
  fail = false;
  await pair.picker.refetch();
  assert.equal(requests, 5);
  assert.equal(pair.defaults.getCurrentResult().isError, false);
  pair.stop();
});

test("one consumer leaving keeps the shared request alive; the last leaving aborts and cannot cache late rows", async () => {
  const c = client();
  let signal, release;
  const wait = new Promise(resolve => { release = resolve; });
  const options = api.publicCareOptions(guest, "clinics", {}, async (_p, s) => {
    signal = s;
    await wait; // Deliberately ignore abort to prove late responses cannot seed data.
    return { items: [{ id: "late" }], total: 1 };
  });
  const picker = new InfiniteQueryObserver(c, options);
  const defaults = new InfiniteQueryObserver(c, { ...options, select: data => data.pages[0] });
  const stopPicker = picker.subscribe(() => {}), stopDefaults = defaults.subscribe(() => {});
  stopPicker();
  assert.equal(signal.aborted, false);
  stopDefaults();
  assert.equal(signal.aborted, true);
  release();
  await turn();
  assert.equal(c.getQueryData(options.queryKey), undefined);
});

test("expired sole data stays in a refreshing state until current cardinality arrives", async () => {
  const c = client();
  const cached = api.publicCareOptions(guest, "clinics", {}, async () => ({ items: [{ id: "old-sole", slug: "old" }], total: 1 }));
  await c.fetchInfiniteQuery(cached);
  c.setQueryData(cached.queryKey, c.getQueryData(cached.queryKey), { updatedAt: Date.now() - api.DIRECTORY_FRESH_MS });
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const current = api.publicCareOptions(guest, "clinics", {}, async () => {
    await wait;
    return { items: [{ id: "old-sole", slug: "old" }, { id: "new", slug: "new" }], total: 2 };
  });
  const pair = observers(c, current);
  assert.equal(pair.defaults.getCurrentResult().data.total, 1);
  assert.equal(pair.defaults.getCurrentResult().isFetching, true, "consumers must wait rather than select stale sole data");
  release();
  await c.fetchInfiniteQuery(current);
  assert.equal(pair.defaults.getCurrentResult().isFetching, false);
  assert.equal(api.soleBookable(pair.defaults.getCurrentResult().data), null);
  pair.stop();
});

test("explicit actor-boundary cancellation clears public options and rejects late reads", async () => {
  const c = client();
  let signal, release;
  const wait = new Promise(resolve => { release = resolve; });
  const options = api.publicCareOptions(guest, "branches", { clinicId: "c" }, async (_p, s) => {
    signal = s;
    await wait;
    return { items: [{ id: "late" }], total: 1 };
  });
  const pending = c.fetchInfiniteQuery(options), rejected = assert.rejects(pending);
  await c.cancelQueries();
  c.clear();
  assert.equal(signal.aborted, true);
  release();
  await rejected;
  await turn();
  assert.equal(c.getQueryCache().getAll().length, 0);
});

test("guest consumers and menus use shared public pages with separate unsearched default authority", async () => {
  const [care, finder, booking] = await Promise.all(["CareLookup", "GuestClinicFinder", "GuestBooking"]
    .map(name => readFile(resolve(root, `../components/${name}.tsx`), "utf8")));
  assert.match(care, /publicCareOptions\(actor, kind, params,/);
  assert.match(care, /publicOptions\?\.queryKey/);
  assert.match(care, /publicOptions\.queryFn\(\{ pageParam, signal \}\)/);
  for (const source of [finder, booking]) {
    assert.equal((source.match(/publicCareOptions\(actor,/g) || []).length, 2);
    assert.equal((source.match(/select:\s*data\s*=>\s*data\.pages\[0\]/g) || []).length, 2);
    assert.doesNotMatch(source, /queryKey:\s*\["guest-(?:finder-)?single-/);
    assert.doesNotMatch(source, /pageSize:\s*2/);
  }
  assert.match(finder, /clinics\.isError\?null:soleBookable\(clinics\.data\)/);
  assert.match(finder, /branches\.isError\?null:soleBookable\(branches\.data\)/);
  assert.match(booking, /soleAssigned\(branchOptions\.data,branchOptions\.isError\)/);
  assert.match(booking, /soleAssigned\(doctorOptions\.data,doctorOptions\.isError\)/);
  assert.match(booking, /doctorId:context\.doctorId\|\|undefined/);
  for (const name of ["clinics", "branches"]) assert.match(finder, new RegExp(`!${name}\\.isFetching`));
  for (const name of ["branchOptions", "doctorOptions"]) assert.match(booking, new RegExp(`!${name}\\.isFetching`));
});
