import { Router, type Request } from "express";
import { createHash } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { db, users, staffSessionProofs } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { audit } from "../lib/store";
import { HttpError, parse } from "../lib/http";
import {
  findUser,
  authoritativeStaffSessionExpiry,
  hasStaffSessionProof,
  isStaffRole,
  requireSessionIdentity,
} from "../lib/auth";

export const authRouter = Router();

function emailEntryLimit(limit: number, accountScoped: boolean) {
  return rateLimit({
    windowMs: 10 * 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: accountScoped
      ? (req: Request) => {
          const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
          const account = createHash("sha256").update(email).digest("hex");
          return `${ipKeyGenerator(req.ip || "unknown")}:${account}`;
        }
      : (req: Request) => ipKeyGenerator(req.ip || "unknown"),
    message: { error: "Too many authentication attempts. Please try again later.", code: "RATE_LIMITED" },
  });
}

// Separate stores prevent patient and staff traffic from consuming each
// other's normal account buckets. The coarse IP buckets still constrain
// high-cardinality email enumeration.
const patientEntryIpLimit = emailEntryLimit(100, false);
const patientEntryAccountLimit = emailEntryLimit(10, true);
const staffEntryIpLimit = emailEntryLimit(100, false);
const staffEntryAccountLimit = emailEntryLimit(10, true);

const passwordVerificationLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const auth = requireSessionIdentity(req);
    return `${auth.clerkId}:${ipKeyGenerator(req.ip || "unknown")}`;
  },
  skipSuccessfulRequests: true,
  message: { error: "Too many password verification attempts. Please try again later.", code: "RATE_LIMITED" },
});

function normalizedEmail(schema: any, body: unknown): string {
  const raw = body && typeof body === "object" && "email" in body
    ? String((body as { email: unknown }).email).trim().toLowerCase()
    : undefined;
  return parse(schema, { ...(body as object), email: raw }).email;
}

async function localUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  return user ?? null;
}

async function clerkUserForEmail(email: string) {
  const result = await clerkClient.users.getUserList({ emailAddress: [email], limit: 2 });
  return result.data.find(user => user.emailAddresses.some(address => address.emailAddress.toLowerCase() === email)) ?? null;
}

authRouter.post("/auth/patient-entry", patientEntryIpLimit, patientEntryAccountLimit, async (req, res) => {
  const email = normalizedEmail(z.PreparePatientEntryBody, req.body);
  const local = await localUserByEmail(email);

  // The database role and lifecycle are checked before any Clerk request. This
  // prevents the patient entry point from sending codes to staff or inactive
  // patient accounts even when the browser misrepresents its intended flow.
  if (local && isStaffRole(local.role)) {
    throw new HttpError(403, "This account is registered as a staff account. Please use Staff Login with your email and password.", "STAFF_LOGIN_REQUIRED");
  }
  if (local && (local.role !== "patient" || local.status !== "active")) {
    throw new HttpError(403, "Patient account is inactive", "PATIENT_ACCOUNT_INACTIVE");
  }

  let identity = await clerkUserForEmail(email);
  if (!identity) {
    try {
      // `reserved` is intentionally unverified. Clerk remains the sole OTP and
      // verification authority; no ClinicFlow profile is created at this stage.
      identity = await clerkClient.users.createUser({
        emailAddress: [email],
        emailAddressIdentificationStatus: ["reserved"],
        skipPasswordRequirement: true,
      });
    } catch (error) {
      // A concurrent request or pre-existing Clerk identity can win the unique
      // email race. Re-read and accept only the exact normalized identifier.
      identity = await clerkUserForEmail(email);
      if (!identity) throw new HttpError(503, "Authentication service unavailable. Please retry.", "AUTH_PROVIDER_UNAVAILABLE");
    }
  }

  res.json({ email });
});

authRouter.post("/auth/staff-entry", staffEntryIpLimit, staffEntryAccountLimit, async (req, res) => {
  const email = normalizedEmail(z.PrepareStaffEntryBody, req.body);
  const local = await localUserByEmail(email);
  if (!local || !isStaffRole(local.role)) {
    throw new HttpError(403, "This account is not registered for Staff Login", "STAFF_ACCOUNT_REQUIRED");
  }
  if (local.status !== "active") {
    throw new HttpError(403, "Staff account is inactive", "STAFF_ACCOUNT_INACTIVE");
  }
  res.json({ email });
});

authRouter.get("/auth/status", async (req, res) => {
  const { clerkId, sessionId } = requireSessionIdentity(req);
  const user = await findUser(clerkId);
  const staff = isStaffRole(user?.role);
  const staffPasswordVerified = staff && user?.status === "active"
    ? await hasStaffSessionProof(sessionId, clerkId)
    : false;
  res.json({
    role: user?.role ?? null,
    staffPasswordVerified,
    requiresStaffPassword: staff && !staffPasswordVerified,
  });
});

authRouter.post("/auth/staff-verify", passwordVerificationLimit, async (req, res) => {
  const { clerkId, sessionId } = requireSessionIdentity(req);
  const { password } = parse(z.VerifyStaffPasswordBody, req.body);
  const user = await findUser(clerkId);
  if (!user || !isStaffRole(user.role)) {
    throw new HttpError(403, "Staff account is required", "STAFF_ACCOUNT_REQUIRED");
  }
  if (user.status !== "active") {
    throw new HttpError(403, "Staff account is inactive", "STAFF_ACCOUNT_INACTIVE");
  }

  try {
    await clerkClient.users.verifyPassword({ userId: clerkId, password });
  } catch (error: any) {
    const status = Number(error?.status || error?.statusCode);
    if ([400, 401, 403, 422].includes(status)) {
      throw new HttpError(401, "Password is incorrect", "INVALID_STAFF_PASSWORD");
    }
    throw new HttpError(503, "Authentication service unavailable. Please retry.", "AUTH_PROVIDER_UNAVAILABLE");
  }

  // Access-token JWTs can rotate far sooner than the Clerk session. Bind the
  // proof to Clerk's authoritative session lifetime, not the current JWT exp.
  const expiresAt = await authoritativeStaffSessionExpiry(sessionId, clerkId);

  await db.transaction(async tx => {
    await tx.insert(staffSessionProofs).values({
      sessionId,
      clerkUserId: clerkId,
      expiresAt,
    }).onConflictDoUpdate({
      target: staffSessionProofs.sessionId,
      set: { clerkUserId: clerkId, expiresAt, createdAt: new Date() },
    });
    await audit(user, "verifyStaffPassword", "users", user, tx);
  });
  req.log.info({ event: "staff_password_verified", userId: user.id }, "Staff password verified");
  res.json({ role: user.role, staffPasswordVerified: true, requiresStaffPassword: false });
});