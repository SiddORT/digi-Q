import { sql, type SQL } from "drizzle-orm";

/** Immutable handoff source coordinates confer only the pre-existing profile/
 * same-clinic records access, never current queue or appointment write access.
 * The server sets this schema capability from the live database, not input. */
export function retainedDoctorVisitSql(user: any, patient: SQL, appointment?: SQL): SQL {
  if (user.role !== "doctor" || !user.handoffHistoryInstalled || !user.doctorId || !user.clinicIds?.length || !user.branchIds?.length)
    return sql`false`;
  const values = (ids: string[]) => sql.join(ids.map(id => sql`${id}`), sql.raw(","));
  return sql`exists(select 1 from appointment_transitions ht where ht.patient_id=${patient}
    and ht.from_doctor_id=${user.doctorId} and ht.clinic_id in (${values(user.clinicIds)})
    and ht.from_branch_id in (${values(user.branchIds)}) ${appointment ? sql`and ht.appointment_id=${appointment}` : sql``})`;
}
