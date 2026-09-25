import { Router } from "express";
import { db, clinics, branches, doctors, qrs, appointments } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { all, one, filtered, paginate } from "../lib/store";
import { query, assert } from "../lib/http";
import { enrich, publicDoctor } from "../lib/entities";
import { availability, availabilitySessions, localNow } from "../lib/availability";
import { getPresence } from "../lib/presence";
import { orderedReservations, pendingStatuses, sessionRows } from "../lib/queue-order";
import { queryPage } from "../lib/list-query";
export const publicRouter = Router();
for (const [kind, table, schema] of [
  ["clinics", clinics, z.ListPublicClinicsQueryParams],
  ["branches", branches, z.ListPublicBranchesQueryParams],
  ["doctors", doctors, z.ListPublicDoctorsQueryParams],
] as const) {
  publicRouter.get(`/public/${kind}`, async (req, res) => {
    const q = query(schema, req);
    const extra = kind === "branches" ? sql`exists(select 1 from clinics c where c.id=r.clinic_id and c.status='active') and ${"doctorId" in q && q.doctorId ? sql`exists(select 1 from doctors d join users u on u.id=d.user_id where d.id=${q.doctorId} and d.status='active' and u.status='active')` : sql`true`}`
      : kind === "doctors" ? sql`exists(select 1 from assignments a join clinics c on c.id=a.clinic_id join branches b on b.id=a.branch_id where a.user_id=r.user_id and c.status='active' and b.status='active')`
        : sql`true`;
    const result = await queryPage({ role: "superAdmin" }, kind, { ...q, status: "active" }, extra);
    if (kind === "doctors") result.items = result.items.map(publicDoctor);
    if (kind === "clinics") result.items = result.items.map(({ ownerId, ...r }: any) => r);
    res.json(result);
  });
}
publicRouter.get("/public/availability", async (req, res) => {
  const q = query(z.GetPublicAvailabilityQueryParams, req); res.json(await availability(q.doctorId, q.branchId, q.date, db, q));
});
publicRouter.get("/public/availability/sessions", async (req, res) => {
  const q = query(z.GetPublicAvailabilitySessionsQueryParams, req); res.json(await availabilitySessions(q.doctorId, q.branchId, q.date));
});
export async function resolveQr(reference: string, conn: any = db, lock = false) {
  let qr;
  if (lock) {
    const [row] = await conn.select().from(qrs).where(eq(qrs.publicReference, reference)).for("update");
    qr = row;
  } else qr = (await all(qrs, conn)).find(q => q.publicReference === reference);
  assert(qr?.status === "active", 404, "Booking link expired or revoked");
  assert(qr, 404, "Booking link expired or revoked");
  const clinic = await one(clinics, qr.clinicId, conn);
  const branch = qr.branchId ? await one(branches, qr.branchId, conn) : null;
  const doctor = qr.doctorId ? await enrich("doctors", await one(doctors, qr.doctorId, conn), conn) : null;
  assert(clinic.status === "active" && (!branch || branch.status === "active") && (!doctor || doctor.status === "active"), 404, "Booking link unavailable");
  assert((!branch || branch.clinicId === clinic.id) && (!doctor || doctor.clinicIds.includes(clinic.id) && (!branch || doctor.branchIds.includes(branch.id))), 404, "Booking link context is no longer available");
  return { reference, clinicId: clinic.id, clinicName: clinic.name, clinicAddress: clinic.address || null, branchAddress: branch?.address || null, branchCity: branch?.city || null, branchTimezone: branch?.timezone || null, branchId: branch?.id || null, branchName: branch?.name || null, doctorId: doctor?.id || null, doctorName: doctor?.fullName || null };
}
export async function publicDisplay(reference: string, conn: any = db) {
  const context = await resolveQr(reference, conn);
  assert(context.branchId, 404, "Display requires a branch-specific QR");
  const branch = await one(branches, context.branchId, conn);
  const timezone = branch.timezone || "Asia/Kolkata", date = localNow(timezone).date;
  const assigned = [];
  for (const row of await all(doctors, conn)) {
    if (row.status !== "active" || context.doctorId && row.id !== context.doctorId) continue;
    const doctor = await enrich("doctors", row, conn);
    if (doctor.status === "active" && doctor.clinicIds.includes(context.clinicId) && doctor.branchIds.includes(branch.id)) assigned.push(doctor);
  }
  const rows = (await all(appointments, conn)).filter(a => a.clinicId === context.clinicId && a.branchId === branch.id && a.date === date);
  const sessions = [];
  for (const doctor of assigned.sort((a,b) => a.fullName.localeCompare(b.fullName))) {
    const scheduled = await availabilitySessions(doctor.id, branch.id, date, conn);
    // Preserve old appointment snapshots when a weekly template has since moved.
    const doctorRows = rows.filter(a => a.doctorId === doctor.id);
    const contexts = new Map(scheduled.map(s => [s.startTime, s]));
    for (const entry of doctorRows) if (!contexts.has(entry.startTime)) contexts.set(entry.startTime, entry);
    for (const schedule of contexts.values()) {
    const entries = sessionRows(rows, { doctorId: doctor.id, branchId: branch.id, date, startTime: schedule.startTime });
    const pending = orderedReservations(entries.filter(a => pendingStatuses.includes(a.status)));
    const current = entries.find(a => ["called", "inConsultation"].includes(a.status));
    const presence = await getPresence({ doctorId: doctor.id, branchId: branch.id, date, startTime: schedule.startTime, sessionId: schedule.sessionId }, conn);
    sessions.push({ doctorId: doctor.id, doctorName: doctor.fullName, sessionId: schedule.sessionId || null, presence: presence.status, startTime: schedule.startTime || entries[0]?.startTime || null, endTime: schedule.endTime || entries[0]?.endTime || null,
      currentToken: current?.token || null, currentStatus: current?.status || null, nextToken: pending[0]?.token || null, waitingTokens: pending.map(a => a.token), waitingCount: pending.length, completedCount: entries.filter(a => a.status === "completed").length });
    }
  }
  return { clinic: { name: context.clinicName }, branch: { name: branch.name, address: branch.address || null, city: branch.city || null, timezone }, date, updatedAt: new Date().toISOString(), sessions };
}
publicRouter.get("/public/display/:reference", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const display = await publicDisplay(req.params.reference as string);
  z.GetPublicDisplayResponse.parse(display);
  res.json(display);
});
publicRouter.get("/public/qr/:reference", async (req, res) => { res.json(await resolveQr(req.params.reference as string)); });