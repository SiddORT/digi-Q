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
 const schedulePin=fixedClinicId?null:pin; // clinic settings stay unrestricted
 const clinicId=fixedClinicId||schedulePin?.clinicId||params.get("clinicId")||"";
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
   <nav className="section-nav" aria-label="Schedule sections"><span className="section-nav-label">Schedule</span>{([["availability","Weekly sessions"],["exceptions","Date exceptions"]] as const).map(([value,label])=><button key={value} type="button" aria-current={selectedPage===value?"page":undefined} onClick={()=>{if(selectedPage!==value)go(value);}} data-testid={`button-schedule-${value}`}>{label}</button>)}</nav>
      <div className="schedule-bar-actions">
   </div>
  </div>
   {admin&&selectedPage==="availability"&&<><ErrorNotice error={settings.error}/>{settings.error&&<button type="button" onClick={()=>void settings.refetch()}>Retry Clinic Configuration</button>}</>}
   <ResourcePage key={`${selectedPage}-${fixedClinicId||""}`} resource={selectedPage} identity={identity} embedded={!!fixedClinicId} fixedClinicId={fixedClinicId} defaults={{clinicId,branchId:schedulePin?.branchId||params.get("branchId")||"",doctorId:params.get("doctorId")||doctorId||"",isOpen:true}}/>
 </section></DateTimePreferencesProvider>;
}