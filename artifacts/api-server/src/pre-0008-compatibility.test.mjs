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

test("disabled consulting capability rejects before writes; ordinary registration and staff remain supported", async () => {
  await h.seed();
  const { api, t, db } = h;
  assert.equal(api.CONSULTING_ADMIN_ENABLED, false);
  const admin = await api.one(t.users, "admin");
  const input = { clinic: { name: "Safe Clinic", address: "Road", slug: "safe-clinic" }, branches: [{ name: "Main", address: "Road", slug: "main-safe" }] };
  const before = await Promise.all([api.all(t.users), api.all(t.clinics), api.all(t.doctors), api.all(t.assignments), api.all(t.auditLogs)]);
  // The route rejects before the registration rate limiter, Clerk lookup,
  // password verification, session proof or transaction is reached.
  const register = api.clinicExpansionRouter.stack.find(layer => layer.route?.path === "/clinic-registration");
  assert.equal(register.route.stack.length, 3);
  assert.throws(() => register.route.stack[0].handle({ body: { ...input, ownDoctor: true } }, {}, () => {
    throw Error("registration middleware was reached");
  }), e => e.code === "CONSULTING_ADMIN_DISABLED");
  await assert.rejects(api.clinicExpansionRouter.stack.find(layer => layer.route?.path === "/me/doctor-profile").route.stack[0].handle({}, {}), e => e.code === "CONSULTING_ADMIN_DISABLED");
  await assert.rejects(db.transaction(tx => api.createOwnedClinic(admin, admin, { ...input, ownDoctor: true }, tx)), e => e.code === "CONSULTING_ADMIN_DISABLED" && e.status === 409);
  await assert.rejects(db.transaction(tx => api.attachOwnDoctor(admin, { branchIds: ["b"] }, tx)), e => e.code === "CONSULTING_ADMIN_DISABLED");
  await assert.rejects(api.createClinicAdminOnboarding({ id: "super", role: "superAdmin" }, { ...input, admin: { fullName: "New", email: "new@example.invalid" }, ownDoctor: true }), e => e.code === "CONSULTING_ADMIN_DISABLED");
  assert.deepEqual(await Promise.all([api.all(t.users), api.all(t.clinics), api.all(t.doctors), api.all(t.assignments), api.all(t.auditLogs)]), before);
  const result = await db.transaction(tx => api.createOwnedClinic(admin, admin, { ...input, ownDoctor: false }, tx));
  assert.equal(result.doctorId, null);
  assert.equal((await api.all(t.assignments)).filter(a => a.userId === admin.id && a.clinicId === result.clinic.id && a.branchId === null).length, 1);
  assert.equal((await api.all(t.doctors)).filter(d => d.userId === admin.id).length, 0);
  await assert.rejects(db.transaction(async tx => {
    await api.createOwnedClinic(admin, admin, { clinic: { name: "Rollback", address: "Road", slug: "rollback-safe" }, branches: [] }, tx);
    throw Error("rollback probe");
  }), /rollback probe/);
  assert.equal((await api.all(t.clinics)).some(c => c.slug === "rollback-safe"), false);
  assert.equal((await api.all(t.clinics)).some(c => c.id === result.clinic.id), true);
  assert.equal((await api.all(t.doctors)).some(d => d.id === "d"), true);
});

test("generic doctor and linked admin mutations fail closed; ordinary doctor workflow is unchanged", async () => {
  const { api, t, db } = h;
  const actor = { id: "super", role: "superAdmin", clinicIds: ["c"], branchIds: ["b"] };
  const ordinary = await api.one(t.doctors, "d");
  await api.authorizeWrite(actor, "doctors", { fullName: "Doctor" }, { ...ordinary, clinicIds: ["c"], branchIds: ["b"] });
  await api.authorizeWrite(actor, "users", { fullName: "Admin" }, { ...(await api.one(t.users, "admin")), clinicIds: ["c"] });
  await assert.rejects(api.authorizeWrite(actor, "doctors", { userId: "admin" }), e => e.code === "CONSULTING_ADMIN_DISABLED");
  // An existing clinical admin profile may be present in a legacy database:
  // never remove it, and reject edits, ownership transfers and deactivation.
  await db.transaction(tx => api.put(t.doctors, { id: "legacy-admin-doctor", userId: "admin", ownerAdminId: "admin" }, tx));
  const legacy = { ...(await api.one(t.doctors, "legacy-admin-doctor")), clinicIds: ["c"], branchIds: [] };
  for (const body of [{}, { fullName: "Changed" }, { ownerAdminId: "other" }, { status: "inactive" }]) {
    await assert.rejects(api.authorizeWrite(actor, "doctors", body, legacy), e => e.code === "CONSULTING_ADMIN_DISABLED");
  }
  await assert.rejects(api.authorizeWrite(actor, "users", { status: "inactive" }, { ...(await api.one(t.users, "admin")), clinicIds: ["c"] }), e => e.code === "CONSULTING_ADMIN_DISABLED");
  await assert.rejects(api.authorizeWrite(actor, "users", { role: "doctor" }, { ...(await api.one(t.users, "admin")), clinicIds: ["c"] }), /roles cannot be switched/);
  assert.equal((await api.one(t.doctors, legacy.id)).status, "active");
  assert.equal((await api.one(t.users, "admin")).role, "clinicAdmin");
  // Old SQL really rejects the consulting branch mapping while preserving the
  // admin's clinic-only mapping and an ordinary doctor's branch mapping.
  await assert.rejects(db.transaction(tx => api.put(t.assignments, { id: "forbidden-admin-branch", userId: "admin", clinicId: "c", branchId: "b" }, tx)), e => /must match the clinic administrator/.test(e.cause?.message || e.message));
  assert.equal((await api.all(t.assignments)).some(a => a.id === "forbidden-admin-branch"), false);
  assert.ok((await api.all(t.assignments)).some(a => a.userId === "du" && a.branchId === "b"));
});