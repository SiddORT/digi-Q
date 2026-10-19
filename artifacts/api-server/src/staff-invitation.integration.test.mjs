// Real HTTP routes, migrations and native credentials; disposable PostgreSQL and
// an intercepted mail transport. No workspace database or external messages.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h;
before(async () => {
  Object.assign(process.env, {
    CLINICFLOW_PUBLIC_ORIGIN: "https://clinic.test.invalid",
    SMTP_HOST: "mail.test.invalid", SMTP_PORT: "587", SMTP_USER: "fixture",
    SMTP_PASSWORD: "fixture-only", SMTP_FROM: "noreply@test.invalid",
    SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "true",
  });
  h = await createFeatureHarness({ administration: true, simulatedMail: true });
  await seedFeatureFixtures(h.pg);
});
after(async () => await h?.close());
const rows = async (sql, params) => (await h.pg.query(sql, params)).rows;
const input = (name) => ({ fullName: name, email: `${name}@test.invalid`, status: "active", clinicIds: ["c1"], branchIds: ["b1"] });
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result.data)); return result.data; };

test("successful doctor creation returns authorized persisted context and a sent invitation, without verifying the account", async () => {
  const result = ok(await h.call("adm", "POST", "/doctors", input("sent-doctor")), 201);
  assert.equal(result.invitationStatus, "sent");
  assert.equal(result.ownerAdminId, "adm");
  assert.deepEqual(result.branchIds, ["b1"]);
  assert.notEqual(result.passwordEnabled, true);
  const [account] = await rows("select * from users where id=$1", [result.userId]);
  assert.equal(account.email_verified_at, null);
  assert.equal(account.password_hash, null);
  assert.equal(h.mail.messages.length, 1);
  assert.equal(h.mail.messages[0].to, "sent-doctor@test.invalid");
  assert.match(h.mail.messages[0].text, /https:\/\/clinic.test.invalid\/set-password\?token=/);
  assert.ok(!JSON.stringify(result).includes("token="));
});

test("post-commit provider failure retains doctor, assignments and failed status; authorized resend recovers without creation", async () => {
  h.mail.fail = true;
  const result = ok(await h.call("adm", "POST", "/doctors", input("failed-doctor")), 201);
  assert.equal(result.invitationStatus, "failed");
  assert.equal(result.ownerAdminId, "adm");
  assert.deepEqual(result.branchIds, ["b1"]);
  const loaded = ok(await h.call("adm", "GET", `/doctors/${result.id}`));
  assert.equal(loaded.userId, result.userId);
  assert.equal(loaded.invitationStatus, "failed");
  assert.equal((await h.call("adm", "POST", "/doctors", input("failed-doctor"))).status, 409);
  assert.equal((await h.call("adm2", "POST", `/users/${result.userId}/resend-invitation`)).status, 403);
  assert.equal((await h.call("rec", "POST", `/users/${result.userId}/resend-invitation`)).status, 403);
  const failed = ok(await h.call("adm", "POST", `/users/${result.userId}/resend-invitation`));
  assert.equal(failed.invitationStatus, "failed");
  assert.equal((await rows("select count(*)::int n from auth_challenges where user_id=$1 and consumed_at is null", [result.userId]))[0].n, 0);
  h.mail.fail = false;
  const sent = ok(await h.call("adm", "POST", `/users/${result.userId}/resend-invitation`));
  assert.equal(sent.id, result.userId);
  assert.equal(sent.invitationStatus, "sent");
  assert.deepEqual(sent.branchIds, ["b1"]);
  const message = h.mail.messages.at(-1);
  const token = new URL(message.text.match(/https:\/\/\S+/)[0]).searchParams.get("token");
  ok(await h.call(null, "POST", "/auth/invitation/accept", { token, password: "Disposable-Password-42!" }));
  const [account] = await rows("select password_hash,email_verified_at,invitation_status from users where id=$1", [result.userId]);
  assert.ok(account.password_hash);
  assert.ok(account.email_verified_at);
  assert.equal(account.invitation_status, "notRequired");
  assert.equal((await h.call("adm", "POST", `/users/${result.userId}/resend-invitation`)).status, 409);
  assert.equal((await rows("select count(*)::int n from users where email=$1", ["failed-doctor@test.invalid"]))[0].n, 1);
});

test("configuration failures and validation failures before persistence never leave a duplicate-prone account", async () => {
  delete process.env.CLINICFLOW_PUBLIC_ORIGIN;
  const missing = await h.call("adm", "POST", "/doctors", input("no-origin"));
  assert.equal(missing.status, 503);
  assert.equal(missing.data.code, "PUBLIC_ORIGIN_UNCONFIGURED");
  assert.equal((await rows("select count(*)::int n from users where email=$1", ["no-origin@test.invalid"]))[0].n, 0);
  process.env.CLINICFLOW_PUBLIC_ORIGIN = "https://clinic.test.invalid";
  process.env.SMTP_HOST = "";
  const smtp = await h.call("adm", "POST", "/users", { ...input("no-smtp"), role: "receptionist" });
  assert.equal(smtp.status, 503);
  assert.equal(smtp.data.code, "EMAIL_UNCONFIGURED");
  assert.equal((await rows("select count(*)::int n from users where email=$1", ["no-smtp@test.invalid"]))[0].n, 0);
  process.env.SMTP_HOST = "mail.test.invalid";
  assert.equal((await h.call("adm", "POST", "/doctors", { ...input("invalid"), email: "invalid" })).status, 400);
  assert.equal((await rows("select count(*)::int n from users where email='invalid'"))[0].n, 0);
});

test("receptionist creation and resend configuration failure return the same saved identity, including to an authorized doctor", async () => {
  h.mail.fail = true;
  const result = ok(await h.call("adm", "POST", "/users", { ...input("failed-desk"), role: "receptionist" }), 201);
  assert.equal(result.invitationStatus, "failed");
  assert.equal(result.managingAdminId, "adm");
  delete process.env.CLINICFLOW_PUBLIC_ORIGIN;
  const failure = ok(await h.call("docu", "POST", `/users/${result.id}/resend-invitation`));
  assert.equal(failure.id, result.id);
  assert.equal(failure.invitationStatus, "failed");
  process.env.CLINICFLOW_PUBLIC_ORIGIN = "https://clinic.test.invalid";
  h.mail.fail = false;
  assert.equal(ok(await h.call("docu", "POST", `/users/${result.id}/resend-invitation`)).invitationStatus, "sent");
  assert.equal(ok(await h.call("adm", "GET", `/users/${result.id}`)).invitationStatus, "sent");
});

test("Clinic Admin onboarding keeps the atomically saved clinic and owner after mail failure and supports resend", async () => {
  const body = {
    admin: { fullName: "Invited Owner", email: "invited-owner@test.invalid" },
    clinic: { name: "Invitation Fixture Clinic", address: "Fictional Road", slug: "invitation-fixture-clinic", timezone: "UTC", email: "front@test.invalid", phone: "+919876543210" },
    branches: [{ name: "Fixture Location", slug: "fixture-location", address: "Fictional Road", timezone: "UTC", openingHours: [{dayOfWeek:1,startTime:"09:00",endTime:"12:00"}] }],
  };
  h.mail.fail = true;
  const result = ok(await h.call("sa", "POST", "/clinic-admin-onboarding", body), 201);
  assert.equal(result.admin.invitationStatus, "failed");
  assert.equal(result.clinic.adminId, result.admin.id);
  assert.equal(result.branches.length, 1);
  assert.equal(ok(await h.call("sa", "GET", `/clinics/${result.clinic.id}`)).adminId, result.admin.id);
  assert.equal((await h.call("sa", "POST", "/clinic-admin-onboarding", body)).status, 409);
  assert.equal((await h.call("adm", "POST", `/users/${result.admin.id}/resend-invitation`)).status, 403);
  h.mail.fail = false;
  assert.equal(ok(await h.call("sa", "POST", `/users/${result.admin.id}/resend-invitation`)).invitationStatus, "sent");
  assert.equal((await rows("select count(*)::int n from clinics where admin_id=$1", [result.admin.id]))[0].n, 1);
});
