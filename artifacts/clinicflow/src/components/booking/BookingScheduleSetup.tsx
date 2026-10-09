import { useState } from "react";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "../AppDialog";
import { DoctorScheduleContext } from "../schedule/DoctorScheduleContext";

/** Server-verified capability; display filters and public membership cannot grant management. */
export function BookingScheduleSetup({identity,doctorId,branchId,clinicId,enabled=true}:{
  identity:api.Identity;doctorId:string;branchId:string;clinicId:string;enabled?:boolean;
}){
  const params={doctorId,branchId};
  const permitted=enabled&&identity.user?.role!=="patient"&&!!doctorId&&!!branchId&&!!clinicId;
  const access=api.useGetBookingScheduleAccess(params,{query:{queryKey:[...api.getGetBookingScheduleAccessQueryKey(params),identity.userId],enabled:permitted,staleTime:0,refetchInterval:30000,retry:false}});
  const [open,setOpen]=useState(false),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
  const [scope,setScope]=useState({doctorId,branchId,clinicId});
  if(!open&&(!permitted||!access.data?.allowed||access.error||access.isFetching))return <p className="muted">For schedule setup or changes, contact the clinic.</p>;
  return <><button type="button" className="text-link" disabled={!permitted||!access.data?.allowed||access.isFetching||!!access.error} data-testid="button-booking-manage-schedule" onClick={()=>{setScope({doctorId,branchId,clinicId});setDirty(false);setBusy(false);setOpen(true);}}>Manage this doctor's schedule at this location</button>
    {open&&<AppDialog open size="wide" title="Manage Doctor Schedule" dirty={dirty} busy={busy} onClose={()=>{setOpen(false);}}>
      <DoctorScheduleContext doctor={{id:scope.doctorId}} fixedClinicId={scope.clinicId} fixedBranchId={scope.branchId} onDirtyChange={setDirty} onBusyChange={setBusy}/>
      <p className="muted">Saved sessions apply to matching weekdays, subject to date exceptions and booking restrictions. Close to return to your retained booking draft.</p>
    </AppDialog>}
  </>;
}
