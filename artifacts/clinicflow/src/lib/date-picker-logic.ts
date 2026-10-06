/** Pure date/time picker behaviour shared by DateFormatInput/TimeFormatInput and their tests.
 *  All dates are canonical YYYY-MM-DD, all times canonical HH:mm; min/max are inclusive. */
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const parts = (date: string) => [Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))] as const;

export function daysInMonth(year: number, monthIndex: number) { return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(); }
export function isLeapYear(year: number) { return daysInMonth(year, 1) === 29; }
export function addDays(date: string, days: number) { const [y, m, d] = parts(date); return toIso(new Date(Date.UTC(y, m, d + days))); }
/** Month shift clamps the day (31 Jan + 1 month = 28/29 Feb), never overflowing into the next month. */
export function addMonths(date: string, months: number) {
  const [y, m, d] = parts(date);
  return toIso(new Date(Date.UTC(y, m + months, Math.min(d, daysInMonth(y, m + months)))));
}
export function isOutOfRange(value: string, min?: string, max?: string) { return !!(min && value < min) || !!(max && value > max); }
export function clampToRange(value: string, min?: string, max?: string) { return min && value < min ? min : max && value > max ? max : value; }

/** Leading nulls pad to the first weekday (Sunday-first), followed by every day of the month. */
export function monthGrid(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return [...Array<null>(first).fill(null), ...Array.from({ length: daysInMonth(year, monthIndex) }, (_, i) => `${year}-${pad(monthIndex + 1)}-${pad(i + 1)}`)];
}

/** Initial focused day: the selection, else today clamped into [min, max]. */
export function initialFocus(value: string, today: string, min?: string, max?: string) { return value || clampToRange(today, min, max); }

export type CalendarKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "PageUp" | "PageDown" | "Home" | "End";
/** Keyboard navigation result, clamped to min/max so focus never lands on a disabled day.
 *  Returns null for keys the calendar does not handle. */
export function calendarKeyTarget(focus: string, key: string, min?: string, max?: string): string | null {
  const [y, m, d] = parts(focus);
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
  const next: Record<CalendarKey, () => string> = {
    ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1),
    ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
    PageUp: () => addMonths(focus, -1), PageDown: () => addMonths(focus, 1),
    Home: () => addDays(focus, -dow), End: () => addDays(focus, 6 - dow),
  };
  const fn = next[key as CalendarKey];
  return fn ? clampToRange(fn(), min, max) : null;
}

/** Time list entries at `step` minutes within [min, max]. A typed exact minute (e.g. 09:07) is merged in
 *  so the current selection is always visible and selectable. */
export function timeOptions(step: number, min?: string, max?: string, selected?: string): string[] {
  const s = Math.max(1, Math.floor(step) || 15), out: string[] = [];
  for (let t = 0; t < 1440; t += s) { const v = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; if (!isOutOfRange(v, min, max)) out.push(v); }
  if (selected && !isOutOfRange(selected, min, max) && !out.includes(selected)) { out.push(selected); out.sort(); }
  return out;
}

export interface Rect { top: number; left: number; bottom: number; right: number; width: number; height: number }
/** Popover placement inside its portal container (dialog content or document body).
 *  Prefers below the anchor, flips above when it would overflow the container's visible area,
 *  and clamps horizontally so the panel is never clipped. Coordinates are relative to the container. */
export function placePanel(anchor: Rect, container: Rect, panel: { width: number; height: number }, gap = 4, margin = 8, scroll = { x: 0, y: 0 }) {
  const below = anchor.bottom - container.top + gap;
  const above = anchor.top - container.top - gap - panel.height;
  const fitsBelow = below + panel.height <= container.height - margin;
  const top = fitsBelow || above < margin ? Math.max(margin, Math.min(below, container.height - margin - panel.height)) : above;
  const left = Math.max(margin, Math.min(anchor.left - container.left, container.width - margin - panel.width));
  return { top: top + scroll.y, left: left + scroll.x, placement: fitsBelow || above < margin ? "below" as const : "above" as const };
}

/** Inline drawer error for a date range filter; null when Apply may proceed.
 *  `required` ranges (reports) need both ends; optional ranges only reject inversion. */
export function rangeError(from: string, to: string, required = false, textInvalid = false): string | null {
  // Unparseable typed text clears the canonical value; don't misreport it as "empty".
  if (textInvalid) return "Enter valid start and end dates, with the end on or after the start.";
  if (required && (!from || !to)) return "Select both a start and end date.";
  if (from && to && from > to) return "Select an end date on or after the start date.";
  return null;
}

/** Month/year shortcut target: keeps the day where possible (clamped to month length) and to min/max. */
export function jumpTo(focus: string, year: number, monthIndex: number, min?: string, max?: string) {
  const day = Math.min(Number(focus.slice(8, 10)) || 1, daysInMonth(year, monthIndex));
  return clampToRange(`${year}-${pad(monthIndex + 1)}-${pad(day)}`, min, max);
}

/** Hour/minute/period column model for the time picker (no natural-language parsing). */
export function splitTime(value: string) { return { hour: Number(value.slice(0, 2)) || 0, minute: Number(value.slice(3, 5)) || 0 }; }
/** Display hours for a clock format: 12h lists 12,1..11; 24h lists 0..23. */
export function hourOptions(format: "12h" | "24h") { return format === "12h" ? [12, ...Array.from({ length: 11 }, (_, i) => i + 1)] : Array.from({ length: 24 }, (_, i) => i); }
export function toHour24(display: number, period: "AM" | "PM" | null) { return period ? (display % 12) + (period === "PM" ? 12 : 0) : display; }
export function composeTime(hour24: number, minute: number) { return `${pad(hour24)}:${pad(minute)}`; }
/** Minutes at `step`, with the current exact minute merged so typed values stay selectable. */
export function minuteOptions(step: number, selected?: number) {
  const s = Math.max(1, Math.floor(step) || 15), out: number[] = [];
  for (let m = 0; m < 60; m += s) out.push(m);
  if (selected !== undefined && !out.includes(selected)) { out.push(selected); out.sort((a, b) => a - b); }
  return out;
}
/** True when no minute of this 24h hour falls inside [min, max]. */
export function hourOutOfRange(hour24: number, min?: string, max?: string) { return !!(min && `${pad(hour24)}:59` < min) || !!(max && `${pad(hour24)}:00` > max); }

/** Two-click range selection: first click starts, second click ends (earlier second click restarts). */
export function rangeClick(range: { from: string; to: string }, day: string): { from: string; to: string } {
  if (!range.from || range.to || day < range.from) return { from: day, to: "" };
  return { from: range.from, to: day };
}
/** First day of the month containing `date`, shifted by `months`. */
export function monthOf(date: string, months = 0) { return addMonths(`${date.slice(0, 7)}-01`, months); }
