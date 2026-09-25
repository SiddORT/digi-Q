import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clerkClient } from "@clerk/express";
import { db, pool, users, auditLogs } from "@workspace/db";

// Explicit DEV-only operator utility. Never invoked by application startup.
// Only creates a fresh identity; does not update passwords or insert auth proofs.
async function main() {
  if (process.env.NODE_ENV !== "development" ||
      !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") ||
      process.env.REPLIT_DEPLOYMENT === "1") {
    throw new Error("Development and a Clerk test instance are required.");
  }
  const mode = process.argv[2] ?? "clinicAdmin";
  if (!["clinicAdmin", "superAdmin", "unmappedOwner"].includes(mode)) {
    throw new Error("Fixture mode must be clinicAdmin, superAdmin, or unmappedOwner.");
  }
  const id = randomUUID();
  const email = `clinicflow.staff.${id}+clerk_test@example.com`;
  const password = `Cf!${randomBytes(24).toString("base64url")}9a`;
  const role = mode === "unmappedOwner" ? null : mode;
  const fullName = "Isolated Staff Fixture";
  const directory = await mkdtemp(join(tmpdir(), "clinicflow-staff-fixture-"));
  await chmod(directory, 0o700);
  const path = join(directory, "credentials.json");
  let clerkId: string | undefined;
  try {
    const identity = await clerkClient.users.createUser({
      emailAddress: [email], emailAddressIdentificationStatus: ["verified"],
      password, firstName: "Isolated", lastName: "Staff Fixture",
      privateMetadata: { purpose: "isolated-development-staff-test", fixtureId: id },
    });
    clerkId = identity.id;
    if (!identity.passwordEnabled ||
        !identity.emailAddresses.some(address =>
          address.emailAddress === email && address.verification?.status === "verified")) {
      throw new Error("Provider fixture does not meet password and email requirements.");
    }
    // Provider verification is real, but is NOT application session proof.
    await clerkClient.users.verifyPassword({ userId: clerkId, password });
    await writeFile(path, JSON.stringify({
      email, password, clerkId, userId: role ? id : null, role, fixtureId: id,
      firstName: "Isolated", lastName: "Staff Fixture",
    }), { mode: 0o600, flag: "wx" });
    if (role) await db.transaction(async tx => {
      await tx.insert(users).values({
        id, clerkId, email, fullName, role, invitationStatus: "notRequired",
        data: { previewOnly: true, fixturePurpose: "isolated-development-staff-test" },
      });
      await tx.insert(auditLogs).values({
        id: randomUUID(), actorId: id, entityType: "users", entityId: id,
        action: "previewProvision", summary: "Isolated development staff fixture created",
      });
    });
  } catch {
    if (clerkId) {
      try { await clerkClient.users.deleteUser(clerkId); }
      catch { console.error(`Provider cleanup required for isolated fixture ${clerkId}`); }
    }
    await rm(directory, { recursive: true, force: true });
    // Provider errors may contain submitted values; never serialize them.
    throw new Error("Isolated fixture provisioning failed; credentials were not logged.");
  }
  console.log(JSON.stringify({ credentialFile: path, providerPasswordVerified: true }));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());