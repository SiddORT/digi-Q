import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

const endpoint = "/reports/communication-usage";
const id = n => "notification-history:" + createHash("sha256").update(String(n)).digest("hex");
const old = Date.parse("2020-01-01T00:00:00Z");
test("clinic-admin usage resolves scoped doctor recipients without widening staff access", { timeout: 60000 }, async () => {
  const h = await createFeatureHarness({ communicationUsage: true, deletion: true });
  try {
    await seedFeatureFixtures(h.pg);
    const fingerprint = h.historyProvenance.accountSubjectFingerprint;
    for (const [key, clinicId, reporting] of [
      ["doctor-own", "c1", { recipient: fingerprint("docu"), actor: fingerprint("rec"), branchId: "b1" }],
      ["doctor-foreign", "c3", { recipient: fingerprint("docu"), actor: fingerprint("rec"), branchId: "b3" }],
      ["historical-own", "c1", undefined],
    ]) {
      const historyId = id(key);
      const data = { channel: "email", event: "booking", source: "automatic", clinicId, recipientGroup: "doctor", createdAt: old, status: "provider_accepted", ...(reporting ? { reporting } : {}) };
      data.provenance = h.historyProvenance.signHistorySubjects(historyId, data, [fingerprint("docu"), fingerprint("rec")]);
      await h.pg.query("insert into settings(id,data) values($1,$2)", [historyId, JSON.stringify(data)]);
    }
    const grouped = await h.call("adm", "GET", endpoint + "?groupBy=user");
    assert.equal(grouped.status, 200);
    assert.equal(grouped.data.total, 2);
    assert.equal(grouped.data.breakdowns.find(r => r.key === "docu").count, 1);
    assert.equal(grouped.data.breakdowns.find(r => r.key === "docu").label, "Dr Meera Rao");
    assert.equal(grouped.data.breakdowns.find(r => r.key === null).count, 1);
    assert.equal(grouped.data.userOptions.filter(u => u.id === "docu").length, 1);
    assert(!grouped.data.userOptions.some(u => ["doc3u", "patu"].includes(u.id)));
    for (const query of ["?groupBy=user&userId=docu", "?groupBy=clinic&userId=docu", "?groupBy=user&userId=rec&attribution=actor"]) {
      const r = await h.call("adm", "GET", endpoint + query);
      assert.equal(r.status, 200, query);
      assert.equal(r.data.total, 1, query);
    }
    assert.equal((await h.call("adm", "GET", endpoint + "?userId=doc3u")).status, 403);
    assert.equal((await h.call("adm2", "GET", endpoint + "?userId=docu")).status, 403);
  } finally { await h.close(); }
});
test("unlimited observed usage: buckets, legacy, isolation, cleanup, stable pages and volume", { timeout: 120000 }, async t => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32); // Fictional disposable key only.
  const h = await createFeatureHarness({ communicationUsage: true, deletion: true });
  const put = async (key, patch = {}) => {
    const d = {channel:"sms",event:"booking",source:"automatic",clinicId:"c1",recipientGroup:"patient",
      createdAt:old,status:"provider_accepted",...patch};
    if (!patch.unproven) d.provenance = h.historyProvenance.signHistorySubjects(key,d,[]);
    delete d.unproven;
    await h.pg.query("insert into settings(id,data) values ($1,$2) on conflict(id) do update set data=excluded.data", [key, JSON.stringify(d)]);
  };
  const read = async (who = "sa", query = "") => {
    const r = await h.call(who,"GET",endpoint+query);
    assert.equal(r.status,200,JSON.stringify(r.data));
    return r.data;
  };
  try {
    await h.pg.exec(`insert into users(id,email,full_name,role,status) values
      ('sa','sa@test.invalid','Super Admin','superAdmin','active'),
      ('adm','owner@test.invalid','Owner','clinicAdmin','active'),
      ('adm2','other@test.invalid','Other Owner','clinicAdmin','active'),
      ('adm4','fourth@test.invalid','Fourth Admin','clinicAdmin','active');
      insert into users(id,email,full_name,role,status) values
      ('docu','patient@test.invalid','Non Administrator','patient','active');
      insert into clinics(id,admin_id,owner_id,data) values
      ('c1','adm','adm','{"name":"Lakeview Clinic"}'),
      ('c3','adm2','adm2','{"name":"Other Clinic"}')`);
    const fingerprint = value => createHash("sha256").update(value).digest("hex");
    await put(id("accepted"), { reporting: { recipient: fingerprint("adm"), actor: fingerprint("adm"), branchId: null } });
    await put(id("failed"),{channel:"email",status:"provider_rejected"});
    await put(id("pending"),{status:"pending"});
    await put(id("sending"),{status:"sending",dispatchAt:Date.now()});
    await put(id("stale"),{status:"sending",dispatchAt:old});
    await put(id("no-claim-time"),{status:"sending"});
    await put(id("unknown"),{status:"unrecognized"});
    await put(id("skipped"),{status:"disabled"});
    await put(id("foreign"),{clinicId:"c3"});
    await put(id("security"),{event:"patient_login_otp",clinicId:"c1"});
    await put(id("unproven"),{unproven:true});
    await put(id("platform"),{clinicId:null});
    await put(id("test"),{source:"test",event:"provider_test",recipientGroup:"explicit"});
    await put(id("erased"),{erased:true});
    const legacyKey="mail-outbox:booking:legacy:0";
    await h.pg.query("insert into settings(id,data) values($1,$2)",[legacyKey,JSON.stringify({event:"booking",clinicId:"c1",createdAt:old-86400000,state:"provider_accepted",recipientGroup:"doctor"})]);
    // Outbox for a captured history is not counted a second time.
    await h.pg.query("insert into settings(id,data) values($1,$2)",["sms-outbox:booking:dedup:0",JSON.stringify({historyKey:"accepted",clinicId:"c1",createdAt:old,state:"provider_accepted",event:"booking"})]);
    // id("accepted") is exactly historyId("accepted"), so legacy must deduplicate.
    const all=await read();
    assert.equal(all.total,13);
    assert.equal(all.earliestAvailableAt,old-86400000);
    assert.equal(all.legacyCount,1);
    assert.equal(all.unattributedCount,3);
    assert.equal(all.counts.reduce((n,c)=>n+c.count,0),all.total);
    assert.equal(all.breakdowns.reduce((n,c)=>n+c.count,0),all.total);
    const byUser = await read("sa","?groupBy=user&userId=adm");
    assert.equal(byUser.total,1);
    assert.equal(byUser.breakdowns[0].key,"adm");
    assert.equal(byUser.breakdowns[0].label,"Owner");
    assert.equal((await read("sa","?groupBy=user&userId=adm&attribution=actor")).total,1);
    for (const dimension of ["location","event","recipientGroup"]) {
      const r = await read("sa",`?groupBy=${dimension}`);
      assert.equal(r.breakdowns.reduce((n,c)=>n+c.count,0),r.total,dimension);
    }
    assert.equal((await h.call("adm","GET",endpoint+"?groupBy=user&userId=adm2")).status,403);
    assert(!JSON.stringify(all).includes("encrypted"));
    assert.equal((await read("sa","?source=test")).total,1);
    const owned=await read("adm");
    assert.equal(owned.scopeClinicId,"c1");
    assert.equal(owned.total,9);
    assert.equal(owned.unattributedCount,0);
    assert.equal(owned.counts.filter(c=>c.bucket==="unknown").reduce((n,c)=>n+c.count,0),3);
    for(const key of ["foreign","security","unproven","platform","test","erased"]){
      assert.equal((await h.call("adm","GET",endpoint+"/"+id(key))).status,404,key);
    }
    for(const query of ["?clinicId=c3","?clinicId=unattributed","?source=test"]){
      assert.equal((await h.call("adm","GET",endpoint+query)).status,403);
    }
    assert.equal((await h.call("docu","GET",endpoint)).status,403);
    assert.equal((await h.call("adm","GET","/management/notification-logs")).status,403);
    assert.equal((await h.call("sa","GET","/management/notification-logs/"+id("accepted"))).status,200);
    assert.equal((await h.call("sa","GET","/management/notification-logs/legacy:"+legacyKey)).status,200);
    const logs=await h.call("sa","GET","/management/notification-logs?pageSize=100");
    assert.equal(logs.status,200);
    assert(logs.data.items.some(r=>r.id==="legacy:"+legacyKey));
    const detail=await h.call("adm","GET",endpoint+"/"+id("accepted"));
    assert.equal(detail.status,200);
    assert.equal(detail.data.createdAt,old);
    assert(!("message" in detail.data));
    await h.cleanupHistory(Date.parse("2050-01-01T00:00:00Z"));
    assert.equal((await read()).total,all.total);
    for(const query of ["?from=1900-01-01T00:00:00Z","?to=2021-01-01T00:00:00Z","?from=1900-01-01T00:00:00Z&to=2100-01-01T00:00:00Z"]){
      assert.equal((await read("sa",query)).total,13);
    }
    for(const query of ["?from=bad","?from=2026-01-01T00:00:00Z&to=2020-01-01T00:00:00Z","?pageSize=101","?cursor=bad"]){
      assert.equal((await h.call("sa","GET",endpoint+query)).status,400,query);
    }
    // IST boundary: 2020-01-01 05:30 is 00:00Z, inclusive both ends.
    assert.equal((await read("adm","?from=2020-01-01T05:30:00%2B05:30&to=2020-01-01T05:30:00%2B05:30")).total,8);
    for(const status of ["accepted","pending","failed","unknown","skipped"]){
      const page=await read("adm","?status="+status);
      assert(page.items.every(r=>r.bucket===status));
      assert.equal(page.total,owned.counts.filter(c=>c.bucket===status).reduce((n,c)=>n+c.count,0));
    }
    let first=await read("adm","?pageSize=2"), seen=first.items.map(r=>r.id), cursor=first.nextCursor;
    await put(id("concurrent-new"),{createdAt:Date.now()});
    while(cursor){
      const page=await read("adm","?pageSize=2&cursor="+encodeURIComponent(cursor));
      assert(page.items.length<=2);
      seen.push(...page.items.map(r=>r.id));cursor=page.nextCursor;
    }
    assert.equal(new Set(seen).size,9);
    assert.equal(seen.length,9);
    await h.pg.exec("update clinics set admin_id='adm4' where id='c1'");
    assert.equal((await h.call("adm","GET",endpoint)).status,403);
    assert.equal((await h.call("adm","GET",endpoint+"/"+id("accepted"))).status,403);
    assert.equal((await read("adm4")).total,10);
    await h.pg.exec("update clinics set admin_id='adm' where id='c1'");
    // Representative metadata-only large history. No live transports or real data.
    await h.pg.exec(`insert into settings(id,data)
      select 'notification-history:'||encode(sha256(convert_to('volume-'||n,'UTF8')),'hex'),
      jsonb_build_object('channel',case when n%2=0 then 'sms' else 'email' end,'event','booking','source','automatic',
      'recipientGroup','patient','clinicId','c3','status','provider_accepted','createdAt',1577836800000+n)
      from generate_series(1,20000) n`);
    const start=performance.now(), large=await read("sa","?pageSize=25");
    const elapsed=Math.round(performance.now()-start);
    assert.equal(large.total,20014);
    assert.equal(large.items.length,25);
    assert(JSON.stringify(large).length<25000);
    t.diagnostic(`20,000 additional retained records: aggregate + bounded page ${elapsed}ms; response ${JSON.stringify(large).length} bytes`);
    const deepCursor=Buffer.from(JSON.stringify([old+5000,id("volume-5000")])).toString("base64url");
    const deep=await read("sa","?pageSize=100&cursor="+deepCursor);
    assert.equal(deep.items.length,100);
    assert.equal(deep.items[0].createdAt,old+4999);
    assert.equal(deep.total,large.total);
    // A real capture and its timeline transitions remain ONE occurrence. Only
    // detail decrypts one envelope, with the contact masked and body excluded.
    const actualEntry={channel:"email",event:"rescheduled",clinicId:"c1",recipientGroup:"clinicAdmin",
      createdAt:old,_sourceInput:{clinicId:"c1",snapshot:{}}};
    await h.recordHistory("actual-capture",actualEntry,"pending",undefined,[],old);
    await h.recordHistory("actual-capture",actualEntry,"sending",{
      recipient:"fictional@example.invalid",sender:"sender@example.invalid",
      subject:"Fictional visit",message:"Private body https://example.invalid/private-token",
    },[],old+100);
    let actual=await read("adm","?event=rescheduled");
    assert.equal(actual.total,1);
    assert.equal(actual.items[0].bucket,"unknown");
    await h.recordHistory("actual-capture",actualEntry,"provider_accepted",undefined,[],old+200);
    actual=await read("adm","?event=rescheduled");
    assert.equal(actual.total,1);
    assert.equal(actual.items[0].bucket,"accepted");
    assert.equal(actual.items[0].createdAt,old);
    const masked=await h.call("adm","GET",endpoint+"/"+id("actual-capture"));
    assert.equal(masked.status,200);
    assert.equal(masked.data.recipient,"f***@***");
    assert(!JSON.stringify(masked.data).includes("private-token"));
    assert(!JSON.stringify(masked.data).includes("Private body"));
    const definitions={
      provider_accepted:"accepted",pending:"pending",provider_rejected:"failed",
      pre_dispatch_failed:"failed",configuration_failed:"failed",preparation_failed:"failed",
      delivery_unknown:"unknown",disabled:"skipped",obsolete:"skipped",no_recipient:"skipped",
      not_attempted:"skipped",unrecognized:"unknown",
    };
    for(const [status,bucket] of Object.entries(definitions)){
      await put(id("bucket-"+status),{status,event:"completed"});
      const result=await h.call("adm","GET",endpoint+"/"+id("bucket-"+status));
      assert.equal(result.data.bucket,bucket,status);
    }
    // Undated partial records are available at the end of all-time history,
    // not dropped or given an invented timestamp; explicit dates exclude them.
    await h.pg.query("insert into settings(id,data) values($1,$2)",["mail-outbox:booking:undated:0",JSON.stringify({event:"booking",clinicId:"c1",state:"provider_accepted"})]);
    const tailCursor=Buffer.from(JSON.stringify([old-86400000,"legacy:"+legacyKey])).toString("base64url");
    const tail=await read("adm","?cursor="+tailCursor);
    assert.equal(tail.items.length,1);
    assert.equal(tail.items[0].createdAt,null);
    assert.equal(tail.items[0].legacy,true);
    assert.equal((await h.call("adm","GET",endpoint+"/legacy:mail-outbox:booking:undated:0")).status,200);
    const logsTail=await h.call("sa","GET","/management/notification-logs?cursor="+tailCursor);
    assert.equal(logsTail.status,200);
    assert(logsTail.data.items.some(r=>r.id==="legacy:mail-outbox:booking:undated:0"));
    // Owning multiple clinics is supported: do not invert "one admin per
    // clinic" into "one clinic per admin", and do not require active branches.
    const beforeMulti=await read("adm");
    await h.pg.exec(`insert into clinics(id,admin_id,owner_id,data) values
      ('c2','adm','adm','{"name":"Second Owned Clinic"}')`);
    await put(id("second-owned"),{clinicId:"c2"});
    const multiple=await read("adm");
    assert.equal(multiple.total,beforeMulti.total+1);
    assert.equal(multiple.scopeClinicId,null);
    assert.equal(multiple.scopeClinicName,"All currently owned clinics (2)");
    assert(multiple.counts.some(c=>c.clinicId==="c1"));
    assert(multiple.counts.some(c=>c.clinicId==="c2"));
    assert(multiple.counts.every(c=>["c1","c2"].includes(c.clinicId)));
    assert.equal((await read("adm","?clinicId=c2")).total,1);
    assert.equal((await h.call("adm","GET",endpoint+"/"+id("second-owned"))).status,200);
    assert.equal((await h.call("adm","GET",endpoint+"/"+id("foreign"))).status,404);
    assert.equal((await h.call("adm","GET",endpoint+"?clinicId=c3")).status,403);
    assert.equal((await h.call("adm","GET",endpoint+"?clinicId=unattributed")).status,403);
    assert.equal((await h.call("adm","GET",endpoint+"/"+id("platform"))).status,404);
    await h.pg.exec("update clinics set admin_id='adm4' where id='c2'");
    assert.equal((await read("adm")).total,beforeMulti.total);
    assert.equal((await h.call("adm","GET",endpoint+"/"+id("second-owned"))).status,404);
    assert.equal((await h.call("adm","GET",endpoint+"?clinicId=c2")).status,403);
    assert.equal((await read("adm4")).total,1);
    assert.equal((await h.call("adm4","GET",endpoint+"/"+id("second-owned"))).status,200);
  } finally { await h.close(); }
});
