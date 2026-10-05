import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { planCopy } from "./copy-plan";
import { formatTime } from "../../lib/date-time";
import { friendlyError } from "../../lib/friendly-error";
import { notifyBulk } from "../../lib/notify";
import { SearchableSelect } from "../SearchableSelect";
import { useConfirm } from "../ConfirmDialog";

const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function WeeklyOverview({doctorId,branchId,onEdit}:{doctorId:string;branchId:string;onEdit:(row:any)=>void}){
  const client=useQueryClient();
  const confirmation=useConfirm();
  const clinic=api.useGetBranch(branchId,{query:{queryKey:api.getGetBranchQueryKey(branchId),enabled:!!branchId}});
  const q=useQuery<any>({queryKey:["weekly-overview",doctorId,branchId],queryFn:async()=>{const items:any[]=[];for(let page=1;page<50;page++){const res:any=await api.listSchedules({doctorId,branchId,page,pageSize:100} as any);items.push(...res.items);if(items.length>=res.total||!res.items.length)break;}return {items};}});
  const [source,setSource]=useState("");const [targets,setTargets]=useState<number[]>([]);const [busy,setBusy]=useState(false);const [result,setResult]=useState("");
  const rows:any[]=q.data?.items||[];
  const copy=async(all=false)=>{
    if(busy||source==="")return;setBusy(true);setResult("");
    const plan=planCopy(rows,Number(source),all?[0,1,2,3,4,5,6].filter(day=>day!==Number(source)):targets);let made=0;const failed:string[]=[];const outcomes:{label:string;ok:boolean;message?:string}[]=[];
    if(plan.creates.length&&!await confirmation.ask({title:"Copy Doctor Sessions?",description:`Create ${plan.creates.length} sessions. Each session saves separately; this is not an atomic weekly update. Existing sessions are never overwritten. Successful saves remain if another session fails.`,confirmLabel:"Copy Sessions"})){setBusy(false);return;}
    for(const body of plan.creates){const label=`${DAYS[body.dayOfWeek as number]} ${body.startTime}`;try{await api.createSchedule(body as any);made++;outcomes.push({label,ok:true});}catch(e){const message=friendlyError(e,"save");failed.push(`${label}: ${message}`);outcomes.push({label,ok:false,message});}}
    if(outcomes.length)notifyBulk(outcomes,"created");
    const day=(x:string)=>DAYS[Number(x.split(":")[0])]+" "+x.slice(x.indexOf(":")+1);
    setResult(`Created ${made}. Already identical: ${plan.skipped.length}.${plan.conflicts.length?` Not copied (existing different session overlaps): ${plan.conflicts.map(day).join("; ")}.`:""}${failed.length?` Failed: ${failed.join("; ")}.`:""}`);
    setBusy(false);setTargets([]);client.invalidateQueries();
  };
  if(q.isLoading)return <div className="skeleton" role="status">Loading weekly overview…</div>;
  if(q.error)return <div className="error-box" role="alert">Weekly overview unavailable. <button onClick={()=>q.refetch()}>Retry</button></div>;
  return <section className="panel padded" data-testid="panel-weekly-overview">
    {confirmation.dialog}
    {clinic.error&&<p role="alert">Clinic hours could not be loaded. <button type="button" onClick={()=>void clinic.refetch()}>Retry Clinic Hours</button></p>}
    <div className="weekly-overview">{[1,2,3,4,5,6,0].map(i=>{const d=DAYS[i];const day=rows.filter(r=>r.dayOfWeek===i).sort((a,b)=>a.startTime.localeCompare(b.startTime));const hours=(clinic.data?.openingHours||[]).filter(hour=>hour.dayOfWeek===i);return <div className="day" key={d}><strong>{d}</strong>{clinic.data&&<small className="muted">Clinic: {hours.length?hours.map(hour=>`${formatTime(hour.startTime,rows[0])}–${formatTime(hour.endTime,rows[0])}`).join(", "):"Closed"}</small>}{day.length?day.map(r=><button type="button" disabled={busy} className="slot" key={r.id} onClick={()=>onEdit(r)} data-testid={`button-slot-${r.id}`}>{formatTime(r.startTime,r)}–{formatTime(r.endTime,r)}{r.isOpen?"":" (closed)"} · {r.maxTokens} patients</button>):<span className="muted">No sessions</span>}<button type="button" disabled={busy||!clinic.data} onClick={()=>onEdit({doctorId,branchId,clinicId:clinic.data?.clinicId,dayOfWeek:i,isOpen:true,timezone:clinic.data?.timezone,startTime:hours[0]?.startTime||"",endTime:hours[0]?.endTime||""})}>Add Session</button></div>;})}</div>
    <div className="weekly-copy"><SearchableSelect label="Copy Sessions From" value={source} disabled={busy} onChange={value=>{setSource(value);setTargets(targets=>targets.filter(day=>String(day)!==value));}} options={[1,2,3,4,5,6,0].filter(day=>rows.some(row=>row.dayOfWeek===day)).map(day=>({value:String(day),label:DAYS[day]}))}/>
      {[1,2,3,4,5,6,0].map(i=>String(i)!==source&&<label key={i}><input type="checkbox" disabled={busy} checked={targets.includes(i)} onChange={e=>setTargets(t=>e.target.checked?[...t,i]:t.filter(x=>x!==i))}/>{DAYS[i]}</label>)}
      <button disabled={busy||source===""||!targets.length} onClick={()=>copy()} data-testid="button-copy-days">{busy?"Copying…":"Copy to Selected Days"}</button><button disabled={busy||source===""} onClick={()=>copy(true)} data-testid="button-copy-all-days">Copy to All Days</button></div>
    <small className="muted">Choose a day to add or edit any number of sessions, including closed sessions. Save each session separately. Copying preserves existing sessions, skips identical ones and reports conflicts and partial failures; it is not an atomic weekly replacement. Owner-linked hours must be edited through clinic settings.</small>
    {result&&<p className="notice" role="status">{result}</p>}
  </section>;
}
