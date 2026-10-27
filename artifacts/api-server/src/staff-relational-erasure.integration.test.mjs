import { test } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("relational erasure blocks care and preserves clinical identity and document locators after retirement", async () => {
  const h = await createFeatureHarness({ postgres: true, deletion: true, fakeBookingMail: true });
  try {
    await seedFeatureFixtures(h.pg);
    await assert.rejects(h.relationalErasure("docu"), /unfinished clinical work/);
    assert.equal((await h.pg.query(`select user_id from doctors where id='d1'`)).rows[0].user_id, "docu");
    await h.pg.exec(`update appointments set status='completed' where doctor_id='d1';
      update guest_requests set status='rejected' where doctor_id='d1' and status='pending'`);
    await h.pg.exec(`insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key)
      values('kept-clinical-file','p1','c1','docu','Clinical narrative','application/pdf',7,'local','private-clinical-path')`);
    // Include records currently owned by another doctor: past move attribution still needs erasure.
    await h.pg.exec(`update appointments set data=data || '{"history":[
      {"status":"waiting","action":"reschedule","occurredAt":"2030-01-07T11:00:00Z",
       "from":{"doctorId":"d1","doctorName":"Historical removed name","branchName":"Original location"},
       "to":{"doctorId":"d3","doctorName":"Preserved doctor","branchName":"Next location"}},
      {"status":"waiting","action":"reschedule","occurredAt":"2030-01-08T11:00:00Z",
       "from":{"doctorId":"d3","doctorName":"Preserved doctor","branchName":"Next location"},
       "to":{"doctorId":"d1","doctorName":"Historical removed name","branchName":"Original location"}}
    ]}'::jsonb`);
    const before = (await h.pg.query(`select id,patient_id,doctor_id,clinic_id,branch_id,status,data->>'reference' as reference
      from appointments order by id`)).rows;
    await h.relationalErasure("docu");
    const doctor = (await h.pg.query(`select * from doctors where id='d1'`)).rows[0];
    assert.equal(doctor.status, "retired");
    assert.equal(doctor.user_id, null);
    assert.equal(doctor.owner_admin_id, null);
    assert.equal(doctor.data.fullName, "Deleted doctor");
    for (const { data } of (await h.pg.query(`select data from appointments`)).rows) {
      assert.equal(data.history[0].from.deletedDoctor, true);
      assert.equal(data.history[0].from.doctorName, "Deleted doctor");
      assert.equal(data.history[1].to.deletedDoctor, true);
      assert.equal(data.history[1].to.doctorName, "Deleted doctor");
      assert.equal(data.history[0].from.branchName, "Original location");
      assert.equal(data.history[0].to.doctorName, "Preserved doctor");
      assert.equal(data.history[1].from.doctorName, "Preserved doctor");
      assert.equal(JSON.stringify(data.history).includes("Historical removed name"), false);
    }
    assert.deepEqual((await h.pg.query(`select id,patient_id,doctor_id,clinic_id,branch_id,status,data->>'reference' as reference
      from appointments order by id`)).rows, before);
    const file = (await h.pg.query(`select uploaded_by,deleted_uploader,storage_key,name,size from patient_documents
      where id='kept-clinical-file'`)).rows[0];
    assert.equal(file.uploaded_by, null);
    assert.equal(file.deleted_uploader, true);
    assert.equal(file.storage_key, "private-clinical-path");
    assert.equal(file.name, "Clinical narrative");
    assert.equal(file.size, 7);
    assert.equal((await h.pg.query(`select count(*)::int as n from users where id='docu'`)).rows[0].n, 1,
      "primitive must not bypass outer JSON/media/receipt review by deleting the account");
  } finally { await h.close(); }
});
