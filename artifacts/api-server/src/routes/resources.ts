import { Router } from "express";
import { clerkClient } from "@clerk/express";
import * as tables from "@workspace/db";
import * as z from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireUser, roles, scope, scoped, canRead, projectAssignmentScope, setAssignments, validateAssignments } from "../lib/auth";
import { all, one, put, change, uid, audit, filtered, paginate } from "../lib/store";
import { assert, parse, query } from "../lib/http";
import { enrich } from "../lib/entities";
import { queryPage, assignmentCatalogPredicate } from "../lib/list-query";
import { invitationMetadata } from "../lib/invitation-metadata";
import { doctorContext, validateTimes, localNow, sessionsOverlap, weeklySessionsOverlap, datePlus } from "../lib/availability";
const { db, users, doctors, patients, clinics, branches, masters, schedules, availabilityExceptions, qrs } = tables;
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
  if (!row?.clerkId || !["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(row.role)) return row;
  try {
    const identity = await clerkClient.users.getUser(row.clerkId);
    return { ...row, passwordEnabled: identity.passwordEnabled };
  } catch {
    return { ...row, passwordEnabled: null };
  }
}

async function authorizeWrite(user: any, kind: string, body: any, old?: any) {
  const context = { ...old, ...body };
  if (body.timezone) localNow(body.timezone);
  if (old) assert(await canRead(user, kind, old), 403, "Record outside your scope");
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
    if (old && user.role !== "superAdmin") assert((!body.clinicId || body.clinicId === old.clinicId) && (!body.branchId || body.branchId === old.branchId), 403, "Registration assignments cannot be moved");
  } else if (kind === "branches") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
  } else roles(user, ["superAdmin", "clinicAdmin", "doctor", ...(["qrs", "schedules", "availability-exceptions"].includes(kind) ? ["receptionist"] : [])]);
  if (context.clinicId) {
    if (kind === "branches" && user.role === "doctor") {
      const clinic = await one(clinics, context.clinicId);
      assert(clinic.adminId === user.managingAdminId, 403, "Clinic outside your managing administrator's catalog");
    } else assert(scope(user, context.clinicId, context.branchId), 403, "Clinic outside assigned scope");
  }
  if (context.branchId) {
    const branch = await one(branches, context.branchId);
    assert(!context.clinicId || branch.clinicId === context.clinicId, 400, "Branch does not belong to clinic");
    assert(scope(user, branch.clinicId, branch.id), 403, "Branch outside assigned scope");
  }
  if (context.doctorId) {
    if (context.branchId) await doctorContext(context.doctorId, context.branchId);
    if (context.branchId) {
      const doctor = await enrich("doctors", await one(doctors, context.doctorId));
      assert(doctor.branchIds.includes(context.branchId) && scope(user, (await one(branches, context.branchId)).clinicId, context.branchId), 403, "You cannot manage this doctor's availability at this location");
    }
  }
  if (kind === "qrs") {
    const context = { ...old, ...body };
    if (user.role === "doctor") assert(context.doctorId === user.doctorId, 403, "Doctor booking links must use your own doctor profile");
    if (context.doctorId) {
      const doctor = await enrich("doctors", await one(doctors, context.doctorId));
      assert(doctor.status === "active" && doctor.clinicIds.includes(context.clinicId), 409, "Doctor is not active and assigned to this clinic");
    }
  }
  if ((body.clinicIds || body.branchIds) && user.role === "doctor") assert(kind === "users" && (body.role || old?.role) === "receptionist", 403, "Doctors may assign receptionists only");
  for (const [field, category] of Object.entries({ specializationId: "specialization", clinicTypeId: "clinicType", categoryId: "clinicCategory" })) {
    if (body[field]) { const m = await one(masters, body[field]); assert(m.category === category && m.status === "active", 400, `Invalid ${field}`); }
  }
  for (const id of body.qualificationIds || []) { const m = await one(masters, id); assert(m.category === "qualification" && m.status === "active", 400, "Invalid qualification"); }
  if (kind === "masters") {
    if (governed[body.category]) assert(governed[body.category].includes(body.code), 400, "This category uses governed workflow codes");
    if (old && governed[old.category]) assert(body.code === old.code && body.category === old.category, 400, "Governed codes cannot be changed");
    if (body.parentId) { assert(body.parentId !== old?.id, 400, "Master cannot parent itself"); await one(masters, body.parentId); }
  }
}
export async function deliverInvitation(userId: string, redirectUrl?: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"staff-invitation:" + userId}))`);
    const account = await one(users, userId, tx);
    if (account.clerkId) {
      await change(users, userId, { invitationStatus: "notRequired" }, tx);
      return;
    }
    const verifiedIdentity = async () => {
      const email = account.email.toLowerCase();
      const matches = await clerkClient.users.getUserList({ emailAddress: [email] });
      return matches.data.find(identity => identity.emailAddresses.some(candidate =>
        candidate.emailAddress.toLowerCase() === email && candidate.verification?.status === "verified"));
    };
    const linkIdentity = async (identity: { id: string }) => {
      assert(!(await all(users, tx)).some(u => u.id !== userId && u.clerkId === identity.id), 409, "This identity already has a profile");
      await change(users, userId, { clerkId: identity.id, invitationStatus: "notRequired" }, tx);
    };
    let identity;
    try {
      identity = await verifiedIdentity();
    } catch {
      await change(users, userId, { invitationStatus: "failed" }, tx);
      return;
    }
    if (identity) {
      await linkIdentity(identity);
      return;
    }
    if (!redirectUrl) {
      await change(users, userId, { invitationStatus: "failed" }, tx);
      return;
    }
    try {
      const emailAddress = account.email.toLowerCase();
      const pending = await clerkClient.invitations.getInvitationList({ query: emailAddress, status: "pending", limit: 100 });
      for (const invitation of pending.data.filter(item => item.emailAddress.toLowerCase() === emailAddress)) {
        await clerkClient.invitations.revokeInvitation(invitation.id);
      }
      const enriched = await enrich("users", account, tx);
      const metadata = invitationMetadata(
        account.role,
        enriched.clinicIds,
        enriched.branchIds,
        await all(clinics, tx),
        await all(branches, tx),
      );
      await clerkClient.invitations.createInvitation({
        emailAddress,
        expiresInDays: Math.min(30, Math.max(1, Number.parseInt(process.env.CLERK_INVITATION_EXPIRES_IN_DAYS || "7", 10) || 7)),
        ignoreExisting: false,
        notify: true,
        ...(redirectUrl ? { redirectUrl } : {}),
        publicMetadata: metadata,
      });
    } catch {
      // A Clerk identity can be completed between the lookup and invitation call.
      // Only a verified matching address is safe to link.
      try {
        identity = await verifiedIdentity();
      } catch {
        identity = undefined;
      }
      if (identity) {
        await linkIdentity(identity);
        return;
      }
      await change(users, userId, { invitationStatus: "failed" }, tx);
      return;
    }
    await change(users, userId, { invitationStatus: "sent" }, tx);
  });
}
export async function createClinicAdminOnboarding(actor: any, body: any, redirectUrl?: string) {
  roles(actor, ["superAdmin"]);
  const email = body.admin.email.toLowerCase();
  if (body.clinic.timezone) localNow(body.clinic.timezone);
  assert(!(await all(users)).some(u => u.email === email), 409, "Email already belongs to an existing profile; roles cannot be silently changed");
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
    const clinicId = uid();
    const clinic = await put(clinics, {
      id: clinicId,
      ownerId: actor.id,
      adminId,
      status: "active",
      data: {
        ...body.clinic,
        code: body.clinic.code || `CLN-${clinicId.slice(0, 8)}`,
        timezone: body.clinic.timezone || "Asia/Kolkata",
      },
    }, tx);
    await audit(actor, "create", "users", admin, tx);
    await audit(actor, "create", "clinics", clinic, tx);
    return {
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
async function save(kind: string, table: any, user: any, body: any, old?: any, redirectUrl?: string) {
  await authorizeWrite(user, kind, body, old);
  if (kind === "users" || kind === "doctors") body.email = body.email.toLowerCase();
  if (!old && (kind === "users" || kind === "doctors")) {
    const existing = (await all(users)).find(u => u.email === body.email);
    assert(!existing, 409, "Email already belongs to an existing profile; roles cannot be silently changed");
  }
  const saved = await db.transaction(async tx => {
    const proposed = { ...old, ...body };
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${kind + ":" + (proposed.doctorId || old?.id || body.email || "create")}))`);
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
    if (["schedules", "availability-exceptions"].includes(kind)) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + proposed.doctorId}))`);
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
      const exceptions = (await all(availabilityExceptions, tx)).filter(e => e.id !== old?.id && e.doctorId === proposed.doctorId && e.status === "active");
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
      if (old && fields.adminId !== old.adminId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"clinic-owner:" + old.id}))`);
        const links = (await all(tables.assignments, tx)).filter(a => a.clinicId === old.id);
        const accounts = await all(users, tx), doctorRows = await all(doctors, tx);
        const conflict = links.some(link => {
          const account = accounts.find(a => a.id === link.userId);
          if (account?.role === "receptionist") return account.managingAdminId !== fields.adminId;
          if (account?.role === "doctor") return doctorRows.find(d => d.userId === account.id)?.ownerAdminId !== fields.adminId;
          return false;
        });
        assert(!conflict, 409, "Transfer blocked because assigned doctors or receptionists are managed by another Clinic Admin");
      }
      fields.data.code ||= `CLN-${id.slice(0,8)}`;
    }
    if (kind === "branches") fields.data.code ||= `BR-${id.slice(0,8)}`;
    if (kind === "masters") fields.code = body.code;
    if (kind === "patients") {
      assert(body.mobile, 400, "Patient mobile is required");
      if (!old && body.clinicId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"patient-mobile:" + body.clinicId + ":" + body.mobile}))`);
        const matches = (await all(patients, tx)).filter(p => p.clinicId === body.clinicId && p.mobile === body.mobile);
        for (const match of matches) assert(!await canRead(user, "patients", match), 409, "A patient with this mobile already exists in this clinic. Search by mobile and select the existing patient; contact your clinic administrator if this is a different household member.");
      }
      fields.mobile = body.mobile; fields.mobileVerified = old?.mobile === body.mobile ? old.mobileVerified : false;
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
      const explicitDoctorTransfer = old && kind === "doctors" && user.role === "superAdmin" && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId);
      const expectedManager = old && !explicitDoctorTransfer ? (kind === "doctors" ? old.ownerAdminId : old.managingAdminId) : undefined;
      let managingAdminId: string | undefined;
      if (kind === "doctors" && old && !assignmentChangeRequested && !explicitDoctorTransfer) managingAdminId = old.ownerAdminId;
      else if (["doctor", "receptionist"].includes(role)) managingAdminId = await validateAssignments(user, requestedClinics, requestedBranches, role, expectedManager, tx);
      if (body.ownerAdminId !== undefined) assert(body.ownerAdminId === managingAdminId, 409, "Supplied Clinic Admin does not match the owner derived from selected clinics");
      if (body.managingAdminId !== undefined) assert(body.managingAdminId === managingAdminId, 409, "Supplied Clinic Admin does not match the owner derived from selected clinics");
      const uf: any = { fullName: body.fullName, email: body.email, mobile: body.mobile, role, status: fields.status, ...(!old ? { invitationStatus: "failed" } : {}) };
      if (kind === "doctors") {
        fields.ownerAdminId = managingAdminId;
        const owner = await one(users, fields.ownerAdminId, tx);
        assert(owner.role === "clinicAdmin" && owner.status === "active", 400, "Please select an active Clinic Admin");
        if (old) await change(users, userId, uf, tx); else await put(users, { id: userId, ...uf }, tx);
        fields.userId = userId; fields.data.code ||= `DOC-${id.slice(0,8)}`;
      } else {
        if (role === "receptionist") fields.managingAdminId = managingAdminId;
        Object.assign(fields, uf);
      }
      if (kind === "users" && old) {
        const linkedPatient = (await all(patients, tx)).find(p => p.userId === old.id);
        if (linkedPatient && body.mobile !== undefined && body.mobile !== linkedPatient.mobile) await change(patients, linkedPatient.id, { mobile: body.mobile, mobileVerified: false }, tx);
        const linkedDoctor = (await all(doctors, tx)).find(d => d.userId === old.id);
        if (linkedDoctor && body.status) await change(doctors, linkedDoctor.id, { status: body.status }, tx);
      }
      if (role === "clinicAdmin") {
        assert(user.role === "superAdmin", 403, "Only Super Admin can create Clinic Admins");
        assert(old, 409, "Create Clinic Admins through clinic admin onboarding");
        assert(!requestedClinics.length && !requestedBranches.length, 409, "Create the Clinic Admin as pending, then transfer clinic ownership explicitly");
      }
      const row = old ? await change(table, id, fields, tx) : await put(table, { id, ...fields }, tx);
      if (["doctor", "receptionist"].includes(role) && (kind !== "doctors" || !old || assignmentChangeRequested)) {
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
    if (kind === "clinics" && !old && user.role === "doctor") {
      await tx.insert(tables.assignments).values({ id: uid(), userId: user.id, clinicId: id }).onConflictDoNothing();
    }
    await audit(user, old && kind === "clinics" && ownershipChangeRequested(body.adminId, old.adminId) ? "ownershipTransfer" : old ? "update" : "create", kind, row, tx);
    return enrich(kind, row, tx);
  });
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
  let provisionedClerkId: string | undefined;
  if (!old && (kind === "users" || kind === "doctors")) {
    const existing = (await all(users)).find(u => u.email === body.email);
    assert(!existing, 409, "Email already belongs to an existing profile; roles cannot be silently changed");
    provisionedClerkId = (await provisionIdentity(body.email)).clerkId;
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
      const exceptions = (await all(availabilityExceptions, tx)).filter(e => e.id !== old?.id && e.doctorId === proposed.doctorId && e.status === "active");
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
      fields.data.code ||= `CLN-${id.slice(0,8)}`;
    }
    if (kind === "branches") fields.data.code ||= `BR-${id.slice(0,8)}`;
    if (kind === "masters") fields.code = body.code;
    if (kind === "patients") {
      assert(body.mobile, 400, "Patient mobile is required");
      if (!old && body.clinicId) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"patient-mobile:" + body.clinicId + ":" + body.mobile}))`);
        const matches = (await all(patients, tx)).filter(p => p.clinicId === body.clinicId && p.mobile === body.mobile);
        for (const match of matches) assert(!await canRead(user, "patients", match), 409, "A patient with this mobile already exists in this clinic. Search by mobile and select the existing patient; contact your clinic administrator if this is a different household member.");
      }
      fields.mobile = body.mobile; fields.mobileVerified = old?.mobile === body.mobile ? old.mobileVerified : false;
      fields.data.code ||= `PAT-${id.slice(0,8)}`;
    }
    if (kind === "qrs") {
      fields.publicReference = old?.publicReference || randomBytes(32).toString("base64url");
      fields.data.bookingUrl = `/book/${fields.publicReference}`;
    }
    if (kind === "users" || kind === "doctors") {
      const userId = kind === "users" ? id : old?.userId || uid();
      const uf: any = { fullName: body.fullName, email: body.email, mobile: body.mobile, role: kind === "users" ? body.role : "doctor", status: fields.status, ...(!old && provisionedClerkId ? { clerkId: provisionedClerkId } : {}) };
      if (kind === "doctors") {
        fields.ownerAdminId = old?.ownerAdminId || (user.role === "clinicAdmin" ? user.id : body.ownerAdminId);
        assert(fields.ownerAdminId, 400, "Please select a Clinic Admin");
        const owner = await one(users, fields.ownerAdminId, tx);
        assert(owner.role === "clinicAdmin" && owner.status === "active", 400, "Please select an active Clinic Admin");
        if (old) await change(users, userId, uf, tx); else await put(users, { id: userId, ...uf }, tx);
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
      const ids = result.items.filter((r: any) => r.clerkId && ["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(r.role)).map((r: any) => r.clerkId);
      if (ids.length) {
        try {
          const identities = await clerkClient.users.getUserList({ userId: ids, limit: 100 });
          result.items = result.items.map((r: any) => ids.includes(r.clerkId) ? { ...r, passwordEnabled: identities.data.find(i => i.id === r.clerkId)?.passwordEnabled ?? null } : r);
        } catch {
          result.items = result.items.map((r: any) => ids.includes(r.clerkId) ? { ...r, passwordEnabled: null, passwordStateError: "Identity provider unavailable" } : r);
        }
      }
    }
    res.json(result);
  });
  resourcesRouter.get(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), row = await enrich(kind, await one(table, req.params.id as string));
    assert(await canRead(user, kind, row), 403, "Record outside your scope");
    res.json(await withPasswordState(await projectAssignmentScope(user, kind, row)));
  });
  resourcesRouter.post(`/${kind}`, async (req, res) => {
    const user = await requireUser(req), row = await save(kind, table, user, parse(schema, req.body), undefined, invitationRedirectUrl(req));
    res.status(201).json(await projectAssignmentScope(user, kind, row));
  });
  resourcesRouter.patch(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), old = await enrich(kind, await one(table, req.params.id as string));
    res.json(await projectAssignmentScope(user, kind, await save(kind, table, user, parse(schema, req.body), old)));
  });
  resourcesRouter.delete(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), old = await enrich(kind, await one(table, req.params.id as string));
    assert(user.role !== "patient", 403, "Patients cannot deactivate profiles");
    await authorizeWrite(user, kind, {}, old);
    await db.transaction(async tx => {
      if (kind === "users" && old.role === "superAdmin") {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('super-admin-protection'))`);
        assert((await all(users, tx)).some(u => u.role === "superAdmin" && u.status === "active" && u.id !== old.id), 409, "Cannot deactivate last active super administrator");
      }
      await change(table, old.id, { status: "inactive" }, tx);
      if (kind === "doctors") await change(users, old.userId, { status: "inactive" }, tx);
      await audit(user, "deactivate", kind, old, tx);
    });
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
  const options = { ...q, managingAdminId: undefined, sort: "name" };
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
  assert(target.clerkId, 409, "This staff account has not completed invitation setup. Resend the set-password invitation instead.");
  await audit(user, "recoveryInstructions", "users", target);
  res.status(202).json({ message: "Open /forgot-password to start the secure email-code password flow. No recovery email has been sent by this action." });
});
resourcesRouter.post("/users/:id/resend-invitation", async (req, res) => {
  const actor = await requireUser(req), target = await enrich("users", await one(users, req.params.id as string));
  roles(actor, ["superAdmin", "clinicAdmin", "doctor"]);
  assert(["clinicAdmin", "doctor", "receptionist"].includes(target.role), 400, "Invitations are available for staff profiles only");
  assert(await canRead(actor, "users", target), 403, "User outside your management scope");
  assert(!target.clerkId, 409, "This staff account is already linked. Use password recovery assistance instead.");
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
