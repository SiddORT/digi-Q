import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { fakeS3 } from "./test-support/s3-fixture.mjs";

let tools, temp, bundle;
const env = {
  FILES_S3_BUCKET:"private-fixture", FILES_S3_REGION:"us-east-1",
  FILES_S3_ENDPOINT:"https://s3.fixture.invalid", FILES_S3_UPLOADS_PREFIX:"uploads",
  FILES_S3_FORCE_PATH_STYLE:"true", FILES_S3_CREDENTIALS:"static",
  FILES_S3_ACCESS_KEY_ID:"fixture-id", FILES_S3_SECRET_ACCESS_KEY:"fixture-secret",
};
const key = () => `private/clinics/c1/patients/p1/documents/${randomUUID()}.pdf`;
const bytes = Buffer.from("%PDF-fixture");
before(async () => {
  temp = await mkdtemp(join(tmpdir(), "s3-contract-"));
  // External SDK resolves at the API package boundary; no network requests.
  const outfile = new URL(`../.s3-contract-${process.pid}.mjs`, import.meta.url);
  const { fileURLToPath } = await import("node:url");
  await build({stdin:{contents:`
    export * from "./features/files/s3-storage";
    export * from "./features/files/s3-config";
    export {privateStorageConfig,mediaConfig} from "./lib/storage-config";
  `, resolveDir:import.meta.dirname}, bundle:true, platform:"node", format:"esm", outfile:fileURLToPath(outfile),
    external:["@aws-sdk/client-s3"], logLevel:"error"});
  tools = await import(outfile);
  bundle = fileURLToPath(outfile);
});
after(async () => { await rm(temp, {recursive:true,force:true}); if(bundle) await rm(bundle,{force:true}); });
const cfg = overrides => tools.s3FileConfig({...env,...overrides});
const adapter = (fake, overrides, timeout = 40) => tools.createS3FileAdapter(cfg(overrides), fake.factory, timeout);

test("S3 is opt-in, disabled/malformed settings never create a client and logos remain separate", () => {
  assert.equal(tools.privateStorageConfig({MEDIA_STORAGE:"object",PRIVATE_OBJECT_DIR:"/old-bucket/private",FILES_S3_ENDPOINT:"invalid"}).driver,"object");
  assert.equal(tools.mediaConfig({...env,FILES_STORAGE:"s3"}).driver,"object");
  assert.equal(tools.privateStorageConfig({...env,FILES_STORAGE:"s3"}).driver,"s3");
  assert.equal(cfg({FILES_S3_ENDPOINT:""}).endpoint, undefined);
  assert.equal(cfg({FILES_S3_CREDENTIALS:"role",FILES_S3_ACCESS_KEY_ID:"",FILES_S3_SECRET_ACCESS_KEY:""}).credentials, undefined);
  for(const patch of [
    {FILES_S3_BUCKET:""}, {FILES_S3_BUCKET:"../secret"}, {FILES_S3_BUCKET:"192.168.0.1"},
    {FILES_S3_BUCKET:"bucket.-invalid"}, {FILES_S3_SECRET_ACCESS_KEY:"secret\ninjected"},
    {FILES_S3_REGION:""}, {FILES_S3_REGION:"us/east"}, {FILES_S3_ENDPOINT:"http://insecure.invalid"},
    {FILES_S3_ENDPOINT:"https://user:secret@host.invalid"}, {FILES_S3_ENDPOINT:"https://host.invalid/path"},
    {FILES_S3_ENDPOINT:"https://host.invalid?token=secret"}, {FILES_S3_UPLOADS_PREFIX:""},
    {FILES_S3_UPLOADS_PREFIX:"../uploads"}, {FILES_S3_UPLOADS_PREFIX:"uploads//bad"},
    {FILES_S3_UPLOADS_PREFIX:"/uploads"}, {FILES_S3_FORCE_PATH_STYLE:""}, {FILES_S3_FORCE_PATH_STYLE:"yes"},
    {FILES_S3_CREDENTIALS:""}, {FILES_S3_SECRET_ACCESS_KEY:""}, {FILES_S3_CREDENTIALS:"role"},
  ]) assert.throws(()=>cfg(patch),error => error.status===503 && !error.message.includes("secret"),JSON.stringify(Object.keys(patch)));
  assert.throws(()=>tools.privateStorageConfig({...env,FILES_STORAGE:"typo"}));
  assert.throws(()=>tools.mediaConfig({MEDIA_STORAGE:"s3"}));
});

test("upload/head/read/delete contract is private, create-only, bounded and authorizer-gated", async () => {
  const fake = fakeS3(), a = adapter(fake), locator = a.locator(key());
  await a.upload(locator, bytes, "application/pdf");
  const put = fake.calls[0].input;
  assert.equal(put.IfNoneMatch,"*"); assert.equal(put.CacheControl,"private, no-store");
  assert.equal(put.ACL,undefined); assert.equal(put.ContentLength,bytes.length);
  assert.equal(put.ChecksumSHA256, (await import("node:crypto")).createHash("sha256").update(bytes).digest("base64"));
  assert.deepEqual(await a.head(locator),{size:bytes.length,contentType:"application/pdf"});
  assert.deepEqual(await a.read(locator),bytes);
  await assert.rejects(a.upload(locator,Buffer.from("replace"),"text/plain"),/Private file storage is unavailable/);
  const calls = fake.calls.length;
  await assert.rejects(a.deleteIfAuthorized(locator,async()=>false),e=>e.status===403);
  await assert.rejects(a.deleteIfAuthorized(locator,async()=>{throw Error("authorization lookup failed");}));
  assert.equal(fake.calls.length,calls,"authorization fails before touching provider");
  await a.deleteIfAuthorized(locator,async()=>true);
  await a.deleteIfAuthorized(locator,async()=>true); // missing object deletion is idempotent
  await assert.rejects(a.read(locator),/unavailable/);
  assert.equal(fake.destroyed,fake.calls.length);
  assert.ok(!/fixture-secret|fixture-id|https:/.test(locator));
});

test("saved bucket and prefix survive changed defaults; endpoint/region mismatch fails closed", async () => {
  const fake=fakeS3(), original=adapter(fake), locator=original.locator(key());
  await original.upload(locator,bytes,"application/pdf");
  const next=adapter(fake,{FILES_S3_BUCKET:"next-bucket",FILES_S3_UPLOADS_PREFIX:"next/uploads"});
  assert.deepEqual(await next.read(locator),bytes);
  await assert.rejects(next.upload(locator,bytes,"application/pdf"),/selected storage/);
  for(const patch of [{FILES_S3_ENDPOINT:"https://other.invalid"}, {FILES_S3_REGION:"eu-west-1"}])
    await assert.rejects(adapter(fake,patch).read(locator), /locator is unavailable/);
  const repeated=adapter(fake,{FILES_S3_UPLOADS_PREFIX:"my/private/clinics/retained"});
  const repeatedLocator=repeated.locator(key());
  await repeated.upload(repeatedLocator,bytes,"application/pdf");
  assert.deepEqual(await repeated.read(repeatedLocator),bytes);
  const calls=fake.calls.length;
  for(const locator of ["https://evil.invalid/x","s3:bad",original.locator(key()).replace("private/clinics","../private/clinics"),
    original.locator(key()).replace("/uploads/","/up%2Floads/")])
    await assert.rejects(original.read(locator));
  for(const k of ["../../secret","private/clinics/c1/patients/p1/documents/name.pdf",key()+"?x=y"])
    assert.throws(()=>original.locator(k));
  assert.equal(fake.calls.length,calls);
});

test("provider failures, missing/truncated/oversize streams and timeouts expose only safe errors", async () => {
  const fake=fakeS3(), a=adapter(fake), locator=a.locator(key());
  await a.upload(locator,bytes,"application/pdf");
  for(const mode of ["denied","truncated","oversize","overrun","hang","slow-body"]) {
    fake.mode=mode;
    await assert.rejects(a.read(locator),e=>e.status===503 && !/DO-NOT-LOG|secret|private.invalid|Authorization/.test(e.stack));
  }
  for(const operation of ["upload","head","deleteIfAuthorized"]) {
    fake.mode="hang";
    const args=operation==="upload"?[a.locator(key()),bytes,"application/pdf"]:
      operation==="head"?[locator]:[locator,async()=>true];
    await assert.rejects(a[operation](...args),e=>e.status===503);
  }
  assert.ok(fake.calls.some(c=>c.abortSignal.aborted));
  fake.mode=""; assert.deepEqual(await a.read(locator),bytes,"timeouts do not poison later operations");
  const badFactory=tools.createS3FileAdapter(cfg(),()=>{throw Error("DO-NOT-LOG fixture-secret credential failure");});
  await assert.rejects(badFactory.head(locator),e=>e.status===503 && !/DO-NOT-LOG|fixture-secret/.test(e.stack));
});

test("uncertain writes reconcile by head/digest without overwrite or implicit deletion", async () => {
  const fake=fakeS3(), a=adapter(fake), locator=a.locator(key());
  fake.mode="after-write";
  await assert.rejects(a.upload(locator,bytes,"application/pdf"),/unavailable/);
  fake.mode="";
  assert.equal((await a.head(locator)).size,bytes.length);
  assert.deepEqual(await a.read(locator),bytes);
  await assert.rejects(a.upload(locator,bytes,"application/pdf"),/unavailable/);
  assert.equal(fake.calls.filter(c=>c.name==="DeleteObjectCommand").length,0);
});

test("real AWS SDK signs and serializes against an in-process HTTP handler only", async () => {
  const requests=[];
  const a=tools.createS3FileAdapter(cfg(), config=>new S3Client({
    ...tools.s3ClientOptions(config),
    requestHandler:{destroy(){},async handle(request){
      requests.push(request);
      if(request.method==="GET") return {response:{statusCode:200,headers:{"content-length":String(bytes.length)},body:Readable.from([bytes])}};
      return {response:{statusCode:200,headers:request.method==="HEAD"?{"content-length":String(bytes.length),"content-type":"application/pdf"}:{},body:Readable.from([])}};
    }},
  }));
  const locator=a.locator(key());
  await a.upload(locator,bytes,"application/pdf"); await a.head(locator); assert.deepEqual(await a.read(locator),bytes);
  await a.deleteIfAuthorized(locator,async()=>true);
  assert.deepEqual(requests.map(r=>r.method),["PUT","HEAD","GET","DELETE"]);
  assert.ok(requests.every(r=>r.protocol==="https:" && r.hostname==="s3.fixture.invalid"));
  assert.match(requests[0].path,/^\/private-fixture\/uploads\/private\/clinics\//);
  assert.match(requests[0].headers.authorization,/AWS4-HMAC-SHA256 Credential=fixture-id\//);
  assert.equal(requests[0].headers["if-none-match"],"*");
  assert.equal(requests[0].headers["x-amz-acl"],undefined);
  const options=tools.s3ClientOptions(cfg());
  assert.equal(options.ignoreConfiguredEndpointUrls,true,"ambient SDK endpoint settings cannot redirect files");
  assert.equal(options.maxAttempts,1);
  assert.equal(options.followRegionRedirects,false);
});
