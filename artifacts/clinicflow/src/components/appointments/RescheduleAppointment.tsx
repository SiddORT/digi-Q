import { useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CareLookup } from "../CareLookup";
import { ErrorNotice, today } from "../../resources";

export function RescheduleAppointment({appointment:a,onDone}:{appointment:api.Appointment;onDone:()=>void}){
 const [branchId,setBranch]=useState(a.branchId);const [doctorId,setDoctor]=useState(a.doctorId);const [date,setDate]=useState(a.date);const [reason,setReason]=useState("");const [confirmed,setConfirmed]=useState(false);
 const params={branchId,doctorId,date};const availability=api.useGetPublicAvailability(params,{query:{queryKey:api.getGetPublicAvailabilityQueryKey(params),enabled:!!branchId&&!!doctorId&&!!date,refetchInterval:30000}});
 const client=useQueryClient();const lock=useRef(false);
 const mutation=api.useRescheduleAppointment({mutation:{onSuccess:()=>{client.invalidateQueries();onDone();},onError:()=>client.invalidateQueries()}});
 const valid=availability.data?.available&&availability.data.remainingTokens>0&&!availability.error&&!availability.isFetching&&(branchId!==a.branchId||doctorId!==a.doctorId||date!==a.date);
 return <form onSubmit={async e=>{e.preventDefault();if(lock.current||!valid||!confirmed)return;lock.current=true;try{await mutation.mutateAsync({id:a.id,data:{branchId,doctorId,date,reason:reason.trim()||undefined,expectedRevision:a.revision??0}});}catch{}finally{lock.current=false;}}}>
 <p>{a.reference} · {a.clinicName}. Changes are permitted only before check-in and the clinic cancellation cutoff. Your reference and history remain; the destination issues a new token. A failed change leaves your original booking intact.</p>
 <ErrorNotice error={mutation.error||availability.error}/>
 <CareLookup kind="branches" publicAccess label="Destination branch" value={branchId} params={{clinicId:a.clinicId}} onChange={v=>{setBranch(v);setDoctor("");}}/>
 <CareLookup kind="doctors" publicAccess label="Destination doctor" value={doctorId} disabled={!branchId} params={{clinicId:a.clinicId,branchId}} onChange={setDoctor}/>
 <label>Destination date<input type="date" min={today(availability.data?.timezone)} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <p role="status">{availability.isFetching?"Checking destination…":availability.data?.available?`${availability.data.remainingTokens} remaining · ${availability.data.startTime}–${availability.data.endTime}${availability.data.breakStart?` · Break ${availability.data.breakStart}–${availability.data.breakEnd}`:""}`:availability.data?.reason||"Select a destination."}</p>
 <label>Reason (optional)<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label>
 <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Replace this booking with the selected destination and a new token.</label>
 <button className="button" disabled={!valid||!confirmed||mutation.isPending}>{mutation.isPending?"Rescheduling…":"Confirm reschedule"}</button>
 </form>;
}