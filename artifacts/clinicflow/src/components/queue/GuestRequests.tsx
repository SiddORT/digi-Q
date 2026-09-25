import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { ErrorNotice } from "../../resources";
import { Pagination } from "../ListingControls";
import { useFreshWorkspace } from "./useFreshWorkspace";
import { AppDialog } from "../AppDialog";

export function GuestRequests({clinicId,branchId,doctorId,date,sessionId,startTime}:{clinicId:string;branchId:string;doctorId:string;date:string;sessionId?:string;startTime?:string}) {
 const [page,setPage]=useState(1);
 const [pageSize,setPageSize]=useState(10);
 const [declining,setDeclining]=useState<api.StaffGuestRequest|null>(null);
 const [reason,setReason]=useState("");
 const [message,setMessage]=useState("");
 const lock=useRef(false);
 const client=useQueryClient();
 // A snapshotted time includes older requests without a stored session ID.
 const params:api.ListGuestRequestsParams={clinicId,branchId,doctorId,date,sessionId:startTime?undefined:sessionId,startTime,status:"pending",page,pageSize};
 const requests=api.useListGuestRequests(params,{query:{queryKey:api.getListGuestRequestsQueryKey(params),refetchInterval:20000}});
 const fresh=useFreshWorkspace(requests.dataUpdatedAt,!!requests.error);
 const decision=api.useDecideGuestRequest({mutation:{onSuccess:item=>{setMessage(item.status==="confirmed"?`${item.fullName} confirmed · Token ${item.token}`:`${item.fullName}: request declined.`);setDeclining(null);setReason("");},onSettled:()=>{void client.invalidateQueries();}}});
 async function act(id:string,action:"confirm"|"reject",auditReason:string) {
  if(lock.current||fresh.stale)return;lock.current=true;setMessage("");
  try{await decision.mutateAsync({id,data:{action,reason:auditReason}});}catch{/* Error remains visible; failed confirmation leaves request pending. */}finally{lock.current=false;}
 }
 return <section className="panel" aria-label="Awaiting confirmation">
  <div className="panel-heading"><div><h2>Awaiting confirmation <span className="badge" data-testid="guest-pending-count">{requests.error?"Unavailable":requests.data?.total??"…"}</span></h2><p>Requests for the selected consulting session. No tokens or capacity reserved yet.</p></div></div>
  <ErrorNotice error={requests.error}/><ErrorNotice error={decision.error}/>
  {decision.error&&<p>Confirmation may fail if the session is full or availability changed. Refresh and review the request before trying again.</p>}
  {message&&<p role="status" data-testid="guest-decision-result">{message}</p>}
  {fresh.stale&&!requests.isLoading&&<p role="alert">Requests are offline or out of date. Refresh before deciding.</p>}
  <button className="button secondary small" data-testid="button-refresh-requests" onClick={()=>requests.refetch()} disabled={requests.isFetching}>Refresh requests</button>
  {requests.isLoading?<p role="status">Loading requests…</p>:requests.error?null:requests.data?.items.length?<div className="activity-list">{requests.data.items.map(item=><article key={item.id} style={{padding:"16px 0",borderBottom:"1px solid var(--color-border)"}}>
   <strong>{item.fullName}</strong><p>{item.doctorName} · {item.date}<br/>{item.branchName} · {item.startTime}–{item.endTime} · {item.timezone}</p>
   <p className="muted">{[item.email,item.mobile].filter(Boolean).join(" · ")||"No contact details provided"}</p>
   <div className="toolbar"><button className="button" data-testid={`button-approve-${item.id}`} disabled={fresh.stale||requests.isFetching||decision.isPending} onClick={()=>void act(item.id,"confirm","Confirmed by reception after reviewing the guest request.")}>Approve</button><button className="button secondary" data-testid={`button-decline-${item.id}`} disabled={fresh.stale||requests.isFetching||decision.isPending} onClick={()=>{decision.reset();setDeclining(item);setReason("");}}>Decline</button></div>
  </article>)}</div>:<p>No requests awaiting confirmation for this session.</p>}
  <Pagination page={page} pageSize={pageSize} total={requests.data?.total??0} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  <AppDialog title="Decline request" open={!!declining} onClose={()=>setDeclining(null)} busy={decision.isPending}>
   <p>{declining?.fullName} · {declining?.doctorName} · {declining?.date}</p>
   <label>Reason (shown on the patient's receipt)<textarea data-testid="input-guest-decline-reason" maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <ErrorNotice error={decision.error}/>
   <button className="button" data-testid="button-confirm-decline" disabled={!reason.trim()||decision.isPending||fresh.stale} onClick={()=>declining&&void act(declining.id,"reject",reason.trim())}>Decline request</button>
  </AppDialog>
 </section>;
}