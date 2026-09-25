import { Router } from "express";
import { db, appointments, patients, doctors, clinics, branches, appointmentHistory, masters } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, scoped, canRead, scope } from "../lib/auth";
import { assert, parse, query } from "../lib/http";
import { all, one, put, uid, audit, getSettings, filtered, paginate, change } from "../lib/store";
import { availability, localNow, minutes } from "../lib/availability";
import { enrich } from "../lib/entities";
import { appointmentView, transition, lockQueue } from "../lib/appointments";
import { resolveQr } from "./public";
import { queryPage } from "../lib/list-query";
import { snapshotDuration, allocateToken } from "../lib/session-duration";
import { reschedule } from "../lib/reschedule";
import { rank, sessionRows } from "../lib/queue-order";
export const appointmentsRouter = Router();
appointmentsRouter.get("/appointments", async (req, res) => {
  const user = await requireUser(req), q = query(z.ListAppointmentsQueryParams, req);
  const result = await queryPage(user, "appointments", q);
  res.json({ ...result, items: result.items.map((a: any) => appointmentView(a, user)) });
});
appointmentsRouter.get("/appointments/:id", async (req, res) => {
  const user = await requireUser(req), row = await one(appointments, req.params.id as string);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  res.json(appointmentView(row, user));
});
appointmentsRouter.post("/appointments", async (req, res) => {
  const user = await requireUser(req), body = parse(z.CreateAppointmentBody, req.body);
  if (user.role === "patient") assert(body.patientId === user.patientId && ["online", "qr"].includes(body.source), 403, "Patients may book online for themselves only");
  else assert(scope(user, body.clinicId, body.branchId) && (user.role !== "doctor" || body.doctorId === user.doctorId), 403, "Booking outside assigned scope");
  const row = await db.transaction(async tx => {
    await lockQueue(tx, body.doctorId, body.branchId, body.date);
    const existing = await all(appointments, tx);
    if (body.requestId) {
      const original = existing.find(a => a.requestId === body.requestId && a.actorId === user.id);
      if (original) { assert(original.patientId === body.patientId && original.doctorId === body.doctorId && original.clinicId === body.clinicId && original.branchId === body.branchId && original.date === body.date && original.source === body.source, 409, "Idempotency key already used for another booking"); return original; }
    }
    assert(!existing.some(a => a.patientId === body.patientId && a.doctorId === body.doctorId && a.branchId === body.branchId && a.date === body.date && !["cancelled", "completed", "noShow"].includes(a.status)), 409, "Patient already has an active booking for this session");
    const patient = await one(patients, body.patientId, tx);
    assert(patient.status === "active", 409, "Patient is inactive");
    assert(/^\+[1-9][0-9]{7,14}$/.test(patient.mobile), 400, "Complete the patient's international mobile number before booking");
    assert(user.role === "patient" || await canRead(user, "patients", patient), 403, "Patient outside assigned scope");
    const available = await availability(body.doctorId, body.branchId, body.date, tx);
    assert(available.clinicId === body.clinicId, 400, "Clinic/branch mismatch");
    assert(available.available, 409, available.reason || "Session unavailable");
    assert(available.queueMode !== "appointmentsOnly" || body.source !== "walkIn", 409, "Session accepts appointments only");
    assert(available.queueMode !== "walkInsOnly" || body.source === "walkIn", 409, "Session accepts walk-ins only");
    const now = localNow(available.timezone);
    if (body.source === "walkIn") assert(body.date === now.date, 400, "Walk-ins must be for today");
    if (body.date === now.date) {
      assert(!available.queueCloseTime || now.minute < minutes(available.queueCloseTime), 409, "Queue booking has closed");
      if (body.source === "walkIn") {
        assert(now.minute >= minutes(available.queueOpenTime || available.startTime!), 409, "Queue has not opened");
        assert(!available.breakStart || now.minute < minutes(available.breakStart) || now.minute >= minutes(available.breakEnd!), 409, "Doctor is on a break");
      }
    }
    const config = await getSettings(tx);
    assert(!config.requireMobileVerification || patient.mobileVerified, 403, "Patient mobile verification is required");
    if (user.role === "patient") assert(body.termsAccepted, 400, "Terms and privacy consent is required");
    if (body.source === "qr") {
      assert(body.qrReference, 400, "QR reference required");
      const context = await resolveQr(body.qrReference, tx, true);
      assert(context.clinicId === body.clinicId && (!context.branchId || context.branchId === body.branchId) && (!context.doctorId || context.doctorId === body.doctorId), 400, "Booking does not match QR context");
    }
    for (const [field, category] of [["appointmentTypeId", "appointmentType"], ["consultationTypeId", "consultationType"]]) if (body[field]) { const m = await one(masters, body[field], tx); assert(m.category === category && m.status === "active", 400, `Invalid ${field}`); }
    const tokenNumber = await allocateToken(body, tx);
    const doctor = await enrich("doctors", await one(doctors, body.doctorId, tx), tx), clinic = await one(clinics, body.clinicId, tx), branch = await one(branches, body.branchId, tx);
    const id = uid(), timestamp = new Date().toISOString();
    const expectedDurationMinutes = await snapshotDuration(body, tx);
    const queueRank = Math.max(0, ...sessionRows(existing, body).map(rank)) + 1;
    const result = await put(appointments, { id, status: "waiting", patientId: body.patientId, doctorId: body.doctorId, clinicId: body.clinicId, branchId: body.branchId, date: body.date, tokenNumber, requestId: body.requestId, actorId: user.id, data: { ...body, waitingAt: timestamp, reference: `CF-${uid().replaceAll("-", "").toUpperCase().slice(0,16)}`, token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`, patientName: patient.fullName, patientCode: patient.code, doctorName: doctor.fullName, clinicName: clinic.name, branchName: branch.name, timezone: available.timezone, startTime: available.startTime, endTime: available.endTime, history: [{ status: "waiting", occurredAt: timestamp }] } }, tx);
    Object.assign(result, { expectedDurationMinutes, queueRank, revision: 0 });
    await change(appointments, id, { data: result }, tx);
    await put(appointmentHistory, { id: uid(), appointmentId: id, actorId: user.id, toStatus: "waiting" }, tx);
    await audit(user, "book", "appointments", result, tx);
    return result;
  });
  res.status(201).json(appointmentView(row, user));
});
appointmentsRouter.post("/appointments/:id/actions", async (req, res) => {
  const user = await requireUser(req), body = parse(z.TransitionAppointmentBody, req.body);
  res.json(await db.transaction(tx => transition(user, req.params.id as string, body, tx)));
});
appointmentsRouter.post("/appointments/:id/reschedule", async (req, res) => {
  const user = await requireUser(req), body = parse(z.RescheduleAppointmentBody, req.body);
  res.json(await db.transaction(tx => reschedule(user, req.params.id as string, body, tx)));
});