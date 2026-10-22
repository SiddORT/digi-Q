import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createOwnerBookingHarness, ownerSetup, OWNER_PASSWORD } from "./test-support/owner-booking-harness.mjs";

let h, superCookie;
before(async () => {
  h = await createOwnerBookingHarness();
  superCookie = await h.login("super@owner.test.invalid");
});
after(async () => { await h?.close(); });
const ok = (response, status = 200) => {
  assert.equal(response.status, status, JSON.stringify(response.data));
  return response.data;
};
async function setup(mode, name, consults = true) {
  const email = `contract-${name}@owner.test.invalid`;
  const input = ownerSetup(`contract-${name}`, consults);
  // These cases deliberately prove that doctor eligibility is not a schedule.
  delete input.ownerSchedule;
  const cookie = mode === "self" ? await h.register(email) : superCookie;
  const route = mode === "self" ? "/clinic-registration" : "/clinic-admin-onboarding";
  const body = mode === "self"
    ? { ...input, fullName: `Fictional ${name}`, password: OWNER_PASSWORD }
    : { ...input, admin: { email, fullName: `Fictional ${name}` } };
  return { email, cookie, route, body, response: await h.as(cookie, "POST", route, body) };
}

for (const mode of ["self", "admin"]) {
  test(`${mode}: consulting onboarding immediately persists one owner profile, retained after adding doctor and receptionist`, async () => {
    const fixture = await setup(mode, `${mode}-staff`);
    const saved = ok(fixture.response, 201);
    const cookie = mode === "self" ? fixture.cookie : await h.acceptInvitation(fixture.email);
    const me = ok(await h.as(cookie, "GET", "/me"));
    assert.equal(me.user.role, "clinicAdmin");
    assert.equal(me.doctorId, saved.doctorId);
    assert.ok(me.doctorId, "No second enable action is used");
    const clinicId = saved.clinic.id, branchId = saved.branches[0].id;
    const receptionist = ok(await h.as(cookie, "POST", "/users", {
      fullName: "Fictional Receptionist", email: `${mode}-receptionist@owner.test.invalid`,
      role: "receptionist", status: "active", clinicIds: [clinicId], branchIds: [branchId],
    }), 201);
    assert.equal(receptionist.role, "receptionist");
    const colleague = ok(await h.as(cookie, "POST", "/doctors", {
      fullName: "Fictional Colleague", email: `${mode}-doctor@owner.test.invalid`,
      status: "active", clinicIds: [clinicId], branchIds: [branchId],
    }), 201);
    for (const actor of [cookie, await h.login(fixture.email), superCookie]) {
      const doctors = ok(await h.as(actor, "GET", `/doctors?clinicId=${clinicId}&branchId=${branchId}&status=active&pageSize=20`));
      assert.equal(doctors.total, 2);
      assert.deepEqual(doctors.items.map(d => d.id).sort(), [me.doctorId, colleague.id].sort());
      assert.equal(doctors.items.find(d => d.id === me.doctorId).fullName, `Fictional ${mode}-staff`);
    }
    const identity = ok(await h.as(cookie, "GET", "/me"));
    assert.equal(identity.user.role, "clinicAdmin");
    assert.equal(identity.doctorId, me.doctorId);
    const profiles = (await h.pg.query("select id, owner_admin_id, data from doctors where user_id=$1", [me.user.id])).rows;
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].owner_admin_id, me.user.id);
    assert.deepEqual(profiles[0].data.branchIds, [branchId]);
    assert.equal((await h.pg.query("select id from schedules where doctor_id=$1", [me.doctorId])).rows.length, 0);
  });

  test(`${mode}: non-consulting onboarding does not silently turn every Clinic Admin into a doctor`, async () => {
    const fixture = await setup(mode, `${mode}-admin-only`, false);
    const saved = ok(fixture.response, 201);
    const cookie = mode === "self" ? fixture.cookie : await h.acceptInvitation(fixture.email);
    const me = ok(await h.as(cookie, "GET", "/me"));
    assert.equal(me.user.role, "clinicAdmin");
    assert.equal(me.doctorId, null);
    assert.equal(saved.doctorId, null);
    assert.equal((await h.pg.query("select id from doctors where user_id=$1", [me.user.id])).rows.length, 0);
  });

  test(`${mode}: completion cannot report success after its requested profile is lost`, async () => {
    const fixture = await setup(mode, `${mode}-lost`);
    const saved = ok(fixture.response, 201);
    await h.pg.query(`update doctors set status='retired', user_id=null,
      owner_admin_id=null, retired_at=now(), data='{}' where id=$1`, [saved.doctorId]);
    const completion = await h.as(fixture.cookie, "GET", `${fixture.route}/completion?requestId=${fixture.body.requestId}`);
    assert.equal(completion.status, 409, JSON.stringify(completion.data));
    assert.match(completion.data.error, /Do not repeat registration/);
    const replay = await h.as(fixture.cookie, "POST", fixture.route, fixture.body);
    assert.equal(replay.status, 409, JSON.stringify(replay.data));
    assert.equal((await h.pg.query("select id from clinics where id=$1", [saved.clinic.id])).rows.length, 1);
    assert.equal((await h.pg.query("select id from doctors where id=$1", [saved.doctorId])).rows.length, 1);
  });

  test(`${mode}: completion requires the saved consulting locations, not merely an existing profile`, async () => {
    const fixture = await setup(mode, `${mode}-membership-lost`);
    const saved = ok(fixture.response, 201);
    const receipt = (await h.pg.query("select data->'registrationReceipt' as receipt from clinics where id=$1", [saved.clinic.id])).rows[0].receipt;
    assert.deepEqual(receipt.consultingBranchIds, saved.branches.map(branch => branch.id));
    ok(await h.as(fixture.cookie, "POST", "/branches", {
      clinicId: saved.clinic.id, name: "Fictional Later Location",
      slug: "later", address: "Fictional Road", timezone: "UTC",
    }), 201);
    const before = ok(await h.as(fixture.cookie, "GET", `${fixture.route}/completion?requestId=${fixture.body.requestId}`));
    assert.equal(before.result.doctorId, saved.doctorId,
      "A later administrative location does not expand the original consulting selection");
    await h.pg.query("update doctors set data=jsonb_set(data,'{branchIds}','[]'::jsonb) where id=$1", [saved.doctorId]);
    for (const [method, path, body] of [
      ["GET", `${fixture.route}/completion?requestId=${fixture.body.requestId}`],
      ["POST", fixture.route, fixture.body],
    ]) {
      const response = await h.as(fixture.cookie, method, path, body);
      assert.equal(response.status, 409, JSON.stringify(response.data));
      assert.match(response.data.error, /location membership/);
    }
    // Legacy receipts do not invent consent; neither may they claim a profile
    // is usable at this clinic when it has no clinical membership.
    await h.pg.query(`update clinics set data=jsonb_set(data,'{registrationReceipt}',
      (data->'registrationReceipt') - 'ownDoctor' - 'consultingBranchIds') where id=$1`, [saved.clinic.id]);
    const legacy = ok(await h.as(fixture.cookie, "GET", `${fixture.route}/completion?requestId=${fixture.body.requestId}`));
    assert.equal(legacy.result.doctorId, null);
    const stored = (await h.pg.query("select data->'branchIds' as ids from doctors where id=$1", [saved.doctorId])).rows[0];
    assert.deepEqual(stored.ids, [], "Completion reads must not restore or broaden membership");
  });
}

test("registration rolls back rather than completing with a consulting profile missing its locations", async () => {
  await h.pg.exec(`create function contract_omit_locations() returns trigger language plpgsql as $$
    begin
      new.data := jsonb_set(new.data, '{branchIds}', '[]'::jsonb);
      return new;
    end $$;
    create trigger contract_omit_locations before insert on doctors
    for each row execute function contract_omit_locations();`);
  try {
    const fixture = await setup("admin", "corrupt");
    assert.equal(fixture.response.status, 409, JSON.stringify(fixture.response.data));
    assert.match(fixture.response.data.error, /Registration was not completed/);
    assert.equal((await h.pg.query("select id from users where email=$1", [fixture.email])).rows.length, 0);
    assert.equal((await h.pg.query("select id from clinics where data->>'name'=$1", [fixture.body.clinic.name])).rows.length, 0);
  } finally {
    await h.pg.exec("drop trigger contract_omit_locations on doctors; drop function contract_omit_locations();");
  }
});
