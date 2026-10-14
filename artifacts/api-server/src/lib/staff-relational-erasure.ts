import { sql } from "drizzle-orm";
import { assert } from "./http";
import { eraseStaffAttribution, unresolvedStaffReferences } from "./staff-attribution-erasure";

const identifier = (name: string) => sql.raw(`"${name.replaceAll('"', '""')}"`);
/**
 * Internal primitive, never an authorization boundary. Caller must hold native
 * credential/writer barriers, verify a current signed exact-row review, classify
 * settings/encrypted history/media, and commit the receipt in the SAME tx.
 * Any unknown relation or integrity error aborts that transaction.
 */
export async function eraseStaffRelationalRows(tx: any, targetId: string) {
  const native = await tx.execute(sql`select id,role,clerk_id from users where id=${targetId} for update`);
  const target = native.rows[0];
  assert(target && ["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(target.role),
    409, "Staff account is no longer eligible");
  const responsibilities = await tx.execute(sql`select 1 from clinics where admin_id=${targetId}
    union all select 1 from users where managing_admin_id=${targetId}
    union all select 1 from doctors where owner_admin_id=${targetId} and user_id is distinct from ${targetId} and status<>'retired'
    union all select 1 from patients where user_id=${targetId} limit 1`);
  assert(!responsibilities.rows.length, 409, "Resolve staff responsibilities and patient-account links first");
  const linked = await tx.execute(sql`select id from doctors where user_id=${targetId} order by id for update`);
  const ids: string[] = linked.rows.map((row: any) => row.id);
  const inDoctors = ids.length ? sql.join(ids.map(id => sql`${id}`), sql.raw(",")) : sql`null`;
  const care = await tx.execute(sql`select 1 from appointments where doctor_id in (${inDoctors})
      and status not in ('completed','noShow','cancelled')
    union all select 1 from guest_requests where doctor_id in (${inDoctors}) and status='pending' limit 1`);
  assert(!care.rows.length, 409, "Resolve unfinished clinical work first");

  // Known structured application metadata only. Immutable handoff projections
  // are excluded: their coordinates contain no native identity/name/contact.
  const attribution = { userId: targetId, doctorIds: new Set(ids) };
  for (const table of ["clinics", "branches", "patients", "appointments", "guest_requests", "qrs", "saved_views"]) {
    const result = await tx.execute(sql`select * from ${identifier(table)} order by id for update`);
    for (const row of result.rows) {
      if (table === "saved_views" && row.user_id === targetId && !row.shared_role) continue;
      const useDoctor = row.doctor_id && ids.includes(row.doctor_id) && !row.data.doctorId;
      const next = eraseStaffAttribution(useDoctor ? { ...row.data, doctorId: row.doctor_id } : row.data, attribution);
      if (useDoctor) delete next.doctorId;
      assert(unresolvedStaffReferences(next, targetId).length === 0, 409, "An application relationship needs explicit review");
      if (JSON.stringify(next) !== JSON.stringify(row.data))
        await tx.execute(sql`update ${identifier(table)} set data=${JSON.stringify(next)}::jsonb where id=${row.id}`);
    }
  }
  // Shared clinical rows and their IDs survive, with narrow anonymous flags.
  await tx.execute(sql`update clinics set owner_id=null,data=data || '{"deletedCreator":true}'::jsonb where owner_id=${targetId}`);
  for (const table of ["appointments", "appointment_history", "appointment_transitions"])
    await tx.execute(sql`update ${identifier(table)} set actor_id=null,deleted_actor=true where actor_id=${targetId}`);
  await tx.execute(sql`update guest_requests set decided_by=null,deleted_decider=true where decided_by=${targetId}`);
  await tx.execute(sql`update patient_documents set uploaded_by=null,deleted_uploader=true where uploaded_by=${targetId}`);
  await tx.execute(sql`delete from saved_views where user_id=${targetId} and shared_role is null`);
  await tx.execute(sql`update saved_views set user_id=null,deleted_owner=true where user_id=${targetId}`);
  // Shared evidence survives; source summaries are generated metadata, not
  // clinical narratives. Do not retain an old copied profile/contact summary.
  await tx.execute(sql`update audit_logs set actor_id=null,deleted_actor=true,
    summary=action || ' ' || entity_type || ' record (Deleted user)' where actor_id=${targetId}`);

  // No schedule inheritance remains enabled against a retired doctor. Frozen
  // historical visit coordinates and immutable transition IDs remain untouched.
  for (const doctorId of ids) {
    await tx.execute(sql`update branches set data=jsonb_set(data,'{linkedSchedule}',
      (data->'linkedSchedule') || '{"enabled":false,"deletedDoctor":true}'::jsonb)
      where data->'linkedSchedule'->>'doctorId'=${doctorId}`);
    for (const table of ["schedules", "availability_exceptions"])
      await tx.execute(sql`delete from ${identifier(table)} where doctor_id=${doctorId}`);
    await tx.execute(sql`update qrs set status='inactive' where doctor_id=${doctorId}`);
    await tx.execute(sql`update doctors set status='retired',retired_at=now(),user_id=null,owner_admin_id=null,specialization_id=null,
      data='{"fullName":"Deleted doctor","deletedDoctor":true}'::jsonb where id=${doctorId}`);
  }
  for (const table of ["auth_sessions", "auth_challenges", "otp_challenges", "notification_reads", "assignments"])
    await tx.execute(sql`delete from ${identifier(table)} where user_id=${targetId}`);
  await tx.execute(sql`delete from staff_session_proofs where clerk_user_id=${targetId}
    or clerk_user_id=${target.clerk_id ?? targetId}`);
  // Actual physical deletion is deliberately left to the outer orchestrator:
  // it must prove JSON/encrypted references and prepare a durable media receipt.
  return { doctorIds: ids };
}
