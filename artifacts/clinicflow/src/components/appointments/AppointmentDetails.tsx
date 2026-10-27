import { TabIcon } from "../TabIcon";
import { useEffect, type ReactNode } from "react";
import type { Appointment } from "@workspace/api-client-react";
import { useGetAppointment, getGetAppointmentQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { formatDate, formatTime } from "../../lib/date-time";
import { ErrorNotice } from "../../resources";
import { AppointmentBookingTab } from "./AppointmentBookingTab";
import { AppointmentDetailsPanel } from "./AppointmentDetailsPanel";
import { AppointmentHistoryPanel } from "./AppointmentHistoryPanel";
import { statusText } from "./detail-history";
import { isPrivateAppointmentUnavailable } from "./presentation";
import { clearBookingDraft } from "./booking-drafts";
import { useBookingDraftGuard } from "./booking-draft-guard";


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
  const session = `${a.startTime ? formatTime(a.startTime, a) : "—"}–${a.endTime ? formatTime(a.endTime, a) : "—"}`;
  return <section aria-label="Appointment details" className="appt-detail" data-testid="appointment-details">
    {!rowContext && <header className="appt-detail-summary" data-testid="appointment-summary">
      <div className="appt-sum-id">
        <h3 data-testid="text-detail-patient"><span className="appt-sum-name">{a.patientName}</span> <span className={`badge ${a.status}`} data-testid="text-detail-status">{statusText(a.status)}</span></h3>
        <p className="appt-sum-refs"><span data-testid="text-detail-token">Token: <strong>{a.token || "Not assigned"}</strong></span><span>Ref: <code className="mono">{a.reference}</code></span></p>
      </div>
      <dl className="appt-sum-context" data-testid="text-detail-context">
        <div><dt>Visit</dt><dd>{formatDate(a.date, a)}<small>{session}</small></dd></div>
        <div><dt>Clinic / location</dt><dd>{a.clinicName}<small>{a.branchName}</small></dd></div>
        <div><dt>Doctor</dt><dd>{a.doctorName}</dd></div>
      </dl>
    </header>}
    <Tabs defaultValue="booking">
      <TabsList aria-label="Appointment detail sections">
        <TabsTrigger value="booking" data-testid="tab-detail-booking"><TabIcon name="booking"/>Booking</TabsTrigger>
        <TabsTrigger value="details" data-testid="tab-detail-details"><TabIcon name="details"/>Details</TabsTrigger>
        <TabsTrigger value="history" data-testid="tab-detail-history"><TabIcon name="history"/>History</TabsTrigger>
      </TabsList>
      <TabsContent value="booking" className="appt-tab-panel">
        <AppointmentBookingTab appointment={a} />
      </TabsContent>
      <TabsContent value="details" className="appt-tab-panel">
        {!!historyError && <><ErrorNotice error={historyError} /><button type="button" className="button secondary" onClick={retryHistory}>Retry Details</button></>}
        <AppointmentDetailsPanel appointment={a} supplementaryDetails={supplementaryDetails} rowContext={rowContext} />
      </TabsContent>
      <TabsContent value="history" className="appt-tab-panel">
        <AppointmentHistoryPanel key={`${a.id}:${a.historyNextCursor ?? ""}`} appointment={a} history={history} nextCursor={a.historyNextCursor}
          loading={historyLoading} error={historyError} retry={retryHistory} />
      </TabsContent>
    </Tabs>
  </section>;
}
