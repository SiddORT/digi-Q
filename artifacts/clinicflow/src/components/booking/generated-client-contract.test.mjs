import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../../../../../lib/api-client-react/src/index.ts", import.meta.url))],
  bundle: true, write: false, platform: "node", format: "cjs",
  external: ["react", "react/*", "@tanstack/react-query"],
});
const clientModule = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, clientModule, clientModule.exports);
const api = clientModule.exports;

test("approved booking client exposes hooks and parameter-scoped query keys", () => {
  const params = { doctorId: "doctor-1", branchId: "branch-1" };
  for (const [operation, path] of [
    ["GetPublicBookingContext", "/api/public/availability/context"],
    ["GetBookingScheduleAccess", "/api/booking/schedule-access"],
  ]) {
    assert.equal(typeof api[`use${operation}`], "function");
    assert.deepEqual(api[`get${operation}QueryKey`](params), [path, params]);
    const options = api[`get${operation}QueryOptions`](params);
    assert.deepEqual(options.queryKey, [path, params]);
    assert.equal(typeof options.queryFn, "function");
  }
});
test("schedule removal sends the exact opened snapshot as an encoded query parameter", async t => {
  const snapshot = JSON.stringify({ startTime: "09:00", endTime: "12:00", status: "active", note: "a & b + c" });
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, options };
    return new Response(null, { status: 204 });
  });
  await api.deleteSchedule("schedule-1", { expectedSnapshot: snapshot });
  const url = new URL(request.url, "https://clinicflow.example");
  assert.equal(url.pathname, "/api/schedules/schedule-1");
  assert.equal(url.searchParams.get("expectedSnapshot"), snapshot);
  assert.equal(request.options.method, "DELETE");
  assert.equal(request.options.body, undefined);
  const resources = readFileSync(new URL("../../resources.tsx", import.meta.url), "utf8");
  assert.match(resources, /api\.deleteSchedule\(id,\{expectedSnapshot:scheduleSnapshot\(row\)\}\)/);
  assert.match(resources, /expectedSnapshot:scheduleSnapshot\(editing\)/);
});
