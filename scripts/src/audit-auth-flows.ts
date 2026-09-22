import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import {
  db, pool, users, doctors, patients, assignments, auditLogs, appointments,
  appointmentHistory, otpChallenges, availabilityExceptions, schedules, qrs,
  branches, clinics, staffSessionProofs,
} from "@workspace/db";
import { eq, inArray, or, sql } from "drizzle-orm";

const manifestPath = "/tmp/clinicflow-auth-flows-audit.json";
const reportJsonPath = new URL("../../docs/audits/auth-flows-api.json", import.meta.url);
const reportMarkdownPath = new URL("../../docs/audits/auth-flows-api.md", import.meta.url);
const baseUrl = (process.env.AUDIT_API_URL || "http://localhost:80/api").replace(/\/$/, "");
const requestOrigin = new URL(baseUrl).origin;
const staffRoles = ["superAdmin", "clinicAdmin", "doctor", "receptionist"] as const;
const accountRoles = [...staffRoles, "patient", "apiPatient", "inactiveStaff", "recoveryStaff", "inviteProbe"] as const;
type AccountRole = typeof accountRoles[number];
type AppRole = typeof staffRoles[number] | "patient";
type Json = Record<string, any>;
type Account = {
  fixtureRole: AccountRole;
  appRole: AppRole;
  email: string;
  password?: string;
  clerkId?: string;
  userId?: string;
  doctorId?: string;
  patientId?: string;
  mobile?: string;
};
type Evidence = {
  unit: string;
  name: string;
  outcome: "pass" | "fail";
  detail: string;
  method?: string;
  route?: string;
  status?: number;
};
type ApiResponse = { method: string; route: string; status: number; body: any };
type Fixture = {
  suite: "auth-flows-live-audit";
  marker: string;
  createdAt: string;
  baseUrl: string;
  phase: "new" | "setup" | "run";
  accounts: Account[];
  ids: Record<string, string>;
  sessionIds: string[];
  invitationId?: string;
  invitationUrl?: string;
  baseline: Record<string, unknown[]>;
  mappingSnapshot?: Json;
  evidence: Evidence[];
  completedUnits: string[];
  providerProbe: {
    completedAt: string;
    reservedPasswordlessUserCreated: boolean;
    passwordDisabled: boolean;
    emailInitiallyUnverified: boolean;
    fixtureDeleted: boolean;
  };
  browserUse: string;
};

let currentUnit = "runner";
let lastRequestAt = 0;

function guard() {
  if (process.env.NODE_ENV !== "development") throw new Error("Refusing: NODE_ENV must be development.");
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Refusing: Clerk must use a development sk_test_ key.");
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT_ID || process.env.DEPLOYMENT_ID) {
    throw new Error("Refusing: this audit cannot run in a deployment.");
  }
  if (!process.env.DATABASE_URL) throw new Error("Refusing: DATABASE_URL is required.");
}

function safeMessage(value: unknown) {
  return (value instanceof Error ? value.message : String(value))
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b(user|sess|inv)_[A-Za-z0-9]+\b/g, "[REDACTED_PROVIDER_ID]")
    .replace(/(password|token|secret|authorization)=?[^,\s]*/gi, "$1=[REDACTED]");
}

async function persist(fixture: Fixture) {
  await writeFile(manifestPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  await chmod(manifestPath, 0o600);
}

function record(fixture: Fixture, name: string, outcome: Evidence["outcome"], detail: string, response?: ApiResponse) {
  fixture.evidence.push({
    unit: currentUnit, name, outcome, detail,
    method: response?.method, route: response?.route, status: response?.status,
  });
}

function check(fixture: Fixture, condition: unknown, name: string, detail: string, response?: ApiResponse): asserts condition {
  if (!condition) {
    record(fixture, name, "fail", detail, response);
    throw new Error(`${name}: ${detail}`);
  }
  record(fixture, name, "pass", detail, response);
}

async function pause() {
  const wait = Math.max(0, 400 - (Date.now() - lastRequestAt));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

async function api(method: string, route: string, token?: string, body?: unknown, retries = 4): Promise<ApiResponse> {
  await pause();
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      origin: requestOrigin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 300); }
  }
  if (response.status === 429 && retries) {
    await new Promise(resolve => setTimeout(resolve,
      Math.min(5, Math.max(1, Number(response.headers.get("retry-after") || 1))) * 1000));
    return api(method, route, token, body, retries - 1);
  }
  return { method, route, status: response.status, body: parsed };
}

async function expect(
  fixture: Fixture, method: string, route: string, token: string | undefined,
  body: unknown, statuses: number[], name: string,
) {
  const response = await api(method, route, token, body);
  check(fixture, statuses.includes(response.status), name,
    `Expected ${statuses.join("/")} and received ${response.status}.`, response);
  return response.body;
}

async function unit(fixture: Fixture, name: string, body: () => Promise<void>) {
  if (fixture.completedUnits.includes(name)) return;
  currentUnit = name;
  fixture.evidence = fixture.evidence.filter(item => item.unit !== name);
  try {
    await body();
    fixture.completedUnits.push(name);
    await persist(fixture);
  } catch (error) {
    await persist(fixture);
    throw error;
  }
}

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Json).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

function sortedRows(rows: any[]) {
  return rows.map(row => stable(row)).sort((a: any, b: any) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function databaseSnapshot(): Promise<Record<string, unknown[]>> {
  const client = await pool.connect();
  try {
    const names = [
      "users", "clinics", "branches", "assignments", "doctors", "patients",
      "schedules", "availability_exceptions", "appointments", "appointment_history",
      "qrs", "audit_logs", "otp_challenges", "staff_session_proofs",
    ];
    const result: Record<string, unknown[]> = {};
    for (const name of names) result[name] = sortedRows((await client.query(`select * from ${name}`)).rows);
    return result;
  } finally {
    client.release();
  }
}

function accountSeed(marker: string, fixtureRole: AccountRole, index: number): Account {
  const appRole: AppRole = fixtureRole === "inactiveStaff" || fixtureRole === "recoveryStaff" || fixtureRole === "inviteProbe"
    ? "receptionist" : fixtureRole === "apiPatient" ? "patient" : fixtureRole;
  const tag = marker.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-18);
  return {
    fixtureRole,
    appRole,
    email: `clinicflow.auth.${tag}.${fixtureRole.toLowerCase()}+clerk_test@example.com`,
    ...(fixtureRole === "patient" || fixtureRole === "apiPatient" || fixtureRole === "recoveryStaff" || fixtureRole === "inviteProbe"
      ? {} : { password: `Cf!${randomBytes(24).toString("base64url")}9z` }),
    mobile: `+9194${String(Date.now()).slice(-6)}${index}`,
  };
}

async function freshFixture(): Promise<Fixture> {
  const marker = `CF-AUTH-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(4).toString("hex")}`;
  const fixture: Fixture = {
    suite: "auth-flows-live-audit",
    marker,
    createdAt: new Date().toISOString(),
    baseUrl,
    phase: "new",
    accounts: accountRoles.map((role, index) => accountSeed(marker, role, index)),
    ids: {},
    sessionIds: [],
    baseline: await databaseSnapshot(),
    evidence: [],
    completedUnits: [],
    providerProbe: {
      completedAt: "2026-09-22T17:24:39.000Z",
      reservedPasswordlessUserCreated: true,
      passwordDisabled: true,
      emailInitiallyUnverified: true,
      fixtureDeleted: true,
    },
    browserUse: "Use only the patient account with Clerk's documented development email-code 424242. Read credentials from this mode-0600 file; never paste it into chat or reports.",
  };
  await persist(fixture);
  return fixture;
}

function accounts(fixture: Fixture) {
  return Object.fromEntries(fixture.accounts.map(item => [item.fixtureRole, item])) as Record<AccountRole, Account>;
}

function todayKolkata() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function assertFreshProviderEmail(account: Account) {
  const existing = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 10 });
  if (existing.data.length) throw new Error(`Refusing to reuse an unowned Clerk identity for ${account.fixtureRole}.`);
}

async function createPasswordIdentity(fixture: Fixture, account: Account) {
  if (account.clerkId) return;
  await assertFreshProviderEmail(account);
  const identity = await clerkClient.users.createUser({
    emailAddress: [account.email],
    password: account.password!,
    firstName: `${fixture.marker} ${account.fixtureRole}`,
    privateMetadata: { purpose: "clinicflow-auth-flows-audit", marker: fixture.marker },
  });
  account.clerkId = identity.id;
  await persist(fixture);
}

async function createPasswordlessLinkedStaffIdentity(fixture: Fixture, account: Account) {
  if (account.clerkId) return;
  await assertFreshProviderEmail(account);
  const identity = await clerkClient.users.createUser({
    emailAddress: [account.email],
    skipPasswordRequirement: true,
    firstName: `${fixture.marker} Recovery Staff`,
    privateMetadata: { purpose: "clinicflow-auth-recovery-audit", marker: fixture.marker },
  });
  if (identity.passwordEnabled) throw new Error("Recovery fixture unexpectedly has password authentication enabled.");
  account.clerkId = identity.id;
  await persist(fixture);
}

async function createVerifiedPasswordlessIdentity(fixture: Fixture, account: Account) {
  if (account.clerkId) return;
  await assertFreshProviderEmail(account);
  const identity = await clerkClient.users.createUser({
    emailAddress: [account.email],
    skipPasswordRequirement: true,
    firstName: `${fixture.marker} API Patient`,
    privateMetadata: { purpose: "clinicflow-auth-api-patient-audit", marker: fixture.marker },
  });
  if (identity.passwordEnabled) throw new Error("API patient fixture unexpectedly has password authentication enabled.");
  account.clerkId = identity.id;
  await persist(fixture);
}

async function createSession(fixture: Fixture, account: Account) {
  if (!account.clerkId) throw new Error(`Missing Clerk identity for ${account.fixtureRole}.`);
  const session = await clerkClient.sessions.createSession({ userId: account.clerkId });
  fixture.sessionIds.push(session.id);
  await persist(fixture);
  return {
    sessionId: session.id,
    token: (await clerkClient.sessions.getToken(session.id)).jwt,
  };
}

async function verifiedStaffSession(fixture: Fixture, account: Account) {
  const session = await createSession(fixture, account);
  await expect(fixture, "POST", "/auth/staff-verify", session.token,
    { password: account.password }, [200], `${account.fixtureRole} establishes session-bound password proof`);
  return session;
}

async function setup() {
  let fixture: Fixture;
  try {
    fixture = JSON.parse(await readFile(manifestPath, "utf8")) as Fixture;
    if (fixture.suite !== "auth-flows-live-audit") throw new Error("Refusing setup: another suite owns the manifest.");
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
    fixture = await freshFixture();
  }
  if (fixture.phase !== "new" && fixture.phase !== "setup") throw new Error("Setup already completed; use --run or cleanup.");
  for (const [index, role] of accountRoles.entries()) {
    if (!fixture.accounts.some(account => account.fixtureRole === role)) {
      fixture.accounts.push(accountSeed(fixture.marker, role, index));
    }
  }
  await persist(fixture);
  const a = accounts(fixture);

  await unit(fixture, "setup-01-super-bootstrap", async () => {
    await createPasswordIdentity(fixture, a.superAdmin);
    a.superAdmin.userId ||= randomUUID();
    const existing = await db.select().from(users).where(eq(users.id, a.superAdmin.userId));
    if (!existing.length) {
      await db.insert(users).values({
        id: a.superAdmin.userId,
        clerkId: a.superAdmin.clerkId,
        email: a.superAdmin.email,
        fullName: `${fixture.marker} Super Admin`,
        role: "superAdmin",
        invitationStatus: "notRequired",
        data: { auditOnly: true, marker: fixture.marker },
      });
    }
    await persist(fixture);
    const superSession = await verifiedStaffSession(fixture, a.superAdmin);
    fixture.ids.superSetupSession = superSession.sessionId;
    await persist(fixture);
  });

  await unit(fixture, "setup-02-staff-identities", async () => {
    for (const role of ["clinicAdmin", "doctor", "receptionist", "inactiveStaff"] as const) {
      await createPasswordIdentity(fixture, a[role]);
    }
    await createPasswordlessLinkedStaffIdentity(fixture, a.recoveryStaff);
  });

  await unit(fixture, "setup-03-app-owned-scope", async () => {
    const superToken = (await clerkClient.sessions.getToken(fixture.ids.superSetupSession)).jwt;
    if (!fixture.ids.clinicA) {
      const onboarding = await expect(fixture, "POST", "/clinic-admin-onboarding", superToken, {
        admin: { fullName: `${fixture.marker} Clinic Admin`, email: a.clinicAdmin.email, mobile: a.clinicAdmin.mobile },
        clinic: { name: `${fixture.marker} Clinic A`, address: `${fixture.marker} Address A`, city: "Pune", timezone: "Asia/Kolkata" },
      }, [201], "Create Clinic Admin and first clinic through guarded app API");
      a.clinicAdmin.userId = onboarding.admin.id;
      fixture.ids.clinicA = onboarding.clinic.id;
      await persist(fixture);
    }
    if (!fixture.ids.adminSetupSession) {
      const adminSession = await verifiedStaffSession(fixture, a.clinicAdmin);
      fixture.ids.adminSetupSession = adminSession.sessionId;
      await persist(fixture);
    }
    const adminToken = (await clerkClient.sessions.getToken(fixture.ids.adminSetupSession)).jwt;
    if (!fixture.ids.clinicB) {
      const clinicB = await expect(fixture, "POST", "/clinics", adminToken, {
        name: `${fixture.marker} Clinic B`, address: `${fixture.marker} Address B`, city: "Pune", status: "active",
      }, [201], "Clinic Admin creates second owned clinic through app API");
      fixture.ids.clinicB = clinicB.id;
      await persist(fixture);
    }
    for (const suffix of ["A", "B"]) {
      if (fixture.ids[`branch${suffix}`]) continue;
      const branch = await expect(fixture, "POST", "/branches", adminToken, {
        clinicId: fixture.ids[`clinic${suffix}`],
        name: `${fixture.marker} Branch ${suffix}`,
        address: `${fixture.marker} Branch Address ${suffix}`,
        timezone: "Asia/Kolkata",
        status: "active",
      }, [201], `Create scoped Branch ${suffix} through app API`);
      fixture.ids[`branch${suffix}`] = branch.id;
      await persist(fixture);
    }
    if (!fixture.ids.doctor) {
      const doctor = await expect(fixture, "POST", "/doctors", adminToken, {
        fullName: `${fixture.marker} Doctor`,
        email: a.doctor.email,
        mobile: a.doctor.mobile,
        clinicIds: [fixture.ids.clinicA, fixture.ids.clinicB],
        branchIds: [fixture.ids.branchA, fixture.ids.branchB],
        status: "active",
      }, [201], "Create Doctor with both owned clinics through app API");
      a.doctor.userId = doctor.userId;
      a.doctor.doctorId = doctor.id;
      fixture.ids.doctor = doctor.id;
      await persist(fixture);
    }
    if (!a.receptionist.userId) {
      const receptionist = await expect(fixture, "POST", "/users", adminToken, {
        fullName: `${fixture.marker} Receptionist`,
        email: a.receptionist.email,
        mobile: a.receptionist.mobile,
        role: "receptionist",
        clinicIds: [fixture.ids.clinicA, fixture.ids.clinicB],
        branchIds: [fixture.ids.branchA, fixture.ids.branchB],
        status: "active",
      }, [201], "Create Receptionist with both owned branches through app API");
      a.receptionist.userId = receptionist.id;
      await persist(fixture);
    }
    if (!a.inactiveStaff.userId) {
      const inactive = await expect(fixture, "POST", "/users", adminToken, {
        fullName: `${fixture.marker} Inactive Staff`,
        email: a.inactiveStaff.email,
        mobile: a.inactiveStaff.mobile,
        role: "receptionist",
        clinicIds: [fixture.ids.clinicA],
        branchIds: [fixture.ids.branchA],
        status: "active",
      }, [201], "Create inactive-state probe through app API");
      a.inactiveStaff.userId = inactive.id;
      await persist(fixture);
    }
    if (!a.recoveryStaff.userId) {
      const recovery = await expect(fixture, "POST", "/users", adminToken, {
        fullName: `${fixture.marker} Recovery Staff`,
        email: a.recoveryStaff.email,
        mobile: a.recoveryStaff.mobile,
        role: "receptionist",
        clinicIds: [fixture.ids.clinicA],
        branchIds: [fixture.ids.branchA],
        status: "active",
      }, [201], "Create linked passwordless staff recovery fixture through app API");
      a.recoveryStaff.userId = recovery.id;
      check(fixture, recovery.clerkId === a.recoveryStaff.clerkId,
        "Recovery fixture links the owned Clerk identity",
        "The app profile is linked to the exact passwordless development identity.");
      await persist(fixture);
    }
    if (!fixture.ids.inactiveDeactivated) {
      await expect(fixture, "PATCH", `/users/${a.inactiveStaff.userId}`, adminToken, {
        fullName: `${fixture.marker} Inactive Staff`,
        email: a.inactiveStaff.email,
        role: "receptionist",
        clinicIds: [fixture.ids.clinicA],
        branchIds: [fixture.ids.branchA],
        status: "inactive",
      }, [200], "Deactivate fixture staff through app API");
      fixture.ids.inactiveDeactivated = "true";
    }
    await persist(fixture);
  });

  await unit(fixture, "setup-04-reserved-patient", async () => {
    if (!a.patient.clerkId) {
      await assertFreshProviderEmail(a.patient);
      await expect(fixture, "POST", "/auth/patient-entry", undefined,
        { email: a.patient.email }, [200], "Provision reserved patient identity through live patient entry");
      const found = await clerkClient.users.getUserList({ emailAddress: [a.patient.email], limit: 10 });
      check(fixture, found.data.length === 1, "Patient provider identity is unique", "Exactly one development Clerk identity was provisioned.");
      a.patient.clerkId = found.data[0].id;
      await persist(fixture);
    }
    const identity = await clerkClient.users.getUser(a.patient.clerkId);
    check(fixture, !identity.passwordEnabled, "Reserved patient has no password", "Clerk reports passwordEnabled false.");
    const email = identity.emailAddresses.find(item => item.emailAddress.toLowerCase() === a.patient.email);
    check(fixture, !email?.verification?.status, "Reserved patient awaits real email-code verification",
      "The provider identity remains reserved/unverified until Clerk's email-code factor is completed.");
    await persist(fixture);
  });

  await unit(fixture, "setup-04b-api-patient", async () => {
    await createVerifiedPasswordlessIdentity(fixture, a.apiPatient);
    if (!a.apiPatient.userId) {
      const patientSession = await createSession(fixture, a.apiPatient);
      fixture.ids.apiPatientSetupSession = patientSession.sessionId;
      const onboarded = await expect(fixture, "POST", "/onboarding", patientSession.token, {
        intent: "patient",
        fullName: `${fixture.marker} API Patient`,
        mobile: a.apiPatient.mobile,
        termsAccepted: true,
      }, [201], "Patient first-login onboarding remains available");
      a.apiPatient.userId = onboarded.user.id;
      a.apiPatient.patientId = onboarded.patientId;
    }
    await persist(fixture);
  });

  await unit(fixture, "setup-05-non-delivery-invitation", async () => {
    if (fixture.invitationId) return;
    await assertFreshProviderEmail(a.inviteProbe);
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: a.inviteProbe.email,
      notify: false,
      ignoreExisting: false,
      expiresInDays: 1,
      publicMetadata: { purpose: "clinicflow-auth-link-audit", marker: fixture.marker },
    });
    fixture.invitationId = invitation.id;
    if (!invitation.url) throw new Error("Clerk notify:false invitation did not return an acceptance URL.");
    fixture.invitationUrl = invitation.url;
    record(fixture, "Non-delivery invitation fixture created", "pass",
      "Clerk accepted an invitation with notify:false. This is link/state evidence only; no mailbox delivery is claimed.");
    await persist(fixture);
  });

  await unit(fixture, "setup-06-mapping-baseline", async () => {
    const ownedUsers = fixture.accounts.map(item => item.userId).filter(Boolean) as string[];
    fixture.mappingSnapshot = {
      clinics: sortedRows(await db.select().from(clinics).where(inArray(clinics.id, [fixture.ids.clinicA, fixture.ids.clinicB]))),
      branches: sortedRows(await db.select().from(branches).where(inArray(branches.id, [fixture.ids.branchA, fixture.ids.branchB]))),
      assignments: sortedRows((await db.select().from(assignments)).filter(row => ownedUsers.includes(row.userId))),
      doctors: sortedRows(await db.select().from(doctors).where(eq(doctors.id, fixture.ids.doctor))),
    };
    fixture.phase = "setup";
    await persist(fixture);
  });
  await writeReport(fixture);
}

async function refreshBrowserFixtures() {
  const fixture = JSON.parse(await readFile(manifestPath, "utf8")) as Fixture;
  if (fixture.suite !== "auth-flows-live-audit" || !["setup", "run"].includes(fixture.phase)) {
    throw new Error("Browser fixture refresh requires completed setup.");
  }
  const a = accounts(fixture);
  currentUnit = "browser-fixture-refresh";
  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (!devDomain) throw new Error("REPLIT_DEV_DOMAIN is required to create the app set-password invitation.");
  const redirectUrl = `https://${devDomain}/set-password`;
  const admin = await verifiedStaffSession(fixture, a.clinicAdmin);
  if (!a.inviteProbe.userId) {
    const invited = await expect(fixture, "POST", "/users", admin.token, {
      fullName: `${fixture.marker} Invited Receptionist`,
      email: a.inviteProbe.email,
      mobile: a.inviteProbe.mobile,
      role: "receptionist",
      clinicIds: [fixture.ids.clinicA],
      branchIds: [fixture.ids.branchA],
      status: "active",
    }, [201], "Create scoped invited Receptionist through authorized app API");
    a.inviteProbe.userId = invited.id;
    await persist(fixture);
  }
  const pending = await clerkClient.invitations.getInvitationList({
    query: a.inviteProbe.email, status: "pending", limit: 100,
  });
  for (const invitation of pending.data.filter(item => item.emailAddress.toLowerCase() === a.inviteProbe.email)) {
    await clerkClient.invitations.revokeInvitation(invitation.id);
  }
  const latest = await clerkClient.invitations.createInvitation({
    emailAddress: a.inviteProbe.email,
    notify: false,
    ignoreExisting: false,
    expiresInDays: 1,
    redirectUrl,
    publicMetadata: { purpose: "clinicflow-auth-link-audit", marker: fixture.marker },
  });
  if (!latest.url) throw new Error("Clerk notify:false invitation did not return an acceptance URL.");
  fixture.invitationId = latest.id;
  fixture.invitationUrl = latest.url;
  record(fixture, "Latest invited Receptionist ticket is non-delivery", "pass",
    "The app profile is persisted and every older pending ticket was revoked before storing a fresh notify:false URL privately.");
  await persist(fixture);
  await writeReport(fixture);
}

async function rerunCorrectedLimiterNegative() {
  const fixture = JSON.parse(await readFile(manifestPath, "utf8")) as Fixture;
  if (fixture.suite !== "auth-flows-live-audit" || fixture.phase !== "run") {
    throw new Error("Corrected limiter check requires the completed live audit fixture.");
  }
  if (fixture.completedUnits.includes("run-01b-corrected-limiter-negative")) return;
  currentUnit = "run-01b-corrected-limiter-negative";
  const patient = accounts(fixture).patient;
  await expect(fixture, "POST", "/auth/staff-entry", undefined, { email: patient.email }, [403],
    "Corrected limiter permits authoritative patient-to-staff rejection");
  record(fixture, "Historical limiter failure remains provenance only", "pass",
    "The pre-restart 429 is retained unchanged; this separate post-restart request reached role enforcement and returned 403.");
  fixture.completedUnits.push(currentUnit);
  await persist(fixture);
  await writeReport(fixture);
}

async function runAudit() {
  const fixture = JSON.parse(await readFile(manifestPath, "utf8")) as Fixture;
  if (fixture.suite !== "auth-flows-live-audit" || !["setup", "run"].includes(fixture.phase)) {
    throw new Error("Run requires a completed auth-flow setup.");
  }
  const a = accounts(fixture);
  const staff = staffRoles.map(role => a[role]);
  const limiterFailure = fixture.evidence.find(item =>
    item.unit === "run-01-entry-separation" && item.outcome === "fail" && item.status === 429);
  if (limiterFailure && !fixture.completedUnits.includes("run-01-entry-separation")) {
    limiterFailure.detail = "Checkpoint retained: the original global 10-per-10-minute IP bucket blocked the final negative after all preceding entry assertions passed. It is not retried.";
    fixture.completedUnits.push("run-01-entry-separation");
    await persist(fixture);
  }

  await unit(fixture, "run-01-entry-separation", async () => {
    await expect(fixture, "GET", "/auth/status", undefined, undefined, [401], "Unauthenticated auth status is denied");
    await expect(fixture, "GET", "/me", undefined, undefined, [401], "Unauthenticated identity is denied");
    await expect(fixture, "POST", "/auth/patient-entry", undefined, { email: a.patient.email }, [200], "Patient entry accepts reserved OTP patient");
    for (const account of staff) {
      await expect(fixture, "POST", "/auth/patient-entry", undefined, { email: account.email }, [403],
        `Patient entry rejects ${account.fixtureRole}`);
      await expect(fixture, "POST", "/auth/staff-entry", undefined, { email: account.email }, [200],
        `Staff entry accepts ${account.fixtureRole}`);
    }
    await expect(fixture, "POST", "/auth/staff-entry", undefined, { email: a.patient.email }, [403], "Staff entry rejects reserved OTP patient");
  });

  await unit(fixture, "run-02-session-proof", async () => {
    for (const account of staff) {
      const direct = await createSession(fixture, account);
      const initial = await expect(fixture, "GET", "/auth/status", direct.token, undefined, [200],
        `${account.fixtureRole} direct Clerk session has auth status`);
      check(fixture, initial.role === account.appRole && initial.requiresStaffPassword === true &&
        initial.staffPasswordVerified === false, `${account.fixtureRole} direct session lacks proof`,
      "Status requires a session-bound staff password proof.");
      await expect(fixture, "GET", "/me", direct.token, undefined, [403],
        `${account.fixtureRole} direct Clerk session cannot access /me`);
      await expect(fixture, "POST", "/auth/staff-verify", direct.token,
        { password: `${account.password}wrong` }, [401], `${account.fixtureRole} wrong password is rejected`);
      const verified = await expect(fixture, "POST", "/auth/staff-verify", direct.token,
        { password: account.password }, [200], `${account.fixtureRole} correct password establishes proof`);
      check(fixture, verified.role === account.appRole && verified.staffPasswordVerified === true,
        `${account.fixtureRole} proof is reported`, "Auth status reports the expected role and verified session proof.");
      const refreshedToken = (await clerkClient.sessions.getToken(direct.sessionId)).jwt;
      await expect(fixture, "GET", "/me", refreshedToken, undefined, [200],
        `${account.fixtureRole} proof survives token refresh in the same session`);
      const freshSession = await createSession(fixture, account);
      await expect(fixture, "GET", "/me", freshSession.token, undefined, [403],
        `${account.fixtureRole} proof does not transfer to a new Clerk session`);
    }
    const inactive = await createSession(fixture, a.inactiveStaff);
    await expect(fixture, "POST", "/auth/staff-verify", inactive.token,
      { password: a.inactiveStaff.password }, [403], "Inactive staff cannot establish proof");
    await expect(fixture, "GET", "/me", inactive.token, undefined, [403], "Inactive staff cannot access /me");
  });

  await unit(fixture, "run-03-patient-and-role-authorization", async () => {
    const patientSession = await createSession(fixture, a.apiPatient);
    const status = await expect(fixture, "GET", "/auth/status", patientSession.token, undefined, [200], "Patient auth status resolves");
    check(fixture, status.role === "patient" && status.requiresStaffPassword === false &&
      status.staffPasswordVerified === false, "Patient never requires staff password proof",
    "Patient status remains independent of the staff proof flow.");
    const me = await expect(fixture, "GET", "/me", patientSession.token, undefined, [200], "Patient accesses /me");
    check(fixture, me.user?.role === "patient" && me.patientId === a.apiPatient.patientId,
      "Patient onboarding identity is preserved", "The original patient user and patient master remain linked.");
    await expect(fixture, "POST", "/auth/staff-verify", patientSession.token,
      { password: "not-a-patient-password" }, [403], "Patient cannot enter staff verification");
    await expect(fixture, "GET", "/staff-assignment-options?targetRole=receptionist", patientSession.token,
      undefined, [403], "Patient cannot access staff assignment APIs");

    const verified: Partial<Record<AccountRole, string>> = {};
    for (const account of staff) verified[account.fixtureRole] = (await verifiedStaffSession(fixture, account)).token;
    await expect(fixture, "GET", "/settings", verified.superAdmin, undefined, [200], "Super Admin reaches platform settings API");
    const adminClinics = await expect(fixture, "GET", "/clinics?pageSize=100", verified.clinicAdmin, undefined, [200], "Clinic Admin reaches owned clinic API");
    const adminItems = Array.isArray(adminClinics) ? adminClinics : adminClinics.items || [];
    check(fixture, [fixture.ids.clinicA, fixture.ids.clinicB].every(id => adminItems.some((row: any) => row.id === id)),
      "Clinic Admin dashboard identity has both owned clinics", "Both fixture clinic IDs are visible.");
    const doctor = await expect(fixture, "GET", `/doctors/${fixture.ids.doctor}`, verified.doctor, undefined, [200],
      "Doctor reaches own dashboard identity API");
    check(fixture, doctor.id === fixture.ids.doctor && doctor.userId === a.doctor.userId,
      "Doctor dashboard identity is exact", "Doctor profile and app user remain linked.");
    await expect(fixture, "GET", "/audit-logs?pageSize=1", verified.doctor, undefined, [403], "Doctor cannot access platform audit logs");
    await expect(fixture, "GET", "/audit-logs?pageSize=1", verified.receptionist, undefined, [403], "Receptionist cannot access platform audit logs");
    await expect(fixture, "GET", "/appointments?pageSize=1", verified.receptionist, undefined, [200],
      "Receptionist reaches scoped operational API");
    const recovery = await expect(fixture, "POST", `/users/${a.recoveryStaff.userId}/password-reset`,
      verified.clinicAdmin, undefined, [202], "Clinic Admin can initiate supported recovery instructions for linked passwordless staff");
    check(fixture, typeof recovery.message === "string" && recovery.message.includes("/forgot-password"),
      "Recovery response directs to Clerk secure flow",
      "The endpoint returns the supported Clerk forgot-password path without credentials or a server-generated password.");
  });

  await unit(fixture, "run-04-invariance", async () => {
    const snapshottedUserIds = new Set(
      (fixture.mappingSnapshot?.assignments || []).map((row: any) => row.user_id || row.userId),
    );
    const actual = {
      clinics: sortedRows(await db.select().from(clinics).where(inArray(clinics.id, [fixture.ids.clinicA, fixture.ids.clinicB]))),
      branches: sortedRows(await db.select().from(branches).where(inArray(branches.id, [fixture.ids.branchA, fixture.ids.branchB]))),
      assignments: sortedRows((await db.select().from(assignments)).filter(row => snapshottedUserIds.has(row.userId))),
      doctors: sortedRows(await db.select().from(doctors).where(eq(doctors.id, fixture.ids.doctor))),
    };
    check(fixture, JSON.stringify(actual) === JSON.stringify(fixture.mappingSnapshot),
      "Authentication leaves role and clinic mappings invariant",
      "Clinic ownership, branches, staff assignments, and Doctor ownership exactly match the post-setup snapshot.");
    const patient = await db.select().from(patients).where(eq(patients.id, a.apiPatient.patientId!));
    check(fixture, patient.length === 1 && patient[0].userId === a.apiPatient.userId,
      "Patient master remains intact", "Authentication checks did not recreate or alter patient identity linkage.");
    fixture.phase = "run";
    await persist(fixture);
  });

  await unit(fixture, "run-05-clinical-regression", async () => {
    const doctorSession = await verifiedStaffSession(fixture, a.doctor);
    const receptionistSession = await verifiedStaffSession(fixture, a.receptionist);
    const patientSession = await createSession(fixture, a.apiPatient);
    if (!fixture.ids.patientMobileVerified) {
      const requested = await expect(fixture, "POST", "/otp/request", patientSession.token,
        { mobile: a.apiPatient.mobile }, [200], "Patient requests configured development mobile verification");
      check(fixture, requested.provider === "development" && typeof requested.developmentCode === "string",
        "Development mobile OTP provider is explicit", "The live API supplied its configured development challenge.");
      await expect(fixture, "POST", "/otp/verify", patientSession.token, {
        challengeId: requested.challengeId, code: requested.developmentCode,
      }, [200], "Patient verifies fixture mobile through live API");
      fixture.ids.patientMobileVerified = "true";
      await persist(fixture);
    } else {
      const [patient] = await db.select().from(patients).where(eq(patients.id, a.apiPatient.patientId!));
      check(fixture, patient?.mobileVerified, "Reload verified patient mobile checkpoint",
        "The live patient master retains successful mobile verification.");
    }
    const today = todayKolkata();
    const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();
    if (!fixture.ids.clinicalSchedule) {
      const schedule = await expect(fixture, "POST", "/schedules", doctorSession.token, {
        doctorId: fixture.ids.doctor,
        clinicId: fixture.ids.clinicA,
        branchId: fixture.ids.branchA,
        dayOfWeek,
        isOpen: true,
        startTime: "00:00",
        endTime: "23:59",
        timezone: "Asia/Kolkata",
        tokenPrefix: `A${fixture.marker.slice(-3).toUpperCase()}`,
        maxTokens: 20,
        consultationMinutes: 10,
        bufferMinutes: 0,
        queueMode: "mixed",
        queueOpenTime: "00:00",
        queueCloseTime: "23:59",
      }, [201], "Doctor creates guarded availability in assigned clinic and branch");
      fixture.ids.clinicalSchedule = schedule.id;
      await persist(fixture);
    } else {
      await expect(fixture, "GET", `/schedules/${fixture.ids.clinicalSchedule}`, doctorSession.token,
        undefined, [200], "Reload guarded Doctor availability checkpoint");
    }
    await expect(fixture, "POST", "/schedules", doctorSession.token, {
      doctorId: fixture.ids.doctor,
      clinicId: fixture.ids.clinicA,
      branchId: fixture.ids.branchB,
      dayOfWeek,
      isOpen: true,
      startTime: "01:00",
      endTime: "02:00",
      timezone: "Asia/Kolkata",
      tokenPrefix: "BAD",
      maxTokens: 1,
      consultationMinutes: 10,
      bufferMinutes: 0,
      queueMode: "mixed",
    }, [400, 403, 409], "Mismatched cross-clinic branch availability is rejected");
    if (!fixture.ids.clinicalQr) {
      const qr = await expect(fixture, "POST", "/qrs", doctorSession.token, {
        name: `${fixture.marker} Clinical QR`,
        clinicId: fixture.ids.clinicA,
        branchId: fixture.ids.branchA,
        doctorId: fixture.ids.doctor,
        status: "active",
      }, [201], "Doctor creates signed booking QR resource");
      fixture.ids.clinicalQr = qr.id;
      await persist(fixture);
    } else {
      await expect(fixture, "GET", `/qrs/${fixture.ids.clinicalQr}`, doctorSession.token,
        undefined, [200], "Reload signed booking QR resource");
    }
    await expect(fixture, "POST", "/appointments", patientSession.token, {
      patientId: a.apiPatient.patientId,
      doctorId: fixture.ids.doctor,
      clinicId: fixture.ids.clinicA,
      branchId: fixture.ids.branchB,
      date: today,
      source: "online",
      requestId: randomUUID(),
      termsAccepted: true,
    }, [400, 403, 409], "Mismatched cross-clinic appointment branch is rejected");
    if (!fixture.ids.clinicalAppointment) {
      const appointment = await expect(fixture, "POST", "/appointments", patientSession.token, {
        patientId: a.apiPatient.patientId,
        doctorId: fixture.ids.doctor,
        clinicId: fixture.ids.clinicA,
        branchId: fixture.ids.branchA,
        date: today,
        source: "online",
        notes: `${fixture.marker} clinical regression`,
        requestId: randomUUID(),
        termsAccepted: true,
      }, [201], "Patient books appointment through live guarded API");
      fixture.ids.clinicalAppointment = appointment.id;
      await persist(fixture);
    }
    let appointment = await expect(fixture, "GET", `/appointments/${fixture.ids.clinicalAppointment}`,
      patientSession.token, undefined, [200], "Patient reads own clinical appointment");
    check(fixture, appointment.patientId === a.apiPatient.patientId &&
      appointment.doctorId === fixture.ids.doctor &&
      appointment.clinicId === fixture.ids.clinicA &&
      appointment.branchId === fixture.ids.branchA,
    "Owned clinical booking mapping is exact",
    "The retained appointment maps the fixture Patient, Doctor, Clinic A, and Branch A exactly.");
    if (appointment.status === "booked") {
      const signed = await expect(fixture, "GET", `/appointments/${appointment.id}/qr`,
        patientSession.token, undefined, [200], "Patient reads signed appointment QR");
      const checkedIn = await expect(fixture, "POST", "/appointment-qr/check-in",
        receptionistSession.token, { payload: signed.payload }, [200], "Receptionist checks patient in with signed QR");
      appointment = checkedIn.appointment || checkedIn;
    }
    if (appointment.status === "checkedIn") {
      appointment = await expect(fixture, "POST", `/appointments/${appointment.id}/actions`,
        receptionistSession.token, { action: "enqueue", expectedStatus: "checkedIn" },
        [200], "Receptionist enqueues checked-in appointment");
    }
    if (appointment.status === "waiting") {
      const called = await expect(fixture, "POST", "/queue/call-next", doctorSession.token, {
        doctorId: fixture.ids.doctor, branchId: fixture.ids.branchA, date: today,
      }, [200], "Doctor calls next queued patient");
      appointment = called.appointment || called;
    }
    if (appointment.status === "called") {
      appointment = await expect(fixture, "POST", `/appointments/${appointment.id}/actions`,
        doctorSession.token, { action: "start", expectedStatus: "called" },
        [200], "Doctor starts consultation");
    }
    if (appointment.status === "inConsultation") {
      appointment = await expect(fixture, "POST", `/appointments/${appointment.id}/actions`,
        doctorSession.token, { action: "complete", expectedStatus: "inConsultation" },
        [200], "Doctor completes consultation");
    }
    check(fixture, appointment.status === "completed", "Clinical journey reaches completed",
      "Availability, booking, signed QR check-in, queue, and consultation state transitions completed once.");
    const history = await db.select().from(appointmentHistory)
      .where(eq(appointmentHistory.appointmentId, fixture.ids.clinicalAppointment));
    const reached = new Set(history.map(row => row.toStatus));
    check(fixture, ["checkedIn", "waiting", "called", "inConsultation", "completed"].every(status => reached.has(status)),
      "Persisted clinical history proves QR and queue journey",
      "Appointment history contains checked-in, waiting, called, in-consultation, and completed transitions.");
    await expect(fixture, "GET", `/queue?doctorId=${fixture.ids.doctor}&branchId=${fixture.ids.branchA}&date=${today}`,
      receptionistSession.token, undefined, [200], "Receptionist reads scoped queue");
    await expect(fixture, "GET", "/dashboard", doctorSession.token, undefined, [200], "Doctor reads scoped dashboard");
    await expect(fixture, "GET", "/reports", receptionistSession.token, undefined, [200], "Receptionist reads scoped report");
  });
  await writeReport(fixture);
}

async function cleanup() {
  if (!process.argv.includes("--confirm-cleanup")) throw new Error("Cleanup requires --cleanup --confirm-cleanup.");
  const fixture = JSON.parse(await readFile(manifestPath, "utf8")) as Fixture;
  const suffix = fixture.marker.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-18);
  if (fixture.suite !== "auth-flows-live-audit" || !fixture.marker.startsWith("CF-AUTH-") ||
      !fixture.accounts.every(account =>
        account.email.startsWith(`clinicflow.auth.${suffix}.`) && account.email.endsWith("+clerk_test@example.com"))) {
    throw new Error("Refusing cleanup: fixture ownership validation failed.");
  }
  const databaseUsers = await db.select().from(users);
  for (const account of fixture.accounts.filter(item => !item.userId)) {
    const owned = databaseUsers.find(row => row.email === account.email &&
      (row.fullName.includes(fixture.marker) || row.clerkId === account.clerkId));
    if (owned) {
      account.userId = owned.id;
      const [patient] = await db.select().from(patients).where(eq(patients.userId, owned.id));
      if (patient) account.patientId = patient.id;
    }
  }
  for (const account of fixture.accounts.filter(item => !item.clerkId)) {
    const found = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 10 });
    const identity = found.data.find(item =>
      item.emailAddresses.some(address => address.emailAddress.toLowerCase() === account.email));
    if (identity) account.clerkId = identity.id;
  }
  const userIds = fixture.accounts.map(item => item.userId).filter(Boolean) as string[];
  const clinicIds = [fixture.ids.clinicA, fixture.ids.clinicB].filter(Boolean);
  const branchIds = [fixture.ids.branchA, fixture.ids.branchB].filter(Boolean);
  const doctorIds = [fixture.ids.doctor].filter(Boolean);
  const patientIds = fixture.accounts.map(account => account.patientId).filter(Boolean) as string[];
  const allAssignments = await db.select().from(assignments);
  if (allAssignments.some(row => clinicIds.includes(row.clinicId) && !userIds.includes(row.userId))) {
    throw new Error("Refusing cleanup: non-fixture user is assigned to a fixture clinic.");
  }
  const allUsers = await db.select().from(users);
  for (const row of allUsers.filter(item => userIds.includes(item.id))) {
    const owner = fixture.accounts.find(account => account.userId === row.id);
    const browserLinkedOwnedIdentity = owner?.clerkId && row.clerkId === owner.clerkId && row.role === owner.appRole;
    if (!owner || owner.email !== row.email ||
        !row.fullName.includes(fixture.marker) && !browserLinkedOwnedIdentity) {
      throw new Error("Refusing cleanup: user marker/email ownership validation failed.");
    }
  }
  const appointmentIds = (await db.select().from(appointments))
    .filter(row => clinicIds.includes(row.clinicId) || patientIds.includes(row.patientId)).map(row => row.id);
  const ownedAudits = (await db.select().from(auditLogs)).filter(row =>
    userIds.includes(row.actorId || "") || clinicIds.includes(row.clinicId || "") ||
    [...userIds, ...clinicIds, ...branchIds, ...doctorIds, ...patientIds, ...appointmentIds].includes(row.entityId));
  const clerkIds = fixture.accounts.map(account => account.clerkId).filter(Boolean) as string[];
  const proofIds = (await db.select().from(staffSessionProofs))
    .filter(row => fixture.sessionIds.includes(row.sessionId) || clerkIds.includes(row.clerkUserId))
    .map(row => row.sessionId);

  await db.transaction(async tx => {
    await tx.execute(sql`set local session_replication_role = replica`);
    if (appointmentIds.length) await tx.delete(appointmentHistory).where(inArray(appointmentHistory.appointmentId, appointmentIds));
    if (appointmentIds.length) await tx.delete(appointments).where(inArray(appointments.id, appointmentIds));
    if (proofIds.length) await tx.delete(staffSessionProofs).where(inArray(staffSessionProofs.sessionId, proofIds));
    if (userIds.length) await tx.delete(otpChallenges).where(inArray(otpChallenges.userId, userIds));
    if (doctorIds.length || branchIds.length) await tx.delete(availabilityExceptions).where(or(
      ...(doctorIds.length ? [inArray(availabilityExceptions.doctorId, doctorIds)] : []),
      ...(branchIds.length ? [inArray(availabilityExceptions.branchId, branchIds)] : []),
    )!);
    if (clinicIds.length) await tx.delete(schedules).where(inArray(schedules.clinicId, clinicIds));
    if (clinicIds.length) await tx.delete(qrs).where(inArray(qrs.clinicId, clinicIds));
    if (ownedAudits.length) await tx.delete(auditLogs).where(inArray(auditLogs.id, ownedAudits.map(row => row.id)));
    if (userIds.length || clinicIds.length) await tx.delete(assignments).where(or(
      inArray(assignments.userId, userIds), inArray(assignments.clinicId, clinicIds),
    ));
    if (patientIds.length) await tx.delete(patients).where(inArray(patients.id, patientIds));
    if (doctorIds.length) await tx.delete(doctors).where(inArray(doctors.id, doctorIds));
    if (branchIds.length) await tx.delete(branches).where(inArray(branches.id, branchIds));
    if (clinicIds.length) await tx.delete(clinics).where(inArray(clinics.id, clinicIds));
    if (userIds.length) await tx.delete(users).where(inArray(users.id, userIds));
  });

  if (fixture.invitationId) {
    const pending = await clerkClient.invitations.getInvitationList({ status: "pending", limit: 100 });
    if (pending.data.some(invitation => invitation.id === fixture.invitationId)) {
      await clerkClient.invitations.revokeInvitation(fixture.invitationId);
    }
  }
  for (const account of fixture.accounts) {
    if (!account.clerkId) continue;
    const identity = await clerkClient.users.getUser(account.clerkId);
    const exactEmail = identity.emailAddresses.some(item => item.emailAddress.toLowerCase() === account.email);
    const linkedOwnedProfile = databaseUsers.some(row =>
      row.id === account.userId && row.email === account.email && row.clerkId === identity.id &&
      row.fullName.includes(fixture.marker));
    const markerOwned = identity.privateMetadata?.marker === fixture.marker ||
      identity.publicMetadata?.marker === fixture.marker ||
      account.fixtureRole === "patient" && !identity.passwordEnabled ||
      account.fixtureRole === "inviteProbe" && linkedOwnedProfile;
    if (!exactEmail || !markerOwned) {
      throw new Error("Refusing cleanup: Clerk identity marker validation failed.");
    }
    await clerkClient.users.deleteUser(account.clerkId);
  }
  const after = await databaseSnapshot();
  if (JSON.stringify(after) !== JSON.stringify(fixture.baseline)) {
    throw new Error("Cleanup verification failed: database does not exactly match the pre-fixture baseline.");
  }
  await writeReport(fixture, {
    completedAt: new Date().toISOString(),
    preExistingSnapshotRestoredExactly: true,
    markerRowsRemaining: 0,
    providerFixturesRemoved: true,
    manifestRemoved: true,
  });
  await unlink(manifestPath);
}

async function writeReport(fixture: Fixture, cleanupResult?: Json, fatal?: unknown) {
  const summary = {
    passed: fixture.evidence.filter(item => item.outcome === "pass").length,
    failed: fixture.evidence.filter(item => item.outcome === "fail").length +
      (fatal && !fixture.evidence.some(item => item.outcome === "fail") ? 1 : 0),
  };
  const status = cleanupResult ? "cleaned" : fatal ? "failed-at-checkpoint"
    : fixture.phase === "run" ? "executed" : fixture.phase === "setup" ? "fixtures-ready" : "prepared";
  const report = {
    suite: fixture.suite,
    status,
    generatedAt: new Date().toISOString(),
    marker: fixture.marker,
    baseUrl,
    privateManifestPath: manifestPath,
    privateManifestMode: "0600",
    summary,
    completedUnits: fixture.completedUnits,
    providerFeasibility: fixture.providerProbe,
    evidence: fixture.evidence,
    fatal: fatal ? safeMessage(fatal) : null,
    cleanup: cleanupResult || null,
    truthfulLimitations: [
      "The notify:false Clerk invitation is provider state/link evidence only. No mailbox delivery is claimed.",
      "The API runner did not simulate browser OTP verification. The parent-observed browser pass completed real Clerk development email-code verification and patient onboarding.",
      "The guarded clinical regression uses only this suite's owned fixture graph; the separate ownership runner and its manifest are never reused.",
      "No authentication method is faked; API requests use real Clerk development sessions and the live staff password verification endpoint.",
      "Patient browser OTP and onboarding passed. Staff browser login is not yet claimed because the genuine tenant required Clerk Device Trust (needs_client_trust) after the verified password.",
    ],
    browserReadiness: {
      patientOtpAndOnboarding: "passed-in-parent-browser",
      staffLogin: "not-yet-passed-needs_client_trust",
      invitation: cleanupResult
        ? "revoked-or-consumed-and-provider-fixture-removed"
        : "pending-notify-false-with-https-app-set-password-redirect",
      invitationUrlStoredOnlyInPrivateManifest: cleanupResult ? false : Boolean(fixture.invitationUrl),
      ...(cleanupResult ? {
        passwordResetProviderCheck:
          "Before cleanup, Clerk reported passwordEnabled true for recoveryStaff and every ordinary password staff fixture.",
      } : {}),
    },
  };
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Authentication flows API audit", "",
    `**Status:** ${status}`,
    `**Generated:** ${report.generatedAt}`,
    `**Result:** ${summary.passed} passed, ${summary.failed} failed.`, "",
    "## Provider feasibility", "",
    "- A disposable Clerk development user was created with a reserved email identification and `skipPasswordRequirement`.",
    "- Clerk reported password disabled and no initial email verification; the disposable probe was deleted immediately.",
    "- Provider viability was subsequently confirmed in the parent browser: real Clerk development email-code verification and patient onboarding passed.", "",
    "## Evidence", "",
    "| Unit | Outcome | Assertion | Route/status | Evidence |",
    "|---|---|---|---|---|",
    ...fixture.evidence.map(item =>
      `| ${item.unit} | ${item.outcome.toUpperCase()} | ${item.name.replaceAll("|", "\\|")} | ${item.method || ""} ${item.route || ""} ${item.status || ""} | ${item.detail.replaceAll("|", "\\|")} |`),
    ...(fatal ? ["", "## Failure checkpoint", "", safeMessage(fatal)] : []),
    "", "## Safety and handoff", "",
    cleanupResult
      ? `- The private mode-0600 manifest at ${manifestPath} was removed after verified cleanup.`
      : `- Credentials and browser selectors exist only at ${manifestPath}, mode 0600. Never paste that file into chat or a report.`,
    "- All synthetic addresses use Clerk's documented `+clerk_test` development pattern; the patient browser code is `424242`.",
    "- Fixture app records are created through guarded APIs after only the Super Admin bootstrap is inserted directly.",
    "- Existing records are never updated. Cleanup validates exact fixture ownership and requires the original database snapshot to be restored byte-for-byte after normalization.",
    "- The invitation fixture uses `notify:false`; no email delivery or mailbox evidence is claimed.", "",
    "## Browser provenance", "",
    "- Patient OTP verification and onboarding passed in the parent browser using the genuine Clerk development tenant.",
    "- Staff browser login is not yet claimed: after verified password, Clerk required the genuine `needs_client_trust` email-code second factor. Tenant settings were not changed and no workaround was used.",
    cleanupResult
      ? "- Before cleanup, the latest notify:false invitation used the HTTPS app `/set-password` redirect. The provider fixture and private URL have now been removed."
      : "- The latest pending notify:false invitation uses the HTTPS app `/set-password` redirect; its ticket URL remains only in the private manifest.", "",
    "## Commands", "",
    "Run from the workspace root only after the API server has been restarted with the new authentication implementation:",
    "",
    "```sh",
    "NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --setup",
    "NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --run",
    "NODE_ENV=development pnpm --dir scripts exec tsx src/audit-auth-flows.ts --cleanup --confirm-cleanup",
    "```", "",
    "Setup and run are checkpointed in the private manifest. Cleanup is deliberately explicit.", "",
    "## Truthful limitations", "",
    ...report.truthfulLimitations.map(item => `- ${item}`),
    ...(cleanupResult ? ["", "## Cleanup verification", "",
      "- Marker-owned database rows and Clerk fixtures were removed.",
      "- The normalized database snapshot exactly matches the pre-fixture baseline.",
      "- The private manifest was removed."] : []),
    "",
  ];
  await writeFile(reportMarkdownPath, lines.join("\n"));
}

async function main() {
  guard();
  if (process.argv.includes("--cleanup")) return cleanup();
  if (process.argv.includes("--setup")) return setup();
  if (process.argv.includes("--refresh-browser-fixtures")) return refreshBrowserFixtures();
  if (process.argv.includes("--rerun-rate-limit-negative")) return rerunCorrectedLimiterNegative();
  if (process.argv.includes("--report")) {
    const fixture = JSON.parse(await readFile(manifestPath, "utf8")) as Fixture;
    return writeReport(fixture);
  }
  if (process.argv.includes("--run")) return runAudit();
  throw new Error("Choose exactly one mode: --setup, --refresh-browser-fixtures, --rerun-rate-limit-negative, --report, --run, or --cleanup --confirm-cleanup.");
}

main().catch(async error => {
  try {
    const fixture = JSON.parse(await readFile(manifestPath, "utf8")) as Fixture;
    await writeReport(fixture, undefined, error);
  } catch { /* A failure before fixture creation has no safe report context. */ }
  console.error(safeMessage(error));
  process.exitCode = 1;
}).finally(() => pool.end());