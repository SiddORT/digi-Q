import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Editor, ErrorNotice, resources, profileFields, title } from "../resources";
import { AppDialog } from "./AppDialog";
import { RecordFacts } from "./RecordDetails";
import { completionLabels, isMissingProfileValue, patientAgeLabel } from "../lib/profile-values";
import { formatDate } from "../lib/date-time";
import { notifySuccess } from "../lib/notify";
import { useDateTimePreferences } from "./DateTimePreferences";
import { useDirectoryActor } from "../lib/use-directory";

type Kind = "patients" | "doctors" | "users";
const address = ["address", "country", "state", "city", "pincode"];
export const profileCompletionKeys: Record<Kind, string[]> = {
  patients: ["dateOfBirth", "age", "gender", "mobile", "email", ...address, "emergencyContactName", "emergencyContactPhone"],
  doctors: ["dateOfBirth", "gender", "mobile", ...address, "photoUrl", "about", "specializationId", "qualificationIds", "languages", "registrationNumber", "experienceYears", "consultationFee"],
  users: ["mobile", ...address, "photoUrl"],
};
const supported = profileCompletionKeys;
export function canCompleteProfile(kind: Kind, record: any, identity?: api.Identity) {
  const actor = identity?.user;
  if (!actor) return false;
  if (actor.role === "superAdmin") return true;
  if (kind === "patients") return identity?.patientId === record.id || ["clinicAdmin", "receptionist"].includes(actor.role) &&
    !!record.clinicId && (actor.clinicIds || []).includes(record.clinicId) &&
    (!(actor.branchIds || []).length || !record.branchId || (actor.branchIds || []).includes(record.branchId));
  if (kind === "doctors") return identity?.doctorId === record.id || actor.role === "clinicAdmin" && record.ownerAdminId === actor.id;
  return actor.id === record.id || ["clinicAdmin", "doctor"].includes(actor.role);
}
export function ProfileValue({ kind, record, field, editable, children, blocked = false }: {
  kind: Kind; record: any; field: string; editable: boolean; children?: ReactNode; blocked?: boolean;
}) {
  const client = useQueryClient();
  const actor = useDirectoryActor();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [current, setCurrent] = useState<any>(), [error, setError] = useState<unknown>();
  const formHost = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState(false);
  const keys = address.includes(field) ? address : field.startsWith("emergencyContact") ? ["emergencyContactName", "emergencyContactPhone"] :
    kind === "patients" && ["age", "dateOfBirth"].includes(field) ? ["dateOfBirth", "age"] : [field];
  useEffect(() => {
    if (!open || !current) return;
    const timer = setTimeout(() => {
      const target = formHost.current?.querySelector<HTMLElement>(`#input-${field}`) ||
        formHost.current?.querySelector<HTMLElement>("input,button[role=combobox],textarea,select");
      target?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [open, current, field]);
  const missing = isMissingProfileValue(record[field]);
  const access = useQuery({
    queryKey: ["profile-field-access", actor, kind, record.id],
    queryFn: () => api.getProfileFieldAccess(kind, record.id),
    enabled: missing && editable && supported[kind].includes(field), retry: false, staleTime: 15000,
  });
  // Refreshing identity/access while an editor is open must not unmount its draft.
  // The server rechecks permission and the saved baseline on every submission.
  if (!open) {
    if (!missing) return <>{children ?? String(record[field])}</>;
    if (!editable || !supported[kind].includes(field)) return <span className="muted">Not entered</span>;
    if (access.isLoading) return <span role="status">Checking access…</span>;
    if (access.error) return <span>Unable to check access. <button type="button" className="text-link" onClick={()=>void access.refetch()}>Retry</button></span>;
    if (!access.data?.fields.includes(field)) return <span className="muted">Not entered</span>;
  }
  const start = async () => {
    if (opening) return;
    setOpening(true); setError(undefined);
    try {
      const saved = kind === "patients" ? await api.getPatient(record.id) : kind === "doctors" ? await api.getDoctor(record.id) : await api.getUser(record.id);
      setCurrent(saved); setDirty(false); setOpen(true);
    } catch (e) { setError(e); } finally { setOpening(false); }
  };
  const save = async (data: any) => {
    if (busy) return;
    const values = Object.fromEntries(keys.filter(key => Object.hasOwn(data, key) && JSON.stringify(data[key]) !== JSON.stringify(current[key])).map(key => [key, data[key]]));
    if (!Object.keys(values).length) { setError(new Error("Enter a value before saving.")); return; }
    setBusy(true); setError(undefined);
    try {
      const baseline = Object.fromEntries(keys.map(key => [key, current[key] ?? null]));
      await api.completeProfileFields(kind, record.id, { values, baseline });
      await client.invalidateQueries();
      setOpen(false); setDirty(false); notifySuccess("Profile updated");
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const label = completionLabels[field] || title(field).toLowerCase();
  const fields = (kind === "users" ? [...resources.users.fields, ...profileFields.filter(f => f.key === "photoUrl")] : resources[kind].fields)
    .filter(f => keys.includes(f.key)).map(f => ({ ...f, required: false }));
  return <>
    <button type="button" className="text-link" disabled={blocked || opening} aria-haspopup="dialog" onClick={() => void start()}>{opening ? "Opening…" : `Add ${label}`}</button>
    {!open && error ? <ErrorNotice error={error} onRetry={() => void start()} /> : null}
    <AppDialog open={open} onClose={() => setOpen(false)} title={`Add ${label}`} dirty={dirty} busy={busy}
      description={["mobile", "email"].includes(field) ? "Profile contact only. This does not verify the contact, create an account or change this visit's contact." : undefined}>
      <ErrorNotice error={error} />
      {current && <div ref={formHost}><Editor fields={fields} initial={current} onSave={data => void save(data)} onDirtyChange={setDirty} busy={busy} submitLabel="Save" /></div>}
    </AppDialog>
  </>;
}
export function ProfileFacts({ kind, record, editable, fields }: { kind: Kind; record: any; editable: boolean; fields?: string[] }) {
  const preferences = useDateTimePreferences();
  const keys = fields || supported[kind].filter(key => kind !== "users" || key !== "photoUrl");
  return <RecordFacts facts={keys.filter(key => !(key === "age" && record.dateOfBirth)).map(key => {
    const value = key === "age" ? patientAgeLabel(record) : key === "dateOfBirth" ? formatDate(record[key], {...preferences,...record}) :
      key === "specializationId" ? record.specializationName : key === "qualificationIds" ? record.qualificationNames?.join(", ") :
      key === "gender" ? title(record[key] || "") : Array.isArray(record[key]) ? record[key].join(", ") : record[key];
    return [key === "mobile" ? "Profile mobile" : title(key), <ProfileValue key={key} kind={kind} record={record} field={key} editable={editable}>{value}</ProfileValue>];
  })} />;
}
export function ProfileRecordSummary({ kind, id, identity, self = false }: { kind: Kind; id: string; identity: api.Identity; self?: boolean }) {
  const query = useQuery<api.Patient|api.Doctor|api.User>({
    queryKey: kind === "patients" ? api.getGetPatientQueryKey(id) : kind === "doctors" ? api.getGetDoctorQueryKey(id) : api.getGetUserQueryKey(id),
    queryFn: () => kind === "patients" ? api.getPatient(id) : kind === "doctors" ? api.getDoctor(id) : api.getUser(id),
    retry: false,
  });
  return query.isLoading ? <p role="status">Loading profile…</p> : query.error ? <ErrorNotice error={query.error} onRetry={()=>void query.refetch()}/> :
    query.data ? <ProfileFacts kind={kind} record={query.data} editable={canCompleteProfile(kind, query.data, identity)}
      fields={self && kind === "users" ? ["mobile","photoUrl"] : undefined} /> : null;
}
export function StaffProfileDetails({ kind, record, identity }: { kind: "users"|"doctors"; record: any; identity: api.Identity }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="text-link" aria-haspopup="dialog" onClick={()=>setOpen(true)}>View profile</button>
    <AppDialog open={open} variant="drawer" onClose={()=>setOpen(false)} title={`${record.fullName} · Profile`}>
      {open && <ProfileRecordSummary kind={kind} id={record.id} identity={identity}/>}
    </AppDialog></>;
}
