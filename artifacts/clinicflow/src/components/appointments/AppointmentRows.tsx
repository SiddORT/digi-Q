import { FormActions } from "../FormActions";
import { createPortal } from "react-dom";
import { Fragment, useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { ErrorNotice, title } from "../../resources";
import { RescheduleAppointment } from "./RescheduleAppointment";
import { BulkAppointments } from "./BulkAppointments";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import "../queue/queue-workspace.css";
import "./visit-range.css";
import { ArrowDown, ArrowUp, ArrowUpDown, LogIn, LogOut, PanelRightOpen } from "lucide-react";
import { HelpTip } from "../HelpTip";
import { AppointmentDetails } from "./AppointmentDetails";
import { formatDate, formatTime, formatConfiguredTimestamp } from "../../lib/date-time";
import { RowMenu } from "../RowMenu";
import { IconAction } from "../IconAction";
import { useTableColumns } from "../TableColumns";
import { OverflowText } from "../OverflowText";
import { downloadPdf, freshTicketHtml } from "./ticket-export";
import { canShowAppointmentTicket } from "./presentation";
import { TicketEmailDialog } from "./TicketEmailDialog";
const statusLabel=(s:string)=>s==="called"?"Called Next":title(s);
/** Coloured, shape-coded status symbol: explanation on hover, focus or tap; accessible name always present. */
function StatusDot({a}:{a:api.Appointment}){const [show,setShow]=useState(false);return <button type="button" className={`appt-status-dot ${a.status}`} aria-label={`Status: ${statusLabel(a.status)}`} onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)} onFocus={()=>setShow(true)} onBlur={()=>setShow(false)} onClick={()=>setShow(v=>!v)} data-testid={`status-dot-${a.id}`}>{show&&<span className="appt-status-tip" role="tooltip">{statusLabel(a.status)}</span>}</button>;}
const visitSession=(a:api.Appointment)=>`${a.startTime?formatTime(a.startTime,a):"—"}–${a.endTime?formatTime(a.endTime,a):"—"}`;

const PRIMARY:api.AppointmentActionType[]=["checkIn","start","complete","call"];
const actionLabel=(n:api.AppointmentActionType)=>n==="start"||n==="checkIn"?"Check In":n==="complete"?"Check Out":n==="noShow"?"Skip Absent":n==="requeue"?"Return / Re-Enter":title(n);
export type AppointmentDateSort="date"|"-date"|"-createdAt"|"createdAt";
export function nextAppointmentDateSort(current:AppointmentDateSort):AppointmentDateSort { return current==="date"?"-date":"date"; }
export function AppointmentRows({appointments,columnsTarget,selectionKey="",disabled=false,selectable=false,sessionScoped=false,sort,onSortChange,serialOffset=0}:{serialOffset?:number;appointments:api.Appointment[];columnsTarget?:HTMLElement|null;selectionKey?:string;disabled?:boolean;selectable?:boolean;sessionScoped?:boolean;sort?:AppointmentDateSort;onSortChange?:(sort:AppointmentDateSort)=>void}){
  const [selected,setSelected]=useState<string[]>([]);
  const {online}=useFreshWorkspace(Date.now());
  const blocked=disabled||!online;
  useEffect(()=>setSelected([]),[selectionKey]);
 const client=useQueryClient();
 const me=api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),staleTime:60000}});
 // Approved default order: serial, visit date/session, patient + ID, waiting number, clinic/location, doctor, booked at, status, actions.
  // Keys are stable so saved views keep working; new keys are visible unless a saved view explicitly hides them.
  const cols=useTableColumns(sessionScoped?"appointments-session":"appointments",me.data?.user?.id,me.data?.user?.role,[{key:"serial",label:"#"},...(sessionScoped?[]:[{key:"date",label:"Visit Date & Session"}]),{key:"patient",label:"Patient"},{key:"token",label:"Waiting No."},...(sessionScoped?[]:[{key:"location",label:"Clinic / Location"},{key:"doctor",label:"Doctor"}]),{key:"createdAt",label:"Booked At"},{key:"status",label:"Status"},{key:"reference",label:"Booking Reference"}],{defaultHidden:["reference","status"],reorderable:!sessionScoped,pinnable:!sessionScoped});
  const shownCols=cols.visible,hiddenCols=cols.hidden;
 const action=api.useTransitionAppointment({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
 const [reschedule,setReschedule]=useState<api.Appointment|null>(null);
 const [emailFor,setEmailFor]=useState<api.Appointment|null>(null);
 const [pdf,setPdf]=useState<{id:string;error?:string}|null>(null);const pdfLock=useRef(false);
 async function rowPdf(a:api.Appointment){
  if(pdfLock.current||blocked)return;pdfLock.current=true;setPdf({id:a.id});
  try{const {html,appointment}=await freshTicketHtml(a.id);await downloadPdf(html,`DigiQ-ticket-${appointment.reference}.pdf`);setPdf(null);}
  catch(e){setPdf({id:a.id,error:`${a.reference}: ${e instanceof Error?e.message:"PDF could not be prepared."}`});}finally{pdfLock.current=false;}
 }
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
  const cell=(k:string,a:api.Appointment,i=0)=>k==="serial"?<span className="appt-serial mono">{serialOffset+i+1}</span>:k==="patient"?<span className="appt-patient"><OverflowText as="strong" value={a.patientName} testId={`text-patient-${a.id}`}/>{a.patientCode&&<small className="mono"><OverflowText value={a.patientCode}/></small>}</span>:k==="token"?<span className="appt-token-wrap">{!shownCols.includes("status")&&<StatusDot a={a}/>}<strong className="appt-token" data-testid={`text-token-${a.id}`}>{a.token}</strong></span>:k==="location"?<span className="appt-stack"><OverflowText value={a.clinicName}/><small><OverflowText value={a.branchName}/></small></span>:k==="doctor"?<OverflowText value={a.doctorName}/>:k==="date"?<span className="appt-stack appointment-visit-date"><span>{formatDate(a.date,a)} <HelpTip text={`${a.clinicName} · ${a.branchName}. Session ${visitSession(a)}. Token and booking reference are available in Details and Ticket.`}/></span><small>{visitSession(a)}</small></span>:k==="createdAt"?<span className="appt-booked" title="When the booking was created, not the visit time">{formatConfiguredTimestamp(a.createdAt,a.timezone||undefined,{},a)}</span>:k==="status"?<span className={`badge ${a.status}`}>{a.status==="called"?"Called Next":title(a.status)}</span>:k==="reference"?<OverflowText className="mono" value={a.reference}/>:null;
  return <>{selectable&&<BulkAppointments labels={Object.fromEntries(appointments.map(a=>[a.id,`${a.patientName} · ${a.reference}`]))} ids={selected} disabled={blocked} onClear={()=>setSelected([])} onRetain={setSelected}/>}<ErrorNotice error={action.error}/>{pdf?.error&&<p role="alert" className="notice" data-testid="status-row-pdf-error">{pdf.error} <button type="button" onClick={()=>setPdf(null)}>Dismiss</button></p>}{action.isSuccess&&<p className="notice" role="status">Appointment updated. Check-out calls the next eligible patient; check-in starts their consultation.</p>}
  {columnsTarget?createPortal(cols.settings,columnsTarget):<div className="table-tools">{cols.settings}</div>}<div className="table-scroll appt-table"><table><thead><tr>{selectable&&<th className="col-select"><input type="checkbox" aria-label="Select all appointments on this page" checked={appointments.length>0&&appointments.every(a=>selected.includes(a.id))} onChange={e=>setSelected(e.target.checked?appointments.map(a=>a.id):[])}/></th>}{shownCols.map(k=>k==="date"?<th key={k} className={cols.cls(k)} aria-sort={!sessionScoped&&onSortChange?(sort==="date"?"ascending":sort==="-date"?"descending":"none"):undefined}>{!sessionScoped&&onSortChange?<button className="table-sort" type="button" aria-label={`Sort by visit date, ${sort==="date"?"latest first":"earliest first"}`} onClick={()=>onSortChange(nextAppointmentDateSort(sort||"-createdAt"))}>Visit Date {sort==="date"?<ArrowUp aria-hidden size={15}/>:sort==="-date"?<ArrowDown aria-hidden size={15}/>:<ArrowUpDown aria-hidden size={15}/>}</button>:"Visit Date"}</th>:<th key={k} className={cols.cls(k,k==="status"?"col-status":undefined)}>{cols.label(k)}</th>)}<th className="col-actions sticky">Actions <HelpTip text="Check in starts consultation. Check out completes it and calls the next eligible patient. A called patient still needs explicit check-in."/></th></tr></thead><tbody>
  {appointments.map((a,i)=><Fragment key={a.id}><tr data-testid={`appointment-${a.id}`}>{selectable&&<td className="col-select" data-label="Select"><input type="checkbox" aria-label={`Select ${a.patientName}, ${formatDate(a.date,a)}`} checked={selected.includes(a.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,a.id]:ids.filter(id=>id!==a.id))}/></td>}{shownCols.map((k,ci)=><td key={k} data-label={cols.label(k)} className={cols.cls(k,k==="patient"?"admin-record":undefined)}>{ci===0&&hiddenCols.length>0?<span className="row-lead">{cols.toggle(a.id,a.patientName)}{cell(k,a,i)}</span>:cell(k,a,i)}</td>)}<td className="col-actions sticky" data-label="Actions"><div className="row-actions">
  {(()=>{const primary=PRIMARY.find(n=>a.allowedActions.includes(n));const rest=a.allowedActions.filter(n=>n!==primary&&n!=="enqueue"&&!(primary==="checkIn"&&n==="start"));const label=actionLabel;const open=(n:api.AppointmentActionType)=>{if(blocked)return;action.reset();setReason("");setPosition(1);setPending({appointment:a,next:n});};const canReschedule=["booked","waiting","called"].includes(a.status)&&!a.checkedInAt&&a.allowedActions.includes("cancel");return <>
  {primary&&<button className="row-primary" title={primary==="complete"?"Finish consultation and call the next eligible patient":"Check in only when the patient enters consultation"} disabled={blocked||action.isPending} data-testid={`action-${primary}-${a.id}`} onClick={()=>open(primary)}>{primary==="complete"?<LogOut size={14}/>:<LogIn size={14}/>} {label(primary)}</button>}
  <IconAction className="row-details" label={`Details for ${a.patientName}`} hint="Details, ticket and QR" icon={<PanelRightOpen size={16} aria-hidden/>} testId={`details-${a.id}`} onClick={()=>setDetailId(a.id)}/>
  {!canReschedule&&["called","inConsultation"].includes(a.status)&&<HelpTip text="Rescheduling is unavailable for this visit in its current state. Called visits must still meet the existing unchecked-in and cancellation-permission requirements; a visit already in consultation cannot be rescheduled."/>}
 <RowMenu label={`More actions for ${a.patientName}`} testId={`menu-${a.id}`} items={[...(canShowAppointmentTicket(a)?[{key:"pdf",label:pdf?.id===a.id&&!pdf.error?"Preparing PDF…":"Download Ticket PDF",disabled:blocked||!!(pdf&&!pdf.error),testId:`action-pdf-${a.id}`,onSelect:()=>void rowPdf(a)},{key:"email",label:"Email Ticket…",disabled:blocked,testId:`action-email-${a.id}`,onSelect:()=>setEmailFor(a)}]:[]),...(canReschedule?[{key:"reschedule",label:"Reschedule",disabled:blocked||action.isPending,onSelect:()=>setReschedule(a)}]:[]),...rest.map(next=>({key:next,label:label(next),danger:["cancel","noShow"].includes(next),disabled:blocked||action.isPending,testId:`action-${next}-${a.id}`,onSelect:()=>open(next)}))]}/></>;})()}
</div></td></tr>{cols.expansion(a.id,shownCols.length+1+(selectable?1:0),k=>cell(k,a,i))}</Fragment>)}</tbody></table></div>
  <AppDialog open={!!detailId} variant="drawer" onClose={()=>setDetailId("")} title="Appointment Details"><ErrorNotice error={detail.error}/>{detail.error?<button onClick={()=>detail.refetch()}>Retry Details</button>:detail.isLoading?<div className="appt-detail-skeleton" role="status" aria-label="Loading details"><span/><span/><span/></div>:detail.data&&<AppointmentDetails appointment={detail.data}/>}</AppDialog>
 <AppDialog open={!!reschedule} size="wide" onClose={()=>setReschedule(null)} title="Reschedule Appointment" dirty>{reschedule&&<RescheduleAppointment key={reschedule.id} appointment={reschedule} onDone={()=>{setReschedule(null);setDetailId(reschedule.id);}}/>}</AppDialog>
  <AppDialog open={!!pending} onClose={()=>setPending(null)} title={pending?actionLabel(pending.next):"Update appointment"} busy={action.isPending} dirty={!!reason}><form onSubmit={e=>{e.preventDefault();if(pending)void transition(pending.appointment,pending.next);}}>
  {blocked&&<p role="alert">Updates are disabled while offline or stale. Refresh before continuing.</p>}
  {pending&&["checkIn","start"].includes(pending.next)&&<p className="notice">Confirm the patient is entering consultation now. Scanning a QR alone does not start consultation.</p>}
  {pending?.next==="complete"&&<p className="notice">Finish this consultation. The next eligible waiting patient will be called, not checked in automatically.</p>}
 <p>{pending?.appointment.patientName} · {pending?.appointment.reference} · Token {pending?.appointment.token}</p>
 {pending?.next==="cancel"&&<p className="notice">Cancel this reservation? It will release its place. This cannot be undone; the clinic cutoff is checked again when you confirm.</p>}
 {pending?.next==="noShow"&&<p className="notice">Explicitly skip this absent patient without cancelling their booking or token. Reception can record a return position later.</p>}
 {pending?.next==="requeue"&&<><ErrorNotice error={queue.error}/><p>Keep the same booking and token. Choose a one-based position among pending reservations. An already called patient or consultation cannot be displaced.</p><label>Return position<input type="number" required min={1} max={(queue.data?.reserved??0)+1} value={position} onChange={e=>setPosition(Number(e.target.value))}/></label><p>{queue.data?.reserved??"…"} pending reservations</p>{queue.error&&<button type="button" onClick={()=>queue.refetch()}>Refresh Queue</button>}</>}
 <ErrorNotice error={action.error}/>
 {pending&&["cancel","noShow","requeue"].includes(pending.next)&&<label>Required reason<textarea required value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>}
 {pending&&!pending.appointment.allowedActions.includes(pending.next)&&<p role="alert">This appointment changed. Close this dialog and review its current status.</p>}
  <FormActions wide={false} onCancel={()=>setPending(null)} cancelLabel="Back" busy={action.isPending} busyLabel="Updating…" submitLabel="Confirm" disabled={blocked||!!(pending&&!pending.appointment.allowedActions.includes(pending.next))||!!(pending&&["cancel","noShow","requeue"].includes(pending.next)&&!reason.trim())||(pending?.next==="requeue"&&(!queue.data?.queueVersion||queue.isFetching||!!queue.error||!Number.isInteger(position)||position<1))}/>
 </form></AppDialog></>;
}