var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all3) => {
  for (var name in all3)
    __defProp(target, name, { get: all3[name], enumerable: true });
};

// ../../lib/db/src/schema/core.ts
import { pgTable, text, jsonb, timestamp, integer, boolean, index, uniqueIndex, check, foreignKey, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
var id, data, created, users, clinics, branches, assignments, masters, doctors, patients, schedules, availabilityExceptions, appointments, appointmentHistory, guestRequests, qrs, auditLogs, settings, integrationCredentials, otpChallenges, staffSessionProofs, authSessions, authChallenges, authRateLimits, notificationReads, patientDocuments, savedViews;
var init_core = __esm({
  "../../lib/db/src/schema/core.ts"() {
    "use strict";
    id = () => text("id").primaryKey();
    data = () => jsonb("data").$type().notNull().default({});
    created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
    users = pgTable("users", {
      id: id(),
      clerkId: text("clerk_id").unique(),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash"),
      emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
      passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
      fullName: text("full_name").notNull(),
      mobile: text("mobile"),
      role: text("role").notNull(),
      managingAdminId: text("managing_admin_id").references(() => users.id),
      invitationStatus: text("invitation_status").notNull().default("failed"),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("user_managing_admin_idx").on(t.managingAdminId),
      check("users_role", sql`${t.role} in ('superAdmin','clinicAdmin','doctor','receptionist','patient')`),
      check("users_managing_admin_role", sql`${t.managingAdminId} is null or ${t.role} = 'receptionist'`),
      check("users_invitation_status", sql`${t.invitationStatus} in ('sent','failed','notRequired')`)
    ]);
    clinics = pgTable("clinics", {
      id: id(),
      ownerId: text("owner_id").references(() => users.id),
      adminId: text("admin_id").notNull().references(() => users.id),
      // Display preferences belong to the parent, in the existing settings document.
      // Keeping these additive JSON fields avoids missing-column failures before migration.
      status: text("status").notNull().default("active"),
      data: jsonb("data").$type().notNull().default({}),
      createdAt: created()
    }, (t) => [index("clinic_owner_idx").on(t.ownerId), index("clinic_admin_idx").on(t.adminId), uniqueIndex("clinic_name_unique").on(sql`lower(${t.data}->>'name')`), uniqueIndex("clinic_slug_unique").on(sql`(${t.data}->>'slug')`)]);
    branches = pgTable("branches", {
      id: id(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("branch_clinic_idx").on(t.clinicId),
      uniqueIndex("branch_id_clinic_unique").on(t.id, t.clinicId),
      uniqueIndex("branch_name_clinic_unique").on(t.clinicId, sql`lower(${t.data}->>'name')`),
      uniqueIndex("branch_slug_clinic_unique").on(t.clinicId, sql`(${t.data}->>'slug')`)
    ]);
    assignments = pgTable("assignments", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id)
    }, (t) => [
      index("assignment_user_idx").on(t.userId),
      index("assignment_scope_idx").on(t.clinicId, t.branchId),
      uniqueIndex("assignment_user_clinic_only_unique").on(t.userId, t.clinicId).where(sql`${t.branchId} is null`),
      uniqueIndex("assignment_user_branch_unique").on(t.userId, t.branchId).where(sql`${t.branchId} is not null`),
      foreignKey({ columns: [t.branchId, t.clinicId], foreignColumns: [branches.id, branches.clinicId], name: "assignment_branch_clinic_fk" })
    ]);
    masters = pgTable("masters", {
      id: id(),
      category: text("category").notNull(),
      code: text("code").notNull(),
      parentId: text("parent_id").references(() => masters.id),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [uniqueIndex("master_category_code").on(t.category, t.code)]);
    doctors = pgTable("doctors", {
      id: id(),
      userId: text("user_id").notNull().unique().references(() => users.id),
      ownerAdminId: text("owner_admin_id").notNull().references(() => users.id),
      specializationId: text("specialization_id").references(() => masters.id),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    }, (t) => [index("doctor_owner_admin_idx").on(t.ownerAdminId)]);
    patients = pgTable("patients", {
      id: id(),
      userId: text("user_id").unique().references(() => users.id),
      clinicId: text("clinic_id").references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      mobile: text("mobile"),
      mobileVerified: boolean("mobile_verified").notNull().default(false),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [index("patient_scope_idx").on(t.clinicId, t.branchId), index("patient_mobile_idx").on(t.mobile)]);
    schedules = pgTable("schedules", {
      id: id(),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      dayOfWeek: integer("day_of_week").notNull(),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [
      index("schedule_lookup_idx").on(t.doctorId, t.branchId, t.dayOfWeek),
      uniqueIndex("schedule_active_location_day_unique").on(t.doctorId, t.branchId, t.dayOfWeek, sql`(${t.data}->>'startTime')`).where(sql`${t.status} = 'active'`),
      check("schedule_weekday", sql`${t.dayOfWeek} between 0 and 6`)
    ]);
    availabilityExceptions = pgTable("availability_exceptions", {
      id: id(),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      date: text("date").notNull(),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [uniqueIndex("exception_date_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'sessionId','')`)]);
    appointments = pgTable("appointments", {
      id: id(),
      patientId: text("patient_id").notNull().references(() => patients.id),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      date: text("date").notNull(),
      tokenNumber: integer("token_number").notNull(),
      status: text("status").notNull().default("booked"),
      requestId: text("request_id"),
      actorId: text("actor_id").notNull().references(() => users.id),
      data: data(),
      createdAt: created()
    }, (t) => [
      uniqueIndex("appointment_token_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`, t.tokenNumber),
      uniqueIndex("appointment_request_idx").on(t.actorId, t.requestId),
      uniqueIndex("appointment_reference_idx").on(sql`(${t.data}->>'reference')`),
      index("appointment_patient_idx").on(t.patientId),
      index("appointment_scope_idx").on(t.clinicId, t.branchId, t.date),
      uniqueIndex("appointment_active_patient_idx").on(t.patientId, t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`).where(sql`${t.status} not in ('cancelled','completed','noShow')`),
      uniqueIndex("appointment_one_consult_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`).where(sql`${t.status} in ('called','inConsultation')`),
      check("appointment_status_check", sql`${t.status} in ('booked','checkedIn','waiting','called','inConsultation','completed','noShow','cancelled')`),
      check("appointment_token_positive", sql`${t.tokenNumber} > 0`)
    ]);
    appointmentHistory = pgTable("appointment_history", {
      id: id(),
      appointmentId: text("appointment_id").notNull().references(() => appointments.id),
      actorId: text("actor_id").notNull().references(() => users.id),
      fromStatus: text("from_status"),
      toStatus: text("to_status").notNull(),
      createdAt: created()
    }, (t) => [index("history_appointment_idx").on(t.appointmentId)]);
    guestRequests = pgTable("guest_requests", {
      id: id(),
      requestId: text("request_id").notNull().unique(),
      receiptHash: text("receipt_hash").notNull().unique(),
      inputHash: text("input_hash").notNull(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      date: text("date").notNull(),
      status: text("status").notNull().default("pending"),
      appointmentId: text("appointment_id").unique().references(() => appointments.id),
      decidedBy: text("decided_by").references(() => users.id),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("guest_request_scope_idx").on(t.clinicId, t.branchId, t.status),
      check("guest_request_status", sql`${t.status} in ('pending','confirmed','rejected')`)
    ]);
    qrs = pgTable("qrs", {
      id: id(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      doctorId: text("doctor_id").references(() => doctors.id),
      publicReference: text("public_reference").notNull().unique(),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [index("qr_scope_idx").on(t.clinicId, t.branchId)]);
    auditLogs = pgTable("audit_logs", {
      id: id(),
      actorId: text("actor_id").references(() => users.id),
      clinicId: text("clinic_id").references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      action: text("action").notNull(),
      entityType: text("entity_type").notNull(),
      entityId: text("entity_id").notNull(),
      summary: text("summary").notNull(),
      createdAt: created()
    }, (t) => [index("audit_scope_idx").on(t.clinicId, t.branchId, t.createdAt)]);
    settings = pgTable("settings", { id: id(), data: data() });
    integrationCredentials = pgTable("integration_credentials", {
      provider: text("provider").primaryKey(),
      encrypted: text("encrypted").notNull(),
      revision: text("revision").notNull()
    });
    otpChallenges = pgTable("otp_challenges", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      mobile: text("mobile").notNull(),
      codeHash: text("code_hash").notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      attempts: integer("attempts").notNull().default(0),
      consumedAt: timestamp("consumed_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("otp_user_idx").on(t.userId, t.createdAt)]);
    staffSessionProofs = pgTable("staff_session_proofs", {
      sessionId: text("session_id").primaryKey(),
      clerkUserId: text("clerk_user_id").notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      createdAt: created()
    }, (t) => [
      index("staff_session_proof_user_idx").on(t.clerkUserId),
      index("staff_session_proof_expiry_idx").on(t.expiresAt)
    ]);
    authSessions = pgTable("auth_sessions", {
      tokenHash: text("token_hash").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      revokedAt: timestamp("revoked_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("auth_session_user_idx").on(t.userId), index("auth_session_expiry_idx").on(t.expiresAt)]);
    authChallenges = pgTable("auth_challenges", {
      id: id(),
      userId: text("user_id").references(() => users.id),
      email: text("email").notNull(),
      purpose: text("purpose").notNull(),
      tokenHash: text("token_hash").notNull(),
      data: data(),
      attempts: integer("attempts").notNull().default(0),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      consumedAt: timestamp("consumed_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("auth_challenge_email_idx").on(t.email, t.purpose), index("auth_challenge_expiry_idx").on(t.expiresAt)]);
    authRateLimits = pgTable("auth_rate_limits", {
      key: text("key").primaryKey(),
      attempts: integer("attempts").notNull().default(0),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
    }, (t) => [index("auth_rate_limit_expiry_idx").on(t.expiresAt)]);
    notificationReads = pgTable("notification_reads", {
      userId: text("user_id").notNull().references(() => users.id),
      notificationId: text("notification_id").notNull(),
      readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow()
    }, (t) => [primaryKey({ columns: [t.userId, t.notificationId] })]);
    patientDocuments = pgTable("patient_documents", {
      id: id(),
      patientId: text("patient_id").notNull().references(() => patients.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      uploadedBy: text("uploaded_by").notNull().references(() => users.id),
      name: text("name").notNull(),
      contentType: text("content_type").notNull(),
      size: integer("size").notNull(),
      provider: text("provider").notNull(),
      storageKey: text("storage_key").notNull(),
      status: text("status").notNull().default("active"),
      createdAt: created(),
      deletedAt: timestamp("deleted_at", { withTimezone: true })
    }, (t) => [index("patient_document_patient_idx").on(t.patientId, t.clinicId)]);
    savedViews = pgTable("saved_views", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      tableKey: text("table_key").notNull(),
      name: text("name").notNull(),
      data: data(),
      sharedRole: text("shared_role"),
      clinicIds: jsonb("clinic_ids").$type().notNull().default([]),
      createdAt: created()
    }, (t) => [index("saved_view_owner_idx").on(t.userId, t.tableKey), index("saved_view_shared_idx").on(t.sharedRole, t.tableKey)]);
  }
});

// isolated:db
var db_exports = {};
__export(db_exports, {
  appointmentHistory: () => appointmentHistory,
  appointments: () => appointments,
  assignments: () => assignments,
  auditLogs: () => auditLogs,
  authChallenges: () => authChallenges,
  authRateLimits: () => authRateLimits,
  authSessions: () => authSessions,
  availabilityExceptions: () => availabilityExceptions,
  branches: () => branches,
  clinics: () => clinics,
  db: () => db,
  doctors: () => doctors,
  guestRequests: () => guestRequests,
  integrationCredentials: () => integrationCredentials,
  masters: () => masters,
  notificationReads: () => notificationReads,
  otpChallenges: () => otpChallenges,
  patientDocuments: () => patientDocuments,
  patients: () => patients,
  qrs: () => qrs,
  savedViews: () => savedViews,
  schedules: () => schedules,
  settings: () => settings,
  staffSessionProofs: () => staffSessionProofs,
  users: () => users
});
var db;
var init_db = __esm({
  "isolated:db"() {
    init_core();
    db = new Proxy({}, { get: (_, key3) => {
      const h = globalThis.queueContentionContext;
      const conn = h.context.getStore()?.db || h.db;
      const value = conn[key3];
      return typeof value === "function" ? value.bind(conn) : value;
    } });
  }
});

// src/lib/http.ts
import { ZodError } from "zod";
function assert(value, status, message) {
  if (!value) throw new HttpError(status, message);
}
function parse(schema2, value) {
  validateDates(value);
  if (value?.mobile) assert(/^\+[1-9][0-9]{7,14}$/.test(value.mobile), 400, "Mobile must use international format, for example +919876543210");
  return normalizeDates(schema2.parse(value));
}
function validateDates(value) {
  for (const key3 of ["date", "from", "to", "dateOfBirth"]) {
    if (value?.[key3] !== void 0) {
      const v = value[key3];
      assert(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 400, `Invalid ${key3}; expected YYYY-MM-DD`);
    }
  }
}
function normalizeDates(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeDates(v)]));
  return value;
}
function query(schema2, req) {
  const q = { ...req.query };
  validateDates(q);
  for (const k of ["date", "from", "to"]) if (q[k] !== void 0) q[k] = new Date(q[k]);
  for (const k of ["page", "pageSize", "dayOfWeek", "weekday"]) if (q[k] !== void 0) q[k] = Number(q[k]);
  if (q.linkedOnly !== void 0) {
    assert(["true", "false"].includes(String(q.linkedOnly)), 400, "linkedOnly must be true or false");
    q.linkedOnly = String(q.linkedOnly) === "true";
  }
  const result = normalizeDates(schema2.parse(q));
  if (result.from && result.to) assert(result.from <= result.to, 400, "Start date must be on or before end date");
  for (const [key3, value] of Object.entries(result)) assert(value !== "undefined", 400, `${key3} is required`);
  return result;
}
var HttpError;
var init_http = __esm({
  "src/lib/http.ts"() {
    "use strict";
    HttpError = class extends Error {
      constructor(status, message, code2 = "REQUEST_FAILED") {
        super(message);
        this.status = status;
        this.code = code2;
      }
      status;
      code;
    };
  }
});

// src/lib/integration-config.ts
function validEmailAddress(value) {
  return value.length <= 254 && emailAddressPattern.test(value);
}
function key(env, name, valid = () => true, optional = false) {
  const value = env[name];
  return { key: name, status: !value?.trim() ? optional ? "default" : "missing" : valid(value) ? "configured" : "invalid" };
}
function smtpKeys(env) {
  return [
    key(env, "SMTP_HOST", (value) => /^[a-z0-9.-]+$/i.test(value)),
    key(env, "SMTP_PORT", (value) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535),
    key(env, "SMTP_USER", (value) => !/[\r\n]/.test(value)),
    key(env, "SMTP_PASSWORD"),
    key(env, "SMTP_FROM", (value) => {
      const address = value.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? value;
      return validEmailAddress(address);
    }),
    key(env, "SMTP_SECURE", (value) => /^(true|false)$/.test(value), true),
    key(env, "SMTP_REQUIRE_TLS", (value) => value === "true", true)
  ];
}
function integrationReadiness(env = process.env) {
  const smtp = smtpKeys(env);
  const sms = [
    key(env, "OTP_PROVIDER", (value) => value === "twilio" || value === "development" && env.NODE_ENV === "development"),
    key(env, "TWILIO_ACCOUNT_SID", (value) => /^AC[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_MESSAGING_SERVICE_SID", (value) => /^MG[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_AUTH_TOKEN", (value) => /^[a-f0-9]{32}$/i.test(value))
  ];
  return { smtp: { ready: ready(smtp), keys: smtp }, sms: { ready: ready(sms), keys: sms } };
}
function smtpConfig(env = process.env) {
  if (!ready(smtpKeys(env))) throw new HttpError(503, "Email delivery is not configured", "EMAIL_UNCONFIGURED");
  const port = Number(env.SMTP_PORT);
  return {
    host: env.SMTP_HOST,
    port,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    requireTLS: true
  };
}
var emailAddressPattern, ready;
var init_integration_config = __esm({
  "src/lib/integration-config.ts"() {
    "use strict";
    init_http();
    emailAddressPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
    ready = (keys) => keys.every((item) => item.status === "configured" || item.status === "default");
  }
});

// src/lib/integration-vault.ts
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
function masterKey() {
  const raw2 = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw2 || !/^[a-f0-9]{64}$/i.test(raw2))
    throw new HttpError(503, "Configure the server integration encryption key before editing credentials.", "INTEGRATION_KEY_REQUIRED");
  return Buffer.from(raw2, "hex");
}
function decryptIntegration(provider, encrypted) {
  try {
    const [version, nonce, tag, data2, extra] = encrypted.split(".");
    if (version !== "v1" || extra !== void 0) throw new Error("Format");
    const cipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(nonce, "base64"));
    cipher.setAAD(Buffer.from(`digiq:integrations:v1:${provider}`));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data2, "base64")), cipher.final()]).toString("utf8"));
  } catch {
    throw new HttpError(503, "Stored integration configuration cannot be decrypted. Restore the correct server encryption key.", "INTEGRATION_DECRYPT_FAILED");
  }
}
async function resolvedIntegration(provider, conn = db) {
  const [row] = await conn.select().from(integrationCredentials).where(eq(integrationCredentials.provider, provider));
  return {
    env: row ? { NODE_ENV: process.env.NODE_ENV, ...decryptIntegration(provider, row.encrypted) } : process.env,
    source: row ? "database" : "environment",
    revision: row?.revision ?? null
  };
}
var init_integration_vault = __esm({
  "src/lib/integration-vault.ts"() {
    "use strict";
    init_db();
    init_http();
    init_integration_config();
  }
});

// src/lib/otp-delivery.ts
function developmentOtpEnabled() {
  return process.env.NODE_ENV === "development" && process.env.OTP_PROVIDER === "development";
}
async function otpDeliveryConfigured(conn) {
  const { env, source } = await resolvedIntegration("sms", conn);
  return source === "environment" && developmentOtpEnabled() || integrationReadiness(env).sms.ready;
}
var init_otp_delivery = __esm({
  "src/lib/otp-delivery.ts"() {
    "use strict";
    init_http();
    init_integration_vault();
    init_integration_config();
  }
});

// src/lib/store.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { eq as eq2 } from "drizzle-orm";
function flatten(row) {
  if (!row) return null;
  const { data: data2, clerkId: _legacyProviderId, passwordHash: _hash, tokenHash: _token, ...fields } = row;
  const { passwordHash: _nestedHash, tokenHash: _nestedToken, ...safeData } = data2 || {};
  return { ...safeData, ...fields };
}
async function all(table, conn = db) {
  return (await conn.select().from(table)).map(flatten);
}
async function one(table, id2, conn = db) {
  const [row] = await conn.select().from(table).where(eq2(table.id, id2));
  assert(row, 404, "Record not found");
  return flatten(row);
}
async function put(table, fields, conn = db) {
  const [row] = await conn.insert(table).values(fields).returning();
  return flatten(row);
}
async function change(table, id2, fields, conn = db) {
  const [row] = await conn.update(table).set(fields).where(eq2(table.id, id2)).returning();
  assert(row, 404, "Record not found");
  return flatten(row);
}
async function audit(user, action, type, row, conn = db) {
  await conn.insert(auditLogs).values({ id: uid(), actorId: user.id, clinicId: row.clinicId || (type === "clinics" ? row.id : null), branchId: row.branchId || (type === "branches" ? row.id : null), action, entityType: type, entityId: row.id, summary: `${action} ${type} record` });
}
async function getSettings(conn = db, clinicId) {
  const [row] = await conn.select().from(settings).where(eq2(settings.id, "platform"));
  const clinic = clinicId ? await one(clinics, clinicId, conn) : null;
  return { ...defaultSettings, ...row?.data, ...clinic?.policies || {}, otpProviderConfigured: await otpDeliveryConfigured(conn), queuePollSeconds: 30 };
}
function filtered(rows, q) {
  return rows.filter((r) => {
    for (const k of ["clinicId", "branchId", "doctorId", "patientId", "managingAdminId", "status", "role", "category", "parentId", "gender", "city", "specializationId", "source", "entityType", "actorId", "date"]) {
      if (q[k] !== void 0 && r[k] !== q[k] && !(k === "clinicId" && r.clinicIds?.includes(q[k])) && !(k === "branchId" && r.branchIds?.includes(q[k]))) return false;
    }
    const date2 = r.date || new Date(r.createdAt || 0).toISOString().slice(0, 10);
    if (q.from && date2 < q.from || q.to && date2 > q.to) return false;
    return !q.search || ["name", "fullName", "email", "mobile", "code", "reference", "patientName", "doctorName", "summary"].some((k) => String(r[k] || "").toLowerCase().includes(q.search.toLowerCase()));
  });
}
function paginate(rows, q) {
  const sort = q.sort || "-createdAt", key3 = sort.replace(/^-/, "");
  assert(["createdAt", "name", "fullName", "date", "status", "code", "tokenNumber", "sortOrder", "email"].includes(key3), 400, "Unsupported sort field");
  const direction = sort.startsWith("-") ? -1 : 1;
  rows.sort((a, b) => String(a[key3] ?? "").localeCompare(String(b[key3] ?? ""), void 0, { numeric: true }) * direction || String(a.id ?? "").localeCompare(String(b.id ?? "")) * direction);
  const page = q.page || 1, pageSize = q.pageSize || 20;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}
var uid, defaultSettings;
var init_store = __esm({
  "src/lib/store.ts"() {
    "use strict";
    init_db();
    init_http();
    init_otp_delivery();
    uid = () => randomUUID2();
    defaultSettings = {
      platformName: "DigiQ Doctors",
      timezone: "Asia/Kolkata",
      bookingHorizonDays: 60,
      cancellationCutoffMinutes: 0,
      requireMobileVerification: false,
      otpExpirySeconds: 300,
      otpMaxAttempts: 5,
      sessionTimeoutMinutes: 60,
      notificationsEnabled: false,
      queuePollSeconds: 30
    };
  }
});

// src/lib/clinical-membership.ts
import { sql as sql2 } from "drizzle-orm";
function clinicalMembership(doctorId, branchId, clinicId) {
  return sql2`exists (
    select 1 from doctors cm_d
    join users cm_u on cm_u.id=cm_d.user_id and cm_u.status='active'
    join branches cm_b on cm_b.status='active'
    join clinics cm_c on cm_c.id=cm_b.clinic_id and cm_c.status='active'
    where cm_d.id=${doctorId} and cm_d.status='active'
      ${branchId ? sql2`and cm_b.id=${branchId}` : sql2``}
      ${clinicId ? sql2`and cm_c.id=${clinicId}` : sql2``}
      and (
        (cm_u.role='doctor' and exists (
          select 1 from assignments cm_a where cm_a.user_id=cm_d.user_id
          and cm_a.clinic_id=cm_b.clinic_id and cm_a.branch_id=cm_b.id
        ))
        or (cm_u.role='clinicAdmin' and cm_d.user_id=cm_d.owner_admin_id
          and cm_c.admin_id=cm_u.id
          and jsonb_typeof(cm_d.data->'branchIds')='array'
          and cm_d.data->'branchIds' ? cm_b.id
          and exists (select 1 from assignments cm_a where cm_a.user_id=cm_u.id
            and cm_a.clinic_id=cm_c.id and cm_a.branch_id is null))
      )
  )`;
}
function managedDoctorLinks(doctorId) {
  return sql2`select a.clinic_id, a.branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='doctor'
    join assignments a on a.user_id=md.user_id
    join clinics c on c.id=a.clinic_id and c.admin_id=md.owner_admin_id
    where md.id=${doctorId} and (a.branch_id is null or exists (
      select 1 from branches b where b.id=a.branch_id and b.clinic_id=c.id))
    union all
    select a.clinic_id, null::text as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.branch_id is null
    join clinics c on c.id=a.clinic_id and c.admin_id=mu.id
    where md.id=${doctorId}
    union all
    select b.clinic_id, b.id as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join branches b on jsonb_typeof(md.data->'branchIds')='array' and md.data->'branchIds' ? b.id
    join clinics c on c.id=b.clinic_id and c.admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.clinic_id=c.id and a.branch_id is null
    where md.id=${doctorId}`;
}
async function managedDoctorAssignments(doctor, conn = db) {
  const accounts = await all(users, conn), links2 = await all(assignments, conn);
  const branchRows = await all(branches, conn), clinicRows = await all(clinics, conn);
  const account = accounts.find((u) => u.id === doctor.userId);
  if (!account) return { clinicIds: [], branchIds: [] };
  const ownedClinics = clinicRows.filter((c) => c.adminId === doctor.ownerAdminId);
  const clinicIds = /* @__PURE__ */ new Set(), branchIds = /* @__PURE__ */ new Set();
  if (account.role === "doctor") {
    for (const link of links2.filter((a) => a.userId === doctor.userId && ownedClinics.some((c) => c.id === a.clinicId))) {
      if (link.branchId && !branchRows.some((b) => b.id === link.branchId && b.clinicId === link.clinicId)) continue;
      clinicIds.add(link.clinicId);
      if (link.branchId) branchIds.add(link.branchId);
    }
  } else if (account.role === "clinicAdmin" && doctor.ownerAdminId === doctor.userId) {
    for (const clinic of ownedClinics.filter((c) => links2.some((a) => a.userId === account.id && a.clinicId === c.id && !a.branchId))) {
      clinicIds.add(clinic.id);
      if (Array.isArray(doctor.branchIds)) for (const branch of branchRows.filter((b) => b.clinicId === clinic.id && doctor.branchIds.includes(b.id))) branchIds.add(branch.id);
    }
  }
  return { clinicIds: [...clinicIds], branchIds: [...branchIds] };
}
async function clinicalBranchIds(doctorId, conn = db) {
  const doctorRows = await all(doctors, conn), accountRows = await all(users, conn);
  const links2 = await all(assignments, conn), branchRows = await all(branches, conn), clinicRows = await all(clinics, conn);
  const doctor = doctorRows.find((d) => d.id === doctorId);
  const account = accountRows.find((u) => u.id === doctor?.userId);
  if (doctor?.status !== "active" || account?.status !== "active") return [];
  const selected = doctor.branchIds;
  return branchRows.filter((branch) => {
    if (branch.status !== "active") return false;
    const clinic = clinicRows.find((c) => c.id === branch.clinicId);
    if (clinic?.status !== "active") return false;
    if (account.role === "doctor") return links2.some((a) => a.userId === doctor.userId && a.clinicId === branch.clinicId && a.branchId === branch.id);
    return account.role === "clinicAdmin" && doctor.userId === doctor.ownerAdminId && clinic.adminId === account.id && Array.isArray(selected) && selected.includes(branch.id) && links2.some((a) => a.userId === account.id && a.clinicId === clinic.id && !a.branchId);
  }).map((b) => b.id).sort();
}
async function isClinicalMember(doctorId, branchId, conn = db) {
  return (await clinicalBranchIds(doctorId, conn)).includes(branchId);
}
var init_clinical_membership = __esm({
  "src/lib/clinical-membership.ts"() {
    "use strict";
    init_db();
    init_store();
  }
});

// src/lib/patient-registration-scope.ts
import { sql as sql3 } from "drizzle-orm";
function doctorRegistrationSql(user, clinic, branch) {
  return sql3`(${!!user.doctorId} and exists (
    select 1 from assignments pr_a
    join clinics pr_c on pr_c.id=pr_a.clinic_id and pr_c.status='active'
    left join branches pr_b on pr_b.id=pr_a.branch_id and pr_b.clinic_id=pr_c.id and pr_b.status='active'
    where pr_a.user_id=${user.id} and pr_a.clinic_id=${clinic}
      and (pr_a.branch_id is null or pr_b.id is not null)
      and (${branch} is null or pr_b.id=${branch})
  ))`;
}
async function doctorRegisteredPatient(user, patient, conn = db) {
  if (!user.doctorId || !patient.clinicId || !user.clinicIds.includes(patient.clinicId) || patient.branchId && !user.branchIds.includes(patient.branchId)) return false;
  const clinicRows = await all(clinics, conn);
  if (!clinicRows.some((c) => c.id === patient.clinicId && c.status === "active")) return false;
  const branchRows = await all(branches, conn), links2 = await all(assignments, conn);
  return links2.some((a) => a.userId === user.id && a.clinicId === patient.clinicId && (!a.branchId || branchRows.some((b) => b.id === a.branchId && b.clinicId === a.clinicId && b.status === "active")) && (!patient.branchId || a.branchId === patient.branchId));
}
var init_patient_registration_scope = __esm({
  "src/lib/patient-registration-scope.ts"() {
    "use strict";
    init_db();
    init_store();
  }
});

// src/lib/feature-policy.ts
function narrowToWorkspace(user, activeClinicId, branchClinic) {
  if (!activeClinicId || user.role === "superAdmin" || user.role === "patient" || user.clinicIds.length < 2 || !user.clinicIds.includes(activeClinicId))
    return { ...user, activeClinicId: null };
  return { ...user, clinicIds: [activeClinicId], branchIds: user.branchIds.filter((b) => branchClinic.get(b) === activeClinicId), activeClinicId };
}
var DOCUMENT_MAX_BYTES;
var init_feature_policy = __esm({
  "src/lib/feature-policy.ts"() {
    "use strict";
    DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
  }
});

// src/lib/demo-policy.ts
function demoWriteAllowed(method, path) {
  if (method === "GET" || method === "HEAD") return true;
  if (method === "POST" && path === "/queue/call-next") return true;
  if (method === "POST" && /^\/guest-requests\/[^/]+\/decision$/.test(path)) return true;
  if (method === "POST" && /^\/appointments\/[^/]+\/(actions|reschedule)$/.test(path)) return true;
  if (method === "PATCH" && /^\/doctors\/[^/]+\/presence$/.test(path)) return true;
  return false;
}
var DEMO_FIXTURE, DEMO_LOGIN_WINDOW_MS;
var init_demo_policy = __esm({
  "src/lib/demo-policy.ts"() {
    "use strict";
    DEMO_FIXTURE = "clinicflow:published-demo";
    DEMO_LOGIN_WINDOW_MS = 10 * 6e4;
  }
});

// src/lib/custom-roles.ts
var custom_roles_exports = {};
__export(custom_roles_exports, {
  customRolesInput: () => customRolesInput,
  enforceCustomRoles: () => enforceCustomRoles,
  getCustomRoles: () => getCustomRoles,
  saveCustomRoles: () => saveCustomRoles
});
import { eq as eq3, sql as sql4, and } from "drizzle-orm";
import { z } from "zod";
async function getCustomRoles(conn = db) {
  const [row] = await conn.select().from(settings).where(eq3(settings.id, "custom-roles"));
  return row?.data || { revision: 0, roles: [], bindings: [] };
}
async function saveCustomRoles(actor, input) {
  assert(actor.role === "superAdmin", 403, "Super Admin access required");
  const parsed = customRolesInput.safeParse(input);
  assert(parsed.success, 400, "Invalid roles or assignments");
  const body = parsed.data;
  assert(new Set(body.roles.map((r) => r.id)).size === body.roles.length, 400, "Duplicate role identifier");
  assert(new Set(body.roles.map((r) => r.name.toLowerCase())).size === body.roles.length, 400, "Role names must be unique");
  assert(new Set(body.bindings.map((b) => `${b.userId}:${b.roleId}:${b.clinicId || ""}`)).size === body.bindings.length, 400, "Duplicate role assignment");
  return db.transaction(async (tx) => {
    await tx.execute(sql4`select pg_advisory_xact_lock(hashtext('custom-roles'))`);
    const current = await getCustomRoles(tx);
    assert(current.revision === body.revision, 409, "Roles changed. Reload before saving.");
    for (const binding of body.bindings) {
      const role = body.roles.find((r) => r.id === binding.roleId);
      const [user] = await tx.select().from(users).where(eq3(users.id, binding.userId));
      assert(role && user && user.role === role.baseRole && user.status === "active", 400, "Assign roles only to active staff with the matching base role");
      if (binding.clinicId) {
        const [clinic] = await tx.select().from(clinics).where(eq3(clinics.id, binding.clinicId));
        const links2 = await tx.select().from(assignments).where(and(eq3(assignments.userId, user.id), eq3(assignments.clinicId, binding.clinicId)));
        assert(clinic && (clinic.adminId === user.id || links2.length > 0), 400, "The user must already belong to this clinic");
      }
    }
    const next = { ...body, revision: current.revision + 1 };
    await tx.insert(settings).values({ id: "custom-roles", data: next }).onConflictDoUpdate({ target: settings.id, set: { data: next } });
    await audit(actor, "configure", "custom_roles", { id: "custom-roles" }, tx);
    return next;
  });
}
async function enforceCustomRoles(user, req, module, action) {
  const config = await getCustomRoles();
  const relevant = config.bindings.filter((b) => b.userId === user.id).filter((b) => config.roles.some((r) => r.id === b.roleId && r.baseRole === user.role && r.denied.includes(`${module}:${action}`)));
  if (!relevant.length) return;
  assert(!relevant.some((b) => !b.clinicId), 403, "Your assigned role does not allow this action");
  const parts = req.path.split("/").filter(Boolean);
  let clinicId = req.body?.clinicId || req.query?.clinicId;
  const branchId = req.body?.branchId || req.query?.branchId;
  if (typeof branchId === "string") {
    const [branch] = await db.select().from(branches).where(eq3(branches.id, branchId));
    clinicId = branch?.clinicId;
  }
  const tables = { clinics, branches, appointments, doctors, patients, schedules, "availability-exceptions": availabilityExceptions, qrs };
  const table = tables[parts[0]];
  if (parts.length > 1 && !table && !["management", "queue"].includes(parts[0])) clinicId = void 0;
  if (table && parts[1] && !["public", "search"].includes(parts[1])) {
    const [record2] = await db.select().from(table).where(eq3(table.id, parts[1]));
    const row = record2 && { ...record2.data, ...record2 };
    clinicId = parts[0] === "clinics" ? row?.id : row?.clinicId;
    if (!clinicId && row?.branchId) {
      const [branch] = await db.select().from(branches).where(eq3(branches.id, row.branchId));
      clinicId = branch?.clinicId;
    }
  }
  assert(typeof clinicId === "string" && clinicId.length > 0, 403, "Select a clinic scope before using this operation with your assigned role");
  assert(!relevant.some((b) => b.clinicId === clinicId), 403, "Your assigned role does not allow this action in this clinic");
}
var capabilityKeys, roleSchema, bindingSchema, customRolesInput;
var init_custom_roles = __esm({
  "src/lib/custom-roles.ts"() {
    "use strict";
    init_db();
    init_http();
    init_store();
    init_permission_policy();
    capabilityKeys = new Set(permissionModules.flatMap((m) => permissionActions.map((a) => `${m}:${a}`)));
    roleSchema = z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
      name: z.string().trim().min(1).max(80),
      baseRole: z.enum(["clinicAdmin", "doctor", "receptionist"]),
      denied: z.array(z.string().refine((k) => capabilityKeys.has(k))).max(capabilityKeys.size)
    }).strict();
    bindingSchema = z.object({ userId: z.string().min(1), roleId: z.string().min(1), clinicId: z.string().min(1).optional() }).strict();
    customRolesInput = z.object({ revision: z.number().int().min(0), roles: z.array(roleSchema).max(100), bindings: z.array(bindingSchema).max(5e3) }).strict();
  }
});

// src/lib/permission-policy.ts
var permission_policy_exports = {};
__export(permission_policy_exports, {
  configurableRoles: () => configurableRoles,
  enforcePermissionPolicy: () => enforcePermissionPolicy,
  permissionActions: () => permissionActions,
  permissionModules: () => permissionModules,
  permissionPolicy: () => permissionPolicy
});
import { eq as eq4 } from "drizzle-orm";
async function permissionPolicy(conn = db) {
  const [row] = await conn.select().from(settings).where(eq4(settings.id, "permission-policy"));
  return row?.data || { revision: 0, denied: [] };
}
async function enforcePermissionPolicy(user, req) {
  if (user.role === "superAdmin") return;
  const parts = req.path.split("/").filter(Boolean);
  let module = parts[0];
  if (module === "notifications" || module === "search" && parts[1] === "records") module = "appointments";
  if (module === "patient-documents") module = "patients";
  if (module === "clinic-registration") module = "clinics";
  if (module === "me" && parts[1] === "doctor-profile") module = "doctors";
  if (module === "management" && parts[1] === "templates") module = "templates";
  if (module === "clinic-settings") module = "clinics";
  if (!permissionModules.includes(module)) return;
  let action = req.method === "GET" ? "read" : req.method === "DELETE" ? "delete" : req.method === "POST" && parts.length === 1 ? "create" : "update";
  if (parts[0] === "notifications") action = "read";
  if (parts[0] === "me" && parts[1] === "doctor-profile" && req.method === "POST") action = "create";
  if (parts.includes("reschedule")) action = "reschedule";
  if (parts.includes("actions") && ["cancel", "complete"].includes(req.body?.action)) action = req.body.action;
  const policy = await permissionPolicy();
  assert(!policy.denied.includes(`${user.role}:${module}:${action}`), 403, "This operation is disabled by your administrator");
  const { enforceCustomRoles: enforceCustomRoles2 } = await Promise.resolve().then(() => (init_custom_roles(), custom_roles_exports));
  await enforceCustomRoles2(user, req, module, action);
}
var permissionModules, permissionActions, configurableRoles;
var init_permission_policy = __esm({
  "src/lib/permission-policy.ts"() {
    "use strict";
    init_db();
    init_http();
    permissionModules = ["clinics", "branches", "users", "doctors", "patients", "appointments", "queue", "schedules", "availability-exceptions", "qrs", "reports", "templates"];
    permissionActions = ["read", "create", "update", "delete", "cancel", "reschedule", "complete"];
    configurableRoles = ["clinicAdmin", "doctor", "receptionist", "patient"];
  }
});

// src/lib/auth.ts
import { eq as eq5, sql as sql5 } from "drizzle-orm";
function isStaffRole(role) {
  return Boolean(role && STAFF_ROLES.includes(role));
}
function requireIdentity(req) {
  const id2 = req.authUserId;
  assert(id2, 401, "Sign in required");
  return id2;
}
function requireSessionIdentity(req) {
  const userId = requireIdentity(req), sessionId = req.authSessionHash;
  if (!sessionId) throw new HttpError(401, "Sign in required", "SIGN_IN_REQUIRED");
  return { userId, sessionId };
}
async function requireStaffSessionProof(req) {
  requireSessionIdentity(req);
}
async function findUser(userId) {
  const [row] = await db.select().from(users).where(eq5(users.id, userId));
  if (!row) return null;
  if (row.data?.demoFixture === DEMO_FIXTURE) {
    const [state] = await db.select().from(settings).where(eq5(settings.id, DEMO_FIXTURE));
    if (!state?.data?.enabled || state.data.userId !== row.id || row.status !== "active" || row.role !== "clinicAdmin") return null;
    const owned = await db.select().from(clinics).where(eq5(clinics.adminId, row.id));
    const doctor2 = await db.select().from(doctors).where(eq5(doctors.userId, row.id));
    const selected = await db.select().from(branches).where(eq5(branches.clinicId, state.data.clinicId));
    if (owned.length !== 1 || owned[0].id !== state.data.clinicId || owned[0].status !== "active" || selected.length !== 1 || selected[0].id !== state.data.branchId || selected[0].status !== "active" || doctor2.length !== 1 || doctor2[0].id !== state.data.doctorId || doctor2[0].ownerAdminId !== row.id || doctor2[0].status !== "active")
      return null;
    const links3 = await db.select().from(assignments).where(eq5(assignments.userId, row.id));
    if (links3.length !== 1 || links3[0].clinicId !== state.data.clinicId || links3[0].branchId) return null;
  }
  const user = flatten(row);
  const activeClinics = new Set((await all(clinics)).filter((c) => c.status === "active").map((c) => c.id));
  const activeBranches = new Set((await all(branches)).filter((b) => b.status === "active" && activeClinics.has(b.clinicId)).map((b) => b.id));
  const links2 = (await all(assignments)).filter((a) => a.userId === user.id && activeClinics.has(a.clinicId) && (!a.branchId || activeBranches.has(a.branchId)));
  const [doctor] = await db.select().from(doctors).where(eq5(doctors.userId, user.id));
  const [patient] = await db.select().from(patients).where(eq5(patients.userId, user.id));
  return { ...user, mobile: user.mobile || "", managingAdminId: user.role === "doctor" ? doctor?.ownerAdminId || null : user.managingAdminId || null, clinicIds: [...new Set(links2.map((a) => a.clinicId))], branchIds: [...new Set(links2.filter((a) => a.branchId).map((a) => a.branchId))], doctorId: doctor?.id || null, patientId: patient?.id || null };
}
async function applyWorkspace(user) {
  if (user.role === "superAdmin" || user.role === "patient" || user.clinicIds.length < 2) return { ...user, activeClinicId: null };
  const [row] = await db.select().from(settings).where(eq5(settings.id, `workspace:${user.id}`));
  const active = row?.data?.clinicId;
  if (!active) return { ...user, activeClinicId: null };
  const branchRows = await db.select({ id: branches.id, clinicId: branches.clinicId }).from(branches).where(eq5(branches.clinicId, active));
  return narrowToWorkspace(user, active, new Map(branchRows.map((b) => [b.id, b.clinicId])));
}
async function requireUser(req) {
  if (!globalThis.queueContentionContext.context.getStore()?.authenticate) return globalThis.queueContentionContext.context.getStore().actor;
  const found = await findUser(requireIdentity(req));
  assert(found, 403, "Complete onboarding first");
  const user = await applyWorkspace(found);
  assert(user.status === "active", 403, "Account inactive");
  if (isStaffRole(user.role)) await requireStaffSessionProof(req);
  if (user.demoFixture === DEMO_FIXTURE)
    assert(demoWriteAllowed(req.method, req.path), 403, "Demo account cannot modify clinic structure or staff");
  const { enforcePermissionPolicy: enforcePermissionPolicy2 } = await Promise.resolve().then(() => (init_permission_policy(), permission_policy_exports));
  await enforcePermissionPolicy2(user, req);
  return user;
}
function roles(user, allowed) {
  assert(allowed.includes(user.role), 403, "Permission denied");
}
function scope(user, clinicId, branchId) {
  if (user.role === "superAdmin") return true;
  if (!clinicId || !user.clinicIds.includes(clinicId)) return false;
  return !branchId || !["doctor", "receptionist"].includes(user.role) || user.branchIds.includes(branchId);
}
async function canRead(user, kind, row, conn = db) {
  if (user.role === "superAdmin" || kind === "masters") return true;
  if (kind === "users") {
    if (user.id === row.id) return true;
    if (row.role === "receptionist" && ["clinicAdmin", "doctor"].includes(user.role)) return row.managingAdminId === (user.role === "clinicAdmin" ? user.id : user.managingAdminId);
    return row.role !== "superAdmin" && row.clinicIds?.some((id2) => scope(user, id2)) && (!["doctor", "receptionist"].includes(user.role) || row.branchIds?.some((id2) => user.branchIds.includes(id2)));
  }
  if (kind === "doctors") return user.doctorId === row.id || ["clinicAdmin", "doctor", "receptionist"].includes(user.role) && row.clinicIds?.some((id2) => scope(user, id2)) && (!["doctor", "receptionist"].includes(user.role) || row.branchIds?.some((id2) => user.branchIds.includes(id2)));
  if (kind === "patients") {
    if (user.role === "patient") return row.id === user.patientId;
    if (scope(user, row.clinicId, row.branchId) && (user.role !== "doctor" || await doctorRegisteredPatient(user, row, conn))) return true;
    return (await all(appointments, conn)).some((a) => a.patientId === row.id && (user.role === "doctor" ? a.doctorId === user.doctorId && scope(user, a.clinicId, a.branchId) : scope(user, a.clinicId, a.branchId)));
  }
  if (kind === "clinics") return scope(user, row.id);
  if (user.role === "patient") return kind === "appointments" && row.patientId === user.patientId;
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) return row.doctorId === user.doctorId && scope(user, row.clinicId, row.branchId);
  if (["schedules", "availability-exceptions"].includes(kind)) {
    const doctor = await one(doctors, row.doctorId);
    const doctorAssigned = await isClinicalMember(doctor.id, row.branchId);
    if (!doctorAssigned) return false;
  }
  let clinicId = row.clinicId;
  if (!clinicId && row.branchId) clinicId = (await one(branches, row.branchId)).clinicId;
  return scope(user, clinicId, row.branchId || (kind === "branches" ? row.id : null));
}
async function projectAssignmentScope(user, kind, row) {
  if (!["users", "doctors"].includes(kind)) return row;
  const own = kind === "users" ? row.id === user.id : row.id === user.doctorId;
  const clinicRows = await all(clinics), branchRows = await all(branches);
  const managementPeer = kind === "users" && row.role === "receptionist" && ["clinicAdmin", "doctor"].includes(user.role) && row.managingAdminId === (user.role === "clinicAdmin" ? user.id : user.managingAdminId);
  const clinicIds = user.role === "superAdmin" || own || managementPeer ? row.clinicIds || [] : (row.clinicIds || []).filter((clinicId) => scope(user, clinicId));
  const branchIds = user.role === "superAdmin" || own || managementPeer ? row.branchIds || [] : (row.branchIds || []).filter((branchId) => {
    const branch = branchRows.find((b) => b.id === branchId);
    return branch && scope(user, branch.clinicId, branch.id);
  });
  const visibleClinics = new Set(clinicIds), visibleBranches = new Set(branchIds);
  return {
    ...row,
    clinicIds,
    branchIds,
    clinicNames: clinicRows.filter((c) => visibleClinics.has(c.id)).map((c) => c.name),
    branchNames: branchRows.filter((b) => visibleBranches.has(b.id)).map((b) => b.name)
  };
}
async function setAssignments(userId, clinicIds, branchIds, actor, managingAdminId, conn = db) {
  await conn.execute(sql5`select pg_advisory_xact_lock(hashtext(${"assignments:" + userId}))`);
  clinicIds = [...new Set(clinicIds)];
  branchIds = [...new Set(branchIds)];
  const target = await one(users, userId, conn);
  assert(target.role !== "clinicAdmin", 409, "Clinic administrator access is changed only by transferring clinic ownership");
  const existing = (await all(assignments, conn)).filter((a) => a.userId === userId);
  const finalClinicIds = new Set(clinicIds);
  const desired = clinicIds.map((clinicId) => ({ clinicId, branchId: null }));
  for (const branchId of branchIds) {
    const branch = await one(branches, branchId, conn);
    assert(finalClinicIds.has(branch.clinicId), 400, "Branch must belong to assigned clinic");
    desired.push({ clinicId: branch.clinicId, branchId });
  }
  const matches = (a, b) => a.clinicId === b.clinicId && (a.branchId || null) === (b.branchId || null);
  for (const link of existing) if (!desired.some((wanted) => matches(link, wanted))) await conn.delete(assignments).where(eq5(assignments.id, link.id));
  for (const wanted of desired) if (!existing.some((link) => matches(link, wanted))) await conn.insert(assignments).values({ id: uid(), userId, ...wanted }).onConflictDoNothing();
}
async function validateAssignments(actor, clinicIds, branchIds, targetRole, expectedManagingAdminId, conn = db) {
  clinicIds = [...new Set(clinicIds)];
  branchIds = [...new Set(branchIds)];
  assert(clinicIds.length, 400, "Please select a clinic");
  const clinicRows = [];
  for (const id2 of clinicIds) {
    const c = await one(clinics, id2, conn);
    assert(c.status === "active", 403, "Clinic assignment forbidden");
    clinicRows.push(c);
  }
  const owners = [...new Set(clinicRows.map((c) => c.adminId))];
  assert(owners.length === 1, 409, "All selected clinics must have the same Clinic Admin owner");
  const managingAdminId = owners[0];
  const manager = await one(users, managingAdminId, conn);
  assert(manager.role === "clinicAdmin" && manager.status === "active", 409, "Selected clinics do not have a valid active Clinic Admin owner");
  if (actor.role === "clinicAdmin") assert(managingAdminId === actor.id, 403, "Clinic assignment forbidden");
  if (actor.role === "doctor") assert(targetRole === "receptionist" && managingAdminId === actor.managingAdminId, 403, "Clinic assignment forbidden");
  if (expectedManagingAdminId) assert(managingAdminId === expectedManagingAdminId, 409, "Changing clinic mappings cannot implicitly transfer the managing Clinic Admin");
  const branchClinics = /* @__PURE__ */ new Set();
  for (const id2 of branchIds) {
    const b = await one(branches, id2, conn);
    assert(b.status === "active" && clinicIds.includes(b.clinicId), 403, "Branch assignment forbidden");
    branchClinics.add(b.clinicId);
  }
  if (targetRole === "receptionist") for (const clinicId of clinicIds) assert(branchClinics.has(clinicId), 400, "Select at least one valid branch for every receptionist clinic");
  return managingAdminId;
}
var STAFF_ROLES;
var init_auth = __esm({
  "src/lib/auth.ts"() {
    "use strict";
    init_db();
    init_http();
    init_store();
    init_clinical_membership();
    init_patient_registration_scope();
    init_feature_policy();
    init_demo_policy();
    STAFF_ROLES = ["superAdmin", "clinicAdmin", "doctor", "receptionist"];
  }
});

// src/lib/queue-order.ts
import { createHash } from "node:crypto";
function orderedReservations(rows) {
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.tokenNumber - b.tokenNumber || a.id.localeCompare(b.id));
}
function queueVersion(rows) {
  return createHash("sha256").update(JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)).map(
    (a) => [a.id, a.status, rank(a), a.revision || 0, a.expectedDurationMinutes ?? null]
  ))).digest("hex");
}
function sessionRows(rows, session) {
  return rows.filter((a) => a.doctorId === session.doctorId && a.branchId === session.branchId && a.date === session.date && (session.startTime ? a.startTime === session.startTime : session.sessionId ? a.sessionId === session.sessionId : true));
}
function queueSummary(rows, own, fallbackDuration = null) {
  const pending = orderedReservations(rows.filter((a) => pendingStatuses.includes(a.status)));
  const current = rows.find((a) => ["called", "inConsultation"].includes(a.status));
  const durationRow = rows.find((a) => Object.hasOwn(a, "expectedDurationMinutes"));
  const duration = durationRow ? durationRow.expectedDurationMinutes ?? null : fallbackDuration;
  const ahead = own && pendingStatuses.includes(own.status) ? pending.filter((a) => rank(a) < rank(own) || rank(a) === rank(own) && a.tokenNumber < own.tokenNumber).length + (current ? 1 : 0) : 0;
  return {
    currentToken: current?.token || null,
    nextToken: pending[0]?.token || null,
    reserved: pending.length,
    arrived: rows.filter((a) => ["checkedIn", "waiting", "called", "inConsultation"].includes(a.status)).length,
    waiting: pending.length,
    inConsultation: rows.filter((a) => a.status === "inConsultation").length,
    completed: rows.filter((a) => a.status === "completed").length,
    noShow: rows.filter((a) => a.status === "noShow").length,
    total: rows.length,
    queueVersion: queueVersion(rows),
    expectedDurationMinutes: duration,
    blockedByAbsentReservation: false,
    ownEntry: own ? { appointmentId: own.id, token: own.token, status: own.status, patientsAhead: ahead, estimatedWaitMinutes: duration === null ? null : ahead * duration } : null
  };
}
var pendingStatuses, statusGroups, rank;
var init_queue_order = __esm({
  "src/lib/queue-order.ts"() {
    "use strict";
    pendingStatuses = ["booked", "checkedIn", "waiting"];
    statusGroups = {
      active: [...pendingStatuses, "called", "inConsultation"],
      waiting: pendingStatuses,
      absent: ["noShow"],
      completed: ["completed"],
      cancelled: ["cancelled"]
    };
    rank = (row) => row.queueRank ?? row.tokenNumber;
  }
});

// src/lib/session-duration.ts
var session_duration_exports = {};
__export(session_duration_exports, {
  allocateToken: () => allocateToken,
  configuredDuration: () => configuredDuration,
  freezeDoctorSessions: () => freezeDoctorSessions,
  readDuration: () => readDuration,
  sessionKey: () => sessionKey,
  snapshotDuration: () => snapshotDuration
});
import { eq as eq6 } from "drizzle-orm";
async function configuredDuration(doctorId, clinicId, conn = db) {
  const doctor = await one(doctors, doctorId, conn);
  const value = doctor.expectedDurations?.[clinicId];
  return [20, 30, 60].includes(value) ? value : null;
}
async function readDuration(session, conn = db) {
  const [stored2] = await conn.select().from(settings).where(eq6(settings.id, sessionKey(session)));
  if (stored2) return flatten(stored2).expectedDurationMinutes ?? null;
  const existing = sessionRows(await all(appointments, conn), session);
  const explicit = existing.find((a) => a.expectedDurationMinutes !== void 0);
  if (explicit) return explicit.expectedDurationMinutes;
  const [legacy] = session.startTime ? await conn.select().from(settings).where(eq6(settings.id, sessionKey({ ...session, startTime: void 0 }))) : [];
  if (legacy) return flatten(legacy).expectedDurationMinutes ?? null;
  const schedule = (await all(schedules, conn)).find((s) => s.doctorId === session.doctorId && s.branchId === session.branchId && s.dayOfWeek === (/* @__PURE__ */ new Date(session.date + "T12:00:00Z")).getUTCDay() && s.status === "active" && (session.sessionId ? s.id === session.sessionId : !session.startTime || s.startTime === session.startTime));
  const legacyDuration = schedule?.consultationMinutes || 10;
  return existing.length ? existing.find((a) => a.expectedDurationMinutes !== void 0)?.expectedDurationMinutes ?? legacyDuration : await configuredDuration(session.doctorId, session.clinicId, conn) ?? legacyDuration;
}
async function snapshotDuration(session, conn) {
  const [stored2] = await conn.select().from(settings).where(eq6(settings.id, sessionKey(session)));
  if (stored2) return flatten(stored2).expectedDurationMinutes ?? null;
  const existing = sessionRows(await all(appointments, conn), session);
  const duration = await readDuration(session, conn);
  await conn.insert(settings).values({ id: sessionKey(session), data: { expectedDurationMinutes: duration } });
  for (const row of existing) if (row.expectedDurationMinutes === void 0) await change(appointments, row.id, { data: { ...row, expectedDurationMinutes: duration } }, conn);
  return duration;
}
async function freezeDoctorSessions(doctorId, conn) {
  const seen = /* @__PURE__ */ new Set();
  for (const row of (await all(appointments, conn)).filter((a) => a.doctorId === doctorId)) {
    const key3 = sessionKey(row);
    if (!seen.has(key3)) {
      seen.add(key3);
      await snapshotDuration(row, conn);
    }
  }
}
async function allocateToken(session, conn, allocate = true) {
  const key3 = "tokens:" + sessionKey(session);
  const [stored2] = await conn.select().from(settings).where(eq6(settings.id, key3));
  const [legacy] = session.startTime ? await conn.select().from(settings).where(eq6(settings.id, "tokens:" + sessionKey({ ...session, startTime: void 0 }))) : [];
  const max = Math.max(stored2?.data?.lastIssued || 0, legacy?.data?.lastIssued || 0, 0, ...sessionRows(await all(appointments, conn), session).map((a) => a.tokenNumber));
  const value = max + (allocate ? 1 : 0);
  await conn.insert(settings).values({ id: key3, data: { lastIssued: value } }).onConflictDoUpdate({ target: settings.id, set: { data: { lastIssued: value } } });
  return value;
}
var sessionKey;
var init_session_duration = __esm({
  "src/lib/session-duration.ts"() {
    "use strict";
    init_db();
    init_store();
    init_queue_order();
    sessionKey = (s) => `session:${s.doctorId}:${s.branchId}:${s.date}${s.startTime ? ":" + s.startTime : ""}`;
  }
});

// src/lib/display-preferences.ts
function clinicDisplayPreferences(clinic) {
  const dateFormats = ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
  const source = clinic?.data ? { ...clinic.data, ...clinic } : clinic;
  return {
    dateFormat: dateFormats.includes(source?.dateFormat) ? source.dateFormat : "DD MMM YYYY",
    timeFormat: source?.timeFormat === "24h" ? "24h" : "12h"
  };
}
var init_display_preferences = __esm({
  "src/lib/display-preferences.ts"() {
    "use strict";
  }
});

// src/lib/availability.ts
import { eq as eq7 } from "drizzle-orm";
function minutes(time) {
  assert(typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time), 400, "Time must be HH:mm");
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function localNow(timezone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(/* @__PURE__ */ new Date());
  } catch {
    assert(false, 400, "Invalid timezone");
  }
  const p = Object.fromEntries(parts.map((p2) => [p2.type, p2.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}
function sameTimezone(a, b) {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: a }).resolvedOptions().timeZone === new Intl.DateTimeFormat("en", { timeZone: b }).resolvedOptions().timeZone;
  } catch {
    assert(false, 400, "Invalid timezone");
  }
}
function validateTimes(body) {
  if (body.timezone) localNow(body.timezone);
  if (body.isClosed || body.isOpen === false) return;
  const start = minutes(body.startTime), end = minutes(body.endTime);
  assert(start < end, 400, "Session end must follow start (overnight sessions are not supported)");
  assert(Boolean(body.breakStart) === Boolean(body.breakEnd), 400, "Both break times are required");
  if (body.breakStart) assert(minutes(body.breakStart) >= start && minutes(body.breakEnd) <= end && minutes(body.breakStart) < minutes(body.breakEnd), 400, "Break must lie within the session");
  if (body.queueOpenTime) assert(minutes(body.queueOpenTime) < end, 400, "Queue opening must precede session end");
  if (body.queueCloseTime) assert(minutes(body.queueCloseTime) <= end && minutes(body.queueCloseTime) > minutes(body.queueOpenTime || body.startTime), 400, "Invalid queue closing time");
}
function datePlus(date2, days) {
  const value = /* @__PURE__ */ new Date(date2 + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function zonedInstant(date2, time, timezone) {
  localNow(timezone);
  const [year, month, day] = date2.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    const correction = Date.UTC(year, month - 1, day, hour, minute) - represented;
    if (!correction) break;
    guess += correction;
  }
  return guess;
}
function sessionQueueWaitMinutes(row, now = Date.now()) {
  if (!row.waitingAt || !row.startTime || !row.timezone || !row.date) return null;
  const waiting = Date.parse(row.waitingAt);
  if (!Number.isFinite(waiting) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date))) return null;
  try {
    minutes(row.startTime);
    const start = zonedInstant(row.date, row.startTime, row.timezone);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(start)).map((p) => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` !== row.date || `${parts.hour}:${parts.minute}` !== row.startTime) return null;
    return Math.max(0, (now - Math.max(waiting, start)) / 6e4);
  } catch (error) {
    if (error instanceof RangeError || error instanceof HttpError && error.status === 400) return null;
    throw error;
  }
}
function sessionsOverlap(a, aDate, b, bDate) {
  if (!a.isOpen || !b.isOpen || a.isClosed || b.isClosed) return false;
  const aStart = zonedInstant(aDate, a.startTime, a.timezone), aEnd = zonedInstant(aDate, a.endTime, a.timezone);
  const bStart = zonedInstant(bDate, b.startTime, b.timezone), bEnd = zonedInstant(bDate, b.endTime, b.timezone);
  return aStart < bEnd && bStart < aEnd;
}
function weeklySessionsOverlap(a, b) {
  const sunday = "2030-01-06";
  for (let week = 0; week < 3; week++) {
    const aDate = datePlus(sunday, week * 7 + a.dayOfWeek);
    for (let adjacent = -1; adjacent <= 1; adjacent++) {
      const bDate = datePlus(sunday, week * 7 + b.dayOfWeek + adjacent * 7);
      if (sessionsOverlap(a, aDate, b, bDate)) return true;
    }
  }
  return false;
}
function extraSession(e, template = {}, branch = {}) {
  return {
    ...template,
    id: e.id,
    isExtra: true,
    isOpen: true,
    isClosed: false,
    dayOfWeek: (/* @__PURE__ */ new Date(e.date + "T12:00:00Z")).getUTCDay(),
    startTime: e.startTime,
    endTime: e.endTime,
    breakStart: e.breakStart ?? null,
    breakEnd: e.breakEnd ?? null,
    maxTokens: e.maxTokens ?? template.maxTokens ?? 0,
    timezone: template.timezone || branch.timezone || "Asia/Kolkata",
    tokenPrefix: template.tokenPrefix || "X",
    consultationMinutes: template.consultationMinutes || 10,
    queueMode: template.queueMode || "mixed",
    queueOpenTime: null,
    queueCloseTime: null,
    bufferMinutes: template.bufferMinutes || 0,
    status: "active"
  };
}
async function operationalDoctorContext(doctorId, branchId, conn = db) {
  const doctor = await one(doctors, doctorId, conn), branch = await one(branches, branchId, conn), clinic = await one(clinics, branch.clinicId, conn);
  const account = await one(users, doctor.userId, conn);
  const assigned = await isClinicalMember(doctorId, branchId, conn);
  return { doctor, branch, clinic, assigned, active: [doctor, account, branch, clinic].every((r) => r.status === "active") };
}
async function doctorContext(doctorId, branchId, conn = db) {
  const { doctor, branch, clinic, assigned, active } = await operationalDoctorContext(doctorId, branchId, conn);
  assert(active, 409, "Doctor, clinic or branch is inactive");
  assert(assigned, 409, "Doctor is not assigned to this branch");
  return { doctor, branch, clinic };
}
async function availability(doctorId, branchId, date2, conn = db, selector = {}) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date2) && !Number.isNaN(Date.parse(date2)) && new Date(date2).toISOString().slice(0, 10) === date2, 400, "Invalid date");
  const { doctor, branch, clinic } = await doctorContext(doctorId, branchId, conn);
  const weekday = (/* @__PURE__ */ new Date(date2 + "T12:00:00Z")).getUTCDay();
  const sessions = (await all(schedules, conn)).filter((s) => s.doctorId === doctorId && s.branchId === branchId && s.dayOfWeek === weekday && s.status === "active");
  const dated = (await all(availabilityExceptions, conn)).filter((e) => e.doctorId === doctorId && e.branchId === branchId && e.date === date2 && e.status === "active");
  const exceptions = dated.filter((e) => !e.isExtra);
  let matches = sessions.filter((s) => selector.sessionId ? s.id === selector.sessionId : !selector.startTime || s.startTime === selector.startTime);
  if (!matches.length && (selector.sessionId || selector.startTime)) {
    const extra = dated.find((e) => e.isExtra && (selector.sessionId ? e.id === selector.sessionId : e.startTime === selector.startTime));
    if (extra) matches = [extraSession(extra, sessions[0], branch)];
  }
  assert(matches.length <= 1, 409, "Select a session for this doctor and date");
  const schedule = matches[0];
  if (selector.sessionId || selector.startTime) assert(schedule, 404, "Session not found for this doctor, branch and date");
  const exception = schedule?.isExtra ? void 0 : exceptions.find((e) => e.sessionId === schedule?.id) || exceptions.find((e) => !e.sessionId);
  const effective = { ...schedule };
  if (exception) {
    for (const key3 of ["startTime", "endTime", "breakStart", "breakEnd", "maxTokens"]) if (exception[key3] !== void 0 && (exception[key3] !== null || key3.startsWith("break"))) effective[key3] = exception[key3];
  }
  if (selector.sessionId && selector.startTime) assert(selector.startTime === effective.startTime, 409, "Session timing changed; refresh availability");
  const timezone = effective.timezone || branch.timezone || "Asia/Kolkata", now = localNow(timezone), config = await getSettings(conn, clinic.id);
  const sessionBookings = (await all(appointments, conn)).filter((a) => a.doctorId === doctorId && a.branchId === branchId && a.date === date2 && a.startTime === effective.startTime);
  const bookedTokens = sessionBookings.filter((a) => a.status !== "cancelled").length;
  const [snapshot] = await conn.select().from(settings).where(eq7(settings.id, sessionKey({ doctorId, branchId, date: date2, startTime: effective.startTime })));
  const consultationMinutes = snapshot?.data?.expectedDurationMinutes ?? (sessionBookings.length ? sessionBookings[0].expectedDurationMinutes ?? effective.consultationMinutes ?? 10 : await configuredDuration(doctorId, clinic.id, conn) ?? effective.consultationMinutes ?? 10);
  let reason = null;
  if (!schedule || !schedule.isOpen) reason = "No open weekly session";
  if (exception?.isClosed) reason = exception.reason || "Closed for this date";
  if (!reason && Array.isArray(branch.openingHours) && !sameTimezone(timezone, branch.timezone || "Asia/Kolkata")) reason = "Session timezone differs from the location timezone";
  if (!reason && schedule && effective.startTime && branchDayStatus(branch, { ...effective, date: date2 }) === "closed") reason = LOCATION_CLOSED_REASON;
  const hoursWarning = schedule && !exception?.isClosed ? outsideBranchHours(branch, { ...effective, date: date2 }) : null;
  if (date2 < now.date || date2 === now.date && effective.endTime && now.minute >= minutes(effective.endTime)) reason = "Session is in the past";
  if (!reason && date2 === now.date && effective.queueCloseTime && now.minute >= minutes(effective.queueCloseTime)) reason = "Queue booking has closed";
  if ((Date.parse(date2) - Date.parse(now.date)) / 864e5 > config.bookingHorizonDays) reason = "Outside booking horizon";
  const maxTokens = effective.maxTokens || 0, remainingTokens = Math.max(0, maxTokens - bookedTokens);
  if (!maxTokens) reason ||= "Session setup is incomplete. Contact the clinic.";
  else if (!remainingTokens) reason ||= "Session capacity reached";
  return { doctorId, branchId, clinicId: clinic.id, ...clinicDisplayPreferences(clinic), date: date2, sessionId: schedule?.id || null, available: !reason, reason, hoursWarning, startTime: effective.startTime || null, endTime: effective.endTime || null, breakStart: effective.breakStart || null, breakEnd: effective.breakEnd || null, timezone, maxTokens, bookedTokens, remainingTokens, consultationMinutes, tokenPrefix: effective.tokenPrefix || "A", queueMode: effective.queueMode || "mixed", queueOpenTime: effective.queueOpenTime, queueCloseTime: effective.queueCloseTime, bufferMinutes: effective.bufferMinutes || 0 };
}
async function availabilitySessions(doctorId, branchId, date2, conn = db) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date2) && Number.isFinite(Date.parse(date2)) && new Date(date2).toISOString().slice(0, 10) === date2, 400, "Invalid date");
  await doctorContext(doctorId, branchId, conn);
  const weekday = (/* @__PURE__ */ new Date(date2 + "T12:00:00Z")).getUTCDay();
  const rows = (await all(schedules, conn)).filter((s) => s.doctorId === doctorId && s.branchId === branchId && s.dayOfWeek === weekday && s.status === "active");
  const extras = (await all(availabilityExceptions, conn)).filter((e) => e.isExtra && e.doctorId === doctorId && e.branchId === branchId && e.date === date2 && e.status === "active");
  const ids = [...rows, ...extras].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))).map((s) => s.id);
  return Promise.all(ids.map((sessionId) => availability(doctorId, branchId, date2, conn, { sessionId })));
}
function branchDayStatus(branch, session) {
  if (!Array.isArray(branch?.openingHours)) return "unconfigured";
  if (!branch.openingHours.length) return "closed";
  const day = session.date ? (/* @__PURE__ */ new Date(session.date + "T12:00:00Z")).getUTCDay() : session.dayOfWeek;
  const open2 = branch.openingHours.filter((h) => h.dayOfWeek === day && h.isOpen !== false);
  return open2.some((h) => minutes(h.startTime) <= minutes(session.startTime) && minutes(h.endTime) >= minutes(session.endTime)) ? "inside" : "outside";
}
function outsideBranchHours(branch, session) {
  if (!session?.startTime || !session?.endTime) return null;
  return branchDayStatus(branch, session) === "outside" ? OUTSIDE_LOCATION_HOURS_WARNING : null;
}
var OUTSIDE_LOCATION_HOURS_WARNING, LOCATION_CLOSED_REASON;
var init_availability = __esm({
  "src/lib/availability.ts"() {
    "use strict";
    init_db();
    init_clinical_membership();
    init_session_duration();
    init_store();
    init_http();
    init_display_preferences();
    OUTSIDE_LOCATION_HOURS_WARNING = "Doctor hours extend beyond the location's ordinary opening hours";
    LOCATION_CLOSED_REASON = "Location is closed on all days (outside branch opening hours)";
  }
});

// src/lib/presence.ts
import { eq as eq8 } from "drizzle-orm";
async function getPresence(session, conn = db) {
  const [row] = await conn.select().from(settings).where(eq8(settings.id, "presence:" + sessionKey(session)));
  return {
    doctorId: session.doctorId,
    branchId: session.branchId,
    date: session.date,
    ...session.sessionId ? { sessionId: session.sessionId } : {},
    ...session.startTime ? { startTime: session.startTime } : {},
    status: row?.data?.status || "available",
    updatedAt: row?.data?.updatedAt || null
  };
}
async function isDoctorAvailable(session, conn = db) {
  return (await getPresence(session, conn)).status === "available";
}
var init_presence = __esm({
  "src/lib/presence.ts"() {
    "use strict";
    init_db();
    init_session_duration();
  }
});

// src/lib/notification-templates.ts
import { z as z2 } from "zod";
function defaultTemplate(event, recipient = defaultRecipient(event)) {
  return { enabled: recipient === defaultRecipient(event), subject: `${eventTitles[event]} \u2014 {{clinic_name}}`, body: recipient === defaultRecipient(event) ? bodies[event] : `Clinic notification: ${eventTitles[event]}
Patient: {{patient_name}}
Doctor: {{doctor_name}}
{{appointment_details}}
Reference: {{reference}}
{{clinic_contact}}`, prefix: "", logoUrl: "", footer: "This is an automated clinic message. Contact your clinic for assistance." };
}
function substitute(text2, values) {
  return text2.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key3) => values[key3] ?? `[${key3.replaceAll("_", " ")}]`);
}
function renderNotification(content, values) {
  const subject = [substitute(content.prefix, values), substitute(content.subject, values)].filter(Boolean).join(" ").replace(/[\r\n]+/g, " ");
  const body = substitute(content.body, values), footer2 = substitute(content.footer, values);
  const escape = (v) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const logoPath = content.logoUrl.startsWith("/api/branding/logos/") ? content.logoUrl : void 0;
  return {
    subject,
    logoPath,
    text: [body, footer2].filter(Boolean).join("\n\n"),
    html: `<!doctype html><html><body style="font:16px/1.6 Arial,sans-serif;color:#17243b"><main style="max-width:600px;margin:auto;padding:24px">${content.logoUrl ? `<img src="${escape(logoPath ? "cid:clinic-logo" : content.logoUrl)}" alt="${escape(values.clinic_name || "Clinic")} logo" style="max-width:180px;max-height:80px">` : ""}<h1 style="font-size:22px">${escape(subject)}</h1><div style="white-space:pre-wrap">${escape(body)}</div><p style="font-size:12px;color:#53647b;white-space:pre-wrap">${escape(footer2)}</p></main></body></html>`
  };
}
var templateEvents, templateRecipients, defaultRecipient, templateVariables, templateContent, templateSave, eventTitles, bodies;
var init_notification_templates = __esm({
  "src/lib/notification-templates.ts"() {
    "use strict";
    templateEvents = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"];
    templateRecipients = ["patient", "clinicAdmin", "doctor", "receptionist"];
    defaultRecipient = (event) => event === "onboarding" ? "clinicAdmin" : "patient";
    templateVariables = ["clinic_name", "patient_name", "doctor_name", "appointment_details", "previous_details", "reference", "timezone", "clinic_contact"];
    templateContent = z2.object({
      enabled: z2.boolean().default(true),
      subject: z2.string().trim().min(1).max(180).refine((v) => !/[\r\n]/.test(v), "Subject must be one line"),
      body: z2.string().trim().min(1).max(8e3),
      prefix: z2.string().trim().max(60).refine((v) => !/[\r\n]/.test(v), "Prefix must be one line"),
      footer: z2.string().trim().max(500),
      logoUrl: z2.string().max(1e3).refine((value) => {
        if (!value) return true;
        if (/^\/api\/branding\/logos\/[a-f0-9-]{36}$/.test(value)) return true;
        try {
          const u = new URL(value);
          return u.protocol === "https:" && !u.username && !u.password;
        } catch {
          return false;
        }
      }, "Use an HTTPS logo URL without credentials")
    }).strict().superRefine((value, ctx) => {
      for (const field of ["subject", "body", "prefix", "footer"]) {
        const remaining = value[field].replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (token, variable) => {
          if (!templateVariables.includes(variable))
            ctx.addIssue({ code: "custom", path: [field], message: `Unsupported variable: ${variable}` });
          return "";
        });
        if (/[{}]/.test(remaining)) ctx.addIssue({ code: "custom", path: [field], message: "Use supported variables in double braces" });
      }
    });
    templateSave = z2.object({
      recipient: z2.enum(templateRecipients).optional(),
      clinicId: z2.string().min(1).max(100).optional(),
      event: z2.enum(templateEvents),
      revision: z2.number().int().min(0),
      mode: z2.enum(["draft", "publish", "reset"]),
      content: templateContent.optional()
    }).strict().refine((v) => v.mode === "reset" || !!v.content, { message: "Template content is required" });
    eventTitles = {
      booking: "Booking confirmation",
      onboarding: "Clinic onboarding",
      rescheduled: "Appointment rescheduled",
      cancelled: "Appointment cancelled",
      completed: "Thank you after your visit",
      reminder: "Appointment reminder"
    };
    bodies = {
      booking: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} is confirmed.\n{{appointment_details}}\nReference: {{reference}}\n\n{{clinic_contact}}",
      onboarding: "Welcome to {{clinic_name}}.\n\nComplete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link.\n\n{{clinic_contact}}",
      rescheduled: "Hello {{patient_name}},\n\nYour visit at {{clinic_name}} has been rescheduled.\nPrevious details: {{previous_details}}\nNew details:\n{{appointment_details}}\nReference: {{reference}}",
      cancelled: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} has been cancelled.\n{{appointment_details}}\nReference: {{reference}}\nContact the clinic if you need to book another visit.\n{{clinic_contact}}",
      completed: "Hello {{patient_name}},\n\nThank you for visiting {{clinic_name}}. Your visit is now complete.\nFor further assistance, contact your clinic.\n{{clinic_contact}}",
      reminder: "Hello {{patient_name}},\n\nA reminder of your upcoming session at {{clinic_name}}.\n{{appointment_details}}\nReference: {{reference}}\nQueue-based visits do not guarantee an exact consultation time."
    };
  }
});

// src/lib/notification-template-store.ts
import { eq as eq9, sql as sql6 } from "drizzle-orm";
async function stored(event, clinicId, conn = db, recipient = defaultRecipient(event)) {
  const [row] = await conn.select().from(settings).where(eq9(settings.id, key2(event, clinicId, recipient)));
  return row?.data || { revision: 0 };
}
async function resolvedTemplate(event, clinicId, conn = db, recipient = defaultRecipient(event)) {
  const platform = await stored(event, void 0, conn, recipient);
  const local = clinicId ? await stored(event, clinicId, conn, recipient) : platform;
  const content = local.published || platform.published || defaultTemplate(event, recipient);
  return { content: templateContent.parse(content), local, source: local.published ? clinicId ? "clinic" : "platform" : platform.published ? "platform" : "default" };
}
var key2;
var init_notification_template_store = __esm({
  "src/lib/notification-template-store.ts"() {
    "use strict";
    init_db();
    init_store();
    init_http();
    init_notification_templates();
    init_notification_templates();
    key2 = (event, clinicId, recipient = defaultRecipient(event)) => `notification-template:${clinicId || "platform"}:${event}${recipient === defaultRecipient(event) ? "" : `:${recipient}`}`;
  }
});

// src/lib/email-template.ts
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
function systemEmailTemplate(subject, body) {
  return {
    text: `${brand}

${subject}

${body}

${footer}`,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background-color:#f4f7fb;color:#17243b;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background-color:#ffffff">
    <tr><td style="padding:24px 28px;background-color:#163b65;color:#ffffff;font-size:24px;font-weight:bold">${brand}</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.4">${escapeHtml(subject)}</h1>
      <div style="font-size:16px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(body)}</div>
    </td></tr>
    <tr><td style="padding:20px 28px;border-top:1px solid #e4e9f0;color:#53647b;font-size:12px;line-height:1.6">${footer}</td></tr>
  </table>
</body>
</html>`
  };
}
var brand, footer;
var init_email_template = __esm({
  "src/lib/email-template.ts"() {
    "use strict";
    brand = "DigiQ Doctors";
    footer = "This is an automated message from DigiQ Doctors. Please do not reply to this email.";
  }
});

// src/lib/objectAcl.ts
function isPermissionAllowed(requested, granted) {
  if (requested === "read" /* READ */) {
    return ["read" /* READ */, "write" /* WRITE */].includes(granted);
  }
  return granted === "write" /* WRITE */;
}
function createObjectAccessGroup(group) {
  switch (group.type) {
    // Implement per access group type, e.g.:
    // case "USER_LIST":
    //   return new UserListAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}
async function setObjectAclPolicy(objectFile, aclPolicy) {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy)
    }
  });
}
async function getObjectAclPolicy(objectFile) {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy);
}
async function canAccessObject({
  userId,
  objectFile,
  requestedPermission
}) {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }
  if (aclPolicy.visibility === "public" && requestedPermission === "read" /* READ */) {
    return true;
  }
  if (!userId) {
    return false;
  }
  if (aclPolicy.owner === userId) {
    return true;
  }
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (await accessGroup.hasMember(userId) && isPermissionAllowed(requestedPermission, rule.permission)) {
      return true;
    }
  }
  return false;
}
var ACL_POLICY_METADATA_KEY;
var init_objectAcl = __esm({
  "src/lib/objectAcl.ts"() {
    "use strict";
    ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
  }
});

// src/lib/objectStorage.ts
import { randomUUID as randomUUID3 } from "crypto";
import { Readable } from "stream";
import { Storage } from "@google-cloud/storage";
function parseObjectPath(path) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return {
    bucketName,
    objectName
  };
}
async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec
}) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1e3).toISOString()
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(3e4)
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, make sure you're running on Replit`
    );
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
var REPLIT_SIDECAR_ENDPOINT, objectStorageClient, ObjectNotFoundError, ObjectStorageService;
var init_objectStorage = __esm({
  "src/lib/objectStorage.ts"() {
    "use strict";
    init_objectAcl();
    REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
    objectStorageClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token"
          }
        },
        universe_domain: "googleapis.com"
      },
      projectId: ""
    });
    ObjectNotFoundError = class _ObjectNotFoundError extends Error {
      constructor() {
        super("Object not found");
        this.name = "ObjectNotFoundError";
        Object.setPrototypeOf(this, _ObjectNotFoundError.prototype);
      }
    };
    ObjectStorageService = class {
      constructor() {
      }
      getPublicObjectSearchPaths() {
        const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
        const paths = Array.from(
          new Set(
            pathsStr.split(",").map((path) => path.trim()).filter((path) => path.length > 0)
          )
        );
        if (paths.length === 0) {
          throw new Error(
            "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
          );
        }
        return paths;
      }
      getPrivateObjectDir() {
        const dir = process.env.PRIVATE_OBJECT_DIR || "";
        if (!dir) {
          throw new Error(
            "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
          );
        }
        return dir;
      }
      async searchPublicObject(filePath2) {
        for (const searchPath of this.getPublicObjectSearchPaths()) {
          const fullPath = `${searchPath}/${filePath2}`;
          const { bucketName, objectName } = parseObjectPath(fullPath);
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (exists) {
            return file;
          }
        }
        return null;
      }
      async downloadObject(file, cacheTtlSec = 3600) {
        const [metadata] = await file.getMetadata();
        const aclPolicy = await getObjectAclPolicy(file);
        const isPublic = aclPolicy?.visibility === "public";
        const nodeStream = file.createReadStream();
        const webStream = Readable.toWeb(nodeStream);
        const headers = {
          "Content-Type": metadata.contentType || "application/octet-stream",
          "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`
        };
        if (metadata.size) {
          headers["Content-Length"] = String(metadata.size);
        }
        return new Response(webStream, { headers });
      }
      async getObjectEntityUploadURL() {
        const privateObjectDir = this.getPrivateObjectDir();
        if (!privateObjectDir) {
          throw new Error(
            "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
          );
        }
        const objectId = randomUUID3();
        const fullPath = `${privateObjectDir}/uploads/${objectId}`;
        const { bucketName, objectName } = parseObjectPath(fullPath);
        return signObjectURL({
          bucketName,
          objectName,
          method: "PUT",
          ttlSec: 900
        });
      }
      async getObjectEntityFile(objectPath) {
        if (!objectPath.startsWith("/objects/")) {
          throw new ObjectNotFoundError();
        }
        const parts = objectPath.slice(1).split("/");
        if (parts.length < 2) {
          throw new ObjectNotFoundError();
        }
        const entityId = parts.slice(1).join("/");
        let entityDir = this.getPrivateObjectDir();
        if (!entityDir.endsWith("/")) {
          entityDir = `${entityDir}/`;
        }
        const objectEntityPath = `${entityDir}${entityId}`;
        const { bucketName, objectName } = parseObjectPath(objectEntityPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const objectFile = bucket.file(objectName);
        const [exists] = await objectFile.exists();
        if (!exists) {
          throw new ObjectNotFoundError();
        }
        return objectFile;
      }
      normalizeObjectEntityPath(rawPath) {
        if (!rawPath.startsWith("https://storage.googleapis.com/")) {
          return rawPath;
        }
        const url = new URL(rawPath);
        const rawObjectPath = url.pathname;
        let objectEntityDir = this.getPrivateObjectDir();
        if (!objectEntityDir.endsWith("/")) {
          objectEntityDir = `${objectEntityDir}/`;
        }
        if (!rawObjectPath.startsWith(objectEntityDir)) {
          return rawObjectPath;
        }
        const entityId = rawObjectPath.slice(objectEntityDir.length);
        return `/objects/${entityId}`;
      }
      async trySetObjectEntityAclPolicy(rawPath, aclPolicy) {
        const normalizedPath = this.normalizeObjectEntityPath(rawPath);
        if (!normalizedPath.startsWith("/")) {
          return normalizedPath;
        }
        const objectFile = await this.getObjectEntityFile(normalizedPath);
        await setObjectAclPolicy(objectFile, aclPolicy);
        return normalizedPath;
      }
      async canAccessObjectEntity({
        userId,
        objectFile,
        requestedPermission
      }) {
        return canAccessObject({
          userId,
          objectFile,
          requestedPermission: requestedPermission ?? "read" /* READ */
        });
      }
    };
  }
});

// src/lib/local-media.ts
import { isAbsolute, join } from "node:path";
import { mkdir, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
function mediaConfig(env = process.env) {
  const driver = env.MEDIA_STORAGE || "object";
  assert(["local", "object"].includes(driver), 500, "MEDIA_STORAGE must be local or object");
  const root = env.MEDIA_ROOT || "";
  const url = (env.MEDIA_URL || "/media").replace(/\/$/, "");
  assert(/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(url) && !/^\/(api|admin|assets)(\/|$)/.test(url), 500, "MEDIA_URL must be a dedicated URL path, such as /media");
  if (driver === "local") {
    assert(isAbsolute(root) && root !== "/", 500, "Local media requires an absolute MEDIA_ROOT folder");
  }
  return { driver, root, url };
}
function filePath(key3) {
  assert(/^[a-f0-9-]{36}\.png$/.test(key3), 400, "Invalid media key");
  const { root } = mediaConfig();
  assert(isAbsolute(root), 503, "MEDIA_ROOT is required to read local logos");
  return join(root, key3);
}
async function readLocalLogo(key3) {
  const handle = await open(filePath(key3), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    assert(stat.isFile() && stat.size <= 20 * 1024 * 1024, 400, "Invalid stored logo");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}
var init_local_media = __esm({
  "src/lib/local-media.ts"() {
    "use strict";
    init_http();
  }
});

// src/lib/logo-bytes.ts
var logo_bytes_exports = {};
__export(logo_bytes_exports, {
  loadLogoBytes: () => loadLogoBytes
});
import { eq as eq10 } from "drizzle-orm";
async function loadLogoBytes(path) {
  assert(/^\/api\/branding\/logos\/[a-f0-9-]{36}$/.test(path), 400, "Invalid logo");
  const [row] = await db.select().from(settings).where(eq10(settings.id, `logo:${path.split("/").at(-1)}`));
  const data2 = row?.data;
  assert(data2?.state === "ready", 400, "Logo is unavailable");
  if (data2.provider === "local") return readLocalLogo(data2.validatedPath);
  const file = await new ObjectStorageService().getObjectEntityFile(data2.validatedPath);
  const [bytes] = await file.download();
  return bytes;
}
var init_logo_bytes = __esm({
  "src/lib/logo-bytes.ts"() {
    "use strict";
    init_db();
    init_objectStorage();
    init_http();
    init_local_media();
  }
});

// src/lib/auth-email.ts
import nodemailer from "nodemailer";
async function sendAuthEmail(to, subject, text2, transport, rendered, files = []) {
  const cfg = smtpConfig((await resolvedIntegration("smtp")).env);
  const client = transport || nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
    requireTLS: !cfg.secure && cfg.requireTLS,
    connectionTimeout: 1e4,
    greetingTimeout: 1e4,
    socketTimeout: 2e4,
    disableFileAccess: true,
    disableUrlAccess: true
  });
  try {
    const attachments = [...files];
    if (rendered?.logoPath) {
      const { loadLogoBytes: loadLogoBytes2 } = await Promise.resolve().then(() => (init_logo_bytes(), logo_bytes_exports));
      attachments.push({ filename: "clinic-logo.png", content: await loadLogoBytes2(rendered.logoPath), contentType: "image/png", cid: "clinic-logo" });
    }
    const result = await client.sendMail({
      from: cfg.from,
      to,
      subject,
      ...rendered || systemEmailTemplate(subject, text2),
      attachments,
      disableFileAccess: true,
      disableUrlAccess: true
    });
    if (result && typeof result === "object") {
      const delivery = result;
      if (Array.isArray(delivery.accepted) && delivery.accepted.length === 0 || Array.isArray(delivery.rejected) && delivery.rejected.length > 0)
        throw new Error("Email not accepted");
    }
  } catch {
    throw new HttpError(503, "Email delivery unavailable", "EMAIL_DELIVERY_FAILED");
  }
}
var init_auth_email = __esm({
  "src/lib/auth-email.ts"() {
    "use strict";
    init_http();
    init_integration_config();
    init_email_template();
    init_integration_vault();
    init_integration_config();
  }
});

// src/lib/appointment-confirmation.ts
import { eq as eq11, sql as sql7 } from "drizzle-orm";
async function confirmationRecipient(patient, conn) {
  const account = patient.userId ? await one(users, patient.userId, conn) : null;
  return String(account?.email || patient.email || "").trim();
}
async function initialConfirmationEmail(patient, enabled, conn) {
  if (!enabled) return "disabled";
  if (!validEmailAddress(await confirmationRecipient(patient, conn))) return "no_recipient";
  return void 0;
}
function confirmationText(row, clinic) {
  const preferences = clinicDisplayPreferences(clinic);
  const [year, month, day] = row.date.split("-");
  const date2 = preferences.dateFormat === "DD/MM/YYYY" ? `${day}/${month}/${year}` : preferences.dateFormat === "MM/DD/YYYY" ? `${month}/${day}/${year}` : preferences.dateFormat === "YYYY-MM-DD" ? row.date : `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]} ${year}`;
  const time = (value) => {
    if (!value) return "Not recorded";
    if (preferences.timeFormat === "24h") return value;
    const [hour, minute] = value.split(":");
    return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
  };
  return `Your appointment is confirmed.

${row.clinicName} \xB7 ${row.branchName}
Doctor: ${row.doctorName}
Date: ${date2}
Session: ${time(row.startTime)}\u2013${time(row.endTime)} (${row.timezone || "timezone unavailable"})
Reference: ${row.reference}
Token: ${row.token}

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.`;
}
async function saveOutcome(conn, id2, outcome) {
  await conn.update(appointments).set({ data: sql7`${appointments.data} || ${JSON.stringify({ confirmationEmail: outcome })}::jsonb` }).where(eq11(appointments.id, id2));
}
async function lockConfirmation(conn, id2) {
  await conn.execute(sql7`select pg_advisory_xact_lock(hashtext(${"appointment-confirmation:" + id2}))`);
  const original = await one(appointments, id2, conn);
  await lockQueue(conn, original.doctorId, original.branchId, original.date);
  const row = await one(appointments, id2, conn);
  if (row.doctorId !== original.doctorId || row.branchId !== original.branchId || row.date !== original.date || row.startTime !== original.startTime)
    throw new Error("Appointment changed during notification preparation");
  return row;
}
async function confirmAppointmentEmail(id2, conn = db, send = sendAuthEmail) {
  let claimed;
  try {
    claimed = await conn.transaction(async (tx) => {
      const row = await lockConfirmation(tx, id2);
      if (["completed", "cancelled", "noShow"].includes(row.status)) {
        await saveOutcome(tx, id2, "not_attempted");
        return { outcome: "not_attempted" };
      }
      const config = await getSettings(tx, row.clinicId);
      if (!config.notificationsEnabled) {
        await saveOutcome(tx, id2, "disabled");
        return { outcome: "disabled" };
      }
      const { enqueueEvent: enqueueEvent2 } = await Promise.resolve().then(() => (init_notification_outbox(), notification_outbox_exports));
      await enqueueEvent2(tx, "booking", { ...row, revision: 0 });
      if (row.confirmationEmail) return { outcome: row.confirmationEmail };
      const patient = await one(patients, row.patientId, tx);
      const recipient = await confirmationRecipient(patient, tx);
      if (!validEmailAddress(recipient)) {
        await saveOutcome(tx, id2, "no_recipient");
        return { outcome: "no_recipient" };
      }
      const clinic = await one(clinics, row.clinicId, tx);
      const template = await resolvedTemplate("booking", row.clinicId, tx);
      if (!template.content.enabled) {
        await saveOutcome(tx, id2, "disabled");
        return { outcome: "disabled" };
      }
      const rendered = template.source === "default" ? void 0 : renderNotification(template.content, {
        clinic_name: clinic.name,
        patient_name: patient.fullName || "Patient",
        doctor_name: row.doctorName || "Your doctor",
        appointment_details: confirmationText(row, clinic),
        reference: row.reference || "",
        timezone: row.timezone || "",
        previous_details: "",
        clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" \xB7 ")
      });
      await saveOutcome(tx, id2, "not_attempted");
      return { outcome: "not_attempted", recipient, text: confirmationText(row, clinic), rendered };
    });
  } catch {
    return "unavailable";
  }
  if (!claimed.recipient || !claimed.text) return claimed.outcome;
  let outcome = "provider_accepted";
  try {
    if (claimed.rendered && send === sendAuthEmail)
      await sendAuthEmail(claimed.recipient, claimed.rendered.subject, claimed.rendered.text, void 0, claimed.rendered);
    else await send(claimed.recipient, claimed.rendered?.subject || "DigiQ Doctors \u2014 Appointment confirmation", claimed.rendered?.text || claimed.text);
  } catch {
    outcome = "unavailable";
  }
  try {
    await conn.transaction(async (tx) => {
      await lockConfirmation(tx, id2);
      await saveOutcome(tx, id2, outcome);
    });
  } catch {
    return "not_attempted";
  }
  return outcome;
}
var init_appointment_confirmation = __esm({
  "src/lib/appointment-confirmation.ts"() {
    "use strict";
    init_db();
    init_store();
    init_auth_email();
    init_integration_config();
    init_display_preferences();
    init_appointments();
    init_notification_template_store();
    init_notification_templates();
  }
});

// src/lib/notification-outbox.ts
var notification_outbox_exports = {};
__export(notification_outbox_exports, {
  enqueueEvent: () => enqueueEvent,
  processNotifications: () => processNotifications,
  reminderDue: () => reminderDue,
  startNotificationWorker: () => startNotificationWorker
});
import { eq as eq12, sql as sql8 } from "drizzle-orm";
import { createHash as createHash2 } from "node:crypto";
async function enqueueEvent(conn, event, row, previousDetails = "") {
  if (!(await getSettings(conn, row.clinicId)).notificationsEnabled) return;
  if (typeof previousDetails === "object") previousDetails = confirmationText(previousDetails, await one(clinics, row.clinicId, conn)).replace("Your appointment is confirmed.", "Previous visit details:");
  const usedEmails = /* @__PURE__ */ new Set();
  if (row.patientId && (await resolvedTemplate(event, row.clinicId, conn, "patient")).content.enabled) {
    const patient = await one(patients, row.patientId, conn);
    const account = patient.userId ? await one(users, patient.userId, conn) : null;
    usedEmails.add(String(account?.email || patient.email || "").toLowerCase());
  }
  for (const group of templateRecipients) {
    if (event === "onboarding" && group !== "clinicAdmin") continue;
    if (event === "booking" && group === "patient") continue;
    const template = await resolvedTemplate(event, row.clinicId, conn, group);
    if (!template.content.enabled) continue;
    const primary = group === defaultRecipient(event);
    let targets = [null];
    if (!primary) {
      if (group === "clinicAdmin") targets = [await one(users, (await one(clinics, row.clinicId, conn)).adminId, conn)];
      if (group === "doctor") targets = row.doctorId ? [await one(users, (await one(doctors, row.doctorId, conn)).userId, conn)] : [];
      if (group === "receptionist") {
        const links2 = await conn.select().from(assignments).where(eq12(assignments.clinicId, row.clinicId));
        targets = [];
        for (const link of links2) if (!link.branchId || link.branchId === row.branchId) {
          const account = await one(users, link.userId, conn);
          if (account.role === "receptionist") targets.push(account);
        }
      }
    }
    for (const target of targets) {
      if (target) {
        const email2 = String(target.email || "").toLowerCase();
        if (target.status !== "active" || !validEmailAddress(email2) || usedEmails.has(email2)) continue;
        usedEmails.add(email2);
      }
      const id2 = `mail-outbox:${event}:${row.id}:${row.revision || 0}`;
      await conn.insert(settings).values({ id: primary ? id2 : `${id2}:recipient:${emailKey(target.email)}`, data: {
        recipientGroup: group,
        recipientUserId: target?.id,
        recipientEmailKey: target ? emailKey(target.email) : void 0,
        event,
        appointmentId: event === "onboarding" ? void 0 : row.id,
        clinicId: row.clinicId,
        previousDetails,
        snapshot: row,
        state: "pending",
        attempts: 0,
        dueAt: Date.now(),
        createdAt: Date.now()
      } }).onConflictDoNothing();
    }
  }
}
function reminderDue(row, now = Date.now()) {
  if (!row.date || !row.startTime || !row.timezone || !["waiting", "booked"].includes(row.status) || row.checkedInAt) return false;
  const local = (instant) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  const target = `${row.date}T${row.startTime}`;
  for (let minute = 59; minute <= 60; minute++) if (local(now + minute * 6e4) === target) return true;
  return false;
}
async function processNotifications(conn = db, send = sendAuthEmail, now = Date.now()) {
  const acquired = await conn.transaction(async (tx) => {
    const lock = await tx.execute(sql8`select pg_try_advisory_xact_lock(hashtext('notification-scheduler')) as acquired`);
    if (!lock.rows[0]?.acquired) return false;
    const from = new Date(now - 864e5).toISOString().slice(0, 10), to = new Date(now + 1728e5).toISOString().slice(0, 10);
    const rows = await tx.select().from(appointments).where(sql8`${appointments.status} in ('waiting','booked') and ${appointments.date} between ${from} and ${to}`);
    for (const raw2 of rows) {
      const row = { ...raw2.data, ...raw2 };
      let due = false;
      try {
        due = reminderDue(row, now);
      } catch {
        console.error("Reminder skipped: invalid session timing");
      }
      if (due) await enqueueEvent(tx, "reminder", row);
    }
    return true;
  });
  if (!acquired) return;
  const candidates = await conn.select().from(settings).where(sql8`${settings.id} like 'mail-outbox:%' and ${settings.data}->>'state' = 'pending' and (${settings.data}->>'dueAt')::bigint <= ${now}`).limit(100);
  for (const record2 of candidates) {
    try {
      const claimed = await conn.transaction(async (tx) => {
        await tx.execute(sql8`select pg_advisory_xact_lock(hashtext(${record2.id}))`);
        const [fresh] = await tx.select().from(settings).where(eq12(settings.id, record2.id));
        const data2 = fresh.data;
        if (data2.state !== "pending" || data2.dueAt > now) return null;
        const update = async (patch) => tx.update(settings).set({ data: { ...data2, ...patch } }).where(eq12(settings.id, record2.id));
        if (!(await getSettings(tx, data2.clinicId)).notificationsEnabled) {
          await update({ state: "disabled" });
          return null;
        }
        const clinic = await one(clinics, data2.clinicId, tx);
        const current = data2.appointmentId ? await one(appointments, data2.appointmentId, tx) : null;
        if (data2.appointmentId && !current) {
          await update({ state: "obsolete" });
          return null;
        }
        if (data2.event === "reminder" && (!current || !reminderDue(current, now) || current.revision !== data2.snapshot.revision)) {
          await update({ state: "obsolete" });
          return null;
        }
        let recipient, patient = null;
        if (current) {
          patient = await one(patients, current.patientId, tx);
          const account = patient.userId ? await one(users, patient.userId, tx) : null;
          recipient = account?.email || patient.email || "";
        } else recipient = (await one(users, clinic.adminId, tx)).email || "";
        if (data2.recipientUserId) {
          const account = await one(users, data2.recipientUserId, tx);
          let member = data2.recipientGroup === "clinicAdmin" && clinic.adminId === account.id;
          if (data2.recipientGroup === "doctor" && current?.doctorId) member = (await one(doctors, current.doctorId, tx)).userId === account.id;
          if (data2.recipientGroup === "receptionist") {
            const links2 = await tx.select().from(assignments).where(eq12(assignments.userId, account.id));
            member = account.role === "receptionist" && links2.some((l) => l.clinicId === data2.clinicId && (!l.branchId || l.branchId === current?.branchId));
          }
          if (!member || account.status !== "active") {
            await update({ state: "obsolete" });
            return null;
          }
          recipient = account.email || "";
          if (data2.recipientEmailKey && emailKey(recipient) !== data2.recipientEmailKey) {
            await update({ state: "obsolete" });
            return null;
          }
        }
        if (!validEmailAddress(recipient)) {
          await update({ state: "no_recipient" });
          return null;
        }
        const template = await resolvedTemplate(data2.event, data2.clinicId, tx, data2.recipientGroup || defaultRecipient(data2.event));
        if (!template.content.enabled) {
          await update({ state: "disabled" });
          return null;
        }
        const row = data2.snapshot;
        const rendered = renderNotification(template.content, {
          clinic_name: clinic.name,
          patient_name: patient?.fullName || "",
          doctor_name: row.doctorName || "",
          appointment_details: current ? confirmationText(row, clinic).replace("Your appointment is confirmed.", "Visit details:") : "",
          previous_details: data2.previousDetails || "",
          reference: row.reference || "",
          timezone: row.timezone || clinic.timezone || "",
          clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" \xB7 ")
        });
        await update({ state: "sending", claimedAt: now, attempts: data2.attempts + 1 });
        return { recipient, rendered, data: data2 };
      });
      if (!claimed) continue;
      let state = "provider_accepted";
      try {
        await send(claimed.recipient, claimed.rendered.subject, claimed.rendered.text, void 0, claimed.rendered);
      } catch (error) {
        state = error?.code === "EMAIL_UNCONFIGURED" ? claimed.data.attempts < 4 ? "pending" : "configuration_failed" : "delivery_unknown";
      }
      await conn.update(settings).set({ data: { ...claimed.data, state, attempts: claimed.data.attempts + 1, dueAt: now + 6e4 * 2 ** claimed.data.attempts, finishedAt: Date.now() } }).where(eq12(settings.id, record2.id));
    } catch {
      console.error("Notification item failed; durable dispatch state retained");
      await conn.transaction(async (tx) => {
        await tx.execute(sql8`select pg_advisory_xact_lock(hashtext(${record2.id}))`);
        const [latest] = await tx.select().from(settings).where(eq12(settings.id, record2.id));
        if (latest?.data.state !== "pending") return;
        const attempts = (latest.data.attempts || 0) + 1;
        await tx.update(settings).set({ data: { ...latest.data, attempts, state: attempts >= 5 ? "preparation_failed" : "pending", dueAt: now + 6e4 * 2 ** attempts } }).where(eq12(settings.id, record2.id));
      });
    }
  }
}
function startNotificationWorker() {
  if (process.env.NODE_ENV !== "production") return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await processNotifications();
    } catch {
      console.error("Notification worker failed; pending work retained");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), 3e4);
  timer.unref();
}
var emailKey;
var init_notification_outbox = __esm({
  "src/lib/notification-outbox.ts"() {
    "use strict";
    init_db();
    init_store();
    init_notification_templates();
    init_notification_template_store();
    init_auth_email();
    init_appointment_confirmation();
    init_integration_config();
    emailKey = (email2) => createHash2("sha256").update(email2.trim().toLowerCase()).digest("hex");
  }
});

// src/lib/appointments.ts
import { sql as sql9 } from "drizzle-orm";
async function lockQueue(conn, doctorId, branchId, date2) {
  await conn.execute(sql9`select pg_advisory_xact_lock(hashtext(${"schedules:" + doctorId}))`);
  await conn.execute(sql9`select pg_advisory_xact_lock(hashtext(${`${doctorId}:${branchId}:${date2}`}))`);
}
function appointmentView(row, user) {
  const allowedActions = Object.entries(transitions).filter(([action, rule]) => !["enqueue", "call", "start"].includes(action) && rule.from.includes(row.status) && (action === "cancel" ? !row.checkedInAt : row.date === localNow(row.timezone || "Asia/Kolkata").date) && (user.role !== "patient" || action === "cancel") && (action !== "requeue" || ["superAdmin", "clinicAdmin", "receptionist"].includes(user.role))).map(([a]) => a);
  const { actorId, requestId, ...view } = row;
  return { ...view, ...user.role === "patient" && row.history ? { history: row.history.map(({ actorId: _actor, ...event }) => event) } : {}, queueRank: rank(row), revision: row.revision || 0, expectedDurationMinutes: row.expectedDurationMinutes ?? null, allowedActions };
}
async function appointmentViewWithBranch(row, user, conn = db) {
  const clinic = await one(clinics, row.clinicId, conn);
  const branch = row.branchAddress == null ? await one(branches, row.branchId, conn) : null;
  return appointmentView({ ...row, ...clinicDisplayPreferences(clinic), branchAddress: row.branchAddress ?? branch?.address ?? null }, user);
}
async function appointmentViews(rows, user, conn = db) {
  if (!rows.length) return [];
  const clinicMap = new Map((await all(clinics, conn)).map((c) => [c.id, c]));
  const branchMap = new Map((rows.some((r) => r.branchAddress == null) ? await all(branches, conn) : []).map((b) => [b.id, b]));
  return rows.map((row) => appointmentView({
    ...row,
    ...clinicDisplayPreferences(clinicMap.get(row.clinicId)),
    branchAddress: row.branchAddress ?? branchMap.get(row.branchId)?.address ?? null
  }, user));
}
async function transition(user, id2, body, conn = db, locked = false) {
  let row = await one(appointments, id2, conn);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  if (!locked) {
    const original = row;
    await lockQueue(conn, row.doctorId, row.branchId, row.date);
    row = await one(appointments, id2, conn);
    assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date && row.startTime === original.startTime, 409, "Appointment was rescheduled; refresh and retry");
  }
  const rule = transitions[body.action];
  assert(rule && rule.from.includes(row.status), 409, "Invalid appointment state transition");
  assert(!body.expectedStatus || row.status === body.expectedStatus, 409, "Appointment changed; refresh and retry");
  assert(body.expectedRevision === void 0 || (row.revision || 0) === body.expectedRevision, 409, "Appointment changed; refresh and retry");
  if (user.role === "patient") assert(body.action === "cancel" && row.patientId === user.patientId, 403, "Patients can only cancel their own booking");
  else roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  if (!["cancel", "complete", "noShow"].includes(body.action)) await doctorContext(row.doctorId, row.branchId, conn);
  const now = localNow(row.timezone || "Asia/Kolkata");
  if (body.action === "cancel") {
    assert(!row.checkedInAt, 409, "Cannot cancel after consultation check-in");
    const config = await getSettings(conn, row.clinicId);
    const difference = (Date.parse(row.date) - Date.parse(now.date)) / 6e4 + minutes(row.startTime || "00:00") - now.minute;
    assert(difference >= config.cancellationCutoffMinutes, 409, "Cancellation cutoff has passed");
  } else assert(row.date === now.date, 409, "Queue actions are allowed only on the appointment date");
  const rows = sessionRows(await all(appointments, conn), row);
  if (["noShow", "requeue"].includes(body.action)) assert(typeof body.reason === "string" && body.reason.trim().length > 0, 400, "A reason is required");
  if (body.action === "requeue") {
    roles(user, ["superAdmin", "clinicAdmin", "receptionist"]);
    assert(body.expectedRevision !== void 0 && body.expectedQueueVersion === queueVersion(rows), 409, "Queue changed; refresh and select the return position again");
    const pending = orderedReservations(rows.filter((a) => pendingStatuses.includes(a.status)));
    assert(Number.isInteger(body.position) && body.position >= 1 && body.position <= pending.length + 1, 400, "Choose a valid return position");
    pending.splice(body.position - 1, 0, row);
    for (const [index2, entry] of pending.entries()) {
      entry.queueRank = index2 + 1;
      if (entry.id !== id2) await change(appointments, entry.id, { data: { ...entry, revision: (entry.revision || 0) + 1 } }, conn);
    }
  }
  if (["call", "start", "checkIn"].includes(body.action)) {
    assert(await isDoctorAvailable(row, conn), 409, "Doctor is on break or away. Future bookings are unchanged.");
    const active = rows.some((a) => a.id !== id2 && ["called", "inConsultation"].includes(a.status));
    assert(!active, 409, "Another patient is already called or in consultation");
    if (row.status !== "called") assert(orderedReservations(rows.filter((a) => pendingStatuses.includes(a.status)))[0]?.id === id2, 409, "Earlier reservation must be served or explicitly skipped first");
  }
  const expectedDurationMinutes = await snapshotDuration(row, conn);
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString(), data2 = { ...row, expectedDurationMinutes: row.expectedDurationMinutes === void 0 ? expectedDurationMinutes : row.expectedDurationMinutes, revision: (row.revision || 0) + 1, ...rule.stamp ? { [rule.stamp]: timestamp2 } : {} };
  if (["start", "checkIn"].includes(body.action)) {
    data2.checkedInAt = timestamp2;
    data2.consultationStartedAt = timestamp2;
    data2.waitMinutes = sessionQueueWaitMinutes(row);
  }
  if (body.action === "complete" && row.consultationStartedAt) data2.consultationMinutesActual = Math.max(0, (Date.now() - Date.parse(row.consultationStartedAt)) / 6e4);
  data2.history = [...row.history || [], { status: rule.to, occurredAt: timestamp2, actorId: user.id, action: body.action, ...body.position ? { position: body.position } : {}, ...body.reason ? { reason: body.reason.trim() } : {} }];
  const updated = await change(appointments, id2, { status: rule.to, data: data2 }, conn);
  await put(appointmentHistory, { id: uid(), appointmentId: id2, actorId: user.id, fromStatus: row.status, toStatus: rule.to }, conn);
  await audit(user, body.action, "appointments", updated, conn);
  if (["cancel", "complete"].includes(body.action)) {
    const { enqueueEvent: enqueueEvent2 } = await Promise.resolve().then(() => (init_notification_outbox(), notification_outbox_exports));
    await enqueueEvent2(conn, body.action === "cancel" ? "cancelled" : "completed", updated);
  }
  if (body.action === "complete") {
    const next = orderedReservations(rows.filter((a) => pendingStatuses.includes(a.status)))[0];
    if (next) {
      const context = await operationalDoctorContext(next.doctorId, next.branchId, conn);
      if (context.active && context.assigned && await isDoctorAvailable(next, conn)) await transition(user, next.id, { action: "call", expectedStatus: next.status }, conn, true);
    }
  }
  return appointmentView(updated, user);
}
var transitions;
var init_appointments = __esm({
  "src/lib/appointments.ts"() {
    "use strict";
    init_db();
    init_store();
    init_http();
    init_auth();
    init_availability();
    init_queue_order();
    init_presence();
    init_session_duration();
    init_display_preferences();
    transitions = {
      checkIn: { from: ["booked", "checkedIn", "waiting", "called"], to: "inConsultation", stamp: "checkedInAt" },
      enqueue: { from: ["booked", "checkedIn"], to: "waiting", stamp: "waitingAt" },
      call: { from: ["booked", "checkedIn", "waiting"], to: "called", stamp: "calledAt" },
      start: { from: ["called"], to: "inConsultation", stamp: "consultationStartedAt" },
      complete: { from: ["inConsultation"], to: "completed", stamp: "completedAt" },
      noShow: { from: ["booked", "checkedIn", "waiting", "called"], to: "noShow" },
      requeue: { from: ["noShow"], to: "waiting", stamp: "waitingAt" },
      cancel: { from: ["booked", "checkedIn", "waiting", "called"], to: "cancelled", stamp: "cancelledAt" }
    };
  }
});

// <stdin>
init_appointments();

// src/lib/reschedule.ts
init_db();
init_store();
init_auth();
init_http();
init_availability();
init_appointments();
init_session_duration();
init_queue_order();

// src/lib/entities.ts
init_db();
init_store();
init_clinical_membership();
import { eq as eq13 } from "drizzle-orm";
async function enrich(kind, row, conn = db) {
  row = { ...row };
  if (kind === "doctors" || kind === "users") {
    if (kind === "users") row.mobile ||= "";
    const activeClinics = new Set((await all(clinics, conn)).filter((c) => c.status === "active").map((c) => c.id));
    const activeBranches = new Set((await all(branches, conn)).filter((b) => b.status === "active" && activeClinics.has(b.clinicId)).map((b) => b.id));
    const links2 = (await all(assignments, conn)).filter((a) => a.userId === (kind === "doctors" ? row.userId : row.id) && activeClinics.has(a.clinicId) && (!a.branchId || activeBranches.has(a.branchId)));
    if (kind === "doctors") Object.assign(row, await managedDoctorAssignments(row, conn));
    else {
      row.clinicIds = [...new Set(links2.map((a) => a.clinicId))];
      row.branchIds = [...new Set(links2.filter((a) => a.branchId).map((a) => a.branchId))];
    }
  }
  if (kind === "doctors") {
    const account = await one(users, row.userId, conn);
    row.fullName = account.fullName;
    row.email = account.email;
    row.mobile = account.mobile || "";
    for (const key3 of ["address", "country", "state", "city", "pincode"]) if ((row[key3] === void 0 || row[key3] === null || row[key3] === "") && account[key3]) row[key3] = account[key3];
    row.createdAt ||= account.createdAt || null;
    row.managingAdminId = row.ownerAdminId;
    row.managingAdminName = (await one(users, row.ownerAdminId, conn)).fullName;
    const [credential] = await conn.select({ passwordHash: users.passwordHash }).from(users).where(eq13(users.id, account.id));
    row.invitationStatus = credential?.passwordHash ? "notRequired" : account.invitationStatus;
    if (account.status !== "active") row.status = "inactive";
    if (row.specializationId) row.specializationName = (await one(masters, row.specializationId, conn)).name;
    row.qualificationNames = (await all(masters, conn)).filter((m) => row.qualificationIds?.includes(m.id)).map((m) => m.name);
  }
  if (kind === "users") {
    const managerId = row.role === "receptionist" ? row.managingAdminId : null;
    row.managingAdminId = managerId || null;
    row.managingAdminName = managerId ? (await one(users, managerId, conn)).fullName : null;
    const [credential] = await conn.select({ passwordHash: users.passwordHash }).from(users).where(eq13(users.id, row.id));
    row.invitationStatus = credential?.passwordHash ? "notRequired" : row.invitationStatus;
    row.createdAt ||= null;
  }
  if (kind === "clinics") row.adminName = (await one(users, row.adminId, conn)).fullName;
  if (kind === "branches") {
    const clinic = await one(clinics, row.clinicId, conn);
    row.clinicName = clinic.name;
    row.createdAt ||= null;
    row.inheritEmail ??= !row.email;
    row.inheritPhone ??= !row.phone;
    row.effectiveEmail = row.inheritEmail ? clinic.email || null : row.email || null;
    row.effectivePhone = row.inheritPhone ? clinic.phone || null : row.phone || null;
  }
  if (kind === "qrs") row.reference = row.publicReference;
  return row;
}
function publicDoctor(row) {
  return Object.fromEntries(["id", "fullName", "photoUrl", "specializationName", "qualificationNames", "about", "experienceYears", "consultationFee", "clinicIds", "branchIds"].map((k) => [k, row[k]]));
}

// src/lib/reschedule.ts
async function reschedule(user, id2, body, tx) {
  let row = await one(appointments, id2, tx);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  if (user.role !== "patient") roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const original = row;
  const locks = [row, body].sort((a, b) => `${a.doctorId}:${a.branchId}:${a.date}`.localeCompare(`${b.doctorId}:${b.branchId}:${b.date}`));
  for (const session of locks) await lockQueue(tx, session.doctorId, session.branchId, session.date);
  row = await one(appointments, id2, tx);
  assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date && (row.revision || 0) === body.expectedRevision, 409, "Appointment changed; refresh and retry");
  assert(["booked", "checkedIn", "waiting", "called"].includes(row.status) && !row.checkedInAt, 409, "Only appointments before check-in can be rescheduled");
  const config = await getSettings(tx, row.clinicId), now = localNow(row.timezone || "Asia/Kolkata");
  const difference = (Date.parse(row.date) - Date.parse(now.date)) / 6e4 + minutes(row.startTime || "00:00") - now.minute;
  assert(difference >= config.cancellationCutoffMinutes, 409, "Cancellation cutoff has passed");
  const branch = await one(branches, body.branchId, tx);
  assert(branch.clinicId === row.clinicId, 403, "Rescheduling must stay within the same clinic");
  if (user.role !== "patient") assert(scope(user, row.clinicId, branch.id) && (user.role !== "doctor" || body.doctorId === user.doctorId), 403, "Destination outside assigned scope");
  const available = await availability(body.doctorId, body.branchId, body.date, tx, body);
  body = { ...body, sessionId: available.sessionId, startTime: available.startTime };
  assert(row.doctorId !== body.doctorId || row.branchId !== body.branchId || row.date !== body.date || row.startTime !== body.startTime, 400, "Choose a different destination session");
  assert(available.available, 409, available.reason || "Destination unavailable");
  assert(available.queueMode !== "walkInsOnly", 409, "Destination accepts walk-ins only");
  const destination = { ...body, clinicId: row.clinicId };
  const rows = sessionRows(await all(appointments, tx), destination);
  assert(!rows.some((a) => a.patientId === row.patientId && !["cancelled", "completed", "noShow"].includes(a.status)), 409, "Patient already has an active booking for the destination");
  await snapshotDuration(row, tx);
  await allocateToken(row, tx, false);
  const duration = await snapshotDuration(destination, tx), tokenNumber = await allocateToken(destination, tx);
  const doctor = await enrich("doctors", await one(doctors, body.doctorId, tx), tx);
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  const data2 = {
    ...row,
    doctorId: body.doctorId,
    branchId: body.branchId,
    date: body.date,
    sessionId: body.sessionId,
    token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`,
    tokenNumber,
    doctorName: doctor.fullName,
    branchName: branch.name,
    branchAddress: branch.address ?? null,
    timezone: available.timezone,
    startTime: available.startTime,
    endTime: available.endTime,
    expectedDurationMinutes: duration,
    queueRank: Math.max(0, ...rows.map(rank)) + 1,
    revision: (row.revision || 0) + 1,
    waitingAt: timestamp2,
    calledAt: null,
    history: [...row.history || [], {
      status: "waiting",
      action: "reschedule",
      occurredAt: timestamp2,
      actorId: user.id,
      reason: body.reason,
      from: { doctorId: row.doctorId, branchId: row.branchId, date: row.date, sessionId: row.sessionId, startTime: row.startTime, token: row.token, tokenNumber: row.tokenNumber },
      to: { doctorId: body.doctorId, branchId: body.branchId, date: body.date, sessionId: body.sessionId, startTime: body.startTime, token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`, tokenNumber }
    }]
  };
  const updated = await change(appointments, id2, { status: "waiting", doctorId: body.doctorId, branchId: body.branchId, date: body.date, tokenNumber, data: data2 }, tx);
  await put(appointmentHistory, { id: uid(), appointmentId: id2, actorId: user.id, fromStatus: row.status, toStatus: "waiting" }, tx);
  await audit(user, "reschedule", "appointments", updated, tx);
  const { enqueueEvent: enqueueEvent2 } = await Promise.resolve().then(() => (init_notification_outbox(), notification_outbox_exports));
  await enqueueEvent2(tx, "rescheduled", updated, row);
  return appointmentView(updated, user);
}

// <stdin>
init_queue_order();
init_store();

// src/lib/clinic-expansion.ts
init_db();
init_store();
init_http();
import { sql as sql11 } from "drizzle-orm";
init_availability();
init_availability();

// src/lib/linked-schedules.ts
init_db();
init_store();
init_http();
init_availability();
import { sql as sql10 } from "drizzle-orm";
async function lockLinkedDoctors(clinic, branchInputs, existingBranches, conn) {
  const owner = (await all(doctors, conn)).find((d) => d.userId === clinic.adminId);
  const ids = /* @__PURE__ */ new Set();
  for (const input of branchInputs) {
    const prior = existingBranches.find((b) => b.id === input.id);
    if (prior?.linkedSchedule?.enabled || input.linkedSchedule?.enabled) {
      if (owner) ids.add(owner.id);
      if (prior?.linkedSchedule?.doctorId) ids.add(prior.linkedSchedule.doctorId);
    }
  }
  for (const id2 of [...ids].sort()) {
    await conn.execute(sql10`select pg_advisory_xact_lock(hashtext(${"schedules:" + id2}))`);
    await conn.execute(sql10`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + id2}))`);
  }
}
async function planLinkedSchedules(clinic, branch, prior, conn) {
  const link = branch.linkedSchedule;
  const rows = (await all(schedules, conn)).filter((s) => s.branchId === branch.id && s.status === "active");
  const linked = rows.filter((s) => s.linkedBranchId === branch.id);
  const impact = { branchId: branch.id, create: 0, update: 0, retire: 0, unlink: !!prior?.linkedSchedule?.enabled && !link?.enabled };
  const conflicts = [];
  const writes = [];
  if (!link?.enabled) {
    for (const old of linked) writes.push({ old, unlink: true });
    return { impact, conflicts, writes, link };
  }
  const doctor = (await all(doctors, conn)).find((d) => d.userId === clinic.adminId);
  assert(doctor && doctor.status === "active" && doctor.ownerAdminId === clinic.adminId && doctor.branchIds?.includes(branch.id), 409, "Attach the active owner's doctor profile to this location before linking hours.");
  assert(!link.doctorId || link.doctorId === doctor.id, 403, "Linked hours are restricted to the clinic owner's doctor profile.");
  assert(Array.isArray(branch.openingHours), 400, "Choose explicit location opening hours before linking sessions.");
  assert(Number.isInteger(link.maxTokens) && link.maxTokens >= 1 && link.maxTokens <= 1e3, 400, "Choose capacity between 1 and 1000.");
  assert(Number.isInteger(link.consultationMinutes) && link.consultationMinutes >= 1 && link.consultationMinutes <= 240, 400, "Choose consultation duration between 1 and 240 minutes.");
  assert(/^[A-Za-z0-9]{1,8}$/.test(link.tokenPrefix || "") && ["mixed", "appointmentsOnly", "walkInsOnly"].includes(link.queueMode), 400, "Choose an explicit ticket prefix and booking policy.");
  const allSessions = (await all(schedules, conn)).filter((s) => s.doctorId === doctor.id && s.status === "active");
  const locations = await all(branches, conn);
  const taken = /* @__PURE__ */ new Set();
  for (const hour of branch.openingHours) {
    const next = { ...hour, doctorId: doctor.id, clinicId: clinic.id, branchId: branch.id, timezone: branch.timezone || "Asia/Kolkata", isOpen: true, maxTokens: link.maxTokens, consultationMinutes: link.consultationMinutes, tokenPrefix: link.tokenPrefix.toUpperCase(), queueMode: link.queueMode, bufferMinutes: 0, linkedBranchId: branch.id };
    validateTimes(next);
    const old = linked.find((s) => s.doctorId === doctor.id && s.dayOfWeek === hour.dayOfWeek && s.startTime === hour.startTime && s.endTime === hour.endTime);
    if (old) taken.add(old.id);
    for (const other of allSessions.filter((s) => !linked.some((l) => l.id === s.id))) {
      const timezone = other.timezone || locations.find((b) => b.id === other.branchId)?.timezone || "Asia/Kolkata";
      if (weeklySessionsOverlap(next, { ...other, timezone })) conflicts.push(`Session ${other.id} overlaps ${hour.startTime}\u2013${hour.endTime} on weekday ${hour.dayOfWeek}. Edit custom sessions before linking.`);
    }
    const changed = old && Object.keys(next).some((k) => k === "timezone" ? !sameTimezone(next.timezone, old.timezone) : next[k] !== old[k]);
    if (!old) {
      impact.create++;
      writes.push({ next });
    } else if (changed) {
      impact.update++;
      writes.push({ old, next });
    }
  }
  for (const old of linked.filter((s) => !taken.has(s.id))) {
    impact.retire++;
    writes.push({ old, retire: true });
  }
  const bookings = await all(appointments, conn), exceptions = await all(availabilityExceptions, conn);
  if (impact.create && exceptions.some((e) => e.status === "active" && e.doctorId === doctor.id)) {
    conflicts.push("This doctor has active date exceptions. Review and deactivate or resolve exceptions before adding linked sessions, so a date override cannot introduce overlapping consultations.");
  }
  for (const write of writes.filter((w) => w.old && !w.unlink)) {
    const s = write.old;
    const booked = bookings.some((a) => a.doctorId === s.doctorId && a.branchId === s.branchId && (a.sessionId === s.id || a.startTime === s.startTime && (/* @__PURE__ */ new Date(a.date + "T12:00:00Z")).getUTCDay() === s.dayOfWeek));
    const exception = exceptions.some((e) => e.status === "active" && e.doctorId === s.doctorId && e.branchId === s.branchId && (!e.sessionId || e.sessionId === s.id));
    if (booked || exception) conflicts.push(`Session ${s.id} (${s.startTime}\u2013${s.endTime}, weekday ${s.dayOfWeek}) has ${booked ? "booking history" : "date exceptions"}. Unlink to retain its records and review a custom schedule; no patients were moved.`);
  }
  return { impact, conflicts, writes, link: { ...link, doctorId: doctor.id } };
}
async function applyLinkedPlan(actor, plan, conn) {
  assert(!plan.conflicts.length, 409, plan.conflicts.join(" "));
  for (const write of plan.writes) {
    const row = write.old ? await change(schedules, write.old.id, write.retire ? { status: "inactive" } : { data: { ...write.old, ...write.next, ...write.unlink ? { linkedBranchId: null } : {} } }, conn) : await put(schedules, { id: uid(), doctorId: write.next.doctorId, branchId: write.next.branchId, clinicId: write.next.clinicId, dayOfWeek: write.next.dayOfWeek, data: write.next }, conn);
    await audit(actor, write.unlink ? "unlinkHours" : write.retire ? "retireLinkedSession" : "syncLinkedSession", "schedules", row, conn);
  }
}

// src/lib/clinic-expansion.ts
var reserved = /* @__PURE__ */ new Set(["api", "admin", "auth", "login", "logout", "register", "signup", "sign-in", "sign-up", "onboarding", "dashboard", "clinics", "branches", "doctors", "patients", "appointments", "queue", "settings", "reports", "users", "masters", "schedules", "availability", "booking", "book", "display", "qr", "public", "guest", "invite", "invitations", "forgot-password", "reset-password", "account", "me", "assets", "favicon", "__mockup", "clinicflow-project-deck"]);
var CONSULTING_ADMIN_ENABLED = true;
for (const path of ["register-clinic", "register-doctor", "patient-login", "scan-qr", "guest-booking", "set-password", "check-in", "doctor", "patient", "receptionist", "audit", "qrs", "exceptions"]) reserved.add(path);
function validSlug(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(value) && !reserved.has(value);
}
async function validateSlugWrite(kind, body, old, conn) {
  if (!["clinics", "branches"].includes(kind) || body.slug === void 0) return;
  assert(validSlug(body.slug), 400, "Use a non-reserved lowercase URL slug of 3\u201363 letters, digits or hyphens");
  assert(!old?.slug || old.slug === body.slug, 409, "Public URL is locked after creation. You may change the display name without changing this link.");
  const clinicId = body.clinicId || old?.clinicId;
  await conn.execute(sql11`select pg_advisory_xact_lock(hashtext(${"slug:" + kind + ":" + (clinicId || "") + ":" + body.slug}))`);
  const rows = (await conn.execute(kind === "clinics" ? sql11`select id from clinics where data->>'slug'=${body.slug} and id<>${old?.id || ""} limit 1` : sql11`select id from branches where clinic_id=${clinicId} and data->>'slug'=${body.slug} and id<>${old?.id || ""} limit 1`)).rows;
  assert(!rows.length, 409, "This public URL is already in use");
}
function validateOpeningHours(hours) {
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
function withinBranchHours(branch, session) {
  if (!session.isOpen || session.isClosed || !Array.isArray(branch.openingHours)) return null;
  assert(branchDayStatus(branch, session) !== "closed", 409, "The location is set to closed on all days. Add opening hours before adding doctor sessions.");
  assert(!session.timezone || sameTimezone(session.timezone, branch.timezone || "Asia/Kolkata"), 400, "Sessions with configured branch hours must use the branch timezone");
  return outsideBranchHours(branch, session);
}
async function provisionBranchQr(branch, old, conn) {
  if (!branch.slug || old?.slug) return;
  await conn.execute(sql11`select pg_advisory_xact_lock(hashtext(${"branch-qr:" + branch.id}))`);
  const existing = (await all(qrs, conn)).find((q) => q.branchId === branch.id && !q.doctorId);
  if (!existing) {
    const reference = uid();
    await put(qrs, { id: uid(), clinicId: branch.clinicId, branchId: branch.id, publicReference: reference, data: { name: branch.name + " booking", bookingUrl: `/book/${reference}` } }, conn);
  }
}
async function validateClinicMetadata(body, conn) {
  assert(body.dateFormat === void 0 || ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].includes(body.dateFormat), 400, "Select a supported date format");
  assert(body.timeFormat === void 0 || ["12h", "24h"].includes(body.timeFormat), 400, "Select a supported time format");
  if (body.categoryId) {
    const row = await one(masters, body.categoryId, conn);
    assert(row.category === "clinicCategory" && row.status === "active", 400, "Invalid clinic category");
  }
  for (const id2 of body.specialityIds || []) {
    const row = await one(masters, id2, conn);
    assert(row.category === "specialization" && row.status === "active", 400, "Invalid clinic speciality");
  }
}
async function clinicSettingsResult(clinicId, conn = db) {
  const clinic = await one(clinics, clinicId, conn), platform = await getSettings(conn);
  const formats = clinicDisplayPreferences2(clinic);
  return {
    clinic: { ...await enrich("clinics", clinic, conn), ...formats },
    branches: await Promise.all((await all(branches, conn)).filter((b) => b.clinicId === clinicId).map(async (b) => ({ ...await enrich("branches", b, conn), ...formats }))),
    policies: { bookingHorizonDays: clinic.policies?.bookingHorizonDays ?? platform.bookingHorizonDays, cancellationCutoffMinutes: clinic.policies?.cancellationCutoffMinutes ?? platform.cancellationCutoffMinutes }
  };
}
function clinicDisplayPreferences2(clinic) {
  return { dateFormat: clinic?.dateFormat ?? "DD MMM YYYY", timeFormat: clinic?.timeFormat ?? "12h" };
}
async function saveClinicSetup(actor, clinicId, body, conn) {
  await conn.execute(sql11`select pg_advisory_xact_lock(hashtext(${"clinics:" + clinicId}))`);
  const old = await one(clinics, clinicId, conn);
  assert(actor.role === "superAdmin" || actor.role === "clinicAdmin" && old.adminId === actor.id, 403, "Clinic settings are outside your ownership");
  await lockLinkedDoctors(old, body.branches || [], await all(branches, conn), conn);
  const detail = body.clinic || {};
  await validateClinicMetadata(detail, conn);
  await validateSlugWrite("clinics", detail, old, conn);
  const clinic = await change(clinics, clinicId, { data: { ...clinicDisplayPreferences2(old), ...old, ...detail, policies: { ...old.policies, ...body.policies } } }, conn);
  for (const input of body.branches || []) {
    const prior = input.id ? await one(branches, input.id, conn) : null;
    assert(!prior || prior.clinicId === clinicId, 403, "Branch belongs to another clinic");
    const next = { ...prior, ...input, clinicId, id: prior?.id || uid() };
    await conn.execute(sql11`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + next.id}))`);
    if (next.timezone) localNow(next.timezone);
    if (next.openingHours) validateOpeningHours(next.openingHours);
    await validateSlugWrite("branches", next, prior, conn);
    const plan = await planLinkedSchedules(clinic, next, prior, conn);
    await applyLinkedPlan(actor, plan, conn);
    if (next.openingHours?.length) for (const s of (await all(schedules, conn)).filter((s2) => s2.branchId === next.id && s2.status === "active")) withinBranchHours(next, s);
    if (plan.link) next.linkedSchedule = plan.link;
    const data2 = { ...next, timezone: next.timezone || "Asia/Kolkata", code: next.code || `BR-${next.id.slice(0, 8)}`, inheritEmail: next.inheritEmail ?? (prior ? !prior.email : true), inheritPhone: next.inheritPhone ?? (prior ? !prior.phone : true) };
    const branch = prior ? await change(branches, next.id, { data: data2 }, conn) : await put(branches, { id: next.id, clinicId, data: data2 }, conn);
    await provisionBranchQr(branch, prior, conn);
    await audit(actor, prior ? "update" : "create", "branches", branch, conn);
  }
  await audit(actor, "updateSettings", "clinics", clinic, conn);
  return clinicSettingsResult(clinicId, conn);
}
async function attachOwnDoctor(actor, body, conn) {
  assert(actor.role === "clinicAdmin", 403, "Only the owning Clinic Admin can attach their clinical profile");
  await conn.execute(sql11`select pg_advisory_xact_lock(hashtext(${"own-doctor:" + actor.id}))`);
  const account = await one(users, actor.id, conn);
  assert(account.role === "clinicAdmin" && account.status === "active", 403, "Only an active Clinic Admin can consult");
  assert(Array.isArray(body.branchIds) && body.branchIds.length <= 30 && body.branchIds.every((id3) => typeof id3 === "string"), 400, "Select valid consultation branches");
  const selected = [];
  for (const branchId of [...new Set(body.branchIds)]) {
    const branch = await one(branches, branchId, conn), clinic = await one(clinics, branch.clinicId, conn);
    assert(branch.status === "active" && clinic.status === "active" && clinic.adminId === actor.id, 403, "Choose active branches in your own clinic");
    assert((await all(assignments, conn)).some((a) => a.userId === actor.id && a.clinicId === clinic.id && !a.branchId), 403, "Clinic ownership assignment is required");
    selected.push(branch);
  }
  assert(selected.length, 400, "Select at least one branch for consultations");
  if (body.specializationId) {
    const s = await one(masters, body.specializationId, conn);
    assert(s.category === "specialization" && s.status === "active", 400, "Invalid specialization");
  }
  for (const id3 of body.qualificationIds || []) {
    const q = await one(masters, id3, conn);
    assert(q.category === "qualification" && q.status === "active", 400, "Invalid qualification");
  }
  const prior = (await all(doctors, conn)).find((d) => d.userId === actor.id);
  assert(!prior || prior.ownerAdminId === actor.id, 409, "Doctor ownership requires an explicit transfer");
  if (prior) await conn.execute(sql11`select pg_advisory_xact_lock(hashtext(${"schedules:" + prior.id}))`);
  if (prior) for (const branch of await all(branches, conn)) {
    assert(!branch.linkedSchedule?.enabled || branch.linkedSchedule.doctorId !== prior.id || selected.some((b) => b.id === branch.id), 409, "Unlink clinic hours before removing this doctor's linked consultation location.");
  }
  const id2 = prior?.id || uid();
  const fields = { data: { ...prior, ...body, branchIds: selected.map((b) => b.id), code: prior?.code || `DOC-${id2.slice(0, 8)}` }, ...body.specializationId ? { specializationId: body.specializationId } : {} };
  const doctor = prior ? await change(doctors, prior.id, fields, conn) : await put(doctors, { id: id2, userId: actor.id, ownerAdminId: actor.id, ...fields }, conn);
  await audit(actor, "attachOwnDoctorProfile", "doctors", doctor, conn);
  return enrich("doctors", doctor, conn);
}
async function createOwnedClinic(actor, admin, input, conn) {
  assert(!input.ownerSchedule || input.ownDoctor, 400, "Linked owner sessions require the consulting owner profile.");
  assert(!input.ownerCustomSchedule || input.ownDoctor, 400, "Custom owner sessions require the consulting owner profile.");
  assert(!(input.ownerSchedule && input.ownerCustomSchedule), 400, "Choose either linked location hours or custom weekly sessions, not both.");
  assert(input.clinic?.name?.trim() && typeof input.clinic.address === "string", 400, "Clinic name and address are required");
  await validateClinicMetadata(input.clinic, conn);
  await validateSlugWrite("clinics", input.clinic, null, conn);
  const id2 = uid();
  const clinic = await put(clinics, { id: id2, ownerId: actor.id, adminId: admin.id, data: { ...clinicDisplayPreferences2(input.clinic), ...input.clinic, code: input.clinic.code || `CLN-${id2.slice(0, 8)}`, timezone: input.clinic.timezone || "Asia/Kolkata" } }, conn);
  await conn.insert(assignments).values({ id: uid(), userId: admin.id, clinicId: id2 }).onConflictDoNothing();
  await audit(actor, "create", "clinics", clinic, conn);
  const { enqueueEvent: enqueueEvent2 } = await Promise.resolve().then(() => (init_notification_outbox(), notification_outbox_exports));
  await enqueueEvent2(conn, "onboarding", { ...clinic, clinicId: clinic.id });
  const result = await saveClinicSetup({ ...admin, role: "clinicAdmin" }, id2, { branches: input.branches || [], policies: input.policies }, conn);
  const priorDoctor = input.ownDoctor ? (await all(doctors, conn)).find((d) => d.userId === admin.id) : null;
  const doctor = input.ownDoctor ? await attachOwnDoctor(admin, { branchIds: [.../* @__PURE__ */ new Set([...priorDoctor?.branchIds || [], ...result.branches.map((b) => b.id)])], specializationId: input.specializationId, qualificationIds: input.qualificationIds }, conn) : null;
  const linkedResult = input.ownerSchedule && doctor ? await saveClinicSetup({ ...admin, role: "clinicAdmin" }, id2, {
    branches: result.branches.map((b) => ({ id: b.id, linkedSchedule: { ...input.ownerSchedule, enabled: true, doctorId: doctor.id } }))
  }, conn) : result;
  if (input.ownerCustomSchedule && doctor) await createOwnerCustomSessions(admin, doctor.id, result.branches, input.ownerCustomSchedule, conn);
  return { ...linkedResult, doctorId: doctor?.id || null };
}
async function previewClinicSetup(actor, clinicId, body, conn = db) {
  const clinic = await one(clinics, clinicId, conn);
  assert(actor.role === "superAdmin" || actor.role === "clinicAdmin" && clinic.adminId === actor.id, 403, "Clinic settings are outside your ownership");
  const impacts = [], conflicts = [];
  for (const input of body.branches || []) {
    const prior = input.id ? await one(branches, input.id, conn) : null;
    assert(!prior || prior.clinicId === clinicId, 403, "Branch belongs to another clinic");
    const next = { ...prior, ...input, id: prior?.id || "new-location", clinicId };
    try {
      if (Array.isArray(next.openingHours)) validateOpeningHours(next.openingHours);
      const plan = await planLinkedSchedules(clinic, next, prior, conn);
      impacts.push(plan.impact);
      conflicts.push(...plan.conflicts);
      const retired = new Set(plan.writes.filter((w) => w.retire).map((w) => w.old.id));
      if (next.openingHours?.length) for (const session of (await all(schedules, conn)).filter((s) => s.branchId === next.id && s.status === "active" && !retired.has(s.id))) {
        const update = plan.writes.find((w) => w.old?.id === session.id && w.next);
        withinBranchHours(next, update ? { ...session, ...update.next } : session);
      }
    } catch (error) {
      if (error.status === 403) throw error;
      conflicts.push(error.message || "Unable to preview linked sessions.");
    }
  }
  return { allowed: !conflicts.length, impacts, conflicts };
}
async function createOwnerCustomSessions(actor, doctorId, created2, custom, conn) {
  const placed = [];
  for (const input of custom.sessions || []) {
    const branch = created2[input.branchIndex];
    assert(branch, 400, "Each custom session must belong to one of the new locations");
    const session = {
      doctorId,
      clinicId: branch.clinicId,
      branchId: branch.id,
      dayOfWeek: input.dayOfWeek,
      isOpen: true,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: branch.timezone || "Asia/Kolkata",
      tokenPrefix: custom.tokenPrefix,
      maxTokens: custom.maxTokens,
      consultationMinutes: custom.consultationMinutes,
      bufferMinutes: 0,
      queueMode: custom.queueMode
    };
    validateTimes(session);
    withinBranchHours(branch, session);
    assert(!placed.some((p) => p.branchId === session.branchId && weeklySessionsOverlap(p, session)), 409, "Custom sessions on the same day and location cannot overlap");
    placed.push(session);
  }
  for (const session of placed) {
    const saved = await put(schedules, { id: uid(), clinicId: session.clinicId, branchId: session.branchId, doctorId, dayOfWeek: session.dayOfWeek, data: session }, conn);
    await audit(actor, "create", "schedules", saved, conn);
  }
  return placed.length;
}

// <stdin>
init_availability();

// src/lib/schedule-snapshot.ts
init_http();
var SCHEDULE_SNAPSHOT_KEYS = ["doctorId", "clinicId", "branchId", "dayOfWeek", "isOpen", "startTime", "endTime", "breakStart", "breakEnd", "timezone", "tokenPrefix", "maxTokens", "consultationMinutes", "bufferMinutes", "queueMode", "queueOpenTime", "queueCloseTime", "status", "linkedBranchId", "linkedIntervalKey"].sort();
function scheduleSnapshot(row) {
  return JSON.stringify(Object.fromEntries(SCHEDULE_SNAPSHOT_KEYS.map((k) => [k, row[k] ?? null])));
}
function assertScheduleSnapshot(row, expected) {
  if (expected === void 0) return;
  assert(typeof expected === "string" && expected.length <= 2e4, 400, "Invalid schedule snapshot. Reload the schedule before retrying.");
  assert(scheduleSnapshot(row) === expected, 409, "This session was changed by another administrator. Reload the schedule and review your draft before retrying.");
}

// <stdin>
init_clinical_membership();

// src/lib/list-query.ts
init_db();
init_http();
init_queue_order();
init_clinical_membership();
init_patient_registration_scope();
import { sql as sql12 } from "drizzle-orm";
var names = { users: "users", doctors: "doctors", clinics: "clinics", branches: "branches", patients: "patients", masters: "masters", schedules: "schedules", "availability-exceptions": "availability_exceptions", qrs: "qrs", appointments: "appointments", "audit-logs": "audit_logs" };
var raw = sql12.raw;
var inList = (value, ids) => ids?.length ? sql12`${value} in (${sql12.join(ids.map((id2) => sql12`${id2}`), raw(","))})` : raw("false");
function operationalScope(user, clinic, branch) {
  if (user.role === "superAdmin") return raw("true");
  return sql12`(${inList(clinic, user.clinicIds)} and (${branch} is null or ${!["doctor", "receptionist"].includes(user.role)} or ${inList(branch, user.branchIds)}))`;
}
function links(kind) {
  if (kind === "doctors") return managedDoctorLinks(raw("r.id"));
  return raw(`select a.*, c.data->>'name' as clinic_name, b.data->>'name' as branch_name from assignments a join clinics c on c.id=a.clinic_id left join branches b on b.id=a.branch_id where a.user_id=r.${kind === "doctors" ? "user_id" : "id"} and c.status='active' and (a.branch_id is null or b.status='active')`);
}
function readScope(user, kind) {
  if (user.role === "superAdmin" || kind === "masters") return raw("true");
  if (kind === "users" || kind === "doctors") {
    const assigned = sql12`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.clinic_id"), user.clinicIds)})`;
    const branch2 = !["doctor", "receptionist"].includes(user.role) ? raw("true") : sql12`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.branch_id"), user.branchIds)})`;
    if (kind === "doctors") return sql12`(r.id=${user.doctorId || ""} or (${["clinicAdmin", "doctor", "receptionist"].includes(user.role)} and ${assigned} and ${branch2}))`;
    return sql12`(r.id=${user.id} or (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}) or (not (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)}) and r.role<>'superAdmin' and ${assigned} and ${branch2}))`;
  }
  if (kind === "patients") {
    if (user.role === "patient") return sql12`r.id=${user.patientId || ""}`;
    const registered = operationalScope(user, raw("r.clinic_id"), raw("r.branch_id"));
    const ownClinic = user.role === "doctor" ? sql12`(${registered} and ${doctorRegistrationSql(user, raw("r.clinic_id"), raw("r.branch_id"))})` : registered;
    return sql12`(${ownClinic} or exists(select 1 from appointments ap where ap.patient_id=r.id and ${operationalScope(user, raw("ap.clinic_id"), raw("ap.branch_id"))} ${user.role === "doctor" ? sql12`and ap.doctor_id=${user.doctorId || ""}` : raw("")}))`;
  }
  if (kind === "clinics") return operationalScope(user, raw("r.id"), raw("null"));
  if (user.role === "patient") return kind === "appointments" ? sql12`r.patient_id=${user.patientId || ""}` : raw("false");
  const clinic = kind === "availability-exceptions" ? raw("(select clinic_id from branches where id=r.branch_id)") : raw("r.clinic_id");
  const branch = kind === "branches" ? raw("r.id") : raw("r.branch_id");
  let result = operationalScope(user, clinic, branch);
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) result = sql12`${result} and r.doctor_id=${user.doctorId || ""}`;
  if (["schedules", "availability-exceptions"].includes(kind)) result = sql12`${result} and ${clinicalMembership(raw("r.doctor_id"), raw("r.branch_id"))}`;
  return result;
}
function documentSql(kind, assignmentDocument) {
  let doc = raw(`coalesce(to_jsonb(r)->'data','{}'::jsonb) || (select jsonb_object_agg((select string_agg(case when n=1 then word else initcap(word) end,'' order by n) from unnest(string_to_array(k,'_')) with ordinality t(word,n)),v) from jsonb_each(to_jsonb(r)-'data'-'password_hash'-'token_hash') e(k,v))`);
  if (kind === "users") doc = sql12`(${doc}) - 'passwordHash' - 'password_hash' - 'tokenHash' - 'token_hash' - 'clerkId'`;
  if (["users", "doctors"].includes(kind)) doc = sql12`${doc} || ${assignmentDocument || sql12`jsonb_build_object('clinicIds',coalesce((select jsonb_agg(distinct l.clinic_id) from (${links(kind)}) l),'[]'::jsonb),'branchIds',coalesce((select jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null) from (${links(kind)}) l),'[]'::jsonb))`}`;
  if (kind === "doctors") doc = sql12`${doc} || (select jsonb_build_object('fullName',u.full_name,'email',u.email,'mobile',coalesce(u.mobile,''),'passwordEnabled',u.password_hash is not null,'managingAdminId',r.owner_admin_id,'managingAdminName',(select full_name from users where id=r.owner_admin_id),'invitationStatus',case when u.password_hash is not null then 'notRequired' else u.invitation_status end,'status',case when u.status<>'active' then 'inactive' else r.status end) from users u where u.id=r.user_id) || jsonb_build_object('specializationName',(select data->>'name' from masters where id=r.specialization_id),'qualificationNames',coalesce((select jsonb_agg(data->>'name') from masters where id in (select jsonb_array_elements_text(coalesce(r.data->'qualificationIds','[]'::jsonb)))),'[]'::jsonb))`;
  if (kind === "users") doc = sql12`${doc} || jsonb_build_object('mobile',coalesce(r.mobile,''),'passwordEnabled',r.password_hash is not null,'managingAdminName',(select full_name from users where id=r.managing_admin_id),'invitationStatus',case when r.password_hash is not null then 'notRequired' else r.invitation_status end)`;
  if (kind === "clinics") doc = sql12`${doc} || jsonb_build_object('adminName',(select full_name from users where id=r.admin_id))`;
  if (kind === "branches") doc = sql12`${doc} || jsonb_build_object('clinicName',(select data->>'name' from clinics where id=r.clinic_id),
    'inheritEmail',coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null),
    'inheritPhone',coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null),
    'effectiveEmail',case when coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null) then (select data->>'email' from clinics where id=r.clinic_id) else r.data->>'email' end,
    'effectivePhone',case when coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null) then (select data->>'phone' from clinics where id=r.clinic_id) else r.data->>'phone' end)`;
  if (["schedules", "availability-exceptions", "qrs"].includes(kind)) doc = sql12`${doc} || jsonb_build_object('doctorName',(select u.full_name from doctors d join users u on u.id=d.user_id where d.id=r.doctor_id),'branchName',(select data->>'name' from branches where id=r.branch_id))`;
  if (kind === "qrs") doc = sql12`${doc} || jsonb_build_object('reference',r.public_reference)`;
  if (kind === "audit-logs") doc = sql12`${doc} || jsonb_build_object('actorName',(select full_name from users where id=r.actor_id),'actorRole',(select role from users where id=r.actor_id))`;
  return doc;
}
function filterSql(q) {
  const filters = [raw("true")];
  const weekday = q.dayOfWeek ?? q.weekday;
  if (weekday !== void 0) {
    assert(Number.isInteger(Number(weekday)) && Number(weekday) >= 0 && Number(weekday) <= 6, 400, "Invalid weekday");
    filters.push(sql12`doc->>'dayOfWeek'=${String(weekday)}`);
  }
  if (q.linkedOnly === true) filters.push(sql12`doc->>'passwordEnabled'='true'`);
  if (q.statusGroup && q.statusGroup !== "all") {
    assert(statusGroups[q.statusGroup], 400, "Invalid status group");
    filters.push(inList(raw("doc->>'status'"), statusGroups[q.statusGroup]));
  }
  for (const key3 of ["clinicId", "branchId", "doctorId", "patientId", "adminId", "managingAdminId", "status", "role", "category", "parentId", "gender", "city", "specializationId", "source", "entityType", "actorId", "date", "sessionId", "startTime"]) {
    if (q[key3] !== void 0) filters.push(sql12`(doc->>${key3}=${q[key3]} or coalesce(doc->${key3 === "clinicId" ? "clinicIds" : key3 === "branchId" ? "branchIds" : "__none"},'[]'::jsonb) ? ${q[key3]})`);
  }
  if (q.search) filters.push(sql12`exists(select 1 from jsonb_each_text(doc) e where e.key in ('name','fullName','email','mobile','code','reference','token','patientName','doctorName','summary','specializationName') and e.value ilike ${"%" + String(q.search).replace(/[\\%_]/g, "\\$&") + "%"})`);
  if (q.from) filters.push(sql12`coalesce(doc->>'date',left(doc->>'createdAt',10))>=${q.from}`);
  if (q.to) filters.push(sql12`coalesce(doc->>'date',left(doc->>'createdAt',10))<=${q.to}`);
  const security = sql12`doc->>'action' in ('verifyStaffPassword','recoveryInstructions','invitationResent','invitationNotRequired','invitationFailed')`;
  if (q.activityType === "operational") filters.push(sql12`not (${security})`);
  if (q.activityType === "security") filters.push(security);
  if (q.selectedIds) {
    const ids = String(q.selectedIds).split(",");
    assert(ids.length <= 100, 400, "At most 100 selected IDs may be resolved");
    filters.push(inList(raw("doc->>'id'"), ids));
  }
  return sql12.join(filters, raw(" and "));
}
function sourceSql(user, kind, extra = raw("true")) {
  assert(names[kind], 400, "Unsupported resource");
  if (["users", "doctors"].includes(kind)) {
    const own = kind === "users" ? sql12`r.id=${user.id}` : sql12`r.id=${user.doctorId || ""}`;
    const peer = kind === "users" ? sql12`r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}` : raw("false");
    const unrestricted = user.role === "superAdmin" ? raw("true") : sql12`(${own} or (${peer}))`;
    const assignmentDocument = sql12`jsonb_build_object(
      'clinicIds',coalesce(jsonb_agg(distinct l.clinic_id) filter(where ${unrestricted} or ${inList(raw("l.clinic_id"), user.clinicIds)}),'[]'::jsonb),
      'branchIds',coalesce(jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null and (${unrestricted} or ${operationalScope(user, raw("l.clinic_id"), raw("l.branch_id"))})),'[]'::jsonb))`;
    return sql12`select ${documentSql(kind, raw("assignment_doc.doc"))} as doc from ${raw(names[kind])} r
      cross join lateral (select ${assignmentDocument} as doc from (${links(kind)}) l) assignment_doc
      where (${readScope(user, kind)}) and (${extra})`;
  }
  return sql12`select ${documentSql(kind)} as doc from ${raw(names[kind])} r where (${readScope(user, kind)}) and (${extra})`;
}
var metricSql = sql12`count(*)::int as appointments,
  count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting'))::int as waiting,
  count(*) filter(where doc->>'status'='inConsultation')::int as "checkedIn",
  count(*) filter(where doc->>'status'='completed')::int as completed,
  count(*) filter(where doc->>'status'='noShow')::int as "noShow",
  count(*) filter(where doc->>'status'='cancelled')::int as cancelled,
  coalesce(avg((doc->>'waitMinutes')::numeric),0)::float as "averageWaitMinutes",
  avg(case when doc->>'status'='completed'
    and doc->>'consultationStartedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and doc->>'completedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and (doc->>'completedAt')::timestamptz >= (doc->>'consultationStartedAt')::timestamptz
    then extract(epoch from ((doc->>'completedAt')::timestamptz - (doc->>'consultationStartedAt')::timestamptz))/60 end)::float as "averageConsultationMinutes"`;
async function queryMetrics(user, q) {
  const result = await db.execute(sql12`with visible as (${sourceSql(user, "appointments")}) select ${metricSql},
    count(distinct (doc->>'doctorId',doc->>'branchId',doc->>'date',doc->>'startTime')) filter(where doc->>'status' in ('booked','checkedIn','waiting','called','inConsultation'))::int as "activeQueues",
    min(doc->>'token') filter(where doc->>'status' in ('called','inConsultation')) as "currentToken"
    from visible where ${filterSql(q)}`);
  return result.rows[0];
}
function pageParams(q) {
  const page = Number(q.page || 1), pageSize = Number(q.pageSize || 20);
  assert(Number.isInteger(page) && page > 0 && Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100, 400, "Invalid pagination");
  return { page, pageSize };
}
var statusCountsSql = sql12`jsonb_build_object(
  'all', count(*)::int,
  ${sql12.join(Object.entries(statusGroups).map(([group, statuses]) => sql12`${group}::text, count(*) filter(where ${inList(raw("doc->>'status'"), statuses)})::int`), raw(","))})`;
async function queryPage(user, kind, q = {}, extra, conn = db, withStatusCounts = false) {
  assert(!withStatusCounts || kind === "appointments" && user.role !== "patient", 400, "Status counts require staff appointments");
  const { page, pageSize } = pageParams(q), sort = q.sort || "-createdAt", key3 = sort.replace(/^-/, "");
  assert(["createdAt", "name", "fullName", "date", "status", "code", "tokenNumber", "sortOrder", "email", "waitingAt"].includes(key3), 400, "Unsupported sort field");
  const direction = raw(sort.startsWith("-") ? "desc" : "asc");
  const value = key3 === "waitingAt" ? sql12`coalesce(doc->>'waitingAt',doc->>'createdAt')` : ["tokenNumber", "sortOrder"].includes(key3) ? sql12`nullif(doc->>${key3},'')::numeric` : sql12`doc->>${key3}`;
  const secondary = key3 === "waitingAt" ? sql12`(doc->>'tokenNumber')::int ${direction},` : raw("");
  let effectiveQuery = q;
  if (["branches", "clinics"].includes(kind) && q.doctorId) {
    extra = sql12`(${extra || raw("true")}) and ${clinicalMembership(sql12`${q.doctorId}`, kind === "branches" ? raw("r.id") : void 0, kind === "clinics" ? raw("r.id") : void 0)}`;
    effectiveQuery = { ...q, doctorId: void 0 };
  }
  if (kind === "patients" && (q.clinicId || q.branchId)) {
    const registered = sql12`${q.clinicId ? sql12`r.clinic_id=${q.clinicId}` : raw("true")} and ${q.branchId ? sql12`r.branch_id=${q.branchId}` : raw("true")}`;
    const visited = sql12`exists(select 1 from appointments ap where ap.patient_id=r.id
      and ${q.clinicId ? sql12`ap.clinic_id=${q.clinicId}` : raw("true")}
      and ${q.branchId ? sql12`ap.branch_id=${q.branchId}` : raw("true")}
      and ${operationalScope(user, raw("ap.clinic_id"), raw("ap.branch_id"))}
      ${user.role === "doctor" ? sql12`and ap.doctor_id=${user.doctorId || ""}` : raw("")})`;
    extra = sql12`(${extra || raw("true")}) and ((${registered}) or ${visited})`;
    effectiveQuery = { ...effectiveQuery, clinicId: void 0, branchId: void 0 };
  }
  const source = sourceSql(user, kind, extra), filter = filterSql(effectiveQuery);
  const matching = withStatusCounts ? sql12`base_matching as (select doc from visible where ${filterSql({ ...effectiveQuery, status: void 0, statusGroup: void 0 })}), matching as (select doc from base_matching where ${filterSql({ status: effectiveQuery.status, statusGroup: effectiveQuery.statusGroup })})` : sql12`matching as (select doc from visible where ${filter})`;
  const result = await conn.execute(sql12`with visible as (${source}), ${matching}, page_rows as (select doc from matching order by ${value} ${direction} nulls last, ${secondary} doc->>'id' ${direction} limit ${pageSize} offset ${(page - 1) * pageSize}) select (select count(*)::int from matching) as total, coalesce((select jsonb_agg(doc) from page_rows),'[]'::jsonb) as items ${withStatusCounts ? sql12`, (select ${statusCountsSql} from base_matching) as "statusCounts"` : raw("")}`);
  const { items, total, statusCounts } = result.rows[0];
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), ...withStatusCounts ? { statusCounts } : {} };
}
async function queryAppointmentCalendar(user, q, conn = db) {
  assert(q.from && q.to && q.from <= q.to, 400, "Choose a valid calendar range");
  assert((Date.parse(q.to) - Date.parse(q.from)) / 864e5 <= 62, 400, "Calendar range cannot exceed 63 days");
  const result = await conn.execute(sql12`with visible as (${sourceSql(user, "appointments")})
    select doc->>'date' as date, doc->>'status' as status, count(*)::int as count
    from visible where ${filterSql(q)} group by doc->>'date', doc->>'status' order by date`);
  const days = /* @__PURE__ */ new Map();
  for (const row of result.rows) {
    const day = days.get(row.date) || { date: row.date, total: 0, byStatus: {} };
    day.byStatus[row.status] = Number(row.count);
    day.total += Number(row.count);
    days.set(row.date, day);
  }
  return { days: [...days.values()], total: [...days.values()].reduce((sum, d) => sum + d.total, 0) };
}
function queryAppointmentPage(user, q, conn = db) {
  return queryPage(user, "appointments", q, void 0, conn, user.role !== "patient");
}
function assignmentCatalogPredicate(kind, manager, retainedUserId) {
  const retained = retainedUserId ? sql12`exists(select 1 from assignments a where a.user_id=${retainedUserId} and ${kind === "clinics" ? sql12`a.clinic_id=r.id` : sql12`a.branch_id=r.id and a.clinic_id=r.clinic_id`})` : raw("false");
  if (kind === "clinics") return sql12`(${manager ? sql12`r.admin_id=${manager}` : raw("true")}) and (r.status='active' or ${retained})`;
  return sql12`exists(select 1 from clinics c where c.id=r.clinic_id and (${manager ? sql12`c.admin_id=${manager}` : raw("true")}) and ((r.status='active' and c.status='active') or ${retained}))`;
}

// src/routes/appointments.ts
init_db();
import { Router as Router2 } from "express";

// ../../lib/api-zod/src/generated/api.ts
import * as zod from "zod";
var searchGeographyQuerySearchMax = 100;
var searchGeographyQueryCountryMax = 100;
var searchGeographyQueryStateMax = 100;
var searchGeographyQueryCityMax = 100;
var SearchGeographyQueryParams = zod.object({
  "kind": zod.enum(["country", "state", "city"]),
  "search": zod.coerce.string().max(searchGeographyQuerySearchMax).optional(),
  "country": zod.coerce.string().max(searchGeographyQueryCountryMax).optional().describe("ISO-2 code or English country name scoping states and cities"),
  "state": zod.coerce.string().max(searchGeographyQueryStateMax).optional().describe("State/UT name scoping cities"),
  "city": zod.coerce.string().max(searchGeographyQueryCityMax).optional().describe("When given with kind=city, the response includes a compatible flag")
});
var SearchGeographyResponse = zod.object({
  "items": zod.array(zod.string()),
  "compatible": zod.boolean().optional().describe("Whether the given city belongs to the given state; true when the directory cannot judge")
});
var searchPublicGeographyQuerySearchMax = 100;
var searchPublicGeographyQueryCountryMax = 100;
var searchPublicGeographyQueryStateMax = 100;
var searchPublicGeographyQueryCityMax = 100;
var SearchPublicGeographyQueryParams = zod.object({
  "kind": zod.enum(["country", "state", "city"]),
  "search": zod.coerce.string().max(searchPublicGeographyQuerySearchMax).optional(),
  "country": zod.coerce.string().max(searchPublicGeographyQueryCountryMax).optional(),
  "state": zod.coerce.string().max(searchPublicGeographyQueryStateMax).optional(),
  "city": zod.coerce.string().max(searchPublicGeographyQueryCityMax).optional()
});
var SearchPublicGeographyResponse = zod.object({
  "items": zod.array(zod.string()),
  "compatible": zod.boolean().optional().describe("Whether the given city belongs to the given state; true when the directory cannot judge")
});
var lookupPublicPincodePathPinRegExp = new RegExp("^[1-9][0-9]{5}$");
var LookupPublicPincodeParams = zod.object({
  "pin": zod.coerce.string().regex(lookupPublicPincodePathPinRegExp)
});
var LookupPublicPincodeResponse = zod.object({
  "pincode": zod.string(),
  "available": zod.boolean().describe("False when the offline dataset is unavailable; manual entry continues."),
  "attribution": zod.string(),
  "items": zod.array(zod.object({
    "locality": zod.string(),
    "district": zod.string(),
    "state": zod.string()
  }))
});
var CheckIntegrationConnectionParams = zod.object({
  "provider": zod.enum(["smtp", "sms", "storage"])
});
var CheckIntegrationConnectionResponse = zod.object({
  "provider": zod.string(),
  "source": zod.string(),
  "checkedAt": zod.string(),
  "checks": zod.array(zod.object({
    "name": zod.string(),
    "status": zod.enum(["passed", "failed", "not_verified"]),
    "message": zod.string()
  }))
});
var GetStorageConfigurationResponse = zod.object({
  "provider": zod.string(),
  "source": zod.string(),
  "publicPath": zod.string(),
  "configured": zod.boolean()
});
var GetSystemUsersQueryParams = zod.object({
  "page": zod.coerce.number().int().optional(),
  "search": zod.coerce.string().optional(),
  "role": zod.coerce.string().optional(),
  "status": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional()
});
var GetSystemUsersResponse = zod.object({
  "data": zod.array(zod.object({
    "id": zod.string(),
    "fullName": zod.string(),
    "email": zod.string(),
    "role": zod.string(),
    "status": zod.string(),
    "clinics": zod.array(zod.object({
      "id": zod.string(),
      "name": zod.string()
    }))
  })),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int()
});
var GetCustomRolesResponse = zod.object({
  "revision": zod.number().int(),
  "roles": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string(),
    "baseRole": zod.enum(["clinicAdmin", "doctor", "receptionist"]),
    "denied": zod.array(zod.string())
  })),
  "bindings": zod.array(zod.object({
    "userId": zod.string(),
    "roleId": zod.string(),
    "clinicId": zod.string().optional()
  }))
});
var SaveCustomRolesBody = zod.object({
  "revision": zod.number().int(),
  "roles": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string(),
    "baseRole": zod.enum(["clinicAdmin", "doctor", "receptionist"]),
    "denied": zod.array(zod.string())
  })),
  "bindings": zod.array(zod.object({
    "userId": zod.string(),
    "roleId": zod.string(),
    "clinicId": zod.string().optional()
  }))
});
var SaveCustomRolesResponse = zod.object({
  "revision": zod.number().int(),
  "roles": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string(),
    "baseRole": zod.enum(["clinicAdmin", "doctor", "receptionist"]),
    "denied": zod.array(zod.string())
  })),
  "bindings": zod.array(zod.object({
    "userId": zod.string(),
    "roleId": zod.string(),
    "clinicId": zod.string().optional()
  }))
});
var GetPermissionPolicyResponse = zod.object({
  "revision": zod.number().int(),
  "denied": zod.array(zod.string())
}).and(zod.object({
  "modules": zod.array(zod.string()),
  "actions": zod.array(zod.string()),
  "roles": zod.array(zod.string())
}));
var SavePermissionPolicyBody = zod.object({
  "revision": zod.number().int(),
  "denied": zod.array(zod.string())
});
var SavePermissionPolicyResponse = zod.object({
  "revision": zod.number().int(),
  "denied": zod.array(zod.string())
}).and(zod.object({
  "modules": zod.array(zod.string()),
  "actions": zod.array(zod.string()),
  "roles": zod.array(zod.string())
}));
var RequestLogoUploadBody = zod.object({
  "name": zod.string(),
  "size": zod.number().int(),
  "contentType": zod.string(),
  "clinicId": zod.string().optional()
});
var RequestLogoUploadResponse = zod.object({
  "id": zod.string(),
  "uploadUrl": zod.string()
});
var UploadLocalLogoParams = zod.object({
  "id": zod.coerce.string()
});
var UploadLocalLogoResponse = zod.void();
var CompleteLogoUploadParams = zod.object({
  "id": zod.coerce.string()
});
var CompleteLogoUploadResponse = zod.object({
  "logoUrl": zod.string()
});
var GetNotificationTemplatesQueryParams = zod.object({
  "clinicId": zod.coerce.string().optional(),
  "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist"]).optional()
});
var getNotificationTemplatesResponseItemsItemContentSubjectMax = 180;
var getNotificationTemplatesResponseItemsItemContentBodyMax = 8e3;
var getNotificationTemplatesResponseItemsItemContentPrefixMax = 60;
var getNotificationTemplatesResponseItemsItemContentFooterMax = 500;
var getNotificationTemplatesResponseItemsItemContentLogoUrlMax = 1e3;
var getNotificationTemplatesResponseItemsItemDraftSubjectMax = 180;
var getNotificationTemplatesResponseItemsItemDraftBodyMax = 8e3;
var getNotificationTemplatesResponseItemsItemDraftPrefixMax = 60;
var getNotificationTemplatesResponseItemsItemDraftFooterMax = 500;
var getNotificationTemplatesResponseItemsItemDraftLogoUrlMax = 1e3;
var GetNotificationTemplatesResponse = zod.object({
  "scopeName": zod.string(),
  "variables": zod.array(zod.string()),
  "items": zod.array(zod.object({
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist"]).optional(),
    "title": zod.string(),
    "revision": zod.number().int(),
    "source": zod.string(),
    "content": zod.object({
      "enabled": zod.boolean().optional(),
      "subject": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemContentSubjectMax),
      "body": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemContentBodyMax),
      "prefix": zod.string().max(getNotificationTemplatesResponseItemsItemContentPrefixMax),
      "footer": zod.string().max(getNotificationTemplatesResponseItemsItemContentFooterMax),
      "logoUrl": zod.string().max(getNotificationTemplatesResponseItemsItemContentLogoUrlMax)
    }),
    "draft": zod.object({
      "enabled": zod.boolean().optional(),
      "subject": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemDraftSubjectMax),
      "body": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemDraftBodyMax),
      "prefix": zod.string().max(getNotificationTemplatesResponseItemsItemDraftPrefixMax),
      "footer": zod.string().max(getNotificationTemplatesResponseItemsItemDraftFooterMax),
      "logoUrl": zod.string().max(getNotificationTemplatesResponseItemsItemDraftLogoUrlMax)
    }).optional(),
    "previewSubject": zod.string(),
    "previewBody": zod.string(),
    "delivery": zod.string()
  }))
});
var saveNotificationTemplateBodyRevisionMin = 0;
var saveNotificationTemplateBodyContentSubjectMax = 180;
var saveNotificationTemplateBodyContentBodyMax = 8e3;
var saveNotificationTemplateBodyContentPrefixMax = 60;
var saveNotificationTemplateBodyContentFooterMax = 500;
var saveNotificationTemplateBodyContentLogoUrlMax = 1e3;
var SaveNotificationTemplateBody = zod.object({
  "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist"]).optional(),
  "clinicId": zod.string().optional(),
  "event": zod.enum(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"]),
  "revision": zod.number().int().min(saveNotificationTemplateBodyRevisionMin),
  "mode": zod.enum(["draft", "publish", "reset"]),
  "content": zod.object({
    "enabled": zod.boolean().optional(),
    "subject": zod.string().min(1).max(saveNotificationTemplateBodyContentSubjectMax),
    "body": zod.string().min(1).max(saveNotificationTemplateBodyContentBodyMax),
    "prefix": zod.string().max(saveNotificationTemplateBodyContentPrefixMax),
    "footer": zod.string().max(saveNotificationTemplateBodyContentFooterMax),
    "logoUrl": zod.string().max(saveNotificationTemplateBodyContentLogoUrlMax)
  }).optional()
});
var saveNotificationTemplateResponseItemsItemContentSubjectMax = 180;
var saveNotificationTemplateResponseItemsItemContentBodyMax = 8e3;
var saveNotificationTemplateResponseItemsItemContentPrefixMax = 60;
var saveNotificationTemplateResponseItemsItemContentFooterMax = 500;
var saveNotificationTemplateResponseItemsItemContentLogoUrlMax = 1e3;
var saveNotificationTemplateResponseItemsItemDraftSubjectMax = 180;
var saveNotificationTemplateResponseItemsItemDraftBodyMax = 8e3;
var saveNotificationTemplateResponseItemsItemDraftPrefixMax = 60;
var saveNotificationTemplateResponseItemsItemDraftFooterMax = 500;
var saveNotificationTemplateResponseItemsItemDraftLogoUrlMax = 1e3;
var SaveNotificationTemplateResponse = zod.object({
  "scopeName": zod.string(),
  "variables": zod.array(zod.string()),
  "items": zod.array(zod.object({
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist"]).optional(),
    "title": zod.string(),
    "revision": zod.number().int(),
    "source": zod.string(),
    "content": zod.object({
      "enabled": zod.boolean().optional(),
      "subject": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemContentSubjectMax),
      "body": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemContentBodyMax),
      "prefix": zod.string().max(saveNotificationTemplateResponseItemsItemContentPrefixMax),
      "footer": zod.string().max(saveNotificationTemplateResponseItemsItemContentFooterMax),
      "logoUrl": zod.string().max(saveNotificationTemplateResponseItemsItemContentLogoUrlMax)
    }),
    "draft": zod.object({
      "enabled": zod.boolean().optional(),
      "subject": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemDraftSubjectMax),
      "body": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemDraftBodyMax),
      "prefix": zod.string().max(saveNotificationTemplateResponseItemsItemDraftPrefixMax),
      "footer": zod.string().max(saveNotificationTemplateResponseItemsItemDraftFooterMax),
      "logoUrl": zod.string().max(saveNotificationTemplateResponseItemsItemDraftLogoUrlMax)
    }).optional(),
    "previewSubject": zod.string(),
    "previewBody": zod.string(),
    "delivery": zod.string()
  }))
});
var updateIntegrationSettingsBodyCurrentPasswordMax = 1024;
var updateIntegrationSettingsBodyValuesMaxOne = 2048;
var UpdateIntegrationSettingsBody = zod.object({
  "provider": zod.enum(["smtp", "sms"]),
  "mode": zod.enum(["database", "environment"]),
  "revision": zod.string().nullable(),
  "currentPassword": zod.string().min(1).max(updateIntegrationSettingsBodyCurrentPasswordMax),
  "values": zod.record(zod.string(), zod.string().max(updateIntegrationSettingsBodyValuesMaxOne))
});
var UpdateIntegrationSettingsResponse = zod.object({
  "editable": zod.boolean().optional(),
  "smtp": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }),
  "sms": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  })
});
var GetIntegrationSettingsResponse = zod.object({
  "editable": zod.boolean().optional(),
  "smtp": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }),
  "sms": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  })
});
var sendSmtpTestEmailBodyRecipientMax = 254;
var SendSmtpTestEmailBody = zod.object({
  "recipient": zod.string().email().max(sendSmtpTestEmailBodyRecipientMax)
});
var SendSmtpTestEmailResponse = zod.object({
  "status": zod.enum(["provider_accepted"]),
  "message": zod.string()
});
var demoLoginBodyPasswordMax = 200;
var DemoLoginBody = zod.object({
  "password": zod.string().min(1).max(demoLoginBodyPasswordMax)
});
var DemoLoginResponse = zod.object({
  "authenticated": zod.boolean()
});
var GetDemoSetupResponse = zod.object({
  "configured": zod.boolean(),
  "enabled": zod.boolean(),
  "clinicName": zod.string().optional(),
  "clinicSlug": zod.string().optional(),
  "branchSlug": zod.string().optional(),
  "doctorName": zod.string().optional(),
  "username": zod.string().optional(),
  "loginPath": zod.string().optional(),
  "bookingPath": zod.string().optional(),
  "clinicPath": zod.string().optional(),
  "alreadyExists": zod.boolean().optional(),
  "password": zod.string().optional().describe("One-time secret only on creation or rotation")
});
var CreateDemoSetupResponse = zod.object({
  "configured": zod.boolean(),
  "enabled": zod.boolean(),
  "clinicName": zod.string().optional(),
  "clinicSlug": zod.string().optional(),
  "branchSlug": zod.string().optional(),
  "doctorName": zod.string().optional(),
  "username": zod.string().optional(),
  "loginPath": zod.string().optional(),
  "bookingPath": zod.string().optional(),
  "clinicPath": zod.string().optional(),
  "alreadyExists": zod.boolean().optional(),
  "password": zod.string().optional().describe("One-time secret only on creation or rotation")
});
var UpdateDemoSetupBody = zod.object({
  "action": zod.enum(["enable", "disable", "rotate-password"])
});
var UpdateDemoSetupResponse = zod.object({
  "configured": zod.boolean(),
  "enabled": zod.boolean(),
  "clinicName": zod.string().optional(),
  "clinicSlug": zod.string().optional(),
  "branchSlug": zod.string().optional(),
  "doctorName": zod.string().optional(),
  "username": zod.string().optional(),
  "loginPath": zod.string().optional(),
  "bookingPath": zod.string().optional(),
  "clinicPath": zod.string().optional(),
  "alreadyExists": zod.boolean().optional(),
  "password": zod.string().optional().describe("One-time secret only on creation or rotation")
});
var GetSessionContextsQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date()
});
var GetSessionContextsResponseItem = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "hoursWarning": zod.string().nullish().describe("Present when the session extends beyond ordinary location hours; the session remains bookable."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "available": zod.boolean(),
  "reason": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().optional(),
  "maxTokens": zod.number().int(),
  "bookedTokens": zod.number().int(),
  "remainingTokens": zod.number().int(),
  "consultationMinutes": zod.number().int().optional(),
  "tokenPrefix": zod.string().optional(),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": zod.string().optional(),
  "queueCloseTime": zod.string().optional()
}).and(zod.object({
  "snapshotOnly": zod.boolean()
}));
var GetSessionContextsResponse = zod.array(GetSessionContextsResponseItem);
var GetRegistrationOptionsResponse = zod.object({
  "categories": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  })),
  "specialities": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  })),
  "qualifications": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  }))
});
var registerClinicBodyFullNameMax = 150;
var registerClinicBodyPasswordMax = 1024;
var registerClinicBodyClinicSlugMin = 3;
var registerClinicBodyClinicSlugMax = 63;
var registerClinicBodyClinicReferralCodeMax = 100;
var registerClinicBodyBranchesItemSlugMin = 3;
var registerClinicBodyBranchesItemSlugMax = 63;
var registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var registerClinicBodyBranchesItemOpeningHoursMax = 28;
var registerClinicBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var registerClinicBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var registerClinicBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyBranchesMax = 30;
var registerClinicBodyPoliciesBookingHorizonDaysMax = 365;
var registerClinicBodyPoliciesCancellationCutoffMinutesMin = 0;
var registerClinicBodyPoliciesCancellationCutoffMinutesMax = 10080;
var registerClinicBodyOwnDoctorDefault = false;
var registerClinicBodyOwnerScheduleMaxTokensMax = 1e3;
var registerClinicBodyOwnerScheduleConsultationMinutesMax = 240;
var registerClinicBodyOwnerScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyOwnerCustomScheduleMaxTokensMax = 1e3;
var registerClinicBodyOwnerCustomScheduleConsultationMinutesMax = 240;
var registerClinicBodyOwnerCustomScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMin = 0;
var registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMax = 49;
var registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMin = 0;
var registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMax = 6;
var registerClinicBodyOwnerCustomScheduleSessionsItemStartTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsItemEndTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsMax = 500;
var RegisterClinicBody = zod.object({
  "fullName": zod.string().min(1).max(registerClinicBodyFullNameMax),
  "mobile": zod.string().optional(),
  "password": zod.string().min(1).max(registerClinicBodyPasswordMax),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": zod.string().min(1).optional(),
    "address": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "slug": zod.string().min(registerClinicBodyClinicSlugMin).max(registerClinicBodyClinicSlugMax).optional(),
    "categoryId": zod.string().nullish(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(registerClinicBodyClinicReferralCodeMax).nullish()
  }),
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(registerClinicBodyBranchesItemSlugMin).max(registerClinicBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(registerClinicBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(registerClinicBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(registerClinicBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(registerClinicBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).min(1).max(registerClinicBodyBranchesMax),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(registerClinicBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(registerClinicBodyPoliciesCancellationCutoffMinutesMin).max(registerClinicBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional(),
  "ownDoctor": zod.boolean().default(registerClinicBodyOwnDoctorDefault),
  "ownerSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(registerClinicBodyOwnerScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(registerClinicBodyOwnerScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(registerClinicBodyOwnerScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"])
  }).optional(),
  "ownerCustomSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(registerClinicBodyOwnerCustomScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(registerClinicBodyOwnerCustomScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(registerClinicBodyOwnerCustomScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]),
    "sessions": zod.array(zod.object({
      "branchIndex": zod.number().int().min(registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMin).max(registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMax),
      "dayOfWeek": zod.number().int().min(registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMin).max(registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMax),
      "startTime": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemStartTimeRegExp),
      "endTime": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemEndTimeRegExp)
    })).min(1).max(registerClinicBodyOwnerCustomScheduleSessionsMax)
  }).optional().describe("Custom weekly consultation intervals entered once during onboarding/registration with the shared weekly editor. Saved in the same transaction after the owner's doctor profile is created. Mutually exclusive with ownerSchedule (linked)."),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional()
});
var registerClinicResponseClinicOneSlugMin = 3;
var registerClinicResponseClinicOneSlugMax = 63;
var registerClinicResponseClinicOneReferralCodeMax = 100;
var registerClinicResponseBranchesItemOneSlugMin = 3;
var registerClinicResponseBranchesItemOneSlugMax = 63;
var registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var registerClinicResponseBranchesItemOneOpeningHoursMax = 28;
var registerClinicResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var registerClinicResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var registerClinicResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var registerClinicResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicResponsePoliciesBookingHorizonDaysMax = 365;
var registerClinicResponsePoliciesCancellationCutoffMinutesMin = 0;
var registerClinicResponsePoliciesCancellationCutoffMinutesMax = 10080;
var RegisterClinicResponse = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(registerClinicResponseClinicOneSlugMin).max(registerClinicResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(registerClinicResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(registerClinicResponseBranchesItemOneSlugMin).max(registerClinicResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(registerClinicResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(registerClinicResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(registerClinicResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(registerClinicResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(registerClinicResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(registerClinicResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(registerClinicResponsePoliciesCancellationCutoffMinutesMin).max(registerClinicResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": zod.string().nullish()
});
var GetClinicSettingsParams = zod.object({
  "id": zod.coerce.string()
});
var getClinicSettingsResponseClinicOneSlugMin = 3;
var getClinicSettingsResponseClinicOneSlugMax = 63;
var getClinicSettingsResponseClinicOneReferralCodeMax = 100;
var getClinicSettingsResponseBranchesItemOneSlugMin = 3;
var getClinicSettingsResponseBranchesItemOneSlugMax = 63;
var getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getClinicSettingsResponseBranchesItemOneOpeningHoursMax = 28;
var getClinicSettingsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getClinicSettingsResponsePoliciesBookingHorizonDaysMax = 365;
var getClinicSettingsResponsePoliciesCancellationCutoffMinutesMin = 0;
var getClinicSettingsResponsePoliciesCancellationCutoffMinutesMax = 10080;
var GetClinicSettingsResponse = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(getClinicSettingsResponseClinicOneSlugMin).max(getClinicSettingsResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(getClinicSettingsResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(getClinicSettingsResponseBranchesItemOneSlugMin).max(getClinicSettingsResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(getClinicSettingsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(getClinicSettingsResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(getClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(getClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(getClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(getClinicSettingsResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(getClinicSettingsResponsePoliciesCancellationCutoffMinutesMin).max(getClinicSettingsResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": zod.string().nullish()
});
var UpdateClinicSettingsParams = zod.object({
  "id": zod.coerce.string()
});
var updateClinicSettingsBodyClinicSlugMin = 3;
var updateClinicSettingsBodyClinicSlugMax = 63;
var updateClinicSettingsBodyClinicReferralCodeMax = 100;
var updateClinicSettingsBodyBranchesItemSlugMin = 3;
var updateClinicSettingsBodyBranchesItemSlugMax = 63;
var updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var updateClinicSettingsBodyBranchesItemOpeningHoursMax = 28;
var updateClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var updateClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var updateClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var updateClinicSettingsBodyBranchesMax = 30;
var updateClinicSettingsBodyPoliciesBookingHorizonDaysMax = 365;
var updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMin = 0;
var updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMax = 10080;
var UpdateClinicSettingsBody = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": zod.string().min(1).optional(),
    "address": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "slug": zod.string().min(updateClinicSettingsBodyClinicSlugMin).max(updateClinicSettingsBodyClinicSlugMax).optional(),
    "categoryId": zod.string().nullish(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(updateClinicSettingsBodyClinicReferralCodeMax).nullish()
  }).optional(),
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(updateClinicSettingsBodyBranchesItemSlugMin).max(updateClinicSettingsBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(updateClinicSettingsBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(updateClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(updateClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(updateClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(updateClinicSettingsBodyBranchesMax).optional(),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(updateClinicSettingsBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMin).max(updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional()
});
var updateClinicSettingsResponseClinicOneSlugMin = 3;
var updateClinicSettingsResponseClinicOneSlugMax = 63;
var updateClinicSettingsResponseClinicOneReferralCodeMax = 100;
var updateClinicSettingsResponseBranchesItemOneSlugMin = 3;
var updateClinicSettingsResponseBranchesItemOneSlugMax = 63;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursMax = 28;
var updateClinicSettingsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var updateClinicSettingsResponsePoliciesBookingHorizonDaysMax = 365;
var updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMin = 0;
var updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMax = 10080;
var UpdateClinicSettingsResponse = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(updateClinicSettingsResponseClinicOneSlugMin).max(updateClinicSettingsResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(updateClinicSettingsResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(updateClinicSettingsResponseBranchesItemOneSlugMin).max(updateClinicSettingsResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(updateClinicSettingsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(updateClinicSettingsResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(updateClinicSettingsResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMin).max(updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": zod.string().nullish()
});
var PreviewClinicSettingsParams = zod.object({
  "id": zod.coerce.string()
});
var previewClinicSettingsBodyClinicSlugMin = 3;
var previewClinicSettingsBodyClinicSlugMax = 63;
var previewClinicSettingsBodyClinicReferralCodeMax = 100;
var previewClinicSettingsBodyBranchesItemSlugMin = 3;
var previewClinicSettingsBodyBranchesItemSlugMax = 63;
var previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var previewClinicSettingsBodyBranchesItemOpeningHoursMax = 28;
var previewClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var previewClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var previewClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var previewClinicSettingsBodyBranchesMax = 30;
var previewClinicSettingsBodyPoliciesBookingHorizonDaysMax = 365;
var previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMin = 0;
var previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMax = 10080;
var PreviewClinicSettingsBody = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": zod.string().min(1).optional(),
    "address": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "slug": zod.string().min(previewClinicSettingsBodyClinicSlugMin).max(previewClinicSettingsBodyClinicSlugMax).optional(),
    "categoryId": zod.string().nullish(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(previewClinicSettingsBodyClinicReferralCodeMax).nullish()
  }).optional(),
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(previewClinicSettingsBodyBranchesItemSlugMin).max(previewClinicSettingsBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(previewClinicSettingsBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(previewClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(previewClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(previewClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(previewClinicSettingsBodyBranchesMax).optional(),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(previewClinicSettingsBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMin).max(previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional()
});
var PreviewClinicSettingsResponse = zod.object({
  "allowed": zod.boolean(),
  "conflicts": zod.array(zod.string()),
  "impacts": zod.array(zod.object({
    "branchId": zod.string(),
    "create": zod.number().int(),
    "update": zod.number().int(),
    "retire": zod.number().int(),
    "unlink": zod.boolean()
  }))
});
var attachOwnDoctorProfileBodyBranchIdsMax = 30;
var AttachOwnDoctorProfileBody = zod.object({
  "branchIds": zod.array(zod.string()).max(attachOwnDoctorProfileBodyBranchIdsMax),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "about": zod.string().optional()
});
var attachOwnDoctorProfileResponseOneCountryMax = 100;
var attachOwnDoctorProfileResponseOneStateMax = 100;
var attachOwnDoctorProfileResponseOneCityMax = 100;
var attachOwnDoctorProfileResponseOnePincodeMax = 12;
var attachOwnDoctorProfileResponseOneAddressMax = 500;
var attachOwnDoctorProfileResponseOneExperienceYearsMin = 0;
var attachOwnDoctorProfileResponseOneConsultationFeeMin = 0;
var AttachOwnDoctorProfileResponse = zod.object({
  "country": zod.string().max(attachOwnDoctorProfileResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(attachOwnDoctorProfileResponseOneStateMax).optional(),
  "city": zod.string().max(attachOwnDoctorProfileResponseOneCityMax).optional(),
  "pincode": zod.string().max(attachOwnDoctorProfileResponseOnePincodeMax).optional(),
  "address": zod.string().max(attachOwnDoctorProfileResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().optional(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(attachOwnDoctorProfileResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(attachOwnDoctorProfileResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var checkSlugAvailabilityQuerySlugMin = 3;
var checkSlugAvailabilityQuerySlugMax = 63;
var CheckSlugAvailabilityQueryParams = zod.object({
  "slug": zod.coerce.string().min(checkSlugAvailabilityQuerySlugMin).max(checkSlugAvailabilityQuerySlugMax),
  "clinicId": zod.coerce.string().optional()
});
var CheckSlugAvailabilityResponse = zod.object({
  "available": zod.boolean(),
  "slug": zod.string()
});
var ResolveClinicSlugParams = zod.object({
  "clinicSlug": zod.coerce.string()
});
var resolveClinicSlugQueryPageMax = 1e6;
var resolveClinicSlugQuerySearchMax = 200;
var ResolveClinicSlugQueryParams = zod.object({
  "directory": zod.coerce.boolean().optional().describe("Opt in to scoped server pagination; omitted preserves the legacy context arrays."),
  "page": zod.coerce.number().int().min(1).max(resolveClinicSlugQueryPageMax).optional(),
  "pageSize": zod.union([zod.literal(10), zod.literal(25), zod.literal(50), zod.literal(100)]).optional(),
  "search": zod.coerce.string().max(resolveClinicSlugQuerySearchMax).optional().describe("Matches public clinic name/address/city or doctor name/specialization only."),
  "sort": zod.enum(["name", "-name"]).optional().describe("Public name with optional minus prefix; sorting never uses private fields.")
});
var resolveClinicSlugResponseDirectoryPaginationTotalMin = 0;
var resolveClinicSlugResponseBranchCountMin = 0;
var resolveClinicSlugResponseBranchDoctorCountMin = 0;
var resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMin = 0;
var resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMax = 6;
var ResolveClinicSlugResponse = zod.object({
  "directoryPagination": zod.object({
    "total": zod.number().int().min(resolveClinicSlugResponseDirectoryPaginationTotalMin),
    "page": zod.number().int(),
    "pageSize": zod.number().int(),
    "totalPages": zod.number().int().optional()
  }).optional(),
  "branchCount": zod.number().int().min(resolveClinicSlugResponseBranchCountMin).optional().describe("Active clinic count before directory search."),
  "branchDoctorCount": zod.number().int().min(resolveClinicSlugResponseBranchDoctorCountMin).optional().describe("Active doctors at the resolved clinic before directory search."),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "doctorCount": zod.number().int().optional(),
    "averageConsultationMinutes": zod.number().nullish(),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string(),
    "address": zod.string().nullish(),
    "email": zod.string().nullish(),
    "phone": zod.string().nullish()
  }),
  "branches": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin).max(resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  })),
  "branch": zod.union([zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMin).max(resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  }), zod.null()]),
  "qrReference": zod.string().nullable(),
  "doctors": zod.array(zod.object({
    "averageConsultationMinutes": zod.number().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": zod.number().int().nullish().describe("Explicit clinic duration configuration"),
    "id": zod.string(),
    "fullName": zod.string(),
    "photoUrl": zod.string().optional(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional(),
    "about": zod.string().optional(),
    "experienceYears": zod.number().int().optional(),
    "consultationFee": zod.number().optional(),
    "clinicIds": zod.array(zod.string()),
    "branchIds": zod.array(zod.string())
  }))
});
var ResolveBranchSlugParams = zod.object({
  "clinicSlug": zod.coerce.string(),
  "branchSlug": zod.coerce.string()
});
var resolveBranchSlugQueryPageMax = 1e6;
var resolveBranchSlugQuerySearchMax = 200;
var ResolveBranchSlugQueryParams = zod.object({
  "directory": zod.coerce.boolean().optional().describe("Opt in to scoped server pagination; omitted preserves the legacy context arrays."),
  "page": zod.coerce.number().int().min(1).max(resolveBranchSlugQueryPageMax).optional(),
  "pageSize": zod.union([zod.literal(10), zod.literal(25), zod.literal(50), zod.literal(100)]).optional(),
  "search": zod.coerce.string().max(resolveBranchSlugQuerySearchMax).optional().describe("Matches public clinic name/address/city or doctor name/specialization only."),
  "sort": zod.enum(["name", "-name"]).optional().describe("Public name with optional minus prefix; sorting never uses private fields.")
});
var resolveBranchSlugResponseDirectoryPaginationTotalMin = 0;
var resolveBranchSlugResponseBranchCountMin = 0;
var resolveBranchSlugResponseBranchDoctorCountMin = 0;
var resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMin = 0;
var resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMax = 6;
var ResolveBranchSlugResponse = zod.object({
  "directoryPagination": zod.object({
    "total": zod.number().int().min(resolveBranchSlugResponseDirectoryPaginationTotalMin),
    "page": zod.number().int(),
    "pageSize": zod.number().int(),
    "totalPages": zod.number().int().optional()
  }).optional(),
  "branchCount": zod.number().int().min(resolveBranchSlugResponseBranchCountMin).optional().describe("Active clinic count before directory search."),
  "branchDoctorCount": zod.number().int().min(resolveBranchSlugResponseBranchDoctorCountMin).optional().describe("Active doctors at the resolved clinic before directory search."),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "doctorCount": zod.number().int().optional(),
    "averageConsultationMinutes": zod.number().nullish(),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string(),
    "address": zod.string().nullish(),
    "email": zod.string().nullish(),
    "phone": zod.string().nullish()
  }),
  "branches": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin).max(resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  })),
  "branch": zod.union([zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMin).max(resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  }), zod.null()]),
  "qrReference": zod.string().nullable(),
  "doctors": zod.array(zod.object({
    "averageConsultationMinutes": zod.number().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": zod.number().int().nullish().describe("Explicit clinic duration configuration"),
    "id": zod.string(),
    "fullName": zod.string(),
    "photoUrl": zod.string().optional(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional(),
    "about": zod.string().optional(),
    "experienceYears": zod.number().int().optional(),
    "consultationFee": zod.number().optional(),
    "clinicIds": zod.array(zod.string()),
    "branchIds": zod.array(zod.string())
  }))
});
var GetDoctorPresenceParams = zod.object({
  "id": zod.coerce.string()
});
var GetDoctorPresenceQueryParams = zod.object({
  "branchId": zod.coerce.string(),
  "date": zod.date(),
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional()
});
var GetDoctorPresenceResponse = zod.object({
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "status": zod.enum(["available", "onBreak", "away"])
}).and(zod.object({
  "doctorId": zod.string(),
  "updatedAt": zod.coerce.date().nullable()
}));
var UpdateDoctorPresenceParams = zod.object({
  "id": zod.coerce.string()
});
var UpdateDoctorPresenceBody = zod.object({
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "status": zod.enum(["available", "onBreak", "away"])
});
var UpdateDoctorPresenceResponse = zod.object({
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "status": zod.enum(["available", "onBreak", "away"])
}).and(zod.object({
  "doctorId": zod.string(),
  "updatedAt": zod.coerce.date().nullable()
}));
var GetBookingScheduleAccessQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string()
});
var GetBookingScheduleAccessResponse = zod.object({
  "allowed": zod.boolean()
});
var GetPublicBookingContextQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string()
});
var GetPublicBookingContextResponse = zod.object({
  "timezone": zod.string(),
  "today": zod.coerce.date(),
  "lastBookableDate": zod.coerce.date()
});
var GetPublicAvailabilitySessionsQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date()
});
var GetPublicAvailabilitySessionsResponseItem = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "hoursWarning": zod.string().nullish().describe("Present when the session extends beyond ordinary location hours; the session remains bookable."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "available": zod.boolean(),
  "reason": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().optional(),
  "maxTokens": zod.number().int(),
  "bookedTokens": zod.number().int(),
  "remainingTokens": zod.number().int(),
  "consultationMinutes": zod.number().int().optional(),
  "tokenPrefix": zod.string().optional(),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": zod.string().optional(),
  "queueCloseTime": zod.string().optional()
});
var GetPublicAvailabilitySessionsResponse = zod.array(GetPublicAvailabilitySessionsResponseItem);
var createGuestRequestBodyQrReferenceMax = 200;
var createGuestRequestBodyFullNameMax = 150;
var createGuestRequestBodyEmailMax = 254;
var createGuestRequestBodyMobileMax = 16;
var createGuestRequestBodyMobileRegExp = new RegExp("^\\+[1-9][0-9]{7,14}$");
var createGuestRequestBodyBranchIdMax = 100;
var createGuestRequestBodyDoctorIdMax = 100;
var createGuestRequestBodyDateRegExp = new RegExp("^\\d{4}-\\d{2}-\\d{2}$");
var createGuestRequestBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var CreateGuestRequestBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "qrReference": zod.string().min(1).max(createGuestRequestBodyQrReferenceMax),
  "fullName": zod.string().min(1).max(createGuestRequestBodyFullNameMax),
  "email": zod.string().email().max(createGuestRequestBodyEmailMax).nullish(),
  "mobile": zod.string().max(createGuestRequestBodyMobileMax).regex(createGuestRequestBodyMobileRegExp).nullish(),
  "branchId": zod.string().min(1).max(createGuestRequestBodyBranchIdMax),
  "doctorId": zod.string().min(1).max(createGuestRequestBodyDoctorIdMax),
  "date": zod.string().regex(createGuestRequestBodyDateRegExp),
  "requestId": zod.string().uuid(),
  "receiptSecret": zod.string().regex(createGuestRequestBodyReceiptSecretRegExp)
});
var CreateGuestRequestResponse = zod.object({
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "id": zod.string(),
  "status": zod.enum(["pending", "confirmed", "rejected"]),
  "fullName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "doctorName": zod.string(),
  "date": zod.string(),
  "startTime": zod.string().nullable(),
  "endTime": zod.string().nullable(),
  "timezone": zod.string(),
  "token": zod.string().nullable(),
  "reason": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "reference": zod.string().nullable(),
  "branchAddress": zod.string().nullable(),
  "appointmentStatus": zod.string().nullable(),
  "revision": zod.number().int().nullable(),
  "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
});
var getGuestReceiptBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var GetGuestReceiptBody = zod.object({
  "receiptSecret": zod.string().regex(getGuestReceiptBodyReceiptSecretRegExp)
});
var GetGuestReceiptResponse = zod.object({
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "id": zod.string(),
  "status": zod.enum(["pending", "confirmed", "rejected"]),
  "fullName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "doctorName": zod.string(),
  "date": zod.string(),
  "startTime": zod.string().nullable(),
  "endTime": zod.string().nullable(),
  "timezone": zod.string(),
  "token": zod.string().nullable(),
  "reason": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "reference": zod.string().nullable(),
  "branchAddress": zod.string().nullable(),
  "appointmentStatus": zod.string().nullable(),
  "revision": zod.number().int().nullable(),
  "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
});
var listGuestRequestsQuerySearchMax = 200;
var listGuestRequestsQuerySortDefault = `-createdAt`;
var listGuestRequestsQueryPageMax = 1e5;
var listGuestRequestsQueryPageSizeMax = 100;
var ListGuestRequestsQueryParams = zod.object({
  "search": zod.coerce.string().max(listGuestRequestsQuerySearchMax).optional(),
  "sort": zod.enum(["createdAt", "-createdAt", "fullName", "-fullName", "date", "-date"]).default(listGuestRequestsQuerySortDefault),
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "date": zod.date().optional(),
  "status": zod.enum(["pending", "confirmed", "rejected"]).optional(),
  "page": zod.coerce.number().int().min(1).max(listGuestRequestsQueryPageMax).optional(),
  "pageSize": zod.coerce.number().int().min(1).max(listGuestRequestsQueryPageSizeMax).optional()
});
var ListGuestRequestsResponse = zod.object({
  "items": zod.array(zod.object({
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "sessionId": zod.string().nullish(),
    "id": zod.string(),
    "status": zod.enum(["pending", "confirmed", "rejected"]),
    "fullName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "doctorName": zod.string(),
    "date": zod.string(),
    "startTime": zod.string().nullable(),
    "endTime": zod.string().nullable(),
    "timezone": zod.string(),
    "token": zod.string().nullable(),
    "reason": zod.string().nullable(),
    "appointmentId": zod.string().nullable(),
    "reference": zod.string().nullable(),
    "branchAddress": zod.string().nullable(),
    "appointmentStatus": zod.string().nullable(),
    "revision": zod.number().int().nullable(),
    "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
  }).and(zod.object({
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "doctorId": zod.string(),
    "email": zod.string().nullable(),
    "mobile": zod.string().nullable(),
    "appointmentId": zod.string().nullable(),
    "createdAt": zod.coerce.date()
  }))),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int()
});
var DecideGuestRequestParams = zod.object({
  "id": zod.coerce.string()
});
var decideGuestRequestBodyReasonMax = 500;
var DecideGuestRequestBody = zod.object({
  "action": zod.enum(["confirm", "reject"]),
  "reason": zod.string().min(1).max(decideGuestRequestBodyReasonMax)
});
var DecideGuestRequestResponse = zod.object({
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "id": zod.string(),
  "status": zod.enum(["pending", "confirmed", "rejected"]),
  "fullName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "doctorName": zod.string(),
  "date": zod.string(),
  "startTime": zod.string().nullable(),
  "endTime": zod.string().nullable(),
  "timezone": zod.string(),
  "token": zod.string().nullable(),
  "reason": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "reference": zod.string().nullable(),
  "branchAddress": zod.string().nullable(),
  "appointmentStatus": zod.string().nullable(),
  "revision": zod.number().int().nullable(),
  "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
}).and(zod.object({
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "doctorId": zod.string(),
  "email": zod.string().nullable(),
  "mobile": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "createdAt": zod.coerce.date()
}));
var HealthCheckResponse = zod.object({
  "status": zod.string()
});
var GetAuthCsrfResponse = zod.object({
  "csrfToken": zod.string()
});
var nativeStaffLoginBodyPasswordMax = 1024;
var NativeStaffLoginBody = zod.object({
  "email": zod.string().email(),
  "password": zod.string().min(1).max(nativeStaffLoginBodyPasswordMax)
});
var NativeStaffLoginResponse = zod.object({
  "authenticated": zod.literal(true),
  "user": zod.object({
    "id": zod.string(),
    "email": zod.string().email(),
    "fullName": zod.string(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist"]),
    "status": zod.enum(["active"])
  })
});
var verifyStaffDeviceBodyCodeMin = 6;
var verifyStaffDeviceBodyCodeMax = 6;
var VerifyStaffDeviceBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().min(verifyStaffDeviceBodyCodeMin).max(verifyStaffDeviceBodyCodeMax)
});
var VerifyStaffDeviceResponse = zod.void();
var startPatientEmailBodyEmailMax = 254;
var StartPatientEmailBody = zod.object({
  "email": zod.string().email().max(startPatientEmailBodyEmailMax)
});
var StartPatientEmailResponse = zod.object({
  "challengeId": zod.string(),
  "requiresVerification": zod.boolean().optional()
});
var verifyPatientEmailBodyCodeMin = 6;
var verifyPatientEmailBodyCodeMax = 6;
var VerifyPatientEmailBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().min(verifyPatientEmailBodyCodeMin).max(verifyPatientEmailBodyCodeMax)
});
var VerifyPatientEmailResponse = zod.object({
  "authenticated": zod.boolean()
});
var startClinicRegistrationBodyFullNameMax = 200;
var startClinicRegistrationBodyPasswordMin = 8;
var startClinicRegistrationBodyPasswordMax = 1024;
var startClinicRegistrationBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var StartClinicRegistrationBody = zod.object({
  "email": zod.string().email(),
  "fullName": zod.string().min(1).max(startClinicRegistrationBodyFullNameMax),
  "password": zod.string().min(startClinicRegistrationBodyPasswordMin).max(startClinicRegistrationBodyPasswordMax).regex(startClinicRegistrationBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var StartClinicRegistrationResponse = zod.object({
  "challengeId": zod.string(),
  "requiresVerification": zod.boolean().optional()
});
var ResendClinicRegistrationBody = zod.object({
  "challengeId": zod.string()
});
var ResendClinicRegistrationResponse = zod.object({
  "challengeId": zod.string()
});
var verifyClinicRegistrationBodyCodeMin = 6;
var verifyClinicRegistrationBodyCodeMax = 6;
var VerifyClinicRegistrationBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().min(verifyClinicRegistrationBodyCodeMin).max(verifyClinicRegistrationBodyCodeMax)
});
var VerifyClinicRegistrationResponse = zod.object({
  "authenticated": zod.boolean()
});
var requestPasswordRecoveryBodyEmailMax = 254;
var RequestPasswordRecoveryBody = zod.object({
  "email": zod.string().email().max(requestPasswordRecoveryBodyEmailMax)
});
var RequestPasswordRecoveryResponse = zod.object({
  "sent": zod.boolean()
});
var resetNativePasswordBodyPasswordMin = 8;
var resetNativePasswordBodyPasswordMax = 1024;
var resetNativePasswordBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var ResetNativePasswordBody = zod.object({
  "token": zod.string(),
  "password": zod.string().min(resetNativePasswordBodyPasswordMin).max(resetNativePasswordBodyPasswordMax).regex(resetNativePasswordBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var ResetNativePasswordResponse = zod.object({
  "reset": zod.boolean()
});
var acceptStaffInvitationBodyPasswordMin = 8;
var acceptStaffInvitationBodyPasswordMax = 1024;
var acceptStaffInvitationBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var AcceptStaffInvitationBody = zod.object({
  "token": zod.string(),
  "password": zod.string().min(acceptStaffInvitationBodyPasswordMin).max(acceptStaffInvitationBodyPasswordMax).regex(acceptStaffInvitationBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var AcceptStaffInvitationResponse = zod.object({
  "authenticated": zod.boolean()
});
var changeNativePasswordBodyPasswordMin = 8;
var changeNativePasswordBodyPasswordMax = 1024;
var changeNativePasswordBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var ChangeNativePasswordBody = zod.object({
  "currentPassword": zod.string(),
  "password": zod.string().min(changeNativePasswordBodyPasswordMin).max(changeNativePasswordBodyPasswordMax).regex(changeNativePasswordBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var ChangeNativePasswordResponse = zod.object({
  "changed": zod.boolean()
});
var LogoutNativeSessionResponse = zod.object({
  "authenticated": zod.boolean()
});
var GetAuthStatusResponse = zod.object({
  "role": zod.string().nullable(),
  "staffPasswordVerified": zod.boolean(),
  "requiresStaffPassword": zod.boolean()
});
var getMeResponseUserOneOneCountryMax = 100;
var getMeResponseUserOneOneStateMax = 100;
var getMeResponseUserOneOneCityMax = 100;
var getMeResponseUserOneOnePincodeMax = 12;
var getMeResponseUserOneOneAddressMax = 500;
var GetMeResponse = zod.object({
  "userId": zod.string(),
  "user": zod.union([zod.object({
    "country": zod.string().max(getMeResponseUserOneOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(getMeResponseUserOneOneStateMax).optional(),
    "city": zod.string().max(getMeResponseUserOneOneCityMax).optional(),
    "pincode": zod.string().max(getMeResponseUserOneOnePincodeMax).optional(),
    "address": zod.string().max(getMeResponseUserOneOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })), zod.null()]),
  "doctorId": zod.string().nullish(),
  "patientId": zod.string().nullish(),
  "needsOnboarding": zod.boolean()
});
var UpdateMeBody = zod.object({
  "fullName": zod.string().min(1).optional(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional()
});
var updateMeResponseOneCountryMax = 100;
var updateMeResponseOneStateMax = 100;
var updateMeResponseOneCityMax = 100;
var updateMeResponseOnePincodeMax = 12;
var updateMeResponseOneAddressMax = 500;
var UpdateMeResponse = zod.object({
  "country": zod.string().max(updateMeResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateMeResponseOneStateMax).optional(),
  "city": zod.string().max(updateMeResponseOneCityMax).optional(),
  "pincode": zod.string().max(updateMeResponseOnePincodeMax).optional(),
  "address": zod.string().max(updateMeResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var onboardBodyIntentDefault = `patient`;
var OnboardBody = zod.object({
  "intent": zod.enum(["patient"]).default(onboardBodyIntentDefault),
  "fullName": zod.string().min(1),
  "mobile": zod.string().optional(),
  "termsAccepted": zod.boolean().optional()
});
var onboardResponseUserOneOneCountryMax = 100;
var onboardResponseUserOneOneStateMax = 100;
var onboardResponseUserOneOneCityMax = 100;
var onboardResponseUserOneOnePincodeMax = 12;
var onboardResponseUserOneOneAddressMax = 500;
var OnboardResponse = zod.object({
  "userId": zod.string(),
  "user": zod.union([zod.object({
    "country": zod.string().max(onboardResponseUserOneOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(onboardResponseUserOneOneStateMax).optional(),
    "city": zod.string().max(onboardResponseUserOneOneCityMax).optional(),
    "pincode": zod.string().max(onboardResponseUserOneOnePincodeMax).optional(),
    "address": zod.string().max(onboardResponseUserOneOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })), zod.null()]),
  "doctorId": zod.string().nullish(),
  "patientId": zod.string().nullish(),
  "needsOnboarding": zod.boolean()
});
var requestOtpBodyMobileRegExp = new RegExp("^\\+[1-9][0-9]{7,14}$");
var RequestOtpBody = zod.object({
  "mobile": zod.string().regex(requestOtpBodyMobileRegExp)
});
var RequestOtpResponse = zod.object({
  "challengeId": zod.string(),
  "expiresAt": zod.coerce.date(),
  "resendAfterSeconds": zod.number().int(),
  "provider": zod.enum(["sms", "development"]),
  "developmentCode": zod.string().optional().describe("Returned only by the explicitly enabled development provider when NODE_ENV=development. Never present in production.")
});
var verifyOtpBodyCodeRegExp = new RegExp("^[0-9]{4,8}$");
var VerifyOtpBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().regex(verifyOtpBodyCodeRegExp)
});
var VerifyOtpResponse = zod.object({
  "verified": zod.boolean(),
  "mobile": zod.string(),
  "verifiedAt": zod.coerce.date().optional()
});
var listPublicClinicsQuerySelectedIdsMax = 1e4;
var listPublicClinicsQueryPageDefault = 1;
var listPublicClinicsQueryPageSizeDefault = 20;
var listPublicClinicsQueryPageSizeMax = 100;
var ListPublicClinicsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listPublicClinicsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPublicClinicsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPublicClinicsQueryPageSizeMax).default(listPublicClinicsQueryPageSizeDefault)
});
var listPublicClinicsResponseOneTotalMin = 0;
var listPublicClinicsResponseTwoItemsItemOneSlugMin = 3;
var listPublicClinicsResponseTwoItemsItemOneSlugMax = 63;
var listPublicClinicsResponseTwoItemsItemOneReferralCodeMax = 100;
var ListPublicClinicsResponse = zod.object({
  "total": zod.number().int().min(listPublicClinicsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(listPublicClinicsResponseTwoItemsItemOneSlugMin).max(listPublicClinicsResponseTwoItemsItemOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(listPublicClinicsResponseTwoItemsItemOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })))
}));
var listPublicBranchesQuerySelectedIdsMax = 1e4;
var listPublicBranchesQueryPageDefault = 1;
var listPublicBranchesQueryPageSizeDefault = 20;
var listPublicBranchesQueryPageSizeMax = 100;
var ListPublicBranchesQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listPublicBranchesQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPublicBranchesQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPublicBranchesQueryPageSizeMax).default(listPublicBranchesQueryPageSizeDefault)
});
var listPublicBranchesResponseOneTotalMin = 0;
var listPublicBranchesResponseTwoItemsItemOneSlugMin = 3;
var listPublicBranchesResponseTwoItemsItemOneSlugMax = 63;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin = 0;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax = 6;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursMax = 28;
var listPublicBranchesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax = 1e3;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax = 240;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var ListPublicBranchesResponse = zod.object({
  "total": zod.number().int().min(listPublicBranchesResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "slug": zod.string().min(listPublicBranchesResponseTwoItemsItemOneSlugMin).max(listPublicBranchesResponseTwoItemsItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin).max(listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(listPublicBranchesResponseTwoItemsItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(listPublicBranchesResponseTwoItemsItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  })))
}));
var listPublicDoctorsQuerySelectedIdsMax = 1e4;
var listPublicDoctorsQueryPageDefault = 1;
var listPublicDoctorsQueryPageSizeDefault = 20;
var listPublicDoctorsQueryPageSizeMax = 100;
var ListPublicDoctorsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listPublicDoctorsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "specializationId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPublicDoctorsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPublicDoctorsQueryPageSizeMax).default(listPublicDoctorsQueryPageSizeDefault)
});
var listPublicDoctorsResponseOneTotalMin = 0;
var ListPublicDoctorsResponse = zod.object({
  "total": zod.number().int().min(listPublicDoctorsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "averageConsultationMinutes": zod.number().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": zod.number().int().nullish().describe("Explicit clinic duration configuration"),
    "id": zod.string(),
    "fullName": zod.string(),
    "photoUrl": zod.string().optional(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional(),
    "about": zod.string().optional(),
    "experienceYears": zod.number().int().optional(),
    "consultationFee": zod.number().optional(),
    "clinicIds": zod.array(zod.string()),
    "branchIds": zod.array(zod.string())
  }))
}));
var GetPublicAvailabilityQueryParams = zod.object({
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date()
});
var GetPublicAvailabilityResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "hoursWarning": zod.string().nullish().describe("Present when the session extends beyond ordinary location hours; the session remains bookable."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "available": zod.boolean(),
  "reason": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().optional(),
  "maxTokens": zod.number().int(),
  "bookedTokens": zod.number().int(),
  "remainingTokens": zod.number().int(),
  "consultationMinutes": zod.number().int().optional(),
  "tokenPrefix": zod.string().optional(),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": zod.string().optional(),
  "queueCloseTime": zod.string().optional()
});
var GetPublicDisplayParams = zod.object({
  "reference": zod.coerce.string()
});
var GetPublicDisplayResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "clinic": zod.object({
    "name": zod.string()
  }),
  "branch": zod.object({
    "name": zod.string(),
    "address": zod.string().nullable(),
    "city": zod.string().nullable(),
    "timezone": zod.string()
  }),
  "date": zod.coerce.date(),
  "updatedAt": zod.coerce.date(),
  "sessions": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "sessionId": zod.string().nullish(),
    "presence": zod.enum(["available", "onBreak", "away"]).optional(),
    "doctorId": zod.string(),
    "doctorName": zod.string(),
    "startTime": zod.string().nullable(),
    "endTime": zod.string().nullable(),
    "currentToken": zod.string().nullable(),
    "currentStatus": zod.union([zod.literal("called"), zod.literal("inConsultation"), zod.literal(null)]).nullable(),
    "nextToken": zod.string().nullable(),
    "waitingTokens": zod.array(zod.string()),
    "waitingCount": zod.number().int(),
    "completedCount": zod.number().int()
  }))
});
var ResolveQrParams = zod.object({
  "reference": zod.coerce.string()
});
var ResolveQrResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "reference": zod.string(),
  "clinicId": zod.string(),
  "clinicName": zod.string(),
  "clinicAddress": zod.string().nullish(),
  "branchAddress": zod.string().nullish(),
  "branchCity": zod.string().nullish(),
  "branchTimezone": zod.string().nullish(),
  "branchId": zod.string().nullish(),
  "branchName": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "doctorName": zod.string().nullish()
});
var listClinicsQuerySelectedIdsMax = 1e4;
var listClinicsQueryPageDefault = 1;
var listClinicsQueryPageSizeDefault = 20;
var listClinicsQueryPageSizeMax = 100;
var ListClinicsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listClinicsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "doctorId": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "adminId": zod.coerce.string().optional(),
  "city": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listClinicsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listClinicsQueryPageSizeMax).default(listClinicsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listClinicsResponseOneTotalMin = 0;
var listClinicsResponseTwoItemsItemOneSlugMin = 3;
var listClinicsResponseTwoItemsItemOneSlugMax = 63;
var listClinicsResponseTwoItemsItemOneReferralCodeMax = 100;
var ListClinicsResponse = zod.object({
  "total": zod.number().int().min(listClinicsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(listClinicsResponseTwoItemsItemOneSlugMin).max(listClinicsResponseTwoItemsItemOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(listClinicsResponseTwoItemsItemOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })))
}));
var createClinicBodySlugMin = 3;
var createClinicBodySlugMax = 63;
var createClinicBodyReferralCodeMax = 100;
var CreateClinicBody = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(createClinicBodySlugMin).max(createClinicBodySlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(createClinicBodyReferralCodeMax).nullish(),
  "adminId": zod.string().optional().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createClinicResponseOneSlugMin = 3;
var createClinicResponseOneSlugMax = 63;
var createClinicResponseOneReferralCodeMax = 100;
var CreateClinicResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(createClinicResponseOneSlugMin).max(createClinicResponseOneSlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(createClinicResponseOneReferralCodeMax).nullish(),
  "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "adminName": zod.string(),
  "createdAt": zod.coerce.date().nullable(),
  "doctorCount": zod.number().int().optional(),
  "branchCount": zod.number().int().optional()
}));
var GetClinicParams = zod.object({
  "id": zod.coerce.string()
});
var getClinicResponseOneSlugMin = 3;
var getClinicResponseOneSlugMax = 63;
var getClinicResponseOneReferralCodeMax = 100;
var GetClinicResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(getClinicResponseOneSlugMin).max(getClinicResponseOneSlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(getClinicResponseOneReferralCodeMax).nullish(),
  "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "adminName": zod.string(),
  "createdAt": zod.coerce.date().nullable(),
  "doctorCount": zod.number().int().optional(),
  "branchCount": zod.number().int().optional()
}));
var UpdateClinicParams = zod.object({
  "id": zod.coerce.string()
});
var updateClinicBodySlugMin = 3;
var updateClinicBodySlugMax = 63;
var updateClinicBodyReferralCodeMax = 100;
var UpdateClinicBody = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(updateClinicBodySlugMin).max(updateClinicBodySlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(updateClinicBodyReferralCodeMax).nullish(),
  "adminId": zod.string().optional().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updateClinicResponseOneSlugMin = 3;
var updateClinicResponseOneSlugMax = 63;
var updateClinicResponseOneReferralCodeMax = 100;
var UpdateClinicResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(updateClinicResponseOneSlugMin).max(updateClinicResponseOneSlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(updateClinicResponseOneReferralCodeMax).nullish(),
  "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "adminName": zod.string(),
  "createdAt": zod.coerce.date().nullable(),
  "doctorCount": zod.number().int().optional(),
  "branchCount": zod.number().int().optional()
}));
var DeleteClinicParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteClinicResponse = zod.void();
var listBranchesQuerySelectedIdsMax = 1e4;
var listBranchesQueryPageDefault = 1;
var listBranchesQueryPageSizeDefault = 20;
var listBranchesQueryPageSizeMax = 100;
var ListBranchesQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listBranchesQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "doctorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listBranchesQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listBranchesQueryPageSizeMax).default(listBranchesQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listBranchesResponseOneTotalMin = 0;
var listBranchesResponseTwoItemsItemOneSlugMin = 3;
var listBranchesResponseTwoItemsItemOneSlugMax = 63;
var listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin = 0;
var listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax = 6;
var listBranchesResponseTwoItemsItemOneOpeningHoursMax = 28;
var listBranchesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax = 1e3;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax = 240;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var ListBranchesResponse = zod.object({
  "total": zod.number().int().min(listBranchesResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "slug": zod.string().min(listBranchesResponseTwoItemsItemOneSlugMin).max(listBranchesResponseTwoItemsItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin).max(listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(listBranchesResponseTwoItemsItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(listBranchesResponseTwoItemsItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(listBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(listBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(listBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  })))
}));
var createBranchBodySlugMin = 3;
var createBranchBodySlugMax = 63;
var createBranchBodyOpeningHoursItemDayOfWeekMin = 0;
var createBranchBodyOpeningHoursItemDayOfWeekMax = 6;
var createBranchBodyOpeningHoursMax = 28;
var createBranchBodyTimezoneDefault = `Asia/Kolkata`;
var CreateBranchBody = zod.object({
  "slug": zod.string().min(createBranchBodySlugMin).max(createBranchBodySlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(createBranchBodyOpeningHoursItemDayOfWeekMin).max(createBranchBodyOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(createBranchBodyOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(createBranchBodyTimezoneDefault),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createBranchResponseOneSlugMin = 3;
var createBranchResponseOneSlugMax = 63;
var createBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var createBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var createBranchResponseOneOpeningHoursMax = 28;
var createBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var createBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var createBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var createBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var CreateBranchResponse = zod.object({
  "slug": zod.string().min(createBranchResponseOneSlugMin).max(createBranchResponseOneSlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(createBranchResponseOneOpeningHoursItemDayOfWeekMin).max(createBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(createBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(createBranchResponseOneTimezoneDefault),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": zod.object({
    "enabled": zod.boolean(),
    "doctorId": zod.string().optional(),
    "maxTokens": zod.number().int().min(1).max(createBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": zod.number().int().min(1).max(createBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": zod.string().regex(createBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": zod.string().nullish(),
  "effectivePhone": zod.string().nullish(),
  "id": zod.string(),
  "code": zod.string(),
  "clinicName": zod.string().optional(),
  "createdAt": zod.coerce.date().nullable()
}));
var GetBranchParams = zod.object({
  "id": zod.coerce.string()
});
var getBranchResponseOneSlugMin = 3;
var getBranchResponseOneSlugMax = 63;
var getBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var getBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var getBranchResponseOneOpeningHoursMax = 28;
var getBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var getBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var getBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var getBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var GetBranchResponse = zod.object({
  "slug": zod.string().min(getBranchResponseOneSlugMin).max(getBranchResponseOneSlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(getBranchResponseOneOpeningHoursItemDayOfWeekMin).max(getBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(getBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(getBranchResponseOneTimezoneDefault),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": zod.object({
    "enabled": zod.boolean(),
    "doctorId": zod.string().optional(),
    "maxTokens": zod.number().int().min(1).max(getBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": zod.number().int().min(1).max(getBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": zod.string().regex(getBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": zod.string().nullish(),
  "effectivePhone": zod.string().nullish(),
  "id": zod.string(),
  "code": zod.string(),
  "clinicName": zod.string().optional(),
  "createdAt": zod.coerce.date().nullable()
}));
var UpdateBranchParams = zod.object({
  "id": zod.coerce.string()
});
var updateBranchBodySlugMin = 3;
var updateBranchBodySlugMax = 63;
var updateBranchBodyOpeningHoursItemDayOfWeekMin = 0;
var updateBranchBodyOpeningHoursItemDayOfWeekMax = 6;
var updateBranchBodyOpeningHoursMax = 28;
var updateBranchBodyTimezoneDefault = `Asia/Kolkata`;
var UpdateBranchBody = zod.object({
  "slug": zod.string().min(updateBranchBodySlugMin).max(updateBranchBodySlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(updateBranchBodyOpeningHoursItemDayOfWeekMin).max(updateBranchBodyOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(updateBranchBodyOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(updateBranchBodyTimezoneDefault),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updateBranchResponseOneSlugMin = 3;
var updateBranchResponseOneSlugMax = 63;
var updateBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var updateBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var updateBranchResponseOneOpeningHoursMax = 28;
var updateBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var updateBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var updateBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var updateBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var UpdateBranchResponse = zod.object({
  "slug": zod.string().min(updateBranchResponseOneSlugMin).max(updateBranchResponseOneSlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(updateBranchResponseOneOpeningHoursItemDayOfWeekMin).max(updateBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(updateBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(updateBranchResponseOneTimezoneDefault),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": zod.object({
    "enabled": zod.boolean(),
    "doctorId": zod.string().optional(),
    "maxTokens": zod.number().int().min(1).max(updateBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": zod.number().int().min(1).max(updateBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": zod.string().regex(updateBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": zod.string().nullish(),
  "effectivePhone": zod.string().nullish(),
  "id": zod.string(),
  "code": zod.string(),
  "clinicName": zod.string().optional(),
  "createdAt": zod.coerce.date().nullable()
}));
var DeleteBranchParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteBranchResponse = zod.void();
var listDoctorsQuerySelectedIdsMax = 1e4;
var listDoctorsQueryPageDefault = 1;
var listDoctorsQueryPageSizeDefault = 20;
var listDoctorsQueryPageSizeMax = 100;
var ListDoctorsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listDoctorsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "managingAdminId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "specializationId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listDoctorsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listDoctorsQueryPageSizeMax).default(listDoctorsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listDoctorsResponseOneTotalMin = 0;
var listDoctorsResponseTwoItemsItemOneCountryMax = 100;
var listDoctorsResponseTwoItemsItemOneStateMax = 100;
var listDoctorsResponseTwoItemsItemOneCityMax = 100;
var listDoctorsResponseTwoItemsItemOnePincodeMax = 12;
var listDoctorsResponseTwoItemsItemOneAddressMax = 500;
var listDoctorsResponseTwoItemsItemOneExperienceYearsMin = 0;
var listDoctorsResponseTwoItemsItemOneConsultationFeeMin = 0;
var ListDoctorsResponse = zod.object({
  "total": zod.number().int().min(listDoctorsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "country": zod.string().max(listDoctorsResponseTwoItemsItemOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(listDoctorsResponseTwoItemsItemOneStateMax).optional(),
    "city": zod.string().max(listDoctorsResponseTwoItemsItemOneCityMax).optional(),
    "pincode": zod.string().max(listDoctorsResponseTwoItemsItemOnePincodeMax).optional(),
    "address": zod.string().max(listDoctorsResponseTwoItemsItemOneAddressMax).optional(),
    "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "photoUrl": zod.string().optional(),
    "gender": zod.string().optional(),
    "dateOfBirth": zod.coerce.date().optional(),
    "specializationId": zod.string().optional(),
    "qualificationIds": zod.array(zod.string()).optional(),
    "registrationNumber": zod.string().optional(),
    "experienceYears": zod.number().int().min(listDoctorsResponseTwoItemsItemOneExperienceYearsMin).optional(),
    "about": zod.string().optional(),
    "consultationFee": zod.number().min(listDoctorsResponseTwoItemsItemOneConsultationFeeMin).optional(),
    "languages": zod.array(zod.string()).optional(),
    "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
    "branchIds": zod.array(zod.string()).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "userId": zod.string(),
    "code": zod.string(),
    "managingAdminId": zod.string(),
    "managingAdminName": zod.string(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "createdAt": zod.coerce.date().nullable(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional()
  })))
}));
var createDoctorBodyCountryMax = 100;
var createDoctorBodyStateMax = 100;
var createDoctorBodyCityMax = 100;
var createDoctorBodyPincodeMax = 12;
var createDoctorBodyAddressMax = 500;
var createDoctorBodyExperienceYearsMin = 0;
var createDoctorBodyConsultationFeeMin = 0;
var CreateDoctorBody = zod.object({
  "country": zod.string().max(createDoctorBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createDoctorBodyStateMax).optional(),
  "city": zod.string().max(createDoctorBodyCityMax).optional(),
  "pincode": zod.string().max(createDoctorBodyPincodeMax).optional(),
  "address": zod.string().max(createDoctorBodyAddressMax).optional(),
  "ownerAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().optional(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(createDoctorBodyExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(createDoctorBodyConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createDoctorResponseOneCountryMax = 100;
var createDoctorResponseOneStateMax = 100;
var createDoctorResponseOneCityMax = 100;
var createDoctorResponseOnePincodeMax = 12;
var createDoctorResponseOneAddressMax = 500;
var createDoctorResponseOneExperienceYearsMin = 0;
var createDoctorResponseOneConsultationFeeMin = 0;
var CreateDoctorResponse = zod.object({
  "country": zod.string().max(createDoctorResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createDoctorResponseOneStateMax).optional(),
  "city": zod.string().max(createDoctorResponseOneCityMax).optional(),
  "pincode": zod.string().max(createDoctorResponseOnePincodeMax).optional(),
  "address": zod.string().max(createDoctorResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().optional(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(createDoctorResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(createDoctorResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var GetDoctorParams = zod.object({
  "id": zod.coerce.string()
});
var getDoctorResponseOneCountryMax = 100;
var getDoctorResponseOneStateMax = 100;
var getDoctorResponseOneCityMax = 100;
var getDoctorResponseOnePincodeMax = 12;
var getDoctorResponseOneAddressMax = 500;
var getDoctorResponseOneExperienceYearsMin = 0;
var getDoctorResponseOneConsultationFeeMin = 0;
var GetDoctorResponse = zod.object({
  "country": zod.string().max(getDoctorResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(getDoctorResponseOneStateMax).optional(),
  "city": zod.string().max(getDoctorResponseOneCityMax).optional(),
  "pincode": zod.string().max(getDoctorResponseOnePincodeMax).optional(),
  "address": zod.string().max(getDoctorResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().optional(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(getDoctorResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(getDoctorResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var UpdateDoctorParams = zod.object({
  "id": zod.coerce.string()
});
var updateDoctorBodyCountryMax = 100;
var updateDoctorBodyStateMax = 100;
var updateDoctorBodyCityMax = 100;
var updateDoctorBodyPincodeMax = 12;
var updateDoctorBodyAddressMax = 500;
var updateDoctorBodyExperienceYearsMin = 0;
var updateDoctorBodyConsultationFeeMin = 0;
var UpdateDoctorBody = zod.object({
  "country": zod.string().max(updateDoctorBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateDoctorBodyStateMax).optional(),
  "city": zod.string().max(updateDoctorBodyCityMax).optional(),
  "pincode": zod.string().max(updateDoctorBodyPincodeMax).optional(),
  "address": zod.string().max(updateDoctorBodyAddressMax).optional(),
  "ownerAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().optional(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(updateDoctorBodyExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(updateDoctorBodyConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updateDoctorResponseOneCountryMax = 100;
var updateDoctorResponseOneStateMax = 100;
var updateDoctorResponseOneCityMax = 100;
var updateDoctorResponseOnePincodeMax = 12;
var updateDoctorResponseOneAddressMax = 500;
var updateDoctorResponseOneExperienceYearsMin = 0;
var updateDoctorResponseOneConsultationFeeMin = 0;
var UpdateDoctorResponse = zod.object({
  "country": zod.string().max(updateDoctorResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateDoctorResponseOneStateMax).optional(),
  "city": zod.string().max(updateDoctorResponseOneCityMax).optional(),
  "pincode": zod.string().max(updateDoctorResponseOnePincodeMax).optional(),
  "address": zod.string().max(updateDoctorResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().optional(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(updateDoctorResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(updateDoctorResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var DeleteDoctorParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteDoctorResponse = zod.void();
var listUsersQueryPageDefault = 1;
var listUsersQueryPageSizeDefault = 20;
var listUsersQueryPageSizeMax = 100;
var ListUsersQueryParams = zod.object({
  "linkedOnly": zod.coerce.boolean().optional(),
  "search": zod.coerce.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "managingAdminId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listUsersQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listUsersQueryPageSizeMax).default(listUsersQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listUsersResponseOneTotalMin = 0;
var listUsersResponseTwoItemsItemOneCountryMax = 100;
var listUsersResponseTwoItemsItemOneStateMax = 100;
var listUsersResponseTwoItemsItemOneCityMax = 100;
var listUsersResponseTwoItemsItemOnePincodeMax = 12;
var listUsersResponseTwoItemsItemOneAddressMax = 500;
var ListUsersResponse = zod.object({
  "total": zod.number().int().min(listUsersResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "country": zod.string().max(listUsersResponseTwoItemsItemOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(listUsersResponseTwoItemsItemOneStateMax).optional(),
    "city": zod.string().max(listUsersResponseTwoItemsItemOneCityMax).optional(),
    "pincode": zod.string().max(listUsersResponseTwoItemsItemOnePincodeMax).optional(),
    "address": zod.string().max(listUsersResponseTwoItemsItemOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })))
}));
var createUserBodyCountryMax = 100;
var createUserBodyStateMax = 100;
var createUserBodyCityMax = 100;
var createUserBodyPincodeMax = 12;
var createUserBodyAddressMax = 500;
var CreateUserBody = zod.object({
  "country": zod.string().max(createUserBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createUserBodyStateMax).optional(),
  "city": zod.string().max(createUserBodyCityMax).optional(),
  "pincode": zod.string().max(createUserBodyPincodeMax).optional(),
  "address": zod.string().max(createUserBodyAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()).optional(),
  "managingAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
});
var createUserResponseOneCountryMax = 100;
var createUserResponseOneStateMax = 100;
var createUserResponseOneCityMax = 100;
var createUserResponseOnePincodeMax = 12;
var createUserResponseOneAddressMax = 500;
var CreateUserResponse = zod.object({
  "country": zod.string().max(createUserResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createUserResponseOneStateMax).optional(),
  "city": zod.string().max(createUserResponseOneCityMax).optional(),
  "pincode": zod.string().max(createUserResponseOnePincodeMax).optional(),
  "address": zod.string().max(createUserResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var onboardClinicAdminBodyBranchesItemSlugMin = 3;
var onboardClinicAdminBodyBranchesItemSlugMax = 63;
var onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var onboardClinicAdminBodyBranchesItemOpeningHoursMax = 28;
var onboardClinicAdminBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyBranchesMax = 30;
var onboardClinicAdminBodyPoliciesBookingHorizonDaysMax = 365;
var onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMin = 0;
var onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMax = 10080;
var onboardClinicAdminBodyOwnerScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyOwnerScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyOwnerScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyOwnerCustomScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyOwnerCustomScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyOwnerCustomScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMin = 0;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMax = 49;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMin = 0;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMax = 6;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemStartTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemEndTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsMax = 500;
var onboardClinicAdminBodyClinicSlugMin = 3;
var onboardClinicAdminBodyClinicSlugMax = 63;
var onboardClinicAdminBodyClinicReferralCodeMax = 100;
var onboardClinicAdminBodyClinicTimezoneDefault = `Asia/Kolkata`;
var OnboardClinicAdminBody = zod.object({
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(onboardClinicAdminBodyBranchesItemSlugMin).max(onboardClinicAdminBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(onboardClinicAdminBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(onboardClinicAdminBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(onboardClinicAdminBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(onboardClinicAdminBodyBranchesMax).optional(),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(onboardClinicAdminBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMin).max(onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional(),
  "ownDoctor": zod.boolean().optional(),
  "ownerSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(onboardClinicAdminBodyOwnerScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"])
  }).optional(),
  "ownerCustomSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerCustomScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerCustomScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]),
    "sessions": zod.array(zod.object({
      "branchIndex": zod.number().int().min(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMin).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMax),
      "dayOfWeek": zod.number().int().min(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMin).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMax),
      "startTime": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemStartTimeRegExp),
      "endTime": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemEndTimeRegExp)
    })).min(1).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsMax)
  }).optional().describe("Custom weekly consultation intervals entered once during onboarding/registration with the shared weekly editor. Saved in the same transaction after the owner's doctor profile is created. Mutually exclusive with ownerSchedule (linked)."),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "admin": zod.object({
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional()
  }),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(onboardClinicAdminBodyClinicSlugMin).max(onboardClinicAdminBodyClinicSlugMax).optional(),
    "categoryId": zod.string().optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(onboardClinicAdminBodyClinicReferralCodeMax).nullish(),
    "name": zod.string().min(1),
    "code": zod.string().optional(),
    "phone": zod.string().optional(),
    "email": zod.string().email().optional(),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "timezone": zod.string().default(onboardClinicAdminBodyClinicTimezoneDefault)
  })
});
var onboardClinicAdminResponseBranchesItemOneSlugMin = 3;
var onboardClinicAdminResponseBranchesItemOneSlugMax = 63;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursMax = 28;
var onboardClinicAdminResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminResponseAdminOneCountryMax = 100;
var onboardClinicAdminResponseAdminOneStateMax = 100;
var onboardClinicAdminResponseAdminOneCityMax = 100;
var onboardClinicAdminResponseAdminOnePincodeMax = 12;
var onboardClinicAdminResponseAdminOneAddressMax = 500;
var onboardClinicAdminResponseClinicOneSlugMin = 3;
var onboardClinicAdminResponseClinicOneSlugMax = 63;
var onboardClinicAdminResponseClinicOneReferralCodeMax = 100;
var OnboardClinicAdminResponse = zod.object({
  "branches": zod.array(zod.object({
    "slug": zod.string().min(onboardClinicAdminResponseBranchesItemOneSlugMin).max(onboardClinicAdminResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(onboardClinicAdminResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(onboardClinicAdminResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))).optional(),
  "doctorId": zod.string().nullish(),
  "admin": zod.object({
    "country": zod.string().max(onboardClinicAdminResponseAdminOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(onboardClinicAdminResponseAdminOneStateMax).optional(),
    "city": zod.string().max(onboardClinicAdminResponseAdminOneCityMax).optional(),
    "pincode": zod.string().max(onboardClinicAdminResponseAdminOnePincodeMax).optional(),
    "address": zod.string().max(onboardClinicAdminResponseAdminOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(onboardClinicAdminResponseClinicOneSlugMin).max(onboardClinicAdminResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(onboardClinicAdminResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  }))
});
var GetUserParams = zod.object({
  "id": zod.coerce.string()
});
var getUserResponseOneCountryMax = 100;
var getUserResponseOneStateMax = 100;
var getUserResponseOneCityMax = 100;
var getUserResponseOnePincodeMax = 12;
var getUserResponseOneAddressMax = 500;
var GetUserResponse = zod.object({
  "country": zod.string().max(getUserResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(getUserResponseOneStateMax).optional(),
  "city": zod.string().max(getUserResponseOneCityMax).optional(),
  "pincode": zod.string().max(getUserResponseOnePincodeMax).optional(),
  "address": zod.string().max(getUserResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var UpdateUserParams = zod.object({
  "id": zod.coerce.string()
});
var updateUserBodyCountryMax = 100;
var updateUserBodyStateMax = 100;
var updateUserBodyCityMax = 100;
var updateUserBodyPincodeMax = 12;
var updateUserBodyAddressMax = 500;
var UpdateUserBody = zod.object({
  "country": zod.string().max(updateUserBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateUserBodyStateMax).optional(),
  "city": zod.string().max(updateUserBodyCityMax).optional(),
  "pincode": zod.string().max(updateUserBodyPincodeMax).optional(),
  "address": zod.string().max(updateUserBodyAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()).optional(),
  "managingAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
});
var updateUserResponseOneCountryMax = 100;
var updateUserResponseOneStateMax = 100;
var updateUserResponseOneCityMax = 100;
var updateUserResponseOnePincodeMax = 12;
var updateUserResponseOneAddressMax = 500;
var UpdateUserResponse = zod.object({
  "country": zod.string().max(updateUserResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateUserResponseOneStateMax).optional(),
  "city": zod.string().max(updateUserResponseOneCityMax).optional(),
  "pincode": zod.string().max(updateUserResponseOnePincodeMax).optional(),
  "address": zod.string().max(updateUserResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var DeleteUserParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteUserResponse = zod.void();
var RequestUserPasswordResetParams = zod.object({
  "id": zod.coerce.string()
});
var RequestUserPasswordResetResponse = zod.object({
  "message": zod.string()
});
var ResendUserInvitationParams = zod.object({
  "id": zod.coerce.string()
});
var resendUserInvitationResponseOneCountryMax = 100;
var resendUserInvitationResponseOneStateMax = 100;
var resendUserInvitationResponseOneCityMax = 100;
var resendUserInvitationResponseOnePincodeMax = 12;
var resendUserInvitationResponseOneAddressMax = 500;
var ResendUserInvitationResponse = zod.object({
  "country": zod.string().max(resendUserInvitationResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(resendUserInvitationResponseOneStateMax).optional(),
  "city": zod.string().max(resendUserInvitationResponseOneCityMax).optional(),
  "pincode": zod.string().max(resendUserInvitationResponseOnePincodeMax).optional(),
  "address": zod.string().max(resendUserInvitationResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var getStaffAssignmentOptionsQuerySortDefault = `name`;
var getStaffAssignmentOptionsQueryPageDefault = 1;
var getStaffAssignmentOptionsQueryPageSizeDefault = 20;
var getStaffAssignmentOptionsQueryPageSizeMax = 100;
var getStaffAssignmentOptionsQuerySelectedIdsMax = 1e4;
var GetStaffAssignmentOptionsQueryParams = zod.object({
  "targetRole": zod.enum(["doctor", "receptionist"]),
  "sort": zod.enum(["name", "-name", "createdAt", "-createdAt"]).default(getStaffAssignmentOptionsQuerySortDefault).describe("Server ordering within each authorized clinic and branch catalog. ID in the selected direction breaks ties."),
  "doctorId": zod.coerce.string().optional().describe("Existing doctor being edited."),
  "userId": zod.coerce.string().optional().describe("Existing receptionist being edited."),
  "managingAdminId": zod.coerce.string().optional().describe("Narrows the catalog owner; cannot override an actor or edited staff owner."),
  "search": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(getStaffAssignmentOptionsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(getStaffAssignmentOptionsQueryPageSizeMax).default(getStaffAssignmentOptionsQueryPageSizeDefault),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "selectedIds": zod.coerce.string().max(getStaffAssignmentOptionsQuerySelectedIdsMax).optional().describe("Comma-separated IDs to resolve within the authorized catalog (maximum 100).")
});
var getStaffAssignmentOptionsResponseClinicsItemOneSlugMin = 3;
var getStaffAssignmentOptionsResponseClinicsItemOneSlugMax = 63;
var getStaffAssignmentOptionsResponseClinicsItemOneReferralCodeMax = 100;
var getStaffAssignmentOptionsResponseBranchesItemOneSlugMin = 3;
var getStaffAssignmentOptionsResponseBranchesItemOneSlugMax = 63;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursMax = 28;
var getStaffAssignmentOptionsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getStaffAssignmentOptionsResponsePaginationClinicsTotalMin = 0;
var getStaffAssignmentOptionsResponsePaginationBranchesTotalMin = 0;
var GetStaffAssignmentOptionsResponse = zod.object({
  "clinics": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(getStaffAssignmentOptionsResponseClinicsItemOneSlugMin).max(getStaffAssignmentOptionsResponseClinicsItemOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(getStaffAssignmentOptionsResponseClinicsItemOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  }))),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(getStaffAssignmentOptionsResponseBranchesItemOneSlugMin).max(getStaffAssignmentOptionsResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(getStaffAssignmentOptionsResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "managingAdmins": zod.array(zod.object({
    "id": zod.string(),
    "fullName": zod.string()
  })),
  "pagination": zod.object({
    "clinics": zod.object({
      "total": zod.number().int().min(getStaffAssignmentOptionsResponsePaginationClinicsTotalMin),
      "page": zod.number().int(),
      "pageSize": zod.number().int(),
      "totalPages": zod.number().int().optional()
    }).optional(),
    "branches": zod.object({
      "total": zod.number().int().min(getStaffAssignmentOptionsResponsePaginationBranchesTotalMin),
      "page": zod.number().int(),
      "pageSize": zod.number().int(),
      "totalPages": zod.number().int().optional()
    }).optional()
  }).optional()
});
var listPatientsQueryPageDefault = 1;
var listPatientsQueryPageSizeDefault = 20;
var listPatientsQueryPageSizeMax = 100;
var ListPatientsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "gender": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPatientsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPatientsQueryPageSizeMax).default(listPatientsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listPatientsResponseOneTotalMin = 0;
var listPatientsResponseTwoItemsItemOneCountryMax = 100;
var listPatientsResponseTwoItemsItemOneStateMax = 100;
var listPatientsResponseTwoItemsItemOneCityMax = 100;
var listPatientsResponseTwoItemsItemOnePincodeMax = 12;
var listPatientsResponseTwoItemsItemOneAgeMin = 0;
var listPatientsResponseTwoItemsItemOneAgeMax = 130;
var ListPatientsResponse = zod.object({
  "total": zod.number().int().min(listPatientsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "country": zod.string().max(listPatientsResponseTwoItemsItemOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(listPatientsResponseTwoItemsItemOneStateMax).optional(),
    "city": zod.string().max(listPatientsResponseTwoItemsItemOneCityMax).optional(),
    "pincode": zod.string().max(listPatientsResponseTwoItemsItemOnePincodeMax).optional(),
    "fullName": zod.string().min(1),
    "mobile": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "dateOfBirth": zod.coerce.date().optional(),
    "age": zod.number().int().min(listPatientsResponseTwoItemsItemOneAgeMin).max(listPatientsResponseTwoItemsItemOneAgeMax).optional(),
    "gender": zod.string().optional(),
    "address": zod.string().optional(),
    "emergencyContactName": zod.string().optional(),
    "emergencyContactPhone": zod.string().optional(),
    "clinicId": zod.string().optional(),
    "branchId": zod.string().optional(),
    "status": zod.enum(["active", "inactive"]).optional()
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "userId": zod.string().nullish(),
    "mobileVerified": zod.boolean(),
    "createdAt": zod.coerce.date()
  })))
}));
var createPatientBodyCountryMax = 100;
var createPatientBodyStateMax = 100;
var createPatientBodyCityMax = 100;
var createPatientBodyPincodeMax = 12;
var createPatientBodyAgeMin = 0;
var createPatientBodyAgeMax = 130;
var CreatePatientBody = zod.object({
  "country": zod.string().max(createPatientBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createPatientBodyStateMax).optional(),
  "city": zod.string().max(createPatientBodyCityMax).optional(),
  "pincode": zod.string().max(createPatientBodyPincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().optional(),
  "age": zod.number().int().min(createPatientBodyAgeMin).max(createPatientBodyAgeMax).optional(),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createPatientResponseOneCountryMax = 100;
var createPatientResponseOneStateMax = 100;
var createPatientResponseOneCityMax = 100;
var createPatientResponseOnePincodeMax = 12;
var createPatientResponseOneAgeMin = 0;
var createPatientResponseOneAgeMax = 130;
var CreatePatientResponse = zod.object({
  "country": zod.string().max(createPatientResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createPatientResponseOneStateMax).optional(),
  "city": zod.string().max(createPatientResponseOneCityMax).optional(),
  "pincode": zod.string().max(createPatientResponseOnePincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().optional(),
  "age": zod.number().int().min(createPatientResponseOneAgeMin).max(createPatientResponseOneAgeMax).optional(),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "userId": zod.string().nullish(),
  "mobileVerified": zod.boolean(),
  "createdAt": zod.coerce.date()
}));
var GetPatientParams = zod.object({
  "id": zod.coerce.string()
});
var getPatientResponseOneCountryMax = 100;
var getPatientResponseOneStateMax = 100;
var getPatientResponseOneCityMax = 100;
var getPatientResponseOnePincodeMax = 12;
var getPatientResponseOneAgeMin = 0;
var getPatientResponseOneAgeMax = 130;
var GetPatientResponse = zod.object({
  "country": zod.string().max(getPatientResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(getPatientResponseOneStateMax).optional(),
  "city": zod.string().max(getPatientResponseOneCityMax).optional(),
  "pincode": zod.string().max(getPatientResponseOnePincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().optional(),
  "age": zod.number().int().min(getPatientResponseOneAgeMin).max(getPatientResponseOneAgeMax).optional(),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "userId": zod.string().nullish(),
  "mobileVerified": zod.boolean(),
  "createdAt": zod.coerce.date()
}));
var UpdatePatientParams = zod.object({
  "id": zod.coerce.string()
});
var updatePatientBodyCountryMax = 100;
var updatePatientBodyStateMax = 100;
var updatePatientBodyCityMax = 100;
var updatePatientBodyPincodeMax = 12;
var updatePatientBodyAgeMin = 0;
var updatePatientBodyAgeMax = 130;
var UpdatePatientBody = zod.object({
  "country": zod.string().max(updatePatientBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updatePatientBodyStateMax).optional(),
  "city": zod.string().max(updatePatientBodyCityMax).optional(),
  "pincode": zod.string().max(updatePatientBodyPincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().optional(),
  "age": zod.number().int().min(updatePatientBodyAgeMin).max(updatePatientBodyAgeMax).optional(),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updatePatientResponseOneCountryMax = 100;
var updatePatientResponseOneStateMax = 100;
var updatePatientResponseOneCityMax = 100;
var updatePatientResponseOnePincodeMax = 12;
var updatePatientResponseOneAgeMin = 0;
var updatePatientResponseOneAgeMax = 130;
var UpdatePatientResponse = zod.object({
  "country": zod.string().max(updatePatientResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updatePatientResponseOneStateMax).optional(),
  "city": zod.string().max(updatePatientResponseOneCityMax).optional(),
  "pincode": zod.string().max(updatePatientResponseOnePincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().optional(),
  "age": zod.number().int().min(updatePatientResponseOneAgeMin).max(updatePatientResponseOneAgeMax).optional(),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "userId": zod.string().nullish(),
  "mobileVerified": zod.boolean(),
  "createdAt": zod.coerce.date()
}));
var DeletePatientParams = zod.object({
  "id": zod.coerce.string()
});
var DeletePatientResponse = zod.void();
var listMastersQueryPageDefault = 1;
var listMastersQueryPageSizeDefault = 20;
var listMastersQueryPageSizeMax = 100;
var ListMastersQueryParams = zod.object({
  "category": zod.coerce.string().optional(),
  "parentId": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listMastersQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listMastersQueryPageSizeMax).default(listMastersQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listMastersResponseOneTotalMin = 0;
var ListMastersResponse = zod.object({
  "total": zod.number().int().min(listMastersResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
    "name": zod.string().min(1),
    "code": zod.string().min(1),
    "parentId": zod.string().nullish(),
    "sortOrder": zod.number().int().optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string()
  })))
}));
var CreateMasterBody = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var CreateMasterResponse = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string()
}));
var GetMasterParams = zod.object({
  "id": zod.coerce.string()
});
var GetMasterResponse = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string()
}));
var UpdateMasterParams = zod.object({
  "id": zod.coerce.string()
});
var UpdateMasterBody = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var UpdateMasterResponse = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string()
}));
var DeleteMasterParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteMasterResponse = zod.void();
var listSchedulesQueryDayOfWeekMin = 0;
var listSchedulesQueryDayOfWeekMax = 6;
var listSchedulesQueryWeekdayMin = 0;
var listSchedulesQueryWeekdayMax = 6;
var listSchedulesQueryPageDefault = 1;
var listSchedulesQueryPageSizeDefault = 20;
var listSchedulesQueryPageSizeMax = 100;
var ListSchedulesQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "dayOfWeek": zod.coerce.number().int().min(listSchedulesQueryDayOfWeekMin).max(listSchedulesQueryDayOfWeekMax).optional(),
  "weekday": zod.coerce.number().int().min(listSchedulesQueryWeekdayMin).max(listSchedulesQueryWeekdayMax).optional().describe("Alias for dayOfWeek"),
  "doctorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listSchedulesQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listSchedulesQueryPageSizeMax).default(listSchedulesQueryPageSizeDefault)
});
var listSchedulesResponseOneTotalMin = 0;
var listSchedulesResponseTwoItemsItemOneExpectedSnapshotMax = 2e4;
var listSchedulesResponseTwoItemsItemOneDayOfWeekMin = 0;
var listSchedulesResponseTwoItemsItemOneDayOfWeekMax = 6;
var listSchedulesResponseTwoItemsItemOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var listSchedulesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listSchedulesResponseTwoItemsItemOneTokenPrefixMax = 8;
var listSchedulesResponseTwoItemsItemOneMaxTokensMax = 1e3;
var listSchedulesResponseTwoItemsItemOneBufferMinutesDefault = 0;
var listSchedulesResponseTwoItemsItemOneBufferMinutesMin = 0;
var listSchedulesResponseTwoItemsItemOneBufferMinutesMax = 1440;
var listSchedulesResponseTwoItemsItemOneQueueModeDefault = `mixed`;
var ListSchedulesResponse = zod.object({
  "total": zod.number().int().min(listSchedulesResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "expectedSnapshot": zod.string().max(listSchedulesResponseTwoItemsItemOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "dayOfWeek": zod.number().int().min(listSchedulesResponseTwoItemsItemOneDayOfWeekMin).max(listSchedulesResponseTwoItemsItemOneDayOfWeekMax).describe("Sunday is 0"),
    "isOpen": zod.boolean(),
    "startTime": zod.string().regex(listSchedulesResponseTwoItemsItemOneStartTimeRegExp),
    "endTime": zod.string(),
    "breakStart": zod.string().nullish(),
    "breakEnd": zod.string().nullish(),
    "timezone": zod.string().default(listSchedulesResponseTwoItemsItemOneTimezoneDefault),
    "tokenPrefix": zod.string().min(1).max(listSchedulesResponseTwoItemsItemOneTokenPrefixMax),
    "maxTokens": zod.number().int().min(1).max(listSchedulesResponseTwoItemsItemOneMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1),
    "bufferMinutes": zod.number().int().min(listSchedulesResponseTwoItemsItemOneBufferMinutesMin).max(listSchedulesResponseTwoItemsItemOneBufferMinutesMax).default(listSchedulesResponseTwoItemsItemOneBufferMinutesDefault),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(listSchedulesResponseTwoItemsItemOneQueueModeDefault),
    "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
    "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "doctorName": zod.string().optional(),
    "clinicName": zod.string().optional(),
    "branchName": zod.string().optional()
  })))
}));
var createScheduleBodyExpectedSnapshotMax = 2e4;
var createScheduleBodyDayOfWeekMin = 0;
var createScheduleBodyDayOfWeekMax = 6;
var createScheduleBodyStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var createScheduleBodyTimezoneDefault = `Asia/Kolkata`;
var createScheduleBodyTokenPrefixMax = 8;
var createScheduleBodyMaxTokensMax = 1e3;
var createScheduleBodyBufferMinutesDefault = 0;
var createScheduleBodyBufferMinutesMin = 0;
var createScheduleBodyBufferMinutesMax = 1440;
var createScheduleBodyQueueModeDefault = `mixed`;
var CreateScheduleBody = zod.object({
  "expectedSnapshot": zod.string().max(createScheduleBodyExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(createScheduleBodyDayOfWeekMin).max(createScheduleBodyDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(createScheduleBodyStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(createScheduleBodyTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(createScheduleBodyTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(createScheduleBodyMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(createScheduleBodyBufferMinutesMin).max(createScheduleBodyBufferMinutesMax).default(createScheduleBodyBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(createScheduleBodyQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
});
var createScheduleResponseOneExpectedSnapshotMax = 2e4;
var createScheduleResponseOneDayOfWeekMin = 0;
var createScheduleResponseOneDayOfWeekMax = 6;
var createScheduleResponseOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var createScheduleResponseOneTimezoneDefault = `Asia/Kolkata`;
var createScheduleResponseOneTokenPrefixMax = 8;
var createScheduleResponseOneMaxTokensMax = 1e3;
var createScheduleResponseOneBufferMinutesDefault = 0;
var createScheduleResponseOneBufferMinutesMin = 0;
var createScheduleResponseOneBufferMinutesMax = 1440;
var createScheduleResponseOneQueueModeDefault = `mixed`;
var CreateScheduleResponse = zod.object({
  "expectedSnapshot": zod.string().max(createScheduleResponseOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(createScheduleResponseOneDayOfWeekMin).max(createScheduleResponseOneDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(createScheduleResponseOneStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(createScheduleResponseOneTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(createScheduleResponseOneTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(createScheduleResponseOneMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(createScheduleResponseOneBufferMinutesMin).max(createScheduleResponseOneBufferMinutesMax).default(createScheduleResponseOneBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(createScheduleResponseOneQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "doctorName": zod.string().optional(),
  "clinicName": zod.string().optional(),
  "branchName": zod.string().optional()
}));
var UpdateScheduleParams = zod.object({
  "id": zod.coerce.string()
});
var updateScheduleBodyExpectedSnapshotMax = 2e4;
var updateScheduleBodyDayOfWeekMin = 0;
var updateScheduleBodyDayOfWeekMax = 6;
var updateScheduleBodyStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var updateScheduleBodyTimezoneDefault = `Asia/Kolkata`;
var updateScheduleBodyTokenPrefixMax = 8;
var updateScheduleBodyMaxTokensMax = 1e3;
var updateScheduleBodyBufferMinutesDefault = 0;
var updateScheduleBodyBufferMinutesMin = 0;
var updateScheduleBodyBufferMinutesMax = 1440;
var updateScheduleBodyQueueModeDefault = `mixed`;
var UpdateScheduleBody = zod.object({
  "expectedSnapshot": zod.string().max(updateScheduleBodyExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(updateScheduleBodyDayOfWeekMin).max(updateScheduleBodyDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(updateScheduleBodyStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(updateScheduleBodyTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(updateScheduleBodyTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(updateScheduleBodyMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(updateScheduleBodyBufferMinutesMin).max(updateScheduleBodyBufferMinutesMax).default(updateScheduleBodyBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(updateScheduleBodyQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
});
var updateScheduleResponseOneExpectedSnapshotMax = 2e4;
var updateScheduleResponseOneDayOfWeekMin = 0;
var updateScheduleResponseOneDayOfWeekMax = 6;
var updateScheduleResponseOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var updateScheduleResponseOneTimezoneDefault = `Asia/Kolkata`;
var updateScheduleResponseOneTokenPrefixMax = 8;
var updateScheduleResponseOneMaxTokensMax = 1e3;
var updateScheduleResponseOneBufferMinutesDefault = 0;
var updateScheduleResponseOneBufferMinutesMin = 0;
var updateScheduleResponseOneBufferMinutesMax = 1440;
var updateScheduleResponseOneQueueModeDefault = `mixed`;
var UpdateScheduleResponse = zod.object({
  "expectedSnapshot": zod.string().max(updateScheduleResponseOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(updateScheduleResponseOneDayOfWeekMin).max(updateScheduleResponseOneDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(updateScheduleResponseOneStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(updateScheduleResponseOneTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(updateScheduleResponseOneTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(updateScheduleResponseOneMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(updateScheduleResponseOneBufferMinutesMin).max(updateScheduleResponseOneBufferMinutesMax).default(updateScheduleResponseOneBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(updateScheduleResponseOneQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "doctorName": zod.string().optional(),
  "clinicName": zod.string().optional(),
  "branchName": zod.string().optional()
}));
var DeleteScheduleParams = zod.object({
  "id": zod.coerce.string()
});
var deleteScheduleQueryExpectedSnapshotMax = 2e4;
var DeleteScheduleQueryParams = zod.object({
  "expectedSnapshot": zod.coerce.string().max(deleteScheduleQueryExpectedSnapshotMax).optional().describe("Optional loaded schedule authoring snapshot. Compared after acquiring doctor locks; stale changes return 409. Deactivation retains history.")
});
var DeleteScheduleResponse = zod.void();
var listAvailabilityExceptionsQueryPageDefault = 1;
var listAvailabilityExceptionsQueryPageSizeDefault = 20;
var listAvailabilityExceptionsQueryPageSizeMax = 100;
var ListAvailabilityExceptionsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "date": zod.date().optional(),
  "doctorId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "page": zod.coerce.number().int().min(1).default(listAvailabilityExceptionsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listAvailabilityExceptionsQueryPageSizeMax).default(listAvailabilityExceptionsQueryPageSizeDefault)
});
var listAvailabilityExceptionsResponseOneTotalMin = 0;
var listAvailabilityExceptionsResponseTwoItemsItemOneMaxTokensMax = 1e3;
var ListAvailabilityExceptionsResponse = zod.object({
  "total": zod.number().int().min(listAvailabilityExceptionsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "doctorId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "isClosed": zod.boolean(),
    "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
    "reason": zod.string(),
    "startTime": zod.string().nullish(),
    "endTime": zod.string().nullish(),
    "breakStart": zod.string().nullish(),
    "breakEnd": zod.string().nullish(),
    "maxTokens": zod.number().int().min(1).max(listAvailabilityExceptionsResponseTwoItemsItemOneMaxTokensMax).nullish()
  }).and(zod.object({
    "id": zod.string()
  })))
}));
var createAvailabilityExceptionBodyMaxTokensMax = 1e3;
var CreateAvailabilityExceptionBody = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(createAvailabilityExceptionBodyMaxTokensMax).nullish()
});
var createAvailabilityExceptionResponseOneMaxTokensMax = 1e3;
var CreateAvailabilityExceptionResponse = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(createAvailabilityExceptionResponseOneMaxTokensMax).nullish()
}).and(zod.object({
  "id": zod.string()
}));
var UpdateAvailabilityExceptionParams = zod.object({
  "id": zod.coerce.string()
});
var updateAvailabilityExceptionBodyMaxTokensMax = 1e3;
var UpdateAvailabilityExceptionBody = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(updateAvailabilityExceptionBodyMaxTokensMax).nullish()
});
var updateAvailabilityExceptionResponseOneMaxTokensMax = 1e3;
var UpdateAvailabilityExceptionResponse = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(updateAvailabilityExceptionResponseOneMaxTokensMax).nullish()
}).and(zod.object({
  "id": zod.string()
}));
var DeleteAvailabilityExceptionParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteAvailabilityExceptionResponse = zod.void();
var listAppointmentsQueryPageDefault = 1;
var listAppointmentsQueryPageSizeDefault = 20;
var listAppointmentsQueryPageSizeMax = 100;
var ListAppointmentsQueryParams = zod.object({
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "statusGroup": zod.enum(["active", "waiting", "absent", "completed", "cancelled", "all"]).optional().describe("Server-side group filter applied before pagination; intersects with status when both supplied"),
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "patientId": zod.coerce.string().optional(),
  "date": zod.date().optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listAppointmentsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listAppointmentsQueryPageSizeMax).default(listAppointmentsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listAppointmentsResponseOneTotalMin = 0;
var listAppointmentsResponseTwoItemsItemOneNotesMax = 1e3;
var ListAppointmentsResponse = zod.object({
  "total": zod.number().int().min(listAppointmentsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "statusCounts": zod.object({
    "active": zod.number().int().optional(),
    "waiting": zod.number().int().optional(),
    "absent": zod.number().int().optional(),
    "completed": zod.number().int().optional(),
    "cancelled": zod.number().int().optional(),
    "all": zod.number().int().optional()
  }).optional(),
  "items": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(listAppointmentsResponseTwoItemsItemOneNotesMax).optional()
  }).and(zod.object({
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional()
  })))
}));
var createAppointmentBodyNotesMax = 1e3;
var CreateAppointmentBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(createAppointmentBodyNotesMax).optional()
});
var createAppointmentResponseOneNotesMax = 1e3;
var CreateAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(createAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional()
}));
var GetTicketEmailPreviewParams = zod.object({
  "id": zod.coerce.string()
});
var GetTicketEmailPreviewResponse = zod.object({
  "recipient": zod.string(),
  "eligible": zod.boolean(),
  "reason": zod.string()
});
var SendTicketEmailParams = zod.object({
  "id": zod.coerce.string()
});
var SendTicketEmailBody = zod.object({
  "requestId": zod.string().uuid(),
  "recipient": zod.string().email()
});
var SendTicketEmailResponse = zod.object({
  "state": zod.enum(["provider_accepted", "unknown"])
});
var GetAppointmentCalendarQueryParams = zod.object({
  "from": zod.date(),
  "to": zod.date(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "status": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional()
});
var GetAppointmentCalendarResponse = zod.object({
  "days": zod.array(zod.object({
    "date": zod.string(),
    "total": zod.number().int(),
    "byStatus": zod.record(zod.string(), zod.number().int())
  })),
  "total": zod.number().int()
});
var GetAppointmentParams = zod.object({
  "id": zod.coerce.string()
});
var getAppointmentResponseOneNotesMax = 1e3;
var GetAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(getAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional()
}));
var GetAppointmentQrParams = zod.object({
  "id": zod.coerce.string()
});
var GetAppointmentQrResponse = zod.object({
  "appointmentId": zod.string(),
  "payload": zod.string(),
  "checkInUrl": zod.string()
});
var ResolveAppointmentQrBody = zod.object({
  "payload": zod.string().min(1)
});
var resolveAppointmentQrResponseAppointmentOneNotesMax = 1e3;
var ResolveAppointmentQrResponse = zod.object({
  "appointment": zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(resolveAppointmentQrResponseAppointmentOneNotesMax).optional()
  }).and(zod.object({
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional()
  })),
  "eligible": zod.boolean(),
  "alreadyCheckedIn": zod.boolean(),
  "message": zod.string()
});
var CheckInAppointmentQrBody = zod.object({
  "payload": zod.string().min(1)
});
var checkInAppointmentQrResponseAppointmentOneNotesMax = 1e3;
var CheckInAppointmentQrResponse = zod.object({
  "appointment": zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(checkInAppointmentQrResponseAppointmentOneNotesMax).optional()
  }).and(zod.object({
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional()
  })),
  "alreadyCheckedIn": zod.boolean(),
  "message": zod.string()
});
var GetDoctorDurationParams = zod.object({
  "id": zod.coerce.string(),
  "clinicId": zod.coerce.string()
});
var GetDoctorDurationResponse = zod.object({
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "expectedDurationMinutes": zod.number().int().nullable().describe("Existing legacy durations are retained; new selections must be 20/30/60.")
});
var UpdateDoctorDurationParams = zod.object({
  "id": zod.coerce.string(),
  "clinicId": zod.coerce.string()
});
var UpdateDoctorDurationBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "clinicId": zod.string(),
  "expectedDurationMinutes": zod.union([zod.literal(20), zod.literal(30), zod.literal(60)]),
  "effect": zod.enum(["futureOnly", "runningSession"]).describe("Both choices update sessions that have not started"),
  "branchId": zod.string().optional(),
  "date": zod.coerce.date().optional(),
  "confirmRunningSession": zod.boolean().optional(),
  "expectedQueueVersion": zod.string().optional()
});
var UpdateDoctorDurationResponse = zod.object({
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "expectedDurationMinutes": zod.number().int().nullable().describe("Existing legacy durations are retained; new selections must be 20/30/60.")
});
var RescheduleAppointmentParams = zod.object({
  "id": zod.coerce.string()
});
var rescheduleAppointmentBodyExpectedRevisionMin = 0;
var RescheduleAppointmentBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "expectedRevision": zod.number().int().min(rescheduleAppointmentBodyExpectedRevisionMin),
  "reason": zod.string().optional()
});
var rescheduleAppointmentResponseOneNotesMax = 1e3;
var RescheduleAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(rescheduleAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional()
}));
var TransitionAppointmentParams = zod.object({
  "id": zod.coerce.string()
});
var transitionAppointmentBodyExpectedRevisionMin = 0;
var TransitionAppointmentBody = zod.object({
  "action": zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"]),
  "reason": zod.string().optional(),
  "cancellationReasonId": zod.string().optional(),
  "expectedStatus": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "expectedRevision": zod.number().int().min(transitionAppointmentBodyExpectedRevisionMin).optional(),
  "expectedQueueVersion": zod.string().optional(),
  "position": zod.number().int().min(1).optional().describe("Required for requeue. One-based position among pending reservations; current consultation is never displaced.")
});
var transitionAppointmentResponseOneNotesMax = 1e3;
var TransitionAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(transitionAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional()
}));
var getQueueQueryPageSizeMax = 100;
var getQueueQuerySearchMax = 200;
var GetQueueQueryParams = zod.object({
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date(),
  "appointmentId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).optional().describe("Explicit staff listing page; omit both pagination parameters for legacy full-list compatibility"),
  "pageSize": zod.coerce.number().int().min(1).max(getQueueQueryPageSizeMax).optional().describe("Explicit staff listing page size; omitted pagination parameters must not be default-injected by clients"),
  "search": zod.coerce.string().max(getQueueQuerySearchMax).optional().describe("Staff-only listing search applied before pagination"),
  "sort": zod.coerce.string().optional().describe("Staff-only allowlisted listing sort with optional minus prefix"),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "statusGroup": zod.enum(["active", "waiting", "absent", "completed", "cancelled", "all"]).optional().describe("Server-side group filter applied before pagination; intersects with status when both supplied")
});
var getQueueResponseEntriesItemOneNotesMax = 1e3;
var GetQueueResponse = zod.object({
  "filteredTotal": zod.number().optional().describe("Staff-only count after listing filters; omitted for patients."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "presence": zod.object({
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "status": zod.enum(["available", "onBreak", "away"])
  }).and(zod.object({
    "doctorId": zod.string(),
    "updatedAt": zod.coerce.date().nullable()
  })).optional(),
  "page": zod.number().int().optional(),
  "pageSize": zod.number().int().optional(),
  "totalPages": zod.number().int().optional(),
  "entriesTotal": zod.number().int().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "currentToken": zod.string().nullable(),
  "nextToken": zod.string().nullable(),
  "waiting": zod.number().int(),
  "reserved": zod.number().int().optional().describe("All pending booked"),
  "arrived": zod.number().int().optional().describe("Checked-in"),
  "queueVersion": zod.string().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "blockedByAbsentReservation": zod.boolean().optional(),
  "inConsultation": zod.number().int(),
  "completed": zod.number().int(),
  "noShow": zod.number().int(),
  "total": zod.number().int(),
  "ownEntry": zod.union([zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "appointmentId": zod.string(),
    "token": zod.string(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientsAhead": zod.number().int(),
    "estimatedWaitMinutes": zod.number().int().nullable()
  }), zod.null()]).optional(),
  "entries": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(getQueueResponseEntriesItemOneNotesMax).optional()
  }).and(zod.object({
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional()
  }))).optional().describe("Omitted for patients"),
  "statusCounts": zod.object({
    "active": zod.number().int().optional(),
    "waiting": zod.number().int().optional(),
    "absent": zod.number().int().optional(),
    "completed": zod.number().int().optional(),
    "cancelled": zod.number().int().optional(),
    "all": zod.number().int().optional()
  }).optional(),
  "pollIntervalSeconds": zod.literal(30),
  "updatedAt": zod.coerce.date()
});
var CallNextBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date()
});
var callNextResponseAppointmentOneOneNotesMax = 1e3;
var CallNextResponse = zod.object({
  "appointment": zod.union([zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(callNextResponseAppointmentOneOneNotesMax).optional()
  }).and(zod.object({
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional()
  })), zod.null()])
});
var listQrsQueryPageDefault = 1;
var listQrsQueryPageSizeDefault = 20;
var listQrsQueryPageSizeMax = 100;
var ListQrsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listQrsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listQrsQueryPageSizeMax).default(listQrsQueryPageSizeDefault)
});
var listQrsResponseOneTotalMin = 0;
var ListQrsResponse = zod.object({
  "total": zod.number().int().min(listQrsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "name": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string().nullish(),
    "doctorId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "reference": zod.string(),
    "bookingUrl": zod.string(),
    "createdAt": zod.coerce.date()
  })))
}));
var CreateQrBody = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var CreateQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var GetQrParams = zod.object({
  "id": zod.coerce.string()
});
var GetQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var UpdateQrParams = zod.object({
  "id": zod.coerce.string()
});
var UpdateQrBody = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var UpdateQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var DeleteQrParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteQrResponse = zod.void();
var RegenerateQrParams = zod.object({
  "id": zod.coerce.string()
});
var RegenerateQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var GetDashboardQueryParams = zod.object({
  "date": zod.date().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional()
});
var getDashboardResponseRecentAppointmentsItemOneNotesMax = 1e3;
var GetDashboardResponse = zod.object({
  "totalDoctors": zod.number().int().optional(),
  "totalClinics": zod.number().int().optional(),
  "totalBranches": zod.number().int().optional(),
  "totalPatients": zod.number().int().optional(),
  "todayAppointments": zod.number().int(),
  "activeQueues": zod.number().int().optional(),
  "waiting": zod.number().int(),
  "checkedIn": zod.number().int(),
  "completed": zod.number().int(),
  "cancelled": zod.number().int(),
  "noShow": zod.number().int(),
  "averageWaitMinutes": zod.number(),
  "currentToken": zod.string().nullish(),
  "recentAppointments": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(getDashboardResponseRecentAppointmentsItemOneNotesMax).optional()
  }).and(zod.object({
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel"])),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional()
  }))).optional(),
  "recentActivity": zod.array(zod.object({
    "id": zod.string(),
    "actorId": zod.string(),
    "actorName": zod.string().optional(),
    "actorRole": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
    "action": zod.string(),
    "entityType": zod.string(),
    "entityId": zod.string(),
    "clinicId": zod.string().nullish(),
    "summary": zod.string(),
    "createdAt": zod.coerce.date()
  })).optional()
});
var getReportsQuerySearchMax = 200;
var getReportsQueryPageDefault = 1;
var getReportsQueryPageSizeDefault = 20;
var getReportsQueryPageSizeMax = 100;
var getReportsQueryGroupByDefault = `date`;
var GetReportsQueryParams = zod.object({
  "search": zod.coerce.string().max(getReportsQuerySearchMax).optional().describe("Trimmed report search text"),
  "sort": zod.enum(["key", "-key", "label", "-label", "appointments", "-appointments", "outcomes", "-outcomes", "other", "-other", "registrations", "-registrations", "waiting", "-waiting", "checkedIn", "-checkedIn", "completed", "-completed", "noShow", "-noShow", "cancelled", "-cancelled", "averageWaitMinutes", "-averageWaitMinutes", "averageConsultationMinutes", "-averageConsultationMinutes"]).optional().describe("Outcomes orders by cancelled then no-show then residual Other counts. Other equals visits minus completed minus cancelled minus no-show. Group key ascending breaks ties."),
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(getReportsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(getReportsQueryPageSizeMax).default(getReportsQueryPageSizeDefault),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "groupBy": zod.enum(["clinic", "doctor", "date"]).default(getReportsQueryGroupByDefault)
});
var GetReportsResponse = zod.object({
  "page": zod.number().int().optional(),
  "pageSize": zod.number().int().optional(),
  "totalPages": zod.number().int().optional(),
  "total": zod.number().int().optional(),
  "from": zod.coerce.date(),
  "to": zod.coerce.date(),
  "groupBy": zod.string(),
  "rows": zod.array(zod.object({
    "key": zod.string(),
    "label": zod.string(),
    "appointments": zod.number().int(),
    "checkedIn": zod.number().int().optional(),
    "waiting": zod.number().int().optional(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "registrations": zod.number().int(),
    "averageWaitMinutes": zod.number(),
    "averageConsultationMinutes": zod.number().nullish()
  }))
});
var listAuditLogsQueryActivityTypeDefault = `all`;
var listAuditLogsQueryPageDefault = 1;
var listAuditLogsQueryPageSizeDefault = 20;
var listAuditLogsQueryPageSizeMax = 100;
var ListAuditLogsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "activityType": zod.enum(["all", "operational", "security"]).default(listAuditLogsQueryActivityTypeDefault),
  "entityType": zod.coerce.string().optional(),
  "actorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "page": zod.coerce.number().int().min(1).default(listAuditLogsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listAuditLogsQueryPageSizeMax).default(listAuditLogsQueryPageSizeDefault)
});
var listAuditLogsResponseOneTotalMin = 0;
var ListAuditLogsResponse = zod.object({
  "total": zod.number().int().min(listAuditLogsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "actorId": zod.string(),
    "actorName": zod.string().optional(),
    "actorRole": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
    "action": zod.string(),
    "entityType": zod.string(),
    "entityId": zod.string(),
    "clinicId": zod.string().nullish(),
    "summary": zod.string(),
    "createdAt": zod.coerce.date()
  }))
}));
var getSettingsResponseOneCancellationCutoffMinutesMin = 0;
var getSettingsResponseOneOtpExpirySecondsMin = 60;
var getSettingsResponseOneOtpExpirySecondsMax = 900;
var getSettingsResponseOneOtpMaxAttemptsMax = 10;
var getSettingsResponseOneSessionTimeoutMinutesMin = 5;
var GetSettingsResponse = zod.object({
  "platformName": zod.string(),
  "supportEmail": zod.string().email().optional(),
  "supportPhone": zod.string().optional(),
  "timezone": zod.string().optional(),
  "bookingHorizonDays": zod.number().int().min(1).optional(),
  "cancellationCutoffMinutes": zod.number().int().min(getSettingsResponseOneCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": zod.boolean(),
  "otpExpirySeconds": zod.number().int().min(getSettingsResponseOneOtpExpirySecondsMin).max(getSettingsResponseOneOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": zod.number().int().min(1).max(getSettingsResponseOneOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": zod.number().int().min(getSettingsResponseOneSessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": zod.boolean().optional(),
  "logoUrl": zod.string().optional(),
  "primaryColor": zod.string().optional(),
  "termsUrl": zod.string().optional(),
  "privacyUrl": zod.string().optional()
}).and(zod.object({
  "otpProviderConfigured": zod.boolean(),
  "queuePollSeconds": zod.literal(30)
}));
var updateSettingsBodyCancellationCutoffMinutesMin = 0;
var updateSettingsBodyOtpExpirySecondsMin = 60;
var updateSettingsBodyOtpExpirySecondsMax = 900;
var updateSettingsBodyOtpMaxAttemptsMax = 10;
var updateSettingsBodySessionTimeoutMinutesMin = 5;
var UpdateSettingsBody = zod.object({
  "platformName": zod.string().optional(),
  "supportEmail": zod.string().email().optional(),
  "supportPhone": zod.string().optional(),
  "timezone": zod.string().optional(),
  "bookingHorizonDays": zod.number().int().min(1).optional(),
  "cancellationCutoffMinutes": zod.number().int().min(updateSettingsBodyCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": zod.boolean().optional(),
  "otpExpirySeconds": zod.number().int().min(updateSettingsBodyOtpExpirySecondsMin).max(updateSettingsBodyOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": zod.number().int().min(1).max(updateSettingsBodyOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": zod.number().int().min(updateSettingsBodySessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": zod.boolean().optional(),
  "logoUrl": zod.string().optional(),
  "primaryColor": zod.string().optional(),
  "termsUrl": zod.string().optional(),
  "privacyUrl": zod.string().optional()
});
var updateSettingsResponseOneCancellationCutoffMinutesMin = 0;
var updateSettingsResponseOneOtpExpirySecondsMin = 60;
var updateSettingsResponseOneOtpExpirySecondsMax = 900;
var updateSettingsResponseOneOtpMaxAttemptsMax = 10;
var updateSettingsResponseOneSessionTimeoutMinutesMin = 5;
var UpdateSettingsResponse = zod.object({
  "platformName": zod.string(),
  "supportEmail": zod.string().email().optional(),
  "supportPhone": zod.string().optional(),
  "timezone": zod.string().optional(),
  "bookingHorizonDays": zod.number().int().min(1).optional(),
  "cancellationCutoffMinutes": zod.number().int().min(updateSettingsResponseOneCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": zod.boolean(),
  "otpExpirySeconds": zod.number().int().min(updateSettingsResponseOneOtpExpirySecondsMin).max(updateSettingsResponseOneOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": zod.number().int().min(1).max(updateSettingsResponseOneOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": zod.number().int().min(updateSettingsResponseOneSessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": zod.boolean().optional(),
  "logoUrl": zod.string().optional(),
  "primaryColor": zod.string().optional(),
  "termsUrl": zod.string().optional(),
  "privacyUrl": zod.string().optional()
}).and(zod.object({
  "otpProviderConfigured": zod.boolean(),
  "queuePollSeconds": zod.literal(30)
}));
var listNotificationsQueryKindDefault = `all`;
var ListNotificationsQueryParams = zod.object({
  "kind": zod.enum(["all", "appointments", "queue", "system"]).default(listNotificationsQueryKindDefault)
});
var ListNotificationsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "kind": zod.enum(["appointments", "queue", "system"]),
    "title": zod.string(),
    "body": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "read": zod.boolean(),
    "appointmentId": zod.string().nullish(),
    "date": zod.string().nullish()
  })),
  "unread": zod.number().int()
});
var markNotificationsReadBodyIdsItemMax = 120;
var markNotificationsReadBodyIdsMax = 100;
var MarkNotificationsReadBody = zod.object({
  "ids": zod.array(zod.string().max(markNotificationsReadBodyIdsItemMax)).max(markNotificationsReadBodyIdsMax).optional(),
  "all": zod.boolean().optional()
});
var MarkNotificationsReadResponse = zod.object({
  "unread": zod.number().int()
});
var ListWorkspacesResponse = zod.object({
  "activeClinicId": zod.string().nullish(),
  "switchable": zod.boolean(),
  "workspaces": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  }))
});
var SelectWorkspaceBody = zod.object({
  "clinicId": zod.string().nullable()
});
var SelectWorkspaceResponse = zod.object({
  "activeClinicId": zod.string().nullish(),
  "switchable": zod.boolean(),
  "workspaces": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  }))
});
var ListPatientDocumentsParams = zod.object({
  "id": zod.coerce.string()
});
var ListPatientDocumentsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "patientId": zod.string(),
    "clinicId": zod.string(),
    "clinicName": zod.string().optional(),
    "name": zod.string(),
    "contentType": zod.string(),
    "size": zod.number().int(),
    "createdAt": zod.coerce.date(),
    "uploadedByName": zod.string().optional()
  })),
  "uploadClinicIds": zod.array(zod.string())
});
var UploadPatientDocumentParams = zod.object({
  "id": zod.coerce.string()
});
var uploadPatientDocumentQueryNameMax = 160;
var UploadPatientDocumentQueryParams = zod.object({
  "name": zod.coerce.string().min(1).max(uploadPatientDocumentQueryNameMax),
  "clinicId": zod.coerce.string().optional()
});
var UploadPatientDocumentResponse = zod.object({
  "id": zod.string(),
  "patientId": zod.string(),
  "clinicId": zod.string(),
  "clinicName": zod.string().optional(),
  "name": zod.string(),
  "contentType": zod.string(),
  "size": zod.number().int(),
  "createdAt": zod.coerce.date(),
  "uploadedByName": zod.string().optional()
});
var DownloadPatientDocumentParams = zod.object({
  "id": zod.coerce.string()
});
var DownloadPatientDocumentResponse = zod.unknown();
var DeletePatientDocumentParams = zod.object({
  "id": zod.coerce.string()
});
var DeletePatientDocumentResponse = zod.void();
var ListPatientActivityParams = zod.object({
  "id": zod.coerce.string()
});
var listPatientActivityQueryPageDefault = 1;
var listPatientActivityQueryPageSizeDefault = 20;
var listPatientActivityQueryPageSizeMax = 100;
var ListPatientActivityQueryParams = zod.object({
  "page": zod.coerce.number().int().min(1).default(listPatientActivityQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPatientActivityQueryPageSizeMax).default(listPatientActivityQueryPageSizeDefault)
});
var ListPatientActivityResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "appointmentId": zod.string(),
    "fromStatus": zod.string().nullish(),
    "toStatus": zod.string(),
    "occurredAt": zod.coerce.date(),
    "reference": zod.string(),
    "doctorName": zod.string(),
    "date": zod.string(),
    "actorName": zod.string().nullish()
  })),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int()
});
var GetReportTrendsQueryParams = zod.object({
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional()
});
var GetReportTrendsResponse = zod.object({
  "from": zod.string(),
  "to": zod.string(),
  "points": zod.array(zod.object({
    "date": zod.string(),
    "appointments": zod.number().int(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "waiting": zod.number().int()
  }))
});
var searchRecordsQueryQMin = 2;
var searchRecordsQueryQMax = 100;
var SearchRecordsQueryParams = zod.object({
  "q": zod.coerce.string().min(searchRecordsQueryQMin).max(searchRecordsQueryQMax)
});
var SearchRecordsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "clinicId": zod.string().describe("Visit clinic"),
    "branchId": zod.string(),
    "doctorId": zod.string(),
    "startTime": zod.string().nullish().describe("Session start time when the visit belongs to a timed session."),
    "sessionId": zod.string().nullish(),
    "reference": zod.string(),
    "patientName": zod.string(),
    "doctorName": zod.string(),
    "tokenNumber": zod.number().int(),
    "token": zod.string().optional(),
    "date": zod.string(),
    "status": zod.string(),
    "today": zod.boolean()
  }))
});
var listSavedViewsQueryTableKeyMax = 60;
var ListSavedViewsQueryParams = zod.object({
  "tableKey": zod.coerce.string().max(listSavedViewsQueryTableKeyMax)
});
var listSavedViewsResponseItemsItemColumnsOrderItemMax = 60;
var listSavedViewsResponseItemsItemColumnsOrderMax = 40;
var listSavedViewsResponseItemsItemColumnsHiddenItemMax = 60;
var listSavedViewsResponseItemsItemColumnsHiddenMax = 40;
var listSavedViewsResponseItemsItemColumnsPinnedMax = 60;
var ListSavedViewsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "tableKey": zod.string(),
    "name": zod.string(),
    "filters": zod.record(zod.string(), zod.string()),
    "columns": zod.object({
      "order": zod.array(zod.string().max(listSavedViewsResponseItemsItemColumnsOrderItemMax)).max(listSavedViewsResponseItemsItemColumnsOrderMax),
      "hidden": zod.array(zod.string().max(listSavedViewsResponseItemsItemColumnsHiddenItemMax)).max(listSavedViewsResponseItemsItemColumnsHiddenMax),
      "pinned": zod.string().max(listSavedViewsResponseItemsItemColumnsPinnedMax).nullish()
    }).optional(),
    "ownedByMe": zod.boolean(),
    "shared": zod.boolean()
  })),
  "canShare": zod.boolean()
});
var createSavedViewBodyTableKeyMax = 60;
var createSavedViewBodyNameMax = 60;
var createSavedViewBodyFiltersMaxOne = 80;
var createSavedViewBodyColumnsOrderItemMax = 60;
var createSavedViewBodyColumnsOrderMax = 40;
var createSavedViewBodyColumnsHiddenItemMax = 60;
var createSavedViewBodyColumnsHiddenMax = 40;
var createSavedViewBodyColumnsPinnedMax = 60;
var CreateSavedViewBody = zod.object({
  "tableKey": zod.string().max(createSavedViewBodyTableKeyMax),
  "name": zod.string().min(1).max(createSavedViewBodyNameMax),
  "filters": zod.record(zod.string(), zod.string().max(createSavedViewBodyFiltersMaxOne)),
  "columns": zod.object({
    "order": zod.array(zod.string().max(createSavedViewBodyColumnsOrderItemMax)).max(createSavedViewBodyColumnsOrderMax),
    "hidden": zod.array(zod.string().max(createSavedViewBodyColumnsHiddenItemMax)).max(createSavedViewBodyColumnsHiddenMax),
    "pinned": zod.string().max(createSavedViewBodyColumnsPinnedMax).nullish()
  }).optional(),
  "shareWithRole": zod.boolean().optional()
});
var createSavedViewResponseColumnsOrderItemMax = 60;
var createSavedViewResponseColumnsOrderMax = 40;
var createSavedViewResponseColumnsHiddenItemMax = 60;
var createSavedViewResponseColumnsHiddenMax = 40;
var createSavedViewResponseColumnsPinnedMax = 60;
var CreateSavedViewResponse = zod.object({
  "id": zod.string(),
  "tableKey": zod.string(),
  "name": zod.string(),
  "filters": zod.record(zod.string(), zod.string()),
  "columns": zod.object({
    "order": zod.array(zod.string().max(createSavedViewResponseColumnsOrderItemMax)).max(createSavedViewResponseColumnsOrderMax),
    "hidden": zod.array(zod.string().max(createSavedViewResponseColumnsHiddenItemMax)).max(createSavedViewResponseColumnsHiddenMax),
    "pinned": zod.string().max(createSavedViewResponseColumnsPinnedMax).nullish()
  }).optional(),
  "ownedByMe": zod.boolean(),
  "shared": zod.boolean()
});
var DeleteSavedViewParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteSavedViewResponse = zod.void();

// src/routes/appointments.ts
init_auth();
init_http();
init_store();
init_availability();
init_appointments();

// src/routes/public.ts
init_db();
import { Router } from "express";
import { eq as eq14, sql as sql13 } from "drizzle-orm";
init_store();
init_http();
init_availability();
init_store();
init_presence();
init_queue_order();
init_clinical_membership();
init_display_preferences();
var publicRouter = Router();
for (const [kind, table, schema2] of [
  ["clinics", clinics, ListPublicClinicsQueryParams],
  ["branches", branches, ListPublicBranchesQueryParams],
  ["doctors", doctors, ListPublicDoctorsQueryParams]
]) {
  publicRouter.get(`/public/${kind}`, async (req, res) => {
    const q = query(schema2, req);
    const extra = kind === "branches" ? sql13`exists(select 1 from clinics c where c.id=r.clinic_id and c.status='active') and ${"doctorId" in q && q.doctorId ? sql13`exists(select 1 from doctors d join users u on u.id=d.user_id where d.id=${q.doctorId} and d.status='active' and u.status='active')` : sql13`true`}` : kind === "doctors" ? sql13`${clinicalMembership(sql13`r.id`, q.branchId ? sql13`${q.branchId}` : void 0)}
          and ${q.clinicId ? sql13`exists(select 1 from branches pb where pb.clinic_id=${q.clinicId}
            ${q.branchId ? sql13`and pb.id=${q.branchId}` : sql13``}
            and ${clinicalMembership(sql13`r.id`, sql13`pb.id`)})` : sql13`true`}` : kind === "clinics" ? sql13`exists(select 1 from branches pb where pb.clinic_id=r.id and pb.status='active')` : sql13`true`;
    const result = await queryPage({ role: "superAdmin" }, kind, { ...q, ...kind === "doctors" ? { branchId: void 0 } : {}, status: "active" }, extra);
    if (kind === "doctors") {
      const locations = await all(branches);
      result.items = await Promise.all(result.items.map(async (row) => {
        const branchIds = await clinicalBranchIds(row.id);
        return publicDoctor({ ...row, branchIds, clinicIds: [...new Set(locations.filter((b) => branchIds.includes(b.id)).map((b) => b.clinicId))] });
      }));
    }
    if (kind === "clinics") result.items = result.items.map(({ ownerId, ...r }) => ({ ...r, ...clinicDisplayPreferences(r) }));
    if (kind === "branches") {
      const clinicMap = new Map((await all(clinics)).map((c) => [c.id, c]));
      result.items = result.items.map((row) => ({ ...row, ...clinicDisplayPreferences(clinicMap.get(row.clinicId)) }));
    }
    res.json(result);
  });
}
publicRouter.get("/public/availability", async (req, res) => {
  const q = query(GetPublicAvailabilityQueryParams, req);
  res.json(await availability(q.doctorId, q.branchId, q.date, db, q));
});
publicRouter.get("/public/availability/sessions", async (req, res) => {
  const q = query(GetPublicAvailabilitySessionsQueryParams, req);
  res.json(await availabilitySessions(q.doctorId, q.branchId, q.date));
});
publicRouter.get("/public/availability/context", async (req, res) => {
  const q = query(GetPublicBookingContextQueryParams, req);
  const { branch, clinic } = await doctorContext(q.doctorId, q.branchId);
  assert(branch.timezone, 409, "Location timezone is not configured. Contact the clinic.");
  const today = localNow(branch.timezone).date;
  const config = await getSettings(db, clinic.id);
  res.json({ timezone: branch.timezone, today, lastBookableDate: datePlus(today, config.bookingHorizonDays) });
});
async function resolveQr(reference, conn = db, lock = false) {
  let qr;
  if (lock) {
    const [row] = await conn.select().from(qrs).where(eq14(qrs.publicReference, reference)).for("update");
    qr = row;
  } else qr = (await all(qrs, conn)).find((q) => q.publicReference === reference);
  assert(qr?.status === "active", 404, "Booking link expired or revoked");
  assert(qr, 404, "Booking link expired or revoked");
  const clinic = await one(clinics, qr.clinicId, conn);
  const branch = qr.branchId ? await one(branches, qr.branchId, conn) : null;
  const doctor = qr.doctorId ? await enrich("doctors", await one(doctors, qr.doctorId, conn), conn) : null;
  assert(clinic.status === "active" && (!branch || branch.status === "active") && (!doctor || doctor.status === "active"), 404, "Booking link unavailable");
  assert((!branch || branch.clinicId === clinic.id) && (!doctor || doctor.clinicIds.includes(clinic.id) && (!branch || doctor.branchIds.includes(branch.id))), 404, "Booking link context is no longer available");
  return { reference, clinicId: clinic.id, ...clinicDisplayPreferences(clinic), clinicName: clinic.name, clinicAddress: clinic.address || null, branchAddress: branch?.address || null, branchCity: branch?.city || null, branchTimezone: branch?.timezone || null, branchId: branch?.id || null, branchName: branch?.name || null, doctorId: doctor?.id || null, doctorName: doctor?.fullName || null };
}
async function publicDisplay(reference, conn = db) {
  const context = await resolveQr(reference, conn);
  assert(context.branchId, 404, "Display requires a branch-specific QR");
  const branch = await one(branches, context.branchId, conn);
  const timezone = branch.timezone || "Asia/Kolkata", date2 = localNow(timezone).date;
  const assigned = [];
  for (const row of await all(doctors, conn)) {
    if (row.status !== "active" || context.doctorId && row.id !== context.doctorId) continue;
    const doctor = await enrich("doctors", row, conn);
    if (doctor.status === "active" && doctor.clinicIds.includes(context.clinicId) && doctor.branchIds.includes(branch.id)) assigned.push(doctor);
  }
  const rows = (await all(appointments, conn)).filter((a) => a.clinicId === context.clinicId && a.branchId === branch.id && a.date === date2);
  const sessions = [];
  for (const doctor of assigned.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
    const scheduled = await availabilitySessions(doctor.id, branch.id, date2, conn);
    const doctorRows = rows.filter((a) => a.doctorId === doctor.id);
    const contexts = new Map(scheduled.map((s) => [s.startTime, s]));
    for (const entry of doctorRows) if (!contexts.has(entry.startTime)) contexts.set(entry.startTime, entry);
    for (const schedule of contexts.values()) {
      const entries = sessionRows(rows, { doctorId: doctor.id, branchId: branch.id, date: date2, startTime: schedule.startTime });
      const pending = orderedReservations(entries.filter((a) => pendingStatuses.includes(a.status)));
      const current = entries.find((a) => ["called", "inConsultation"].includes(a.status));
      const presence = await getPresence({ doctorId: doctor.id, branchId: branch.id, date: date2, startTime: schedule.startTime, sessionId: schedule.sessionId }, conn);
      sessions.push({
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        ...clinicDisplayPreferences(context),
        sessionId: schedule.sessionId || null,
        presence: presence.status,
        startTime: schedule.startTime || entries[0]?.startTime || null,
        endTime: schedule.endTime || entries[0]?.endTime || null,
        currentToken: current?.token || null,
        currentStatus: current?.status || null,
        nextToken: pending[0]?.token || null,
        waitingTokens: pending.map((a) => a.token),
        waitingCount: pending.length,
        completedCount: entries.filter((a) => a.status === "completed").length
      });
    }
  }
  return { ...clinicDisplayPreferences(context), clinic: { name: context.clinicName, ...clinicDisplayPreferences(context) }, branch: { name: branch.name, address: branch.address || null, city: branch.city || null, timezone }, date: date2, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), sessions };
}
publicRouter.get("/public/display/:reference", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const display = await publicDisplay(req.params.reference);
  GetPublicDisplayResponse.parse(display);
  res.json(display);
});
publicRouter.get("/public/qr/:reference", async (req, res) => {
  res.json(await resolveQr(req.params.reference));
});

// src/routes/appointments.ts
init_session_duration();
init_queue_order();
init_appointment_confirmation();

// src/lib/ticket-email.ts
init_db();
init_auth();
init_http();
init_store();
init_appointments();
init_appointment_confirmation();
import { eq as eq16, sql as sql15 } from "drizzle-orm";
import { createHash as createHash4 } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// src/lib/appointment-qr.ts
init_db();
init_store();
init_http();
init_auth();
init_availability();
init_appointments();
init_queue_order();
import { createHmac, timingSafeEqual } from "node:crypto";
var VERSION = "v1";
var SIGNING_CONTEXT = "clinicflow:appointment-qr";
function secret() {
  const value = process.env.SESSION_SECRET;
  assert(value, 503, "Appointment QR service is unavailable");
  return value;
}
function signature(reference) {
  return createHmac("sha256", secret()).update(`${SIGNING_CONTEXT}:${VERSION}:${reference}`).digest();
}
function createAppointmentQrPayload(reference) {
  assert(typeof reference === "string" && reference.length > 0, 400, "Appointment reference is required");
  const encodedReference = Buffer.from(reference, "utf8").toString("base64url");
  return `${VERSION}.${encodedReference}.${signature(reference).toString("base64url")}`;
}
async function getAppointmentQr(user, appointmentId, conn = db) {
  const row = await one(appointments, appointmentId, conn);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  const payload = createAppointmentQrPayload(row.reference);
  return {
    appointmentId: row.id,
    payload,
    checkInUrl: `/check-in?payload=${encodeURIComponent(payload)}`
  };
}

// src/lib/ticket-email.ts
init_integration_config();
init_integration_vault();
init_auth_email();

// src/lib/native-auth.ts
init_db();
init_http();
import { createHash as createHash3, createHmac as createHmac2, randomBytes as randomBytes2, randomInt, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import argon2 from "argon2";
import { and as and2, eq as eq15, gt, inArray, isNull, lt, sql as sql14 } from "drizzle-orm";

// src/lib/auth-config.ts
init_http();
var SESSION_AGE_SECONDS = 12 * 60 * 60;
var SESSION_AGE = SESSION_AGE_SECONDS * 1e3;
var JWT_ISSUER = "digiq-doctors";
var JWT_AUDIENCE = "digiq-doctors-session";
function sessionMode(env = process.env) {
  const mode = env.AUTH_SESSION_MODE ?? "native";
  if (mode !== "native" && mode !== "jwt")
    throw new HttpError(503, "Authentication session mode is invalid", "AUTH_SESSION_UNCONFIGURED");
  return mode;
}
function jwtSigningKey(env = process.env) {
  const key3 = env.JWT_SIGNING_KEY;
  if (!key3 || key3.trim() !== key3 || Buffer.byteLength(key3, "utf8") < 32)
    throw new HttpError(503, "JWT signing key is not configured correctly", "AUTH_SESSION_UNCONFIGURED");
  return new TextEncoder().encode(key3);
}

// src/lib/jwt-session.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
var PURPOSE = "app-session";
async function signSessionJwt(userId, issuedAt = Math.floor(Date.now() / 1e3)) {
  if (!userId || userId.trim() !== userId) throw new Error("Invalid session subject");
  return new SignJWT({ purpose: PURPOSE }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer(JWT_ISSUER).setAudience(JWT_AUDIENCE).setSubject(userId).setJti(randomUUID4()).setIssuedAt(issuedAt).setExpirationTime(issuedAt + SESSION_AGE_SECONDS).sign(jwtSigningKey());
}
async function verifySessionJwt(token) {
  const key3 = jwtSigningKey();
  try {
    const { payload, protectedHeader } = await jwtVerify(token, key3, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      typ: "JWT",
      requiredClaims: ["sub", "jti", "iat", "exp", "purpose"],
      maxTokenAge: SESSION_AGE_SECONDS
    });
    if (protectedHeader.typ !== "JWT" || payload.purpose !== PURPOSE || typeof payload.sub !== "string" || !payload.sub || payload.sub.trim() !== payload.sub || typeof payload.jti !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(payload.jti) || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.iat > Math.floor(Date.now() / 1e3) || payload.exp - payload.iat !== SESSION_AGE_SECONDS || payload.aud !== JWT_AUDIENCE) return void 0;
    return payload.sub;
  } catch {
    return void 0;
  }
}

// src/lib/native-auth.ts
var SESSION_COOKIE = "digiq_session";
var CSRF_COOKIE = "digiq_csrf";
var digest = (raw2) => createHash3("sha256").update(raw2).digest("hex");
function challengeDigest(id2, purpose, raw2) {
  const secret2 = process.env.SESSION_SECRET;
  if (!secret2 || Buffer.byteLength(secret2, "utf8") < 32)
    throw new HttpError(503, "Authentication secret is not configured", "AUTH_SECRET_UNCONFIGURED");
  return createHmac2("sha256", secret2).update(`${purpose}:${id2}:${raw2}`).digest("hex");
}
var cookieOptions = { httpOnly: true, sameSite: "lax", secure: true, path: "/api" };
function passwordInput(password) {
  if (typeof password !== "string" || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || Buffer.byteLength(password, "utf8") > 1024)
    throw new HttpError(400, "Password must contain at least 8 characters, including letters and numbers, and at most 1024 bytes", "INVALID_PASSWORD");
}
async function hashPassword(password) {
  passwordInput(password);
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}
var dummyHash;
async function verifyPassword(hash, password) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) return false;
  dummyHash ||= hashPassword(`a1${randomBytes2(32).toString("base64url")}`);
  try {
    const verified = await argon2.verify(hash || await dummyHash, password);
    return Boolean(hash && verified);
  } catch {
    return false;
  }
}
function safeEqual(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual2(left, right);
}
function getCookie(req, name) {
  const value = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  try {
    return value ? decodeURIComponent(value.slice(name.length + 1)) : void 0;
  } catch {
    return void 0;
  }
}
async function nativeSession(req, _res, next) {
  try {
    const token = getCookie(req, SESSION_COOKIE);
    if (!token) return next();
    let subject;
    let mode;
    try {
      mode = sessionMode();
      if (mode === "jwt") {
        subject = await verifySessionJwt(token);
        if (!subject) return next();
      } else if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return next();
    } catch (error) {
      if (error instanceof HttpError && error.code === "AUTH_SESSION_UNCONFIGURED") return next();
      throw error;
    }
    {
      const [row] = await db.select({ userId: authSessions.userId, tokenHash: authSessions.tokenHash }).from(authSessions).innerJoin(users, eq15(users.id, authSessions.userId)).where(and2(
        eq15(authSessions.tokenHash, digest(token)),
        gt(authSessions.expiresAt, /* @__PURE__ */ new Date()),
        isNull(authSessions.revokedAt),
        eq15(users.status, "active")
      )).limit(1);
      if (row && (mode === "native" || row.userId === subject)) {
        req.authUserId = row.userId;
        req.authSessionHash = row.tokenHash;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
async function lockCredentials(tx, userId) {
  await tx.execute(sql14`select pg_advisory_xact_lock(hashtext(${"auth-credentials:" + userId}))`);
}
async function insertSession(tx, userId) {
  const mode = sessionMode();
  const issuedAt = Math.floor(Date.now() / 1e3);
  const token = mode === "jwt" ? await signSessionJwt(userId, issuedAt) : randomBytes2(32).toString("base64url");
  const expiresAt = new Date(mode === "jwt" ? issuedAt * 1e3 + SESSION_AGE : Date.now() + SESSION_AGE);
  await tx.insert(authSessions).values({ tokenHash: digest(token), userId, expiresAt });
  return token;
}
function sessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE });
}
async function createSession(res, userId, expectedPasswordHash) {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, /* @__PURE__ */ new Date()));
  const token = await db.transaction(async (tx) => {
    await lockCredentials(tx, userId);
    const [user] = await tx.select().from(users).where(eq15(users.id, userId)).for("update");
    if (!user || user.status !== "active" || expectedPasswordHash !== void 0 && (user.passwordHash !== expectedPasswordHash || !["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(user.role)))
      throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    return insertSession(tx, userId);
  });
  sessionCookie(res, token);
}
async function invalidateStaffCredentials(tx, userId) {
  await tx.update(authSessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq15(authSessions.userId, userId));
  await tx.update(authChallenges).set({ consumedAt: /* @__PURE__ */ new Date(), data: {} }).where(and2(
    eq15(authChallenges.userId, userId),
    isNull(authChallenges.consumedAt),
    inArray(authChallenges.purpose, ["reset", "invitation", "device"])
  ));
}
async function revokeSession(req, res) {
  if (req.authSessionHash) await db.update(authSessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq15(authSessions.tokenHash, req.authSessionHash));
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
async function revokeUserSessions(userId) {
  await db.update(authSessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(eq15(authSessions.userId, userId));
}
function issueCsrf(req, res) {
  const existing = getCookie(req, CSRF_COOKIE);
  if (existing && /^[A-Za-z0-9_-]{43}$/.test(existing)) return existing;
  const token = randomBytes2(32).toString("base64url");
  res.cookie(CSRF_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE });
  return token;
}
async function consumeRateLimit(key3, max, windowMs = 6e5) {
  if (randomBytes2(1)[0] === 0)
    await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, /* @__PURE__ */ new Date()));
  const hash = digest(key3);
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql14`insert into auth_rate_limits ("key",attempts,expires_at)
      values (${hash},1,now() + (${windowMs} * interval '1 millisecond'))
      on conflict ("key") do update
      set attempts=case when auth_rate_limits.expires_at<now() then 1 else auth_rate_limits.attempts+1 end,
          expires_at=case when auth_rate_limits.expires_at<now() then now() + (${windowMs} * interval '1 millisecond') else auth_rate_limits.expires_at end
      returning attempts, greatest(1,ceil(extract(epoch from (expires_at-now()))))::int as retry_seconds`);
    if (Number(result.rows[0]?.attempts) > max) {
      const seconds = Number(result.rows[0]?.retry_seconds);
      throw new HttpError(429, `Too many attempts. Try again in ${seconds} seconds.`, "RATE_LIMITED");
    }
  });
}
async function createChallenge(input) {
  const id2 = randomBytes2(18).toString("base64url");
  await db.delete(authChallenges).where(lt(authChallenges.expiresAt, /* @__PURE__ */ new Date()));
  await db.transaction(async (tx) => {
    if (input.userId) await lockCredentials(tx, input.userId);
    await tx.insert(authChallenges).values({
      id: id2,
      userId: input.userId,
      email: input.email,
      purpose: input.purpose,
      tokenHash: challengeDigest(id2, input.purpose, input.secret),
      expiresAt: new Date(Date.now() + input.ttlMs),
      data: input.data || {}
    });
  });
  return id2;
}
async function validateChallenge(id2, purpose, secret2) {
  const [row] = await db.select({ tokenHash: authChallenges.tokenHash }).from(authChallenges).where(and2(
    eq15(authChallenges.id, id2),
    eq15(authChallenges.purpose, purpose),
    isNull(authChallenges.consumedAt),
    gt(authChallenges.expiresAt, /* @__PURE__ */ new Date()),
    lt(authChallenges.attempts, 5)
  )).limit(1);
  if (!row || !safeEqual(row.tokenHash, challengeDigest(id2, purpose, secret2)))
    throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
}
async function consumeChallenge(id2, purpose, secret2, transaction) {
  const consume = async (tx) => {
    const [challenge] = await tx.select().from(authChallenges).where(eq15(authChallenges.id, id2)).for("update");
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt || challenge.expiresAt <= /* @__PURE__ */ new Date() || challenge.attempts >= 5) return null;
    const matching = safeEqual(challenge.tokenHash, challengeDigest(id2, purpose, secret2));
    await tx.update(authChallenges).set({
      attempts: challenge.attempts + 1,
      ...matching ? { consumedAt: /* @__PURE__ */ new Date(), data: {} } : {}
    }).where(eq15(authChallenges.id, id2));
    return matching ? challenge : null;
  };
  const row = transaction ? await consume(transaction) : await db.transaction(consume);
  if (!row) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return row;
}
async function challengeUserId(id2) {
  const [row] = await db.select({ userId: authChallenges.userId }).from(authChallenges).where(eq15(authChallenges.id, id2)).limit(1);
  if (!row?.userId) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return row.userId;
}
async function resendRegistrationChallenge(id2, deliver) {
  return db.transaction(async (tx) => {
    const [challenge] = await tx.select().from(authChallenges).where(eq15(authChallenges.id, id2)).for("update");
    if (!challenge || challenge.purpose !== "register" || challenge.userId || challenge.consumedAt || challenge.expiresAt <= /* @__PURE__ */ new Date() || challenge.attempts >= 5)
      throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
    const remaining = Math.ceil((challenge.createdAt.getTime() + 6e4 - Date.now()) / 1e3);
    if (remaining > 0)
      throw new HttpError(429, "Please wait before requesting another code", "REGISTRATION_RESEND_COOLDOWN");
    await tx.execute(sql14`select pg_advisory_xact_lock(hashtext(${"registration-resend:" + id2}))`);
    const key3 = digest("registration-resend:" + id2);
    const result = await tx.execute(sql14`insert into auth_rate_limits ("key",attempts,expires_at)
      values (${key3},1,now() + interval '60 seconds')
      on conflict ("key") do update set attempts=1, expires_at=now() + interval '60 seconds'
      where auth_rate_limits.expires_at <= now() returning attempts`);
    if (!result.rows.length)
      throw new HttpError(429, "Please wait before requesting another code", "REGISTRATION_RESEND_COOLDOWN");
    let secret2;
    do {
      secret2 = String(randomInt(1e5, 1e6));
    } while (safeEqual(challenge.tokenHash, challengeDigest(id2, "register", secret2)));
    await tx.update(authChallenges).set({ tokenHash: challengeDigest(id2, "register", secret2) }).where(eq15(authChallenges.id, id2));
    await deliver(challenge.email, secret2);
    return id2;
  });
}

// src/lib/logger.ts
import pino from "pino";
var isProduction = process.env.NODE_ENV === "production";
var logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body.password",
    "req.body.currentPassword",
    "req.body.values",
    "currentPassword",
    "encrypted",
    "password",
    "res.headers['set-cookie']"
  ],
  ...isProduction ? {} : {
    transport: {
      target: "pino-pretty",
      options: { colorize: true }
    }
  }
});

// src/lib/ticket-email.ts
async function ticketEmailPreview(user, id2) {
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const row = await one(appointments, id2);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  const patient = await one(patients, row.patientId);
  const account = patient.userId ? await one(users, patient.userId) : null;
  const recipient = String(account?.email || patient.email || "").trim();
  let reason = "";
  if (process.env.NODE_ENV !== "production") reason = "Email delivery is disabled in development.";
  else if (!(await getSettings(db, row.clinicId)).notificationsEnabled) reason = "Email notifications are disabled for this clinic.";
  else if (!validEmailAddress(recipient)) reason = "No valid email address is recorded. Update the patient record first.";
  else {
    try {
      smtpConfig((await resolvedIntegration("smtp")).env);
    } catch {
      reason = "Email delivery is not configured.";
    }
  }
  return { recipient, eligible: !reason, reason };
}
async function ticketAttachment(user, id2) {
  const row = await one(appointments, id2);
  const view = await appointmentViewWithBranch(row, user);
  const clinic = await one(clinics, row.clinicId);
  const qr = await getAppointmentQr(user, id2);
  const origin = process.env.CLINICFLOW_PUBLIC_ORIGIN;
  assert(origin && /^https:\/\/[^/]+$/.test(origin), 503, "Public ticket links are not configured");
  const pdf = new jsPDF();
  const root = process.cwd().endsWith("api-server") ? process.cwd() : resolve(process.cwd(), "artifacts/api-server");
  const font = await readFile(resolve(root, "assets/ticket-font.ttf"));
  pdf.addFileToVFS("ticket.ttf", font.toString("base64"));
  pdf.addFont("ticket.ttf", "Ticket", "normal");
  pdf.setFont("Ticket");
  const logo = await readFile(resolve(root, "../clinicflow/public/digiq-doctors-logo.png"));
  pdf.addImage(logo.toString("base64"), "PNG", 15, 10, 40, 20);
  pdf.setFontSize(18);
  pdf.text("Visit Ticket", 65, 23);
  pdf.setFontSize(11);
  const text2 = `${view.patientName}
Waiting number: ${view.token}
Current status: ${view.status}
${view.branchAddress ? `Address: ${view.branchAddress}
` : ""}
${confirmationText(view, clinic).replace("Your appointment is confirmed.", "Visit details.")}
Keep your QR private. Staff must confirm consultation check-in.`;
  const lines = pdf.splitTextToSize(text2, 175);
  let y = 40;
  for (const line of lines) {
    if (y > 270) {
      pdf.addPage();
      y = 15;
    }
    pdf.text(line, 15, y);
    y += 6;
  }
  if (y > 205) {
    pdf.addPage();
    y = 15;
  }
  pdf.addImage(await QRCode.toDataURL(new URL(qr.checkInUrl, origin).href, { width: 500, margin: 2 }), "PNG", 15, y + 5, 60, 60);
  return Buffer.from(pdf.output("arraybuffer"));
}
async function emailTicket(user, id2, requestId, recipient) {
  const preview = await ticketEmailPreview(user, id2);
  assert(preview.eligible, 409, preview.reason);
  assert(preview.recipient === recipient, 409, "Recipient changed. Review and confirm again.");
  const attachment = await ticketAttachment(user, id2);
  const key3 = `ticket-email:${createHash4("sha256").update(`${user.id}:${id2}:${requestId}`).digest("hex")}`;
  const claim = await db.transaction(async (tx) => {
    await tx.execute(sql15`select pg_advisory_xact_lock(hashtext(${key3}))`);
    const [existing] = await tx.select().from(settings).where(eq16(settings.id, key3));
    if (existing) return false;
    await tx.insert(settings).values({ id: key3, data: { state: "dispatching", appointmentId: id2, at: Date.now() } });
    return true;
  });
  if (!claim) {
    const [existing] = await db.select().from(settings).where(eq16(settings.id, key3));
    return { state: existing.data.state === "provider_accepted" ? "provider_accepted" : "unknown" };
  }
  try {
    await consumeRateLimit(`ticket-email:${user.id}`, 100);
    await consumeRateLimit(`ticket-email-appointment:${id2}`, 3);
    const current = await ticketEmailPreview(user, id2);
    assert(current.eligible && current.recipient === recipient, 409, "Recipient or delivery settings changed. Review again.");
    await sendAuthEmail(
      preview.recipient,
      "Your visit ticket",
      "Your private visit ticket is attached. The session is a time range, not an exact consultation time.",
      void 0,
      void 0,
      [{ filename: "visit-ticket.pdf", content: attachment, contentType: "application/pdf" }]
    );
    await db.update(settings).set({ data: { state: "provider_accepted", appointmentId: id2, at: Date.now() } }).where(eq16(settings.id, key3));
    await audit(user, "email-ticket", "appointments", { id: id2 }).catch(() => {
      logger.error("Ticket email audit could not be recorded");
    });
    return { state: "provider_accepted" };
  } catch {
    await db.update(settings).set({ data: { state: "unknown", appointmentId: id2, at: Date.now() } }).where(eq16(settings.id, key3));
    return { state: "unknown" };
  }
}

// src/routes/appointments.ts
import { z as validator } from "zod";
var STAFF_CONTACT_OPTIONAL_ROLES = ["superAdmin", "clinicAdmin", "receptionist", "doctor"];
var appointmentsRouter = Router2();
appointmentsRouter.get("/appointments/:id/email-ticket", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await ticketEmailPreview(await requireUser(req), req.params.id));
});
appointmentsRouter.post("/appointments/:id/email-ticket", async (req, res) => {
  const body = validator.object({ requestId: validator.string().uuid(), recipient: validator.string().email() }).parse(req.body);
  res.setHeader("Cache-Control", "no-store");
  res.json(await emailTicket(await requireUser(req), req.params.id, body.requestId, body.recipient));
});
appointmentsRouter.get("/appointments", async (req, res) => {
  const user = await requireUser(req), q = query(ListAppointmentsQueryParams, req);
  const result = await queryAppointmentPage(user, q);
  res.json({ ...result, items: await appointmentViews(result.items, user) });
});
appointmentsRouter.get("/appointments/calendar", async (req, res) => {
  const user = await requireUser(req), q = query(ListAppointmentsQueryParams, req);
  res.setHeader("Cache-Control", "no-store");
  res.json(await queryAppointmentCalendar(user, q));
});
appointmentsRouter.get("/appointments/:id", async (req, res) => {
  const user = await requireUser(req), row = await one(appointments, req.params.id);
  assert(await canRead(user, "appointments", row), 403, "Appointment outside your scope");
  res.json(await appointmentViewWithBranch(row, user));
});
appointmentsRouter.post("/appointments", async (req, res) => {
  const user = await requireUser(req), body = parse(CreateAppointmentBody, req.body);
  if (user.role === "patient") assert(body.patientId === user.patientId && ["online", "qr"].includes(body.source), 403, "Patients may book online for themselves only");
  else assert(scope(user, body.clinicId, body.branchId) && (user.role !== "doctor" || body.doctorId === user.doctorId), 403, "Booking outside assigned scope");
  const row = await db.transaction((tx) => bookAppointment(user, body, tx));
  const confirmationEmail = await confirmAppointmentEmail(row.id);
  res.status(201).json(await appointmentViewWithBranch({ ...row, confirmationEmail }, user));
});
async function bookAppointment(user, body, tx, guestPolicy = false) {
  assert(!guestPolicy || user.role === "guest" && body.source === "qr", 403, "Invalid guest booking policy");
  await lockQueue(tx, body.doctorId, body.branchId, body.date);
  const existing = await all(appointments, tx);
  if (body.requestId) {
    const original = existing.find((a) => a.requestId === body.requestId && a.actorId === user.id);
    if (original) {
      assert(original.patientId === body.patientId && original.doctorId === body.doctorId && original.clinicId === body.clinicId && original.branchId === body.branchId && original.date === body.date && (!body.startTime || original.startTime === body.startTime) && (!body.sessionId || original.sessionId === body.sessionId) && original.source === body.source, 409, "Idempotency key already used for another booking");
      return original;
    }
  }
  const available = await availability(body.doctorId, body.branchId, body.date, tx, body);
  body = { ...body, sessionId: available.sessionId, startTime: available.startTime };
  assert(!sessionRows(existing, body).some((a) => a.patientId === body.patientId && !["cancelled", "completed", "noShow"].includes(a.status)), 409, "Patient already has an active booking for this session");
  const patient = await one(patients, body.patientId, tx);
  assert(patient.status === "active", 409, "Patient is inactive");
  const guestPatient = guestPolicy && !patient.userId && patient.clinicId === body.clinicId && patient.branchId === body.branchId;
  assert(!guestPolicy || guestPatient, 403, "Guest patient outside booking scope");
  const contactOptional = !patient.userId && STAFF_CONTACT_OPTIONAL_ROLES.includes(user.role) || guestPatient;
  if (!contactOptional) assert(/^\+[1-9][0-9]{7,14}$/.test(patient.mobile), 400, "Complete the patient's international mobile number before booking");
  assert(guestPatient || user.role === "patient" || await canRead(user, "patients", patient, tx), 403, "Patient outside assigned scope");
  assert(available.clinicId === body.clinicId, 400, "Clinic/branch mismatch");
  assert(available.available, 409, available.reason || "Session unavailable");
  assert(available.queueMode !== "appointmentsOnly" || body.source !== "walkIn", 409, "Session accepts appointments only");
  assert(available.queueMode !== "walkInsOnly" || body.source === "walkIn", 409, "Session accepts walk-ins only");
  const now = localNow(available.timezone);
  if (body.source === "walkIn") assert(body.date === now.date, 400, "Walk-ins must be for today");
  if (body.date === now.date) {
    assert(!available.queueCloseTime || now.minute < minutes(available.queueCloseTime), 409, "Queue booking has closed");
    if (body.source === "walkIn") {
      assert(now.minute >= minutes(available.queueOpenTime || available.startTime), 409, "Queue has not opened");
      assert(!available.breakStart || now.minute < minutes(available.breakStart) || now.minute >= minutes(available.breakEnd), 409, "Doctor is on a break");
    }
  }
  const config = await getSettings(tx, body.clinicId);
  const confirmationEmail = await initialConfirmationEmail(patient, config.notificationsEnabled, tx);
  assert(contactOptional || !config.requireMobileVerification || patient.mobileVerified, 403, "Patient mobile verification is required");
  if (user.role === "patient") assert(body.termsAccepted, 400, "Terms and privacy consent is required");
  if (body.source === "qr") {
    assert(body.qrReference, 400, "QR reference required");
    const context = await resolveQr(body.qrReference, tx, true);
    assert(context.clinicId === body.clinicId && (!context.branchId || context.branchId === body.branchId) && (!context.doctorId || context.doctorId === body.doctorId), 400, "Booking does not match QR context");
  }
  for (const [field, category] of [["appointmentTypeId", "appointmentType"], ["consultationTypeId", "consultationType"]]) if (body[field]) {
    const m = await one(masters, body[field], tx);
    assert(m.category === category && m.status === "active", 400, `Invalid ${field}`);
  }
  const tokenNumber = await allocateToken(body, tx);
  const doctor = await enrich("doctors", await one(doctors, body.doctorId, tx), tx), clinic = await one(clinics, body.clinicId, tx), branch = await one(branches, body.branchId, tx);
  const id2 = uid(), timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  const expectedDurationMinutes = await snapshotDuration(body, tx);
  const queueRank = Math.max(0, ...sessionRows(existing, body).map(rank)) + 1;
  const result = await put(appointments, { id: id2, status: "waiting", patientId: body.patientId, doctorId: body.doctorId, clinicId: body.clinicId, branchId: body.branchId, date: body.date, tokenNumber, requestId: body.requestId, actorId: user.id, data: { ...body, confirmationEmail, ...guestPolicy ? { bookingOrigin: "anonymousGuest" } : {}, waitingAt: timestamp2, reference: `CF-${uid().replaceAll("-", "").toUpperCase().slice(0, 16)}`, token: `${available.tokenPrefix}-${String(tokenNumber).padStart(2, "0")}`, patientName: patient.fullName, patientCode: patient.code, doctorName: doctor.fullName, clinicName: clinic.name, branchName: branch.name, branchAddress: branch.address ?? null, timezone: available.timezone, startTime: available.startTime, endTime: available.endTime, history: [{ status: "waiting", occurredAt: timestamp2 }] } }, tx);
  Object.assign(result, { expectedDurationMinutes, queueRank, revision: 0 });
  await change(appointments, id2, { data: result }, tx);
  await put(appointmentHistory, { id: uid(), appointmentId: id2, actorId: user.id, toStatus: "waiting" }, tx);
  await audit(user, "book", "appointments", result, tx);
  return result;
}
appointmentsRouter.post("/appointments/:id/actions", async (req, res) => {
  const user = await requireUser(req), body = parse(TransitionAppointmentBody, req.body);
  res.json(await appointmentViewWithBranch(await db.transaction((tx) => transition(user, req.params.id, body, tx)), user));
});
appointmentsRouter.post("/appointments/:id/reschedule", async (req, res) => {
  const user = await requireUser(req), body = parse(RescheduleAppointmentBody, req.body);
  res.json(await appointmentViewWithBranch(await db.transaction((tx) => reschedule(user, req.params.id, body, tx)), user));
});

// src/routes/guest-requests.ts
init_db();
import { Router as Router3 } from "express";
import { createHash as createHash5 } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { and as and3, eq as eq17, sql as sql16, desc, asc, inArray as inArray2 } from "drizzle-orm";
import { z as schema } from "zod";
init_http();
init_auth();
init_store();
init_availability();
init_display_preferences();
init_appointment_confirmation();
var guestRequestsRouter = Router3();
var guestListControls = schema.object({
  search: schema.string().trim().max(200).optional(),
  sort: schema.enum(["createdAt", "-createdAt", "fullName", "-fullName", "date", "-date"]).optional()
});
var guestHash = (s) => createHash5("sha256").update(s).digest("hex");
function guestReceipt(r, appointment) {
  const receipt = Object.fromEntries(["id", "status", "fullName", "clinicName", "branchName", "doctorName", "date", "sessionId", "startTime", "endTime", "timezone", "token", "reason"].map((k) => [k, r[k] ?? null]));
  const payload = appointment?.reference ? createAppointmentQrPayload(appointment.reference) : null;
  return {
    ...receipt,
    ...clinicDisplayPreferences(r),
    ...appointment ? Object.fromEntries(
      ["clinicName", "branchName", "doctorName", "date", "sessionId", "startTime", "endTime", "timezone", "token"].map((key3) => [key3, appointment[key3] ?? receipt[key3]])
    ) : {},
    appointmentId: r.appointmentId ?? null,
    reference: appointment?.reference ?? null,
    branchAddress: appointment?.branchAddress ?? r.branchAddress ?? null,
    appointmentStatus: appointment?.status ?? null,
    revision: appointment?.revision ?? null,
    confirmationEmail: appointment?.confirmationEmail ?? r.confirmationEmail,
    checkInUrl: payload ? `/check-in?payload=${encodeURIComponent(payload)}` : null
  };
}
async function currentReceipt(row, conn = db) {
  let appointment = row.appointmentId ? await one(appointments, row.appointmentId, conn) : null;
  if (appointment && appointment.branchAddress == null) {
    const branch = await one(branches, appointment.branchId, conn);
    appointment = { ...appointment, branchAddress: branch.address ?? null };
  }
  const clinic = await one(clinics, appointment?.clinicId || row.clinicId, conn);
  return guestReceipt({ ...row, ...clinicDisplayPreferences(clinic) }, appointment);
}
function staffView(r) {
  return {
    ...guestReceipt(r),
    clinicId: r.clinicId,
    branchId: r.branchId,
    doctorId: r.doctorId,
    email: r.email ?? null,
    mobile: r.mobile ?? null,
    appointmentId: r.appointmentId ?? null,
    createdAt: new Date(r.createdAt).toISOString()
  };
}
async function staff(req) {
  const user = await requireUser(req);
  assert(["superAdmin", "clinicAdmin", "receptionist"].includes(user.role), 403, "Reception access required");
  return user;
}
var submissionLimit = rateLimit({ windowMs: 15 * 6e4, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many guest requests. Please retry later.", code: "RATE_LIMIT" } });
var receiptLimit = rateLimit({ windowMs: 6e4, limit: 60, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many receipt requests.", code: "RATE_LIMIT" } });
async function createGuestRequest(body, conn = db) {
  createAppointmentQrPayload("guest-signing-preflight");
  body = { ...body, fullName: body.fullName.trim(), email: body.email?.trim() || null, mobile: body.mobile?.trim() || null };
  assert(body.fullName.length > 0, 400, "Name is required");
  const { receiptSecret, ...input } = body;
  const receiptHash = guestHash(receiptSecret), inputHash = guestHash(JSON.stringify(input));
  return conn.transaction(async (tx) => {
    await tx.execute(sql16`select pg_advisory_xact_lock(hashtext(${"guest:" + body.requestId}))`);
    const [existing] = await tx.select().from(guestRequests).where(eq17(guestRequests.requestId, body.requestId));
    if (existing) {
      assert(existing.inputHash === inputHash && existing.receiptHash === receiptHash, 409, "Idempotency key already used for another request");
      return flatten(existing);
    }
    await tx.execute(sql16`select pg_advisory_xact_lock(hashtext(${"guest-receipt:" + receiptHash}))`);
    const [claimed] = await tx.select({ id: guestRequests.id }).from(guestRequests).where(eq17(guestRequests.receiptHash, receiptHash));
    assert(!claimed, 409, "Receipt secret already belongs to another request");
    const context = await resolveQr(body.qrReference, tx, true);
    assert((!context.branchId || context.branchId === body.branchId) && (!context.doctorId || context.doctorId === body.doctorId), 400, "Request does not match QR context");
    const available = await availability(body.doctorId, body.branchId, body.date, tx, body);
    assert(available.clinicId === context.clinicId, 400, "Request does not match QR clinic");
    assert(available.available && available.queueMode !== "walkInsOnly", 409, available.reason || "Session does not accept appointments");
    const doctor = await enrich("doctors", await one(doctors, body.doctorId, tx), tx);
    const branch = await one(branches, body.branchId, tx);
    const clinic = await one(clinics, context.clinicId, tx);
    const id2 = uid(), patientId = uid();
    await put(patients, {
      id: patientId,
      clinicId: context.clinicId,
      branchId: body.branchId,
      mobile: body.mobile,
      data: { fullName: body.fullName, email: body.email, code: `PAT-${patientId.slice(0, 8)}` }
    }, tx);
    const appointment = await bookAppointment(
      { id: clinic.adminId, role: "guest" },
      {
        patientId,
        clinicId: context.clinicId,
        branchId: body.branchId,
        doctorId: body.doctorId,
        date: body.date,
        sessionId: available.sessionId,
        startTime: available.startTime,
        source: "qr",
        qrReference: body.qrReference,
        requestId: `guest:${id2}`
      },
      tx,
      true
    );
    return put(guestRequests, {
      id: id2,
      requestId: body.requestId,
      receiptHash,
      inputHash,
      clinicId: context.clinicId,
      branchId: body.branchId,
      doctorId: body.doctorId,
      date: body.date,
      status: "confirmed",
      appointmentId: appointment.id,
      data: {
        fullName: body.fullName,
        email: body.email,
        mobile: body.mobile,
        qrReference: body.qrReference,
        clinicName: context.clinicName,
        branchName: branch.name,
        branchAddress: branch.address || null,
        doctorName: doctor.fullName,
        sessionId: available.sessionId,
        startTime: available.startTime,
        endTime: available.endTime,
        timezone: available.timezone,
        token: appointment.token,
        reason: null
      }
    }, tx);
  });
}
async function decideGuestRequest(user, id2, body, conn = db) {
  assert(["superAdmin", "clinicAdmin", "receptionist"].includes(user.role), 403, "Reception access required");
  assert(body.reason.trim(), 400, "Decision reason required");
  return conn.transaction(async (tx) => {
    const [raw2] = await tx.select().from(guestRequests).where(eq17(guestRequests.id, id2)).for("update");
    assert(raw2, 404, "Request not found");
    let row = flatten(raw2);
    assert(scope(user, row.clinicId, row.branchId), 403, "Request outside assigned scope");
    const status = body.action === "confirm" ? "confirmed" : "rejected";
    if (row.status !== "pending") {
      assert(row.status === status, 409, "Request already decided");
      return row;
    }
    let appointmentId = null, token = null;
    if (status === "confirmed") {
      const patientId = uid();
      await put(patients, {
        id: patientId,
        clinicId: row.clinicId,
        branchId: row.branchId,
        mobile: row.mobile,
        data: { fullName: row.fullName, email: row.email, code: `PAT-${patientId.slice(0, 8)}` }
      }, tx);
      const appointment = await bookAppointment(user, {
        patientId,
        clinicId: row.clinicId,
        branchId: row.branchId,
        doctorId: row.doctorId,
        date: row.date,
        sessionId: row.sessionId,
        startTime: row.startTime,
        source: "qr",
        qrReference: row.qrReference,
        requestId: `guest:${row.id}`
      }, tx);
      appointmentId = appointment.id;
      token = appointment.token;
    }
    row = await change(guestRequests, id2, {
      status,
      appointmentId,
      decidedBy: user.id,
      data: { ...raw2.data, token, reason: body.reason.trim(), decidedAt: (/* @__PURE__ */ new Date()).toISOString() }
    }, tx);
    await put(auditLogs, {
      id: uid(),
      actorId: user.id,
      clinicId: row.clinicId,
      branchId: row.branchId,
      action: `guest-${body.action}`,
      entityType: "guestRequests",
      entityId: row.id,
      summary: body.reason.trim()
    }, tx);
    return row;
  });
}
guestRequestsRouter.post("/public/guest-requests", submissionLimit, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const row = await createGuestRequest(parse(CreateGuestRequestBody, req.body));
  const confirmationEmail = row.appointmentId ? await confirmAppointmentEmail(row.appointmentId) : void 0;
  res.status(201).json(CreateGuestRequestResponse.parse({ ...await currentReceipt(row), confirmationEmail }));
});
guestRequestsRouter.post("/public/guest-receipt", receiptLimit, async (req, res) => {
  res.set("Cache-Control", "no-store");
  const body = parse(GetGuestReceiptBody, req.body);
  const [row] = await db.select().from(guestRequests).where(eq17(guestRequests.receiptHash, guestHash(body.receiptSecret)));
  assert(row, 404, "Receipt not found");
  res.json(GetGuestReceiptResponse.parse(await currentReceipt(flatten(row))));
});
guestRequestsRouter.get("/guest-requests", async (req, res) => {
  const user = await staff(req), q = { ...query(ListGuestRequestsQueryParams, req), ...query(guestListControls, req) };
  const page = q.page || 1, pageSize = q.pageSize || 20;
  const clauses = [eq17(guestRequests.status, q.status || "pending")];
  if (q.clinicId) clauses.push(eq17(guestRequests.clinicId, q.clinicId));
  if (q.branchId) clauses.push(eq17(guestRequests.branchId, q.branchId));
  if (q.doctorId) clauses.push(eq17(guestRequests.doctorId, q.doctorId));
  if (q.date) clauses.push(eq17(guestRequests.date, q.date));
  if (q.sessionId) clauses.push(sql16`${guestRequests.data}->>'sessionId'=${q.sessionId}`);
  if (q.startTime) clauses.push(sql16`${guestRequests.data}->>'startTime'=${q.startTime}`);
  if (q.search) {
    const pattern = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
    clauses.push(sql16`(${guestRequests.data}->>'fullName' ilike ${pattern} or ${guestRequests.data}->>'email' ilike ${pattern}
      or ${guestRequests.data}->>'mobile' ilike ${pattern} or ${guestRequests.data}->>'token' ilike ${pattern})`);
  }
  if (user.role !== "superAdmin") {
    clauses.push(inArray2(guestRequests.clinicId, user.clinicIds));
    if (user.role === "receptionist") clauses.push(inArray2(guestRequests.branchId, user.branchIds));
  }
  const where = and3(...clauses);
  const sort = q.sort || "-createdAt", column = sort.replace(/^-/, "") === "fullName" ? sql16`${guestRequests.data}->>'fullName'` : sort.replace(/^-/, "") === "date" ? guestRequests.date : guestRequests.createdAt;
  const rows = await db.select().from(guestRequests).where(where).orderBy(sort.startsWith("-") ? desc(column) : asc(column), asc(guestRequests.id)).limit(pageSize).offset((page - 1) * pageSize);
  const [count] = await db.select({ total: sql16`count(*)::int` }).from(guestRequests).where(where);
  const clinicMap = new Map((await all(clinics)).map((c) => [c.id, c]));
  res.set("Cache-Control", "no-store").json(ListGuestRequestsResponse.parse({ items: rows.map((r) => staffView({ ...flatten(r), ...clinicDisplayPreferences(clinicMap.get(r.clinicId)) })), total: count.total, page, pageSize }));
});
guestRequestsRouter.post("/guest-requests/:id/decision", async (req, res) => {
  const user = await staff(req), body = parse(DecideGuestRequestBody, req.body);
  const row = await decideGuestRequest(user, req.params.id, body);
  const clinic = await one(clinics, row.clinicId);
  const confirmationEmail = row.appointmentId ? await confirmAppointmentEmail(row.appointmentId) : void 0;
  res.set("Cache-Control", "no-store").json(DecideGuestRequestResponse.parse(staffView({ ...row, confirmationEmail, ...clinicDisplayPreferences(clinic) })));
});

// src/routes/queue.ts
init_db();
import { Router as Router4 } from "express";
import { sql as sql18 } from "drizzle-orm";
init_auth();
init_http();
init_store();
init_appointments();
init_availability();
init_queue_order();
init_session_duration();
init_presence();
init_display_preferences();

// src/lib/queue-list.ts
import { sql as sql17 } from "drizzle-orm";
init_queue_order();
init_http();
async function staffQueueList(conn, session, q, paginated) {
  const page = paginated ? q.page || 1 : 1, size = q.pageSize || 20;
  assert(Number.isInteger(page) && page >= 1 && page <= 1e5, 400, "Invalid queue page");
  assert(Number.isInteger(size) && size >= 1 && size <= 100, 400, "Invalid queue page size");
  assert(!q.search || typeof q.search === "string" && q.search.length <= 200, 400, "Queue search must be at most 200 characters");
  const scope2 = sql17`r.doctor_id=${session.doctorId} and r.branch_id=${session.branchId} and r.date=${session.date}
    ${session.startTime ? sql17`and r.data->>'startTime'=${session.startTime}` : session.sessionId ? sql17`and r.data->>'sessionId'=${session.sessionId}` : sql17``}`;
  const pattern = q.search ? `%${q.search.replace(/[\\%_]/g, "\\$&")}%` : null;
  const search = pattern ? sql17`(doc->>'token' ilike ${pattern} or doc->>'reference' ilike ${pattern} or doc->>'patientName' ilike ${pattern} or doc->>'patientCode' ilike ${pattern})` : sql17`true`;
  const group = q.statusGroup && q.statusGroup !== "all" ? statusGroups[q.statusGroup] : null;
  assert(!q.statusGroup || q.statusGroup === "all" || group, 400, "Invalid queue status group");
  const status = sql17`${group ? sql17`doc->>'status' in (${sql17.join(group.map((value) => sql17`${value}`), sql17`,`)})` : sql17`true`}
    and ${q.status ? sql17`doc->>'status'=${q.status}` : sql17`true`}`;
  const rank2 = sql17`coalesce((doc->>'queueRank')::numeric,(doc->>'tokenNumber')::numeric)`;
  const columns = {
    createdAt: sql17`doc->>'createdAt'`,
    date: sql17`doc->>'date'`,
    status: sql17`doc->>'status'`,
    tokenNumber: sql17`(doc->>'tokenNumber')::numeric`,
    queueRank: rank2,
    waitingAt: sql17`doc->>'waitingAt'`
  };
  const sort = q.sort || "queueRank", key3 = sort.replace(/^-/, "");
  assert(columns[key3], 400, "Unsupported queue sort field");
  const order = sort === "queueRank" || sort === "waitingAt" ? sql17`${rank2} asc nulls last, (doc->>'tokenNumber')::numeric asc nulls last, doc->>'id' asc` : sql17`${columns[key3]} ${sort.startsWith("-") ? sql17`desc nulls last` : sql17`asc nulls first`}, doc->>'id' asc`;
  const result = await conn.execute(sql17`with scoped as (
      select ${documentSql("appointments")} as doc from appointments r where ${scope2}
    ), searched as (select doc from scoped where ${search}),
    filtered as (select doc from searched where ${status}),
    page_rows as (select doc from filtered order by ${order} ${paginated ? sql17`limit ${size} offset ${(page - 1) * size}` : sql17``})
    select (select count(*)::int from filtered) as total,
      coalesce((select jsonb_agg(doc) from page_rows),'[]'::jsonb) as entries,
      (select jsonb_build_object('all',count(*)::int,
        'active',(count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting','called','inConsultation')))::int,
        'waiting',(count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting')))::int,
        'absent',(count(*) filter(where doc->>'status'='noShow'))::int,
        'completed',(count(*) filter(where doc->>'status'='completed'))::int,
        'cancelled',(count(*) filter(where doc->>'status'='cancelled'))::int) from searched) as "statusCounts"`);
  const { entries, total, statusCounts } = result.rows[0];
  const pageSize = paginated ? size : Math.max(total, 1);
  return { entries, entriesTotal: total, filteredTotal: total, page, pageSize, totalPages: Math.ceil(total / pageSize), statusCounts };
}

// src/routes/queue.ts
var queueRouter = Router4();
async function selectQueue(q, conn, scopedRows) {
  const rows = sessionRows(scopedRows ?? await all(appointments, conn), { doctorId: q.doctorId, branchId: q.branchId, date: q.date });
  if (q.appointmentId) {
    const own = rows.find((a2) => a2.id === q.appointmentId);
    assert(own && (!q.sessionId || q.sessionId === own.sessionId) && (!q.startTime || q.startTime === own.startTime), 404, "Appointment is not in the selected session");
    return { ...q, startTime: own.startTime, sessionId: own.sessionId };
  }
  const matches = rows.filter((a2) => (!q.sessionId || a2.sessionId === q.sessionId) && (!q.startTime || a2.startTime === q.startTime));
  const starts = [...new Set(matches.map((a2) => a2.startTime))];
  if (q.startTime) return q;
  assert(starts.length <= 1 || q.sessionId, 409, "Select a session for this queue");
  if (starts.length === 1) return { ...q, startTime: starts[0] };
  const a = await availability(q.doctorId, q.branchId, q.date, conn, q);
  return { ...q, startTime: a.startTime, sessionId: a.sessionId };
}
async function authorizeQueue(user, q) {
  const context = await doctorContext(q.doctorId, q.branchId), { branch } = context;
  if (user.role !== "patient") assert(scope(user, branch.clinicId, branch.id) && (user.role !== "doctor" || user.doctorId === q.doctorId), 403, "Queue outside assigned scope");
  return context;
}
queueRouter.get("/session-contexts", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const q = query(GetSessionContextsQueryParams, req);
  const context = await authorizeQueue(user, q);
  const current = await availabilitySessions(q.doctorId, q.branchId, q.date);
  const contexts = current.map((s) => ({ ...s, snapshotOnly: false }));
  const rows = (await db.select().from(appointments).where(sql18`${appointments.doctorId}=${q.doctorId} and ${appointments.branchId}=${q.branchId} and ${appointments.date}=${q.date}`)).map(flatten);
  for (const row of rows) {
    if (contexts.some((s) => s.startTime === (row.startTime ?? null))) continue;
    const members = sessionRows(rows, { ...row, startTime: row.startTime });
    contexts.push({
      doctorId: q.doctorId,
      branchId: q.branchId,
      clinicId: row.clinicId,
      ...clinicDisplayPreferences(context.clinic),
      date: q.date,
      sessionId: row.sessionId ?? null,
      startTime: row.startTime ?? null,
      endTime: row.endTime ?? null,
      timezone: row.timezone || "Asia/Kolkata",
      available: false,
      snapshotOnly: true,
      reason: "Persisted appointment session; not available for new bookings",
      maxTokens: 0,
      bookedTokens: members.filter((a) => a.status !== "cancelled").length,
      remainingTokens: 0
    });
  }
  res.set("Cache-Control", "no-store").json(contexts.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")));
});
queueRouter.get("/queue", async (req, res) => {
  const user = await requireUser(req), q = query(GetQueueQueryParams, req), context = await authorizeQueue(user, q);
  let selected = q;
  let duration = null;
  let listing;
  const paginated = req.query?.page !== void 0 || req.query?.pageSize !== void 0;
  const rows = await db.transaction(async (tx) => {
    await lockQueue(tx, q.doctorId, q.branchId, q.date);
    const candidates = (await tx.select().from(appointments).where(sql18`${appointments.doctorId}=${q.doctorId} and ${appointments.branchId}=${q.branchId} and ${appointments.date}=${q.date}`)).map(flatten);
    selected = await selectQueue(q, tx, candidates);
    const initial = sessionRows(candidates, selected);
    if (user.role === "patient") assert(initial.some((a) => a.patientId === user.patientId && (!q.appointmentId || a.id === q.appointmentId)), 403, "You do not have an appointment in this queue");
    if (initial.length) duration = await readDuration(initial[0], tx);
    if (user.role !== "patient") listing = await staffQueueList(tx, selected, q, paginated);
    return initial;
  });
  const own = user.role === "patient" ? rows.find((a) => a.patientId === user.patientId && (!q.appointmentId || a.id === q.appointmentId)) : q.appointmentId ? rows.find((a) => a.id === q.appointmentId) : void 0;
  if (user.role === "patient") assert(own, 403, "You do not have an appointment in this queue");
  const summary = queueSummary(rows, own, duration);
  res.json({
    doctorId: q.doctorId,
    branchId: q.branchId,
    date: q.date,
    ...clinicDisplayPreferences(context.clinic),
    sessionId: selected.sessionId || rows[0]?.sessionId || null,
    startTime: selected.startTime || null,
    presence: await getPresence(selected),
    ...summary,
    pollIntervalSeconds: 30,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...listing ? { ...listing, entries: listing.entries.map((row) => appointmentView({ ...row, ...clinicDisplayPreferences(context.clinic), branchAddress: row.branchAddress ?? context.branch.address ?? null }, user)) } : {}
  });
});
queueRouter.post("/queue/call-next", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const body = parse(CallNextBody, req.body);
  await authorizeQueue(user, body);
  const { branch } = await doctorContext(body.doctorId, body.branchId);
  assert(body.date === localNow(branch.timezone || "Asia/Kolkata").date, 409, "Queue actions are allowed only on the appointment date");
  const appointment = await db.transaction(async (tx) => {
    await lockQueue(tx, body.doctorId, body.branchId, body.date);
    const selected = await selectQueue(body, tx);
    const rows = sessionRows(await all(appointments, tx), selected);
    assert(!rows.some((a) => ["called", "inConsultation"].includes(a.status)), 409, "Another patient is already called or in consultation");
    const next = orderedReservations(rows.filter((a) => pendingStatuses.includes(a.status)))[0];
    return next ? transition(user, next.id, { action: "call", expectedStatus: next.status }, tx, true) : null;
  });
  res.json({ appointment: appointment ? await appointmentViewWithBranch(appointment, user) : null });
});

// src/routes/resources.ts
init_db();
import { Router as Router6 } from "express";
init_auth();
init_store();
init_http();
import { and as and4, eq as eq19, sql as sql20 } from "drizzle-orm";
import { randomBytes as randomBytes4 } from "node:crypto";

// src/routes/auth.ts
init_db();
init_http();
init_store();
init_auth();
init_auth_email();
init_integration_vault();
import { Router as Router5 } from "express";
import { randomBytes as randomBytes3 } from "node:crypto";
import { eq as eq18, sql as sql19 } from "drizzle-orm";
var authRouter = Router5();
var CODE_AGE = 10 * 6e4;
var LINK_AGE = 30 * 6e4;
var code = () => randomBytes3(4).readUInt32BE() % 9e5 + 1e5;
function email(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/.test(normalized))
    throw new HttpError(400, "Valid email required", "INVALID_EMAIL");
  return normalized;
}
function publicOrigin(req) {
  const origin = process.env.CLINICFLOW_PUBLIC_ORIGIN;
  if (!origin || !/^https:\/\/[^/]+$/.test(origin)) throw new HttpError(503, "Public email links are not configured", "PUBLIC_ORIGIN_UNCONFIGURED");
  return origin;
}
async function localUser(address) {
  const [row] = await db.select().from(users).where(sql19`lower(${users.email})=${address}`).limit(1);
  return row;
}
async function limit(req, address, action, maximum = 5) {
  await consumeRateLimit(`${action}:account:${address}`, maximum);
  await consumeRateLimit(`${action}:ip:${req.ip || "unknown"}`, maximum * 10);
}
async function mailCode(address, purpose, userId, data2) {
  smtpConfig((await resolvedIntegration("smtp")).env);
  const secret2 = String(code());
  const challengeId = await createChallenge({ userId, email: address, purpose, secret: secret2, ttlMs: CODE_AGE, data: data2 });
  await sendAuthEmail(
    address,
    purpose === "register" ? "Verify your DigiQ clinic registration" : "DigiQ Doctors verification",
    purpose === "register" ? `Your clinic administrator registration code is ${secret2}. It expires in 10 minutes. Verify your email to continue setting up your clinic. This is not a doctor invitation. If you did not start this registration, ignore this email.` : `Your verification code is ${secret2}. It expires in 10 minutes.`
  );
  return challengeId;
}
async function mailLink(req, address, userId, purpose, route) {
  await ensureStaffInvitationConfigured();
  const url = new URL(route, publicOrigin(req));
  const secret2 = randomBytes3(32).toString("base64url");
  const id2 = await createChallenge({ userId, email: address, purpose, secret: secret2, ttlMs: LINK_AGE });
  url.searchParams.set("token", `${id2}.${secret2}`);
  await sendAuthEmail(address, "DigiQ Doctors account access", `Use this link within 30 minutes: ${url}`);
}
async function ensureStaffInvitationConfigured() {
  smtpConfig((await resolvedIntegration("smtp")).env);
  publicOrigin(null);
}
function splitToken(token) {
  const parts = typeof token === "string" ? /^([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(token) : null;
  if (!parts) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return { id: parts[1], secret: parts[2] };
}
async function inviteStaff(req, row) {
  await mailLink(req, row.email.toLowerCase(), row.id, "invitation", "/set-password");
  await db.update(users).set({ invitationStatus: "sent" }).where(eq18(users.id, row.id));
}
async function requestStaffReset(req, row) {
  await consumeRateLimit(`forgot-password:ip:${req?.ip || "unknown"}`, 30);
  await mailLink(req, row.email.toLowerCase(), row.id, "reset", "/reset-password");
}
authRouter.get("/auth/csrf", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ csrfToken: issueCsrf(_req, res) });
});
authRouter.get("/auth/status", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = req.authUserId;
  const [user] = userId ? await db.select({ role: users.role }).from(users).where(eq18(users.id, userId)) : [];
  const role = user?.role ?? null;
  res.json({ role, staffPasswordVerified: Boolean(role && isStaffRole(role)), requiresStaffPassword: false });
});
authRouter.post("/auth/login", async (req, res) => {
  const address = email(req.body?.email), password = req.body?.password;
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  await limit(req, address, "staff-login");
  const user = await localUser(address);
  const validPassword = await verifyPassword(user?.passwordHash, password);
  if (!user || !isStaffRole(user.role) || user.status !== "active" || !validPassword)
    throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  await revokeSession(req, res);
  await createSession(res, user.id, user.passwordHash);
  res.set("Cache-Control", "no-store").json({
    authenticated: true,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status }
  });
});
authRouter.post("/auth/verify-device", (_req, res) => {
  res.set("Cache-Control", "no-store");
  throw new HttpError(410, "Device verification is retired. Use staff email and password.", "AUTH_METHOD_REMOVED");
});
authRouter.post("/auth/logout", async (req, res) => {
  await revokeSession(req, res);
  res.set("Cache-Control", "no-store").json({ authenticated: false });
});
authRouter.post("/auth/forgot-password", async (req, res) => {
  const address = email(req.body?.email);
  await consumeRateLimit(`forgot-password:ip:${req.ip || "unknown"}`, 30);
  smtpConfig((await resolvedIntegration("smtp")).env);
  const user = await localUser(address);
  if (user?.status === "active" && isStaffRole(user.role)) await mailLink(req, address, user.id, "reset", "/reset-password");
  res.set("Cache-Control", "no-store").json({ sent: true });
});
async function updatePassword(req, res, purpose) {
  const { id: id2, secret: secret2 } = splitToken(req.body?.token);
  passwordInput(req.body?.password);
  await consumeRateLimit(`${purpose}:token:${id2}`, 5);
  await consumeRateLimit(`${purpose}:ip:${req.ip || "unknown"}`, 20);
  await validateChallenge(id2, purpose, secret2);
  const hashed = await hashPassword(req.body.password);
  const userId = await challengeUserId(id2);
  const token = await db.transaction(async (tx) => {
    await lockCredentials(tx, userId);
    const challenge = await consumeChallenge(id2, purpose, secret2, tx);
    const [user] = await tx.select().from(users).where(eq18(users.id, userId)).for("update");
    if (!user || challenge.userId !== user.id || user.status !== "active" || !isStaffRole(user.role) || user.email.toLowerCase() !== challenge.email)
      throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
    await tx.update(users).set({ passwordHash: hashed, passwordChangedAt: /* @__PURE__ */ new Date(), emailVerifiedAt: /* @__PURE__ */ new Date(), invitationStatus: "notRequired" }).where(eq18(users.id, user.id));
    await invalidateStaffCredentials(tx, user.id);
    return purpose === "invitation" ? insertSession(tx, user.id) : void 0;
  });
  if (token) sessionCookie(res, token);
  res.set("Cache-Control", "no-store").json(purpose === "invitation" ? { authenticated: true } : { reset: true });
}
authRouter.post("/auth/reset-password", async (req, res) => updatePassword(req, res, "reset"));
authRouter.post("/auth/invitation/accept", async (req, res) => updatePassword(req, res, "invitation"));
authRouter.post("/auth/change-password", async (req, res) => {
  const actor = await requireUser(req);
  assert(isStaffRole(actor.role), 403, "Staff account required");
  await limit(req, actor.id, "change-password");
  passwordInput(req.body?.password);
  const [user] = await db.select().from(users).where(eq18(users.id, actor.id));
  if (!user || !await verifyPassword(user.passwordHash, req.body?.currentPassword))
    throw new HttpError(401, "Invalid password", "INVALID_CREDENTIALS");
  const hashed = await hashPassword(req.body.password);
  await db.transaction(async (tx) => {
    await lockCredentials(tx, actor.id);
    const [current] = await tx.select().from(users).where(eq18(users.id, actor.id)).for("update");
    if (!current || current.status !== "active" || !isStaffRole(current.role) || current.passwordHash !== user.passwordHash)
      throw new HttpError(401, "Invalid password", "INVALID_CREDENTIALS");
    await tx.update(users).set({ passwordHash: hashed, passwordChangedAt: /* @__PURE__ */ new Date() }).where(eq18(users.id, actor.id));
    await invalidateStaffCredentials(tx, actor.id);
    await audit(actor, "changePassword", "users", actor, tx);
  });
  res.set("Cache-Control", "no-store").json({ changed: true });
});
authRouter.post("/auth/patient/start", async (req, res) => {
  const address = email(req.body?.email);
  await limit(req, address, "patient-login");
  smtpConfig((await resolvedIntegration("smtp")).env);
  const user = await localUser(address);
  const challengeId = user && (user.status !== "active" || user.role !== "patient") ? randomBytes3(18).toString("base64url") : await mailCode(address, "patient", user?.id);
  res.set("Cache-Control", "no-store").json({ challengeId });
});
authRouter.post("/auth/patient/verify", async (req, res) => {
  await consumeRateLimit(`patient-verify:${req.ip || "unknown"}`, 25);
  const { challengeId, code: submitted } = req.body || {};
  if (typeof challengeId !== "string" || typeof submitted !== "string") throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
  const challenge = await consumeChallenge(challengeId, "patient", submitted);
  const existing = await localUser(challenge.email);
  if (existing && (existing.role !== "patient" || existing.status !== "active"))
    throw new HttpError(401, "Invalid verification", "INVALID_VERIFICATION");
  const user = existing || await db.transaction(async (tx) => {
    await tx.execute(sql19`select pg_advisory_xact_lock(hashtext(${"user-email:" + challenge.email}))`);
    const [nowExisting] = await tx.select().from(users).where(sql19`lower(${users.email})=${challenge.email}`).limit(1);
    if (nowExisting) {
      assert(nowExisting.role === "patient" && nowExisting.status === "active", 401, "Invalid verification");
      return nowExisting;
    }
    return put(users, { id: uid(), email: challenge.email, fullName: "", role: "patient", invitationStatus: "notRequired", emailVerifiedAt: /* @__PURE__ */ new Date() }, tx);
  });
  await db.update(users).set({ emailVerifiedAt: /* @__PURE__ */ new Date() }).where(eq18(users.id, user.id));
  await createSession(res, user.id);
  res.set("Cache-Control", "no-store").json({ authenticated: true });
});
authRouter.post("/auth/register/start", async (req, res) => {
  const address = email(req.body?.email);
  const name = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
  if (!name || name.length > 200) throw new HttpError(400, "Full name required", "INVALID_NAME");
  passwordInput(req.body?.password);
  await limit(req, address, "clinic-register", 3);
  smtpConfig((await resolvedIntegration("smtp")).env);
  if (await localUser(address)) throw new HttpError(409, "Account already registered", "ACCOUNT_EXISTS");
  const hash = await hashPassword(req.body.password);
  const challengeId = await mailCode(address, "register", void 0, { fullName: name, passwordHash: hash });
  res.set("Cache-Control", "no-store").json({ challengeId });
});
authRouter.post("/auth/registration/resend", async (req, res) => {
  res.set("Cache-Control", "no-store");
  await consumeRateLimit(`registration-resend:ip:${req.ip || "unknown"}`, 25);
  const id2 = req.body?.challengeId;
  if (typeof id2 !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(id2))
    throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  smtpConfig((await resolvedIntegration("smtp")).env);
  try {
    const challengeId = await resendRegistrationChallenge(id2, (address, secret2) => sendAuthEmail(address, "Verify your DigiQ clinic registration", `Your clinic administrator registration code is ${secret2}. Use it before your original registration code expires. Verify your email to continue setting up your clinic. This is not a doctor invitation. If you did not start this registration, ignore this email.`));
    res.json({ challengeId });
  } catch (error) {
    if (error instanceof HttpError && error.code === "REGISTRATION_RESEND_COOLDOWN")
      res.set("Retry-After", "60");
    throw error;
  }
});
authRouter.post("/auth/register/verify", async (req, res) => {
  await consumeRateLimit(`register-verify:${req.ip || "unknown"}`, 25);
  const { challengeId, code: submitted } = req.body || {};
  if (typeof challengeId !== "string" || typeof submitted !== "string") throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
  const challenge = await consumeChallenge(challengeId, "register", submitted);
  const user = await db.transaction(async (tx) => {
    await tx.execute(sql19`select pg_advisory_xact_lock(hashtext(${"user-email:" + challenge.email}))`);
    const [existing] = await tx.select().from(users).where(sql19`lower(${users.email})=${challenge.email}`).limit(1);
    assert(!existing, 409, "Account already registered");
    const record2 = await put(users, {
      id: uid(),
      email: challenge.email,
      fullName: String(challenge.data.fullName),
      role: "clinicAdmin",
      status: "active",
      passwordHash: String(challenge.data.passwordHash),
      emailVerifiedAt: /* @__PURE__ */ new Date(),
      invitationStatus: "notRequired"
    }, tx);
    await audit(record2, "registerClinicAdmin", "users", record2, tx);
    return record2;
  });
  await createSession(res, user.id);
  res.set("Cache-Control", "no-store").json({ authenticated: true });
});
authRouter.post("/auth/staff-verify", (_req, _res) => {
  throw new HttpError(410, "Use local staff login", "AUTH_METHOD_REMOVED");
});

// src/routes/resources.ts
init_availability();
var ADDRESS_KEYS = ["address", "country", "state", "city", "pincode"];
async function mergeAddress(table, id2, patch, tx) {
  const [row] = await tx.select({ data: table.data }).from(table).where(eq19(table.id, id2));
  if (row) await change(table, id2, { data: { ...row.data || {}, ...patch } }, tx);
}
var { db: db2, users: users2, doctors: doctors3, patients: patients3, clinics: clinics2, branches: branches2, masters: masters2, schedules: schedules2, availabilityExceptions: availabilityExceptions2, qrs: qrs2, authChallenges: authChallenges2 } = db_exports;
var resourcesRouter = Router6();
resourcesRouter.get("/booking/schedule-access", async (req, res) => {
  const user = await requireUser(req), q = query(GetBookingScheduleAccessQueryParams, req);
  try {
    const branch = await one(branches2, q.branchId);
    await authorizeWrite(user, "schedules", { doctorId: q.doctorId, branchId: q.branchId, clinicId: branch.clinicId });
    const { enforcePermissionPolicy: enforcePermissionPolicy2 } = await Promise.resolve().then(() => (init_permission_policy(), permission_policy_exports));
    for (const path of ["/schedules", "/doctors", "/branches", "/clinics"])
      await enforcePermissionPolicy2(user, { method: "GET", path });
    await enforcePermissionPolicy2(user, { method: "POST", path: "/schedules" });
    await enforcePermissionPolicy2(user, { method: "PATCH", path: "/schedules/context" });
    res.json({ allowed: true });
  } catch (error) {
    if (error instanceof HttpError && [403, 404, 409].includes(error.status)) {
      res.json({ allowed: false });
      return;
    }
    throw error;
  }
});
var definitions = [
  ["clinics", clinics2, CreateClinicBody, ListClinicsQueryParams],
  ["branches", branches2, CreateBranchBody, ListBranchesQueryParams],
  ["doctors", doctors3, CreateDoctorBody, ListDoctorsQueryParams],
  ["users", users2, CreateUserBody, ListUsersQueryParams],
  ["patients", patients3, CreatePatientBody, ListPatientsQueryParams],
  ["masters", masters2, CreateMasterBody, ListMastersQueryParams],
  ["schedules", schedules2, CreateScheduleBody, ListSchedulesQueryParams],
  ["availability-exceptions", availabilityExceptions2, CreateAvailabilityExceptionBody, ListAvailabilityExceptionsQueryParams],
  ["qrs", qrs2, CreateQrBody, ListQrsQueryParams]
];
var governed = {
  userRole: ["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"],
  appointmentStatus: ["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"],
  queueStatus: ["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"],
  bookingSource: ["online", "walkIn", "phone", "qr"],
  queueType: ["mixed", "appointmentsOnly", "walkInsOnly"],
  userStatus: ["active", "inactive"],
  clinicStatus: ["active", "inactive"]
};
async function projectAssignmentScope2(user, kind, row) {
  const result = await projectAssignmentScope(user, kind, row);
  if (kind === "clinics") return { ...result, ...clinicDisplayPreferences2(row) };
  if (kind === "branches") return { ...result, ...clinicDisplayPreferences2(await one(clinics2, row.clinicId)) };
  return result;
}
function ownershipChangeRequested(value, current) {
  return value !== void 0 && value !== current;
}
function invitationRedirectUrl(req) {
  const configured = process.env.CLINICFLOW_PUBLIC_ORIGIN?.trim();
  const requestOrigin = req?.get?.("origin")?.trim();
  const candidate = configured || requestOrigin;
  if (!candidate) return void 0;
  try {
    const url = new URL(candidate);
    const forwardedHost = String(req?.get?.("x-forwarded-host") || req?.get?.("host") || "").split(",")[0].trim().toLowerCase();
    const isRequestOrigin = !configured;
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()) || url.hostname.endsWith(".localhost");
    if (url.protocol !== "https:" || localHost || isRequestOrigin && forwardedHost && url.host.toLowerCase() !== forwardedHost) return void 0;
    url.search = "";
    url.hash = "";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/set-password`;
    return url.toString();
  } catch {
    return void 0;
  }
}
async function withPasswordState(row) {
  if (!row?.id || !["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(row.role)) return row;
  const [identity] = await db2.select({ passwordHash: users2.passwordHash }).from(users2).where(eq19(users2.id, row.id));
  return { ...row, passwordEnabled: Boolean(identity?.passwordHash) };
}
var CLINIC_OWNED_BRANCH_KEYS = ["openingHours", "timezone", "email", "phone", "inheritEmail", "inheritPhone", "linkedSchedule"];
var CLINIC_OWNED_ADDRESS_KEYS = ["name", "slug", "address", "city", "state", "pincode", "country", "area"];
var CLINIC_OWNED_CLINIC_KEYS = ["name", "address", "city", "state", "pincode", "country", "area", "email", "phone", "slug", "timezone", "dateFormat", "timeFormat", "categoryId", "specialityIds", "referralCode", "bookingHorizonDays", "cancellationCutoffMinutes", "policies"];
async function authorizeWrite(user, kind, body, old, conn = db2) {
  if (kind === "doctors") {
    assert(body.userId === void 0, 409, "Doctor identity cannot be reassigned");
    if (old?.userId) {
      const account = await one(users2, old.userId, conn);
      if (account.role === "clinicAdmin") {
        assert(old.ownerAdminId === old.userId && (user.role === "superAdmin" || user.id === old.userId && user.role === "clinicAdmin"), 403, "Only Super Admin or the owning Clinic Admin can edit this clinical profile");
        assert(body.ownerAdminId === void 0 || body.ownerAdminId === old.userId, 409, "Self-owned doctor profile cannot be transferred");
        assert(body.clinicIds === void 0, 409, "Administrative clinic mappings cannot be edited through a doctor profile");
      }
    }
  }
  const context = { ...old, ...body };
  if (body.timezone) localNow(body.timezone);
  if (old) assert(await canRead(user, kind, old, conn), 403, "Record outside your scope");
  if (user.role !== "superAdmin" && // Clinic-owned onboarding defaults inherited by new staff (identity, address, contact, timezone, date/time
  // format, policies, opening hours): every edit of an existing clinic or location is owner-only.
  (kind === "clinics" && old && CLINIC_OWNED_CLINIC_KEYS.some((key3) => Object.hasOwn(body, key3)) || kind === "branches" && CLINIC_OWNED_BRANCH_KEYS.some((key3) => Object.hasOwn(body, key3)) || kind === "branches" && old && CLINIC_OWNED_ADDRESS_KEYS.some((key3) => Object.hasOwn(body, key3)))) {
    assert(user.role === "clinicAdmin", 403, "Only the owning Clinic Admin can change clinic settings");
    const clinic = await one(clinics2, kind === "clinics" ? old.id : context.clinicId, conn);
    assert(clinic.adminId === user.id, 403, "Only the owning Clinic Admin can change clinic settings");
  }
  if (old && kind === "doctors" && user.role === "clinicAdmin") assert(old.clinicIds.some((id2) => user.clinicIds.includes(id2)), 403, "This doctor is outside your administration scope");
  if (kind === "masters") roles(user, ["superAdmin"]);
  else if (kind === "users") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    if (user.role === "doctor") assert((body.role || old?.role) === "receptionist", 403, "Doctors may manage receptionists only");
    if (user.role === "clinicAdmin") assert(["doctor", "receptionist", "patient"].includes(body.role || old?.role), 403, "Cannot grant administrator roles");
    if (old) assert(!body.role || body.role === old.role, 409, "Existing account roles cannot be switched");
    if (!old) assert(body.role !== "doctor", 400, "Create doctors through the doctor resource so an owning Clinic Admin is recorded");
    if (!old) assert(body.role !== "clinicAdmin", 409, "Create Clinic Admins together with their first clinic through clinic admin onboarding");
  } else if (kind === "doctors") {
    roles(user, ["superAdmin", "clinicAdmin", ...old?.id === user.doctorId ? ["doctor"] : []]);
    if (old && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId)) {
      roles(user, ["superAdmin"]);
    }
  } else if (kind === "clinics") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    if (old && ownershipChangeRequested(body.adminId, old.adminId)) roles(user, ["superAdmin"]);
  } else if (kind === "patients") {
    roles(user, ["superAdmin", "clinicAdmin", "receptionist", ...old?.id === user.patientId ? ["patient"] : []]);
    if (user.role === "patient") assert(body.clinicId === void 0 && body.branchId === void 0 && body.status === void 0, 403, "Patients cannot change registration scope or status");
    else assert(body.clinicId || old?.clinicId || user.role === "superAdmin", 400, "Clinic registration is required");
    if (old && user.role !== "patient" && user.role !== "superAdmin") assert(scope(user, old.clinicId, old.branchId), 403, "Only the registering clinic may edit this patient's demographics");
    if (old && user.role !== "superAdmin") assert((body.clinicId === void 0 || body.clinicId === old.clinicId) && (body.branchId === void 0 || body.branchId === old.branchId), 403, "Registration assignments cannot be moved");
  } else if (kind === "branches") {
    roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
  } else roles(user, ["superAdmin", "clinicAdmin", "doctor", ...["qrs", "schedules", "availability-exceptions"].includes(kind) ? ["receptionist"] : []]);
  if (context.clinicId) {
    if (kind === "branches" && user.role === "doctor") {
      const clinic = await one(clinics2, context.clinicId, conn);
      assert(clinic.adminId === user.managingAdminId, 403, "Clinic outside your managing administrator's catalog");
    } else assert(scope(user, context.clinicId, context.branchId), 403, "Clinic outside assigned scope");
  }
  if (context.branchId) {
    const branch = await one(branches2, context.branchId, conn);
    assert(!context.clinicId || branch.clinicId === context.clinicId, 400, "Branch does not belong to clinic");
    assert(scope(user, branch.clinicId, branch.id), 403, "Branch outside assigned scope");
  }
  if (context.doctorId) {
    if (["schedules", "availability-exceptions"].includes(kind) && user.role === "doctor") assert(context.doctorId === user.doctorId, 403, "Doctors may manage only their own schedule.");
    if (context.branchId) await doctorContext(context.doctorId, context.branchId, conn);
    if (context.branchId) {
      const doctor = await enrich("doctors", await one(doctors3, context.doctorId, conn), conn);
      assert(doctor.branchIds.includes(context.branchId) && scope(user, (await one(branches2, context.branchId, conn)).clinicId, context.branchId), 403, "You cannot manage this doctor's availability at this location");
    }
  }
  if (kind === "qrs") {
    const context2 = { ...old, ...body };
    if (user.role === "doctor") assert(context2.doctorId === user.doctorId, 403, "Doctor booking links must use your own doctor profile");
    if (context2.doctorId) {
      const doctor = await enrich("doctors", await one(doctors3, context2.doctorId, conn), conn);
      assert(doctor.status === "active" && doctor.clinicIds.includes(context2.clinicId), 409, "Doctor is not active and assigned to this clinic");
    }
  }
  if ((body.clinicIds || body.branchIds) && user.role === "doctor") assert(kind === "users" && (body.role || old?.role) === "receptionist", 403, "Doctors may assign receptionists only");
  for (const [field, category] of Object.entries({ specializationId: "specialization", clinicTypeId: "clinicType", categoryId: "clinicCategory" })) {
    if (body[field]) {
      const m = await one(masters2, body[field], conn);
      assert(m.category === category && m.status === "active", 400, `Invalid ${field}`);
    }
  }
  for (const id2 of body.qualificationIds || []) {
    const m = await one(masters2, id2, conn);
    assert(m.category === "qualification" && m.status === "active", 400, "Invalid qualification");
  }
  if (kind === "masters") {
    if (governed[body.category]) assert(governed[body.category].includes(body.code), 400, "This category uses governed workflow codes");
    if (old && governed[old.category]) assert(body.code === old.code && body.category === old.category, 400, "Governed codes cannot be changed");
    if (body.parentId) {
      assert(body.parentId !== old?.id, 400, "Master cannot parent itself");
      await one(masters2, body.parentId, conn);
    }
  }
}
async function deliverInvitation(userId, redirectUrl) {
  const account = await one(users2, userId);
  assert(["clinicAdmin", "doctor", "receptionist"].includes(account.role) && account.status === "active", 403, "Only active staff can be invited");
  const [credential] = await db2.select({ passwordHash: users2.passwordHash }).from(users2).where(eq19(users2.id, userId));
  if (credential?.passwordHash) return;
  await db2.update(authChallenges2).set({ consumedAt: /* @__PURE__ */ new Date() }).where(and4(
    eq19(authChallenges2.userId, userId),
    eq19(authChallenges2.purpose, "invitation")
  ));
  try {
    await inviteStaff(null, account);
  } catch (error) {
    if (!(error instanceof HttpError) || !["EMAIL_DELIVERY_FAILED", "EMAIL_UNCONFIGURED", "PUBLIC_ORIGIN_UNCONFIGURED"].includes(error.code)) throw error;
    await db2.update(authChallenges2).set({ consumedAt: /* @__PURE__ */ new Date() }).where(and4(
      eq19(authChallenges2.userId, userId),
      eq19(authChallenges2.purpose, "invitation")
    ));
    await change(users2, userId, { invitationStatus: "failed" });
  }
}
async function createClinicAdminOnboarding(actor, body, redirectUrl) {
  roles(actor, ["superAdmin"]);
  const email2 = body.admin.email.toLowerCase();
  if (body.clinic.timezone) localNow(body.clinic.timezone);
  assert(!(await all(users2)).some((u) => u.email === email2), 409, "Email already belongs to an existing profile; roles cannot be silently changed");
  await ensureStaffInvitationConfigured();
  const result = await db2.transaction(async (tx) => {
    await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"user-email:" + email2}))`);
    assert(!(await all(users2, tx)).some((u) => u.email === email2), 409, "Email already belongs to an existing profile; roles cannot be silently changed");
    const adminId = uid();
    const admin = await put(users2, {
      id: adminId,
      fullName: body.admin.fullName,
      email: email2,
      mobile: body.admin.mobile,
      role: "clinicAdmin",
      status: "active",
      invitationStatus: "failed"
    }, tx);
    const setup = await createOwnedClinic(actor, admin, body, tx);
    const clinic = setup.clinic;
    await audit(actor, "create", "users", admin, tx);
    await audit(actor, "create", "clinics", clinic, tx);
    return {
      branches: setup.branches,
      doctorId: setup.doctorId,
      admin: await enrich("users", admin, tx),
      clinic: await enrich("clinics", clinic, tx)
    };
  });
  await deliverInvitation(result.admin.id, redirectUrl);
  return {
    ...result,
    admin: await enrich("users", await one(users2, result.admin.id))
  };
}
async function save(kind, table, user, body, old, redirectUrl, refreshActor) {
  await authorizeWrite(user, kind, body, old);
  if (old && ["users", "doctors"].includes(kind) && body.email !== void 0 && body.email.toLowerCase() !== old.email.toLowerCase())
    throw new HttpError(409, "Changing a login email requires a separately verified account transfer", "EMAIL_CHANGE_REQUIRES_VERIFICATION");
  if (kind === "users" || kind === "doctors") body.email = body.email.toLowerCase();
  if (!old && (kind === "users" || kind === "doctors")) {
    const existing = (await all(users2)).find((u) => u.email === body.email);
    assert(!existing, 409, "Email already belongs to an existing profile; roles cannot be silently changed");
    if (kind === "doctors" || ["clinicAdmin", "doctor", "receptionist"].includes(body.role))
      await ensureStaffInvitationConfigured();
  }
  const saved = await db2.transaction(async (tx) => {
    const proposed = { ...old, ...body };
    if (kind === "users" && old?.id === user.id && body.status === "inactive")
      assert(false, 409, "You cannot deactivate your own account");
    if (kind === "branches" && old && (body.openingHours !== void 0 || body.timezone !== void 0)) {
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + old.id}))`);
      assert(!(await one(branches2, old.id, tx)).linkedSchedule?.enabled, 409, "This location has linked doctor sessions. Change opening hours through Clinic settings to preview and synchronize safely.");
    }
    await validateSlugWrite(kind, body, old, tx);
    if (kind === "clinics") await validateClinicMetadata(body, tx);
    if (kind === "branches" && proposed.openingHours) {
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + old?.id}))`);
      validateOpeningHours(proposed.openingHours);
      if (proposed.openingHours.length) for (const s of (await all(schedules2, tx)).filter((s2) => s2.branchId === old?.id && s2.status === "active")) withinBranchHours(proposed, s);
    }
    await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${kind + ":" + (proposed.doctorId || old?.id || body.email || "create")}))`);
    if (kind === "doctors" && old && body.branchIds !== void 0) {
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"schedules:" + old.id}))`);
      for (const location of await all(branches2, tx)) {
        assert(!location.linkedSchedule?.enabled || location.linkedSchedule.doctorId !== old.id || body.branchIds.includes(location.id), 409, "Unlink clinic hours before removing this doctor's linked consultation location.");
      }
    }
    if (kind === "schedules") {
      const current = old ? await one(schedules2, old.id, tx) : null;
      if (current) assertScheduleSnapshot(current, body.expectedSnapshot);
      assert(!current?.linkedBranchId, 409, "This session follows clinic hours. Unlink it in Clinic settings before making custom edits.");
      const { freezeDoctorSessions: freezeDoctorSessions2 } = await Promise.resolve().then(() => (init_session_duration(), session_duration_exports));
      await freezeDoctorSessions2(proposed.doctorId, tx);
    }
    if (old && kind === "doctors" && body.ownerAdminId !== void 0) {
      const current = await one(doctors3, old.id, tx);
      assert(current.ownerAdminId === old.ownerAdminId, 409, "Doctor ownership changed; reload before retrying");
    }
    if (old && kind === "clinics" && body.adminId !== void 0) {
      const current = await one(clinics2, old.id, tx);
      assert(current.adminId === old.adminId, 409, "Clinic ownership changed; reload before retrying");
    }
    if (old && kind === "users" && old.role === "receptionist" && body.managingAdminId !== void 0) {
      const current = await one(users2, old.id, tx);
      assert(current.managingAdminId === old.managingAdminId, 409, "Staff ownership changed; reload before retrying");
    }
    if (["schedules", "availability-exceptions"].includes(kind)) {
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"schedules:" + proposed.doctorId}))`);
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + proposed.doctorId}))`);
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"branch-hours:" + proposed.branchId}))`);
      if (kind === "schedules") {
        if (refreshActor) user = await refreshActor();
        const current = old ? await one(schedules2, old.id, tx) : void 0;
        if (current) assertScheduleSnapshot(current, body.expectedSnapshot);
        await authorizeWrite(user, kind, body, current, tx);
        const location = await one(branches2, proposed.branchId, tx);
        assert(typeof location.timezone === "string" && !!location.timezone, 409, "Location timezone is not configured. Configure it in Clinic settings before saving sessions.");
        const doctor = await enrich("doctors", await one(doctors3, proposed.doctorId, tx), tx);
        assert(location.status === "active" && doctor.status === "active" && doctor.branchIds.includes(location.id) && doctor.clinicIds.includes(location.clinicId), 409, "Doctor assignments or location status changed. Reload the schedule context before saving.");
        assert(proposed.clinicId === location.clinicId, 409, "Location no longer belongs to this Clinic Group. Reload the schedule context.");
        assert(!body.timezone || body.timezone === location.timezone, 409, "Location timezone changed. Reload and review the schedule before saving.");
      }
      if (kind === "availability-exceptions" && proposed.sessionId) {
        const session = await one(schedules2, proposed.sessionId, tx);
        assert(session.doctorId === proposed.doctorId && session.branchId === proposed.branchId && session.dayOfWeek === (/* @__PURE__ */ new Date(proposed.date + "T12:00:00Z")).getUTCDay(), 400, "Exception session does not match doctor, branch and date");
      }
    }
    if (kind === "users" && old?.role === "superAdmin" && body.status === "inactive") {
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext('super-admin-protection'))`);
      assert((await all(users2, tx)).filter((u) => u.role === "superAdmin" && u.status === "active" && u.id !== old.id).length, 409, "Cannot deactivate last active super administrator");
    }
    if (kind === "users" && old?.role === "clinicAdmin" && body.status === "inactive") {
      assert(!(await all(clinics2, tx)).some((c) => c.adminId === old.id) && !(await all(doctors3, tx)).some((d) => d.ownerAdminId === old.id) && !(await all(users2, tx)).some((u) => u.managingAdminId === old.id), 409, "Transfer clinic and staff ownership before deactivating this administrator");
    }
    if (kind === "schedules") {
      validateTimes(proposed);
      const branch = await one(branches2, proposed.branchId, tx);
      const candidate = { ...proposed, timezone: proposed.timezone || branch.timezone || "Asia/Kolkata" };
      withinBranchHours(branch, candidate);
      const collisions = (await all(schedules2, tx)).filter((s) => s.id !== old?.id && s.status === "active" && s.doctorId === proposed.doctorId);
      const previous = (await all(schedules2, tx)).filter((s) => s.status === "active" && s.doctorId === proposed.doctorId && s.branchId === proposed.branchId && s.dayOfWeek === proposed.dayOfWeek);
      if (!old && previous.length === 1) {
        for (const e of (await all(availabilityExceptions2, tx)).filter((e2) => !e2.sessionId && e2.doctorId === proposed.doctorId && e2.branchId === proposed.branchId && (/* @__PURE__ */ new Date(e2.date + "T12:00:00Z")).getUTCDay() === proposed.dayOfWeek)) {
          await change(availabilityExceptions2, e.id, { data: { ...e, sessionId: previous[0].id } }, tx);
        }
      }
      for (const session of collisions) {
        const otherBranch = await one(branches2, session.branchId, tx);
        const other = { ...session, timezone: session.timezone || otherBranch.timezone || "Asia/Kolkata" };
        assert(!weeklySessionsOverlap(candidate, other), 409, "This schedule overlaps with an existing schedule");
      }
      const datedRows = (await all(availabilityExceptions2, tx)).filter((e) => e.doctorId === proposed.doctorId && e.status === "active");
      const exceptions = datedRows.filter((e) => !e.isExtra);
      const templates = [...collisions, { ...candidate, id: old?.id || "__new_session__" }];
      const dates = /* @__PURE__ */ new Set();
      for (const e of exceptions) for (const offset of [-1, 0, 1]) dates.add(datePlus(e.date, offset));
      const effective = [];
      for (const date2 of dates) {
        for (const template of templates.filter((s) => s.dayOfWeek === (/* @__PURE__ */ new Date(date2 + "T12:00:00Z")).getUTCDay())) {
          const location = await one(branches2, template.branchId, tx);
          const exception = exceptions.find((e) => e.branchId === template.branchId && e.date === date2 && e.sessionId === template.id) || exceptions.find((e) => e.branchId === template.branchId && e.date === date2 && !e.sessionId);
          const session = { ...template, timezone: template.timezone || location.timezone || "Asia/Kolkata" };
          if (exception) {
            for (const key3 of ["startTime", "endTime", "breakStart", "breakEnd", "isClosed"]) if (exception[key3] !== void 0 && (exception[key3] !== null || key3.startsWith("break"))) session[key3] = exception[key3];
          }
          effective.push({ session, date: date2 });
        }
      }
      for (const e of datedRows.filter((e2) => e2.isExtra)) {
        const location = await one(branches2, e.branchId, tx);
        for (const offset of [-1, 0, 1]) {
          const date2 = datePlus(e.date, offset);
          for (const template of templates.filter((s) => s.dayOfWeek === (/* @__PURE__ */ new Date(date2 + "T12:00:00Z")).getUTCDay())) {
            const tl = await one(branches2, template.branchId, tx);
            const ov = exceptions.find((x) => x.branchId === template.branchId && x.date === date2 && x.sessionId === template.id) || exceptions.find((x) => x.branchId === template.branchId && x.date === date2 && !x.sessionId);
            const session = { ...template, ...ov ? Object.fromEntries(Object.entries(ov).filter(([k, v]) => ["startTime", "endTime", "isClosed"].includes(k) && v !== null && v !== void 0)) : {}, timezone: template.timezone || tl.timezone || "Asia/Kolkata" };
            assert(!sessionsOverlap(session, date2, extraSession(e, {}, location), e.date), 409, "Weekly change overlaps a dated extra interval");
          }
        }
      }
      for (let i = 0; i < effective.length; i++) for (let j = i + 1; j < effective.length; j++) {
        assert(!sessionsOverlap(effective[i].session, effective[i].date, effective[j].session, effective[j].date), 409, "Weekly change overlaps a dated session exception");
      }
    }
    if (kind === "availability-exceptions" && proposed.isExtra) {
      assert(!proposed.isClosed && !proposed.sessionId, 400, "An extra interval adds a session; it cannot close or replace one");
      assert(proposed.startTime && proposed.endTime && Number(proposed.maxTokens) >= 1, 400, "Enter start time, end time and capacity for the extra interval");
      const location = await one(branches2, proposed.branchId, tx);
      const template = (await all(schedules2, tx)).find((s) => s.doctorId === proposed.doctorId && s.branchId === proposed.branchId && s.status === "active");
      const extra = extraSession({ ...proposed, id: old?.id || "__new_extra__" }, template, location);
      validateTimes(extra);
      withinBranchHours(location, { ...extra, date: proposed.date });
      const dayClosed = (await all(availabilityExceptions2, tx)).some((e) => e.id !== old?.id && e.status === "active" && e.doctorId === proposed.doctorId && e.branchId === proposed.branchId && e.date === proposed.date && e.isClosed && !e.sessionId);
      assert(!dayClosed, 409, "This date has a day-off exception for the doctor at this location. Remove it before adding an extra interval");
      const rows = (await all(availabilityExceptions2, tx)).filter((e) => e.id !== old?.id && e.doctorId === proposed.doctorId && e.status === "active");
      for (const session of (await all(schedules2, tx)).filter((s) => s.doctorId === proposed.doctorId && s.status === "active" && s.isOpen)) {
        const otherBranch = await one(branches2, session.branchId, tx);
        for (const offset of [-1, 0, 1]) {
          const otherDate = datePlus(proposed.date, offset);
          if ((/* @__PURE__ */ new Date(otherDate + "T12:00:00Z")).getUTCDay() !== session.dayOfWeek) continue;
          const ov = rows.find((e) => !e.isExtra && e.branchId === session.branchId && e.date === otherDate && e.sessionId === session.id) || rows.find((e) => !e.isExtra && e.branchId === session.branchId && e.date === otherDate && !e.sessionId);
          const other = { ...session, ...ov ? Object.fromEntries(Object.entries(ov).filter(([k, v]) => ["startTime", "endTime", "isClosed"].includes(k) && v !== null && v !== void 0)) : {}, timezone: session.timezone || otherBranch.timezone || "Asia/Kolkata" };
          assert(!sessionsOverlap(extra, proposed.date, other, otherDate), 409, "This extra interval overlaps an existing session");
        }
      }
      for (const e of rows.filter((e2) => e2.isExtra)) {
        const b = await one(branches2, e.branchId, tx);
        assert(!sessionsOverlap(extra, proposed.date, extraSession(e, {}, b), e.date), 409, "This extra interval overlaps another extra interval");
      }
    }
    if (kind === "availability-exceptions" && !proposed.isClosed && !proposed.isExtra) {
      const weekday = (/* @__PURE__ */ new Date(proposed.date + "T12:00:00Z")).getUTCDay();
      const bases = (await all(schedules2, tx)).filter((s) => s.doctorId === proposed.doctorId && s.branchId === proposed.branchId && s.dayOfWeek === weekday && s.status === "active" && (!proposed.sessionId || s.id === proposed.sessionId));
      assert(bases.length <= 1, 409, "Choose a session for the date exception");
      const base = bases[0];
      assert(base, 409, "Create a weekly schedule before overriding its timing");
      const baseBranch = await one(branches2, base.branchId, tx);
      const effective = { ...base, ...Object.fromEntries(Object.entries(proposed).filter(([k, v]) => v !== null || k.startsWith("break"))), timezone: proposed.timezone || base.timezone || baseBranch.timezone || "Asia/Kolkata" };
      validateTimes(effective);
      withinBranchHours(baseBranch, effective);
      const otherSchedules = (await all(schedules2, tx)).filter((s) => s.doctorId === proposed.doctorId && s.id !== base.id && s.status === "active" && s.isOpen);
      const datedRows = (await all(availabilityExceptions2, tx)).filter((e) => e.id !== old?.id && e.doctorId === proposed.doctorId && e.status === "active");
      const exceptions = datedRows.filter((e) => !e.isExtra);
      for (const e of datedRows.filter((e2) => e2.isExtra)) {
        const b = await one(branches2, e.branchId, tx);
        assert(!sessionsOverlap(effective, proposed.date, extraSession(e, {}, b), e.date), 409, "This change overlaps a dated extra interval");
      }
      for (const session of otherSchedules) {
        const otherBranch = await one(branches2, session.branchId, tx);
        for (const offset of [-1, 0, 1]) {
          const otherDate = datePlus(proposed.date, offset);
          if ((/* @__PURE__ */ new Date(otherDate + "T12:00:00Z")).getUTCDay() !== session.dayOfWeek) continue;
          const exception = exceptions.find((e) => e.branchId === session.branchId && e.date === otherDate && e.sessionId === session.id) || exceptions.find((e) => e.branchId === session.branchId && e.date === otherDate && !e.sessionId);
          const other = { ...session, ...exception, timezone: exception?.timezone || session.timezone || otherBranch.timezone || "Asia/Kolkata" };
          assert(!sessionsOverlap(effective, proposed.date, other, otherDate), 409, "This schedule overlaps with an existing schedule");
        }
      }
    }
    const id2 = old?.id || uid(), merged = { ...old, ...body }, fields = { data: merged };
    delete fields.data.data;
    delete fields.data.expectedSnapshot;
    if ("status" in table) fields.status = body.status || old?.status || "active";
    for (const key3 of ["clinicId", "branchId", "doctorId", "dayOfWeek", "date", "category", "parentId", "specializationId"]) if (key3 in table && merged[key3] !== void 0) fields[key3] = merged[key3];
    if (kind === "clinics") {
      fields.ownerId = old?.ownerId || user.id;
      if (old) fields.adminId = body.adminId || old.adminId;
      else if (user.role === "clinicAdmin") fields.adminId = user.id;
      else if (user.role === "doctor") {
        const self = await one(doctors3, user.doctorId, tx);
        fields.adminId = self.ownerAdminId;
      } else fields.adminId = body.adminId;
      assert(fields.adminId, 400, "Please select a Clinic Admin");
      const admin = await one(users2, fields.adminId, tx);
      assert(admin.role === "clinicAdmin" && admin.status === "active", 400, "Please select an active Clinic Admin");
      if (old && fields.adminId !== old.adminId) {
        await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"clinic-owner:" + old.id}))`);
        const links2 = (await all(assignments, tx)).filter((a) => a.clinicId === old.id);
        const accounts = await all(users2, tx), doctorRows = await all(doctors3, tx);
        const conflict = links2.some((link) => {
          const account = accounts.find((a) => a.id === link.userId);
          if (account?.role === "receptionist") return account.managingAdminId !== fields.adminId;
          const clinicalProfile = doctorRows.find((d) => d.userId === account?.id);
          if (clinicalProfile) return clinicalProfile.ownerAdminId !== fields.adminId;
          return false;
        });
        assert(!conflict, 409, "Transfer blocked because assigned doctors or receptionists are managed by another Clinic Admin");
      }
      fields.data.dateFormat ??= "DD MMM YYYY";
      fields.data.timeFormat ??= "12h";
      fields.data.code ||= `CLN-${id2.slice(0, 8)}`;
    }
    if (kind === "branches") fields.data.code ||= `BR-${id2.slice(0, 8)}`;
    if (kind === "masters") fields.code = body.code;
    if (kind === "patients") {
      if (user.role === "patient" || old?.userId || user.role === "doctor") assert(body.mobile, 400, "Patient mobile is required");
      if (!old && body.clinicId && body.mobile) {
        await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"patient-mobile:" + body.clinicId + ":" + body.mobile}))`);
        const matches = (await all(patients3, tx)).filter((p) => p.clinicId === body.clinicId && p.mobile === body.mobile);
        for (const match of matches) assert(!await canRead(user, "patients", match), 409, "A patient with this mobile already exists in this clinic. Search by mobile and select the existing patient; contact your clinic administrator if this is a different household member.");
      }
      fields.mobile = body.mobile || null;
      fields.mobileVerified = old && old.mobile === body.mobile ? old.mobileVerified : false;
      fields.data.email = body.email || null;
      fields.data.code ||= `PAT-${id2.slice(0, 8)}`;
    }
    if (kind === "qrs") {
      fields.publicReference = old?.publicReference || randomBytes4(32).toString("base64url");
      fields.data.bookingUrl = `/book/${fields.publicReference}`;
    }
    if (kind === "users" || kind === "doctors") {
      const userId = kind === "users" ? id2 : old?.userId || uid();
      const role = kind === "doctors" ? "doctor" : body.role || old?.role;
      const requestedClinics = body.clinicIds === void 0 ? old?.clinicIds || [] : body.clinicIds;
      const requestedBranches = body.branchIds === void 0 ? old?.branchIds || [] : body.branchIds;
      const assignmentChangeRequested = body.clinicIds !== void 0 || body.branchIds !== void 0;
      const sameIds = (left, right) => JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
      const unchangedMappings = old && sameIds(requestedClinics, old.clinicIds || []) && sameIds(requestedBranches, old.branchIds || []);
      const explicitDoctorTransfer = old && kind === "doctors" && user.role === "superAdmin" && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId);
      const expectedManager = old && !explicitDoctorTransfer ? kind === "doctors" ? old.ownerAdminId : old.managingAdminId : void 0;
      let managingAdminId;
      if (kind === "doctors" && old && (old.userId === user.id && user.role === "clinicAdmin" || !assignmentChangeRequested && !explicitDoctorTransfer)) managingAdminId = old.ownerAdminId;
      else if (["doctor", "receptionist"].includes(role)) managingAdminId = await validateAssignments(user, requestedClinics, requestedBranches, role, expectedManager, tx);
      if (body.ownerAdminId !== void 0) assert(body.ownerAdminId === managingAdminId, 409, "Supplied Clinic Admin does not match the owner derived from selected clinics");
      if (body.managingAdminId !== void 0) assert(body.managingAdminId === managingAdminId, 409, "Supplied Clinic Admin does not match the owner derived from selected clinics");
      const uf = { fullName: body.fullName, email: body.email, mobile: body.mobile, role, status: fields.status, ...!old ? { invitationStatus: "failed" } : {} };
      if (kind === "doctors" && old) {
        const account = await one(users2, userId, tx);
        if (account.role === "clinicAdmin") {
          assert(old.ownerAdminId === userId && (user.role === "superAdmin" || user.id === userId) && account.status === "active", 403, "Only Super Admin or the active owning Clinic Admin can edit their clinical profile");
          managingAdminId = userId;
          uf.role = "clinicAdmin";
          uf.status = account.status;
          if (body.branchIds !== void 0) {
            await attachOwnDoctor(account, { branchIds: body.branchIds }, tx);
            fields.data.branchIds = [...new Set(body.branchIds)];
          } else fields.data.branchIds = (await one(doctors3, old.id, tx)).branchIds;
        }
      }
      if (kind === "doctors") {
        if (old) {
          await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"schedules:" + old.id}))`);
          const latest = await one(doctors3, old.id, tx);
          fields.data.expectedDurations = latest.expectedDurations;
          fields.data.durationHistory = latest.durationHistory;
        }
        fields.ownerAdminId = managingAdminId;
        const owner = await one(users2, fields.ownerAdminId, tx);
        assert(owner.role === "clinicAdmin" && owner.status === "active", 400, "Please select an active Clinic Admin");
        if (old) await change(users2, userId, uf, tx);
        else await put(users2, { id: userId, ...uf }, tx);
        const personAddress = Object.fromEntries([...ADDRESS_KEYS, "photoUrl"].filter((key3) => body[key3] !== void 0).map((key3) => [key3, body[key3]]));
        if (Object.keys(personAddress).length) await mergeAddress(users2, userId, personAddress, tx);
        fields.userId = userId;
        fields.data.code ||= `DOC-${id2.slice(0, 8)}`;
      } else {
        if (role === "receptionist") fields.managingAdminId = managingAdminId;
        Object.assign(fields, uf);
      }
      if (kind === "users" && old) {
        const linkedPatient = (await all(patients3, tx)).find((p) => p.userId === old.id);
        if (linkedPatient && body.mobile !== void 0 && body.mobile !== linkedPatient.mobile) await change(patients3, linkedPatient.id, { mobile: body.mobile, mobileVerified: false }, tx);
        const linkedDoctor = (await all(doctors3, tx)).find((d) => d.userId === old.id);
        if (linkedDoctor) await change(doctors3, linkedDoctor.id, { data: { ...linkedDoctor, fullName: body.fullName, email: body.email, ...body.mobile !== void 0 ? { mobile: body.mobile } : {} } }, tx);
        if (linkedDoctor && body.status) await change(doctors3, linkedDoctor.id, { status: body.status }, tx);
        const addressPatch = Object.fromEntries(ADDRESS_KEYS.filter((key3) => body[key3] !== void 0).map((key3) => [key3, body[key3]]));
        if (linkedDoctor && Object.keys(addressPatch).length) await mergeAddress(doctors3, linkedDoctor.id, addressPatch, tx);
      }
      if (role === "clinicAdmin") {
        assert(user.role === "superAdmin", 403, "Only Super Admin can create Clinic Admins");
        assert(old, 409, "Create Clinic Admins through clinic admin onboarding");
        assert(body.clinicIds === void 0 && body.branchIds === void 0, 409, "Clinic Admin assignments are managed only through clinic ownership");
      }
      const row2 = old ? await change(table, id2, fields, tx) : await put(table, { id: id2, ...fields }, tx);
      if (uf.role !== "clinicAdmin" && ["doctor", "receptionist"].includes(role) && (!old || assignmentChangeRequested && !unchangedMappings)) {
        await setAssignments(userId, requestedClinics, requestedBranches, user, managingAdminId, tx);
      }
      if (kind === "users" && !old && body.role === "patient") await put(patients3, { id: uid(), userId, mobile: body.mobile || "", data: { fullName: body.fullName, email: body.email, code: `PAT-${id2.slice(0, 8)}` } }, tx);
      await audit(
        user,
        old && kind === "doctors" && ownershipChangeRequested(body.ownerAdminId, old.ownerAdminId) ? "ownershipTransfer" : old && (body.clinicIds !== void 0 || body.branchIds !== void 0) ? "assignmentChange" : old ? "update" : "create",
        kind,
        row2,
        tx
      );
      return enrich(kind, row2, tx);
    }
    const row = old ? await change(table, id2, fields, tx) : await put(table, { id: id2, ...fields }, tx);
    if (kind === "branches") await provisionBranchQr(row, old, tx);
    if (kind === "clinics" && !old && user.role === "doctor") {
      await tx.insert(assignments).values({ id: uid(), userId: user.id, clinicId: id2 }).onConflictDoNothing();
    }
    await audit(user, old && kind === "clinics" && ownershipChangeRequested(body.adminId, old.adminId) ? "ownershipTransfer" : old ? "update" : "create", kind, row, tx);
    return enrich(kind, row, tx);
  });
  if (old?.status === "active" && saved.status === "inactive") {
    if (kind === "users") await revokeUserSessions(saved.id);
    if (kind === "doctors" && (await one(users2, saved.userId)).status === "inactive")
      await revokeUserSessions(saved.userId);
  }
  if (!old && (kind === "doctors" || kind === "users" && ["clinicAdmin", "doctor", "receptionist"].includes(saved.role))) {
    await deliverInvitation(kind === "users" ? saved.id : saved.userId, redirectUrl);
    return enrich(kind, await one(table, saved.id));
  }
  return saved;
}
resourcesRouter.post("/clinic-admin-onboarding", async (req, res) => {
  const user = await requireUser(req);
  const row = await createClinicAdminOnboarding(user, parse(OnboardClinicAdminBody, req.body), invitationRedirectUrl(req));
  res.status(201).json(row);
});
for (const [kind, table, schema2, listSchema] of definitions) {
  resourcesRouter.get(`/${kind}`, async (req, res) => {
    const user = await requireUser(req), q = query(listSchema, req);
    if (kind === "users") roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
    const result = await queryPage(user, kind, q);
    if (kind === "clinics") result.items = result.items.map((row) => ({ ...row, ...clinicDisplayPreferences2(row) }));
    if (kind === "branches") {
      const parentIds = [...new Set(result.items.map((row) => row.clinicId))];
      const parentRows = parentIds.length ? (await db2.execute(sql20`select id, data from clinics where id in (${sql20.join(parentIds.map((id2) => sql20`${id2}`), sql20`,`)})`)).rows : [];
      const parents = new Map(parentRows.map((row) => [row.id, { ...row.data, ...row }]));
      for (const row of result.items) {
        assert(parents.has(row.clinicId), 404, "Record not found");
        Object.assign(row, clinicDisplayPreferences2(parents.get(row.clinicId)));
      }
    }
    if (["users", "doctors"].includes(kind)) {
      const clinicIds = [...new Set(result.items.flatMap((r) => r.clinicIds))];
      const branchIds = [...new Set(result.items.flatMap((r) => r.branchIds))];
      const clinicRows = clinicIds.length ? (await db2.execute(sql20`select id, data->>'name' as name from clinics where id in (${sql20.join(clinicIds.map((id2) => sql20`${id2}`), sql20`,`)})`)).rows : [];
      const branchRows = branchIds.length ? (await db2.execute(sql20`select id, clinic_id as "clinicId", data->>'name' as name from branches where id in (${sql20.join(branchIds.map((id2) => sql20`${id2}`), sql20`,`)})`)).rows : [];
      result.items = result.items.map((row) => {
        const own = kind === "users" ? row.id === user.id : row.id === user.doctorId;
        const peer = kind === "users" && row.role === "receptionist" && ["clinicAdmin", "doctor"].includes(user.role) && row.managingAdminId === (user.role === "clinicAdmin" ? user.id : user.managingAdminId);
        const unrestricted = user.role === "superAdmin" || own || peer;
        const clinicIds2 = row.clinicIds.filter((id2) => unrestricted || scope(user, id2));
        const branchIds2 = row.branchIds.filter((id2) => unrestricted || branchRows.some((b) => b.id === id2 && scope(user, b.clinicId, id2)));
        return { ...row, clinicIds: clinicIds2, branchIds: branchIds2, clinicNames: clinicRows.filter((c) => clinicIds2.includes(c.id)).map((c) => c.name), branchNames: branchRows.filter((b) => branchIds2.includes(b.id)).map((b) => b.name) };
      });
    }
    res.json(result);
  });
  resourcesRouter.get(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), row = await enrich(kind, await one(table, req.params.id));
    assert(await canRead(user, kind, row), 403, "Record outside your scope");
    res.json(await withPasswordState(await projectAssignmentScope2(user, kind, row)));
  });
  resourcesRouter.post(`/${kind}`, async (req, res) => {
    const user = await requireUser(req), row = await save(kind, table, user, parse(schema2, req.body), void 0, invitationRedirectUrl(req), () => requireUser(req));
    res.status(201).json(await projectAssignmentScope2(user, kind, row));
  });
  resourcesRouter.patch(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), old = await enrich(kind, await one(table, req.params.id));
    res.json(await projectAssignmentScope2(user, kind, await save(kind, table, user, parse(schema2, req.body), old, void 0, () => requireUser(req))));
  });
  resourcesRouter.delete(`/${kind}/:id`, async (req, res) => {
    const user = await requireUser(req), old = await enrich(kind, await one(table, req.params.id));
    assert(user.role !== "patient", 403, "Patients cannot deactivate profiles");
    await authorizeWrite(user, kind, {}, old);
    if (kind === "users" && old.id === user.id)
      assert(false, 409, "You cannot deactivate your own account");
    await db2.transaction(async (tx) => {
      if (kind === "schedules") {
        await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"schedules:" + old.doctorId}))`);
        await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + old.doctorId}))`);
        const current = await one(schedules2, old.id, tx);
        assertScheduleSnapshot(current, req.query.expectedSnapshot);
        const freshActor = await requireUser(req);
        await authorizeWrite(freshActor, kind, {}, current, tx);
        const doctor = await enrich("doctors", await one(doctors3, current.doctorId, tx), tx);
        assert(doctor.status === "active" && doctor.branchIds.includes(current.branchId), 409, "Doctor assignments changed. Reload the schedule context before deactivating sessions.");
        assert(!current.linkedBranchId, 409, "This session follows clinic hours. Unlink it in Clinic settings before deactivating it.");
        const { freezeDoctorSessions: freezeDoctorSessions2 } = await Promise.resolve().then(() => (init_session_duration(), session_duration_exports));
        await freezeDoctorSessions2(old.doctorId, tx);
      }
      if (kind === "users" && old.role === "superAdmin") {
        await tx.execute(sql20`select pg_advisory_xact_lock(hashtext('super-admin-protection'))`);
        assert((await all(users2, tx)).some((u) => u.role === "superAdmin" && u.status === "active" && u.id !== old.id), 409, "Cannot deactivate last active super administrator");
      }
      await change(table, old.id, { status: "inactive" }, tx);
      if (kind === "doctors" && (await one(users2, old.userId, tx)).role !== "clinicAdmin") await change(users2, old.userId, { status: "inactive" }, tx);
      await audit(user, "deactivate", kind, old, tx);
    });
    if (kind === "users") await revokeUserSessions(old.id);
    if (kind === "doctors" && (await one(users2, old.userId)).status === "inactive")
      await revokeUserSessions(old.userId);
    res.sendStatus(204);
  });
}
resourcesRouter.get("/staff-assignment-options", async (req, res) => {
  const user = await requireUser(req);
  roles(user, ["superAdmin", "clinicAdmin", "doctor"]);
  const q = query(GetStaffAssignmentOptionsQueryParams, req);
  if (user.role === "doctor") assert(q.targetRole === "receptionist", 403, "Doctors may request receptionist assignment options only");
  assert(!(q.doctorId && q.userId), 400, "Select only one staff record to edit");
  let managingAdminId;
  let retainedUserId;
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
  const options = { ...q, managingAdminId: void 0, sort: q.sort || "name" };
  const catalogUser = { role: "superAdmin" };
  const retained = q.selectedIds ? retainedUserId : void 0;
  const clinicPage = await queryPage(catalogUser, "clinics", { ...options, doctorId: void 0, clinicId: void 0, branchId: void 0 }, sql20`${assignmentCatalogPredicate("clinics", managingAdminId, retained)} and ${q.clinicId ? sql20`r.id=${q.clinicId}` : sql20`true`}`);
  const branchPage = await queryPage(catalogUser, "branches", { ...options, doctorId: void 0, branchId: void 0 }, sql20`${assignmentCatalogPredicate("branches", managingAdminId, retained)} and ${q.branchId ? sql20`r.id=${q.branchId}` : sql20`true`}`);
  const adminIds = [...new Set(clinicPage.items.map((c) => c.adminId))];
  const adminRows = adminIds.length ? (await db2.execute(sql20`select id, full_name as "fullName" from users where id in (${sql20.join(adminIds.map((id2) => sql20`${id2}`), sql20`,`)}) and role='clinicAdmin' and status='active' order by id limit 100`)).rows : [];
  res.json({
    clinics: clinicPage.items,
    branches: branchPage.items,
    managingAdmins: adminRows.map((a) => ({ id: a.id, fullName: a.fullName })),
    pagination: { clinics: { ...clinicPage, items: void 0 }, branches: { ...branchPage, items: void 0 } }
  });
});
resourcesRouter.post("/users/:id/password-reset", async (req, res) => {
  const user = await requireUser(req), target = await enrich("users", await one(users2, req.params.id));
  roles(user, ["superAdmin", "clinicAdmin"]);
  assert(["clinicAdmin", "doctor", "receptionist", "superAdmin"].includes(target.role), 400, "Password recovery assistance is available for staff profiles only");
  assert(await canRead(user, "users", target), 403, "User outside your scope");
  const [credential] = await db2.select({ passwordHash: users2.passwordHash }).from(users2).where(eq19(users2.id, target.id));
  assert(credential?.passwordHash, 409, "This staff account has not completed invitation setup. Resend the set-password invitation instead.");
  await requestStaffReset(req, target);
  await audit(user, "recoveryInstructions", "users", target);
  res.status(202).json({ message: "Password recovery email requested." });
});
resourcesRouter.post("/users/:id/resend-invitation", async (req, res) => {
  const actor = await requireUser(req), target = await enrich("users", await one(users2, req.params.id));
  roles(actor, ["superAdmin", "clinicAdmin", "doctor"]);
  assert(["clinicAdmin", "doctor", "receptionist"].includes(target.role), 400, "Invitations are available for staff profiles only");
  if (actor.role === "doctor") assert(target.role === "receptionist", 403, "Doctors may manage receptionists only");
  if (actor.role === "clinicAdmin") assert(["doctor", "receptionist"].includes(target.role), 403, "Cannot manage another administrator's invitation");
  assert(await canRead(actor, "users", target), 403, "User outside your management scope");
  assert(target.status === "active", 403, "Reactivate this staff account before sending an invitation");
  const [credential] = await db2.select({ passwordHash: users2.passwordHash }).from(users2).where(eq19(users2.id, target.id));
  assert(!credential?.passwordHash, 409, "This staff account has a password. Use password recovery assistance instead.");
  await consumeRateLimit(`staff-invite:${target.id}`, 3);
  await deliverInvitation(target.id, invitationRedirectUrl(req));
  const updated = await enrich("users", await one(users2, target.id));
  await audit(
    actor,
    updated.invitationStatus === "sent" ? "invitationResent" : updated.invitationStatus === "notRequired" ? "invitationNotRequired" : "invitationFailed",
    "users",
    updated
  );
  res.json(await projectAssignmentScope2(actor, "users", updated));
});
resourcesRouter.post("/qrs/:id/regenerate", async (req, res) => {
  const user = await requireUser(req), old = await one(qrs2, req.params.id);
  await authorizeWrite(user, "qrs", {}, old);
  const reference = randomBytes4(32).toString("base64url");
  const row = await db2.transaction(async (tx) => {
    const updated = await change(qrs2, old.id, { publicReference: reference, data: { ...old, bookingUrl: `/book/${reference}` } }, tx);
    await audit(user, "regenerate", "qrs", updated, tx);
    return updated;
  });
  res.json(await enrich("qrs", row));
});

// src/routes/clinic-expansion.ts
init_db();
import { Router as Router7 } from "express";
import { rateLimit as rateLimit2 } from "express-rate-limit";
import { eq as eq20, sql as sql21 } from "drizzle-orm";
init_auth();
init_http();
init_store();
init_session_duration();
init_clinical_membership();
var clinicExpansionRouter = Router7();
var anonymousLimit = rateLimit2({ windowMs: 6e4, limit: 60, standardHeaders: true, legacyHeaders: false });
var registrationLimit = rateLimit2({ windowMs: 15 * 6e4, limit: 10, standardHeaders: true, legacyHeaders: false });
clinicExpansionRouter.get("/public/registration-options", anonymousLimit, async (_req, res) => {
  const result = {};
  for (const [key3, category] of [["categories", "clinicCategory"], ["specialities", "specialization"], ["qualifications", "qualification"]]) {
    result[key3] = (await db.execute(sql21`select id,data->>'name' as name from masters where status='active' and category=${category} order by data->>'name',id limit 200`)).rows;
  }
  res.json(result);
});
clinicExpansionRouter.get("/clinics/:id/settings", async (req, res) => {
  const user = await requireUser(req), clinic = await one(clinics, req.params.id);
  assert(user.role === "superAdmin" || user.role === "clinicAdmin" && clinic.adminId === user.id, 403, "Clinic settings are outside your ownership");
  res.json(await clinicSettingsResult(clinic.id));
});
clinicExpansionRouter.patch("/clinics/:id/settings", async (req, res) => {
  const user = await requireUser(req), body = parse(UpdateClinicSettingsBody, req.body);
  res.json(await db.transaction((tx) => saveClinicSetup(user, req.params.id, body, tx)));
});
clinicExpansionRouter.post("/clinics/:id/settings/preview", async (req, res) => {
  const user = await requireUser(req), body = parse(PreviewClinicSettingsBody, req.body);
  res.json(await previewClinicSetup(user, req.params.id, body));
});
clinicExpansionRouter.post("/me/doctor-profile", async (req, res) => {
  const user = await requireUser(req), body = parse(AttachOwnDoctorProfileBody, req.body);
  res.json(await db.transaction((tx) => attachOwnDoctor(user, body, tx)));
});
clinicExpansionRouter.post("/clinic-registration", registrationLimit, async (req, res) => {
  const { userId } = requireSessionIdentity(req), body = parse(RegisterClinicBody, req.body);
  const [identity] = await db.select().from(users).where(eq20(users.id, userId));
  assert(identity?.emailVerifiedAt && identity.role === "clinicAdmin" && identity.status === "active", 403, "A verified clinic administrator is required");
  assert(await verifyPassword(identity.passwordHash, body.password), 401, "Invalid password");
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql21`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const existing = await tx.select({ id: clinics.id }).from(clinics).where(eq20(clinics.adminId, userId)).limit(1);
    assert(!existing.length, 409, "This administrator already owns a clinic");
    assert(body.clinic.slug && body.branches.every((b) => b.slug), 400, "Choose public URLs for the clinic and each branch");
    const admin = await change(users, userId, { fullName: body.fullName, mobile: body.mobile }, tx);
    const result2 = await createOwnedClinic(admin, admin, body, tx);
    await audit(admin, "registerClinic", "users", admin, tx);
    return result2;
  });
  res.status(201).json(result);
});
clinicExpansionRouter.get("/public/slug-availability", anonymousLimit, async (req, res) => {
  const q = query(CheckSlugAvailabilityQueryParams, req);
  const rows = validSlug(q.slug) ? (await db.execute(q.clinicId ? sql21`select id from branches where clinic_id=${q.clinicId} and data->>'slug'=${q.slug} limit 1` : sql21`select id from clinics where data->>'slug'=${q.slug} limit 1`)).rows : [true];
  res.json({ slug: q.slug, available: validSlug(q.slug) && !rows.length });
});
clinicExpansionRouter.get("/public/clinics-by-slug/:clinicSlug{/:branchSlug}", anonymousLimit, async (req, res) => {
  const clinicSlug = req.params.clinicSlug, branchSlug = req.params.branchSlug;
  const q = query(branchSlug ? ResolveBranchSlugQueryParams : ResolveClinicSlugQueryParams, req);
  const directory = q.directory === true && req.query.directory !== "false", pageSize = q.pageSize ?? 25;
  const term = q.search?.trim() || "";
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const direction = q.sort === "-name" ? sql21`desc` : sql21`asc`;
  assert(validSlug(clinicSlug) && (!branchSlug || validSlug(branchSlug)), 404, "Clinic page not found");
  const [record2] = (await db.execute(sql21`select * from clinics where status='active' and data->>'slug'=${clinicSlug} limit 1`)).rows;
  assert(record2, 404, "Clinic page not found");
  const clinic = flatten({ ...record2, adminId: record2.admin_id });
  const branchScope = sql21`clinic_id=${clinic.id} and status='active'`;
  const [branchCounts] = (await db.execute(sql21`select count(*)::int as count from branches where ${branchScope}`)).rows;
  const branchCount = Number(branchCounts.count);
  const selectedRecords = branchSlug || branchCount === 1 ? (await db.execute(sql21`select * from branches where ${branchScope} ${branchSlug ? sql21`and data->>'slug'=${branchSlug}` : sql21``} order by id limit 1`)).rows : [];
  assert(!branchSlug || selectedRecords.length, 404, "Branch page not found");
  const branchSearch = term ? sql21`and (data->>'name' ilike ${pattern} or data->>'address' ilike ${pattern} or data->>'city' ilike ${pattern})` : sql21``;
  const doctorScope = selectedRecords.length ? clinicalMembership(sql21`d.id`, sql21`${selectedRecords[0].id}`) : sql21`false`;
  const doctorSearch = term ? sql21`and (u.full_name ilike ${pattern} or exists(select 1 from masters m where m.id=d.specialization_id and m.data->>'name' ilike ${pattern}))` : sql21``;
  const [doctorCounts] = (await db.execute(sql21`select count(*)::int as count from doctors d where ${doctorScope}`)).rows;
  const branchDoctorCount = Number(doctorCounts.count);
  const [matching] = directory ? (await db.execute(selectedRecords.length ? sql21`select count(*)::int as count from doctors d join users u on u.id=d.user_id where ${doctorScope} ${doctorSearch}` : sql21`select count(*)::int as count from branches where ${branchScope} ${branchSearch}`)).rows : [{ count: 0 }];
  const total = Number(matching.count), totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(q.page ?? 1, totalPages), offset = (page - 1) * pageSize;
  const branchRecords = directory ? selectedRecords.length ? selectedRecords : (await db.execute(sql21`select * from branches where ${branchScope} ${branchSearch} order by lower(data->>'name') ${direction},id limit ${pageSize} offset ${offset}`)).rows : (await db.execute(sql21`select * from branches where ${branchScope} order by id limit 100`)).rows;
  const summarizeBranch = (r) => {
    const b = flatten(r);
    return {
      ...clinicDisplayPreferences2(clinic),
      id: b.id,
      name: b.name,
      slug: b.slug || null,
      address: b.address || null,
      city: b.city || null,
      timezone: b.timezone || "Asia/Kolkata",
      effectiveEmail: b.inheritEmail ?? !b.email ? clinic.email || null : b.email || null,
      effectivePhone: b.inheritPhone ?? !b.phone ? clinic.phone || null : b.phone || null,
      openingHours: b.openingHours ?? null
    };
  };
  const branchList = branchRecords.map(summarizeBranch);
  const branch = selectedRecords.length ? summarizeBranch(selectedRecords[0]) : null;
  const publicDoctors = [];
  if (branch) {
    const candidates = (await db.execute(directory ? sql21`select d.id from doctors d join users u on u.id=d.user_id where ${doctorScope} ${doctorSearch} order by lower(u.full_name) ${direction},d.id limit ${pageSize} offset ${offset}` : sql21`select d.id from doctors d where ${doctorScope} order by d.id limit 100`)).rows;
    for (const row of candidates) {
      const id2 = row.id;
      const metric2 = await queryMetrics({ role: "superAdmin" }, { clinicId: clinic.id, branchId: branch.id, doctorId: id2 });
      const branchIds = await clinicalBranchIds(id2);
      publicDoctors.push({
        ...publicDoctor({ ...await enrich("doctors", await one(doctors, id2)), branchIds, clinicIds: [clinic.id] }),
        averageConsultationMinutes: metric2.averageConsultationMinutes,
        expectedDurationMinutes: await configuredDuration(id2, clinic.id)
      });
    }
  }
  const references = branch ? (await db.execute(sql21`select public_reference from qrs where clinic_id=${clinic.id} and branch_id=${branch.id} and doctor_id is null and status='active' order by created_at,id limit 1`)).rows : [];
  const [counts] = (await db.execute(sql21`select count(*)::int as count from doctors d where exists(select 1 from branches b where b.clinic_id=${clinic.id} and ${clinicalMembership(sql21`d.id`, sql21`b.id`)})`)).rows;
  const metric = await queryMetrics({ role: "superAdmin" }, { clinicId: clinic.id });
  const result = {
    clinic: { ...clinicDisplayPreferences2(clinic), id: clinic.id, name: clinic.name, slug: clinic.slug, address: clinic.address || null, email: clinic.email || null, phone: clinic.phone || null, doctorCount: Number(counts.count), averageConsultationMinutes: metric.averageConsultationMinutes },
    branches: branchList,
    branch: branch || null,
    qrReference: references[0]?.public_reference || null,
    doctors: publicDoctors,
    ...directory ? { branchCount, branchDoctorCount, directoryPagination: { total, page, pageSize, totalPages } } : {}
  };
  res.set("Cache-Control", "no-store").json(ResolveClinicSlugResponse.parse(result));
});

// <stdin>
init_db();
import express from "express";
function authenticatedScheduleApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => globalThis.queueContentionContext.context.run({ authenticate: true }, () => nativeSession(req, res, next)));
  app.use("/api", resourcesRouter);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  return app;
}
export {
  CONSULTING_ADMIN_ENABLED,
  LOCATION_CLOSED_REASON,
  OUTSIDE_LOCATION_HOURS_WARNING,
  SCHEDULE_SNAPSHOT_KEYS,
  STAFF_CONTACT_OPTIONAL_ROLES,
  all,
  appointmentView,
  appointmentViewWithBranch,
  appointmentViews,
  appointmentsRouter,
  assertScheduleSnapshot,
  assignmentCatalogPredicate,
  attachOwnDoctor,
  audit,
  authenticatedScheduleApp,
  authorizeWrite,
  availability,
  availabilitySessions,
  bookAppointment,
  branchDayStatus,
  change,
  clinicDisplayPreferences2 as clinicDisplayPreferences,
  clinicExpansionRouter,
  clinicSettingsResult,
  clinicalBranchIds,
  clinicalMembership,
  createClinicAdminOnboarding,
  createGuestRequest,
  createOwnedClinic,
  createOwnerCustomSessions,
  datePlus,
  decideGuestRequest,
  defaultSettings,
  doctorContext,
  documentSql,
  extraSession,
  filterSql,
  filtered,
  flatten,
  getSettings,
  guestHash,
  guestListControls,
  guestReceipt,
  guestRequestsRouter,
  isClinicalMember,
  localNow,
  lockQueue,
  managedDoctorAssignments,
  managedDoctorLinks,
  metricSql,
  minutes,
  one,
  operationalDoctorContext,
  orderedReservations,
  outsideBranchHours,
  pageParams,
  paginate,
  pendingStatuses,
  previewClinicSetup,
  provisionBranchQr,
  publicRouter,
  put,
  queryAppointmentCalendar,
  queryAppointmentPage,
  queryMetrics,
  queryPage,
  queueRouter,
  queueSummary,
  queueVersion,
  rank,
  readScope,
  reschedule,
  resolveQr,
  resourcesRouter,
  sameTimezone,
  saveClinicSetup,
  scheduleSnapshot,
  sessionQueueWaitMinutes,
  sessionRows,
  sessionsOverlap,
  sourceSql,
  statusGroups,
  db_exports as tables,
  transition,
  transitions,
  uid,
  validSlug,
  validateClinicMetadata,
  validateOpeningHours,
  validateSlugWrite,
  validateTimes,
  weeklySessionsOverlap,
  withinBranchHours
};
