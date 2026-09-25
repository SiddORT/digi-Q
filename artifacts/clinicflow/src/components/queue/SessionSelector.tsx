import { useState } from "react";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "../SearchableSelect";
import { ErrorNotice } from "../../resources";
import { resolveSessionContext, sessionContextKey } from "./session-scope";

export function useDailySession({doctorId,branchId,date,initialSessionId}:{doctorId:string;branchId:string;date:string;initialSessionId?:string|null}){
 const scope=JSON.stringify([doctorId,branchId,date]);
 const [selection,setSelection]=useState({scope,id:initialSessionId||""});
 const params={doctorId,branchId,date};
 const query=api.useGetPublicAvailabilitySessions(params,{query:{queryKey:api.getGetPublicAvailabilitySessionsQueryKey(params),enabled:!!doctorId&&!!branchId&&/^\d{4}-\d{2}-\d{2}$/.test(date),refetchInterval:30000}});
 const sessions=query.data||[];
 const explicit=selection.scope===scope?selection.id:"";
 const sessionId=explicit||(sessions.length===1?sessions[0].sessionId||"":"");
 const session=sessions.length===1&&!sessions[0].sessionId?sessions[0]:sessions.find(item=>item.sessionId===sessionId);
 return {sessionId,setSessionId:(id:string)=>setSelection({scope,id}),sessions,availability:{...query,data:session}};
}

export function SessionSelector({selection}:{selection:ReturnType<typeof useDailySession>}){
 return <div><SearchableSelect label="Consulting session" value={selection.sessionId} onChange={selection.setSessionId} placeholder="Select session…" options={selection.sessions.map(item=>({value:item.sessionId||"",label:`${item.startTime}–${item.endTime} · ${item.remainingTokens} places remaining${item.available?"":" · unavailable"}`}))}/><ErrorNotice error={selection.availability.error}/>{selection.availability.error&&<button type="button" onClick={()=>selection.availability.refetch()}>Retry sessions</button>}</div>;
}

export function useOperationalSession({doctorId,branchId,date,initialSessionId,initialStartTime,enabled=true}:{doctorId:string;branchId:string;date:string;initialSessionId?:string|null;initialStartTime?:string|null;enabled?:boolean}){
 const scope=JSON.stringify([doctorId,branchId,date]);
 const [selection,setSelection]=useState({scope,key:"",initial:{sessionId:initialSessionId,startTime:initialStartTime}});
 const params={doctorId,branchId,date};
 const query=api.useGetSessionContexts(params,{query:{queryKey:api.getGetSessionContextsQueryKey(params),enabled:enabled&&!!doctorId&&!!branchId&&/^\d{4}-\d{2}-\d{2}$/.test(date),refetchInterval:30000}});
 const sessions=query.data||[];
 const selected=selection.scope===scope&&selection.key?sessions.find(item=>sessionContextKey(item)===selection.key):resolveSessionContext(sessions,selection.scope===scope?selection.initial:undefined);
 return {sessions,selectedKey:selected?sessionContextKey(selected):"",sessionId:selected?.sessionId||undefined,startTime:selected?.startTime||undefined,snapshotOnly:selected?.snapshotOnly||false,setSelectionKey:(key:string)=>setSelection({scope,key,initial:{sessionId:undefined,startTime:undefined}}),availability:{...query,data:selected}};
}

export function OperationalSessionSelector({selection}:{selection:ReturnType<typeof useOperationalSession>}){
 return <div><SearchableSelect label="Queue session" value={selection.selectedKey} onChange={selection.setSelectionKey} placeholder="Select session…" options={selection.sessions.map(item=>({value:sessionContextKey(item),label:`${item.startTime}–${item.endTime}${item.snapshotOnly?" · Saved appointment session":" · Current schedule"}`}))}/><ErrorNotice error={selection.availability.error}/>{selection.availability.error&&<button type="button" onClick={()=>selection.availability.refetch()}>Retry queue sessions</button>}{selection.snapshotOnly&&<small className="muted">Saved session retained for existing appointments. It cannot receive new bookings.</small>}</div>;
}