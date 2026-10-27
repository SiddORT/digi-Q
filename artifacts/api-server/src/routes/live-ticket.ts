import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { db, appointments, guestRequests } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireUser, canRead } from "../lib/auth";
import { assert, parse } from "../lib/http";
import { one } from "../lib/store";
import { issueLiveLink, liveHash, readLiveStatus, revokeLiveLinks } from "../lib/live-ticket";
import { enforcePermissionPolicy } from "../lib/permission-policy";

export const liveTicketRouter = Router();
const limit = rateLimit({ windowMs: 60_000, limit: 45, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many ticket requests. Try again shortly." } });
liveTicketRouter.use(["/public/live-ticket", "/live-ticket-links", "/appointments/:id/live-ticket-links"], (_req, res, next) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" }); next();
});
liveTicketRouter.use("/public/live-ticket", limit);
liveTicketRouter.post("/live-ticket-links", async (req, res) => {
  const body = parse(z.IssueLiveTicketLinkBody, req.body);
  assert(Boolean(body.appointmentId) !== Boolean(body.receiptSecret), 400, "Choose one ticket authority");
  let row;
  if (body.receiptSecret) {
    const [receipt] = await db.select().from(guestRequests).where(eq(guestRequests.receiptHash, liveHash(body.receiptSecret)));
    assert(receipt?.status === "confirmed" && receipt.appointmentId, 404, "Confirmed receipt not found");
    row = await one(appointments, receipt.appointmentId);
    assert(row.bookingOrigin === "anonymousGuest" && row.clinicId === receipt.clinicId, 403, "Receipt unavailable");
  } else {
    const user = await requireUser(req);
    await enforcePermissionPolicy(user, { method: "GET", path: "/appointments" });
    row = await one(appointments, body.appointmentId!);
    assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  }
  res.json(z.IssueLiveTicketLinkResponse.parse(await issueLiveLink(row)));
});
liveTicketRouter.post("/public/live-ticket", async (req, res) => {
  const body = parse(z.ReadLiveTicketBody, req.body);
  let user = null;
  if ((req as any).authUserId) {
    try {
      user = await requireUser(req);
      await enforcePermissionPolicy(user, { method: "GET", path: "/appointments" });
    } catch (error: any) {
      // The capability still authorizes minimal status; failed identity/policy
      // must never upgrade it to personal access.
      if (![401, 403].includes(error.status)) throw error;
      user = null;
    }
  }
  const result = parse(z.ReadLiveTicketResponse, await db.transaction(tx => readLiveStatus(body.capability, user, tx), { isolationLevel: "repeatable read", accessMode: "read only" }));
  // Preserve date-only appointment wire format after schema validation.
  res.json(result);
});
liveTicketRouter.delete("/appointments/:id/live-ticket-links", async (req, res) => {
  const user = await requireUser(req);
  const row = await one(appointments, parse(z.RevokeLiveTicketLinksParams, req.params).id);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  await revokeLiveLinks(row);
  res.status(204).end();
});
