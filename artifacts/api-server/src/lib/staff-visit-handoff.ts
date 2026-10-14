import { randomUUID } from "node:crypto";
import { db, appointments, doctors, users, appointmentTransitions } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { one, getSettings } from "./store";
import { availability, localNow, minutes } from "./availability";
import { lockQueue } from "./appointments";
import { reschedule } from "./reschedule";
import { computeStaffDeletionImpact } from "./staff-deletion-impact";
import { assertLiveRemovalActor, lockStaffCredentials } from "./staff-removal-auth";
import { issueRemovalReview, verifyRemovalReview } from "./staff-removal-review";

export type VisitMove = {
  appointmentId: string; doctorId: string; branchId: string; date: string;
  sessionId?: string; startTime?: string; expectedRevision: number; reason?: string;
};
type Context = { actorId: string; sessionHash: string; targetId: string };
async function inspectMoves(tx: any, context: Context, moves: VisitMove[]) {
  assert(moves.length > 0 && moves.length <= 50 &&
    new Set(moves.map(m => m.appointmentId)).size === moves.length, 400, "Select between one and fifty distinct visits");
  const target = await one(users, context.targetId, tx);
  assert(["doctor", "clinicAdmin"].includes(target.role) && !target.demo && !target.demoFixture,
    400, "Only an eligible staff clinician's booked care may be handed off");
  const rows = [];
  for (const move of moves) {
    const before = await one(appointments, move.appointmentId, tx);
    const source = await one(doctors, before.doctorId, tx);
    assert(source.userId === target.id && before.status === "booked" && !before.checkedInAt &&
      before.timezone && before.startTime && (before.revision ?? 0) === move.expectedRevision,
      409, "Selected care changed or needs individual clinical resolution");
    const now = localNow(before.timezone), config = await getSettings(tx, before.clinicId);
    const difference = (Date.parse(before.date) - Date.parse(now.date)) / 60_000 + minutes(before.startTime) - now.minute;
    assert(difference >= config.cancellationCutoffMinutes, 409, "Original visit is overdue or its rescheduling cutoff has passed");
    assert(source.id !== move.doctorId, 400, "Choose a different eligible doctor");
    const destination = await one(doctors, move.doctorId, tx);
    assert(destination.userId && destination.status === "active", 409, "Replacement doctor is unavailable");
    const account = await one(users, destination.userId, tx);
    assert(account.status === "active" && !account.demo && !account.demoFixture, 409, "Replacement clinician account is unavailable");
    const slot = await availability(move.doctorId, move.branchId, move.date, tx, move);
    assert(slot.clinicId === before.clinicId && slot.available && slot.queueMode !== "walkInsOnly",
      409, slot.reason || "Replacement must have eligible availability in the original clinic");
    rows.push({ move, before, destination, slot });
  }
  return rows;
}
/** Internal service, not an alternate public reschedule endpoint. The API must
 * still validate its DTO and authorize a fresh native session; this repeats that
 * authority inside the relational transaction. No patient roster is changed. */
export async function reviewStaffVisitHandoff(context: Context, moves: VisitMove[], conn: any = db) {
  return conn.transaction(async (tx: any) => {
    await tx.execute(sql`set transaction isolation level repeatable read`);
    await assertLiveRemovalActor(tx, context.actorId, context.sessionHash);
    const rows = await inspectMoves(tx, context, moves);
    const source = await computeStaffDeletionImpact(tx, context.actorId, context.targetId);
    const destinations: Record<string, string> = {};
    for (const row of rows)
      destinations[row.destination.userId] ??= (await computeStaffDeletionImpact(tx, context.actorId, row.destination.userId)).version;
    const proposal = { moves, destinations };
    const operationId = randomUUID();
    return { operationId, version: source.version, proposal,
      visits: rows.map(r => ({ appointmentId: r.before.id, patientId: r.before.patientId,
        clinicId: r.before.clinicId, fromDoctorId: r.before.doctorId, toDoctorId: r.destination.id,
        originalDate: r.before.date, originalToken: r.before.token,
        destinationDate: r.move.date, destinationSessionId: r.slot.sessionId,
        destinationStartTime: r.slot.startTime, destinationTimezone: r.slot.timezone })),
      reviewToken: issueRemovalReview({ mode: "handoff", actorId: context.actorId, targetId: context.targetId,
        sessionHash: context.sessionHash, version: source.version, proposal, operationId }) };
  });
}
export async function commitStaffVisitHandoff(context: Context, proposal: {
  moves: VisitMove[]; destinations: Record<string, string>;
}, token: string, conn: any = db) {
  const review = verifyRemovalReview(token, { mode: "handoff", actorId: context.actorId,
    targetId: context.targetId, sessionHash: context.sessionHash, proposal });
  return conn.transaction(async (tx: any) => {
    await lockStaffCredentials(tx, [context.actorId, context.targetId, ...Object.keys(proposal.destinations)]);
    await assertLiveRemovalActor(tx, context.actorId, context.sessionHash);
    const committed = await tx.select().from(appointmentTransitions).where(eq(appointmentTransitions.operationId, review.operationId));
    if (committed.length) {
      assert(committed.length === proposal.moves.length && proposal.moves.every(move => committed.some((row: any) =>
        row.appointmentId === move.appointmentId && row.toDoctorId === move.doctorId && row.toBranchId === move.branchId &&
        row.afterCoordinates.date === move.date)), 409, "Handoff operation does not match the reviewed selection");
      return { operationId: review.operationId, appointmentIds: committed.map((row: any) => row.appointmentId), count: committed.length };
    }
    const rows = await inspectMoves(tx, context, proposal.moves);
    const queues = rows.flatMap(r => [
      { doctorId: r.before.doctorId, branchId: r.before.branchId, date: r.before.date },
      { doctorId: r.move.doctorId, branchId: r.move.branchId, date: r.move.date },
    ]).sort((a, b) => `${a.doctorId}:${a.branchId}:${a.date}`.localeCompare(`${b.doctorId}:${b.branchId}:${b.date}`));
    for (const q of queues) await lockQueue(tx, q.doctorId, q.branchId, q.date);
    verifyRemovalReview(token, { mode: "handoff", actorId: context.actorId, targetId: context.targetId,
      sessionHash: context.sessionHash, proposal }); // Expiry still matters after waiting for locks.
    assert((await computeStaffDeletionImpact(tx, context.actorId, context.targetId)).version === review.version,
      409, "Staff care changed; review the handoff again");
    for (const row of rows) {
      const [locked] = await tx.select().from(doctors).where(eq(doctors.id, row.destination.id)).for("share");
      assert(locked?.userId === row.destination.userId &&
        (await computeStaffDeletionImpact(tx, context.actorId, locked.userId)).version === proposal.destinations[locked.userId],
        409, "Replacement scope or care changed; review the handoff again");
    }
    const actor = await one(users, context.actorId, tx), updated = [];
    for (const row of rows)
      updated.push(await reschedule(actor, row.before.id, { ...row.move, reason: row.move.reason || "Reviewed staff care handoff" }, tx,
        { operationId: review.operationId, targetUserId: context.targetId }));
    return { operationId: review.operationId, appointmentIds: updated.map(row => row.id), count: updated.length };
  });
}
