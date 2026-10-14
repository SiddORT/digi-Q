import { randomUUID } from "node:crypto";
import { db, users, doctors, clinics, settings, assignments } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { assert } from "./http";
import { one } from "./store";
import { assertLiveRemovalActor, lockStaffCredentials } from "./staff-removal-auth";
import { computeStaffDeletionImpact } from "./staff-deletion-impact";
import { accountSubjectFingerprint } from "./notification-history-provenance";
import { issueRemovalReview, removalProposalDigest, verifyRemovalReview } from "./staff-removal-review";

type Context = { actorId: string; sessionHash: string; targetId: string };
async function inspect(tx: any, context: Context, replacementId: string) {
  const target = await one(users, context.targetId, tx), replacement = await one(users, replacementId, tx);
  assert(target.role === "clinicAdmin" && replacement.role === "clinicAdmin" && replacement.status === "active" &&
    replacementId !== target.id && !target.demo && !target.demoFixture && !replacement.demo && !replacement.demoFixture,
    409, "Choose another active, non-demo Clinic Admin");
  const owned = await tx.select().from(clinics).where(eq(clinics.adminId, target.id));
  const staff = await tx.select().from(users).where(eq(users.managingAdminId, target.id));
  const profiles = await tx.select().from(doctors).where(eq(doctors.ownerAdminId, target.id));
  const managed = profiles.filter((d: any) => d.userId !== target.id && d.status !== "retired");
  const self = profiles.filter((d: any) => d.userId === target.id && d.status !== "retired");
  assert(self.every((d: any) => d.status === "inactive" && !(d.data.branchIds ?? []).length),
    409, "Resolve consulting care and deactivate or retire the self-owned profile before administration handoff");
  const impact = await computeStaffDeletionImpact(tx, context.actorId, target.id);
  assert(!impact.blockers.some(b => ["OPEN_VISITS", "PENDING_REQUESTS", "DISPATCH_IN_PROGRESS"].includes(b.code)),
    409, "Resolve the administrator's own clinical work and in-flight dispatch before responsibility handoff");
  const destinationClinics = await tx.select({ id: clinics.id }).from(clinics).where(eq(clinics.adminId, replacementId));
  const allowed = new Set([...owned, ...destinationClinics].map(c => c.id));
  const dependentIds = [...new Set([...staff.map((u: any) => u.id), ...managed.map((d: any) => d.userId)])].filter(Boolean) as string[];
  const links = dependentIds.length ? await tx.select().from(assignments).where(inArray(assignments.userId, dependentIds)) : [];
  assert(links.every((a: any) => allowed.has(a.clinicId)), 409, "Replacement cannot own every existing dependent assignment");
  assert(owned.length + staff.length + managed.length > 0, 409, "No administrative responsibilities remain to transfer");
  return { impact, dependentIds, proposal: {
    kind: "clinic-responsibilities", replacementId,
    clinicIds: owned.map((c: any) => c.id).sort(), staffIds: staff.map((u: any) => u.id).sort(),
    doctorIds: managed.map((d: any) => d.id).sort(),
    destinationVersion: (await computeStaffDeletionImpact(tx, context.actorId, replacementId)).version,
  } };
}
/** All clinics and dependent staff, including inactive/unassigned staff. Scope,
 * native account identities, status, clinical bytes and provider IDs stay intact.
 * This internal service is intentionally not mounted until the shared flow and
 * database-backed receipt/late-writer acceptance checks are complete. */
export async function reviewStaffResponsibilityHandoff(context: Context, replacementId: string, conn: any = db) {
  return conn.transaction(async (tx: any) => {
    await tx.execute(sql`set transaction isolation level repeatable read`);
    await assertLiveRemovalActor(tx, context.actorId, context.sessionHash);
    const reviewed = await inspect(tx, context, replacementId), operationId = randomUUID();
    return { operationId, proposal: reviewed.proposal,
      reviewToken: issueRemovalReview({ mode: "handoff", actorId: context.actorId, targetId: context.targetId,
        sessionHash: context.sessionHash, version: reviewed.impact.version, proposal: reviewed.proposal, operationId }) };
  });
}
export async function commitStaffResponsibilityHandoff(context: Context, proposal: {
  kind: string; replacementId: string; clinicIds: string[]; staffIds: string[]; doctorIds: string[]; destinationVersion: string;
}, token: string, conn: any = db) {
  const review = verifyRemovalReview(token, { mode: "handoff", actorId: context.actorId, targetId: context.targetId,
    sessionHash: context.sessionHash, proposal });
  return conn.transaction(async (tx: any) => {
    const initial = await tx.select().from(doctors).where(eq(doctors.ownerAdminId, context.targetId));
    await lockStaffCredentials(tx, [context.actorId, context.targetId, proposal.replacementId, ...proposal.staffIds,
      ...initial.map((d: any) => d.userId).filter(Boolean)]);
    await assertLiveRemovalActor(tx, context.actorId, context.sessionHash);
    const receiptId = "staff-handoff:" + review.operationId;
    const [receipt] = await tx.select().from(settings).where(eq(settings.id, receiptId));
    if (receipt) {
      assert(receipt.data.proposalHash === removalProposalDigest(proposal) &&
        receipt.data.sourceFingerprint === accountSubjectFingerprint(context.targetId), 409, "Handoff receipt mismatch");
      return receipt.data.result;
    }
    await tx.select().from(users).where(eq(users.id, context.targetId)).for("update");
    for (const id of [...proposal.clinicIds].sort())
      await tx.select().from(clinics).where(eq(clinics.id, id)).for("update");
    const current = await inspect(tx, context, proposal.replacementId);
    verifyRemovalReview(token, { mode: "handoff", actorId: context.actorId, targetId: context.targetId,
      sessionHash: context.sessionHash, proposal });
    assert(current.impact.version === review.version && removalProposalDigest(current.proposal) === removalProposalDigest(proposal),
      409, "Administrative responsibility changed; review again");
    // Deferred ownership guards validate the entire final graph at commit.
    for (const id of proposal.doctorIds) await tx.update(doctors).set({ ownerAdminId: proposal.replacementId }).where(eq(doctors.id, id));
    for (const id of proposal.staffIds) await tx.update(users).set({ managingAdminId: proposal.replacementId }).where(eq(users.id, id));
    for (const id of proposal.clinicIds) await tx.update(clinics).set({ adminId: proposal.replacementId }).where(eq(clinics.id, id));
    const result = { operationId: review.operationId, clinicCount: proposal.clinicIds.length,
      staffCount: proposal.staffIds.length, doctorCount: proposal.doctorIds.length, accountRemoved: false };
    await tx.insert(settings).values({ id: receiptId, data: { kind: "staff_responsibility_handoff",
      sourceFingerprint: accountSubjectFingerprint(context.targetId),
      destinationFingerprint: accountSubjectFingerprint(proposal.replacementId),
      proposalHash: removalProposalDigest(proposal), result } });
    return result;
  });
}
