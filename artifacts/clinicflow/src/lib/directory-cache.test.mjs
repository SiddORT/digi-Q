// Real QueryClient request/payload benchmarks; synthetic records, no accounts,
// network, database, browser timing or credentials.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QueryClient, QueryObserver, InfiniteQueryObserver } from "@tanstack/react-query";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const root = import.meta.dirname, bundle = resolve(root, `.directory-cache-${process.pid}.mjs`);
let api;
const actor = ["staff-fixture", "clinicAdmin", ""];
const clients = [];
function client() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(c);
  return c;
}
before(async () => {
  await build({
    stdin: { contents: 'export * from "./directory-cache"; export * from "./context-refresh"; export * from "./sole-option";', resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
  });
  api = await import(bundle);
});
after(async () => { clients.forEach(c => c.clear()); await rm(bundle, {force: true}); });
function fixture(count) {
  const rows = Array.from({length: count}, (_, i) => ({
    id: `branch-${i}`, clinicId: `clinic-${i % 10}`, name: `Location ${i}`,
    clinicName: `Group ${i % 10}`, status: "active",
  }));
  const metrics = { requests: 0, bytes: 0, rows: 0 };
  const load = async p => {
    metrics.requests++;
    const filtered = rows.filter(r => (!p.clinicId || r.clinicId === p.clinicId)
      && (!p.search || r.name.includes(p.search))
      && (!p.selectedIds || p.selectedIds.split(",").includes(r.id)));
    const result = {items: filtered.slice((p.page - 1) * p.pageSize, p.page * p.pageSize), total: filtered.length, page: p.page};
    metrics.bytes += Buffer.byteLength(JSON.stringify(result)); metrics.rows += result.items.length;
    return result;
  };
  return {rows, metrics, load};
}
test("picker and sole defaults share one bounded first page, even concurrently", async () => {
  const c = client(), f = fixture(10000), p = {status: "active", page: 1, pageSize: 20};
  const results = await Promise.all(Array.from({length: 12}, () => api.directoryPage(c, actor, "branches", p, f.load)));
  assert.equal(f.metrics.requests, 1); assert.equal(f.metrics.rows, 20);
  assert.equal(results[0].total, 10000);
  assert.equal(api.soleAssigned(results[0]), null, "first displayed row is never a sole default");
  await api.directoryPage(c, actor, "branches", {...p, page: 2}, f.load);
  await api.directoryPage(c, actor, "branches", {...p, search: "Location 999"}, f.load);
  assert.equal(f.metrics.requests, 3, "subsequent and searched pages stay independent");
  assert.equal(await api.cachedComplete(c, actor, "branches", {status: "active"}), undefined);
});
test("complete directory supports scoped pages/labels; no doctor, actor or filter widening", async () => {
  const c = client(), f = fixture(250);
  await api.completeDirectory(c, actor, "branches", {status: "active", doctorId: "d1"}, f.load);
  const complete = await api.cachedComplete(c, actor, "branches", {status: "active", doctorId: "d1", clinicId: "clinic-4"});
  assert.equal(complete.total, 25); assert.ok(complete.items.every(r => r.clinicId === "clinic-4"));
  for (const [a, p] of [
    [actor, {status: "active", doctorId: "d2"}],
    [actor, {status: "active"}],
    [actor, {status: "inactive", doctorId: "d1"}],
    [actor, {status: "active", doctorId: "d1", branchId: "branch-4"}],
    [["different-staff", "clinicAdmin", ""], {status: "active", doctorId: "d1"}],
    [["staff-fixture", "doctor", "d1"], {status: "active", doctorId: "d1"}],
  ]) assert.equal(await api.cachedComplete(c, a, "branches", p), undefined);
  assert.equal(f.metrics.requests, 3);
});
test("in-flight workspace full read is shared with pickers rather than loaded twice", async () => {
  const c = client(), f = fixture(250);
  let release;
  const wait = new Promise(r => { release = r; });
  const full = api.completeDirectory(c, actor, "branches", {status: "active"}, async p => {await wait; return f.load(p);});
  const page = api.directoryPage(c, actor, "branches", {status: "active", clinicId: "clinic-1", page: 1, pageSize: 20}, f.load);
  release();
  const [all, first] = await Promise.all([full, page]);
  assert.equal(all.total, 250); assert.equal(first.total, 25); assert.equal(first.items.length, 20);
  assert.equal(f.metrics.requests, 3);
});
test("empty/sole/inactive and optional all-location scopes preserve their meaning", async () => {
  for (const rows of [[], [{id:"one",status:"active"}], [{id:"one",status:"inactive"}]]) {
    const c = client();
    const result = await api.directoryPage(c, actor, "branches", {page:1,pageSize:20}, async () => ({items:rows,total:rows.length}));
    assert.equal(api.soleAssigned(result)?.id || null, rows[0]?.status === "active" ? "one" : null);
  }
  assert.deepEqual(api.directoryScope({clinicId:"",doctorId:undefined,status:"active",page:1,pageSize:2}), {status:"active"});
  assert.notDeepEqual(api.directoryScope({branchId:"specific"}), api.directoryScope({}));
});
test("unverified, inconsistent, duplicate, truncated and failed catalogs are never reused", async () => {
  for (const responses of [
    [{items:[{id:"one"}],total:undefined}],
    [{items:[{id:"one"}],total:2}, {items:[],total:2}],
    [{items:[{id:"one"}],total:2}, {items:[{id:"one"}],total:2}],
    [{items:[{id:"one"}],total:2}, {items:[{id:"two"}],total:3}],
  ]) {
    const c = client();
    await assert.rejects(api.completeDirectory(c, actor, "branches", {}, async p => responses[p.page - 1]));
    assert.equal(await api.cachedComplete(c, actor, "branches", {}), undefined);
  }
  const c = client(), key = api.directoryCompleteKey(actor, "branches", {});
  c.setQueryData(key, {items:[{id:"old"}], total:1});
  await c.invalidateQueries({refetchType:"none"});
  await assert.rejects(api.completeDirectory(c, actor, "branches", {}, async () => {throw new Error("offline");}), /offline/);
  assert.equal(await api.cachedComplete(c, actor, "branches", {}), undefined, "old success cannot conceal failed refresh");
});
test("cache reuse expires at 60s, and mutation invalidation forces fresh rows", async () => {
  const c = client(), f = fixture(1), p = {page:1,pageSize:20,status:"active"};
  await api.directoryPage(c, actor, "branches", p, f.load);
  const key = api.directoryCompleteKey(actor, "branches", p);
  c.setQueryData(key, c.getQueryData(key), {updatedAt: Date.now() - 60000});
  assert.equal(await api.cachedComplete(c, actor, "branches", p), undefined);
  // Expire the bounded page too; a fresh inner page may legitimately repopulate a complete result.
  c.setQueryData(["directory-page",actor,"branches",p], c.getQueryData(["directory-page",actor,"branches",p]), {updatedAt:Date.now()-60000});
  await api.directoryPage(c, actor, "branches", p, f.load);
  assert.equal(f.metrics.requests, 2);
  await c.invalidateQueries({refetchType:"none"});
  f.rows[0].status = "inactive";
  const current = await api.directoryPage(c, actor, "branches", p, f.load);
  assert.equal(f.metrics.requests, 3); assert.equal(api.soleAssigned(current), null);
});
test("saved detail labels are deduplicated per ID and isolated by actor", async () => {
  const c = client(); let calls = 0;
  const load = async () => {calls++; return {id:"saved",name:"Saved label"};};
  await Promise.all(Array.from({length:10}, () => api.directoryDetail(c,actor,"doctors","saved",load)));
  assert.equal(calls,1);
  await api.directoryDetail(c,["other","clinicAdmin",""],"doctors","saved",load);
  assert.equal(calls,2);
});
test("cold public picker and confirmation share one selected request on a slow connection; restored consumers reuse it", async () => {
  for (const resource of ["clinics", "branches", "doctors"]) {
    const c = client(), guest = api.directoryActor();
    const scope = {clinicId:"clinic-1",branchId:"branch-1",doctorId:"doctor-1",status:"active"};
    let requests = 0, release;
    const wait = new Promise(resolve => {release=resolve;});
    const load = async (params, signal) => {
      requests++;
      assert.deepEqual(params, {...scope, selectedIds:"saved",page:1,pageSize:20});
      assert.equal(signal.aborted,false);
      await wait;
      return {items:[{id:"saved",name:"Public saved name"}],total:1};
    };
    const options = () => api.publicSelectedCareOptions(guest,resource,"saved",scope,load);
    const picker = new QueryObserver(c,options()), confirmation = new QueryObserver(c,
      api.publicSelectedCareOptions(guest,resource,"saved",{...scope,status:undefined},load));
    const unsub = [picker.subscribe(()=>{}),confirmation.subscribe(()=>{})];
    assert.equal(requests,1);
    release();
    await c.fetchQuery(options());
    assert.equal(picker.getCurrentResult().data.name,"Public saved name");
    assert.equal(confirmation.getCurrentResult().data.name,"Public saved name");
    unsub.forEach(fn=>fn());
    const restored = new QueryObserver(c,options()), stop = restored.subscribe(()=>{});
    await c.fetchQuery(options());
    assert.equal(requests,1,"restored selected IDs reuse a fresh exact-scope label");
    await api.refreshSignedInContext(c,true);
    assert.equal(requests,2,"invalidation refreshes the shared public observer once");
    stop();
    assert.equal(c.getQueryCache().getAll().length,1,"no catalog or alternate selected keys");
  }
});
test("searched and sole public choices retain only the chosen row and need no selected request", async () => {
  const c=client(), guest=api.directoryActor(), f=fixture(10000), scope={clinicId:"clinic-1",status:"active"};
  const searched = await f.load({...scope,search:"Location 999",page:1,pageSize:20});
  const selected=searched.items[0], updatedAt=Date.now()-1000;
  api.retainPublicSelectedCare(c,guest,"branches",scope,selected,updatedAt);
  const options=api.publicSelectedCareOptions(guest,"branches",selected.id,{...scope,search:"",pageSize:2},f.load);
  const picker=new QueryObserver(c,options), summary=new QueryObserver(c,options);
  const unsub=[picker.subscribe(()=>{}),summary.subscribe(()=>{})];
  await c.fetchQuery(options);
  assert.equal(f.metrics.requests,1,"the search is the only request, not a selectedIds request");
  assert.equal(c.getQueryState(options.queryKey).dataUpdatedAt,updatedAt,"seeding does not extend source freshness");
  assert.equal(c.getQueryCache().getAll().length,1,"unchosen searched rows are not retained as selected labels");
  unsub.forEach(fn=>fn());
  const sole={id:"only",name:"Only public clinic"};
  api.retainPublicSelectedCare(c,guest,"clinics",{status:"active"},sole,Date.now());
  await c.fetchQuery(api.publicSelectedCareOptions(guest,"clinics","only",{status:"active"},async()=>{throw Error("redundant selected read");}));
});
test("public selected labels keep exact actor, parent, resource, status and private/public boundaries", async () => {
  const c=client(), guest=api.directoryActor(), scope={clinicId:"c",branchId:"b",doctorId:"d",status:"active"};
  let requests=0;
  const load=async()=>{requests++;return {items:[{id:"saved",name:"Public"}],total:1};};
  await api.directoryDetail(c,guest,"doctors","saved",async()=>({id:"saved",name:"Private"}));
  for (const [a,kind,p] of [
    [guest,"doctors",scope],
    [["signed-in","patient",""],"doctors",scope],
    [guest,"doctors",{...scope,clinicId:"other"}],
    [guest,"doctors",{...scope,branchId:"other"}],
    [guest,"doctors",{...scope,doctorId:"other"}],
    [guest,"doctors",{...scope,status:"inactive"}],
    [guest,"doctors",{...scope,doctorId:undefined}],
    [guest,"branches",scope],
  ]) assert.equal((await c.fetchQuery(api.publicSelectedCareOptions(a,kind,"saved",p,load))).name,"Public");
  assert.equal(requests,8);
});
test("public label expiry, invalidation, missing records and retry never borrow old display data", async () => {
  const c=client(), guest=api.directoryActor(), scope={clinicId:"c"};
  let requests=0, available=true;
  const options=api.publicSelectedCareOptions(guest,"branches","saved",scope,async()=>{
    requests++;return {items:available?[{id:"saved",name:"Current"}]:[],total:available?1:0};
  });
  await c.fetchQuery(options);
  c.setQueryData(options.queryKey,c.getQueryData(options.queryKey),{updatedAt:Date.now()-60000});
  api.retainPublicSelectedCare(c,guest,"branches",scope,{id:"saved",name:"Old"},Date.now()-60000);
  await c.fetchQuery(options);
  assert.equal(requests,2);
  await c.invalidateQueries({queryKey:options.queryKey,refetchType:"none"});
  api.retainPublicSelectedCare(c,guest,"branches",scope,{id:"saved",name:"Do not conceal invalidation"},Date.now());
  assert.equal(c.getQueryState(options.queryKey).isInvalidated,true);
  available=false;
  await assert.rejects(c.fetchQuery(options),/no longer available/);
  assert.equal(requests,3);
  available=true;
  await c.fetchQuery(options);
  assert.equal(requests,4);
});
test("disabled public controls still hydrate; canceled public reads cannot repopulate a cleared actor cache", async () => {
  const c=client(), guest=api.directoryActor();
  let release, signal;
  const wait=new Promise(resolve=>{release=resolve;});
  const options=api.publicSelectedCareOptions(guest,"doctors","saved",{branchId:"b"},async(_p,s)=>{
    signal=s;await wait;return {items:[{id:"saved"}],total:1};
  });
  assert.equal(options.enabled,true,"hydration depends on selected ID, not editability");
  assert.equal(api.publicSelectedCareOptions(guest,"doctors","",{},async()=>{throw Error("empty");}).enabled,false);
  const first=new QueryObserver(c,options), second=new QueryObserver(c,options);
  const stopFirst=first.subscribe(()=>{}), stopSecond=second.subscribe(()=>{});
  stopFirst();
  assert.equal(signal.aborted,false,"one departing consumer cannot cancel another's shared read");
  stopSecond();
  assert.equal(signal.aborted,true,"last departing consumer cancels the transport");
  await c.cancelQueries(); c.clear(); release();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(c.getQueryCache().getAll().length,0);
});
test("public picker, booking summary and sole defaults remain wired to shared selected labels", async () => {
  const care=await readFile(new URL("../components/CareLookup.tsx",import.meta.url),"utf8");
  const booking=await readFile(new URL("../components/GuestBooking.tsx",import.meta.url),"utf8");
  const finder=await readFile(new URL("../components/GuestClinicFinder.tsx",import.meta.url),"utf8");
  assert.equal((care.match(/publicSelectedCareOptions\(actor, kind,/g)||[]).length,2,"both public consumers use the same observer options");
  assert.match(care,/retainPublicSelectedCare\(client, actor, kind, params, record, query.dataUpdatedAt\)/);
  assert.match(care,/options.unshift\(\{ value, label: display\(record\), disabled: true \}\)/,"hydrated labels are not selectable menu membership");
  assert.match(booking,/useSelectedCare\("branches",!committed&&!receipt\?branchId:"",true,\{clinicId:context.clinicId,doctorId:context.doctorId\|\|undefined,status:"active"\}\)/);
  assert.match(booking,/useSelectedCare\("doctors",!committed&&!receipt\?doctorId:"",true,\{clinicId:context.clinicId,branchId,status:"active"\}\)/);
  for (const source of [booking,finder]) {
    assert.match(source,/retainPublicSelectedCare\(client,actor,"branches"/);
  }
  assert.match(finder,/retainPublicSelectedCare\(client,actor,"clinics"/);
  assert.match(booking,/retainPublicSelectedCare\(client,actor,"doctors"/);
});
test("sign-out cancellation cannot repopulate complete directories with late responses", async () => {
  const c = client(); let release, started;
  const startedPromise = new Promise(resolve => {started=resolve;});
  const wait = new Promise(resolve => {release=resolve;});
  const pending = api.directoryPage(c,actor,"branches",{page:1,pageSize:20},async (_p,signal)=>{
    started(signal); await wait;
    return {items:[{id:"old-actor"}],total:1};
  });
  const signal = await startedPromise;
  const rejected = assert.rejects(pending);
  await c.cancelQueries(); c.clear();
  assert.equal(signal.aborted,true);
  release(); await rejected;
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(c.getQueryCache().getAll().length,0);
});
test("one refresh owner coalesces overlapping picker/default requests and ignores fresh navigation", async () => {
  const c = client(), f = fixture(200), p = {status:"active",page:1,pageSize:20};
  const page = () => api.directoryPage(c, actor, "branches", p, f.load);
  const picker = new InfiniteQueryObserver(c, {
    queryKey:["remote-options",actor,"branches",{status:"active"},""], initialPageParam:1,
    queryFn:page, getNextPageParam:()=>undefined, staleTime:60000,
  });
  const sole = new QueryObserver(c, {queryKey:["operational-cardinality",actor,"branches",{status:"active"}], queryFn:page, staleTime:60000});
  const unsubscribe = [picker.subscribe(()=>{}), sole.subscribe(()=>{})];
  await Promise.all([picker.refetch(),sole.refetch()]);
  assert.equal(f.metrics.requests,1);
  await api.refreshSignedInContext(c);
  assert.equal(f.metrics.requests,1);
  await Promise.all([api.refreshSignedInContext(c,true),api.refreshSignedInContext(c,true)]);
  assert.equal(f.metrics.requests,2,"one additional first-page read per periodic refresh");
  assert.equal(picker.getCurrentResult().data.pages[0].total,200);
  unsubscribe.forEach(fn=>fn());
});
test("overlapping periodic workspace, picker, cardinality and label refreshes load a large catalog once", async () => {
  const c=client(), f=fixture(2500), scope={status:"active"}, selected={...scope,clinicId:"clinic-1"};
  const workspace=new QueryObserver(c,{
    queryKey:["workspace-branches",...actor], staleTime:60000,
    queryFn:()=>api.completeDirectory(c,actor,"branches",scope,f.load),
  });
  const unsub=[workspace.subscribe(()=>{})];
  await workspace.refetch();
  const page=()=>api.directoryPage(c,actor,"branches",{...selected,page:1,pageSize:20},f.load);
  const picker=new InfiniteQueryObserver(c,{
    queryKey:["remote-options",actor,"branches",selected,""],initialPageParam:1,
    queryFn:page,getNextPageParam:()=>undefined,staleTime:60000,
  });
  const defaults=new QueryObserver(c,{
    queryKey:["operational-cardinality",actor,"branches",selected],queryFn:page,staleTime:60000,
  });
  const labels=new QueryObserver(c,{
    queryKey:["remote-selected",actor,"branches","branch-2491",selected],staleTime:60000,
    queryFn:async()=> (await api.cachedComplete(c,actor,"branches",selected)).items.filter(r=>r.id==="branch-2491"),
  });
  unsub.push(picker.subscribe(()=>{}),defaults.subscribe(()=>{}),labels.subscribe(()=>{}));
  await Promise.all([picker.refetch(),defaults.refetch(),labels.refetch()]);
  assert.equal(f.metrics.requests,25);
  await Promise.all([api.refreshSignedInContext(c,true),api.refreshSignedInContext(c,true)]);
  assert.equal(f.metrics.requests,50,"one full read for each refresh window, not one per consumer");
  assert.equal(f.metrics.rows,5000);
  assert.equal(labels.getCurrentResult().data[0].id,"branch-2491");
  unsub.forEach(fn=>fn());
});
test("large-directory request and payload budgets (old paths vs shared paths)", async t => {
  for (const count of [100,1000,10000]) {
    const old = fixture(count), shared = fixture(count), c = client(), scope = {status:"active"};
    // Baseline: old workspace full read, plus ten distinct picker scopes, each
    // with a first page, ResourceLookup cardinality, sole-default cardinality,
    // and saved-label read. This is measured, not a wall-clock estimate.
    for (let page=1;page<=Math.ceil(count/100);page++) await old.load({...scope,page,pageSize:100});
    for (let i=0;i<10;i++) {
      const scoped={...scope,clinicId:`clinic-${i}`,page:1};
      await old.load({...scoped,pageSize:20});
      await old.load({...scoped,pageSize:2});
      await old.load({...scoped,pageSize:2});
      await old.load({...scoped,pageSize:1,selectedIds:`branch-${count-10+i}`});
    }
    await api.completeDirectory(c,actor,"branches",scope,shared.load);
    for (let i=0;i<10;i++) {
      const p={...scope,clinicId:`clinic-${i}`,page:1,pageSize:20};
      await Promise.all(Array.from({length:3},()=>api.directoryPage(c,actor,"branches",p,shared.load)));
      const labels=await api.cachedComplete(c,actor,"branches",p);
      assert.ok(labels.items.some(row=>row.id===`branch-${count-10+i}`));
    }
    assert.equal(shared.metrics.requests,Math.ceil(count/100));
    assert.equal(shared.metrics.rows,count,"exactly one full catalog, no repeated option/label payloads");
    assert.ok(shared.metrics.bytes<old.metrics.bytes);
    assert.equal(old.metrics.requests-shared.metrics.requests,40);
    t.diagnostic(JSON.stringify({directorySize:count,baseline:old.metrics,shared:shared.metrics}));
  }
});
