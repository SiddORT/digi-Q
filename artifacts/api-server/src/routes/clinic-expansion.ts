import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import { db, clinics, branches, doctors, qrs, users, staffSessionProofs } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireUser, requireSessionIdentity, authoritativeStaffSessionExpiry, roles } from "../lib/auth";
import { parse, query, assert, HttpError } from "../lib/http";
import { all, one, flatten, put, uid, audit } from "../lib/store";
import { enrich, publicDoctor } from "../lib/entities";
import { validSlug, clinicSettingsResult, saveClinicSetup, attachOwnDoctor, createOwnedClinic, previewClinicSetup } from "../lib/clinic-expansion";
import { queryMetrics } from "../lib/list-query";
import { configuredDuration } from "../lib/session-duration";
import { clinicalMembership, clinicalBranchIds } from "../lib/clinical-membership";

export const clinicExpansionRouter = Router();
const anonymousLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
const registrationLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
clinicExpansionRouter.get("/public/registration-options", anonymousLimit, async (_req, res) => {
  const result: Record<string, any[]> = {};
  for (const [key, category] of [["categories", "clinicCategory"], ["specialities", "specialization"], ["qualifications", "qualification"]]) {
    result[key] = (await db.execute(sql`select id,data->>'name' as name from masters where status='active' and category=${category} order by data->>'name',id limit 200`)).rows;
  }
  res.json(result);
});
clinicExpansionRouter.get("/clinics/:id/settings", async (req, res) => {
  const user = await requireUser(req), clinic = await one(clinics, req.params.id as string);
  assert(user.role === "superAdmin" || user.role === "clinicAdmin" && clinic.adminId === user.id, 403, "Clinic settings are outside your ownership");
  res.json(await clinicSettingsResult(clinic.id));
});
clinicExpansionRouter.patch("/clinics/:id/settings", async (req, res) => {
  const user = await requireUser(req), body = parse(z.UpdateClinicSettingsBody, req.body);
  res.json(await db.transaction(tx => saveClinicSetup(user, req.params.id as string, body, tx)));
});
clinicExpansionRouter.post("/clinics/:id/settings/preview", async (req, res) => {
  const user = await requireUser(req), body = parse(z.PreviewClinicSettingsBody, req.body);
  res.json(await previewClinicSetup(user, req.params.id as string, body));
});
clinicExpansionRouter.post("/me/doctor-profile", async (req, res) => {
  const user = await requireUser(req), body = parse(z.AttachOwnDoctorProfileBody, req.body);
  res.json(await db.transaction(tx => attachOwnDoctor(user, body, tx)));
});
clinicExpansionRouter.post("/clinic-registration", registrationLimit, async (req, res) => {
  const { clerkId, sessionId } = requireSessionIdentity(req), body = parse(z.RegisterClinicBody, req.body);
  const identity = await clerkClient.users.getUser(clerkId);
  const email = identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId && e.verification?.status === "verified")?.emailAddress.toLowerCase();
  assert(email, 400, "Verify your primary email before registering a clinic");
  assert(identity.passwordEnabled, 403, "Set an account password before registering a clinic");
  try { await clerkClient.users.verifyPassword({ userId: clerkId, password: body.password }); }
  catch (error: any) {
    if ([400, 401, 403, 422].includes(Number(error?.status || error?.statusCode))) throw new HttpError(401, "Password is incorrect", "INVALID_STAFF_PASSWORD");
    throw new HttpError(503, "Authentication service unavailable. Please retry.", "AUTH_PROVIDER_UNAVAILABLE");
  }
  const expiresAt = await authoritativeStaffSessionExpiry(sessionId, clerkId);
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clerkId}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"user-email:" + email}))`);
    const existing = (await tx.execute(sql`select id from users where clerk_id=${clerkId} or lower(email)=${email} limit 1`)).rows;
    assert(!existing.length, 409, "This identity already has an application profile. Existing roles cannot be changed by registration.");
    assert(body.clinic.slug && body.branches.every((b: any) => b.slug), 400, "Choose public URLs for the clinic and each branch");
    const admin = await put(users, { id: uid(), clerkId, fullName: body.fullName, email, mobile: body.mobile, role: "clinicAdmin", invitationStatus: "notRequired" }, tx);
    const result = await createOwnedClinic(admin, admin, body, tx);
    await tx.insert(staffSessionProofs).values({ sessionId, clerkUserId: clerkId, expiresAt }).onConflictDoUpdate({ target: staffSessionProofs.sessionId, set: { clerkUserId: clerkId, expiresAt, createdAt: new Date() } });
    await audit(admin, "registerClinic", "users", admin, tx);
    return result;
  });
  res.status(201).json(result);
});
clinicExpansionRouter.get("/public/slug-availability", anonymousLimit, async (req, res) => {
  const q = query(z.CheckSlugAvailabilityQueryParams, req);
  const rows = validSlug(q.slug) ? (await db.execute(q.clinicId
    ? sql`select id from branches where clinic_id=${q.clinicId} and data->>'slug'=${q.slug} limit 1`
    : sql`select id from clinics where data->>'slug'=${q.slug} limit 1`)).rows : [true];
  res.json({ slug: q.slug, available: validSlug(q.slug) && !rows.length });
});
clinicExpansionRouter.get("/public/clinics-by-slug/:clinicSlug{/:branchSlug}", anonymousLimit, async (req, res) => {
  const clinicSlug = req.params.clinicSlug as string, branchSlug = req.params.branchSlug as string | undefined;
  assert(validSlug(clinicSlug) && (!branchSlug || validSlug(branchSlug)), 404, "Clinic page not found");
  const [record] = (await db.execute(sql`select * from clinics where status='active' and data->>'slug'=${clinicSlug} limit 1`)).rows;
  assert(record, 404, "Clinic page not found");
  const clinic = flatten({ ...record, adminId: (record as any).admin_id });
  const branchRecords = (await db.execute(sql`select * from branches where clinic_id=${clinic.id} and status='active' order by id limit 100`)).rows;
  const branchList = branchRecords.map((r: any) => {
    const b = flatten(r);
    return { id: b.id, name: b.name, slug: b.slug || null, address: b.address || null, city: b.city || null, timezone: b.timezone || "Asia/Kolkata",
      effectiveEmail: (b.inheritEmail ?? !b.email) ? clinic.email || null : b.email || null,
      effectivePhone: (b.inheritPhone ?? !b.phone) ? clinic.phone || null : b.phone || null, openingHours: b.openingHours ?? null };
  });
  const branch = branchSlug ? branchList.find(b => b.slug === branchSlug) : branchList.length === 1 ? branchList[0] : null;
  assert(!branchSlug || branch, 404, "Branch page not found");
  const publicDoctors = [];
  if (branch) {
    const candidates = (await db.execute(sql`select d.id from doctors d where ${clinicalMembership(sql`d.id`, sql`${branch.id}`)} order by d.id limit 100`)).rows;
    for (const row of candidates) {
      const id = row.id as string;
      const metric = await queryMetrics({ role: "superAdmin" }, { clinicId: clinic.id, branchId: branch.id, doctorId: id });
      const branchIds = await clinicalBranchIds(id);
      publicDoctors.push({ ...publicDoctor({ ...await enrich("doctors", await one(doctors, id)), branchIds, clinicIds: [clinic.id] }),
        averageConsultationMinutes: metric.averageConsultationMinutes, expectedDurationMinutes: await configuredDuration(id, clinic.id) });
    }
  }
  const references = branch ? (await db.execute(sql`select public_reference from qrs where clinic_id=${clinic.id} and branch_id=${branch.id} and doctor_id is null and status='active' order by created_at,id limit 1`)).rows : [];
  const [counts] = (await db.execute(sql`select count(*)::int as count from doctors d where exists(select 1 from branches b where b.clinic_id=${clinic.id} and ${clinicalMembership(sql`d.id`, sql`b.id`)})`)).rows;
  const metric = await queryMetrics({ role: "superAdmin" }, { clinicId: clinic.id });
  res.set("Cache-Control", "no-store").json({ clinic: { id: clinic.id, name: clinic.name, slug: clinic.slug, address: clinic.address || null, email: clinic.email || null, phone: clinic.phone || null, doctorCount: Number(counts.count), averageConsultationMinutes: metric.averageConsultationMinutes },
    branches: branchList, branch: branch || null, qrReference: references[0]?.public_reference || null, doctors: publicDoctors });
});