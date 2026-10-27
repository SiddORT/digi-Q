import { usePageSizeState } from "../../lib/page-size-preference";
import { ArrivalGuidance } from "../tickets/ArrivalGuidance";
import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { useWorkspaceBranch, usePinnedCare } from "../WorkspaceBranch";
import { useQueryClient } from "@tanstack/react-query";
import { CareLookup, useSelectedCare } from "../CareLookup";
import { Pagination, SearchInput, FilterBar, ListingRegion, PageHeader, useDebouncedValue, listingSuggestions } from "../ListingControls";
import { SearchableSelect } from "../SearchableSelect";
import { ErrorNotice, title, today } from "../../resources";
import { AppointmentRows } from "../appointments/AppointmentRows";
import { DurationEditor } from "./DurationEditor";
import { StatusTabs, statusFilter } from "./StatusTabs";
import { useFreshWorkspace } from "./useFreshWorkspace";
import { useSoleCareDefaults } from "./useSoleCareDefaults";
import { HelpTip } from "../HelpTip";
import { openQrInline } from "../../lib/qr-inline";
import { DateFormatInput } from "../DateFormatInput";
import { GuestRequests } from "./GuestRequests";
import { OperationalSessionSelector, useOperationalSession } from "./SessionSelector";
import { doctorWorkspaceScope } from "./session-scope";
import { formatDate, formatConfiguredTimestamp } from "../../lib/date-time";
import { QrCode, ArrowLeftRight, ScanLine, UserPlus } from "lucide-react";
import "./queue-workspace.css";

export function SessionQueue({identity,initial}:{identity:api.Identity;initial?:api.Appointment}){
 const queuePin=useWorkspaceBranch();
 const searchParams=new URLSearchParams(useSearch());
 const {isDoctor,doctorId:restrictedDoctorId}=doctorWorkspaceScope(identity);
 // Explicit URLs drive the session; the last session is never restored automatically (see QueueOverview "Resume").
 const retained=null as null|{clinicId?:string;branchId?:string;doctorId?:string;date?:string;sessionId?:string;startTime?:string};
 const queueUrlStale=!!queuePin&&!!searchParams.get("branch")&&searchParams.get("branch")!==queuePin.branchId;const [clinicId,setClinic]=useState(queuePin?.clinicId||initial?.clinicId||searchParams.get("clinic")||retained?.clinicId||"");const [branchId,setBranch]=useState(queuePin?.branchId||initial?.branchId||searchParams.get("branch")||retained?.branchId||"");const [doctorId,setDoctor]=useState(restrictedDoctorId||(initial&&(!queuePin||initial.branchId===queuePin.branchId)?initial.doctorId:"")||(queueUrlStale?"":searchParams.get("doctor"))||retained?.doctorId||"");const [date,setDate]=useState(initial?.date||searchParams.get("date")||retained?.date||today());const [appointmentId,setAppointment]=useState(initial?.id||searchParams.get("appointment")||"");
 const [status,setStatus]=useState("");const [search,setSearch]=useState("");const debounced=useDebouncedValue(search);const [page,setPage]=useState(1);const [pageSize,setSize]=usePageSizeState(20);const client=useQueryClient();const lock=useRef(false);
  const autoDate=useRef(!initial?.id&&!initial?.date&&!searchParams.get("appointment")&&!searchParams.get("date")&&!retained?.date);
 const [callPreview,setCallPreview]=useState<{scope:string;token:string}|null>(null);
 const [sort,setSort]=useState("queueRank");
 const isPatient=identity.user?.role==="patient";const root=["superAdmin","clinicAdmin"].includes(identity.user!.role)?"admin":identity.user!.role;
  usePinnedCare(clinicId,branchId,setClinic,setBranch);
  useSoleCareDefaults({enabled:!isPatient,clinicId,branchId,doctorId,setClinic,setBranch,setDoctor});
 // Only staff session selectors are retained. Never persist patient IDs, searches,
 // tickets, tokens, queue results, appointment IDs or booking form data.
 const selected=api.useGetAppointment(appointmentId,{query:{queryKey:api.getGetAppointmentQueryKey(appointmentId),enabled:!!appointmentId}});
  useEffect(()=>{if(selected.data){autoDate.current=false;setClinic(selected.data.clinicId);setBranch(selected.data.branchId);setDoctor(selected.data.doctorId);setDate(selected.data.date);}},[selected.data]);
  const [dateValid,setDateValid]=useState(true);
 const sessionSelection=useOperationalSession({doctorId,branchId,date,initialSessionId:initial?.sessionId||searchParams.get("sessionId")||retained?.sessionId,initialStartTime:initial?.startTime||searchParams.get("startTime")||retained?.startTime,enabled:!isPatient&&dateValid});
  const sessionId=appointmentId&&selected.data?selected.data.sessionId||undefined:sessionSelection.sessionId||undefined;
 const startTime=appointmentId&&selected.data?selected.data.startTime:sessionSelection.availability.data?.startTime||undefined;
 useEffect(()=>{if(isPatient)return;try{sessionStorage.setItem("clinicflow-staff-session",JSON.stringify({staffId:identity.user!.id,clinicId,branchId,doctorId,date,sessionId,startTime}));}catch{/* Storage is optional; in-memory selection remains usable. */}},[isPatient,identity.user?.id,clinicId,branchId,doctorId,date,sessionId,startTime]);
 useEffect(()=>setPage(1),[doctorId,branchId,date,sessionId,startTime,status,pageSize,debounced,sort]);
 // Typed-but-invalid date text pauses session and queue fetching instead of silently using the previous date.
  const scopeReady=!queuePin||(clinicId===queuePin.clinicId&&branchId===queuePin.branchId);
  const enabled=scopeReady&&dateValid&&!!doctorId&&!!branchId&&!!(sessionId||startTime)&&(!isPatient||!!appointmentId);
  // Search the authoritative session list instead of rendering the same
  // appointments in a second "matching appointments" table.
  const params={doctorId,branchId,date,sessionId,startTime,appointmentId:appointmentId||undefined,search:!isPatient?debounced||undefined:undefined,sort:!isPatient?sort:undefined,...statusFilter(status),page,pageSize};
 const queue=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled,refetchInterval:30000}});
 const next=api.useCallNext({mutation:{onSuccess:()=>client.invalidateQueries(),onError:()=>client.invalidateQueries()}});
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const on=()=>setOnline(navigator.onLine);window.addEventListener("online",on);window.addEventListener("offline",on);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",on);};},[]);
 const q=queue.data;
 const callScope=JSON.stringify([doctorId,branchId,date,sessionId,startTime]);
 const lastCall=next.variables?.data;
 const lastCallScope=lastCall?JSON.stringify([lastCall.doctorId,lastCall.branchId,lastCall.date,lastCall.sessionId,lastCall.startTime]):null;
  const freshness=useFreshWorkspace(queue.dataUpdatedAt,!!queue.error);
  const branch=useSelectedCare("branches",branchId,isPatient,{clinicId});
  useEffect(()=>{if(autoDate.current&&!appointmentId&&!selected.data&&typeof branch.data?.timezone==="string"){autoDate.current=false;setDate(today(branch.data.timezone));}},[branch.data?.timezone,appointmentId,selected.data]);
 const listFiltered=!!search||!!status||sort!=="queueRank";
 const sortLabels:Record<string,string>={queueRank:"Queue position",tokenNumber:"Token ascending","-tokenNumber":"Token descending",status:"Status","-createdAt":"Newest bookings"};
 const clearListFilters=()=>{setSearch("");setStatus("");setSort("queueRank");setPage(1);};
  const locationName=queuePin?.name||String(branch.data?.name||"selected location");
  // Booking QR opens the existing QR list narrowed to this session's exact clinic and location.
  const qrScope=[clinicId&&`clinicId=${encodeURIComponent(clinicId)}`,branchId&&`branchId=${encodeURIComponent(branchId)}`].filter(Boolean).join("&");
  const bookingQrHref=root==="doctor"?`/doctor/clinics?area=qrs${qrScope?`&${qrScope}`:""}`:`/${root==="receptionist"?"receptionist":"admin"}/qrs${qrScope?`?${qrScope}`:""}`;
  const otherSessionsHref=`/${root}/queue?view=sessions&${[clinicId&&`clinic=${encodeURIComponent(clinicId)}`,branchId&&`branch=${encodeURIComponent(branchId)}`,date&&`date=${encodeURIComponent(date)}`].filter(Boolean).join("&")}`;
  const listControls=!isPatient&&<FilterBar title={<h2>Session Appointments</h2>} label="Queue Search and Actions">
   <SearchInput value={search} onChange={setSearch} placeholder="Search queue…" label="Search This Session" suggestions={queue.error?[]:listingSuggestions(q?.entries,a=>({id:a.id,label:a.patientName,description:a.tokenNumber!=null?`Token ${a.tokenNumber}`:undefined,value:a.reference}))} loading={queue.isFetching} error={queue.error?"Unable to load this session queue.":null} onRetry={()=>void queue.refetch()} total={q?.entriesTotal} settledQuery={debounced} scopeKey={JSON.stringify({doctorId,branchId,date,sessionId,startTime,status,sort,pageSize})}/>
   <StatusTabs value={status} onChange={setStatus} counts={debounced||!q?undefined:{...(q as typeof q&{statusCounts?:Record<string,number>}).statusCounts,inConsultation:q.inConsultation}}/>
   <div className="sq-list-sort"><SearchableSelect label="Sort Queue Listing" value={sort} onChange={value=>{if(value)setSort(value);}} options={Object.entries(sortLabels).map(([value,label])=>({value,label}))}/>{listFiltered&&<HelpTip text="Clear all resets search, status and sorting while keeping the selected doctor, date, session and page size."><button type="button" onClick={clearListFilters} data-testid="button-clear-queue-filters">Clear All</button></HelpTip>}</div>
  </FilterBar>;
 return <div className="session-queue">
  <PageHeader title="Queue" description={<p>Live queue for {locationName} · Updated every 30 seconds</p>} actions={!isPatient&&<><Link className="button secondary small" href={bookingQrHref} data-testid="link-queue-booking-qr"><QrCode size={15} aria-hidden/> Booking QR</Link>{!isDoctor&&branchId&&<Link className="button secondary small" href={otherSessionsHref} data-testid="link-queue-other-sessions"><ArrowLeftRight size={15} aria-hidden/> Other sessions here</Link>}<button type="button" className="button secondary small" aria-label="Validate Appointment QR" onClick={openQrInline} data-testid="button-validate-qr"><ScanLine size={15} aria-hidden/> Validate QR</button>{sessionSelection.snapshotOnly?<span className="badge">Historical session · no new bookings</span>:enabled&&<Link className="button small" href={`/${root}/book?clinic=${encodeURIComponent(clinicId)}&branch=${encodeURIComponent(branchId)}&doctor=${encodeURIComponent(doctorId)}&sessionId=${encodeURIComponent(sessionId||"")}&source=walkIn`}><UserPlus size={15} aria-hidden/> Register Walk-In</Link>}</>}/>
 <section className="panel padded sq-session-scope" aria-label="Selected queue session">
  <div className="sq-session-fields">
 {isPatient?<CareLookup kind="appointments" label="Your Appointment" value={appointmentId} onChange={id=>{autoDate.current=false;setAppointment(id);setDoctor("");setBranch("");}}/>:<>
  {!queuePin&&<><CareLookup kind="clinics" label="Clinic" value={clinicId} onChange={v=>{setClinic(v);setBranch("");setDoctor(restrictedDoctorId);setAppointment("");}}/><CareLookup kind="branches" label="Location" value={branchId} disabled={!clinicId} params={{clinicId}} onChange={v=>{setBranch(v);setDoctor(restrictedDoctorId);setAppointment("");}}/></>}
 <CareLookup kind="doctors" label="Doctor" value={doctorId} disabled={!branchId||isDoctor} params={{clinicId,branchId}} onChange={v=>{setDoctor(v);setAppointment("");}}/>
  <label>Date<DateFormatInput required data-testid="input-queue-date" value={date} onValidityChange={setDateValid} onChange={value=>{if(value){autoDate.current=false;setDate(value);setAppointment("");}}}/></label></>}
 {!isPatient&&<OperationalSessionSelector selection={{...sessionSelection,setSelectionKey:key=>{sessionSelection.setSelectionKey(key);setAppointment("");}}}/>}
 </div></section>
   {!queuePin&&branch.data&&<div className="sq-context" data-testid="text-queue-context"><strong>{String(branch.data.name||"Selected branch")}</strong><span className="muted"> · {formatDate(date,q)}</span>{branch.data.address?<span className="muted"> · {String(branch.data.address)}</span>:null}</div>}

 <ErrorNotice error={selected.error||queue.error||next.error}/>
  {!isPatient&&sort!=="queueRank"&&<p className="muted sq-sort-note">Sorting the list does not change who is called next.</p>}

 {callPreview?.scope===callScope&&<p className="notice" role="status" aria-live="polite">Requesting call for token {callPreview.token}… awaiting server confirmation. This does not start consultation.</p>}
 {selected.error&&<button type="button" data-testid="button-retry-queue-appointment" onClick={()=>selected.refetch()}>Retry Selected Appointment</button>}
 {queue.error&&<button type="button" onClick={()=>queue.refetch()}>Retry Queue</button>}
  {enabled&&freshness.stale&&<p className="notice" role="alert">{!online?"Offline.":"Queue data is stale or unavailable."} Mutations are disabled. Refresh after reconnecting. <button type="button" onClick={()=>queue.refetch()}>Refresh</button></p>}

 {next.isSuccess&&lastCallScope===callScope&&<p role="status">{next.data?.appointment?"Patient called. Latest queue requested.":"No eligible patient was called. Latest queue requested."}</p>}
 {!isPatient&&enabled&&(queue.isLoading||!q)&&<ListingRegion className="panel table-panel sq-table">
   <p role={queue.error?"alert":"status"}>{queue.error?"Queue results unavailable. Refresh before acting.":"Loading queue…"}</p>
   <Pagination state={queue.error?"error":"loading"} page={page} pageSize={pageSize} total={0} onPageChange={setPage} onPageSizeChange={setSize}/>
 </ListingRegion>}
  {!dateValid&&!isPatient?<p className="empty" role="status" data-testid="text-queue-date-invalid">Correct the date to load the session queue.</p>:!enabled?<p className="empty">Select {isPatient?"your appointment":"clinic, location, doctor and session"} to view a session.</p>:queue.isLoading?<p role="status">Loading queue…</p>:q?<>
   <div className="sq-summary" role="group" aria-label="Whole session queue metrics"><div><small>Current Token</small><strong>{q.currentToken||"—"}</strong><small>{q.currentToken?(q.inConsultation>0?"In Consultation":"Called Next"):"No Patient Called"}</small></div><div><small>Next Waiting Token</small><strong>{q.nextToken||"—"}</strong><HelpTip text="Checkout calls the next patient. Only explicit staff check-in begins consultation."/></div><div><small>Waiting</small><strong>{q.waiting??"—"}</strong><small>Whole session</small></div><div><small>Completed</small><strong>{q.completed??"—"}</strong><small>Whole session</small></div><div><small>Session Total</small><strong>{q.total??"—"}</strong><small>Whole session</small></div></div>
  <DoctorPresence identity={identity} doctorId={doctorId} branchId={branchId} date={date} sessionId={sessionId} startTime={startTime} presence={q.presence} stale={freshness.stale}/>
   {!isPatient&&<button type="button" className="button" disabled={freshness.stale||q.presence?.status!=="available"||next.isPending||queue.isFetching||!!q.currentToken||!q.nextToken||q.blockedByAbsentReservation} onClick={async()=>{if(lock.current)return;lock.current=true;setCallPreview({scope:callScope,token:q.nextToken||""});try{await next.mutateAsync({data:{doctorId,branchId,date,sessionId,startTime}});}catch{/* Authoritative error stays visible; discard the pending preview. */}finally{setCallPreview(null);lock.current=false;}}}>{next.isPending?"Calling…":"Call Next Patient"}</button>}
  {q.blockedByAbsentReservation&&<p className="notice">The earliest reservation needs staff review. Confirm consultation check-in or explicitly skip an absent patient with a reason.</p>}
  {q.ownEntry&&<ArrivalGuidance estimate={q.ownEntry.estimate} stale={freshness.stale} timeFormat={q.timeFormat}/>}
{isPatient&&selected.data&&<section className="panel table-panel sq-table" aria-label="Manage your appointment"><AppointmentRows appointments={[selected.data]} sessionScoped disabled={freshness.stale||queue.isFetching}/></section>}
 <span className="sq-note-details"><HelpTip label="How Waits Are Estimated" text="Token is not position. Estimates use the saved session and current queue, including an ongoing consultation. They are not countdowns or promised appointment times. Breaks and delays can extend the wait."/></span>
    {!isPatient&&<><fieldset className="sq-duration" disabled={freshness.stale}><DurationEditor key={`${doctorId}-${clinicId}-${branchId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} doctorId={doctorId} branchId={branchId} date={date} queue={q}/></fieldset>{listControls}<ListingRegion className="panel table-panel sq-table">{q.entries?.length?<AppointmentRows appointments={q.entries} serialOffset={(page-1)*pageSize} sessionScoped disabled={freshness.stale||queue.isFetching} selectable selectionKey={JSON.stringify(params)}/>:<div className="empty"><p>{debounced?"No matching queue appointments in this session.":status?"No appointments match this session and status.":"No appointments in this session."}</p>{search&&<button type="button" onClick={()=>setSearch("")} data-testid="button-clear-empty-queue-search">Clear Search</button>}</div>}<Pagination state={queue.error?"error":"ready"} page={page} pageSize={pageSize} total={q.entriesTotal??0} onPageChange={setPage} onPageSizeChange={setSize}/></ListingRegion></>}
    {["receptionist","clinicAdmin","superAdmin"].includes(identity.user!.role)&&<GuestRequests key={`${clinicId}-${branchId}-${doctorId}-${date}-${sessionId}-${startTime}`} clinicId={clinicId} branchId={branchId} doctorId={doctorId} date={date} sessionId={sessionId} startTime={startTime}/>}
  <p className="muted sq-note">Last successful response {formatConfiguredTimestamp(q.updatedAt,typeof branch.data?.timezone==="string"?branch.data.timezone:sessionSelection.availability.data?.timezone||undefined,{},q)} · Refresh requested every 30 seconds {queue.isFetching?"· Refreshing…":""} · Times in {typeof branch.data?.timezone==="string"?branch.data.timezone:sessionSelection.availability.data?.timezone||"clinic timezone"}</p>
 </>:null}</div>;
}

function DoctorPresence({identity,doctorId,branchId,date,sessionId,startTime,presence,stale}:{identity:api.Identity;doctorId:string;branchId:string;date:string;sessionId?:string;startTime?:string;presence?:api.DoctorPresence;stale:boolean}){
  const params={branchId,date,sessionId,startTime};const client=useQueryClient();const lock=useRef(false);
 const update=api.useUpdateDoctorPresence({mutation:{onSettled:()=>client.invalidateQueries()}});
 const allowed=identity.doctorId===doctorId||["superAdmin","clinicAdmin"].includes(identity.user!.role);
  return <section className="notice sq-presence"><ErrorNotice error={update.error}/><strong><span className="live-dot" aria-hidden/> Doctor status: {presence?title(presence.status):"Unavailable"}</strong><small>Live presence only — weekly hours and future bookings are unchanged.</small>{allowed&&<div className="row-actions">{Object.values(api.DoctorPresenceInputStatus).map(status=><button type="button" key={status} aria-pressed={presence?.status===status} disabled={stale||update.isPending} onClick={async()=>{if(lock.current)return;lock.current=true;try{await update.mutateAsync({id:doctorId,data:{...params,status}});}catch{/* The backend error remains visible. */}finally{lock.current=false;}}}>{title(status)}</button>)}</div>}{presence&&presence.status!=="available"&&<p>Automatic calling is paused. A current consultation can still be completed.</p>}</section>;
}
