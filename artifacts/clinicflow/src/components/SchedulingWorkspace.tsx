import { useLocation, useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { ResourcePage, ErrorNotice } from "../resources";
import { DateTimePreferencesProvider } from "./DateTimePreferences";
import { useWorkspaceBranch } from "./WorkspaceBranch";

/** Both the clinic section and legacy schedule URLs render this one workflow. */
export function SchedulingWorkspace({identity,page,clinicId:fixedClinicId}:{identity:api.Identity;page:"availability"|"exceptions";clinicId?:string}){
 const [,navigate]=useLocation();
 const search=useSearch();
 const params=new URLSearchParams(search);
 const pin=useWorkspaceBranch();
 const requestedClinicId=fixedClinicId||params.get("clinicId")||"";
 // An explicit clinic handoff must never silently use another pinned location.
 const schedulePin=requestedClinicId?null:pin;
 const clinicId=requestedClinicId||schedulePin?.clinicId||"";
 const selectedPage=fixedClinicId?(params.get("schedule")==="exceptions"?"exceptions":"availability"):page;
 const role=identity.user?.role;
 const admin=role==="clinicAdmin"||role==="superAdmin";
 const doctorId=role==="doctor"||role==="clinicAdmin"?identity.doctorId:undefined;
 const settings=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:admin&&!!clinicId}});
 const clinic=api.useGetClinic(clinicId,{query:{queryKey:api.getGetClinicQueryKey(clinicId),enabled:!admin&&!!clinicId}});
 const go=(target:"availability"|"exceptions")=>{
  const url=new URL(window.location.href);
  for(const key of ["page","sort","search","status"])url.searchParams.delete(key);
  if(fixedClinicId){url.searchParams.set("schedule",target);navigate(`${url.pathname}${url.search}`);}
  else {url.searchParams.delete("schedule");navigate(`/${role==="doctor"?"doctor":role==="receptionist"?"receptionist":"admin"}/${target}${url.search}`);}
 };
 return <DateTimePreferencesProvider value={settings.data?.clinic||clinic.data}><section aria-label="Scheduling workspace">
  <div className="schedule-bar" data-testid="schedule-bar">
   <nav className="workspace-tabs" role="tablist" aria-label="Schedule sections">{([["availability","Weekly"],["exceptions","Exceptions"]] as const).map(([value,label])=><button key={value} type="button" role="tab" aria-selected={selectedPage===value} onClick={()=>{if(selectedPage!==value)go(value);}} data-testid={`button-schedule-${value}`}>{label}</button>)}</nav>
      <div className="schedule-bar-actions">
   </div>
  </div>
   {clinicId&&(admin?settings.isLoading:clinic.isLoading)?<p role="status">Verifying clinic context…</p>:
    clinicId&&(admin?settings.error:clinic.error)?<><ErrorNotice error={admin?settings.error:clinic.error}/><button type="button" onClick={()=>void (admin?settings:clinic).refetch()}>Retry Clinic Context</button></>:
    <ResourcePage key={`${selectedPage}-${clinicId}`} resource={selectedPage} identity={identity} embedded={!!fixedClinicId} fixedClinicId={requestedClinicId||undefined} defaults={{clinicId,verifiedClinicContext:!!requestedClinicId,branchId:schedulePin?.branchId||params.get("branchId")||"",doctorId:params.get("doctorId")||doctorId||"",isOpen:true}}/>}
 </section></DateTimePreferencesProvider>;
}