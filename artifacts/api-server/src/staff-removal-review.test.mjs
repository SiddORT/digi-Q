import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({ entryPoints: [new URL("./lib/staff-removal-review.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "error" });
const module = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  (await import("node:module")).createRequire(import.meta.url), module, module.exports);
const { issueRemovalReview, verifyRemovalReview } = module.exports;
test("removal reviews expire and bind actor, target, exact proposal, mode and native session without exposing credentials", () => {
  process.env.SESSION_SECRET = "fictional-review-test-secret-not-for-normal-use";
  const input = { mode: "delete", actorId: "fixture-sa", targetId: "fixture-target", sessionHash: "ab".repeat(32),
    version: "cd".repeat(32), proposal: { kind: "staff-account-removal" }, operationId: "30000000-0000-4000-8000-000000000001" };
  const token = issueRemovalReview(input, 1000);
  assert.equal(verifyRemovalReview(token, input, 1001).operationId, input.operationId);
  assert.ok(!Buffer.from(token.split(".")[0], "base64url").toString().includes(input.sessionHash));
  for (const change of [{ actorId: "other" }, { targetId: "other" }, { sessionHash: "ef".repeat(32) },
    { mode: "handoff" }, { proposal: { kind: "different action" } }])
    assert.throws(() => verifyRemovalReview(token, { ...input, ...change }, 1001), /changed/);
  assert.throws(() => verifyRemovalReview(token, input, 301000), /expired/);
  assert.throws(() => verifyRemovalReview(token, input, 999), /expired/);
  assert.throws(() => verifyRemovalReview(token + "x", input, 1001), /Invalid/);
});
