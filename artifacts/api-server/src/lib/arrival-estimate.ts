import { orderedReservations, pendingStatuses, sessionRows } from "./queue-order";

const uncertainty = "Estimate only, not an appointment time. Queue changes, breaks and delays can change your wait.";
const wall = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;
function localParts(now: number, timezone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(p => [p.type, p.value]));
}
/** Resolve saved wall times and reject nonexistent DST times rather than normalizing them. */
function sessionInstant(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, Math.floor(wall(time) / 60), wall(time) % 60);
  let guess = desired;
  for (let i = 0; i < 4; i++) {
    const p = localParts(guess, timezone);
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    if (represented === desired) return guess;
    guess += desired - represented;
  }
  return NaN;
}
/** Pure patient-safe projection. Token numbers are labels, never positions. */
export function arrivalEstimate(row: any, candidates: any[], duration: number | null, presence = "available", now = Date.now()) {
  const base = { state: "unavailable", basis: "remainingQueue", asOf: new Date(now).toISOString(), patientsAhead: null as number | null, waitMinutes: null as number | null, suggestedArrival: null as string | null, beyondSessionEnd: false, guidance: uncertainty };
  const unavailable = (guidance: string, state = "unavailable") => ({ ...base, state, guidance });
  if (["completed", "cancelled", "noShow"].includes(row.status)) return unavailable("This visit is no longer waiting. No arrival estimate applies.", "terminal");
  if (!row.timezone || !row.date || !Number.isFinite(wall(row.startTime || "")) || !Number.isFinite(wall(row.endTime || ""))) return unavailable("Session timing is unavailable. Contact the clinic.");
  let p: ReturnType<typeof localParts>, opens: number, closes: number;
  try {
    p = localParts(now, row.timezone);
    opens = sessionInstant(row.date, row.startTime, row.timezone);
    closes = sessionInstant(row.date, row.endTime, row.timezone);
  } catch { return unavailable("Session timezone is unavailable. Contact the clinic."); }
  const today = `${p.year}-${p.month}-${p.day}`, minute = Number(p.hour) * 60 + Number(p.minute);
  const start = wall(row.startTime), end = wall(row.endTime);
  if (end <= start || !Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) return unavailable("Session timing is unavailable. Contact the clinic.");
  if (now >= closes) return unavailable("The saved session has ended. Contact the clinic for current guidance.", "ended");
  const pre = now < opens;
  base.basis = pre ? "sessionStart" : "remainingQueue";
  const rows = sessionRows(candidates, row);
  const current = rows.filter(a => ["called", "inConsultation"].includes(a.status));
  if (current.length > 1) return unavailable("Queue status needs confirmation. Contact the clinic.");
  const pending = orderedReservations(rows.filter(a => pendingStatuses.includes(a.status)));
  const position = pending.findIndex(a => a.id === row.id);
  if (position < 0 && !["called", "inConsultation"].includes(row.status)) return unavailable("Queue position is unavailable. Refresh or contact the clinic.");
  base.patientsAhead = Math.max(0, position) + (current.some(a => a.id !== row.id) ? 1 : 0);
  if (presence !== "available") return unavailable("Doctor is on break or away. Arrival guidance resumes when availability is confirmed.", "paused");
  const breakStart = wall(row.breakStart || ""), breakEnd = wall(row.breakEnd || "");
  if (Boolean(row.breakStart) !== Boolean(row.breakEnd) || row.breakStart && (!Number.isFinite(breakStart) || !Number.isFinite(breakEnd) || breakEnd <= breakStart))
    return unavailable("Break timing is unavailable. Contact the clinic for arrival guidance.");
  if (!pre && minute >= breakStart && minute < breakEnd) return unavailable("Doctor is on a scheduled break. Check again after the break.", "paused");
  if (["called", "inConsultation"].includes(row.status)) return { ...base, state: "ready", waitMinutes: 0, guidance: row.status === "called" ? "You have been called. Follow reception guidance." : "Your consultation is in progress." };
  if (!Number.isFinite(duration) || duration === null || duration <= 0) return unavailable("Waiting-time configuration is unavailable. Contact the clinic.");
  let wait = Math.max(0, position) * duration;
  if (current.length) {
    const active = current[0];
    const since = Date.parse(active.consultationStartedAt || active.calledAt || "");
    if (!pre && (!Number.isFinite(since) || since > now)) return unavailable("Current consultation timing is unavailable. Check again shortly.");
    const elapsed = pre ? 0 : (now - since) / 60000;
    if (elapsed >= duration) return unavailable("The current consultation is taking longer than estimated. Check again shortly.");
    wait += Math.ceil(duration - elapsed);
  }
  const anchor = pre ? opens : now;
  let target = anchor + wait * 60000;
  if (Number.isFinite(breakStart) && breakEnd > breakStart) {
    const begins = sessionInstant(row.date, row.breakStart, row.timezone), resumes = sessionInstant(row.date, row.breakEnd, row.timezone);
    if (!Number.isFinite(begins) || !Number.isFinite(resumes) || begins < opens || resumes > closes) return unavailable("Break timing is unavailable. Contact the clinic.");
    if (anchor < resumes && target >= begins) target += resumes - Math.max(anchor, begins);
  }
  const beyondSessionEnd = target >= closes;
  // Never imply the clinic will silently extend a saved session.
  if (beyondSessionEnd) return { ...base, state: "ready", waitMinutes: Math.ceil((target - anchor) / 60000), beyondSessionEnd, guidance: "Estimated queue wait reaches beyond session closing. Contact the clinic; no later arrival is suggested." };
  const arrival = localParts(Math.ceil(Math.max(opens, now, target - 10 * 60000) / 60000) * 60000, row.timezone);
  return { ...base, state: "ready", waitMinutes: Math.ceil((target - anchor) / 60000), suggestedArrival: `${arrival.hour}:${arrival.minute}`, beyondSessionEnd, guidance: uncertainty };
}
