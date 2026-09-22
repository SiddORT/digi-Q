import { db, doctors, branches, clinics, schedules, availabilityExceptions, appointments, assignments, users } from "@workspace/db";
import { all, one, getSettings } from "./store";
import { assert } from "./http";
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
export async function doctorContext(doctorId: string, branchId: string, conn: any = db) {
  const doctor = await one(doctors, doctorId, conn), branch = await one(branches, branchId, conn), clinic = await one(clinics, branch.clinicId, conn);
  const account = await one(users, doctor.userId, conn);
  const assigned = (await all(assignments, conn)).some(a => a.userId === doctor.userId && a.branchId === branchId);
  assert(assigned, 409, "Doctor is not assigned to this branch");
  assert([doctor, account, branch, clinic].every(r => r.status === "active"), 409, "Doctor, clinic or branch is inactive");
  return { doctor, branch, clinic };
}
export async function availability(doctorId: string, branchId: string, date: string, conn: any = db) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date, 400, "Invalid date");
  const { doctor, branch, clinic } = await doctorContext(doctorId, branchId, conn);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const sessions = (await all(schedules, conn)).filter(s => s.doctorId === doctorId && s.branchId === branchId && s.dayOfWeek === weekday && s.status === "active");
  const exception = (await all(availabilityExceptions, conn)).find(e => e.doctorId === doctorId && e.branchId === branchId && e.date === date && e.status === "active");
  const schedule = sessions[0];
  const effective = { ...schedule };
  if (exception) for (const key of ["startTime", "endTime", "breakStart", "breakEnd", "maxTokens"]) if (exception[key] !== undefined && (exception[key] !== null || key.startsWith("break"))) effective[key] = exception[key];
  const timezone = effective.timezone || branch.timezone || "Asia/Kolkata", now = localNow(timezone), config = await getSettings(conn);
  const bookedTokens = (await all(appointments, conn)).filter(a => a.doctorId === doctorId && a.branchId === branchId && a.date === date && a.status !== "cancelled").length;
  let reason: string | null = null;
  if (!schedule || !schedule.isOpen) reason = "No open weekly session";
  if (exception?.isClosed) reason = exception.reason || "Closed for this date";
  if (date < now.date || date === now.date && effective.endTime && now.minute >= minutes(effective.endTime)) reason = "Session is in the past";
   if (!reason && date === now.date && effective.queueCloseTime && now.minute >= minutes(effective.queueCloseTime)) reason = "Queue booking has closed";
  if ((Date.parse(date) - Date.parse(now.date)) / 86400000 > config.bookingHorizonDays) reason = "Outside booking horizon";
  const maxTokens = effective.maxTokens || 0, remainingTokens = Math.max(0, maxTokens - bookedTokens);
  if (!remainingTokens) reason ||= "Session capacity reached";
  return { doctorId, branchId, clinicId: clinic.id, date, available: !reason, reason, startTime: effective.startTime || null, endTime: effective.endTime || null, breakStart: effective.breakStart || null, breakEnd: effective.breakEnd || null, timezone, maxTokens, bookedTokens, remainingTokens, consultationMinutes: effective.consultationMinutes || 10, tokenPrefix: effective.tokenPrefix || "A", queueMode: effective.queueMode || "mixed", queueOpenTime: effective.queueOpenTime, queueCloseTime: effective.queueCloseTime, bufferMinutes: effective.bufferMinutes || 0 };
}