import { Router } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import * as z from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { db, users, settings, schedules, clinics, branches, doctors } from "@workspace/db";
import { requireUser, roles } from "../lib/auth";
import { createOwnedClinic, withinBranchHours } from "../lib/clinic-expansion";
import { validateTimes } from "../lib/availability";
import { audit, put, uid } from "../lib/store";
import { assert, HttpError, parse } from "../lib/http";
import { nextDemoLoginAttempts } from "../lib/demo-policy";
import { consumeRateLimit, createSession, hashPassword, verifyPassword, revokeUserSessions } from "../lib/native-auth";

export const demoRouter = Router();
export const DEMO_ID = "clinicflow:published-demo";
const SLUG = "clinicflow-demo";
const EMAIL = "doctor@clinicflow.example.com";
const LOGIN_BUCKET = "clinicflow:demo-login-attempts";

async function configured(conn: any = db): Promise<any | null> {
  const [row] = await conn.select().from(settings).where(eq(settings.id, DEMO_ID));
  return row?.data || null;
}

function details(config: any) {
  return config ? {
    configured: true, enabled: config.enabled === true,
    clinicName: "ClinicFlow DEMO Clinic", clinicSlug: SLUG,
    branchSlug: "main-location", doctorName: "Dr. Demo Doctor",
    loginPath: "/demo-login", clinicPath: `/${SLUG}/main-location`,
    bookingPath: `/${SLUG}/main-location?book=1`,
    username: "clinicflow-demo",
  } : { configured: false, enabled: false };
}

const ipLimit = rateLimit({
  windowMs: 10 * 60_000, limit: 50,
  standardHeaders: "draft-8", legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(req.ip || "unknown"),
  message: { error: "Too many login attempts", code: "RATE_LIMITED" },
});

// The shared PostgreSQL counter is authoritative across all app instances.
// Count attempts across workers before checking the local password.
async function consumeAttempt(ip: string) {
  await consumeRateLimit(`${LOGIN_BUCKET}:${ipKeyGenerator(ip)}`, 5);
}

demoRouter.post("/demo/login", ipLimit, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { password } = parse(z.DemoLoginBody, req.body);
  await consumeAttempt(req.ip || "unknown");
  const config = await configured();
  if (!config?.enabled || !config.userId) throw new HttpError(403, "Demo login is disabled", "DEMO_DISABLED");
  const [account] = await db.select().from(users).where(eq(users.id, config.userId));
  if (!account || account.status !== "active" || account.role !== "clinicAdmin" ||
      account.data?.demoFixture !== DEMO_ID ||
      account.email !== EMAIL) throw new HttpError(403, "Demo login unavailable", "DEMO_DISABLED");
  if (!await verifyPassword(account.passwordHash, password)) throw new HttpError(401, "Invalid demo password", "INVALID_DEMO_PASSWORD");
  await createSession(res, account.id);
  res.json({ authenticated: true });
});

demoRouter.get("/demo/setup", async (req, res) => {
  const actor = await requireUser(req); roles(actor, ["superAdmin"]);
  res.setHeader("Cache-Control", "no-store");
  res.json(details(await configured()));
});

demoRouter.post("/demo/setup", async (req, res) => {
  const actor = await requireUser(req); roles(actor, ["superAdmin"]);
  res.setHeader("Cache-Control", "no-store");
  {
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${DEMO_ID}))`);
      const existing = await configured(tx);
      if (existing) return { ...details(existing), alreadyExists: true };
      const [collision] = await tx.select().from(users).where(eq(users.email, EMAIL));
      const [clinicCollision] = await tx.select().from(clinics).where(sql`${clinics.data}->>'slug' = ${SLUG}`);
      assert(!collision && !clinicCollision, 409, "Demo address or clinic slug already in use");
      const password = `Cf!${randomBytes(24).toString("base64url")}9a`;
      const account = await put(users, {
        id: uid(), email: EMAIL, fullName: "Dr. Demo Doctor", passwordHash: await hashPassword(password), emailVerifiedAt: new Date(),
        role: "clinicAdmin", invitationStatus: "notRequired", data: { demoFixture: DEMO_ID },
      }, tx);
      const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: "08:00", endTime: "23:50" }));
      const setup = await createOwnedClinic(actor, account, {
        clinic: { name: "ClinicFlow DEMO Clinic", slug: SLUG, address: "Fictional demo location — no visits", specialityIds: [] },
        branches: [{ name: "DEMO Main Location", slug: "main-location", address: "Fictional demo location — no visits",
          city: "Demo City", timezone: "Asia/Kolkata", openingHours: hours }],
        ownDoctor: true,
      }, tx);
      assert(setup.doctorId && setup.branches.length === 1, 500, "Demo setup incomplete");
      const branch = setup.branches[0];
      for (const dayOfWeek of hours.map(h => h.dayOfWeek)) {
        const session = {
          doctorId: setup.doctorId, clinicId: setup.clinic.id, branchId: branch.id,
          dayOfWeek, isOpen: true, startTime: "08:00", endTime: "23:50",
          timezone: "Asia/Kolkata", tokenPrefix: "D", maxTokens: 31,
          consultationMinutes: 20, bufferMinutes: 0, queueMode: "mixed",
        };
        validateTimes(session); withinBranchHours(branch, session);
        const saved = await put(schedules, {
          id: uid(), clinicId: setup.clinic.id, branchId: branch.id, doctorId: setup.doctorId, dayOfWeek, data: session,
        }, tx);
        await audit(actor, "create", "schedules", saved, tx);
      }
      const config = { enabled: true, userId: account.id, clinicId: setup.clinic.id,
        branchId: branch.id, doctorId: setup.doctorId };
      await tx.insert(settings).values({ id: DEMO_ID, data: config });
      await audit(actor, "createPublishedDemo", "clinics", setup.clinic, tx);
      return { ...details(config), password };
    });
    res.json(result);
  }
});

demoRouter.patch("/demo/setup", async (req, res) => {
  const actor = await requireUser(req); roles(actor, ["superAdmin"]);
  res.setHeader("Cache-Control", "no-store");
  const { action } = parse(z.UpdateDemoSetupBody, req.body);
  const operationId = randomUUID();
  // Commit disabled state before revoking native sessions to block new logins.
  const config = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${DEMO_ID}))`);
    const state = await configured(tx);
    assert(!state?.operationId || Number(state.operationStartedAt) < Date.now() - 15 * 60_000,
      409, "Another demo access change is in progress");
    if (state && action !== "enable") {
      await tx.update(settings).set({ data: { ...state, enabled: false, operationId, operationStartedAt: Date.now() } }).where(eq(settings.id, DEMO_ID));
    }
    return state;
  });
  assert(config?.userId, 404, "Demo not configured");
  const [account] = await db.select().from(users).where(eq(users.id, config.userId));
  let password: string | undefined;
  try {
  assert(account?.data?.demoFixture === DEMO_ID, 409, "Demo account changed");
  if (action === "rotate-password") {
    password = `Cf!${randomBytes(24).toString("base64url")}9a`;
    await db.update(users).set({ passwordHash: await hashPassword(password), passwordChangedAt: new Date() }).where(eq(users.id, account.id));
  }
  if (action === "disable" || action === "rotate-password") {
    await revokeUserSessions(account.id);
  }
  if (action === "enable") {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${DEMO_ID}))`);
      const latest = await configured(tx);
      assert(latest?.userId === config.userId &&
        (!latest.operationId || Number(latest.operationStartedAt) < Date.now() - 15 * 60_000),
      409, "Demo setup changed");
      const { operationId: _failed, operationStartedAt: _started, ...rest } = latest;
      await tx.update(settings).set({ data: { ...rest, enabled: true } }).where(eq(settings.id, DEMO_ID));
    });
  } else {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${DEMO_ID}))`);
      const latest = await configured(tx);
      assert(latest?.userId === config.userId && latest.operationId === operationId, 409, "Demo setup changed");
      const { operationId: _completed, operationStartedAt: _started, ...rest } = latest;
      await tx.update(settings).set({ data: { ...rest, enabled: action === "rotate-password" && config.enabled } }).where(eq(settings.id, DEMO_ID));
    });
  }
  await audit(actor, `demo:${action}`, "users", account);
  res.json({ ...details(await configured()), ...(password ? { password } : {}) });
  } catch (error) {
    if (action !== "enable") {
      await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${DEMO_ID}))`);
        const latest = await configured(tx);
        if (latest?.operationId === operationId) {
          const { operationId: _failed, operationStartedAt: _started, ...rest } = latest;
          await tx.update(settings).set({ data: { ...rest, enabled: false } }).where(eq(settings.id, DEMO_ID));
        }
      });
    }
    throw error;
  }
});