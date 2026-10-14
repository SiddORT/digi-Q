// Disposable relational fixtures only; no production database, storage or sends.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("retirement preserves shared care rows, permits anonymous attribution, and rejects new work", async () => {
  const h = await createFeatureHarness({ administration: true, bookingLookups: true });
  try {
    await seedFeatureFixtures(h.pg);
    const token = randomBytes(32).toString("base64url");
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",
      [createHash("sha256").update(token).digest("hex"), "sa", new Date(Date.now() + 3600000)]);
    const call = path => h.call("sa", "GET", path, undefined, { cookie: `digiq_session=${token}` });
    await assert.rejects(h.pg.exec(`update doctors set status='retired', user_id=null, owner_admin_id=null, retired_at=now() where id='d1'`), /Resolve open doctor work/);
    await assert.rejects(h.pg.exec(`update doctors set user_id=null where id='d1'`), /Doctor owner|doctor_retired_identity/);
    await h.pg.exec(`
      update appointments set status='completed' where id='a1';
      update doctors set status='retired', user_id=null, owner_admin_id=null, retired_at=now(),data='{}' where id='d1';
      update appointment_history set actor_id=null,deleted_actor=true where actor_id='docu';
      delete from assignments where user_id='docu';
      delete from users where id='docu';
    `);
    const rows = await h.pg.query(`select count(*)::int n from appointments where doctor_id='d1'`);
    assert.equal(rows.rows[0].n, 4);
    const history = await h.pg.query(`select actor_id,deleted_actor from appointment_history where id='h2'`);
    assert.deepEqual(history.rows[0], { actor_id: null, deleted_actor: true });
    const page = await call("/doctors?selectedIds=d1");
    assert.equal(page.status, 200, h.errors.map(e => e.message).join("; "));
    assert.deepEqual(page.data.items, [], "retired doctors are not selectable, even through exact-ID hydration");
    assert.equal((await call("/doctors/d1")).status, 404);
    const retained = await call("/appointments?doctorId=d1");
    assert.equal(retained.status, 200);
    assert(retained.data.items.every(row => row.doctorName === "Deleted doctor"), "historical care remains readable without a selectable doctor profile");
    await assert.rejects(h.pg.exec(`update appointments set status='waiting' where id='a2'`), /Retired doctor cannot accept/);
    await assert.rejects(h.pg.exec(`insert into schedules(id,clinic_id,branch_id,doctor_id,day_of_week,status,data) values ('new','c1','b1','d1',1,'active','{}')`), /Retired doctor cannot accept/);
    await assert.rejects(h.pg.exec(`update branches set data=data||'{"linkedSchedule":{"enabled":true,"doctorId":"d1"}}'::jsonb where id='b1'`), /Linked doctor is unavailable/);
    await assert.rejects(h.pg.exec(`update doctors set status='active',user_id='doc3u',owner_admin_id='adm2',retired_at=null where id='d1'`), /cannot be reactivated/);
    // Existing strict live ownership is not relaxed by the retirement exception.
    await assert.rejects(h.pg.exec(`update doctors set owner_admin_id='rec' where id='d3'`), /active Clinic Admin/);
  } finally {
    await h.close();
  }
});

test("anonymous uploader and shared-view ownership preserve bytes and clinic sharing", async () => {
  const h = await createFeatureHarness({ administration: true });
  try {
    await seedFeatureFixtures(h.pg);
    h.blobs.set("clinical-report", Buffer.from("Dr Meera Rao: original clinical content"));
    await h.pg.exec(`
      insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key)
      values ('pd1','p1','c1','docu','Report.pdf','application/pdf',43,'memory','clinical-report');
      insert into saved_views(id,user_id,table_key,name,shared_role,clinic_ids)
      values ('sv1','docu','appointments','Care view','doctor','["c1"]');
      update patient_documents set uploaded_by=null,deleted_uploader=true where id='pd1';
      update saved_views set user_id=null,deleted_owner=true where id='sv1';
    `);
    assert.equal(h.blobs.get("clinical-report").toString(), "Dr Meera Rao: original clinical content");
    const docs = await h.call("sa", "GET", "/patients/p1/documents");
    assert.equal(docs.status, 200, h.errors.map(e => e.message).join("; "));
    assert.equal(docs.data.items[0].uploadedByName, "Deleted user");
    const view = await h.pg.query(`select user_id,deleted_owner,clinic_ids from saved_views where id='sv1'`);
    assert.deepEqual(view.rows[0], { user_id: null, deleted_owner: true, clinic_ids: ["c1"] });
    await assert.rejects(h.pg.exec(`insert into saved_views(id,user_id,table_key,name) values ('sv2',null,'appointments','Private view')`), /saved_views_retired_owner/);
  } finally {
    await h.close();
  }
});
