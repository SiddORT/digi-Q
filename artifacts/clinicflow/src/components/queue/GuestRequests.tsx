import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { IconAction } from "../IconAction";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { ErrorNotice } from "../../resources";
import { Pagination, SearchInput, useDebouncedValue, listingSuggestions } from "../ListingControls";
import { SearchableSelect } from "../SearchableSelect";
import { useFreshWorkspace } from "./useFreshWorkspace";
import { AppDialog } from "../AppDialog";
import { HelpTip } from "../HelpTip";
import { formatDate } from "../../lib/date-time";
import { formatSessionHours } from "./SessionSelector";

export function GuestRequests({clinicId,branchId,doctorId,date,sessionId,startTime}:{clinicId:string;branchId:string;doctorId:string;date:string;sessionId?:string;startTime?:string}) {
 const [page,setPage]=useState(1);
 const [pageSize,setPageSize]=useState(10);
 const [search,setSearch]=useState("");const debounced=useDebouncedValue(search);
 const [sort,setSort]=useState<"createdAt"|"-createdAt"|"fullName"|"-fullName"|"date"|"-date">("-createdAt");
 useEffect(()=>setPage(1),[debounced,sort,pageSize]);
 const [declining,setDeclining]=useState<api.StaffGuestRequest|null>(null);
 const [reason,setReason]=useState("");
 const [message,setMessage]=useState("");
 const lock=useRef(false);
 const client=useQueryClient();
 // A snapshotted time includes older requests without a stored session ID.
 const params:api.ListGuestRequestsParams={clinicId,branchId,doctorId,date,sessionId:startTime?undefined:sessionId,startTime,status:"pending",search:debounced||undefined,sort,page,pageSize};
 const requests=api.useListGuestRequests(params,{query:{queryKey:api.getListGuestRequestsQueryKey(params),refetchInterval:20000}});
 const fresh=useFreshWorkspace(requests.dataUpdatedAt,!!requests.error);
 const decision=api.useDecideGuestRequest({mutation:{onSuccess:item=>{setMessage(item.status==="confirmed"?`${item.fullName} confirmed · Token ${item.token}`:`${item.fullName}: request declined.`);setDeclining(null);setReason("");},onSettled:()=>client.invalidateQueries()}});
 useEffect(()=>{if(requests.data&&!requests.isFetching)setPage(current=>Math.min(current,Math.max(1,Math.ceil(requests.data.total/pageSize))));},[requests.data,requests.isFetching,pageSize]);
 async function act(id:string,action:"confirm"|"reject",auditReason:string) {
  if(lock.current||fresh.stale)return;lock.current=true;setMessage("");
  try{await decision.mutateAsync({id,data:{action,reason:auditReason}});}catch{/* Error remains visible; failed confirmation leaves request pending. */}finally{lock.current=false;}
 }
 if(!requests.isLoading&&!requests.error&&!requests.data?.total&&!message&&!decision.error&&!decision.isPending&&!search&&!debounced)return null;
 return <section className="panel" aria-label="Earlier booking requests">
  <div className="panel-heading section-head"><div><h2>Earlier Booking Requests <span className="badge" data-testid="guest-pending-count">{requests.error?"Unavailable":requests.data?.total??"…"}</span></h2></div><HelpTip text="These requests predate immediate booking and still need a decision. New bookings receive their ticket automatically."/></div>
  <ErrorNotice error={requests.error}/><ErrorNotice error={decision.error}/>
  {decision.error&&<p>Confirmation may fail if the session is full or availability changed. Refresh and review the request before trying again.</p>}
  {message&&<p role="status" data-testid="guest-decision-result">{message}</p>}
  <div className="toolbar"><SearchInput value={search} onChange={setSearch} label="Search Earlier Requests" placeholder="Search name, email, mobile or token…" suggestions={requests.error?[]:listingSuggestions(requests.data?.items,item=>({id:item.id,label:item.fullName,description:item.doctorName,value:item.fullName}))} loading={requests.isFetching} error={requests.error?"Unable to load requests.":null} onRetry={()=>void requests.refetch()} total={requests.data?.total} settledQuery={debounced} scopeKey={JSON.stringify({clinicId,branchId,doctorId,date,sessionId,startTime,sort,pageSize})}/><SearchableSelect label="Sort Earlier Requests" value={sort} onChange={value=>setSort(value as typeof sort)} options={[{value:"-createdAt",label:"Newest Requests"},{value:"createdAt",label:"Oldest Requests"},{value:"fullName",label:"Name A–Z"},{value:"-fullName",label:"Name Z–A"},{value:"date",label:"Earliest Visit"},{value:"-date",label:"Latest Visit"}]}/></div>
  {fresh.stale&&!requests.isLoading&&<p role="alert">Requests are offline or out of date. Refresh before deciding.</p>}
  <IconAction label="Refresh requests" icon={<RotateCw size={15} aria-hidden/>} testId="button-refresh-requests" onClick={()=>void requests.refetch()} disabled={requests.isFetching} disabledReason="Refreshing…"/>
  {requests.isLoading?<p role="status">Loading requests…</p>:requests.error?null:requests.data?.items.length?<div className="activity-list">{requests.data.items.map(item=><article key={item.id} className="guest-request-row">
   <div className="guest-request-main"><strong title={item.fullName}>{item.fullName}</strong><span className="muted">{[item.mobile||item.email||"No contact details",formatSessionHours(item)].join(" · ")}</span><HelpTip label={`Request details for ${item.fullName}`} text={[item.doctorName,formatDate(item.date,item),item.branchName,item.timezone,item.email,item.mobile].filter(Boolean).join(" · ")}/></div>
   <div className="toolbar guest-request-actions"><button className="button small" data-testid={`button-approve-${item.id}`} disabled={fresh.stale||requests.isFetching||decision.isPending} onClick={()=>void act(item.id,"confirm","Confirmed by reception after reviewing the guest request.")}>{decision.isPending&&decision.variables?.id===item.id?"Updating…":"Approve"}</button><button className="button secondary small" data-testid={`button-decline-${item.id}`} disabled={fresh.stale||requests.isFetching||decision.isPending} onClick={()=>{decision.reset();setDeclining(item);setReason("");}}>Decline</button></div>
  </article>)}</div>:<p>No requests awaiting confirmation for this session.</p>}
  <Pagination page={page} pageSize={pageSize} total={requests.data?.total??0} onPageChange={setPage} onPageSizeChange={setPageSize}/>
  <AppDialog title="Decline Request" open={!!declining} onClose={()=>setDeclining(null)} busy={decision.isPending}>
   <p>{declining?.fullName} · {declining?.doctorName} · {declining&&formatDate(declining.date,declining)}</p>
   <label>Reason (shown on the patient's receipt)<textarea data-testid="input-guest-decline-reason" maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <ErrorNotice error={decision.error}/>
   <button className="button" data-testid="button-confirm-decline" disabled={!reason.trim()||decision.isPending||fresh.stale} onClick={()=>declining&&void act(declining.id,"reject",reason.trim())}>{decision.isPending?"Declining…":"Decline Request"}</button>
  </AppDialog>
 </section>;
}