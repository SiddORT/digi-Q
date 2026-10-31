import type { DraftDay } from "./week-plan";

/** Supported common consultation durations (minutes). Legacy values are preserved, never rewritten silently. */
export const WEEK_DURATIONS = [20, 30, 60];

const valid = (v: unknown) => v !== undefined && v !== null && v !== "" && Number.isInteger(Number(v)) && Number(v) > 0;

/** Common duration across every editable session in the week (including retained off-day drafts).
 *  Missing values fall back to template.consultationMinutes. value is "" when mixed or unknown. */
export function weekDuration(week: DraftDay[], template?: Record<string, unknown>): { value: string; mixed: boolean; values: number[] } {
  const fallback = valid(template?.consultationMinutes) ? Number(template!.consultationMinutes) : undefined;
  const set = new Set<number>();
  for (const d of week) for (const s of d.sessions) {
    const v = s.settings?.consultationMinutes;
    if (valid(v)) set.add(Number(v)); else if (fallback !== undefined) set.add(fallback);
  }
  if (!set.size && fallback !== undefined) set.add(fallback);
  const values = [...set].sort((a, b) => a - b);
  return { value: values.length === 1 ? String(values[0]) : "", mixed: values.length > 1, values };
}

/** Sets consultationMinutes on every editable session (all days, off days included); other settings kept. */
export function applyWeekDuration(week: DraftDay[], minutes: number): DraftDay[] {
  return week.map(d => ({ ...d, sessions: d.sessions.map(s => s.locked ? s : { ...s, settings: { ...s.settings, consultationMinutes: minutes } }) }));
}

/** Fills only missing durations (e.g. new or copied slots); existing values untouched. */
export function ensureWeekDuration(week: DraftDay[], minutes?: number): DraftDay[] {
  if (!minutes || !WEEK_DURATIONS.includes(minutes)) return week;
  return week.map(d => ({ ...d, sessions: d.sessions.map(s => s.locked || valid(s.settings?.consultationMinutes) ? s : { ...s, settings: { ...s.settings, consultationMinutes: minutes } }) }));
}

/** True when new (unsaved, no id) editable slots lack a supported duration: a common supported choice is required before creating. */
export function needsWeekDurationChoice(week: DraftDay[]): boolean {
  return week.some(d => d.isOpen && d.sessions.some(s => !s.locked && !s.id && !WEEK_DURATIONS.includes(Number(s.settings?.consultationMinutes))));
}
