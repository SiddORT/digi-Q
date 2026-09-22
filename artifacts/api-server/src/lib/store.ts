import { randomUUID } from "node:crypto";
import { db, settings, auditLogs } from "@workspace/db";
import { eq } from "drizzle-orm";
import { assert } from "./http";
import { otpDeliveryConfigured } from "./otp-delivery";
export const uid = () => randomUUID();
export function flatten(row: any): any {
  if (!row) return null;
  const { data, ...fields } = row;
  return { ...data, ...fields };
}
export async function all(table: any, conn: any = db): Promise<any[]> { return (await conn.select().from(table)).map(flatten); }
export async function one(table: any, id: string, conn: any = db): Promise<any> {
  const [row] = await conn.select().from(table).where(eq(table.id, id));
  assert(row, 404, "Record not found");
  return flatten(row);
}
export async function put(table: any, fields: any, conn: any = db): Promise<any> {
  const [row] = await conn.insert(table).values(fields).returning(); return flatten(row);
}
export async function change(table: any, id: string, fields: any, conn: any = db): Promise<any> {
  const [row] = await conn.update(table).set(fields).where(eq(table.id, id)).returning();
  assert(row, 404, "Record not found"); return flatten(row);
}
export async function audit(user: any, action: string, type: string, row: any, conn: any = db) {
  await conn.insert(auditLogs).values({ id: uid(), actorId: user.id, clinicId: row.clinicId || (type === "clinics" ? row.id : null), branchId: row.branchId || (type === "branches" ? row.id : null), action, entityType: type, entityId: row.id, summary: `${action} ${type} record` });
}
export const defaultSettings = {
  platformName: "ClinicFlow", timezone: "Asia/Kolkata", bookingHorizonDays: 60, cancellationCutoffMinutes: 0,
  requireMobileVerification: false, otpExpirySeconds: 300, otpMaxAttempts: 5, sessionTimeoutMinutes: 60,
  notificationsEnabled: false, queuePollSeconds: 30,
};
export async function getSettings(conn: any = db) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, "platform"));
  return { ...defaultSettings, ...row?.data, otpProviderConfigured: otpDeliveryConfigured(), queuePollSeconds: 30 };
}
export function filtered(rows: any[], q: any) {
  return rows.filter(r => {
    for (const k of ["clinicId", "branchId", "doctorId", "patientId", "managingAdminId", "status", "role", "category", "parentId", "gender", "city", "specializationId", "source", "entityType", "actorId", "date"]) {
      if (q[k] !== undefined && r[k] !== q[k] && !(k === "clinicId" && r.clinicIds?.includes(q[k])) && !(k === "branchId" && r.branchIds?.includes(q[k]))) return false;
    }
    const date = r.date || new Date(r.createdAt || 0).toISOString().slice(0, 10);
    if (q.from && date < q.from || q.to && date > q.to) return false;
    return !q.search || ["name", "fullName", "email", "mobile", "code", "reference", "patientName", "doctorName", "summary"].some(k => String(r[k] || "").toLowerCase().includes(q.search.toLowerCase()));
  });
}
export function paginate(rows: any[], q: any) {
  const sort = q.sort || "-createdAt", key = sort.replace(/^-/, "");
  assert(["createdAt", "name", "fullName", "date", "status", "code", "tokenNumber", "sortOrder", "email"].includes(key), 400, "Unsupported sort field");
  const direction = sort.startsWith("-") ? -1 : 1;
  rows.sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { numeric: true }) * direction || String(a.id ?? "").localeCompare(String(b.id ?? "")) * direction);
  const page = q.page || 1, pageSize = q.pageSize || 20;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}