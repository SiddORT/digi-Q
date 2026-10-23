import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "../AppDialog";
import { ErrorNotice } from "../../resources";
import { HelpTip } from "../HelpTip";

/** Explicit same-account attachment, never inferred from an empty directory. */
export function OwnerBookingRecovery({identity,clinicId,branchId,onRecovered}:{
  identity:api.Identity;clinicId:string;branchId:string;onRecovered:(doctor:api.Doctor)=>void;
}){
  const client=useQueryClient();
  const [open,setOpen]=useState(false);
  const [verificationError,setVerificationError]=useState<unknown>(null);
  const lock=useRef(false);
  const [busy,setBusy]=useState(false);
  const settings=api.useGetClinicSettings(clinicId,{query:{
    queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:!!clinicId,
    staleTime:0,retry:false,
  }});
  const attach=api.useAttachOwnDoctorProfile();
  const branch=settings.data?.branches.find(item=>item.id===branchId);
  const eligible=settings.data?.clinic.adminId===identity.user?.id
    &&settings.data?.clinic.status==="active"&&branch?.status==="active";
  async function recover(){
    if(lock.current||!eligible)return;
    lock.current=true;setBusy(true);setVerificationError(null);
    try{
      // Reconcile an uncertain response or another tab's write before retrying.
      const current=await api.getMe();
      if(current.user?.id!==identity.user?.id||current.user?.role!=="clinicAdmin")
        throw new Error("Your signed-in account changed. Reload before continuing.");
      let doctor:api.Doctor;
      if(current.doctorId){
        doctor=await api.getDoctor(current.doctorId);
        if(doctor.status!=="active"||doctor.ownerAdminId!==current.user.id||!doctor.branchIds?.includes(branchId))
          throw new Error("An existing clinical profile needs review in Clinic → Locations. No consulting locations were changed.");
      }else{
        doctor=await attach.mutateAsync({data:{branchIds:[branchId],recoverMissingOnly:true}});
      }
      // Keep the current booking mounted while identity and actor-scoped menus refresh.
      await client.invalidateQueries();
      onRecovered(doctor);setOpen(false);
    }catch(error){setVerificationError(error);}
    finally{lock.current=false;setBusy(false);}
  }
  if(settings.isFetching)return <p role="status">Checking owner profile recovery…</p>;
  if(settings.error)return <p role="alert">Unable to check owner profile recovery. <button type="button" onClick={()=>void settings.refetch()}>Retry recovery check</button></p>;
  if(!eligible)return null;
  return <div className="owner-booking-recovery">
    <button type="button" className="text-link" data-testid="button-owner-booking-recovery" onClick={()=>{setVerificationError(null);setOpen(true);}}>Restore my consulting profile</button>
    <HelpTip label="About consulting profile recovery" text="Uses your existing Clinic Admin account and this location only. Administration, schedules and other staff stay unchanged."/>
    <AppDialog open={open} title="Restore My Consulting Profile" busy={busy} onClose={()=>{if(!lock.current)setOpen(false);}}>
      <p>If you consult here, restore your missing clinical profile at <strong>{branch.name}</strong> only, on your existing account. Your Clinic Admin access stays unchanged. No sessions or appointments will be created.</p>
      <ErrorNotice error={verificationError}/>
      <button type="button" className="button" disabled={busy} data-testid="button-confirm-owner-recovery" onClick={()=>void recover()}>{busy?"Restoring…":"Restore at this location"}</button>
    </AppDialog>
  </div>;
}
