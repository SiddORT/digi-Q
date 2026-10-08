import { db, doctors, users, assignments, branches, clinics } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";
import { all } from "./store";

// Single source of truth for clinical (not administrative) branch membership.
// An administrator's clinic-only assignment is necessary but never sufficient:
// the branch must also be explicitly selected on their self-owned doctor profile.
export function clinicalMembership(doctorId: SQL, branchId?: SQL, clinicId?: SQL): SQL {
  return sql`exists (
    select 1 from doctors cm_d
    join users cm_u on cm_u.id=cm_d.user_id and cm_u.status='active'
    join branches cm_b on cm_b.status='active'
    join clinics cm_c on cm_c.id=cm_b.clinic_id and cm_c.status='active'
    where cm_d.id=${doctorId} and cm_d.status='active'
      ${branchId ? sql`and cm_b.id=${branchId}` : sql``}
      ${clinicId ? sql`and cm_c.id=${clinicId}` : sql``}
      and (
        (cm_u.role='doctor' and exists (
          select 1 from assignments cm_a where cm_a.user_id=cm_d.user_id
          and cm_a.clinic_id=cm_b.clinic_id and cm_a.branch_id=cm_b.id
        ))
        or (cm_u.role='clinicAdmin' and cm_d.user_id=cm_d.owner_admin_id
          and cm_c.admin_id=cm_u.id
          and jsonb_typeof(cm_d.data->'branchIds')='array'
          and cm_d.data->'branchIds' ? cm_b.id
          and exists (select 1 from assignments cm_a where cm_a.user_id=cm_u.id
            and cm_a.clinic_id=cm_c.id and cm_a.branch_id is null))
      )
  )`;
}

// Management visibility is deliberately independent of availability. An
// inactive doctor/account/branch still needs to be discoverable by its owner
// for editing and reactivation; none of these links grant clinical access.
export function managedDoctorLinks(doctorId: SQL): SQL {
  return sql`select a.clinic_id, a.branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='doctor'
    join assignments a on a.user_id=md.user_id
    join clinics c on c.id=a.clinic_id and c.admin_id=md.owner_admin_id
    where md.id=${doctorId} and (a.branch_id is null or exists (
      select 1 from branches b where b.id=a.branch_id and b.clinic_id=c.id))
    union all
    select a.clinic_id, null::text as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.branch_id is null
    join clinics c on c.id=a.clinic_id and c.admin_id=mu.id
    where md.id=${doctorId}
    union all
    select b.clinic_id, b.id as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join branches b on jsonb_typeof(md.data->'branchIds')='array' and md.data->'branchIds' ? b.id
    join clinics c on c.id=b.clinic_id and c.admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.clinic_id=c.id and a.branch_id is null
    where md.id=${doctorId}`;
}

export async function managedDoctorAssignments(doctor: any, conn: any = db): Promise<{ clinicIds: string[]; branchIds: string[] }> {
  const accounts = await all(users, conn), links = await all(assignments, conn);
  const branchRows = await all(branches, conn), clinicRows = await all(clinics, conn);
  const account = accounts.find(u => u.id === doctor.userId);
  if (!account) return { clinicIds: [], branchIds: [] };
  const ownedClinics = clinicRows.filter(c => c.adminId === doctor.ownerAdminId);
  const clinicIds = new Set<string>(), branchIds = new Set<string>();
  if (account.role === "doctor") {
    for (const link of links.filter(a => a.userId === doctor.userId && ownedClinics.some(c => c.id === a.clinicId))) {
      if (link.branchId && !branchRows.some(b => b.id === link.branchId && b.clinicId === link.clinicId)) continue;
      clinicIds.add(link.clinicId);
      if (link.branchId) branchIds.add(link.branchId);
    }
  } else if (account.role === "clinicAdmin" && doctor.ownerAdminId === doctor.userId) {
    for (const clinic of ownedClinics.filter(c => links.some(a => a.userId === account.id && a.clinicId === c.id && !a.branchId))) {
      clinicIds.add(clinic.id);
      if (Array.isArray(doctor.branchIds)) for (const branch of branchRows.filter(b => b.clinicId === clinic.id && doctor.branchIds.includes(b.id))) branchIds.add(branch.id);
    }
  }
  return { clinicIds: [...clinicIds], branchIds: [...branchIds] };
}

export async function clinicalBranchIds(doctorId: string, conn: any = db): Promise<string[]> {
  const doctorRows = await all(doctors, conn), accountRows = await all(users, conn);
  const links = await all(assignments, conn), branchRows = await all(branches, conn), clinicRows = await all(clinics, conn);
  const doctor = doctorRows.find(d => d.id === doctorId);
  const account = accountRows.find(u => u.id === doctor?.userId);
  if (doctor?.status !== "active" || account?.status !== "active") return [];
  const selected = doctor.branchIds;
  return branchRows.filter(branch => {
    if (branch.status !== "active") return false;
    const clinic = clinicRows.find(c => c.id === branch.clinicId);
    if (clinic?.status !== "active") return false;
    if (account.role === "doctor") return links.some(a => a.userId === doctor.userId && a.clinicId === branch.clinicId && a.branchId === branch.id);
    return account.role === "clinicAdmin" && doctor.userId === doctor.ownerAdminId
      && clinic.adminId === account.id && Array.isArray(selected) && selected.includes(branch.id)
      && links.some(a => a.userId === account.id && a.clinicId === clinic.id && !a.branchId);
  }).map(b => b.id).sort();
}

export async function isClinicalMember(doctorId: string, branchId: string, conn: any = db): Promise<boolean> {
  return (await clinicalBranchIds(doctorId, conn)).includes(branchId);
}