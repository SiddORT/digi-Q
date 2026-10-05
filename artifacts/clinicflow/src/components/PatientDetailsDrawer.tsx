import { useMemo, useState } from "react";
import { CalendarClock, Download, History, Trash2, Upload } from "lucide-react";
import * as api from "@/lib/api";
import { formatDate, formatTime, formatConfiguredTimestamp } from "@/lib/date-time";
import { titleCase } from "@/lib/title-case";
import { AppDialog } from "./AppDialog";
import { OverflowText } from "./OverflowText";
import { CapabilityView, UnavailableAction, fromQuery, unavailable, type Capability } from "./CapabilityState";

type Tab = "timeline" | "activity" | "documents";
const TABS: { id: Tab; label: string }[] = [{ id: "timeline", label: "Timeline" }, { id: "activity", label: "Activity" }, { id: "documents", label: "Documents" }];
export const DOCUMENTS_UNAVAILABLE = "Patient documents are not connected. There is no document storage service yet, so nothing can be uploaded, downloaded or deleted here.";
const ACTIVITY_UNAVAILABLE = "Status history is not included in this appointment listing, so the activity feed can't be built. The Timeline tab still lists the visits.";

type ActivityItem = { key: string; at: string; displayTime: string; status: string; reason?: string; reference: string; doctor: string };
const statusLabel = (value: string) => titleCase(
  ({ called: "Called Next", noShow: "Absent" } as Record<string, string>)[value]
  || value.replace(/([a-z])([A-Z])/g, "$1 $2"),
);

/** Patient Timeline (real appointments for this patient), Activity (real status events, when present) and Documents (not connected). */
export function PatientDetailsDrawer({ patient, onClose }: { patient: { id: string; fullName?: string; patientCode?: string; email?: string }; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("timeline");
  const [page, setPage] = useState(1);
  const params = { patientId: patient.id, sort: "-date" as const, page, pageSize: 25 };
  const q = api.useListAppointments(params as api.ListAppointmentsParams, { query: { queryKey: api.getListAppointmentsQueryKey(params as api.ListAppointmentsParams), staleTime: 30000 } });
  const timeline = fromQuery(q, { isEmpty: d => !d.items.length, emptyMessage: "No appointments are recorded for this patient in your scope.", errorMessage: "Appointments for this patient could not be loaded.", forbiddenReason: "Your role can't view this patient's appointments." });
  const activity: Capability<ActivityItem[]> = useMemo(() => {
    if (timeline.state !== "loaded") return timeline as Capability<never>;
    const items = timeline.data.items;
    if (!items.some(a => Array.isArray(a.history))) return unavailable(ACTIVITY_UNAVAILABLE);
    const events = items.flatMap(a => (a.history ?? []).map((e, i) => ({ key: `${a.id}-${i}`, at: e.occurredAt, displayTime: formatConfiguredTimestamp(e.occurredAt, a.timezone || undefined, {}, a), status: e.status, reason: e.reason, reference: a.reference, doctor: a.doctorName })))
      .sort((x, y) => y.at.localeCompare(x.at));
    return events.length ? { state: "loaded", data: events } : { state: "empty", message: "No status changes are recorded for these visits." };
  }, [timeline]);
  const total = q.data?.total ?? 0;
  const pageSize = q.data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const scope = q.data && total > 0 ? `Visits ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + q.data.items.length} of ${total}, newest first` : "";
  const pager = pages > 1 && <nav className="pd-pager" aria-label="Visit pages">
    <button type="button" className="button secondary small" disabled={page <= 1 || q.isFetching} onClick={() => setPage(p => p - 1)} data-testid="button-timeline-newer">Newer Visits</button>
    <small className="muted" aria-live="polite">Page {page} of {pages}</small>
    <button type="button" className="button secondary small" disabled={page >= pages || q.isFetching} onClick={() => setPage(p => p + 1)} data-testid="button-timeline-older">Older Visits</button>
  </nav>;
  return <AppDialog open variant="drawer" onClose={onClose} title={`Patient Details · ${patient.fullName || "Patient"}`} description={[patient.patientCode, patient.email].filter(Boolean).join(" · ") || undefined}>
    <div className="pd-tabs" role="tablist" aria-label="Patient details sections">{TABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`tab-patient-${t.id}`}>{t.label}</button>)}</div>
    <div role="tabpanel" className="pd-panel" data-testid={`panel-patient-${tab}`}>
      {tab === "timeline" && <>
        {scope && <p className="muted" data-testid="text-timeline-scope">{scope}. Appointment visits only; this is not a full clinical record.</p>}
        <CapabilityView value={timeline} title="Visits" testId="patient-timeline">{d => <ol className="pd-timeline">{d.items.map(a => <li key={a.id}>
          <span className="pd-dot" aria-hidden><CalendarClock size={14} /></span>
          <div className="pd-item"><div className="pd-row"><strong>{formatDate(a.date, a)}{a.startTime ? ` · ${formatTime(a.startTime, a)}` : ""}</strong><span className="badge">{statusLabel(a.status)}</span></div>
            <OverflowText value={`${a.doctorName} · ${a.branchName || a.clinicName}`} /><small className="muted">Ref {a.reference}</small></div>
        </li>)}</ol>}</CapabilityView>{pager}
      </>}
      {tab === "activity" && scope && <p className="muted" data-testid="text-activity-scope">Status changes for the visits on this page only ({scope.toLowerCase()}). Use Timeline paging to see other visits.</p>}
      {tab === "activity" && <CapabilityView value={activity} title="Activity" testId="patient-activity">{items => <ol className="pd-timeline">{items.map(e => <li key={e.key}>
        <span className="pd-dot" aria-hidden><History size={14} /></span>
        <div className="pd-item"><div className="pd-row"><strong>{statusLabel(e.status)}</strong><small className="muted">{e.displayTime}</small></div>
          <OverflowText value={`${e.doctor} · Ref ${e.reference}`} />{e.reason && <small>{e.reason}</small>}</div>
      </li>)}</ol>}</CapabilityView>}
      {tab === "activity" && pager}
      {tab === "documents" && <>
        <div className="pd-doc-actions">
          <UnavailableAction icon={<Upload size={15} aria-hidden />} label="Upload Document" reason={DOCUMENTS_UNAVAILABLE} testId="button-upload-document" />
          <UnavailableAction icon={<Download size={15} aria-hidden />} label="Download" reason={DOCUMENTS_UNAVAILABLE} testId="button-download-document" />
          <UnavailableAction icon={<Trash2 size={15} aria-hidden />} label="Delete" reason={DOCUMENTS_UNAVAILABLE} testId="button-delete-document" />
        </div>
        <CapabilityView value={unavailable(DOCUMENTS_UNAVAILABLE)} title="Documents" testId="patient-documents">{() => null}</CapabilityView>
      </>}
    </div>
  </AppDialog>;
}
