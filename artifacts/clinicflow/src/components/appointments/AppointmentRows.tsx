import { FormActions } from "../FormActions";
import { createPortal } from "react-dom";
import { Fragment, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { ErrorNotice, title } from "../../resources";
import { RescheduleAppointment } from "./RescheduleAppointment";
import { BulkAppointments } from "./BulkAppointments";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import "../queue/queue-workspace.css";
import "./visit-range.css";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, LogIn, LogOut } from "lucide-react";
import { HelpTip } from "../HelpTip";
import { AppointmentDetails } from "./AppointmentDetails";
import { formatDate, formatTime, formatConfiguredTimestamp } from "../../lib/date-time";
import { RowMenu } from "../RowMenu";
import { IconAction } from "../IconAction";
import { useTableColumns } from "../TableColumns";
import { OverflowText } from "../OverflowText";
import { downloadPdf, freshTicketHtml } from "./ticket-export";
import { canShowAppointmentTicket, isPrivateAppointmentUnavailable } from "./presentation";
import { TicketEmailDialog } from "./TicketEmailDialog";
const statusLabel=(s:string)=>s==="called"?"Called Next":title(s);
/** Row clicks open the visit; clicks on controls inside the row keep their own behaviour. */
export const isInteractiveTarget=(target:EventTarget|null)=>target instanceof Element&&!!target.closest("button,a,input,select,textarea,label,summary,[role=menu],[role=menuitem],[role=dialog],[data-row-ignore]");
const visitSession=(a:api.Appointment)=>`${a.startTime?formatTime(a.startTime,a):"—"}–${a.endTime?formatTime(a.endTime,a):"—"}`;

const PRIMARY:api.AppointmentActionType[]=["checkIn","start","complete","call"];
const actionLabel=(n:api.AppointmentActionType)=>n==="start"||n==="checkIn"?"Check In":n==="complete"?"Check Out":n==="noShow"?"Skip Absent":n==="requeue"?"Return / Re-Enter":title(n);
export type AppointmentDateSort="date"|"-date"|"-createdAt"|"createdAt";
export function nextAppointmentDateSort(current:AppointmentDateSort):AppointmentDateSort { return current==="date"?"-date":"date"; }
export const appointmentColumns = (sessionScoped = false) => [{key:"serial",label:"#"},...(sessionScoped?[]:[{key:"date",label:"Visit Date & Session"}]),{key:"patient",label:"Patient"},{key:"token",label:"Token / Queue No."},...(sessionScoped?[]:[{key:"location",label:"Clinic / Location"},{key:"doctor",label:"Doctor"}]),{key:"createdAt",label:"Booked At"},{key:"reference",label:"Booking Reference"}];
export function AppointmentRows({appointments,columnsTarget,compactColumns=false,selectionKey="",disabled=false,selectable=false,sessionScoped=false,sort,onSortChange,serialOffset=0}:{serialOffset?:number;appointments:api.Appointment[];columnsTarget?:HTMLElement|null;compactColumns?:boolean;selectionKey?:string;disabled?:boolean;selectable?:boolean;sessionScoped?:boolean;sort?:AppointmentDateSort;onSortChange?:(sort:AppointmentDateSort)=>void}){
  const [selected,setSelected]=useState<string[]>([]);
  const {online}=useFreshWorkspace(Date.now());
  const blocked=disabled||!online;
  useEffect(()=>setSelected([]),[selectionKey]);
 const client=useQueryClient();
 const me=api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),staleTime:60000}});
 // Approved default order: serial, visit date/session, patient + ID, waiting number, clinic/location, doctor, booked at, status, actions.
  // Keys are stable so saved views keep working; new keys are visible unless a saved view explicitly hides them.
  const cols=useTableColumns(sessionScoped?"appointments-session":"appointments",me.data?.user?.id,me.data?.user?.role,appointmentColumns(sessionScoped),{defaultHidden:["reference","createdAt"],reorderable:!sessionScoped,pinnable:!sessionScoped,iconOnly:compactColumns});
  const shownCols=cols.visible,hiddenCols=cols.hidden;
  // Status always renders immediately after Patient / Token (or the last core column), so it never drifts off-screen.
  const statusAfter=["token","patient"].find(k=>shownCols.includes(k))||shownCols[shownCols.length-1];
 const action=api.useTransitionAppointment({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
 const [reschedule,setReschedule]=useState<api.Appointment|null>(null);const [rescheduleDirty,setRescheduleDirty]=useState(false);
 const [emailFor,setEmailFor]=useState<api.Appointment|null>(null);
 const [pdf,setPdf]=useState<{id:string;error?:string}|null>(null);const pdfLock=useRef(false);
 async function rowPdf(a:api.Appointment,format:"ticket"|"a4"="ticket"){
  if(pdfLock.current||blocked)return;pdfLock.current=true;setPdf({id:a.id});
  try{const {html,appointment}=await freshTicketHtml(a.id);await downloadPdf(html,`DigiQ-ticket-${appointment.reference}.pdf`,format);setPdf(null);}
  catch(e){setPdf({id:a.id,error:`${a.reference}: ${e instanceof Error?e.message:"PDF could not be prepared."}`});}finally{pdfLock.current=false;}
 }
 // One expanded visit at a time: it renders the ticket and the full appointment record inline.
 const [expandedId,setExpandedId]=useState("");
 const toggleRow=(id:string)=>setExpandedId(current=>current===id?"":id);
 // Deep links (?appointment=<id>) from workspace search open that exact visit once it is on this page.
 const linkedId=new URLSearchParams(useSearch()).get("appointment")||"";
 const linkedDone=useRef("");
 const listedLinked=!!linkedId&&appointments.some(a=>a.id===linkedId);
 useEffect(()=>{if(!listedLinked||linkedDone.current===linkedId)return;linkedDone.current=linkedId;setExpandedId(linkedId);requestAnimationFrame(()=>document.querySelector(`[data-testid="appointment-${linkedId}"]`)?.scrollIntoView({block:"center"}));},[listedLinked,linkedId]);
 // Exact visit links resolve by id through the permission-checked endpoint even when the visit is outside the
 // current page or filters; the visit then renders inline above the table (same tabbed details, no drawer).
 const offPageLinked=!!linkedId&&!listedLinked;
  const linkedVisit=api.useGetAppointment(linkedId,{query:{queryKey:api.getGetAppointmentQueryKey(linkedId),enabled:offPageLinked,retry:false,refetchInterval:30000}});
 const [,navigateTo]=useLocation();
 const dismissLinked=()=>{const q=new URLSearchParams(window.location.search);q.delete("appointment");navigateTo(`${window.location.pathname}${q.size?`?${q}`:""}`,{replace:true});};
 const detailParams={queryKey:api.getGetAppointmentQueryKey(expandedId),enabled:!!expandedId,refetchInterval:30000,retry:false};
 const detail=api.useGetAppointment(expandedId,{query:detailParams});
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
  const cell=(k:string,a:api.Appointment,i=0)=>k==="serial"?<span className="appt-serial mono">{serialOffset+i+1}</span>:k==="patient"?<span className="appt-patient"><OverflowText as="strong" value={a.patientName} testId={`text-patient-${a.id}`}/>{a.patientCode&&<small className="mono"><OverflowText value={a.patientCode}/></small>}</span>:k==="token"?<span className="appt-token-wrap"><HelpTip text={`Booking reference ${a.reference}. Copy it from the expanded visit.`}><strong className="appt-token" tabIndex={0} aria-label={`Token ${a.token}, booking reference ${a.reference}`} data-testid={`text-token-${a.id}`}>{a.token}</strong></HelpTip></span>:k==="location"?<span className="appt-stack"><OverflowText value={a.clinicName}/><small><OverflowText value={a.branchName}/></small></span>:k==="doctor"?<OverflowText value={a.doctorName}/>:k==="date"?<span className="appt-stack appointment-visit-date"><span>{formatDate(a.date,a)} <HelpTip text={`${a.clinicName} · ${a.branchName}. Session ${visitSession(a)}. Token and booking reference are available in Details and Ticket.`}/></span><small>{visitSession(a)}</small></span>:k==="createdAt"?<span className="appt-booked" title="When the booking was created, not the visit time">{formatConfiguredTimestamp(a.createdAt,a.timezone||undefined,{},a)}</span>:k==="reference"?<OverflowText className="mono" value={a.reference}/>:null;
  return <>{selectable&&<BulkAppointments labels={Object.fromEntries(appointments.map(a=>[a.id,`${a.patientName} · ${a.reference}`]))} ids={selected} disabled={blocked} onClear={()=>setSelected([])} onRetain={setSelected}/>}<ErrorNotice error={action.error}/>{pdf?.error&&<p role="alert" className="notice" data-testid="status-row-pdf-error">{pdf.error} <button type="button" onClick={()=>setPdf(null)}>Dismiss</button></p>}{action.isSuccess&&<p className="notice" role="status">Appointment updated. Check-out calls the next eligible patient; check-in starts their consultation.</p>}
   {offPageLinked&&<section className="panel linked-visit" aria-label="Linked visit" data-testid="linked-visit"><header className="linked-visit-head"><div><h3>Linked Visit</h3><p className="muted">This visit is outside the current page or filters.</p></div><button type="button" className="button secondary" onClick={dismissLinked} data-testid="button-dismiss-linked">Close</button></header>{linkedVisit.error&&<><ErrorNotice error={linkedVisit.error}/><button type="button" className="button secondary" onClick={()=>void linkedVisit.refetch()}>Retry</button></>}{linkedVisit.data&&!isPrivateAppointmentUnavailable(linkedVisit.error)?<AppointmentDetails key={linkedVisit.data.id} appointment={linkedVisit.data}/>:!linkedVisit.error&&<div className="appt-detail-skeleton" role="status" aria-label="Loading linked visit"><span/><span/><span/></div>}</section>}
  {columnsTarget?createPortal(cols.settings,columnsTarget):<div className="table-tools">{cols.settings}</div>}<div className="table-scroll appt-table"><table><thead><tr>{selectable&&<th className="col-select"><input type="checkbox" aria-label="Select all appointments on this page" checked={appointments.length>0&&appointments.every(a=>selected.includes(a.id))} onChange={e=>setSelected(e.target.checked?appointments.map(a=>a.id):[])}/></th>}{shownCols.map(k=>k==="date"?<th key={k} className={cols.cls(k)} aria-sort={!sessionScoped&&onSortChange?(sort==="date"?"ascending":sort==="-date"?"descending":"none"):undefined}>{!sessionScoped&&onSortChange?<button className="table-sort" type="button" aria-label={`Sort by visit date, ${sort==="date"?"latest first":"earliest first"}`} onClick={()=>onSortChange(nextAppointmentDateSort(sort||"-createdAt"))}>Visit Date {sort==="date"?<ArrowUp aria-hidden size={15}/>:sort==="-date"?<ArrowDown aria-hidden size={15}/>:<ArrowUpDown aria-hidden size={15}/>}</button>:"Visit Date"}</th>:<th key={k} className={cols.cls(k)}>{cols.label(k)}</th>).flatMap(cell=>cell.key===statusAfter?[cell,<th key="status" className="col-status" scope="col">Status</th>]:[cell])}<th className="col-actions sticky">Actions <HelpTip text="Check in starts consultation. Check out completes it and calls the next eligible patient. A called patient still needs explicit check-in."/></th></tr></thead><tbody>
  {appointments.map((a,i)=><Fragment key={a.id}><tr data-testid={`appointment-${a.id}`} className={`appt-row${expandedId===a.id?" is-expanded":""}${linkedId===a.id?" is-linked":""}`} onClick={event=>{if(!isInteractiveTarget(event.target))toggleRow(a.id);}}>{selectable&&<td className="col-select" data-label="Select"><input type="checkbox" aria-label={`Select ${a.patientName}, ${formatDate(a.date,a)}`} checked={selected.includes(a.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,a.id]:ids.filter(id=>id!==a.id))}/></td>}{shownCols.map((k,ci)=><td key={k} data-label={cols.label(k)} className={cols.cls(k,k==="patient"?"admin-record":undefined)}>{ci===0?<span className="row-lead"><button type="button" className="row-expand-toggle" aria-expanded={expandedId===a.id} aria-controls={`appt-expand-${a.id}`} aria-label={`${expandedId===a.id?"Hide":"Show"} visit details and ticket for ${a.patientName}`} onClick={()=>toggleRow(a.id)} data-testid={`button-expand-appointment-${a.id}`}><ChevronRight size={14} aria-hidden/></button>{cell(k,a,i)}</span>:cell(k,a,i)}</td>).flatMap(cell=>cell.key===statusAfter?[cell,<td key="status" className="col-status" data-label="Status"><span className={`badge ${a.status}`} data-testid={`text-status-${a.id}`}>{statusLabel(a.status)}</span></td>]:[cell])}<td className="col-actions sticky" data-label="Actions"><div className="row-actions">
  {(()=>{const primary=PRIMARY.find(n=>a.allowedActions.includes(n));const rest=a.allowedActions.filter(n=>n!==primary&&n!=="enqueue"&&!(primary==="checkIn"&&n==="start"));const label=actionLabel;const open=(n:api.AppointmentActionType)=>{if(blocked)return;action.reset();setReason("");setPosition(1);setPending({appointment:a,next:n});};const canReschedule=["booked","waiting","called"].includes(a.status)&&!a.checkedInAt&&a.allowedActions.includes("cancel");return <>
  {primary&&<IconAction className={`row-primary row-primary-${primary==="complete"?"out":"in"}`} label={`${label(primary)}: ${a.patientName}`} hint={primary==="complete"?"Check Out — finish consultation and call the next eligible patient":"Check In — patient enters consultation"} icon={primary==="complete"?<LogOut size={16} aria-hidden/>:<LogIn size={16} aria-hidden/>} disabled={blocked||action.isPending} disabledReason={blocked?"Unavailable while another action is in progress":undefined} testId={`action-${primary}-${a.id}`} onClick={()=>open(primary)}/>}
  {!canReschedule&&["called","inConsultation"].includes(a.status)&&<HelpTip text="Rescheduling is unavailable for this visit in its current state. Called visits must still meet the existing unchecked-in and cancellation-permission requirements; a visit already in consultation cannot be rescheduled."/>}
 <RowMenu label={`More actions for ${a.patientName}`} testId={`menu-${a.id}`} items={[...(canShowAppointmentTicket(a)?[{key:"pdf",label:pdf?.id===a.id&&!pdf.error?"Preparing PDF…":"Download Ticket PDF",disabled:blocked||!!(pdf&&!pdf.error),testId:`action-pdf-${a.id}`,onSelect:()=>void rowPdf(a)},{key:"pdf-a4",label:"Download A4 PDF",disabled:blocked||!!(pdf&&!pdf.error),testId:`action-pdf-a4-${a.id}`,onSelect:()=>void rowPdf(a,"a4")},{key:"email",label:"Email Ticket…",disabled:blocked,testId:`action-email-${a.id}`,onSelect:()=>setEmailFor(a)}]:[]),...(canReschedule?[{key:"reschedule",label:"Reschedule",disabled:blocked||action.isPending,onSelect:()=>setReschedule(a)}]:[]),...rest.map(next=>({key:next,label:label(next),danger:["cancel","noShow"].includes(next),disabled:blocked||action.isPending,testId:`action-${next}-${a.id}`,onSelect:()=>open(next)}))]}/></>;})()}
</div></td></tr>{expandedId===a.id&&<tr className="row-expansion appt-expansion" id={`appt-expand-${a.id}`} data-testid={`expansion-appointment-${a.id}`}><td colSpan={shownCols.length+2+(selectable?1:0)}>

   <ErrorNotice error={detail.error}/>{detail.error&&<button type="button" onClick={()=>void detail.refetch()}>Retry Details</button>}{detail.data?.id===a.id&&!isPrivateAppointmentUnavailable(detail.error)?<AppointmentDetails key={a.id} appointment={detail.data} supplementaryDetails={hiddenCols.length>0&&<dl className="appt-expansion-hidden" aria-label="Hidden columns">{hiddenCols.map(k=><div key={k}><dt>{cols.label(k)}</dt><dd>{cell(k,detail.data!,i)}</dd></div>)}</dl>}/>:!detail.error&&<div className="appt-detail-skeleton" role="status" aria-label="Loading details"><span/><span/><span/></div>}
  </td></tr>}</Fragment>)}</tbody></table></div>
 <AppDialog open={!!reschedule} size="medium" onClose={()=>{setReschedule(null);setRescheduleDirty(false);}} title="Reschedule Appointment" dirty={rescheduleDirty}>{reschedule&&<RescheduleAppointment key={reschedule.id} appointment={reschedule} onDirtyChange={setRescheduleDirty} onDone={()=>{setReschedule(null);setExpandedId(reschedule.id);}}/>}</AppDialog>
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