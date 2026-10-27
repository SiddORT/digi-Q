import type { Appointment, StatusEvent } from "@workspace/api-client-react";
import { formatDate, formatTime } from "../../lib/date-time";
import { title } from "../../resources";

type HistorySnapshot = NonNullable<StatusEvent["from"]>;
export const privatePatientOf = (a: Appointment) => a.privatePatient;

export const statusText = (status: string) => status === "called" ? "Called next" : title(status);

/** Newest first; ties keep recorded order reversed so the later write leads. Invalid instants sink, never dropped. */
export function sortHistory(history: readonly StatusEvent[]): StatusEvent[] {
  return history.map((event, index) => ({ event, index, t: Date.parse(event.occurredAt) }))
    .sort((x, y) => (Number.isFinite(y.t) ? y.t : -Infinity) - (Number.isFinite(x.t) ? x.t : -Infinity) || y.index - x.index)
    .map(x => x.event);
}

export function actorLabel(e: StatusEvent): { name: string; role?: string; muted: boolean } {
  const role = e.actorRecordedRole ? title(e.actorRecordedRole) : undefined;
  switch (e.actorState) {
    case "named": return e.actorDisplayName?.trim() ? { name: e.actorDisplayName.trim(), role, muted: false } : { name: "Name unavailable", role, muted: true };
    case "system": return { name: "System", muted: true };
    case "receipt": return { name: "Guest receipt", muted: true };
    case "deleted": return { name: "Removed user", role, muted: true };
    case "unavailable": return { name: "Not available to you", muted: true };
    case "unknown": return { name: "Not recorded", muted: true };
    default: return e.actorDisplayName?.trim() ? { name: e.actorDisplayName.trim(), role, muted: false } : { name: "Not recorded", muted: true };
  }
}

/** Wall-clock snapshot range. Times are only stated as appointment-local if the snapshot recorded the same zone. */
export function snapshotText(s: HistorySnapshot | undefined, zone: string | null | undefined, prefs: Parameters<typeof formatDate>[1]): string | undefined {
  if (!s || (!s.date && !s.startTime)) return undefined;
  const date = s.date ? formatDate(s.date, prefs) : "Date not recorded";
  const range = s.startTime ? `${formatTime(s.startTime, prefs)}${s.endTime ? `–${formatTime(s.endTime, prefs)}` : ""}` : "";
  const tz = !s.startTime ? "" : !s.timezone ? " (original timezone not recorded)" : zone && s.timezone !== zone ? ` (${s.timezone})` : "";
  return `${date}${range ? `, ${range}` : ""}${tz}`;
}
