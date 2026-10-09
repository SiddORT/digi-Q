import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { DoctorScheduleContext } from "./DoctorScheduleContext";
import { ErrorNotice } from "../../resources";
import { useRegisterUnsaved } from "../WorkspaceBranch";
import { useDirectoryActor } from "../../lib/use-directory";

/** Doctor/admin entry on the Availability page: the same compact editor, scoped by a freshly fetched doctor, never by URL location ids. */
export function AvailabilityScheduleEntry({ doctorId, fixedClinicId, canDelete,onDirtyChange,onBusyChange }: { doctorId: string; fixedClinicId?: string; canDelete: boolean; onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void }) {
  const actor = useDirectoryActor();
  const doctor = useQuery({ queryKey: ["availability-entry-doctor", actor, doctorId], retry: false, gcTime: 0, queryFn: () => api.getDoctor(doctorId) });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedDoctor,setSavedDoctor]=useState<api.Doctor|null>(null);
  useEffect(()=>{
    if(savedDoctor?.id!==doctorId&&doctor.isFetchedAfterMount&&!doctor.isFetching&&doctor.data?.id===doctorId&&!doctor.error)setSavedDoctor(doctor.data);
  },[doctorId,savedDoctor,doctor.data,doctor.isFetchedAfterMount,doctor.isFetching,doctor.error]);
  useEffect(()=>onDirtyChange?.(dirty),[dirty,onDirtyChange]);
  useEffect(()=>onBusyChange?.(busy),[busy,onBusyChange]);
  useRegisterUnsaved(dirty, busy);
  if (!savedDoctor||savedDoctor.id!==doctorId) {
    if(doctor.error)return <><ErrorNotice error={doctor.error}/><button type="button" onClick={() => void doctor.refetch()}>Retry</button></>;
    return <div className="skeleton" role="status">Loading doctor schedule…</div>;
  }
  return <section className="panel padded" data-testid="panel-weekly-editor-entry">
    <ErrorNotice error={doctor.error}/>
    {doctor.error&&<button type="button" onClick={()=>void doctor.refetch()}>Retry Saved Doctor</button>}
    <DoctorScheduleContext key={doctorId} doctor={savedDoctor} fixedClinicId={fixedClinicId} canDelete={canDelete} onDirtyChange={setDirty} onBusyChange={setBusy}/>
  </section>;
}
