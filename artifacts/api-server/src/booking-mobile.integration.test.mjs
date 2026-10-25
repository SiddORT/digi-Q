import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h, today, future;
const cookies = {};
process.env.AUTH_SESSION_MODE = "native";
const mobile = "+919876543219";
const replacement = "+14155552671";
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; };
const call = (actor, method, path, body) => h.call(null, method, path, body, actor ? { cookie: cookies[actor] } : {});
before(async () => {
  h = await createFeatureHarness({ bookingLookups: true, administration: true, postgres: true, fakeBookingMail: true });
  await seedFeatureFixtures(h.pg);
  for (const actor of ["sa", "adm", "rec", "docu", "patu", "adm2"]) {
    const token = createHash("sha256").update(randomUUID()).digest("base64url");
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)", [
      createHash("sha256").update(token).digest("hex"), actor, new Date(Date.now() + 3600000),
    ]);
    cookies[actor] = `digiq_session=${token}`;
  }
  today = new Date().toISOString().slice(0, 10);
  future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await h.pg.exec(`insert into settings(id,data) values('platform','{"notificationsEnabled":false,"requireMobileVerification":false}');
    update branches set data=data||'{"timezone":"UTC"}'::jsonb where id='b1';
    insert into qrs(id,clinic_id,branch_id,doctor_id,public_reference,data) values('contact-qr','c1','b1','d1','contact-public','{}');`);
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    ok(await call("adm", "POST", "/schedules", {
      clinicId: "c1", branchId: "b1", doctorId: "d1", dayOfWeek, isOpen: true,
      startTime: "00:00", endTime: "23:59", timezone: "UTC", maxTokens: 200,
      tokenPrefix: "M", consultationMinutes: 1, queueMode: "mixed",
    }), 201);
  }
});
after(async () => h?.close());
async function patient(linked = false) {
  const id = randomUUID(), userId = linked ? randomUUID() : null;
  if (linked) await h.pg.query("insert into users(id,email,full_name,role,mobile,data) values($1,$2,'Fictional Account','patient','+919876543210',$3)", [
    userId, `${userId}@test.invalid`, { mobileVerified: true },
  ]);
  await h.pg.query("insert into patients(id,user_id,clinic_id,branch_id,mobile,data) values($1,$2,'c1','b1',$3,$4)", [
    id, userId, linked ? "+919876543210" : null, { fullName: "Fictional Contact Patient", mobileVerified: linked },
  ]);
  return id;
}
const payload = patientId => ({
  patientId, doctorId: "d1", clinicId: "c1", branchId: "b1", date: today,
  source: "walkIn", bookingMobile: replacement, requestId: randomUUID(),
});
test("every staff role saves edited walk-in contact for linked and unlinked patients without changing profiles or accounts", async () => {
  for (const actor of ["sa", "adm", "rec", "docu"]) for (const linked of [false, true]) {
    const patientId = await patient(linked);
    const before = (await h.pg.query("select * from patients where id=$1", [patientId])).rows[0];
    const account = linked ? (await h.pg.query("select * from users where id=$1", [before.user_id])).rows[0] : null;
    const body = payload(patientId);
    const created = ok(await call(actor, "POST", "/appointments", body), 201);
    assert.equal(created.bookingMobile, replacement);
    assert.equal(created.bookingContactSource, "staff");
    assert.equal(ok(await call(actor, "GET", `/appointments/${created.id}`)).bookingMobile, replacement);
    const stored = (await h.pg.query("select data from appointments where id=$1", [created.id])).rows[0].data;
    assert.equal(stored.bookingMobile, replacement);
    assert.equal(stored.mobileVerified, undefined);
    assert.deepEqual((await h.pg.query("select * from patients where id=$1", [patientId])).rows[0], before);
    if (linked) assert.deepEqual((await h.pg.query("select * from users where id=$1", [before.user_id])).rows[0], account);
    assert.equal(ok(await call(actor, "POST", "/appointments", body), 201).id, created.id);
    assert.equal((await call(actor, "POST", "/appointments", { ...body, bookingMobile: mobile })).status, 409);
  }
});
test("missing, blank and malformed contacts cannot bypass creation in any staff mode", async () => {
  for (const actor of ["sa", "adm", "rec", "docu"]) for (const source of ["walkIn", "phone"]) {
    const body = { ...payload(await patient()), source, date: source === "phone" ? future : today };
    for (const bookingMobile of [undefined, null, "", " ", "1234", "+123456789", "+919876543210oops"]) {
      assert.equal((await call(actor, "POST", "/appointments", { ...body, bookingMobile })).status, 400, `${actor} ${source} ${bookingMobile}`);
    }
    ok(await call(actor, "POST", "/appointments", { ...body, bookingMobile: mobile }), 201);
  }
});
test("patient self-booking requires a visit contact while scope, source and verification policy remain separate", async () => {
  const body = { ...payload("p1"), date: future, source: "online", termsAccepted: true };
  assert.equal((await call("patu", "POST", "/appointments", { ...body, bookingMobile: "" })).status, 400);
  assert.equal((await call("patu", "POST", "/appointments", { ...body, source: "walkIn" })).status, 403);
  assert.equal((await call("adm2", "POST", "/appointments", body)).status, 403);
  await h.pg.exec(`update settings set data=data||'{"requireMobileVerification":true}'::jsonb where id='platform'`);
  assert.equal((await call("patu", "POST", "/appointments", body)).status, 403);
  await h.pg.exec(`update settings set data=data||'{"requireMobileVerification":false}'::jsonb where id='platform'`);
  const saved = ok(await call("patu", "POST", "/appointments", body), 201);
  assert.equal(saved.bookingContactSource, "patient");
  assert.equal(saved.bookingMobile, replacement);
  assert.equal((await call("docu", "POST", "/patients", { fullName: "Forbidden", clinicId: "c1", branchId: "b1" })).status, 403);
  assert.equal((await call(null, "POST", "/appointments", body)).status, 401);
  // Historical contactless records are reads, not new booking validation.
  assert.equal(ok(await call("rec", "GET", "/appointments/a1")).id, "a1");
});
test("public guest creation requires mobile, retains retry identity, and does not claim verification", async () => {
  const body = {
    qrReference: "contact-public", branchId: "b1", doctorId: "d1", date: future,
    fullName: "Fictional Guest Contact", requestId: randomUUID(), receiptSecret: "c".repeat(64),
  };
  for (const mobile of [undefined, null, "", " ", "1234", "+123456789"]) {
    assert.equal((await call(null, "POST", "/public/guest-requests", { ...body, mobile })).status, 400);
  }
  const saved = ok(await call(null, "POST", "/public/guest-requests", { ...body, mobile }), 201);
  assert.equal(ok(await call(null, "POST", "/public/guest-requests", { ...body, mobile }), 201).id, saved.id);
  assert.equal((await call(null, "POST", "/public/guest-requests", { ...body, mobile: replacement })).status, 409);
  const appointment = (await h.pg.query("select data,patient_id from appointments where id=$1", [saved.appointmentId])).rows[0];
  assert.equal(appointment.data.bookingMobile, mobile);
  assert.equal(appointment.data.bookingContactSource, "guest");
  const p = (await h.pg.query("select user_id,data from patients where id=$1", [appointment.patient_id])).rows[0];
  assert.equal(p.user_id, null);
  assert.ok(!p.data.mobileVerified);
  assert.equal(ok(await call(null, "POST", "/public/guest-receipt", { receiptSecret: body.receiptSecret })).appointmentId, saved.appointmentId);
});
