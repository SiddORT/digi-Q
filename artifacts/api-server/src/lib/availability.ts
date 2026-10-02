import { db, doctors, branches, clinics, schedules, availabilityExceptions, appointments, users, settings } from "@workspace/db";
import { isClinicalMember } from "./clinical-membership";
import { eq } from "drizzle-orm";
import { configuredDuration, sessionKey } from "./session-duration";
import { all, one, getSettings } from "./store";
import { assert, HttpError } from "./http";
import { clinicDisplayPreferences } from "./display-preferences";
export function minutes(time: string) {
  assert(typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time), 400, "Time must be HH:mm");
  const [h, m] = time.split(":").map(Number); return h * 60 + m;
}
export function localNow(timezone: string) {
  let parts;
  try { parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); }
  catch { assert(false, 400, "Invalid timezone"); }
  const p = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}
/** Compare IANA aliases without rewriting persisted clinic/session timezone values. */
export function sameTimezone(a: string, b: string) {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: a }).resolvedOptions().timeZone
      === new Intl.DateTimeFormat("en", { timeZone: b }).resolvedOptions().timeZone;
  } catch {
    assert(false, 400, "Invalid timezone");
  }
}
export function validateTimes(body: any) {
  if (body.timezone) localNow(body.timezone);
  if (body.isClosed || body.isOpen === false) return;
  const start = minutes(body.startTime), end = minutes(body.endTime);
  assert(start < end, 400, "Session end must follow start (overnight sessions are not supported)");
  assert(Boolean(body.breakStart) === Boolean(body.breakEnd), 400, "Both break times are required");
  if (body.breakStart) assert(minutes(body.breakStart) >= start && minutes(body.breakEnd) <= end && minutes(body.breakStart) < minutes(body.breakEnd), 400, "Break must lie within the session");
  if (body.queueOpenTime) assert(minutes(body.queueOpenTime) < end, 400, "Queue opening must precede session end");
  if (body.queueCloseTime) assert(minutes(body.queueCloseTime) <= end && minutes(body.queueCloseTime) > minutes(body.queueOpenTime || body.startTime), 400, "Invalid queue closing time");
}
function datePlus(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z"); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
function zonedInstant(date: string, time: string, timezone: string) {
  localNow(timezone);
  const [year, month, day] = date.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    const correction = Date.UTC(year, month - 1, day, hour, minute) - represented;
    if (!correction) break;
    guess += correction;
  }
  return guess;
}
// Reservation lead time is not queue wait. Missing/invalid legacy snapshots
// and nonexistent DST wall times remain unknown rather than becoming zero.
export function sessionQueueWaitMinutes(row: any, now = Date.now()): number | null {
  if (!row.waitingAt || !row.startTime || !row.timezone || !row.date) return null;
  const waiting = Date.parse(row.waitingAt);
  if (!Number.isFinite(waiting) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date))) return null;
  try {
    minutes(row.startTime);
    const start = zonedInstant(row.date, row.startTime, row.timezone);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(start)).map(p => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` !== row.date || `${parts.hour}:${parts.minute}` !== row.startTime) return null;
    return Math.max(0, (now - Math.max(waiting, start)) / 60000);
  } catch (error) {
    if (error instanceof RangeError || error instanceof HttpError && error.status === 400) return null;
    throw error;
  }
}
export function sessionsOverlap(a: any, aDate: string, b: any, bDate: string) {
  if (!a.isOpen || !b.isOpen || a.isClosed || b.isClosed) return false;
  const aStart = zonedInstant(aDate, a.startTime, a.timezone), aEnd = zonedInstant(aDate, a.endTime, a.timezone);
  const bStart = zonedInstant(bDate, b.startTime, b.timezone), bEnd = zonedInstant(bDate, b.endTime, b.timezone);
  return aStart < bEnd && bStart < aEnd;
}
export function weeklySessionsOverlap(a: any, b: any) {
  const sunday = "2030-01-06";
  for (let week = 0; week < 3; week++) {
    const aDate = datePlus(sunday, week * 7 + a.dayOfWeek);
    for (let adjacent = -1; adjacent <= 1; adjacent++) {
      const bDate = datePlus(sunday, week * 7 + b.dayOfWeek + adjacent * 7);
      if (sessionsOverlap(a, aDate, b, bDate)) return true;
    }
  }
  return false;
}
export { datePlus };
export async function operationalDoctorContext(doctorId: string, branchId: string, conn: any = db) {
  const doctor = await one(doctors, doctorId, conn), branch = await one(branches, branchId, conn), clinic = await one(clinics, branch.clinicId, conn);
  const account = await one(users, doctor.userId, conn);
  const assigned = await isClinicalMember(doctorId, branchId, conn);
  return { doctor, branch, clinic, assigned, active: [doctor, account, branch, clinic].every(r => r.status === "active") };
}
export async function doctorContext(doctorId: string, branchId: string, conn: any = db) {
  const { doctor, branch, clinic, assigned, active } = await operationalDoctorContext(doctorId, branchId, conn);
  assert(active, 409, "Doctor, clinic or branch is inactive");
  assert(assigned, 409, "Doctor is not assigned to this branch");
  return { doctor, branch, clinic };
}
export async function availability(doctorId: string, branchId: string, date: string, conn: any = db, selector: { sessionId?: string; startTime?: string } = {}) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date, 400, "Invalid date");
  const { doctor, branch, clinic } = await doctorContext(doctorId, branchId, conn);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const sessions = (await all(schedules, conn)).filter(s => s.doctorId === doctorId && s.branchId === branchId && s.dayOfWeek === weekday && s.status === "active");
  const matches = sessions.filter(s => selector.sessionId ? s.id === selector.sessionId : !selector.startTime || s.startTime === selector.startTime);
  assert(matches.length <= 1, 409, "Select a session for this doctor and date");
  const schedule = matches[0];
  if (selector.sessionId || selector.startTime) assert(schedule, 404, "Session not found for this doctor, branch and date");
  const exceptions = (await all(availabilityExceptions, conn)).filter(e => e.doctorId === doctorId && e.branchId === branchId && e.date === date && e.status === "active");
  const exception = exceptions.find(e => e.sessionId === schedule?.id) || exceptions.find(e => !e.sessionId);
  const effective = { ...schedule };
  if (exception) for (const key of ["startTime", "endTime", "breakStart", "breakEnd", "maxTokens"]) if (exception[key] !== undefined && (exception[key] !== null || key.startsWith("break"))) effective[key] = exception[key];
  if (selector.sessionId && selector.startTime) assert(selector.startTime === effective.startTime, 409, "Session timing changed; refresh availability");
  const timezone = effective.timezone || branch.timezone || "Asia/Kolkata", now = localNow(timezone), config = await getSettings(conn, clinic.id);
  const sessionBookings = (await all(appointments, conn)).filter(a => a.doctorId === doctorId && a.branchId === branchId && a.date === date && a.startTime === effective.startTime);
  const bookedTokens = sessionBookings.filter(a => a.status !== "cancelled").length;
  const [snapshot] = await conn.select().from(settings).where(eq(settings.id, sessionKey({ doctorId, branchId, date, startTime: effective.startTime })));
  const consultationMinutes = snapshot?.data?.expectedDurationMinutes ?? (sessionBookings.length
    ? sessionBookings[0].expectedDurationMinutes ?? effective.consultationMinutes ?? 10
    : await configuredDuration(doctorId, clinic.id, conn) ?? effective.consultationMinutes ?? 10);
  let reason: string | null = null;
  if (!schedule || !schedule.isOpen) reason = "No open weekly session";
  if (exception?.isClosed) reason = exception.reason || "Closed for this date";
  if (!reason && Array.isArray(branch.openingHours) && (!branch.openingHours.some((h: any) => h.dayOfWeek === weekday && minutes(h.startTime) <= minutes(effective.startTime) && minutes(h.endTime) >= minutes(effective.endTime)) || !sameTimezone(timezone, branch.timezone || "Asia/Kolkata"))) reason = "Session is outside branch opening hours";
  if (date < now.date || date === now.date && effective.endTime && now.minute >= minutes(effective.endTime)) reason = "Session is in the past";
   if (!reason && date === now.date && effective.queueCloseTime && now.minute >= minutes(effective.queueCloseTime)) reason = "Queue booking has closed";
  if ((Date.parse(date) - Date.parse(now.date)) / 86400000 > config.bookingHorizonDays) reason = "Outside booking horizon";
  const maxTokens = effective.maxTokens || 0, remainingTokens = Math.max(0, maxTokens - bookedTokens);
  if (!remainingTokens) reason ||= "Session capacity reached";
  return { doctorId, branchId, clinicId: clinic.id, ...clinicDisplayPreferences(clinic), date, sessionId: schedule?.id || null, available: !reason, reason, startTime: effective.startTime || null, endTime: effective.endTime || null, breakStart: effective.breakStart || null, breakEnd: effective.breakEnd || null, timezone, maxTokens, bookedTokens, remainingTokens, consultationMinutes, tokenPrefix: effective.tokenPrefix || "A", queueMode: effective.queueMode || "mixed", queueOpenTime: effective.queueOpenTime, queueCloseTime: effective.queueCloseTime, bufferMinutes: effective.bufferMinutes || 0 };
}
export async function availabilitySessions(doctorId: string, branchId: string, date: string, conn: any = db) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date, 400, "Invalid date");
  await doctorContext(doctorId, branchId, conn);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const rows = (await all(schedules, conn)).filter(s => s.doctorId === doctorId && s.branchId === branchId && s.dayOfWeek === weekday && s.status === "active");
  return Promise.all(rows.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(s => availability(doctorId, branchId, date, conn, { sessionId: s.id })));
}