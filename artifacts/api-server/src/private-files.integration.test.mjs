// Real HTTP handlers, migrations and local disk. Object API is an in-memory
// provider double: no workspace database, network provider or real file moves.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
import sharp from "sharp";

let h, temp, root;
const PDF = Buffer.from("%PDF-1.4\nfixture-only\n%%EOF\n");
const SHA = b => createHash("sha256").update(b).digest("hex");
const rows = async (text, args) => (await h.pg.query(text, args)).rows;
const url = (extra = "") => "/files?clinicId=c1&patientId=p1&purpose=documents&name=report.pdf" + extra;
async function upload(extra = "", actor = "rec", bytes = PDF) {
  const r = await h.call(actor, "POST", url(extra), bytes);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}
async function approve(file) {
  const r = await h.call("sa", "POST", `/files/${file.id}/approve`, { digest: file.digest, reviewed: true });
  assert.equal(r.status, 200, JSON.stringify(r.data));
}
before(async () => {
  temp = await mkdtemp(join(tmpdir(), "private-files-"));
  root = join(temp, "uploads");
  process.env.MEDIA_STORAGE = "local";
  process.env.MEDIA_ROOT = root;
  process.env.PRIVATE_OBJECT_DIR = "/fixture-bucket/private";
  h = await createFeatureHarness({ files: true });
  await seedFeatureFixtures(h.pg);
});
after(async () => { await h?.close(); await rm(temp, { recursive: true, force: true }); });

test("local files use generated private hierarchy, quarantine and exact digest approval", async () => {
  const file = await upload("&ignoredPath=../../public", "rec");
  assert.equal(file.status, "quarantined");
  assert.equal(file.digest, SHA(PDF));
  assert.equal(file.contentType, "application/pdf");
  assert.equal(file.storageKey, undefined);
  const [stored] = await rows("select * from patient_documents where id=$1", [file.id]);
  assert.match(stored.storage_key, /^private\/clinics\/c1\/patients\/p1\/documents\/[a-f0-9-]+\.pdf$/);
  assert.deepEqual(await readFile(join(root, stored.storage_key)), PDF);
  assert.equal((await h.call("rec", "GET", file.contentUrl)).status, 404);
  assert.equal((await h.call("rec", "GET", `/patient-documents/${file.id}`)).status, 404);
  assert.equal((await h.call("adm", "POST", `/files/${file.id}/approve`, { digest: file.digest, reviewed: true })).status, 403);
  assert.equal((await h.call("sa", "POST", `/files/${file.id}/approve`, { digest: "0".repeat(64), reviewed: true })).status, 409);
  await approve(file);
  for (const path of [file.contentUrl, `/patient-documents/${file.id}`]) {
    const r = await h.call("patu", "GET", path);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, PDF);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.match(r.headers.get("content-disposition"), /^attachment;/);
  }
  assert.deepEqual(await readdir(join(root, "private/staging")), []);
});

test("tenant, patient, visit-based doctor and permission-policy authority is rechecked", async () => {
  const file = await upload();
  await approve(file);
  for (const actor of [null, "adm2", "rec3", "pat3u", "doc3u"]) {
    const r = await h.call(actor, "GET", file.contentUrl);
    assert.ok([401, 404].includes(r.status), `${actor}: ${r.status}`);
  }
  assert.equal((await h.call("docu", "GET", file.contentUrl)).status, 200);
  assert.equal((await h.call("patu", "POST", url(), PDF)).status, 403);
  assert.equal((await h.call("rec3", "POST", url(), PDF)).status, 404);
  assert.equal((await h.call("rec", "POST", "/files?clinicId=c3&patientId=p1&purpose=medical&name=x.pdf", PDF)).status, 404);
  await rows(`insert into settings(id,data) values ('permission-policy','{"revision":1,"denied":["receptionist:patients:read","clinicAdmin:patients:delete"]}')`);
  assert.equal((await h.call("rec", "GET", file.contentUrl)).status, 403);
  assert.equal((await h.call("adm", "DELETE", `/files/${file.id}`)).status, 403);
  await rows("delete from settings where id='permission-policy'");
  // A registered profile alone must not confer document authority.
  await rows(`insert into patients(id,clinic_id,branch_id,data) values('registered-only','c1','b1','{"fullName":"Fictional"}')`);
  assert.equal((await h.call("docu", "POST", "/files?clinicId=c1&patientId=registered-only&purpose=documents&name=x.pdf", PDF)).status, 404);
});

test("cross-clinic patient files retain independent clinic scopes", async () => {
  const file = await h.call("adm", "POST", "/files?clinicId=c2&patientId=p1&purpose=medical&name=x.pdf", PDF);
  assert.equal(file.status, 201);
  await approve(file.data);
  assert.equal((await h.call("rec", "GET", file.data.contentUrl)).status, 404);
  assert.equal((await h.call("patu", "GET", file.data.contentUrl)).status, 200);
  assert.equal((await h.call("docu", "GET", file.data.contentUrl)).status, 200);
  await rows(`insert into settings(id,data) values('custom-roles',
    '{"revision":1,"roles":[{"id":"limited-files","name":"Limited","baseRole":"clinicAdmin","denied":["patients:read"]}],"bindings":[{"userId":"adm","roleId":"limited-files","clinicId":"c1"}]}')`);
  assert.equal((await h.call("adm", "GET", file.data.contentUrl)).status, 200, "unrestricted clinic remains readable");
  const c1 = await upload();
  assert.equal((await h.call("adm", "GET", `/files/${c1.id}`)).status, 403, "server-owned file clinic controls custom role");
  await rows("delete from settings where id='custom-roles'");
});

test("soft delete hides metadata, legacy links and content; restoration verifies retained bytes", async () => {
  const file = await upload(); await approve(file);
  assert.equal((await h.call("rec2", "DELETE", `/files/${file.id}`)).status, 403);
  assert.equal((await h.call("rec", "DELETE", `/patient-documents/${file.id}`)).status, 204);
  for (const path of [`/files/${file.id}`, file.contentUrl, `/patient-documents/${file.id}`])
    assert.equal((await h.call("rec", "GET", path)).status, 404);
  const [stored] = await rows("select storage_key from patient_documents where id=$1", [file.id]);
  assert.deepEqual(await readFile(join(root, stored.storage_key)), PDF);
  assert.equal((await h.call("rec3", "POST", `/files/${file.id}/restore`)).status, 404);
  assert.equal((await h.call("rec2", "POST", `/files/${file.id}/restore`)).status, 403);
  assert.equal((await h.call("adm", "POST", `/files/${file.id}/restore`)).status, 200);
  assert.equal((await h.call("rec", "GET", file.contentUrl)).status, 200);
  assert.equal((await h.call("adm", "POST", `/files/${file.id}/restore`)).status, 409);
  await h.call("rec", "DELETE", `/files/${file.id}`);
  await writeFile(join(root, stored.storage_key), Buffer.alloc(PDF.length, 65));
  assert.equal((await h.call("rec", "POST", `/files/${file.id}/restore`)).status, 409, "same-size tampering");
  await rm(join(root, stored.storage_key));
  assert.equal((await h.call("rec", "POST", `/files/${file.id}/restore`)).status, 409, "missing retained bytes");
});

test("restoring quarantined files never approves them", async () => {
  const file = await upload();
  assert.equal((await h.call("rec", "DELETE", `/files/${file.id}`)).status, 204);
  const r = await h.call("rec", "POST", `/files/${file.id}/restore`);
  assert.equal(r.status, 200); assert.equal(r.data.status, "quarantined");
  assert.equal((await h.call("rec", "GET", file.contentUrl)).status, 404);
});

test("doctor files enforce ownership, purpose and clinic assignment", async () => {
  const path = "/files?clinicId=c1&doctorId=d1&purpose=credentials&name=license.pdf";
  for (const actor of ["rec", "adm2", "doc3u", "patu"])
    assert.equal((await h.call(actor, "POST", path, PDF)).status, 404);
  const r = await h.call("docu", "POST", path, PDF);
  assert.equal(r.status, 201); await approve(r.data);
  assert.equal((await h.call("adm", "GET", r.data.contentUrl)).status, 200);
  assert.equal((await h.call("rec", "GET", r.data.contentUrl)).status, 404);
  const [stored] = await rows("select storage_key from patient_documents where id=$1", [r.data.id]);
  assert.match(stored.storage_key, /\/doctors\/d1\/credentials\//);
  assert.equal((await h.call("docu", "POST", path.replace("credentials", "medical"), PDF)).status, 400);
  assert.equal((await h.call("docu", "POST", path.replace("c1", "c3"), PDF)).status, 404);
});

test("malicious type, purpose, filename, traversal and size never select a disk path", async () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from("MZnot-an-image"), Buffer.from("<svg onload='alert(1)'/>"), Buffer.from("<!doctype html><html/>"), Buffer.from([0, 255, 127])])
    assert.equal((await h.call("rec", "POST", url(), bytes, { "content-type": "image/png" })).status, 400);
  assert.equal((await h.call("rec", "POST", url(), Buffer.alloc(10 * 1024 * 1024 + 1, 65))).status, 413);
  assert.equal((await h.call("rec", "POST", url().replace("purpose=documents", "purpose=credentials"), PDF)).status, 400);
  assert.equal((await h.call("rec", "POST", url().replace("purpose=documents", "purpose=../../public"), PDF)).status, 400);
  assert.equal((await h.call("rec", "POST", url().replace("patientId=p1", "patientId=..%5C..%5Csecret"), PDF)).status, 404);
  assert.equal((await h.call("rec", "POST", url() + "&doctorId=d1", PDF)).status, 400);
  const file = await upload("&name=" + encodeURIComponent("../CON:\"x'\\\r\n.pdf"));
  assert.ok(!/[\\/\r\n"<>:*?]/.test(file.name));
});

test("symlinks in hierarchy and final content are rejected; failed writes stay hidden", async () => {
  const file = await upload(); await approve(file);
  const [row] = await rows("select storage_key from patient_documents where id=$1", [file.id]);
  const target = join(root, row.storage_key), other = join(temp, "other.pdf");
  await writeFile(other, PDF); await rm(target); await symlink(other, target);
  assert.equal((await h.call("rec", "GET", file.contentUrl)).status, 409);
  await rm(target);
  const linked = join(temp, "linked"); await mkdir(linked);
  const prior = process.env.MEDIA_ROOT;
  const badRoot = join(linked, "uploads");
  await symlink(root, badRoot); process.env.MEDIA_ROOT = badRoot;
  const r = await h.call("rec", "POST", url(), PDF);
  assert.equal(r.status, 409);
  process.env.MEDIA_ROOT = prior;
  const [failed] = await rows("select id,status from patient_documents where status='failed' order by created_at desc limit 1");
  assert.equal(failed.status, "failed");
  assert.equal((await h.call("rec", "GET", `/files/${failed.id}`)).status, 404);
  assert.deepEqual(await readFile(other), PDF);
});

test("historical local and object links retain their saved provider despite driver changes", async () => {
  const id = randomUUID(), key = randomUUID();
  await mkdir(join(root, "private-documents"), { mode: 0o700 });
  await writeFile(join(root, "private-documents", key), PDF, { mode: 0o600 });
  await rows(`insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key)
    values($1,'p1','c1','rec','old.pdf','application/pdf',$2,'local',$3)`, [id, PDF.length, key]);
  process.env.MEDIA_STORAGE = "object";
  assert.equal((await h.call("rec", "GET", `/patient-documents/${id}`)).status, 200);
  const oid = randomUUID(), okey = randomUUID();
  h.blobs.set(`/fixture-bucket/private/patient-documents/${okey}`, PDF);
  await rows(`insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key)
    values($1,'p1','c1','rec','old-object.pdf','application/pdf',$2,'object',$3)`, [oid, PDF.length, okey]);
  process.env.MEDIA_STORAGE = "local";
  assert.equal((await h.call("rec", "GET", `/patient-documents/${oid}`)).status, 200);
  assert.equal((await h.call("rec", "DELETE", `/files/${id}`)).status, 204);
  assert.equal((await h.call("rec", "POST", `/files/${id}/restore`)).status, 200);
  // Historical deletions never recorded retained bytes and are not restorable.
  await rows("update patient_documents set status='deleted', deleted_from=null where id=$1", [oid]);
  assert.equal((await h.call("rec", "POST", `/files/${oid}/restore`)).status, 409);
});

test("new object locators pin the object prefix and survive a selected-driver change", async () => {
  process.env.MEDIA_STORAGE = "object";
  const file = await upload(); await approve(file);
  const [saved] = await rows("select storage_key from patient_documents where id=$1", [file.id]);
  assert.match(saved.storage_key, /^\/fixture-bucket\/private\/uploads\/private\/clinics\/c1\//);
  process.env.MEDIA_STORAGE = "local";
  process.env.PRIVATE_OBJECT_DIR = "/different-fixture-bucket/different-prefix";
  assert.equal((await h.call("rec", "GET", file.contentUrl)).status, 200);
  process.env.PRIVATE_OBJECT_DIR = "/fixture-bucket/private";
});

test("portable locator rules reject Windows reserved names, separators and traversal", async () => {
  const { fileKey, writeFileBytes, readFileBytes } = h.fileStorageTools;
  for (const id of ["CON", "nul", "LPT1", "a:b", "..", "../x", "a\\b", "x\0y", "a/b"])
    assert.throws(() => fileKey(id, "patients", "p1", "documents", randomUUID(), "application/pdf"));
  const key = fileKey("c1", "patients", "p1", "documents", randomUUID(), "application/pdf");
  assert.ok(!/[\\:*?"<>|]/.test(key));
  await writeFileBytes(key, PDF, "application/pdf");
  await assert.rejects(writeFileBytes(key, Buffer.from("replacement"), "text/plain"), /EEXIST/);
  assert.deepEqual(await readFileBytes({provider:"local", storageKey:key, registryVersion:1}), PDF, "atomic completion never overwrites");
  assert.deepEqual(await readdir(join(root, "private/staging")), []);
  await assert.rejects(readFileBytes({provider:"invalid", storageKey:key, registryVersion:1}), /Unknown file provider/);
  await assert.rejects(readFileBytes({provider:"local", storageKey:"../../secret", registryVersion:1}), /Invalid private locator/);
});

test("selected storage configuration validates local isolation without changing legacy media contracts", () => {
  const { privateStorageConfig, mediaConfig } = h.storageConfigTools;
  assert.equal(mediaConfig({MEDIA_STORAGE:"local", MEDIA_ROOT:temp}).root, temp, "legacy logo roots unchanged");
  for (const env of [
    {MEDIA_STORAGE:"bad"},
    {MEDIA_STORAGE:"local", MEDIA_ROOT:"relative/uploads"},
    {MEDIA_STORAGE:"local", MEDIA_ROOT:temp},
    {MEDIA_STORAGE:"local", MEDIA_ROOT:join(temp,"public/uploads")},
    {MEDIA_STORAGE:"local", MEDIA_ROOT:join(process.cwd(),"uploads"), NODE_ENV:"production"},
    {MEDIA_STORAGE:"object", PRIVATE_OBJECT_DIR:""},
  ]) assert.throws(() => privateStorageConfig(env));
  assert.equal(privateStorageConfig({MEDIA_STORAGE:"local", MEDIA_ROOT:root}).root, root);
});

test("registry constraints, erasure fences and anonymized uploader restoration stay enforced", async () => {
  const file = await upload(); await approve(file);
  await assert.rejects(rows("update patient_documents set digest=null where id=$1", [file.id]), /private_file_registry|immutable/);
  await assert.rejects(rows("update patient_documents set patient_id=null where id=$1", [file.id]), /private_file_entity|immutable/);
  await assert.rejects(rows("update patient_documents set size=10485761 where id=$1", [file.id]), /private_file_registry|immutable/);
  await assert.rejects(rows("update patient_documents set registry_version=0 where id=$1", [file.id]), /immutable/);
  await h.call("rec", "DELETE", `/files/${file.id}`);
  await rows("update patient_documents set uploaded_by=null,deleted_uploader=true where id=$1", [file.id]);
  assert.equal((await h.call("adm", "POST", `/files/${file.id}/restore`)).status, 200);
  assert.deepEqual((await rows("select uploaded_by,deleted_uploader from patient_documents where id=$1", [file.id]))[0], { uploaded_by: null, deleted_uploader: true });
  await h.call("adm", "DELETE", `/files/${file.id}`);
  // Disposable-only removal receipt allows the real immutable fence to apply.
  const receipt = randomUUID();
  await rows(`insert into staff_deletion_receipts(id,account_fingerprint,review_hash,state,file_count,verified_count,completed_at)
    values($1,$2,$3,'complete',0,0,now())`, [receipt, "a".repeat(64), "b".repeat(64)]);
  await rows("insert into staff_erased_assets(asset_fingerprint,operation_id) values($1,$2)", [SHA(Buffer.from(file.id)), receipt]);
  assert.equal((await h.call("adm", "POST", `/files/${file.id}/restore`)).status, 409);
});

test("deliberately published logos retain their separate upload and read policy", async () => {
  const bytes = await sharp({create:{width:8,height:8,channels:3,background:"blue"}}).png().toBuffer();
  const reserve = await h.call("sa", "POST", "/management/logos", {name:"logo.png",size:bytes.length,contentType:"image/png"});
  assert.equal(reserve.status, 200, JSON.stringify(reserve.data));
  assert.equal((await h.call("sa", "PUT", reserve.data.uploadUrl, bytes, {"content-type":"image/png"})).status, 204);
  const result = await h.call("sa", "POST", `/management/logos/${reserve.data.id}/complete`, {});
  assert.equal(result.status, 200, JSON.stringify(result.data));
  const publicRead = await h.call(null, "GET", result.data.logoUrl);
  assert.equal(publicRead.status, 200);
  assert.equal((await sharp(publicRead.data).metadata()).format, "png");
  const privateProbe = await fetch(h.base.replace(/\/api$/, "") + "/media/private/clinics/c1/patients/p1/documents/missing.pdf");
  assert.equal(privateProbe.status, 404);
});
