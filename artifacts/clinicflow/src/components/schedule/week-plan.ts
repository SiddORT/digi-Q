export type DraftSession = { key: string; id?: string; startTime: string; endTime: string; locked?: boolean };
export type DraftDay = { dayOfWeek: number; isOpen: boolean; sessions: DraftSession[] };
export type ScheduleRow = { id: string; dayOfWeek: number; startTime: string; endTime: string; isOpen?: boolean; status?: string; linkedBranchId?: string | null; [k: string]: unknown };

/** Fields a new session copies from a template session of the same doctor and clinic. Link metadata is never copied. */
const TEMPLATE_KEYS = ["doctorId", "clinicId", "branchId", "breakStart", "breakEnd", "timezone", "tokenPrefix", "maxTokens", "consultationMinutes", "bufferMinutes", "queueMode", "queueOpenTime", "queueCloseTime"];
const INPUT_KEYS = ["doctorId", "clinicId", "branchId", "dayOfWeek", "isOpen", "startTime", "endTime", "breakStart", "breakEnd", "timezone", "tokenPrefix", "maxTokens", "consultationMinutes", "bufferMinutes", "queueMode", "queueOpenTime", "queueCloseTime"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Proposed soft guidance only; not an approved limit. More sessions are allowed and saved. */
export const SUGGESTED_SESSIONS_PER_DAY = 4;
export const dayWarnings = (day: DraftDay) => day.isOpen && day.sessions.length > SUGGESTED_SESSIONS_PER_DAY ? [`More than ${SUGGESTED_SESSIONS_PER_DAY} sessions on one day. Check this is intended.`] : [];

let seq = 0;
export const draftKey = () => `new-${++seq}`;

export function buildWeek(rows: ScheduleRow[]): DraftDay[] {
  const active = rows.filter(r => r.status !== "inactive");
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const day = active.filter(r => r.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const open = day.filter(r => r.isOpen !== false);
    return { dayOfWeek, isOpen: open.length > 0, sessions: open.map(r => ({ key: r.id, id: r.id, startTime: r.startTime, endTime: r.endTime, locked: !!r.linkedBranchId })) };
  });
}

export function dayErrors(day: DraftDay): string[] {
  if (!day.isOpen) return [];
  const errors: string[] = [];
  if (!day.sessions.length) errors.push("Add at least one session or turn the day off.");
  day.sessions.forEach((s, i) => {
    if (!TIME.test(s.startTime) || !TIME.test(s.endTime)) errors.push(`Session ${i + 1}: enter both start and end times.`);
    else if (s.startTime >= s.endTime) errors.push(`Session ${i + 1}: end time must be after start time. Overnight sessions are not supported.`);
  });
  const sorted = day.sessions.map((s, i) => ({ ...s, n: i + 1 })).filter(s => TIME.test(s.startTime) && TIME.test(s.endTime)).sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) if (sorted[i - 1].endTime > sorted[i].startTime) errors.push(`Session ${sorted[i - 1].n} and session ${sorted[i].n} overlap.`);
  return errors;
}

export function outsideHours(session: DraftSession, hours: { startTime: string; endTime: string }[]) {
  return !!hours.length && TIME.test(session.startTime) && TIME.test(session.endTime) && !hours.some(h => h.startTime <= session.startTime && h.endTime >= session.endTime);
}

/** Copies a day's editable sessions. Locked (clinic-linked) sessions in targets are kept untouched; source locked sessions are copied as plain times. */
export function copyDay(week: DraftDay[], source: number, targets: number[]): DraftDay[] {
  const from = week[source];
  return week.map(day => {
    if (day.dayOfWeek === source || !targets.includes(day.dayOfWeek)) return day;
    const locked = day.sessions.filter(s => s.locked);
    if (!from.isOpen) return locked.length ? { ...day, isOpen: true, sessions: locked } : { ...day, isOpen: false, sessions: [] };
    const reusable = day.sessions.filter(s => !s.locked && s.id);
    const copied = from.sessions.map((s, i) => ({ key: draftKey(), id: reusable[i]?.id, startTime: s.startTime, endTime: s.endTime }));
    return { ...day, isOpen: true, sessions: [...locked, ...copied] };
  });
}

export type WeekPlan = {
  creates: { key: string; body: Record<string, unknown>; label: string }[];
  updates: { id: string; key: string; body: Record<string, unknown>; label: string }[];
  deactivations: { id: string; label: string }[];
  /** Draft sessions identical to a removed record on the same day: keep that record, no write needed. */
  adopt: { key: string; id: string }[];
};

const rowInput = (row: ScheduleRow) => ({ ...Object.fromEntries(INPUT_KEYS.filter(k => row[k] !== undefined && row[k] !== null && row[k] !== "").map(k => [k, row[k]])), breakStart: row.breakStart ?? null, breakEnd: row.breakEnd ?? null });

/** Keep valid early queue opening; repair inherited windows invalidated by changed hours. */
function fitQueueWindow(body: Record<string, unknown>): Record<string, unknown> {
  const next = {...body};
  const start = String(next.startTime), end = String(next.endTime);
  if (next.queueOpenTime && String(next.queueOpenTime) >= end) next.queueOpenTime = start;
  if (next.queueCloseTime && (String(next.queueCloseTime) > end || String(next.queueCloseTime) <= String(next.queueOpenTime || start))) next.queueCloseTime = end;
  return next;
}

/**
 * Turns the draft into per-record writes. New sessions on a day first take over the record of a removed
 * editable session on that day (an update), so replacements never depend on deactivating something first.
 * Only removals with no replacement become deactivations. Clinic-linked records are never written.
 */
export function planWeek(rows: ScheduleRow[], week: DraftDay[], template: Record<string, unknown> | undefined, labels: string[]): WeekPlan {
  const active = rows.filter(r => r.status !== "inactive");
  const byId = new Map(active.map(r => [r.id, r]));
  const kept = new Set<string>();
  for (const day of week) if (day.isOpen) for (const s of day.sessions) if (s.id && byId.has(s.id)) kept.add(s.id);
  const spare = new Map<number, ScheduleRow[]>();
  for (const r of active) if (!kept.has(r.id) && !r.linkedBranchId && r.isOpen !== false) spare.set(r.dayOfWeek, [...(spare.get(r.dayOfWeek) || []), r]);
  const plan: WeekPlan = { creates: [], updates: [], deactivations: [], adopt: [] };
  for (const day of week) {
    if (!day.isOpen) continue;
    for (const s of day.sessions) {
      const label = `${labels[day.dayOfWeek]} ${s.startTime}–${s.endTime}`;
      let row = s.id ? byId.get(s.id) : undefined;
      if (row && s.locked) continue;
      if (!row) { row = spare.get(day.dayOfWeek)?.shift(); if (row) kept.add(row.id); }
      if (row) {
        if (row.startTime !== s.startTime || row.endTime !== s.endTime || row.dayOfWeek !== day.dayOfWeek || row.isOpen === false)
          plan.updates.push({ id: row.id, key: s.key, label, body: fitQueueWindow({ ...rowInput(row), dayOfWeek: day.dayOfWeek, isOpen: true, startTime: s.startTime, endTime: s.endTime }) });
        else if (!s.id) plan.adopt.push({ key: s.key, id: row.id });
      } else if (template) {
        plan.creates.push({ key: s.key, label, body: fitQueueWindow({ ...Object.fromEntries(TEMPLATE_KEYS.filter(k => template[k] !== undefined && template[k] !== null && template[k] !== "").map(k => [k, template[k]])), breakStart: null, breakEnd: null, dayOfWeek: day.dayOfWeek, isOpen: true, startTime: s.startTime, endTime: s.endTime }) });
      }
    }
  }
  for (const r of active) if (!kept.has(r.id) && !r.linkedBranchId && r.isOpen !== false) plan.deactivations.push({ id: r.id, label: `${labels[r.dayOfWeek]} ${r.startTime}–${r.endTime}` });
  return plan;
}

export type Outcome = { label: string; ok: boolean; message?: string; skipped?: boolean };

/**
 * Runs writes in a safe order: updates, then creates, then deactivations. Deactivations run only when every
 * update and create succeeded, so no existing session is switched off while its replacement is unsaved.
 * Returns the ids now attached to draft keys so the caller can keep failed edits in the draft for retry.
 */
export async function executePlan(plan: WeekPlan, io: { update: (id: string, body: any) => Promise<unknown>; create: (body: any) => Promise<{ id: string }>; deactivate: (id: string) => Promise<unknown>; message: (e: unknown) => string }) {
  const outcomes: Outcome[] = []; const savedIds: Record<string, string> = Object.fromEntries(plan.adopt.map(a => [a.key, a.id])); const failedKeys = new Set<string>(); const failedDeactivations = new Set<string>();
  for (const u of plan.updates) { try { await io.update(u.id, u.body); savedIds[u.key] = u.id; outcomes.push({ label: `Update ${u.label}`, ok: true }); } catch (e) { failedKeys.add(u.key); outcomes.push({ label: `Update ${u.label}`, ok: false, message: io.message(e) }); } }
  for (const c of plan.creates) { try { const made = await io.create(c.body); savedIds[c.key] = made.id; outcomes.push({ label: `Add ${c.label}`, ok: true }); } catch (e) { failedKeys.add(c.key); outcomes.push({ label: `Add ${c.label}`, ok: false, message: io.message(e) }); } }
  const blocked = failedKeys.size > 0;
  for (const d of plan.deactivations) {
    if (blocked) { failedDeactivations.add(d.id); outcomes.push({ label: `Deactivate ${d.label}`, ok: false, skipped: true, message: "not run because another change failed; the session stays active" }); continue; }
    try { await io.deactivate(d.id); outcomes.push({ label: `Deactivate ${d.label}`, ok: true }); } catch (e) { failedDeactivations.add(d.id); outcomes.push({ label: `Deactivate ${d.label}`, ok: false, message: io.message(e) }); }
  }
  return { outcomes, savedIds, failedKeys, failedDeactivations };
}

/** After a partial save, keep the user's draft (including failed edits) and attach ids of records that were saved. */
export function reconcileDraft(week: DraftDay[], savedIds: Record<string, string>): DraftDay[] {
  return week.map(day => ({ ...day, sessions: day.sessions.map(s => savedIds[s.key] ? { ...s, id: savedIds[s.key] } : s) }));
}

export function weekSummary(week: DraftDay[], labels: string[], fmt: (t: string) => string) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const text = (d: DraftDay) => d.isOpen && d.sessions.length ? [...d.sessions].sort((a, b) => a.startTime.localeCompare(b.startTime)).map(s => `${fmt(s.startTime)} – ${fmt(s.endTime)}`).join(", ") : "Off";
  const groups: { from: number; to: number; value: string }[] = [];
  for (const day of order) {
    const value = text(week[day]); const last = groups[groups.length - 1];
    if (last && last.value === value) last.to = day; else groups.push({ from: day, to: day, value });
  }
  return groups.map(g => `${g.from === g.to ? labels[g.from] : `${labels[g.from]}–${labels[g.to]}`}: ${g.value}`).join(". ") + ".";
}

/** Clinic-linked sessions are changed only through Clinic settings; the generic per-session editor must not open for them. */
export const canOpenDetails = (row?: ScheduleRow | null) => !!row && !row.linkedBranchId;
export function openDetails(row: ScheduleRow | undefined, onEdit: (row: ScheduleRow) => void) { if (canOpenDetails(row)) onEdit(row!); }
