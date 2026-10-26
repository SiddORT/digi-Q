import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

const bundle = await build({ entryPoints: [new URL("./lib/staff-settings-erasure.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "error" });
const module = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
test("manual SMS claims preserve dispatch/unknown removal barriers and terminal deduplication without actor identity", () => {
  const row = { id: "manual-status-sms:fictional-hash", data: { actorId: "fixture-actor", appointmentId: "fictional-visit", state: "sending" } };
  const classify = state => module.exports.classifyStaffSetting({ ...row, data: { ...row.data, state } }, { userId: "fixture-actor", doctorIds: [] });
  for (const state of ["sending", "delivery_unknown"]) assert.equal(classify(state).action, "resolve");
  for (const state of ["provider_accepted", "provider_rejected", "pre_dispatch_failed", "blocked"]) {
    const result = classify(state);
    assert.equal(result.action, "anonymize");
    assert(!JSON.stringify(result.data).includes("fixture-actor"));
    assert.notEqual(result.action, "erase", "Keep the durable occurrence key");
  }
});
