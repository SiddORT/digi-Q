import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { ErrorNotice, title } from "../../resources";
import { AppointmentTicket } from "./AppointmentTicket";
import { RescheduleAppointment } from "./RescheduleAppointment";

export function AppointmentRows({appointments}:{appointments:api.Appointment[]}){
 const client=useQueryClient();
 const action=api.useTransitionAppointment({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
 const [ticket,setTicket]=useState("");const [reschedule,setReschedule]=useState<api.Appointment|null>(null);
 const [pending,setPending]=useState<{appointment:api.Appointment;next:api.AppointmentActionType}|null>(null);
 const [reason,setReason]=useState("");const [position,setPosition]=useState(1);const lock=useRef(false);
 useEffect(()=>{if(!pending)return;const fresh=appointments.find(a=>a.id===pending.appointment.id);if(fresh&&fresh.revision!==pending.appointment.revision)setPending({...pending,appointment:fresh});},[appointments,pending]);
 const selection={doctorId:pending?.appointment.doctorId||"",branchId:pending?.appointment.branchId||"",date:pending?.appointment.date||""};
 const queue=api.useGetQueue(selection,{query:{queryKey:api.getGetQueueQueryKey(selection),enabled:pending?.next==="requeue",refetchInterval:30000}});
 async function transition(a:api.Appointment,next:api.AppointmentActionType){
  if(lock.current)return;lock.current=true;
  try{await action.mutateAsync({id:a.id,data:{action:next,expectedStatus:a.status,expectedRevision:a.revision??0,reason:reason.trim()||undefined,...(next==="requeue"?{position,expectedQueueVersion:queue.data?.queueVersion}:{})}});setPending(null);setReason("");}
  catch{/* Keep the form and refresh conflicting server state. */}finally{lock.current=false;}
 }
 return <><ErrorNotice error={action.error}/>{action.isSuccess&&<p className="notice" role="status">Appointment updated.</p>}
 <div className="table-scroll"><table><thead><tr><th>Patient / reference</th><th>Doctor & location</th><th>Date / token</th><th className="col-status">Status</th><th className="col-actions">Actions</th></tr></thead><tbody>
 {appointments.map(a=><tr key={a.id} data-testid={`appointment-${a.id}`}><td data-label="Patient / reference"><strong>{a.patientName}</strong><small>{a.reference}</small></td><td data-label="Doctor & location">{a.doctorName}<small>{a.clinicName} · {a.branchName}</small></td><td data-label="Date / token">{a.date}<small>Token {a.token}</small></td><td data-label="Status"><span className={`badge ${a.status}`}>{title(a.status)}</span>{a.status==="booked"&&<small>Reserved · not arrived</small>}{["checkedIn","waiting"].includes(a.status)&&<small>Arrived</small>}</td><td className="col-actions" data-label="Actions"><div className="row-actions">
 <button data-testid={`ticket-${a.id}`} onClick={()=>setTicket(a.id)}>Ticket / details</button>
 {a.status==="booked"&&!a.checkedInAt&&a.allowedActions.includes("cancel")&&<button onClick={()=>setReschedule(a)}>Reschedule</button>}
 {a.allowedActions.map(next=><button key={next} disabled={action.isPending} data-testid={`action-${next}-${a.id}`} onClick={()=>{action.reset();setReason("");setPosition(1);setPending({appointment:a,next});}}>{next==="noShow"?"Skip absent":next==="requeue"?"Return / re-enter":title(next)}</button>)}
 </div></td></tr>)}</tbody></table></div>
 <AppDialog open={!!ticket} onClose={()=>setTicket("")} title="Appointment ticket">{ticket&&<AppointmentTicket id={ticket}/>}</AppDialog>
 <AppDialog open={!!reschedule} onClose={()=>setReschedule(null)} title="Reschedule appointment" dirty>{reschedule&&<RescheduleAppointment key={reschedule.id} appointment={reschedule} onDone={()=>{setReschedule(null);setTicket(reschedule.id);}}/>}</AppDialog>
 <AppDialog open={!!pending} onClose={()=>setPending(null)} title={pending?title(pending.next):"Update appointment"} busy={action.isPending} dirty={!!reason}><form onSubmit={e=>{e.preventDefault();if(pending)void transition(pending.appointment,pending.next);}}>
 <p>{pending?.appointment.patientName} · {pending?.appointment.reference} · Token {pending?.appointment.token}</p>
 {pending?.next==="cancel"&&<p className="notice">Cancel this reservation? It will release its place. This cannot be undone; the clinic cutoff is checked again when you confirm.</p>}
 {pending?.next==="noShow"&&<p className="notice">Explicitly skip this absent patient without cancelling their booking or token. Reception can record a return position later.</p>}
 {pending?.next==="requeue"&&<><ErrorNotice error={queue.error}/><p>Keep the same booking and token. Choose a one-based position among pending reservations. An already called patient or consultation cannot be displaced.</p><label>Return position<input type="number" required min={1} max={(queue.data?.reserved??0)+1} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label><p>{queue.data?.reserved??"…"} pending reservations</p>{queue.error&&<button type="button" onClick={()=>queue.refetch()}>Refresh queue</button>}</>}
 <ErrorNotice error={action.error}/>
 {pending&&["cancel","noShow","requeue"].includes(pending.next)&&<label>Required reason<textarea required value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>}
 {pending&&!pending.appointment.allowedActions.includes(pending.next)&&<p role="alert">This appointment changed. Close this dialog and review its current status.</p>}
 <div className="form-footer"><button type="button" disabled={action.isPending} onClick={()=>setPending(null)}>Back</button><button className="button" disabled={action.isPending||!!(pending&&!pending.appointment.allowedActions.includes(pending.next))||!!(pending&&["cancel","noShow","requeue"].includes(pending.next)&&!reason.trim())||(pending?.next==="requeue"&&(!queue.data?.queueVersion||queue.isFetching||!!queue.error||!Number.isInteger(position)||position<1))}>{action.isPending?"Updating…":"Confirm"}</button></div>
 </form></AppDialog></>;
}