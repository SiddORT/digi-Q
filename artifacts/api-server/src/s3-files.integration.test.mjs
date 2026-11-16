// Real HTTP authorization, SQL registry, migration journal and file service.
// S3 command transport and the existing Google object adapter are offline doubles.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
import { fakeS3 } from "./test-support/s3-fixture.mjs";

const s3=fakeS3(), PDF=Buffer.from("%PDF-1.4\nfixture\n%%EOF\n");
const settings={
  MEDIA_STORAGE:"local", FILES_STORAGE:"s3", FILES_S3_BUCKET:"private-fixture",
  FILES_S3_REGION:"us-east-1", FILES_S3_ENDPOINT:"https://s3.fixture.invalid",
  FILES_S3_UPLOADS_PREFIX:"uploads", FILES_S3_FORCE_PATH_STYLE:"true",
  FILES_S3_CREDENTIALS:"static", FILES_S3_ACCESS_KEY_ID:"DO-NOT-LOG-ID",
  FILES_S3_SECRET_ACCESS_KEY:"DO-NOT-LOG-SECRET", PRIVATE_OBJECT_DIR:"/fixture-bucket/private",
};
let h,temp,prior={};
const rows=async(text,args)=>(await h.pg.query(text,args)).rows;
const upload=()=>h.call("rec","POST","/files?clinicId=c1&patientId=p1&purpose=documents&name=test.pdf&provider=local&storageKey=../../secret&endpoint=https://evil.invalid",PDF);
async function approvedUpload() {
  const response=await upload(); assert.equal(response.status,201,JSON.stringify(response.data));
  const f=response.data;
  assert.equal((await h.call("sa","POST",`/files/${f.id}/approve`,{digest:f.digest,reviewed:true})).status,200);
  return f;
}
before(async()=>{
  temp=await mkdtemp(join(tmpdir(),"s3-files-"));
  settings.MEDIA_ROOT=join(temp,"uploads");
  for(const [key,value] of Object.entries(settings)){prior[key]=process.env[key];process.env[key]=value;}
  h=await createFeatureHarness({files:true,s3ClientFactory:s3.factory});
  await seedFeatureFixtures(h.pg);
});
after(async()=>{
  await h?.close(); await rm(temp,{recursive:true,force:true});
  for(const [key,value] of Object.entries(prior)) value===undefined?delete process.env[key]:process.env[key]=value;
  delete globalThis.__featureS3ClientFactory;
});

test("S3 file URLs stay authorized and private; query locators cannot redirect writes",async()=>{
  const f=await approvedUpload(), [saved]=await rows("select * from patient_documents where id=$1",[f.id]);
  assert.equal(saved.provider,"s3");
  assert.match(saved.storage_key,/^s3:[a-f0-9]{64}:private-fixture\/uploads\/private\/clinics\/c1\/patients\/p1\/documents\//);
  assert.equal(f.contentUrl,`/api/files/${f.id}/content`);
  assert.ok(!/DO-NOT-LOG|s3:|storageKey|fixture.invalid/.test(JSON.stringify(f)));
  const before=s3.calls.length;
  for(const actor of [null,"adm2","rec3","pat3u","doc3u"])
    assert.ok([401,404].includes((await h.call(actor,"GET",f.contentUrl)).status));
  assert.equal(s3.calls.length,before,"denied requests never read provider");
  for(const actor of ["rec","docu","patu"]) {
    const r=await h.call(actor,"GET",f.contentUrl);
    assert.equal(r.status,200); assert.deepEqual(r.data,PDF);
    assert.equal(r.headers.get("cache-control"),"private, no-store");
    assert.equal(r.headers.get("location"),null);
  }
  await rows(`insert into settings(id,data) values ('permission-policy','{"revision":1,"denied":["receptionist:patients:read"]}')`);
  assert.equal((await h.call("rec","GET",f.contentUrl)).status,403);
  await rows("delete from settings where id='permission-policy'");
  const publicProbe=await fetch(h.base.replace(/\/api$/,"")+"/media/private/clinics/c1/patients/p1/documents/"+f.id+".pdf");
  assert.equal(publicProbe.status,404);
});

test("delete-if-authorized retains S3 bytes and restore verifies their digest",async()=>{
  const f=await approvedUpload(), before=s3.blobs.size;
  assert.equal((await h.call("rec2","DELETE",`/files/${f.id}`)).status,403);
  assert.equal((await h.call("rec","DELETE",`/files/${f.id}`)).status,204);
  assert.equal(s3.blobs.size,before);
  assert.equal((await h.call("rec","GET",f.contentUrl)).status,404);
  assert.equal((await h.call("adm","POST",`/files/${f.id}/restore`)).status,200);
  assert.equal((await h.call("rec","GET",f.contentUrl)).status,200);
  assert.equal(s3.calls.filter(c=>c.name==="DeleteObjectCommand").length,0,"no authorized source purge was requested");
  const [saved]=await rows("select storage_key from patient_documents where id=$1",[f.id]);
  const locator=saved.storage_key.replace(/^s3:[a-f0-9]{64}:/,"");
  s3.blobs.set(locator,Buffer.alloc(PDF.length,65));
  assert.equal((await h.call("rec","GET",f.contentUrl)).status,409);
});

test("historical mixed-driver files keep their locators across default bucket/prefix/driver changes",async()=>{
  const sf=await approvedUpload();
  process.env.FILES_STORAGE="local"; const lf=await approvedUpload();
  process.env.FILES_STORAGE="object"; const of=await approvedUpload();
  const before=await rows("select id,provider,storage_key from patient_documents where id=any($1::text[]) order by id",[[sf.id,lf.id,of.id]]);
  for(const selected of ["s3","local","object"]) {
    process.env.FILES_STORAGE=selected;
    process.env.FILES_S3_BUCKET="next-private-fixture"; process.env.FILES_S3_UPLOADS_PREFIX="other/uploads";
    for(const f of [sf,lf,of]) assert.equal((await h.call("rec","GET",f.contentUrl)).status,200,`${selected} reading ${f.id}`);
  }
  assert.deepEqual(await rows("select id,provider,storage_key from patient_documents where id=any($1::text[]) order by id",[[sf.id,lf.id,of.id]]),before);
  process.env.FILES_STORAGE="s3"; process.env.FILES_S3_BUCKET=settings.FILES_S3_BUCKET;
  process.env.FILES_S3_UPLOADS_PREFIX=settings.FILES_S3_UPLOADS_PREFIX;
  process.env.FILES_S3_ENDPOINT="https://different.invalid";
  assert.equal((await h.call("rec","GET",sf.contentUrl)).status,409,"new endpoint cannot redirect historical reads");
  process.env.FILES_S3_ENDPOINT=settings.FILES_S3_ENDPOINT;
});

test("misconfiguration and redacted SDK failures do not serve uncertain uploads or delete their bytes",async()=>{
  const count=(await rows("select count(*)::int n from patient_documents"))[0].n;
  process.env.FILES_S3_SECRET_ACCESS_KEY="";
  assert.equal((await upload()).status,503);
  assert.equal((await rows("select count(*)::int n from patient_documents"))[0].n,count);
  process.env.FILES_S3_SECRET_ACCESS_KEY=settings.FILES_S3_SECRET_ACCESS_KEY;
  for(const mode of ["denied","after-write","hang"]) {
    s3.mode=mode;
    const r=await upload(); assert.equal(r.status,503);
    assert.ok(!/DO-NOT-LOG|secret|Authorization|fixture.invalid/.test(JSON.stringify(r.data)));
    const [failed]=await rows("select * from patient_documents where status='failed' order by created_at desc limit 1");
    assert.equal((await h.call("rec","GET",`/files/${failed.id}`)).status,404);
    assert.equal((await h.call("rec","GET",`/files/${failed.id}/content`)).status,404);
    const loc=failed.storage_key.replace(/^s3:[a-f0-9]{64}:/,"");
    if(mode==="after-write"){
      const retained=s3.blobs.get(loc);
      assert.ok(retained); assert.equal(createHash("sha256").update(retained).digest("hex"),failed.digest);
      assert.equal(retained.length,failed.size);
    }
  }
  assert.ok(h.errors.every(e=>!/DO-NOT-LOG|Authorization|fixture.invalid/.test(e.stack)));
  s3.mode=""; const f=await approvedUpload();
  assert.equal((await h.call("rec","GET",f.contentUrl)).status,200,"retry creates a separate safe file");
  assert.equal(s3.calls.filter(c=>c.name==="DeleteObjectCommand").length,0);
});

test("interrupted staging metadata stays hidden and immutable, while migrations retain all file guards",async()=>{
  const f=await approvedUpload();
  const [current]=await rows("select * from patient_documents where id=$1",[f.id]);
  // Crash before the final transaction: model its durable staging row.
  const id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  await rows(`insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key,digest,registry_version,scan_state,status)
    values($1,'p1','c1','rec','interrupted.pdf','application/pdf',$2,'s3',$3,$4,1,'pending','staging')`,
    [id,PDF.length,current.storage_key.replace(f.id,id),current.digest]);
  assert.equal((await h.call("rec","GET",`/files/${id}`)).status,404);
  assert.equal((await h.call("sa","POST",`/files/${id}/approve`,{digest:current.digest,reviewed:true})).status,404);
  await assert.rejects(rows("update patient_documents set storage_key='new-key' where id=$1",[id]),/immutable/);
  assert.equal((await rows(`select count(*)::int n from pg_trigger where tgrelid='patient_documents'::regclass
    and tgname in ('erased_asset_reference_guard','erased_staff_reference_guard','private_file_identity_guard')`))[0].n,3);
});
