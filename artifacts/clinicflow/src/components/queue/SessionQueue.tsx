import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CareLookup, useSelectedCare } from "../CareLookup";
import { FilterBar, Pagination, SearchInput, useDebouncedValue, listingSuggestions } from "../ListingControls";
import { SearchableSelect } from "../SearchableSelect";
import { ErrorNotice, title, today } from "../../resources";
import { AppointmentRows } from "../appointments/AppointmentRows";
import { DurationEditor } from "./DurationEditor";
import { StatusTabs, statusFilter } from "./StatusTabs";
import { useFreshWorkspace } from "./useFreshWorkspace";
import { useSoleCareDefaults } from "./useSoleCareDefaults";
import { HelpTip } from "../HelpTip";
import { AppDialog } from "../AppDialog";
import { DateFormatInput } from "../DateFormatInput";
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
 const [dateValid,setDateValid]=useState(true);
 const sessionSelection=useOperationalSession({doctorId,branchId,date,initialSessionId:initial?.sessionId||searchParams.get("sessionId")||retained?.sessionId,initialStartTime:initial?.startTime||searchParams.get("startTime")||retained?.startTime,enabled:!isPatient&&dateValid});
 const sessionId=appointmentId&&selected.data?selected.data.sessionId||undefined:sessionSelection.sessionId||undefined;
 const startTime=appointmentId&&selected.data?selected.data.startTime:sessionSelection.availability.data?.startTime||undefined;
 useEffect(()=>{if(isPatient)return;try{sessionStorage.setItem("clinicflow-staff-session",JSON.stringify({staffId:identity.user!.id,clinicId,branchId,doctorId,date,sessionId,startTime}));}catch{/* Storage is optional; in-memory selection remains usable. */}},[isPatient,identity.user?.id,clinicId,branchId,doctorId,date,sessionId,startTime]);
 useEffect(()=>setPage(1),[doctorId,branchId,date,sessionId,startTime,status,pageSize,debounced,sort]);
 // Typed-but-invalid date text pauses session and queue fetching instead of silently using the previous date.
 const enabled=dateValid&&!!doctorId&&!!branchId&&!!(sessionId||startTime)&&(!isPatient||!!appointmentId);
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
 <div className="panel-heading section-head"><div><h2>Session</h2><p>Select the clinic, doctor and consulting session to run this queue.</p></div></div>
 <div className="form-grid">
 {isPatient?<CareLookup kind="appointments" label="Your Appointment" value={appointmentId} onChange={id=>{setAppointment(id);setDoctor("");setBranch("");}}/>:<>
 <CareLookup kind="clinics" label="Clinic" value={clinicId} onChange={v=>{setClinic(v);setBranch("");setDoctor(restrictedDoctorId);setAppointment("");}}/>
  <CareLookup kind="branches" label="Location" value={branchId} disabled={!clinicId} params={{clinicId}} onChange={v=>{setBranch(v);setDoctor(restrictedDoctorId);setAppointment("");}}/>
 <CareLookup kind="doctors" label="Doctor" value={doctorId} disabled={!branchId||isDoctor} params={{clinicId,branchId}} onChange={v=>{setDoctor(v);setAppointment("");}}/>
 <label>Date<DateFormatInput required data-testid="input-queue-date" value={date} onValidityChange={setDateValid} onChange={value=>{if(value){setDate(value);setAppointment("");}}}/></label></>}
 {!isPatient&&<OperationalSessionSelector selection={{...sessionSelection,setSelectionKey:key=>{sessionSelection.setSelectionKey(key);setAppointment("");}}}/>}
 </div></section>
 {["receptionist","clinicAdmin","superAdmin"].includes(identity.user!.role)&&enabled&&<GuestRequests key={`${clinicId}-${branchId}-${doctorId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} branchId={branchId} doctorId={doctorId} date={date} sessionId={sessionId} startTime={startTime}/>}
  {branch.data&&<div className="sq-context" data-testid="text-queue-context"><strong>{String(branch.data.name||"Selected branch")}</strong><span className="muted"> · {formatDate(date,q)}</span>{branch.data.address?<HelpTip label="Location Address" text={String(branch.data.address)}/>:null}</div>}
  {!isPatient&&<FilterBar status={<StatusTabs value={status} onChange={setStatus} counts={(q as typeof q&{statusCounts?:Record<string,number>})?.statusCounts}/>} label="Queue Search and Actions" chips={filterChips} meta={<><SearchableSelect label="Sort Queue Listing" value={sort} onChange={value=>{if(value)setSort(value);}} options={Object.entries(sortLabels).map(([value,label])=>({value,label}))}/>{listFiltered&&<HelpTip text="Clear all resets search, status and sorting while keeping the selected clinic, doctor, date, session and page size."><button type="button" onClick={clearListFilters} data-testid="button-clear-queue-filters">Clear All</button></HelpTip>}</>} actions={<>{!isPatient&&!isDoctor&&branchId&&<button type="button" className="button secondary small" aria-haspopup="dialog" onClick={()=>setShowSummary(true)} data-testid="button-queue-quick-switch">Quick Switch</button>}<Link className="button secondary small" href="/check-in">Validate Appointment QR</Link>{sessionSelection.snapshotOnly?<span className="badge">Historical session · no new bookings</span>:enabled&&<Link className="button small" href={`/${root}/book?clinic=${encodeURIComponent(clinicId)}&branch=${encodeURIComponent(branchId)}&doctor=${encodeURIComponent(doctorId)}&sessionId=${encodeURIComponent(sessionId||"")}&source=walkIn`}>Register Walk-In</Link>}</>}><SearchInput value={search} onChange={setSearch} placeholder="Search queue…" label="Search This Session" suggestions={queue.error?[]:listingSuggestions(q?.entries,a=>({id:a.id,label:a.patientName,description:a.tokenNumber!=null?`Token ${a.tokenNumber}`:undefined,value:a.reference}))} loading={queue.isFetching} error={queue.error?"Unable to load this session queue.":null} onRetry={()=>void queue.refetch()} total={q?.total} settledQuery={debounced} scopeKey={JSON.stringify({doctorId,branchId,date,sessionId,startTime,status,sort,pageSize})}/></FilterBar>}

  {!isPatient&&!isDoctor&&branchId&&showSummary&&<AppDialog open variant="drawer" onClose={()=>setShowSummary(false)} title="Multi-doctor sessions · quick switch"><p className="muted">Each doctor's queue at this location and date. Choose a doctor, then a session if more than one is listed. Switching does not call or check in a patient.</p><ErrorNotice error={doctors.error}/>{doctors.error&&<button onClick={()=>doctors.refetch()}>Retry Doctors</button>}{doctors.isLoading?<p>Loading doctors…</p>:<div className="toolbar">{doctors.data?.items.map(d=><DoctorSummary key={d.id} doctor={d} branchId={branchId} date={date} selected={doctorId===d.id} onSelect={()=>{setDoctor(d.id);setAppointment("");setShowSummary(false);}}/>)}</div>}{(doctors.data?.total??0)>20&&<p>Showing the first 20 doctors; use Doctor search for all results.</p>}</AppDialog>}
 <ErrorNotice error={selected.error||queue.error||next.error}/>
  {!isPatient&&sort!=="queueRank"&&<p className="muted sq-sort-note">Sorting the list does not change who is called next.</p>}

 {callPreview?.scope===callScope&&<p className="notice" role="status" aria-live="polite">Requesting call for token {callPreview.token}… awaiting server confirmation. This does not start consultation.</p>}
 {selected.error&&<button data-testid="button-retry-queue-appointment" onClick={()=>selected.refetch()}>Retry Selected Appointment</button>}
 {queue.error&&<button onClick={()=>queue.refetch()}>Retry Queue</button>}
  {enabled&&freshness.stale&&<p className="notice" role="alert">{!online?"Offline.":"Queue data is stale or unavailable."} Mutations are disabled. Refresh after reconnecting. <button onClick={()=>queue.refetch()}>Refresh</button></p>}

 {next.isSuccess&&lastCallScope===callScope&&<p role="status">{next.data?.appointment?"Patient called. Latest queue requested.":"No eligible patient was called. Latest queue requested."}</p>}
  {!dateValid&&!isPatient?<p className="empty" role="status" data-testid="text-queue-date-invalid">Correct the date to load the session queue.</p>:!enabled?<p className="empty">Select {isPatient?"your appointment":"clinic, location, doctor and session"} to view a session.</p>:queue.isLoading?<p role="status">Loading queue…</p>:q?<>
  <div className="sq-summary"><div><small>Current Token</small><strong>{q.currentToken||"—"}</strong><small>{q.currentToken?(q.inConsultation>0?"In Consultation":"Called Next"):"No Patient Called"}</small></div><div><small>Next Waiting Token</small><strong>{q.nextToken||"—"}</strong><HelpTip text="Checkout calls the next patient. Only explicit staff check-in begins consultation."/></div><div><small>Waiting</small><strong>{q.waiting??"—"}</strong></div><div><small>Completed</small><strong>{q.completed??"—"}</strong></div><div><small>Session Total</small><strong>{q.total??"—"}</strong><small>Whole session</small></div></div>
  <DoctorPresence identity={identity} doctorId={doctorId} branchId={branchId} date={date} sessionId={sessionId} startTime={startTime} presence={q.presence} stale={freshness.stale}/>
   {!isPatient&&<button className="button" disabled={freshness.stale||q.presence?.status!=="available"||next.isPending||queue.isFetching||!!q.currentToken||!q.nextToken||q.blockedByAbsentReservation} onClick={async()=>{if(lock.current)return;lock.current=true;setCallPreview({scope:callScope,token:q.nextToken||""});try{await next.mutateAsync({data:{doctorId,branchId,date,sessionId,startTime}});}catch{/* Authoritative error stays visible; discard the pending preview. */}finally{setCallPreview(null);lock.current=false;}}}>{next.isPending?"Calling…":"Call Next Patient"}</button>}
  {q.blockedByAbsentReservation&&<p className="notice">The earliest reservation needs staff review. Confirm consultation check-in or explicitly skip an absent patient with a reason.</p>}
  {q.ownEntry&&<p className="notice">Token {q.ownEntry.token} · {q.ownEntry.status==="called"?"Called next":["booked","checkedIn","waiting"].includes(q.ownEntry.status)?"Waiting":title(q.ownEntry.status)} · {q.ownEntry.patientsAhead} patients ahead · Approx. queue wait {q.ownEntry.estimatedWaitMinutes==null?"unavailable":`${q.ownEntry.estimatedWaitMinutes} minutes`}</p>}
<span className="sq-note-details"><HelpTip label="How Waits Are Estimated" text={`Token is not position. Approx. wait = patients ahead × ${q.expectedDurationMinutes??"configured"} minutes, updated by queue events, not a countdown. Breaks, pauses and delays can extend the actual wait. Expected duration is separate from actual average consultation time.`}/></span>
   {!isPatient&&<><fieldset className="sq-duration" disabled={freshness.stale}><DurationEditor key={`${doctorId}-${clinicId}-${branchId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} doctorId={doctorId} branchId={branchId} date={date} queue={q}/></fieldset><section className="panel table-panel sq-table">{q.entries?.length?<AppointmentRows appointments={q.entries} serialOffset={(page-1)*pageSize} sessionScoped disabled={freshness.stale||queue.isFetching} selectable selectionKey={JSON.stringify(params)}/>:<div className="empty"><p>{debounced?"No matching queue appointments in this session.":status?"No appointments match this session and status.":"No appointments in this session."}</p>{search&&<button type="button" onClick={()=>setSearch("")} data-testid="button-clear-empty-queue-search">Clear Search</button>}</div>}<Pagination page={page} pageSize={pageSize} total={q.entriesTotal??0} onPageChange={setPage} onPageSizeChange={setSize}/></section></>}
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