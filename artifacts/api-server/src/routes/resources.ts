import { Router } from "express";
import * as tables from "@workspace/db";
import * as z from "@workspace/api-zod";
import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireUser, roles, scope, scoped, canRead, projectAssignmentScope as projectScope, setAssignments, validateAssignments } from "../lib/auth";
import { all, one, put, change, uid, audit, filtered, paginate } from "../lib/store";
import { HttpError, assert, parse, query } from "../lib/http";
import { enrich } from "../lib/entities";
import { queryPage, assignmentCatalogPredicate } from "../lib/list-query";
import { inviteStaff, requestStaffReset, ensureStaffInvitationConfigured } from "./auth";
import { consumeRateLimit, revokeUserSessions } from "../lib/native-auth";
import { createOwnedClinic, validateSlugWrite, validateOpeningHours, withinBranchHours, provisionBranchQr, validateClinicMetadata, attachOwnDoctor, clinicDisplayPreferences } from "../lib/clinic-expansion";
import { doctorContext, validateTimes, localNow, sessionsOverlap, weeklySessionsOverlap, datePlus, extraSession } from "../lib/availability";
import { assertScheduleSnapshot } from "../lib/schedule-snapshot";
const ADDRESS_KEYS = ["address", "country", "state", "city", "pincode"] as const;
/** Address parts live in the JSON `data` column; merge without touching other profile data. */
async function mergeAddress(table: any, id: string, patch: Record<string, unknown>, tx: any) {
  const [row] = await tx.select({ data: table.data }).from(table).where(eq(table.id, id));
  if (row) await change(table, id, { data: { ...(row.data || {}), ...patch } }, tx);
}
const { db, users, doctors, patients, clinics, branches, masters, schedules, availabilityExceptions, qrs, authChallenges } = tables;
export const resourcesRouter = Router();
const definitions: [string, any, any, any][] = [
  ["clinics", clinics, z.CreateClinicBody, z.ListClinicsQueryParams],
  ["branches", branches, z.CreateBranchBody, z.ListBranchesQueryParams],
  ["doctors", doctors, z.CreateDoctorBody, z.ListDoctorsQueryParams],
  ["users", users, z.CreateUserBody, z.ListUsersQueryParams],
  ["patients", patients, z.CreatePatientBody, z.ListPatientsQueryParams],
  ["masters", masters, z.CreateMasterBody, z.ListMastersQueryParams],
  ["schedules", schedules, z.CreateScheduleBody, z.ListSchedulesQueryParams],
  ["availability-exceptions", availabilityExceptions, z.CreateAvailabilityExceptionBody, z.ListAvailabilityExceptionsQueryParams],
  ["qrs", qrs, z.CreateQrBody, z.ListQrsQueryParams],
];
const governed: Record<string, string[]> = {
  userRole: ["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"],
  appointmentStatus: ["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"],
  queueStatus: ["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"],
  bookingSource: ["online", "walkIn", "phone", "qr"], queueType: ["mixed", "appointmentsOnly", "walkInsOnly"],
  userStatus: ["active", "inactive"], clinicStatus: ["active", "inactive"],
};
async function projectAssignmentScope(user: any, kind: string, row: any) {
  const result = await projectScope(user, kind, row);
  if (kind === "clinics") return { ...result, ...clinicDisplayPreferences(row) };
  if (kind === "branches") return { ...result, ...clinicDisplayPreferences(await one(clinics, row.clinicId)) };
  return result;
}
export function ownershipChangeRequested(value: unknown, current: unknown) {
  return value !== undefined && value !== current;
}

function invitationRedirectUrl(req: any) {
  const configured = process.env.CLINICFLOW_PUBLIC_ORIGIN?.trim();
  const requestOrigin = req?.get?.("origin")?.trim();
  const candidate = configured || requestOrigin;
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    const forwardedHost = String(req?.get?.("x-forwarded-host") || req?.get?.("host") || "").split(",")[0].trim().toLowerCase();
    const isRequestOrigin = !configured;
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()) || url.hostname.endsWith(".localhost");
    if (url.protocol !== "https:" || localHost || (isRequestOrigin && forwardedHost && url.host.toLowerCase() !== forwardedHost)) return undefined;
    url.search = "";
    url.hash = "";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/set-password`;
    return url.toString();
  } catch {
    return undefined;
  }
}

async function withPasswordState(row: any) {
  if (!row?.id || !["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(row.role)) return row;
  const [identity] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, row.id));
  return { ...row, passwordEnabled: Boolean(identity?.passwordHash) };
}

/** Location keys that only the owning Clinic Admin (or Super Admin) may set, including at creation. */
export const CLINIC_OWNED_BRANCH_KEYS = ["openingHours", "timezone", "email", "phone", "inheritEmail", "inheritPhone", "linkedSchedule"];
/** Identity and address of an EXISTING location are clinic-owned onboarding details (owner or Super Admin only). Creation keeps its existing policy. */
export const CLINIC_OWNED_ADDRESS_KEYS = ["name", "slug", "address", "city", "state", "pincode", "country", "area"];
export const CLINIC_OWNED_CLINIC_KEYS = ["name", "address", "city", "state", "pincode", "country", "area", "email", "phone", "slug", "timezone", "dateFormat", "timeFormat", "categoryId", "specialityIds", "referralCode", "bookingHorizonDays", "cancellationCutoffMinutes", "policies"];
export async function authorizeWrite(user: any, kind: string, body: any, old?: any, conn: any = db) {
  if (kind === "doctors") {
    assert(body.userId === undefined, 409, "Doctor identity cannot be reassigned");
    if (old?.userId) {
      const account = await one(users, old.userId, conn);
      if (account.role === "clinicAdmin") {
        assert(old.ownerAdminId === old.userId && (user.role === "superAdmin" || user.id === old.userId && user.role === "clinicAdmin"), 403, "Only Super Admin or the owning Clinic Admin can edit this clinical profile");
        assert(body.ownerAdminId === undefined || body.ownerAdminId === old.userId, 409, "Self-owned doctor profile cannot be transferred");
        assert(body.clinicIds === undefined, 409, "Administrative clinic mappings cannot be edited through a doctor profile");
      }
    }
  }
  const context = { ...old, ...body };
  if (body.timezone) localNow(body.timezone);
  if (old) assert(await canRead(user, kind, old, conn), 403, "Record outside your scope");
  // Generic resource writes must not bypass the owner-only Clinic Settings
  // endpoint. Doctors still retain their existing clinical/profile and
  // clinic/branch creation workflows, but cannot edit a clinic's configuration.
  if (user.role !== "superAdmin" &&
      // Clinic-owned onboarding defaults inherited by new staff (identity, address, contact, timezone, date/time
      // format, policies, opening hours): every edit of an existing clinic or location is owner-only.
      (kind === "clinics" && old && CLINIC_OWNED_CLINIC_KEYS.some(key => Object.hasOwn(body, key)) ||
       kind === "branches" && CLINIC_OWNED_BRANCH_KEYS.some(key => Object.hasOwn(body, key)) ||
       kind === "branches" && old && CLINIC_OWNED_ADDRESS_KEYS.some(key => Object.hasOwn(body, key)))) {
    assert(user.role === "clinicAdmin", 403, "Only the owning Clinic Admin can change clinic settings");
    const clinic = await one(clinics, kind === "clinics" ? old.id : context.clinicId, conn);
    assert(clinic.adminId === user.id, 403, "Only the owning Clinic Admin can change clinic settings");
  }
  if (old && kind === "doctors" && user.role === "clinicAdmin") assert(old.clinicIds.some((id: string) => user.clinicIds.includes(id)), 403, "This doctor is outside your administration scope");
  if (kind === "masters") roles(user, ["superAdmin"]);
  else if (kind === "users") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    if (user.role === "doctor") assert((body.role || old?.role) === "receptionist", 403, "Doctors may manage receptionists only");
    if (user.role === "clinicAdmin") assert(["doctor", "receptionist", "patient"].includes(body.role || old?.role), 403, "Cannot grant administrator roles");
    if (old) assert(!body.role || body.role === old.role, 409, "Existing account roles cannot be switched");
    if (!old) assert(body.role !== "doctor", 400, "Create doctors through the doctor resource so an owning Clinic Admin is recorded");
    if (!old) assert(body.role !== "clinicAdmin", 409, "Create Clinic Admins together with their first clinic through clinic admin onboarding");
  } else if (kind === "doctors") {
    roles(user, ["superAdmin", "clinicAdmin", ...(old?.id === user.doctorId ? ["doctor"] : [])]);
    if (old && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId)) {
      roles(user, ["superAdmin"]);
    }
  }
  else if (kind === "clinics") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    if (old && ownershipChangeRequested(body.adminId, old.adminId)) roles(user, ["superAdmin"]);
  } else if (kind === "patients") {
    roles(user, ["superAdmin", "clinicAdmin", "receptionist", ...(old?.id === user.patientId ? ["patient"] : [])]);
    if (user.role === "patient") assert(body.clinicId === undefined && body.branchId === undefined && body.status === undefined, 403, "Patients cannot change registration scope or status");
    else assert(body.clinicId || old?.clinicId || user.role === "superAdmin", 400, "Clinic registration is required");
    if (old && user.role !== "patient" && user.role !== "superAdmin") assert(scope(user, old.clinicId, old.branchId), 403, "Only the registering clinic may edit this patient's demographics");
    if (old && user.role !== "superAdmin") assert((body.clinicId === undefined || body.clinicId === old.clinicId) && (body.branchId === undefined || body.branchId === old.branchId), 403, "Registration assignments cannot be moved");
  } else if (kind === "branches") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
  } else roles(user, ["superAdmin", "clinicAdmin", "doctor", ...(["qrs", "schedules", "availability-exceptions"].includes(kind) ? ["receptionist"] : [])]);
  if (context.clinicId) {
    if (kind === "branches" && user.role === "doctor") {
      const clinic = await one(clinics, context.clinicId, conn);
      assert(clinic.adminId === user.managingAdminId, 403, "Clinic outside your managing administrator's catalog");
    } else assert(scope(user, context.clinicId, context.branchId), 403, "Clinic outside assigned scope");
  }
  if (context.branchId) {
    const branch = await one(branches, context.branchId, conn);
    assert(!context.clinicId || branch.clinicId === context.clinicId, 400, "Branch does not belong to clinic");
    assert(scope(user, branch.clinicId, branch.id), 403, "Branch outside assigned scope");
  }
  if (context.doctorId) {
    if (["schedules","availability-exceptions"].includes(kind) && user.role==="doctor") assert(context.doctorId===user.doctorId,403,"Doctors may manage only their own schedule.");
    if (context.branchId) await doctorContext(context.doctorId, context.branchId, conn);
    if (context.branchId) {
      const doctor = await enrich("doctors", await one(doctors, context.doctorId, conn), conn);
      assert(doctor.branchIds.includes(context.branchId) && scope(user, (await one(branches, context.branchId, conn)).clinicId, context.branchId), 403, "You cannot manage this doctor's availability at this location");
    }
  }
  if (kind === "qrs") {
    const context = { ...old, ...body };
    if (user.role === "doctor") assert(context.doctorId === user.doctorId, 403, "Doctor booking links must use your own doctor profile");
    if (context.doctorId) {
      const doctor = await enrich("doctors", await one(doctors, context.doctorId, conn), conn);
      assert(doctor.status === "active" && doctor.clinicIds.includes(context.clinicId), 409, "Doctor is not active and assigned to this clinic");
    }
  }
  if ((body.clinicIds || body.branchIds) && user.role === "doctor") assert(kind === "users" && (body.role || old?.role) === "receptionist", 403, "Doctors may assign receptionists only");
  for (const [field, category] of Object.entries({ specializationId: "specialization", clinicTypeId: "clinicType", categoryId: "clinicCategory" })) {
    if (body[field]) { const m = await one(masters, body[field], conn); assert(m.category === category && m.status === "active", 400, `Invalid ${field}`); }
  }
  for (const id of body.qualificationIds || []) { const m = await one(masters, id, conn); assert(m.category === "qualification" && m.status === "active", 400, "Invalid qualification"); }
  if (kind === "masters") {
    if (governed[body.category]) assert(governed[body.category].includes(body.code), 400, "This category uses governed workflow codes");
    if (old && governed[old.category]) assert(body.code === old.code && body.category === old.category, 400, "Governed codes cannot be changed");
    if (body.parentId) { assert(body.parentId !== old?.id, 400, "Master cannot parent itself"); await one(masters, body.parentId, conn); }
  }
}
export async function deliverInvitation(userId: string, redirectUrl?: string) {
  const account = await one(users, userId);
  assert(["clinicAdmin", "doctor", "receptionist"].includes(account.role) && account.status === "active", 403, "Only active staff can be invited");
  const [credential] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (credential?.passwordHash) return;
  await db.update(authChallenges).set({ consumedAt: new Date() }).where(and(
    eq(authChallenges.userId, userId), eq(authChallenges.purpose, "invitation"),
  ));
  try {
    await inviteStaff(null, account);
  } catch (error) {
    // Only mail/configuration failures are an invitation outcome. Database and
    // programming failures still propagate rather than claiming a successful save.
    if (!(error instanceof HttpError) || !["EMAIL_DELIVERY_FAILED", "EMAIL_UNCONFIGURED", "PUBLIC_ORIGIN_UNCONFIGURED"].includes(error.code)) throw error;
    await db.update(authChallenges).set({ consumedAt: new Date() }).where(and(
      eq(authChallenges.userId, userId), eq(authChallenges.purpose, "invitation"),
    ));
    await change(users, userId, { invitationStatus: "failed" });
  }
}
export async function createClinicAdminOnboarding(actor: any, body: any, redirectUrl?: string) {
  roles(actor, ["superAdmin"]);
  const email = body.admin.email.toLowerCase();
  if (body.clinic.timezone) localNow(body.clinic.timezone);
  assert(!(await all(users)).some(u => u.email === email), 409, "Email already belongs to an existing profile; roles cannot be silently changed");
  await ensureStaffInvitationConfigured();
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"user-email:" + email}))`);
    assert(!(await all(users, tx)).some(u => u.email === email), 409, "Email already belongs to an existing profile; roles cannot be silently changed");
    const adminId = uid();
    const admin = await put(users, {
      id: adminId,
      fullName: body.admin.fullName,
      email,
      mobile: body.admin.mobile,
      role: "clinicAdmin",
      status: "active",
      invitationStatus: "failed",
    }, tx);
    const setup = await createOwnedClinic(actor, admin, body, tx);
    const clinic = setup.clinic;
    await audit(actor, "create", "users", admin, tx);
    await audit(actor, "create", "clinics", clinic, tx);
    return {
      branches: setup.branches,
      doctorId: setup.doctorId,
      admin: await enrich("users", admin, tx),
      clinic: await enrich("clinics", clinic, tx),
    };
  });
  await deliverInvitation(result.admin.id, redirectUrl);
  return {
    ...result,
    admin: await enrich("users", await one(users, result.admin.id)),
  };
}
async function save(kind: string, table: any, user: any, body: any, old?: any, redirectUrl?: string, refreshActor?:()=>Promise<any>) {
  await authorizeWrite(user, kind, body, old);
  if (old && ["users", "doctors"].includes(kind) && body.email !== undefined &&
      body.email.toLowerCase() !== old.email.toLowerCase())
    throw new HttpError(409, "Changing a login email requires a separately verified account transfer", "EMAIL_CHANGE_REQUIRES_VERIFICATION");
  if (kind === "users" || kind === "doctors") body.email = body.email.toLowerCase();
  if (!old && (kind === "users" || kind === "doctors")) {
    const existing = (await all(users)).find(u => u.email === body.email);
    assert(!existing, 409, "Email already belongs to an existing profile; roles cannot be silently changed");
    if (kind === "doctors" || ["clinicAdmin", "doctor", "receptionist"].includes(body.role))
      await ensureStaffInvitationConfigured();
  }
  const saved = await db.transaction(async tx => {
    const proposed = { ...old, ...body };
    if (kind === "users" && old?.id === user.id && body.status === "inactive")
      assert(false, 409, "You cannot deactivate your own account");
    if (kind === "branches" && old && (body.openingHours !== undefined || body.timezone !== undefined)) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + old.id}))`);
      assert(!(await one(branches, old.id, tx)).linkedSchedule?.enabled, 409, "This location has linked doctor sessions. Change opening hours through Clinic settings to preview and synchronize safely.");
    }
    await validateSlugWrite(kind, body, old, tx);
    if (kind === "clinics") await validateClinicMetadata(body, tx);
    if (kind === "branches" && proposed.openingHours) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + old?.id}))`);
      validateOpeningHours(proposed.openingHours);
      if (proposed.openingHours.length) for (const s of (await all(schedules, tx)).filter(s => s.branchId === old?.id && s.status === "active")) withinBranchHours(proposed, s);
    }
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${kind + ":" + (proposed.doctorId || old?.id || body.email || "create")}))`);
    if (kind === "doctors" && old && body.branchIds !== undefined) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + old.id}))`);
      for (const location of await all(branches, tx)) {
        assert(!location.linkedSchedule?.enabled || location.linkedSchedule.doctorId !== old.id || body.branchIds.includes(location.id), 409, "Unlink clinic hours before removing this doctor's linked consultation location.");
      }
    }
    if (kind === "schedules") {
      const current = old ? await one(schedules, old.id, tx) : null;
      if(current)assertScheduleSnapshot(current,body.expectedSnapshot);
      assert(!current?.linkedBranchId, 409, "This session follows clinic hours. Unlink it in Clinic settings before making custom edits.");
      const { freezeDoctorSessions } = await import("../lib/session-duration");
      await freezeDoctorSessions(proposed.doctorId, tx);
    }
    if (old && kind === "doctors" && body.ownerAdminId !== undefined) {
      const current = await one(doctors, old.id, tx);
      assert(current.ownerAdminId === old.ownerAdminId, 409, "Doctor ownership changed; reload before retrying");
    }
    if (old && kind === "clinics" && body.adminId !== undefined) {
      const current = await one(clinics, old.id, tx);
      assert(current.adminId === old.adminId, 409, "Clinic ownership changed; reload before retrying");
    }
    if (old && kind === "users" && old.role === "receptionist" && body.managingAdminId !== undefined) {
      const current = await one(users, old.id, tx);
      assert(current.managingAdminId === old.managingAdminId, 409, "Staff ownership changed; reload before retrying");
    }
    if (["schedules", "availability-exceptions"].includes(kind)) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + proposed.doctorId}))`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + proposed.doctorId}))`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + proposed.branchId}))`);
      if(kind==="schedules"){
        if(refreshActor)user=await refreshActor();
        const current=old?await one(schedules,old.id,tx):undefined;
        if(current)assertScheduleSnapshot(current,body.expectedSnapshot);
        await authorizeWrite(user,kind,body,current,tx);
        const location=await one(branches,proposed.branchId,tx);
        assert(typeof location.timezone==="string"&&!!location.timezone,409,"Location timezone is not configured. Configure it in Clinic settings before saving sessions.");
        const doctor=await enrich("doctors",await one(doctors,proposed.doctorId,tx),tx);
        assert(location.status==="active"&&doctor.status==="active"&&doctor.branchIds.includes(location.id)&&doctor.clinicIds.includes(location.clinicId),409,"Doctor assignments or location status changed. Reload the schedule context before saving.");
        assert(proposed.clinicId===location.clinicId,409,"Location no longer belongs to this Clinic Group. Reload the schedule context.");
        assert(!body.timezone||body.timezone===location.timezone,409,"Location timezone changed. Reload and review the schedule before saving.");
      }
      if (kind === "availability-exceptions" && proposed.sessionId) {
        const session = await one(schedules, proposed.sessionId, tx);
        assert(session.doctorId === proposed.doctorId && session.branchId === proposed.branchId && session.dayOfWeek === new Date(proposed.date + "T12:00:00Z").getUTCDay(), 400, "Exception session does not match doctor, branch and date");
      }
    }
    if (kind === "users" && old?.role === "superAdmin" && body.status === "inactive") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('super-admin-protection'))`);
      assert((await all(users, tx)).filter(u => u.role === "superAdmin" && u.status === "active" && u.id !== old.id).length, 409, "Cannot deactivate last active super administrator");
    }
    if (kind === "users" && old?.role === "clinicAdmin" && body.status === "inactive") {
      assert(!(await all(clinics, tx)).some(c => c.adminId === old.id) && !(await all(doctors, tx)).some(d => d.ownerAdminId === old.id) && !(await all(users, tx)).some(u => u.managingAdminId === old.id), 409, "Transfer clinic and staff ownership before deactivating this administrator");
    }
    if (kind === "schedules") {
      validateTimes(proposed);
      const branch = await one(branches, proposed.branchId, tx);
      const candidate = { ...proposed, timezone: proposed.timezone || branch.timezone || "Asia/Kolkata" };
      withinBranchHours(branch, candidate);
      const collisions = (await all(schedules, tx)).filter(s => s.id !== old?.id && s.status === "active" && s.doctorId === proposed.doctorId);
      // A legacy exception was authored for the one original weekly session.
      // Bind it to that stable ID before introducing a second template, rather
      // than accidentally copying its replacement timing onto both sessions.
      const previous = (await all(schedules, tx)).filter(s => s.status === "active" && s.doctorId === proposed.doctorId && s.branchId === proposed.branchId && s.dayOfWeek === proposed.dayOfWeek);
      if (!old && previous.length === 1) {
        for (const e of (await all(availabilityExceptions, tx)).filter(e => !e.sessionId && e.doctorId === proposed.doctorId && e.branchId === proposed.branchId && new Date(e.date + "T12:00:00Z").getUTCDay() === proposed.dayOfWeek)) {
          await change(availabilityExceptions, e.id, { data: { ...e, sessionId: previous[0].id } }, tx);
        }
      }
      for (const session of collisions) {
        const otherBranch = await one(branches, session.branchId, tx);
        const other = { ...session, timezone: session.timezone || otherBranch.timezone || "Asia/Kolkata" };
        assert(!weeklySessionsOverlap(candidate, other), 409, "This schedule overlaps with an existing schedule");
      }
      const datedRows = (await all(availabilityExceptions, tx)).filter(e => e.doctorId === proposed.doctorId && e.status === "active");
      const exceptions = datedRows.filter(e => !e.isExtra);
      const templates = [...collisions, { ...candidate, id: old?.id || "__new_session__" }];
      const dates = new Set<string>();
      for (const e of exceptions) for (const offset of [-1, 0, 1]) dates.add(datePlus(e.date, offset));
      const effective: { session: any; date: string }[] = [];
      for (const date of dates) {
        for (const template of templates.filter(s => s.dayOfWeek === new Date(date + "T12:00:00Z").getUTCDay())) {
          const location = await one(branches, template.branchId, tx);
          const exception = exceptions.find(e => e.branchId === template.branchId && e.date === date && e.sessionId === template.id) || exceptions.find(e => e.branchId === template.branchId && e.date === date && !e.sessionId);
          const session = { ...template, timezone: template.timezone || location.timezone || "Asia/Kolkata" };
          if (exception) for (const key of ["startTime", "endTime", "breakStart", "breakEnd", "isClosed"]) if (exception[key] !== undefined && (exception[key] !== null || key.startsWith("break"))) session[key] = exception[key];
          effective.push({ session, date });
        }
      }
      // Section F: dated extra intervals are protected sessions too.
      for (const e of datedRows.filter(e => e.isExtra)) { const location = await one(branches, e.branchId, tx); for (const offset of [-1, 0, 1]) { const date = datePlus(e.date, offset); for (const template of templates.filter(s => s.dayOfWeek === new Date(date + "T12:00:00Z").getUTCDay())) { const tl = await one(branches, template.branchId, tx); const ov = exceptions.find(x => x.branchId === template.branchId && x.date === date && x.sessionId === template.id) || exceptions.find(x => x.branchId === template.branchId && x.date === date && !x.sessionId); const session = { ...template, ...(ov ? Object.fromEntries(Object.entries(ov).filter(([k,v]) => ["startTime","endTime","isClosed"].includes(k) && v !== null && v !== undefined)) : {}), timezone: template.timezone || tl.timezone || "Asia/Kolkata" }; assert(!sessionsOverlap(session, date, extraSession(e, {}, location), e.date), 409, "Weekly change overlaps a dated extra interval"); } } }
      for (let i = 0; i < effective.length; i++) for (let j = i + 1; j < effective.length; j++) {
        assert(!sessionsOverlap(effective[i].session, effective[i].date, effective[j].session, effective[j].date), 409, "Weekly change overlaps a dated session exception");
      }
    }
    if (kind === "availability-exceptions" && proposed.isExtra) {
      // Section F: extra interval on one date — no weekly template required; protect conflicts and explicit closures.
      assert(!proposed.isClosed && !proposed.sessionId, 400, "An extra interval adds a session; it cannot close or replace one");
      assert(proposed.startTime && proposed.endTime && Number(proposed.maxTokens) >= 1, 400, "Enter start time, end time and capacity for the extra interval");
      const location = await one(branches, proposed.branchId, tx);
      const template = (await all(schedules, tx)).find(s => s.doctorId === proposed.doctorId && s.branchId === proposed.branchId && s.status === "active");
      const extra = extraSession({ ...proposed, id: old?.id || "__new_extra__" }, template, location);
      validateTimes(extra);
      withinBranchHours(location, { ...extra, date: proposed.date });
      const dayClosed = (await all(availabilityExceptions, tx)).some(e => e.id !== old?.id && e.status === "active" && e.doctorId === proposed.doctorId && e.branchId === proposed.branchId && e.date === proposed.date && e.isClosed && !e.sessionId);
      assert(!dayClosed, 409, "This date has a day-off exception for the doctor at this location. Remove it before adding an extra interval");
      const rows = (await all(availabilityExceptions, tx)).filter(e => e.id !== old?.id && e.doctorId === proposed.doctorId && e.status === "active");
      for (const session of (await all(schedules, tx)).filter(s => s.doctorId === proposed.doctorId && s.status === "active" && s.isOpen)) {
        const otherBranch = await one(branches, session.branchId, tx);
        for (const offset of [-1, 0, 1]) {
          const otherDate = datePlus(proposed.date, offset);
          if (new Date(otherDate + "T12:00:00Z").getUTCDay() !== session.dayOfWeek) continue;
          const ov = rows.find(e => !e.isExtra && e.branchId === session.branchId && e.date === otherDate && e.sessionId === session.id) || rows.find(e => !e.isExtra && e.branchId === session.branchId && e.date === otherDate && !e.sessionId);
          const other = { ...session, ...(ov ? Object.fromEntries(Object.entries(ov).filter(([k,v]) => ["startTime","endTime","isClosed"].includes(k) && v !== null && v !== undefined)) : {}), timezone: session.timezone || otherBranch.timezone || "Asia/Kolkata" };
          assert(!sessionsOverlap(extra, proposed.date, other, otherDate), 409, "This extra interval overlaps an existing session");
        }
      }
      for (const e of rows.filter(e => e.isExtra)) {
        const b = await one(branches, e.branchId, tx);
        assert(!sessionsOverlap(extra, proposed.date, extraSession(e, {}, b), e.date), 409, "This extra interval overlaps another extra interval");
      }
    }
    if (kind === "availability-exceptions" && !proposed.isClosed && !proposed.isExtra) {
      const weekday = new Date(proposed.date + "T12:00:00Z").getUTCDay();
      const bases = (await all(schedules, tx)).filter(s => s.doctorId === proposed.doctorId && s.branchId === proposed.branchId && s.dayOfWeek === weekday && s.status === "active" && (!proposed.sessionId || s.id === proposed.sessionId));
      assert(bases.length <= 1, 409, "Choose a session for the date exception");
      const base = bases[0];
      assert(base, 409, "Create a weekly schedule before overriding its timing");
      const baseBranch = await one(branches, base.branchId, tx);
      const effective = { ...base, ...Object.fromEntries(Object.entries(proposed).filter(([k,v]) => v !== null || k.startsWith("break"))), timezone: proposed.timezone || base.timezone || baseBranch.timezone || "Asia/Kolkata" };
      validateTimes(effective);
      withinBranchHours(baseBranch, effective);
      const otherSchedules = (await all(schedules, tx)).filter(s => s.doctorId === proposed.doctorId && s.id !== base.id && s.status === "active" && s.isOpen);
      const datedRows = (await all(availabilityExceptions, tx)).filter(e => e.id !== old?.id && e.doctorId === proposed.doctorId && e.status === "active");
      const exceptions = datedRows.filter(e => !e.isExtra);
      for (const e of datedRows.filter(e => e.isExtra)) { const b = await one(branches, e.branchId, tx); assert(!sessionsOverlap(effective, proposed.date, extraSession(e, {}, b), e.date), 409, "This change overlaps a dated extra interval"); }
      for (const session of otherSchedules) {
        const otherBranch = await one(branches, session.branchId, tx);
        for (const offset of [-1, 0, 1]) {
          const otherDate = datePlus(proposed.date, offset);
          if (new Date(otherDate + "T12:00:00Z").getUTCDay() !== session.dayOfWeek) continue;
          const exception = exceptions.find(e => e.branchId === session.branchId && e.date === otherDate && e.sessionId === session.id) || exceptions.find(e => e.branchId === session.branchId && e.date === otherDate && !e.sessionId);
          const other = { ...session, ...exception, timezone: exception?.timezone || session.timezone || otherBranch.timezone || "Asia/Kolkata" };
          assert(!sessionsOverlap(effective, proposed.date, other, otherDate), 409, "This schedule overlaps with an existing schedule");
        }
      }
    }
    const id = old?.id || uid(), merged = { ...old, ...body }, fields: any = { data: merged };
    delete fields.data.data;
    delete fields.data.expectedSnapshot;
    if ("status" in table) fields.status = body.status || old?.status || "active";
    for (const key of ["clinicId", "branchId", "doctorId", "dayOfWeek", "date", "category", "parentId", "specializationId"]) if (key in table && merged[key] !== undefined) fields[key] = merged[key];
    if (kind === "clinics") {
      fields.ownerId = old?.ownerId || user.id;
      if (old) fields.adminId = body.adminId || old.adminId;
      else if (user.role === "clinicAdmin") fields.adminId = user.id;
      else if (user.role === "doctor") {
        const self = await one(doctors, user.doctorId, tx); fields.adminId = self.ownerAdminId;
      } else fields.adminId = body.adminId;
      assert(fields.adminId, 400, "Please select a Clinic Admin");
      const admin = await one(users, fields.adminId, tx);
      assert(admin.role === "clinicAdmin" && admin.status === "active", 400, "Please select an active Clinic Admin");
      if (old && fields.adminId !== old.adminId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"clinic-owner:" + old.id}))`);
        const links = (await all(tables.assignments, tx)).filter(a => a.clinicId === old.id);
        const accounts = await all(users, tx), doctorRows = await all(doctors, tx);
        const conflict = links.some(link => {
          const account = accounts.find(a => a.id === link.userId);
          if (account?.role === "receptionist") return account.managingAdminId !== fields.adminId;
          const clinicalProfile = doctorRows.find(d => d.userId === account?.id);
          if (clinicalProfile) return clinicalProfile.ownerAdminId !== fields.adminId;
          return false;
        });
        assert(!conflict, 409, "Transfer blocked because assigned doctors or receptionists are managed by another Clinic Admin");
      }
      fields.data.dateFormat ??= "DD MMM YYYY";
      fields.data.timeFormat ??= "12h";
      fields.data.code ||= `CLN-${id.slice(0,8)}`;
    }
    if (kind === "branches") fields.data.code ||= `BR-${id.slice(0,8)}`;
    if (kind === "masters") fields.code = body.code;
    if (kind === "patients") {
      if (user.role === "patient" || old?.userId || user.role === "doctor") assert(body.mobile, 400, "Patient mobile is required");
      if (!old && body.clinicId && body.mobile) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"patient-mobile:" + body.clinicId + ":" + body.mobile}))`);
        const matches = (await all(patients, tx)).filter(p => p.clinicId === body.clinicId && p.mobile === body.mobile);
        for (const match of matches) assert(!await canRead(user, "patients", match), 409, "A patient with this mobile already exists in this clinic. Search by mobile and select the existing patient; contact your clinic administrator if this is a different household member.");
      }
      fields.mobile = body.mobile || null; fields.mobileVerified = old && old.mobile === body.mobile ? old.mobileVerified : false;
      fields.data.email = body.email || null;
      fields.data.code ||= `PAT-${id.slice(0,8)}`;
    }
    if (kind === "qrs") {
      fields.publicReference = old?.publicReference || randomBytes(32).toString("base64url");
      fields.data.bookingUrl = `/book/${fields.publicReference}`;
    }
    if (kind === "users" || kind === "doctors") {
      const userId = kind === "users" ? id : old?.userId || uid();
      const role = kind === "doctors" ? "doctor" : body.role || old?.role;
      const requestedClinics = body.clinicIds === undefined ? old?.clinicIds || [] : body.clinicIds;
      const requestedBranches = body.branchIds === undefined ? old?.branchIds || [] : body.branchIds;
      const assignmentChangeRequested = body.clinicIds !== undefined || body.branchIds !== undefined;
      const sameIds=(left:string[],right:string[])=>JSON.stringify([...new Set(left)].sort())===JSON.stringify([...new Set(right)].sort());
      const unchangedMappings=old&&sameIds(requestedClinics,old.clinicIds||[])&&sameIds(requestedBranches,old.branchIds||[]);
      const explicitDoctorTransfer = old && kind === "doctors" && user.role === "superAdmin" && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId);
      const expectedManager = old && !explicitDoctorTransfer ? (kind === "doctors" ? old.ownerAdminId : old.managingAdminId) : undefined;
      let managingAdminId: string | undefined;
      if (kind === "doctors" && old && (old.userId === user.id && user.role === "clinicAdmin" || !assignmentChangeRequested && !explicitDoctorTransfer)) managingAdminId = old.ownerAdminId;
      else if (["doctor", "receptionist"].includes(role)) managingAdminId = await validateAssignments(user, requestedClinics, requestedBranches, role, expectedManager, tx);
      if (body.ownerAdminId !== undefined) assert(body.ownerAdminId === managingAdminId, 409, "Supplied Clinic Admin does not match the owner derived from selected clinics");
      if (body.managingAdminId !== undefined) assert(body.managingAdminId === managingAdminId, 409, "Supplied Clinic Admin does not match the owner derived from selected clinics");
      const uf: any = { fullName: body.fullName, email: body.email, mobile: body.mobile, role, status: fields.status, ...(!old ? { invitationStatus: "failed" } : {}) };
      if (kind === "doctors" && old) {
        const account = await one(users, userId, tx);
        if (account.role === "clinicAdmin") {
          assert(old.ownerAdminId === userId && (user.role === "superAdmin" || user.id === userId) && account.status === "active", 403, "Only Super Admin or the active owning Clinic Admin can edit their clinical profile");
          managingAdminId = userId;
          // Updating or deactivating the clinical capability must never downgrade
          // or deactivate the owning administrative account.
          uf.role = "clinicAdmin"; uf.status = account.status;
          if (body.branchIds !== undefined) {
            // Reuse the same validation, ownership lock and reconciliation as
            // the dedicated self-service endpoint; never write admin branch rows.
            await attachOwnDoctor(account, { branchIds: body.branchIds }, tx);
            fields.data.branchIds = [...new Set(body.branchIds)];
          } else fields.data.branchIds = (await one(doctors, old.id, tx)).branchIds;
        }
      }
      if (kind === "doctors") {
        if (old) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + old.id}))`);
          const latest = await one(doctors, old.id, tx);
          fields.data.expectedDurations = latest.expectedDurations;
          fields.data.durationHistory = latest.durationHistory;
        }
        fields.ownerAdminId = managingAdminId;
        const owner = await one(users, fields.ownerAdminId, tx);
        assert(owner.role === "clinicAdmin" && owner.status === "active", 400, "Please select an active Clinic Admin");
        if (old) await change(users, userId, uf, tx); else await put(users, { id: userId, ...uf }, tx);
        // Section C: doctor profile and its account share one address.
        const personAddress = Object.fromEntries([...ADDRESS_KEYS,"photoUrl"].filter(key => body[key] !== undefined).map(key => [key, body[key]]));
        if (Object.keys(personAddress).length) await mergeAddress(users, userId, personAddress, tx);
        fields.userId = userId; fields.data.code ||= `DOC-${id.slice(0,8)}`;
      } else {
        if (role === "receptionist") fields.managingAdminId = managingAdminId;
        Object.assign(fields, uf);
      }
      if (kind === "users" && old) {
        const linkedPatient = (await all(patients, tx)).find(p => p.userId === old.id);
        if (linkedPatient && body.mobile !== undefined && body.mobile !== linkedPatient.mobile) await change(patients, linkedPatient.id, { mobile: body.mobile, mobileVerified: false }, tx);
        const linkedDoctor = (await all(doctors, tx)).find(d => d.userId === old.id);
        if (linkedDoctor) await change(doctors, linkedDoctor.id, { data: { ...linkedDoctor, fullName: body.fullName, email: body.email, ...(body.mobile !== undefined ? { mobile: body.mobile } : {}) } }, tx);
        if (linkedDoctor && body.status) await change(doctors, linkedDoctor.id, { status: body.status }, tx);
        const addressPatch = Object.fromEntries(ADDRESS_KEYS.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
        if (linkedDoctor && Object.keys(addressPatch).length) await mergeAddress(doctors, linkedDoctor.id, addressPatch, tx);
      }
      if (role === "clinicAdmin") {
        assert(user.role === "superAdmin", 403, "Only Super Admin can create Clinic Admins");
        assert(old, 409, "Create Clinic Admins through clinic admin onboarding");
        assert(body.clinicIds === undefined && body.branchIds === undefined, 409, "Clinic Admin assignments are managed only through clinic ownership");
      }
      const row = old ? await change(table, id, fields, tx) : await put(table, { id, ...fields }, tx);
      if (uf.role !== "clinicAdmin" && ["doctor", "receptionist"].includes(role) && (!old || assignmentChangeRequested && !unchangedMappings)) {
        await setAssignments(userId, requestedClinics, requestedBranches, user, managingAdminId!, tx);
      }
      if (kind === "users" && !old && body.role === "patient") await put(patients, { id: uid(), userId, mobile: body.mobile || "", data: { fullName: body.fullName, email: body.email, code: `PAT-${id.slice(0,8)}` } }, tx);
      await audit(user,
        old && kind === "doctors" && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId) ? "ownershipTransfer"
          : old && (body.clinicIds !== undefined || body.branchIds !== undefined) ? "assignmentChange"
            : old ? "update" : "create",
        kind, row, tx);
      return enrich(kind, row, tx);
    }
    const row = old ? await change(table, id, fields, tx) : await put(table, { id, ...fields }, tx);
    if (kind === "branches") await provisionBranchQr(row, old, tx);
    if (kind === "clinics" && !old && user.role === "doctor") {
      await tx.insert(tables.assignments).values({ id: uid(), userId: user.id, clinicId: id }).onConflictDoNothing();
    }
    await audit(user, old && kind === "clinics" && ownershipChangeRequested(body.adminId, old.adminId) ? "ownershipTransfer" : old ? "update" : "create", kind, row, tx);
    return enrich(kind, row, tx);
  });
  if (old?.status === "active" && saved.status === "inactive") {
    if (kind === "users") await revokeUserSessions(saved.id);
    if (kind === "doctors" && (await one(users, saved.userId)).status === "inactive")
      await revokeUserSessions(saved.userId);
  }
  if (!old && (kind === "doctors" || (kind === "users" && ["clinicAdmin", "doctor", "receptionist"].includes(saved.role)))) {
    await deliverInvitation(kind === "users" ? saved.id : saved.userId, redirectUrl);
    return enrich(kind, await one(table, saved.id));
  }
  return saved;
}
/* Historical incoming save implementation intentionally excluded during conflict resolution.
function discardedIncomingSave(kind: string, table: any, user: any, body: any, old?: any) {
  await authorizeWrite(user, kind, body, old);
  if (kind === "users" || kind === "doctors") body.email = body.email.toLowerCase();
  if (!old && (kind === "users" || kind === "doctors")) {
    const existing = (await all(users)).find(u => u.email === body.email);
    assert(!existing, 409, "Email already belongs to an existing profile; roles cannot be silently changed");
  }
  return db.transaction(async tx => {
    const proposed = { ...old, ...body };
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${kind + ":" + (proposed.doctorId || old?.id || body.email || "create")}))`);
    if (["schedules", "availability-exceptions"].includes(kind)) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + proposed.doctorId}))`);
    if (kind === "users" && old?.role === "superAdmin" && body.status === "inactive") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('super-admin-protection'))`);
      assert((await all(users, tx)).filter(u => u.role === "superAdmin" && u.status === "active" && u.id !== old.id).length, 409, "Cannot deactivate last active super administrator");
    }
    if (kind === "users" && old?.role === "clinicAdmin" && body.status === "inactive") {
      assert(!(await all(clinics, tx)).some(c => c.adminId === old.id) && !(await all(doctors, tx)).some(d => d.ownerAdminId === old.id), 409, "Transfer clinic and doctor ownership before deactivating this administrator");
    }
    if (kind === "schedules") {
      validateTimes(proposed);
      const branch = await one(branches, proposed.branchId, tx);
      const candidate = { ...proposed, timezone: proposed.timezone || branch.timezone || "Asia/Kolkata" };
      const collisions = (await all(schedules, tx)).filter(s => s.id !== old?.id && s.status === "active" && s.doctorId === proposed.doctorId);
      for (const session of collisions) {
        const otherBranch = await one(branches, session.branchId, tx);
        const other = { ...session, timezone: session.timezone || otherBranch.timezone || "Asia/Kolkata" };
        assert(!(session.branchId === proposed.branchId && session.dayOfWeek === proposed.dayOfWeek) && !weeklySessionsOverlap(candidate, other), 409, "This schedule overlaps with an existing schedule");
      }
    }
    if (kind === "availability-exceptions" && !proposed.isClosed) {
      const weekday = new Date(proposed.date + "T12:00:00Z").getUTCDay();
      const base = (await all(schedules, tx)).find(s => s.doctorId === proposed.doctorId && s.branchId === proposed.branchId && s.dayOfWeek === weekday && s.status === "active");
      assert(base, 409, "Create a weekly schedule before overriding its timing");
      const baseBranch = await one(branches, base.branchId, tx);
      const effective = { ...base, ...Object.fromEntries(Object.entries(proposed).filter(([k,v]) => v !== null || k.startsWith("break"))), timezone: proposed.timezone || base.timezone || baseBranch.timezone || "Asia/Kolkata" };
      validateTimes(effective);
      const otherSchedules = (await all(schedules, tx)).filter(s => s.doctorId === proposed.doctorId && s.branchId !== proposed.branchId && s.status === "active" && s.isOpen);
      const datedRows = (await all(availabilityExceptions, tx)).filter(e => e.id !== old?.id && e.doctorId === proposed.doctorId && e.status === "active");
      const exceptions = datedRows.filter(e => !e.isExtra);
      for (const e of datedRows.filter(e => e.isExtra)) { const b = await one(branches, e.branchId, tx); assert(!sessionsOverlap(effective, proposed.date, extraSession(e, {}, b), e.date), 409, "This change overlaps a dated extra interval"); }
      for (const session of otherSchedules) {
        const otherBranch = await one(branches, session.branchId, tx);
        for (const offset of [-1, 0, 1]) {
          const otherDate = datePlus(proposed.date, offset);
          if (new Date(otherDate + "T12:00:00Z").getUTCDay() !== session.dayOfWeek) continue;
          const exception = exceptions.find(e => e.branchId === session.branchId && e.date === otherDate);
          const other = { ...session, ...exception, timezone: exception?.timezone || session.timezone || otherBranch.timezone || "Asia/Kolkata" };
          assert(!sessionsOverlap(effective, proposed.date, other, otherDate), 409, "This schedule overlaps with an existing schedule");
        }
      }
    }
    const id = old?.id || uid(), merged = { ...old, ...body }, fields: any = { data: merged };
    delete fields.data.data;
    if ("status" in table) fields.status = body.status || old?.status || "active";
    for (const key of ["clinicId", "branchId", "doctorId", "dayOfWeek", "date", "category", "parentId", "specializationId"]) if (key in table && merged[key] !== undefined) fields[key] = merged[key];
    if (kind === "clinics") {
      fields.ownerId = old?.ownerId || user.id;
      if (old) fields.adminId = body.adminId || old.adminId;
      else if (user.role === "clinicAdmin") fields.adminId = user.id;
      else if (user.role === "doctor") {
        const self = await one(doctors, user.doctorId, tx); fields.adminId = self.ownerAdminId;
      } else fields.adminId = body.adminId;
      assert(fields.adminId, 400, "Please select a Clinic Admin");
      const admin = await one(users, fields.adminId, tx);
      assert(admin.role === "clinicAdmin" && admin.status === "active", 400, "Please select an active Clinic Admin");
      fields.data.dateFormat ??= "DD MMM YYYY";
      fields.data.timeFormat ??= "12h";
      fields.data.code ||= `CLN-${id.slice(0,8)}`;
    }
    if (kind === "branches") fields.data.code ||= `BR-${id.slice(0,8)}`;
    if (kind === "masters") fields.code = body.code;
    if (kind === "patients") {
      if (user.role === "patient" || old?.userId || user.role === "doctor") assert(body.mobile, 400, "Patient mobile is required");
      if (!old && body.clinicId && body.mobile) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"patient-mobile:" + body.clinicId + ":" + body.mobile}))`);
        const matches = (await all(patients, tx)).filter(p => p.clinicId === body.clinicId && p.mobile === body.mobile);
        for (const match of matches) assert(!await canRead(user, "patients", match), 409, "A patient with this mobile already exists in this clinic. Search by mobile and select the existing patient; contact your clinic administrator if this is a different household member.");
      }
      fields.mobile = body.mobile || null; fields.mobileVerified = old && old.mobile === body.mobile ? old.mobileVerified : false;
      fields.data.email = body.email || null;
      fields.data.code ||= `PAT-${id.slice(0,8)}`;
    }
    if (kind === "qrs") {
      fields.publicReference = old?.publicReference || randomBytes(32).toString("base64url");
      fields.data.bookingUrl = `/book/${fields.publicReference}`;
    }
    if (kind === "users" || kind === "doctors") {
      const userId = kind === "users" ? id : old?.userId || uid();
      const uf: any = { fullName: body.fullName, email: body.email, mobile: body.mobile, role: kind === "users" ? body.role : "doctor", status: fields.status };
      // Section C: one address per person. Doctor profile and its user account share the same address fields.
      const personAddress = Object.fromEntries(ADDRESS_KEYS.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
      if (kind === "doctors") {
        fields.ownerAdminId = old?.ownerAdminId || (user.role === "clinicAdmin" ? user.id : body.ownerAdminId);
        assert(fields.ownerAdminId, 400, "Please select a Clinic Admin");
        const owner = await one(users, fields.ownerAdminId, tx);
        assert(owner.role === "clinicAdmin" && owner.status === "active", 400, "Please select an active Clinic Admin");
        if (old) await change(users, userId, uf, tx); else await put(users, { id: userId, ...uf }, tx);
        if (Object.keys(personAddress).length) await mergeAddress(users, userId, personAddress, tx);
        fields.userId = userId; fields.data.code ||= `DOC-${id.slice(0,8)}`;
      } else Object.assign(fields, uf);
      if (kind === "users" && old) {
        const linkedPatient = (await all(patients, tx)).find(p => p.userId === old.id);
        if (linkedPatient && body.mobile !== undefined && body.mobile !== linkedPatient.mobile) await change(patients, linkedPatient.id, { mobile: body.mobile, mobileVerified: false }, tx);
        const linkedDoctor = (await all(doctors, tx)).find(d => d.userId === old.id);
        if (linkedDoctor && body.status) await change(doctors, linkedDoctor.id, { status: body.status }, tx);
      }
      const requestedClinics = body.clinicIds === undefined ? old?.clinicIds || [] : body.clinicIds;
      const requestedBranches = body.branchIds === undefined ? old?.branchIds || [] : body.branchIds;
      const role = kind === "doctors" ? "doctor" : body.role || old?.role;
      const priorLinks = old ? (await all(tables.assignments, tx)).filter(a => a.userId === userId) : [];
      const retainedLinks = priorLinks.filter(a => user.role !== "superAdmin" && !scope(user, a.clinicId, a.branchId));
      const finalClinics = new Set([...requestedClinics, ...retainedLinks.map(a => a.clinicId)]);
      const finalBranches = new Set([...requestedBranches, ...retainedLinks.filter(a => a.branchId).map(a => a.branchId)]);
      if (["doctor", "receptionist"].includes(role)) assert(finalClinics.size, 400, "Please select a clinic");
      if (role === "receptionist") assert(finalBranches.size, 400, "Please select a branch");
      if (role === "clinicAdmin") {
        assert(user.role === "superAdmin", 403, "Only Super Admin can create Clinic Admins");
        assert(!requestedClinics.length && !requestedBranches.length, 409, "Create the Clinic Admin as pending, then transfer clinic ownership explicitly");
      }
      const row = old ? await change(table, id, fields, tx) : await put(table, { id, ...fields }, tx);
      if (role !== "clinicAdmin") await setAssignments(userId, requestedClinics, requestedBranches, user, tx);
      // User administration also creates the corresponding typed profile.
      if (kind === "users" && !old && body.role === "doctor") await put(doctors, { id: uid(), userId, data: { fullName: body.fullName, email: body.email, code: `DOC-${id.slice(0,8)}` } }, tx);
      if (kind === "users" && !old && body.role === "patient") await put(patients, { id: uid(), userId, mobile: body.mobile || "", data: { fullName: body.fullName, email: body.email, code: `PAT-${id.slice(0,8)}` } }, tx);
      await audit(user,
        old && kind === "doctors" && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId) ? "ownershipTransfer"
          : old && (body.clinicIds !== undefined || body.branchIds !== undefined) ? "assignmentChange"
            : old ? "update" : "create",
        kind, row, tx);
      return enrich(kind, row, tx);
    }
    const row = old ? await change(table, id, fields, tx) : await put(table, { id, ...fields }, tx);
    if (kind === "clinics" && !old && user.role === "doctor") {
      await tx.insert(tables.assignments).values({ id: uid(), userId: user.id, clinicId: id }).onConflictDoNothing();
    }
    if (kind === "branches" && !old && user.role === "doctor") await tx.insert(tables.assignments).values({ id: uid(), userId: user.id, clinicId: body.clinicId, branchId: id }).onConflictDoNothing();
    await audit(user, old && kind === "clinics" && ownershipChangeRequested(body.adminId, old.adminId) ? "ownershipTransfer" : old ? "update" : "create", kind, row, tx);
    return enrich(kind, row, tx);
  });
}
*/
resourcesRouter.post("/clinic-admin-onboarding", async (req, res) => {
  const user = await requireUser(req);
  const row = await createClinicAdminOnboarding(user, parse(z.OnboardClinicAdminBody, req.body), invitationRedirectUrl(req));
  res.status(201).json(row);
});
for (const [kind, table, schema, listSchema] of definitions) {
  resourcesRouter.get(`/${kind}`, async (req, res) => {
    const user = await requireUser(req), q = query(listSchema, req);
    if (kind === "users") roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    const result = await queryPage(user, kind, q);
    if (kind === "clinics") result.items = result.items.map((row: any) => ({ ...row, ...clinicDisplayPreferences(row) }));
    if (kind === "branches") {
      const parentIds = [...new Set(result.items.map((row: any) => row.clinicId))] as string[];
      const parentRows = parentIds.length ? (await db.execute(sql`select id, data from clinics where id in (${sql.join(parentIds.map(id => sql`${id}`), sql`,`)})`)).rows : [];
      const parents = new Map(parentRows.map((row: any) => [row.id, { ...row.data, ...row }]));
      for (const row of result.items) {
        assert(parents.has(row.clinicId), 404, "Record not found");
        Object.assign(row, clinicDisplayPreferences(parents.get(row.clinicId)));
      }
    }
    if (["users", "doctors"].includes(kind)) {
      const clinicIds = [...new Set(result.items.flatMap((r: any) => r.clinicIds))] as string[];
      const branchIds = [...new Set(result.items.flatMap((r: any) => r.branchIds))] as string[];
      const clinicRows = clinicIds.length ? (await db.execute(sql`select id, data->>'name' as name from clinics where id in (${sql.join(clinicIds.map(id => sql`${id}`), sql`,`)})`)).rows : [];
      const branchRows = branchIds.length ? (await db.execute(sql`select id, clinic_id as "clinicId", data->>'name' as name from branches where id in (${sql.join(branchIds.map(id => sql`${id}`), sql`,`)})`)).rows : [];
      result.items = result.items.map((row: any) => {
        const own = kind === "users" ? row.id === user.id : row.id === user.doctorId;
        const peer = kind === "users" && row.role === "receptionist" && ["clinicAdmin", "doctor"].includes(user.role) && row.managingAdminId === (user.role === "clinicAdmin" ? user.id : user.managingAdminId);
        const unrestricted = user.role === "superAdmin" || own || peer;
        const clinicIds = row.clinicIds.filter((id: string) => unrestricted || scope(user, id));
        const branchIds = row.branchIds.filter((id: string) => unrestricted || branchRows.some(b => b.id === id && scope(user, b.clinicId as string, id)));
        return { ...row, clinicIds, branchIds, clinicNames: clinicRows.filter(c => clinicIds.includes(c.id)).map(c => c.name), branchNames: branchRows.filter(b => branchIds.includes(b.id)).map(b => b.name) };
      });
      // queryPage already projects passwordEnabled from the credential column;
      // re-reading each user's credential would add one query per listed staff.
    }
    res.json(result);
  });
  resourcesRouter.get(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), row = await enrich(kind, await one(table, req.params.id as string));
    assert(await canRead(user, kind, row), 403, "Record outside your scope");
    res.json(await withPasswordState(await projectAssignmentScope(user, kind, row)));
  });
  resourcesRouter.post(`/${kind}`, async (req, res) => {
    const user = await requireUser(req), row = await save(kind, table, user, parse(schema, req.body), undefined, invitationRedirectUrl(req),()=>requireUser(req));
    res.status(201).json(await projectAssignmentScope(user, kind, row));
  });
  resourcesRouter.patch(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), old = await enrich(kind, await one(table, req.params.id as string));
    res.json(await projectAssignmentScope(user, kind, await save(kind, table, user, parse(schema, req.body), old,undefined,()=>requireUser(req))));
  });
  resourcesRouter.delete(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), old = await enrich(kind, await one(table, req.params.id as string));
    assert(user.role !== "patient", 403, "Patients cannot deactivate profiles");
    await authorizeWrite(user, kind, {}, old);
    if (kind === "users" && old.id === user.id)
      assert(false, 409, "You cannot deactivate your own account");
    await db.transaction(async tx => {
      if (kind === "schedules") {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + old.doctorId}))`);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + old.doctorId}))`);
        const current=await one(schedules,old.id,tx);
        assertScheduleSnapshot(current,req.query.expectedSnapshot);
        const freshActor=await requireUser(req);
        await authorizeWrite(freshActor,kind,{},current,tx);
        const doctor=await enrich("doctors",await one(doctors,current.doctorId,tx),tx);
        assert(doctor.status==="active"&&doctor.branchIds.includes(current.branchId),409,"Doctor assignments changed. Reload the schedule context before deactivating sessions.");
        assert(!current.linkedBranchId, 409, "This session follows clinic hours. Unlink it in Clinic settings before deactivating it.");
        const { freezeDoctorSessions } = await import("../lib/session-duration");
        await freezeDoctorSessions(old.doctorId, tx);
      }
      if (kind === "users" && old.role === "superAdmin") {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('super-admin-protection'))`);
        assert((await all(users, tx)).some(u => u.role === "superAdmin" && u.status === "active" && u.id !== old.id), 409, "Cannot deactivate last active super administrator");
      }
      await change(table, old.id, { status: "inactive" }, tx);
      if (kind === "doctors" && (await one(users, old.userId, tx)).role !== "clinicAdmin") await change(users, old.userId, { status: "inactive" }, tx);
      await audit(user, "deactivate", kind, old, tx);
    });
    if (kind === "users") await revokeUserSessions(old.id);
    if (kind === "doctors" && (await one(users, old.userId)).status === "inactive")
      await revokeUserSessions(old.userId);
    res.sendStatus(204);
  });
}
resourcesRouter.get("/staff-assignment-options", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
  const q = query(z.GetStaffAssignmentOptionsQueryParams, req);
  if (user.role === "doctor") assert(q.targetRole === "receptionist", 403, "Doctors may request receptionist assignment options only");
  assert(!(q.doctorId && q.userId), 400, "Select only one staff record to edit");
  let managingAdminId: string | undefined;
  let retainedUserId: string | undefined;
  if (q.doctorId) {
    assert(q.targetRole === "doctor", 400, "doctorId requires targetRole=doctor");
    const target = (await queryPage(user, "doctors", { selectedIds: q.doctorId, pageSize: 1 })).items[0];
    assert(target, 403, "Doctor outside your management scope");
    managingAdminId = target.ownerAdminId;
    retainedUserId = target.userId;
  }
  if (q.userId) {
    assert(q.targetRole === "receptionist", 400, "userId requires targetRole=receptionist");
    const target = (await queryPage(user, "users", { selectedIds: q.userId, pageSize: 1 })).items[0];
    assert(target?.role === "receptionist", 403, "Receptionist outside your management scope");
    managingAdminId = target.managingAdminId;
    retainedUserId = target.id;
  }
  if (!managingAdminId && user.role === "clinicAdmin") managingAdminId = user.id;
  if (!managingAdminId && user.role === "doctor") managingAdminId = user.managingAdminId;
  if (user.role !== "superAdmin") {
    const actorManager = user.role === "clinicAdmin" ? user.id : user.managingAdminId;
    assert(actorManager && managingAdminId === actorManager, 403, "Managing Admin outside this assignment catalog");
    assert(!q.managingAdminId || q.managingAdminId === actorManager, 403, "Managing Admin outside this assignment catalog");
  }
  if (q.managingAdminId) {
    assert(!managingAdminId || managingAdminId === q.managingAdminId, 403, "Managing Admin outside this assignment catalog");
    managingAdminId = q.managingAdminId;
  }
   const options = { ...q, managingAdminId: undefined, sort: q.sort || "name" };
  // Management catalog intentionally differs from operational assignments.
  const catalogUser = { role: "superAdmin" };
  const retained = q.selectedIds ? retainedUserId : undefined;
  const clinicPage = await queryPage(catalogUser, "clinics", { ...options, doctorId: undefined, clinicId: undefined, branchId: undefined }, sql`${assignmentCatalogPredicate("clinics", managingAdminId, retained)} and ${q.clinicId ? sql`r.id=${q.clinicId}` : sql`true`}`);
  const branchPage = await queryPage(catalogUser, "branches", { ...options, doctorId: undefined, branchId: undefined }, sql`${assignmentCatalogPredicate("branches", managingAdminId, retained)} and ${q.branchId ? sql`r.id=${q.branchId}` : sql`true`}`);
  const adminIds = [...new Set(clinicPage.items.map((c: any) => c.adminId))] as string[];
  const adminRows = adminIds.length ? (await db.execute(sql`select id, full_name as "fullName" from users where id in (${sql.join(adminIds.map(id => sql`${id}`), sql`,`)}) and role='clinicAdmin' and status='active' order by id limit 100`)).rows : [];
  res.json({
    clinics: clinicPage.items,
    branches: branchPage.items,
    managingAdmins: adminRows.map(a => ({ id: a.id, fullName: a.fullName })),
    pagination: { clinics: { ...clinicPage, items: undefined }, branches: { ...branchPage, items: undefined } },
  });
});
resourcesRouter.post("/users/:id/password-reset", async (req, res) => {
  const user = await requireUser(req), target = await enrich("users", await one(users, req.params.id as string));
  roles(user, ["superAdmin", "clinicAdmin"]);
  assert(["clinicAdmin", "doctor", "receptionist", "superAdmin"].includes(target.role), 400, "Password recovery assistance is available for staff profiles only");
  assert(await canRead(user, "users", target), 403, "User outside your scope");
  const [credential] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, target.id));
  assert(credential?.passwordHash, 409, "This staff account has not completed invitation setup. Resend the set-password invitation instead.");
  await requestStaffReset(req, target);
  await audit(user, "recoveryInstructions", "users", target);
  res.status(202).json({ message: "Password recovery email requested." });
});
resourcesRouter.post("/users/:id/resend-invitation", async (req, res) => {
  const actor = await requireUser(req), target = await enrich("users", await one(users, req.params.id as string));
  roles(actor, ["superAdmin", "clinicAdmin", "doctor"]);
  assert(["clinicAdmin", "doctor", "receptionist"].includes(target.role), 400, "Invitations are available for staff profiles only");
  if (actor.role === "doctor") assert(target.role === "receptionist", 403, "Doctors may manage receptionists only");
  if (actor.role === "clinicAdmin") assert(["doctor", "receptionist"].includes(target.role), 403, "Cannot manage another administrator's invitation");
  assert(await canRead(actor, "users", target), 403, "User outside your management scope");
  assert(target.status === "active", 403, "Reactivate this staff account before sending an invitation");
  const [credential] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, target.id));
  assert(!credential?.passwordHash, 409, "This staff account has a password. Use password recovery assistance instead.");
  await consumeRateLimit(`staff-invite:${target.id}`, 3);
  await deliverInvitation(target.id, invitationRedirectUrl(req));
  const updated = await enrich("users", await one(users, target.id));
  await audit(actor,
    updated.invitationStatus === "sent" ? "invitationResent"
      : updated.invitationStatus === "notRequired" ? "invitationNotRequired"
        : "invitationFailed",
    "users", updated);
  res.json(await projectAssignmentScope(actor, "users", updated));
});
resourcesRouter.post("/qrs/:id/regenerate", async (req, res) => {
  const user = await requireUser(req), old = await one(qrs, req.params.id as string); await authorizeWrite(user, "qrs", {}, old);
  const reference = randomBytes(32).toString("base64url");
  const row = await db.transaction(async tx => {
    const updated = await change(qrs, old.id, { publicReference: reference, data: { ...old, bookingUrl: `/book/${reference}` } }, tx);
    await audit(user, "regenerate", "qrs", updated, tx); return updated;
  });
  res.json(await enrich("qrs", row));
});
