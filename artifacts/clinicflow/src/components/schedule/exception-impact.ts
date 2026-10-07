type Row = { status?: string; startTime?: string; endTime?: string; sessionId?: string | null };
const ACTIVE = new Set(["booked", "confirmed", "waiting", "called", "checkedIn", "inConsultation", "scheduled"]);
/** Counts active bookings on the date that a day off would close or changed hours would leave outside the new window. */
export function exceptionImpact(rows: unknown[], change: { isClosed?: boolean; startTime?: string; endTime?: string; sessionId?: string }) {
  const active = (rows as Row[]).filter(r => ACTIVE.has(String(r.status)) && (!change.sessionId || !r.sessionId || r.sessionId === change.sessionId));
  let affected = 0;
  if (change.isClosed) affected = active.length;
  else if (change.startTime && change.endTime) affected = active.filter(r => !!r.startTime && (r.startTime < change.startTime! || r.startTime >= change.endTime!)).length;
  const message = !active.length ? "No active bookings on this date. Saving affects no patients."
    : affected ? `${affected} active booking${affected === 1 ? "" : "s"} on this date ${change.isClosed ? (affected === 1 ? "falls on the day off" : "fall on the day off") : (affected === 1 ? "starts outside the changed hours" : "start outside the changed hours")}. Existing bookings are kept; contact or reschedule ${affected === 1 ? "this patient" : "these patients"}.`
    : `${active.length} active booking${active.length === 1 ? "" : "s"} on this date ${active.length === 1 ? "stays" : "stay"} within the new hours.`;
  return { active: active.length, affected, message };
}
