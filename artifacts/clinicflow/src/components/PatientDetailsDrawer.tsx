import * as api from "@/lib/api";
import { AppDialog } from "./AppDialog";
import { ErrorNotice } from "../resources";
import { canCompleteProfile } from "./ProfileCompletion";
import { PatientInformation, type PatientInfoTab } from "./PatientInformation";

/** Patient details drawer: the shared PatientInformation (Profile, Appointments, Activity, Documents) over one authoritative profile read. */
export function PatientDetailsDrawer({ patient, onClose, onEdit, defaultTab }: { patient: { id: string; fullName?: string; patientCode?: string; code?: string; email?: string }; onClose: () => void; onEdit?: (patient: any) => void; defaultTab?: PatientInfoTab }) {
  const identity = api.useGetMe();
  const profile = api.useGetPatient(patient.id, { query: { queryKey: api.getGetPatientQueryKey(patient.id), retry: false, staleTime: 15000 } });
  const record = profile.data ? { ...patient, ...profile.data } : null;
  return <AppDialog open variant="drawer" onClose={onClose} title={`Patient Details · ${patient.fullName || "Patient"}`} description={[patient.patientCode || patient.code, patient.email].filter(Boolean).join(" · ") || undefined}>
    {profile.isLoading ? <div className="skeleton" role="status">Loading profile…</div>
      : profile.error ? <ErrorNotice error={profile.error} onRetry={() => void profile.refetch()} />
      : record ? <PatientInformation patient={record} defaultTab={defaultTab} editable={canCompleteProfile("patients", record, identity.data)} onEdit={onEdit ? (p) => { onClose(); onEdit(p); } : undefined} /> : null}
  </AppDialog>;
}
