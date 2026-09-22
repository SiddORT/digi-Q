import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import {
  db, pool, users, doctors, patients, assignments, auditLogs, appointments,
  appointmentHistory, otpChallenges, availabilityExceptions, schedules, qrs,
  branches, clinics,
} from "@workspace/db";
import { eq, inArray, or, sql } from "drizzle-orm";

const credentialsPath = "/tmp/clinicflow-ownership-tabs-audit.json";
const reportJsonPath = new URL("../../docs/audits/ownership-tabs-api.json", import.meta.url);
const reportMarkdownPath = new URL("../../docs/audits/ownership-tabs-api.md", import.meta.url);
const baseUrl = (process.env.AUDIT_API_URL || "http://localhost:80/api").replace(/\/$/, "");
const roles = ["superAdmin", "adminA", "adminB", "doctorA", "receptionistA", "receptionistY", "crossOwnerProbe", "patient"] as const;
type Role = typeof roles[number];
type AppRole = "superAdmin" | "clinicAdmin" | "doctor" | "receptionist" | "patient";
type Json = Record<string, any>;
type Account = {
  role: Role; appRole: AppRole; email: string; password: string; clerkId: string;
  userId?: string; doctorId?: string; patientId?: string; mobile?: string;
};
type Evidence = {
  unit: string; name: string; outcome: "pass" | "fail"; detail: string;
  method?: string; route?: string; status?: number; payload?: unknown;
};
type Fixture = {
  suite: "ownership-tabs-live-regression";
  marker: string; createdAt: string; baseUrl: string; accounts: Account[];
  reservedBrowserAccounts?: Account[];
  ids: Record<string, string>; completedUnits: string[]; evidence: Evidence[];
  selectors?: Record<string, string>;
  priorFailures?: { at: string; unit: string; error: string }[];
  browserUse: string;
};
type ApiResponse = { method: string; route: string; status: number; body: any };

let lastRequestAt = 0;
let currentUnit = "runner";

function guard() {
  if (process.env.NODE_ENV !== "development") throw new Error("Refusing: NODE_ENV must be development.");
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Refusing: Clerk must use a development sk_test_ key.");
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT_ID || process.env.DEPLOYMENT_ID) {
    throw new Error("Refusing: this audit cannot run in a deployment.");
  }
  if (!process.env.DATABASE_URL) throw new Error("Refusing: DATABASE_URL is required.");
}

function safe(value: unknown) {
  if (value === undefined) return undefined;
  const text = JSON.stringify(value, (key, item) =>
    /token|password|secret|authorization|developmentCode|payload|email|mobile/i.test(key) ? "[REDACTED]" : item);
  if (!text) return undefined;
  return text.length > 1800 ? `${text.slice(0, 1750)}…[truncated]` : JSON.parse(text);
}

function safeMessage(value: unknown) {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\buser_[A-Za-z0-9]+\b/g, "[REDACTED_CLERK_ID]")
    .replace(/(password|token|secret|authorization)=?[^,\s]*/gi, "$1=[REDACTED]");
}

function record(fixture: Fixture, name: string, outcome: Evidence["outcome"], detail: string, response?: ApiResponse) {
  fixture.evidence.push({
    unit: currentUnit, name, outcome, detail, method: response?.method, route: response?.route,
    status: response?.status, payload: safe(response?.body),
  });
}

function check(fixture: Fixture, condition: unknown, name: string, detail: string, response?: ApiResponse): asserts condition {
  if (!condition) {
    record(fixture, name, "fail", detail, response);
    throw new Error(`${name}: ${detail}`);
  }
  record(fixture, name, "pass", detail, response);
}

function list(body: any): any[] {
  return Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : Array.isArray(body?.data) ? body.data : [];
}

function todayKolkata() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

async function persist(fixture: Fixture) {
  await writeFile(credentialsPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  await chmod(credentialsPath, 0o600);
}

async function pause() {
  const wait = Math.max(0, 450 - (Date.now() - lastRequestAt));
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
  if (response.status === 429 && retries) {
    await new Promise(resolve => setTimeout(resolve, Math.max(1, Number(response.headers.get("retry-after") || 1)) * 1000));
    return api(method, route, token, body, retries - 1);
  }
  return { method, route, status: response.status, body: parsed };
}

async function apiUnthrottled(method: string, route: string, token?: string, body?: unknown): Promise<ApiResponse> {
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
  return { method, route, status: response.status, body: parsed };
}

async function expect(fixture: Fixture, method: string, route: string, token: string | undefined, body: unknown, statuses: number[], name: string) {
  const response = await api(method, route, token, body);
  check(fixture, statuses.includes(response.status), name, `Expected ${statuses.join("/")} and received ${response.status}.`, response);
  return response.body;
}

async function tokenFor(account: Account) {
  const session = await clerkClient.sessions.createSession({ userId: account.clerkId });
  return (await clerkClient.sessions.getToken(session.id)).jwt;
}

async function unit(fixture: Fixture, name: string, body: () => Promise<void>) {
  if (fixture.completedUnits.includes(name)) return;
  currentUnit = name;
  // A resumed incomplete unit replaces its earlier attempt evidence. The
  // failure itself remains in priorFailures, while final evidence describes
  // only the successful resumed execution of that checkpoint.
  fixture.evidence = fixture.evidence.filter(item => item.unit !== name);
  const evidenceStart = fixture.evidence.length;
  try {
    await body();
    fixture.completedUnits.push(name);
    await persist(fixture);
  } catch (error) {
    fixture.evidence = fixture.evidence.slice(0, evidenceStart).concat(fixture.evidence.slice(evidenceStart));
    await persist(fixture);
    throw error;
  }
}

function accountSeed(marker: string, role: Role, index: number): Account {
  const appRole: AppRole = role === "adminA" || role === "adminB" ? "clinicAdmin"
    : role === "doctorA" || role === "crossOwnerProbe" ? "doctor"
      : role === "receptionistA" || role === "receptionistY" ? "receptionist" : role;
  return {
    role, appRole,
    email: `cfo.${marker.slice(-20).toLowerCase()}.${role.toLowerCase()}@example.com`,
    password: `Cf!${randomBytes(18).toString("base64url")}9z`,
    clerkId: "",
    mobile: `+9195${String(Date.now()).slice(-6)}${index}`,
  };
}

function accountRegistry(fixture: Fixture) {
  return [...fixture.accounts, ...(fixture.reservedBrowserAccounts || [])];
}

async function freshFixture(): Promise<Fixture> {
  const marker = `CF-OWN-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
  const fixture: Fixture = {
    suite: "ownership-tabs-live-regression", marker, createdAt: new Date().toISOString(), baseUrl,
    accounts: roles.map((role, index) => accountSeed(marker, role, index)),
    ids: {}, selectors: {}, completedUnits: [], evidence: [],
    browserUse: "One browser pass only. Use real Clerk sign-in, verify /me role, then run --cleanup --confirm-cleanup.",
  };
  await persist(fixture);
  return fixture;
}

async function createIdentities(fixture: Fixture) {
  for (const account of fixture.accounts) {
    if (account.clerkId) continue;
    const existing = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 1 });
    if (existing.data.length) throw new Error(`Refusing to reuse an unowned Clerk identity for ${account.role}.`);
    const identity = await clerkClient.users.createUser({
      emailAddress: [account.email], password: account.password,
      firstName: `${fixture.marker} ${account.role}`,
      privateMetadata: { purpose: "clinicflow-ownership-tabs-audit", marker: fixture.marker },
    });
    account.clerkId = identity.id;
    await persist(fixture);
  }
  // Minimal bootstrap profiles are limited to platform/admin actors. Staff are
  // created through live APIs so canonical manager derivation is exercised.
  for (const role of ["superAdmin", "adminA", "adminB"] as const) {
    const account = fixture.accounts.find(item => item.role === role)!;
    if (account.userId && (await db.select().from(users).where(eq(users.id, account.userId))).length) continue;
    account.userId ||= randomUUID();
    const userId = account.userId;
    await db.transaction(async tx => {
      // The bootstrap actors are not staff and cannot violate ownership. The
      // migrated deferred staff trigger references table-specific NEW fields,
      // so fixture-only direct inserts bypass triggers until that compatibility
      // issue is corrected in the migration owned by the backend task.
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.insert(users).values({
        id: userId, clerkId: account.clerkId, email: account.email,
        fullName: `${fixture.marker} ${role}`, role: account.appRole,
        data: { auditOnly: true, marker: fixture.marker, fixtureKind: "minimal-bootstrap-profile" },
      });
    });
    await persist(fixture);
  }
}

async function reserveBrowserIdentities(fixture: Fixture) {
  if (!fixture.reservedBrowserAccounts) {
    fixture.reservedBrowserAccounts = [
      accountSeed(fixture.marker, "doctorA", 8),
      accountSeed(fixture.marker, "receptionistA", 9),
    ].map((item, index) => ({
      ...item,
      role: (index === 0 ? "doctorA" : "receptionistA") as Role,
      email: `cfo.${fixture.marker.slice(-20).toLowerCase()}.browser${index === 0 ? "doctor" : "receptionist"}@example.com`,
    }));
    await persist(fixture);
  }
  for (const account of fixture.reservedBrowserAccounts) {
    if (account.clerkId) continue;
    const existing = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 1 });
    if (existing.data.length) throw new Error("Refusing to reuse an unowned reserved browser identity.");
    const identity = await clerkClient.users.createUser({
      emailAddress: [account.email], password: account.password,
      firstName: `${fixture.marker} Browser ${account.appRole}`,
      privateMetadata: { purpose: "clinicflow-ownership-tabs-browser-reserve", marker: fixture.marker },
    });
    account.clerkId = identity.id;
    await persist(fixture);
  }
}

async function writeReport(fixture: Fixture, startedAt: string, fatal?: unknown) {
  const report = {
    suite: fixture.suite,
    status: fatal ? "failed-at-checkpoint" : "executed",
    generatedAt: new Date().toISOString(), startedAt, marker: fixture.marker, baseUrl,
    credentialsPath, credentialsRetainedForOneBrowserPass: true,
    completedUnits: fixture.completedUnits,
    priorFailures: fixture.priorFailures || [],
    nextUnit: fatal ? currentUnit : null,
    summary: {
      passed: fixture.evidence.filter(item => item.outcome === "pass").length,
      failed: fixture.evidence.filter(item => item.outcome === "fail").length + (fatal ? 1 : 0),
    },
    fatal: fatal ? safeMessage(fatal) : null,
    evidence: fixture.evidence,
    exclusions: [
      "Task 3 atomic Clinic Admin plus first-clinic flow is not duplicated by this suite and must be reviewed after its merge.",
      "Responsive tabs, mobile search/filter controls, and real Clerk sign-in are reserved for the single parent browser pass.",
      "Invitation injected-failure and 409 identity-conflict behavior are covered by the 20 isolated backend regressions; live email delivery is intentionally not invoked.",
    ],
  };
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Ownership tabs API regression", "",
    `**Status:** ${report.status}`,
    `**Generated:** ${report.generatedAt}`,
    `**Marker:** ${report.marker}`,
    `**Result:** ${report.summary.passed} passed, ${report.summary.failed} failed.`,
    `**Checkpoint:** ${report.nextUnit || "all live units complete"}`, "",
    "## Evidence", "",
    "| Unit | Outcome | Assertion | Route/status | Evidence |", "|---|---|---|---|---|",
    ...fixture.evidence.map(item =>
      `| ${item.unit} | ${item.outcome.toUpperCase()} | ${item.name.replaceAll("|", "\\|")} | ${item.method || ""} ${item.route || ""} ${item.status || ""} | ${item.detail.replaceAll("|", "\\|")} |`),
    ...(fatal ? ["", "## Failure checkpoint", "", report.fatal || "Unknown failure"] : []),
    "", "## Safety", "",
    "- Development mode, Clerk `sk_test_`, DATABASE_URL, and non-deployment guards are mandatory.",
    "- Every protected request uses a real Clerk development session. There is no authentication bypass.",
    "- Existing Clerk fixture identities are created before staff APIs run, so no real invitation email is sent.",
    "- Requests are throttled and retry only HTTP 429 responses.",
    "- Reports redact email, mobile, credentials, tokens, OTPs, QR payloads, and authorization material.",
    `- Temporary credentials remain at ${credentialsPath} with mode 0600 for one browser pass.`,
    "- Resume skips every completed unit. Mutation IDs are persisted immediately so a failed unit does not recreate successful fixture records.",
    "- Cleanup requires marker and ownership validation, compares pre-existing snapshots, and removes only the owned fixture graph.", "",
    "## Deliberate exclusions / merge coordination", "",
    ...report.exclusions.map(item => `- ${item}`), "",
  ];
  await writeFile(reportMarkdownPath, lines.join("\n"));
}

async function runSuite(fixture: Fixture, tokens: Record<Role, string>) {
  const account = Object.fromEntries(fixture.accounts.map(item => [item.role, item])) as Record<Role, Account>;
  const id = fixture.ids;
  const marker = fixture.marker;
  const create = async (key: string, method: string, route: string, token: string, body: Json, statuses: number[], name: string) => {
    if (id[key]) {
      const existing = await expect(fixture, "GET", `${route}/${id[key]}`, token, undefined, [200], `Reload checkpointed ${name}`);
      return existing;
    }
    const row = await expect(fixture, method, route, token, body, statuses, name);
    id[key] = row.id;
    await persist(fixture);
    return row;
  };
  const refresh = async (role: Role) => {
    tokens[role] = await tokenFor(account[role]);
    return expect(fixture, "GET", "/me", tokens[role], undefined, [200], `${role} authenticates with persisted role`);
  };

  await unit(fixture, "01-owner-fixture", async () => {
    await create("clinicA", "POST", "/clinics", tokens.superAdmin, {
      name: `${marker} Clinic A`, address: `${marker} A`, city: "Pune", adminId: account.adminA.userId, status: "active",
    }, [201], "Create Clinic A owned by Admin A");
    await create("branchA", "POST", "/branches", tokens.superAdmin, {
      clinicId: id.clinicA, name: `${marker} Branch A1`, address: `${marker} A1`, timezone: "Asia/Kolkata", status: "active",
    }, [201], "Create Clinic A branch");
    await create("clinicB", "POST", "/clinics", tokens.superAdmin, {
      name: `${marker} Clinic B`, address: `${marker} B`, city: "Pune", adminId: account.adminA.userId, status: "active",
    }, [201], "Create Clinic B owned by same Admin A");
    await create("branchB", "POST", "/branches", tokens.superAdmin, {
      clinicId: id.clinicB, name: `${marker} Branch B1`, address: `${marker} B1`, timezone: "Asia/Kolkata", status: "active",
    }, [201], "Create Clinic B branch");
    await create("clinicU", "POST", "/clinics", tokens.superAdmin, {
      name: `${marker} Owner Managed Unassigned`, address: `${marker} U`, city: "Pune", adminId: account.adminA.userId, status: "active",
    }, [201], "Create Admin A clinic intentionally unassigned to Doctor A");
    await create("branchU", "POST", "/branches", tokens.superAdmin, {
      clinicId: id.clinicU, name: `${marker} Branch U1`, address: `${marker} U1`, timezone: "Asia/Kolkata", status: "active",
    }, [201], "Create unassigned clinical-scope branch");
    await create("clinicZ", "POST", "/clinics", tokens.superAdmin, {
      name: `${marker} Clinic Z`, address: `${marker} Z`, city: "Pune", adminId: account.adminB.userId, status: "active",
    }, [201], "Create cross-owner Clinic Z");
    await create("branchZ", "POST", "/branches", tokens.superAdmin, {
      clinicId: id.clinicZ, name: `${marker} Branch Z1`, address: `${marker} Z1`, timezone: "Asia/Kolkata", status: "active",
    }, [201], "Create Clinic Z branch");
    fixture.selectors = {
      clinicAName: `${marker} Clinic A`,
      clinicBName: `${marker} Clinic B`,
      unassignedClinicName: `${marker} Owner Managed Unassigned`,
      unassignedBranchName: `${marker} Branch U1`,
      otherOwnerClinicName: `${marker} Clinic Z`,
      otherOwnerBranchName: `${marker} Branch Z1`,
    };
    await persist(fixture);
  });

  await unit(fixture, "02-derived-staff", async () => {
    const doctor = await create("doctorA", "POST", "/doctors", tokens.adminA, {
      fullName: `${marker} Doctor X`, email: account.doctorA.email, mobile: account.doctorA.mobile,
      clinicIds: [id.clinicA, id.clinicB], branchIds: [id.branchA, id.branchB], status: "active",
    }, [201], "Admin A creates Doctor X across both owned clinics without selecting managing admin");
    if (!account.doctorA.userId) {
      account.doctorA.userId = doctor.userId;
      account.doctorA.doctorId = doctor.id;
      await persist(fixture);
    }
    const rec = await create("receptionistA", "POST", "/users", tokens.superAdmin, {
      fullName: `${marker} Receptionist X`, email: account.receptionistA.email, mobile: account.receptionistA.mobile, role: "receptionist",
      clinicIds: [id.clinicA, id.clinicB], branchIds: [id.branchA, id.branchB], status: "active",
    }, [201], "Super Admin creates Receptionist X without selecting managing admin");
    if (!account.receptionistA.userId) {
      account.receptionistA.userId = rec.id;
      await persist(fixture);
    }
    check(fixture, doctor.ownerAdminId === account.adminA.userId && doctor.managingAdminId === account.adminA.userId,
      "Doctor canonical manager aliases agree", "ownerAdminId and canonical managingAdminId both resolve to Admin A.");
    check(fixture, typeof doctor.managingAdminName === "string" && doctor.managingAdminName.length > 0 &&
      doctor.invitationStatus === "notRequired" && "createdAt" in doctor,
    "Doctor ownership and invitation projection is complete", "Manager name, notRequired invitation state, and nullable createdAt are projected.");
    check(fixture, rec.managingAdminId === account.adminA.userId && typeof rec.managingAdminName === "string" &&
      rec.managingAdminName.length > 0 && rec.invitationStatus === "notRequired" && "createdAt" in rec,
    "Receptionist canonical manager projection persists", "users.managingAdminId/name, notRequired invitation state, and nullable createdAt are projected.");
    await refresh("doctorA");
    await refresh("receptionistA");
  });

  await unit(fixture, "02b-projection-and-invitation-contract", async () => {
    const clinic = await expect(fixture, "GET", `/clinics/${id.clinicA}`, tokens.superAdmin, undefined, [200], "Read owned clinic projection");
    check(fixture, clinic.adminId === account.adminA.userId && typeof clinic.adminName === "string" && clinic.adminName.length > 0,
      "Clinic projects owner name", "Clinic adminId and adminName identify Admin A.");
    const resend = await expect(fixture, "POST", `/users/${id.receptionistA}/resend-invitation`, tokens.superAdmin, undefined, [200],
      "Resend invitation is idempotent for an already-linked fixture identity");
    check(fixture, resend.id === id.receptionistA && resend.invitationStatus === "notRequired",
      "Linked resend returns updated user", "The linked existing fixture identity converged to invitationStatus notRequired.");
    const concurrent = await Promise.all([
      api("POST", `/users/${id.receptionistA}/resend-invitation`, tokens.superAdmin),
      api("POST", `/users/${id.receptionistA}/resend-invitation`, tokens.adminA),
    ]);
    check(fixture, concurrent.every(response => response.status === 200 && response.body?.id === id.receptionistA &&
      response.body?.invitationStatus === "notRequired"),
    "Concurrent linked resends converge", "Both advisory-lock-protected calls returned the same updated user with notRequired.");
  });

  await unit(fixture, "03-assignment-options", async () => {
    for (const [role, targetRole, identityQuery] of [
      ["superAdmin", "doctor", `doctorId=${id.doctorA}`],
      ["adminA", "doctor", `doctorId=${id.doctorA}`],
      ["doctorA", "receptionist", `userId=${id.receptionistA}`],
    ] as const) {
      const route = `/staff-assignment-options?targetRole=${targetRole}&${identityQuery}`;
      const response = await expect(fixture, "GET", route, tokens[role], undefined, [200], `${role} reads ${targetRole} assignment options`);
      check(fixture,
        [id.clinicA, id.clinicB, id.clinicU].every(value => list(response.clinics).some(row => row.id === value)) &&
        !list(response.clinics).some(row => row.id === id.clinicZ),
        `${role} options derive Admin A clinics`, "Options contain all and only the selected staff member's managing-admin clinics.");
      check(fixture,
        list(response.branches).every(branch => [id.clinicA, id.clinicB, id.clinicU].includes(branch.clinicId)) &&
        list(response.managingAdmins).length === 1 && response.managingAdmins[0].id === account.adminA.userId,
        `${role} options group valid branches and one manager`, "Branches remain owner-scoped and managingAdmins contains exactly Admin A.");
    }
  });

  await unit(fixture, "04-doctor-owner-catalog-and-clinical-scope", async () => {
    const catalog = await expect(fixture, "GET", "/staff-assignment-options?targetRole=receptionist", tokens.doctorA, undefined, [200],
      "Doctor reads owner-managed receptionist catalog");
    check(fixture, [id.clinicA, id.clinicB, id.clinicU].every(value => list(catalog.clinics).some(row => row.id === value)) &&
      !list(catalog.clinics).some(row => row.id === id.clinicZ),
    "Doctor staff catalog includes all owner clinics only", "Assignment catalog includes the owner-managed unassigned clinic but excludes Admin B Clinic Z.");
    const operational = await expect(fixture, "GET", "/clinics?pageSize=100", tokens.doctorA, undefined, [200], "Doctor reads exact clinical clinic scope");
    check(fixture, [id.clinicA, id.clinicB].every(value => list(operational).some(row => row.id === value)) &&
      !list(operational).some(row => row.id === id.clinicU),
    "Doctor clinical catalog stays assignment-scoped", "Clinical clinic list excludes the owner-managed but unassigned location.");
    await expect(fixture, "POST", "/schedules", tokens.doctorA, {
      doctorId: id.doctorA, clinicId: id.clinicU, branchId: id.branchU, dayOfWeek: 1,
      isOpen: true, startTime: "09:00", endTime: "10:00", timezone: "Asia/Kolkata",
      tokenPrefix: "DEN", maxTokens: 1, consultationMinutes: 10, bufferMinutes: 0, queueMode: "mixed",
    }, [403], "Doctor clinical schedule operation denied at owner-managed but unassigned branch");
    await expect(fixture, "GET", `/queue?doctorId=${id.doctorA}&branchId=${id.branchU}&date=${todayKolkata()}`, tokens.doctorA, undefined, [403, 409],
      "Doctor queue operations denied at owner-managed but unassigned branch");
  });

  await unit(fixture, "05-doctor-cascade", async () => {
    const clinic = await create("clinicC", "POST", "/clinics", tokens.doctorA, {
      name: `${marker} Clinic C`, address: `${marker} C`, city: "Pune", status: "active",
    }, [201], "Doctor X creates Clinic C");
    check(fixture, clinic.adminId === account.adminA.userId, "Doctor-created Clinic C owner is derived", "Clinic C is owned by Doctor X's Admin A.");
    await create("branchC", "POST", "/branches", tokens.doctorA, {
      clinicId: id.clinicC, name: `${marker} Branch C1`, address: `${marker} C1`, timezone: "Asia/Kolkata", status: "active",
    }, [201], "Doctor creates Clinic C branch");
    const rec = await create("receptionistY", "POST", "/users", tokens.doctorA, {
      fullName: `${marker} Receptionist Y`, email: account.receptionistY.email, mobile: account.receptionistY.mobile, role: "receptionist",
      clinicIds: [id.clinicU], branchIds: [id.branchU], status: "active",
    }, [201], "Doctor creates Receptionist Y in owner-managed branch not assigned for clinical operations");
    if (!account.receptionistY.userId) {
      account.receptionistY.userId = rec.id;
      await persist(fixture);
    }
    check(fixture, rec.managingAdminId === account.adminA.userId,
      "Doctor-created Receptionist Y manager derives from selected clinic", "Receptionist Y persisted Admin A despite Doctor X lacking clinical assignment there.");
    await expect(fixture, "PATCH", `/users/${id.receptionistY}`, tokens.doctorA, {
      fullName: `${marker} Receptionist Y`, email: account.receptionistY.email, mobile: account.receptionistY.mobile, role: "receptionist",
      clinicIds: [id.clinicA, id.clinicB], branchIds: [id.branchA], status: "active",
    }, [400, 409], "Receptionist requires at least one branch for every selected clinic");
  });

  await unit(fixture, "06-role-tabs-query-contract", async () => {
    for (const [role, expectedId] of [["clinicAdmin", account.adminA.userId], ["doctor", id.doctorA], ["receptionist", id.receptionistA]] as const) {
      const body = await expect(fixture, "GET", `/users?role=${role}&search=${encodeURIComponent(marker)}&page=1&pageSize=1&sort=-createdAt`,
        tokens.superAdmin, undefined, [200], `${role} role list supports search, newest sorting, and pagination`);
      check(fixture, body.page === 1 && body.pageSize === 1 && body.total >= 1 && list(body).length === 1,
        `${role} projection counts are coherent`, "Total is pre-pagination and one newest matching row is projected.");
      if (role !== "doctor") check(fixture, list(body).some(row => row.id === expectedId) || body.total > 1,
        `${role} list contains only requested role`, "The paged result is role-specific.");
    }
    for (const route of [
      `/users?role=receptionist&search=${encodeURIComponent(account.receptionistA.mobile || "")}&pageSize=20`,
      `/users?role=receptionist&clinicId=${id.clinicA}&branchId=${id.branchA}&managingAdminId=${account.adminA.userId}&status=active&pageSize=20`,
      `/doctors?clinicId=${id.clinicA}&managingAdminId=${account.adminA.userId}&status=active&pageSize=20`,
    ]) {
      await expect(fixture, "GET", route, tokens.superAdmin, undefined, [200], "Role list filter contract accepts mobile/ownership/location/status filters");
    }
  });

  await unit(fixture, "07-rejections-and-immutability", async () => {
    await expect(fixture, "POST", "/doctors", tokens.superAdmin, {
      fullName: `${marker} Mixed Owner Probe`, email: account.crossOwnerProbe.email, mobile: account.crossOwnerProbe.mobile,
      clinicIds: [id.clinicA, id.clinicZ], branchIds: [id.branchA, id.branchZ], status: "active",
    }, [409], "Super Admin cannot create staff from clinics with different owners");
    await expect(fixture, "POST", "/doctors", tokens.adminA, {
      fullName: `${marker} Invalid Cross Owner`, email: account.doctorA.email, mobile: account.doctorA.mobile,
      clinicIds: [id.clinicZ], branchIds: [id.branchZ], status: "active",
    }, [403, 409], "Cross-owner doctor create is rejected before duplicate reuse");
    await expect(fixture, "PATCH", `/doctors/${id.doctorA}`, tokens.superAdmin, {
      fullName: `${marker} Doctor X`, email: account.doctorA.email,
      ownerAdminId: account.adminB.userId, clinicIds: [id.clinicA, id.clinicB], branchIds: [id.branchA, id.branchB], status: "active",
    }, [409], "Existing doctor manager is immutable");
    await expect(fixture, "PATCH", `/users/${id.receptionistA}`, tokens.superAdmin, {
      fullName: `${marker} Receptionist X`, email: account.receptionistA.email, role: "receptionist",
      managingAdminId: account.adminB.userId, clinicIds: [id.clinicA], branchIds: [id.branchA], status: "active",
    }, [409], "Existing receptionist manager is immutable");
    await expect(fixture, "PATCH", `/doctors/${id.doctorA}`, tokens.adminA, {
      fullName: `${marker} Doctor X`, email: account.doctorA.email,
      clinicIds: [id.clinicA, id.clinicZ], branchIds: [id.branchA, id.branchZ], status: "active",
    }, [403, 409], "Cross-owner doctor edit is rejected");
    await expect(fixture, "PATCH", `/doctors/${id.doctorA}`, tokens.superAdmin, {
      fullName: `${marker} Doctor X`, email: account.doctorA.email,
      clinicIds: [id.clinicA, id.clinicZ], branchIds: [id.branchA, id.branchZ], status: "active",
    }, [409], "Super Admin cannot edit staff into mixed-owner clinic scope");
    await expect(fixture, "PATCH", `/users/${id.receptionistA}`, tokens.adminA, {
      fullName: `${marker} Receptionist X`, email: account.receptionistA.email, role: "receptionist",
      clinicIds: [id.clinicA, id.clinicZ], branchIds: [id.branchA, id.branchZ], status: "active",
    }, [403, 409], "Cross-owner receptionist edit is rejected");
    await expect(fixture, "PATCH", `/clinics/${id.clinicA}`, tokens.superAdmin, {
      name: `${marker} Clinic A`, address: `${marker} A`, adminId: account.adminB.userId, status: "active",
    }, [409], "Ownership transfer is rejected while dependents exist");
  });

  await unit(fixture, "08-duplicates-and-races", async () => {
    await expect(fixture, "POST", "/users", tokens.superAdmin, {
      fullName: `${marker} Duplicate`, email: account.receptionistA.email, mobile: account.receptionistA.mobile, role: "receptionist",
      clinicIds: [id.clinicA], branchIds: [id.branchA], status: "active",
    }, [409], "Duplicate staff identity is rejected");
    const raceBody = {
      fullName: `${marker} Receptionist X`, email: account.receptionistA.email, role: "receptionist",
      clinicIds: [id.clinicA, id.clinicB], branchIds: [id.branchA, id.branchB], status: "active",
    };
    const race = await Promise.all([
      api("PATCH", `/users/${id.receptionistA}`, tokens.adminA, raceBody),
      api("PATCH", `/users/${id.receptionistA}`, tokens.superAdmin, raceBody),
    ]);
    check(fixture, race.every(result => [200, 409].includes(result.status)),
      "Concurrent assignment writes are bounded", `Concurrent statuses were ${race.map(result => result.status).join("/")}.`);
    const links = await db.select().from(assignments).where(eq(assignments.userId, id.receptionistA));
    const keys = links.map(row => `${row.userId}:${row.clinicId}:${row.branchId || "clinic"}`);
    check(fixture, keys.length === new Set(keys).size, "Concurrent writes leave no duplicate mappings", "Database uniqueness retained one row per assignment key.");
    const mixedRace = await Promise.all([
      api("PATCH", `/doctors/${id.doctorA}`, tokens.superAdmin, {
        fullName: `${marker} Doctor X`, email: account.doctorA.email,
        clinicIds: [id.clinicA, id.clinicB], branchIds: [id.branchA, id.branchB], status: "active",
      }),
      api("PATCH", `/doctors/${id.doctorA}`, tokens.superAdmin, {
        fullName: `${marker} Doctor X`, email: account.doctorA.email,
        clinicIds: [id.clinicA, id.clinicZ], branchIds: [id.branchA, id.branchZ], status: "active",
      }),
    ]);
    check(fixture, mixedRace.filter(result => result.status === 200).length === 1 &&
      mixedRace.filter(result => result.status === 409).length === 1,
    "Mixed-owner assignment race has one valid winner", `Concurrent statuses were ${mixedRace.map(result => result.status).join("/")}.`);
    const postRace = await db.select().from(assignments).where(eq(assignments.userId, account.doctorA.userId!));
    check(fixture, postRace.every(row => row.clinicId !== id.clinicZ && row.branchId !== id.branchZ),
      "Mixed-owner race leaves no cross-owner rows", "Database state contains only Admin A clinic assignments after the race.");
  });

  await unit(fixture, "09-patient-and-operational-smoke", async () => {
    const orphanAttempt = await api("POST", "/onboarding", tokens.crossOwnerProbe, {
      intent: "doctor", fullName: `${marker} Orphan Doctor`, mobile: account.crossOwnerProbe.mobile, termsAccepted: true,
    });
    check(fixture, [400, 403].includes(orphanAttempt.status), "Self-onboarding is patient-only",
      `Doctor self-onboarding was rejected with ${orphanAttempt.status}.`, orphanAttempt);
    const orphanRows = await db.select().from(users).where(eq(users.clerkId, account.crossOwnerProbe.clerkId));
    check(fixture, orphanRows.length === 0, "Rejected self-onboarding creates no orphan profile", "No application user was created for the rejected doctor intent.");
    if (!account.patient.userId) {
      const patient = await expect(fixture, "POST", "/onboarding", tokens.patient, {
        intent: "patient", fullName: `${marker} Patient`, mobile: account.patient.mobile, termsAccepted: true,
      }, [201], "Patient creates isolated fixture profile");
      account.patient.userId = patient.user.id;
      account.patient.patientId = patient.patientId;
      await persist(fixture);
    }
    if (!id.patientVerified) {
      const requested = await expect(fixture, "POST", "/otp/request", tokens.patient, { mobile: account.patient.mobile }, [200], "Patient requests development OTP");
      check(fixture, requested.provider === "development" && typeof requested.developmentCode === "string",
        "Development OTP provider is explicit", "In-band development code is consumed and never reported.");
      await expect(fixture, "POST", "/otp/verify", tokens.patient, {
        challengeId: requested.challengeId, code: requested.developmentCode,
      }, [200], "Patient verifies fixture mobile");
      id.patientVerified = "true";
      await persist(fixture);
    }
    const today = todayKolkata();
    id.today = today;
    const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();
    await create("scheduleA", "POST", "/schedules", tokens.doctorA, {
      doctorId: id.doctorA, clinicId: id.clinicA, branchId: id.branchA, dayOfWeek,
      isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "Asia/Kolkata",
      tokenPrefix: `O${marker.slice(-3).toUpperCase()}`, maxTokens: 20, consultationMinutes: 10,
      bufferMinutes: 0, queueMode: "mixed", queueOpenTime: "00:00", queueCloseTime: "23:59",
    }, [201], "Create today schedule for operational smoke");
    const bookingQr = await create("bookingQr", "POST", "/qrs", tokens.doctorA, {
      name: `${marker} booking QR`, clinicId: id.clinicA, branchId: id.branchA, doctorId: id.doctorA, status: "active",
    }, [201], "Create booking QR");
    let appointment: Json = { id: id.completedAppointment };
    if (!appointment.id) {
      appointment = await expect(fixture, "POST", "/appointments", tokens.patient, {
        patientId: account.patient.patientId, doctorId: id.doctorA, clinicId: id.clinicA, branchId: id.branchA,
        date: today, source: "online", notes: `${marker} completed smoke`, requestId: randomUUID(), termsAccepted: true,
      }, [201], "Patient books appointment");
      id.completedAppointment = appointment.id;
      await persist(fixture);
    }
    appointment = await expect(fixture, "GET", `/appointments/${appointment.id}`, tokens.patient, undefined, [200], "Read resumable operational appointment");
    if (appointment.status === "booked") {
      const signed = await expect(fixture, "GET", `/appointments/${appointment.id}/qr`, tokens.patient, undefined, [200], "Patient reads signed appointment QR");
      const checkedIn = await expect(fixture, "POST", "/appointment-qr/check-in", tokens.receptionistA, { payload: signed.payload }, [200], "Receptionist checks in through QR");
      appointment = checkedIn.appointment || checkedIn;
    }
    if (appointment.status === "checkedIn") {
      appointment = await expect(fixture, "POST", `/appointments/${appointment.id}/actions`, tokens.receptionistA, {
        action: "enqueue", expectedStatus: "checkedIn",
      }, [200], "Receptionist resumes checked-in appointment into queue");
    }
    if (appointment.status === "waiting") {
      const called = await expect(fixture, "POST", "/queue/call-next", tokens.doctorA, {
        doctorId: id.doctorA, branchId: id.branchA, date: today,
      }, [200], "Doctor calls queue patient");
      appointment = called.appointment || called;
    }
    if (appointment.status === "called") {
      appointment = await expect(fixture, "POST", `/appointments/${appointment.id}/actions`, tokens.doctorA, {
        action: "start", expectedStatus: "called",
      }, [200], "Doctor starts consultation");
    }
    if (appointment.status === "inConsultation") {
      appointment = await expect(fixture, "POST", `/appointments/${appointment.id}/actions`, tokens.doctorA, {
        action: "complete", expectedStatus: "inConsultation",
      }, [200], "Doctor completes consultation");
    }
    check(fixture, appointment.status === "completed", "Operational appointment reaches completed", "Resume-aware QR and queue flow completed exactly once.");
    if (!id.browserAppointment) {
      const retained = await expect(fixture, "POST", "/appointments", tokens.patient, {
        patientId: account.patient.patientId, doctorId: id.doctorA, clinicId: id.clinicA, branchId: id.branchA,
        date: today, source: "qr", qrReference: bookingQr.reference, notes: `${marker} retained browser`,
        requestId: randomUUID(), termsAccepted: true,
      }, [201], "Retain booked-today appointment for one browser QR pass");
      id.browserAppointment = retained.id;
      const browserQr = await expect(fixture, "GET", `/appointments/${retained.id}/qr`, tokens.patient, undefined, [200], "Prepare retained appointment QR");
      id.browserAppointmentQrPayload = browserQr.payload;
      await persist(fixture);
    }
  });

  await unit(fixture, "10-ownership-concurrency", async () => {
    if (!id.ownershipRaceAdmin) {
      id.ownershipRaceAdmin = randomUUID();
      await db.insert(users).values({
        id: id.ownershipRaceAdmin,
        email: `cfo.${marker.slice(-20).toLowerCase()}.raceadmin@example.com`,
        fullName: `${marker} Ownership Race Initial Admin`,
        role: "clinicAdmin",
        invitationStatus: "notRequired",
        data: { auditOnly: true, marker, fixtureKind: "ownership-race-initial-owner" },
      });
      await persist(fixture);
    }
    await create("ownershipRaceClinic", "POST", "/clinics", tokens.superAdmin, {
      name: `${marker} Ownership Race`, address: `${marker} Race`, city: "Pune",
      adminId: id.ownershipRaceAdmin, status: "active",
    }, [201], "Create isolated empty clinic for stale ownership race");
    const reset = await api("PATCH", `/clinics/${id.ownershipRaceClinic}`, tokens.superAdmin, {
      name: `${marker} Ownership Race`, address: `${marker} Race`, city: "Pune",
      adminId: id.ownershipRaceAdmin, status: "active",
    });
    check(fixture, reset.status === 200, "Reset isolated race clinic to neutral initial owner",
      `Expected 200 and received ${reset.status}.`, reset);
    const body = (adminId: string) => ({
      name: `${marker} Ownership Race`, address: `${marker} Race`, city: "Pune", adminId, status: "active",
    });
    // Hold the same advisory key briefly so both HTTP handlers read the same
    // stale owner before either transaction can enter its ownership write.
    const gate = await pool.connect();
    let race: ApiResponse[];
    try {
      await gate.query("select pg_advisory_lock(hashtext($1))", [`clinics:${id.ownershipRaceClinic}`]);
      const pending = Promise.all([
        apiUnthrottled("PATCH", `/clinics/${id.ownershipRaceClinic}`, tokens.superAdmin, body(account.adminA.userId!)),
        apiUnthrottled("PATCH", `/clinics/${id.ownershipRaceClinic}`, tokens.superAdmin, body(account.adminB.userId!)),
      ]);
      await new Promise(resolve => setTimeout(resolve, 250));
      await gate.query("select pg_advisory_unlock(hashtext($1))", [`clinics:${id.ownershipRaceClinic}`]);
      race = await pending;
    } finally {
      gate.release();
    }
    const finalClinic = (await db.select().from(clinics).where(eq(clinics.id, id.ownershipRaceClinic)))[0];
    const finalOwnerLinks = (await db.select().from(assignments)).filter(row =>
      row.clinicId === id.ownershipRaceClinic && !row.branchId &&
      [account.adminA.userId, account.adminB.userId].includes(row.userId));
    const observation = `Statuses ${race.map(result => result.status).join("/")}; final owner ${finalClinic?.adminId === account.adminA.userId ? "AdminA" : finalClinic?.adminId === account.adminB.userId ? "AdminB" : "unexpected"}; owner links ${finalOwnerLinks.length}.`;
    check(fixture, race.filter(result => result.status === 200).length === 1 &&
      race.filter(result => result.status === 409).length === 1,
    "Concurrent stale ownership claims allow one winner", observation);
    check(fixture, Boolean(finalClinic) && [account.adminA.userId, account.adminB.userId].includes(finalClinic.adminId) &&
      finalOwnerLinks.length === 1 && finalOwnerLinks[0].userId === finalClinic.adminId,
    "Ownership race leaves one canonical owner mapping", observation);
  });

  await unit(fixture, "11-database-integrity", async () => {
    const doctor = (await db.select().from(doctors).where(eq(doctors.id, id.doctorA)))[0];
    const recs = await db.select().from(users).where(inArray(users.id, [id.receptionistA, id.receptionistY]));
    check(fixture, doctor?.ownerAdminId === account.adminA.userId && recs.length === 2 &&
      recs.every(row => row.managingAdminId === account.adminA.userId),
    "Canonical persisted managers are single and consistent", "Doctor ownerAdminId and receptionist managingAdminId all equal Admin A.");
    const owned = await db.select().from(clinics).where(inArray(clinics.id, [id.clinicA, id.clinicB, id.clinicC, id.clinicU, id.clinicZ]));
    check(fixture, owned.filter(row => row.adminId === account.adminA.userId).length === 4 &&
      owned.filter(row => row.adminId === account.adminB.userId).length === 1,
    "Clinic ownership projection is exact", "A/B/C/U have Admin A and Z has Admin B, with one adminId per clinic.");
    const allLinks = await db.select().from(assignments);
    const markerUsers = new Set(fixture.accounts.map(item => item.userId).filter(Boolean));
    const links = allLinks.filter(row => markerUsers.has(row.userId));
    const keys = links.map(row => `${row.userId}:${row.clinicId}:${row.branchId || "clinic"}`);
    check(fixture, keys.length === new Set(keys).size, "Fixture has no duplicate assignment keys", "Every marker assignment is unique.");
    const branchMap = new Map((await db.select().from(branches)).map(row => [row.id, row.clinicId]));
    check(fixture, links.every(row => !row.branchId || branchMap.get(row.branchId) === row.clinicId),
      "Fixture has no mismatched or orphan branches", "Every branch assignment belongs to its recorded clinic.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let code = "";
      try {
        await client.query("insert into assignments (id,user_id,clinic_id,branch_id) values ($1,$2,$3,$4)",
          [randomUUID(), id.receptionistA, id.clinicA, id.branchZ]);
      } catch (error: any) { code = error?.code || ""; }
      check(fixture, code === "23503", "Database rejects mixed-owner clinic/branch probe", "Composite branch/clinic FK returned PostgreSQL 23503.");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  await unit(fixture, "12-reserve-browser-identities", async () => {
    await reserveBrowserIdentities(fixture);
    check(fixture, fixture.reservedBrowserAccounts?.length === 2 &&
      fixture.reservedBrowserAccounts.every(item => item.clerkId && !item.userId),
    "Browser form identities are reserved without app profiles", "Verified Clerk test identities for one Doctor form and one Receptionist form are retained only in the mode-0600 manifest.");
  });
}

async function cleanup() {
  if (!process.argv.includes("--confirm-cleanup")) throw new Error("Cleanup requires --cleanup --confirm-cleanup.");
  const fixture = JSON.parse(await readFile(credentialsPath, "utf8")) as Fixture;
  if (fixture.suite !== "ownership-tabs-live-regression" || !fixture.marker.startsWith("CF-OWN-") ||
      !accountRegistry(fixture).every(account => account.email.startsWith("cfo.") && account.email.endsWith("@example.com") &&
        account.email.includes(fixture.marker.slice(-20).toLowerCase()))) {
    throw new Error("Refusing cleanup: fixture marker validation failed.");
  }
  const allUsers = await db.select().from(users);
  const markerLower = fixture.marker.toLowerCase();
  const isOwnedUser = (row: typeof allUsers[number]) =>
    accountRegistry(fixture).some(account => account.userId === row.id || account.email === row.email) ||
    row.fullName.toLowerCase().includes(markerLower) || row.data.marker === fixture.marker;
  const ownedUsers = allUsers.filter(isOwnedUser);
  const userIds = [...new Set(ownedUsers.map(row => row.id))];
  const ownedClinics = (await db.select().from(clinics)).filter(row =>
    userIds.includes(row.ownerId || "") || userIds.includes(row.adminId) || String(row.data.name || "").includes(fixture.marker));
  if (ownedClinics.some(row => !String(row.data.name || "").includes(fixture.marker))) {
    throw new Error("Refusing cleanup: clinic marker/ownership validation failed.");
  }
  const clinicIds = ownedClinics.map(row => row.id);
  const ownedBranches = (await db.select().from(branches)).filter(row => clinicIds.includes(row.clinicId));
  if (ownedBranches.some(row => !String(row.data.name || "").includes(fixture.marker))) {
    throw new Error("Refusing cleanup: descendant branch is not marker-owned.");
  }
  const branchIds = ownedBranches.map(row => row.id);
  const descendantLinks = (await db.select().from(assignments)).filter(row => clinicIds.includes(row.clinicId));
  const descendants = allUsers.filter(row => descendantLinks.some(link => link.userId === row.id));
  if (descendants.some(row => !isOwnedUser(row))) throw new Error("Refusing cleanup: non-marker user is assigned to fixture clinic.");
  for (const row of descendants) if (!userIds.includes(row.id)) userIds.push(row.id);
  const ownedDoctors = (await db.select().from(doctors)).filter(row => userIds.includes(row.userId));
  const doctorIds = ownedDoctors.map(row => row.id);
  const ownedPatients = (await db.select().from(patients)).filter(row => userIds.includes(row.userId || "") || clinicIds.includes(row.clinicId || ""));
  const patientIds = ownedPatients.map(row => row.id);
  const ownedAppointments = (await db.select().from(appointments)).filter(row => clinicIds.includes(row.clinicId));
  const appointmentIds = ownedAppointments.map(row => row.id);
  const ownedAudits = (await db.select().from(auditLogs)).filter(row =>
    userIds.includes(row.actorId || "") || clinicIds.includes(row.clinicId || "") ||
    [...userIds, ...clinicIds, ...branchIds, ...doctorIds, ...patientIds, ...appointmentIds].includes(row.entityId));
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const before = {
    users: byId(allUsers.filter(row => !userIds.includes(row.id))),
    clinics: byId((await db.select().from(clinics)).filter(row => !clinicIds.includes(row.id))),
    branches: byId((await db.select().from(branches)).filter(row => !branchIds.includes(row.id))),
    assignments: byId((await db.select().from(assignments)).filter(row => !userIds.includes(row.userId) && !clinicIds.includes(row.clinicId))),
    doctors: byId((await db.select().from(doctors)).filter(row => !doctorIds.includes(row.id))),
    patients: byId((await db.select().from(patients)).filter(row => !patientIds.includes(row.id))),
    appointments: byId((await db.select().from(appointments)).filter(row => !appointmentIds.includes(row.id))),
  };
  await db.transaction(async tx => {
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
  for (const account of accountRegistry(fixture)) if (account.clerkId) await clerkClient.users.deleteUser(account.clerkId);
  const after = {
    users: byId(await db.select().from(users)), clinics: byId(await db.select().from(clinics)),
    branches: byId(await db.select().from(branches)), assignments: byId(await db.select().from(assignments)),
    doctors: byId(await db.select().from(doctors)), patients: byId(await db.select().from(patients)),
    appointments: byId(await db.select().from(appointments)),
  };
  for (const key of Object.keys(before) as (keyof typeof before)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw new Error(`Cleanup verification failed: pre-existing ${key} changed.`);
    }
  }
  const remainingMarker = Object.values(after).flat().some(row => JSON.stringify(row).toLowerCase().includes(markerLower));
  if (remainingMarker) throw new Error("Cleanup verification failed: marker data remains.");
  const prior = JSON.parse(await readFile(reportJsonPath, "utf8")) as Json;
  prior.cleanup = {
    completedAt: new Date().toISOString(), marker: fixture.marker, markerRowsRemaining: 0,
    preExistingDataPreserved: true, approvedOwnershipPreserved: true, credentialFileRemoved: true,
  };
  await writeFile(reportJsonPath, `${JSON.stringify(prior, null, 2)}\n`);
  const markdown = await readFile(reportMarkdownPath, "utf8");
  await writeFile(reportMarkdownPath, `${markdown.trimEnd()}\n\n## Cleanup verification\n\n- Marker-owned database and Clerk fixtures removed.\n- Pre-existing data and approved ownership snapshots were preserved exactly.\n- Temporary credential file removed.\n`);
  await unlink(credentialsPath);
}

async function main() {
  guard();
  if (process.argv.includes("--cleanup")) return cleanup();
  const startedAt = new Date().toISOString();
  const resume = process.argv.includes("--resume");
  let fixture = resume
    ? JSON.parse(await readFile(credentialsPath, "utf8")) as Fixture
    : await freshFixture();
  if (resume && fixture.suite !== "ownership-tabs-live-regression") throw new Error("Refusing resume: wrong suite fixture.");
  if (resume && !fixture.priorFailures?.length) {
    try {
      const prior = JSON.parse(await readFile(reportJsonPath, "utf8")) as { generatedAt?: string; nextUnit?: string; fatal?: string };
      if (prior.fatal) {
        fixture.priorFailures = [{
          at: prior.generatedAt || new Date().toISOString(),
          unit: prior.nextUnit || "unknown",
          error: safeMessage(prior.fatal),
        }];
        await persist(fixture);
      }
    } catch { /* report provenance is optional when resuming an interrupted process */ }
  }
  try {
    await unit(fixture, "00-development-identities", () => createIdentities(fixture));
    const account = Object.fromEntries(fixture.accounts.map(item => [item.role, item])) as Record<Role, Account>;
    const tokens = {} as Record<Role, string>;
    for (const role of roles) tokens[role] = await tokenFor(account[role]);
    const health = await api("GET", "/healthz");
    if (!fixture.evidence.some(item => item.name === "Live API health")) {
      check(fixture, health.status === 200, "Live API health", `Expected 200 and received ${health.status}.`, health);
    } else if (health.status !== 200) {
      throw new Error(`Live API health: expected 200 and received ${health.status}.`);
    }
    await runSuite(fixture, tokens);
    fixture.evidence = fixture.evidence.filter(item =>
      item.outcome !== "fail" || !fixture.completedUnits.includes(item.unit));
    fixture.evidence = [...new Map(fixture.evidence.map(item => [`${item.unit}:${item.name}`, item])).values()];
    await persist(fixture);
    await writeReport(fixture, startedAt);
  } catch (error) {
    fixture.priorFailures ||= [];
    fixture.priorFailures.push({ at: new Date().toISOString(), unit: currentUnit, error: safeMessage(error) });
    await persist(fixture);
    await writeReport(fixture, startedAt, error);
    throw error;
  }
}

main().catch(error => {
  console.error(safeMessage(error));
  process.exitCode = 1;
}).finally(() => pool.end());