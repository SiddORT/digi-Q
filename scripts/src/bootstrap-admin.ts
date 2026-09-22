import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { db, pool, users, auditLogs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
const args = process.argv.slice(2);
const value = (name: string) => args[args.indexOf(name) + 1];
async function main() {
  if (!args.includes("--clerk-id") && !args.includes("--email")) throw new Error("Usage: pnpm --filter @workspace/scripts bootstrap-admin --clerk-id user_... OR --email verified@example.com");
  const identity = args.includes("--clerk-id") ? await clerkClient.users.getUser(value("--clerk-id")) : (await clerkClient.users.getUserList({ emailAddress: [value("--email")] })).data[0];
  if (!identity) throw new Error("Clerk identity not found; sign up and verify email first.");
  const email = identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId && e.verification?.status === "verified");
  if (!email) throw new Error("A verified primary Clerk email is required.");
  if (args.includes("--email") && email.emailAddress.toLowerCase() !== value("--email").toLowerCase()) throw new Error("Requested email must be the verified primary email.");
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('bootstrap-admin'))`);
    const existing = await tx.select().from(users);
    if (existing.some(u => u.role === "superAdmin" && u.status === "active")) throw new Error("An active super administrator already exists. Use authorized administration instead.");
    const old = existing.find(u => u.clerkId === identity.id || u.email === email.emailAddress.toLowerCase());
    if (old && old.role !== "superAdmin") throw new Error("Existing non-admin profile cannot be silently promoted. Use a dedicated verified Clerk identity.");
    const id = old?.id || randomUUID();
    if (old) await tx.update(users).set({ clerkId: identity.id, status: "active" }).where(eq(users.id, id));
    else await tx.insert(users).values({ id, clerkId: identity.id, fullName: [identity.firstName, identity.lastName].filter(Boolean).join(" ") || email.emailAddress, email: email.emailAddress.toLowerCase(), role: "superAdmin", status: "active" });
    await tx.insert(auditLogs).values({ id: randomUUID(), actorId: id, action: "bootstrap", entityType: "users", entityId: id, summary: "Controlled CLI bootstrap of verified administrator" });
  });
  process.stdout.write("Verified administrator bootstrapped. Sign in with the same Clerk account.\n");
}
main().catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; }).finally(() => pool.end());