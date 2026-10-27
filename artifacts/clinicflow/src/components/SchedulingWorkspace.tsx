import { useLocation, useSearch } from "wouter";
import { useRef } from "react";
import * as api from "@workspace/api-client-react";
import { ResourcePage, ErrorNotice } from "../resources";
import { DateTimePreferencesProvider } from "./DateTimePreferences";
import { useWorkspaceBranch, useWorkspaceBranchContext } from "./WorkspaceBranch";
import { useConfirm } from "./ConfirmDialog";
import { notifyWarning } from "../lib/notify";
import { TabIcon } from "./TabIcon";
import "./tab-presentation.css";
import { tabListKeyDown } from "../lib/tabs-a11y";
import { useTabStripVisibility } from "../lib/tab-strip-visibility";

/** Both the clinic section and legacy schedule URLs render this one workflow. */
export function SchedulingWorkspace({identity,page,clinicId:fixedClinicId}:{identity:api.Identity;page:"availability"|"exceptions";clinicId?:string}){
 const [,navigate]=useLocation();
 const {dirty,busy}=useWorkspaceBranchContext();
 const confirmation=useConfirm();
 const confirming=useRef(false);
 const search=useSearch();
 const params=new URLSearchParams(search);
 const pin=useWorkspaceBranch();
 const requestedClinicId=fixedClinicId||params.get("clinicId")||"";
 // An explicit clinic handoff must never silently use another pinned location.
 const schedulePin=requestedClinicId?null:pin;
 const clinicId=requestedClinicId||schedulePin?.clinicId||"";
 const selectedPage=fixedClinicId?(params.get("schedule")==="exceptions"?"exceptions":"availability"):page;
 const tabStrip = useTabStripVisibility(selectedPage);
 const role=identity.user?.role;
 const admin=role==="clinicAdmin"||role==="superAdmin";
 // Browsing lists every authorized schedule row; the doctor filter is optional for every role.
 const doctorId=undefined as string|undefined;
 const settings=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:admin&&!!clinicId}});
 const clinic=api.useGetClinic(clinicId,{query:{queryKey:api.getGetClinicQueryKey(clinicId),enabled:!admin&&!!clinicId}});
 const go=async(target:"availability"|"exceptions")=>{
  if(confirming.current)return;
  if(busy){notifyWarning("Finish saving before changing schedule tabs.");return;}
  if(dirty){
   confirming.current=true;
   try{
    if(!await confirmation.ask({title:"Discard schedule draft?",description:"Changing tabs discards unsaved schedule changes. Saved sessions are kept.",confirmLabel:"Discard and Continue",tone:"danger"}))return;
   }finally{confirming.current=false;}
  }
  const url=new URL(window.location.href);
  for(const key of ["page","sort","search","status","manage"])url.searchParams.delete(key);
  if(fixedClinicId){url.searchParams.set("schedule",target);navigate(`${url.pathname}${url.search}`);}
  else {url.searchParams.delete("schedule");navigate(`/${role==="doctor"?"doctor":role==="receptionist"?"receptionist":"admin"}/${target}${url.search}`);}
 };
 return <DateTimePreferencesProvider value={settings.data?.clinic||clinic.data}>{confirmation.dialog}<section aria-label="Scheduling workspace">
  <div className="schedule-bar" data-testid="schedule-bar">
   <div ref={tabStrip} className="dq-tabs workspace-tabs" role="tablist" aria-label="Schedule sections" onKeyDown={e=>tabListKeyDown(e,["availability","exceptions"],selectedPage,go)}>{([["availability","Weekly"],["exceptions","Exceptions"]] as const).map(([value,label])=><button className="dq-tab" key={value} type="button" role="tab" tabIndex={selectedPage===value?0:-1} aria-selected={selectedPage===value} onClick={()=>{if(selectedPage!==value)go(value);}} data-testid={`button-schedule-${value}`}><TabIcon name={value==="availability"?"weekly":"exceptions"}/>{label}</button>)}</div>
      <div className="schedule-bar-actions">
   </div>
  </div>
   {clinicId&&(admin?settings.isLoading:clinic.isLoading)?<p role="status">Verifying clinic context…</p>:
    clinicId&&(admin?settings.error:clinic.error)?<><ErrorNotice error={admin?settings.error:clinic.error}/><button type="button" onClick={()=>void (admin?settings:clinic).refetch()}>Retry Clinic Context</button></>:
    <ResourcePage key={`${selectedPage}-${clinicId}`} resource={selectedPage} identity={identity} embedded={!!fixedClinicId} fixedClinicId={requestedClinicId||undefined} defaults={{clinicId,verifiedClinicContext:!!requestedClinicId,branchId:schedulePin?.branchId||params.get("branchId")||"",doctorId:params.get("doctorId")||doctorId||"",isOpen:true}}/>}
 </section></DateTimePreferencesProvider>;
}