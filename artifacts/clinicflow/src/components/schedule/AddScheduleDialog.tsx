import { useState } from "react";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "../AppDialog";
import { ResourceLookup } from "../ResourceLookup";
import { AvailabilityScheduleEntry } from "./AvailabilityScheduleEntry";

/** Selection is only an entry hint; the context adapter reloads saved authorized assignments. */
export function AddScheduleDialog({ initial, onClose }: { initial: any; onClose: () => void }) {
  const me = api.useGetMe();
  const [doctorId, setDoctorId] = useState(initial.doctorId || "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const own = me.data?.user?.role === "doctor";
  const selected = own ? me.data?.doctorId || "" : doctorId;
  return <AppDialog open size="wide" title="Add Schedule" onClose={onClose} dirty={dirty} busy={busy}>
    {!selected && <ResourceLookup resource="doctors" label="Doctor" required value={doctorId} onChange={setDoctorId}
      params={{ status: "active", ...(initial.clinicId ? { clinicId: initial.clinicId } : {}), ...(initial.branchId ? { branchId: initial.branchId } : {}) }}/>}
    {selected && <AvailabilityScheduleEntry key={selected} doctorId={selected} fixedClinicId={initial.clinicId} fixedBranchId={initial.branchId}
      canDelete={false} onDirtyChange={setDirty} onBusyChange={setBusy}/>}
  </AppDialog>;
}
