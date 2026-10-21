// Real routers, migrated disposable PostgreSQL and password sessions. Only
// outbound email is simulated; no ordinary workspace database is connected.
import assert from "node:assert/strict";
import argon2 from "argon2";
import { createFeatureHarness } from "./feature-harness.mjs";

export const OWNER_PASSWORD = "Fictional-Owner!2026";
export async function createOwnerBookingHarness() {
  Object.assign(process.env, {
    AUTH_SESSION_MODE: "native", SESSION_SECRET: "isolated-owner-booking-test-only",
    CLINICFLOW_PUBLIC_ORIGIN: "https://fictional.test.invalid",
    SMTP_HOST: "mail.test.invalid", SMTP_PORT: "587", SMTP_USER: "fictional",
    SMTP_PASSWORD: "fictional", SMTP_FROM: "fictional@test.invalid",
    SMTP_REQUIRE_TLS: "true",
  });
  const h = await createFeatureHarness({
    postgres: true, administration: true, registration: true,
    bookingLookups: true, simulatedMail: true,
  });
  await h.pg.query(`insert into users(id,email,full_name,role,password_hash,email_verified_at)
    values('owner-test-super','super@owner.test.invalid','Fictional Super Admin','superAdmin',$1,now())`,
  [await argon2.hash(OWNER_PASSWORD)]);
  h.login = async email => {
    const response = await h.call(null, "POST", "/auth/login", { email, password: OWNER_PASSWORD });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    const cookie = response.headers.getSetCookie().findLast(value => value.startsWith("digiq_session="));
    assert.ok(cookie, "Password login must establish a real session");
    return cookie.split(";")[0];
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
    return verified.headers.getSetCookie().find(value => value.startsWith("digiq_session=")).split(";")[0];
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
