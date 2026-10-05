import { useState } from "react";
import { CalendarClock } from "lucide-react";
import * as api from "@/lib/api";
import { formatDate, formatTime } from "@/lib/date-time";
import { useTabIds } from "@/lib/tabs-a11y";
import { PatientActivity, statusLabel } from "./PatientActivity";
import { PatientDocuments } from "./PatientDocuments";
import { AppDialog } from "./AppDialog";
import { OverflowText } from "./OverflowText";
import { CapabilityView, fromQuery } from "./CapabilityState";

type Tab = "timeline" | "activity" | "documents";
const TABS: { id: Tab; label: string }[] = [{ id: "timeline", label: "Timeline" }, { id: "activity", label: "Activity" }, { id: "documents", label: "Documents" }];
/** Patient Timeline (appointments), Activity (patient-wide status history) and Documents (private uploads). */
export function PatientDetailsDrawer({ patient, onClose }: { patient: { id: string; fullName?: string; patientCode?: string; email?: string }; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("timeline");
  const [page, setPage] = useState(1);
  const tabs = useTabIds<Tab>(TABS.map(t => t.id), tab, setTab);
  const params = { patientId: patient.id, sort: "-date" as const, page, pageSize: 25 };
  const q = api.useListAppointments(params as api.ListAppointmentsParams, { query: { queryKey: api.getListAppointmentsQueryKey(params as api.ListAppointmentsParams), staleTime: 30000 } });
  const timeline = fromQuery(q, { isEmpty: d => !d.items.length, emptyMessage: "No appointments are recorded for this patient in your scope.", errorMessage: "Appointments for this patient could not be loaded.", forbiddenReason: "Your role can't view this patient's appointments." });
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
    <div className="pd-tabs" aria-label="Patient details sections" {...tabs.list}>{TABS.map(t => <button key={t.id} type="button" {...tabs.tab(t.id)} data-testid={`tab-patient-${t.id}`}>{t.label}</button>)}</div>
    <div className="pd-panel" {...tabs.panel(tab)} data-testid={`panel-patient-${tab}`}>
      {tab === "timeline" && <>
        {scope && <p className="muted" data-testid="text-timeline-scope">{scope}. Appointment visits only; this is not a full clinical record.</p>}
        <CapabilityView value={timeline} title="Visits" testId="patient-timeline">{d => <ol className="pd-timeline">{d.items.map(a => <li key={a.id}>
          <span className="pd-dot" aria-hidden><CalendarClock size={14} /></span>
          <div className="pd-item"><div className="pd-row"><strong>{formatDate(a.date, a)}{a.startTime ? ` · ${formatTime(a.startTime, a)}` : ""}</strong><span className="badge">{statusLabel(a.status)}</span></div>
            <OverflowText value={`${a.doctorName} · ${a.branchName || a.clinicName}`} /><small className="muted">Ref {a.reference}</small></div>
        </li>)}</ol>}</CapabilityView>{pager}
      </>}
      {tab === "activity" && <PatientActivity patientId={patient.id} />}
      {tab === "documents" && <PatientDocuments patientId={patient.id} />}
    </div>
  </AppDialog>;
}
