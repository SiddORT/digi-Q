import { useState } from "react";
import { useListBookingMailOutcomes, getListBookingMailOutcomesQueryKey, type BookingMailOutcome } from "@workspace/api-client-react";
import { formatConfiguredTimestamp } from "../lib/date-time";
import { RecoveryActions } from "./RecoveryActions";

const STATUS_COPY: Record<BookingMailOutcome["status"], { label: string; detail: string }> = {
  pending: { label: "Waiting", detail: "Waiting to be sent. No send has been confirmed." },
  sending: { label: "Sending unconfirmed", detail: "Sending may have started. This email will not be sent again automatically." },
  provider_accepted: { label: "Submitted", detail: "Email submitted; inbox delivery isn’t confirmed." },
  provider_rejected: { label: "Couldn’t send", detail: "The email could not be sent. Ask the system administrator to check the email settings." },
  pre_dispatch_failed: { label: "Not sent", detail: "The email could not be prepared or sent. Nothing was sent." },
  delivery_unknown: { label: "Sending unconfirmed", detail: "We couldn’t confirm whether the email was sent. It will not be sent again automatically." },
  configuration_failed: { label: "Email unavailable", detail: "Email settings prevented sending. No more automatic attempts will be made." },
  preparation_failed: { label: "Couldn’t prepare", detail: "The email could not be prepared. No more automatic attempts will be made." },
  disabled: { label: "Disabled", detail: "Clinic notifications or this template were disabled before dispatch." },
  obsolete: { label: "No longer eligible", detail: "The booking or recipient was no longer eligible at dispatch." },
  no_recipient: { label: "No valid recipient", detail: "No valid owner email was available at dispatch." },
  unknown: { label: "Status unavailable", detail: "The recorded status is not recognized. No action is taken by this view." },
};

/** Mounted with an actor/clinic key so paging cannot carry over between scopes. */
export function BookingMailOutcomes({ clinicId, actorId }: { clinicId: string; actorId: string }) {
  const [page, setPage] = useState(1);
  const params = { clinicId, page, pageSize: 20 };
  const query = useListBookingMailOutcomes(params, { query: {
    queryKey: [...getListBookingMailOutcomesQueryKey(params), actorId],
    staleTime: 0, refetchOnMount: "always", refetchInterval: 30000,
    retry: false,
  } });
  return <section className="booking-mail-outcomes" aria-labelledby="booking-mail-heading" data-testid="booking-mail-outcomes">
    <div className="et-meta"><h3 id="booking-mail-heading">Owner booking email status</h3>
      {!query.error&&<button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} data-testid="button-refresh-booking-mail">Refresh status</button>}</div>
    <p className="et-hint">Recorded booking emails to this clinic's owning Clinic Admin only. This read-only view never sends or resends mail, replays a booking, or confirms inbox delivery.</p>
    {query.isLoading ? <p role="status">Loading booking email outcomes…</p>
      : query.isError ? <div className="error-box" role="alert">We couldn’t check the booking emails.<RecoveryActions error={query.error} busy={query.isFetching} onRetry={()=>query.refetch()} label="Refresh status"/></div>
      : !query.data ? <p role="status">Booking email outcomes are unavailable.</p>
      : <>
        {!query.data.items.length ? <p>No recorded owner booking emails{page > 1 ? " on this page" : " for this clinic"}. Disabled templates, unavailable recipients or shared-address deduplication can prevent an outbox entry; an empty list is not proof of delivery.</p>
          : <ul className="booking-mail-list">{query.data.items.map((item, index) => <li key={`${page}:${index}`}>
            <div><strong>Ref {item.reference || "Unavailable"}</strong>
              <span className="et-chip">{STATUS_COPY[item.status].label}</span>
              <span className="muted">{item.createdAt === null ? "Recorded time unavailable" : formatConfiguredTimestamp(new Date(item.createdAt))}</span></div>
            <p>{STATUS_COPY[item.status].detail}</p>
          </li>)}</ul>}
        <div className="et-actions" aria-label="Booking email pages">
          <button type="button" disabled={page === 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={!query.data.hasMore || query.isFetching || page >= 10000} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </>}
  </section>;
}
