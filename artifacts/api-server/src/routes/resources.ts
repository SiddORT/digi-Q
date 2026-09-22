import { Router } from "express";
import { clerkClient } from "@clerk/express";
import * as tables from "@workspace/db";
import * as z from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireUser, roles, scope, scoped, canRead, setAssignments, validateAssignments } from "../lib/auth";
import { all, one, put, change, uid, audit, filtered, paginate } from "../lib/store";
import { assert, parse, query } from "../lib/http";
import { enrich } from "../lib/entities";
import { doctorContext, validateTimes, minutes, localNow } from "../lib/availability";
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
async function authorizeWrite(user: any, kind: string, body: any, old?: any) {
  if (body.timezone) localNow(body.timezone);
  if (old) assert(await canRead(user, kind, old), 403, "Record outside your scope");
  if (old && kind === "doctors" && user.role === "clinicAdmin") assert(old.clinicIds.length && old.clinicIds.every((id: string) => user.clinicIds.includes(id)), 403, "This doctor has assignments outside your administration scope");
  if (kind === "masters") roles(user, ["superAdmin"]);
  else if (kind === "users") {
    roles(user, ["superAdmin", "clinicAdmin"]);
    if (user.role === "clinicAdmin") assert(["doctor", "receptionist", "patient"].includes(body.role || old?.role), 403, "Cannot grant administrator roles");
    if (old) assert(!body.role || body.role === old.role, 409, "Existing account roles cannot be switched");
  } else if (kind === "doctors") roles(user, ["superAdmin", "clinicAdmin", ...(old?.id === user.doctorId ? ["doctor"] : [])]);
  else if (kind === "clinics") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    if (old && user.role === "doctor") assert(old.ownerId === user.id, 403, "Only owned clinics can be edited");
    if (!old && user.role === "clinicAdmin") assert(false, 403, "Platform administrator must create clinics");
  } else if (kind === "patients") {
    roles(user, ["superAdmin", "clinicAdmin", "receptionist", ...(old?.id === user.patientId ? ["patient"] : [])]);
    if (user.role === "patient") assert(body.clinicId === undefined && body.branchId === undefined && body.status === undefined, 403, "Patients cannot change registration scope or status");
    else assert(body.clinicId || old?.clinicId || user.role === "superAdmin", 400, "Clinic registration is required");
    if (old && user.role !== "patient" && user.role !== "superAdmin") assert(scope(user, old.clinicId, old.branchId), 403, "Only the registering clinic may edit this patient's demographics");
    if (old && user.role !== "superAdmin") assert((!body.clinicId || body.clinicId === old.clinicId) && (!body.branchId || body.branchId === old.branchId), 403, "Registration assignments cannot be moved");
  } else if (kind === "branches") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    if (user.role === "doctor") assert((await one(clinics, body.clinicId || old.clinicId)).ownerId === user.id, 403, "Only owned clinic branches can be edited");
  } else roles(user, ["superAdmin", "clinicAdmin", "doctor", ...(kind === "qrs" ? ["receptionist"] : [])]);
  if (body.clinicId) assert(scope(user, body.clinicId, body.branchId), 403, "Clinic outside assigned scope");
  if (body.branchId) {
    const branch = await one(branches, body.branchId);
    assert(!body.clinicId || branch.clinicId === body.clinicId, 400, "Branch does not belong to clinic");
    assert(scope(user, branch.clinicId, branch.id), 403, "Branch outside assigned scope");
  }
  if (body.doctorId) {
    if (user.role === "doctor") assert(body.doctorId === user.doctorId, 403, "Only your own doctor profile is allowed");
    if (body.branchId) await doctorContext(body.doctorId, body.branchId);
  }
  if (kind === "qrs") {
    const context = { ...old, ...body };
    if (user.role === "doctor") assert(context.doctorId === user.doctorId, 403, "Doctor booking links must use your own doctor profile");
    if (context.doctorId) {
      const doctor = await enrich("doctors", await one(doctors, context.doctorId));
      assert(doctor.status === "active" && doctor.clinicIds.includes(context.clinicId), 409, "Doctor is not active and assigned to this clinic");
    }
  }
  if (body.clinicIds || body.branchIds) {
    await validateAssignments(user, body.clinicIds || old?.clinicIds || [], body.branchIds || old?.branchIds || []);
    if (user.role === "doctor") {
      assert((body.clinicIds || []).every((id: string) => old?.clinicIds?.includes(id)) && (body.branchIds || []).every((id: string) => old?.branchIds?.includes(id)), 403, "Only administrators may add doctor assignments");
    }
  }
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
async function save(kind: string, table: any, user: any, body: any, old?: any) {
  await authorizeWrite(user, kind, body, old);
  if (kind === "users" || kind === "doctors") body.email = body.email.toLowerCase();
  let provisionedClerkId: string | undefined;
  if (!old && (kind === "users" || kind === "doctors")) {
    const existing = (await all(users)).find(u => u.email === body.email);
    assert(!existing, 409, "Email already belongs to an existing profile; roles cannot be silently changed");
    try {
      const matches = await clerkClient.users.getUserList({ emailAddress: [body.email] });
      const identity = matches.data.find(u => u.emailAddresses.some(e => e.emailAddress.toLowerCase() === body.email && e.verification?.status === "verified"));
      if (identity) {
        assert(!(await all(users)).some(u => u.clerkId === identity.id), 409, "This identity already has a profile");
        provisionedClerkId = identity.id;
      } else await clerkClient.invitations.createInvitation({ emailAddress: body.email, ignoreExisting: false });
    }
    catch (e: any) { assert(false, 503, "Identity invitation could not be created. Check Clerk configuration and whether this email already has an account."); }
  }
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${kind + ":" + (body.doctorId || old?.id || body.email || "create")}))`);
    if (kind === "availability-exceptions") await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + body.doctorId}))`);
    if (kind === "users" && old?.role === "superAdmin" && body.status === "inactive") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('super-admin-protection'))`);
      assert((await all(users, tx)).filter(u => u.role === "superAdmin" && u.status === "active" && u.id !== old.id).length, 409, "Cannot deactivate last active super administrator");
    }
    if (kind === "schedules") {
      validateTimes(body);
      const collisions = (await all(schedules, tx)).filter(s => s.id !== old?.id && s.status === "active" && s.doctorId === body.doctorId && s.dayOfWeek === body.dayOfWeek);
      assert(!collisions.some(s => s.branchId === body.branchId || body.isOpen && s.isOpen && (s.timezone !== body.timezone || minutes(body.startTime) < minutes(s.endTime) && minutes(s.startTime) < minutes(body.endTime))), 409, "A session exists for this branch/day or overlaps another branch session");
    }
    if (kind === "availability-exceptions" && !body.isClosed) {
      const weekday = new Date(body.date + "T12:00:00Z").getUTCDay();
      const base = (await all(schedules, tx)).find(s => s.doctorId === body.doctorId && s.branchId === body.branchId && s.dayOfWeek === weekday && s.status === "active");
      assert(base, 409, "Create a weekly schedule before overriding its timing");
      const effective = { ...base, ...Object.fromEntries(Object.entries(body).filter(([k,v]) => v !== null || k.startsWith("break"))) };
      validateTimes(effective);
      const others = (await all(schedules, tx)).filter(s => s.doctorId === body.doctorId && s.branchId !== body.branchId && s.dayOfWeek === weekday && s.status === "active" && s.isOpen);
      assert(!others.some(s => s.timezone !== base.timezone || minutes(effective.startTime) < minutes(s.endTime) && minutes(s.startTime) < minutes(effective.endTime)), 409, "Exception overlaps another branch session");
    }
    const id = old?.id || uid(), merged = { ...old, ...body }, fields: any = { data: merged };
    delete fields.data.data;
    if ("status" in table) fields.status = body.status || old?.status || "active";
    for (const key of ["clinicId", "branchId", "doctorId", "dayOfWeek", "date", "category", "parentId", "specializationId"]) if (key in table && merged[key] !== undefined) fields[key] = merged[key];
    if (kind === "clinics") { fields.ownerId = old?.ownerId || user.id; fields.data.code ||= `CLN-${id.slice(0,8)}`; }
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
        if (old) await change(users, userId, uf, tx); else await put(users, { id: userId, ...uf }, tx);
        fields.userId = userId; fields.data.code ||= `DOC-${id.slice(0,8)}`;
      } else Object.assign(fields, uf);
      if (kind === "users" && old) {
        const linkedPatient = (await all(patients, tx)).find(p => p.userId === old.id);
        if (linkedPatient && body.mobile !== undefined && body.mobile !== linkedPatient.mobile) await change(patients, linkedPatient.id, { mobile: body.mobile, mobileVerified: false }, tx);
        const linkedDoctor = (await all(doctors, tx)).find(d => d.userId === old.id);
        if (linkedDoctor && body.status) await change(doctors, linkedDoctor.id, { status: body.status }, tx);
      }
      const row = old ? await change(table, id, fields, tx) : await put(table, { id, ...fields }, tx);
      await setAssignments(userId, body.clinicIds || old?.clinicIds || [], body.branchIds || old?.branchIds || [], tx);
      // User administration also creates the corresponding typed profile.
      if (kind === "users" && !old && body.role === "doctor") await put(doctors, { id: uid(), userId, data: { fullName: body.fullName, email: body.email, code: `DOC-${id.slice(0,8)}` } }, tx);
      if (kind === "users" && !old && body.role === "patient") await put(patients, { id: uid(), userId, mobile: body.mobile || "", data: { fullName: body.fullName, email: body.email, code: `PAT-${id.slice(0,8)}` } }, tx);
      await audit(user, old ? "update" : "create", kind, row, tx);
      return enrich(kind, row, tx);
    }
    const row = old ? await change(table, id, fields, tx) : await put(table, { id, ...fields }, tx);
    if (kind === "clinics" && !old && user.role === "doctor") {
      await tx.insert(tables.assignments).values({ id: uid(), userId: user.id, clinicId: id });
    }
    if (kind === "branches" && !old && user.role === "doctor") await tx.insert(tables.assignments).values({ id: uid(), userId: user.id, clinicId: body.clinicId, branchId: id });
    await audit(user, old ? "update" : "create", kind, row, tx);
    return enrich(kind, row, tx);
  });
}
for (const [kind, table, schema, listSchema] of definitions) {
  resourcesRouter.get(`/${kind}`, async (req, res) => {
    const user = await requireUser(req), q = query(listSchema, req);
    if (kind === "users") roles(user, ["superAdmin", "clinicAdmin"]);
    const rows = await Promise.all((await all(table)).map(r => enrich(kind, r)));
    res.json(paginate(filtered(await scoped(user, kind, rows), q), q));
  });
  resourcesRouter.get(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), row = await enrich(kind, await one(table, req.params.id as string));
    assert(await canRead(user, kind, row), 403, "Record outside your scope"); res.json(row);
  });
  resourcesRouter.post(`/${kind}`, async (req, res) => {
    const user = await requireUser(req); res.status(201).json(await save(kind, table, user, parse(schema, req.body)));
  });
  resourcesRouter.patch(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), old = await enrich(kind, await one(table, req.params.id as string));
    res.json(await save(kind, table, user, parse(schema, req.body), old));
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
resourcesRouter.post("/users/:id/password-reset", async (req, res) => {
  const user = await requireUser(req), target = await enrich("users", await one(users, req.params.id as string));
  roles(user, ["superAdmin", "clinicAdmin"]); assert(await canRead(user, "users", target), 403, "User outside your scope");
  await audit(user, "recoveryInstructions", "users", target);
  res.status(202).json({ message: "Open /sign-in and select Forgot password to start secure Clerk recovery. No recovery email has been sent by this action." });
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