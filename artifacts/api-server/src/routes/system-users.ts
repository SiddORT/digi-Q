import { Router } from "express";
import { db, users, assignments, clinics } from "@workspace/db";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { requireUser, roles } from "../lib/auth";
import { assert } from "../lib/http";
import { getCustomRoles, saveCustomRoles } from "../lib/custom-roles";

export const systemUsersRouter = Router();
systemUsersRouter.use("/management/system-users", async (req, res, next) => {
  roles(await requireUser(req), ["superAdmin"]); res.setHeader("Cache-Control", "no-store"); next();
});
systemUsersRouter.get("/management/system-users", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), pageSize = 30;
  assert(Number.isSafeInteger(page), 400, "Invalid page");
  const filters: any[] = [inArray(users.role, ["superAdmin", "clinicAdmin", "doctor", "receptionist"])];
  if (typeof req.query.search === "string" && req.query.search) {
    const term = `%${req.query.search.replace(/[%_\\]/g, "\\$&").slice(0, 100)}%`;
    filters.push(or(ilike(users.fullName, term), ilike(users.email, term)));
  }
  if (typeof req.query.role === "string" && req.query.role) filters.push(eq(users.role, req.query.role));
  if (typeof req.query.status === "string" && req.query.status) filters.push(eq(users.status, req.query.status));
  if (typeof req.query.clinicId === "string" && req.query.clinicId) filters.push(sql`(${users.id} in (select ${assignments.userId} from ${assignments} where ${assignments.clinicId}=${req.query.clinicId}) or ${users.id} in (select ${clinics.adminId} from ${clinics} where ${clinics.id}=${req.query.clinicId}))`);
  const where = and(...filters);
  const rows = await db.select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, status: users.status }).from(users).where(where).orderBy(users.fullName, users.id).limit(pageSize).offset((page - 1) * pageSize);
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(users).where(where);
  const ids = rows.map(r => r.id);
  const links = ids.length ? await db.select({ userId: assignments.userId, clinicId: clinics.id, name: sql<string>`${clinics.data}->>'name'` }).from(assignments).innerJoin(clinics, eq(assignments.clinicId, clinics.id)).where(inArray(assignments.userId, ids)) : [];
  const owned = ids.length ? await db.select({ userId: clinics.adminId, clinicId: clinics.id, name: sql<string>`${clinics.data}->>'name'` }).from(clinics).where(inArray(clinics.adminId, ids)) : [];
  res.json({ data: rows.map(row => ({ ...row, clinics: [...new Map([...links, ...owned].filter(l => l.userId === row.id).map(l => [l.clinicId, { id: l.clinicId, name: l.name }])).values()] })), total: count.total, page, pageSize });
});
systemUsersRouter.get("/management/custom-roles", async (req, res) => {
  roles(await requireUser(req), ["superAdmin"]); res.setHeader("Cache-Control", "no-store"); res.json(await getCustomRoles());
});
systemUsersRouter.put("/management/custom-roles", async (req, res) => {
  res.json(await saveCustomRoles(await requireUser(req), req.body));
});