import { useState } from "react";
import type { Appointment } from "@workspace/api-client-react";
import { Copy, Check } from "lucide-react";
import { formatConfiguredTimestamp, formatDate, formatTime } from "../../lib/date-time";
import { title } from "../../resources";

const statusText = (status: string) => status === "called" ? "Called next" : title(status);

/** Private, authorized appointment data only; never render on a public ticket. */
export function AppointmentDetails({ appointment: a }: { appointment: Appointment }) {
  const timestamp = (value: string) => formatConfiguredTimestamp(value, a.timezone || undefined, {}, a);
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const copyReference = () => {
    if (!navigator.clipboard) { setCopied("failed"); return; }
    navigator.clipboard.writeText(a.reference).then(() => setCopied("done"), () => setCopied("failed"));
  };
  const session = `${a.startTime ? formatTime(a.startTime, a) : "—"}–${a.endTime ? formatTime(a.endTime, a) : "—"}`;
  return <section aria-label="Appointment details" className="appt-detail" data-testid="appointment-details">
    <header className="appt-detail-summary">
      <div>
        <h3 data-testid="text-detail-patient">{a.patientName}</h3>
        <div className="appt-detail-status"><span>Current status</span><span className={`badge ${a.status}`} data-testid="text-detail-status">{statusText(a.status)}</span></div>
      </div>
      <div className="appt-detail-token" data-testid="text-detail-token"><small>Token</small><strong>{a.token || "Not assigned"}</strong></div>
    </header>
    <dl className="appt-detail-grid">
      <div><dt>Doctor</dt><dd data-testid="text-detail-doctor">{a.doctorName}</dd></div>
      <div><dt>Clinic group</dt><dd data-testid="text-detail-clinic">{a.clinicName}</dd></div>
      <div><dt>Location</dt><dd data-testid="text-detail-location">{a.branchName}</dd></div>
      <div><dt>Visit date</dt><dd data-testid="text-detail-date">{formatDate(a.date, a)}</dd></div>
      <div><dt>Session</dt><dd data-testid="text-detail-session">{session}{a.timezone ? ` · ${a.timezone}` : ""}<small>Session window, not a promised consultation time.</small></dd></div>
      <div><dt>Reference</dt><dd className="appt-detail-ref"><code data-testid="text-detail-reference">{a.reference}</code><button type="button" onClick={copyReference} aria-label={`Copy reference ${a.reference}`} data-testid="button-copy-reference">{copied === "done" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{copied === "done" ? "Copied" : "Copy"}</button>{copied === "failed" && <small role="alert">Copy unavailable. Select the reference to copy it.</small>}</dd></div>
    </dl>
    <div className="appt-detail-block">
      <h4>Notes</h4>
      <p className={`appt-detail-notes${a.notes?.trim() ? "" : " appt-detail-empty"}`} data-testid="text-detail-notes">{a.notes?.trim() || "No notes recorded."}</p>
    </div>
    <div className="appt-detail-block">
      <h4>Consultation</h4>
      <dl className="appt-detail-grid">
        <div><dt>Consultation check-in</dt><dd data-testid="text-detail-checked-in">{a.checkedInAt ? timestamp(a.checkedInAt) : "Not recorded"}</dd></div>
        <div><dt>Consultation completed</dt><dd data-testid="text-detail-completed">{a.completedAt ? timestamp(a.completedAt) : "Not recorded"}</dd></div>
      </dl>
      <p className="muted" style={{ marginTop: 8, fontSize: "var(--type-label)" }}>Consultation check-in records entry into consultation, not arrival at the clinic.</p>
    </div>
    <div className="appt-detail-block">
      <h4>Status and Reason History</h4>
      {a.history?.length ? <ol className="appt-detail-history">{a.history.map((event, index) => <li key={`${event.occurredAt}-${index}`}>
        <strong>{title(event.action || event.status)}</strong> · {timestamp(event.occurredAt)}
        {event.reason && <p>{event.reason}</p>}
      </li>)}</ol> : <p className="appt-detail-empty">No history recorded.</p>}
    </div>
  </section>;
}
