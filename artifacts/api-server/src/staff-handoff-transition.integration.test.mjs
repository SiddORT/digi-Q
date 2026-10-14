import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("historical doctor-coordinate projection is immutable except anonymous actor detachment", async () => {
  const h = await createFeatureHarness();
  try {
    await seedFeatureFixtures(h.pg);
    await h.pg.exec(`begin;
      insert into users(id,email,full_name,role,status) values ('handoff-actor','handoff@test.invalid','Fixture Operator','superAdmin','active');
      insert into users(id,email,full_name,role,status) values ('replacement','replacement@test.invalid','Fixture Doctor','doctor','active');
      insert into assignments(id,user_id,clinic_id,branch_id) values ('replacement-assignment','replacement','c1','b1');
      insert into doctors(id,user_id,owner_admin_id) values ('replacement-doctor','replacement','adm');
      commit;`);
    const coords = {
      date: "2026-12-01", sessionId: "original-session", startTime: "09:00", endTime: "10:00", timezone: "UTC",
      token: "LV-07", tokenNumber: 7, expectedDurationMinutes: 15,
    };
    const next = { ...coords, sessionId: "replacement-session", token: "LV-08", tokenNumber: 8, expectedDurationMinutes: 20 };
    await h.pg.query(`update appointments set doctor_id='replacement-doctor',date=$1,token_number=8,status='waiting',
      data=data||$2::jsonb where id='a1'`, [next.date, JSON.stringify({ ...next, revision: 1, checkedInAt: null })]);
    await h.pg.query(`insert into appointment_transitions
      (id,operation_id,appointment_id,patient_id,clinic_id,actor_id,from_doctor_id,to_doctor_id,from_branch_id,to_branch_id,
       before_coordinates,after_coordinates,reference_fingerprint,from_revision,to_revision)
      values('transition','fixture-operation','a1','p1','c1','handoff-actor','d1','replacement-doctor','b1','b1',$1,$2,$3,0,1)`,
      [JSON.stringify(coords), JSON.stringify(next), createHash("sha256").update("REF-A1").digest("hex")]);
    for (const mutation of [
      `delete from appointment_transitions where id='transition'`,
      `update appointment_transitions set before_coordinates='{}' where id='transition'`,
      `update appointment_transitions set from_doctor_id='d3' where id='transition'`,
      `update appointment_transitions set reference_fingerprint=repeat('0',64) where id='transition'`,
      `update appointment_transitions set actor_id=null,deleted_actor=true,to_revision=2 where id='transition'`,
    ]) await assert.rejects(h.pg.exec(mutation), /immutable|cannot be deleted/);
    await h.pg.exec(`update appointment_transitions set actor_id=null,deleted_actor=true where id='transition';
      delete from users where id='handoff-actor';`);
    const row = (await h.pg.query(`select * from appointment_transitions where id='transition'`)).rows[0];
    assert.equal(row.actor_id, null); assert.equal(row.deleted_actor, true);
    assert.deepEqual(row.before_coordinates, coords); assert.deepEqual(row.after_coordinates, next);
    await assert.rejects(h.pg.exec(`update appointment_transitions set actor_id='sa',deleted_actor=false where id='transition'`), /immutable/);
    await assert.rejects(h.pg.exec(`update appointments set data=jsonb_set(data,'{reference}','"OTHER-REFERENCE"') where id='a1'`), /must be preserved/);
    await assert.rejects(h.pg.exec(`update appointments set patient_id='p2' where id='a1'`), /must be preserved/);
    assert.equal((await h.pg.query(`select count(*)::int n from appointments`)).rows[0].n, 5);
  } finally { await h.close(); }
});
