import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clerkClient } from "@clerk/express";
import { db, pool, users, schedules, qrs } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createOwnedClinic, withinBranchHours } from "./lib/clinic-expansion";
import { put, audit, uid } from "./lib/store";
import { validateTimes } from "./lib/availability";

// One-time development-only operator fixture. Not used by app startup.
async function main() {
  if (process.env.NODE_ENV !== "development" ||
      !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") ||
      process.env.REPLIT_DEPLOYMENT === "1") {
    throw new Error("A development database and Clerk test instance are required.");
  }
  const suffix = randomBytes(5).toString("hex");
  const id = randomUUID();
  const email = `clinicflow.demo.${suffix}+clerk_test@example.com`;
  const password = `Cf!${randomBytes(24).toString("base64url")}9a`;
  const slug = `demo-care-${suffix}`;
  const branchSlug = "main-location";
  const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek, startTime: "08:00", endTime: "23:50",
  }));
  const directory = await mkdtemp(join(tmpdir(), "clinicflow-demo-clinic-"));
  await chmod(directory, 0o700);
  const credentialFile = join(directory, "credentials.json");
  let clerkId: string | undefined;
  let committed = false;
  try {
    const identity = await clerkClient.users.createUser({
      emailAddress: [email], emailAddressIdentificationStatus: ["verified"],
      password, firstName: "Demo", lastName: "Doctor",
      privateMetadata: { purpose: "development-demo-clinic", fixtureId: id },
    });
    clerkId = identity.id;
    if (!identity.passwordEnabled ||
        !identity.emailAddresses.some(address =>
          address.emailAddress === email && address.verification?.status === "verified")) {
      throw new Error("Test identity was not provisioned with verified email and password.");
    }
    await clerkClient.users.verifyPassword({ userId: clerkId, password });
    await writeFile(credentialFile, JSON.stringify({
      email, password, clerkId, userId: id, role: "clinicAdmin",
      purpose: "development-demo-clinic",
      note: "This synthetic address cannot receive email OTP; no browser sign-in is guaranteed.",
    }), { mode: 0o600, flag: "wx" });
    const result = await db.transaction(async tx => {
      const actor = await put(users, {
        id, clerkId, email, fullName: "Dr. Demo Doctor",
        role: "clinicAdmin", invitationStatus: "notRequired",
        data: { previewOnly: true, fixturePurpose: "development-demo-clinic" },
      }, tx);
      const setup = await createOwnedClinic(actor, actor, {
        clinic: { name: `DEMO Care Clinic ${suffix}`, slug, address: "Demo location (fictional; not a real clinic)", specialityIds: [] },
        branches: [{
          name: "DEMO Main Location", slug: branchSlug,
          address: "Demo location (fictional; not for visits)", city: "Demo City",
          timezone: "Asia/Kolkata", openingHours: hours,
        }],
        ownDoctor: true,
      }, tx);
      if (!setup.doctorId || setup.branches.length !== 1) throw new Error("Demo clinical setup incomplete.");
      const branch = setup.branches[0];
      for (const dayOfWeek of hours.map(h => h.dayOfWeek)) {
        const session = {
          doctorId: setup.doctorId, clinicId: setup.clinic.id, branchId: branch.id,
          dayOfWeek, isOpen: true, startTime: "08:00", endTime: "23:50",
          timezone: "Asia/Kolkata", tokenPrefix: "D", maxTokens: 31,
          consultationMinutes: 20, bufferMinutes: 0, queueMode: "mixed",
        };
        validateTimes(session);
        withinBranchHours(branch, session);
        const saved = await put(schedules, { id: uid(), clinicId: session.clinicId, branchId: session.branchId, doctorId: session.doctorId, dayOfWeek, data: session }, tx);
        await audit(actor, "create", "schedules", saved, tx);
      }
      const [qr] = await tx.select().from(qrs).where(eq(qrs.branchId, branch.id));
      if (!qr?.publicReference) throw new Error("No booking QR was created.");
      await audit(actor, "previewProvision", "users", actor, tx);
      return {
        clinicId: setup.clinic.id, clinicName: setup.clinic.name, clinicSlug: slug,
        branchId: branch.id, branchName: branch.name, branchSlug,
        doctorId: setup.doctorId, doctorName: actor.fullName,
        qrReference: qr.publicReference, bookingPath: `/book/${qr.publicReference}`,
        clinicPath: `/${slug}/${branchSlug}`,
        schedule: "Every day 08:00–23:50 Asia/Kolkata (31 tokens/day)",
      };
    });
    committed = true;
    console.log(JSON.stringify({ ...result, credentialFile, environment: "development" }));
  } catch {
    if (!committed) {
      if (clerkId) {
        try { await clerkClient.users.deleteUser(clerkId); }
        catch { console.error(`Provider cleanup required for failed demo fixture ${clerkId}`); }
      }
      await rm(directory, { recursive: true, force: true });
    }
    throw new Error("Demo clinic provisioning failed; sensitive details were not logged.");
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());