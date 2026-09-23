/** Calendar dates (YYYY-MM-DD) must remain strings; only timestamp instants are converted. */
export function formatConfiguredTimestamp(value: string | Date, timezone?: string, options: Intl.DateTimeFormatOptions = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  if (!timezone) return `${date.toISOString()} (timezone unavailable)`;
  return date.toLocaleString(undefined, { timeZone: timezone, ...options });
}

export function configuredGreeting(timezone?: string, now = new Date()) {
  if (!timezone) return "Hello";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now));
  return `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}`;
}