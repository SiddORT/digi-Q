import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CareLookup, useSelectedCare } from "../CareLookup";
import { FilterBar, Pagination, SearchInput, useDebouncedValue } from "../ListingControls";
import { SearchableSelect } from "../SearchableSelect";
import { ErrorNotice, title, today } from "../../resources";
import { AppointmentRows } from "../appointments/AppointmentRows";
import { DurationEditor } from "./DurationEditor";
import { StatusTabs, statusFilter } from "./StatusTabs";
import { useFreshWorkspace } from "./useFreshWorkspace";
import { useSoleCareDefaults } from "./useSoleCareDefaults";
import { HelpTip } from "../HelpTip";
import { GuestRequests } from "./GuestRequests";
import { OperationalSessionSelector, useOperationalSession } from "./SessionSelector";
import { doctorWorkspaceScope } from "./session-scope";
import { formatDate, formatConfiguredTimestamp } from "../../lib/date-time";

export function SessionQueue({identity,initial}:{identity:api.Identity;initial?:api.Appointment}){
 const searchParams=new URLSearchParams(useSearch());
 const {isDoctor,doctorId:restrictedDoctorId}=doctorWorkspaceScope(identity);
 const [retained]=useState(()=>{try{const value=JSON.parse(sessionStorage.getItem("clinicflow-staff-session")||"null");return identity.user?.role!=="patient"&&value?.staffId===identity.user?.id?value:null;}catch{return null;}});
 const [clinicId,setClinic]=useState(initial?.clinicId||searchParams.get("clinic")||retained?.clinicId||"");const [branchId,setBranch]=useState(initial?.branchId||searchParams.get("branch")||retained?.branchId||"");const [doctorId,setDoctor]=useState(restrictedDoctorId||initial?.doctorId||searchParams.get("doctor")||retained?.doctorId||"");const [date,setDate]=useState(initial?.date||searchParams.get("date")||retained?.date||today());const [appointmentId,setAppointment]=useState(initial?.id||searchParams.get("appointment")||"");
 const [status,setStatus]=useState("");const [search,setSearch]=useState("");const debounced=useDebouncedValue(search);const [page,setPage]=useState(1);const [pageSize,setSize]=useState(20);const client=useQueryClient();const lock=useRef(false);
 const [showSummary,setShowSummary]=useState(false);
 const [callPreview,setCallPreview]=useState<{scope:string;token:string}|null>(null);
 const [sort,setSort]=useState("queueRank");
 const isPatient=identity.user?.role==="patient";const root=["superAdmin","clinicAdmin"].includes(identity.user!.role)?"admin":identity.user!.role;
  useSoleCareDefaults({enabled:!isPatient,clinicId,branchId,doctorId,setClinic,setBranch,setDoctor});
 // Only staff session selectors are retained. Never persist patient IDs, searches,
 // tickets, tokens, queue results, appointment IDs or booking form data.
 const selected=api.useGetAppointment(appointmentId,{query:{queryKey:api.getGetAppointmentQueryKey(appointmentId),enabled:!!appointmentId}});
 useEffect(()=>{if(selected.data){setClinic(selected.data.clinicId);setBranch(selected.data.branchId);setDoctor(selected.data.doctorId);setDate(selected.data.date);}},[selected.data]);
 const sessionSelection=useOperationalSession({doctorId,branchId,date,initialSessionId:initial?.sessionId||searchParams.get("sessionId")||retained?.sessionId,initialStartTime:initial?.startTime||searchParams.get("startTime")||retained?.startTime,enabled:!isPatient});
 const sessionId=appointmentId&&selected.data?selected.data.sessionId||undefined:sessionSelection.sessionId||undefined;
 const startTime=appointmentId&&selected.data?selected.data.startTime:sessionSelection.availability.data?.startTime||undefined;
 useEffect(()=>{if(isPatient)return;try{sessionStorage.setItem("clinicflow-staff-session",JSON.stringify({staffId:identity.user!.id,clinicId,branchId,doctorId,date,sessionId,startTime}));}catch{/* Storage is optional; in-memory selection remains usable. */}},[isPatient,identity.user?.id,clinicId,branchId,doctorId,date,sessionId,startTime]);
 useEffect(()=>setPage(1),[doctorId,branchId,date,sessionId,startTime,status,pageSize,debounced,sort]);
 const enabled=!!doctorId&&!!branchId&&!!(sessionId||startTime)&&(!isPatient||!!appointmentId);
  // Search the authoritative session list instead of rendering the same
  // appointments in a second "matching appointments" table.
  const params={doctorId,branchId,date,sessionId,startTime,appointmentId:appointmentId||undefined,search:!isPatient?debounced||undefined:undefined,sort:!isPatient?sort:undefined,...statusFilter(status),page,pageSize};
 const queue=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled,refetchInterval:30000}});
 const next=api.useCallNext({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
 const doctorsParams={clinicId,branchId,status:"active" as const,page:1,pageSize:20};
 const doctors=api.useListDoctors(doctorsParams,{query:{queryKey:api.getListDoctorsQueryKey(doctorsParams),enabled:showSummary&&!isPatient&&!isDoctor&&!!branchId,refetchInterval:30000,refetchIntervalInBackground:false}});
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const on=()=>setOnline(navigator.onLine);window.addEventListener("online",on);window.addEventListener("offline",on);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",on);};},[]);
 const q=queue.data;
 const callScope=JSON.stringify([doctorId,branchId,date,sessionId,startTime]);
 const lastCall=next.variables?.data;
 const lastCallScope=lastCall?JSON.stringify([lastCall.doctorId,lastCall.branchId,lastCall.date,lastCall.sessionId,lastCall.startTime]):null;
  const freshness=useFreshWorkspace(queue.dataUpdatedAt,!!queue.error);
  const branch=useSelectedCare("branches",branchId,isPatient,{clinicId});
 const listFiltered=!!search||!!status||sort!=="queueRank";
 const sortLabels:Record<string,string>={queueRank:"Queue position",tokenNumber:"Token ascending","-tokenNumber":"Token descending",status:"Status","-createdAt":"Newest bookings"};
 const clearListFilters=()=>{setSearch("");setStatus("");setSort("queueRank");setPage(1);};
 const filterChips=[
  ...(search?[{key:"search",label:`Search: ${search}`,onRemove:()=>setSearch("")}]:[]),
  ...(status?[{key:"status",label:`Status: ${title(status)}`,onRemove:()=>setStatus("")}]:[]),
  ...(sort!=="queueRank"?[{key:"sort",label:`Sort: ${sortLabels[sort]||sort}`,onRemove:()=>setSort("queueRank")}]:[]),
 ];
 return <div className="session-queue">
 <section className="panel padded sq-session-scope" aria-label="Selected queue session">
 <div className="panel-heading"><div><h2>Session</h2><p>Select the clinic, doctor and consulting session to run this queue.</p></div></div>
 <div className="form-grid">
 {isPatient?<CareLookup kind="appointments" label="Your appointment" value={appointmentId} onChange={id=>{setAppointment(id);setDoctor("");setBranch("");}}/>:<>
 <CareLookup kind="clinics" label="Clinic" value={clinicId} onChange={v=>{setClinic(v);setBranch("");setDoctor(restrictedDoctorId);setAppointment("");}}/>
  <CareLookup kind="branches" label="Location" value={branchId} disabled={!clinicId} params={{clinicId}} onChange={v=>{setBranch(v);setDoctor(restrictedDoctorId);setAppointment("");}}/>
 <CareLookup kind="doctors" label="Doctor" value={doctorId} disabled={!branchId||isDoctor} params={{clinicId,branchId}} onChange={v=>{setDoctor(v);setAppointment("");}}/>
 <label>Date<input type="date" value={date} onChange={e=>{setDate(e.target.value);setAppointment("");}}/></label></>}
 {!isPatient&&<OperationalSessionSelector selection={{...sessionSelection,setSelectionKey:key=>{sessionSelection.setSelectionKey(key);setAppointment("");}}}/>}
 </div></section>
 {["receptionist","clinicAdmin","superAdmin"].includes(identity.user!.role)&&enabled&&<GuestRequests key={`${clinicId}-${branchId}-${doctorId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} branchId={branchId} doctorId={doctorId} date={date} sessionId={sessionId} startTime={startTime}/>}
  {branch.data&&<div className="sq-context"><strong>{String(branch.data.name||"Selected branch")}</strong><p>{String(branch.data.address||"Address not provided")} · {formatDate(date,q)}</p></div>}
  {!isPatient&&<StatusTabs value={status} onChange={setStatus} counts={(q as typeof q&{statusCounts?:Record<string,number>})?.statusCounts}/>}
  {!isPatient&&<FilterBar label="Queue search and actions" chips={filterChips} actions={<>{listFiltered&&<button type="button" onClick={clearListFilters} data-testid="button-clear-queue-filters">Clear all</button>}<Link className="button secondary small" href="/check-in">Validate appointment QR</Link>{sessionSelection.snapshotOnly?<span className="badge">Historical session · no new bookings</span>:enabled&&<Link className="button small" href={`/${root}/book?clinic=${encodeURIComponent(clinicId)}&branch=${encodeURIComponent(branchId)}&doctor=${encodeURIComponent(doctorId)}&sessionId=${encodeURIComponent(sessionId||"")}&source=walkIn`}>Register walk-in</Link>}</>}><SearchInput value={search} onChange={setSearch} placeholder="Search queue…" label="Search this session"/></FilterBar>}
  {!isPatient&&listFiltered&&<p className="muted">Clear all resets search, status and sorting while keeping the selected clinic, doctor, date, session and page size.</p>}
  {!isPatient&&!isDoctor&&branchId&&<details className="sq-switch" open={showSummary} onToggle={event=>setShowSummary(event.currentTarget.open)}><summary>Multi-doctor sessions · quick switch</summary>{showSummary&&<><ErrorNotice error={doctors.error}/>{doctors.error&&<button onClick={()=>doctors.refetch()}>Retry doctors</button>}{doctors.isLoading?<p>Loading doctors…</p>:<div className="toolbar">{doctors.data?.items.map(d=><DoctorSummary key={d.id} doctor={d} branchId={branchId} date={date} selected={doctorId===d.id} onSelect={()=>{setDoctor(d.id);setAppointment("");}}/>)}</div>}{(doctors.data?.total??0)>20&&<p>Showing the first 20 doctors; use Doctor search for all results.</p>}</>}</details>}
 <ErrorNotice error={selected.error||queue.error||next.error}/>
  {!isPatient&&<div className="toolbar"><SearchableSelect label="Sort queue listing" value={sort} onChange={value=>{if(value)setSort(value);}} options={Object.entries(sortLabels).map(([value,label])=>({value,label}))}/><span className="muted">Sorting the list does not change who is called next.</span></div>}
 {showSummary&&!isPatient&&!isDoctor&&branchId&&<p className="muted">Quick switch shows each doctor's queue at this location and date. Choose a doctor, then a session if more than one is listed. Switching does not call or check in a patient.</p>}
 {callPreview?.scope===callScope&&<p className="notice" role="status" aria-live="polite">Requesting call for token {callPreview.token}… awaiting server confirmation. This does not start consultation.</p>}
 {selected.error&&<button data-testid="button-retry-queue-appointment" onClick={()=>selected.refetch()}>Retry selected appointment</button>}
 {queue.error&&<button onClick={()=>queue.refetch()}>Retry queue</button>}
  {enabled&&freshness.stale&&<p className="notice" role="alert">{!online?"Offline.":"Queue data is stale or unavailable."} Mutations are disabled. Refresh after reconnecting. <button onClick={()=>queue.refetch()}>Refresh</button></p>}

 {next.isSuccess&&lastCallScope===callScope&&<p role="status">{next.data?.appointment?"Patient called. Latest queue requested.":"No eligible patient was called. Latest queue requested."}</p>}
  {!enabled?<p className="empty">Select {isPatient?"your appointment":"clinic, location, doctor and session"} to view a session.</p>:queue.isLoading?<p role="status">Loading queue…</p>:q?<>
  <div className="sq-summary"><div><small>CURRENT TOKEN</small><strong>{q.currentToken||"—"}</strong><small>{q.currentToken?(q.inConsultation>0?"In consultation":"Called next"):"No patient called"}</small></div><div><small>NEXT WAITING TOKEN</small><strong>{q.nextToken||"—"}</strong><HelpTip text="Checkout calls the next patient. Only explicit staff check-in begins consultation."/></div><div><small>WAITING</small><strong>{q.waiting??"—"}</strong></div><div><small>COMPLETED</small><strong>{q.completed??"—"}</strong></div><div><small>SESSION TOTAL</small><strong>{q.total??"—"}</strong><small>Whole session</small></div></div>
  <DoctorPresence identity={identity} doctorId={doctorId} branchId={branchId} date={date} sessionId={sessionId} startTime={startTime} presence={q.presence} stale={freshness.stale}/>
   {!isPatient&&<button className="button" disabled={freshness.stale||q.presence?.status!=="available"||next.isPending||queue.isFetching||!!q.currentToken||!q.nextToken||q.blockedByAbsentReservation} onClick={async()=>{if(lock.current)return;lock.current=true;setCallPreview({scope:callScope,token:q.nextToken||""});try{await next.mutateAsync({data:{doctorId,branchId,date,sessionId,startTime}});}catch{/* Authoritative error stays visible; discard the pending preview. */}finally{setCallPreview(null);lock.current=false;}}}>{next.isPending?"Calling…":"Call next patient"}</button>}
  {q.blockedByAbsentReservation&&<p className="notice">The earliest reservation needs staff review. Confirm consultation check-in or explicitly skip an absent patient with a reason.</p>}
  {q.ownEntry&&<p className="notice">Token {q.ownEntry.token} · {q.ownEntry.status==="called"?"Called next":["booked","checkedIn","waiting"].includes(q.ownEntry.status)?"Waiting":title(q.ownEntry.status)} · {q.ownEntry.patientsAhead} patients ahead · Approx. queue wait {q.ownEntry.estimatedWaitMinutes==null?"unavailable":`${q.ownEntry.estimatedWaitMinutes} minutes`}</p>}
<details className="sq-note-details"><summary>How waits are estimated</summary><p className="muted sq-note">Token is not position. Approx. wait = patients ahead × {q.expectedDurationMinutes??"configured"} minutes, updated by queue events, not a countdown. Breaks, pauses and delays can extend the actual wait. Expected duration is separate from actual average consultation time.</p></details>
   {!isPatient&&<><details className="sq-duration"><summary>Expected duration settings</summary><fieldset disabled={freshness.stale}><DurationEditor key={`${doctorId}-${clinicId}-${branchId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} doctorId={doctorId} branchId={branchId} date={date} queue={q}/></fieldset></details><section className="panel table-panel sq-table">{q.entries?.length?<AppointmentRows appointments={q.entries} sessionScoped disabled={freshness.stale||queue.isFetching} selectable selectionKey={JSON.stringify(params)}/>:<div className="empty"><p>{debounced?"No matching queue appointments in this session.":status?"No appointments match this session and status.":"No appointments in this session."}</p>{search&&<button type="button" onClick={()=>setSearch("")} data-testid="button-clear-empty-queue-search">Clear search</button>}</div>}<Pagination page={page} pageSize={pageSize} total={q.entriesTotal??0} onPageChange={setPage} onPageSizeChange={setSize}/></section></>}
 <p className="muted sq-note">Last response {formatConfiguredTimestamp(q.updatedAt,typeof branch.data?.timezone==="string"?branch.data.timezone:undefined,{},q)} · Refresh requested every 30 seconds {queue.isFetching?"· Refreshing…":""}</p>
 </>:null}</div>;
}

function DoctorPresence({identity,doctorId,branchId,date,sessionId,startTime,presence,stale}:{identity:api.Identity;doctorId:string;branchId:string;date:string;sessionId?:string;startTime?:string;presence?:api.DoctorPresence;stale:boolean}){
 const params={branchId,date,sessionId,startTime};const client=useQueryClient();
 const update=api.useUpdateDoctorPresence({mutation:{onSettled:()=>client.invalidateQueries()}});
 const allowed=identity.doctorId===doctorId||["superAdmin","clinicAdmin"].includes(identity.user!.role);
 return <section className="notice"><ErrorNotice error={update.error}/><strong>Doctor status: {presence?title(presence.status):"Unavailable"}</strong>{presence&&presence.status!=="available"&&<p>Automatic calling is paused. A current consultation can still be completed.</p>}{allowed&&<div className="row-actions">{Object.values(api.DoctorPresenceInputStatus).map(status=><button key={status} aria-pressed={presence?.status===status} disabled={stale||update.isPending} onClick={()=>update.mutate({id:doctorId,data:{...params,status}})}>{title(status)}</button>)}</div>}<small>Live presence only — weekly hours and future bookings are unchanged.</small></section>;
}

function DoctorSummary({doctor,branchId,date,selected,onSelect}:{doctor:api.Doctor;branchId:string;date:string;selected:boolean;onSelect:()=>void}){
 const selection=useOperationalSession({doctorId:doctor.id,branchId,date});
 const params={doctorId:doctor.id,branchId,date,sessionId:selection.sessionId||undefined,startTime:selection.startTime,page:1,pageSize:1};
 const q=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled:!!selection.startTime,refetchInterval:30000}});
  return <button className={selected?"button small":"button secondary small"} onClick={onSelect} aria-pressed={selected}>{doctor.fullName}<small>{selection.sessions.length>1?`${selection.sessions.length} sessions · choose a session`:q.error?"Summary unavailable":q.isLoading?"Loading…":`${q.data?.waiting??"—"} waiting · current ${q.data?.currentToken||"—"}`}</small></button>;
}