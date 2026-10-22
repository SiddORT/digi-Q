// Real routers, migrated disposable PostgreSQL and native/JWT password sessions.
// Email is simulated and fetch is loopback-only; no workspace DB is connected.
import assert from "node:assert/strict";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { createFeatureHarness } from "./feature-harness.mjs";

export const OWNER_PASSWORD = "Fictional-Owner!2026";
export const sessionDigest = cookie => createHash("sha256").update(cookie.slice("digiq_session=".length)).digest("hex");
export async function createOwnerBookingHarness({ sessionMode = "native" } = {}) {
  assert.ok(["native", "jwt"].includes(sessionMode), "Explicit supported test session mode");
  // Process-local random test material, never the workspace/deployment signing key.
  const signingKey = randomBytes(48).toString("base64url");
  Object.assign(process.env, {
    AUTH_SESSION_MODE: sessionMode, JWT_SIGNING_KEY: signingKey,
    SESSION_SECRET: "isolated-owner-booking-test-only",
    CLINICFLOW_PUBLIC_ORIGIN: "https://fictional.test.invalid",
    SMTP_HOST: "mail.test.invalid", SMTP_PORT: "587", SMTP_USER: "fictional",
    SMTP_PASSWORD: "fictional", SMTP_FROM: "fictional@test.invalid",
    SMTP_REQUIRE_TLS: "true",
  });
  const realFetch = globalThis.fetch;
  let allowedOrigin;
  let blockedRequests = 0;
  globalThis.fetch = (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    if (url.origin !== allowedOrigin) {
      blockedRequests++;
      throw new Error("External network disabled in owner booking harness");
    }
    return realFetch(input, options);
  };
  let h;
  try {
    h = await createFeatureHarness({
      postgres: true, administration: true, registration: true,
      bookingLookups: true, simulatedMail: true,
    });
    allowedOrigin = new URL(h.base).origin;
    await h.pg.query(`insert into users(id,email,full_name,role,password_hash,email_verified_at)
      values('owner-test-super','super@owner.test.invalid','Fictional Super Admin','superAdmin',$1,now())`,
    [await argon2.hash(OWNER_PASSWORD)]);
  } catch (error) {
    globalThis.fetch = realFetch;
    await h?.close();
    throw error;
  }
  const close = h.close.bind(h);
  h.close = async () => {
    try { await close(); }
    finally { globalThis.fetch = realFetch; }
    assert.equal(blockedRequests, 0, "No outbound HTTP attempted during the owner journey");
  };
  async function sessionCookie(response, email) {
    const header = response.headers.getSetCookie().findLast(value => value.startsWith("digiq_session="));
    assert.ok(header, "Authentication must establish a real session");
    const cookie = header.split(";")[0], token = cookie.slice("digiq_session=".length);
    const stored = (await h.pg.query(`select s.user_id,s.expires_at,s.revoked_at,u.email
      from auth_sessions s join users u on u.id=s.user_id where s.token_hash=$1`, [sessionDigest(cookie)])).rows;
    assert.equal(stored.length, 1);
    assert.equal(stored[0].email, email);
    assert.equal(stored[0].revoked_at, null);
    if (sessionMode === "jwt") {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(signingKey), {
        algorithms: ["HS256"], issuer: "digiq-doctors", audience: "digiq-doctors-session", typ: "JWT",
      });
      assert.equal(payload.sub, stored[0].user_id);
      assert.equal(payload.purpose, "app-session");
      assert.equal(payload.exp - payload.iat, 43200);
      assert.equal(stored[0].expires_at.getTime(), payload.exp * 1000);
    } else assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    return cookie;
  }
  // Deliberately invalid subject-to-row binding, but a valid test-key signature.
  // The caller must bind this token's hash to a different persisted identity.
  h.wrongSubjectCookie = async (cookie, subject) => {
    assert.equal(sessionMode, "jwt");
    const { payload } = await jwtVerify(cookie.slice("digiq_session=".length), new TextEncoder().encode(signingKey));
    const token = await new SignJWT({ ...payload, sub: subject })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" }).sign(new TextEncoder().encode(signingKey));
    return `digiq_session=${token}`;
  };
  h.login = async email => {
    const response = await h.call(null, "POST", "/auth/login", { email, password: OWNER_PASSWORD });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return sessionCookie(response, email);
  };
  h.as = (cookie, method, path, body) => h.call(null, method, path, body, { cookie });
  h.register = async email => {
    const start = await h.call(null, "POST", "/auth/register/start", {
      email, fullName: "Fictional Self Owner", password: OWNER_PASSWORD,
    });
    assert.equal(start.status, 200, JSON.stringify(start.data));
    const message = h.mail.messages.findLast(mail => mail.to === email);
    const code = (message.text || message.html).match(/\b\d{6}\b/)?.[0];
    assert.ok(code, "Read verification only from the simulated outbox");
    const verified = await h.call(null, "POST", "/auth/register/verify", { challengeId: start.data.challengeId, code });
    assert.equal(verified.status, 200, JSON.stringify(verified.data));
    return sessionCookie(verified, email);
  };
  h.acceptInvitation = async email => {
    const mail = h.mail.messages.findLast(message => message.to === email);
    const link = (mail.text || mail.html).match(/https:\/\/[^\s<>"]+set-password[^\s<>"]*/)?.[0];
    assert.ok(link, "Invitation must come from the simulated outbox");
    const response = await h.call(null, "POST", "/auth/invitation/accept", {
      token: new URL(link).searchParams.get("token"), password: OWNER_PASSWORD,
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return h.login(email);
  };
  return h;
}

export function ownerSetup(name, ownDoctor = true) {
  return {
    requestId: crypto.randomUUID(),
    clinic: { name: `Fictional ${name}`, slug: `owner-${name}`, address: "Fictional Road",
      email: "front@owner.test.invalid", phone: "+919876543210", dateFormat: "YYYY-MM-DD", timeFormat: "24h" },
    branches: [{ name: `Fictional ${name} Location`, slug: "main", address: "Fictional Road", timezone: "UTC",
      inheritEmail: true, inheritPhone: true,
      openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: "00:00", endTime: "23:59" })) }],
    ownDoctor,
    ...(ownDoctor ? { ownerSchedule: { maxTokens: 30, consultationMinutes: 20, tokenPrefix: "OWN", queueMode: "mixed" } } : {}),
  };
}
