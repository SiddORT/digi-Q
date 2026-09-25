import { Router } from "express";
import { createHash } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { and, eq, sql, desc, inArray } from "drizzle-orm";
import { db, guestRequests, patients, doctors, branches, clinics, appointments, auditLogs } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { assert, parse, query } from "../lib/http";
import { requireUser, scope } from "../lib/auth";
import { one, put, change, flatten, uid } from "../lib/store";
import { availability } from "../lib/availability";
import { enrich } from "../lib/entities";
import { resolveQr } from "./public";
import { bookAppointment } from "./appointments";
import { createAppointmentQrPayload } from "../lib/appointment-qr";

export const guestRequestsRouter = Router();
export const guestHash = (s: string) => createHash("sha256").update(s).digest("hex");
export function guestReceipt(r: any, appointment?: any) {
  const receipt = Object.fromEntries(["id", "status", "fullName", "clinicName", "branchName", "doctorName", "date", "sessionId", "startTime", "endTime", "timezone", "token", "reason"].map(k => [k, r[k] ?? null]));
  const payload = appointment?.reference ? createAppointmentQrPayload(appointment.reference) : null;
  return { ...receipt, ...(appointment ? Object.fromEntries(
    ["clinicName", "branchName", "doctorName", "date", "sessionId", "startTime", "endTime", "timezone", "token"]
      .map(key => [key, appointment[key] ?? receipt[key]])) : {}),
    appointmentId: r.appointmentId ?? null,
    reference: appointment?.reference ?? null, branchAddress: appointment?.branchAddress ?? r.branchAddress ?? null,
    appointmentStatus: appointment?.status ?? null, revision: appointment?.revision ?? null,
    checkInUrl: payload ? `/check-in?payload=${encodeURIComponent(payload)}` : null };
}
async function currentReceipt(row: any, conn: any = db) {
  let appointment = row.appointmentId ? await one(appointments, row.appointmentId, conn) : null;
  if (appointment && appointment.branchAddress == null) {
    const branch = await one(branches, appointment.branchId, conn);
    appointment = { ...appointment, branchAddress: branch.address ?? null };
  }
  return guestReceipt(row, appointment);
}
function staffView(r: any) {
  return { ...guestReceipt(r), clinicId: r.clinicId, branchId: r.branchId, doctorId: r.doctorId,
    email: r.email ?? null, mobile: r.mobile ?? null, appointmentId: r.appointmentId ?? null, createdAt: new Date(r.createdAt).toISOString() };
}
async function staff(req: any) {
  const user = await requireUser(req);
  assert(["superAdmin", "clinicAdmin", "receptionist"].includes(user.role), 403, "Reception access required");
  return user;
}
const submissionLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many guest requests. Please retry later.", code: "RATE_LIMIT" } });
const receiptLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many receipt requests.", code: "RATE_LIMIT" } });
export async function createGuestRequest(body: any, conn: any = db) {
  // Refuse writes when tickets cannot be signed, not after committing a booking.
  createAppointmentQrPayload("guest-signing-preflight");
  body = { ...body, fullName: body.fullName.trim(), email: body.email?.trim() || null, mobile: body.mobile?.trim() || null };
  assert(body.fullName.length > 0, 400, "Name is required");
  const { receiptSecret, ...input } = body;
  const receiptHash = guestHash(receiptSecret), inputHash = guestHash(JSON.stringify(input));
  return conn.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"guest:" + body.requestId}))`);
    const [existing] = await tx.select().from(guestRequests).where(eq(guestRequests.requestId, body.requestId));
    if (existing) {
      assert(existing.inputHash === inputHash && existing.receiptHash === receiptHash, 409, "Idempotency key already used for another request");
      return flatten(existing);
    }
     await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"guest-receipt:" + receiptHash}))`);
     const [claimed] = await tx.select({ id: guestRequests.id }).from(guestRequests).where(eq(guestRequests.receiptHash, receiptHash));
     assert(!claimed, 409, "Receipt secret already belongs to another request");
    const context = await resolveQr(body.qrReference, tx, true);
    assert((!context.branchId || context.branchId === body.branchId) && (!context.doctorId || context.doctorId === body.doctorId), 400, "Request does not match QR context");
    const available = await availability(body.doctorId, body.branchId, body.date, tx, body);
    assert(available.clinicId === context.clinicId, 400, "Request does not match QR clinic");
    assert(available.available && available.queueMode !== "walkInsOnly", 409, available.reason || "Session does not accept appointments");
    const doctor = await enrich("doctors", await one(doctors, body.doctorId, tx), tx);
    const branch = await one(branches, body.branchId, tx);
    const clinic = await one(clinics, context.clinicId, tx);
    const id = uid(), patientId = uid();
    await put(patients, { id: patientId, clinicId: context.clinicId, branchId: body.branchId, mobile: body.mobile,
      data: { fullName: body.fullName, email: body.email, code: `PAT-${patientId.slice(0, 8)}` } }, tx);
    // The real clinic administrator is the required FK audit principal; the
    // guest policy is distinct from staff authorization and explicitly marked
    // on the appointment. This is not a staff session or a staff permission.
    const appointment = await bookAppointment({ id: clinic.adminId, role: "guest" },
      { patientId, clinicId: context.clinicId, branchId: body.branchId, doctorId: body.doctorId,
        date: body.date, sessionId: available.sessionId, startTime: available.startTime,
        source: "qr", qrReference: body.qrReference, requestId: `guest:${id}` }, tx, true);
    return put(guestRequests, { id, requestId: body.requestId, receiptHash, inputHash,
      clinicId: context.clinicId, branchId: body.branchId, doctorId: body.doctorId, date: body.date,
       status: "confirmed", appointmentId: appointment.id,
      data: { fullName: body.fullName, email: body.email, mobile: body.mobile, qrReference: body.qrReference,
         clinicName: context.clinicName, branchName: branch.name, branchAddress: branch.address || null, doctorName: doctor.fullName,
         sessionId: available.sessionId, startTime: available.startTime, endTime: available.endTime, timezone: available.timezone, token: appointment.token, reason: null } }, tx);
  });
}
export async function decideGuestRequest(user: any, id: string, body: any, conn: any = db) {
  assert(["superAdmin", "clinicAdmin", "receptionist"].includes(user.role), 403, "Reception access required");
  assert(body.reason.trim(), 400, "Decision reason required");
  return conn.transaction(async (tx: any) => {
    const [raw] = await tx.select().from(guestRequests).where(eq(guestRequests.id, id)).for("update");
    assert(raw, 404, "Request not found");
    let row = flatten(raw);
    assert(scope(user, row.clinicId, row.branchId), 403, "Request outside assigned scope");
    const status = body.action === "confirm" ? "confirmed" : "rejected";
    if (row.status !== "pending") { assert(row.status === status, 409, "Request already decided"); return row; }
    let appointmentId = null, token = null;
    if (status === "confirmed") {
      const patientId = uid();
      await put(patients, { id: patientId, clinicId: row.clinicId, branchId: row.branchId, mobile: row.mobile,
        data: { fullName: row.fullName, email: row.email, code: `PAT-${patientId.slice(0, 8)}` } }, tx);
      const appointment = await bookAppointment(user, { patientId, clinicId: row.clinicId, branchId: row.branchId,
        doctorId: row.doctorId, date: row.date, sessionId: row.sessionId, startTime: row.startTime, source: "qr", qrReference: row.qrReference, requestId: `guest:${row.id}` }, tx);
      appointmentId = appointment.id; token = appointment.token;
    }
    row = await change(guestRequests, id, { status, appointmentId, decidedBy: user.id,
      data: { ...raw.data, token, reason: body.reason.trim(), decidedAt: new Date().toISOString() } }, tx);
    await put(auditLogs, { id: uid(), actorId: user.id, clinicId: row.clinicId, branchId: row.branchId,
      action: `guest-${body.action}`, entityType: "guestRequests", entityId: row.id, summary: body.reason.trim() }, tx);
    return row;
  });
}
guestRequestsRouter.post("/public/guest-requests", submissionLimit, async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(201).json(z.CreateGuestRequestResponse.parse(await currentReceipt(await createGuestRequest(parse(z.CreateGuestRequestBody, req.body)))));
});
guestRequestsRouter.post("/public/guest-receipt", receiptLimit, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const body = parse(z.GetGuestReceiptBody, req.body);
  const [row] = await db.select().from(guestRequests).where(eq(guestRequests.receiptHash, guestHash(body.receiptSecret)));
  assert(row, 404, "Receipt not found");
  res.json(z.GetGuestReceiptResponse.parse(await currentReceipt(flatten(row))));
});
guestRequestsRouter.get("/guest-requests", async (req, res) => {
  const user = await staff(req), q = query(z.ListGuestRequestsQueryParams, req);
  const page = q.page || 1, pageSize = q.pageSize || 20;
  const clauses: any[] = [eq(guestRequests.status, q.status || "pending")];
  if (q.clinicId) clauses.push(eq(guestRequests.clinicId, q.clinicId));
  if (q.branchId) clauses.push(eq(guestRequests.branchId, q.branchId));
  if (q.doctorId) clauses.push(eq(guestRequests.doctorId, q.doctorId));
  if (q.date) clauses.push(eq(guestRequests.date, q.date));
  if (q.sessionId) clauses.push(sql`${guestRequests.data}->>'sessionId'=${q.sessionId}`);
  if (q.startTime) clauses.push(sql`${guestRequests.data}->>'startTime'=${q.startTime}`);
  if (user.role !== "superAdmin") {
    clauses.push(inArray(guestRequests.clinicId, user.clinicIds));
    if (user.role === "receptionist") clauses.push(inArray(guestRequests.branchId, user.branchIds));
  }
  const where = and(...clauses);
  const rows = await db.select().from(guestRequests).where(where).orderBy(desc(guestRequests.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(guestRequests).where(where);
  res.set("Cache-Control", "no-store").json(z.ListGuestRequestsResponse.parse({ items: rows.map(r => staffView(flatten(r))), total: count.total, page, pageSize }));
});
guestRequestsRouter.post("/guest-requests/:id/decision", async (req, res) => {
  const user = await staff(req), body = parse(z.DecideGuestRequestBody, req.body);
  res.set("Cache-Control", "no-store").json(z.DecideGuestRequestResponse.parse(staffView(await decideGuestRequest(user, req.params.id as string, body))));
});