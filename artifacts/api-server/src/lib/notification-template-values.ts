import { clinicDisplayPreferences } from "./display-preferences";

/** Use the configured public site, never a request host or a private ticket URL. */
export function clinicBookingLink(clinic: any, origin = process.env.CLINICFLOW_PUBLIC_ORIGIN) {
  const slug = clinic?.slug ?? clinic?.data?.slug;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !origin) return "";
  try {
    const site = new URL(origin);
    if (site.protocol !== "https:" || site.username || site.password || site.search || site.hash || site.pathname !== "/") return "";
    return `${site.origin}/${encodeURIComponent(slug)}`;
  } catch { return ""; }
}

/** Calendar dates and session clocks are already in the visit timezone.
 * Never convert these into the server timezone or promise a consultation time. */
export function formatTemplateSession(row: any, clinic: any) {
  const preferences = clinicDisplayPreferences(clinic);
  const date = String(row?.date || "");
  const instant = new Date(`${date}T00:00:00Z`);
  let formattedDate = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === date) {
    const [year, month, day] = date.split("-");
    formattedDate = preferences.dateFormat === "DD/MM/YYYY" ? `${day}/${month}/${year}`
      : preferences.dateFormat === "MM/DD/YYYY" ? `${month}/${day}/${year}`
      : preferences.dateFormat === "YYYY-MM-DD" ? date
      : `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]} ${year}`;
  }
  const time = (value: unknown) => {
    const clock = String(value || "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) return "";
    if (preferences.timeFormat === "24h") return clock;
    const [hour, minute] = clock.split(":");
    return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
  };
  return { date: formattedDate, start: time(row?.startTime), end: time(row?.endTime) };
}

export const visitVariables = ["recipient_name", "appointment_date", "session_start", "session_end",
  "previous_date", "previous_session_start", "previous_session_end", "queue_token", "token_number", "cancel_reason"] as const;

/** Save only the old session fields needed for reschedule substitution, not the entire old visit. */
export function previousSessionSnapshot(row: any) {
  return row && typeof row === "object"
    ? { date: row.date, startTime: row.startTime, endTime: row.endTime }
    : undefined;
}

export function visitTemplateValues(row: any, clinic: any, recipientName: string, previous?: any) {
  const current = formatTemplateSession(row, clinic);
  const old = formatTemplateSession(previous, clinic);
  // Use the cancellation event in this immutable visit snapshot, never another
  // action's reason or an earlier cancellation after the visit was reopened.
  const cancellation = row?.status === "cancelled" && Array.isArray(row.history)
    ? [...row.history].reverse().find((entry: any) => entry?.action === "cancel" && entry?.status === "cancelled")
    : undefined;
  const cancelReason = typeof cancellation?.reason === "string" ? cancellation.reason.trim() : "";
  return {
    booking_link: clinicBookingLink(clinic),
    recipient_name: recipientName || "",
    appointment_date: current.date, session_start: current.start, session_end: current.end,
    previous_date: old.date, previous_session_start: old.start, previous_session_end: old.end,
    queue_token: String(row?.token ?? ""),
    token_number: row?.tokenNumber == null ? "" : String(row.tokenNumber),
    cancel_reason: row?.status === "cancelled" ? cancelReason || "Not specified" : "",
  };
}

/** Newly supported fields must never silently disappear from a dispatched message.
 * Older queued jobs have no structured previous session; do not guess it from prose. */
export function missingVisitVariables(texts: string[], values: Record<string, string>) {
  return texts.flatMap(text => [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)]
    .map(match => match[1]))
    .filter(name => ((visitVariables as readonly string[]).includes(name) || name === "booking_link") && !values[name]?.trim());
}
