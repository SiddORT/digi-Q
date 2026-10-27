import { History } from "lucide-react";
import { useState } from "react";
import type { Appointment } from "@workspace/api-client-react";
import { getAppointmentHistory } from "@workspace/api-client-react";
import { formatConfiguredTimestamp } from "../../lib/date-time";
import { ErrorNotice, title } from "../../resources";
import { EmptyState } from "../EmptyState";
import { Table, TableBody, TableRow, TableCell } from "../ui/table";
import { actorLabel, snapshotText, statusText } from "./detail-history";

type Props = { appointment: Appointment; history: Appointment["history"]; nextCursor?: string | null; loading: boolean; error: unknown; retry: () => void };

export function AppointmentHistoryPanel({ appointment: a, history, nextCursor, loading, error, retry }: Props) {
  const [older, setOlder] = useState<NonNullable<Appointment["history"]>>([]);
  const [cursor, setCursor] = useState(nextCursor);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  async function loadOlder() {
    if (!cursor || olderLoading) return;
    setOlderLoading(true);
    setOlderError(null);
    try {
      const page = await getAppointmentHistory(a.id, { cursor });
      if (!page.history) throw new Error("History unavailable");
      setOlder(current => [...current, ...page.history!]);
      setCursor(page.nextCursor);
    } catch (cause) {
      setOlderError(cause);
    } finally {
      setOlderLoading(false);
    }
  }
  const events = [...(history ?? []), ...older];
  const zone = a.timezone || undefined;
  return <section className="appt-detail-block appt-history" data-testid="section-detail-history" aria-labelledby={`hist-h-${a.id}`}>
    <div className="appt-history-head">
      <h4 id={`hist-h-${a.id}`}>Appointment history</h4>
      <small data-testid="text-history-timezone">{zone ? `Event times shown in current visit timezone: ${zone}` : "Event times shown in UTC (current visit timezone not recorded)"}</small>
    </div>
    {error ? <><ErrorNotice error={error} /><button type="button" className="button secondary" onClick={retry} data-testid="button-retry-history">Retry History</button></>
      : loading ? <div role="status" aria-label="Loading history" className="appt-history-skeleton">{[0, 1, 2].map(i => <span key={i} />)}</div>
      : !history ? <p role="status">History unavailable. <button type="button" onClick={retry} data-testid="button-retry-history">Retry History</button></p>
      : history.length === 0 ? <EmptyState icon={<History className="h-5 w-5" />} title="Nothing to show." />
      : <><Table className="table-fixed appt-history-table" aria-label="Appointment history">
        <thead><tr><th scope="col">Date &amp; time</th><th scope="col">Status</th><th scope="col">Details / remarks</th><th scope="col">Changed by</th></tr></thead>
        <TableBody>{events.map((event, index) => {
          const actor = actorLabel(event);
          const from = snapshotText(event.from, zone, a), to = snapshotText(event.to, zone, a);
          return <TableRow key={`${event.occurredAt}-${index}`} data-testid={`row-history-${index}`}>
            <TableCell data-label="Date & time" className="whitespace-normal break-words">{formatConfiguredTimestamp(event.occurredAt, zone, {}, a)}</TableCell>
            <TableCell data-label="Status"><span className={`badge ${event.status}`}>{statusText(event.status)}</span></TableCell>
            <TableCell data-label="Details / remarks" className="appt-history-remarks">
              <strong>{event.action ? title(event.action) : "Status recorded"}</strong>
              {(from || to) && <span className="appt-history-move">{from || "Previous visit not recorded"} → {to || "New visit not recorded"}</span>}
              {event.reason && <span className="appt-history-reason">{event.reason}</span>}
            </TableCell>
            <TableCell data-label="Changed by" className="appt-history-actor"><span className={actor.muted ? "muted" : undefined}>{actor.name}</span>{actor.role && <small>{actor.role} (role when recorded)</small>}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
      {olderError && <ErrorNotice error={olderError} />}
      {cursor && <button type="button" className="button secondary" onClick={() => void loadOlder()} disabled={olderLoading}
        data-testid="button-older-history">{olderLoading ? "Loading older events…" : olderError ? "Retry older events" : "Load older events"}</button>}
      </>}
  </section>;
}
