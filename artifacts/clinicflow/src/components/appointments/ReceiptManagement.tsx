import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorNotice } from "../../resources";
import { AppDialog } from "../AppDialog";
import { FormActions } from "../FormActions";
import { MovementForm } from "./MovementForm";
import { RescheduleAppointment } from "./RescheduleAppointment";
import { refreshAppointmentObservers } from "./refresh";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";

/** Private-link management. The receipt secret stays in props/memory: never in URLs, logs or query keys. */
export function ReceiptManagement({receiptSecret,onRefresh}:{receiptSecret:string;onRefresh:()=>void}){
 const client=useQueryClient();
 const read=api.useManageGuestReceipt({mutation:{gcTime:0}});
 const cancel=api.useManageGuestReceipt({mutation:{gcTime:0}});
 const [panel,setPanel]=useState<"shift"|"reschedule"|"cancel"|null>(null);
 const [dirty,setDirty]=useState(false);
 const [reason,setReason]=useState("");const [confirmed,setConfirmed]=useState(false);
 const readRef=useRef(()=>{});
 readRef.current=()=>{if(navigator.onLine&&!read.isPending)read.mutate({data:{receiptSecret}});};
 useEffect(()=>{readRef.current();const t=window.setInterval(()=>{if(!panel)readRef.current();},20000);return()=>clearInterval(t);},[receiptSecret,panel]);
 const m=read.data;const a=m?.appointment;
 const fresh=useFreshWorkspace(read.submittedAt,!!read.error);
 const lock=useRef(false);
 useEffect(()=>{setConfirmed(false);},[a?.revision,a?.status]);
 const close=()=>{setPanel(null);setDirty(false);setReason("");setConfirmed(false);cancel.reset();readRef.current();};
 const done=()=>{close();onRefresh();};
 const canCancel=!!a&&a.allowedActions.includes("cancel");
 const canMove=!!a&&a.canReschedule===true&&a.status!=="called";
 const canShift=canMove&&(m?.positions.length??0)>0;
 async function doCancel(e:React.FormEvent){
  e.preventDefault();if(lock.current||fresh.stale||!a||!reason.trim()||!confirmed)return;lock.current=true;
  try{await cancel.mutateAsync({data:{receiptSecret,action:{action:"cancel",reason:reason.trim(),expectedRevision:a.revision??0,expectedStatus:a.status}}});await refreshAppointmentObservers(client);onRefresh();close();}
  catch{setConfirmed(false);await refreshAppointmentObservers(client);onRefresh();readRef.current();}
  finally{lock.current=false;}
 }
 if(!a&&!read.error)return <section className="panel padded" aria-label="Manage this booking" data-testid="receipt-management"><div className="appt-detail-skeleton" role="status" aria-label="Loading booking options"><span/><span/></div></section>;
 return <section className="panel padded" aria-label="Manage this booking" data-testid="receipt-management">
  <h3>Manage This Booking</h3>
  <ErrorNotice error={read.error}/>{read.error&&<button type="button" onClick={()=>readRef.current()}>Retry</button>}
  {a&&<>
   {a.status==="called"&&<p className="notice">You have been called. Changes are not available now; please see reception.</p>}
   {a.movementReason&&<p className="muted">{a.movementReason}</p>}
   <div className="row-actions">
    {canMove&&<button type="button" className="button secondary" disabled={!canShift} onClick={()=>setPanel("shift")} data-testid="button-receipt-shift">Shift Time</button>}
    {canMove&&<button type="button" className="button secondary" onClick={()=>setPanel("reschedule")} data-testid="button-receipt-reschedule">Reschedule</button>}
    {canCancel&&<button type="button" className="button secondary danger" onClick={()=>setPanel("cancel")} data-testid="button-receipt-cancel">Cancel Booking</button>}
   </div>
   {canMove&&!canShift&&<p className="muted">Shift Time is unavailable because you are last in the queue.</p>}
   {!canMove&&!canCancel&&a.status!=="called"&&<p className="muted">No changes are available for this booking.</p>}
  </>}
  <AppDialog open={panel==="shift"} onClose={close} title="Shift Time" dirty={dirty}>{panel==="shift"&&a&&<MovementForm appointmentId={a.id} mode="shift" receiptSecret={receiptSecret} onRefresh={onRefresh} onDirtyChange={setDirty} onDone={done}/>}</AppDialog>
  <AppDialog open={panel==="reschedule"} size="medium" onClose={close} title="Reschedule Appointment" dirty={dirty}>{panel==="reschedule"&&a&&<RescheduleAppointment appointment={a} receiptSecret={receiptSecret} onDirtyChange={setDirty} onDone={done}/>}</AppDialog>
  <AppDialog open={panel==="cancel"} onClose={close} title="Cancel Booking" busy={cancel.isPending} dirty={!!reason}>
   <form onSubmit={doCancel}>
    <p className="notice">Cancelling releases your place and your token. This cannot be undone; the clinic cutoff is checked again when you confirm.</p>
    <ErrorNotice error={cancel.error}/>
    {fresh.stale&&<p role="alert">Your booking review is offline or stale. <button type="button" onClick={()=>readRef.current()}>Refresh Booking</button></p>}
    <label>Required reason<textarea required value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} data-testid="input-receipt-cancel-reason"/></label>
    <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} data-testid="check-receipt-cancel"/>Yes, cancel this booking.</label>
    <FormActions wide={false} onCancel={close} cancelLabel="Back" busy={cancel.isPending} busyLabel="Cancelling…" submitLabel="Confirm Cancel" disabled={fresh.stale||!reason.trim()||!confirmed}/>
   </form>
  </AppDialog>
 </section>;
}
