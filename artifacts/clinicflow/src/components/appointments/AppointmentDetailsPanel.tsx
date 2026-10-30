import { useState, type ReactNode } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { AppDialog } from "../AppDialog";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import { ErrorNotice, PatientEditor, title } from "../../resources";
import { ageFromDateOfBirth } from "../../lib/validators";
import { formatConfiguredTimestamp, formatDate, formatTime } from "../../lib/date-time";
import { bookingFields } from "../booking/booking-fields";
import { BookingEditor, CopyReference } from "./AppointmentBookingTab";
import { refreshAppointmentObservers } from "./refresh";
import { errorStatus } from "../../lib/friendly-error";
import { privatePatientOf } from "./detail-history";
import "./details-tab.css";
import { ProfileValue } from "../ProfileCompletion";
import { patientAgeLabel } from "../../lib/profile-values";

const NR = <span className="appt-detail-empty">Not recorded</span>;
const val = (v?: string | null) => v?.trim() ? v.trim() : NR;

export function AppointmentDetailsPanel({ appointment: a, supplementaryDetails, rowContext }: { appointment: api.Appointment; supplementaryDetails?: ReactNode; rowContext?: boolean }) {
  const live = api.useGetAppointment(a.id, { query: { queryKey: api.getGetAppointmentQueryKey(a.id), retry: false, refetchInterval: 30000 } });
  const fresh = useFreshWorkspace(live.dataUpdatedAt, !!live.error);
  const blocked = fresh.stale || !fresh.online || !!live.error;
   const p = privatePatientOf(live.data || a);
  const ts = (v: string) => formatConfiguredTimestamp(v, a.timezone || undefined, {}, a);
  const age = p?.dateOfBirth ? ageFromDateOfBirth(p.dateOfBirth) : undefined;
  const session = `${a.startTime ? formatTime(a.startTime, a) : "—"}–${a.endTime ? formatTime(a.endTime, a) : "—"}`;
  const source = (a as { source?: string | null }).source;
  return <div className="appt-details" data-testid="section-detail-details-layout">
    <div className="appt-details-pair">
      <section className="appt-detail-block appt-details-card" data-testid="section-detail-patient" aria-labelledby={`pt-h-${a.id}`}>
        <div className="appt-card-head"><h4 id={`pt-h-${a.id}`}>Patient information</h4>{p?.canEdit && a.patientId && <PatientEditAction appointmentId={a.id} patientId={a.patientId} name={p.fullName || a.patientName} blocked={blocked} />}</div>
        {p === undefined ? <div className="appt-history-skeleton" role="status" aria-label="Loading patient"><span /><span /></div>
          : p === null ? <><dl className="appt-detail-grid appt-details-grid">
              <div><dt>Name</dt><dd data-testid="text-detail-patient-name">{a.patientName}</dd></div>
              {!rowContext && <div><dt>Patient ID</dt><dd className="mono" data-testid="text-detail-patient-code">{val(a.patientCode)}</dd></div>}
            </dl><p className="muted" data-testid="text-detail-patient-unavailable">Profile details are not available to you for this patient.</p></>
          : <dl className="appt-detail-grid appt-details-grid">
            <div><dt>Name</dt><dd data-testid="text-detail-patient-name">{val(p.fullName || a.patientName)}</dd></div>
            <div><dt>Patient ID</dt><dd className="mono" data-testid="text-detail-patient-code">{val(p.code || a.patientCode)}</dd></div>
            <div><dt>Gender</dt><dd data-testid="text-detail-gender"><ProfileValue kind="patients" record={{...p,id:a.patientId}} field="gender" editable={!!p.canEdit} blocked={blocked}>{p.gender ? title(p.gender) : "Not entered"}</ProfileValue></dd></div>
            <div><dt>Date of birth / age</dt><dd data-testid="text-detail-dob"><ProfileValue kind="patients" record={{...p,id:a.patientId}} field="dateOfBirth" editable={!!p.canEdit} blocked={blocked}>{p.dateOfBirth ? <>{formatDate(p.dateOfBirth, a)}{age !== undefined && <small>{age} {age === 1 ? "year" : "years"}</small>}</> : "Not entered"}</ProfileValue>{!p.dateOfBirth && p.age!=null && <small>{patientAgeLabel(p)}</small>}</dd></div>
            <div><dt>Profile mobile</dt><dd data-testid="text-detail-profile-mobile"><ProfileValue kind="patients" record={{...p,id:a.patientId}} field="mobile" editable={!!p.canEdit} blocked={blocked}>{val(p.mobile)}</ProfileValue></dd></div>
            <div><dt>Email</dt><dd className="appt-wrap" data-testid="text-detail-email"><ProfileValue kind="patients" record={{...p,id:a.patientId}} field="email" editable={!!p.canEdit} blocked={blocked}>{val(p.email)}</ProfileValue></dd></div>
          </dl>}
      </section>
      <section className="appt-detail-block appt-details-card" data-testid="section-detail-visit" aria-labelledby={`vs-h-${a.id}`}>
        <div className="appt-card-head"><h4 id={`vs-h-${a.id}`}>Visit information</h4><BookingEditor appointment={a} blocked={blocked} label="Edit contact & notes" testId="button-edit-visit-details" /></div>
        <dl className="appt-detail-grid appt-details-grid">
          <div><dt>Clinic / location</dt><dd>{a.clinicName}<small>{a.branchName}</small></dd></div>
          <div><dt>Doctor</dt><dd>{a.doctorName}</dd></div>
          <div><dt>Visit date</dt><dd>{formatDate(a.date, a)}<small>Session {session}</small></dd></div>
          <div><dt>Booking source</dt><dd data-testid="text-detail-source">{source ? (source === "qr" ? "QR code" : title(source)) : NR}</dd></div>
          <div className="span-2"><dt>Visit contact mobile</dt><dd data-testid="text-detail-visit-mobile">{val(a.bookingMobile)}<small>For this visit only; separate from the profile mobile.</small></dd></div>
          <div><dt>Consultation check-in</dt><dd data-testid="text-detail-checked-in">{a.checkedInAt ? ts(a.checkedInAt) : NR}</dd></div>
          <div><dt>Consultation completed</dt><dd data-testid="text-detail-completed">{a.completedAt ? ts(a.completedAt) : NR}</dd></div>
        </dl>
        <p className="muted appt-details-note">Session window, not a promised consultation time. Check-in records entry into consultation, not arrival at the clinic.</p>
      </section>
    </div>
    <section className="appt-detail-block appt-details-card" data-testid="section-detail-additional" aria-labelledby={`ad-h-${a.id}`}>
      <h4 id={`ad-h-${a.id}`}>Additional information</h4>
      <dl className="appt-detail-grid appt-details-grid appt-details-grid-3">
        <div className="span-full"><dt>{bookingFields.notes.label}</dt><dd><p className={`appt-detail-notes${a.notes?.trim() ? "" : " appt-detail-empty"}`} data-testid="text-detail-additional-notes">{a.notes?.trim() || "No notes recorded."}</p></dd></div>
        <div><dt>Booking reference</dt><dd data-testid="text-detail-booking-reference"><CopyReference reference={a.reference} /></dd></div>
        <div><dt>Timezone</dt><dd>{val(a.timezone)}</dd></div>
        <div><dt>Location address</dt><dd className="appt-wrap">{val(a.branchAddress)}</dd></div>
      </dl>
      {supplementaryDetails && <div data-testid="section-detail-supplementary">{supplementaryDetails}</div>}
    </section>
  </div>;
}

/** Existing Patients editor workflow, opened only after a fresh permission-checked profile read. */
function PatientEditAction({ appointmentId, patientId, name, blocked }: { appointmentId: string; patientId: string; name: string; blocked: boolean }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<api.Patient>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<unknown>();
  const start = async () => {
    setError(undefined); setLoading(true);
    try { setPatient(await api.getPatient(patientId)); setOpen(true); } catch (e) { setError(e); } finally { setLoading(false); }
  };
  const close = () => { setOpen(false); setPatient(undefined); setError(undefined); setDirty(false); };
  const save = async (data: api.PatientInput) => {
    if (busy) return; setBusy(true); setError(undefined);
    try {
      await api.updatePatient(patientId, data);
      void client.invalidateQueries({ queryKey: api.getGetPatientQueryKey(patientId) });
      void refreshAppointmentObservers(client);
      close();
    } catch (e) {
      if ([401, 403, 404].includes(errorStatus(e) || 0)) {
        close();
        client.removeQueries({ queryKey: api.getGetPatientQueryKey(patientId) });
        void client.invalidateQueries({ queryKey: api.getGetAppointmentQueryKey(appointmentId) });
      } else setError(e);
    } finally { setBusy(false); }
  };
  return <>
    <button type="button" className="button secondary appt-edit-button" onClick={() => void start()} disabled={blocked || loading} data-testid="button-edit-patient-profile" aria-label={`Edit patient profile for ${name}`}><Pencil size={14} aria-hidden />{loading ? "Opening…" : "Edit patient"}</button>
    {!open && error ? <div className="span-full"><ErrorNotice error={error} /></div> : null}
    <AppDialog open={open && !!patient} onClose={close} title="Edit Patient" description="Changes the patient profile, not this visit's contact or notes." dirty={dirty} busy={busy} size="wide">
      <ErrorNotice error={error} />
      {patient && <PatientEditor initial={patient} profileOnly onSave={data => void save(data)} onDirtyChange={setDirty} busy={busy} />}
    </AppDialog>
  </>;
}
