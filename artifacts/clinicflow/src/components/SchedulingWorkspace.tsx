import { useLocation, useSearch, Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { ResourcePage, ErrorNotice } from "../resources";
import { ClinicSessionSetup } from "./ClinicSessionSetup";
import { DateTimePreferencesProvider } from "./DateTimePreferences";
import { useState } from "react";
import { AppDialog } from "./AppDialog";

/** Both the clinic section and legacy schedule URLs render this one workflow. */
export function SchedulingWorkspace({identity,page,onLinkOwner,clinicId:fixedClinicId}:{identity:api.Identity;page:"availability"|"exceptions";onLinkOwner?:()=>void;clinicId?:string}){
 const [,navigate]=useLocation();
 const [copyOpen,setCopyOpen]=useState(false);
 const search=useSearch();
 const params=new URLSearchParams(search);
 const clinicId=fixedClinicId||params.get("clinicId")||"";
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
    {admin&&selectedPage==="availability"&&settings.data&&<button type="button" className="button secondary small" aria-haspopup="dialog" onClick={()=>setCopyOpen(true)} data-testid="button-copy-opening-hours">Copy opening hours</button>}
    {admin&&clinicId&&(onLinkOwner?<button type="button" className="button secondary small" onClick={onLinkOwner}>Edit linked owner hours</button>:<Link className="button secondary small" href={`/admin/settings?clinicId=${encodeURIComponent(clinicId)}&section=locations`}>Edit linked owner hours</Link>)}
   </div>
  </div>
   {admin&&selectedPage==="availability"&&<><ErrorNotice error={settings.error}/>{settings.error&&<button type="button" onClick={()=>void settings.refetch()}>Retry clinic configuration</button>}</>}
   {copyOpen&&settings.data&&<AppDialog open variant="drawer" onClose={()=>setCopyOpen(false)} title="Copy opening hours into custom doctor sessions" description="For owner-linked consultations, change location hours using the protected preview. For custom doctors, copy selected opening intervals here, then manage them in the list."><ClinicSessionSetup key={clinicId} clinicId={clinicId} branches={settings.data.branches} ownDoctorId={doctorId||undefined}/></AppDialog>}
   <ResourcePage key={`${selectedPage}-${fixedClinicId||""}`} resource={selectedPage} identity={identity} embedded={!!fixedClinicId} fixedClinicId={fixedClinicId} defaults={{clinicId,branchId:params.get("branchId")||"",doctorId:params.get("doctorId")||doctorId||"",isOpen:true}}/>
 </section></DateTimePreferencesProvider>;
}