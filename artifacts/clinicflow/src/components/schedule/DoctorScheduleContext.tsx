import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Editor, resources, ErrorNotice } from "../../resources";
import { AppDialog } from "../AppDialog";
import { SearchableSelect } from "../SearchableSelect";
import { DateTimePreferencesProvider } from "../DateTimePreferences";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { useConfirm } from "../ConfirmDialog";
import { formatDate, resolveDateTimePreferences } from "../../lib/date-time";

/** Saved context only: profile drafts never become schedule write targets. */
export function DoctorScheduleContext({doctor, autoFocus, assignmentDirty, profileBusy, onDirtyChange, onBusyChange}: {
  doctor: any; autoFocus?: boolean; assignmentDirty: boolean; profileBusy: boolean;
  onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const confirm = useConfirm();
  const section = useRef<HTMLElement>(null);
  const [location, setLocation] = useState("");
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [child, setChild] = useState<{kind:"availability"|"exceptions"; row:any}|null>(null);
  const [childDirty, setChildDirty] = useState(false);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  const ids: string[] = doctor.branchIds || [];
  const locations = useQuery({
    queryKey: ["doctor-editor-locations", doctor.id, ids.join(",")],
    enabled: !!doctor.id && !!ids.length, retry: false,
    queryFn: () => Promise.all(ids.map(id => api.getBranch(id))),
  });
  const valid = (locations.data || []).filter(b => b.status==="active" && (doctor.clinicIds||[]).includes(b.clinicId));
  const branch = valid.find(b => b.id===location);
  const clinic = api.useGetClinic(branch?.clinicId||"", {query:{queryKey:api.getGetClinicQueryKey(branch?.clinicId||""),enabled:!!branch}});
  const exceptions = useQuery({
    queryKey:["doctor-editor-exceptions",doctor.id,location], enabled:!!branch&&exceptionsOpen,
    queryFn:async()=>{
      const items:any[]=[];
      for(let page=1;;page++){
        const response=await api.listAvailabilityExceptions({doctorId:doctor.id,branchId:location,page,pageSize:100});
        items.push(...response.items);
        if(items.length>=response.total||!response.items.length)return {items};
      }
    }, retry:false,
  });
  const save = useMutation({
    mutationFn:async(data:any):Promise<unknown>=>{
      if(!child||!branch||assignmentDirty||profileBusy)throw new Error("Save doctor assignments before editing availability.");
      const body={...data,doctorId:doctor.id,branchId:branch.id,...(child.kind==="availability"?{clinicId:branch.clinicId}:{})};
      return child.kind==="availability"?api.updateSchedule(child.row.id,body):
        child.row.id?api.updateAvailabilityException(child.row.id,body):api.createAvailabilityException(body);
    },
    onSuccess:async()=>{setChild(null);setChildDirty(false);await client.invalidateQueries();},
  });
  const busy=weeklyBusy||save.isPending;
  useEffect(()=>{onDirtyChange(weeklyDirty||childDirty);},[weeklyDirty,childDirty,onDirtyChange]);
  useEffect(()=>{onBusyChange(busy);},[busy,onBusyChange]);
  useEffect(()=>{
    if(locations.isSuccess&&!valid.some(b=>b.id===location))setLocation(valid.length===1?valid[0].id:"");
  },[locations.data,doctor.id,location]);
  useEffect(()=>{if(autoFocus)requestAnimationFrame(()=>{section.current?.scrollIntoView({block:"start"});section.current?.focus({preventScroll:true});});},[autoFocus]);
  const changeLocation=async(next:string)=>{
    if(busy||profileBusy||next===location)return;
    if(weeklyDirty&&!await confirm.ask({title:"Discard schedule draft?",description:"Changing locations discards the unsaved weekly schedule. Doctor details are kept.",confirmLabel:"Discard and Change Location",tone:"danger"}))return;
    setWeeklyDirty(false);setLocation(next);
  };
  const openChild=(kind:"availability"|"exceptions",row:any)=>{
    if(busy||profileBusy||assignmentDirty)return;
    // Both remain mounted. Details cannot refetch over an unsaved weekly draft.
    if(weeklyDirty)return;
    save.reset();setChildDirty(false);setChild({kind,row});
  };
  return <section className="doctor-schedule-context" ref={section} tabIndex={-1} aria-label="Doctor schedule" data-testid="doctor-schedule-context">
    {confirm.dialog}
    <h3>Schedule</h3>
    <p className="muted">Saved separately from doctor details, per session.</p>
    <div className="form-grid">
      <div><label>Doctor · fixed record</label><div className="doctor-context-value">{doctor.fullName||"Save the new doctor first"}</div></div>
      {valid.length===1?<div><label>Assigned location · fixed</label><div className="doctor-context-value">{valid[0].name}</div></div>:
        valid.length>1?<SearchableSelect label="Saved assigned location" value={location} disabled={busy||profileBusy} onChange={value=>void changeLocation(value)} options={valid.map(b=>({value:b.id,label:b.name}))}/>:null}
    </div>
    {!doctor.id?<p className="notice">Add the doctor first. This editor will stay open for schedule setup.</p>:
      !ids.length?<p className="notice">No saved location assignments. <button type="button" onClick={()=>{const el=document.getElementById("doctor-assignments");el?.scrollIntoView({block:"start"});el?.querySelector<HTMLElement>("button,input")?.focus();}}>Set up assignments</button> Select a location above and Save Doctor Details.</p>:
      locations.isLoading?<p role="status">Loading saved assigned locations…</p>:
      locations.error?<><ErrorNotice error={locations.error}/><button type="button" onClick={()=>void locations.refetch()}>Retry Assigned Locations</button></>:
      !valid.length?<p className="notice">No active authorised saved locations. Update the assignments above and save doctor details.</p>:
      !branch?<p className="notice">Choose a saved assigned location to view sessions.</p>:null}
    {assignmentDirty&&<p className="notice" role="status">Assignments have unsaved changes. Save Doctor Details before editing availability. If a schedule draft exists, save or discard it first.</p>}
    {branch&&<DateTimePreferencesProvider value={clinic.data}>
      <ErrorNotice error={clinic.error}/>{clinic.error&&<button type="button" onClick={()=>void clinic.refetch()}>Retry Date/Time Preferences</button>}
      <p className="muted">Timezone: {branch.timezone} · Date: {resolveDateTimePreferences(clinic.data).dateFormat} · Time: {resolveDateTimePreferences(clinic.data).timeFormat==="24h"?"24-hour":"12-hour"} · Display preferences inherited from the Clinic Group.</p>
      <fieldset disabled={assignmentDirty||profileBusy||save.isPending} style={{border:0,padding:0,minWidth:0}}>
        <WeeklyScheduleEditor key={`${doctor.id}:${branch.id}`} doctorId={doctor.id} branchId={branch.id} onDirtyChange={setWeeklyDirty} onBusyChange={setWeeklyBusy} onEdit={row=>openChild("availability",row)} onExceptions={()=>setExceptionsOpen(true)} contextual/>
        <button type="button" className="button secondary small" disabled={weeklyDirty||busy} title={weeklyDirty?"Save or discard the weekly draft first":undefined} onClick={()=>{setExceptionsOpen(true);openChild("exceptions",{doctorId:doctor.id,branchId:branch.id,isClosed:true,isExtra:false});}}>Add Date Exception</button>
      </fieldset>
      {weeklyDirty&&<p className="muted">Save or discard the weekly draft before opening session details or adding exceptions.</p>}
      {exceptionsOpen&&<section aria-label="Date exceptions"><h3>Date Exceptions</h3>
        {exceptions.isLoading?<p role="status">Loading date exceptions…</p>:exceptions.error?<><ErrorNotice error={exceptions.error}/><button type="button" onClick={()=>void exceptions.refetch()}>Retry Date Exceptions</button></>:exceptions.data?.items.length?exceptions.data.items.map(row=><div className="notice" key={row.id}><strong>{formatDate(row.date,clinic.data)}</strong> · {row.reason} <button type="button" disabled={weeklyDirty||busy||assignmentDirty||profileBusy} onClick={()=>openChild("exceptions",row)}>Edit Date Exception</button></div>):<p className="muted">No date exceptions saved at this location.</p>}
      </section>}
      {child&&<AppDialog open size="medium" title={child.kind==="availability"?"Session Details":child.row.id?"Edit Date Exception":"Add Date Exception"} dirty={childDirty} busy={save.isPending} onClose={()=>{setChild(null);setChildDirty(false);}}>
        <p className="doctor-context-value">{doctor.fullName} · {branch.name}</p>
        <ErrorNotice error={save.error}/>
        <Editor resourceName={child.kind} fields={resources[child.kind].fields.filter(f=>!["doctorId","branchId","clinicId"].includes(f.key))} initial={{...child.row,doctorId:doctor.id,branchId:branch.id,clinicId:branch.clinicId}} busy={save.isPending} onDirtyChange={setChildDirty} onSave={data=>save.mutate(data)} submitLabel={child.kind==="availability"?"Save Session":"Save Date Exception"}/>
      </AppDialog>}
    </DateTimePreferencesProvider>}
  </section>;
}
