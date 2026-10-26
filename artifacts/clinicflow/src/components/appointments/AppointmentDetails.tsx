import { useEffect, type ReactNode } from "react";
import type { Appointment } from "@workspace/api-client-react";
import { useGetAppointment, getGetAppointmentQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { formatConfiguredTimestamp, formatDate, formatTime } from "../../lib/date-time";
import { ErrorNotice, title } from "../../resources";
import { bookingFields } from "../booking/booking-fields";
import { AppointmentBookingTab, CopyReference } from "./AppointmentBookingTab";
import { isPrivateAppointmentUnavailable } from "./presentation";
import { clearBookingDraft } from "./booking-drafts";
import { useBookingDraftGuard } from "./booking-draft-guard";

const statusText = (status: string) => status === "called" ? "Called next" : title(status);

/** Private, authorized appointment data only; never render on a public ticket. Tabs: Booking (default), Details, Consultation, History. */
export function AppointmentDetails(props: { appointment: Appointment; supplementaryDetails?: ReactNode }) {
  // Keep the permission-checked record current while ANY section is open,
  // including calendar consumers that began with an authorized list projection.
  const authorized = useGetAppointment(props.appointment.id, { query: {
    queryKey: getGetAppointmentQueryKey(props.appointment.id), refetchInterval: 30000, retry: false,
  } });
  useBookingDraftGuard();
  const lost = isPrivateAppointmentUnavailable(authorized.error);
  // Authorization loss hides every private draft and dialog along with the record.
  useEffect(() => { if (lost) clearBookingDraft(props.appointment.id); }, [lost, props.appointment.id]);
  if (lost) return <div>
    <ErrorNotice error={authorized.error} />
    <button type="button" onClick={() => void authorized.refetch()}>Retry Details</button>
  </div>;
  return <AppointmentDetailsInner key={props.appointment.id} {...props} appointment={authorized.data || props.appointment} />;
}

function AppointmentDetailsInner({ appointment: a, supplementaryDetails }: { appointment: Appointment; supplementaryDetails?: ReactNode }) {
  const timestamp = (value: string) => formatConfiguredTimestamp(value, a.timezone || undefined, {}, a);
  const session = `${a.startTime ? formatTime(a.startTime, a) : "—"}–${a.endTime ? formatTime(a.endTime, a) : "—"}`;
  return <section aria-label="Appointment details" className="appt-detail" data-testid="appointment-details">
    <header className="appt-detail-summary" data-testid="appointment-summary">
      <div className="appt-sum-id">
        <h3 data-testid="text-detail-patient"><span className="appt-sum-name">{a.patientName}</span> <span className={`badge ${a.status}`} data-testid="text-detail-status">{statusText(a.status)}</span></h3>
        <p className="appt-sum-refs"><span data-testid="text-detail-token">Token: <strong>{a.token || "Not assigned"}</strong></span><span>Ref: <CopyReference reference={a.reference} /></span></p>
      </div>
      <dl className="appt-sum-context" data-testid="text-detail-context">
        <div><dt>Visit</dt><dd>{formatDate(a.date, a)}<small>{session}</small></dd></div>
        <div><dt>Clinic / location</dt><dd>{a.clinicName}<small>{a.branchName}</small></dd></div>
        <div><dt>Doctor</dt><dd>{a.doctorName}</dd></div>
      </dl>
    </header>
    <Tabs defaultValue="booking" className="appt-tabs">
      <TabsList className="appt-tabs-list" aria-label="Appointment detail sections">
        <TabsTrigger value="booking" className="appt-tab" data-testid="tab-detail-booking">Booking</TabsTrigger>
        <TabsTrigger value="details" className="appt-tab" data-testid="tab-detail-details">Details</TabsTrigger>
        <TabsTrigger value="consultation" className="appt-tab" data-testid="tab-detail-consultation">Consultation</TabsTrigger>
        <TabsTrigger value="history" className="appt-tab" data-testid="tab-detail-history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="booking" className="appt-tab-panel">
        <AppointmentBookingTab appointment={a} />
      </TabsContent>
      <TabsContent value="details" className="appt-tab-panel">
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
              <div><dt>{bookingFields.date.label}</dt><dd data-testid="text-detail-date">{formatDate(a.date, a)}</dd></div>
              <div><dt>{bookingFields.session.label}</dt><dd data-testid="text-detail-session">{session}{a.timezone ? ` · ${a.timezone}` : ""}<small>Session window, not a promised consultation time.</small></dd></div>
              <div><dt>{bookingFields.clinic.label}</dt><dd data-testid="text-detail-clinic">{a.clinicName}</dd></div>
              <div><dt>{bookingFields.location.label}</dt><dd data-testid="text-detail-location">{a.branchName}{a.branchAddress && <small>{a.branchAddress}</small>}</dd></div>
            </dl>
          </div>
          <div className="appt-detail-block" data-testid="section-detail-provider">
            <h4>Provider</h4>
            <dl className="appt-detail-grid">
              <div className="span-2"><dt>{bookingFields.doctor.label}</dt><dd data-testid="text-detail-doctor">{a.doctorName}</dd></div>
            </dl>
          </div>
          {supplementaryDetails && <div className="appt-detail-block appt-detail-extra" data-testid="section-detail-supplementary">{supplementaryDetails}</div>}
        </div>
      </TabsContent>
      <TabsContent value="consultation" className="appt-tab-panel">
        <div className="appt-detail-block" data-testid="section-detail-consultation">
          <h4>Consultation</h4>
          <dl className="appt-detail-grid">
            <div><dt>Consultation check-in</dt><dd data-testid="text-detail-checked-in">{a.checkedInAt ? timestamp(a.checkedInAt) : "Not recorded"}</dd></div>
            <div><dt>Consultation completed</dt><dd data-testid="text-detail-completed">{a.completedAt ? timestamp(a.completedAt) : "Not recorded"}</dd></div>
          </dl>
          <p className="muted" style={{ marginTop: 8, fontSize: "var(--type-label)" }}>Consultation check-in records entry into consultation, not arrival at the clinic.</p>
        </div>
      </TabsContent>
      <TabsContent value="history" className="appt-tab-panel">
        <div className="appt-detail-block" data-testid="section-detail-history">
          <h4>Status and Reason History</h4>
          {a.history?.length ? <ol className="appt-detail-history">{a.history.map((event, index) => <li key={`${event.occurredAt}-${index}`}>
            <strong>{title(event.action || event.status)}</strong> · {timestamp(event.occurredAt)}
            {event.status && event.action && <span className="appt-detail-hstatus"> · Status: {statusText(event.status)}</span>}
            {event.reason && <p>{event.reason}</p>}
          </li>)}</ol> : <p className="appt-detail-empty" data-testid="text-detail-history-empty">No history recorded.</p>}
        </div>
      </TabsContent>
    </Tabs>
  </section>;
}
