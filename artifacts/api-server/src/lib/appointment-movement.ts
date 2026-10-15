import { appointments } from "@workspace/db";
import { all, one } from "./store";
import { canRead } from "./auth";
import { assert } from "./http";
import { appointmentViewWithBranch, lockQueue } from "./appointments";
import { orderedReservations, pendingStatuses, queueVersion, sessionRows } from "./queue-order";
import { assertSourceSessionOpen } from "./appointment-eligibility";
import { HttpError } from "./http";

/** Counts and positions only. Never return other bookings through self-service. */
export async function appointmentMovement(user: any, id: string, tx: any) {
  let row = await one(appointments, id, tx);
  assert(await canRead(user, "appointments", row, tx), 403, "Appointment outside your scope");
  const original = row;
  await lockQueue(tx, row.doctorId, row.branchId, row.date);
  row = await one(appointments, id, tx);
  assert(row.doctorId === original.doctorId && row.branchId === original.branchId && row.date === original.date && row.startTime === original.startTime, 409, "Appointment changed; refresh and retry");
  const rows = sessionRows(await all(appointments, tx), row);
  const pending = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)));
  const currentPosition = pending.findIndex(a => a.id === id) + 1;
  const remaining = pending.filter(a => a.id !== id).length;
  const min = row.status === "noShow" ? 1 : row.status === "called" ? 2 : currentPosition + 1;
  const positions = Array.from({length: remaining + 1}, (_, i) => i + 1).filter(p => p >= min);
  const appointment = await appointmentViewWithBranch(row, user, tx);
  if (appointment.canReschedule || appointment.allowedActions.some((a: string) => ["shift", "requeue", "noShow"].includes(a))) {
    try { await assertSourceSessionOpen(row, tx); }
    catch (error) {
      if (!(error instanceof HttpError) || ![400, 404, 409].includes(error.status)) throw error;
      appointment.canReschedule = false;
      appointment.movementReason = error.message;
      appointment.allowedActions = appointment.allowedActions.filter((a: string) => !["shift", "requeue", "noShow"].includes(a));
    }
  }
  if (!positions.length && appointment.allowedActions.includes("shift")) {
    appointment.allowedActions = appointment.allowedActions.filter((a: string) => a !== "shift");
    appointment.movementReason = "Already last in the pending queue; there is no later position";
  }
  return { appointment, queueVersion: queueVersion(rows), currentPosition, pendingCount: pending.length, positions };
}
