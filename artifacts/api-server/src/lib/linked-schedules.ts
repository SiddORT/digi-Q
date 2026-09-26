import { schedules, doctors, appointments, availabilityExceptions, branches } from "@workspace/db";
import { sql } from "drizzle-orm";
import { all, change, put, uid, audit } from "./store";
import { assert } from "./http";
import { sameTimezone, weeklySessionsOverlap, validateTimes } from "./availability";

export async function lockLinkedDoctors(clinic: any, branchInputs: any[], existingBranches: any[], conn: any) {
  const owner = (await all(doctors, conn)).find(d => d.userId === clinic.adminId);
  const ids = new Set<string>();
  for (const input of branchInputs) {
    const prior = existingBranches.find(b => b.id === input.id);
    if (prior?.linkedSchedule?.enabled || input.linkedSchedule?.enabled) {
      if (owner) ids.add(owner.id);
      if (prior?.linkedSchedule?.doctorId) ids.add(prior.linkedSchedule.doctorId);
    }
  }
  for (const id of [...ids].sort()) {
    // Same order as booking allocation and generic schedule edits.
    await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedules:" + id}))`);
    await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"doctor-schedules:" + id}))`);
  }
}

export async function planLinkedSchedules(clinic: any, branch: any, prior: any, conn: any) {
  const link = branch.linkedSchedule;
  const rows = (await all(schedules, conn)).filter(s => s.branchId === branch.id && s.status === "active");
  const linked = rows.filter(s => s.linkedBranchId === branch.id);
  const impact = { branchId: branch.id, create: 0, update: 0, retire: 0, unlink: !!prior?.linkedSchedule?.enabled && !link?.enabled };
  const conflicts: string[] = [];
  const writes: { old?: any; next?: any; retire?: boolean; unlink?: boolean }[] = [];
  if (!link?.enabled) {
    for (const old of linked) writes.push({ old, unlink: true });
    return { impact, conflicts, writes, link };
  }
  const doctor = (await all(doctors, conn)).find(d => d.userId === clinic.adminId);
  assert(doctor && doctor.status === "active" && doctor.ownerAdminId === clinic.adminId && doctor.branchIds?.includes(branch.id), 409, "Attach the active owner's doctor profile to this location before linking hours.");
  assert(!link.doctorId || link.doctorId === doctor.id, 403, "Linked hours are restricted to the clinic owner's doctor profile.");
  assert(Array.isArray(branch.openingHours), 400, "Choose explicit location opening hours before linking sessions.");
  assert(Number.isInteger(link.maxTokens) && link.maxTokens >= 1 && link.maxTokens <= 1000, 400, "Choose capacity between 1 and 1000.");
  assert(Number.isInteger(link.consultationMinutes) && link.consultationMinutes >= 1 && link.consultationMinutes <= 240, 400, "Choose consultation duration between 1 and 240 minutes.");
  assert(/^[A-Za-z0-9]{1,8}$/.test(link.tokenPrefix || "") && ["mixed", "appointmentsOnly", "walkInsOnly"].includes(link.queueMode), 400, "Choose an explicit ticket prefix and booking policy.");
  const allSessions = (await all(schedules, conn)).filter(s => s.doctorId === doctor.id && s.status === "active");
  const locations = await all(branches, conn);
  const taken = new Set<string>();
  for (const hour of branch.openingHours) {
    const next = { ...hour, doctorId: doctor.id, clinicId: clinic.id, branchId: branch.id, timezone: branch.timezone || "Asia/Kolkata", isOpen: true, maxTokens: link.maxTokens, consultationMinutes: link.consultationMinutes, tokenPrefix: link.tokenPrefix.toUpperCase(), queueMode: link.queueMode, bufferMinutes: 0, linkedBranchId: branch.id };
    validateTimes(next);
    const old = linked.find(s => s.doctorId === doctor.id && s.dayOfWeek === hour.dayOfWeek && s.startTime === hour.startTime && s.endTime === hour.endTime);
    if (old) taken.add(old.id);
    for (const other of allSessions.filter(s => !linked.some(l => l.id === s.id))) {
      const timezone = other.timezone || locations.find(b => b.id === other.branchId)?.timezone || "Asia/Kolkata";
      if (weeklySessionsOverlap(next, { ...other, timezone })) conflicts.push(`Session ${other.id} overlaps ${hour.startTime}–${hour.endTime} on weekday ${hour.dayOfWeek}. Edit custom sessions before linking.`);
    }
    const changed = old && Object.keys(next).some(k => k === "timezone" ? !sameTimezone(next.timezone, old.timezone) : next[k as keyof typeof next] !== old[k]);
    if (!old) { impact.create++; writes.push({ next }); }
    else if (changed) { impact.update++; writes.push({ old, next }); }
  }
  for (const old of linked.filter(s => !taken.has(s.id))) { impact.retire++; writes.push({ old, retire: true }); }
  const bookings = await all(appointments, conn), exceptions = await all(availabilityExceptions, conn);
  if (impact.create && exceptions.some(e => e.status === "active" && e.doctorId === doctor.id)) {
    conflicts.push("This doctor has active date exceptions. Review and deactivate or resolve exceptions before adding linked sessions, so a date override cannot introduce overlapping consultations.");
  }
  for (const write of writes.filter(w => w.old && !w.unlink)) {
    const s = write.old;
    const booked = bookings.some(a => a.doctorId === s.doctorId && a.branchId === s.branchId && (a.sessionId === s.id || a.startTime === s.startTime && new Date(a.date + "T12:00:00Z").getUTCDay() === s.dayOfWeek));
    const exception = exceptions.some(e => e.status === "active" && e.doctorId === s.doctorId && e.branchId === s.branchId && (!e.sessionId || e.sessionId === s.id));
    if (booked || exception) conflicts.push(`Session ${s.id} (${s.startTime}–${s.endTime}, weekday ${s.dayOfWeek}) has ${booked ? "booking history" : "date exceptions"}. Unlink to retain its records and review a custom schedule; no patients were moved.`);
  }
  return { impact, conflicts, writes, link: { ...link, doctorId: doctor.id } };
}

export async function applyLinkedPlan(actor: any, plan: Awaited<ReturnType<typeof planLinkedSchedules>>, conn: any) {
  assert(!plan.conflicts.length, 409, plan.conflicts.join(" "));
  for (const write of plan.writes) {
    const row = write.old
      ? await change(schedules, write.old.id, write.retire ? { status: "inactive" } : { data: { ...write.old, ...write.next, ...(write.unlink ? { linkedBranchId: null } : {}) } }, conn)
      : await put(schedules, { id: uid(), doctorId: write.next.doctorId, branchId: write.next.branchId, clinicId: write.next.clinicId, dayOfWeek: write.next.dayOfWeek, data: write.next }, conn);
    await audit(actor, write.unlink ? "unlinkHours" : write.retire ? "retireLinkedSession" : "syncLinkedSession", "schedules", row, conn);
  }
}