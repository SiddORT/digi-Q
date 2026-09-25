import { Router } from "express";
import { db, settings, appointments } from "@workspace/db";
import * as z from "@workspace/api-zod";
import { requireUser, roles, scope } from "../lib/auth";
import { parse, query, assert } from "../lib/http";
import { audit, all } from "../lib/store";
import { availability, localNow, doctorContext } from "../lib/availability";
import { lockQueue } from "../lib/appointments";
import { sessionKey } from "../lib/session-duration";
import { getPresence } from "../lib/presence";

export const presenceRouter = Router();
async function context(user: any, doctorId: string, input: any, conn: any = db) {
  roles(user, ["doctor", "clinicAdmin", "superAdmin"]);
  const operational = await doctorContext(doctorId, input.branchId, conn);
  assert(scope(user, operational.clinic.id, input.branchId) && (user.role !== "doctor" || user.doctorId === doctorId), 403, "Doctor presence is outside your scope");
  if (input.startTime) {
    const snapshot = (await all(appointments, conn)).find(a => a.doctorId === doctorId && a.branchId === input.branchId && a.date === input.date && a.startTime === input.startTime && (!input.sessionId || a.sessionId === input.sessionId));
    if (snapshot) return { doctorId, branchId: input.branchId, date: input.date, sessionId: snapshot.sessionId, startTime: snapshot.startTime, clinicId: snapshot.clinicId, timezone: snapshot.timezone || operational.branch.timezone || "Asia/Kolkata" };
  }
  const a = await availability(doctorId, input.branchId, input.date, conn, input);
  assert(scope(user, a.clinicId, a.branchId) && (user.role !== "doctor" || user.doctorId === doctorId), 403, "Doctor presence is outside your scope");
  return { doctorId, branchId: input.branchId, date: input.date, sessionId: a.sessionId, startTime: a.startTime, clinicId: a.clinicId, timezone: a.timezone };
}
presenceRouter.get("/doctors/:id/presence", async (req, res) => {
  const user = await requireUser(req), q = query(z.GetDoctorPresenceQueryParams, req);
  res.json(await getPresence(await context(user, req.params.id as string, q)));
});
presenceRouter.patch("/doctors/:id/presence", async (req, res) => {
  const user = await requireUser(req), body = parse(z.UpdateDoctorPresenceBody, req.body), doctorId = req.params.id as string;
  res.json(await db.transaction(async tx => {
    await lockQueue(tx, doctorId, body.branchId, body.date);
    const session = await context(user, doctorId, body, tx);
    assert(session.date === localNow(session.timezone).date, 409, "Live presence can be changed for today only; future bookings are unchanged");
    const data = { status: body.status, updatedAt: new Date().toISOString(), actorId: user.id, ...session };
    await tx.insert(settings).values({ id: "presence:" + sessionKey(session), data }).onConflictDoUpdate({ target: settings.id, set: { data } });
    await audit(user, `presence:${body.status}:${session.date}:${session.startTime}`, "doctors", { id: doctorId, clinicId: session.clinicId, branchId: session.branchId }, tx);
    return getPresence(session, tx);
  }));
});