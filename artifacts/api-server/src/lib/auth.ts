import type { Request } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, users, doctors, patients, assignments, branches, clinics, appointments } from "@workspace/db";
import { eq } from "drizzle-orm";
import { assert } from "./http";
import { all, flatten, one, uid } from "./store";
export function requireIdentity(req: Request): string {
  const id = getAuth(req).userId; assert(id, 401, "Sign in required"); return id;
}
export async function findUser(clerkId: string) {
  let [row] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  if (!row) {
    const identity = await clerkClient.users.getUser(clerkId);
    const verified = identity.emailAddresses.filter(e => e.verification?.status === "verified").map(e => e.emailAddress.toLowerCase());
    for (const email of verified) {
      const [invited] = await db.select().from(users).where(eq(users.email, email));
      if (invited && !invited.clerkId) {
        const [linked] = await db.update(users).set({ clerkId, invitationStatus: "notRequired" }).where(eq(users.id, invited.id)).returning(); row = linked; break;
      }
    }
  }
  if (!row) return null;
  const user = flatten(row);
  const activeClinics = new Set((await all(clinics)).filter(c => c.status === "active").map(c => c.id));
  const activeBranches = new Set((await all(branches)).filter(b => b.status === "active" && activeClinics.has(b.clinicId)).map(b => b.id));
  const links = (await all(assignments)).filter(a => a.userId === user.id && activeClinics.has(a.clinicId) && (!a.branchId || activeBranches.has(a.branchId)));
  const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, user.id));
  const [patient] = await db.select().from(patients).where(eq(patients.userId, user.id));
  return { ...user, mobile: user.mobile || "", managingAdminId: user.role === "doctor" ? doctor?.ownerAdminId || null : user.managingAdminId || null, clinicIds: [...new Set(links.map(a => a.clinicId))], branchIds: [...new Set(links.filter(a => a.branchId).map(a => a.branchId))], doctorId: doctor?.id || null, patientId: patient?.id || null };
}
export async function requireUser(req: Request) {
  const user = await findUser(requireIdentity(req)); assert(user, 403, "Complete onboarding first"); assert(user.status === "active", 403, "Account inactive"); return user;
}
export function roles(user: any, allowed: string[]) { assert(allowed.includes(user.role), 403, "Permission denied"); }
export function scope(user: any, clinicId?: string | null, branchId?: string | null) {
  if (user.role === "superAdmin") return true;
  if (!clinicId || !user.clinicIds.includes(clinicId)) return false;
  return !branchId || !["doctor", "receptionist"].includes(user.role) || user.branchIds.includes(branchId);
}
export async function canRead(user: any, kind: string, row: any): Promise<boolean> {
  if (user.role === "superAdmin" || kind === "masters") return true;
  if (kind === "users") {
    if (user.id === row.id) return true;
    if (row.role === "receptionist" && ["clinicAdmin", "doctor"].includes(user.role)) return row.managingAdminId === (user.role === "clinicAdmin" ? user.id : user.managingAdminId);
    return row.role !== "superAdmin" && row.clinicIds?.some((id: string) => scope(user, id)) && (!["doctor", "receptionist"].includes(user.role) || row.branchIds?.some((id: string) => user.branchIds.includes(id)));
  }
  if (kind === "doctors") return user.doctorId === row.id || ["clinicAdmin", "doctor", "receptionist"].includes(user.role) && row.clinicIds?.some((id: string) => scope(user, id)) && (!["doctor", "receptionist"].includes(user.role) || row.branchIds?.some((id: string) => user.branchIds.includes(id)));
  if (kind === "patients") {
    if (user.role === "patient") return row.id === user.patientId;
    if (user.role !== "doctor" && scope(user, row.clinicId, row.branchId)) return true;
    return (await all(appointments)).some(a => a.patientId === row.id && (user.role === "doctor" ? a.doctorId === user.doctorId && scope(user, a.clinicId, a.branchId) : scope(user, a.clinicId, a.branchId)));
  }
  if (kind === "clinics") return scope(user, row.id);
  if (user.role === "patient") return kind === "appointments" && row.patientId === user.patientId;
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) return row.doctorId === user.doctorId && scope(user, row.clinicId, row.branchId);
  if (["schedules", "availability-exceptions"].includes(kind)) {
    const doctor = await one(doctors, row.doctorId);
    const doctorAssigned = (await all(assignments)).some(a => a.userId === doctor.userId && a.branchId === row.branchId);
    if (!doctorAssigned) return false;
  }
  let clinicId = row.clinicId;
  if (!clinicId && row.branchId) clinicId = (await one(branches, row.branchId)).clinicId;
  return scope(user, clinicId, row.branchId || (kind === "branches" ? row.id : null));
}
export async function scoped(user: any, kind: string, rows: any[]) {
  const flags = await Promise.all(rows.map(r => canRead(user, kind, r)));
  return rows.filter((_, i) => flags[i]);
}
export async function projectAssignmentScope(user: any, kind: string, row: any) {
  if (!["users", "doctors"].includes(kind)) return row;
  const own = kind === "users" ? row.id === user.id : row.id === user.doctorId;
  const clinicRows = await all(clinics), branchRows = await all(branches);
  const managementPeer = kind === "users" && row.role === "receptionist" && ["clinicAdmin", "doctor"].includes(user.role) && row.managingAdminId === (user.role === "clinicAdmin" ? user.id : user.managingAdminId);
  const clinicIds = user.role === "superAdmin" || own || managementPeer ? row.clinicIds || [] : (row.clinicIds || []).filter((clinicId: string) => scope(user, clinicId));
  const branchIds = user.role === "superAdmin" || own || managementPeer ? row.branchIds || [] : (row.branchIds || []).filter((branchId: string) => {
    const branch = branchRows.find(b => b.id === branchId);
    return branch && scope(user, branch.clinicId, branch.id);
  });
  const visibleClinics = new Set(clinicIds), visibleBranches = new Set(branchIds);
  return {
    ...row,
    clinicIds,
    branchIds,
    clinicNames: clinicRows.filter(c => visibleClinics.has(c.id)).map(c => c.name),
    branchNames: branchRows.filter(b => visibleBranches.has(b.id)).map(b => b.name),
  };
}
export async function setAssignments(userId: string, clinicIds: string[], branchIds: string[], actor: any, managingAdminId: string, conn: any = db) {
  clinicIds = [...new Set(clinicIds)];
  branchIds = [...new Set(branchIds)];
  const target = await one(users, userId, conn);
  assert(target.role !== "clinicAdmin", 409, "Clinic administrator access is changed only by transferring clinic ownership");
  const existing = (await all(assignments, conn)).filter(a => a.userId === userId);
  const finalClinicIds = new Set(clinicIds);
  for (const link of existing) await conn.delete(assignments).where(eq(assignments.id, link.id));
  for (const clinicId of clinicIds) await conn.insert(assignments).values({ id: uid(), userId, clinicId }).onConflictDoNothing();
  for (const branchId of branchIds) {
    const branch = await one(branches, branchId, conn);
    assert(finalClinicIds.has(branch.clinicId), 400, "Branch must belong to assigned clinic");
    await conn.insert(assignments).values({ id: uid(), userId, clinicId: branch.clinicId, branchId }).onConflictDoNothing();
  }
}
export async function validateAssignments(actor: any, clinicIds: string[], branchIds: string[], targetRole: string, expectedManagingAdminId?: string, conn: any = db) {
  clinicIds = [...new Set(clinicIds)]; branchIds = [...new Set(branchIds)];
  assert(clinicIds.length, 400, "Please select a clinic");
  const clinicRows = [];
  for (const id of clinicIds) { const c = await one(clinics, id, conn); assert(c.status === "active", 403, "Clinic assignment forbidden"); clinicRows.push(c); }
  const owners = [...new Set(clinicRows.map(c => c.adminId))];
  assert(owners.length === 1, 409, "All selected clinics must have the same Clinic Admin owner");
  const managingAdminId = owners[0];
  const manager = await one(users, managingAdminId, conn);
  assert(manager.role === "clinicAdmin" && manager.status === "active", 409, "Selected clinics do not have a valid active Clinic Admin owner");
  if (actor.role === "clinicAdmin") assert(managingAdminId === actor.id, 403, "Clinic assignment forbidden");
  if (actor.role === "doctor") assert(targetRole === "receptionist" && managingAdminId === actor.managingAdminId, 403, "Clinic assignment forbidden");
  if (expectedManagingAdminId) assert(managingAdminId === expectedManagingAdminId, 409, "Changing clinic mappings cannot implicitly transfer the managing Clinic Admin");
  const branchClinics = new Set<string>();
  for (const id of branchIds) { const b = await one(branches, id, conn); assert(b.status === "active" && clinicIds.includes(b.clinicId), 403, "Branch assignment forbidden"); branchClinics.add(b.clinicId); }
  if (targetRole === "receptionist") for (const clinicId of clinicIds) assert(branchClinics.has(clinicId), 400, "Select at least one valid branch for every receptionist clinic");
  return managingAdminId;
}