import { useState } from "react";
import { History } from "lucide-react";
import * as api from "@/lib/api";
import { formatConfiguredTimestamp, formatDate } from "@/lib/date-time";
import { titleCase } from "@/lib/title-case";
import { OverflowText } from "./OverflowText";
import { CapabilityView, fromQuery } from "./CapabilityState";

export const statusLabel = (value: string) => titleCase(({ called: "Called Next", noShow: "Absent" } as Record<string, string>)[value] || value.replace(/([a-z])([A-Z])/g, "$1 $2"));

/** Patient-wide status history from the server, paged independently of the Timeline. */
export function PatientActivity({ patientId, timezone }: { patientId: string; timezone?: string }) {
  const [page, setPage] = useState(1);
  const params = { page, pageSize: 25 };
  const q = api.useListPatientActivity(patientId, params, { query: { queryKey: api.getListPatientActivityQueryKey(patientId, params), placeholderData: p => p } });
  const value = fromQuery(q, { isEmpty: d => !d.items.length, emptyMessage: "No status changes are recorded for this patient in your scope.", errorMessage: "Activity could not be loaded.", forbiddenReason: "Your role can't view this patient's activity." });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 25));
  return <>
    {q.data && q.data.total > 0 && <p className="muted" data-testid="text-activity-scope">{q.data.total} status changes across all visits, newest first.</p>}
    <CapabilityView value={value} title="Activity" testId="patient-activity">{d => <ol className="pd-timeline">{d.items.map(e => <li key={e.id}>
      <span className="pd-dot" aria-hidden><History size={14} /></span>
      <div className="pd-item"><div className="pd-row"><strong>{e.fromStatus ? `${statusLabel(e.fromStatus)} → ` : ""}{statusLabel(e.toStatus)}</strong><small className="muted">{formatConfiguredTimestamp(e.occurredAt, timezone)}</small></div>
        <OverflowText value={`${e.doctorName} · Visit ${formatDate(e.date)} · Ref ${e.reference}`} />{e.actorName && <small className="muted">By {e.actorName}</small>}</div>
    </li>)}</ol>}</CapabilityView>
    {pages > 1 && <nav className="pd-pager" aria-label="Activity pages">
      <button type="button" className="button secondary small" disabled={page <= 1 || q.isFetching} onClick={() => setPage(p => p - 1)} data-testid="button-activity-newer">Newer</button>
      <small className="muted" aria-live="polite">Page {page} of {pages}</small>
      <button type="button" className="button secondary small" disabled={page >= pages || q.isFetching} onClick={() => setPage(p => p + 1)} data-testid="button-activity-older">Older</button>
    </nav>}
  </>;
}
