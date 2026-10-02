import type { Appointment } from "@workspace/api-client-react";
import { formatConfiguredTimestamp } from "../../lib/date-time";
import { title } from "../../resources";

/** Private, authorized appointment data only; never render on a public ticket. */
export function AppointmentDetails({ appointment: a }: { appointment: Appointment }) {
  const timestamp = (value: string) => formatConfiguredTimestamp(value, a.timezone || undefined, {}, a);
  return <section aria-label="Appointment details">
    <p><strong>{a.patientName}</strong> · {a.reference}</p>
    <dl>
      <dt>Notes</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{a.notes?.trim() || "No notes recorded."}</dd>
      <dt>Consultation check-in</dt><dd>{a.checkedInAt ? timestamp(a.checkedInAt) : "Not recorded"}</dd>
      <dt>Consultation completed</dt><dd>{a.completedAt ? timestamp(a.completedAt) : "Not recorded"}</dd>
    </dl>
    <p className="muted">Consultation check-in records entry into consultation, not arrival at the clinic.</p>
    <h3>Status and reason history</h3>
    {a.history?.length ? <ol>{a.history.map((event, index) => <li key={`${event.occurredAt}-${index}`}>
      <strong>{title(event.action || event.status)}</strong> · {timestamp(event.occurredAt)}
      {event.reason && <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{event.reason}</p>}
    </li>)}</ol> : <p>No history recorded.</p>}
  </section>;
}