import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Editor, resources, ErrorNotice } from "../../resources";
import { AppDialog, useAppDialogDiscard } from "../AppDialog";
import { SearchableSelect } from "../SearchableSelect";
import { DateTimePreferencesProvider } from "../DateTimePreferences";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { useConfirm } from "../ConfirmDialog";
import { formatDate, resolveDateTimePreferences } from "../../lib/date-time";
import { useDirectoryActor } from "../../lib/use-directory";
import { scheduleSnapshot } from "./week-plan";

/** Saved context only: profile drafts never become schedule write targets. */
export function DoctorScheduleContext({doctor: listed, fixedClinicId, fixedBranchId, canDelete=false, onSaved, onDirtyChange, onBusyChange}: {
  doctor: any; fixedClinicId?: string; fixedBranchId?:string; canDelete?: boolean; onSaved?: () => void;
  onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const assignmentDirty=false, profileBusy=false, autoFocus=false;
  const client = useQueryClient();
  const actor = useDirectoryActor();
  const confirm = useConfirm();
  const guarded = useAppDialogDiscard();
  const section = useRef<HTMLElement>(null);
  const [location, setLocation] = useState("");
  const [group, setGroup] = useState("");
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [child, setChild] = useState<{kind:"availability"|"exceptions"; row:any}|null>(null);
  const [childDirty, setChildDirty] = useState(false);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  const [savedDoctor,setSavedDoctor]=useState<any>(null);
  const [savedLocations,setSavedLocations]=useState<any[]|null>(null);
  // Fresh saved assignments, never the (possibly stale) list row.
  const fresh = useQuery({queryKey:["doctor-schedule-fresh",actor,listed.id],enabled:!!listed.id,retry:false,gcTime:0,staleTime:0,queryFn:()=>api.getDoctor(listed.id)});
  useEffect(()=>{
    if(!savedDoctor&&fresh.isFetchedAfterMount&&!fresh.isFetching&&fresh.data&&!fresh.error)setSavedDoctor(fresh.data);
  },[savedDoctor,fresh.data,fresh.isFetchedAfterMount,fresh.isFetching,fresh.error]);
  const doctor:any = savedDoctor || listed;
  const ids: string[] = savedDoctor ? savedDoctor.branchIds || [] : [];
  const locations = useQuery({
    queryKey: ["doctor-editor-locations", actor, doctor.id, ids.join(",")],
    enabled: !!doctor.id && !!ids.length && !!savedDoctor, retry: false, staleTime:0, gcTime:0,
    queryFn: () => Promise.all(ids.map(id => api.getBranch(id))),
  });
  useEffect(()=>{
    if(savedLocations===null&&locations.isFetchedAfterMount&&!locations.isFetching&&locations.data&&!locations.error)setSavedLocations(locations.data);
  },[savedLocations,locations.data,locations.isFetchedAfterMount,locations.isFetching,locations.error]);
   const valid = (savedLocations || []).filter(b => b.status==="active" && (doctor.clinicIds||[]).includes(b.clinicId) && (!fixedClinicId || b.clinicId===fixedClinicId) && (!fixedBranchId || b.id===fixedBranchId));
  const groupIds = [...new Set(valid.map(b => b.clinicId))];
  const activeGroup = fixedClinicId || (groupIds.length === 1 ? groupIds[0] : group);
  const groups = useQuery({ queryKey: ["doctor-schedule-groups", actor, doctor.id, groupIds.join(",")], enabled: groupIds.length > 0, retry: false, queryFn: () => Promise.all(groupIds.map(id => api.getClinic(id))) });
  const inGroup = valid.filter(b => !!activeGroup && b.clinicId === activeGroup);
  const branch = inGroup.find(b => b.id===location);
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
      const body={...data,doctorId:doctor.id,branchId:branch.id,...(child.kind==="availability"?{clinicId:branch.clinicId,expectedSnapshot:scheduleSnapshot(child.row)}:{})};
      return child.kind==="availability"?api.updateSchedule(child.row.id,body):
        child.row.id?api.updateAvailabilityException(child.row.id,body):api.createAvailabilityException(body);
    },
    onSuccess:async()=>{setChild(null);setChildDirty(false);await client.invalidateQueries();},
  });
  const busy=weeklyBusy||save.isPending;
  useEffect(()=>{onDirtyChange(weeklyDirty||childDirty);},[weeklyDirty,childDirty,onDirtyChange]);
  useEffect(()=>{onBusyChange(busy);},[busy,onBusyChange]);
  useEffect(()=>{
    if(locations.isSuccess&&!inGroup.some(b=>b.id===location))setLocation(inGroup.length===1?inGroup[0].id:"");
  },[locations.data,doctor.id,location,activeGroup,inGroup.map(b=>b.id).join(",")]);
  useEffect(()=>{if(autoFocus)requestAnimationFrame(()=>{section.current?.scrollIntoView({block:"start"});section.current?.focus({preventScroll:true});});},[autoFocus]);
  /** Inside the dialog, switches share its single discard prompt; outside, fall back to a local confirmation. */
  const switchContext=async(title:string,description:string,label:string,apply:()=>void)=>{
    if(busy)return;
    if(!weeklyDirty){apply();return;}
    if(guarded){guarded(()=>{setWeeklyDirty(false);apply();});return;}
    if(!await confirm.ask({title,description,confirmLabel:label,tone:"danger"}))return;
    setWeeklyDirty(false);apply();
  };
  const changeLocation=(next:string)=>{if(next!==location)void switchContext("Discard schedule draft?","Changing locations discards the unsaved weekly schedule. Doctor details are kept.","Discard and Change Location",()=>setLocation(next));};
  const changeGroup=(next:string)=>{if(next!==group)void switchContext("Discard schedule draft?","Changing the clinic group discards the unsaved weekly schedule.","Discard and Change Group",()=>{setLocation("");setGroup(next);});};
  const openChild=(kind:"availability"|"exceptions",row:any)=>{
    if(busy||profileBusy||assignmentDirty)return;
    // Both remain mounted. Details cannot refetch over an unsaved weekly draft.
    if(weeklyDirty)return;
    save.reset();setChildDirty(false);setChild({kind,row});
  };
  const prefs=resolveDateTimePreferences(clinic.data);
  const showPicker=inGroup.length>1;
  return <section className="doctor-schedule-context" ref={section} tabIndex={-1} aria-label="Doctor schedule" data-testid="doctor-schedule-context">
    {confirm.dialog}
    <div className="dsc-header" data-testid="schedule-header">
      <div className="dsc-id"><strong>{doctor.fullName}</strong>{(doctor.specializationName||listed.specializationName)&&<span className="muted"> · {doctor.specializationName||listed.specializationName}</span>}<span className="muted"> · ID {doctor.registrationNumber||doctor.code||doctor.doctorCode||String(doctor.id).slice(0,8)}</span></div>
      <div className="dsc-scope">
        {fixedClinicId||groupIds.length===1?<span className="dsc-chip" data-testid="text-fixed-group">{(groups.data||[]).find(g=>g.id===activeGroup)?.name||"Clinic Group"}</span>:
          groupIds.length>1?<SearchableSelect labelScope={JSON.stringify([actor,doctor.id,"group"])} retainSelectionLabel={false} label="Clinic Group" testId="select-schedule-group" value={group} disabled={busy} onChange={changeGroup} options={groupIds.map(id=>({value:id,label:(groups.data||[]).find(g=>g.id===id)?.name||"Clinic Group"}))}/>:null}
        {inGroup.length===1&&<span className="dsc-chip" data-testid="text-fixed-location">{inGroup[0].name}</span>}
        {showPicker&&<SearchableSelect labelScope={JSON.stringify([actor,doctor.id])} retainSelectionLabel={false} label="Location" value={location} disabled={busy} onChange={changeLocation} options={inGroup.map(b=>({value:b.id,label:b.name}))}/>}
        {branch&&<><span className="dsc-chip" title="Schedule times use the clinic's configured timezone. Change it in clinic settings." data-testid="indicator-timezone">Timezone: {branch.timezone||"Not set"} (locked)</span>
        <span className="dsc-chip" title="Time format is set in clinic settings." data-testid="indicator-time-format">Time format: {prefs.timeFormat==="24h"?"24-hour":"12-hour (AM/PM)"} (locked)</span></>}
      </div>
    </div>
    {fresh.isLoading||(!savedDoctor&&!fresh.error)||locations.isLoading||(!!ids.length&&savedLocations===null&&!locations.error)?<div className="skeleton" role="status">Loading saved locations…</div>:
      fresh.error?<><ErrorNotice error={fresh.error}/><button type="button" onClick={()=>void fresh.refetch()}>Retry</button></>:
      locations.error?<><ErrorNotice error={locations.error}/><button type="button" onClick={()=>void locations.refetch()}>Retry Assigned Locations</button></>:
      !ids.length?<p className="notice">This doctor has no saved location assignments. Edit the doctor and save assignments first.</p>:
      !valid.length?<p className="notice">No active, authorised locations for this doctor{fixedClinicId?" in this clinic group":""}.</p>:
      !branch?<p className="notice">{activeGroup?"Choose a location":"Choose a clinic group"} to view the schedule.</p>:null}
    {branch&&<DateTimePreferencesProvider value={clinic.data}>
      <ErrorNotice error={clinic.error}/>{clinic.error&&<button type="button" onClick={()=>void clinic.refetch()}>Retry Date/Time Preferences</button>}
      {!branch.timezone&&<p className="field-error" role="alert">This location has no timezone. Set it in clinic settings before saving schedules.</p>}
      <fieldset disabled={save.isPending} style={{border:0,padding:0,minWidth:0}}>
        <WeeklyScheduleEditor key={`${doctor.id}:${branch.id}`} doctorId={doctor.id} branchId={branch.id} onDirtyChange={setWeeklyDirty} onBusyChange={setWeeklyBusy} onEdit={row=>openChild("availability",row)} onExceptions={()=>setExceptionsOpen(true)} onSaved={onSaved} canDelete={canDelete} doctorName={doctor.fullName} contextual compact/>
      </fieldset>
      <div className="dsc-extra"><button type="button" className="button secondary small" disabled={weeklyDirty||busy} title={weeklyDirty?"Save or discard the schedule draft first":undefined} onClick={()=>{setExceptionsOpen(true);openChild("exceptions",{doctorId:doctor.id,branchId:branch.id,isClosed:true,isExtra:false});}}>Add Date Exception</button></div>
      {exceptionsOpen&&<section aria-label="Date exceptions"><h3>Date Exceptions</h3>
        {exceptions.isLoading?<p role="status">Loading date exceptions…</p>:exceptions.error?<><ErrorNotice error={exceptions.error}/><button type="button" onClick={()=>void exceptions.refetch()}>Retry Date Exceptions</button></>:exceptions.data?.items.length?exceptions.data.items.map(row=><div className="notice" key={row.id}><strong>{formatDate(row.date,clinic.data)}</strong> · {row.reason} <button type="button" disabled={weeklyDirty||busy} onClick={()=>openChild("exceptions",row)}>Edit Date Exception</button></div>):<p className="muted">No date exceptions saved at this location.</p>}
      </section>}
      {child&&<AppDialog open size="medium" title={child.kind==="availability"?"Session Details":child.row.id?"Edit Date Exception":"Add Date Exception"} dirty={childDirty} busy={save.isPending} onClose={()=>{setChild(null);setChildDirty(false);}}>
        <p className="doctor-context-value">{doctor.fullName} · {branch.name}</p>
        <ErrorNotice error={save.error}/>
        <Editor resourceName={child.kind} fields={resources[child.kind].fields.filter(f=>!["doctorId","branchId","clinicId"].includes(f.key))} initial={{...child.row,doctorId:doctor.id,branchId:branch.id,clinicId:branch.clinicId}} busy={save.isPending} onDirtyChange={setChildDirty} onSave={data=>save.mutate(data)} submitLabel={child.kind==="availability"?"Save Session":"Save Date Exception"}/>
      </AppDialog>}
    </DateTimePreferencesProvider>}
  </section>;
}
