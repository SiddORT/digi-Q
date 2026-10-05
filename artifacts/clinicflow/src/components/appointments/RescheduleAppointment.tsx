import { useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CareLookup } from "../CareLookup";
import { ErrorNotice, today } from "../../resources";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import { SessionSelector, useDailySession, formatSessionHours } from "../queue/SessionSelector";
import { formatTime } from "../../lib/date-time";
import { DateFormatInput } from "../DateFormatInput";

export function RescheduleAppointment({appointment:a,onDone}:{appointment:api.Appointment;onDone:()=>void}){
 const [branchId,setBranch]=useState(a.branchId);const [doctorId,setDoctor]=useState(a.doctorId);const [date,setDate]=useState(a.date);const [reason,setReason]=useState("");const [confirmed,setConfirmed]=useState(false);
 const selection=useDailySession({branchId,doctorId,date,initialSessionId:a.sessionId});const availability=selection.availability;
 const client=useQueryClient();const lock=useRef(false);
 const current=api.useGetAppointment(a.id,{query:{queryKey:api.getGetAppointmentQueryKey(a.id),refetchInterval:30000}});
 const original=current.data||a;
 const mutation=api.useRescheduleAppointment({mutation:{onSuccess:async()=>{await client.invalidateQueries();onDone();},onError:()=>{setConfirmed(false);return client.invalidateQueries();}}});
 const fresh=useFreshWorkspace(current.dataUpdatedAt,!!current.error);
 const valid=!fresh.stale&&["booked","waiting","called"].includes(original.status)&&!original.checkedInAt&&!current.error&&!current.isFetching&&availability.data?.available&&availability.data.queueMode!=="walkInsOnly"&&availability.data.remainingTokens>0&&!availability.error&&!availability.isFetching&&(branchId!==original.branchId||doctorId!==original.doctorId||date!==original.date||availability.data.startTime!==original.startTime);
 return <form onSubmit={async e=>{e.preventDefault();if(lock.current||!valid||!confirmed)return;lock.current=true;try{await mutation.mutateAsync({id:a.id,data:{branchId,doctorId,date,sessionId:selection.sessionId||undefined,reason:reason.trim()||undefined,expectedRevision:original.revision??0}});}catch{}finally{lock.current=false;}}}>
 <p>{a.reference} · {a.clinicName}. Changes are permitted only before check-in and the clinic cancellation cutoff. Your reference and history remain; the destination issues a new token. A failed change leaves your original booking intact.</p>
 <p>Current reservation: {original.doctorName} · {original.branchName} · {original.date} · Token {original.token} · {original.status}</p>
 <ErrorNotice error={mutation.error||availability.error||current.error}/>
 {(availability.error||current.error)&&<button type="button" onClick={()=>{availability.refetch();current.refetch();}}>Refresh Original and Destination</button>}
 <CareLookup kind="branches" publicAccess label="Destination Branch" value={branchId} disabled={mutation.isPending} params={{clinicId:a.clinicId}} onChange={v=>{setBranch(v);setDoctor("");setConfirmed(false);}}/>
 <CareLookup kind="doctors" publicAccess label="Destination Doctor" value={doctorId} disabled={!branchId||mutation.isPending} params={{clinicId:a.clinicId,branchId}} onChange={v=>{setDoctor(v);setConfirmed(false);}}/>
 <label>Destination date<DateFormatInput data-testid="input-reschedule-date" disabled={mutation.isPending} min={today(availability.data?.timezone)} value={date} onChange={value=>{setDate(value);setConfirmed(false);}}/></label>
 <SessionSelector selection={{...selection,setSessionId:id=>{selection.setSessionId(id);setConfirmed(false);}}}/>
 <p role="status">{availability.isFetching?"Checking destination…":availability.data?.available?`${availability.data.remainingTokens} remaining · ${formatSessionHours(availability.data)}${availability.data.breakStart&&availability.data.breakEnd?` · Break ${formatTime(availability.data.breakStart,availability.data)}–${formatTime(availability.data.breakEnd,availability.data)}`:""}`:availability.data?.reason||"Select a destination."}</p>
 <label>Reason (optional)<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label>
 <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Replace this booking with the selected destination and a new token.</label>
 <button data-testid="button-confirm-reschedule" className="button" disabled={!valid||!confirmed||mutation.isPending}>{mutation.isPending?"Rescheduling…":"Confirm Reschedule"}</button>
 </form>;
}