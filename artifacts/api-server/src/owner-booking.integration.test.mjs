import { before, after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createOwnerBookingHarness, ownerSetup, OWNER_PASSWORD, sessionDigest } from "./test-support/owner-booking-harness.mjs";

for (const sessionMode of ["native", "jwt"]) describe(`${sessionMode} consulting-owner booking`, { concurrency: false }, () => {
let h, superCookie;
const owners = [];
before(async () => {
  h = await createOwnerBookingHarness({ sessionMode });
  superCookie = await h.login("super@owner.test.invalid");
});
after(async () => { await h?.close(); });
const ok = (response, status = 200) => {
  assert.equal(response.status, status, JSON.stringify(response.data));
  return response.data;
};
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

for (const path of ["self", "admin"]) {
  test(`${path}: owner retains admin identity, discovers own doctor and persists tickets with immediate and fresh sessions`, async () => {
    const email = `${path}@owner.test.invalid`, input = ownerSetup(path);
    let cookie, saved;
    if (path === "self") {
      cookie = await h.register(email);
      saved = ok(await h.as(cookie, "POST", "/clinic-registration", {
        ...input, fullName: "Fictional Self Owner", password: OWNER_PASSWORD,
      }), 201);
    } else {
      saved = ok(await h.as(superCookie, "POST", "/clinic-admin-onboarding", {
        ...input, admin: { email, fullName: "Fictional Invited Owner" },
      }), 201);
      cookie = await h.acceptInvitation(email);
    }
    const clinicId = saved.clinic.id, branchId = saved.branches[0].id, doctorId = saved.doctorId;
    assert.ok(doctorId);
    const persisted = (await h.pg.query("select user_id,owner_admin_id,data from doctors where id=$1", [doctorId])).rows[0];
    assert.equal(persisted.user_id, persisted.owner_admin_id);
    assert.deepEqual(persisted.data.branchIds, [branchId]);
    for (const label of ["immediate", "fresh"]) {
      // Finish the immediate journey before a new login can mask stale onboarding state.
      const session = label === "immediate" ? cookie : await h.login(email);
      if (label === "fresh") assert.notEqual(session, cookie, "Fresh login issues an independent session");
      const identity = ok(await h.as(session, "GET", "/me"));
      assert.equal(identity.user.role, "clinicAdmin");
      assert.equal(identity.doctorId, doctorId);
      assert.equal(identity.user.id, persisted.user_id);
      const list = ok(await h.as(session, "GET", `/doctors?clinicId=${clinicId}&branchId=${branchId}&status=active&pageSize=20`));
      assert.equal(list.total, 1);
      assert.equal(list.items[0].id, doctorId);
      assert.deepEqual(list.items[0].branchIds, [branchId]);
      const patient = ok(await h.as(session, "POST", "/patients", {
        fullName: `Fictional ${label} Owner Patient`, clinicId, branchId,
      }), 201);
      const savedPatient = (await h.pg.query("select clinic_id,branch_id from patients where id=$1", [patient.id])).rows[0];
      assert.equal(savedPatient.clinic_id, clinicId);
      assert.equal(savedPatient.branch_id, branchId);
      const sessions = ok(await h.as(session, "GET", `/public/availability/sessions?doctorId=${doctorId}&branchId=${branchId}&date=${tomorrow()}`));
      assert.ok(sessions.length);
      const booking = ok(await h.as(session, "POST", "/appointments", {
        clinicId, branchId, doctorId, patientId: patient.id, date: tomorrow(), sessionId: sessions[0].sessionId,
        source: "phone", consent: true, requestId: crypto.randomUUID(),
      }), 201);
      assert.equal(booking.doctorId, doctorId);
      assert.equal(booking.branchId, branchId);
      assert.ok(booking.reference);
      assert.ok(booking.token);
      const stored = (await h.pg.query("select doctor_id,clinic_id,branch_id,patient_id,data from appointments where id=$1", [booking.id])).rows[0];
      assert.equal(stored.doctor_id, doctorId);
      assert.equal(stored.clinic_id, clinicId);
      assert.equal(stored.branch_id, branchId);
      assert.equal(stored.patient_id, patient.id);
      assert.equal(stored.data.reference, booking.reference);
      assert.equal(stored.data.token, booking.token);
      if (label === "immediate") owners.push({ cookie, email, clinicId, branchId, doctorId, patientId: patient.id });
    }
  });
}

test("administrative ownership never grants unselected/foreign consultation membership; inactive profiles/accounts cannot book", async () => {
  assert.equal(owners.length, 2);
  const owner = owners[0], foreign = owners[1];
  const extra = ok(await h.as(owner.cookie, "POST", "/branches", {
    clinicId: owner.clinicId, name: "Fictional Unselected Location", slug: "unselected", address: "Fictional Road", timezone: "UTC",
  }), 201);
  const list = async (clinicId, branchId, cookie = owner.cookie) =>
    ok(await h.as(cookie, "GET", `/doctors?clinicId=${clinicId}&branchId=${branchId}&status=active`));
  assert.equal((await list(owner.clinicId, extra.id)).total, 0);
  assert.equal((await list(foreign.clinicId, foreign.branchId)).total, 0);
  for (const [clinicId, branchId] of [[owner.clinicId, extra.id], [foreign.clinicId, foreign.branchId]]) {
    const rejected = await h.as(owner.cookie, "POST", "/appointments", {
      clinicId, branchId, doctorId: owner.doctorId, patientId: owner.patientId,
      date: tomorrow(), source: "phone", consent: true,
    });
    assert.ok([400, 403, 409].includes(rejected.status), JSON.stringify(rejected.data));
  }
  await h.pg.query("update doctors set status='inactive' where id=$1", [owner.doctorId]);
  assert.equal((await list(owner.clinicId, owner.branchId)).total, 0);
  assert.equal(ok(await h.as(owner.cookie, "GET", `/public/doctors?clinicId=${owner.clinicId}&branchId=${owner.branchId}`)).total, 0);
  const inactiveBooking = await h.as(owner.cookie, "POST", "/appointments", {
    clinicId: owner.clinicId, branchId: owner.branchId, doctorId: owner.doctorId, patientId: owner.patientId,
    date: tomorrow(), source: "phone", consent: true,
  });
  assert.equal(inactiveBooking.status, 409, JSON.stringify(inactiveBooking.data));
  await h.pg.query("update doctors set status='active' where id=$1", [owner.doctorId]);
  // The actual ownership guard prohibits deactivating a clinic-owning admin;
  // do not disable it just to manufacture an impossible inactive-owner fixture.
  await assert.rejects(h.pg.query("update users set status='inactive' where email=$1", [owner.email]),
    /Transfer clinic and doctor ownership/);
  const adminId = (await h.pg.query("select admin_id from clinics where id=$1", [owner.clinicId])).rows[0].admin_id;
  // Deferred ownership guards validate the complete user/profile pair at commit.
  await h.pg.exec("BEGIN");
  await h.pg.query("insert into users(id,email,full_name,role,status) values('inactive-staff','inactive@owner.test.invalid','Fictional Inactive Doctor','doctor','inactive')");
  await h.pg.query("insert into doctors(id,user_id,owner_admin_id) values('inactive-profile','inactive-staff',$1)", [adminId]);
  await h.pg.query("insert into assignments(id,user_id,clinic_id,branch_id) values('inactive-link','inactive-staff',$1,$2)", [owner.clinicId, owner.branchId]);
  await h.pg.exec("COMMIT");
  const activeList = await list(owner.clinicId, owner.branchId, superCookie);
  assert.deepEqual(activeList.items.map(item => item.id), [owner.doctorId]);
  const inactiveAccountBooking = await h.as(owner.cookie, "POST", "/appointments", {
    clinicId: owner.clinicId, branchId: owner.branchId, doctorId: "inactive-profile", patientId: owner.patientId,
    date: tomorrow(), source: "phone", consent: true,
  });
  assert.equal(inactiveAccountBooking.status, 409, JSON.stringify(inactiveAccountBooking.data));
});

test("admin-only onboarding creates no doctor and does not inherit another actor's directory", async () => {
  const input = ownerSetup("admin-only", false);
  const saved = ok(await h.as(superCookie, "POST", "/clinic-admin-onboarding", {
    ...input, admin: { email: "admin-only@owner.test.invalid", fullName: "Fictional Non Consulting Owner" },
  }), 201);
  assert.ok(!saved.doctorId);
  assert.equal((await h.pg.query("select id from doctors where user_id=$1", [saved.admin.id])).rows.length, 0);
  const cookie = await h.acceptInvitation("admin-only@owner.test.invalid");
  const identity = ok(await h.as(cookie, "GET", "/me"));
  assert.equal(identity.user.role, "clinicAdmin");
  assert.ok(!identity.doctorId);
  const list = ok(await h.as(cookie, "GET", `/doctors?clinicId=${saved.clinic.id}&branchId=${saved.branches[0].id}&status=active`));
  assert.equal(list.total, 0);
  const foreign = ok(await h.as(cookie, "GET", `/doctors?clinicId=${owners[1].clinicId}&branchId=${owners[1].branchId}&status=active`));
  assert.equal(foreign.total, 0);
});

test("missing sessions do not remove the owner from doctor discovery or prevent independent patient registration", async () => {
  const owner = owners[0];
  assert.ok(owner);
  await h.pg.query("update schedules set status='inactive' where doctor_id=$1", [owner.doctorId]);
  const directory = ok(await h.as(owner.cookie, "GET",
    `/doctors?clinicId=${owner.clinicId}&branchId=${owner.branchId}&status=active`));
  assert.deepEqual(directory.items.map(item => item.id), [owner.doctorId]);
  const sessions = ok(await h.as(owner.cookie, "GET",
    `/public/availability/sessions?doctorId=${owner.doctorId}&branchId=${owner.branchId}&date=${tomorrow()}`));
  assert.deepEqual(sessions, []);
  const patient = ok(await h.as(owner.cookie, "POST", "/patients", {
    fullName: "Fictional Registered Without Booking", clinicId: owner.clinicId, branchId: owner.branchId,
  }), 201);
  assert.ok(patient.id);
  const appointments = (await h.pg.query("select id from appointments where patient_id=$1", [patient.id])).rows;
  assert.deepEqual(appointments, []);
});

test("revoked sessions cannot discover scoped doctors, create patients or persist bookings", async () => {
  const owner = owners[1], cookie = await h.login(owner.email);
  ok(await h.as(cookie, "POST", "/auth/logout"));
  const row = (await h.pg.query("select revoked_at from auth_sessions where token_hash=$1", [sessionDigest(cookie)])).rows[0];
  assert.ok(row.revoked_at, "The real logout handler must persist revocation");
  await assertRejectedSession(cookie, owner);
});

if (sessionMode === "jwt") test("correctly signed wrong-subject JWT cannot use another owner's saved session or broaden clinic scope", async () => {
  const owner = owners[0], foreign = owners[1], cookie = await h.login(owner.email);
  const ownerId = (await h.pg.query("select user_id from doctors where id=$1", [owner.doctorId])).rows[0].user_id;
  const foreignId = (await h.pg.query("select user_id from doctors where id=$1", [foreign.doctorId])).rows[0].user_id;
  assert.notEqual(ownerId, foreignId);
  const wrong = await h.wrongSubjectCookie(cookie, foreignId);
  await h.pg.query("update auth_sessions set token_hash=$1 where token_hash=$2 and user_id=$3",
    [sessionDigest(wrong), sessionDigest(cookie), ownerId]);
  const bound = (await h.pg.query("select user_id,revoked_at,expires_at from auth_sessions where token_hash=$1", [sessionDigest(wrong)])).rows[0];
  assert.equal(bound.user_id, ownerId);
  assert.equal(bound.revoked_at, null);
  assert.ok(bound.expires_at > new Date());
  try {
    await assertRejectedSession(wrong, owner);
    await assertRejectedSession(wrong, foreign);
  } finally {
    await h.pg.query("update auth_sessions set token_hash=$1 where token_hash=$2",
      [sessionDigest(cookie), sessionDigest(wrong)]);
  }
  assert.equal(ok(await h.as(cookie, "GET", "/me")).user.id, ownerId);
});

async function assertRejectedSession(cookie, owner) {
  const before = (await h.pg.query("select (select count(*) from patients) as patients, (select count(*) from appointments) as appointments")).rows[0];
  for (const [method, path, body] of [
    ["GET", "/me"],
    ["GET", `/doctors?clinicId=${owner.clinicId}&branchId=${owner.branchId}&status=active`],
    ["POST", "/patients", { fullName: "Fictional Rejected Patient", clinicId: owner.clinicId, branchId: owner.branchId }],
    ["POST", "/appointments", {
      clinicId: owner.clinicId, branchId: owner.branchId, doctorId: owner.doctorId, patientId: owner.patientId,
      date: tomorrow(), source: "phone", consent: true, requestId: crypto.randomUUID(),
    }],
  ]) {
    const result = await h.as(cookie, method, path, body);
    assert.equal(result.status, 401, `${method} ${path}: ${JSON.stringify(result.data)}`);
  }
  const after = (await h.pg.query("select (select count(*) from patients) as patients, (select count(*) from appointments) as appointments")).rows[0];
  assert.deepEqual(after, before, "Rejected sessions must not leave patient or appointment rows");
}
});
