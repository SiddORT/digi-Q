import { db, doctors, users, assignments, masters, branches, clinics } from "@workspace/db";
import { eq } from "drizzle-orm";
import { all, flatten, one } from "./store";
import { managedDoctorAssignments } from "./clinical-membership";
export async function enrich(kind: string, row: any, conn: any = db): Promise<any> {
  row = { ...row };
  if (kind === "doctors" || kind === "users") {
    if (kind === "users") row.mobile ||= "";
    const activeClinics = new Set((await all(clinics, conn)).filter(c => c.status === "active").map(c => c.id));
    const activeBranches = new Set((await all(branches, conn)).filter(b => b.status === "active" && activeClinics.has(b.clinicId)).map(b => b.id));
    const links = (await all(assignments, conn)).filter(a => a.userId === (kind === "doctors" ? row.userId : row.id) && activeClinics.has(a.clinicId) && (!a.branchId || activeBranches.has(a.branchId)));
    if (kind === "doctors") Object.assign(row, await managedDoctorAssignments(row, conn));
    else {
      row.clinicIds = [...new Set(links.map(a => a.clinicId))];
      row.branchIds = [...new Set(links.filter(a => a.branchId).map(a => a.branchId))];
    }
  }
  if (kind === "doctors") {
    const account = await one(users, row.userId, conn); row.fullName = account.fullName; row.email = account.email; row.mobile = account.mobile || "";
    row.createdAt ||= account.createdAt || null;
    row.managingAdminId = row.ownerAdminId;
    row.managingAdminName = (await one(users, row.ownerAdminId, conn)).fullName;
    const [credential] = await conn.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, account.id));
    row.invitationStatus = credential?.passwordHash ? "notRequired" : account.invitationStatus;
    if (account.status !== "active") row.status = "inactive";
    if (row.specializationId) row.specializationName = (await one(masters, row.specializationId, conn)).name;
    row.qualificationNames = (await all(masters, conn)).filter(m => row.qualificationIds?.includes(m.id)).map(m => m.name);
  }
  if (kind === "users") {
    const managerId = row.role === "receptionist" ? row.managingAdminId : null;
    row.managingAdminId = managerId || null;
    row.managingAdminName = managerId ? (await one(users, managerId, conn)).fullName : null;
    const [credential] = await conn.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, row.id));
    row.invitationStatus = credential?.passwordHash ? "notRequired" : row.invitationStatus;
    row.createdAt ||= null;
  }
  if (kind === "clinics") row.adminName = (await one(users, row.adminId, conn)).fullName;
  if (kind === "branches") {
    const clinic = await one(clinics, row.clinicId, conn);
    row.clinicName = clinic.name; row.createdAt ||= null;
    row.inheritEmail ??= !row.email;
    row.inheritPhone ??= !row.phone;
    row.effectiveEmail = row.inheritEmail ? clinic.email || null : row.email || null;
    row.effectivePhone = row.inheritPhone ? clinic.phone || null : row.phone || null;
  }
  if (kind === "qrs") row.reference = row.publicReference;
  return row;
}
export function publicDoctor(row: any) {
  return Object.fromEntries(["id", "fullName", "photoUrl", "specializationName", "qualificationNames", "about", "experienceYears", "consultationFee", "clinicIds", "branchIds"].map(k => [k, row[k]]));
}