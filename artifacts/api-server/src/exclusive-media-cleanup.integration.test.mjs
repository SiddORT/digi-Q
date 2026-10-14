import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

test("exclusive logo cleanup verifies absence, waits for expiry, preserves shared files and fails closed", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "staff-media-fixture-"));
  const root = join(scratch, "media");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(root);
  const old = { storage: process.env.MEDIA_STORAGE, root: process.env.MEDIA_ROOT };
  process.env.MEDIA_STORAGE = "local"; process.env.MEDIA_ROOT = root;
  const bundle = join(import.meta.dirname, `.staff-media-${process.pid}.mjs`);
  try {
    await build({ entryPoints: [resolve(import.meta.dirname, "lib/exclusive-media-cleanup.ts")],
      outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external" });
    const api = await import(bundle);
    const bytes = Buffer.from("fictional staff photo fixture");
    const key = `${randomUUID()}.png`, path = join(root, key);
    await writeFile(path, bytes);
    const job = { provider: "local", key, configuration: api.logoStorageConfiguration("local"), notBefore: 100 };
    assert.deepEqual(await api.removeExclusiveLogo(job, async () => false, 99),
      { state: "pending", reason: "UPLOAD_NOT_EXPIRED" });
    assert.deepEqual(await api.removeExclusiveLogo(job, undefined, 101),
      { state: "pending", reason: "REFERENCE_PRESENT" }, "no implicit claim that an uploader owns a file");
    assert.deepEqual(await api.removeExclusiveLogo(job, async () => true, 101),
      { state: "pending", reason: "REFERENCE_PRESENT" });
    assert.deepEqual(await readFile(path), bytes);
    assert.deepEqual(await api.removeExclusiveLogo({ ...job, configuration: "0".repeat(64) }, async () => false, 101),
      { state: "pending", reason: "STORAGE_CONFIGURATION_CHANGED" });
    assert.deepEqual(await api.removeExclusiveLogo({ ...job, key: "../outside" }, async () => false, 101),
      { state: "pending", reason: "INVALID_JOB" });
    assert.deepEqual(await api.removeExclusiveLogo(job, async () => { throw new Error("private path"); }, 101),
      { state: "pending", reason: "STORAGE_UNAVAILABLE" });
    assert.deepEqual(await readFile(path), bytes);
    assert.deepEqual(await api.removeExclusiveLogo(job, async () => false, 101), { state: "complete" });
    await assert.rejects(readFile(path), { code: "ENOENT" });
    assert.deepEqual(await api.removeExclusiveLogo(job, async () => false, 101), { state: "complete" }, "retry proves absence again");
    const linkedRoot = join(scratch, "linked-root");
    await symlink(root, linkedRoot);
    process.env.MEDIA_ROOT = linkedRoot;
    await writeFile(path, bytes);
    assert.deepEqual(await api.removeExclusiveLogo({ ...job, configuration: api.logoStorageConfiguration("local") }, async () => false, 101),
      { state: "pending", reason: "STORAGE_UNAVAILABLE" });
    assert.deepEqual(await readFile(path), bytes);
  } finally {
    for (const [name, value] of [["MEDIA_STORAGE", old.storage], ["MEDIA_ROOT", old.root]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await rm(bundle, { force: true });
    await rm(scratch, { recursive: true, force: true });
  }
});

test("object cleanup uses verified existence and never treats a provider or probe failure as completion", async () => {
  const bundle = join(import.meta.dirname, `.staff-media-object-${process.pid}.mjs`);
  globalThis.staffMediaObjectFixture = { mode: "present", removed: false };
  try {
    await build({ entryPoints: [resolve(import.meta.dirname, "lib/exclusive-media-cleanup.ts")],
      outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
      plugins: [{ name: "disposable-object-transport", setup(b) {
        b.onLoad({ filter: /lib\/objectStorage\.ts$/ }, () => ({ loader: "ts", contents: `
          export class ObjectNotFoundError extends Error {}
          export class ObjectStorageService {
            getPrivateObjectDir(){return "/fictional-bucket/private";}
            async getObjectEntityFile(){
              const h=globalThis.staffMediaObjectFixture;
              if(h.mode==="missing")throw new ObjectNotFoundError();
              if(h.mode==="unavailable")throw new Error("private provider diagnostics");
              return {
                async delete(){
                  if(h.mode==="delete-failed")throw new Error("private provider diagnostics");
                  h.removed=true;
                },
                async exists(){
                  if(h.mode==="probe-failed")throw new Error("private provider diagnostics");
                  return [h.mode==="sticky" || !h.removed];
                }
              };
            }
          }` }));
      } }] });
    const api = await import(bundle);
    const job = { provider: "object", key: `/objects/uploads/${randomUUID()}-validated.png`,
      configuration: api.logoStorageConfiguration("object"), notBefore: 0 };
    for (const mode of ["unavailable", "delete-failed", "probe-failed"]) {
      globalThis.staffMediaObjectFixture = { mode, removed: false };
      assert.deepEqual(await api.removeExclusiveLogo(job, async () => false),
        { state: "pending", reason: "STORAGE_UNAVAILABLE" });
    }
    globalThis.staffMediaObjectFixture = { mode: "sticky", removed: false };
    assert.deepEqual(await api.removeExclusiveLogo(job, async () => false),
      { state: "pending", reason: "OBJECT_STILL_PRESENT" });
    for (const mode of ["present", "missing"]) {
      globalThis.staffMediaObjectFixture = { mode, removed: false };
      assert.deepEqual(await api.removeExclusiveLogo(job, async () => false), { state: "complete" });
    }
  } finally {
    delete globalThis.staffMediaObjectFixture;
    await rm(bundle, { force: true });
  }
});
