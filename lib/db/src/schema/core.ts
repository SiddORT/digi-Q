import { pgTable, text, jsonb, timestamp, integer, boolean, index, uniqueIndex, check, foreignKey, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => text("id").primaryKey();
const data = () => jsonb("data").$type<Record<string, any>>().notNull().default({});
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const users = pgTable("users", {
  id: id(), clerkId: text("clerk_id").unique(), email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(), mobile: text("mobile"), role: text("role").notNull(),
  managingAdminId: text("managing_admin_id").references((): AnyPgColumn => users.id),
  invitationStatus: text("invitation_status").notNull().default("failed"),
  status: text("status").notNull().default("active"), data: data(), createdAt: created(),
}, t => [
  index("user_managing_admin_idx").on(t.managingAdminId),
  check("users_role", sql`${t.role} in ('superAdmin','clinicAdmin','doctor','receptionist','patient')`),
  check("users_managing_admin_role", sql`${t.managingAdminId} is null or ${t.role} = 'receptionist'`),
  check("users_invitation_status", sql`${t.invitationStatus} in ('sent','failed','notRequired')`),
]);
export const clinics = pgTable("clinics", {
  id: id(), ownerId: text("owner_id").references(() => users.id), adminId: text("admin_id").notNull().references(() => users.id),
  status: text("status").notNull().default("active"), data: data(), createdAt: created(),
}, t => [index("clinic_owner_idx").on(t.ownerId), index("clinic_admin_idx").on(t.adminId), uniqueIndex("clinic_name_unique").on(sql`lower(${t.data}->>'name')`)]);
export const branches = pgTable("branches", {
  id: id(), clinicId: text("clinic_id").notNull().references(() => clinics.id), status: text("status").notNull().default("active"), data: data(), createdAt: created(),
}, t => [
  index("branch_clinic_idx").on(t.clinicId),
  uniqueIndex("branch_id_clinic_unique").on(t.id, t.clinicId),
  uniqueIndex("branch_name_clinic_unique").on(t.clinicId, sql`lower(${t.data}->>'name')`),
]);
export const assignments = pgTable("assignments", {
  id: id(), userId: text("user_id").notNull().references(() => users.id), clinicId: text("clinic_id").notNull().references(() => clinics.id),
  branchId: text("branch_id").references(() => branches.id),
}, t => [
  index("assignment_user_idx").on(t.userId),
  index("assignment_scope_idx").on(t.clinicId, t.branchId),
  uniqueIndex("assignment_user_clinic_only_unique").on(t.userId, t.clinicId).where(sql`${t.branchId} is null`),
  uniqueIndex("assignment_user_branch_unique").on(t.userId, t.branchId).where(sql`${t.branchId} is not null`),
  foreignKey({ columns: [t.branchId, t.clinicId], foreignColumns: [branches.id, branches.clinicId], name: "assignment_branch_clinic_fk" }),
]);
export const masters = pgTable("masters", {
  id: id(), category: text("category").notNull(), code: text("code").notNull(), parentId: text("parent_id").references((): AnyPgColumn => masters.id), status: text("status").notNull().default("active"), data: data(),
}, t => [uniqueIndex("master_category_code").on(t.category, t.code)]);
export const doctors = pgTable("doctors", {
  id: id(), userId: text("user_id").notNull().unique().references(() => users.id),
  ownerAdminId: text("owner_admin_id").notNull().references(() => users.id),
  specializationId: text("specialization_id").references(() => masters.id), status: text("status").notNull().default("active"), data: data(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, t => [index("doctor_owner_admin_idx").on(t.ownerAdminId)]);
export const patients = pgTable("patients", {
  id: id(), userId: text("user_id").unique().references(() => users.id), clinicId: text("clinic_id").references(() => clinics.id),
  branchId: text("branch_id").references(() => branches.id), mobile: text("mobile").notNull().default(""),
  mobileVerified: boolean("mobile_verified").notNull().default(false), status: text("status").notNull().default("active"), data: data(), createdAt: created(),
}, t => [index("patient_scope_idx").on(t.clinicId, t.branchId), index("patient_mobile_idx").on(t.mobile)]);
export const schedules = pgTable("schedules", {
  id: id(), doctorId: text("doctor_id").notNull().references(() => doctors.id), clinicId: text("clinic_id").notNull().references(() => clinics.id),
  branchId: text("branch_id").notNull().references(() => branches.id), dayOfWeek: integer("day_of_week").notNull(), status: text("status").notNull().default("active"), data: data(),
}, t => [
  index("schedule_lookup_idx").on(t.doctorId, t.branchId, t.dayOfWeek),
  uniqueIndex("schedule_active_location_day_unique").on(t.doctorId, t.branchId, t.dayOfWeek).where(sql`${t.status} = 'active'`),
  check("schedule_weekday", sql`${t.dayOfWeek} between 0 and 6`),
]);
export const availabilityExceptions = pgTable("availability_exceptions", {
  id: id(), doctorId: text("doctor_id").notNull().references(() => doctors.id), branchId: text("branch_id").notNull().references(() => branches.id),
  date: text("date").notNull(), status: text("status").notNull().default("active"), data: data(),
}, t => [uniqueIndex("exception_date_idx").on(t.doctorId, t.branchId, t.date)]);
export const appointments = pgTable("appointments", {
  id: id(), patientId: text("patient_id").notNull().references(() => patients.id), doctorId: text("doctor_id").notNull().references(() => doctors.id),
  clinicId: text("clinic_id").notNull().references(() => clinics.id), branchId: text("branch_id").notNull().references(() => branches.id),
  date: text("date").notNull(), tokenNumber: integer("token_number").notNull(), status: text("status").notNull().default("booked"),
  requestId: text("request_id"), actorId: text("actor_id").notNull().references(() => users.id), data: data(), createdAt: created(),
}, t => [
  uniqueIndex("appointment_token_idx").on(t.doctorId, t.branchId, t.date, t.tokenNumber),
  uniqueIndex("appointment_request_idx").on(t.actorId, t.requestId),
  uniqueIndex("appointment_reference_idx").on(sql`(${t.data}->>'reference')`),
  index("appointment_patient_idx").on(t.patientId), index("appointment_scope_idx").on(t.clinicId, t.branchId, t.date),
  uniqueIndex("appointment_active_patient_idx").on(t.patientId, t.doctorId, t.branchId, t.date).where(sql`${t.status} not in ('cancelled','completed','noShow')`),
  uniqueIndex("appointment_one_consult_idx").on(t.doctorId, t.branchId, t.date).where(sql`${t.status} in ('called','inConsultation')`),
  check("appointment_status_check", sql`${t.status} in ('booked','checkedIn','waiting','called','inConsultation','completed','noShow','cancelled')`),
  check("appointment_token_positive", sql`${t.tokenNumber} > 0`),
]);
export const appointmentHistory = pgTable("appointment_history", {
  id: id(), appointmentId: text("appointment_id").notNull().references(() => appointments.id), actorId: text("actor_id").notNull().references(() => users.id),
  fromStatus: text("from_status"), toStatus: text("to_status").notNull(), createdAt: created(),
}, t => [index("history_appointment_idx").on(t.appointmentId)]);
export const qrs = pgTable("qrs", {
  id: id(), clinicId: text("clinic_id").notNull().references(() => clinics.id), branchId: text("branch_id").references(() => branches.id),
  doctorId: text("doctor_id").references(() => doctors.id), publicReference: text("public_reference").notNull().unique(),
  status: text("status").notNull().default("active"), data: data(), createdAt: created(),
}, t => [index("qr_scope_idx").on(t.clinicId, t.branchId)]);
export const auditLogs = pgTable("audit_logs", {
  id: id(), actorId: text("actor_id").references(() => users.id), clinicId: text("clinic_id").references(() => clinics.id),
  branchId: text("branch_id").references(() => branches.id),
  action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), summary: text("summary").notNull(), createdAt: created(),
}, t => [index("audit_scope_idx").on(t.clinicId, t.branchId, t.createdAt)]);
export const settings = pgTable("settings", { id: id(), data: data() });
export const otpChallenges = pgTable("otp_challenges", {
  id: id(), userId: text("user_id").notNull().references(() => users.id), mobile: text("mobile").notNull(),
  codeHash: text("code_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0), consumedAt: timestamp("consumed_at", { withTimezone: true }), createdAt: created(),
}, t => [index("otp_user_idx").on(t.userId, t.createdAt)]);