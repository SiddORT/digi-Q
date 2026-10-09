// Fictional identities, intercepted email, disposable PostgreSQL; no real clinic or inbox.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h;
before(async () => {
  Object.assign(process.env, { CLINICFLOW_PUBLIC_ORIGIN: "https://fictional.test.invalid",
    SMTP_HOST: "mail.test.invalid", SMTP_PORT: "587", SMTP_USER: "fictional",
    SMTP_PASSWORD: "fictional", SMTP_FROM: "fictional@test.invalid", SMTP_REQUIRE_TLS: "true" });
  h = await createFeatureHarness({ administration: true, simulatedMail: true, postgres: true, registration: true });
  await seedFeatureFixtures(h.pg);
});
after(async () => await h?.close());
const body = (name, requestId) => ({
  requestId, admin: { fullName: "Fictional Owner", email: `${name}@test.invalid` },
  clinic: { name: `Fictional ${name}`, slug: `fictional-${name}`, address: "Fictional Way", email: "front@test.invalid", phone: "+919876543210" },
  branches: [{ name: "Fictional Location", slug: `location-${name}`, address: "Fictional Way", timezone: "Asia/Kolkata",
    inheritEmail: true, inheritPhone: true, openingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, { dayOfWeek: 1, startTime: "13:00", endTime: "18:00" }] }],
  ownDoctor: true, ownerSchedule: { maxTokens: 8, consultationMinutes: 20, tokenPrefix: "A", queueMode: "mixed" },
});
test("creation-only effective contact checks reject missing inherited values, independently", async () => {
  const input = body("missing-contacts", crypto.randomUUID());
  for (const field of ["email", "phone"]) {
    const missing = structuredClone(input); delete missing.clinic[field];
    const rejected = await h.call("sa", "POST", "/clinic-admin-onboarding", missing);
    assert.equal(rejected.status, 400, JSON.stringify(rejected.data));
    assert.match(rejected.data.error, new RegExp(field));
  }
  const explicit = structuredClone(input);
  explicit.clinic.email = undefined;
  explicit.branches[0].inheritEmail = false;
  explicit.branches[0].email = "branch@test.invalid";
  const result = await h.call("sa", "POST", "/clinic-admin-onboarding", explicit);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.branches[0].effectiveEmail, "branch@test.invalid");
  assert.equal(result.data.branches[0].effectivePhone, "+919876543210");
});
test("concurrent requests and lost-response retries recover the same authorized committed result", async () => {
  const input = body("parallel-owner", crypto.randomUUID());
  const requests = await Promise.all([h.call("sa", "POST", "/clinic-admin-onboarding", input), h.call("sa", "POST", "/clinic-admin-onboarding", input)]);
  for (const result of requests) assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(requests[0].data.clinic.id, requests[1].data.clinic.id);
  assert.equal(requests[0].data.admin.id, requests[1].data.admin.id);
  const saved = await h.call("sa", "GET", `/clinic-admin-onboarding/completion?requestId=${input.requestId}`);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.result.clinic.id, requests[0].data.clinic.id);
  const stranger = await h.call("adm", "GET", `/clinic-admin-onboarding/completion?requestId=${input.requestId}`);
  assert.equal(stranger.status, 403);
  const changed = await h.call("sa", "POST", "/clinic-admin-onboarding", { ...input, clinic: { ...input.clinic, name: "Changed" } });
  assert.equal(changed.status, 409, JSON.stringify(changed.data));
  const rows = (await h.pg.query("select id from clinics where admin_id=$1", [requests[0].data.admin.id])).rows;
  assert.equal(rows.length, 1);
  assert.equal((await h.pg.query("select count(*)::int n from branches where clinic_id=$1", [rows[0].id])).rows[0].n, 1);
  assert.equal((await h.pg.query("select count(*)::int n from schedules where clinic_id=$1", [rows[0].id])).rows[0].n, 2);
  assert.equal(h.mail.messages.filter(m => m.to === input.admin.email).length, 1);
});
test("self-registration requires verified ownership and a password; success can be read after a lost response", async () => {
  const argon2 = createRequire(import.meta.url)("argon2");
  const hash = await argon2.hash("FictionalPass123", { type: argon2.argon2id });
  await h.pg.query("insert into users(id,email,full_name,role,status,email_verified_at,password_hash) values ('self-fixture','self@test.invalid','Fictional Owner','clinicAdmin','active',now(),$1)", [hash]);
  const { admin, ...input } = body("self-owner", crypto.randomUUID());
  input.fullName = "Fictional Owner"; input.password = "FictionalPass123";
  const wrong = await h.call("self-fixture", "POST", "/clinic-registration", { ...input, password: "WrongPass123" });
  assert.equal(wrong.status, 401);
  const result = await h.call("self-fixture", "POST", "/clinic-registration", input);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const retry = await h.call("self-fixture", "POST", "/clinic-registration", input);
  assert.equal(retry.status, 201);
  assert.equal(retry.data.clinic.id, result.data.clinic.id);
  const recovered = await h.call("self-fixture", "GET", `/clinic-registration/completion?requestId=${input.requestId}`);
  assert.equal(recovered.data.result.clinic.id, result.data.clinic.id);
  const changed = await h.call("self-fixture", "POST", "/clinic-registration", {...input, clinic: {...input.clinic, name:"Changed"}});
  assert.equal(changed.status, 409);
  assert.equal((await h.pg.query("select count(*)::int n from clinics where admin_id='self-fixture'")).rows[0].n, 1);
});
test("custom consulting-owner sessions are saved atomically and a retry cannot duplicate them", async () => {
  const input = body("custom-owner", crypto.randomUUID());
  delete input.ownerSchedule;
  input.ownerCustomSchedule = { sessions: [{ branchIndex: 0, dayOfWeek: 1, startTime: "09:00", endTime: "11:00" }], maxTokens: 5, consultationMinutes: 30, tokenPrefix: "B", queueMode: "mixed" };
  const response = await h.call("sa", "POST", "/clinic-admin-onboarding", input);
  assert.equal(response.status, 201, JSON.stringify(response.data));
  assert.ok(response.data.doctorId);
  assert.equal((await h.call("sa", "POST", "/clinic-admin-onboarding", input)).data.clinic.id, response.data.clinic.id);
  const saved = (await h.pg.query("select data from schedules where clinic_id=$1", [response.data.clinic.id])).rows;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].data.startTime, "09:00");
});
