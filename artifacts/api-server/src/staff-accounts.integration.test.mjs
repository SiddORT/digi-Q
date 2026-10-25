// Disposable database, fictional identities and fake email/SMS. No live messages.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h;
const password = "Fictional-Staff-239!";
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; };
const rows = async (q, p = []) => (await h.pg.query(q, p)).rows;
const input = name => ({ fullName: `Fictional ${name}`, email: `${name}@test.invalid`, mobile: "+919876543210",
  password, confirmPassword: password, status: "active", clinicIds: ["c1"], branchIds: ["b1"] });
const create = async (name, role = "receptionist", actor = "adm") => ok(await h.call(actor, "POST", role === "doctor" ? "/doctors" : "/users",
  { ...input(name), ...(role === "doctor" ? {} : { role }) }), 201);
const request = async (id, channel) => ok(await h.call(id, "POST", "/staff-verification/request", { channel }));
const code = channel => (channel === "email" ? h.mail.messages.at(-1)?.text : h.sms.messages.at(-1)?.text)?.match(/\b\d{6}\b/)?.[0];
const confirm = (id, channel, challenge, otp = code(channel)) => h.call(id, "POST", "/staff-verification/confirm", { channel, challengeId: challenge.challengeId, code: otp });
async function age(id, channel) {
  await h.pg.query("update auth_challenges set created_at=now()-interval '61 seconds' where user_id=$1 and purpose=$2", [id, `staff-contact:${channel}`]);
}
async function smsTemplate(event, recipient) {
  const defaultRecipient = ["staff_created_admin"].includes(event) ? "clinicAdmin" : "receptionist";
  const content = { enabled: true, subject: "Digi-Q", body: event.endsWith("_otp")
    ? "Digi-Q code {{otp}} expires in {{expiry_minutes}} minutes."
    : "Digi-Q {{recipient_name}} {{staff_name}} {{role_name}} {{clinic_name}} {{location_names}} {{sign_in_link}}",
    prefix: "", footer: "", logoUrl: "", senderId: "TESTDQ", dltEntityId: "", dltTemplateId: `fictional-${event}` };
  await h.pg.query("insert into settings(id,data) values($1,$2) on conflict(id) do update set data=excluded.data",
    [`sms-template:platform:${event}${recipient === defaultRecipient ? "" : `:${recipient}`}`, { revision: 1, publishedRevision: 1, published: content }]);
}
before(async () => {
  Object.assign(process.env, {
    NODE_ENV: "test", SESSION_SECRET: "fictional-session-secret-longer-than-32-bytes",
    CLINICFLOW_PUBLIC_ORIGIN: "https://clinic.test.invalid",
    SMTP_HOST: "mail.test.invalid", SMTP_PORT: "587", SMTP_USER: "fixture",
    SMTP_PASSWORD: "fictional", SMTP_FROM: "fixture@test.invalid", SMTP_REQUIRE_TLS: "true",
    NOTIFICATION_SMS_PROVIDER: "keepInTouch", NOTIFICATION_SMS_KEY: "fictional-key",
    NOTIFICATION_SMS_BEARER_TOKEN: "fictional-bearer", NOTIFICATION_SMS_CLIENT_ID: "fixture",
    NOTIFICATION_SMS_SENDER_ID: "TESTDQ", NOTIFICATION_SMS_COUNTRY_CODE_FORMAT: "plus",
    NOTIFICATION_SMS_ENABLED: "true",
  });
  h = await createFeatureHarness({ administration: true, simulatedMail: true, staffAccounts: true, registration: true, postgres: true });
  await seedFeatureFixtures(h.pg);
  for (const recipient of ["clinicAdmin", "doctor", "receptionist", "superAdmin"])
    for (const event of ["staff_mobile_otp", "staff_welcome", "staff_created_admin"]) await smsTemplate(event, recipient);
});
after(async () => await h?.close());

test("all direct-created roles commit password, scope and one occurrence without invitation or delivery prerequisites", async () => {
  h.mail.fail = true;
  const savedOrigin = process.env.CLINICFLOW_PUBLIC_ORIGIN; delete process.env.CLINICFLOW_PUBLIC_ORIGIN;
  const originalHost = process.env.SMTP_HOST; process.env.SMTP_HOST = "";
  try {
    for (const [role, actor] of [["doctor", "adm"], ["receptionist", "adm"], ["receptionist", "docu"], ["doctor", "sa"]]) {
      const name = `direct-${role}-${actor}`, result = await create(name, role, actor);
      const id = result.userId || result.id;
      assert.equal(result.invitationStatus, "notRequired");
      assert.equal(result.passwordEnabled, true);
      assert.deepEqual(result.staffCreationNotice, { email: "skipped", sms: "skipped" });
      assert.deepEqual(result.clinicIds, ["c1"]); assert.deepEqual(result.branchIds, ["b1"]);
      const [stored] = await rows("select * from users where id=$1", [id]);
      assert.match(stored.password_hash, /^\$argon2id\$/); assert.equal(stored.email_verified_at, null);
      assert(!JSON.stringify(stored.data).includes(password)); assert(!JSON.stringify(result).includes(password));
      ok(await h.call(null, "POST", "/auth/login", { email: input(name).email, password }));
      assert.equal((await rows("select count(*)::int n from auth_challenges where user_id=$1", [id]))[0].n, 0);
      assert.equal((await rows("select count(*)::int n from settings where id=$1", [`staff-created:${id}`]))[0].n, 1);
      assert.equal((await h.call(actor, "POST", role === "doctor" ? "/doctors" : "/users", { ...input(name), role })).status, 409);
    }
    assert.equal(h.mail.messages.length, 0);
  } finally { h.mail.fail = false; process.env.SMTP_HOST = originalHost; process.env.CLINICFLOW_PUBLIC_ORIGIN = savedOrigin; }
  const body = { requestId: randomUUID(), admin: { fullName: "Fictional Owner", email: "new-owner@test.invalid",
    mobile: "+919876543210", password, confirmPassword: password },
    clinic: { name: "Fictional Direct Clinic", slug: "fictional-direct", address: "Fictional Way", email: "front@test.invalid", phone: "+919876543210" },
    branches: [{ name: "Fictional Location", slug: "main", address: "Fictional Way", timezone: "Asia/Kolkata", inheritEmail: true, inheritPhone: true,
      openingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }] }],
    ownDoctor: true, ownerSchedule: { maxTokens: 8, consultationMinutes: 20, tokenPrefix: "A", queueMode: "mixed" } };
  const admin = ok(await h.call("sa", "POST", "/clinic-admin-onboarding", body), 201);
  assert(admin.doctorId); assert.equal(admin.admin.invitationStatus, "notRequired");
  ok(await h.call(null, "POST", "/auth/login", { email: body.admin.email, password }));
  const replay = ok(await h.call("sa", "POST", "/clinic-admin-onboarding", body), 201);
  assert.equal(replay.admin.id, admin.admin.id);
  assert.equal((await rows("select count(*)::int n from settings where id=$1", [`staff-created:${admin.admin.id}`]))[0].n, 1);
  assert(!JSON.stringify(await rows("select data from clinics where id=$1", [admin.clinic.id])).includes(password));
});

test("invalid credentials, permission and mixed-owner failures roll back without occurrences", async () => {
  for (const [actor, patch, status, path] of [
    ["adm", { confirmPassword: "different" }, 400, "/users"],
    ["adm", { password: "weak", confirmPassword: "weak" }, 400, "/users"],
    ["adm", { mobile: "9876543210" }, 400, "/users"],
    ["rec", {}, 403, "/users"], ["docu", {}, 403, "/doctors"],
    ["sa", { role: "superAdmin" }, 403, "/users"],
    ["adm", { clinicIds: ["c1", "c3"], branchIds: ["b1", "b3"] }, 409, "/users"],
  ]) {
    const name = `denied-${randomUUID()}`, email = `${name}@test.invalid`;
    const r = await h.call(actor, "POST", path, { ...input(name), role: "receptionist", ...patch });
    assert.equal(r.status, status, JSON.stringify(r.data));
    assert.equal((await rows("select count(*)::int n from users where email=$1", [email]))[0].n, 0);
  }
  const count = (await rows("select count(*)::int n from users"))[0].n;
  await h.pg.exec(`create function reject_staff_notice() returns trigger language plpgsql as $$ begin if NEW.id like 'staff-created:%' then raise exception 'fixture rollback'; end if; return NEW; end; $$;
    create trigger reject_staff_notice before insert on settings for each row execute function reject_staff_notice();`);
  try { assert.equal((await h.call("adm", "POST", "/users", { ...input("rolled-back"), role: "receptionist" })).status, 500); }
  finally { await h.pg.exec("drop trigger reject_staff_notice on settings; drop function reject_staff_notice();"); }
  assert.equal((await rows("select count(*)::int n from users"))[0].n, count);
});

test("actor-scoped creation receipts recover repeated and concurrent saves without exposing passwords", async () => {
  const body = { ...input("receipt-staff"), role: "receptionist", requestId: randomUUID() };
  const results = await Promise.all([h.call("adm", "POST", "/users", body), h.call("adm", "POST", "/users", body)]);
  const first = ok(results[0], 201), second = ok(results[1], 201);
  assert.equal(first.id, second.id);
  assert.equal(ok(await h.call("adm", "POST", "/users", body), 201).id, first.id);
  assert.equal((await h.call("adm", "POST", "/users", { ...body, fullName: "Different draft" })).status, 409);
  const receipt = await rows("select data from settings where id=$1", [`staff-create-receipt:adm:${body.requestId}`]);
  assert.equal(receipt.length, 1); assert(!JSON.stringify(receipt).includes(password));
  assert.equal((await rows("select count(*)::int n from settings where id=$1", [`staff-created:${first.id}`]))[0].n, 1);
});

test("first-login deferral and explicit independent proofs release exactly one welcome per channel", async () => {
  const staff = await create("verified-staff"), id = staff.id;
  let state = ok(await h.call(id, "GET", "/staff-verification"));
  assert.equal(state.promptRequired, true); assert.equal(state.emailVerified, false); assert.equal(state.mobileVerified, false);
  assert.equal(state.welcomeEmailStatus, "awaiting_verification");
  ok(await h.call(id, "POST", "/staff-verification/defer"));
  assert.equal(ok(await h.call(id, "GET", "/staff-verification")).promptRequired, false);
  const initialMail = h.mail.messages.length;
  const challenge = await request(id, "email"), otp = code("email");
  assert.equal(h.mail.messages.length, initialMail + 1);
  assert(!JSON.stringify(challenge).includes(otp));
  assert.equal((await h.call(id, "POST", "/staff-verification/request", { channel: "email" })).status, 429);
  assert.equal((await confirm("rec", "email", challenge, otp)).status, 400);
  assert.equal((await confirm(id, "sms", challenge, otp)).status, 400);
  assert.equal((await confirm(id, "email", challenge, "000000")).status, 400);
  const confirms = await Promise.all([confirm(id, "email", challenge, otp), confirm(id, "email", challenge, otp)]);
  assert.deepEqual(confirms.map(x => x.status).sort(), [200, 400]);
  state = ok(await h.call(id, "GET", "/staff-verification"));
  assert.equal(state.emailVerified, true); assert.equal(state.mobileVerified, false);
  const beforeSms = h.sms.messages.length;
  await Promise.all([h.dispatchStaffNotices(), h.dispatchStaffNotices()]);
  assert.equal(h.mail.messages.filter(m => m.to === staff.email && /Welcome to Digi-Q/.test(m.subject)).length, 1);
  assert.equal(h.sms.messages.length, beforeSms, "email proof cannot authorize SMS");
  const smsChallenge = await request(id, "sms");
  ok(await confirm(id, "sms", smsChallenge));
  await Promise.all([h.dispatchStaffNotices(), h.dispatchStaffNotices()]);
  assert.equal(h.sms.messages.filter(m => m.to === staff.mobile && /Fictional verified-staff/.test(m.text)).length, 1);
  assert.equal((await confirm(id, "sms", smsChallenge)).status, 400);
  assert.equal((await requestVerified(id, "email")).status, 409);
  const notices = await rows("select data from settings where id like $1", [`staff-account-notice:staff_welcome:${id}:%`]);
  assert.equal(notices.length, 2);
  assert(notices.every(n => n.data.state === "provider_accepted"));
  state = ok(await h.call(id, "GET", "/staff-verification"));
  assert.equal(state.welcomeEmailStatus, "provider_accepted"); assert.equal(state.welcomeSmsStatus, "provider_accepted");
  assert(!JSON.stringify(notices).includes(password));
});
function requestVerified(id, channel) { return h.call(id, "POST", "/staff-verification/request", { channel }); }

test("expired, exhausted and edited-contact codes fail; edits clear proof and cannot repeat welcomes", async () => {
  const staff = await create("contact-edit"), id = staff.id;
  let c = await request(id, "email"), otp = code("email");
  for (let i = 0; i < 5; i++) assert.equal((await confirm(id, "email", c, "000000")).status, 400);
  assert.equal((await confirm(id, "email", c, otp)).status, 400);
  await age(id, "email"); c = await request(id, "email"); otp = code("email");
  await h.pg.query("update auth_challenges set expires_at=now()-interval '1 second' where id=$1", [c.challengeId]);
  assert.equal((await confirm(id, "email", c, otp)).status, 400);
  c = await request(id, "sms"); otp = code("sms");
  ok(await h.call(id, "PATCH", "/me", { mobile: "+919876543211" }));
  assert.equal((await confirm(id, "sms", c, otp)).status, 400);
  assert.equal(ok(await h.call(id, "GET", "/staff-verification")).mobileVerified, false);
  await age(id, "sms"); c = await request(id, "sms"); ok(await confirm(id, "sms", c));
  const before = h.sms.messages.length;
  await h.dispatchStaffNotices();
  assert.equal(h.sms.messages.length, before + 1);
  ok(await h.call("adm", "PATCH", `/users/${id}`, { fullName: staff.fullName, email: staff.email, role: "receptionist", mobile: "+919876543212" }));
  assert.equal(ok(await h.call(id, "GET", "/staff-verification")).mobileVerified, false);
  await age(id, "sms"); c = await request(id, "sms"); ok(await confirm(id, "sms", c));
  const repeat = h.sms.messages.length; await h.dispatchStaffNotices();
  assert.equal(h.sms.messages.length, repeat, "contact changes never create another welcome");
});

test("admin notice only reaches actual creator's verified channels; unknown dispatch is never replayed", async () => {
  await h.pg.exec(`update users set email_verified_at=now(),mobile='+919876543219',
    data=data||'{"staffMobileProof":{"contact":"+919876543219","verifiedAt":"2026-01-01"}}'::jsonb where id='adm';`);
  const staff = await create("admin-notice");
  const mails = [], texts = [];
  await Promise.all([h.dispatchStaffNotices(async (...args) => { mails.push(args); }, async (...args) => { texts.push(args); return "delivery_unknown"; }),
    h.dispatchStaffNotices(async (...args) => { mails.push(args); }, async (...args) => { texts.push(args); return "delivery_unknown"; })]);
  assert.equal(mails.filter(x => x[0] === "adm@test.invalid").length, 1);
  assert.equal(texts.filter(x => x[1] === "+919876543219").length, 1);
  assert(!mails.some(x => ["sa@test.invalid", "adm2@test.invalid", staff.email].includes(x[0])));
  assert(!JSON.stringify([mails, texts]).includes(password));
  await h.dispatchStaffNotices(async (...args) => { mails.push(args); }, async (...args) => { texts.push(args); return "provider_accepted"; });
  assert.equal(texts.length, 1);
  const c = await request(staff.id, "email"); ok(await confirm(staff.id, "email", c));
  h.mail.fail = true;
  try { await h.dispatchStaffNotices(); } finally { h.mail.fail = false; }
  const n = h.mail.messages.length; await h.dispatchStaffNotices(); assert.equal(h.mail.messages.length, n);
  ok(await h.call(null, "POST", "/auth/login", { email: staff.email, password }));
});

test("legacy staff verification never backfills welcome; delivery disable leaves password login working", async () => {
  const c = await request("rec", "email"); ok(await confirm("rec", "email", c));
  assert.equal((await rows("select count(*)::int n from settings where id like 'staff-account-notice:staff_welcome:rec:%'"))[0].n, 0);
  const staff = await create("delivery-disabled");
  await h.pg.query("insert into settings(id,data) values($1,$2)", ["notification-template:platform:staff_email_otp", { revision: 1, activationEnabled: false }]);
  assert.equal((await h.call(staff.id, "POST", "/staff-verification/request", { channel: "email" })).status, 503);
  assert.equal(ok(await h.call(staff.id, "GET", "/staff-verification")).emailVerified, false);
  ok(await h.call(null, "POST", "/auth/login", { email: staff.email, password }));
});
