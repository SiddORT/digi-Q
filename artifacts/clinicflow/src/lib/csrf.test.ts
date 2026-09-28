import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { authRequest } from "./auth-request";
import { csrfFetch, csrfToken } from "./csrf";
import { ApiError, customFetch, setCsrfTokenGetter } from "../../../../lib/api-client-react/src/custom-fetch";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  setCsrfTokenGetter(null);
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("all auth mutations fetch matching cookie and header, with no cached token", async () => {
  let cookie = "";
  let issued = 0;
  const posts: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    if (path === "/api/auth/csrf") {
      assert.equal(init?.method, undefined);
      cookie = `token-${++issued}`; // browser stores the Set-Cookie from this response
      return json({ csrfToken: cookie });
    }
    assert.equal(new Headers(init?.headers).get("X-CSRF-Token"), cookie);
    assert.equal(init?.method, "POST");
    posts.push(path);
    return json({ authenticated: true });
  };

  const paths = [
    "login", "logout", "verify-device", "forgot-password", "reset-password",
    "invitation/accept", "change-password", "patient/start", "patient/verify",
    "register/start", "register/verify",
  ];
  for (const path of paths) await authRequest(path, { test: true });
  await csrfFetch("/api/demo/login", { method: "POST", body: JSON.stringify({ password: "test" }) });
  assert.deepEqual(posts, [...paths.map(path => `/api/auth/${path}`), "/api/demo/login"]);
  assert.equal(issued, posts.length);
});

test("missing CSRF token fails closed before sending the write", async () => {
  const paths: string[] = [];
  globalThis.fetch = async input => {
    paths.push(String(input));
    return json({});
  };
  await assert.rejects(authRequest("login", {}), /security token is missing/);
  assert.deepEqual(paths, ["/api/auth/csrf"]);
});

test("only INVALID_CSRF 403 refetches and retries once", async () => {
  let issued = 0;
  let writes = 0;
  const headers: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/auth/csrf") return json({ csrfToken: `fresh-${++issued}` });
    headers.push(new Headers(init?.headers).get("X-CSRF-Token") || "");
    writes++;
    return writes === 1 ? json({ code: "INVALID_CSRF", error: "Invalid CSRF token" }, 403) : json({ ok: true });
  };
  assert.deepEqual(await authRequest("login", {}), { ok: true });
  assert.deepEqual(headers, ["fresh-1", "fresh-2"]);
  assert.equal(issued, 2);
});

test("second INVALID_CSRF rejection is returned without another retry", async () => {
  let requests = 0;
  globalThis.fetch = async input => {
    requests++;
    return String(input) === "/api/auth/csrf"
      ? json({ csrfToken: "token" })
      : json({ code: "INVALID_CSRF", error: "Invalid CSRF token" }, 403);
  };
  await assert.rejects(authRequest("patient/verify", {}), /Invalid CSRF token/);
  assert.equal(requests, 4);
});

test("auth, validation, other 403, and non-JSON errors are never retried", async () => {
  for (const response of [
    json({ code: "INVALID_CREDENTIALS", error: "Wrong password" }, 401),
    json({ code: "INVALID_VERIFICATION", error: "Bad code" }, 400),
    json({ code: "FORBIDDEN", error: "Not allowed" }, 403),
    new Response("Forbidden", { status: 403 }),
  ]) {
    let requests = 0;
    globalThis.fetch = async input => {
      requests++;
      return String(input) === "/api/auth/csrf" ? json({ csrfToken: "token" }) : response;
    };
    await assert.rejects(authRequest("login", {}));
    assert.equal(requests, 2);
  }
});

test("generated mutations use configured getter and only retry pre-handler CSRF rejects", async () => {
  setCsrfTokenGetter(csrfToken);
  let issued = 0;
  let posts = 0;
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    if (String(input) === "/api/auth/csrf") {
      assert.equal(init?.cache, "no-store");
      return json({ csrfToken: `fresh-${++issued}` });
    }
    posts++;
    assert.equal(new Headers(init?.headers).get("X-CSRF-Token"), `fresh-${issued}`);
    if (posts === 1) return json({ code: "INVALID_CSRF" }, 403);
    return json({ ok: true });
  };
  assert.deepEqual(await customFetch("/api/clinics", { method: "POST", body: "{}" }), { ok: true });
  assert.equal(issued, 2);
  assert.equal(posts, 2);

  let conflictRequests = 0;
  globalThis.fetch = async (input) => {
    conflictRequests++;
    return String(input) === "/api/auth/csrf"
      ? json({ csrfToken: "fresh" })
      : json({ code: "CONFLICT" }, 409);
  };
  await assert.rejects(customFetch("/api/clinics", { method: "POST" }), (error: unknown) =>
    error instanceof ApiError && error.status === 409);
  assert.equal(conflictRequests, 2);
});

test("generated writes fail closed on missing token and stop after one CSRF retry", async () => {
  setCsrfTokenGetter(csrfToken);
  let requests = 0;
  globalThis.fetch = async input => {
    requests++;
    return String(input) === "/api/auth/csrf" ? json({}) : json({ ok: true });
  };
  await assert.rejects(customFetch("/api/clinics", { method: "POST" }), /security token is missing/);
  assert.equal(requests, 1);

  requests = 0;
  globalThis.fetch = async input => {
    requests++;
    return String(input) === "/api/auth/csrf"
      ? json({ csrfToken: "token" })
      : json({ code: "INVALID_CSRF" }, 403);
  };
  await assert.rejects(customFetch("/api/clinics", { method: "POST" }), (error: unknown) =>
    error instanceof ApiError && error.status === 403);
  assert.equal(requests, 4);
});