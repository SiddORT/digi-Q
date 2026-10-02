// Isolated transport/controller tests. No browser, running app, accounts or email.
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { QueryClient } from "@tanstack/react-query";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");

const root = import.meta.dirname, bundle = resolve(root, `.session-lifecycle-${process.pid}.mjs`);
const originalFetch = globalThis.fetch, originalWindow = globalThis.window;
let api, events;
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
before(async () => {
  await build({
    stdin: { contents: `
      export * from "./native-auth";
      export * from "../lib/auth-request";
      export * from "../../../../lib/api-client-react/src/custom-fetch";
    `, resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
  });
  api = await import(bundle);
});
beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    location: { href: "https://example.test/app", origin: "https://example.test" },
  });
  events = [];
  window.addEventListener("digiq:session-unauthorized", event => events.push(event.detail));
  api.setCsrfTokenGetter(null); api.setBaseUrl(null);
});
after(async () => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  await rm(bundle, { force: true });
});
function harness() {
  const states = [], signals = [], client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const lifecycle = api.createSessionLifecycle({ queryClient: client, state: value => states.push(value), publish: value => signals.push(value) });
  return { client, states, signals, lifecycle, latest: () => states.at(-1) };
}
async function signedHarness() {
  const h = harness();
  globalThis.fetch = async () => json({ role: "doctor" });
  await h.lifecycle.refresh();
  h.signals.length = 0;
  h.client.setQueryData(["private-record"], { fixture: true });
  return h;
}
test("auth errors preserve safe status/code/cooldown and hide provider diagnostics", async () => {
  globalThis.fetch = async input => String(input).endsWith("/csrf") ? json({ csrfToken: "fixture" })
    : json({ error: "Please wait before requesting another code", code: "REGISTRATION_RESEND_COOLDOWN" }, 429, { "Retry-After": "60" });
  await assert.rejects(() => api.authRequest("registration/resend", { challengeId: "fixture" }), error => {
    assert.equal(error.status, 429); assert.equal(error.code, "REGISTRATION_RESEND_COOLDOWN");
    assert.equal(error.retryAfter, "60"); assert.equal(error.retryAfterSeconds, 60);
    assert.equal(error.message, "Too many attempts. Please wait a moment and try again.");
    return true;
  });
  globalThis.fetch = async input => String(input).endsWith("/csrf") ? json({ csrfToken: "fixture" })
    : json({ error: "SQL provider-password diagnostics", code: "EMAIL_DELIVERY_FAILED", password: "must-not-retain" }, 503);
  await assert.rejects(() => api.authRequest("register/start", {}), error => {
    assert.equal(error.status, 503);
    assert.ok(!JSON.stringify(error).includes("must-not-retain"));
    assert.ok(!error.message.includes("SQL")); return true;
  });
  assert.equal(events.length, 0);
});
test("protected mutation 401 clears private identity/cache immediately and never replays the write", async () => {
  const h = await signedHarness();
  window.addEventListener("digiq:session-unauthorized", event => h.lifecycle.unauthorized(event.detail.startedAt));
  let writes = 0;
  globalThis.fetch = async () => { writes++; return json({ error: "Sign in required", code: "REQUEST_FAILED" }, 401); };
  await assert.rejects(() => api.customFetch("/api/appointments", { method: "POST", body: "{}" }), error => error.status === 401);
  assert.equal(writes, 1); assert.equal(events.length, 1);
  assert.deepEqual(h.latest(), { isLoaded: true, isSignedIn: false, error: "" });
  assert.equal(h.client.getQueryCache().getAll().length, 0);
  assert.deepEqual(h.signals, ["signed-out"]);
  h.lifecycle.unauthorized(performance.now());
  assert.deepEqual(h.signals, ["signed-out"], "repeated failures cannot broadcast a logout loop");
});
test("anonymous auth/public/external failures and wrong-password errors do not invalidate sessions", async () => {
  globalThis.fetch = async () => json({ error: "Not authenticated", code: "REQUEST_FAILED" }, 401);
  for (const path of ["/api/auth/login", "/api/auth/status", "/api/auth/logout", "/api/auth/patient/verify",
    "/api/public/guest-receipt", "/api/demo/login", "/api/healthz", "https://other.test/api/me"])
    await assert.rejects(() => api.customFetch(path));
  globalThis.fetch = async () => json({ error: "Invalid password", code: "INVALID_CREDENTIALS" }, 401);
  await assert.rejects(() => api.customFetch("/api/clinic-expansion"));
  await assert.rejects(() => api.customFetch("/api/auth/change-password"));
  assert.equal(events.length, 0);
});
test("manual change-password distinguishes missing session from an incorrect current password", async () => {
  let missing = false;
  globalThis.fetch = async input => String(input).endsWith("/csrf") ? json({ csrfToken: "fixture" })
    : json(missing ? { error: "Sign in required", code: "REQUEST_FAILED" }
      : { error: "Invalid password", code: "INVALID_CREDENTIALS" }, 401);
  await assert.rejects(() => api.authRequest("change-password", {}));
  assert.equal(events.length, 0);
  missing = true;
  await assert.rejects(() => api.authRequest("change-password", {}));
  assert.equal(events.length, 1);
});
test("logout succeeds across tabs without credentials or rebroadcast loops; failed logout stays signed in", async () => {
  const a = await signedHarness(), b = await signedHarness();
  globalThis.fetch = async input => String(input).endsWith("/csrf") ? json({ csrfToken: "fixture" })
    : json({ error: "Unavailable" }, 503);
  await assert.rejects(() => a.lifecycle.logout());
  assert.equal(a.latest().isSignedIn, true);
  assert.ok(a.client.getQueryData(["private-record"]));
  globalThis.fetch = async input => String(input).endsWith("/csrf") ? json({ csrfToken: "fixture" })
    : json({ authenticated: false });
  await a.lifecycle.logout();
  assert.deepEqual(a.signals, ["signed-out"]);
  b.lifecycle.receive(a.signals[0]);
  assert.equal(b.latest().isSignedIn, false);
  assert.equal(b.client.getQueryCache().getAll().length, 0);
  assert.deepEqual(b.signals, [], "receiving a logout never sends one back");
  b.lifecycle.receive({ token: "ignored-unrecognized-shape" });
  assert.deepEqual(b.signals, []);
});
test("late successful status response cannot restore a session invalidated by a protected 401", async () => {
  const h = await signedHarness();
  let respond;
  globalThis.fetch = () => new Promise(resolve => { respond = resolve; });
  const pending = h.lifecycle.refresh(true);
  h.lifecycle.unauthorized(performance.now());
  respond(json({ role: "doctor" }));
  await pending;
  assert.equal(h.latest().isSignedIn, false);
  assert.equal(h.client.getQueryCache().getAll().length, 0);
  assert.deepEqual(h.signals, ["signed-out"]);
});
test("status checks are single-flight, do not renew or clear healthy caches, and detect expiry", async () => {
  const h = await signedHarness();
  let requests = 0, respond;
  globalThis.fetch = input => {
    assert.equal(String(input), "/api/auth/status"); requests++;
    return new Promise(resolve => { respond = resolve; });
  };
  const one = h.lifecycle.refresh(true), two = h.lifecycle.refresh(true);
  assert.equal(one, two); assert.equal(requests, 1);
  respond(json({ role: "doctor" })); await one;
  assert.ok(h.client.getQueryData(["private-record"]));
  globalThis.fetch = async () => json({ role: null });
  await h.lifecycle.refresh(true);
  assert.equal(h.latest().isSignedIn, false);
  assert.equal(h.client.getQueryCache().getAll().length, 0);
});
test("stale requests from a previous account cannot invalidate a newly refreshed session", async () => {
  const h = await signedHarness(), oldRequestStart = performance.now();
  await h.lifecycle.refresh();
  h.lifecycle.unauthorized(oldRequestStart);
  assert.equal(h.latest().isSignedIn, true);
  h.lifecycle.unauthorized(performance.now());
  assert.equal(h.latest().isSignedIn, false);
});
test("another tab's account change clears same-role data and rechecks without broadcasting", async () => {
  const h = await signedHarness();
  h.lifecycle.receive("session-changed");
  assert.equal(h.client.getQueryCache().getAll().length, 0);
  assert.equal(h.latest().isLoaded, false);
  await h.lifecycle.refresh(true);
  assert.equal(h.latest().isSignedIn, true);
  assert.deepEqual(h.signals, []);
});
test("aborted old queries do not emit expiry signals and cannot refill a cleared private cache", async () => {
  const h = await signedHarness();
  const abort = new AbortController(); abort.abort();
  globalThis.fetch = async () => json({ error: "Sign in required" }, 401);
  await assert.rejects(() => api.customFetch("/api/me", { signal: abort.signal }));
  assert.equal(events.length, 0);
  let finish;
  const query = h.client.fetchQuery({ queryKey: ["pending-private"], queryFn: () => new Promise(resolve => { finish = resolve; }) });
  const result = query.catch(() => undefined);
  h.lifecycle.unauthorized(performance.now());
  finish({ privateFixture: true }); await result;
  assert.equal(h.client.getQueryCache().getAll().length, 0);
});