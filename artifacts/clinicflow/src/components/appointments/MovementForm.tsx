import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorNotice } from "../../resources";
import { FormActions } from "../FormActions";
import { refreshAppointmentObservers } from "./refresh";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";

/** Shift Time (later only) and absent Re-enter share one fresh-review form. Staff and private-receipt transports differ only in how they read and submit. */
export function MovementForm({appointmentId,mode,receiptSecret,onDone,onRefresh,onDirtyChange}:{appointmentId:string;mode:"shift"|"requeue";receiptSecret?:string;onDone:()=>void;onRefresh?:()=>void;onDirtyChange?:(dirty:boolean)=>void}){
 const client=useQueryClient();
 const staffRead=api.useGetAppointmentMovement(appointmentId,{query:{queryKey:api.getGetAppointmentMovementQueryKey(appointmentId),enabled:!receiptSecret,refetchInterval:30000,gcTime:0}});
 const receiptRead=api.useManageGuestReceipt({mutation:{gcTime:0}});
 const staffAct=api.useTransitionAppointment();
 const receiptAct=api.useManageGuestReceipt({mutation:{gcTime:0}});
 const readRef=useRef(()=>{});
 readRef.current=()=>{if(receiptSecret&&navigator.onLine&&!receiptRead.isPending)receiptRead.mutate({data:{receiptSecret}});};
 useEffect(()=>{if(!receiptSecret)return;readRef.current();const t=window.setInterval(()=>readRef.current(),20000);return()=>clearInterval(t);},[receiptSecret]);
 const movement=receiptSecret?receiptRead.data:staffRead.data;
 const readError=receiptSecret?receiptRead.error:staffRead.error;
 const reading=receiptSecret?receiptRead.isPending:staffRead.isFetching;
 const reload=()=>{if(receiptSecret)readRef.current();else void staffRead.refetch();};
 const [reason,setReason]=useState("");const [position,setPosition]=useState(0);const [confirmed,setConfirmed]=useState(false);const [release,setRelease]=useState(false);
 const lock=useRef(false);
 const a=movement?.appointment;
 // Any queue or revision change invalidates what the person reviewed.
 const reviewKey=movement?`${movement.queueVersion}:${a?.revision}:${a?.status}`:"";
 useEffect(()=>{setPosition(0);setConfirmed(false);setRelease(false);},[reviewKey]);
 const dirty=!!reason.trim()||position>0;
 const dirtyRef=useRef(onDirtyChange);dirtyRef.current=onDirtyChange;
 useEffect(()=>{dirtyRef.current?.(dirty);},[dirty]);
 const positions=movement?.positions??[];
 const freshness=useFreshWorkspace(receiptSecret?receiptRead.submittedAt:staffRead.dataUpdatedAt,!!readError);
 const called=a?.status==="called";
 const needsRelease=called&&mode==="shift"&&!receiptSecret;
 const pending=staffAct.isPending||receiptAct.isPending;
 const patientCalled=!!receiptSecret&&called;
 const ready=!!movement&&!!a&&!reading&&!freshness.stale&&!readError&&positions.includes(position)&&!!reason.trim()&&confirmed&&(!needsRelease||release)&&!patientCalled&&(mode==="requeue"?a.allowedActions.includes("requeue"):a.allowedActions.includes("shift"));
 async function submit(e:React.FormEvent){
  e.preventDefault();if(lock.current||!ready||!movement||!a)return;lock.current=true;
  const data:api.AppointmentAction={action:mode==="shift"?"shift":"requeue",expectedRevision:a.revision??0,expectedQueueVersion:movement.queueVersion,position,reason:reason.trim(),...(needsRelease?{releaseCallConfirmed:true}:{})};
  try{
   if(receiptSecret)await receiptAct.mutateAsync({data:{receiptSecret,action:data}});else await staffAct.mutateAsync({id:a.id,data:{...data,expectedStatus:a.status}});
   await refreshAppointmentObservers(client);onRefresh?.();onDone();
  }catch{setConfirmed(false);setPosition(0);await refreshAppointmentObservers(client);onRefresh?.();reload();}
  finally{lock.current=false;}
 }
 const last=!!movement&&positions.length===0;
 return <form onSubmit={submit} data-testid={`form-${mode}`}>
  {!movement&&!readError&&<div className="appt-detail-skeleton" role="status" aria-label="Loading current queue"><span/><span/><span/></div>}
  <ErrorNotice error={readError||staffAct.error||receiptAct.error}/>
  {readError&&<button type="button" onClick={reload}>Refresh Queue</button>}
  {movement&&a&&<>
   <p><strong>{a.patientName}</strong> · {a.reference} · Token {a.token}</p>
   {mode==="shift"?<>
    <p className="notice">Shift Time moves this visit to a later pending position, including just one place later. Your token stays the same: a token is not a queue position, and no exact consultation time is promised.</p>
    <p>{called?`Currently called; ${movement.pendingCount} pending.`:`Currently place ${movement.currentPosition} of ${movement.pendingCount} pending.`}</p>
   </>:<>
    <p className="notice">Re-enter keeps the same booking and token and puts the absent patient back in the pending queue at the position you confirm. A patient already called or in consultation is never displaced.</p>
    <p>{movement.pendingCount} pending {movement.pendingCount===1?"reservation":"reservations"} currently ahead of or around this return.</p>
   </>}
   {last&&mode==="shift"&&<p role="status" className="notice">This visit is already last in the queue, so there is no later place to move to.</p>}
   {patientCalled&&<p role="alert">You have been called and cannot move now. Please speak to reception.</p>}
   {a.movementReason&&<p role="status" className="notice">{a.movementReason}</p>}
   {freshness.stale&&<p role="alert">Queue review is offline, stale or unavailable. <button type="button" onClick={reload}>Refresh Queue</button></p>}
   {positions.length>0&&<fieldset disabled={pending}><legend>{mode==="shift"?"Move to place":"Return position"}</legend>{positions.map(p=><label key={p} className="check-label"><input type="radio" name="movement-position" checked={position===p} onChange={()=>{setPosition(p);setConfirmed(false);}} data-testid={`radio-position-${p}`}/>Place {p}{mode==="shift"&&p===movement.currentPosition+1?" (one place later)":""}{p===movement.pendingCount+1&&mode==="requeue"?" (last)":""}</label>)}</fieldset>}
   <label>Required reason<textarea required value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} data-testid="input-movement-reason"/></label>
   {needsRelease&&<label className="check-label"><input type="checkbox" checked={release} onChange={e=>setRelease(e.target.checked)} data-testid="check-release-call"/>I confirm releasing this patient's current call; they return to waiting.</label>}
   <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} data-testid="check-confirm-movement"/>{mode==="shift"?"Shift this visit to the chosen later place.":"Re-enter this patient at the chosen position."}</label>
  </>}
  <FormActions wide={false} onCancel={onDone} cancelLabel="Back" busy={pending} busyLabel="Updating…" submitLabel={mode==="shift"?"Confirm Shift Time":"Confirm Re-enter"} disabled={!ready}/>
 </form>;
}
