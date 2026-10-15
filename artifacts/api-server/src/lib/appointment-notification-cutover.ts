import { appointmentNotificationTarget } from "./appointment-notification-scope";

/** Compare session wall time using its own timezone. A due instant before cutover
 * cannot be captured by a poll during the same minute just after cutover.
 * Upcoming sessions whose one-hour reminder falls after cutover remain eligible.
 */
export function appointmentCaptureAfterCutover(event: string, recipient: string, cutoff: number, row: any, now = Date.now()) {
  if (!appointmentNotificationTarget(event, recipient) || !cutoff) return true;
  if (event !== "reminder") return now >= cutoff;
  if (!row.date || !row.startTime || !row.timezone) return false;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(cutoff + 3600000)).map(p => [p.type, p.value]));
    return `${row.date}T${row.startTime}` > `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch { return false; }
}
