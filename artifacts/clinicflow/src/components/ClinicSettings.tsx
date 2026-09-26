import { useEffect, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { Editor, ErrorNotice, resources } from "../resources";
import { ResourceLookup } from "./ResourceLookup";
import { AppDialog } from "./AppDialog";
import { clinicalBranchSelection } from "./clinical-branches";
import { ClinicSessionSetup } from "./ClinicSessionSetup";
import "./clinic-settings.css";

export function ClinicSettings({identity}:{identity:api.Identity}){
 const [clinicId,setClinic]=useState(()=>new URLSearchParams(window.location.search).get("clinicId")||"");
 const client=useQueryClient();
 const clinicParams={pageSize:2};
 const clinics=api.useListClinics(clinicParams,{query:{queryKey:api.getListClinicsQueryKey(clinicParams),enabled:!clinicId&&identity.user?.role==="clinicAdmin",refetchInterval:30000}});
 useEffect(()=>{if(!clinicId&&clinics.data?.total===1)setClinic(clinics.data.items[0].id);},[clinicId,clinics.data]);
 const query=api.useGetClinicSettings(clinicId,{query:{queryKey:api.getGetClinicSettingsQueryKey(clinicId),enabled:!!clinicId,refetchInterval:30000}});
 const [section,setSection]=useState<"clinic"|"policies"|null>(null);
 const [branch,setBranch]=useState<api.Branch|null>(null);
 const [ownProfile,setOwnProfile]=useState(false);
 const [clinicalBranches,setClinicalBranches]=useState<string[]>([]);
 const save=api.useUpdateClinicSettings({mutation:{onSuccess:()=>{setSection(null);setBranch(null);client.invalidateQueries();}}});
 const doctor=api.useGetDoctor(identity.doctorId||"",{query:{queryKey:api.getGetDoctorQueryKey(identity.doctorId||""),enabled:!!identity.doctorId}});
 const own=api.useAttachOwnDoctorProfile({mutation:{onSuccess:async()=>{setOwnProfile(false);await client.invalidateQueries();}}});
 const [dirty,setDirty]=useState(false);
 const data=query.data;
 const otherIds=(doctor.data?.branchIds||[]).filter(id=>!data?.branches.some(branch=>branch.id===id));
 const otherQueries=useQueries({queries:otherIds.map(id=>({queryKey:api.getGetBranchQueryKey(id),queryFn:()=>api.getBranch(id),enabled:ownProfile,staleTime:15000}))});
 const otherBranches=otherQueries.flatMap(result=>result.data?[result.data]:[]);
 const selection=clinicalBranchSelection(clinicalBranches,[...(data?.branches||[]),...otherBranches]);
 const openClinical=()=>{own.reset();setDirty(false);setClinicalBranches(doctor.data?.branchIds||[]);setOwnProfile(true);};
 const toggleClinical=(id:string,checked:boolean)=>{setDirty(true);setClinicalBranches(previous=>checked?[...previous,id]:previous.filter(value=>value!==id));};
 return <section className="clinic-settings">
  <ResourceLookup resource="clinics" label={identity.user?.role==="superAdmin"?"Select clinic to configure":"Your clinic"} value={clinicId} onChange={id=>{setClinic(id);setSection(null);setBranch(null);setOwnProfile(false);save.reset();}}/>
 <ErrorNotice error={query.error||clinics.error}/>{query.error&&<button onClick={()=>query.refetch()}>Retry clinic settings</button>}
 {!clinicId?<p className="empty">Select a clinic to manage its settings. Platform settings are separate.</p>:query.isLoading?<p role="status">Loading clinic settings…</p>:data&&!query.error&&<>
 <section className="panel padded"><div className="panel-heading"><div><h2>{data.clinic.name}</h2><p>{data.clinic.address}</p></div><button onClick={()=>{setDirty(false);save.reset();setSection("clinic");}}>Edit clinic</button></div>
 <p>Web address: {data.clinic.slug?<Link href={`/${data.clinic.slug}`}>/{data.clinic.slug}</Link>:"Not set — edit clinic to choose a permanent address"}</p><p>{[data.clinic.email,data.clinic.phone].filter(Boolean).join(" · ")||"No clinic contacts configured"}</p>
 </section>
 <section className="panel padded"><div className="panel-heading"><h2>Booking policies</h2><button onClick={()=>{setDirty(false);save.reset();setSection("policies");}}>Edit policies</button></div><p>Booking horizon: {data.policies.bookingHorizonDays??"Not configured"} days · Cancellation cutoff: {data.policies.cancellationCutoffMinutes??"Not configured"} minutes</p></section>
 <ClinicSessionSetup key={clinicId} clinicId={clinicId} branches={data.branches} ownDoctorId={identity.doctorId||undefined}/>
 <section className="panel padded"><h2>Opening days &amp; hours · locations</h2><p>Location hours do not create bookable doctor sessions. Configure each doctor's sessions above.</p>{data.branches.map(item=><details key={item.id}><summary>{item.name} · {item.city||item.address} · {(item.openingHours||[]).length} open interval{(item.openingHours||[]).length===1?"":"s"}</summary><p>Effective email: {item.effectiveEmail||"Not set"} · Effective phone: {item.effectivePhone||"Not set"}</p><p>Web address: {item.slug||"Not set"}</p><button onClick={()=>{setDirty(false);save.reset();setBranch(item);}}>Edit opening days &amp; hours</button></details>)}<Link href="/admin/branches">Manage locations</Link></section>
   {identity.user?.role==="clinicAdmin"&&<section className="panel padded"><h2>My consultation</h2><p>Consult at your own branches while retaining the full Clinic Admin workspace. No role switch or second login is needed.</p><ErrorNotice error={doctor.error}/>{doctor.error&&<button onClick={()=>doctor.refetch()}>Retry doctor profile</button>}{identity.doctorId?<><div className="row-actions"><Link href="/admin/profile">Edit my doctor profile</Link><button onClick={openClinical} disabled={doctor.isLoading||!!doctor.error}>Manage clinical branches</button>{doctor.data?.status==="active"&&<Link href={`/admin/queue?doctor=${encodeURIComponent(identity.doctorId)}`}>Open my consultation queue</Link>}</div>{doctor.data?.status==="inactive"&&<p className="notice" role="status">Your doctor profile is inactive. Clinical queue access is unavailable until you reactivate it in My consultation. Your clinic administration remains available.</p>}</>:<button onClick={openClinical}>Enable my doctor profile</button>}</section>}
 <AppDialog open={!!section} onClose={()=>setSection(null)} title={section==="clinic"?"Clinic details":"Booking policies"} dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{section&&<Editor onDirtyChange={setDirty} initial={section==="clinic"?data.clinic:data.policies} fields={section==="clinic"?resources.clinics.fields.filter(field=>["name","address","email","phone","slug","categoryId","specialityIds","referralCode"].includes(field.key)):[{key:"bookingHorizonDays",type:"number",required:true},{key:"cancellationCutoffMinutes",type:"number",required:true}]} busy={save.isPending} onSave={value=>save.mutate({id:clinicId,data:section==="clinic"?{clinic:value}:{policies:value}})}/>}</AppDialog>
 <AppDialog open={!!branch} onClose={()=>setBranch(null)} title="Location opening days & hours" dirty={dirty} busy={save.isPending}><ErrorNotice error={save.error}/>{branch&&<BranchSettings key={branch.id} branch={branch} busy={save.isPending} onDirtyChange={setDirty} onSave={value=>save.mutate({id:clinicId,data:{branches:[value]}})}/>}</AppDialog>
 </>}
   <AppDialog open={ownProfile} onClose={()=>setOwnProfile(false)} title={identity.doctorId?"Manage clinical branches":"Enable my doctor profile"} busy={own.isPending} dirty={dirty}><p>Choose active branches where you consult. You may remove the last branch at this clinic if another active owned branch stays selected. Inactive selections must be removed before saving.</p><ErrorNotice error={own.error}/><form onSubmit={event=>{event.preventDefault();if(selection.canSave&&!own.isPending)own.mutate({data:{branchIds:selection.branchIds}});}}>{(data?.branches||[]).filter(item=>item.status==="active"||clinicalBranches.includes(item.id)).map(item=><label className="check-label" key={item.id}><input type="checkbox" checked={clinicalBranches.includes(item.id)} disabled={item.status!=="active"&&!clinicalBranches.includes(item.id)} onChange={event=>toggleClinical(item.id,event.target.checked)}/> {item.name} · {item.city||item.address}{item.status!=="active"&&" · Inactive — remove before saving"}</label>)}{!!otherIds.length&&<><h3>Selected at other clinics</h3>{otherIds.map((id,index)=>{const item=otherQueries[index].data;return <div key={id}><label className="check-label"><input type="checkbox" checked={clinicalBranches.includes(id)} disabled={!clinicalBranches.includes(id)} onChange={event=>toggleClinical(id,event.target.checked)}/> {item?`${item.name} · ${item.city||item.address} (${item.clinicId})${item.status!=="active"?" · Inactive — remove before saving":""}`:`Branch ${id} · ${otherQueries[index].error?"Unable to load — remove or retry":"Loading details…"}`}</label>{otherQueries[index].error&&<><ErrorNotice error={otherQueries[index].error}/><button type="button" onClick={()=>otherQueries[index].refetch()}>Retry branch details</button></>}</div>;})}</>}{!selection.canSave&&<p className="muted" role="status">{selection.inactive.length?"Remove inactive branches before saving. ":""}{selection.unknown.length?"Wait for selected branch details, retry, or remove unavailable selections. ":""}{!selection.branchIds.length?"Choose at least one active owned branch.":""}</p>}<div className="form-footer"><button className="button" disabled={own.isPending||!selection.canSave}>{own.isPending?"Saving…":identity.doctorId?"Save clinical branches":"Enable my doctor profile"}</button></div></form></AppDialog>
 </section>;
}

function BranchSettings({branch,busy,onDirtyChange,onSave}:{branch:api.Branch;busy:boolean;onDirtyChange:(value:boolean)=>void;onSave:(value:api.ClinicBranchSetup)=>void}){
 const [hours,setHours]=useState<api.OpeningHour[]>(branch.openingHours||[]);
 const [hoursChanged,setHoursChanged]=useState(false);
 return <>{branch.openingHours==null&&!hoursChanged&&<p className="notice">No branch opening-hour limits are configured. Editing contact details alone keeps existing scheduling behavior. Choosing hours below creates an explicit weekly plan.</p>}<OpeningHoursEditor value={hours} onChange={value=>{setHours(value);setHoursChanged(true);onDirtyChange(true);}}/><Editor initial={branch} fields={resources.branches.fields.filter(field=>field.key!=="clinicId"&&field.key!=="status")} busy={busy} onDirtyChange={value=>onDirtyChange(value||hoursChanged)} onSave={value=>onSave({...value,id:branch.id,...(hoursChanged||branch.openingHours!=null?{openingHours:hours}:{})})}/></>;
}

export function OpeningHoursEditor({value,onChange}:{value:api.OpeningHour[];onChange:(value:api.OpeningHour[])=>void}){
 const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 const replace=(day:number,items:api.OpeningHour[])=>onChange([...value.filter(item=>item.dayOfWeek!==day),...items]);
 return <fieldset className="branch-hours"><legend>Location opening days &amp; hours</legend><p className="muted">Location opening hours do not create bookable doctor sessions. An explicitly closed week stays closed until you choose opening hours.</p><button type="button" onClick={()=>onChange([])}>Close all days</button>{days.map((name,day)=>{
 const shifts=value.filter(item=>item.dayOfWeek===day);
 return <details key={name}><summary>{name} · {shifts.length?shifts.map(item=>`${item.startTime}–${item.endTime}`).join(", "):"Closed"}</summary><label><input type="checkbox" checked={!!shifts.length} onChange={event=>replace(day,event.target.checked?[{dayOfWeek:day,startTime:"09:00",endTime:"17:00"}]:[])}/> Open</label>{shifts.map((shift,index)=><div className="form-grid" key={index}><label>Shift {index+1} starts<input type="time" required value={shift.startTime} onChange={event=>replace(day,shifts.map((item,i)=>i===index?{...item,startTime:event.target.value}:item))}/></label><label>Ends<input type="time" required value={shift.endTime} onChange={event=>replace(day,shifts.map((item,i)=>i===index?{...item,endTime:event.target.value}:item))}/></label><button type="button" onClick={()=>replace(day,shifts.filter((_,i)=>i!==index))}>Remove shift</button></div>)}<button type="button" onClick={()=>replace(day,[...shifts,{dayOfWeek:day,startTime:"",endTime:""}])}>Add shift</button>{!!shifts.length&&<button type="button" onClick={()=>onChange(days.flatMap((_,target)=>shifts.map(item=>({...item,dayOfWeek:target}))))}>Copy hours to all days</button>}</details>;
 })}</fieldset>;
}