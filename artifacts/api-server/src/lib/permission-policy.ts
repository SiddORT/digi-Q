import { db, settings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { assert } from "./http";

export const permissionModules = ["clinics", "branches", "users", "doctors", "patients", "appointments", "queue", "schedules", "availability-exceptions", "qrs", "reports", "templates"] as const;
export const permissionActions = ["read", "create", "update", "delete", "cancel", "reschedule", "complete"] as const;
export const configurableRoles = ["clinicAdmin", "doctor", "receptionist", "patient"] as const;
export async function permissionPolicy(conn: any = db) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, "permission-policy"));
  return row?.data || { revision: 0, denied: [] };
}
export async function enforcePermissionPolicy(user: any, req: { method: string; path: string; body?: any }) {
  if (user.role === "superAdmin") return;
  const parts = req.path.split("/").filter(Boolean);
  let module = parts[0];
  if (module === "clinic-registration") module = "clinics";
  if (module === "me" && parts[1] === "doctor-profile") module = "doctors";
  if (module === "management" && parts[1] === "templates") module = "templates";
  if (module === "clinic-settings") module = "clinics";
  if (!(permissionModules as readonly string[]).includes(module)) return;
  let action = req.method === "GET" ? "read" : req.method === "DELETE" ? "delete" : req.method === "POST" && parts.length === 1 ? "create" : "update";
  if (parts[0] === "me" && parts[1] === "doctor-profile" && req.method === "POST") action = "create";
  if (parts.includes("reschedule")) action = "reschedule";
  if (parts.includes("actions") && ["cancel", "complete"].includes(req.body?.action)) action = req.body.action;
  const policy = await permissionPolicy();
  assert(!policy.denied.includes(`${user.role}:${module}:${action}`), 403, "This operation is disabled by your administrator");
}