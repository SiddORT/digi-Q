// Standalone live-router authorization regression. Checked-in migrations, disposable
// PGlite, fictional records only. No development DB, mail, browser interception,
// mocked requireUser/canRead/queryPage, or test-header authentication.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";

process.env.AUTH_SESSION_MODE = "native";
let h;
const labels = {
  c1: "Fictional Cedar Clinic", c2: "Fictional Maple Clinic",
  ci: "Private Inactive Clinic", ce: "Private Clinic Without Active Locations",
  b1: "Fictional Cedar East", b2: "Fictional Cedar West", b3: "Fictional Maple North",
  bi: "Private Inactive Location", bc: "Private Location In Inactive Clinic",
  be: "Private Inactive Only Location",
  d1: "Dr Fictional Cedar", d2: "Dr Fictional Maple",
  ds: "Dr Fictional Shared Membership",
  di: "Dr Private Inactive Profile", du: "Dr Private Inactive Account",
  db: "Dr Private Inactive Location", dc: "Dr Private Inactive Clinic",
  dn: "Dr Private Unassigned",
};
const patientLabels = ["Fictional Patient One", "Private Fictional Patient Two"];
const cookies = {};
after(async () => { if (h) await h.close(); });

before(async () => {
  h = await createFeatureHarness({ bookingLookups: true });
  const insert = async (table, columns, values) => h.pg.query(
    `insert into ${table} (${columns.join(",")}) values (${values.map((_, i) => `$${i + 1}`).join(",")})`,
    values,
  );
  // Ownership guards are deferred: commit complete user/profile pairs, never
  // disable production constraints to make fictional fixtures fit.
  await h.pg.exec("BEGIN");
  await insert("users", ["id", "email", "full_name", "role"], ["owner", "owner@lookup.invalid", "Fictional Clinic Owner", "clinicAdmin"]);
  for (const [id, status] of [["c1", "active"], ["c2", "active"], ["ci", "inactive"], ["ce", "active"]])
    await insert("clinics", ["id", "admin_id", "status", "data"], [id, "owner", status, { name: labels[id] }]);
  for (const [id, clinic, status] of [
    ["b1", "c1", "active"], ["b2", "c1", "active"], ["b3", "c2", "active"],
    ["bi", "c1", "inactive"], ["bc", "ci", "active"], ["be", "ce", "inactive"],
  ]) await insert("branches", ["id", "clinic_id", "status", "data"], [id, clinic, status, { name: labels[id] }]);
  for (const [id, status, accountStatus, links] of [
    ["d1", "active", "active", [["c1", "b1"]]],
    ["d2", "active", "active", [["c2", "b3"]]],
    ["ds", "active", "active", [["c1", "b1"], ["c2", "b3"]]],
    ["di", "inactive", "active", [["c1", "b1"]]],
    ["du", "active", "inactive", [["c1", "b1"]]],
    ["db", "active", "active", [["c1", "bi"]]],
    ["dc", "active", "active", [["ci", "bc"]]],
    ["dn", "active", "active", []],
  ]) {
    await insert("users", ["id", "email", "full_name", "role", "status"], [`u-${id}`, `${id}@lookup.invalid`, labels[id], "doctor", accountStatus]);
    await insert("doctors", ["id", "user_id", "owner_admin_id", "status"], [id, `u-${id}`, "owner", status]);
    for (const [clinic, branch] of links)
      await insert("assignments", ["id", "user_id", "clinic_id", "branch_id"], [`a-${id}-${branch}`, `u-${id}`, clinic, branch]);
  }
  for (const n of [1, 2]) {
    const user = `patient-user-${n}`, patient = `p${n}`;
    await insert("users", ["id", "email", "full_name", "role"], [user, `${user}@lookup.invalid`, patientLabels[n - 1], "patient"]);
    await insert("patients", ["id", "user_id", "clinic_id", "branch_id", "data"], [patient, user, "c1", "b1", { fullName: patientLabels[n - 1], code: `FP-${n}` }]);
    // Deliberately distinctive snapshot labels: own and foreign appointments
    // must not share names, otherwise a name-leak assertion could miss exposure.
    const own = n === 1;
    await insert("appointments", ["id", "patient_id", "doctor_id", "clinic_id", "branch_id", "date", "token_number", "actor_id", "data"],
      [`visit-${n}`, patient, own ? "d1" : "d2", own ? "c1" : "c2", own ? "b1" : "b3", "2030-01-07", n, user, {
        patientName: patientLabels[n - 1], patientCode: `FP-${n}`,
        doctorName: own ? labels.d1 : "Private Appointment Doctor",
        clinicName: own ? labels.c1 : "Private Appointment Clinic",
        branchName: own ? labels.b1 : "Private Appointment Location",
        token: `FP-${n}`, reference: `FICTIONAL-VISIT-${n}`, startTime: "09:00", endTime: "10:00",
      }]);
    const token = createHash("sha256").update(`fictional-lookup-session-${n}`).digest("base64url");
    await insert("auth_sessions", ["token_hash", "user_id", "expires_at"],
      [createHash("sha256").update(token).digest("hex"), user, new Date(Date.now() + 3600000)]);
    cookies[n] = `digiq_session=${token}`;
  }
  await h.pg.exec("COMMIT");
});

async function get(path, patient) {
  return h.call(null, "GET", path, undefined, patient ? { cookie: cookies[patient] } : {});
}
function absent(response, names, context) {
  const text = JSON.stringify(response.data);
  for (const name of names) assert.ok(!text.includes(name), `${context}: exposed ${name}`);
}
async function selection(kind, selectedIds, expected, filters = {}) {
  const path = `/public/${kind}?${new URLSearchParams({ selectedIds: selectedIds.join(","), ...filters })}`;
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert.deepEqual(response.data.items.map(row => row.id).sort(), [...expected].sort(), path);
  assert.equal(response.data.total, expected.length, path);
  for (const row of response.data.items)
    assert.equal(row[kind === "doctors" ? "fullName" : "name"], labels[row.id], `${path}: human label retained`);
  absent(response, selectedIds.filter(id => !expected.includes(id)).map(id => labels[id]).filter(Boolean), path);
  return response;
}

test("public selectedIds never revive inactive clinics or clinics without active locations", async () => {
  for (const blocked of ["ci", "ce", "missing-clinic"])
    await selection("clinics", [blocked], []);
  await selection("clinics", ["c1", "c2", "ci", "ce"], ["c1", "c2"]);
});

test("public selectedIds never revive inactive locations or an inactive parent clinic", async () => {
  for (const blocked of ["bi", "bc", "be", "missing-location"])
    await selection("branches", [blocked], []);
  await selection("branches", ["b1", "b3", "bi", "bc", "be"], ["b1", "b3"]);
});

test("public selectedIds exclude inactive doctor profiles/accounts and unavailable clinical memberships", async () => {
  for (const blocked of ["di", "du", "db", "dc", "dn", "missing-doctor"])
    await selection("doctors", [blocked], []);
  const result = await selection("doctors", ["d1", "d2", "di", "du", "db", "dc", "dn"], ["d1", "d2"]);
  for (const row of result.data.items) {
    assert.deepEqual(row.branchIds, row.id === "d1" ? ["b1"] : ["b3"]);
    assert.deepEqual(row.clinicIds, row.id === "d1" ? ["c1"] : ["c2"]);
  }
});

test("public location selections intersect selectedIds with clinic AND clinical doctor membership", async () => {
  const ids = ["b1", "b2", "b3", "bi", "bc"];
  for (const [filters, expected] of [
    [{ clinicId: "c1" }, ["b1", "b2"]],
    [{ doctorId: "d1" }, ["b1"]],
    [{ clinicId: "c1", doctorId: "d1" }, ["b1"]],
    [{ clinicId: "c2", doctorId: "d2" }, ["b3"]],
    [{ clinicId: "c2", doctorId: "d1" }, []],
    [{ clinicId: "c1", doctorId: "d2" }, []],
    ...["di", "du", "db", "dc", "dn", "missing-doctor"].map(doctorId => [{ doctorId }, []]),
    [{ clinicId: "ci", doctorId: "dc" }, []],
  ]) await selection("branches", ids, expected, filters);
  // A valid contextual result must not widen to all members when selectedIds
  // names a different active location in that same clinic.
  await selection("branches", ["b2"], [], { clinicId: "c1", doctorId: "d1" });
});

test("public doctor selections intersect selectedIds with clinic AND location on the same membership", async () => {
  const ids = ["d1", "d2", "di", "du", "db", "dc", "dn"];
  for (const [filters, expected] of [
    [{ clinicId: "c1" }, ["d1"]],
    [{ branchId: "b1" }, ["d1"]],
    [{ clinicId: "c1", branchId: "b1" }, ["d1"]],
    [{ clinicId: "c2", branchId: "b3" }, ["d2"]],
    [{ clinicId: "c1", branchId: "b3" }, []],
    [{ clinicId: "c2", branchId: "b1" }, []],
    [{ clinicId: "c1", branchId: "b2" }, []],
    [{ branchId: "bi" }, []], [{ branchId: "bc" }, []],
    [{ clinicId: "ci" }, []], [{ clinicId: "missing-clinic" }, []],
    [{ branchId: "missing-location" }, []],
  ]) await selection("doctors", ids, expected, filters);
  await selection("doctors", ["d2"], [], { clinicId: "c1", branchId: "b1" });
  // This doctor belongs to BOTH clinics. Separate EXISTS predicates matching
  // a clinic and a location independently must not admit a crossed pair.
  await selection("doctors", ["ds"], ["ds"], { clinicId: "c1", branchId: "b1" });
  await selection("doctors", ["ds"], ["ds"], { clinicId: "c2", branchId: "b3" });
  await selection("doctors", ["ds"], [], { clinicId: "c1", branchId: "b3" });
  await selection("doctors", ["ds"], [], { clinicId: "c2", branchId: "b1" });
});

test("invalid public selection requests return errors without serializing fixture names", async () => {
  for (const kind of ["clinics", "branches", "doctors"]) {
    for (const filters of [
      { selectedIds: Object.keys(labels).concat(Array.from({ length: 101 }, (_, i) => `missing-${i}`)).join(",") },
      { selectedIds: Object.keys(labels).join(","), pageSize: "101" },
    ]) {
      const response = await get(`/public/${kind}?${new URLSearchParams(filters)}`);
      assert.equal(response.status, 400, `${kind}: invalid selection must fail explicitly`);
      absent(response, Object.values(labels), `${kind}: invalid selection`);
      assert.equal("items" in response.data, false);
    }
  }
});

const foreignNames = [patientLabels[1], labels.d2, labels.c2, labels.b3,
  "Private Appointment Doctor", "Private Appointment Clinic", "Private Appointment Location"];
test("patient appointment label detail rejects foreign IDs without returning private names", async () => {
  const own = await get("/appointments/visit-1", 1);
  assert.equal(own.status, 200);
  assert.equal(own.data.id, "visit-1");
  for (const [key, value] of Object.entries({ patientName: patientLabels[0], doctorName: labels.d1, clinicName: labels.c1, branchName: labels.b1 }))
    assert.equal(own.data[key], value, `own ${key} remains readable`);
  absent(own, foreignNames, "own appointment");
  const other = await get("/appointments/visit-2", 1);
  assert.equal(other.status, 403);
  absent(other, foreignNames, "foreign appointment detail");
  const anonymous = await get("/appointments/visit-2");
  assert.equal(anonymous.status, 401);
  absent(anonymous, foreignNames, "anonymous appointment detail");
  const owner = await get("/appointments/visit-2", 2);
  assert.equal(owner.status, 200, "foreign fixture is a real readable appointment for its owner");
  assert.equal(owner.data.patientName, patientLabels[1]);
});

test("patient appointment lists and resource reads cannot widen to another patient's labels", async () => {
  for (const [query, expected] of [
    ["", ["visit-1"]], ["patientId=p1", ["visit-1"]], ["patientId=p2", []],
  ]) {
    const response = await get(`/appointments?${query}`, 1);
    assert.equal(response.status, 200);
    assert.deepEqual(response.data.items.map(row => row.id), expected);
    assert.equal(response.data.total, expected.length);
    absent(response, foreignNames, query);
    if (expected.length) assert.equal(response.data.items[0].doctorName, labels.d1);
  }
  // Exercise the resource router as well, using its supported query contract.
  const patients = await get("/patients", 1);
  assert.equal(patients.status, 200);
  assert.deepEqual(patients.data.items.map(row => row.id), ["p1"]);
  assert.equal(patients.data.items[0].fullName, patientLabels[0]);
  absent(patients, [patientLabels[1]], "patient resource labels");
  const foreignPatient = await get("/patients/p2", 1);
  assert.equal(foreignPatient.status, 403);
  absent(foreignPatient, [patientLabels[1]], "foreign patient resource detail");
});
