import { addDays } from "./date-picker-logic";

/** Timezone-safe visit range presets. All values are ISO dates (YYYY-MM-DD) computed from the
 *  clinic's configured "today" string, never from the browser's local Date. */
export type VisitPreset = "today" | "tomorrow" | "week" | "next7" | "month" | "nextMonth" | "last30" | "all" | "custom";
export const VISIT_PRESETS: { key: VisitPreset; label: string }[] = [
  { key: "today", label: "Today" }, { key: "tomorrow", label: "Tomorrow" }, { key: "week", label: "This week" },
  { key: "next7", label: "Next 7 days" }, { key: "month", label: "This month" }, { key: "nextMonth", label: "Next month" },
  { key: "last30", label: "Last 30 days" }, { key: "all", label: "All dates" }, { key: "custom", label: "Custom" },
];
const pad = (n: number) => String(n).padStart(2, "0");
const parts = (d: string) => d.split("-").map(Number) as [number, number, number];
export const monthStart = (d: string) => { const [y, m] = parts(d); return `${y}-${pad(m)}-01`; };
export const monthEnd = (d: string) => { const [y, m] = parts(d); return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`; };
export const shiftMonth = (d: string, n: number) => { const [y, m] = parts(d); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-01`; };
/** ISO weekday, Monday = 0. */
export const weekday = (d: string) => { const [y, m, day] = parts(d); return (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7; };

export function presetRange(preset: VisitPreset, today: string): { from: string; to: string } {
  switch (preset) {
    case "today": return { from: today, to: today };
    case "tomorrow": { const t = addDays(today, 1); return { from: t, to: t }; }
    case "week": { const s = addDays(today, -weekday(today)); return { from: s, to: addDays(s, 6) }; }
    case "next7": return { from: today, to: addDays(today, 6) };
    case "month": return { from: monthStart(today), to: monthEnd(today) };
    case "nextMonth": { const s = shiftMonth(today, 1); return { from: s, to: monthEnd(s) }; }
    case "last30": return { from: addDays(today, -29), to: today };
    default: return { from: "", to: "" };
  }
}
export function detectPreset(from: string, to: string, today: string): VisitPreset {
  if (!from && !to) return "all";
  return VISIT_PRESETS.find(p => p.key !== "custom" && p.key !== "all" && (() => { const r = presetRange(p.key, today); return r.from === from && r.to === to; })())?.key ?? "custom";
}
/** Period stepping: moves the range by its own length; whole months step by calendar month. */
export function stepRange(from: string, to: string, dir: 1 | -1): { from: string; to: string } {
  if (!from || !to) return { from, to };
  if (from === monthStart(from) && to === monthEnd(from)) { const s = shiftMonth(from, dir); return { from: s, to: monthEnd(s) }; }
  const [a, b] = [parts(from), parts(to)];
  const days = Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000) + 1;
  return { from: addDays(from, days * dir), to: addDays(to, days * dir) };
}
/** Month grid (Monday-first) with null padding cells. */
export function monthGrid(anyDayInMonth: string): (string | null)[] {
  const s = monthStart(anyDayInMonth), e = monthEnd(anyDayInMonth);
  const cells: (string | null)[] = Array(weekday(s)).fill(null);
  for (let d = s; d <= e; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}
