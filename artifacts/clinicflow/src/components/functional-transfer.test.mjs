// Runtime checks of the REAL generated client + customFetch (bundled), with fetch stubbed. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
// esbuild is a workspace tool dependency (api-server); resolve it from there.
const { build } = createRequire(resolve(root, "artifacts/api-server/package.json"))("esbuild");
async function load() {
  const dir = await mkdtemp(join(tmpdir(), "digiq-client-"));
  const out = join(dir, "client.mjs");
  await build({ stdin: { resolveDir: root, contents: `
      export { uploadPatientDocument, downloadPatientDocument, getListSavedViewsQueryKey } from "./lib/api-client-react/src/generated/api";` },
    outfile: out, bundle: true, platform: "node", format: "esm", logLevel: "error",
    // Only plain request functions are exercised; React Query hooks are stubbed out.
    plugins: [{ name: "no-react", setup(b) {
      b.onResolve({ filter: /^(react|@tanstack\/react-query)$/ }, a => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const useQuery=()=>{};export const useMutation=()=>{};export const useInfiniteQuery=()=>{};export const useSuspenseQuery=()=>{};export default {};" }));
    } }] });
  const mod = await import(out);
  return { mod, done: () => rm(dir, { recursive: true, force: true }) };
}
function stubFetch(respond) {
  const calls = []; const prev = globalThis.fetch;
  globalThis.fetch = async (input, init) => { calls.push({ input: String(input?.url ?? input), init }); return respond(); };
  return { calls, restore: () => { globalThis.fetch = prev; } };
}

test("upload sends the raw File bytes as application/octet-stream with name/clinic query", async () => {
  const { mod, done } = await load();
  const f = stubFetch(() => new Response(JSON.stringify({ id: "d1" }), { status: 201, headers: { "content-type": "application/json" } }));
  try {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "Lab report.pdf", { type: "application/pdf" });
    const res = await mod.uploadPatientDocument("p1", file, { name: "Lab report.pdf", clinicId: "c1" });
    assert.equal(res.id, "d1");
    const { input, init } = f.calls[0];
    assert.match(input, /\/api\/patients\/p1\/documents\?/); assert.match(input, /name=Lab(\+|%20)report\.pdf/); assert.match(input, /clinicId=c1/);
    assert.equal(init.method, "POST");
    assert.equal(init.body, file, "body is the File itself, not JSON or FormData");
    assert.equal(new Headers(init.headers).get("content-type"), "application/octet-stream");
  } finally { f.restore(); await done(); }
});

test("download with responseType blob returns a Blob of the exact bytes", async () => {
  const { mod, done } = await load();
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const f = stubFetch(() => new Response(bytes, { status: 200, headers: { "content-type": "image/png" } }));
  try {
    const blob = await mod.downloadPatientDocument("d1", { responseType: "blob" });
    assert.ok(blob instanceof Blob);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
    assert.equal(f.calls[0].init.method, "GET");
    // Even a text/plain document must stay a Blob when blob is requested (no auto text parsing).
    const t = stubFetch(() => new Response("hello", { status: 200, headers: { "content-type": "text/plain" } }));
    try { assert.ok((await mod.downloadPatientDocument("d2", { responseType: "blob" })) instanceof Blob); } finally { t.restore(); }
  } finally { f.restore(); await done(); }
});

test("saved-view cache key includes the signed-in user and role", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../lib/listing-views.ts", import.meta.url), "utf8");
  assert.match(s, /savedViewsQueryKey = \(tableKey: string, userId: string \| undefined, role: string \| undefined\) =>\s*\[\.\.\.api\.getListSavedViewsQueryKey\(\{ tableKey \}\), userId \|\| "anon", role \|\| "none"\]/);
  assert.match(s, /queryKey: savedViewsQueryKey\(tableKey, userId, role\)/);
  assert.doesNotMatch(s, /queryKey: api\.getListSavedViewsQueryKey\(params\)/);
  const { mod, done } = await load();
  try {
    const base = mod.getListSavedViewsQueryKey({ tableKey: "appointments" });
    const a = [...base, "u1", "receptionist"], b = [...base, "u2", "receptionist"];
    assert.notDeepEqual(a, b);
    assert.deepEqual(a.slice(0, base.length), base, "invalidating the base key still matches by prefix");
  } finally { await done(); }
});
