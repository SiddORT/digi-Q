import { db, appointments, doctors, settings, schedules } from "@workspace/db";
import { eq } from "drizzle-orm";
import { all, one, flatten, change } from "./store";
import { sessionRows } from "./queue-order";

export const sessionKey = (s: any) => `session:${s.doctorId}:${s.branchId}:${s.date}${s.startTime ? ":" + s.startTime : ""}`;
export async function configuredDuration(doctorId: string, clinicId: string, conn: any = db) {
  const doctor = await one(doctors, doctorId, conn);
  const value = doctor.expectedDurations?.[clinicId];
  return [20, 30, 60].includes(value) ? value : null;
}
// Read-only fallback for legacy sessions. Never materialize snapshots on a GET.
export async function readDuration(session: any, conn: any = db) {
  const [stored] = await conn.select().from(settings).where(eq(settings.id, sessionKey(session)));
  if (stored) return flatten(stored).expectedDurationMinutes ?? null;
  const existing = sessionRows(await all(appointments, conn), session);
  const explicit = existing.find(a => a.expectedDurationMinutes !== undefined);
  if (explicit) return explicit.expectedDurationMinutes;
  const [legacy] = session.startTime ? await conn.select().from(settings).where(eq(settings.id, sessionKey({ ...session, startTime: undefined }))) : [];
  if (legacy) return flatten(legacy).expectedDurationMinutes ?? null;
  const schedule = (await all(schedules, conn)).find(s => s.doctorId === session.doctorId && s.branchId === session.branchId && s.dayOfWeek === new Date(session.date + "T12:00:00Z").getUTCDay() && s.status === "active" && (session.sessionId ? s.id === session.sessionId : !session.startTime || s.startTime === session.startTime));
  const legacyDuration = schedule?.consultationMinutes || 10;
  return existing.length ? (existing.find(a => a.expectedDurationMinutes !== undefined)?.expectedDurationMinutes ?? legacyDuration) : (await configuredDuration(session.doctorId, session.clinicId, conn) ?? legacyDuration);
}
// Caller holds doctor/session lock. JSON settings keeps snapshots independent of mutable schedules.
export async function snapshotDuration(session: any, conn: any) {
  const [stored] = await conn.select().from(settings).where(eq(settings.id, sessionKey(session)));
  if (stored) return flatten(stored).expectedDurationMinutes ?? null;
  const existing = sessionRows(await all(appointments, conn), session);
  const duration = await readDuration(session, conn);
  await conn.insert(settings).values({ id: sessionKey(session), data: { expectedDurationMinutes: duration } });
  // Freeze legacy bookings at their existing schedule value before any intentional config update.
  for (const row of existing) if (row.expectedDurationMinutes === undefined) await change(appointments, row.id, { data: { ...row, expectedDurationMinutes: duration } }, conn);
  return duration;
}
export async function freezeDoctorSessions(doctorId: string, conn: any) {
  const seen = new Set<string>();
  for (const row of (await all(appointments, conn)).filter(a => a.doctorId === doctorId)) {
    const key = sessionKey(row);
    if (!seen.has(key)) { seen.add(key); await snapshotDuration(row, conn); }
  }
}
export async function allocateToken(session: any, conn: any, allocate = true) {
  const key = "tokens:" + sessionKey(session);
  const [stored] = await conn.select().from(settings).where(eq(settings.id, key));
  const [legacy] = session.startTime ? await conn.select().from(settings).where(eq(settings.id, "tokens:" + sessionKey({ ...session, startTime: undefined }))) : [];
  const max = Math.max(stored?.data?.lastIssued || 0, legacy?.data?.lastIssued || 0, 0, ...sessionRows(await all(appointments, conn), session).map(a => a.tokenNumber));
  const value = max + (allocate ? 1 : 0);
  await conn.insert(settings).values({ id: key, data: { lastIssued: value } }).onConflictDoUpdate({ target: settings.id, set: { data: { lastIssued: value } } });
  return value;
}