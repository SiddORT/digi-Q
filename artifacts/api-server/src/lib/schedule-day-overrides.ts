import { createHash } from "node:crypto";
import { branches, schedules, appointments, availabilityExceptions, auditLogs, clinics, doctors } from "@workspace/db";
import { sql } from "drizzle-orm";
import { all, one, change, uid } from "./store";
import { assert } from "./http";
import { scheduleSnapshot } from "./schedule-snapshot";
import { freezeDoctorSessions } from "./session-duration";

/** Server-owned JSON on the location, outside the client-editable linkedSchedule document. */
export const customDay = (branch: any, doctorId: string, day: number) => branch.scheduleDayOverrides?.[doctorId]?.[day];
export async function lockScheduleDays(doctorId: string, branchId: string, conn: any) {
  for (const key of [`schedules:${doctorId}`, `doctor-schedules:${doctorId}`, `branch-hours:${branchId}`])
    await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}
export async function scheduleDayContext(doctorId: string, branchId: string, conn: any) {
  const branch = await one(branches, branchId, conn);
  const items = (await all(schedules, conn)).filter(s => s.doctorId === doctorId && s.branchId === branchId && s.status === "active");
  let linkedDoctorId = branch.linkedSchedule?.doctorId;
  if (branch.linkedSchedule?.enabled && !linkedDoctorId) {
    const clinic = await one(clinics, branch.clinicId, conn);
    linkedDoctorId = (await all(doctors, conn)).find(d=>d.userId===clinic.adminId)?.id;
  }
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const override = customDay(branch, doctorId, dayOfWeek);
    const following = !!branch.linkedSchedule?.enabled && linkedDoctorId === doctorId && !override;
    const snapshot = createHash("sha256").update(JSON.stringify({
      doctorId, branchId, dayOfWeek, timezone: branch.timezone, status: branch.status,
      link: branch.linkedSchedule ?? null, openingHours: branch.openingHours ?? null, override: override ? { isOpen: override.isOpen, requestId: override.requestId, changedAt: override.changedAt } : null,
      sessions: items.filter(s => s.dayOfWeek === dayOfWeek).sort((a,b) => a.id.localeCompare(b.id)).map(s => [s.id, scheduleSnapshot(s)]),
    })).digest("hex");
    return { dayOfWeek, following, custom: !!override, snapshot };
  });
  return { items, days };
}

/** One confirmed complete day, not a general weekly transaction. Caller owns authorization and transaction. */
export async function applyDayOverride(actor: any, body: any, conn: any, saveSession: (body: any, old?: any) => Promise<any>) {
  const branch = await one(branches, body.branchId, conn);
  const digest = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const prior = customDay(branch, body.doctorId, body.dayOfWeek);
  if (prior?.requestId === body.requestId && prior.actorId === actor.id) {
    assert(prior.digest === digest, 409, "This save identifier was already used for another draft.");
    // Return precisely the original write response, never a later reader's baseline.
    return prior.receipt;
  }
  assert(body.confirmed === true, 400, "Confirm the selected custom day before saving.");
  const context = await scheduleDayContext(body.doctorId, branch.id, conn);
  const day = context.days[body.dayOfWeek];
  assert(day.snapshot === body.expectedSnapshot, 409, "Clinic hours, link settings or this day's sessions changed. Reload and review your draft before saving.");
  assert(day.following || day.custom, 409, "This day no longer follows clinic hours. Reload the schedule.");
  assert(body.isOpen ? body.sessions.length > 0 : body.sessions.length === 0, 400, "A working day needs sessions; a day off must have none.");
  const rows = context.items.filter(s => s.dayOfWeek === body.dayOfWeek);
  assert(body.sessions.every((s:any)=>s.session.timezone===branch.timezone), 409, "Location timezone changed. Reload and review the schedule.");
  const ids = body.sessions.flatMap((s: any) => s.id ? [s.id] : []);
  assert(new Set(ids).size === ids.length && new Set(body.sessions.map((s:any)=>s.key)).size === body.sessions.length, 400, "Duplicate sessions in this day.");
  assert(ids.every((id: string) => rows.some(r => r.id === id)), 403, "A session is outside the selected doctor, location or day.");
  const bookings = await all(appointments, conn), exceptions = await all(availabilityExceptions, conn);
  for (const old of rows) {
    const next = body.sessions.find((s: any) => s.id === old.id)?.session;
    if (next && next.startTime === old.startTime && next.endTime === old.endTime && (next.breakStart??null)===(old.breakStart??null) && (next.breakEnd??null)===(old.breakEnd??null)) continue;
    const booked = bookings.some(a => a.doctorId === old.doctorId && a.branchId === old.branchId && (a.sessionId === old.id || !a.sessionId && a.startTime === old.startTime && new Date(`${a.date}T12:00:00Z`).getUTCDay() === old.dayOfWeek));
    const exception = exceptions.some(e => e.status === "active" && e.doctorId === old.doctorId && e.branchId === old.branchId && new Date(`${e.date}T12:00:00Z`).getUTCDay() === old.dayOfWeek && (!e.sessionId || e.sessionId === old.id));
    assert(!booked && !exception, 409, `${old.startTime}–${old.endTime} has ${booked ? "booking history" : "date exceptions"}. Keep its times or resolve the affected records separately; no appointments were moved.`);
  }
  await freezeDoctorSessions(body.doctorId, conn);
  // Hide the complete old set inside this transaction, avoiding swap/duplicate-start conflicts.
  // The normal save validator then sees only unaffected sessions plus already validated replacements.
  for (const row of rows) await change(schedules, row.id, { status: "inactive", data: { ...row, linkedBranchId: null, linkedIntervalKey: null } }, conn);
  for (const slot of body.sessions) {
    const old = slot.id ? await one(schedules, slot.id, conn) : undefined;
    assert(slot.session.doctorId === body.doctorId && slot.session.branchId === branch.id && slot.session.clinicId === branch.clinicId && slot.session.dayOfWeek === body.dayOfWeek && slot.session.isOpen === true, 403, "Session scope must match the selected custom day.");
    const { expectedSnapshot: _snapshot, ...input } = slot.session;
    await saveSession({ ...input, timezone: branch.timezone, draftKey: slot.key, status: "active" }, old);
  }
  const override = { isOpen: body.isOpen, actorId: actor.id, requestId: body.requestId, digest, changedAt: new Date().toISOString() };
  const overrides = { ...branch.scheduleDayOverrides, [body.doctorId]: { ...branch.scheduleDayOverrides?.[body.doctorId], [body.dayOfWeek]: override } };
  await change(branches, branch.id, { data: { ...branch, scheduleDayOverrides: overrides } }, conn);
  const receipt = await scheduleDayContext(body.doctorId, branch.id, conn);
  // Receipt excluded from day snapshot to keep the baseline stable.
  await change(branches, branch.id, { data: { ...branch, scheduleDayOverrides: { ...overrides, [body.doctorId]: { ...overrides[body.doctorId], [body.dayOfWeek]: { ...override, receipt } } } } }, conn);
  await conn.insert(auditLogs).values({
    id: uid(), actorId: actor.id, clinicId: branch.clinicId, branchId: branch.id, action: "customizeScheduleDay",
    entityType: "schedules", entityId: `${body.doctorId}:${branch.id}:${body.dayOfWeek}`,
    summary: JSON.stringify({ doctorId: body.doctorId, dayOfWeek: body.dayOfWeek, confirmed: true, clinicHours: branch.openingHours?.filter((h:any)=>h.dayOfWeek===body.dayOfWeek) ?? null, prior: rows.map(r=>({id:r.id,snapshot:scheduleSnapshot(r)})), proposed: body.sessions, isOpen: body.isOpen }),
  });
  return receipt;
}
