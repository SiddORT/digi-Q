import { chmod, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { db, pool, users, clinics, branches, assignments } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

const manifestPath = "/tmp/clinicflow-manual-invitation-audit.json";
const reportJsonPath = new URL("../../docs/audits/manual-invitation-audit.json", import.meta.url);
const reportMarkdownPath = new URL("../../docs/audits/manual-invitation-audit.md", import.meta.url);
const baseUrl = (process.env.AUDIT_API_URL || "http://localhost:80/api").replace(/\/$/, "");
const clinicName = "Sunshine Multispeciality Clinic";
const branchName = "Sunshine Multispeciality Clinic – Baner Branch";

type Json = Record<string, any>;
type Evidence = {
  name: string;
  outcome: "pass" | "fail";
  classification: "read-only" | "live-provider" | "live-api";
  detail: string;
  status?: number;
};
type Manifest = {
  suite: "manual-real-invitation-audit";
  marker: string;
  createdAt: string;
  phase: "checked" | "invited";
  inbox: string;
  inboxHash: string;
  clinicId: string;
  branchId: string;
  managingAdminId: string;
  actor: { userId?: string; clerkId?: string; sessionId?: string; email: string; password: string };
  target: { userId?: string; invitationId?: string };
  baseline: Record<string, unknown[]>;
  evidence: Evidence[];
  invitation?: {
    mechanism: string;
    notify: true;
    redirectPath: "/set-password";
    configuredExpiryDays: number;
    providerStatus: "pending";
  };
};

function guard() {
  if (process.env.NODE_ENV !== "development") throw new Error("Refusing: NODE_ENV must be development.");
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Refusing: Clerk must use a development key.");
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT_ID || process.env.DEPLOYMENT_ID) {
    throw new Error("Refusing: this audit cannot run in a deployment.");
  }
  if (!process.env.DATABASE_URL) throw new Error("Refusing: DATABASE_URL is required.");
}

function inboxFromEnvironment() {
  const inbox = process.env.MANUAL_INVITATION_EMAIL?.trim().toLowerCase();
  if (!inbox || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inbox)) {
    throw new Error("MANUAL_INVITATION_EMAIL must contain the explicitly approved inbox.");
  }
  return inbox;
}

function hashInbox(inbox: string) {
  return createHash("sha256").update(inbox).digest("hex");
}

async function persist(manifest: Manifest) {
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await chmod(manifestPath, 0o600);
}

function evidence(
  manifest: Manifest, name: string, classification: Evidence["classification"],
  detail: string, status?: number,
) {
  manifest.evidence.push({ name, outcome: "pass", classification, detail, status });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Json).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

async function databaseSnapshot() {
  const tableRows = await pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  const snapshot: Record<string, unknown[]> = {};
  for (const { table_name: table } of tableRows.rows) {
    const rows = (await pool.query(`select * from "${table.replaceAll('"', '""')}"`)).rows
      .map(stable)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    snapshot[table] = rows;
  }
  return snapshot;
}

async function exactScope() {
  const clinicRows = (await db.select().from(clinics))
    .filter(row => (row.data as Json).name === clinicName);
  assert(clinicRows.length === 1, "Refusing: clinic name is not a unique exact match.");
  const clinic = clinicRows[0];
  assert(clinic.status === "active", "Refusing: exact clinic is not active.");
  const branchRows = (await db.select().from(branches).where(eq(branches.clinicId, clinic.id)))
    .filter(row => (row.data as Json).name === branchName);
  assert(branchRows.length === 1, "Refusing: branch name is not a unique exact match in the exact clinic.");
  const branch = branchRows[0];
  assert(branch.status === "active", "Refusing: exact branch is not active.");
  const [manager] = await db.select().from(users).where(eq(users.id, clinic.adminId));
  assert(manager?.role === "clinicAdmin" && manager.status === "active",
    "Refusing: exact clinic does not have one valid active Clinic Admin owner.");
  return { clinic, branch, manager };
}

async function assertInboxUnused(inbox: string) {
  const appMatches = await db.select().from(users).where(sql`lower(${users.email}) = ${inbox}`);
  assert(appMatches.length === 0, "STOP: approved inbox already exists in app users.");
  const identities = await clerkClient.users.getUserList({ emailAddress: [inbox], limit: 10 });
  assert(identities.data.length === 0, "STOP: approved inbox already exists as a Clerk identity.");
  const pending = await clerkClient.invitations.getInvitationList({ query: inbox, status: "pending", limit: 100 });
  assert(!pending.data.some(item => item.emailAddress.toLowerCase() === inbox),
    "STOP: approved inbox already has a pending Clerk invitation.");
}

async function api(
  method: string, route: string, token: string, body: unknown, origin: string,
) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin,
      "x-forwarded-host": new URL(origin).host,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }
  return { status: response.status, body: parsed };
}

async function writeReport(manifest: Manifest, fatal?: unknown) {
  const report = {
    suite: manifest.suite,
    status: fatal ? "failed-at-checkpoint" : manifest.phase === "invited" ? "pending-manual-acceptance" : "ready-to-invite",
    generatedAt: new Date().toISOString(),
    marker: manifest.marker,
    summary: {
      passed: manifest.evidence.filter(item => item.outcome === "pass").length,
      failed: fatal ? 1 : 0,
    },
    expectedAssignment: {
      role: "receptionist",
      clinic: clinicName,
      branch: branchName,
      onlyExactNamedScope: true,
    },
    evidence: manifest.evidence,
    invitation: manifest.invitation || null,
    providerClaim: manifest.phase === "invited"
      ? "Clerk accepted one notify:true invitation and reports it pending. Inbox receipt is not yet claimed."
      : "No invitation has been sent.",
    browserStatus: "No browser automation was performed. CAPTCHA, password setup, login, and used-link behavior await the user.",
    privacy: "The approved inbox, credentials, provider IDs, and invitation URL are retained only in the mode-0600 private manifest.",
    cleanupPlan: [
      "After the user completes receipt, CAPTCHA, password setup, login, and used-link checks, discover the target only by exact private-manifest email and Clerk linkage.",
      "Revoke only a still-pending owned invitation; Clerk may retain revoked/used invitation history.",
      "Remove only the temporary target assignments, target user and linked owned Clerk identity, temporary actor proof/session/user/identity, and audit rows created by their owned IDs.",
      "Require the normalized database snapshot to exactly equal the private pre-write baseline and independently verify zero marker rows before removing the manifest.",
    ],
    fatal: fatal instanceof Error ? fatal.message.replace(/[^@\s]+@[^@\s]+/g, "[REDACTED_INBOX]") : null,
  };
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Manual real invitation audit", "",
    `**Status:** ${report.status}`,
    `**Generated:** ${report.generatedAt}`,
    `**Result:** ${report.summary.passed} passed, ${report.summary.failed} failed.`, "",
    "## Expected assignment", "",
    `- Role: Receptionist`,
    `- Clinic: ${clinicName}`,
    `- Branch: ${branchName}`,
    "- Scope: only the exact clinic and branch above.", "",
    "## Evidence", "",
    "| Outcome | Classification | Assertion | Evidence |",
    "|---|---|---|---|",
    ...manifest.evidence.map(item =>
      `| PASS | ${item.classification} | ${item.name} | ${item.detail}${item.status ? ` Status ${item.status}.` : ""} |`),
    ...(fatal ? ["", "## Failure checkpoint", "", report.fatal || "Sanitized failure."] : []),
    "", "## Provider and browser status", "",
    `- ${report.providerClaim}`,
    `- ${report.browserStatus}`,
    `- ${report.privacy}`, "",
    "## Cleanup plan", "",
    ...report.cleanupPlan.map(item => `- ${item}`),
    "",
  ];
  await writeFile(reportMarkdownPath, lines.join("\n"));
}

async function check() {
  const inbox = inboxFromEnvironment();
  try {
    await readFile(manifestPath, "utf8");
    throw new Error("Refusing: private manual invitation manifest already exists.");
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
  const { clinic, branch, manager } = await exactScope();
  await assertInboxUnused(inbox);
  const marker = `CF-MANUAL-INVITE-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(4).toString("hex")}`;
  const suffix = marker.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-18);
  const manifest: Manifest = {
    suite: "manual-real-invitation-audit",
    marker,
    createdAt: new Date().toISOString(),
    phase: "checked",
    inbox,
    inboxHash: hashInbox(inbox),
    clinicId: clinic.id,
    branchId: branch.id,
    managingAdminId: manager.id,
    actor: {
      email: `clinicflow.manual.${suffix}.actor+clerk_test@example.com`,
      password: `Cf!${randomBytes(24).toString("base64url")}9z`,
    },
    target: {},
    baseline: await databaseSnapshot(),
    evidence: [],
  };
  evidence(manifest, "Exact clinic uniquely matched and active", "read-only",
    "Exactly one active clinic matched the approved name.");
  evidence(manifest, "Exact branch uniquely matched and active", "read-only",
    "Exactly one active branch matched inside the exact clinic.");
  evidence(manifest, "Existing Clinic Admin ownership is valid", "read-only",
    "The exact clinic has one active Clinic Admin owner; no owner or mapping was changed.");
  evidence(manifest, "Approved inbox absent from app users", "read-only",
    "No app user matched the private approved inbox.");
  evidence(manifest, "Approved inbox absent from Clerk identities", "read-only",
    "No Clerk identity matched the private approved inbox.");
  evidence(manifest, "Approved inbox has no pending invitation", "read-only",
    "No pending Clerk invitation matched the private approved inbox.");
  await persist(manifest);
  await writeReport(manifest);
}

async function createInvitation() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  assert(manifest.suite === "manual-real-invitation-audit" && manifest.phase === "checked",
    "Refusing: creation requires a completed read-only check.");
  const inbox = inboxFromEnvironment();
  assert(hashInbox(inbox) === manifest.inboxHash && inbox === manifest.inbox,
    "Refusing: approved inbox does not match the checked private manifest.");
  const { clinic, branch, manager } = await exactScope();
  assert(clinic.id === manifest.clinicId && branch.id === manifest.branchId &&
    manager.id === manifest.managingAdminId, "Refusing: approved scope changed after the read-only check.");
  await assertInboxUnused(inbox);
  evidence(manifest, "Pre-write scope and inbox guard revalidated", "read-only",
    "Immediately before writes, exact scope remained active/unique and the approved inbox remained unused.");

  const actorIdentity = await clerkClient.users.createUser({
    emailAddress: [manifest.actor.email],
    password: manifest.actor.password,
    firstName: `${manifest.marker} Invitation Actor`,
    privateMetadata: { purpose: "clinicflow-manual-invitation-audit", marker: manifest.marker },
  });
  manifest.actor.clerkId = actorIdentity.id;
  manifest.actor.userId = randomUUID();
  await db.insert(users).values({
    id: manifest.actor.userId,
    clerkId: actorIdentity.id,
    email: manifest.actor.email,
    fullName: `${manifest.marker} Invitation Actor`,
    role: "superAdmin",
    invitationStatus: "notRequired",
    data: { auditOnly: true, marker: manifest.marker },
  });
  const actorSession = await clerkClient.sessions.createSession({ userId: actorIdentity.id });
  manifest.actor.sessionId = actorSession.id;
  await persist(manifest);
  const actorToken = (await clerkClient.sessions.getToken(actorSession.id)).jwt;
  const verified = await api("POST", "/auth/staff-verify", actorToken,
    { password: manifest.actor.password }, new URL(baseUrl).origin);
  assert(verified.status === 200, "Temporary actor could not establish guarded staff proof.");
  evidence(manifest, "Temporary isolated actor established guarded proof", "live-api",
    "A synthetic Super Admin bootstrap was used only to authorize the existing creation path; no real account session or mapping was touched.",
    verified.status);

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  assert(devDomain, "REPLIT_DEV_DOMAIN is required for the DEVELOPMENT set-password redirect.");
  const devOrigin = `https://${devDomain}`;
  const created = await api("POST", "/users", actorToken, {
    fullName: `${manifest.marker} Manual Receptionist`,
    email: manifest.inbox,
    role: "receptionist",
    clinicIds: [manifest.clinicId],
    branchIds: [manifest.branchId],
    status: "active",
  }, devOrigin);
  assert(created.status === 201 && created.body?.id, "Existing app creation path did not create the temporary Receptionist.");
  const targetUserId = String(created.body.id);
  manifest.target.userId = targetUserId;
  await persist(manifest);
  assert(created.body.role === "receptionist" && created.body.invitationStatus === "sent",
    "Temporary app profile was created but provider send was not accepted; no retry is permitted.");
  assert(created.body.clinicIds?.length === 1 && created.body.clinicIds[0] === manifest.clinicId &&
    created.body.branchIds?.length === 1 && created.body.branchIds[0] === manifest.branchId,
  "Temporary Receptionist response does not have only the exact approved scope.");
  evidence(manifest, "Existing app creation/invitation path accepted temporary Receptionist", "live-api",
    "POST /users returned 201 with role Receptionist, invitationStatus sent, and only the exact approved clinic and branch.",
    created.status);

  const targetAssignments = await db.select().from(assignments)
    .where(eq(assignments.userId, targetUserId));
  assert(targetAssignments.length === 2 &&
    targetAssignments.every(row => row.clinicId === manifest.clinicId) &&
    targetAssignments.filter(row => row.branchId).length === 1 &&
    targetAssignments.some(row => row.branchId === manifest.branchId),
  "Persisted temporary assignments are not exactly one clinic membership and one approved branch assignment.");
  evidence(manifest, "Persisted assignment scope is exact", "read-only",
    "Only the approved clinic membership and approved branch assignment exist for the temporary Receptionist.");

  const identities = await clerkClient.users.getUserList({ emailAddress: [manifest.inbox], limit: 10 });
  assert(identities.data.length === 0, "Approved inbox unexpectedly became a Clerk identity before invitation acceptance.");
  const pending = await clerkClient.invitations.getInvitationList({
    query: manifest.inbox, status: "pending", limit: 100,
  });
  const exactPending = pending.data.filter(item => item.emailAddress.toLowerCase() === manifest.inbox);
  assert(exactPending.length === 1, "Provider does not report exactly one pending invitation; no retry is permitted.");
  manifest.target.invitationId = exactPending[0].id;
  const configuredExpiryDays = Math.min(30, Math.max(1,
    Number.parseInt(process.env.CLERK_INVITATION_EXPIRES_IN_DAYS || "7", 10) || 7));
  manifest.invitation = {
    mechanism: "Existing POST /users → deliverInvitation → Clerk createInvitation",
    notify: true,
    redirectPath: "/set-password",
    configuredExpiryDays,
    providerStatus: "pending",
  };
  manifest.phase = "invited";
  evidence(manifest, "Clerk accepted exactly one real invitation", "live-provider",
    "The supported helper used notify:true, app role/clinic metadata, bounded configured expiry, and the current DEVELOPMENT /set-password redirect.");
  evidence(manifest, "Provider reports invitation pending", "live-provider",
    "Exactly one provider invitation is pending. This proves accepted send state only; inbox delivery is not claimed.");
  await persist(manifest);
  await writeReport(manifest);
}

async function main() {
  guard();
  if (process.argv.includes("--check")) return check();
  if (process.argv.includes("--create")) return createInvitation();
  throw new Error("Choose --check or --create.");
}

main().catch(async error => {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
    await writeReport(manifest, error);
  } catch { /* No report exists before the private check manifest is created. */ }
  console.error(error instanceof Error
    ? error.message.replace(/[^@\s]+@[^@\s]+/g, "[REDACTED_INBOX]")
    : "Sanitized manual invitation failure.");
  process.exitCode = 1;
}).finally(() => pool.end());