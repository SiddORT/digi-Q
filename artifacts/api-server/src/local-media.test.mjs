import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import express from "express";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

let h, api, server, origin, folder;
const bundle = resolve(import.meta.dirname, `.media-test-${process.pid}.mjs`);
before(async () => {
  folder = await mkdtemp(join(tmpdir(), "digiq-media-test-"));
  h = await createQueueHarness({ empty: true });
  await h.control.query(queueFixtureSql);
  globalThis.mediaTestDb = h.db;
  await build({ stdin: { contents: 'export * from "./routes/logos"; export * from "./lib/local-media"; export * from "./lib/logo-bytes"; export { errors } from "./lib/http";', resolveDir: import.meta.dirname }, outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "fixture", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "fixture" }));
      b.onResolve({ filter: /\/lib\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
      b.onResolve({ filter: /\/lib\/native-auth$/ }, () => ({ path: "rate", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path === "db" ? `export * from "${resolve(import.meta.dirname, "../../../lib/db/src/schema/core.ts")}";export const db=globalThis.mediaTestDb;` : path === "auth" ? `export async function requireUser(req){ if(!req.get("x-test-user")) throw Object.assign(Error("Sign in"),{status:401});return {id:req.get("x-test-user"),role:"superAdmin"};}` : "export async function consumeRateLimit(){}", loader: "ts", resolveDir: import.meta.dirname }));
    }}] });
  // Test-process-only configuration; never mutates workspace or published settings.
  process.env.MEDIA_STORAGE = "local";
  process.env.MEDIA_ROOT = folder;
  process.env.MEDIA_URL = "/test-media";
  api = await import(bundle);
  await api.initializeMedia();
  const app = express();
  app.use(express.json());
  app.use("/api", api.logosRouter);
  app.use("/test-media", api.localMediaRouter);
  app.use(api.errors);
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (h) await h.close(); if (folder) await rm(folder, { recursive: true, force: true }); await rm(bundle, { force: true }); delete globalThis.mediaTestDb; });
const request = (path, method = "GET", body, user = "owner", type = "application/json") => fetch(origin + path, { method, headers: { ...(user ? { "x-test-user": user } : {}), "Content-Type": type }, body: body === undefined ? undefined : type === "application/json" ? JSON.stringify(body) : body });
const reserve = async () => (await request("/api/management/logos", "POST", { name: "logo.png", size: 100, contentType: "image/png" })).json();
test("local upload, preview, completion and CID bytes persist without object storage", async () => {
  const bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: "blue" } }).png().toBuffer();
  const item = await reserve();
  assert.equal((await request(item.uploadUrl, "PUT", bytes, "stranger", "image/png")).status, 404);
  assert.equal((await request(item.uploadUrl, "PUT", bytes, "", "image/png")).status, 401);
  assert.equal((await request(item.uploadUrl, "PUT", bytes, "owner", "image/png")).status, 204);
  assert.equal((await request(item.uploadUrl, "PUT", bytes, "owner", "image/png")).status, 409);
  const result = await (await request(`/api/management/logos/${item.id}/complete`, "POST", {})).json();
  const response = await request(result.logoUrl);
  assert.equal(response.status, 200);
  assert.ok(response.url.includes("/test-media/"));
  const output = Buffer.from(await response.arrayBuffer());
  assert.equal((await sharp(output).metadata()).format, "png");
  assert.deepEqual(await api.loadLogoBytes(result.logoUrl), output);
  await api.initializeMedia();
  assert.deepEqual(await api.loadLogoBytes(result.logoUrl), output);
});
test("invalid, oversize and expired uploads cannot create public files", async () => {
  const item = await reserve(), initial = await readdir(folder);
  assert.equal((await request(item.uploadUrl, "PUT", Buffer.from("not a png"), "owner", "image/png")).status, 400);
  assert.equal((await request(item.uploadUrl, "PUT", Buffer.alloc(2097153), "owner", "image/png")).status, 413);
  assert.equal((await request(`/api/management/logos/${item.id}/complete`, "POST", {})).status, 409);
  await h.control.query("update settings set data=jsonb_set(data,'{expiresAt}','0') where id=$1", [`logo:${item.id}`]);
  assert.equal((await request(item.uploadUrl, "PUT", Buffer.from("x"), "owner", "image/png")).status, 409);
  assert.deepEqual(await readdir(folder), initial);
});
test("configuration and file reads reject traversal and symlink targets", async () => {
  assert.equal(api.mediaConfig({}).driver, "object");
  assert.throws(() => api.mediaConfig({ MEDIA_STORAGE: "unknown" }));
  assert.throws(() => api.mediaConfig({ MEDIA_STORAGE: "local", MEDIA_ROOT: "relative" }));
  assert.throws(() => api.mediaConfig({ MEDIA_STORAGE: "local", MEDIA_ROOT: folder, MEDIA_URL: "/api" }));
  await assert.rejects(api.readLocalLogo("../server.env"));
  const key = "00000000-0000-0000-0000-000000000000.png";
  await symlink("/etc/hosts", join(folder, key));
  await assert.rejects(api.readLocalLogo(key));
});