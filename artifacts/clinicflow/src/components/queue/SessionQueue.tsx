import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CareLookup } from "../CareLookup";
import { FilterBar, Pagination, SearchInput, useDebouncedValue } from "../ListingControls";
import { SearchableSelect } from "../SearchableSelect";
import { ErrorNotice, title, today } from "../../resources";
import { AppointmentRows } from "../appointments/AppointmentRows";
import { DurationEditor } from "./DurationEditor";

export function SessionQueue({identity,initial}:{identity:api.Identity;initial?:api.Appointment}){
 const searchParams=new URLSearchParams(useSearch());
 const [retained]=useState(()=>{try{const value=JSON.parse(sessionStorage.getItem("clinicflow-staff-session")||"null");return identity.user?.role!=="patient"&&value?.staffId===identity.user?.id?value:null;}catch{return null;}});
 const [clinicId,setClinic]=useState(initial?.clinicId||searchParams.get("clinic")||retained?.clinicId||"");const [branchId,setBranch]=useState(initial?.branchId||searchParams.get("branch")||retained?.branchId||"");const [doctorId,setDoctor]=useState(initial?.doctorId||identity.doctorId||searchParams.get("doctor")||retained?.doctorId||"");const [date,setDate]=useState(initial?.date||searchParams.get("date")||retained?.date||today());const [appointmentId,setAppointment]=useState(initial?.id||searchParams.get("appointment")||"");
 const [status,setStatus]=useState("");const [search,setSearch]=useState("");const debounced=useDebouncedValue(search);const [page,setPage]=useState(1);const [pageSize,setSize]=useState(20);const client=useQueryClient();const lock=useRef(false);
 const [showSummary,setShowSummary]=useState(false);
 const isPatient=identity.user?.role==="patient";const root=["superAdmin","clinicAdmin"].includes(identity.user!.role)?"admin":identity.user!.role;
 // Only staff session selectors are retained. Never persist patient IDs, searches,
 // tickets, tokens, queue results, appointment IDs or booking form data.
 useEffect(()=>{if(isPatient)return;try{sessionStorage.setItem("clinicflow-staff-session",JSON.stringify({staffId:identity.user!.id,clinicId,branchId,doctorId,date}));}catch{/* Storage is optional; in-memory selection remains usable. */}},[isPatient,identity.user?.id,clinicId,branchId,doctorId,date]);
 const selected=api.useGetAppointment(appointmentId,{query:{queryKey:api.getGetAppointmentQueryKey(appointmentId),enabled:!!appointmentId}});
 useEffect(()=>{if(selected.data){setClinic(selected.data.clinicId);setBranch(selected.data.branchId);setDoctor(selected.data.doctorId);setDate(selected.data.date);}},[selected.data]);
 useEffect(()=>setPage(1),[doctorId,branchId,date,status,pageSize,debounced]);
 const enabled=!!doctorId&&!!branchId&&(!isPatient||!!appointmentId);
 const params={doctorId,branchId,date,appointmentId:appointmentId||undefined,status:(status||undefined) as api.AppointmentStatus|undefined,page,pageSize};
 const queue=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled,refetchInterval:30000}});
 const next=api.useCallNext({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
 const searchQuery={clinicId:clinicId||undefined,branchId:branchId||undefined,doctorId:doctorId||undefined,from:date,to:date,search:debounced,page,pageSize};
 const found=api.useListAppointments(searchQuery,{query:{queryKey:api.getListAppointmentsQueryKey(searchQuery),enabled:!isPatient&&!!debounced&&!!clinicId,refetchInterval:30000}});
 const doctorsParams={clinicId,branchId,status:"active" as const,page:1,pageSize:20};
 const doctors=api.useListDoctors(doctorsParams,{query:{queryKey:api.getListDoctorsQueryKey(doctorsParams),enabled:showSummary&&!isPatient&&!identity.doctorId&&!!branchId}});
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const on=()=>setOnline(navigator.onLine);window.addEventListener("online",on);window.addEventListener("offline",on);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",on);};},[]);
 const q=queue.data;
 return <div className="session-queue">
 <FilterBar active={!!status} onReset={()=>setStatus("")} advanced={!isPatient&&<SearchableSelect label="Status" value={status} onChange={setStatus} options={Object.values(api.AppointmentStatus).map(value=>({value,label:title(value)}))}/>} chips={status?[{key:"adv:status",label:title(status),onRemove:()=>setStatus("")}]:[]}>
 {isPatient?<CareLookup kind="appointments" label="Your appointment" value={appointmentId} onChange={id=>{setAppointment(id);setDoctor("");setBranch("");}}/>:<>
 <CareLookup kind="clinics" label="Clinic" value={clinicId} onChange={v=>{setClinic(v);setBranch("");setDoctor(identity.doctorId||"");setAppointment("");}}/>
 <CareLookup kind="branches" label="Branch" value={branchId} disabled={!clinicId} params={{clinicId}} onChange={v=>{setBranch(v);setDoctor(identity.doctorId||"");setAppointment("");}}/>
 <CareLookup kind="doctors" label="Doctor" value={doctorId} disabled={!branchId||!!identity.doctorId} params={{clinicId,branchId}} onChange={v=>{setDoctor(v);setAppointment("");}}/>
 <label>Date<input type="date" value={date} onChange={e=>{setDate(e.target.value);setAppointment("");}}/></label></>}
 </FilterBar>
 {!isPatient&&<div className="toolbar sq-toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Find patient, permanent reference or token…"/><Link className="button secondary small" href="/check-in">Scan check-in QR</Link><Link className="button small" href={`/${root}/book?clinic=${clinicId}&branch=${branchId}&doctor=${doctorId}&source=walkIn`}>Register walk-in</Link></div>}
 {!isPatient&&!identity.doctorId&&branchId&&<details className="sq-switch" open={showSummary} onToggle={event=>setShowSummary(event.currentTarget.open)}><summary>Multi-doctor sessions · quick switch</summary>{showSummary&&<><ErrorNotice error={doctors.error}/>{doctors.error&&<button onClick={()=>doctors.refetch()}>Retry doctors</button>}{doctors.isLoading?<p>Loading doctors…</p>:<div className="toolbar">{doctors.data?.items.map(d=><DoctorSummary key={d.id} doctor={d} branchId={branchId} date={date} selected={doctorId===d.id} onSelect={()=>{setDoctor(d.id);setAppointment("");}}/>)}</div>}{(doctors.data?.total??0)>20&&<p>Showing the first 20 doctors; use Doctor search for all results.</p>}</>}</details>}
 <ErrorNotice error={selected.error||queue.error||next.error||found.error}/>
 {queue.error&&<button onClick={()=>queue.refetch()}>Retry queue</button>}
 {(!online||queue.error)&&<p className="notice" role="alert">{!online?"Offline.":"Queue refresh failed."} Live estimates and call controls are unavailable. Refresh after reconnecting.</p>}
 {next.isSuccess&&<p role="status">Patient called. Queue refresh requested.</p>}
 {debounced&&!isPatient?<section className="panel table-panel"><h3>Matching appointments · confirm the exact patient before check-in</h3>{found.isLoading?<p>Searching…</p>:found.error?<button onClick={()=>found.refetch()}>Retry search</button>:found.data?.items.length?<AppointmentRows appointments={found.data.items}/>:<p>No matching appointments for this session.</p>}<Pagination page={page} pageSize={pageSize} total={found.data?.total??0} onPageChange={setPage} onPageSizeChange={setSize}/></section>:null}
 {!enabled?<p className="empty">Select {isPatient?"your appointment":"clinic, branch and doctor"} to view a session.</p>:queue.isLoading?<p role="status">Loading queue…</p>:q&&!queue.error&&online?<>
 <div className="queue-display sq-banner"><div><span className="eyebrow">CURRENT</span><strong>{q.currentToken||"—"}</strong><small>Called / in consultation</small></div><div><span className="eyebrow">NEXT</span><strong>{q.nextToken||"—"}</strong><small>{q.reserved??"—"} reserved · {q.arrived??"—"} arrived · {q.completed} completed</small></div>{!isPatient&&<button className="button light" disabled={next.isPending||queue.isFetching||!!q.currentToken||!q.nextToken||q.blockedByAbsentReservation} onClick={async()=>{if(lock.current)return;lock.current=true;try{await next.mutateAsync({data:{doctorId,branchId,date}});}catch{}finally{lock.current=false;}}}>{next.isPending?"Calling…":"Call next patient"}</button>}</div>
 {q.blockedByAbsentReservation&&<p className="notice">The earliest reservation has not arrived / entered the waiting queue. Staff must check in and enqueue the patient, or explicitly skip them as absent with a reason. Later arrivals do not bypass their reservation.</p>}
 {q.ownEntry&&<p className="notice">Token {q.ownEntry.token} · {title(q.ownEntry.status)} · {q.ownEntry.patientsAhead} patients ahead · Approx. wait {q.ownEntry.estimatedWaitMinutes==null?"unavailable":`${q.ownEntry.estimatedWaitMinutes} minutes`}</p>}
 <p className="muted sq-note">Token is not position. Approx. wait = patients ahead × {q.expectedDurationMinutes??"configured"} minutes, updated by queue events, not a countdown. Breaks, pauses and delays can extend the actual wait; this view does not report a live pause/delay state.</p>
 {!isPatient&&<><details className="sq-duration"><summary>Expected duration settings</summary><DurationEditor key={`${doctorId}-${clinicId}-${branchId}-${date}`} clinicId={clinicId} doctorId={doctorId} branchId={branchId} date={date} queue={q}/></details><section className="panel table-panel sq-table">{q.entries?.length?<AppointmentRows appointments={q.entries}/>:<p className="empty">No appointments match this session and status.</p>}<Pagination page={page} pageSize={pageSize} total={q.entriesTotal??0} onPageChange={setPage} onPageSizeChange={setSize}/></section></>}
 <p className="muted sq-note">Last response {new Date(q.updatedAt).toLocaleString()} · Refresh requested every 30 seconds {queue.isFetching?"· Refreshing…":""}</p>
 </>:null}</div>;
}

function DoctorSummary({doctor,branchId,date,selected,onSelect}:{doctor:api.Doctor;branchId:string;date:string;selected:boolean;onSelect:()=>void}){
 const params={doctorId:doctor.id,branchId,date,page:1,pageSize:1};
 const q=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),refetchInterval:30000}});
 return <button className={selected?"button small":"button secondary small"} onClick={onSelect} aria-pressed={selected}>{doctor.fullName}<small>{q.error?"Summary unavailable":q.isLoading?"Loading…":`${q.data?.reserved??0} reserved · ${q.data?.arrived??0} arrived · current ${q.data?.currentToken||"—"}`}</small></button>;
}