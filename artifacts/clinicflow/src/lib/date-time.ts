/** Display-only preferences. Calendar dates and wall times never pass through Date. */
export const DATE_FORMATS = ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
export const TIME_FORMATS = ["12h", "24h"] as const;
export type DateTimePreferences = { dateFormat: typeof DATE_FORMATS[number]; timeFormat: typeof TIME_FORMATS[number] };
export const DEFAULT_DATE_TIME_PREFERENCES: DateTimePreferences = { dateFormat: "DD MMM YYYY", timeFormat: "12h" };
type Preferences = Partial<DateTimePreferences> | null;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
export function resolveDateTimePreferences(value?: Preferences): DateTimePreferences {
  return {
    dateFormat: DATE_FORMATS.includes(value?.dateFormat as any) ? value!.dateFormat! : DEFAULT_DATE_TIME_PREFERENCES.dateFormat,
    timeFormat: TIME_FORMATS.includes(value?.timeFormat as any) ? value!.timeFormat! : DEFAULT_DATE_TIME_PREFERENCES.timeFormat,
  };
}
export function isCanonicalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
export function isCanonicalTime(value: string): boolean { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function formatDate(value: string, preferences?: Preferences): string {
  if (!isCanonicalDate(value)) return "Invalid date";
  const [y, m, d] = value.split("-");
  switch (resolveDateTimePreferences(preferences).dateFormat) {
    case "YYYY-MM-DD": return value;
    case "DD/MM/YYYY": return `${d}/${m}/${y}`;
    case "MM/DD/YYYY": return `${m}/${d}/${y}`;
    default: return `${d} ${months[Number(m) - 1]} ${y}`;
  }
}
export function formatTime(value: string, preferences?: Preferences): string {
  if (!isCanonicalTime(value)) return "Invalid time";
  if (resolveDateTimePreferences(preferences).timeFormat === "24h") return value;
  const [h, m] = value.split(":");
  return `${Number(h) % 12 || 12}:${m} ${Number(h) < 12 ? "AM" : "PM"}`;
}
export function formatTimeRange(start: string, end: string, preferences?: Preferences) {
  return `${formatTime(start, preferences)} – ${formatTime(end, preferences)}`;
}
/** Typed display input only; null signals an inline validation error. */
export function parseDateInput(value: string, preferences?: Preferences): string | null {
  const format = resolveDateTimePreferences(preferences).dateFormat;
  let canonical = value.trim();
  if (format === "DD MMM YYYY") {
    const match = /^(\d{2}) ([A-Za-z]{3}) (\d{4})$/.exec(canonical);
    if (!match) return null;
    const month = months.findIndex(m => m.toLowerCase() === match[2].toLowerCase()) + 1;
    canonical = `${match[3]}-${pad(month)}-${match[1]}`;
  } else if (format !== "YYYY-MM-DD") {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(canonical);
    if (!match) return null;
    canonical = format === "DD/MM/YYYY" ? `${match[3]}-${match[2]}-${match[1]}` : `${match[3]}-${match[1]}-${match[2]}`;
  }
  return isCanonicalDate(canonical) ? canonical : null;
}
export function parseTimeInput(value: string, preferences?: Preferences): string | null {
  let canonical = value.trim();
  if (resolveDateTimePreferences(preferences).timeFormat === "12h") {
    const match = /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/i.exec(canonical);
    if (!match) return null;
    canonical = `${pad(Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0))}:${match[2]}`;
  }
  return isCanonicalTime(canonical) ? canonical : null;
}
/** Offset-bearing instants only. A wall time is not an instant, especially at DST boundaries. */
export function formatConfiguredTimestamp(value: string | Date, timezone?: string, options: Intl.DateTimeFormatOptions = {}, preferences?: Preferences) {
  if (typeof value === "string" && (!/T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !isCanonicalDate(value.slice(0, 10)))) return "Invalid date";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  if (!timezone) return `${date.toISOString()} (timezone unavailable)`;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const day = formatDate(`${p.year.padStart(4, "0")}-${p.month}-${p.day}`, preferences);
    const time = formatTime(`${p.hour}:${p.minute}`, preferences);
    const onlyTime = (options.hour || options.timeStyle) && !(options.year || options.month || options.day || options.dateStyle);
    const onlyDate = (options.year || options.month || options.day || options.dateStyle) && !(options.hour || options.timeStyle);
    return onlyTime ? time : onlyDate ? day : `${day}, ${time}`;
  } catch { return "Invalid timezone"; }
}
export function configuredGreeting(timezone?: string, now = new Date()) {
  if (!timezone) return "Hello";
  try {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now));
    return `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}`;
  } catch { return "Hello"; }
}