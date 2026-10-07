import { FormActions } from "./FormActions";
import { FormDisclosure, FormSection } from "./FormSection";
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
import { ClinicChangeReview, LinkedScheduleControls, type LinkedSchedule } from "./LinkedScheduleControls";
import "./clinic-settings.css";
import { DateTimeFormatFields } from "./ClinicRegistrationWizard";
import { ClinicRegistrationHours, newWeek, dayError } from "./ClinicRegistrationHours";
import type { DateTimePreferences } from "../lib/date-time";
import { DateTimePreferencesProvider } from "./DateTimePreferences";
import { notifySuccess } from "../lib/notify";
import { ConfirmDialog } from "./ConfirmDialog";
import { SearchableSelect } from "./SearchableSelect";

const sections = [["general","Details"],["locations","Locations"],["staff","Staff"],["policies","Policies"]] as const;
/** Older links pointed at separate sections; they now open the tab that contains that content. */
const legacySection = (value:string|null) => value==="details"||!value ? "general" : value==="qrs"||value==="sessions" ? "locations" : value==="history" ? "general" : ["general","locations","policies","staff"].includes(value) ? value : "general";

export function ClinicSettings({identity,scopeSwitch}:{identity:api.Identity;scopeSwitch?:ReactNode}){
 const [,navigate]=useLocation();
 const [clinicId,setClinic]=useState(()=>new URLSearchParams(window.location.search).get("clinicId")||"");
 const [view,setView]=useState(()=>legacySection(new URLSearchParams(window.location.search).get("section")));
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
  <div className="settings-scope" data-testid="settings-scope">{scopeSwitch}<div className="settings-scope-lookup"><ResourceLookup resource="clinics" label={identity.user?.role==="superAdmin"?"Clinic Group":"Your Clinic Group"} value={clinicId} onChange={id=>{setClinic(id);setSection(null);closeBranch();save.reset();}}/></div>{identity.user?.role==="superAdmin"&&<Link className="button secondary small" href="/admin/clinics" data-testid="link-all-clinic-groups">All Clinic Groups</Link>}<span className="settings-scope-badge" data-testid="settings-scope-badge">Clinic-wide management <HelpTip label="About management scope" text="These settings apply across every location in this Clinic Group. Day-to-day queues and appointments use the location chosen in the workspace header."/></span></div>
 <ErrorNotice error={query.error||clinics.error}/>{query.error&&<button onClick={()=>query.refetch()}>Retry Clinic Settings</button>}
 {!clinicId?<p className="empty">Select a clinic to manage its settings. Platform settings are separate.</p>:query.isLoading?<p role="status">Loading clinic settings…</p>:data&&!query.error&&<>
  <div className="clinic-workspace-tabs-layout"><div className="workspace-tabs" role="tablist" aria-label="Clinic sections">{sections.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={view===key} onClick={()=>selectView(key)} data-testid={`tab-clinic-${key}`}>{label}</button>)}</div><div className="clinic-workspace-content">
 <section hidden={view!=="general"} className="panel padded settings-summary">
  <div className="panel-heading section-head"><div><h2>{data.clinic.name}</h2><p>{data.clinic.address||"No address configured"}</p></div><div className="row-actions"><button type="button" className="button small" onClick={()=>{setDirty(false);save.reset();setSection("clinic");}}>Edit Clinic</button><button type="button" className="button secondary small" onClick={()=>{setFormats({dateFormat:data.clinic.dateFormat,timeFormat:data.clinic.timeFormat});setConfirmFormats(false);save.reset();}}>Edit Date and Time Format</button></div></div>
  <dl className="settings-facts">
   <div><dt>Web address</dt><dd>{data.clinic.slug?<Link href={`/${data.clinic.slug}`}>/{data.clinic.slug}</Link>:"Not set. Edit clinic to choose a permanent address."}</dd></div>
   <div><dt>Contacts</dt><dd>{[data.clinic.email,data.clinic.phone].filter(Boolean).join(" · ")||"No clinic contacts configured"}</dd></div>
   <div><dt>Date and time display</dt><dd>{[data.clinic.dateFormat,data.clinic.timeFormat].filter(Boolean).join(" · ")||"Default"} <HelpTip text="Inherited by all clinics in this Clinic Group."/></dd></div>
   <div><dt>Linked owner hours</dt><dd>{data.branches.filter(b=>b.linkedSchedule?.enabled).length} of {data.branches.length} location(s) <HelpTip text="Custom doctor availability is checked separately from linked owner hours."/> <Link className="text-link" href="/admin/availability">Check Doctor Booking Readiness</Link></dd></div>
  </dl>
 </section>
 <section hidden={view!=="policies"} className="panel padded"><div className="panel-heading section-head"><h2>Booking Policies <HelpTip text="Clinic policies do not configure general notification delivery or authentication session timeout. Those integration controls belong to platform/provider administration."/></h2><button type="button" className="button secondary small" onClick={()=>{setDirty(false);save.reset();setSection("policies");}}>Edit Policies</button></div><p>Booking horizon: {data.policies.bookingHorizonDays??"Not configured"} days · Cancellation cutoff: {data.policies.cancellationCutoffMinutes??"Not configured"} minutes</p></section>
  {view==="general"&&<details className="panel padded workspace-subsection" data-testid="details-clinic-history"><summary><strong>Activity history</strong></summary>{identity.user?.role==="superAdmin"&&<p><Link href="/admin/settings?area=audit">View Platform-Wide Audit History</Link></p>}<ResourcePage key={`${clinicId}-history`} resource="audit" identity={identity} embedded fixedClinicId={clinicId} allowCreate={false}/></details>}
  {view==="locations"&&<>{missingBranch&&<p role="alert" className="error-box">This location is not available in the selected clinic. Check your clinic and choose an authorised location below.</p>}<ResourcePage key={`${clinicId}-branches`} resource="branches" identity={identity} embedded fixedClinicId={clinicId} onEdit={row=>{const item=data.branches.find(branch=>branch.id===row.id);if(item){setDirty(false);save.reset();setMissingBranch(false);setBranch(item);}else void query.refetch();}}/>
   <section className="workspace-subsection" aria-labelledby="clinic-location-qr"><div className="panel-heading section-head"><div><h2 id="clinic-location-qr">Booking links &amp; QR</h2><p className="muted">Regenerating a QR invalidates printed copies <HelpTip text="Existing booking links stay unchanged when editing clinic hours."/></p></div><div className="row-actions"><Link className="button secondary small" href="/admin/availability" data-testid="link-location-schedule">Weekly schedule</Link><Link className="button secondary small" href="/admin/exceptions" data-testid="link-location-exceptions">Exceptions</Link>{data.clinic.slug&&<Link className="button secondary small" href={`/${data.clinic.slug}`}>Patient booking page</Link>}</div></div><ResourcePage key={`${clinicId}-qrs`} resource="qrs" identity={identity} embedded fixedClinicId={clinicId}/></section>
   {identity.user?.role==="clinicAdmin"&&<div className="workspace-subsection"><ConsultationManagement identity={identity} clinicId={clinicId}/></div>}</>}
  {view==="staff"&&<>{identity.user?.role==="superAdmin"&&<p><Link href="/admin/users?area=staff">Manage All Staff and Clinic Administrators</Link></p>}<Users key={`${clinicId}-staff`} identity={identity} clinicId={clinicId} embedded/></>}
 <AppDialog open={!!section} size="medium" onClose={()=>setSection(null)} title={section==="clinic"?"Clinic Details":"Booking Policies"} dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{section&&<Editor onDirtyChange={setDirty} initial={section==="clinic"?data.clinic:data.policies} fields={section==="clinic"?resources.clinics.fields.filter(field=>["name","address","email","phone","slug","categoryId","specialityIds","referralCode"].includes(field.key)):[{key:"bookingHorizonDays",type:"number",required:true,label:"Booking Horizon (days)",width:"md"},{key:"cancellationCutoffMinutes",type:"number",required:true,label:"Cancellation Cutoff (minutes)",width:"md"}]} busy={save.isPending} onSave={value=>save.mutate({id:clinicId,data:section==="clinic"?{clinic:value}:{policies:value}})}/>}</AppDialog>
  <AppDialog open={!!branch} size="wide" onClose={closeBranch} title={`Edit Location · ${branch?.name||""}`} dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{branch&&<BranchSettings key={branch.id} clinicId={clinicId} branch={branch} busy={save.isPending} onDirtyChange={setDirty} onSave={value=>save.mutate({id:clinicId,data:{branches:[value]}})}/>}</AppDialog>
  </div></div>
  <AppDialog open={!!formats} onClose={()=>setFormats(null)} title="Date and Time Format" dirty={!!formats&&(formats.dateFormat!==data.clinic.dateFormat||formats.timeFormat!==data.clinic.timeFormat)} busy={save.isPending}>
    {formats&&<><DateTimeFormatFields value={formats} onChange={patch=>{setFormats(current=>({...current,...patch}));setConfirmFormats(false);}}/><ErrorNotice error={save.error}/><FormActions wide={false} cancelClosesDialog busy={save.isPending} onSubmit={()=>setConfirmFormats(true)} submitLabel="Review Display Change" submitTestId="button-review-formats"/><ConfirmDialog open={confirmFormats} title="Confirm Display Change" description="This changes only how dates and times are displayed throughout this Clinic Group. Stored dates, session times and bookings will not be rewritten." confirmLabel="Confirm Display Change" onCancel={()=>setConfirmFormats(false)} onConfirm={async()=>{await save.mutateAsync({id:clinicId,data:{clinic:formats}});setConfirmFormats(false);setFormats(null);}}/></>}
  </AppDialog>
 </>}
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
 const own=api.useAttachOwnDoctorProfile({mutation:{onSuccess:async()=>{setOpen(false);await client.invalidateQueries();}}});
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
 const changed=()=>{setPending(null);setValidation("");onDirtyChange(true);};
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
     setHours(source.openingHours.map(hour=>({...hour})));setHoursChanged(true);changed();
     setCopyMessage(`Copied hours from ${source.name} to ${branch.name} in this draft. Times use the destination timezone. Review Changes, then Apply to save.`);
    }}>Copy Hours to Draft</button>
    {copyMessage&&<p role="status">{copyMessage}</p>}
   </FormDisclosure>
   {validation&&<p role="alert" className="error-box">{validation}</p>}
   <Editor initial={branch} fields={resources.branches.fields.filter(field=>field.key!=="clinicId"&&field.key!=="status")} busy={busy} submitLabel="Review Changes" reviewOnly onDirtyChange={onDirtyChange} onSave={value=>{const invalid=newWeek().map(day=>({...day,isOpen:hours.some(hour=>hour.dayOfWeek===day.dayOfWeek),sessions:hours.filter(hour=>hour.dayOfWeek===day.dayOfWeek)})).map(dayError).find(Boolean);if(invalid){setValidation(invalid);return;}setPending({...value,id:branch.id,linkedSchedule:linked,...(hoursChanged||branch.openingHours!=null?{openingHours:hours}:{})});}}>
    <FormSection title="Opening hours" grid={false}><OpeningHoursEditor value={hours} onChange={value=>{setHours(value);setHoursChanged(true);changed();}}/></FormSection>
    <FormSection title="Linked owner schedule" grid={false}><LinkedScheduleControls value={linked} onChange={value=>{setLinked(value);changed();}}/></FormSection>
   </Editor>
  </fieldset>
  {pending&&<ClinicChangeReview key={JSON.stringify(pending)} clinicId={clinicId} change={{branches:[pending]}} busy={busy} onSave={()=>onSave(pending)}/>}
 </>;
}

export function OpeningHoursEditor({value,onChange}:{value:api.OpeningHour[];onChange:(value:api.OpeningHour[])=>void}){
 const week=newWeek().map(day=>({...day,isOpen:value.some(item=>item.dayOfWeek===day.dayOfWeek),sessions:value.filter(item=>item.dayOfWeek===day.dayOfWeek)}));
 return <fieldset className="branch-hours"><legend>Clinic opening days &amp; hours</legend><p className="muted">Opening hours do not create bookable doctor sessions <HelpTip text="An explicitly closed week stays closed until you choose opening hours."/></p><button type="button" onClick={()=>onChange([])}>Close All Days</button><ClinicRegistrationHours value={week} onChange={days=>onChange(days.filter(day=>day.isOpen).flatMap(day=>day.sessions.map(session=>({...session,dayOfWeek:day.dayOfWeek}))))}/></fieldset>;
}