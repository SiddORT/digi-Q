import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

test("reviewed visit handoff preserves receipt, freezes both coordinates and replays without allocating twice", async () => {
  process.env.SESSION_SECRET = "isolated-fictional-staff-handoff-signing-key-only";
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "cd".repeat(32);
  const h = await createFeatureHarness({ deletion: true, postgres: true, fakeBookingMail: true, administration: true, bookingLookups: true });
  try {
    await seedFeatureFixtures(h.pg);
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const tokens = Object.fromEntries(["sa", "adm", "docu", "replacement"].map(id => [id, randomBytes(32).toString("base64url")]));
    const hashes = Object.fromEntries(Object.entries(tokens).map(([id, token]) => [id, createHash("sha256").update(token).digest("hex")]));
    for (const id of ["sa", "adm", "docu"])
      await h.pg.query(`insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')`, [hashes[id], id]);
    const call = (role, method, path, body) => h.call(null, method, path, body, { cookie: `digiq_session=${tokens[role]}` });
    const upload = async (role, clinicId = "c1") => {
      const response = await fetch(h.base + "/patients/handoff-patient/documents?clinicId=" + clinicId + "&name=fixture.pdf",
        { method: "POST", headers: { cookie: `digiq_session=${tokens[role]}`, "content-type": "application/pdf" },
          body: Buffer.from("%PDF-1.4\nFictional signed care narrative - unchanged") });
      return { status: response.status, data: await response.json() };
    };
    await h.pg.exec(`begin;
      insert into users(id,email,full_name,role,status) values('replacement','handoff-replacement@test.invalid','Fixture Replacement','doctor','active');
      insert into assignments(id,user_id,clinic_id,branch_id) values('replacement-scope','replacement','c1','b1');
      insert into doctors(id,user_id,owner_admin_id) values('replacement-doctor','replacement','adm');
      insert into patients(id,clinic_id,branch_id,mobile,data) values
        ('handoff-patient','c3','b3','9000000999','{"fullName":"Fictional handoff patient"}');
      insert into patient_documents(id,patient_id,clinic_id,uploaded_by,name,content_type,size,provider,storage_key) values
        ('handoff-document','handoff-patient','c1','rec','Fictional care narrative','application/pdf',3,'memory','before-doc'),
        ('cross-clinic-document','handoff-patient','c3','rec3','Fictional other clinic','application/pdf',3,'memory','outside-doc');
      commit;`);
    await h.pg.query(`insert into auth_sessions(token_hash,user_id,expires_at) values($1,'replacement',now()+interval '1 day')`, [hashes.replacement]);
    h.blobs.set("before-doc", Buffer.from("PDF"));
    h.blobs.set("outside-doc", Buffer.from("OUT"));
    for (const [id, doctor, duration, prefix] of [["source-session", "d1", 15, "O"], ["replacement-session", "replacement-doctor", 20, "N"]])
      await h.pg.query(`insert into schedules(id,clinic_id,branch_id,doctor_id,day_of_week,data) values($1,'c1','b1',$2,$3,$4)`, [
        id, doctor, new Date(date + "T12:00:00Z").getUTCDay(),
        { isOpen: true, startTime: "09:00", endTime: "12:00", timezone: "UTC", maxTokens: 20, tokenPrefix: prefix, consultationMinutes: duration, queueMode: "mixed" },
      ]);
    await h.pg.query(`insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data)
      values('handoff-visit','handoff-patient','d1','c1','b1',$1,7,'booked','rec',$2)`, [date, {
      reference: "PRIVATE-FIXTURE-HANDOFF-RECEIPT", sessionId: "source-session", startTime: "09:00", endTime: "12:00",
      timezone: "UTC", token: "O-07", tokenNumber: 7, expectedDurationMinutes: 15, doctorName: "Dr Meera Rao", revision: 0,
    }]);
    const context = { actorId: "sa", sessionHash: hashes.sa, targetId: "docu" };
    const moves = [{ appointmentId: "handoff-visit", doctorId: "replacement-doctor", branchId: "b1", date, sessionId: "replacement-session", expectedRevision: 0 }];
    await assert.rejects(h.visitHandoffs.review({ ...context, actorId: "adm", sessionHash: hashes.adm }, moves), /Superadmin/i);
    assert.equal((await call("docu", "GET", "/patients/handoff-patient")).status, 200);
    assert.ok([403, 404].includes((await call("replacement", "GET", "/patients/handoff-patient")).status));
    assert.equal((await call("replacement", "GET", "/patients/handoff-patient/documents")).status, 404);
    assert.ok([403,404].includes((await upload("replacement")).status));
    const apiReview = await call("sa", "POST", "/management/system-users/docu/handoff-impact", { kind: "visits", moves });
    assert.equal(apiReview.status, 200, JSON.stringify(apiReview.data));
    const review = apiReview.data;
    const decoded = JSON.parse(Buffer.from(review.reviewToken.split(".")[0], "base64url").toString());
    assert.ok(!JSON.stringify(decoded).includes(hashes.sa), "native session hashes are never disclosed");
    const apiCommit = await call("sa", "POST", "/management/system-users/docu/handoff",
      { kind: "visits", proposal: review.proposal, reviewToken: review.reviewToken });
    assert.equal(apiCommit.status, 200, JSON.stringify(apiCommit.data));
    const result = apiCommit.data;
    assert.equal(result.count, 1);
    const current = (await h.pg.query(`select * from appointments where id='handoff-visit'`)).rows[0];
    assert.equal(current.doctor_id, "replacement-doctor");
    assert.equal(current.data.reference, "PRIVATE-FIXTURE-HANDOFF-RECEIPT");
    assert.equal(current.patient_id, "handoff-patient"); assert.equal(current.clinic_id, "c1"); assert.equal(current.data.revision, 1);
    const transition = (await h.pg.query(`select * from appointment_transitions where operation_id=$1`, [review.operationId])).rows[0];
    assert.equal(transition.from_doctor_id, "d1"); assert.equal(transition.to_doctor_id, "replacement-doctor");
    assert.equal(transition.before_coordinates.token, "O-07");
    assert.equal(transition.before_coordinates.expectedDurationMinutes, 15);
    assert.equal(transition.after_coordinates.expectedDurationMinutes, 20);
    assert.equal(transition.reference_fingerprint, createHash("sha256").update(current.data.reference).digest("hex"));
    const counters = (await h.pg.query(`select id,data from settings where id like 'tokens:%' order by id`)).rows;
    assert.deepEqual(await h.visitHandoffs.commit(context, review.proposal, review.reviewToken), result);
    assert.deepEqual((await h.pg.query(`select id,data from settings where id like 'tokens:%' order by id`)).rows, counters);
    assert.equal((await h.pg.query(`select count(*)::int n from appointment_transitions where operation_id=$1`, [review.operationId])).rows[0].n, 1);
    const changed = structuredClone(review.proposal); changed.moves[0].date = "2099-01-01";
    await assert.rejects(h.visitHandoffs.commit(context, changed, review.reviewToken), /selected action changed|review again/);
    for (const role of ["docu", "replacement"]) {
      assert.equal((await call(role, "GET", "/patients/handoff-patient")).status, 200, role);
      const docs = await call(role, "GET", "/patients/handoff-patient/documents");
      assert.equal(docs.status, 200, JSON.stringify(docs.data));
      assert.deepEqual(docs.data.items.map(d => d.id), ["handoff-document"]);
      assert.ok(docs.data.uploadClinicIds.includes("c1"));
      assert.equal((await call(role, "GET", "/patient-documents/handoff-document")).status, 200);
      assert.equal((await call(role, "GET", "/patient-documents/cross-clinic-document")).status, 404);
      assert.equal((await call(role, "GET", "/patients/handoff-patient/activity")).status, 200);
      assert.ok([403,404].includes((await call(role, "GET", "/patients/p3")).status), "handoff is not blanket cross-clinic access");
    }
    const originalUpload = await upload("docu"), replacementUpload = await upload("replacement");
    assert.equal(originalUpload.status, 201, JSON.stringify(originalUpload.data));
    assert.equal(replacementUpload.status, 201, JSON.stringify(replacementUpload.data));
    assert.ok([403,404].includes((await upload("replacement", "c3")).status));
    await h.pg.exec(`update appointments set status='completed' where doctor_id='d1';
      update guest_requests set status='rejected' where doctor_id='d1' and status='pending'`);
    const deletion = await h.removals.review(context);
    assert.equal(deletion.ready, true, JSON.stringify(deletion.blockers));
    const bytesBefore = [...h.blobs].map(([key, bytes]) => [key, createHash("sha256").update(bytes).digest("hex")]);
    await h.removals.commit(context, { version: deletion.version, reviewToken: deletion.reviewToken, confirmation: "delete" });
    assert.deepEqual([...h.blobs].map(([key, bytes]) => [key, createHash("sha256").update(bytes).digest("hex")]), bytesBefore);
    assert.equal((await call("docu", "GET", "/patients/handoff-patient")).status, 401);
    assert.equal((await call("replacement", "GET", "/patients/handoff-patient")).status, 200);
    assert.equal((await call("replacement", "GET", "/patient-documents/handoff-document")).status, 200);
    assert.equal((await call("replacement", "GET", "/patient-documents/" + originalUpload.data.id)).status, 200);
    assert.equal((await upload("docu")).status, 401);
    assert.equal((await upload("replacement")).status, 201);
    const original = (await h.pg.query(`select data from appointments where id='a1'`)).rows[0];
    assert.equal(original.data.doctorName, "Deleted doctor");
  } finally { await h.close(); }
});
