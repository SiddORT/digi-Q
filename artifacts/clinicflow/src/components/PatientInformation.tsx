import { useState, type ReactNode } from "react";
import { CalendarClock, Pencil } from "lucide-react";
import * as api from "@/lib/api";
import { formatDate, formatTime, formatConfiguredTimestamp } from "@/lib/date-time";
import { useTabIds } from "@/lib/tabs-a11y";
import { patientAgeLabel } from "@/lib/profile-values";
import { TabIcon } from "./TabIcon";
import "./tab-presentation.css";
import "./patient-information.css";
import { PatientActivity, statusLabel } from "./PatientActivity";
import { PatientDocuments } from "./PatientDocuments";
import { OverflowText } from "./OverflowText";
import { CapabilityView, fromQuery } from "./CapabilityState";
import { ProfileFacts, ProfileValue } from "./ProfileCompletion";
import { RecordFacts, type RecordFact } from "./RecordDetails";
import { IconAction } from "./IconAction";
import { useDateTimePreferences } from "./DateTimePreferences";
import { useFilterNames } from "./FilterNames";

export type PatientInfoTab = "profile" | "appointments" | "activity" | "documents";
export const PATIENT_INFO_TABS: { id: PatientInfoTab; label: string; icon: "personal" | "timeline" | "activity" | "documents" }[] = [
  { id: "profile", label: "Profile", icon: "personal" },
  { id: "appointments", label: "Appointments", icon: "timeline" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "documents", label: "Documents", icon: "documents" },
];
/** Supported patient profile groups. Only verified contract fields; nothing synthesized. */
export const PATIENT_INFO_GROUPS = {
  contact: ["mobile", "email"],
  address: ["address", "city", "state", "country", "pincode"],
  emergency: ["emergencyContactName", "emergencyContactPhone"],
} as const;

export const patientInitials = (name?: string) => (name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("") || "P";
const dash = <span className="muted" aria-label="Not entered">—</span>;

function Section({ title, children, testId, onEdit }: { title: string; children: ReactNode; testId: string; onEdit?: () => void }) {
  return <section className="pi-section" aria-label={title} data-testid={testId}>
    <div className="pi-section-head"><h4>{title}</h4>{onEdit && <IconAction label={`Edit ${title.toLowerCase()}`} hint="Opens the full patient editor" icon={<Pencil size={13} aria-hidden />} onClick={onEdit} testId={`button-edit-${testId}`} />}</div>
    {children}
  </section>;
}

function Appointments({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const params = { patientId, sort: "-date" as const, page, pageSize: 25 };
  const q = api.useListAppointments(params as api.ListAppointmentsParams, { query: { queryKey: api.getListAppointmentsQueryKey(params as api.ListAppointmentsParams), staleTime: 30000 } });
  const timeline = fromQuery(q, { isEmpty: d => !d.items.length, emptyMessage: "No appointments are recorded for this patient in your scope.", errorMessage: "Appointments for this patient could not be loaded.", forbiddenReason: "Your role can't view this patient's appointments." });
  const total = q.data?.total ?? 0, pageSize = q.data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const scope = q.data && total > 0 ? `Visits ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + q.data.items.length} of ${total}, newest first` : "";
  return <>
    {scope && <p className="muted" data-testid="text-timeline-scope">{scope}. Appointment visits only; this is not a full clinical record.</p>}
    <CapabilityView value={timeline} title="Visits" testId="patient-timeline">{d => <ol className="pd-timeline">{d.items.map(a => <li key={a.id}>
      <span className="pd-dot" aria-hidden><CalendarClock size={14} /></span>
      <div className="pd-item"><div className="pd-row"><strong>{formatDate(a.date, a)}{a.startTime ? ` · ${formatTime(a.startTime, a)}` : ""}</strong><span className="badge">{statusLabel(a.status)}</span></div>
        <OverflowText value={`${a.doctorName} · ${a.branchName || a.clinicName}`} /><small className="muted">Ref {a.reference}</small></div>
    </li>)}</ol>}</CapabilityView>
    {pages > 1 && <nav className="pd-pager" aria-label="Visit pages">
      <button type="button" className="button secondary small" disabled={page <= 1 || q.isFetching} onClick={() => setPage(p => p - 1)} data-testid="button-timeline-newer">Newer Visits</button>
      <small className="muted" aria-live="polite">Page {page} of {pages}</small>
      <button type="button" className="button secondary small" disabled={page >= pages || q.isFetching} onClick={() => setPage(p => p + 1)} data-testid="button-timeline-older">Older Visits</button>
    </nav>}
  </>;
}

/**
 * Shared patient information: compact summary, accessible tabs and grouped profile.
 * Used by the listing's inline expansion and PatientDetailsDrawer. The caller supplies the
 * already-loaded record (no extra authoritative fetch here) and the permission decisions.
 */
export function PatientInformation({ patient, editable, onEdit, compact = false, defaultTab = "profile" }: {
  patient: any; editable: boolean; onEdit?: (patient: any) => void; compact?: boolean; defaultTab?: PatientInfoTab;
}) {
  const [tab, setTab] = useState<PatientInfoTab>(defaultTab);
  const tabs = useTabIds<PatientInfoTab>(PATIENT_INFO_TABS.map(t => t.id), tab, setTab);
  const preferences = useDateTimePreferences();
  // Reuse scoped saved-label hydration, never download a clinic directory.
  // Missing, loading and inaccessible assignments must not all look blank.
  const assignment = useFilterNames({
    clinicId: patient.clinicName ? undefined : patient.clinicId || undefined,
    branchId: patient.branchName ? undefined : patient.branchId || undefined,
  });
  const id = patient.id as string;
  const facts = (keys: readonly string[]) => <ProfileFacts kind="patients" record={patient} editable={editable} fields={[...keys]} emptyDash />;
  const value = (key: string, children?: ReactNode) => <ProfileValue kind="patients" record={patient} field={key} editable={editable} emptyDash>{children}</ProfileValue>;
  const edit = onEdit ? () => onEdit(patient) : undefined;
  const addressLine = [patient.address, patient.city, patient.state, patient.pincode, patient.country].filter(Boolean).join(", ");
  const basic: RecordFact[] = [
    ["Full name", patient.fullName || dash],
    ["Gender", value("gender", patient.gender ? String(patient.gender).replace(/([A-Z])/g, " $1").replace(/^./, (c: string) => c.toUpperCase()) : undefined)],
    ["Date of birth", value("dateOfBirth", patient.dateOfBirth ? formatDate(patient.dateOfBirth, { ...preferences, ...patient }) : undefined)],
    // Calculated age (from DOB) and approximate age (with its reference date) keep distinct meanings.
    [patient.dateOfBirth ? "Age (calculated)" : "Approximate age", patient.dateOfBirth ? patientAgeLabel(patient) : value("age", patientAgeLabel(patient))],
  ];
  // Raw identifiers are never used as display labels or selection authority.
  const registration: RecordFact[] = [
    ["Patient ID", patient.code || dash],
    ["Clinic group", patient.clinicName || (patient.clinicId ? assignment.name("clinicId") : dash)],
    ["Clinic", patient.branchName || (patient.branchId ? assignment.name("branchId") : dash)],
    ["Status", patient.status ? <span className={`pi-status is-${patient.status}`}>{patient.status === "active" ? "Active" : "Inactive"}</span> : dash],
    ["Registered", patient.createdAt ? formatConfiguredTimestamp(patient.createdAt, patient.timezone, undefined, { ...preferences, ...patient }) : dash],
  ];
  return <div className={`patient-info${compact ? " is-compact" : ""}`} data-testid={`patient-info-${id}`}>
    <header className="pi-summary">
      <span className="pi-avatar" aria-hidden>{patientInitials(patient.fullName)}</span>
      <div className="pi-identity">
        <div className="pi-name-row"><strong data-testid={`text-patient-name-${id}`}>{patient.fullName || "Patient"}</strong>
          {patient.status && <span className={`pi-status is-${patient.status}`} data-testid={`status-patient-${id}`}>{patient.status === "active" ? "Active" : "Inactive"}</span>}</div>
        <small className="muted" data-testid={`text-patient-code-${id}`}>{patient.code ? `ID ${patient.code}` : "ID —"}</small>
      </div>
      <dl className="pi-contact">
        <div><dt>Mobile</dt><dd>{patient.mobile || dash}</dd></div>
        <div><dt>Email</dt><dd>{value("email", patient.email ? <OverflowText value={patient.email} /> : undefined)}</dd></div>
        <div className="pi-contact-address"><dt>Address</dt><dd>{addressLine && !patient.address ? <OverflowText value={addressLine} /> : value("address", addressLine ? <OverflowText value={addressLine} /> : undefined)}</dd></div>
      </dl>
      {onEdit && <IconAction label={`Edit ${patient.fullName || "patient"}`} hint="Edit full patient profile" icon={<Pencil size={15} aria-hidden />} onClick={() => onEdit(patient)} testId={`button-patient-info-edit-${id}`} />}
    </header>
    <div className="dq-tabs pd-tabs pi-tabs" aria-label="Patient information sections" {...tabs.list}>
      {PATIENT_INFO_TABS.map(t => <button className="dq-tab" key={t.id} type="button" {...tabs.tab(t.id)} data-testid={`tab-patient-${t.id}`}><TabIcon name={t.icon} />{t.label}</button>)}
    </div>
    <div className="pd-panel pi-panel" {...tabs.panel(tab)} data-testid={`panel-patient-${tab}`}>
      {tab === "profile" && <div className="pi-grid">
        <Section title="Basic Information" testId="section-patient-basic" onEdit={edit}><RecordFacts facts={basic} /></Section>
        <Section title="Contact Information" testId="section-patient-contact" onEdit={edit}>{facts(PATIENT_INFO_GROUPS.contact)}</Section>
        <Section title="Address" testId="section-patient-address" onEdit={edit}>{facts(PATIENT_INFO_GROUPS.address)}</Section>
        <Section title="Clinic & Registration" testId="section-patient-registration" onEdit={edit}><RecordFacts facts={registration} /></Section>
        <Section title="Emergency Contact" testId="section-patient-emergency" onEdit={edit}>{facts(PATIENT_INFO_GROUPS.emergency)}</Section>
      </div>}
      {tab === "appointments" && <Appointments patientId={id} />}
      {tab === "activity" && <PatientActivity patientId={id} />}
      {/* Document capability is server-scoped (e.g. doctors only for eligible own visits); never hidden here by role. */}
      {tab === "documents" && <PatientDocuments patientId={id} />}
    </div>
  </div>;
}
