import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CareLookup } from "../CareLookup";
import { ErrorNotice } from "../../resources";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import { useDailySession } from "../queue/SessionSelector";
import { DateFormatInput } from "../DateFormatInput";
import { BookingField, bookingFields } from "../booking/booking-fields";
import { BookingVisitSummary } from "../booking/BookingVisitSummary";
import { refreshAppointmentObservers } from "./refresh";
import { DateTimePreferencesProvider } from "../DateTimePreferences";
import { BookingDiscovery, useBookingDiscovery } from "../booking/BookingDiscovery";

export function RescheduleAppointment({appointment:a,onDone,onDirtyChange,receiptSecret}:{appointment:api.Appointment;onDone:()=>void;onDirtyChange?:(dirty:boolean)=>void;receiptSecret?:string}){
 return <DateTimePreferencesProvider value={a}><RescheduleAppointmentForm appointment={a} onDone={onDone} onDirtyChange={onDirtyChange} receiptSecret={receiptSecret}/></DateTimePreferencesProvider>;
}
function RescheduleAppointmentForm({appointment:a,onDone,onDirtyChange,receiptSecret}:{appointment:api.Appointment;onDone:()=>void;onDirtyChange?:(dirty:boolean)=>void;receiptSecret?:string}){
 const [branchId,setBranch]=useState(a.branchId);const [doctorId,setDoctor]=useState(a.doctorId);const [date,setDate]=useState(a.date);const [reason,setReason]=useState("");const [confirmed,setConfirmed]=useState(false);const [release,setRelease]=useState(false);
 const [dateValid,setDateValid]=useState(true);
 const discovery=useBookingDiscovery({branchId,doctorId,date,setDate,deliberateDate:true,preferences:a});
 const selection=useDailySession({branchId,doctorId,date,initialSessionId:a.sessionId,bookingMode:"advance"});const availability=selection.availability;
 const dirty=branchId!==a.branchId||doctorId!==a.doctorId||date!==a.date||selection.sessionId!==(a.sessionId||"")||!!reason.trim();
 const dirtyRef=useRef(onDirtyChange);dirtyRef.current=onDirtyChange;
 useEffect(()=>{dirtyRef.current?.(dirty);},[dirty]);
 // Re-review changed session ranges/timezones after an availability refresh.
 const reviewKey=JSON.stringify([branchId,doctorId,date,selection.sessionId,availability.data?.startTime,availability.data?.endTime,availability.data?.timezone,selection.selectionIssue]);
 useEffect(()=>{setConfirmed(false);},[reviewKey]);
 const client=useQueryClient();const lock=useRef(false);
 const identity=api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),enabled:!receiptSecret}});
 const ownDoctor=identity.data?.user?.role==="doctor";
 const publicAccess=!!receiptSecret||identity.data?.user?.role==="patient";
  const staffReview=api.useGetAppointmentMovement(a.id,{query:{queryKey:api.getGetAppointmentMovementQueryKey(a.id),enabled:!receiptSecret,refetchInterval:30000}});
  const staffCurrent={...staffReview,data:staffReview.data?.appointment};
  const receiptRead=api.useManageGuestReceipt({mutation:{gcTime:0}});
  const [receiptUpdated,setReceiptUpdated]=useState(0);
  const readRef=useRef(()=>{});
  readRef.current=()=>{if(receiptSecret&&navigator.onLine&&!receiptRead.isPending)receiptRead.mutate({data:{receiptSecret}},{onSuccess:()=>setReceiptUpdated(Date.now())});};
  useEffect(()=>{if(!receiptSecret)return;readRef.current();const t=window.setInterval(()=>readRef.current(),20000);return()=>clearInterval(t);},[receiptSecret]);
  const current=receiptSecret?{data:receiptRead.data?.appointment,error:receiptRead.error,isFetching:receiptRead.isPending,dataUpdatedAt:receiptUpdated,refetch:()=>readRef.current()}:staffCurrent;
  const original=current.data||a;
  const originalReviewKey=`${original.revision}:${original.status}`;
  useEffect(()=>{setConfirmed(false);setRelease(false);},[originalReviewKey]);
  const receiptSave=api.useManageGuestReceipt({mutation:{gcTime:0}});
  const staffSave=api.useRescheduleAppointment();
  const mutation={isPending:staffSave.isPending||receiptSave.isPending,error:staffSave.error||receiptSave.error};
  const settle=async()=>{await refreshAppointmentObservers(client);};
 const fresh=useFreshWorkspace(current.dataUpdatedAt,!!current.error);
 const destinationFresh=useFreshWorkspace(availability.dataUpdatedAt,!!availability.error);
 const valid=discovery.ready&&date>=discovery.context.data!.today&&date<=discovery.context.data!.lastBookableDate&&dateValid&&!destinationFresh.stale&&!fresh.stale&&original.canReschedule===true&&(original.status!=="called"||(release&&!receiptSecret))&&!current.error&&!current.isFetching&&availability.data?.available&&availability.data.queueMode!=="walkInsOnly"&&availability.data.remainingTokens>0&&!availability.error&&!availability.isFetching&&(branchId!==original.branchId||doctorId!==original.doctorId||date!==original.date||availability.data.startTime!==original.startTime);
 return <form onSubmit={async e=>{e.preventDefault();if(lock.current||!valid||!confirmed)return;lock.current=true;try{const dest:api.AppointmentReschedule={branchId,doctorId,date,sessionId:selection.sessionId||undefined,reason:reason.trim()||undefined,expectedRevision:original.revision??0,...(original.status==="called"?{releaseCallConfirmed:true}:{})};
   if(receiptSecret){await receiptSave.mutateAsync({data:{receiptSecret,destination:dest}});}
   else{const saved=await staffSave.mutateAsync({id:a.id,data:dest});client.setQueryData(api.getGetAppointmentQueryKey(saved.id),saved);}
   await settle();onDone();}
  catch{setConfirmed(false);setRelease(false);await settle();current.refetch();}finally{lock.current=false;}}}>
 <p>{a.reference} · {a.clinicName}. Changes are permitted only while this visit can still be rescheduled; a called visit needs an explicit call release by staff. Your reference and history remain; the destination issues a new token. A failed change leaves your original booking intact.</p>
 <BookingVisitSummary clinicName={original.clinicName} branchName={original.branchName} doctorName={original.doctorName} date={original.date} session={original} preferences={original} patientName={original.patientName}/>
 <ErrorNotice error={mutation.error||availability.error||current.error}/>
 {original.movementReason&&<p role="status" className="notice">{original.movementReason}</p>}
 {original.status==="called"&&!receiptSecret&&<label className="check-label"><input type="checkbox" checked={release} onChange={e=>setRelease(e.target.checked)} data-testid="check-reschedule-release-call"/>I confirm releasing this patient's current call before moving the unserved visit. This does not mark them absent.</label>}
 {availability.data&&branchId===original.branchId&&doctorId===original.doctorId&&date===original.date&&availability.data.startTime===original.startTime&&<p className="notice">This is the same session. Use Shift Time for a later pending position.</p>}
 <p className="muted">The destination token is an identifier, not immediate-next priority or an exact consultation time.</p>
 {(availability.error||current.error)&&<button type="button" onClick={()=>{availability.refetch();current.refetch();}}>Refresh Original and Destination</button>}
 <CareLookup kind="branches" publicAccess={publicAccess} {...bookingFields.location} value={branchId} disabled={mutation.isPending} params={{clinicId:a.clinicId}} onChange={v=>{setBranch(v);setDoctor(ownDoctor?a.doctorId:"");setConfirmed(false);}}/>
 <CareLookup kind="doctors" publicAccess={publicAccess} {...bookingFields.doctor} value={doctorId} disabled={ownDoctor||!branchId||mutation.isPending} params={{clinicId:a.clinicId,branchId}} onChange={v=>{setDoctor(v);setConfirmed(false);}}/>
 <BookingField name="date"><DateFormatInput required preferences={original} onValidityChange={setDateValid} data-testid="input-reschedule-date" disabled={mutation.isPending} min={discovery.context.data?.today} max={discovery.context.data?.lastBookableDate} value={date} onChange={value=>{discovery.changeDate(value);setConfirmed(false);}}/></BookingField>
 <BookingDiscovery discovery={discovery} selection={{...selection,setSessionId:id=>{selection.setSessionId(id);setConfirmed(false);}}} date={date}/>
 <BookingField name="reason"><textarea placeholder={bookingFields.reason.placeholder} value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></BookingField>
 <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Replace this booking with the selected destination and a new token.</label>
 <button data-testid="button-confirm-reschedule" className="button" disabled={!valid||!confirmed||mutation.isPending}>{mutation.isPending?"Rescheduling…":"Confirm Reschedule"}</button>
 </form>;
}