import { randomBytes, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { db, pool, users, doctors, patients, auditLogs } from "@workspace/db";
import { inArray } from "drizzle-orm";

// Explicit operator-only provisioning, never run during startup or deployment.
async function main() {
  if (process.env.NODE_ENV !== "development" || !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") || process.env.REPLIT_DEPLOYMENT === "1") {
    throw new Error("Preview account provisioning requires development and a Clerk test instance.");
  }
  const accounts = [
    ["superAdmin", "superadmin", "Preview Super Admin"],
    ["clinicAdmin", "clinicadmin", "Preview Clinic Admin"],
    ["doctor", "doctor", "Preview Doctor"],
    ["receptionist", "receptionist", "Preview Receptionist"],
    ["patient", "patient", "Preview Patient"],
  ].map(([role, alias, fullName]) => ({
    id: randomUUID(), role, fullName,
    email: `clinicflow.${alias}+clerk_test@example.com`,
    password: `Cf!${randomBytes(15).toString("base64url")}9a`,
    clerkId: "",
  }));
  const previewClinicAdmin = accounts.find(account => account.role === "clinicAdmin")!;
  const existing = await db.select({ id: users.id }).from(users).where(inArray(users.email, accounts.map(a => a.email)));
  if (existing.length) throw new Error("Preview profiles already exist; no existing accounts were modified.");
  for (const a of accounts) {
    const found = await clerkClient.users.getUserList({ emailAddress: [a.email], limit: 1 });
    if (found.data.length) throw new Error("Preview identities already exist; no existing passwords were modified.");
  }
  try {
    for (const a of accounts) {
      const identity = await clerkClient.users.createUser({
        emailAddress: [a.email], password: a.password, firstName: a.fullName,
        privateMetadata: { purpose: "clinicflow-preview-only" },
      });
      a.clerkId = identity.id;
    }
    await db.transaction(async tx => {
      for (const a of accounts) {
        await tx.insert(users).values({
          id: a.id, clerkId: a.clerkId, email: a.email, fullName: a.fullName,
          role: a.role, data: { previewOnly: true },
          ...(a.role === "receptionist" ? { managingAdminId: previewClinicAdmin.id } : {}),
        });
        if (a.role === "doctor") await tx.insert(doctors).values({
          id: randomUUID(), userId: a.id, ownerAdminId: previewClinicAdmin.id,
          data: { fullName: a.fullName, email: a.email, code: `DOC-${a.id.slice(0, 8)}`, clinicIds: [], branchIds: [] },
        });
        if (a.role === "patient") await tx.insert(patients).values({
          id: randomUUID(), userId: a.id, mobile: "", mobileVerified: false,
          data: { fullName: a.fullName, email: a.email, code: `PAT-${a.id.slice(0, 8)}` },
        });
        await tx.insert(auditLogs).values({
          id: randomUUID(), actorId: a.id, entityType: "users", entityId: a.id,
          action: "previewProvision", summary: "Operator-created development-only test account",
        });
      }
    });
  } catch (error) {
    for (const a of accounts.filter(a => a.clerkId)) {
      try { await clerkClient.users.deleteUser(a.clerkId); }
      catch { console.error(`Cleanup required for preview identity ${a.clerkId}`); }
    }
    throw error;
  }
  // Newly generated test credentials are shown once; never stored in project files.
  console.log(JSON.stringify(accounts.map(({ role, email, password }) => ({ role, email, password })), null, 2));
}

main().catch(error => {
  console.error(error?.errors?.map((e: { code: string; message: string }) => ({ code: e.code, message: e.message })) ?? error.message);
  process.exitCode = 1;
}).finally(() => pool.end());