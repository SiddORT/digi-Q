import { useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { ErrorNotice } from "../../resources";
import { SearchableSelect } from "../SearchableSelect";

export function DurationEditor({clinicId,doctorId,branchId,date,queue}:{clinicId:string;doctorId:string;branchId:string;date:string;queue:api.LiveQueue}){
 const [open,setOpen]=useState(false);const [minutes,setMinutes]=useState<20|30|60>(20);const [effect,setEffect]=useState<"futureOnly"|"runningSession">("futureOnly");const [confirm,setConfirm]=useState(false);const [openedMinutes,setOpenedMinutes]=useState<20|30|60>(20);const lock=useRef(false);const client=useQueryClient();
 const q=api.useGetDoctorDuration(doctorId,clinicId,{query:{queryKey:api.getGetDoctorDurationQueryKey(doctorId,clinicId),enabled:open}});
 const update=api.useUpdateDoctorDuration({mutation:{onSuccess:()=>{client.invalidateQueries();setOpen(false);},onError:()=>{setConfirm(false);client.invalidateQueries();}}});
 return <><button type="button" className="button secondary small sq-duration-open" aria-haspopup="dialog" data-testid="button-queue-duration" onClick={()=>{update.reset();setConfirm(false);setEffect("futureOnly");setOpenedMinutes(minutes);setOpen(true);}}>Expected Duration</button><AppDialog open={open} onClose={()=>setOpen(false)} title="Doctor duration · this clinic" variant="drawer" busy={update.isPending} dirty={minutes!==openedMinutes||effect!=="futureOnly"||confirm}>
 <ErrorNotice error={q.error||update.error}/>{q.error&&<button type="button" onClick={()=>q.refetch()}>Retry Duration</button>}
 <p>Clinic override: {q.isLoading?"Loading…":q.data?.expectedDurationMinutes==null?"Uses existing schedule duration":`${q.data.expectedDurationMinutes} minutes`}. Selected session: {queue.expectedDurationMinutes??"—"} minutes. Existing legacy values stay unchanged until you explicitly save a new choice.</p>
 <form onSubmit={async e=>{e.preventDefault();if(lock.current||q.error||q.isLoading)return;lock.current=true;try{await update.mutateAsync({id:doctorId,clinicId,data:{clinicId,expectedDurationMinutes:minutes,effect,...(effect==="runningSession"?{branchId,date,sessionId:queue.sessionId||undefined,startTime:queue.startTime||undefined,confirmRunningSession:confirm,expectedQueueVersion:queue.queueVersion}:{})}});}catch{}finally{lock.current=false;}}}>
 <div data-testid="select-duration-minutes"><SearchableSelect label="New Expected Duration" disabled={update.isPending} value={String(minutes)} onChange={value=>{if(!value)return;setMinutes(Number(value) as 20|30|60);setConfirm(false);}} options={[20,30,60].map(n=>({value:String(n),label:`${n} minutes`}))}/></div>
 <div data-testid="select-duration-effect"><SearchableSelect label="Apply Change" disabled={update.isPending} value={effect} onChange={value=>{if(!value)return;setEffect(value as typeof effect);setConfirm(false);}} options={[{value:"futureOnly",label:"Future Sessions Only"},{value:"runningSession",label:"Also Apply to This Running Session"}]}/></div>
 <p>Future-only updates sessions that have not started, including future sessions with existing bookings. Running and completed sessions keep their recorded duration unless you explicitly confirm applying this change to the selected running session.</p>
 {effect==="runningSession"&&<><p className="notice" role="alert">Warning: this updates wait estimates immediately for all patients in the selected session ({date}). It does not move reservations or interrupt care.</p><label className="check-label"><input required type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>I confirm applying the change to the selected running session.</label></>}
 <button data-testid="button-save-duration" className="button" disabled={update.isPending||q.isLoading||!!q.error||(effect==="runningSession"&&(!confirm||!queue.queueVersion))}>{update.isPending?"Saving…":"Save Duration"}</button>
 </form></AppDialog></>;
}