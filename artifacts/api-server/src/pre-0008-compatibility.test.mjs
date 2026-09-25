import assert from "node:assert/strict";
import { test, after } from "node:test";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

const h = await createQueueHarness({ pre0008: true });
after(() => h.close());

test("disposable database uses the production pre-0008 function bodies and keeps ownership triggers", async () => {
  const expected = {
    clinicflow_assert_staff_owner: "d8c72a37bbd4881f82755133b5738eef38bc3bc7adaf41b0e53cffd4e4cf8b5a",
    enforce_clinicflow_assignment: "2f07199e1ac353b5f7e5cce218edad564743b6cbd1278f07074894099c43d6c2",
    enforce_clinicflow_doctor_owner: "23ae5bdcc80e8122186bad3eab9c302ed160610823b983fb5116da3bd2124b8a",
    protect_clinicflow_admin_account: "e619d399445435eb831a0b138456f91da5a761a61b24cbdab9360233af63f648",
  };
  const functions = (await h.control.query(`select proname, encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') as hash
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and proname=any($1::text[])`, [Object.keys(expected)])).rows;
  assert.equal(functions.length, 4);
  for (const row of functions) assert.equal(row.hash, expected[row.proname], row.proname);
  const triggers = (await h.control.query(`select tgname, tgenabled from pg_trigger where not tgisinternal and tgname in
    ('clinics_admin_guard','clinics_admin_assignment','assignments_admin_guard','assignments_admin_delete_guard','doctors_owner_guard','users_admin_account_guard',
     'assignment_owner_guard','doctor_manager_guard','receptionist_manager_guard','clinic_owner_guard')`)).rows;
  assert.equal(triggers.length, 10);
  assert.ok(triggers.every(row => row.tgenabled === "O"));
});

test("solo clinic creation and attach use one active identity with clinic-only ownership", async () => {
  await h.seed();
  const { api, t, db } = h;
  assert.equal(api.CONSULTING_ADMIN_ENABLED, true);
  const admin = await api.one(t.users, "admin");
  const input = { clinic: { name: "Safe Clinic", address: "Road", slug: "safe-clinic" }, branches: [{ name: "Main", address: "Road", slug: "main-safe" }] };
  const result = await db.transaction(tx => api.createOwnedClinic(admin, admin, { ...input, ownDoctor: true }, tx));
  assert.ok(result.doctorId);
  assert.equal((await api.all(t.assignments)).filter(a => a.userId === admin.id && a.clinicId === result.clinic.id && a.branchId === null).length, 1);
  assert.equal((await api.all(t.assignments)).filter(a => a.userId === admin.id && a.branchId).length, 0);
  assert.equal((await api.all(t.doctors)).filter(d => d.userId === admin.id).length, 1);
  assert.deepEqual((await api.one(t.doctors, result.doctorId)).branchIds, [result.branches[0].id]);
  assert.equal((await api.one(t.users, admin.id)).role, "clinicAdmin");
  const second = await db.transaction(tx => api.attachOwnDoctor(admin, { branchIds: [result.branches[0].id] }, tx));
  assert.equal(second.id, result.doctorId);
  await db.transaction(tx => api.change(t.branches, "b", { status: "inactive" }, tx));
  await assert.rejects(db.transaction(tx => api.attachOwnDoctor(admin, { branchIds: ["b"] }, tx)), /own clinic/);
  await db.transaction(tx => api.change(t.branches, "b", { status: "active" }, tx));
  assert.equal((await api.all(t.doctors)).filter(d => d.userId === admin.id).length, 1);
  await assert.rejects(db.transaction(async tx => {
    await api.createOwnedClinic(admin, admin, { clinic: { name: "Rollback", address: "Road", slug: "rollback-safe" }, branches: [] }, tx);
    throw Error("rollback probe");
  }), /rollback probe/);
  assert.equal((await api.all(t.clinics)).some(c => c.slug === "rollback-safe"), false);
  assert.equal((await api.all(t.clinics)).some(c => c.id === result.clinic.id), true);
  assert.equal((await api.all(t.doctors)).some(d => d.id === "d"), true);
});

test("generic doctor and linked admin mutations cannot forge ownership; ordinary doctor workflow is unchanged", async () => {
  const { api, t, db } = h;
  const actor = { id: "super", role: "superAdmin", clinicIds: ["c"], branchIds: ["b"] };
  const ordinary = await api.one(t.doctors, "d");
  await api.authorizeWrite(actor, "doctors", { fullName: "Doctor" }, { ...ordinary, clinicIds: ["c"], branchIds: ["b"] });
  await api.authorizeWrite(actor, "users", { fullName: "Admin" }, { ...(await api.one(t.users, "admin")), clinicIds: ["c"] });
  await assert.rejects(api.authorizeWrite(actor, "doctors", { userId: "admin" }), /identity cannot be reassigned/);
  await db.transaction(async tx => {
    await api.put(t.doctors, { id: "legacy-admin-doctor", userId: "admin", ownerAdminId: "admin" }, tx);
  });
  const legacy = { ...(await api.one(t.doctors, "legacy-admin-doctor")), clinicIds: ["c"], branchIds: [] };
  for (const body of [{}, { fullName: "Changed" }, { ownerAdminId: "other" }, { status: "inactive" }, { branchIds: ["b"] }]) {
    await assert.rejects(api.authorizeWrite(actor, "doctors", body, legacy), /Only the owning Clinic Admin/);
  }
  await api.authorizeWrite(actor, "users", { status: "inactive" }, { ...(await api.one(t.users, "admin")), clinicIds: ["c"] });
  await assert.rejects(api.authorizeWrite(actor, "users", { role: "doctor" }, { ...(await api.one(t.users, "admin")), clinicIds: ["c"] }), /roles cannot be switched/);
  assert.equal((await api.one(t.doctors, legacy.id)).status, "active");
  assert.equal((await api.one(t.users, "admin")).role, "clinicAdmin");
  // Old SQL really rejects the consulting branch mapping while preserving the
  // admin's clinic-only mapping and an ordinary doctor's branch mapping.
  await assert.rejects(db.transaction(tx => api.put(t.assignments, { id: "forbidden-admin-branch", userId: "admin", clinicId: "c", branchId: "b" }, tx)), e => /must match the clinic administrator/.test(e.cause?.message || e.message));
  assert.equal((await api.all(t.assignments)).some(a => a.id === "forbidden-admin-branch"), false);
  assert.ok((await api.all(t.assignments)).some(a => a.userId === "du" && a.branchId === "b"));
});

test("pre-0008 clinical membership is selected-branch-only across public, availability and schedules", async () => {
  await h.seed();
  const { api, t, db } = h;
  const admin = await api.one(t.users, "admin");
  const own = await db.transaction(tx => api.attachOwnDoctor(admin, { branchIds: ["b"] }, tx));
  assert.deepEqual(await api.clinicalBranchIds(own.id), ["b"]);
  assert.equal(await api.isClinicalMember(own.id, "b"), true);
  assert.equal(await api.isClinicalMember(own.id, "b2"), false);
  assert.equal(await api.isClinicalMember("d", "b"), true);
  assert.equal(await api.isClinicalMember("d", "b2"), false);
  const listed = await api.queryPage({ role: "superAdmin" }, "doctors", { branchId: "b" });
  assert.ok(listed.items.some(d => d.id === own.id));
  assert.equal((await api.queryPage({ role: "superAdmin" }, "doctors", { branchId: "b2" })).items.some(d => d.id === own.id), false);
  const discovery = await h.route(api.publicRouter, "get", "/public/doctors", admin, {}, {}, { branchId: "b" });
  assert.ok(discovery.items.some(d => d.id === own.id));
  const other = await h.route(api.publicRouter, "get", "/public/doctors", admin, {}, {}, { branchId: "b2" });
  assert.equal(other.items.some(d => d.id === own.id), false);
  const day = new Date().getUTCDay();
  await api.put(t.schedules, { id: "solo-session", doctorId: own.id, clinicId: "c", branchId: "b", dayOfWeek: day,
    data: { isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "UTC", maxTokens: 2 } });
  await api.doctorContext(own.id, "b");
  await assert.rejects(api.doctorContext(own.id, "b2"), /not assigned/);
  const schedule = await api.queryPage({ role: "superAdmin" }, "schedules", { doctorId: own.id });
  assert.ok(schedule.items.some(s => s.id === "solo-session"));
  const date = new Date().toISOString().slice(0, 10);
  const staff = { ...admin, clinicIds: ["c"], branchIds: [], doctorId: own.id };
  const reserve = patientId => db.transaction(tx => api.bookAppointment(staff, {
    doctorId: own.id, patientId, clinicId: "c", branchId: "b", date, source: "walkIn",
  }, tx));
  const first = await reserve("p1"), second = await reserve("p2");
  await assert.rejects(reserve("p3"), /Session capacity reached/);
  await assert.rejects(db.transaction(tx => api.bookAppointment(staff, {
    doctorId: own.id, patientId: "p3", clinicId: "c", branchId: "b2", date, source: "walkIn",
  }, tx)), /not assigned/);
  const called = await h.route(api.queueRouter, "post", "/queue/call-next", staff, {
    doctorId: own.id, branchId: "b", date,
  });
  assert.equal(called.appointment.id, first.id);
  const checked = await db.transaction(tx => api.transition(staff, first.id, { action: "checkIn" }, tx));
  assert.equal(checked.status, "inConsultation");
  const completed = await db.transaction(tx => api.transition(staff, first.id, { action: "complete" }, tx));
  assert.equal(completed.status, "completed");
  assert.equal((await api.one(t.appointments, second.id)).status, "called");
  await db.transaction(tx => api.attachOwnDoctor(admin, { branchIds: ["b2"] }, tx));
  assert.equal(await api.isClinicalMember(own.id, "b"), false);
  assert.equal(await api.isClinicalMember(own.id, "b2"), true);
  await assert.rejects(api.doctorContext(own.id, "b"), /not assigned/);
  assert.equal((await api.queryPage({ role: "superAdmin" }, "doctors", { branchId: "b" })).items.some(d => d.id === own.id), false);
  await db.transaction(tx => api.change(t.branches, "b2", { status: "inactive" }, tx));
  assert.equal(await api.isClinicalMember(own.id, "b2"), false);
});

test("inactive owned clinical profiles remain manageable, not clinically available, and reactivate without losing selection", async () => {
  await h.seed();
  const { api, t, db } = h, owner = await api.one(t.users, "admin");
  const actor = { ...owner, clinicIds: ["c"], branchIds: [] };
  const own = await db.transaction(tx => api.attachOwnDoctor(owner, { branchIds: ["b"] }, tx));
  await db.transaction(tx => api.change(t.doctors, own.id, { status: "inactive" }, tx));
  const managed = await api.queryPage(actor, "doctors", { status: "inactive" });
  const profile = managed.items.find(d => d.id === own.id);
  assert.ok(profile, "owner still sees inactive doctor");
  assert.deepEqual(profile.clinicIds, ["c"]);
  assert.deepEqual(profile.branchIds, ["b"]);
  assert.equal(await api.isClinicalMember(own.id, "b"), false);
  assert.equal((await h.route(api.publicRouter, "get", "/public/doctors", actor, {}, {}, { branchId: "b" })).items.some(d => d.id === own.id), false);
  await assert.rejects(api.doctorContext(own.id, "b"), /inactive/);
  const foreign = await api.put(t.users, { id: "foreign-manager", email: "foreign-manager@example.invalid", fullName: "Foreign Manager", role: "clinicAdmin" });
  const foreignClinic = await db.transaction(tx => api.createOwnedClinic(foreign, foreign, {
    clinic: { name: "Foreign", address: "Elsewhere", slug: "foreign-management" },
    branches: [{ name: "Foreign Branch", address: "Elsewhere", slug: "foreign-management-branch" }],
  }, tx));
  const foreignActor = { ...foreign, clinicIds: [foreignClinic.clinic.id], branchIds: [] };
  assert.equal((await api.queryPage(foreignActor, "doctors", {})).items.some(d => d.id === own.id), false);
  await assert.rejects(h.route(api.resourcesRouter, "patch", "/doctors/:id", foreignActor,
    { fullName: owner.fullName, email: owner.email, status: "active" }, { id: own.id }), /Only the owning Clinic Admin/);
  const updated = await h.route(api.resourcesRouter, "patch", "/doctors/:id", actor,
    { fullName: owner.fullName, email: owner.email, status: "active" }, { id: own.id });
  assert.deepEqual(updated.branchIds, ["b"]);
  assert.equal((await api.one(t.users, "admin")).role, "clinicAdmin");
  assert.equal(await api.isClinicalMember(own.id, "b"), true);
  assert.deepEqual((await h.route(api.publicRouter, "get", "/public/doctors", actor, {}, {}, { branchId: "b" })).items.find(d => d.id === own.id).branchIds, ["b"]);
  await db.transaction(tx => api.change(t.users, "du", { status: "inactive" }, tx));
  assert.ok((await api.queryPage(actor, "doctors", { status: "inactive" })).items.some(d => d.id === "d"));
  assert.equal(await api.isClinicalMember("d", "b"), false);
  await h.route(api.resourcesRouter, "patch", "/doctors/:id", actor,
    { fullName: "Doctor", email: "d@example.com", status: "active" }, { id: "d" });
  assert.equal(await api.isClinicalMember("d", "b"), true);
});

test("public doctor discovery binds clinic and branch filters to one location", async () => {
  await h.seed();
  const { api, db } = h, owner = await api.one(api.tables.users, "admin");
  const second = await db.transaction(tx => api.createOwnedClinic(owner, owner, {
    clinic: { name: "Second Owned Clinic", address: "Road", slug: "second-discovery-clinic" },
    branches: [{ name: "Second Branch", address: "Road", slug: "second-discovery-branch" }],
  }, tx));
  const secondBranchId = second.branches[0].id;
  const own = await db.transaction(tx => api.attachOwnDoctor(owner, { branchIds: ["b", secondBranchId] }, tx));
  const discover = (clinicId, branchId) => h.route(api.publicRouter, "get", "/public/doctors", owner, {}, {}, { clinicId, branchId });
  assert.ok((await discover("c", "b")).items.some(d => d.id === own.id));
  assert.ok((await discover(second.clinic.id, secondBranchId)).items.some(d => d.id === own.id));
  for (const [clinicId, branchId] of [["c", secondBranchId], [second.clinic.id, "b"]]) {
    const result = await discover(clinicId, branchId);
    assert.equal(result.total, 0);
    assert.deepEqual(result.items, []);
  }
});