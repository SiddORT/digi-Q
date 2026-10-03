import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { ErrorNotice, title } from "../../resources";
import { AppointmentTicket } from "./AppointmentTicket";
import { RescheduleAppointment } from "./RescheduleAppointment";
import { BulkAppointments } from "./BulkAppointments";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import "../queue/queue-workspace.css";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, QrCode, LogIn, LogOut } from "lucide-react";
import { HelpTip } from "../HelpTip";
import { AppointmentDetails } from "./AppointmentDetails";
import { canShowAppointmentTicket } from "./presentation";
import { formatDate, formatTime } from "../../lib/date-time";
const visitSession=(a:api.Appointment)=>`${a.startTime?formatTime(a.startTime,a):"—"}–${a.endTime?formatTime(a.endTime,a):"—"}`;

const PRIMARY:api.AppointmentActionType[]=["checkIn","start","complete","call"];
const actionLabel=(n:api.AppointmentActionType)=>n==="start"||n==="checkIn"?"Check in":n==="complete"?"Check out":n==="noShow"?"Skip absent":n==="requeue"?"Return / re-enter":title(n);
export type AppointmentDateSort="date"|"-date"|"-createdAt"|"createdAt";
export function nextAppointmentDateSort(current:AppointmentDateSort):AppointmentDateSort { return current==="date"?"-date":"date"; }
export function AppointmentRows({appointments,selectionKey="",disabled=false,selectable=false,sessionScoped=false,sort,onSortChange}:{appointments:api.Appointment[];selectionKey?:string;disabled?:boolean;selectable?:boolean;sessionScoped?:boolean;sort?:AppointmentDateSort;onSortChange?:(sort:AppointmentDateSort)=>void}){
  const [selected,setSelected]=useState<string[]>([]);
  const {online}=useFreshWorkspace(Date.now());
  const blocked=disabled||!online;
  useEffect(()=>setSelected([]),[selectionKey]);
 const client=useQueryClient();
 const action=api.useTransitionAppointment({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
 const [ticket,setTicket]=useState("");const [reschedule,setReschedule]=useState<api.Appointment|null>(null);
 const [detailId,setDetailId]=useState("");
 const detailParams={queryKey:api.getGetAppointmentQueryKey(detailId),enabled:!!detailId,refetchInterval:30000};
 const detail=api.useGetAppointment(detailId,{query:detailParams});
 const [pending,setPending]=useState<{appointment:api.Appointment;next:api.AppointmentActionType}|null>(null);
 const [reason,setReason]=useState("");const [position,setPosition]=useState(1);const lock=useRef(false);
 useEffect(()=>{if(!pending)return;const fresh=appointments.find(a=>a.id===pending.appointment.id);if(fresh&&fresh.revision!==pending.appointment.revision)setPending({...pending,appointment:fresh});},[appointments,pending]);
 const selection={doctorId:pending?.appointment.doctorId||"",branchId:pending?.appointment.branchId||"",date:pending?.appointment.date||"",sessionId:pending?.appointment.sessionId||undefined,startTime:pending?.appointment.startTime};
 const queue=api.useGetQueue(selection,{query:{queryKey:api.getGetQueueQueryKey(selection),enabled:pending?.next==="requeue",refetchInterval:30000}});
 async function transition(a:api.Appointment,next:api.AppointmentActionType){
  if(lock.current||blocked)return;lock.current=true;
  try{await action.mutateAsync({id:a.id,data:{action:next,expectedStatus:a.status,expectedRevision:a.revision??0,reason:reason.trim()||undefined,...(next==="requeue"?{position,expectedQueueVersion:queue.data?.queueVersion}:{})}});setPending(null);setReason("");}
  catch{/* Keep the form and refresh conflicting server state. */}finally{lock.current=false;}
 }
  return <>{selectable&&<BulkAppointments ids={selected} disabled={blocked} onClear={()=>setSelected([])}/>}<ErrorNotice error={action.error}/>{action.isSuccess&&<p className="notice" role="status">Appointment updated. Check-out calls the next eligible patient; check-in starts their consultation.</p>}
  <div className="table-scroll appt-table"><table><thead><tr>{selectable&&<th className="col-select"><input type="checkbox" aria-label="Select all appointments on this page" checked={appointments.length>0&&appointments.every(a=>selected.includes(a.id))} onChange={e=>setSelected(e.target.checked?appointments.map(a=>a.id):[])}/></th>}<th>Patient</th>{!sessionScoped&&<th>Doctor & location</th>}<th aria-sort={!sessionScoped&&onSortChange?(sort==="date"?"ascending":sort==="-date"?"descending":"none"):undefined}>{!sessionScoped&&onSortChange?<button className="table-sort" type="button" aria-label={`Sort by visit date, ${sort==="date"?"latest first":"earliest first"}`} onClick={()=>onSortChange(nextAppointmentDateSort(sort||"-createdAt"))}>Visit date {sort==="date"?<ArrowUp aria-hidden size={15}/>:sort==="-date"?<ArrowDown aria-hidden size={15}/>:<ArrowUpDown aria-hidden size={15}/>}</button>:sessionScoped?"Token":"Visit date"}</th><th className="col-status">Status</th><th className="col-actions">Actions <HelpTip text="Check in starts consultation. Check out completes it and calls the next eligible patient. A called patient still needs explicit check-in."/></th></tr></thead><tbody>
  {appointments.map(a=><tr key={a.id} data-testid={`appointment-${a.id}`}>{selectable&&<td className="col-select" data-label="Select"><input type="checkbox" aria-label={`Select ${a.patientName}, ${formatDate(a.date,a)}`} checked={selected.includes(a.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,a.id]:ids.filter(id=>id!==a.id))}/></td>}<td data-label="Patient" className="admin-record"><strong>{a.patientName}</strong></td>{!sessionScoped&&<td data-label="Doctor & location">{a.doctorName}<small>{a.branchName}</small></td>}<td data-label={sessionScoped?"Token":"Visit date"}>{sessionScoped?<strong>{a.token}</strong>:<span className="appointment-visit-date">{formatDate(a.date,a)} <HelpTip text={`${a.clinicName} · ${a.branchName}. Session ${visitSession(a)}. Token and booking reference are available in Details and Ticket.`}/></span>}</td><td data-label="Status"><span className={`badge ${a.status}`}>{a.status==="called"?"Called next":title(a.status)}</span></td><td className="col-actions" data-label="Actions"><div className="row-actions">
  {(()=>{const primary=PRIMARY.find(n=>a.allowedActions.includes(n));const rest=a.allowedActions.filter(n=>n!==primary&&n!=="enqueue"&&!(primary==="checkIn"&&n==="start"));const label=actionLabel;const open=(n:api.AppointmentActionType)=>{if(blocked)return;action.reset();setReason("");setPosition(1);setPending({appointment:a,next:n});};const canReschedule=["booked","waiting","called"].includes(a.status)&&!a.checkedInAt&&a.allowedActions.includes("cancel");return <>
  {primary&&<button className="row-primary" title={primary==="complete"?"Finish consultation and call the next eligible patient":"Check in only when the patient enters consultation"} disabled={blocked||action.isPending} data-testid={`action-${primary}-${a.id}`} onClick={()=>open(primary)}>{primary==="complete"?<LogOut size={14}/>:<LogIn size={14}/>} {label(primary)}</button>}
  <button type="button" data-testid={`details-${a.id}`} onClick={()=>setDetailId(a.id)}>Details</button>
  {!canReschedule&&["called","inConsultation"].includes(a.status)&&<HelpTip text="Rescheduling is unavailable for this visit in its current state. Called visits must still meet the existing unchecked-in and cancellation-permission requirements; a visit already in consultation cannot be rescheduled."/>}
  {canShowAppointmentTicket(a)&&<button className="row-ticket" aria-label="Ticket" title={`View ticket for ${a.patientName}`} data-testid={`ticket-${a.id}`} onClick={()=>setTicket(a.id)}><QrCode aria-hidden size={14}/></button>}
 {(rest.length>0||canReschedule)&&<details className="row-menu" onKeyDown={e=>{if(e.key==="Escape"){(e.currentTarget as HTMLDetailsElement).open=false;(e.currentTarget.querySelector("summary") as HTMLElement)?.focus();}}}><summary title={`More actions for ${a.patientName}`} aria-label={`More actions for ${a.patientName}`} data-testid={`menu-${a.id}`}><MoreHorizontal aria-hidden size={18}/></summary><div className="row-menu-list" role="group" aria-label="More actions">
  {canReschedule&&<button disabled={blocked||action.isPending} onClick={e=>{(e.currentTarget.closest("details") as HTMLDetailsElement).open=false;setReschedule(a);}}>Reschedule</button>}
  {rest.map(next=><button key={next} className={["cancel","noShow"].includes(next)?"danger":undefined} disabled={blocked||action.isPending} data-testid={`action-${next}-${a.id}`} onClick={e=>{(e.currentTarget.closest("details") as HTMLDetailsElement).open=false;open(next);}}>{label(next)}</button>)}
 </div></details>}</>;})()}
 </div></td></tr>)}</tbody></table></div>
 <AppDialog open={!!ticket} onClose={()=>setTicket("")} title="Appointment ticket">{ticket&&<AppointmentTicket id={ticket}/>}</AppDialog>
 <AppDialog open={!!detailId} onClose={()=>setDetailId("")} title="Appointment details"><ErrorNotice error={detail.error}/>{detail.error?<button onClick={()=>detail.refetch()}>Retry details</button>:detail.isLoading?<p role="status">Loading details…</p>:detail.data&&<AppointmentDetails appointment={detail.data}/>}</AppDialog>
 <AppDialog open={!!reschedule} size="wide" onClose={()=>setReschedule(null)} title="Reschedule appointment" dirty>{reschedule&&<RescheduleAppointment key={reschedule.id} appointment={reschedule} onDone={()=>{setReschedule(null);setTicket(reschedule.id);}}/>}</AppDialog>
  <AppDialog open={!!pending} onClose={()=>setPending(null)} title={pending?actionLabel(pending.next):"Update appointment"} busy={action.isPending} dirty={!!reason}><form onSubmit={e=>{e.preventDefault();if(pending)void transition(pending.appointment,pending.next);}}>
  {blocked&&<p role="alert">Updates are disabled while offline or stale. Refresh before continuing.</p>}
  {pending&&["checkIn","start"].includes(pending.next)&&<p className="notice">Confirm the patient is entering consultation now. Scanning a QR alone does not start consultation.</p>}
  {pending?.next==="complete"&&<p className="notice">Finish this consultation. The next eligible waiting patient will be called, not checked in automatically.</p>}
 <p>{pending?.appointment.patientName} · {pending?.appointment.reference} · Token {pending?.appointment.token}</p>
 {pending?.next==="cancel"&&<p className="notice">Cancel this reservation? It will release its place. This cannot be undone; the clinic cutoff is checked again when you confirm.</p>}
 {pending?.next==="noShow"&&<p className="notice">Explicitly skip this absent patient without cancelling their booking or token. Reception can record a return position later.</p>}
 {pending?.next==="requeue"&&<><ErrorNotice error={queue.error}/><p>Keep the same booking and token. Choose a one-based position among pending reservations. An already called patient or consultation cannot be displaced.</p><label>Return position<input type="number" required min={1} max={(queue.data?.reserved??0)+1} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label><p>{queue.data?.reserved??"…"} pending reservations</p>{queue.error&&<button type="button" onClick={()=>queue.refetch()}>Refresh queue</button>}</>}
 <ErrorNotice error={action.error}/>
 {pending&&["cancel","noShow","requeue"].includes(pending.next)&&<label>Required reason<textarea required value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>}
 {pending&&!pending.appointment.allowedActions.includes(pending.next)&&<p role="alert">This appointment changed. Close this dialog and review its current status.</p>}
  <div className="form-footer"><button type="button" disabled={action.isPending} onClick={()=>setPending(null)}>Back</button><button className="button" disabled={blocked||action.isPending||!!(pending&&!pending.appointment.allowedActions.includes(pending.next))||!!(pending&&["cancel","noShow","requeue"].includes(pending.next)&&!reason.trim())||(pending?.next==="requeue"&&(!queue.data?.queueVersion||queue.isFetching||!!queue.error||!Number.isInteger(position)||position<1))}>{action.isPending?"Updating…":"Confirm"}</button></div>
 </form></AppDialog></>;
}