import { TabIcon } from "../TabIcon";
import { useEffect, type ReactNode } from "react";
import { History } from "lucide-react";
import type { Appointment } from "@workspace/api-client-react";
import { useGetAppointment, getGetAppointmentQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { formatConfiguredTimestamp, formatDate, formatTime } from "../../lib/date-time";
import { ErrorNotice, title } from "../../resources";
import { EmptyState } from "../EmptyState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { AppointmentBookingTab, CopyReference } from "./AppointmentBookingTab";
import { isPrivateAppointmentUnavailable } from "./presentation";
import { clearBookingDraft } from "./booking-drafts";
import { useBookingDraftGuard } from "./booking-draft-guard";

const statusText = (status: string) => status === "called" ? "Called next" : title(status);

type DetailsProps = { appointment: Appointment; supplementaryDetails?: ReactNode; rowContext?: boolean };

/** Private, authorized appointment data only; never render on a public ticket. */
export function AppointmentDetails(props: DetailsProps) {
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
  return <AppointmentDetailsInner key={props.appointment.id} {...props} appointment={authorized.data || props.appointment}
    historyLoading={!authorized.data && authorized.isPending} historyError={authorized.error}
    history={authorized.data?.history} retryHistory={() => void authorized.refetch()} />;
}

function AppointmentDetailsInner({ appointment: a, supplementaryDetails, rowContext, history, historyLoading, historyError, retryHistory }: DetailsProps & {
  history: Appointment["history"]; historyLoading: boolean; historyError: unknown; retryHistory: () => void;
}) {
  const timestamp = (value: string) => formatConfiguredTimestamp(value, a.timezone || undefined, {}, a);
  const session = `${a.startTime ? formatTime(a.startTime, a) : "—"}–${a.endTime ? formatTime(a.endTime, a) : "—"}`;
  return <section aria-label="Appointment details" className="appt-detail" data-testid="appointment-details">
    {rowContext ? <div className="appt-sum-refs" aria-label="Booking reference"><CopyReference reference={a.reference} /></div> : <header className="appt-detail-summary" data-testid="appointment-summary">
      <div className="appt-sum-id">
        <h3 data-testid="text-detail-patient"><span className="appt-sum-name">{a.patientName}</span> <span className={`badge ${a.status}`} data-testid="text-detail-status">{statusText(a.status)}</span></h3>
        <p className="appt-sum-refs"><span data-testid="text-detail-token">Token: <strong>{a.token || "Not assigned"}</strong></span><span>Ref: <CopyReference reference={a.reference} /></span></p>
      </div>
      <dl className="appt-sum-context" data-testid="text-detail-context">
        <div><dt>Visit</dt><dd>{formatDate(a.date, a)}<small>{session}</small></dd></div>
        <div><dt>Clinic / location</dt><dd>{a.clinicName}<small>{a.branchName}</small></dd></div>
        <div><dt>Doctor</dt><dd>{a.doctorName}</dd></div>
      </dl>
    </header>}
    <Tabs defaultValue="booking" className="appt-tabs">
      <TabsList className="appt-tabs-list" aria-label="Appointment detail sections">
        <TabsTrigger value="booking" className="appt-tab" data-testid="tab-detail-booking"><TabIcon name="booking"/>Booking</TabsTrigger>
        <TabsTrigger value="details" className="appt-tab" data-testid="tab-detail-details"><TabIcon name="details"/>Details</TabsTrigger>
        <TabsTrigger value="history" className="appt-tab" data-testid="tab-detail-history"><TabIcon name="history"/>History</TabsTrigger>
      </TabsList>
      <TabsContent value="booking" className="appt-tab-panel">
        <AppointmentBookingTab appointment={a} />
      </TabsContent>
      <TabsContent value="details" className="appt-tab-panel">
        <div className="appt-detail-cols">
          <div className="appt-detail-block" data-testid="section-detail-additional">
            <h4>Additional information</h4>
            <dl className="appt-detail-grid">
              {!rowContext && <div><dt>Patient ID</dt><dd className="mono" data-testid="text-detail-patient-code">{a.patientCode || "Not recorded"}</dd></div>}
              {a.branchAddress && <div><dt>Location address</dt><dd>{a.branchAddress}</dd></div>}
              <div><dt>Timezone</dt><dd>{a.timezone || "Not recorded"}</dd></div>
            </dl>
            <p className="muted">Session window, not a promised consultation time.</p>
            {supplementaryDetails && <div data-testid="section-detail-supplementary">{supplementaryDetails}</div>}
          </div>
        <div className="appt-detail-block" data-testid="section-detail-consultation">
          <h4>Consultation</h4>
          <dl className="appt-detail-grid">
            <div><dt>Consultation check-in</dt><dd data-testid="text-detail-checked-in">{a.checkedInAt ? timestamp(a.checkedInAt) : "Not recorded"}</dd></div>
            <div><dt>Consultation completed</dt><dd data-testid="text-detail-completed">{a.completedAt ? timestamp(a.completedAt) : "Not recorded"}</dd></div>
          </dl>
          <p className="muted">Consultation check-in records entry into consultation, not arrival at the clinic.</p>
        </div>
        </div>
      </TabsContent>
      <TabsContent value="history" className="appt-tab-panel">
        <div className="appt-detail-block" data-testid="section-detail-history">
          {historyError ? <><ErrorNotice error={historyError} /><button type="button" className="button secondary" onClick={retryHistory}>Retry History</button></>
            : historyLoading ? <p role="status">Loading history…</p>
            : !history ? <p role="status">History unavailable. <button type="button" onClick={retryHistory}>Retry History</button></p>
            : history.length === 0 ? <EmptyState icon={<History className="h-5 w-5" />} title="Nothing to show." />
            : <Table className="table-fixed" aria-label="Appointment history">
              <TableHeader><TableRow><TableHead scope="col">Date &amp; time</TableHead><TableHead scope="col">Event</TableHead><TableHead scope="col">Status</TableHead><TableHead scope="col">Reason</TableHead></TableRow></TableHeader>
              <TableBody>{history.map((event, index) => <TableRow key={`${event.occurredAt}-${index}`}>
                <TableCell className="whitespace-normal break-words">{timestamp(event.occurredAt)}</TableCell>
                <TableCell className="whitespace-normal break-words">{event.action ? title(event.action) : "Status recorded"}</TableCell>
                <TableCell className="whitespace-normal break-words">{event.status ? statusText(event.status) : "—"}</TableCell>
                <TableCell className="whitespace-pre-wrap [overflow-wrap:anywhere]">{event.reason || "—"}</TableCell>
              </TableRow>)}</TableBody>
            </Table>}
        </div>
      </TabsContent>
    </Tabs>
  </section>;
}
