import { useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { ErrorNotice } from "../../resources";

export function DurationEditor({clinicId,doctorId,branchId,date,queue}:{clinicId:string;doctorId:string;branchId:string;date:string;queue:api.LiveQueue}){
 const [open,setOpen]=useState(false);const [minutes,setMinutes]=useState<20|30|60>(20);const [effect,setEffect]=useState<"futureOnly"|"runningSession">("futureOnly");const [confirm,setConfirm]=useState(false);const lock=useRef(false);const client=useQueryClient();
 const q=api.useGetDoctorDuration(doctorId,clinicId,{query:{queryKey:api.getGetDoctorDurationQueryKey(doctorId,clinicId),enabled:open}});
 const update=api.useUpdateDoctorDuration({mutation:{onSuccess:()=>{client.invalidateQueries();setOpen(false);},onError:()=>{setConfirm(false);client.invalidateQueries();}}});
 return <><button onClick={()=>{update.reset();setConfirm(false);setEffect("futureOnly");setOpen(true);}}>Expected duration</button><AppDialog open={open} onClose={()=>setOpen(false)} title="Doctor duration · this clinic" busy={update.isPending} dirty>
 <ErrorNotice error={q.error||update.error}/>{q.error&&<button onClick={()=>q.refetch()}>Retry duration</button>}
 <p>Clinic override: {q.isLoading?"Loading…":q.data?.expectedDurationMinutes==null?"Uses existing schedule duration":`${q.data.expectedDurationMinutes} minutes`}. Selected session: {queue.expectedDurationMinutes??"—"} minutes. Existing legacy values stay unchanged until you explicitly save a new choice.</p>
 <form onSubmit={async e=>{e.preventDefault();if(lock.current||q.error||q.isLoading)return;lock.current=true;try{await update.mutateAsync({id:doctorId,clinicId,data:{clinicId,expectedDurationMinutes:minutes,effect,...(effect==="runningSession"?{branchId,date,confirmRunningSession:confirm,expectedQueueVersion:queue.queueVersion}:{})}});}catch{}finally{lock.current=false;}}}>
 <label>New expected duration<select data-testid="select-duration-minutes" disabled={update.isPending} value={minutes} onChange={e=>{setMinutes(Number(e.target.value) as 20|30|60);setConfirm(false);}}>{[20,30,60].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>
 <label>Apply change<select data-testid="select-duration-effect" disabled={update.isPending} value={effect} onChange={e=>{setEffect(e.target.value as typeof effect);setConfirm(false);}}><option value="futureOnly">Future sessions only</option><option value="runningSession">Also apply to this running session</option></select></label>
 <p>Future-only updates sessions that have not started, including future sessions with existing bookings. Running and completed sessions keep their recorded duration unless you explicitly confirm applying this change to the selected running session.</p>
 {effect==="runningSession"&&<><p className="notice" role="alert">Warning: this updates wait estimates immediately for all patients in the selected session ({date}). It does not move reservations or interrupt care.</p><label className="check-label"><input required type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>I confirm applying the change to the selected running session.</label></>}
 <button data-testid="button-save-duration" className="button" disabled={update.isPending||q.isLoading||!!q.error||(effect==="runningSession"&&(!confirm||!queue.queueVersion))}>{update.isPending?"Saving…":"Save duration"}</button>
 </form></AppDialog></>;
}