import { Router } from "express";
import { db, settings } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireUser, roles } from "../lib/auth";
import { assert } from "../lib/http";
import { audit } from "../lib/store";
import { permissionPolicy, permissionModules, permissionActions, configurableRoles } from "../lib/permission-policy";

export const permissionPolicyRouter = Router();
const validKeys = new Set(configurableRoles.flatMap(role => permissionModules.flatMap(module => permissionActions.map(action => `${role}:${module}:${action}`))));
const input = z.object({ revision: z.number().int().min(0), denied: z.array(z.string().refine(v => validKeys.has(v), "Invalid permission")).max(validKeys.size) }).strict();
permissionPolicyRouter.get("/management/permissions", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin"]);
  res.setHeader("Cache-Control", "no-store");
  res.json({ ...await permissionPolicy(), modules: permissionModules, actions: permissionActions, roles: ["superAdmin", ...configurableRoles] });
});
permissionPolicyRouter.put("/management/permissions", async (req, res) => {
  const user = await requireUser(req); roles(user, ["superAdmin"]);
  const parsed = input.safeParse(req.body); assert(parsed.success, 400, "Invalid permission policy");
  const body = parsed.data!;
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('permission-policy'))`);
    const current = await permissionPolicy(tx);
    assert(current.revision === body.revision, 409, "Permissions changed. Reload before saving.");
    const data = { revision: current.revision + 1, denied: [...new Set(body.denied)] };
    await tx.insert(settings).values({ id: "permission-policy", data }).onConflictDoUpdate({ target: settings.id, set: { data } });
    await audit(user, "configure", "permissions", { id: "permission-policy" }, tx);
    return data;
  });
  res.json({ ...result, modules: permissionModules, actions: permissionActions, roles: ["superAdmin", ...configurableRoles] });
});