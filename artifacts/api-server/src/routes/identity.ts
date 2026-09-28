import { Router } from "express";
import { db, users, doctors, patients } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireIdentity, requireUser, findUser, isStaffRole, requireStaffSessionProof } from "../lib/auth";
import { assert, parse } from "../lib/http";
import { uid, put, change, audit } from "../lib/store";
export const identityRouter = Router();
identityRouter.get("/me", async (req, res) => {
  const userId = requireIdentity(req), user = await findUser(userId);
  if (user) assert(user.status === "active", 403, "Account inactive");
  if (isStaffRole(user?.role)) await requireStaffSessionProof(req);
  res.json({ userId, user, doctorId: user?.doctorId || null, patientId: user?.patientId || null, needsOnboarding: !user || user.role === "patient" && !user.patientId });
});
identityRouter.post("/onboarding", async (req, res) => {
  const userId = requireIdentity(req), body = parse(z.OnboardBody, req.body);
  const existingUser = await findUser(userId);
  if (isStaffRole(existingUser?.role)) await requireStaffSessionProof(req);
  const [identity] = await db.select().from(users).where(eq(users.id, userId));
  assert(identity?.emailVerifiedAt, 400, "A verified email is required");
  assert(identity.role === "patient" && !existingUser?.patientId, 409, "Profile already exists");
  assert((body.intent || "patient") === "patient", 409, "Doctors must be invited with clinic assignments by an authorized administrator");
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [before] = await tx.select().from(patients).where(eq(patients.userId, userId));
    assert(!before, 409, "Profile already exists");
    const user = await change(users, userId, { fullName: body.fullName, mobile: body.mobile }, tx);
    await put(patients, { id: uid(), userId, mobile: body.mobile || "", data: { fullName: body.fullName, email: user.email, code: `PAT-${userId.slice(0,8)}` } }, tx);
    await audit(user, "onboard", "users", user, tx);
  });
  const user = await findUser(userId);
  res.status(201).json({ userId, user, doctorId: user?.doctorId, patientId: user?.patientId, needsOnboarding: false });
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
  res.json(await findUser(user.id));
});