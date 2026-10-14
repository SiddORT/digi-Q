import { createHash, randomUUID } from "node:crypto";
import { appointmentTransitions } from "@workspace/db";
import { assert } from "./http";

function coordinates(row: any, duration: number) {
  assert(Number.isFinite(duration) && duration > 0, 409, "The original and destination consultation durations must be confirmed");
  assert(row.date && row.startTime && row.timezone && Number.isInteger(row.tokenNumber) && row.tokenNumber > 0,
    409, "Visit coordinates are incomplete; resolve the original visit before a handoff");
  return {
    date: row.date, sessionId: row.sessionId ?? null, startTime: row.startTime,
    endTime: row.endTime ?? null, timezone: row.timezone,
    token: row.token ?? null, tokenNumber: row.tokenNumber, expectedDurationMinutes: duration,
  };
}

/**
 * Evidence only, not handoff authority. The caller must run the reviewed
 * Superadmin workflow and normal reschedule/cutoff/capacity/queue locks first.
 * Insert this in the SAME transaction as the care change and outbox events.
 * Do not copy arbitrary profile/JSON fields into immutable clinical evidence.
 */
export async function recordStaffHandoffTransition(
  tx: any, operationId: string, actorId: string, before: any, after: any,
  originalDuration: number, destinationDuration: number,
) {
  assert(before.id === after.id && before.patientId === after.patientId && before.clinicId === after.clinicId,
    409, "A handoff must preserve the visit, patient and clinic");
  assert(before.doctorId !== after.doctorId, 400, "Choose a different eligible doctor");
  assert(!before.checkedInAt && ["booked", "waiting"].includes(before.status),
    409, "Checked-in or unresolved clinical work cannot be handed off through staff removal");
  assert(typeof before.reference === "string" && before.reference.length > 0 && before.reference === after.reference,
    409, "The patient's private ticket reference must be preserved");
  const fromRevision = before.revision ?? 0, toRevision = after.revision ?? 0;
  assert(Number.isInteger(fromRevision) && fromRevision >= 0 && toRevision === fromRevision + 1,
    409, "Visit revision changed; review the handoff again");
  const [transition] = await tx.insert(appointmentTransitions).values({
    id: randomUUID(), operationId, appointmentId: before.id, patientId: before.patientId,
    clinicId: before.clinicId, actorId,
    fromDoctorId: before.doctorId, toDoctorId: after.doctorId,
    fromBranchId: before.branchId, toBranchId: after.branchId,
    beforeCoordinates: coordinates(before, originalDuration), afterCoordinates: coordinates(after, destinationDuration),
    referenceFingerprint: createHash("sha256").update(before.reference).digest("hex"),
    fromRevision, toRevision,
  }).returning();
  return transition;
}
