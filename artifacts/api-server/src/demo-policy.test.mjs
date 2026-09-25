import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({ entryPoints: [new URL("./lib/demo-policy.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false });
const { demoWriteAllowed, nextDemoLoginAttempts, DEMO_LOGIN_WINDOW_MS, DEMO_LOGIN_IP_LIMIT, DEMO_LOGIN_GLOBAL_LIMIT } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("demo owner cannot mutate clinic structure, staff, or arbitrary endpoints", () => {
  for (const path of ["/clinics", "/branches/1", "/users", "/users/1/resend-invitation",
    "/users/1", "/doctors/1", "/schedules", "/qrs/1/regenerate",
    "/settings", "/clinic-admin-onboarding", "/demo/setup", "/patients"]) {
    for (const method of ["POST", "PATCH", "DELETE"]) assert.equal(demoWriteAllowed(method, path), false, `${method} ${path}`);
  }
  assert.equal(demoWriteAllowed("POST", "/queue/call-next"), true);
  assert.equal(demoWriteAllowed("POST", "/guest-requests/one/decision"), true);
  assert.equal(demoWriteAllowed("POST", "/appointments/one/actions"), true);
  assert.equal(demoWriteAllowed("PATCH", "/doctors/one/presence"), true);
  assert.equal(demoWriteAllowed("POST", "/doctors/one/presence"), false);
});

test("demo login limits one IP without exhausting all demo access", () => {
  const first = "a".repeat(64), second = "b".repeat(64);
  let data;
  for (let i = 0; i < DEMO_LOGIN_IP_LIMIT; i++) {
    const next = nextDemoLoginAttempts(data, first, 1_000 + i);
    assert.equal(next.permitted, true);
    data = next.data;
  }
  assert.equal(nextDemoLoginAttempts(data, first, 2_000).permitted, false);
  const other = nextDemoLoginAttempts(data, second, 2_000);
  assert.equal(other.permitted, true);
  assert.equal(other.data.attempts.length, DEMO_LOGIN_IP_LIMIT + 1);
  const expired = nextDemoLoginAttempts(other.data, first, 2_000 + DEMO_LOGIN_WINDOW_MS + 1);
  assert.equal(expired.permitted, true);
  assert.equal(expired.data.attempts.length, 1);
  assert.equal(Object.keys(expired.data.byIp).length, 1);
});

test("demo login global cap bounds all stored attempts and IP entries", () => {
  let data;
  for (let i = 0; i < DEMO_LOGIN_GLOBAL_LIMIT; i++) {
    const ip = i.toString(16).padStart(64, "0");
    const next = nextDemoLoginAttempts(data, ip, 1_000 + i);
    assert.equal(next.permitted, true);
    data = next.data;
  }
  assert.equal(Object.keys(data.byIp).length, DEMO_LOGIN_GLOBAL_LIMIT);
  assert.equal(nextDemoLoginAttempts(data, "f".repeat(64), 2_000).permitted, false);
  const recovered = nextDemoLoginAttempts(data, "f".repeat(64), 1_000 + DEMO_LOGIN_WINDOW_MS + DEMO_LOGIN_GLOBAL_LIMIT);
  assert.equal(recovered.permitted, true);
  assert.equal(recovered.data.attempts.length, 1);
  assert.equal(Object.keys(recovered.data.byIp).length, 1);
});