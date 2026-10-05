// Real routers + real SQL against the ACTUAL migration journal in disposable PGlite.
// Only document byte storage is an in-memory fake. Fictional data; no email, no network beyond loopback.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures, TODAY, PAST } from "./test-support/feature-fixtures.mjs";

let h;
before(async () => { h = await createFeatureHarness(); await seedFeatureFixtures(h.pg); });
after(async () => { await h?.close(); });
const rows = async (sql, params) => (await h.pg.query(sql, params)).rows;
const ids = r => r.data.items.map(i => i.id);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n");

test("migration 0016 tables exist with Drizzle-named constraints", async () => {
  const names = (await rows(`select conname from pg_constraint where conrelid in ('notification_reads'::regclass,'patient_documents'::regclass,'saved_views'::regclass) order by 1`)).map(r => r.conname);
  for (const n of ["notification_reads_user_id_notification_id_pk", "patient_documents_patient_id_patients_id_fk", "patient_documents_clinic_id_clinics_id_fk", "saved_views_user_id_users_id_fk"]) assert.ok(names.includes(n), n);
});

test("every new route requires a signed-in user", async () => {
  for (const [m, p] of [["GET", "/notifications"], ["GET", "/workspaces"], ["GET", "/saved-views?tableKey=appointments"], ["GET", "/search/records?q=REF"], ["GET", "/patients/p1/documents"], ["GET", "/patients/p1/activity"], ["GET", `/reports/trends?from=${PAST}&to=${TODAY}`]])
    assert.equal((await h.call(null, m, p)).status, 401, p);
});

test("notifications: scoped history + admin audit, own actions excluded, kind filter", async () => {
  const adm = await h.call("adm", "GET", "/notifications");
  assert.equal(adm.status, 200);
  assert.deepEqual(ids(adm).sort(), ["a:al2", "h:h1", "h:h2"], "foreign clinic h3/al1, own h4 and >30 day h5 are excluded");
  assert.equal(adm.data.unread, 3);
  assert.equal(adm.data.items.find(i => i.id === "h:h1").kind, "queue");
  const rec = await h.call("rec", "GET", "/notifications");
  assert.deepEqual(ids(rec), ["h:h4"], "branch-scoped receptionist: no other clinic, no audit logs, not own h1");
  assert.deepEqual(ids(await h.call("adm", "GET", "/notifications?kind=system")), ["a:al2"]);
  assert.deepEqual(ids(await h.call("adm", "GET", "/notifications?kind=queue")), ["h:h1"]);
  assert.deepEqual(ids(await h.call("adm2", "GET", "/notifications")), ["h:h3"], "foreign admin sees only its clinic; own audit al1 excluded");
  assert.deepEqual(ids(await h.call("patu", "GET", "/notifications")).sort(), ["h:h1", "h:h2", "h:h4", "h:h5"].filter(id => id !== "h:h5"), "patient sees own appointments only");
});

test("notification read state is per user, persists, and ignores invisible IDs", async () => {
  const r = await h.call("adm", "POST", "/notifications/read", { ids: ["h:h1", "h:h3", "a:al1", "bogus"] });
  assert.equal(r.status, 200); assert.equal(r.data.unread, 2);
  assert.deepEqual((await rows("select notification_id from notification_reads where user_id='adm'")).map(x => x.notification_id), ["h:h1"]);
  const again = await h.call("adm", "GET", "/notifications");
  assert.equal(again.data.items.find(i => i.id === "h:h1").read, true);
  assert.equal((await h.call("patu", "GET", "/notifications")).data.items.find(i => i.id === "h:h1").read, false, "another user's state is untouched");
  assert.equal((await h.call("adm", "POST", "/notifications/read", { all: true })).data.unread, 0);
  assert.equal((await h.call("adm", "POST", "/notifications/read", { all: true })).status, 200, "repeat is idempotent");
  assert.equal((await rows("select count(*)::int n from notification_reads where user_id='adm2'"))[0].n, 0);
});

test("workspace selection narrows server scope, never expands, and is audited", async () => {
  const list = await h.call("adm", "GET", "/workspaces");
  assert.equal(list.data.switchable, true);
  assert.deepEqual(list.data.workspaces.map(w => w.id).sort(), ["c1", "c2"]);
  assert.equal((await h.call("adm", "PUT", "/workspaces/active", { clinicId: "c3" })).status, 403, "unassigned clinic rejected");
  assert.equal((await rows("select count(*)::int n from settings where id='workspace:adm'"))[0].n, 0);
  const sel = await h.call("adm", "PUT", "/workspaces/active", { clinicId: "c2" });
  assert.equal(sel.status, 200); assert.equal(sel.data.activeClinicId, "c2");
  assert.deepEqual((await rows("select data from settings where id='workspace:adm'"))[0].data, { clinicId: "c2" });
  assert.equal((await rows("select count(*)::int n from audit_logs where actor_id='adm' and action='switchWorkspace'"))[0].n, 1);
  // Every requireUser route now sees c2 only.
  assert.deepEqual(ids(await h.call("adm", "GET", "/search/records?q=REF")), ["a2"]);
  assert.deepEqual(ids(await h.call("adm", "GET", "/notifications?kind=queue")), [], "c1 queue event hidden");
  const trend = await h.call("adm", "GET", `/reports/trends?from=${PAST}&to=${TODAY}`);
  assert.equal(trend.data.points.reduce((s, p) => s + p.appointments, 0), 1, "only the c2 visit counts");
  assert.equal((await h.call("adm", "GET", "/patients/p1/activity")).data.total, 1, "activity narrowed to c2 history");
  assert.equal((await h.call("adm", "GET", "/workspaces")).data.workspaces.length, 2, "switch list still offers every assigned clinic");
  // Stale assignment: removing c2 membership must not keep a widened or orphaned scope.
  await h.call("adm", "PUT", "/workspaces/active", { clinicId: null });
  assert.equal((await rows("select count(*)::int n from settings where id='workspace:adm'"))[0].n, 0);
  assert.equal((await h.call("adm", "GET", "/search/records?q=REF")).data.items.length, 4, "all assigned clinics restored");
  const single = await h.call("rec", "GET", "/workspaces");
  assert.equal(single.data.switchable, false);
  assert.equal((await h.call("rec", "PUT", "/workspaces/active", { clinicId: "c2" })).status, 403);
  assert.equal((await h.call("patu", "PUT", "/workspaces/active", { clinicId: "c1" })).status, 403);
});

test("a stored workspace for a clinic no longer assigned is ignored (no expansion)", async () => {
  await h.pg.query(`insert into settings(id,data) values ('workspace:adm','{"clinicId":"c3"}') on conflict (id) do update set data=excluded.data`);
  const r = await h.call("adm", "GET", "/search/records?q=REF");
  assert.deepEqual(ids(r).sort(), ["a1", "a2", "a4", "a5"], "c3 never becomes visible");
  await h.pg.query(`delete from settings where id='workspace:adm'`);
});

test("patient activity: paginated, scoped, actor hidden from patients", async () => {
  const p1 = await h.call("adm", "GET", "/patients/p1/activity?page=1&pageSize=2");
  assert.equal(p1.status, 200); assert.equal(p1.data.total, 4); assert.deepEqual(ids(p1), ["h1", "h2"]);
  assert.deepEqual(ids(await h.call("adm", "GET", "/patients/p1/activity?page=2&pageSize=2")), ["h4", "h5"]);
  assert.equal((await h.call("rec", "GET", "/patients/p1/activity")).data.total, 3, "receptionist excludes the other clinic visit");
  const own = await h.call("patu", "GET", "/patients/p1/activity");
  assert.equal(own.data.total, 4); assert.ok(own.data.items.every(i => i.actorName == null));
  assert.ok([403, 404].includes((await h.call("adm2", "GET", "/patients/p1/activity")).status));
  assert.ok([403, 404].includes((await h.call("pat3u", "GET", "/patients/p1/activity")).status));
});

test("report trends: every day, scoped counts, validated range", async () => {
  const r = await h.call("adm", "GET", `/reports/trends?from=${PAST}&to=${TODAY}`);
  assert.equal(r.status, 200); assert.equal(r.data.points.length, 4);
  const past = r.data.points.find(p => p.date === PAST), today = r.data.points.find(p => p.date === TODAY);
  assert.deepEqual([past.appointments, past.completed, past.cancelled], [2, 1, 1]);
  assert.deepEqual([today.appointments, today.waiting], [1, 1]);
  const foreign = await h.call("adm2", "GET", `/reports/trends?from=${PAST}&to=${TODAY}`);
  assert.equal(foreign.data.points.reduce((s, p) => s + p.appointments, 0), 1);
  assert.equal((await h.call("adm", "GET", `/reports/trends?from=${PAST}&to=${TODAY}&clinicId=c3`)).data?.points?.reduce?.((s, p) => s + p.appointments, 0) ?? 0, 0, "foreign clinic filter yields nothing");
  assert.equal((await h.call("adm", "GET", `/reports/trends?from=${TODAY}&to=${PAST}`)).status, 400);
  assert.equal((await h.call("adm", "GET", "/reports/trends?from=2020-01-01&to=2022-01-01")).status, 400);
  assert.equal((await h.call("patu", "GET", `/reports/trends?from=${PAST}&to=${TODAY}`)).status, 403);
});

test("record search: scoped, today first, validated", async () => {
  const r = await h.call("rec", "GET", "/search/records?q=ravi");
  assert.deepEqual(ids(r), ["a1", "a4", "a5"]); assert.equal(r.data.items[0].today, true);
  assert.deepEqual(ids(await h.call("rec", "GET", "/search/records?q=REF-A2")), [], "other clinic hidden");
  assert.deepEqual(ids(await h.call("adm2", "GET", "/search/records?q=REF-A1")), []);
  assert.deepEqual(ids(await h.call("adm", "GET", "/search/records?q=07")), ["a1"], "token number match (two-character minimum)");
  assert.deepEqual(ids(await h.call("adm", "GET", "/search/records?q=%25_")), [], "LIKE wildcards are escaped");
  assert.equal((await h.call("adm", "GET", "/search/records?q=R")).status, 400);
});

test("saved views: sanitized on the server, owner-only delete, admin sharing to staff in overlapping clinics", async () => {
  const made = await h.call("adm", "POST", "/saved-views", { tableKey: "appointments", name: "Cancelled", filters: { status: "cancelled", search: "Ravi", email: "x@test.invalid", note: "free text here" }, columns: { order: ["date"], hidden: [], pinned: null }, shareWithRole: true });
  assert.equal(made.status, 201);
  assert.deepEqual(made.data.filters, { status: "cancelled" });
  const stored = (await rows("select data, shared_role, clinic_ids from saved_views where id=$1", [made.data.id]))[0];
  assert.doesNotMatch(JSON.stringify(stored.data), /Ravi|test\.invalid|free text/);
  assert.equal(stored.shared_role, "staff"); assert.deepEqual(stored.clinic_ids.sort(), ["c1", "c2"]);
  const recList = await h.call("rec", "GET", "/saved-views?tableKey=appointments");
  assert.deepEqual(recList.data.items.map(v => [v.id, v.ownedByMe, v.shared]), [[made.data.id, false, true]], "staff in an overlapping clinic receive it");
  assert.deepEqual(ids(await h.call("docu", "GET", "/saved-views?tableKey=appointments")), [made.data.id]);
  assert.deepEqual(ids(await h.call("adm2", "GET", "/saved-views?tableKey=appointments")), [], "no clinic overlap");
  assert.deepEqual(ids(await h.call("rec3", "GET", "/saved-views?tableKey=appointments")), [], "foreign staff");
  assert.deepEqual(ids(await h.call("patu", "GET", "/saved-views?tableKey=appointments")), [], "patients never receive shared views");
  assert.deepEqual(ids(await h.call("adm", "GET", "/saved-views?tableKey=reports")), [], "per-table");
  assert.equal((await h.call("rec", "POST", "/saved-views", { tableKey: "appointments", name: "Mine", filters: {}, shareWithRole: true })).status, 403);
  const recView = await h.call("rec", "POST", "/saved-views", { tableKey: "appointments", name: "Mine", filters: { status: "booked" } });
  assert.equal(recView.status, 201);
  assert.equal(recList.data.canShare, false);
  assert.deepEqual(ids(await h.call("rec2", "GET", "/saved-views?tableKey=appointments")), [made.data.id], "private views stay private");
  assert.equal((await h.call("rec2", "DELETE", `/saved-views/${recView.data.id}`)).status, 404, "non-owner cannot delete");
  assert.equal((await h.call("rec", "DELETE", `/saved-views/${made.data.id}`)).status, 404, "shared recipient cannot delete");
  assert.equal((await h.call("adm", "POST", "/saved-views", { tableKey: "Bad Key!", name: "x", filters: {} })).status, 400);
  assert.equal((await h.call("rec", "DELETE", `/saved-views/${recView.data.id}`)).status, 204);
  const sa = await h.call("sa", "POST", "/saved-views", { tableKey: "appointments", name: "Network", filters: {}, shareWithRole: true });
  assert.equal((await rows("select shared_role from saved_views where id=$1", [sa.data.id]))[0].shared_role, "superAdmin");
  assert.ok(!ids(await h.call("adm", "GET", "/saved-views?tableKey=appointments")).includes(sa.data.id), "super admin shares only with super admins");
  for (let i = 0; i < 29; i++) await h.call("adm", "POST", "/saved-views", { tableKey: "appointments", name: `View ${i}`, filters: {} });
  assert.equal((await h.call("adm", "POST", "/saved-views", { tableKey: "appointments", name: "One too many", filters: {} })).status, 400, "30 per list");
});

test("patient documents: staff upload in shared clinic, scoped list/download, uploader/admin delete", async () => {
  const bad = await h.call("rec", "POST", "/patients/p1/documents?name=run.exe&clinicId=c1", Buffer.from("MZ\x90\x00binary"));
  assert.equal(bad.status, 400, "content sniffed, not trusted from the name");
  assert.equal((await h.call("rec", "POST", "/patients/p1/documents?name=a.pdf&clinicId=c2", PDF)).status, 403, "receptionist not in c2");
  assert.equal((await h.call("rec", "POST", "/patients/p3/documents?name=a.pdf", PDF)).status >= 403, true, "foreign patient");
  assert.equal((await h.call("patu", "POST", "/patients/p1/documents?name=a.pdf", PDF)).status, 403, "patients cannot upload");
  const up = await h.call("rec", "POST", "/patients/p1/documents?name=../../Lab%20report.pdf&clinicId=c1", PDF);
  assert.equal(up.status, 201); assert.equal(up.data.contentType, "application/pdf"); assert.doesNotMatch(up.data.name, /[\\/]|^\./); assert.match(up.data.name, /Lab report\.pdf$/);
  assert.equal(h.blobs.size, 1);
  const row = (await rows("select clinic_id, uploaded_by, provider, status from patient_documents where id=$1", [up.data.id]))[0];
  assert.deepEqual(row, { clinic_id: "c1", uploaded_by: "rec", provider: "memory", status: "active" });
  assert.deepEqual(ids(await h.call("adm", "GET", "/patients/p1/documents")), [up.data.id]);
  assert.deepEqual(ids(await h.call("patu", "GET", "/patients/p1/documents")), [up.data.id], "patient sees own documents");
  assert.equal((await h.call("patu", "GET", "/patients/p1/documents")).data.uploadClinicIds.length, 0);
  assert.ok([403, 404].includes((await h.call("adm2", "GET", "/patients/p1/documents")).status));
  const dl = await h.call("patu", "GET", `/patient-documents/${up.data.id}`);
  assert.equal(dl.status, 200); assert.ok(Buffer.compare(dl.data, PDF) === 0);
  assert.match(dl.headers.get("content-disposition"), /^attachment;/);
  assert.equal(dl.headers.get("x-content-type-options"), "nosniff");
  assert.match(dl.headers.get("cache-control"), /no-store/);
  assert.equal((await h.call("adm2", "GET", `/patient-documents/${up.data.id}`)).status, 404, "foreign admin cannot download by id");
  assert.equal((await h.call("rec3", "GET", `/patient-documents/${up.data.id}`)).status, 404);
  assert.equal((await h.call("rec2", "DELETE", `/patient-documents/${up.data.id}`)).status, 403, "same-clinic peer is not the uploader");
  assert.equal((await h.call("adm", "DELETE", `/patient-documents/${up.data.id}`)).status, 204);
  assert.equal(h.blobs.size, 0, "bytes removed");
  assert.equal((await h.call("adm", "GET", `/patient-documents/${up.data.id}`)).status, 404);
  assert.deepEqual(ids(await h.call("adm", "GET", "/patients/p1/documents")), []);
  const audits = (await rows("select actor_id, action from audit_logs where entity_type='patient_documents' order by created_at")).map(r => `${r.actor_id}:${r.action}`);
  assert.deepEqual(audits, ["rec:uploadDocument", "patu:downloadDocument", "adm:deleteDocument"]);
});

test("permission policy: alternate routes are denied under their source module", async () => {
  const setPolicy = denied => h.pg.query(`insert into settings(id,data) values ('permission-policy',$1) on conflict (id) do update set data=excluded.data`, [JSON.stringify({ revision: 1, denied })]);
  const up = await h.call("rec", "POST", "/patients/p1/documents?name=policy.pdf&clinicId=c1", PDF);
  assert.equal(up.status, 201);
  try {
    await setPolicy(["receptionist:appointments:read"]);
    for (const [m, p, b] of [["GET", "/notifications"], ["POST", "/notifications/read", { all: true }], ["GET", "/search/records?q=REF"], ["GET", "/patients/p1/activity"]])
      assert.equal((await h.call("rec", m, p, b)).status, 403, `${m} ${p} follows appointments:read`);
    assert.equal((await h.call("rec", "GET", "/patients/p1/documents")).status, 200, "documents follow patients, not appointments");
    assert.equal((await h.call("adm", "GET", "/notifications")).status, 200, "other roles unaffected");

    await setPolicy(["receptionist:patients:read"]);
    assert.equal((await h.call("rec", "GET", "/patients/p1/documents")).status, 403);
    assert.equal((await h.call("rec", "GET", `/patient-documents/${up.data.id}`)).status, 403, "download follows patients:read");
    assert.equal((await h.call("rec", "GET", "/notifications")).status, 200);

    await setPolicy(["clinicAdmin:patients:delete"]);
    assert.equal((await h.call("adm", "DELETE", `/patient-documents/${up.data.id}`)).status, 403, "delete follows patients:delete");
    assert.equal((await rows("select status from patient_documents where id=$1", [up.data.id]))[0].status, "active");
    assert.equal((await h.call("adm", "GET", `/patient-documents/${up.data.id}`)).status, 200, "read still allowed");
  } finally { await setPolicy([]); }
  assert.equal((await h.call("adm", "DELETE", `/patient-documents/${up.data.id}`)).status, 204);
});

test("custom roles: per-user bindings deny the same alternate routes, globally or per clinic", async () => {
  const setRoles = (roles, bindings) => h.pg.query(`insert into settings(id,data) values ('custom-roles',$1) on conflict (id) do update set data=excluded.data`, [JSON.stringify({ revision: 1, roles, bindings })]);
  try {
    await setRoles([{ id: "r-noappt", name: "No Appointments", baseRole: "receptionist", denied: ["appointments:read"] }], [{ userId: "rec2", roleId: "r-noappt", clinicId: null }]);
    assert.equal((await h.call("rec2", "GET", "/notifications")).status, 403);
    assert.equal((await h.call("rec2", "GET", "/search/records?q=REF")).status, 403);
    assert.equal((await h.call("rec2", "GET", "/patients/p1/activity")).status, 403);
    assert.equal((await h.call("rec", "GET", "/notifications")).status, 200, "unbound user unaffected");
    await setRoles([{ id: "r-nopat", name: "No Patients", baseRole: "receptionist", denied: ["patients:read"] }], [{ userId: "rec2", roleId: "r-nopat", clinicId: "c1" }]);
    assert.equal((await h.call("rec2", "GET", "/patients/p1/documents")).status, 403, "clinic-scoped binding resolves the patient's clinic");
    assert.equal((await h.call("rec2", "GET", "/notifications")).status, 200);
  } finally { await setRoles([], []); }
});

test("record search returns the visit's queue coordinates for exact deep links", async () => {
  const r = await h.call("rec", "GET", "/search/records?q=REF-A1");
  assert.deepEqual(r.data.items.map(i => [i.id, i.clinicId, i.branchId, i.doctorId, i.today]), [["a1", "c1", "b1", "d1", true]]);
});
