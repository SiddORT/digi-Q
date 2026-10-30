import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { ErrorNotice } from "../../resources";
import { useAppDialogDiscard } from "../AppDialog";
import { SearchableSelect } from "../SearchableSelect";
import { DateTimePreferencesProvider } from "../DateTimePreferences";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { useConfirm } from "../ConfirmDialog";
import { resolveDateTimePreferences } from "../../lib/date-time";
import { useDirectoryActor } from "../../lib/use-directory";
import { ScheduleContextHeader } from "./ScheduleContextHeader";

/** Saved context only: profile drafts never become schedule write targets. */
export type ScheduleDisplayContext = {doctorId:string;branchId:string;timezone?:string;timeFormat:string};
export function DoctorScheduleContext({doctor: listed, fixedClinicId, fixedBranchId, canDelete=false, onSaved, onDirtyChange, onBusyChange, onDisplayContextChange}: {
  doctor: any; fixedClinicId?: string; fixedBranchId?:string; canDelete?: boolean; onSaved?: () => void; onDisplayContextChange?:(context:ScheduleDisplayContext|null)=>void;
  onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const autoFocus=false;
  const actor = useDirectoryActor();
  const confirm = useConfirm();
  const guarded = useAppDialogDiscard();
  const section = useRef<HTMLElement>(null);
  const [location, setLocation] = useState("");
  const [group, setGroup] = useState("");
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const [weeklyBusy, setWeeklyBusy] = useState(false);
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
  const busy=weeklyBusy;
  useEffect(()=>{onDirtyChange(weeklyDirty);},[weeklyDirty,onDirtyChange]);
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
  const prefs=resolveDateTimePreferences(clinic.data);
  useEffect(()=>{
    onDisplayContextChange?.(branch?{doctorId:doctor.id,branchId:branch.id,timezone:branch.timezone,timeFormat:prefs.timeFormat}:null);
  },[doctor.id,branch?.id,branch?.timezone,prefs.timeFormat,onDisplayContextChange]);
  const showPicker=inGroup.length>1;
  return <section className="doctor-schedule-context" ref={section} tabIndex={-1} aria-label="Doctor schedule" data-testid="doctor-schedule-context">
    {confirm.dialog}
    <ScheduleContextHeader doctor={doctor.fullName} clinic={fixedClinicId||groupIds.length===1?(groups.data||[]).find(g=>g.id===activeGroup)?.name||"Clinic Group":undefined} location={inGroup.length===1?inGroup[0].name:undefined} timezone={branch?.timezone} timeFormat={prefs.timeFormat}>
        {!fixedClinicId&&groupIds.length>1&&<SearchableSelect labelScope={JSON.stringify([actor,doctor.id,"group"])} retainSelectionLabel={false} label="Clinic Group" testId="select-schedule-group" value={group} disabled={busy} onChange={changeGroup} options={groupIds.map(id=>({value:id,label:(groups.data||[]).find(g=>g.id===id)?.name||"Clinic Group"}))}/>}
        {showPicker&&<SearchableSelect labelScope={JSON.stringify([actor,doctor.id])} retainSelectionLabel={false} label="Location" value={location} disabled={busy} onChange={changeLocation} options={inGroup.map(b=>({value:b.id,label:b.name}))}/>}
    </ScheduleContextHeader>
    {fresh.isLoading||(!savedDoctor&&!fresh.error)||locations.isLoading||(!!ids.length&&savedLocations===null&&!locations.error)?<div className="skeleton" role="status">Loading saved locations…</div>:
      fresh.error?<ErrorNotice error={fresh.error} onRetry={()=>fresh.refetch()} busy={fresh.isFetching}/>:
      locations.error?<ErrorNotice error={locations.error} onRetry={()=>locations.refetch()} busy={locations.isFetching}/>:
      !ids.length?<p className="notice">This doctor has no saved location assignments. Edit the doctor and save assignments first.</p>:
      !valid.length?<p className="notice">No active, authorised locations for this doctor{fixedClinicId?" in this clinic group":""}.</p>:
      !branch?<p className="notice">{activeGroup?"Choose a location":"Choose a clinic group"} to view the schedule.</p>:null}
    {branch&&<DateTimePreferencesProvider value={clinic.data}>
      <ErrorNotice error={clinic.error} onRetry={()=>clinic.refetch()} busy={clinic.isFetching}/>
      {!branch.timezone&&<p className="field-error" role="alert">This location has no timezone. Set it in clinic settings before saving schedules.</p>}
      <WeeklyScheduleEditor key={`${doctor.id}:${branch.id}`} doctorId={doctor.id} branchId={branch.id} onDirtyChange={setWeeklyDirty} onBusyChange={setWeeklyBusy} onSaved={onSaved} canDelete={canDelete} doctorName={doctor.fullName} showContext={false} contextual/>
    </DateTimePreferencesProvider>}
  </section>;
}
