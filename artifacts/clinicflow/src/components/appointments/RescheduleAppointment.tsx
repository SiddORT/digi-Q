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

export function RescheduleAppointment({appointment:a,onDone,onDirtyChange}:{appointment:api.Appointment;onDone:()=>void;onDirtyChange?:(dirty:boolean)=>void}){
 return <DateTimePreferencesProvider value={a}><RescheduleAppointmentForm appointment={a} onDone={onDone} onDirtyChange={onDirtyChange}/></DateTimePreferencesProvider>;
}
function RescheduleAppointmentForm({appointment:a,onDone,onDirtyChange}:{appointment:api.Appointment;onDone:()=>void;onDirtyChange?:(dirty:boolean)=>void}){
 const [branchId,setBranch]=useState(a.branchId);const [doctorId,setDoctor]=useState(a.doctorId);const [date,setDate]=useState(a.date);const [reason,setReason]=useState("");const [confirmed,setConfirmed]=useState(false);
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
 const current=api.useGetAppointment(a.id,{query:{queryKey:api.getGetAppointmentQueryKey(a.id),refetchInterval:30000}});
 const original=current.data||a;
 const mutation=api.useRescheduleAppointment({mutation:{onSuccess:async saved=>{client.setQueryData(api.getGetAppointmentQueryKey(saved.id),saved);await refreshAppointmentObservers(client);onDone();},onError:()=>{setConfirmed(false);return refreshAppointmentObservers(client);}}});
 const fresh=useFreshWorkspace(current.dataUpdatedAt,!!current.error);
 const destinationFresh=useFreshWorkspace(availability.dataUpdatedAt,!!availability.error);
 const valid=discovery.ready&&date>=discovery.context.data!.today&&date<=discovery.context.data!.lastBookableDate&&dateValid&&!destinationFresh.stale&&!fresh.stale&&["booked","waiting","called"].includes(original.status)&&!original.checkedInAt&&!current.error&&!current.isFetching&&availability.data?.available&&availability.data.queueMode!=="walkInsOnly"&&availability.data.remainingTokens>0&&!availability.error&&!availability.isFetching&&(branchId!==original.branchId||doctorId!==original.doctorId||date!==original.date||availability.data.startTime!==original.startTime);
 return <form onSubmit={async e=>{e.preventDefault();if(lock.current||!valid||!confirmed)return;lock.current=true;try{await mutation.mutateAsync({id:a.id,data:{branchId,doctorId,date,sessionId:selection.sessionId||undefined,reason:reason.trim()||undefined,expectedRevision:original.revision??0}});}catch{}finally{lock.current=false;}}}>
 <p>{a.reference} · {a.clinicName}. Changes are permitted only before check-in and the clinic cancellation cutoff. Your reference and history remain; the destination issues a new token. A failed change leaves your original booking intact.</p>
 <BookingVisitSummary clinicName={original.clinicName} branchName={original.branchName} doctorName={original.doctorName} date={original.date} session={original} preferences={original} patientName={original.patientName}/>
 <ErrorNotice error={mutation.error||availability.error||current.error}/>
 {(availability.error||current.error)&&<button type="button" onClick={()=>{availability.refetch();current.refetch();}}>Refresh Original and Destination</button>}
 <CareLookup kind="branches" publicAccess {...bookingFields.location} value={branchId} disabled={mutation.isPending} params={{clinicId:a.clinicId}} onChange={v=>{setBranch(v);setDoctor("");setConfirmed(false);}}/>
 <CareLookup kind="doctors" publicAccess {...bookingFields.doctor} value={doctorId} disabled={!branchId||mutation.isPending} params={{clinicId:a.clinicId,branchId}} onChange={v=>{setDoctor(v);setConfirmed(false);}}/>
 <BookingField name="date"><DateFormatInput required preferences={original} onValidityChange={setDateValid} data-testid="input-reschedule-date" disabled={mutation.isPending} min={discovery.context.data?.today} max={discovery.context.data?.lastBookableDate} value={date} onChange={value=>{discovery.changeDate(value);setConfirmed(false);}}/></BookingField>
 <BookingDiscovery discovery={discovery} selection={{...selection,setSessionId:id=>{selection.setSessionId(id);setConfirmed(false);}}} date={date}/>
 <BookingField name="reason"><textarea placeholder={bookingFields.reason.placeholder} value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></BookingField>
 <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Replace this booking with the selected destination and a new token.</label>
 <button data-testid="button-confirm-reschedule" className="button" disabled={!valid||!confirmed||mutation.isPending}>{mutation.isPending?"Rescheduling…":"Confirm Reschedule"}</button>
 </form>;
}