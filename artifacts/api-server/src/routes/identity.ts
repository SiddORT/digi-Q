import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { db, users, doctors, patients } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireIdentity, requireUser, findUser } from "../lib/auth";
import { assert, parse } from "../lib/http";
import { uid, put, change, audit } from "../lib/store";
export const identityRouter = Router();
identityRouter.get("/me", async (req, res) => {
  const clerkId = requireIdentity(req), user = await findUser(clerkId);
  if (user) assert(user.status === "active", 403, "Account inactive");
  res.json({ clerkId, user, doctorId: user?.doctorId || null, patientId: user?.patientId || null, needsOnboarding: !user });
});
identityRouter.post("/onboarding", async (req, res) => {
  const clerkId = requireIdentity(req), body = parse(z.OnboardBody, req.body);
  const identity = await clerkClient.users.getUser(clerkId);
  const email = identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId && e.verification?.status === "verified");
  assert(email, 400, "A verified primary email is required");
  assert(!await findUser(clerkId), 409, "Profile already exists");
  assert((body.intent || "patient") === "patient", 409, "Doctors must be invited with clinic assignments by an authorized administrator");
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clerkId}))`);
    const id = uid(), role = body.intent || "patient";
    const user = await put(users, { id, clerkId, email: email.emailAddress.toLowerCase(), fullName: body.fullName, mobile: body.mobile, role, invitationStatus: "notRequired" }, tx);
    await put(patients, { id: uid(), userId: id, mobile: body.mobile || "", data: { fullName: body.fullName, email: user.email, code: `PAT-${id.slice(0,8)}` } }, tx);
    await audit(user, "onboard", "users", user, tx);
  });
  const user = await findUser(clerkId);
  res.status(201).json({ clerkId, user, doctorId: user?.doctorId, patientId: user?.patientId, needsOnboarding: false });
});
identityRouter.patch("/me", async (req, res) => {
  const user = await requireUser(req), body = parse(z.UpdateMeBody, req.body);
  await db.transaction(async tx => {
    await change(users, user.id, { ...(body.fullName ? { fullName: body.fullName } : {}), ...(body.mobile !== undefined ? { mobile: body.mobile } : {}), data: { photoUrl: body.photoUrl ?? user.photoUrl } }, tx);
    if (user.patientId) {
      const [p] = await tx.select().from(patients).where(eq(patients.id, user.patientId));
      await change(patients, p.id, { data: { ...p.data, ...(body.fullName ? { fullName: body.fullName } : {}) }, ...(body.mobile !== undefined ? { mobile: body.mobile, mobileVerified: body.mobile === p.mobile && p.mobileVerified } : {}) }, tx);
    }
    if (user.doctorId) {
      const [d] = await tx.select().from(doctors).where(eq(doctors.id, user.doctorId));
      await change(doctors, d.id, { data: { ...d.data, ...body } }, tx);
    }
    await audit(user, "updateProfile", "users", user, tx);
  });
  res.json(await findUser(user.clerkId!));
});