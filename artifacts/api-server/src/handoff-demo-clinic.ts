import { readFile, rm } from "node:fs/promises";
import { clerkClient } from "@clerk/express";
import { db, pool, users, clinics, doctors, branches, staffSessionProofs } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { audit } from "./lib/store";
import { deliverInvitation } from "./routes/resources";

// Explicit one-time operator tool for the isolated development demo fixture.
// From the scripts directory (which provides tsx):
// NODE_ENV=development pnpm exec tsx ../artifacts/api-server/src/handoff-demo-clinic.ts --check <email> <credentials-file>
// NODE_ENV=development pnpm exec tsx ../artifacts/api-server/src/handoff-demo-clinic.ts --send  <email> <credentials-file>
async function main() {
  if (process.env.NODE_ENV !== "development" ||
      !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") ||
      process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Only the development Clerk tenant and database are allowed.");
  const [mode, rawEmail, credentialPath] = process.argv.slice(2);
  if (!["--check", "--send"].includes(mode) || !rawEmail || !credentialPath) throw new Error("Expected --check or --send, target email and isolated fixture credentials path.");
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid target email.");
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN || ""}`;
  if (!/^https:\/\/[a-z0-9.-]+\.replit\.dev$/i.test(origin)) throw new Error("An actual HTTPS Preview origin is required.");
  const redirectUrl = `${origin}/set-password`;

  // Read the fixture identity solely to validate it; never print this file.
  const fixture = JSON.parse(await readFile(credentialPath, "utf8")) as {
    userId: string; clerkId: string; email: string; purpose: string;
  };
  if (fixture.purpose !== "development-demo-clinic" || !fixture.userId || !fixture.clerkId ||
      !fixture.email.endsWith("+clerk_test@example.com")) throw new Error("Not the isolated development fixture.");
  const [account] = await db.select().from(users).where(eq(users.id, fixture.userId));
  if (!account || account.role !== "clinicAdmin" || account.status !== "active" ||
      account.data.fixturePurpose !== "development-demo-clinic" || account.data.previewOnly !== true ||
      account.clerkId !== fixture.clerkId || account.email !== fixture.email) {
    throw new Error("Fixture state changed; refusing to transfer access.");
  }
  const [clinic] = await db.select().from(clinics).where(and(
    eq(clinics.id, "218f400a-fd17-404b-92aa-731e0fafff1c"),
    eq(clinics.adminId, account.id),
  ));
  const [doctor] = await db.select().from(doctors).where(and(
    eq(doctors.userId, account.id), eq(doctors.ownerAdminId, account.id),
  ));
  const associated = clinic ? await db.select().from(branches).where(eq(branches.clinicId, clinic.id)) : [];
  if (!clinic || clinic.data.slug !== "demo-care-8c157094de" || clinic.status !== "active" ||
      !doctor || doctor.status !== "active" || associated.length !== 1 ||
      associated[0].data.slug !== "main-location") throw new Error("Demo clinic ownership or location changed.");

  const [localCollision] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (localCollision) throw new Error("The target email already has an application account; no records were changed.");
  const providerUsers = await clerkClient.users.getUserList({ emailAddress: [email], limit: 100 });
  if (providerUsers.data.some(user => user.emailAddresses.some(addr => addr.emailAddress.toLowerCase() === email))) {
    throw new Error("The target email already has a Clerk identity; no records were changed.");
  }
  const pending = await clerkClient.invitations.getInvitationList({ query: email, status: "pending", limit: 100 });
  if (pending.data.some(invitation => invitation.emailAddress.toLowerCase() === email)) {
    throw new Error("The target email already has a pending invitation; no records were changed.");
  }
  const synthetic = await clerkClient.users.getUser(fixture.clerkId);
  if (synthetic.privateMetadata.purpose !== "development-demo-clinic" ||
      synthetic.privateMetadata.fixtureId !== fixture.userId ||
      !synthetic.emailAddresses.some(addr => addr.emailAddress.toLowerCase() === fixture.email)) {
    throw new Error("Synthetic identity is not the expected isolated fixture.");
  }
  if (mode === "--check") {
    console.log(JSON.stringify({ ready: true, environment: "development", clinicSlug: clinic.data.slug, sameAccountDoctor: true }));
    return;
  }
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"user-email:" + email}))`);
    const [locked] = await tx.select().from(users).where(eq(users.id, fixture.userId)).for("update");
    const [collision] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (!locked || locked.clerkId !== fixture.clerkId || locked.email !== fixture.email || collision) {
      throw new Error("Concurrent identity change detected; no records were changed.");
    }
    await tx.delete(staffSessionProofs).where(eq(staffSessionProofs.clerkUserId, fixture.clerkId));
    await tx.update(users).set({ email, clerkId: null, invitationStatus: "failed" }).where(eq(users.id, fixture.userId));
    await audit(account, "demoInvitationHandoff", "users", account, tx);
  });
  // Clerk deletion invalidates the old fixture's sessions; the app link and all
  // staff proof rows are already gone even if the remote deletion fails.
  await clerkClient.users.deleteUser(fixture.clerkId);
  await rm(credentialPath);
  // The existing application invitation routine supplies roles, clinic/branch
  // metadata and notify:true; never display its ticket or invitation URL.
  await deliverInvitation(fixture.userId, redirectUrl);
  const [updated] = await db.select({ status: users.invitationStatus, clerkId: users.clerkId }).from(users).where(eq(users.id, fixture.userId));
  if (updated?.status !== "sent" || updated?.clerkId) throw new Error("Invitation dispatch was not confirmed by the provider; profile is unlinked and can be resent by an authorized admin.");
  const invitations = await clerkClient.invitations.getInvitationList({ query: email, status: "pending", limit: 100 });
  if (!invitations.data.some(invitation => invitation.emailAddress.toLowerCase() === email)) {
    throw new Error("Provider did not report a pending invitation; check the account before retrying.");
  }
  console.log(JSON.stringify({ invitationCreated: true, invitationStatus: "sent", environment: "development", clinicSlug: clinic.data.slug, passwordSetRoute: "/set-password", sameAccountDoctor: true }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Demo handoff failed.");
  process.exitCode = 1;
}).finally(() => pool.end());