import { db, settings, users, clinics, assignments, appointments, branches, doctors, patients, schedules, availabilityExceptions, qrs } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";
import { assert } from "./http";
import { audit } from "./store";
import { permissionModules, permissionActions } from "./permission-policy";

const capabilityKeys = new Set(permissionModules.flatMap(m => permissionActions.map(a => `${m}:${a}`)));
const roleSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), name: z.string().trim().min(1).max(80),
  baseRole: z.enum(["clinicAdmin", "doctor", "receptionist"]),
  denied: z.array(z.string().refine(k => capabilityKeys.has(k))).max(capabilityKeys.size),
}).strict();
const bindingSchema = z.object({ userId: z.string().min(1), roleId: z.string().min(1), clinicId: z.string().min(1).optional() }).strict();
export const customRolesInput = z.object({ revision: z.number().int().min(0), roles: z.array(roleSchema).max(100), bindings: z.array(bindingSchema).max(5000) }).strict();
export type CustomRoles = z.infer<typeof customRolesInput>;
export async function getCustomRoles(conn: any = db): Promise<CustomRoles> {
  const [row] = await conn.select().from(settings).where(eq(settings.id, "custom-roles"));
  return row?.data || { revision: 0, roles: [], bindings: [] };
}
export async function saveCustomRoles(actor: any, input: unknown) {
  assert(actor.role === "superAdmin", 403, "Super Admin access required");
  const parsed = customRolesInput.safeParse(input);
  assert(parsed.success, 400, "Invalid roles or assignments");
  const body = parsed.data!;
  assert(new Set(body.roles.map(r => r.id)).size === body.roles.length, 400, "Duplicate role identifier");
  assert(new Set(body.roles.map(r => r.name.toLowerCase())).size === body.roles.length, 400, "Role names must be unique");
  assert(new Set(body.bindings.map(b => `${b.userId}:${b.roleId}:${b.clinicId || ""}`)).size === body.bindings.length, 400, "Duplicate role assignment");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('custom-roles'))`);
    const current = await getCustomRoles(tx);
    assert(current.revision === body.revision, 409, "Roles changed. Reload before saving.");
    for (const binding of body.bindings) {
      const role = body.roles.find(r => r.id === binding.roleId);
      const [user] = await tx.select().from(users).where(eq(users.id, binding.userId));
      assert(role && user && user.role === role.baseRole && user.status === "active", 400, "Assign roles only to active staff with the matching base role");
      if (binding.clinicId) {
        const [clinic] = await tx.select().from(clinics).where(eq(clinics.id, binding.clinicId));
        const links = await tx.select().from(assignments).where(and(eq(assignments.userId, user.id), eq(assignments.clinicId, binding.clinicId)));
        assert(clinic && (clinic.adminId === user.id || links.length > 0), 400, "The user must already belong to this clinic");
      }
    }
    const next = { ...body, revision: current.revision + 1 };
    await tx.insert(settings).values({ id: "custom-roles", data: next }).onConflictDoUpdate({ target: settings.id, set: { data: next } });
    await audit(actor, "configure", "custom_roles", { id: "custom-roles" }, tx);
    return next;
  });
}
export async function enforceCustomRoles(user: any, req: any, module: string, action: string) {
  const config = await getCustomRoles();
  const relevant = config.bindings.filter(b => b.userId === user.id).filter(b => config.roles.some(r => r.id === b.roleId && r.baseRole === user.role && r.denied.includes(`${module}:${action}`)));
  if (!relevant.length) return;
  assert(!relevant.some(b => !b.clinicId), 403, "Your assigned role does not allow this action");
  const parts = req.path.split("/").filter(Boolean);
  let clinicId = req.body?.clinicId || req.query?.clinicId;
  const branchId = req.body?.branchId || req.query?.branchId;
  if (typeof branchId === "string") {
    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
    clinicId = branch?.clinicId;
  }
  const tables: Record<string, any> = { clinics, branches, appointments, doctors, patients, schedules, "availability-exceptions": availabilityExceptions, qrs };
  const table = tables[parts[0]];
  if (parts.length > 1 && !table && !["management", "queue"].includes(parts[0])) clinicId = undefined;
  if (table && parts[1] && !["public", "search"].includes(parts[1])) {
    const [record] = await db.select().from(table).where(eq(table.id, parts[1]));
    const row = record && { ...record.data, ...record };
    clinicId = parts[0] === "clinics" ? row?.id : row?.clinicId;
    if (!clinicId && row?.branchId) {
      const [branch] = await db.select().from(branches).where(eq(branches.id, row.branchId));
      clinicId = branch?.clinicId;
    }
  }
  // Never treat an unscoped query as permission to bypass a clinic restriction.
  assert(typeof clinicId === "string" && clinicId.length > 0, 403, "Select a clinic scope before using this operation with your assigned role");
  assert(!relevant.some(b => b.clinicId === clinicId), 403, "Your assigned role does not allow this action in this clinic");
}