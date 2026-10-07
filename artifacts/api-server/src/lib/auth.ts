import type { Request } from "express";
import { db, users, doctors, patients, assignments, branches, clinics, appointments, settings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { assert, HttpError } from "./http";
import { all, flatten, one, uid } from "./store";
import { isClinicalMember } from "./clinical-membership";
import { narrowToWorkspace } from "./feature-policy";
import { DEMO_FIXTURE, demoWriteAllowed } from "./demo-policy";
export const STAFF_ROLES = ["superAdmin", "clinicAdmin", "doctor", "receptionist"] as const;
export function isStaffRole(role: string | null | undefined): boolean {
  return Boolean(role && STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]));
}
export function requireIdentity(req: Request): string {
  const id = (req as any).authUserId as string | undefined; assert(id, 401, "Sign in required"); return id;
}
export function requireSessionIdentity(req: Request) {
  const userId = requireIdentity(req), sessionId = (req as any).authSessionHash as string | undefined;
  if (!sessionId) throw new HttpError(401, "Sign in required", "SIGN_IN_REQUIRED");
  return { userId, sessionId };
}
export async function requireStaffSessionProof(req: Request): Promise<void> {
  requireSessionIdentity(req);
}
export async function findUser(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (!row) return null;
  if (row.data?.demoFixture === DEMO_FIXTURE) {
    const [state] = await db.select().from(settings).where(eq(settings.id, DEMO_FIXTURE));
    if (!state?.data?.enabled || state.data.userId !== row.id ||
        row.status !== "active" || row.role !== "clinicAdmin") return null;
    const owned = await db.select().from(clinics).where(eq(clinics.adminId, row.id));
    const doctor = await db.select().from(doctors).where(eq(doctors.userId, row.id));
    const selected = await db.select().from(branches).where(eq(branches.clinicId, state.data.clinicId));
    if (owned.length !== 1 || owned[0].id !== state.data.clinicId ||
      owned[0].status !== "active" ||
      selected.length !== 1 || selected[0].id !== state.data.branchId || selected[0].status !== "active" ||
      doctor.length !== 1 || doctor[0].id !== state.data.doctorId || doctor[0].ownerAdminId !== row.id ||
      doctor[0].status !== "active")
      return null;
    const links = await db.select().from(assignments).where(eq(assignments.userId, row.id));
    if (links.length !== 1 || links[0].clinicId !== state.data.clinicId || links[0].branchId) return null;
  }
  const user = flatten(row);
  const activeClinics = new Set((await all(clinics)).filter(c => c.status === "active").map(c => c.id));
  const activeBranches = new Set((await all(branches)).filter(b => b.status === "active" && activeClinics.has(b.clinicId)).map(b => b.id));
  const links = (await all(assignments)).filter(a => a.userId === user.id && activeClinics.has(a.clinicId) && (!a.branchId || activeBranches.has(a.branchId)));
  const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, user.id));
  const [patient] = await db.select().from(patients).where(eq(patients.userId, user.id));
  return { ...user, mobile: user.mobile || "", managingAdminId: user.role === "doctor" ? doctor?.ownerAdminId || null : user.managingAdminId || null, clinicIds: [...new Set(links.map(a => a.clinicId))], branchIds: [...new Set(links.filter(a => a.branchId).map(a => a.branchId))], doctorId: doctor?.id || null, patientId: patient?.id || null };
}
/** Applies the server-stored active workspace. Only narrows to an already-assigned clinic. */
export async function applyWorkspace<T extends { id: string; role: string; clinicIds: string[]; branchIds: string[] }>(user: T) {
  if (user.role === "superAdmin" || user.role === "patient" || user.clinicIds.length < 2) return { ...user, activeClinicId: null as string | null };
  const [row] = await db.select().from(settings).where(eq(settings.id, `workspace:${user.id}`));
  const active = (row?.data as any)?.clinicId as string | undefined;
  if (!active) return { ...user, activeClinicId: null as string | null };
  const branchRows = await db.select({ id: branches.id, clinicId: branches.clinicId }).from(branches).where(eq(branches.clinicId, active));
  return narrowToWorkspace(user, active, new Map(branchRows.map(b => [b.id, b.clinicId])));
}
export async function requireUser(req: Request) {
  const found = await findUser(requireIdentity(req));
  assert(found, 403, "Complete onboarding first");
  const user = await applyWorkspace(found!);
  assert(user.status === "active", 403, "Account inactive");
  // This session was issued only after locally verified credentials and code.
  if (isStaffRole(user.role)) await requireStaffSessionProof(req);
  if (user.demoFixture === DEMO_FIXTURE)
    assert(demoWriteAllowed(req.method, req.path), 403, "Demo account cannot modify clinic structure or staff");
  const { enforcePermissionPolicy } = await import("./permission-policy");
  await enforcePermissionPolicy(user, req);
  return user;
}
export function roles(user: any, allowed: string[]) { assert(allowed.includes(user.role), 403, "Permission denied"); }
export function scope(user: any, clinicId?: string | null, branchId?: string | null) {
  if (user.role === "superAdmin") return true;
  if (!clinicId || !user.clinicIds.includes(clinicId)) return false;
  return !branchId || !["doctor", "receptionist"].includes(user.role) || user.branchIds.includes(branchId);
}
/** `conn` lets callers inside a transaction evaluate the same rules on their own connection; the policy is identical. */
export async function canRead(user: any, kind: string, row: any, conn: any = db): Promise<boolean> {
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
    return (await all(appointments, conn)).some(a => a.patientId === row.id && (user.role === "doctor" ? a.doctorId === user.doctorId && scope(user, a.clinicId, a.branchId) : scope(user, a.clinicId, a.branchId)));
  }
  if (kind === "clinics") return scope(user, row.id);
  if (user.role === "patient") return kind === "appointments" && row.patientId === user.patientId;
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) return row.doctorId === user.doctorId && scope(user, row.clinicId, row.branchId);
  if (["schedules", "availability-exceptions"].includes(kind)) {
    const doctor = await one(doctors, row.doctorId);
    const doctorAssigned = await isClinicalMember(doctor.id, row.branchId);
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