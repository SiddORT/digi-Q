import { db, clinics, branches, doctors, assignments, schedules, masters, qrs, users } from "@workspace/db";
import { sql } from "drizzle-orm";
import { all, one, put, change, uid, audit, getSettings } from "./store";
import { assert, HttpError } from "./http";
import { enrich } from "./entities";
import { localNow, minutes, weeklySessionsOverlap } from "./availability";

const reserved = new Set(["api", "admin", "auth", "login", "logout", "register", "signup", "sign-in", "sign-up", "onboarding", "dashboard", "clinics", "branches", "doctors", "patients", "appointments", "queue", "settings", "reports", "users", "masters", "schedules", "availability", "booking", "book", "display", "qr", "public", "guest", "invite", "invitations", "forgot-password", "reset-password", "account", "me", "assets", "favicon", "__mockup", "clinicflow-project-deck"]);
// Release invariant: production still has pre-0008 ownership functions. Enabling
// this requires a code change AND independent verification of the four 0008 bodies.
export const CONSULTING_ADMIN_ENABLED = false;
export function requireConsultingAdminCapability(): void {
  if (!CONSULTING_ADMIN_ENABLED) throw new HttpError(409, "Clinic Admin clinical profiles are unavailable in this release", "CONSULTING_ADMIN_DISABLED");
}
export function rejectConsultingAdminRequest(input: any): void {
  if (input?.ownDoctor === true) requireConsultingAdminCapability();
}
for (const path of ["register-clinic", "register-doctor", "patient-login", "set-password", "check-in", "doctor", "patient", "receptionist", "audit", "qrs", "exceptions"]) reserved.add(path);
export function validSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(value) && !reserved.has(value);
}
export async function validateSlugWrite(kind: string, body: any, old: any, conn: any) {
  if (!["clinics", "branches"].includes(kind) || body.slug === undefined) return;
  assert(validSlug(body.slug), 400, "Use a non-reserved lowercase URL slug of 3–63 letters, digits or hyphens");
  assert(!old?.slug || old.slug === body.slug, 409, "Public URL is locked after creation. You may change the display name without changing this link.");
  const clinicId = body.clinicId || old?.clinicId;
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"slug:" + kind + ":" + (clinicId || "") + ":" + body.slug}))`);
  const rows = (await conn.execute(kind === "clinics"
    ? sql`select id from clinics where data->>'slug'=${body.slug} and id<>${old?.id || ""} limit 1`
    : sql`select id from branches where clinic_id=${clinicId} and data->>'slug'=${body.slug} and id<>${old?.id || ""} limit 1`)).rows;
  assert(!rows.length, 409, "This public URL is already in use");
}
export function validateOpeningHours(hours: any[]) {
  assert(Array.isArray(hours) && hours.length <= 28, 400, "Invalid branch opening hours");
  for (const h of hours) {
    assert(Number.isInteger(h.dayOfWeek) && h.dayOfWeek >= 0 && h.dayOfWeek <= 6, 400, "Invalid opening weekday");
    assert(minutes(h.startTime) < minutes(h.endTime), 400, "Opening end must follow start");
  }
  for (let i = 0; i < hours.length; i++) for (let j = i + 1; j < hours.length; j++) {
    const a = hours[i], b = hours[j];
    assert(a.dayOfWeek !== b.dayOfWeek || minutes(a.startTime) >= minutes(b.endTime) || minutes(b.startTime) >= minutes(a.endTime), 400, "Branch opening intervals overlap");
  }
}
export function withinBranchHours(branch: any, session: any) {
  if (!session.isOpen || session.isClosed || !Array.isArray(branch.openingHours)) return;
  const day = session.date ? new Date(session.date + "T12:00:00Z").getUTCDay() : session.dayOfWeek;
  assert(branch.openingHours.some((h: any) => h.dayOfWeek === day && minutes(h.startTime) <= minutes(session.startTime) && minutes(h.endTime) >= minutes(session.endTime)), 409, "Doctor session must be within branch opening hours");
  assert(!session.timezone || session.timezone === (branch.timezone || "Asia/Kolkata"), 400, "Sessions with configured branch hours must use the branch timezone");
}
export async function provisionBranchQr(branch: any, old: any, conn: any) {
  if (!branch.slug || old?.slug) return;
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"branch-qr:" + branch.id}))`);
  // A revoked branch QR is an intentional decision: never recreate it implicitly.
  const existing = (await all(qrs, conn)).find(q => q.branchId === branch.id && !q.doctorId);
  if (!existing) {
    const reference = uid();
    await put(qrs, { id: uid(), clinicId: branch.clinicId, branchId: branch.id, publicReference: reference, data: { name: branch.name + " booking", bookingUrl: `/book/${reference}` } }, conn);
  }
}
export async function validateClinicMetadata(body: any, conn: any) {
  if (body.categoryId) {
    const row = await one(masters, body.categoryId, conn);
    assert(row.category === "clinicCategory" && row.status === "active", 400, "Invalid clinic category");
  }
  for (const id of body.specialityIds || []) {
    const row = await one(masters, id, conn);
    assert(row.category === "specialization" && row.status === "active", 400, "Invalid clinic speciality");
  }
}
export async function clinicSettingsResult(clinicId: string, conn: any = db) {
  const clinic = await one(clinics, clinicId, conn), platform = await getSettings(conn);
  return { clinic: await enrich("clinics", clinic, conn),
    branches: await Promise.all((await all(branches, conn)).filter(b => b.clinicId === clinicId).map(b => enrich("branches", b, conn))),
    policies: { bookingHorizonDays: clinic.policies?.bookingHorizonDays ?? platform.bookingHorizonDays, cancellationCutoffMinutes: clinic.policies?.cancellationCutoffMinutes ?? platform.cancellationCutoffMinutes } };
}
export async function saveClinicSetup(actor: any, clinicId: string, body: any, conn: any) {
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"clinics:" + clinicId}))`);
  const old = await one(clinics, clinicId, conn);
  assert(actor.role === "superAdmin" || actor.role === "clinicAdmin" && old.adminId === actor.id, 403, "Clinic settings are outside your ownership");
  const detail = body.clinic || {};
  await validateClinicMetadata(detail, conn);
  await validateSlugWrite("clinics", detail, old, conn);
  const clinic = await change(clinics, clinicId, { data: { ...old, ...detail, policies: { ...old.policies, ...body.policies } } }, conn);
  for (const input of body.branches || []) {
    const prior = input.id ? await one(branches, input.id, conn) : null;
    assert(!prior || prior.clinicId === clinicId, 403, "Branch belongs to another clinic");
    const next = { ...prior, ...input, clinicId, id: prior?.id || uid() };
    await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + next.id}))`);
    if (next.timezone) localNow(next.timezone);
    if (next.openingHours) validateOpeningHours(next.openingHours);
    await validateSlugWrite("branches", next, prior, conn);
    if (next.openingHours?.length) for (const s of (await all(schedules, conn)).filter(s => s.branchId === next.id && s.status === "active")) withinBranchHours(next, s);
    const data = { ...next, timezone: next.timezone || "Asia/Kolkata", code: next.code || `BR-${next.id.slice(0,8)}`, inheritEmail: next.inheritEmail ?? (prior ? !prior.email : true), inheritPhone: next.inheritPhone ?? (prior ? !prior.phone : true) };
    const branch = prior ? await change(branches, next.id, { data }, conn) : await put(branches, { id: next.id, clinicId, data }, conn);
    await provisionBranchQr(branch, prior, conn);
    await audit(actor, prior ? "update" : "create", "branches", branch, conn);
  }
  await audit(actor, "updateSettings", "clinics", clinic, conn);
  return clinicSettingsResult(clinicId, conn);
}
export async function attachOwnDoctor(actor: any, body: any, conn: any) {
  requireConsultingAdminCapability();
  assert(actor.role === "clinicAdmin", 403, "Only the owning Clinic Admin can attach their clinical profile");
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"own-doctor:" + actor.id}))`);
  const selected = [];
  for (const branchId of [...new Set<string>(body.branchIds)]) {
    const branch = await one(branches, branchId, conn), clinic = await one(clinics, branch.clinicId, conn);
    assert(branch.status === "active" && clinic.status === "active" && clinic.adminId === actor.id, 403, "Choose active branches in your own clinic");
    selected.push(branch);
  }
  assert(selected.length, 400, "Select at least one branch for consultations");
  if (body.specializationId) {
    const s = await one(masters, body.specializationId, conn);
    assert(s.category === "specialization" && s.status === "active", 400, "Invalid specialization");
  }
  for (const id of body.qualificationIds || []) {
    const q = await one(masters, id, conn);
    assert(q.category === "qualification" && q.status === "active", 400, "Invalid qualification");
  }
  const prior = (await all(doctors, conn)).find(d => d.userId === actor.id);
  assert(!prior || prior.ownerAdminId === actor.id, 409, "Doctor ownership requires an explicit transfer");
  const id = prior?.id || uid();
  const fields = { data: { ...prior, ...body, code: prior?.code || `DOC-${id.slice(0,8)}` }, ...(body.specializationId ? { specializationId: body.specializationId } : {}) };
  const doctor = prior ? await change(doctors, prior.id, fields, conn) : await put(doctors, { id, userId: actor.id, ownerAdminId: actor.id, ...fields }, conn);
  for (const b of selected) await conn.insert(assignments).values({ id: uid(), userId: actor.id, clinicId: b.clinicId, branchId: b.id }).onConflictDoNothing();
  await audit(actor, "attachOwnDoctorProfile", "doctors", doctor, conn);
  return enrich("doctors", doctor, conn);
}
export async function createOwnedClinic(actor: any, admin: any, input: any, conn: any) {
  rejectConsultingAdminRequest(input);
  assert(input.clinic?.name?.trim() && typeof input.clinic.address === "string", 400, "Clinic name and address are required");
  await validateClinicMetadata(input.clinic, conn);
  await validateSlugWrite("clinics", input.clinic, null, conn);
  const id = uid();
  const clinic = await put(clinics, { id, ownerId: actor.id, adminId: admin.id, data: { ...input.clinic, code: input.clinic.code || `CLN-${id.slice(0,8)}`, timezone: input.clinic.timezone || "Asia/Kolkata" } }, conn);
  await conn.insert(assignments).values({ id: uid(), userId: admin.id, clinicId: id }).onConflictDoNothing();
  await audit(actor, "create", "clinics", clinic, conn);
  const result = await saveClinicSetup({ ...admin, role: "clinicAdmin" }, id, { branches: input.branches || [], policies: input.policies }, conn);
  const doctor = input.ownDoctor ? await attachOwnDoctor(admin, { branchIds: result.branches.map(b => b.id), specializationId: input.specializationId, qualificationIds: input.qualificationIds }, conn) : null;
  return { ...result, doctorId: doctor?.id || null };
}