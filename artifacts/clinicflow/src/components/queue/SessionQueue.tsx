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

export function SessionQueue({identity,initial}:{identity:api.Identity;initial?:api.Appointment}){
 const searchParams=new URLSearchParams(useSearch());
 const {isDoctor,doctorId:restrictedDoctorId}=doctorWorkspaceScope(identity);
 const [retained]=useState(()=>{try{const value=JSON.parse(sessionStorage.getItem("clinicflow-staff-session")||"null");return identity.user?.role!=="patient"&&value?.staffId===identity.user?.id?value:null;}catch{return null;}});
 const [clinicId,setClinic]=useState(initial?.clinicId||searchParams.get("clinic")||retained?.clinicId||"");const [branchId,setBranch]=useState(initial?.branchId||searchParams.get("branch")||retained?.branchId||"");const [doctorId,setDoctor]=useState(restrictedDoctorId||initial?.doctorId||searchParams.get("doctor")||retained?.doctorId||"");const [date,setDate]=useState(initial?.date||searchParams.get("date")||retained?.date||today());const [appointmentId,setAppointment]=useState(initial?.id||searchParams.get("appointment")||"");
 const [status,setStatus]=useState("");const [search,setSearch]=useState("");const debounced=useDebouncedValue(search);const [page,setPage]=useState(1);const [pageSize,setSize]=useState(20);const client=useQueryClient();const lock=useRef(false);
 const [showSummary,setShowSummary]=useState(false);
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
 useEffect(()=>setPage(1),[doctorId,branchId,date,sessionId,startTime,status,pageSize,debounced]);
 const enabled=!!doctorId&&!!branchId&&!!(sessionId||startTime)&&(!isPatient||!!appointmentId);
  const params={doctorId,branchId,date,sessionId,startTime,appointmentId:appointmentId||undefined,...statusFilter(status),page,pageSize};
 const queue=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled,refetchInterval:30000}});
 const next=api.useCallNext({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
  const searchQuery:api.ListAppointmentsParams={clinicId:clinicId||undefined,branchId:branchId||undefined,doctorId:doctorId||undefined,sessionId:startTime?undefined:sessionId,startTime,from:date,to:date,search:debounced,...statusFilter(status),page,pageSize};
 const found=api.useListAppointments(searchQuery,{query:{queryKey:api.getListAppointmentsQueryKey(searchQuery),enabled:!isPatient&&!!debounced&&enabled,refetchInterval:30000}});
 const doctorsParams={clinicId,branchId,status:"active" as const,page:1,pageSize:20};
 const doctors=api.useListDoctors(doctorsParams,{query:{queryKey:api.getListDoctorsQueryKey(doctorsParams),enabled:showSummary&&!isPatient&&!isDoctor&&!!branchId,refetchInterval:30000,refetchIntervalInBackground:false}});
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const on=()=>setOnline(navigator.onLine);window.addEventListener("online",on);window.addEventListener("offline",on);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",on);};},[]);
 const q=queue.data;
  const freshness=useFreshWorkspace(queue.dataUpdatedAt,!!queue.error);
  const branch=useSelectedCare("branches",branchId,isPatient,{clinicId});
 return <div className="session-queue">
 <FilterBar active={!!status} onReset={()=>setStatus("")} advanced={!isPatient&&<SearchableSelect label="Status" value={status} onChange={setStatus} options={Object.values(api.AppointmentStatus).map(value=>({value,label:title(value)}))}/>} chips={status?[{key:"adv:status",label:title(status),onRemove:()=>setStatus("")}]:[]}>
 {isPatient?<CareLookup kind="appointments" label="Your appointment" value={appointmentId} onChange={id=>{setAppointment(id);setDoctor("");setBranch("");}}/>:<>
 <CareLookup kind="clinics" label="Clinic" value={clinicId} onChange={v=>{setClinic(v);setBranch("");setDoctor(restrictedDoctorId);setAppointment("");}}/>
  <CareLookup kind="branches" label="Location" value={branchId} disabled={!clinicId} params={{clinicId}} onChange={v=>{setBranch(v);setDoctor(restrictedDoctorId);setAppointment("");}}/>
 <CareLookup kind="doctors" label="Doctor" value={doctorId} disabled={!branchId||isDoctor} params={{clinicId,branchId}} onChange={v=>{setDoctor(v);setAppointment("");}}/>
 <label>Date<input type="date" value={date} onChange={e=>{setDate(e.target.value);setAppointment("");}}/></label></>}
 {!isPatient&&<OperationalSessionSelector selection={{...sessionSelection,setSelectionKey:key=>{sessionSelection.setSelectionKey(key);setAppointment("");}}}/>}
 </FilterBar>
 {["receptionist","clinicAdmin","superAdmin"].includes(identity.user!.role)&&enabled&&<GuestRequests key={`${clinicId}-${branchId}-${doctorId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} branchId={branchId} doctorId={doctorId} date={date} sessionId={sessionId} startTime={startTime}/>}
  {branch.data&&<div className="sq-context"><strong>{String(branch.data.name||"Selected branch")}</strong><p>{String(branch.data.address||"Address not provided")} · {date}</p></div>}
  {!isPatient&&<StatusTabs value={status} onChange={setStatus} counts={(q as typeof q&{statusCounts?:Record<string,number>})?.statusCounts||(q?{waiting:q.waiting,completed:q.completed,absent:q.noShow,all:q.total}:undefined)}/>}
   {!isPatient&&<div className="toolbar sq-toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Find patient, permanent reference or token…"/><Link className="button secondary small" href="/check-in">Validate appointment QR</Link>{sessionSelection.snapshotOnly?<button disabled>Historical session · no new bookings</button>:enabled&&<Link className="button small" href={`/${root}/book?clinic=${encodeURIComponent(clinicId)}&branch=${encodeURIComponent(branchId)}&doctor=${encodeURIComponent(doctorId)}&sessionId=${encodeURIComponent(sessionId||"")}&source=walkIn`}>Register walk-in</Link>}</div>}
  {!isPatient&&!isDoctor&&branchId&&<details className="sq-switch" open={showSummary} onToggle={event=>setShowSummary(event.currentTarget.open)}><summary>Multi-doctor sessions · quick switch</summary>{showSummary&&<><ErrorNotice error={doctors.error}/>{doctors.error&&<button onClick={()=>doctors.refetch()}>Retry doctors</button>}{doctors.isLoading?<p>Loading doctors…</p>:<div className="toolbar">{doctors.data?.items.map(d=><DoctorSummary key={d.id} doctor={d} branchId={branchId} date={date} selected={doctorId===d.id} onSelect={()=>{setDoctor(d.id);setAppointment("");}}/>)}</div>}{(doctors.data?.total??0)>20&&<p>Showing the first 20 doctors; use Doctor search for all results.</p>}</>}</details>}
 <ErrorNotice error={selected.error||queue.error||next.error||found.error}/>
 {selected.error&&<button data-testid="button-retry-queue-appointment" onClick={()=>selected.refetch()}>Retry selected appointment</button>}
 {queue.error&&<button onClick={()=>queue.refetch()}>Retry queue</button>}
  {enabled&&freshness.stale&&<p className="notice" role="alert">{!online?"Offline.":"Queue data is stale or unavailable."} Mutations are disabled. Refresh after reconnecting. <button onClick={()=>queue.refetch()}>Refresh</button></p>}
  {queue.dataUpdatedAt>0&&<p className="muted">Last successful update {new Date(queue.dataUpdatedAt).toLocaleString()}</p>}
 {next.isSuccess&&<p role="status">Patient called. Queue refresh requested.</p>}
   {debounced&&!isPatient?<section className="panel table-panel"><h3>Matching appointments · confirm the exact patient before check-in</h3>{found.isLoading?<p>Searching…</p>:found.data?.items.length?<AppointmentRows appointments={found.data.items} disabled={freshness.stale||!!found.error||found.isFetching} selectable selectionKey={JSON.stringify(searchQuery)}/>:found.error?<button onClick={()=>found.refetch()}>Retry search</button>:<p>No matching appointments for this session.</p>}<Pagination page={page} pageSize={pageSize} total={found.data?.total??0} onPageChange={setPage} onPageSizeChange={setSize}/></section>:null}
  {!enabled?<p className="empty">Select {isPatient?"your appointment":"clinic, location, doctor and session"} to view a session.</p>:queue.isLoading?<p role="status">Loading queue…</p>:q?<>
  <div className="sq-summary"><div><small>CURRENT TOKEN</small><strong>{q.currentToken||"—"}</strong><small>{q.currentToken?(q.inConsultation>0?"In consultation":"Called next"):"No patient called"}</small></div><div><small>NEXT WAITING TOKEN</small><strong>{q.nextToken||"—"}</strong><HelpTip text="Checkout calls the next patient. Only explicit staff check-in begins consultation."/></div><div><small>WAITING</small><strong>{q.waiting??"—"}</strong></div><div><small>COMPLETED</small><strong>{q.completed??"—"}</strong></div></div>
  <DoctorPresence identity={identity} doctorId={doctorId} branchId={branchId} date={date} sessionId={sessionId} startTime={startTime} presence={q.presence} stale={freshness.stale}/>
   {!isPatient&&<button className="button" disabled={freshness.stale||q.presence?.status!=="available"||next.isPending||queue.isFetching||!!q.currentToken||!q.nextToken||q.blockedByAbsentReservation} onClick={async()=>{if(lock.current)return;lock.current=true;try{await next.mutateAsync({data:{doctorId,branchId,date,sessionId,startTime}});}catch{}finally{lock.current=false;}}}>{next.isPending?"Calling…":"Call next patient"}</button>}
  {q.blockedByAbsentReservation&&<p className="notice">The earliest reservation needs staff review. Confirm consultation check-in or explicitly skip an absent patient with a reason.</p>}
  {q.ownEntry&&<p className="notice">Token {q.ownEntry.token} · {q.ownEntry.status==="called"?"Called next":["booked","checkedIn","waiting"].includes(q.ownEntry.status)?"Waiting":title(q.ownEntry.status)} · {q.ownEntry.patientsAhead} patients ahead · Approx. queue wait {q.ownEntry.estimatedWaitMinutes==null?"unavailable":`${q.ownEntry.estimatedWaitMinutes} minutes`}</p>}
 <p className="muted sq-note">Token is not position. Approx. wait = patients ahead × {q.expectedDurationMinutes??"configured"} minutes, updated by queue events, not a countdown. Breaks, pauses and delays can extend the actual wait. Expected duration is separate from actual average consultation time.</p>
  {!isPatient&&<><details className="sq-duration"><summary>Expected duration settings</summary><fieldset disabled={freshness.stale}><DurationEditor key={`${doctorId}-${clinicId}-${branchId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} doctorId={doctorId} branchId={branchId} date={date} queue={q}/></fieldset></details><section className="panel table-panel sq-table">{q.entries?.length?<AppointmentRows appointments={q.entries} disabled={freshness.stale||queue.isFetching} selectable selectionKey={JSON.stringify(params)}/>:<p className="empty">No appointments match this session and status.</p>}<Pagination page={page} pageSize={pageSize} total={q.entriesTotal??0} onPageChange={setPage} onPageSizeChange={setSize}/></section></>}
 <p className="muted sq-note">Last response {new Date(q.updatedAt).toLocaleString()} · Refresh requested every 30 seconds {queue.isFetching?"· Refreshing…":""}</p>
 </>:null}</div>;
}

function DoctorPresence({identity,doctorId,branchId,date,sessionId,startTime,presence,stale}:{identity:api.Identity;doctorId:string;branchId:string;date:string;sessionId?:string;startTime?:string;presence?:api.DoctorPresence;stale:boolean}){
 const params={branchId,date,sessionId,startTime};const client=useQueryClient();
 const update=api.useUpdateDoctorPresence({mutation:{onSuccess:()=>client.invalidateQueries()}});
 const allowed=identity.doctorId===doctorId||["superAdmin","clinicAdmin"].includes(identity.user!.role);
 return <section className="notice"><ErrorNotice error={update.error}/><strong>Doctor status: {presence?title(presence.status):"Unavailable"}</strong>{presence&&presence.status!=="available"&&<p>Automatic calling is paused. A current consultation can still be completed.</p>}{allowed&&<div className="row-actions">{Object.values(api.DoctorPresenceInputStatus).map(status=><button key={status} aria-pressed={presence?.status===status} disabled={stale||update.isPending} onClick={()=>update.mutate({id:doctorId,data:{...params,status}})}>{title(status)}</button>)}</div>}<small>Live presence only — weekly hours and future bookings are unchanged.</small></section>;
}

function DoctorSummary({doctor,branchId,date,selected,onSelect}:{doctor:api.Doctor;branchId:string;date:string;selected:boolean;onSelect:()=>void}){
 const selection=useOperationalSession({doctorId:doctor.id,branchId,date});
 const params={doctorId:doctor.id,branchId,date,sessionId:selection.sessionId||undefined,startTime:selection.startTime,page:1,pageSize:1};
 const q=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled:!!selection.startTime,refetchInterval:30000}});
  return <button className={selected?"button small":"button secondary small"} onClick={onSelect} aria-pressed={selected}>{doctor.fullName}<small>{selection.sessions.length>1?`${selection.sessions.length} sessions · choose a session`:q.error?"Summary unavailable":q.isLoading?"Loading…":`${q.data?.waiting??"—"} waiting · current ${q.data?.currentToken||"—"}`}</small></button>;
}