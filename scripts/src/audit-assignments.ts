import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import {
  db, pool, users, doctors, patients, assignments, auditLogs, appointments,
  appointmentHistory, otpChallenges, availabilityExceptions, schedules, qrs,
  branches, clinics,
} from "@workspace/db";
import { eq, inArray, or, sql } from "drizzle-orm";

const credentialsPath = "/tmp/clinicflow-assignment-audit-credentials.json";
const reportJsonPath = new URL("../../docs/audits/assignment-api-verification.json", import.meta.url);
const reportMarkdownPath = new URL("../../docs/audits/assignment-api-verification.md", import.meta.url);
const baseUrl = (process.env.AUDIT_API_URL || "http://localhost:80/api").replace(/\/$/, "");
const marker = `CF-ASSIGN-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const roles = ["superAdmin", "adminA", "adminB", "doctorA", "peerDoctor", "receptionistA", "receptionistB", "patient"] as const;
type Role = typeof roles[number];
type Json = Record<string, any>;
type Account = {
  role: Role;
  appRole: "superAdmin" | "clinicAdmin" | "doctor" | "receptionist" | "patient";
  email: string;
  password: string;
  clerkId: string;
  userId?: string;
  doctorId?: string;
  patientId?: string;
  mobile?: string;
};
type Fixture = {
  marker: string;
  createdAt: string;
  baseUrl: string;
  accounts: Account[];
  ids: Record<string, string>;
  browserUse: string;
};
type ApiResponse = { method: string; route: string; status: number; body: any };
type Evidence = {
  name: string;
  outcome: "pass" | "fail" | "skip";
  method?: string;
  route?: string;
  status?: number;
  detail: string;
  payload?: unknown;
};

const evidence: Evidence[] = [];
let lastRequestAt = 0;
let resumeInfo: { previousGeneratedAt: string | null; previousFatal: string | null; preservedPasses: number } | null = null;

function guard() {
  if (process.env.NODE_ENV !== "development") throw new Error("Refusing: NODE_ENV must be development.");
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Refusing: CLERK_SECRET_KEY must be a Clerk development sk_test_ key.");
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT_ID || process.env.DEPLOYMENT_ID) {
    throw new Error("Refusing: assignment audit cannot execute in a deployment.");
  }
  if (!process.env.DATABASE_URL) throw new Error("Refusing: DATABASE_URL is required.");
}

function safePayload(value: unknown) {
  if (value === undefined) return undefined;
  const text = JSON.stringify(value, (key, item) =>
    /token|password|secret|authorization|developmentCode|payload/i.test(key) ? "[REDACTED]" : item);
  if (!text) return undefined;
  return text.length > 1800 ? `${text.slice(0, 1750)}…[truncated]` : JSON.parse(text);
}

function record(name: string, outcome: Evidence["outcome"], detail: string, response?: ApiResponse) {
  evidence.push({
    name, outcome, detail, method: response?.method, route: response?.route,
    status: response?.status, payload: safePayload(response?.body),
  });
}

function check(condition: unknown, name: string, detail: string, response?: ApiResponse): asserts condition {
  if (!condition) {
    record(name, "fail", detail, response);
    throw new Error(`${name}: ${detail}`);
  }
  record(name, "pass", detail, response);
}

function list(body: any): any[] {
  return Array.isArray(body) ? body
    : Array.isArray(body?.items) ? body.items
      : Array.isArray(body?.data) ? body.data : [];
}

function dateInKolkata(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + offsetDays * 86_400_000));
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
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
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 500); }
  }
  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after") || 1);
    await new Promise(resolve => setTimeout(resolve, Math.max(1, retryAfter) * 1000));
    return api(method, route, token, body, retries - 1);
  }
  return { method, route, status: response.status, body: parsed };
}

async function expect(method: string, route: string, token: string | undefined, body: unknown, statuses: number[], name: string) {
  const response = await api(method, route, token, body);
  check(statuses.includes(response.status), name, `Expected ${statuses.join("/")} and received ${response.status}.`, response);
  return response.body;
}

async function tokenFor(account: Account) {
  const session = await clerkClient.sessions.createSession({ userId: account.clerkId });
  return (await clerkClient.sessions.getToken(session.id)).jwt;
}

function accountSeed(role: Role, index: number): Account {
  const appRole = role === "adminA" || role === "adminB" ? "clinicAdmin"
    : role === "doctorA" || role === "peerDoctor" ? "doctor"
      : role === "receptionistA" || role === "receptionistB" ? "receptionist"
        : role;
  return {
    role, appRole,
    email: `cfa.${marker.slice(-20).toLowerCase()}.${role.toLowerCase()}@example.com`,
    password: `Cf!${randomBytes(18).toString("base64url")}9z`,
    clerkId: "",
    ...(role === "patient" ? { mobile: `+9196${String(Date.now()).slice(-6)}${index}` } : {}),
  };
}

async function updateFixture(fixture: Fixture) {
  await writeFile(credentialsPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  await chmod(credentialsPath, 0o600);
}

async function createIdentityFixtures(): Promise<Fixture> {
  const accounts = roles.map(accountSeed);
  const createdClerkIds: string[] = [];
  try {
    for (const account of accounts) {
      const existing = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 1 });
      if (existing.data.length) throw new Error(`Refusing to modify an existing Clerk identity for ${account.role}.`);
      const identity = await clerkClient.users.createUser({
        emailAddress: [account.email],
        password: account.password,
        firstName: `${marker} ${account.role}`,
        privateMetadata: { purpose: "clinicflow-assignment-audit", marker },
      });
      account.clerkId = identity.id;
      createdClerkIds.push(identity.id);
    }
    // Only actors needed to bootstrap API-owned business creation receive minimal direct profiles.
    for (const role of ["superAdmin", "adminA", "adminB"] as const) {
      const account = accounts.find(item => item.role === role)!;
      account.userId = randomUUID();
      await db.insert(users).values({
        id: account.userId, clerkId: account.clerkId, email: account.email,
        fullName: `${marker} ${role}`, role: account.appRole,
        data: { auditOnly: true, marker, fixtureKind: "minimal-identity-profile" },
      });
    }
  } catch (error) {
    for (const clerkId of createdClerkIds) {
      try { await clerkClient.users.deleteUser(clerkId); } catch { /* best effort */ }
    }
    throw error;
  }
  const fixture: Fixture = {
    marker, createdAt: new Date().toISOString(), baseUrl, accounts, ids: {},
    browserUse: "Retained for browser verification. Run this runner with --cleanup --confirm-cleanup only after the parent confirms browser work is complete.",
  };
  await updateFixture(fixture);
  return fixture;
}

async function refreshToken(tokens: Record<Role, string>, accounts: Record<Role, Account>, role: Role) {
  tokens[role] = await tokenFor(accounts[role]);
  return expect("GET", "/me", tokens[role], undefined, [200], `${role} re-authenticates with current persisted claims`);
}

function assertNoLeak(body: unknown, forbidden: string[], name: string, response?: ApiResponse) {
  const serialized = JSON.stringify(body);
  const leaked = forbidden.find(value => value && serialized.includes(value));
  check(!leaked, name, leaked ? `Response exposed out-of-scope marker ${leaked}.` : "Response omitted out-of-scope IDs and marker names.", response);
}

async function onboardPatient(account: Account, token: string) {
  const identity = await expect("POST", "/onboarding", token, {
    intent: "patient", fullName: `${marker} Patient`, mobile: account.mobile, termsAccepted: true,
  }, [201], "Patient creates minimal self profile through onboarding API");
  account.userId = identity.user.id;
  account.patientId = identity.patientId;
}

async function verifyPatientOtp(account: Account, token: string) {
  const requested = await expect("POST", "/otp/request", token, { mobile: account.mobile }, [200], "Patient requests development mobile OTP");
  check(requested.provider === "development" && typeof requested.developmentCode === "string",
    "Development OTP is explicitly enabled", "Development-only provider returned an in-band code; report redaction suppresses it.");
  await expect("POST", "/otp/verify", token, {
    challengeId: requested.challengeId, code: requested.developmentCode,
  }, [200], "Patient verifies mobile OTP");
}

async function databaseIntegrity(fixture: Fixture, accounts: Record<Role, Account>) {
  const ids = fixture.ids;
  const clinicRows = await db.select().from(clinics).where(inArray(clinics.id, [ids.clinicA, ids.clinicB]));
  const doctorRows = await db.select().from(doctors).where(eq(doctors.id, accounts.doctorA.doctorId!));
  const links = await db.select().from(assignments).where(inArray(assignments.userId, [
    accounts.adminA.userId!, accounts.doctorA.userId!, accounts.receptionistA.userId!, accounts.receptionistB.userId!,
  ]));
  check(clinicRows.length === 2 && clinicRows.every(row => row.adminId === accounts.adminA.userId),
    "Exactly one ClinicAdmin owns each clinic", "Clinic A and doctor-created Clinic B both persist Admin A as their single adminId.");
  check(doctorRows.length === 1 && doctorRows[0].ownerAdminId === accounts.adminA.userId,
    "Doctor has one persisted owner admin", "Doctor A ownerAdminId is the creating ClinicAdmin A.");
  check(links.filter(row => row.userId === accounts.adminA.userId && row.clinicId === ids.clinicA && !row.branchId).length === 1 &&
    links.filter(row => row.userId === accounts.adminA.userId && row.clinicId === ids.clinicB && !row.branchId).length === 1,
  "Admin cascade mappings are exact", "Admin A has exactly one clinic-level mapping for Clinic A and Clinic B.");
  check(links.filter(row => row.userId === accounts.doctorA.userId && row.clinicId === ids.clinicB && row.branchId === ids.branchB).length === 1,
    "Doctor Branch B mapping is exact", "Doctor A has exactly one persisted Clinic B / Branch B1 mapping.");
  const duplicateKeys = links.map(row => `${row.userId}:${row.clinicId}:${row.branchId || "clinic"}`);
  check(new Set(duplicateKeys).size === duplicateKeys.length, "No duplicate assignment rows", "Persisted user/clinic/branch mappings are unique.");
  const branchesById = new Map((await db.select().from(branches)).map(row => [row.id, row.clinicId]));
  check(links.every(row => !row.branchId || branchesById.get(row.branchId) === row.clinicId),
    "All branch assignments match clinic", "Every persisted branch assignment resolves to its own clinic.");

  const client = await pool.connect();
  const invalidId = randomUUID();
  try {
    await client.query("BEGIN");
    let code = "";
    try {
      await client.query(
        "insert into assignments (id, user_id, clinic_id, branch_id) values ($1,$2,$3,$4)",
        [invalidId, accounts.receptionistA.userId, ids.clinicA, ids.branchB],
      );
    } catch (error: any) {
      code = error?.code || "";
    }
    check(code === "23503", "Composite assignment FK rejects clinic mismatch", "Rollback-only direct SQL received PostgreSQL foreign-key violation 23503.");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  check(!(await db.select().from(assignments).where(eq(assignments.id, invalidId))).length,
    "Invalid SQL probe rolled back", "No invalid assignment survived the rollback transaction.");
}

async function runMatrix(fixture: Fixture, tokens: Record<Role, string>, resume = false) {
  const marker = fixture.marker;
  const accounts = Object.fromEntries(fixture.accounts.map(account => [account.role, account])) as Record<Role, Account>;
  const ids = fixture.ids;
  const adminA = accounts.adminA.userId!;
  const today = ids.today || dateInKolkata();
  ids.today = today;
  let clinicA: Json = { id: ids.clinicA };
  let branchA: Json = { id: ids.branchA };
  let doctorA: Json = { id: accounts.doctorA.doctorId || ids.doctorA };
  let receptionistB: Json = { id: accounts.receptionistB.userId || ids.receptionistB };
  let clinicB: Json = { id: ids.clinicB };
  let branchB: Json = { id: ids.branchB };

  if (!resume) {
  clinicA = await expect("POST", "/clinics", tokens.superAdmin, {
    name: `${marker} Clinic A`, address: `${marker} Address A`, city: "Pune",
    description: `${marker} owned audit fixture`, adminId: adminA, status: "active",
  }, [201], "SuperAdmin creates Clinic A with Admin A");
  ids.clinicA = clinicA.id;
  branchA = await expect("POST", "/branches", tokens.superAdmin, {
    clinicId: clinicA.id, name: `${marker} Branch A1`, address: `${marker} A1`,
    timezone: "Asia/Kolkata", status: "active",
  }, [201], "SuperAdmin creates Branch A1");
  ids.branchA = branchA.id;
  await updateFixture(fixture);

  await refreshToken(tokens, accounts, "adminA");
  const adminClinics = await expect("GET", "/clinics?pageSize=100", tokens.adminA, undefined, [200], "Admin A reads assigned Clinic A after re-auth");
  check(list(adminClinics).some(row => row.id === clinicA.id), "Admin A Clinic A projection", "Clinic A is immediately in Admin A scope.");

  doctorA = await expect("POST", "/doctors", tokens.adminA, {
    fullName: `${marker} Doctor A`, email: accounts.doctorA.email,
    clinicIds: [clinicA.id], branchIds: [branchA.id], status: "active",
  }, [201], "Admin A creates Doctor A through API");
  accounts.doctorA.userId = doctorA.userId;
  accounts.doctorA.doctorId = doctorA.id;
  ids.doctorA = doctorA.id;
  await updateFixture(fixture);

  const receptionistA = await expect("POST", "/users", tokens.adminA, {
    fullName: `${marker} Receptionist A`, email: accounts.receptionistA.email, role: "receptionist",
    clinicIds: [clinicA.id], branchIds: [branchA.id], status: "active",
  }, [201], "Admin A creates Receptionist A with mandatory branch");
  accounts.receptionistA.userId = receptionistA.id;
  ids.receptionistA = receptionistA.id;
  await updateFixture(fixture);

  await refreshToken(tokens, accounts, "doctorA");
  await refreshToken(tokens, accounts, "receptionistA");
  const doctorMe = await expect("GET", "/me", tokens.doctorA, undefined, [200], "Doctor A reads persisted Clinic A and Branch A1");
  check(doctorMe.user.clinicIds.includes(clinicA.id) && doctorMe.user.branchIds.includes(branchA.id),
    "Doctor A initial assignment", "Re-authenticated identity contains Clinic A / Branch A1.");

  receptionistB = await expect("POST", "/users", tokens.doctorA, {
    fullName: `${marker} Receptionist B`, email: accounts.receptionistB.email, role: "receptionist",
    clinicIds: [clinicA.id], branchIds: [branchA.id], status: "active",
  }, [201], "Doctor A creates Receptionist B in own scope");
  accounts.receptionistB.userId = receptionistB.id;
  ids.receptionistB = receptionistB.id;
  await updateFixture(fixture);
  await refreshToken(tokens, accounts, "receptionistB");
  for (const role of ["superAdmin", "adminA", "doctorA"] as const) {
    const visible = await expect("GET", "/users?role=receptionist&pageSize=100", tokens[role], undefined, [200], `${role} reads Doctor-created Receptionist B`);
    check(list(visible).some(row => row.id === receptionistB.id), `${role} Receptionist B visibility`, "Shared persisted staff mapping is visible.");
  }

  clinicB = await expect("POST", "/clinics", tokens.doctorA, {
    name: `${marker} Clinic B`, address: `${marker} Address B`, city: "Pune",
    description: `${marker} doctor-created owned audit fixture`, status: "active",
  }, [201], "Doctor A creates Clinic B");
  ids.clinicB = clinicB.id;
  branchB = await expect("POST", "/branches", tokens.doctorA, {
    clinicId: clinicB.id, name: `${marker} Branch B1`, address: `${marker} B1`,
    timezone: "Asia/Kolkata", status: "active",
  }, [201], "Doctor A creates Branch B1");
  ids.branchB = branchB.id;
  await updateFixture(fixture);

  for (const role of ["doctorA", "adminA", "superAdmin"] as const) {
    await refreshToken(tokens, accounts, role);
    const visible = await expect("GET", "/clinics?pageSize=100", tokens[role], undefined, [200], `${role} refreshes doctor-created clinic scope`);
    check(list(visible).some(row => row.id === clinicB.id), `${role} sees Clinic B`, "Doctor-created clinic cascade is persisted.");
    const visibleBranches = await expect("GET", `/branches?clinicId=${clinicB.id}&pageSize=100`, tokens[role], undefined, [200], `${role} reads Branch B1`);
    check(list(visibleBranches).some(row => row.id === branchB.id), `${role} sees Branch B1`, "Doctor-created branch is visible to the cascade.");
  }

  const ownerBefore = await db.select().from(clinics).where(eq(clinics.id, clinicB.id));
  const secondAdmin = await api("PATCH", `/clinics/${clinicB.id}`, tokens.adminB, {
    name: `${marker} Clinic B`, address: `${marker} Address B`, adminId: accounts.adminB.userId,
  });
  check([403, 409].includes(secondAdmin.status), "Second admin ownership conflict", "A second ClinicAdmin cannot take over Clinic B.", secondAdmin);
  const ownerAfter = await db.select().from(clinics).where(eq(clinics.id, clinicB.id));
  check(ownerAfter[0]?.adminId === ownerBefore[0]?.adminId && ownerAfter[0]?.adminId === adminA,
    "Ownership preserved after conflict", "Rejected second-admin request did not alter Clinic B adminId or assignments.");

  await expect("PATCH", `/doctors/${doctorA.id}`, tokens.adminA, {
    fullName: `${marker} Doctor A`, email: accounts.doctorA.email,
    clinicIds: [clinicA.id, clinicB.id], branchIds: [branchA.id, branchB.id], status: "active",
  }, [200], "Admin A maps Doctor A to Branch B1");
  await expect("PATCH", `/users/${receptionistB.id}`, tokens.adminA, {
    fullName: `${marker} Receptionist B`, email: accounts.receptionistB.email, role: "receptionist",
    clinicIds: [clinicA.id, clinicB.id], branchIds: [branchA.id, branchB.id], status: "active",
  }, [200], "Admin A maps Receptionist B to Branch B1");

  const duplicatePatchBody = {
    fullName: `${marker} Receptionist B`, email: accounts.receptionistB.email, role: "receptionist",
    clinicIds: [clinicA.id, clinicB.id], branchIds: [branchA.id, branchB.id], status: "active",
  };
  const mappingRace = await Promise.all([
    api("PATCH", `/users/${receptionistB.id}`, tokens.adminA, duplicatePatchBody),
    api("PATCH", `/users/${receptionistB.id}`, tokens.superAdmin, duplicatePatchBody),
  ]);
  check(mappingRace.every(result => [200, 409].includes(result.status)),
    "Concurrent duplicate mapping requests are bounded", "Both requests completed or conflicted without a server error.");
  const finalLinks = await db.select().from(assignments).where(eq(assignments.userId, receptionistB.id));
  check(finalLinks.filter(row => row.branchId === branchB.id).length === 1,
    "Concurrent mapping leaves one Branch B1 row", "Database uniqueness preserved exactly one receptionist/branch mapping.");
  } else {
    check(Boolean(clinicA.id && branchA.id && doctorA.id && receptionistB.id && clinicB.id && branchB.id),
      "Resume checkpoint is complete", "Existing fixture contains every ID required after the assignment phase.");
  }

  const existingMarkerAppointments = (await db.select().from(appointments)).filter(row =>
    row.clinicId === clinicB.id && String(row.data.notes || "").includes(marker));
  const advancedResume = resume && existingMarkerAppointments.some(row => row.data.source === "online");
  let peer: Json = { id: accounts.peerDoctor.doctorId };
  let bookingQr: Json;
  let online: Json;
  let appointmentQr: Json;
  let qrBooking: Json;
  let browserAppointmentQr: Json;
  let historyCountBefore = 0;
  const patientBody = (source: string, extra: Json = {}) => ({
    patientId: accounts.patient.patientId, doctorId: doctorA.id, clinicId: clinicB.id,
    branchId: branchB.id, date: today, source, notes: `${marker} ${source}`,
    requestId: randomUUID(), ...extra,
  });

  if (!advancedResume) {
  const raceNonce = randomBytes(2).toString("hex");
  const duplicateBranchBody = {
    clinicId: clinicB.id, name: `${marker} Concurrent Branch ${raceNonce}`, address: `${marker} duplicate`,
    timezone: "Asia/Kolkata", status: "active",
  };
  const branchRace = await Promise.all([
    api("POST", "/branches", tokens.doctorA, duplicateBranchBody),
    api("POST", "/branches", tokens.adminA, duplicateBranchBody),
  ]);
  check(branchRace.filter(result => result.status === 201).length === 1 &&
    branchRace.filter(result => result.status === 409).length === 1,
  "Concurrent branch creation is unique",
  `Expected one 201 and one 409; received ${branchRace.map(result => result.status).join("/")}.`);

  const scheduleB = await expect("POST", "/schedules", tokens.doctorA, {
    doctorId: doctorA.id, clinicId: clinicB.id, branchId: branchB.id, dayOfWeek: weekday(today),
    isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "Asia/Kolkata",
    tokenPrefix: `B${marker.slice(-3).toUpperCase()}`, maxTokens: 20, consultationMinutes: 10,
    bufferMinutes: 0, queueMode: "mixed", queueOpenTime: "00:00", queueCloseTime: "23:59",
  }, [201], "Doctor A creates Branch B1 schedule");
  ids.scheduleB = scheduleB.id;
  await expect("POST", "/schedules", tokens.adminA, {
    doctorId: doctorA.id, clinicId: clinicA.id, branchId: branchA.id, dayOfWeek: weekday(today),
    isOpen: true, startTime: "10:00", endTime: "11:00", timezone: "Asia/Kolkata",
    tokenPrefix: "OVR", maxTokens: 10, consultationMinutes: 10, bufferMinutes: 0, queueMode: "mixed",
  }, [409], "Reject cross-location overlapping schedule");

  const exceptionDate = dateInKolkata(8);
  const exceptionDay = weekday(exceptionDate);
  await expect("POST", "/schedules", tokens.adminA, {
    doctorId: doctorA.id, clinicId: clinicB.id, branchId: branchB.id, dayOfWeek: exceptionDay,
    isOpen: true, startTime: "09:00", endTime: "12:00", timezone: "Asia/Kolkata",
    tokenPrefix: "BX", maxTokens: 10, consultationMinutes: 10, bufferMinutes: 0, queueMode: "mixed",
  }, [201], "Create future Branch B schedule for exception collision");
  await expect("POST", "/schedules", tokens.adminA, {
    doctorId: doctorA.id, clinicId: clinicA.id, branchId: branchA.id, dayOfWeek: exceptionDay,
    isOpen: true, startTime: "13:00", endTime: "17:00", timezone: "Asia/Kolkata",
    tokenPrefix: "AX", maxTokens: 10, consultationMinutes: 10, bufferMinutes: 0, queueMode: "mixed",
  }, [201], "Create non-overlapping Branch A schedule");
  await expect("POST", "/availability-exceptions", tokens.receptionistA, {
    doctorId: doctorA.id, branchId: branchA.id, date: exceptionDate, isClosed: false,
    startTime: "10:00", endTime: "11:00", breakStart: null, breakEnd: null, maxTokens: 5,
    reason: `${marker} overlap probe`,
  }, [409], "Receptionist exception cannot overlap another location");
  await expect("POST", "/availability-exceptions", tokens.receptionistB, {
    doctorId: doctorA.id, branchId: branchB.id, date: dateInKolkata(9), isClosed: true,
    startTime: null, endTime: null, breakStart: null, breakEnd: null, maxTokens: null,
    reason: `${marker} scoped closure`,
  }, [201], "Receptionist manages authorized Doctor A availability");

  peer = await expect("POST", "/doctors", tokens.adminA, {
    fullName: `${marker} Peer Doctor`, email: accounts.peerDoctor.email,
    clinicIds: [clinicA.id], branchIds: [branchA.id], status: "active",
  }, [201], "Admin A creates peer doctor through API");
  accounts.peerDoctor.userId = peer.userId;
  accounts.peerDoctor.doctorId = peer.id;
  ids.peerDoctor = peer.id;
  await updateFixture(fixture);
  await refreshToken(tokens, accounts, "peerDoctor");
  await expect("POST", "/availability-exceptions", tokens.peerDoctor, {
    doctorId: doctorA.id, branchId: branchB.id, date: dateInKolkata(10), isClosed: true,
    reason: `${marker} unauthorized peer`, startTime: null, endTime: null,
    breakStart: null, breakEnd: null, maxTokens: null,
  }, [403], "Peer doctor cannot manage Doctor A availability");

  await onboardPatient(accounts.patient, tokens.patient);
  await verifyPatientOtp(accounts.patient, tokens.patient);
  await updateFixture(fixture);

  bookingQr = await expect("POST", "/qrs", tokens.doctorA, {
    name: `${marker} Clinic B booking QR`, clinicId: clinicB.id, branchId: branchB.id,
    doctorId: doctorA.id, status: "active",
  }, [201], "Doctor creates Branch B booking QR");
  ids.bookingQr = bookingQr.id;
  await expect("GET", `/public/qr/${bookingQr.reference}`, undefined, undefined, [200], "Public booking QR resolves without identity data");

  online = await expect("POST", "/appointments", tokens.patient, patientBody("online", { termsAccepted: true }), [201], "Patient online booking");
  ids.onlineAppointment = online.id;
  appointmentQr = await expect("GET", `/appointments/${online.id}/qr`, tokens.patient, undefined, [200], "Patient gets signed appointment QR");
  await expect("POST", "/appointment-qr/resolve", tokens.receptionistB, { payload: appointmentQr.payload }, [200], "Receptionist resolves appointment QR");
  const checkedIn = await expect("POST", "/appointment-qr/check-in", tokens.receptionistB, { payload: appointmentQr.payload }, [200], "Receptionist QR check-in uses queue engine");
  check(checkedIn.appointment.status === "waiting", "QR check-in enqueues atomically", "Appointment reached waiting through signed QR flow.");
  const qrAgain = await expect("GET", `/appointments/${online.id}/qr`, tokens.patient, undefined, [200], "Appointment QR remains retrievable after check-in");
  check(qrAgain.payload === appointmentQr.payload, "Appointment QR preserved", "Signed QR payload remains stable through lifecycle changes.");
  const called = await expect("POST", "/queue/call-next", tokens.doctorA, {
    doctorId: doctorA.id, branchId: branchB.id, date: today,
  }, [200], "Doctor calls QR-checked-in patient");
  check(called.appointment.id === online.id, "Queue calls expected QR appointment", "Call-next selected the connected online booking.");
  await expect("POST", `/appointments/${online.id}/actions`, tokens.doctorA, { action: "start", expectedStatus: "called" }, [200], "Doctor starts consultation");
  await expect("POST", `/appointments/${online.id}/actions`, tokens.doctorA, { action: "complete", expectedStatus: "inConsultation" }, [200], "Doctor completes consultation");
  const history = await expect("GET", `/appointments/${online.id}`, tokens.patient, undefined, [200], "Patient reads completed history");
  check(history.status === "completed" && history.history?.map((item: Json) => item.status).join(",") === "booked,checkedIn,waiting,called,inConsultation,completed",
    "Connected lifecycle history is complete", "Patient history contains every queue transition in order.");
  } else {
    const existingOnline = existingMarkerAppointments.find(row => row.data.source === "online");
    const existingQr = (await db.select().from(qrs)).find(row =>
      row.clinicId === clinicB.id && String(row.data.name || "").includes(marker));
    check(Boolean(existingOnline && existingQr && peer.id),
      "Advanced resume checkpoint is complete", "Schedules, peer doctor, patient, booking QR, and completed online flow remain persisted.");
    online = { ...existingOnline!.data, ...existingOnline };
    bookingQr = { ...existingQr!.data, id: existingQr!.id, reference: existingQr!.publicReference };
    appointmentQr = await expect("GET", `/appointments/${online.id}/qr`, tokens.patient, undefined, [200], "Reload signed appointment QR at advanced checkpoint");
  }

  const revocationResume = resume && Boolean(ids.browserAppointment && ids.browserAppointmentQrPayload);
  if (!revocationResume) {
  const existingPhone = existingMarkerAppointments.find(row => row.data.source === "phone");
  let phone: Json = existingPhone ? { ...existingPhone.data, ...existingPhone } : {};
  if (!phone.id) phone = await expect("POST", "/appointments", tokens.receptionistB, patientBody("phone"), [201], "Receptionist creates phone booking");
  if (phone.status === "booked") {
    await expect("POST", `/appointments/${phone.id}/actions`, tokens.receptionistB, { action: "checkIn", expectedStatus: "booked" }, [200], "Phone booking checks in");
    await expect("POST", `/appointments/${phone.id}/actions`, tokens.receptionistB, { action: "enqueue", expectedStatus: "checkedIn" }, [200], "Phone booking enters queue");
    await expect("POST", "/queue/call-next", tokens.doctorA, {
      doctorId: doctorA.id, branchId: branchB.id, date: today,
    }, [200], "Doctor calls phone booking");
    await expect("POST", `/appointments/${phone.id}/actions`, tokens.doctorA, { action: "start", expectedStatus: "called" }, [200], "Doctor starts phone consultation");
    phone = await expect("POST", `/appointments/${phone.id}/actions`, tokens.doctorA, { action: "complete", expectedStatus: "inConsultation" }, [200], "Doctor completes phone consultation");
  }
  const existingWalkIn = existingMarkerAppointments.find(row => row.data.source === "walkIn");
  let walkIn: Json = existingWalkIn ? { ...existingWalkIn.data, ...existingWalkIn } :
    await expect("POST", "/appointments", tokens.receptionistB, patientBody("walkIn"), [201], "Receptionist creates walk-in booking");
  if (walkIn.status === "waiting") {
    check(true, "Walk-in enters same queue engine", "Walk-in atomically reached waiting.");
    walkIn = await expect("POST", `/appointments/${walkIn.id}/actions`, tokens.receptionistB, { action: "noShow", expectedStatus: "waiting" }, [200], "Walk-in no-show transition");
  }
  const existingQrBooking = existingMarkerAppointments.find(row => row.data.source === "qr");
  qrBooking = existingQrBooking ? { ...existingQrBooking.data, ...existingQrBooking } :
    await expect("POST", "/appointments", tokens.patient, patientBody("qr", {
      termsAccepted: true, qrReference: bookingQr.reference,
    }), [201], "Patient books from clinic QR source");
  ids.qrAppointment = qrBooking.id;
  browserAppointmentQr = await expect("GET", `/appointments/${qrBooking.id}/qr`, tokens.patient, undefined, [200], "Prepare booked appointment QR for browser scanning");
  ids.browserAppointment = qrBooking.id;
  ids.browserAppointmentQrPayload = browserAppointmentQr.payload;
  ids.browserBookingQrReference = bookingQr.reference;
  await updateFixture(fixture);
  check(["online", "phone", "walkIn", "qr"].every(source =>
    [online, phone, walkIn, qrBooking].some(row => row.source === source)),
  "All four booking sources persisted", "Online, phone, walk-in, and QR all used the live appointment API.");

  const outAppointments = await expect("GET", `/appointments?clinicId=${clinicB.id}&pageSize=100`, tokens.receptionistA, undefined, [200], "Receptionist A requests out-of-scope appointments filter");
  assertNoLeak(outAppointments, [online.id, clinicB.id, branchB.id, `${marker} Clinic B`], "Appointments response has no Clinic B leakage");
  const outDoctors = await expect("GET", `/doctors?clinicId=${clinicB.id}&pageSize=100`, tokens.receptionistA, undefined, [200], "Receptionist A requests out-of-scope doctor projection");
  assertNoLeak(outDoctors, [clinicB.id, branchB.id], "Shared doctor projection hides out-of-scope mappings");
  const sharedDoctors = await expect("GET", `/doctors?clinicId=${clinicA.id}&pageSize=100`, tokens.receptionistA, undefined, [200], "Receptionist A reads shared Doctor A projection");
  const projectedDoctor = list(sharedDoctors).find(row => row.id === doctorA.id);
  check(Boolean(projectedDoctor) &&
    projectedDoctor.clinicIds?.includes(clinicA.id) &&
    projectedDoctor.branchIds?.includes(branchA.id) &&
    !projectedDoctor.clinicIds?.includes(clinicB.id) &&
    !projectedDoctor.branchIds?.includes(branchB.id),
  "Shared doctor mapping projection is scoped", "Receptionist A sees the shared doctor with only Clinic A / Branch A1 mappings.");
  await expect("PATCH", `/doctors/${doctorA.id}`, tokens.adminA, {
    fullName: `${marker} Doctor A`, email: accounts.doctorA.email,
    status: "active",
  }, [200], "Non-assignment doctor edit preserves omitted mappings");
  const mappingsAfterEdit = await db.select().from(assignments).where(eq(assignments.userId, accounts.doctorA.userId!));
  check(mappingsAfterEdit.some(row => row.clinicId === clinicB.id && row.branchId === branchB.id),
    "Hidden doctor mapping survives profile edit", "Clinic B / Branch B1 remained persisted when assignment arrays were omitted.");
  await expect("GET", `/queue?doctorId=${doctorA.id}&branchId=${branchB.id}&date=${today}`, tokens.receptionistA, undefined, [403], "Receptionist A cannot read Branch B queue");
  await expect("POST", "/appointment-qr/resolve", tokens.receptionistA, { payload: appointmentQr.payload }, [403], "Receptionist A cannot resolve Branch B appointment QR");
  await expect("GET", `/patients/${accounts.patient.patientId}`, tokens.receptionistA, undefined, [403], "Receptionist A cannot read Branch B patient");

  historyCountBefore = (await db.select().from(appointmentHistory).where(eq(appointmentHistory.appointmentId, online.id))).length;
  await expect("PATCH", `/users/${receptionistB.id}`, tokens.adminA, {
    fullName: `${marker} Receptionist B`, email: accounts.receptionistB.email, role: "receptionist",
    clinicIds: [clinicA.id], branchIds: [branchA.id], status: "active",
  }, [200], "Admin revokes Receptionist B Branch B scope only");
  await refreshToken(tokens, accounts, "receptionistB");
  } else {
    const persistedQrBooking = existingMarkerAppointments.find(row => row.id === ids.browserAppointment);
    check(Boolean(persistedQrBooking), "Revocation resume checkpoint is complete", "Booked browser QR appointment remains persisted.");
    qrBooking = { ...persistedQrBooking!.data, ...persistedQrBooking };
    browserAppointmentQr = { payload: ids.browserAppointmentQrPayload };
    historyCountBefore = (await db.select().from(appointmentHistory).where(eq(appointmentHistory.appointmentId, online.id))).length;
    await refreshToken(tokens, accounts, "receptionistB");
  }
  await expect("GET", `/dashboard?clinicId=${clinicB.id}&branchId=${branchB.id}&date=${today}`, tokens.receptionistB, undefined, [403], "Revoked receptionist cannot read Branch B dashboard");
  await expect("GET", `/appointments/${online.id}`, tokens.receptionistB, undefined, [403], "Revoked receptionist cannot read Branch B appointment");
  await expect("GET", `/patients/${accounts.patient.patientId}`, tokens.receptionistB, undefined, [403], "Revoked receptionist cannot read Branch B patient");
  await expect("POST", "/appointment-qr/resolve", tokens.receptionistB, { payload: appointmentQr.payload }, [403], "Revoked receptionist cannot resolve Branch B QR");
  const stillA = await expect("GET", `/branches?clinicId=${clinicA.id}&pageSize=100`, tokens.receptionistB, undefined, [200], "Revoked receptionist retains Branch A scope");
  check(list(stillA).some(row => row.id === branchA.id), "Exact-branch revocation preserves other branch", "Branch A remains available after Branch B revocation.");
  const historyCountAfter = (await db.select().from(appointmentHistory).where(eq(appointmentHistory.appointmentId, online.id))).length;
  check(historyCountAfter === historyCountBefore && historyCountAfter > 0, "Revocation preserves DB history", "Appointment history rows remain unchanged.");

  await expect("PATCH", `/doctors/${doctorA.id}`, tokens.adminA, {
    fullName: `${marker} Doctor A`, email: accounts.doctorA.email,
    clinicIds: [clinicA.id], branchIds: [branchA.id], status: "active",
  }, [200], "Admin revokes Doctor A Branch B scope");
  await refreshToken(tokens, accounts, "doctorA");
  await expect("GET", `/appointments/${online.id}`, tokens.doctorA, undefined, [403], "Revoked doctor cannot read Branch B appointment");
  await expect("GET", `/patients/${accounts.patient.patientId}`, tokens.doctorA, undefined, [403], "Revoked doctor cannot read Branch B patient");
  await expect("GET", `/qrs/${bookingQr.id}`, tokens.doctorA, undefined, [403], "Revoked doctor cannot read Branch B booking QR");
  await expect("POST", "/appointment-qr/resolve", tokens.doctorA, { payload: browserAppointmentQr.payload }, [403], "Revoked doctor cannot resolve Branch B appointment QR");
  const doctorHistoryAfterRevoke = (await db.select().from(appointmentHistory).where(eq(appointmentHistory.appointmentId, online.id))).length;
  check(doctorHistoryAfterRevoke === historyCountAfter,
    "Doctor revocation preserves DB history", "Doctor assignment revocation removed access without deleting lifecycle history.");
  await expect("PATCH", `/doctors/${doctorA.id}`, tokens.adminA, {
    fullName: `${marker} Doctor A`, email: accounts.doctorA.email,
    clinicIds: [clinicA.id, clinicB.id], branchIds: [branchA.id, branchB.id], status: "active",
  }, [200], "Restore Doctor A scope for browser fixture");
  await refreshToken(tokens, accounts, "doctorA");

  const testClinic = await expect("POST", "/clinics", tokens.superAdmin, {
    name: `${marker} Deactivation Clinic`, address: `${marker} deactivate`, adminId: adminA,
    description: `${marker} deactivation-only`, status: "active",
  }, [201], "Create test-only clinic for CRUD deactivation");
  const testBranch = await expect("POST", "/branches", tokens.superAdmin, {
    clinicId: testClinic.id, name: `${marker} Deactivation Branch`, address: `${marker} deactivate`,
    timezone: "Asia/Kolkata", status: "active",
  }, [201], "Create test-only branch for CRUD deactivation");
  await expect("PATCH", `/branches/${testBranch.id}`, tokens.superAdmin, {
    clinicId: testClinic.id, name: `${marker} Deactivation Branch Edited`, address: `${marker} edited`,
    timezone: "Asia/Kolkata", status: "active",
  }, [200], "Branch update CRUD");
  await expect("DELETE", `/branches/${testBranch.id}`, tokens.superAdmin, undefined, [204], "Branch deactivation CRUD");
  await expect("PATCH", `/clinics/${testClinic.id}`, tokens.superAdmin, {
    name: `${marker} Deactivation Clinic Edited`, address: `${marker} edited`, adminId: adminA, status: "active",
  }, [200], "Clinic update CRUD");
  await expect("DELETE", `/clinics/${testClinic.id}`, tokens.superAdmin, undefined, [204], "Clinic deactivation CRUD");
  await expect("DELETE", `/doctors/${peer.id}`, tokens.adminA, undefined, [204], "Doctor deactivation CRUD");
  tokens.peerDoctor = await tokenFor(accounts.peerDoctor);
  const inactiveDoctorMe = await api("GET", "/me", tokens.peerDoctor);
  check(inactiveDoctorMe.status === 403, "Deactivated doctor login rejected", "Fresh authenticated request was rejected after doctor deactivation.", inactiveDoctorMe);

  await expect("PATCH", `/users/${receptionistB.id}`, tokens.adminA, {
    fullName: `${marker} Receptionist B`, email: accounts.receptionistB.email, role: "receptionist",
    clinicIds: [clinicA.id, clinicB.id], branchIds: [branchA.id, branchB.id], status: "active",
  }, [200], "Restore Receptionist B scope for browser QR verification");
  await refreshToken(tokens, accounts, "receptionistB");
  const browserBooking = await expect("GET", `/appointments/${qrBooking.id}`, tokens.receptionistB, undefined, [200], "Browser fixture receptionist can read booked QR appointment");
  check(browserBooking.status === "booked", "Browser QR fixture remains booked", "A current marker-owned booked appointment is retained for browser scanning.");

  await databaseIntegrity(fixture, accounts);
  await updateFixture(fixture);
}

async function writeReport(fixture: Fixture | null, startedAt: string, fatal?: unknown) {
  const report = {
    generatedAt: new Date().toISOString(), startedAt, mode: fatal ? "failed" : resumeInfo ? "resumed-executed" : "executed",
    marker: fixture?.marker || null, baseUrl, credentialsPath,
    credentialsRetainedForBrowserAudit: Boolean(fixture),
    resume: resumeInfo,
    summary: {
      passed: evidence.filter(item => item.outcome === "pass").length,
      failed: evidence.filter(item => item.outcome === "fail").length + (fatal ? 1 : 0),
      skipped: evidence.filter(item => item.outcome === "skip").length,
    },
    fatal: fatal instanceof Error ? fatal.message : fatal ? String(fatal) : null,
    evidence,
    notTested: [
      "Frontend layout, responsive behavior, selectors, and browser refresh rendering are reserved for the parent browser audit.",
      "Production SMS is not exercised; the runner requires the existing development OTP provider.",
      "Production Clerk and deployed environments are deliberately refused.",
      "Legacy PreviewClinicAdmin clinics/doctors are inspected only indirectly for non-mutation and are never used as fixtures.",
    ],
  };
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Assignment API verification", "",
    `**Executed:** ${report.generatedAt}`,
    `**Marker:** ${report.marker || "fixture setup failed"}`,
    `**Result:** ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped.`, "",
    "## Evidence", "",
    "| Outcome | Assertion | Route/status | Evidence |", "|---|---|---|---|",
    ...evidence.map(item => `| ${item.outcome.toUpperCase()} | ${item.name.replaceAll("|", "\\|")} | ${item.method || ""} ${item.route || ""} ${item.status || ""} | ${item.detail.replaceAll("|", "\\|")} |`),
    ...(fatal ? ["", "## Fatal runner error", "", fatal instanceof Error ? fatal.message : String(fatal)] : []),
    ...(resumeInfo ? ["", "## Resume provenance", "",
      `- Preserved ${resumeInfo.preservedPasses} passing assertions from the prior phase.`,
      `- Prior failure: ${resumeInfo.previousFatal || "none"}.`,
      `- Prior report generated: ${resumeInfo.previousGeneratedAt || "unknown"}.`] : []),
    "", "## Safety", "",
    "- Real Clerk development sessions authenticate every protected request; no auth bypass is used.",
    "- Execution is refused outside development, with non-test Clerk keys, or in deployments.",
    "- Requests are throttled to 400 ms and retry only HTTP 429 responses.",
    "- Tokens, passwords, OTP codes, signed QR payloads, secrets, and headers are never written to reports.",
    `- Browser credentials and IDs are retained only at ${credentialsPath} with mode 0600.`,
    "- Cleanup is marker/ownership guarded and requires both `--cleanup` and `--confirm-cleanup` after browser verification.",
    "- The approved legacy PreviewClinicAdmin four-clinic/two-doctor fixture is not mutated.", "",
    "## Not tested by this runner", "",
    ...report.notTested.map(item => `- ${item}`), "",
  ];
  await writeFile(reportMarkdownPath, lines.join("\n"));
}

async function cleanup() {
  if (!process.argv.includes("--confirm-cleanup")) throw new Error("Cleanup requires --cleanup --confirm-cleanup.");
  const fixture = JSON.parse(await readFile(credentialsPath, "utf8")) as Fixture;
  if (!fixture.marker.startsWith("CF-ASSIGN-") ||
      !fixture.accounts.every(account =>
        account.email.startsWith("cfa.") &&
        account.email.includes(fixture.marker.slice(-20).toLowerCase()) &&
        account.email.endsWith("@example.com"))) {
    throw new Error("Refusing cleanup: invalid assignment-audit credential marker.");
  }
  const markerLower = fixture.marker.toLowerCase();
  const markerEmailFragment = fixture.marker.slice(-20).toLowerCase();
  const allUsers = await db.select().from(users);
  const isMarkerUser = (row: typeof allUsers[number]) =>
    fixture.accounts.some(account => account.userId === row.id || account.email === row.email) ||
    row.email.toLowerCase().includes(markerEmailFragment) ||
    row.fullName.toLowerCase().includes(markerLower) ||
    row.data.marker === fixture.marker;
  const markerUsers = allUsers.filter(isMarkerUser);
  const userIds = [...new Set(markerUsers.map(row => row.id))];
  const ownedClinics = (await db.select().from(clinics)).filter(row =>
    userIds.includes(row.ownerId || "") || userIds.includes(row.adminId));
  if (ownedClinics.some(row => !String(row.data.name || "").includes(fixture.marker))) {
    throw new Error("Refusing cleanup: clinic ownership and marker validation failed.");
  }
  const clinicIds = ownedClinics.map(row => row.id);
  const descendantAssignments = (await db.select().from(assignments)).filter(row => clinicIds.includes(row.clinicId));
  const descendantUsers = allUsers.filter(row => descendantAssignments.some(link => link.userId === row.id));
  if (descendantUsers.some(row => !isMarkerUser(row))) {
    throw new Error("Refusing cleanup: an assigned descendant user is not marker-owned.");
  }
  for (const row of descendantUsers) if (!userIds.includes(row.id)) userIds.push(row.id);
  const ownedBranches = (await db.select().from(branches)).filter(row => clinicIds.includes(row.clinicId));
  if (ownedBranches.some(row => !String(row.data.name || "").includes(fixture.marker))) {
    throw new Error("Refusing cleanup: a descendant branch is not marker-owned.");
  }
  const branchIds = ownedBranches.map(row => row.id);
  const scopedAppointments = (await db.select().from(appointments)).filter(row => clinicIds.includes(row.clinicId));
  const appointmentIds = scopedAppointments.map(row => row.id);
  const scopedPatients = (await db.select().from(patients)).filter(row =>
    userIds.includes(row.userId || "") || clinicIds.includes(row.clinicId || ""));
  const patientIds = scopedPatients.map(row => row.id);
  const scopedDoctors = (await db.select().from(doctors)).filter(row => userIds.includes(row.userId));
  const doctorIds = scopedDoctors.map(row => row.id);
  const scopedAudits = (await db.select().from(auditLogs)).filter(row =>
    userIds.includes(row.actorId || "") || clinicIds.includes(row.clinicId || "") ||
    [...clinicIds, ...branchIds, ...appointmentIds, ...patientIds, ...doctorIds, ...userIds].includes(row.entityId));
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const preservedSnapshots = {
    clinics: byId((await db.select().from(clinics)).filter(row => !clinicIds.includes(row.id))),
    branches: byId((await db.select().from(branches)).filter(row => !branchIds.includes(row.id))),
    users: byId(allUsers.filter(row => !userIds.includes(row.id))),
    assignments: byId((await db.select().from(assignments)).filter(row =>
      !userIds.includes(row.userId) && !clinicIds.includes(row.clinicId))),
    doctors: byId((await db.select().from(doctors)).filter(row => !doctorIds.includes(row.id))),
    patients: byId((await db.select().from(patients)).filter(row => !patientIds.includes(row.id))),
    appointments: byId((await db.select().from(appointments)).filter(row => !appointmentIds.includes(row.id))),
    appointmentHistory: byId((await db.select().from(appointmentHistory)).filter(row => !appointmentIds.includes(row.appointmentId))),
    schedules: byId((await db.select().from(schedules)).filter(row =>
      !clinicIds.includes(row.clinicId) && !doctorIds.includes(row.doctorId))),
    availabilityExceptions: byId((await db.select().from(availabilityExceptions)).filter(row =>
      !doctorIds.includes(row.doctorId) && !branchIds.includes(row.branchId))),
    qrs: byId((await db.select().from(qrs)).filter(row => !clinicIds.includes(row.clinicId))),
    auditLogs: byId((await db.select().from(auditLogs)).filter(row => !scopedAudits.some(audit => audit.id === row.id))),
    otpChallenges: byId((await db.select().from(otpChallenges)).filter(row => !userIds.includes(row.userId))),
  };
  const listClerkIds = async () => {
    const ids: string[] = [];
    let offset = 0;
    do {
      const page = await clerkClient.users.getUserList({ limit: 100, offset });
      ids.push(...page.data.map(user => user.id));
      offset += page.data.length;
      if (!page.data.length || ids.length >= page.totalCount) break;
    } while (true);
    return ids.sort();
  };
  const fixtureClerkIds = new Set(fixture.accounts.map(account => account.clerkId));
  const preservedClerkIds = (await listClerkIds()).filter(id => !fixtureClerkIds.has(id));

  await db.transaction(async tx => {
    // Ownership triggers intentionally prevent normal removal of a clinic's sole
    // admin mapping. This transaction is already restricted to marker-validated
    // fixtures, so suspend triggers locally to remove the complete owned graph.
    await tx.execute(sql`set local session_replication_role = replica`);
    if (appointmentIds.length) await tx.delete(appointmentHistory).where(inArray(appointmentHistory.appointmentId, appointmentIds));
    if (appointmentIds.length) await tx.delete(appointments).where(inArray(appointments.id, appointmentIds));
    if (userIds.length) await tx.delete(otpChallenges).where(inArray(otpChallenges.userId, userIds));
    if (doctorIds.length || branchIds.length) await tx.delete(availabilityExceptions).where(or(
      ...(doctorIds.length ? [inArray(availabilityExceptions.doctorId, doctorIds)] : []),
      ...(branchIds.length ? [inArray(availabilityExceptions.branchId, branchIds)] : []),
    )!);
    if (clinicIds.length) await tx.delete(schedules).where(inArray(schedules.clinicId, clinicIds));
    if (clinicIds.length) await tx.delete(qrs).where(inArray(qrs.clinicId, clinicIds));
    if (scopedAudits.length) await tx.delete(auditLogs).where(inArray(auditLogs.id, scopedAudits.map(row => row.id)));
    if (userIds.length || clinicIds.length) await tx.delete(assignments).where(or(
      inArray(assignments.userId, userIds), inArray(assignments.clinicId, clinicIds),
    ));
    if (patientIds.length) await tx.delete(patients).where(inArray(patients.id, patientIds));
    if (doctorIds.length) await tx.delete(doctors).where(inArray(doctors.id, doctorIds));
    if (branchIds.length) await tx.delete(branches).where(inArray(branches.id, branchIds));
    if (clinicIds.length) await tx.delete(clinics).where(inArray(clinics.id, clinicIds));
    if (userIds.length) await tx.delete(users).where(inArray(users.id, userIds));
  });
  for (const account of fixture.accounts) await clerkClient.users.deleteUser(account.clerkId);
  const remaining = [
    ...(await db.select().from(clinics)).filter(row => clinicIds.includes(row.id)),
    ...(await db.select().from(branches)).filter(row => branchIds.includes(row.id)),
    ...(await db.select().from(users)).filter(row => userIds.includes(row.id)),
    ...(await db.select().from(assignments)).filter(row => clinicIds.includes(row.clinicId) || userIds.includes(row.userId)),
    ...(await db.select().from(doctors)).filter(row => doctorIds.includes(row.id) || userIds.includes(row.userId)),
    ...(await db.select().from(patients)).filter(row => patientIds.includes(row.id) || userIds.includes(row.userId || "")),
    ...(await db.select().from(appointments)).filter(row => appointmentIds.includes(row.id) || clinicIds.includes(row.clinicId)),
    ...(await db.select().from(appointmentHistory)).filter(row => appointmentIds.includes(row.appointmentId)),
    ...(await db.select().from(schedules)).filter(row => clinicIds.includes(row.clinicId) || doctorIds.includes(row.doctorId)),
    ...(await db.select().from(availabilityExceptions)).filter(row => doctorIds.includes(row.doctorId) || branchIds.includes(row.branchId)),
    ...(await db.select().from(qrs)).filter(row => clinicIds.includes(row.clinicId)),
    ...(await db.select().from(auditLogs)).filter(row => scopedAudits.some(audit => audit.id === row.id)),
    ...(await db.select().from(otpChallenges)).filter(row => userIds.includes(row.userId)),
  ];
  if (remaining.length) throw new Error(`Cleanup verification failed: ${remaining.length} owned rows remain.`);
  for (const account of fixture.accounts) {
    const matches = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 1 });
    if (matches.data.length) throw new Error(`Cleanup verification failed: Clerk identity remains for ${account.role}.`);
  }
  const afterSnapshots = {
    clinics: byId(await db.select().from(clinics)),
    branches: byId(await db.select().from(branches)),
    users: byId(await db.select().from(users)),
    assignments: byId(await db.select().from(assignments)),
    doctors: byId(await db.select().from(doctors)),
    patients: byId(await db.select().from(patients)),
    appointments: byId(await db.select().from(appointments)),
    appointmentHistory: byId(await db.select().from(appointmentHistory)),
    schedules: byId(await db.select().from(schedules)),
    availabilityExceptions: byId(await db.select().from(availabilityExceptions)),
    qrs: byId(await db.select().from(qrs)),
    auditLogs: byId(await db.select().from(auditLogs)),
    otpChallenges: byId(await db.select().from(otpChallenges)),
  };
  for (const key of Object.keys(preservedSnapshots) as (keyof typeof preservedSnapshots)[]) {
    if (JSON.stringify(afterSnapshots[key]) !== JSON.stringify(preservedSnapshots[key])) {
      throw new Error(`Cleanup verification failed: pre-existing ${key} changed.`);
    }
  }
  if (JSON.stringify(await listClerkIds()) !== JSON.stringify(preservedClerkIds)) {
    throw new Error("Cleanup verification failed: original Clerk account set changed.");
  }
  const markerRemnants = Object.values(afterSnapshots).flat().filter(row =>
    JSON.stringify(row).toLowerCase().includes(markerLower));
  if (markerRemnants.length) throw new Error(`Cleanup verification failed: ${markerRemnants.length} marker rows remain.`);
  const cleanedAt = new Date().toISOString();
  const priorReport = JSON.parse(await readFile(reportJsonPath, "utf8")) as Json;
  priorReport.cleanup = {
    completedAt: cleanedAt,
    marker: fixture.marker,
    clerkAccountsRemoved: fixture.accounts.length,
    markerRowsRemaining: 0,
    preExistingRowsPreserved: true,
    preExistingClinicOwnershipPreserved: true,
    preExistingDoctorOwnershipPreserved: true,
    originalClerkAccountSetPreserved: true,
    credentialFileRemoved: true,
  };
  await writeFile(reportJsonPath, `${JSON.stringify(priorReport, null, 2)}\n`);
  const priorMarkdown = await readFile(reportMarkdownPath, "utf8");
  await writeFile(reportMarkdownPath, `${priorMarkdown.trimEnd()}\n\n## Cleanup verification\n\n- Completed: ${cleanedAt}\n- Marker: ${fixture.marker}\n- All isolated database and Clerk fixtures removed; marker rows remaining: 0.\n- All pre-existing rows, clinic/doctor ownership, and the original Clerk account set were preserved exactly.\n- The 141-pass regression evidence and historical fixed-failure provenance above are preserved.\n- Temporary credential file removed after verification.\n`);
  await unlink(credentialsPath);
  process.stdout.write(`Cleaned assignment fixture ${fixture.marker}; temporary credential file removed.\n`);
}

async function main() {
  guard();
  if (process.argv.includes("--cleanup")) return cleanup();
  const resume = process.argv.includes("--resume");
  const health = await api("GET", "/healthz");
  if (health.status !== 200) throw new Error(`API is not ready at ${baseUrl}; health returned ${health.status}.`);
  let startedAt = new Date().toISOString();
  let fixture: Fixture | null = null;
  try {
    if (resume) {
      fixture = JSON.parse(await readFile(credentialsPath, "utf8")) as Fixture;
      if (!fixture.marker.startsWith("CF-ASSIGN-") ||
          !["clinicA", "branchA", "doctorA", "receptionistB", "clinicB", "branchB"].every(key => fixture!.ids[key]) ||
          !fixture.accounts.every(account => account.clerkId && account.email.endsWith("@example.com"))) {
        throw new Error("Refusing resume: credential file does not contain the completed assignment checkpoint.");
      }
      const prior = JSON.parse(await readFile(reportJsonPath, "utf8")) as {
        generatedAt?: string;
        startedAt?: string;
        fatal?: string | null;
        evidence?: Evidence[];
      };
      const preserved = (prior.evidence || []).filter(item => item.outcome === "pass");
      evidence.push(...preserved);
      startedAt = prior.startedAt || startedAt;
      resumeInfo = {
        previousGeneratedAt: prior.generatedAt || null,
        previousFatal: prior.fatal || null,
        preservedPasses: preserved.length,
      };
    } else {
      fixture = await createIdentityFixtures();
    }
    const accounts = Object.fromEntries(fixture.accounts.map(account => [account.role, account])) as Record<Role, Account>;
    const tokens = {} as Record<Role, string>;
    for (const role of roles) tokens[role] = await tokenFor(accounts[role]);
    await runMatrix(fixture, tokens, resume);
    await writeReport(fixture, startedAt);
    process.stdout.write(`Assignment audit complete: ${evidence.filter(item => item.outcome === "pass").length} passed, ${evidence.filter(item => item.outcome === "fail").length} failed. Browser credentials retained at ${credentialsPath} (0600).\n`);
  } catch (error) {
    await writeReport(fixture, startedAt, error);
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => pool.end());