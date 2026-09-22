import { Router } from "express";
import { requireUser } from "../lib/auth";
import { assert } from "../lib/http";
import {
  checkInAppointmentQr,
  getAppointmentQr,
  resolveAppointmentQr,
} from "../lib/appointment-qr";

export const appointmentQrRouter = Router();

function payloadFrom(body: unknown): string {
  assert(body !== null && typeof body === "object" && !Array.isArray(body), 400, "Invalid request body");
  const payload = (body as Record<string, unknown>).payload;
  assert(typeof payload === "string" && payload.length > 0, 400, "Appointment QR payload is required");
  return payload;
}

appointmentQrRouter.get("/appointments/:id/qr", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  res.setHeader("Cache-Control", "no-store");
  res.json(await getAppointmentQr(user, req.params.id as string));
});

appointmentQrRouter.post("/appointment-qr/resolve", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  res.setHeader("Cache-Control", "no-store");
  res.json(await resolveAppointmentQr(user, payloadFrom(req.body)));
});

appointmentQrRouter.post("/appointment-qr/check-in", async (req, res): Promise<void> => {
  const user = await requireUser(req);
  res.setHeader("Cache-Control", "no-store");
  res.json(await checkInAppointmentQr(user, payloadFrom(req.body)));
});