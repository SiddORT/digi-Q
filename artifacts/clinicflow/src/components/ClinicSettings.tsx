import { FormActions } from "./FormActions";
import { FormDisclosure, FormSection } from "./FormSection";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpTip } from "./HelpTip";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Building2, Phone, Copy, Check, ExternalLink, Info, ChevronRight, MapPin, Settings2, CalendarDays, Pencil } from "lucide-react";
import { clinicsReturnHref, clinicWorkspaceHref, parseClinicWorkspace } from "../lib/clinic-navigation";
import { useWorkspaceLeaveGuard } from "../lib/use-workspace-leave-guard";
import * as api from "@workspace/api-client-react";
import { Editor, ErrorNotice, ResourcePage, resources } from "../resources";
import { Users } from "../Users";
import { ResourceLookup } from "./ResourceLookup";
import { AppDialog } from "./AppDialog";
import { clinicalBranchSelection } from "./clinical-branches";
import { ClinicChangeReview, LinkedScheduleControls, type LinkedSchedule } from "./LinkedScheduleControls";
import "./clinic-settings.css";
import { DateTimeFormatFields } from "./ClinicRegistrationWizard";
import { ClinicRegistrationHours, newWeek, dayError } from "./ClinicRegistrationHours";
import type { DateTimePreferences } from "../lib/date-time";
import { DateTimePreferencesProvider } from "./DateTimePreferences";
import { notifySuccess, notifyWarning } from "../lib/notify";
import { usePublicWebsite } from "../lib/public-website";
import { ConfirmDialog, useConfirm } from "./ConfirmDialog";
import { SearchableSelect } from "./SearchableSelect";
import { useRegisterUnsaved, useWorkspaceBranchContext } from "./WorkspaceBranch";
import { ClinicMetadataFacts } from "./ClinicMetadataFields";

const sections = [["details","Details"],["locations","Locations"],["staff","Staff"],["policies","Policies"],["activity-history","Activity History"]] as const;
type SectionKey = typeof sections[number][0];
// This endpoint persists one full address string, not the separate geography
// controls from the general resource editor. Blank nullable contacts clear them.
const clinicEditFields=()=>resources.clinics.fields.filter(field=>["name","address","email","phone","slug","categoryId","customCategory","specialityIds","customSpecialities","referralCode"].includes(field.key)).map(field=>({
 ...field,
 ...(field.key==="address"?{type:"textarea",nullable:true}:{}),
 ...(["email","phone","categoryId","referralCode"].includes(field.key)?{nullable:true}:{}),
}));

function CopyValue({value,label}:{value:string;label:string}){
 const [done,setDone]=useState(false);
 const timer=useRef<number|undefined>(undefined);
 useEffect(()=>()=>window.clearTimeout(timer.current),[]);
 return <><button type="button" className="cs-copy" aria-label={`Copy ${label}`} data-testid={`button-copy-${label.toLowerCase().replace(/\W+/g,"-")}`} onClick={async()=>{try{await navigator.clipboard.writeText(value);setDone(true);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setDone(false),2000);}catch{notifyWarning("Copy is not available in this browser. Select and copy the displayed value instead.");}}}>{done?<Check size={14} aria-hidden/>:<Copy size={14} aria-hidden/>}</button><span className="sr-only" role="status">{done?`${label} copied`:""}</span></>;
}

export function ClinicSettings({identity,scopeSwitch}:{identity:api.Identity;scopeSwitch?:ReactNode}){
 const [location,navigate]=useLocation();
 const search=useSearch();
 const params=new URLSearchParams(search);
 const parsed=parseClinicWorkspace(location,search) as {clinicId?:string;section?:string}|null;
 const clinicId=parsed?.clinicId||params.get("clinicId")||"";
 const view=(sections.some(([key])=>key===parsed?.section)?parsed?.section:"details") as SectionKey;
 const client=useQueryClient();
 const site=usePublicWebsite();
 const workspaceDrafts=useWorkspaceBranchContext();
 const confirm=useConfirm();
 const askRef=useRef(confirm.ask);askRef.current=confirm.ask;
 const clinicParams={pageSize:2};
 const clinics=api.useListClinics(clinicParams,{query:{queryKey:api.getListClinicsQueryKey(clinicParams),enabled:!clinicId&&identity.user?.role==="clinicAdmin",refetchInterval:30000}});
 const query=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:!!clinicId,refetchInterval:30000}});
 const [section,setSection]=useState<"clinic"|"policies"|null>(null);
 const [branch,setBranch]=useState<api.Branch|null>(null);
 const openedBranchId=useRef<string|null>(null);
 const closeBranch=()=>{setBranch(null);setDirty(false);if(openedBranchId.current){const url=new URL(window.location.href);if(url.searchParams.get("branchId")===openedBranchId.current){url.searchParams.delete("branchId");window.history.replaceState(window.history.state,"",url);}openedBranchId.current=null;}};
 const [formats,setFormats]=useState<Partial<DateTimePreferences>|null>(null);
 const [confirmFormats,setConfirmFormats]=useState(false);
 const save=api.useUpdateClinicSettings({mutation:{onSuccess:(saved)=>{client.setQueryData(api.getGetClinicSettingsQueryKey(clinicId),saved);setSection(null);closeBranch();setDirty(false);notifySuccess("Updated successfully");client.invalidateQueries();}}});
 const [dirty,setDirty]=useState(false);
 const data=query.data;
 const formatDirty=!!formats&&!!data&&(formats.dateFormat!==data.clinic.dateFormat||formats.timeFormat!==data.clinic.timeFormat);
 const anyDirty=dirty||formatDirty||workspaceDrafts.dirty;
 const locked=save.isPending||workspaceDrafts.busy;
 const resetDialogs=()=>{setSection(null);setBranch(null);openedBranchId.current=null;setFormats(null);setConfirmFormats(false);setDirty(false);save.reset();};
 const resetRef=useRef(resetDialogs);resetRef.current=resetDialogs;
 useRegisterUnsaved(dirty||formatDirty,save.isPending);
 useWorkspaceLeaveGuard(location,anyDirty||locked,(o:any)=>locked?Promise.resolve(false):askRef.current(o),resetDialogs);
 useEffect(()=>{
  if(!anyDirty&&!locked)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
 },[anyDirty,locked]);
 // Reset transient dialogs and mutation state whenever the clinic changes.
 const lastClinic=useRef(clinicId);
 useEffect(()=>{if(lastClinic.current!==clinicId){lastClinic.current=clinicId;resetRef.current();setMissingBranch(false);}},[clinicId]);
 /** Programmatic moves ask first when drafts exist and never run during a save. */
 const moving=useRef(false);
 const guarded=async(go:()=>void)=>{
  if(locked||moving.current)return;
  moving.current=true;
  try {
   if(anyDirty&&!await askRef.current({title:"Discard Changes?",description:"You have unsaved changes. Leaving discards them.",confirmLabel:"Discard Changes",tone:"danger"}))return;
   resetDialogs();go();
  } finally { moving.current=false; }
 };
 const setClinic=(id:string,replace=false)=>{
  const next=new URLSearchParams(search);
  ["clinicId","section","branchId","open"].forEach(key=>next.delete(key));
  navigate(clinicWorkspaceHref(id,view,next.toString())+window.location.hash,{replace});
 };
 useEffect(()=>{
  if(!clinicId||anyDirty||locked)return;
  const canonical=clinicWorkspaceHref(clinicId,view,search);
  if(`${location}${search?`?${search}`:""}`!==canonical)navigate(`${canonical}${window.location.hash}`,{replace:true});
 },[clinicId,view,location,search,anyDirty,locked,navigate]);
 useEffect(()=>{if(!clinicId&&clinics.data?.total===1)setClinic(clinics.data.items[0].id,true);},[clinicId,clinics.data]);// eslint-disable-line react-hooks/exhaustive-deps
 const selectView=(next:SectionKey)=>{if(next===view)return;void guarded(()=>{const keep=params.get("returnTo");navigate(clinicWorkspaceHref(clinicId,next,keep?`returnTo=${encodeURIComponent(keep)}`:""));});};
 const [missingBranch,setMissingBranch]=useState(false);
 useEffect(()=>{
  if(!data||view!=="locations")return;
  const url=new URL(window.location.href);const target=url.searchParams.get("branchId");
  if(!target||openedBranchId.current===target)return;
  const item=data.branches.find(b=>b.id===target);
  if(item){openedBranchId.current=target;setDirty(false);setBranch(item);setMissingBranch(false);}
  else{setMissingBranch(true);url.searchParams.delete("branchId");window.history.replaceState(window.history.state,"",url);}
 },[data,view]);
 const tabKeys=sections.map(([key])=>key);
 const onTabKey=(event:React.KeyboardEvent,index:number)=>{
  const move=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:0;
  const target=event.key==="Home"?0:event.key==="End"?tabKeys.length-1:move?(index+move+tabKeys.length)%tabKeys.length:-1;
  if(target<0)return;event.preventDefault();
  document.getElementById(`clinic-tab-${tabKeys[target]}`)?.focus();selectView(tabKeys[target]);
 };
 const openClinicEdit=()=>{if(locked)return;setDirty(false);save.reset();setSection("clinic");};
 const linkedCount=data?data.branches.filter(b=>b.linkedSchedule?.enabled).length:0;
 const clinic=data?.clinic;
 const active=clinic?.status==="active";
 return <DateTimePreferencesProvider value={data?.clinic}><section className="clinic-settings">
  <div className="settings-scope" data-testid="settings-scope">{scopeSwitch}<div className="settings-scope-lookup"><ResourceLookup resource="clinics" label={identity.user?.role==="superAdmin"?"Clinic Group":"Your Clinic Group"} value={clinicId} onChange={id=>{if(id!==clinicId)void guarded(()=>setClinic(id));}}/></div></div>
  {identity.user?.role==="superAdmin"&&<Link className="cs-back" href={clinicsReturnHref(search)} data-testid="link-all-clinic-groups">&larr; Back to Clinics</Link>}
  <ErrorNotice error={query.error||clinics.error}/>{query.error&&<button type="button" onClick={()=>query.refetch()}>Retry Clinic Settings</button>}
  {!clinicId?<p className="empty">Select a clinic to manage its settings. Platform settings are separate.</p>:query.isLoading?<p role="status">Loading clinic settings…</p>:data&&clinic&&!query.error&&<>
   <header className="panel padded cs-overview" data-testid="clinic-overview">
    <div className="cs-mark" aria-hidden><Building2 size={44}/></div>
    <div className="cs-identity">
     <div className="cs-title"><h2 data-testid="text-clinic-name">{clinic.name}</h2><span className={`cs-status${active?" live":""}`} data-testid="text-clinic-status">{active?"Active":"Inactive"}</span></div>
     <p className="cs-address"><MapPin size={14} aria-hidden/>{clinic.address||"No address configured"}</p>
     <div className="cs-actions">
      <button type="button" className="button small" disabled={locked} onClick={openClinicEdit} data-testid="button-edit-clinic"><Pencil size={14} aria-hidden/> Edit Clinic</button>
      <button type="button" className="button secondary small" disabled={locked} onClick={()=>{setFormats({dateFormat:clinic.dateFormat,timeFormat:clinic.timeFormat});setConfirmFormats(false);save.reset();}} data-testid="button-edit-date-time"><CalendarDays size={14} aria-hidden/> Edit Date &amp; Time</button>
      <span className="cs-scope" data-testid="settings-scope-badge"><Settings2 size={14} aria-hidden/> Clinic-wide management <HelpTip label="About clinic-wide management" text="Details, hours and policies here apply across every location in this Clinic Group. Day-to-day queues and appointments use the location chosen in the workspace header."/></span>
     </div>
    </div>
    <aside className="cs-linked-card" aria-label="Linked owner hours summary">
     <button type="button" className="cs-linked-main" disabled={locked} onClick={()=>selectView("locations")} data-testid="button-linked-locations"><span><small>Linked Locations</small><strong>{linkedCount} of {data.branches.length} location(s)</strong></span><ChevronRight size={18} aria-hidden/></button>
     <Link className="cs-readiness" href={`/admin/availability?clinicId=${encodeURIComponent(clinicId)}`} data-testid="link-booking-readiness">Check Doctor Booking Readiness <ExternalLink size={14} aria-hidden/></Link>
    </aside>
   </header>
   <div className="clinic-workspace-tabs-layout"><div className="workspace-tabs" role="tablist" aria-label="Clinic sections">{sections.map(([key,label],index)=><button key={key} id={`clinic-tab-${key}`} type="button" role="tab" aria-selected={view===key} aria-controls={`clinic-panel-${key}`} tabIndex={view===key?0:-1} disabled={locked} onKeyDown={event=>onTabKey(event,index)} onClick={()=>selectView(key)} data-testid={`tab-clinic-${key}`}>{label}</button>)}</div>
   <div className="clinic-workspace-content" role="tabpanel" id={`clinic-panel-${view}`} aria-labelledby={`clinic-tab-${view}`}>
   {view==="details"&&<>
    <div className="cs-cards">
     <section className="panel padded cs-card" aria-labelledby="cs-basic"><div className="cs-card-head"><h3 id="cs-basic"><Building2 size={18} aria-hidden/> Basic Information</h3><button type="button" className="button secondary small" disabled={locked} onClick={openClinicEdit} data-testid="button-edit-basic">Edit</button></div>
      <dl className="cs-list">
       <div><dt>Clinic Name</dt><dd>{clinic.name}</dd></div>
        <ClinicMetadataFacts clinic={clinic}/>
       <div><dt>Address</dt><dd>{clinic.address||"Not set"}</dd></div>
       <div><dt>Web Address</dt><dd>{clinic.slug?<><Link href={`/${clinic.slug}`}>/{clinic.slug}</Link>{site.url(`/${clinic.slug}`)&&<CopyValue value={site.url(`/${clinic.slug}`)!} label="Web address"/>}</>:"Not set. Edit clinic to choose a permanent address."}</dd></div>
       <div><dt>Status</dt><dd><span className={`cs-status${active?" live":""}`}>{active?"Active":"Inactive"}</span></dd></div>
       <div><dt>Date &amp; Time Display</dt><dd><strong>{[clinic.dateFormat,clinic.timeFormat].filter(Boolean).join(" · ")||"Default"}</strong> <HelpTip text="Inherited by all clinics in this Clinic Group."/></dd></div>
      </dl></section>
     <section className="panel padded cs-card" aria-labelledby="cs-contact"><div className="cs-card-head"><h3 id="cs-contact"><Phone size={18} aria-hidden/> Contact Information</h3><button type="button" className="button secondary small" disabled={locked} onClick={openClinicEdit} data-testid="button-edit-contact">Edit</button></div>
      <dl className="cs-list">
       <div><dt>Clinic Email</dt><dd>{clinic.email?<><span className="cs-wrap">{clinic.email}</span><CopyValue value={clinic.email} label="Clinic email"/></>:"Not set"}</dd></div>
       <div><dt>Phone</dt><dd>{clinic.phone?<><span>{clinic.phone}</span><CopyValue value={clinic.phone} label="Phone"/></>:"Not set"}</dd></div>
      </dl></section>
    </div>
    <section className="panel padded cs-hours" aria-labelledby="cs-hours-title"><div className="cs-card-head"><h3 id="cs-hours-title"><Info size={18} aria-hidden/> Linked Owner Hours</h3><button type="button" className="button secondary small" disabled={locked} onClick={()=>selectView("locations")} data-testid="button-manage-linked-hours">Manage</button></div>
     <div className="cs-hours-body"><div><small>Locations Linked</small><strong data-testid="text-linked-count">{linkedCount} of {data.branches.length} location(s)</strong> <HelpTip text="Custom doctor availability is checked separately from linked owner hours."/></div>
      <p className="cs-hours-note">{linkedCount?"Enabled linked schedules use location hours to maintain owner sessions. Booking availability is checked separately.":"No locations linked yet. Link locations to manage clinic timings and availability."}</p>
      <Link className="cs-readiness" href={`/admin/availability?clinicId=${encodeURIComponent(clinicId)}`}>Check Doctor Booking Readiness <ExternalLink size={14} aria-hidden/></Link></div></section>
   </>}
   {view==="policies"&&<section className="panel padded"><div className="panel-heading section-head"><h2>Booking Policies <HelpTip text="Clinic policies do not configure general notification delivery or authentication session timeout. Those integration controls belong to platform/provider administration."/></h2><button type="button" className="button secondary small" disabled={locked} onClick={()=>{if(locked)return;setDirty(false);save.reset();setSection("policies");}}>Edit Policies</button></div><p>Booking horizon: {data.policies.bookingHorizonDays??"Not configured"} days · Cancellation cutoff: {data.policies.cancellationCutoffMinutes??"Not configured"} minutes</p><p className="muted">Saved notification preferences and delivery policies remain in effect.</p></section>}
   {view==="activity-history"&&<section className="panel padded" data-testid="details-clinic-history"><h2>Activity History</h2>{identity.user?.role==="superAdmin"&&<p><Link href="/admin/settings?area=audit">View Platform-Wide Audit History</Link></p>}<ResourcePage key={`${clinicId}-history`} resource="audit" identity={identity} embedded fixedClinicId={clinicId} allowCreate={false}/></section>}
   {view==="locations"&&<>{missingBranch&&<p role="alert" className="error-box">This location is not available in the selected clinic. Check your clinic and choose an authorised location below.</p>}<ResourcePage key={`${clinicId}-branches`} resource="branches" identity={identity} embedded fixedClinicId={clinicId} onEdit={row=>{if(locked)return;const item=data.branches.find(b=>b.id===row.id);if(item){setDirty(false);save.reset();setMissingBranch(false);setBranch(item);}else void query.refetch();}}/>
    <section className="workspace-subsection" aria-labelledby="clinic-location-qr"><div className="panel-heading section-head"><div><h2 id="clinic-location-qr">Booking links &amp; QR</h2><p className="muted">Regenerating a QR invalidates printed copies <HelpTip text="Existing booking links stay unchanged when editing clinic hours."/></p></div><div className="row-actions"><Link className="button secondary small" href={`/admin/availability?clinicId=${encodeURIComponent(clinicId)}`} data-testid="link-location-schedule">Weekly schedule</Link><Link className="button secondary small" href={`/admin/exceptions?clinicId=${encodeURIComponent(clinicId)}`} data-testid="link-location-exceptions">Exceptions</Link>{clinic.slug&&<Link className="button secondary small" href={`/${clinic.slug}`}>Patient booking page</Link>}</div></div><ResourcePage key={`${clinicId}-qrs`} resource="qrs" identity={identity} embedded fixedClinicId={clinicId}/></section>
    {identity.user?.role==="clinicAdmin"&&<div className="workspace-subsection"><ConsultationManagement identity={identity} clinicId={clinicId}/></div>}</>}
   {view==="staff"&&<>{identity.user?.role==="superAdmin"&&<p><Link href="/admin/staff" data-testid="link-global-staff">Manage All Staff and Clinic Administrators</Link></p>}<Users key={`${clinicId}-staff`} identity={identity} clinicId={clinicId} embedded/></>}
   <AppDialog open={!!section} size="medium" onClose={()=>{setSection(null);setDirty(false);}} title={section==="clinic"?"Clinic Details":"Booking Policies"} dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{section&&<Editor onDirtyChange={setDirty} initial={section==="clinic"?data.clinic:data.policies} fields={section==="clinic"?clinicEditFields():[{key:"bookingHorizonDays",type:"number",required:true,label:"Booking Horizon (days)",width:"md"},{key:"cancellationCutoffMinutes",type:"number",required:true,label:"Cancellation Cutoff (minutes)",width:"md"}]} busy={save.isPending} onSave={value=>save.mutate({id:clinicId,data:section==="clinic"?{clinic:{...value,...(value.address===null?{address:""}:{})}}:{policies:value}})}/>}</AppDialog>
   <AppDialog open={!!branch} size="wide" onClose={closeBranch} title={`Edit Location · ${branch?.name||""}`} dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{branch&&<BranchSettings key={branch.id} clinicId={clinicId} branch={branch} busy={save.isPending} onDirtyChange={setDirty} onSave={value=>save.mutate({id:clinicId,data:{branches:[value]}})}/>}</AppDialog>
   </div></div>
   <AppDialog open={!!formats} onClose={()=>{setFormats(null);setConfirmFormats(false);}} title="Date and Time Format" dirty={formatDirty} busy={save.isPending}>
    {formats&&<><DateTimeFormatFields value={formats} onChange={patch=>{setFormats(current=>({...current,...patch}));setConfirmFormats(false);}}/><ErrorNotice error={save.error}/><FormActions wide={false} cancelClosesDialog busy={save.isPending} onSubmit={()=>setConfirmFormats(true)} submitLabel="Review Display Change" submitTestId="button-review-formats"/><ConfirmDialog open={confirmFormats} title="Confirm Display Change" description="This changes only how dates and times are displayed throughout this Clinic Group. Stored dates, session times and bookings will not be rewritten." confirmLabel="Confirm Display Change" onCancel={()=>setConfirmFormats(false)} onConfirm={async()=>{await save.mutateAsync({id:clinicId,data:{clinic:formats}});setConfirmFormats(false);setFormats(null);}}/></>}
   </AppDialog>
  </>}
  {confirm.dialog}
 </section></DateTimePreferencesProvider>;
}

/** One owner-doctor capability editor, shared by the profile and clinic workspace links. */
export function ConsultationManagement({identity,clinicId:fixedClinicId}:{identity:api.Identity;clinicId?:string}){
 const client=useQueryClient();
 const [chosenClinicId,setClinicId]=useState("");
 const clinicId=fixedClinicId||chosenClinicId;
 const [open,setOpen]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [selected,setSelected]=useState<string[]>([]);
 const clinics=api.useListClinics({pageSize:2},{query:{queryKey:api.getListClinicsQueryKey({pageSize:2}),enabled:!fixedClinicId,refetchInterval:30000}});
 useEffect(()=>{if(!clinicId&&clinics.data?.total===1)setClinicId(clinics.data.items[0].id);},[clinicId,clinics.data]);
 const settings=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:!!clinicId}});
 const doctor=api.useGetDoctor(identity.doctorId||"",{query:{queryKey:api.getGetDoctorQueryKey(identity.doctorId||""),enabled:!!identity.doctorId}});
 const own=api.useAttachOwnDoctorProfile({mutation:{onSuccess:async()=>{setOpen(false);setDirty(false);await client.invalidateQueries();}}});
 useRegisterUnsaved(open&&dirty,own.isPending);
 const otherIds=(doctor.data?.branchIds||[]).filter(id=>!settings.data?.branches.some(branch=>branch.id===id));
 const other=useQueries({queries:otherIds.map(id=>({queryKey:api.getGetBranchQueryKey(id),queryFn:()=>api.getBranch(id),enabled:open,staleTime:15000}))});
 const choice=clinicalBranchSelection(selected,[...(settings.data?.branches||[]),...other.flatMap(item=>item.data?[item.data]:[])]);
 const start=()=>{own.reset();setDirty(false);setSelected(doctor.data?.branchIds||[]);setOpen(true);};
 const toggle=(id:string,checked:boolean)=>{setDirty(true);setSelected(previous=>checked?[...previous,id]:previous.filter(value=>value!==id));};
 return <section className="panel padded"><div className="panel-heading section-head"><div><h2>My consulting locations <HelpTip text="Manage where you consult without changing your Clinic Admin account."/></h2></div>{doctor.data?.status==="active"&&<Link href={`/admin/queue?doctor=${encodeURIComponent(identity.doctorId||"")}`}>Open My Queue</Link>}</div>
  {!fixedClinicId&&<ResourceLookup resource="clinics" label="Clinic" value={clinicId} onChange={setClinicId}/>}
  <ErrorNotice error={settings.error||doctor.error||clinics.error}/>{(settings.error||doctor.error)&&<button type="button" onClick={()=>{void settings.refetch();void doctor.refetch();}}>Retry Consultation Details</button>}
  {doctor.data?.status==="inactive"&&<p className="notice">Your clinical profile is inactive. Administration remains available; reactivate your doctor profile before using the queue.</p>}
  {clinicId&&settings.data&&<button type="button" onClick={start} disabled={doctor.isLoading||!!doctor.error}>{identity.doctorId?"Manage Clinical Locations":"Enable My Doctor Profile"}</button>}
  <AppDialog open={open} onClose={()=>setOpen(false)} title={identity.doctorId?"Manage Clinical Locations":"Enable My Doctor Profile"} busy={own.isPending} dirty={dirty}><p>Choose active owned locations where you consult. Removing an inactive location is permitted; you must retain at least one active location overall.</p><ErrorNotice error={own.error}/>
   <form onSubmit={event=>{event.preventDefault();if(choice.canSave&&!own.isPending)own.mutate({data:{branchIds:choice.branchIds}});}}>
    {(settings.data?.branches||[]).filter(item=>item.status==="active"||selected.includes(item.id)).map(item=><label className="check-label" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event=>toggle(item.id,event.target.checked)}/> {item.name} · {item.city||item.address}{item.status!=="active"&&" · Inactive — remove before saving"}</label>)}
    {!!otherIds.length&&<><h3>Previously Selected at Other Clinics</h3>{otherIds.map((id,index)=>{const item=other[index].data;return <div key={id}><label className="check-label"><input type="checkbox" checked={selected.includes(id)} onChange={event=>toggle(id,event.target.checked)}/> {item?`${item.name} · ${item.city||item.address}${item.status!=="active"?" · Inactive":""}`:`Location ${id} · ${other[index].error?"Unable to load — remove or retry":"Loading…"}`}</label>{other[index].error&&<button type="button" onClick={()=>void other[index].refetch()}>Retry Location</button>}</div>;})}</>}
    {!choice.canSave&&<p role="status">{choice.inactive.length?"Remove inactive locations. ":""}{choice.unknown.length?"Wait, retry or remove unavailable locations. ":""}{!choice.branchIds.length?"Choose an active location.":""}</p>}
    <FormActions wide={false} busy={own.isPending} disabled={!choice.canSave} submitLabel={identity.doctorId?"Save Clinical Locations":"Enable My Doctor Profile"}/>
   </form></AppDialog>
 </section>;
}

function BranchSettings({branch,clinicId,busy,onDirtyChange,onSave}:{branch:api.Branch;clinicId:string;busy:boolean;onDirtyChange:(value:boolean)=>void;onSave:(value:api.ClinicBranchSetup)=>void}){
 const [sourceClinicId,setSourceClinicId]=useState(clinicId);
 const sources=api.useGetClinicSettings(sourceClinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(sourceClinicId),enabled:!!sourceClinicId}});
 const [copySource,setCopySource]=useState("");
 const [copyMessage,setCopyMessage]=useState("");
 const [hours,setHours]=useState<api.OpeningHour[]>(branch.openingHours||[]);
 const [hoursChanged,setHoursChanged]=useState(false);
 const [linked,setLinked]=useState<LinkedSchedule>(branch.linkedSchedule || {enabled:false});
 const [pending,setPending]=useState<api.ClinicBranchSetup|null>(null);
 const [validation,setValidation]=useState("");
 const [editorDirty,setEditorDirty]=useState(false);
 const [extraDirty,setExtraDirty]=useState(false);
 const dirtyRef=useRef(onDirtyChange);dirtyRef.current=onDirtyChange;
 useEffect(()=>{dirtyRef.current(editorDirty||extraDirty);},[editorDirty,extraDirty]);
 useEffect(()=>()=>dirtyRef.current(false),[]);
 const changed=()=>{setPending(null);setValidation("");};
 const extraChanged=()=>{changed();setExtraDirty(true);};
 return <>
  {branch.openingHours==null&&!hoursChanged&&<p className="notice">No opening-hour limits are configured. Editing contacts alone keeps existing scheduling behaviour.</p>}
  <fieldset disabled={busy} onChange={changed} onInvalidCapture={event=>{
   setValidation("Complete the highlighted fields before reviewing. Each open shift needs a start and end time; linked consultations need a positive whole-number capacity and duration.");
   // Required time controls may be inside collapsed day disclosures.
   let parent=(event.target as HTMLElement).parentElement;
   while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}
  }} style={{border:0,padding:0,minWidth:0}}>
   <FormDisclosure title="Copy Opening Hours From Another Location" summary="Optional. Replaces this location's draft hours only." testId="details-copy-location-hours">
    <p className="muted">Destination: <strong>{branch.name}</strong>. Copying replaces this location's draft hours only. Contacts, timezone and doctor assignments are not copied. Review Changes checks linked sessions before anything is saved.</p>
    <ResourceLookup resource="clinics" label="Source Clinic Group" value={sourceClinicId} onChange={value=>{setSourceClinicId(value);setCopySource("");setCopyMessage("");}}/>
    <SearchableSelect label="Source Location" value={copySource} onChange={setCopySource} disabled={sources.isFetching||!!sources.error} placeholder="Choose a source location" options={(sources.data?.branches||[]).filter(item=>item.id!==branch.id&&item.status==="active"&&item.openingHours!=null).map(item=>({value:item.id,label:`${item.name}${item.timezone?` · ${item.timezone}`:""}`}))}/>
    {sourceClinicId&&!sources.isFetching&&!sources.error&&sources.data&&!sources.data.branches.some(item=>item.id!==branch.id&&item.status==="active"&&item.openingHours!=null)&&<p>No other active locations with configured hours in this group. Choose another authorized Clinic Group or enter hours below.</p>}
    {sources.error&&<p role="alert">Unable to load source locations. <button type="button" onClick={()=>void sources.refetch()}>Retry</button></p>}
    <button type="button" disabled={!copySource||sources.isFetching||!!sources.error} onClick={()=>{
     const source=sources.data?.branches.find(item=>item.id===copySource&&item.id!==branch.id&&item.status==="active");
     if(!source||source.openingHours==null)return;
     setHours(source.openingHours.map(hour=>({...hour})));setHoursChanged(true);extraChanged();
     setCopyMessage(`Copied hours from ${source.name} to ${branch.name} in this draft. Times use the destination timezone. Review Changes, then Apply to save.`);
    }}>Copy Hours to Draft</button>
    {copyMessage&&<p role="status">{copyMessage}</p>}
   </FormDisclosure>
   {validation&&<p role="alert" className="error-box">{validation}</p>}
   <Editor initial={branch} fields={resources.branches.fields.filter(field=>field.key!=="clinicId"&&field.key!=="status")} busy={busy} submitLabel="Review Changes" reviewOnly onDirtyChange={setEditorDirty} onSave={value=>{const invalid=newWeek().map(day=>({...day,isOpen:hours.some(hour=>hour.dayOfWeek===day.dayOfWeek),sessions:hours.filter(hour=>hour.dayOfWeek===day.dayOfWeek)})).map(dayError).find(Boolean);if(invalid){setValidation(invalid);return;}setPending({...value,id:branch.id,linkedSchedule:linked,...(hoursChanged||branch.openingHours!=null?{openingHours:hours}:{})});}}>
    <FormSection title="Opening hours" grid={false}><OpeningHoursEditor value={hours} onChange={value=>{setHours(value);setHoursChanged(true);extraChanged();}}/></FormSection>
    <FormSection title="Linked owner schedule" grid={false}><LinkedScheduleControls value={linked} onChange={value=>{setLinked(value);extraChanged();}}/></FormSection>
   </Editor>
  </fieldset>
  {pending&&<ClinicChangeReview key={JSON.stringify(pending)} clinicId={clinicId} change={{branches:[pending]}} busy={busy} onSave={()=>onSave(pending)}/>}
 </>;
}

export function OpeningHoursEditor({value,onChange}:{value:api.OpeningHour[];onChange:(value:api.OpeningHour[])=>void}){
 const week=newWeek().map(day=>({...day,isOpen:value.some(item=>item.dayOfWeek===day.dayOfWeek),sessions:value.filter(item=>item.dayOfWeek===day.dayOfWeek)}));
 return <fieldset className="branch-hours"><legend>Clinic opening days &amp; hours</legend><p className="muted">Opening hours do not create bookable doctor sessions <HelpTip text="An explicitly closed week stays closed until you choose opening hours."/></p><button type="button" onClick={()=>onChange([])}>Close All Days</button><ClinicRegistrationHours value={week} onChange={days=>onChange(days.filter(day=>day.isOpen).flatMap(day=>day.sessions.map(session=>({...session,dayOfWeek:day.dayOfWeek}))))}/></fieldset>;
}
