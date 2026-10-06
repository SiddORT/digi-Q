import { FormActions } from "./FormActions";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpTip } from "./HelpTip";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { Editor, ErrorNotice, ResourcePage, resources } from "../resources";
import { Users } from "../Users";
import { ResourceLookup } from "./ResourceLookup";
import { AppDialog } from "./AppDialog";
import { clinicalBranchSelection } from "./clinical-branches";
import { SchedulingWorkspace } from "./SchedulingWorkspace";
import { ClinicChangeReview, LinkedScheduleControls, type LinkedSchedule } from "./LinkedScheduleControls";
import "./clinic-settings.css";
import { DateTimeFormatFields } from "./ClinicRegistrationWizard";
import { ClinicRegistrationHours, newWeek, dayError } from "./ClinicRegistrationHours";
import type { DateTimePreferences } from "../lib/date-time";
import { DateTimePreferencesProvider } from "./DateTimePreferences";
import { notifySuccess } from "../lib/notify";
import { ConfirmDialog } from "./ConfirmDialog";
import { SearchableSelect } from "./SearchableSelect";

const sections = [["general","General"],["locations","Locations & Hours"],["sessions","Doctors & Sessions"],["policies","Booking Rules"],["staff","Staff"],["qrs","Booking Links & QR"],["history","Activity history"]] as const;

export function ClinicSettings({identity,scopeSwitch}:{identity:api.Identity;scopeSwitch?:ReactNode}){
 const [,navigate]=useLocation();
 const [clinicId,setClinic]=useState(()=>new URLSearchParams(window.location.search).get("clinicId")||"");
 const [view,setView]=useState(()=>{const value=new URLSearchParams(window.location.search).get("section")||"general";return ["general","locations","sessions","policies","staff","qrs","history"].includes(value)?value:"general";});
 const selectView=(next:string)=>{if(next===view)return;setView(next);const url=new URL(window.location.href);url.searchParams.set("section",next);for(const key of ["search","page","pageSize","sort","status","branchId","doctorId","date","from","to"])url.searchParams.delete(key);navigate(`${url.pathname}${url.search}`);};
 useEffect(()=>{if(clinicId){const url=new URL(window.location.href);url.searchParams.set("clinicId",clinicId);url.searchParams.set("section",view);window.history.replaceState(window.history.state,"",url);}},[clinicId,view]);
 const client=useQueryClient();
 const clinicParams={pageSize:2};
 const clinics=api.useListClinics(clinicParams,{query:{queryKey:api.getListClinicsQueryKey(clinicParams),enabled:!clinicId&&identity.user?.role==="clinicAdmin",refetchInterval:30000}});
 useEffect(()=>{if(!clinicId&&clinics.data?.total===1)setClinic(clinics.data.items[0].id);},[clinicId,clinics.data]);
 const query=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:!!clinicId,refetchInterval:30000}});
 const [section,setSection]=useState<"clinic"|"policies"|null>(null);
 const [branch,setBranch]=useState<api.Branch|null>(null);
 const openedBranchId=useRef<string|null>(null);
 const closeBranch=()=>{setBranch(null);if(openedBranchId.current){const url=new URL(window.location.href);if(url.searchParams.get("branchId")===openedBranchId.current){url.searchParams.delete("branchId");window.history.replaceState(window.history.state,"",url);}openedBranchId.current=null;}};
 const save=api.useUpdateClinicSettings({mutation:{onSuccess:()=>{setSection(null);closeBranch();notifySuccess("Updated successfully");client.invalidateQueries();}}});
 const [dirty,setDirty]=useState(false);
 const [formats,setFormats]=useState<Partial<DateTimePreferences>|null>(null);
 const [confirmFormats,setConfirmFormats]=useState(false);
 const data=query.data;
 const [missingBranch,setMissingBranch]=useState(false);
 useEffect(()=>{
  if(!data||view!=="locations")return;
  const url=new URL(window.location.href);const target=url.searchParams.get("branchId");
  if(!target||openedBranchId.current===target)return;
  const item=data.branches.find(branch=>branch.id===target);
  if(item){openedBranchId.current=target;setDirty(false);setBranch(item);setMissingBranch(false);}
  else{setMissingBranch(true);url.searchParams.delete("branchId");window.history.replaceState(window.history.state,"",url);}
 },[data,view]);
 return <DateTimePreferencesProvider value={data?.clinic}><section className="clinic-settings">
  <div className="settings-scope" data-testid="settings-scope">{scopeSwitch}<div className="settings-scope-lookup"><ResourceLookup resource="clinics" label={identity.user?.role==="superAdmin"?"Clinic Group":"Your Clinic Group"} value={clinicId} onChange={id=>{setClinic(id);setSection(null);closeBranch();save.reset();}}/></div>{data&&!query.error&&<span className="muted settings-scope-meta">{data.branches.length} {data.branches.length===1?"location":"locations"}</span>}</div>
 <ErrorNotice error={query.error||clinics.error}/>{query.error&&<button onClick={()=>query.refetch()}>Retry Clinic Settings</button>}
 {!clinicId?<p className="empty">Select a clinic to manage its settings. Platform settings are separate.</p>:query.isLoading?<p role="status">Loading clinic settings…</p>:data&&!query.error&&<>
  <div className="clinic-section-mobile workspace-section-select"><SearchableSelect label="Clinic Section" value={view} onChange={value=>{if(value)selectView(value);}} options={sections.map(([value,label])=>({value,label}))}/></div>
  <div className="clinic-workspace-layout clinic-workspace"><nav className="clinic-section-menu workspace-section-nav" aria-label="Clinic configuration sections">{sections.map(([key,label])=><button key={key} type="button" aria-current={view===key?"page":undefined} onClick={()=>selectView(key)}>{label}</button>)}</nav><div className="clinic-workspace-content">
 <section hidden={view!=="general"} className="panel padded settings-summary">
  <div className="panel-heading section-head"><div><h2>{data.clinic.name}</h2><p>{data.clinic.address||"No address configured"}</p></div><div className="row-actions"><button type="button" className="button small" onClick={()=>{setDirty(false);save.reset();setSection("clinic");}}>Edit Clinic</button><button type="button" className="button secondary small" onClick={()=>{setFormats({dateFormat:data.clinic.dateFormat,timeFormat:data.clinic.timeFormat});setConfirmFormats(false);save.reset();}}>Edit Date and Time Format</button><Link className="button secondary small" href="/admin/clinics">All Clinics</Link></div></div>
  <dl className="settings-facts">
   <div><dt>Web address</dt><dd>{data.clinic.slug?<Link href={`/${data.clinic.slug}`}>/{data.clinic.slug}</Link>:"Not set. Edit clinic to choose a permanent address."}</dd></div>
   <div><dt>Contacts</dt><dd>{[data.clinic.email,data.clinic.phone].filter(Boolean).join(" · ")||"No clinic contacts configured"}</dd></div>
   <div><dt>Date and time display</dt><dd>{[data.clinic.dateFormat,data.clinic.timeFormat].filter(Boolean).join(" · ")||"Default"} <HelpTip text="Inherited by all clinics in this Clinic Group."/></dd></div>
   <div><dt>Linked owner hours</dt><dd>{data.branches.filter(b=>b.linkedSchedule?.enabled).length} of {data.branches.length} location(s) <HelpTip text="Custom doctor availability is checked separately from linked owner hours."/> <button type="button" className="text-link" onClick={()=>selectView("sessions")}>Check Doctor Booking Readiness</button></dd></div>
  </dl>
 </section>
 <section hidden={view!=="policies"} className="panel padded"><div className="panel-heading section-head"><h2>Booking Policies <HelpTip text="Clinic policies do not configure general notification delivery or authentication session timeout. Those integration controls belong to platform/provider administration."/></h2><button type="button" className="button secondary small" onClick={()=>{setDirty(false);save.reset();setSection("policies");}}>Edit Policies</button></div><p>Booking horizon: {data.policies.bookingHorizonDays??"Not configured"} days · Cancellation cutoff: {data.policies.cancellationCutoffMinutes??"Not configured"} minutes</p></section>
  {view==="sessions"&&<SchedulingWorkspace key={`${clinicId}-sessions`} identity={identity} page="availability" clinicId={clinicId} onLinkOwner={()=>selectView("locations")}/>}
  {view==="locations"&&<><p className="listing-hint">Edit a location to change its details, hours and linked consultations together <HelpTip text="Every change is previewed first, so bookings are never moved without you seeing it."/></p>{missingBranch&&<p role="alert" className="error-box">This location is not available in the selected clinic. Check your clinic and choose an authorised location below.</p>}<ResourcePage key={`${clinicId}-branches`} resource="branches" identity={identity} embedded fixedClinicId={clinicId} onEdit={row=>{const item=data.branches.find(branch=>branch.id===row.id);if(item){setDirty(false);save.reset();setMissingBranch(false);setBranch(item);}else void query.refetch();}}/></>}
  {view==="staff"&&<>{identity.user?.role==="superAdmin"&&<p><Link href="/admin/users">Manage All Staff and Clinic Administrators</Link></p>}<Users key={`${clinicId}-staff`} identity={identity} clinicId={clinicId} embedded/></>}
  {view==="qrs"&&<><p className="listing-hint">Regenerating a QR invalidates printed copies <HelpTip text="Existing booking links stay unchanged when editing clinic hours."/></p><ResourcePage key={`${clinicId}-qrs`} resource="qrs" identity={identity} embedded fixedClinicId={clinicId}/>{data.clinic.slug&&<Link href={`/${data.clinic.slug}`}>Check Patient Booking Page</Link>}</>}
  {view==="history"&&<>{identity.user?.role==="superAdmin"&&<p><Link href="/admin/audit">View Platform-Wide Audit History</Link></p>}<ResourcePage key={`${clinicId}-history`} resource="audit" identity={identity} embedded fixedClinicId={clinicId} allowCreate={false}/></>}
 <AppDialog open={!!section} size="wide" onClose={()=>setSection(null)} title={section==="clinic"?"Clinic Details":"Booking Policies"} dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{section&&<Editor onDirtyChange={setDirty} initial={section==="clinic"?data.clinic:data.policies} fields={section==="clinic"?resources.clinics.fields.filter(field=>["name","address","email","phone","slug","categoryId","specialityIds","referralCode"].includes(field.key)):[{key:"bookingHorizonDays",type:"number",required:true},{key:"cancellationCutoffMinutes",type:"number",required:true}]} busy={save.isPending} onSave={value=>save.mutate({id:clinicId,data:section==="clinic"?{clinic:value}:{policies:value}})}/>}</AppDialog>
  <AppDialog open={!!branch} size="wide" onClose={closeBranch} title="Location opening days & hours" dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{branch&&<BranchSettings key={branch.id} clinicId={clinicId} branch={branch} busy={save.isPending} onDirtyChange={setDirty} onSave={value=>save.mutate({id:clinicId,data:{branches:[value]}})}/>}</AppDialog>
  </div></div>
  <AppDialog open={!!formats} onClose={()=>setFormats(null)} title="Date and Time Format" dirty={!!formats&&(formats.dateFormat!==data.clinic.dateFormat||formats.timeFormat!==data.clinic.timeFormat)} busy={save.isPending}>
    {formats&&<><DateTimeFormatFields value={formats} onChange={patch=>{setFormats(current=>({...current,...patch}));setConfirmFormats(false);}}/><ErrorNotice error={save.error}/><FormActions wide={false} cancelClosesDialog busy={save.isPending} onSubmit={()=>setConfirmFormats(true)} submitLabel="Review Display Change" submitTestId="button-review-formats"/><ConfirmDialog open={confirmFormats} title="Confirm Display Change" description="This changes only how dates and times are displayed throughout this Clinic Group. Stored dates, session times and bookings will not be rewritten." confirmLabel="Confirm Display Change" onCancel={()=>setConfirmFormats(false)} onConfirm={async()=>{await save.mutateAsync({id:clinicId,data:{clinic:formats}});setConfirmFormats(false);setFormats(null);}}/></>}
  </AppDialog>
 </>}
 </section></DateTimePreferencesProvider>;
}

/** One owner-doctor capability editor, shared by the profile and clinic workspace links. */
export function ConsultationManagement({identity}:{identity:api.Identity}){
 const client=useQueryClient();
 const [clinicId,setClinicId]=useState("");
 const [open,setOpen]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [selected,setSelected]=useState<string[]>([]);
 const clinics=api.useListClinics({pageSize:2},{query:{queryKey:api.getListClinicsQueryKey({pageSize:2}),refetchInterval:30000}});
 useEffect(()=>{if(!clinicId&&clinics.data?.total===1)setClinicId(clinics.data.items[0].id);},[clinicId,clinics.data]);
 const settings=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:!!clinicId}});
 const doctor=api.useGetDoctor(identity.doctorId||"",{query:{queryKey:api.getGetDoctorQueryKey(identity.doctorId||""),enabled:!!identity.doctorId}});
 const own=api.useAttachOwnDoctorProfile({mutation:{onSuccess:async()=>{setOpen(false);await client.invalidateQueries();}}});
 const otherIds=(doctor.data?.branchIds||[]).filter(id=>!settings.data?.branches.some(branch=>branch.id===id));
 const other=useQueries({queries:otherIds.map(id=>({queryKey:api.getGetBranchQueryKey(id),queryFn:()=>api.getBranch(id),enabled:open,staleTime:15000}))});
 const choice=clinicalBranchSelection(selected,[...(settings.data?.branches||[]),...other.flatMap(item=>item.data?[item.data]:[])]);
 const start=()=>{own.reset();setDirty(false);setSelected(doctor.data?.branchIds||[]);setOpen(true);};
 const toggle=(id:string,checked:boolean)=>{setDirty(true);setSelected(previous=>checked?[...previous,id]:previous.filter(value=>value!==id));};
 return <section className="panel padded"><div className="panel-heading section-head"><div><h2>My consultation &amp; clinical locations <HelpTip text="Manage where you consult without changing your Clinic Admin account."/></h2></div>{doctor.data?.status==="active"&&<Link href={`/admin/queue?doctor=${encodeURIComponent(identity.doctorId||"")}`}>Open My Queue</Link>}</div>
  <ResourceLookup resource="clinics" label="Clinic" value={clinicId} onChange={setClinicId}/>
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
 const changed=()=>{setPending(null);setValidation("");onDirtyChange(true);};
 return <>
  {branch.openingHours==null&&!hoursChanged&&<p className="notice">No opening-hour limits are configured. Editing contacts alone keeps existing scheduling behaviour.</p>}
  <fieldset disabled={busy} onChange={changed} onInvalidCapture={event=>{
   setValidation("Complete the highlighted fields before reviewing. Each open shift needs a start and end time; linked consultations need a positive whole-number capacity and duration.");
   // Required time controls may be inside collapsed day disclosures.
   let parent=(event.target as HTMLElement).parentElement;
   while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}
  }} style={{border:0,padding:0,minWidth:0}}>
   <section className="notice" aria-label="Copy location opening hours">
    <h3>Copy Opening Hours From Another Location</h3>
    <p>Destination: <strong>{branch.name}</strong>. Copying replaces this location's draft hours only. Contacts, timezone and doctor assignments are not copied. Review Changes checks linked sessions before anything is saved.</p>
    <ResourceLookup resource="clinics" label="Source Clinic Group" value={sourceClinicId} onChange={value=>{setSourceClinicId(value);setCopySource("");setCopyMessage("");}}/>
    <SearchableSelect label="Source Location" value={copySource} onChange={setCopySource} disabled={sources.isFetching||!!sources.error} placeholder="Choose a source location" options={(sources.data?.branches||[]).filter(item=>item.id!==branch.id&&item.status==="active"&&item.openingHours!=null).map(item=>({value:item.id,label:`${item.name}${item.timezone?` · ${item.timezone}`:""}`}))}/>
    {sourceClinicId&&!sources.isFetching&&!sources.error&&sources.data&&!sources.data.branches.some(item=>item.id!==branch.id&&item.status==="active"&&item.openingHours!=null)&&<p>No other active locations with configured hours in this group. Choose another authorized Clinic Group or enter hours below.</p>}
    {sources.error&&<p role="alert">Unable to load source locations. <button type="button" onClick={()=>void sources.refetch()}>Retry</button></p>}
    <button type="button" disabled={!copySource||sources.isFetching||!!sources.error} onClick={()=>{
     const source=sources.data?.branches.find(item=>item.id===copySource&&item.id!==branch.id&&item.status==="active");
     if(!source||source.openingHours==null)return;
     setHours(source.openingHours.map(hour=>({...hour})));setHoursChanged(true);changed();
     setCopyMessage(`Copied hours from ${source.name} to ${branch.name} in this draft. Times use the destination timezone. Review Changes, then Apply to save.`);
    }}>Copy Hours to Draft</button>
    {copyMessage&&<p role="status">{copyMessage}</p>}
   </section>
   {validation&&<p role="alert" className="error-box">{validation}</p>}
   <Editor initial={branch} fields={resources.branches.fields.filter(field=>field.key!=="clinicId"&&field.key!=="status")} busy={busy} submitLabel="Review Changes" reviewOnly onDirtyChange={onDirtyChange} onSave={value=>{const invalid=newWeek().map(day=>({...day,isOpen:hours.some(hour=>hour.dayOfWeek===day.dayOfWeek),sessions:hours.filter(hour=>hour.dayOfWeek===day.dayOfWeek)})).map(dayError).find(Boolean);if(invalid){setValidation(invalid);return;}setPending({...value,id:branch.id,linkedSchedule:linked,...(hoursChanged||branch.openingHours!=null?{openingHours:hours}:{})});}}>
    <div className="wide"><OpeningHoursEditor value={hours} onChange={value=>{setHours(value);setHoursChanged(true);changed();}}/></div>
    <div className="wide"><LinkedScheduleControls value={linked} onChange={value=>{setLinked(value);changed();}}/></div>
   </Editor>
  </fieldset>
  {pending&&<ClinicChangeReview key={JSON.stringify(pending)} clinicId={clinicId} change={{branches:[pending]}} busy={busy} onSave={()=>onSave(pending)}/>}
 </>;
}

export function OpeningHoursEditor({value,onChange}:{value:api.OpeningHour[];onChange:(value:api.OpeningHour[])=>void}){
 const week=newWeek().map(day=>({...day,isOpen:value.some(item=>item.dayOfWeek===day.dayOfWeek),sessions:value.filter(item=>item.dayOfWeek===day.dayOfWeek)}));
 return <fieldset className="branch-hours"><legend>Clinic opening days &amp; hours</legend><p className="muted">Opening hours do not create bookable doctor sessions <HelpTip text="An explicitly closed week stays closed until you choose opening hours."/></p><button type="button" onClick={()=>onChange([])}>Close All Days</button><ClinicRegistrationHours value={week} onChange={days=>onChange(days.filter(day=>day.isOpen).flatMap(day=>day.sessions.map(session=>({...session,dayOfWeek:day.dayOfWeek}))))}/></fieldset>;
}