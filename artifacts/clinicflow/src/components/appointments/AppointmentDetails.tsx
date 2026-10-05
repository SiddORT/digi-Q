import { useState } from "react";
import type { Appointment } from "@workspace/api-client-react";
import { Copy, Check, QrCode } from "lucide-react";
import { formatConfiguredTimestamp, formatDate, formatTime } from "../../lib/date-time";
import { title } from "../../resources";
import { AppointmentTicket } from "./AppointmentTicket";
import { canShowAppointmentTicket } from "./presentation";

const statusText = (status: string) => status === "called" ? "Called next" : title(status);

/** Private, authorized appointment data only; never render on a public ticket.
 *  Sections: Patient, Visit, Provider, Booking, Ticket & QR, Consultation, History. Nothing from the earlier
 *  flat layout is dropped; the full ticket (QR, download, print, status, guidance) now lives here instead of a row button. */
export function AppointmentDetails({ appointment: a }: { appointment: Appointment }) {
  const timestamp = (value: string) => formatConfiguredTimestamp(value, a.timezone || undefined, {}, a);
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const copyReference = () => {
    if (!navigator.clipboard) { setCopied("failed"); return; }
    navigator.clipboard.writeText(a.reference).then(() => setCopied("done"), () => setCopied("failed"));
  };
  const session = `${a.startTime ? formatTime(a.startTime, a) : "—"}–${a.endTime ? formatTime(a.endTime, a) : "—"}`;
  const [ticketOpen, setTicketOpen] = useState(false);
  return <section aria-label="Appointment details" className="appt-detail" data-testid="appointment-details">
    <header className="appt-detail-summary">
      <div>
        <h3 data-testid="text-detail-patient">{a.patientName}</h3>
        <div className="appt-detail-status"><span>Current status</span><span className={`badge ${a.status}`} data-testid="text-detail-status">{statusText(a.status)}</span>
</div>
      </div>
      <div className="appt-detail-token" data-testid="text-detail-token"><small>Token</small><strong>{a.token || "Not assigned"}</strong></div>
    </header>

    <div className="appt-detail-cols">
    <div className="appt-detail-block" data-testid="section-detail-patient">
      <h4>Patient</h4>
      <dl className="appt-detail-grid">
        <div><dt>Name</dt><dd>{a.patientName}</dd></div>
        <div><dt>Patient ID</dt><dd className="mono" data-testid="text-detail-patient-code">{a.patientCode || "Not recorded"}</dd></div>
      </dl>
    </div>

    <div className="appt-detail-block" data-testid="section-detail-visit">
      <h4>Visit</h4>
      <dl className="appt-detail-grid">
        <div><dt>Visit date</dt><dd data-testid="text-detail-date">{formatDate(a.date, a)}</dd></div>
        <div><dt>Session</dt><dd data-testid="text-detail-session">{session}{a.timezone ? ` · ${a.timezone}` : ""}<small>Session window, not a promised consultation time.</small></dd></div>
        <div><dt>Clinic group</dt><dd data-testid="text-detail-clinic">{a.clinicName}</dd></div>
        <div><dt>Location</dt><dd data-testid="text-detail-location">{a.branchName}{a.branchAddress && <small>{a.branchAddress}</small>}</dd></div>
      </dl>
    </div>

    <div className="appt-detail-block" data-testid="section-detail-provider">
      <h4>Provider</h4>
      <dl className="appt-detail-grid">
        <div className="span-2"><dt>Doctor</dt><dd data-testid="text-detail-doctor">{a.doctorName}</dd></div>
      </dl>
    </div>

    <div className="appt-detail-block" data-testid="section-detail-booking">
      <h4>Booking</h4>
      <dl className="appt-detail-grid">
        <div><dt>Reference</dt><dd className="appt-detail-ref"><code data-testid="text-detail-reference">{a.reference}</code><button type="button" onClick={copyReference} aria-label={`Copy reference ${a.reference}`} data-testid="button-copy-reference">{copied === "done" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{copied === "done" ? "Copied" : "Copy"}</button>{canShowAppointmentTicket(a) && <button type="button" className="appt-detail-jump" aria-expanded={ticketOpen} aria-controls={`appt-ticket-${a.id}`} onClick={() => setTicketOpen(v => !v)} data-testid="button-detail-jump-ticket"><QrCode size={13} aria-hidden />{ticketOpen ? "Hide Ticket & QR" : "Ticket & QR"}</button>}{copied === "failed" && <small role="alert">Copy unavailable. Select the reference to copy it.</small>}</dd></div>
        <div><dt>Booked at</dt><dd data-testid="text-detail-booked">{timestamp(a.createdAt)}<small>When the booking was created, not the visit time.</small></dd></div>
        <div className="span-2"><dt>Notes</dt><dd><p className={`appt-detail-notes${a.notes?.trim() ? "" : " appt-detail-empty"}`} data-testid="text-detail-notes">{a.notes?.trim() || "No notes recorded."}</p></dd></div>
      </dl>
    </div>

    {(ticketOpen || !canShowAppointmentTicket(a)) && <div className="appt-detail-block appt-detail-ticket span-2" style={{ gridColumn: "1/-1" }} id={`appt-ticket-${a.id}`} data-testid="section-detail-ticket">
      <h4>Ticket &amp; QR</h4>
      {canShowAppointmentTicket(a)
        ? <AppointmentTicket id={a.id} />
        : <p className="appt-detail-empty" data-testid="text-detail-ticket-unavailable">Completed visits do not need a ticket. The booking reference above remains available for records.</p>}
    </div>}

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
    </div>
  </section>;
}
