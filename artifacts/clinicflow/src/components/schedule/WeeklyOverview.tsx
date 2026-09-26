import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { planCopy } from "./copy-plan";

const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function WeeklyOverview({doctorId,branchId,onEdit}:{doctorId:string;branchId:string;onEdit:(row:any)=>void}){
  const client=useQueryClient();
  const q=useQuery<any>({queryKey:["weekly-overview",doctorId,branchId],queryFn:async()=>{const items:any[]=[];for(let page=1;page<50;page++){const res:any=await api.listSchedules({doctorId,branchId,page,pageSize:100} as any);items.push(...res.items);if(items.length>=res.total||!res.items.length)break;}return {items};}});
  const [source,setSource]=useState("");const [targets,setTargets]=useState<number[]>([]);const [busy,setBusy]=useState(false);const [result,setResult]=useState("");
  const rows:any[]=q.data?.items||[];
  const copy=async()=>{
    if(busy||source==="")return;setBusy(true);setResult("");
    const plan=planCopy(rows,Number(source),targets);let made=0;const failed:string[]=[];
    for(const body of plan.creates){try{await api.createSchedule(body as any);made++;}catch(e){failed.push(`${DAYS[body.dayOfWeek as number]} ${body.startTime}: ${e instanceof Error?e.message:"failed"}`);}}
    const day=(x:string)=>DAYS[Number(x.split(":")[0])]+" "+x.slice(x.indexOf(":")+1);
    setResult(`Created ${made}. Already identical: ${plan.skipped.length}.${plan.conflicts.length?` Not copied (existing different session overlaps): ${plan.conflicts.map(day).join("; ")}.`:""}${failed.length?` Failed: ${failed.join("; ")}.`:""}`);
    setBusy(false);setTargets([]);client.invalidateQueries();
  };
  if(q.isLoading)return <div className="skeleton" role="status">Loading weekly overview…</div>;
  if(q.error)return <div className="error-box" role="alert">Weekly overview unavailable. <button onClick={()=>q.refetch()}>Retry</button></div>;
  return <section className="panel padded" data-testid="panel-weekly-overview">
    <div className="weekly-overview">{DAYS.map((d,i)=>{const day=rows.filter(r=>r.dayOfWeek===i).sort((a,b)=>a.startTime.localeCompare(b.startTime));return <div className="day" key={d}><strong>{d}</strong>{day.length?day.map(r=><button type="button" className="slot" key={r.id} onClick={()=>onEdit(r)} data-testid={`button-slot-${r.id}`}>{r.startTime}–{r.endTime}{r.isOpen?"":" (closed)"} · {r.maxTokens}</button>):<span className="muted">No sessions</span>}</div>;})}</div>
    <div className="weekly-copy"><label>Copy sessions from<select value={source} onChange={e=>setSource(e.target.value)} data-testid="select-copy-source"><option value="">Choose day</option>{DAYS.map((d,i)=>rows.some(r=>r.dayOfWeek===i)&&<option key={d} value={i}>{d}</option>)}</select></label>
      {DAYS.map((d,i)=>String(i)!==source&&<label key={d}><input type="checkbox" checked={targets.includes(i)} onChange={e=>setTargets(t=>e.target.checked?[...t,i]:t.filter(x=>x!==i))}/>{d}</label>)}
      <button disabled={busy||source===""||!targets.length} onClick={copy} data-testid="button-copy-days">{busy?"Copying…":"Copy to selected days"}</button></div>
    <small className="muted">Identical sessions are skipped; overlapping sessions with different hours or capacity are reported, never overwritten. Use the list below for detailed editing.</small>
    {result&&<p className="notice" role="status">{result}</p>}
  </section>;
}
