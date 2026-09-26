import { useLocation, useSearch, Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { ResourcePage, ErrorNotice } from "../resources";
import { ClinicSessionSetup } from "./ClinicSessionSetup";

/** Both the clinic section and legacy schedule URLs render this one workflow. */
export function SchedulingWorkspace({identity,page,onLinkOwner,clinicId:fixedClinicId}:{identity:api.Identity;page:"availability"|"exceptions";onLinkOwner?:()=>void;clinicId?:string}){
 const [,navigate]=useLocation();
 const search=useSearch();
 const params=new URLSearchParams(search);
 const clinicId=fixedClinicId||params.get("clinicId")||"";
 const selectedPage=fixedClinicId?(params.get("schedule")==="exceptions"?"exceptions":"availability"):page;
 const role=identity.user?.role;
 const admin=role==="clinicAdmin"||role==="superAdmin";
 const doctorId=role==="doctor"||role==="clinicAdmin"?identity.doctorId:undefined;
 const settings=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:admin&&!!clinicId}});
 const go=(target:"availability"|"exceptions")=>{
  const url=new URL(window.location.href);
  for(const key of ["page","sort","search","status"])url.searchParams.delete(key);
  if(fixedClinicId){url.searchParams.set("schedule",target);navigate(`${url.pathname}${url.search}`);}
  else {url.searchParams.delete("schedule");navigate(`/${role==="doctor"?"doctor":role==="receptionist"?"receptionist":"admin"}/${target}${url.search}`);}
 };
 return <section aria-label="Scheduling workspace">
  <div className="panel-heading"><div><h2>Schedule</h2><p>Weekly doctor sessions and date exceptions share your selected clinic, location and doctor.</p></div>{admin&&clinicId&&(onLinkOwner?<button type="button" onClick={onLinkOwner}>Edit linked owner hours</button>:<Link href={`/admin/settings?clinicId=${encodeURIComponent(clinicId)}&section=locations`}>Edit linked owner hours</Link>)}</div>
   <label style={{display:"grid",maxWidth:290,marginBottom:12}}>Schedule section<select value={selectedPage} onChange={event=>go(event.target.value as "availability"|"exceptions")}><option value="availability">Weekly sessions</option><option value="exceptions">Date exceptions</option></select></label>
   {admin&&selectedPage==="availability"&&<><ErrorNotice error={settings.error}/>{settings.error&&<button type="button" onClick={()=>void settings.refetch()}>Retry clinic configuration</button>}{settings.data&&<details className="panel padded"><summary>Copy opening hours into custom doctor sessions</summary><p>For owner-linked consultations, change location hours using the protected preview. For custom doctors, copy selected opening intervals here, then manage them below.</p><ClinicSessionSetup key={clinicId} clinicId={clinicId} branches={settings.data.branches} ownDoctorId={doctorId||undefined}/></details>}</>}
   <ResourcePage key={`${selectedPage}-${fixedClinicId||""}`} resource={selectedPage} identity={identity} embedded={!!fixedClinicId} fixedClinicId={fixedClinicId} defaults={doctorId?{doctorId,isOpen:true}:{}}/>
 </section>;
}