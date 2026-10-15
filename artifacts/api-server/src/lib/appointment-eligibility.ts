import { localNow, minutes } from "./availability";
import { availability } from "./availability";
import { assert } from "./http";
import { availabilityExceptions } from "@workspace/db";
import { all } from "./store";

/** Check the saved source interval, not booking capacity or the cancellation cutoff. */
export function sourceSessionReason(row: any, activeOnly = false): string | null {
  const now = localNow(row.timezone || "Asia/Kolkata");
  if (!row.endTime || !row.startTime) return "Original session timing is unavailable; contact the clinic";
  if (row.date < now.date || row.date === now.date && now.minute >= minutes(row.endTime))
    return "The original session has ended";
  if (activeOnly && (row.date !== now.date || now.minute < minutes(row.startTime)))
    return "This action requires the same active session";
  return null;
}
export function movementReason(row: any, user: any): string | null {
  if (row.checkedInAt || row.consultationStartedAt || ["inConsultation", "completed"].includes(row.status))
    return "Consultation has already started";
  if (row.status === "cancelled") return "Cancelled bookings cannot be moved or re-entered";
  if (!["booked", "checkedIn", "waiting", "called"].includes(row.status))
    return "Only pending bookings can move; an absent patient needs staff re-entry";
  if (row.status === "called" && user.role === "patient") return "You have been called; ask staff to release the call before moving";
  return sourceSessionReason(row);
}

/** Source capacity and booking closure do not prevent leaving an open care session. */
export async function assertSourceSessionOpen(row: any, tx: any) {
  const closed = (await all(availabilityExceptions, tx)).find(e => e.doctorId === row.doctorId && e.branchId === row.branchId &&
    e.date === row.date && e.status === "active" && !e.isExtra && e.isClosed && (!e.sessionId || e.sessionId === row.sessionId));
  assert(!closed, 409, closed?.reason || "The original session is closed");
  const source = await availability(row.doctorId, row.branchId, row.date, tx, {
    ...(row.sessionId ? {sessionId: row.sessionId} : {}), startTime: row.startTime,
  });
  assert(source.available || ["Session capacity reached", "Queue booking has closed", "Outside booking horizon"].includes(source.reason || ""),
    409, source.reason || "The original session is closed");
}
