// Fully in-memory harness: no database, network, SMTP, or real secret access.
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { SignJWT, decodeJwt } from "jose";
import { PgDialect } from "drizzle-orm/pg-core";

const root = import.meta.dirname;
const bundle = resolve(root, `.jwt-test-${process.pid}.mjs`);
const key = "disposable-jwt-test-key-not-a-production-secret";
const digest = token => createHash("sha256").update(token).digest("hex");
let api, rows, active, lookups;
const dialect = new PgDialect();
globalThis.jwtTestDb = {
  async transaction(work) {
    const snapshot = rows.map(row => ({ ...row }));
    let credentialLocked = false, userLocked = false;
    const tx = {
      async execute(statement) {
        const query = dialect.sqlToQuery(statement);
        assert.match(query.sql, /pg_advisory_xact_lock\(hashtext\(/);
        assert.deepEqual(query.params, ["auth-credentials:existing-user-id"]);
        credentialLocked = true;
      },
      select: () => ({ from: () => ({ where: condition => ({
        async for(mode) {
          assert.equal(credentialLocked, true, "credential advisory lock precedes user row lock");
          assert.equal(mode, "update");
          const query = dialect.sqlToQuery(condition);
          assert.match(query.sql, /"users"\."id" =/);
          assert.deepEqual(query.params, ["existing-user-id"]);
          userLocked = true;
          return [{ id: "existing-user-id", status: active ? "active" : "inactive", role: "doctor" }];
        },
      }) }) }),
      insert: () => ({ async values(row) {
        assert.equal(userLocked, true, "session insert follows locked active-user check");
        rows.push(row);
      } }),
    };
    try { return await work(tx); }
    catch (error) { rows = snapshot; throw error; }
  },
  delete: () => ({ where: async () => {} }),
  insert: () => ({ values: async row => rows.push(row) }),
  select: () => ({ from: () => ({ innerJoin: () => ({ where: condition => ({
    limit: async () => {
      lookups++;
      const query = dialect.sqlToQuery(condition);
      assert.match(query.sql, /"token_hash" =/);
      assert.match(query.sql, /"expires_at" >/);
      assert.match(query.sql, /"revoked_at" is null/);
      assert.match(query.sql, /"status" =/);
      assert.ok(query.params.includes("active"));
      return rows.filter(row => query.params.includes(row.tokenHash) &&
        !row.revokedAt && row.expiresAt > new Date() && active);
    },
  }) }) }) }),
};
before(async () => {
  await build({
    stdin: { contents: 'export * from "./lib/native-auth"; export * from "./lib/jwt-session"; export * from "./lib/auth-config";', resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "memory-db", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "memory" }));
      b.onLoad({ filter: /.*/, namespace: "memory" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db = globalThis.jwtTestDb;`, resolveDir: root }));
    } }],
  });
  api = await import(bundle);
});
beforeEach(() => {
  rows = []; active = true; lookups = 0;
  process.env.AUTH_SESSION_MODE = "jwt";
  process.env.JWT_SIGNING_KEY = key;
});
after(async () => {
  delete globalThis.jwtTestDb;
  await rm(bundle, { force: true });
});
function response() {
  return { cookie(name, value, options) { this.cookieValue = value; this.options = options; } };
}
async function resolveToken(token) {
  const req = { headers: { cookie: token ? `digiq_session=${token}` : "" } };
  await new Promise((resolve, reject) => api.nativeSession(req, {}, error => error ? reject(error) : resolve()));
  return req;
}
async function issue() {
  const res = response();
  await api.createSession(res, "existing-user-id");
  return res;
}
async function custom(claims = {}, alg = "HS256") {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: api.JWT_ISSUER, aud: api.JWT_AUDIENCE, sub: "existing-user-id",
    jti: "00000000-0000-4000-8000-000000000001",
    iat: now, exp: now + 43200, purpose: "app-session", ...claims,
  }).setProtectedHeader({ alg, typ: "JWT" }).sign(new TextEncoder().encode(key));
}
test("JWT issuance preserves identity, hashed proof, secure cookie and fixed 12h expiry", async () => {
  const res = await issue(), token = res.cookieValue, claims = decodeJwt(token);
  assert.equal(claims.sub, "existing-user-id");
  assert.equal(claims.exp - claims.iat, 43200);
  assert.equal(rows[0].expiresAt.getTime(), claims.exp * 1000);
  assert.equal(rows[0].tokenHash, digest(token));
  assert.equal(res.options.httpOnly, true);
  assert.equal(res.options.secure, true);
  assert.equal(res.options.sameSite, "lax");
  assert.equal(res.options.maxAge, 43200000);
  const req = await resolveToken(token);
  assert.equal(req.authUserId, "existing-user-id");
  assert.equal(req.authSessionHash, digest(token));
});
test("revoked, expired DB rows, inactive users, and subject/hash mismatch fail closed", async () => {
  const { cookieValue: token } = await issue();
  active = false;
  assert.equal((await resolveToken(token)).authUserId, undefined);
  active = true; rows[0].revokedAt = new Date();
  assert.equal((await resolveToken(token)).authUserId, undefined);
  rows[0].revokedAt = null; rows[0].expiresAt = new Date(0);
  assert.equal((await resolveToken(token)).authUserId, undefined);
  rows[0].expiresAt = new Date(Date.now() + 60000); rows[0].userId = "other-user";
  assert.equal((await resolveToken(token)).authUserId, undefined);
});
test("tampered, expired, wrong algorithm/issuer/audience/purpose and malformed claims never query DB", async () => {
  const token = (await issue()).cookieValue;
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...decodeJwt(token), sub: "attacker" })).toString("base64url");
  const invalid = [
    parts.join("."), "malformed", await custom({}, "HS384"),
    await custom({ iss: "other" }), await custom({ aud: "other" }),
    await custom({ aud: [api.JWT_AUDIENCE, "other"] }),
    await custom({ purpose: "password-reset" }), await custom({ sub: "" }),
    await custom({ jti: "" }), await custom({ jti: undefined }),
    await custom({ iat: "wrong" }), await custom({ exp: undefined }),
    await custom({ exp: Math.floor(Date.now() / 1000) - 1 }),
    await custom({ iat: Math.floor(Date.now() / 1000) + 60 }),
    await custom({ exp: Math.floor(Date.now() / 1000) + 86400 }),
  ];
  for (const value of invalid) assert.equal((await resolveToken(value)).authUserId, undefined);
  assert.equal(lookups, 0);
});
test("native default accepts existing opaque cookies; JWT never accepts them or falls back", async () => {
  delete process.env.AUTH_SESSION_MODE;
  const { cookieValue: token } = await issue();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await resolveToken(token)).authUserId, "existing-user-id");
  process.env.AUTH_SESSION_MODE = "jwt"; lookups = 0;
  assert.equal((await resolveToken(token)).authUserId, undefined);
  assert.equal(lookups, 0);
  const jwt = (await issue()).cookieValue;
  process.env.AUTH_SESSION_MODE = "native";
  assert.equal((await resolveToken(jwt)).authUserId, undefined);
});
test("missing/short key and invalid mode reject issuance, leave public requests anonymous", async () => {
  for (const value of [undefined, "", "short", " ".repeat(32)]) {
    if (value === undefined) delete process.env.JWT_SIGNING_KEY;
    else process.env.JWT_SIGNING_KEY = value;
    await assert.rejects(issue, error => error.status === 503 && error.code === "AUTH_SESSION_UNCONFIGURED");
    assert.equal((await resolveToken()).authUserId, undefined);
    assert.equal((await resolveToken("stale-cookie")).authUserId, undefined);
  }
  process.env.AUTH_SESSION_MODE = "typo";
  await assert.rejects(issue, error => error.status === 503);
  assert.equal((await resolveToken("stale-cookie")).authUserId, undefined);
  assert.equal(rows.length, 0);
  assert.equal(lookups, 0);
});
test("new passwords require eight characters with letters and numbers; legacy verification is not revalidated", async () => {
  for (const password of ["short1", "onlyletters", "12345678", "a1" + "x".repeat(1023)])
    assert.throws(() => api.passwordInput(password), error => error.code === "INVALID_PASSWORD");
  assert.doesNotThrow(() => api.passwordInput("abcdefg1"));
  assert.doesNotThrow(() => api.passwordInput("a1" + "x".repeat(1022)));
  const { default: argon2 } = await import("argon2");
  const legacyHash = await argon2.hash("legacy-no-digits");
  assert.equal(await api.verifyPassword(legacyHash, "legacy-no-digits"), true);
});