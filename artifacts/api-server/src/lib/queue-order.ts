import { createHash } from "node:crypto";

export const pendingStatuses = ["booked", "checkedIn", "waiting"];
export const statusGroups: Record<string, string[]> = {
  active: [...pendingStatuses, "called", "inConsultation"],
  waiting: pendingStatuses,
  absent: ["noShow"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};
export const rank = (row: any): number => row.queueRank ?? row.tokenNumber;
export function orderedReservations(rows: any[]) {
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.tokenNumber - b.tokenNumber || a.id.localeCompare(b.id));
}
export function queueVersion(rows: any[]) {
  return createHash("sha256").update(JSON.stringify([...rows].sort((a,b) => a.id.localeCompare(b.id)).map(a =>
    [a.id, a.status, rank(a), a.revision || 0, a.expectedDurationMinutes ?? null]
  ))).digest("hex");
}
export function sessionRows(rows: any[], session: any) {
  return rows.filter(a => a.doctorId === session.doctorId && a.branchId === session.branchId && a.date === session.date &&
    (session.startTime ? a.startTime === session.startTime : session.sessionId ? a.sessionId === session.sessionId : true));
}
export function queueSummary(rows: any[], own?: any, fallbackDuration: number | null = null) {
  const pending = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)));
  const current = rows.find(a => ["called", "inConsultation"].includes(a.status));
  const durationRow = rows.find(a => Object.hasOwn(a, "expectedDurationMinutes"));
  const duration = durationRow ? durationRow.expectedDurationMinutes ?? null : fallbackDuration;
  const ahead = own && pendingStatuses.includes(own.status)
    ? pending.filter(a => rank(a) < rank(own) || rank(a) === rank(own) && a.tokenNumber < own.tokenNumber).length + (current ? 1 : 0) : 0;
  return {
    currentToken: current?.token || null, nextToken: pending[0]?.token || null,
    reserved: pending.length, arrived: rows.filter(a => ["checkedIn", "waiting", "called", "inConsultation"].includes(a.status)).length,
    waiting: pending.length,
    inConsultation: rows.filter(a => a.status === "inConsultation").length,
    completed: rows.filter(a => a.status === "completed").length, noShow: rows.filter(a => a.status === "noShow").length,
    total: rows.length, queueVersion: queueVersion(rows), expectedDurationMinutes: duration,
    blockedByAbsentReservation: false,
    ownEntry: own ? { appointmentId: own.id, token: own.token, status: own.status, patientsAhead: ahead, estimatedWaitMinutes: duration === null ? null : ahead * duration } : null,
  };
}