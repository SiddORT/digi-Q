import { db, assignments, branches, clinics } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";
import { all } from "./store";

/** Profile visibility only. Appointment and document authorization remain independent. */
export function doctorRegistrationSql(user: any, clinic: SQL, branch: SQL): SQL {
  return sql`(${!!user.doctorId} and exists (
    select 1 from assignments pr_a
    join clinics pr_c on pr_c.id=pr_a.clinic_id and pr_c.status='active'
    left join branches pr_b on pr_b.id=pr_a.branch_id and pr_b.clinic_id=pr_c.id and pr_b.status='active'
    where pr_a.user_id=${user.id} and pr_a.clinic_id=${clinic}
      and (pr_a.branch_id is null or pr_b.id is not null)
      and (${branch} is null or pr_b.id=${branch})
  ))`;
}

export async function doctorRegisteredPatient(user: any, patient: any, conn: any = db): Promise<boolean> {
  if (!user.doctorId || !patient.clinicId || !user.clinicIds.includes(patient.clinicId) ||
      patient.branchId && !user.branchIds.includes(patient.branchId)) return false;
  const clinicRows = await all(clinics, conn);
  if (!clinicRows.some(c => c.id === patient.clinicId && c.status === "active")) return false;
  const branchRows = await all(branches, conn), links = await all(assignments, conn);
  return links.some(a => a.userId === user.id && a.clinicId === patient.clinicId &&
    (!a.branchId || branchRows.some(b => b.id === a.branchId && b.clinicId === a.clinicId && b.status === "active")) &&
    (!patient.branchId || a.branchId === patient.branchId));
}
