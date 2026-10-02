import { useEffect, useRef, useState } from "react";
import { useNativeAuth } from "./auth/native-auth";
import { Link, Redirect, useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Activity, LayoutDashboard, CalendarDays, Users as UsersIcon, Building2, Stethoscope, Settings, LogOut, ChevronRight, ArrowUpRight, Clock3, Check, Menu, QrCode, SlidersHorizontal, FileText, UserRound, Plus, ArrowUpDown } from "lucide-react";
import { Logo } from "./App";
import { WorkspaceNav, navLabel } from "./components/WorkspaceNav";
import { DemoClinicManagement } from "./components/DemoClinicManagement";
import { IntegrationSettings } from "./components/IntegrationSettings";
import { Users } from "./Users";
import { Editor, Empty, ErrorNotice, ResourcePage, resources, profileFields, settingsFields, title, today } from "./resources";
import { SearchableSelect } from "./components/SearchableSelect";
import { Pagination, SearchInput, FilterBar, useDebouncedValue } from "./components/ListingControls";
import { AppDialog } from "./components/AppDialog";
import { ResourceLookup } from "./components/ResourceLookup";
import { CareLookup, useSelectedCare } from "./components/CareLookup";
import { configuredGreeting, formatConfiguredTimestamp, formatDate, formatTime, resolveDateTimePreferences, type DateTimePreferences } from "./lib/date-time";
import { DateTimePreferencesProvider } from "./components/DateTimePreferences";
import { AppointmentRows, type AppointmentDateSort } from "./components/appointments/AppointmentRows";
import { AppointmentTicket } from "./components/appointments/AppointmentTicket";
import { SessionQueue } from "./components/queue/SessionQueue";
import { StatusTabs, statusFilter } from "./components/queue/StatusTabs";
import { useFreshWorkspace } from "./components/queue/useFreshWorkspace";
import { useSoleCareDefaults } from "./components/queue/useSoleCareDefaults";
import { GuestBooking } from "./components/GuestBooking";
import { ClinicSettings, ConsultationManagement } from "./components/ClinicSettings";
import { SchedulingWorkspace } from "./components/SchedulingWorkspace";
import { SessionSelector, useDailySession } from "./components/queue/SessionSelector";
import { doctorWorkspaceScope } from "./components/queue/session-scope";

import { useGetAppointmentQr } from "@workspace/api-client-react";
import QRCode from "qrcode";
import { reportOtherVisits, reportOutcomeSummary } from "./lib/clinic-report-outcomes";
import { notifyCritical, notifySuccess } from "./lib/notify";
import { HelpTip } from "./components/HelpTip";
import { bookingDoctorMembership } from "./lib/booking-doctor-membership";
import { DateFormatInput } from "./components/DateFormatInput";
import { isPatientBookingConfirmation } from "./lib/patient-booking-notice";

function useConfiguredTimezone(identity?:api.Identity) {
 const identityTimezone=(identity as (api.Identity&{settings?:{timezone?:string}})|undefined)?.settings?.timezone;
 const settings=api.useGetSettings({query:{queryKey:api.getGetSettingsQueryKey(),enabled:!identityTimezone,staleTime:60000}});
 return identityTimezone||settings.data?.timezone;
}

// A ref closes the same-render double-click window before React can display pending state.
function usePendingGuard<T extends { mutateAsync: (variables: any) => Promise<any> }>(mutation:T) {
 const locked=useRef(false);
 return {...mutation,mutate:(variables:Parameters<T["mutateAsync"]>[0])=>{
  if(locked.current)return;
  locked.current=true;
  void mutation.mutateAsync(variables).catch(()=>{/* React Query exposes the error in the form. */}).finally(()=>{locked.current=false;});
 }};
}

export function AppointmentQr({ id, name, onReady }: { id: string; name: string; onReady?: (ready:boolean)=>void }) {
  const qr = useGetAppointmentQr(id);
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState<Error | null>(null);
  const [imageAttempt,setImageAttempt]=useState(0);
  useEffect(()=>{onReady?.(!!image&&!qr.error&&!imageError);},[image,qr.error,imageError,onReady]);

  useEffect(() => {
    let cancelled=false;
    if (qr.data?.checkInUrl) {
      let url = qr.data.checkInUrl;
      if (url.startsWith("/")) {
        url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${url}`;
      }
      setImage("");setImageError(null);
      QRCode.toDataURL(url, { width: 300, margin: 2 }).then(value=>{if(!cancelled)setImage(value);}).catch(error=>{if(!cancelled)setImageError(error);});
    }
    return ()=>{cancelled=true;};
  }, [qr.data?.checkInUrl,imageAttempt]);

  if (qr.isLoading) return <div className="skeleton">Loading QR code...</div>;
  if (qr.error || imageError) return <><ErrorNotice error={qr.error || imageError}/><button onClick={()=>{setImageAttempt(value=>value+1);qr.refetch();}}>Retry QR code</button></>;
  if (!qr.data) return <p>QR code is unavailable.</p>;

  return (
    <div className="appointment-qr-box" style={{ margin: "20px 0", padding: "16px", background: "var(--color-input)", borderRadius: "var(--radius)", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <small><strong>PRIVATE APPOINTMENT QR</strong></small>
      {image && <img src={image} alt={`Appointment verification QR for ${name}`} style={{ borderRadius: "8px", width: "200px" }} />}
      {image?<a className="button secondary small" href={image} download={`DigiQ-appointment-${id}-qr.png`}><QrCode size={15}/> Download QR</a>:<p role="status">Generating QR image…</p>}
    </div>
  );
}

export function Onboarding(){
 const {isLoaded,isSignedIn}=useNativeAuth();const [,navigate]=useLocation();const client=useQueryClient();
 const me=api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),enabled:!!isSignedIn,refetchOnWindowFocus:true,refetchInterval:60000}});
 const onboard=api.useOnboard({mutation:{onSuccess:()=>{sessionStorage.removeItem("clinicflow-intent");client.invalidateQueries();}}});
 useEffect(()=>{if(me.data?.user&&!me.data.needsOnboarding){const role=me.data.user.role; const root=["superAdmin","clinicAdmin"].includes(role)?"admin":role;const reference=sessionStorage.getItem("clinicflow-qr");navigate(reference?`/book/${reference}`:`/${root}/dashboard`);}},[me.data,navigate]);
 if(!isLoaded||me.isLoading)return <div className="page-loading">Connecting your account…</div>;
 if(!isSignedIn)return <Redirect to="/login"/>;
  if(me.data?.user?.role==="clinicAdmin"&&!me.data.user.clinicIds?.length)return <Redirect to="/register-clinic"/>;
 const intent=sessionStorage.getItem("clinicflow-intent")==="doctor"?"doctor":"patient";

 if (intent === "doctor") {
   return (
     <div className="onboarding">
       <Logo/>
       <section className="panel">
         <span className="eyebrow">PROVIDER ACCOUNT</span>
         <h1>Care begins with an invitation.</h1>
         <p>Healthcare providers cannot self-register directly. Please contact your clinic administrator to be invited to their workspace.</p>
         <Link href="/" className="button" onClick={() => sessionStorage.removeItem("clinicflow-intent")}>Return home</Link>
       </section>
     </div>
   );
 }

  return <div className="onboarding"><Logo/><section className="panel"><span className="eyebrow">LET'S GET ACQUAINTED</span><h1>Welcome to your care workspace.</h1><p>Complete your profile to get started. Your account is being registered as a patient.</p><ErrorNotice error={me.error||onboard.error}/><Editor initial={{fullName:me.data?.user?.fullName||"",termsAccepted:false}} fields={[{key:"fullName",required:true},{key:"mobile",type:"tel"},{key:"termsAccepted",label:"I consent to the use of my information for appointment management",type:"checkbox",required:true}]} submitLabel="Complete my profile" busy={onboard.isPending} onSave={data=>onboard.mutate({data:{...data,intent: "patient"}})}/></section></div>;
}
export function PublicBooking({reference}:{reference:string}){
  const auth=useNativeAuth();const qr=api.useResolveQr(reference,{query:{queryKey:api.getResolveQrQueryKey(reference),refetchInterval:30000}}); const me=api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),enabled:!!auth.isSignedIn,refetchOnWindowFocus:true,refetchInterval:60000}});
 useEffect(()=>{sessionStorage.setItem("clinicflow-qr",reference);},[reference]);
 if(qr.isLoading)return <div className="page-loading">Finding your clinic…</div>;
  return <div className="public-book"><Logo/><div className="panel"><span className="eyebrow">YOUR DIRECT LINK TO CARE</span><h1 data-testid="text-booking-clinic">{qr.data?.clinicName==="ClinicFlow DEMO Clinic"?"DigiQ DEMO Clinic":qr.data?.clinicName||"Book a visit"}</h1>{["ClinicFlow DEMO Clinic","DigiQ DEMO Clinic"].includes(qr.data?.clinicName||"")&&<div className="notice" role="status"><strong>Fictional demo clinic.</strong> Do not enter real patient information. Book Now issues your visit ticket immediately.</div>}{qr.error&&<p role="alert">This clinic booking QR may be invalid, inactive, or temporarily unavailable. Check the code with reception or choose a clinic for guest booking.</p>}<ErrorNotice error={qr.error||me.error}/>{(qr.error||me.error)&&<button onClick={()=>{qr.refetch();if(auth.isSignedIn)me.refetch();}}>Retry booking context</button>}{qr.data&&!qr.error&&<><p data-testid="text-booking-location">{[qr.data.branchName,qr.data.branchCity,qr.data.doctorName].filter(Boolean).join(" · ")||"Choose a clinic and doctor below"}</p>{!auth.isLoaded?<p role="status">Connecting securely…</p>:!auth.isSignedIn?<><GuestBooking key={reference} reference={reference} context={qr.data}/><hr/><p>Already have an account?</p><Link className="button secondary" href="/patient-login" data-testid="link-account-booking">Sign in to your account <ArrowUpRight size={18}/></Link></>:me.error?null:me.data?.needsOnboarding?<Redirect to="/onboarding"/>:me.data?.user?<Booking key={reference} identity={me.data} context={qr.data}/>:<p role="status">Loading your profile…</p>}</>}</div></div>;
}
const navConfig:Record<string,string[]>={
  admin:["dashboard","appointments","queue","patients","availability","reports","masters","settings","demo"],
 doctor:["dashboard","appointments","queue","patients","availability","profile"],
  receptionist:["dashboard","appointments","queue","patients","availability"],
 patient:["dashboard","book","appointments","queue","profile"],
};
export function Portal({identity,role,page}:{identity:api.Identity;role:string;page:string}){
 return <PortalWorkspace key={`${identity.user!.id}:${identity.user!.role}:${identity.doctorId||""}`} identity={identity} role={role} page={page}/>;
}
function PortalWorkspace({identity,role,page}:{identity:api.Identity;role:string;page:string}){
 const {logout}=useNativeAuth();const client=useQueryClient();const [open,setOpen]=useState(false);
 const logoutLock=useRef(false);
 const signOut=({redirectUrl}:{redirectUrl:string})=>{
  if(logoutLock.current)return;
  logoutLock.current=true;
  void logout().then(()=>{client.clear();window.location.href=redirectUrl;}).catch(()=>notifyCritical("Unable to sign out. Please try again.")).finally(()=>{logoutLock.current=false;});
 };
 const [,navigate]=useLocation();
 const timezone=useConfiguredTimezone(identity);
 const name=identity.user!.fullName;
 const defaultDoctorId=doctorWorkspaceScope(identity).doctorId;
 const navigation=navConfig[role].filter(p=>identity.user!.role!=="clinicAdmin"||!["masters","demo"].includes(p));
 if(identity.user?.role==="clinicAdmin"&&identity.doctorId)navigation.push("profile");
  return <div className="workspace">{open&&<button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}<aside className={`sidebar ${open?"open":""}`} id="workspace-sidebar" onKeyDown={e=>{if(e.key==="Escape")setOpen(false);}}><Logo/><div className="workspace-label">{role==="patient"?"YOUR CARE":"WORKSPACE"}<span>{title(role)}</span></div><WorkspaceNav navigation={navigation} role={role} page={page} onNavigate={()=>setOpen(false)}/><div className="sidebar-bottom"><div className="help-card"><span className="live-dot"/>Care, in sync.<p>{role==="patient"?"Your bookings stay up to date automatically.":"Your workspace stays connected with live queue updates."}</p></div><button className="logout" onClick={()=>signOut({redirectUrl:import.meta.env.BASE_URL})} data-testid="button-signout"><LogOut size={18}/> Sign out</button></div></aside><div className="workspace-main"><header className="topbar"><button className="mobile-menu" onClick={()=>setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open} aria-controls="workspace-sidebar"><Menu/></button><div className="breadcrumb">Workspace <ChevronRight size={13}/> <strong>{navLabel(page,role)}</strong></div><div className="topbar-right"><span className="secure-label"><span className="live-dot"/> Secure workspace</span><span className="avatar">{name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><div><strong>{name}</strong><small>{title(identity.user!.role)}</small></div></div></header><main className="content">{identity.user?.email==="doctor@clinicflow.example.com"&&<div className="notice" role="status"><strong>Fictional demo workspace.</strong> Do not enter real patient information.</div>}<div className="page-heading"><div>{["dashboard","appointments","reports"].includes(page)&&<span className="eyebrow">{formatConfiguredTimestamp(new Date(),timezone,{weekday:"long",month:"long",day:"numeric"})}</span>}<h1>{page==="dashboard"?`${configuredGreeting(timezone)}, ${name.split(" ")[0]}.`:navLabel(page,role)}</h1>{page==="dashboard"&&<p>Here's what's happening with your care workspace today.</p>}{page==="queue"&&<p>Choose a session date below to view queue activity · refreshed every 30 seconds.</p>}</div>{(page==="appointments"||page==="dashboard")&&<Link className="button small" href={`/${role}/book`} data-testid="link-page-book-appointment"><Plus size={17}/> {role==="patient"?"Book Now":"Book appointment"}</Link>}</div>
 {page==="dashboard"?<Dashboard role={role}/>:page==="demo"&&identity.user!.role==="superAdmin"?<DemoClinicManagement/>:page==="users"?<Users identity={identity}/>:page==="clinics"&&role==="doctor"?<DoctorClinics identity={identity}/>:page==="book"?<Booking identity={identity}/>:page==="appointments"?<Appointments/>:page==="queue"?<Queue identity={identity}/>:page==="profile"?<Profile identity={identity}/>:page==="settings"?<WorkspaceSettings identity={identity}/>:page==="reports"?<Reports/>:(page==="availability"||page==="exceptions")?<SchedulingWorkspace key={page} identity={identity} page={page}/>:resources[page]?<ResourcePage key={page} resource={page} identity={identity} allowCreate={!(identity.user!.role==="doctor"&&page==="patients")} defaults={defaultDoctorId?{doctorId:defaultDoctorId,isOpen:true}:{}} onEdit={page==="branches"&&role==="admin"?row=>navigate(`/admin/settings?clinicId=${encodeURIComponent(row.clinicId)}&section=locations&branchId=${encodeURIComponent(row.id)}`):undefined}/>:<Empty label="available modules"/>}
  <div className="content-footer"><span>DigiQ Doctors · Care, connected.</span><span>All times follow your clinic's configured timezone.</span></div></main></div></div>;
}
function WorkspaceSettings({identity}:{identity:api.Identity}){
 const [tab,setTab]=useState("clinic");const superAdmin=identity.user?.role==="superAdmin";
  return <>{superAdmin&&<label className="clinic-section-mobile" style={{display:"grid",maxWidth:280,marginBottom:12}}>Settings area<select value={tab} onChange={event=>setTab(event.target.value)}><option value="clinic">Clinic workspace</option><option value="platform">Platform settings</option></select></label>}{superAdmin&&tab==="platform"?<PlatformSettings/>:<ClinicSettings identity={identity}/>}</>;
}
function Dashboard({role}:{role:string}){
 const timezone=useConfiguredTimezone();
 const q=api.useGetDashboard(undefined,{query:{queryKey:api.getGetDashboardQueryKey(),refetchInterval:30000}});
 const averageWait=q.data?.averageWaitMinutes;
 const averageWaitDisplay=averageWait==null?undefined:averageWait.toFixed(1);
   return <div className="dashboard-compact"><ErrorNotice error={q.error}/>{q.error&&<button onClick={()=>q.refetch()}>Retry dashboard</button>}{q.error&&q.data&&<p role="status" className="notice">Showing the last available overview; refresh to see current activity.</p>}
    {role==="patient"&&<PatientBookingNotices timezone={timezone}/>}
    <div className="stat-grid">{[["Today's appointments",q.data?.todayAppointments,CalendarDays,"Scheduled for today"],["Waiting in queue",q.data?.waiting,Clock3,"Ready for their next step"],["Completed visits",q.data?.completed,Check,"Care delivered today"],["Average queue wait",averageWaitDisplay,Activity,"Minutes since booking or session start, whichever is later"]].map(([label,value,Icon,caption]:any)=><div className="stat-card" key={label}><div><span>{label}{label==="Average queue wait"&&<HelpTip text="Sum of recorded queue-wait minutes divided by visits with a recorded wait in this dashboard's scope. Wait is measured when consultation starts, from booking or session start, whichever is later, and cannot be negative. Visits without a recorded wait are excluded; no recorded waits displays 0. This is not time since physical arrival."/>}</span><span className="stat-icon"><Icon size={19}/></span></div><strong>{q.isLoading?"…":value??"—"}</strong><small>{caption}</small></div>)}</div>
    <section className="panel"><div className="panel-heading"><div><h2>{role==="patient"?"Your appointments":"Today's appointments"}</h2></div><Link href={`/${role}/appointments`} className="text-link">View all <ChevronRight size={16}/></Link></div>{q.isLoading?<div className="skeleton">Loading appointments…</div>:q.data?.recentAppointments?.length?<AppointmentRows appointments={q.data.recentAppointments} disabled={!!q.error||q.isFetching}/>:q.error?null:<Empty label="appointments"/>}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Operational activity</h2><p>Recent care and business updates. Authentication and password-verification events remain in the separate security audit, not this feed.</p></div><span className="badge">{q.error?"Last available":"Live data"}</span></div>{q.isLoading?<div className="skeleton">Loading operational activity…</div>:q.data?.recentActivity?.length?<div className="activity-list">{q.data.recentActivity.map(a=><div key={a.id}><span className="icon-box"><Activity size={16}/></span><div><strong>{a.summary}</strong><small>{a.actorName} · {formatConfiguredTimestamp(a.createdAt,timezone)}</small></div></div>)}</div>:q.error?null:<Empty label="operational activity updates"/>}</section></div>;
}
function PatientBookingNotices({timezone}:{timezone?:string}){
 const params:api.ListAppointmentsParams={from:today(timezone),statusGroup:"waiting",sort:"-createdAt",page:1,pageSize:5};
 // Patient authorization on the existing endpoint defines scope; no supplied patient ID.
 const query=api.useListAppointments(params,{query:{queryKey:api.getListAppointmentsQueryKey(params),refetchInterval:30000,refetchOnWindowFocus:true}});
 const notices=query.data?.items.filter(isPatientBookingConfirmation)||[];
 if(query.error)return <section className="notice" aria-label="Booking confirmations"><p role="alert">Unable to refresh your booking confirmations.</p><button onClick={()=>query.refetch()}>Retry booking confirmations</button></section>;
 if(query.isLoading)return <p role="status">Checking your booking confirmations…</p>;
 if(!notices.length)return null;
 return <section className="panel" aria-labelledby="patient-booking-confirmations"><div className="panel-heading"><div><h2 id="patient-booking-confirmations">Your booking confirmations</h2><p>Recent reservations for today and upcoming visits. These confirmations come from your saved appointments.</p></div></div><div className="activity-list">{notices.map(appointment=><div key={appointment.id} data-testid={`booking-confirmation-${appointment.id}`}><Check size={18} aria-hidden/><div><strong>Booked · {formatDate(appointment.date,appointment)}{appointment.startTime&&` · ${formatTime(appointment.startTime,appointment)}`}</strong><p>{appointment.doctorName} · {appointment.branchName}{appointment.timezone&&` · ${appointment.timezone}`}</p><Link className="text-link" href={`/patient/appointments?view=all&search=${encodeURIComponent(appointment.reference)}`} aria-label={`View booking details for ${appointment.doctorName} on ${formatDate(appointment.date,appointment)}`}>View booking details <ChevronRight size={16}/></Link></div></div>)}</div></section>;
}
function Appointments(){
  // Keep the list context in the URL so returning from booking or another page
  // restores the same visit scope without storing any patient information.
  const [initialSearch]=useState(()=>new URLSearchParams(window.location.search));
 const identity=api.useGetMe();const isPatient=identity.data?.user?.role==="patient";
 const ownDoctorId=identity.data?.user?.role==="doctor"?identity.data.doctorId:undefined;
 const timezone=useConfiguredTimezone(identity.data);const visitToday=today(timezone);
 const yesterday=new Date(`${visitToday}T12:00:00Z`);yesterday.setUTCDate(yesterday.getUTCDate()-1);
  const [view,setView]=useState(()=>["upcoming","past","all"].includes(initialSearch.get("view")||"")?initialSearch.get("view")!:"upcoming");
  const [search,setSearch]=useState(()=>initialSearch.get("search")||"");const debounced=useDebouncedValue(search);const [from,setFrom]=useState(()=>initialSearch.get("from")||"");const [to,setTo]=useState(()=>initialSearch.get("to")||"");const [status,setStatus]=useState(()=>initialSearch.get("status")||"");const [clinicId,setClinic]=useState(()=>initialSearch.get("clinic")||"");const [branchId,setBranch]=useState(()=>initialSearch.get("branch")||"");const [doctorId,setDoctor]=useState(()=>initialSearch.get("doctor")||"");const [sort,setSort]=useState<AppointmentDateSort>(()=>["createdAt","-createdAt","date","-date"].includes(initialSearch.get("sort")||"")?initialSearch.get("sort") as AppointmentDateSort:"-createdAt");const [page,setPage]=useState(()=>Math.max(1,Math.floor(Number(initialSearch.get("page")))||1));const [pageSize,setPageSize]=useState(()=>[10,20,25,50,100].includes(Number(initialSearch.get("size")))?Number(initialSearch.get("size")):20);
 const [draft,setDraft]=useState({from:"",to:"",clinicId:"",branchId:"",doctorId:""});
 const [fromValid,setFromValid]=useState(true);const [toValid,setToValid]=useState(true);
 const draftClinic=useSelectedCare("clinics",draft.clinicId,isPatient);
 const updateDraft=(change:Partial<typeof draft>)=>setDraft(previous=>({...previous,...change}));
 const openFilters=()=>setDraft({from,to,clinicId,branchId,doctorId});
 const applyFilters=()=>{if(!fromValid||!toValid){notifyCritical("Correct the date filters before applying.");return;}setFrom(draft.from);setTo(draft.to);setClinic(draft.clinicId);setBranch(draft.branchId);setDoctor(draft.doctorId);};
 const sessionSelection=useDailySession({doctorId:ownDoctorId||doctorId,branchId,date:from&&from===to?from:""});
 const sessionId=from&&from===to?sessionSelection.sessionId||undefined:undefined;
  const firstFilterRender=useRef(true);
  useEffect(()=>{if(firstFilterRender.current){firstFilterRender.current=false;return;}setPage(1);},[debounced,from,to,status,clinicId,branchId,doctorId,sessionId,sort,pageSize,view]);
  useEffect(()=>{
    const values=new URLSearchParams();
    for(const [key,value] of Object.entries({view:view==="upcoming"?"":view,search,from,to,status,clinic:clinicId,branch:branchId,doctor:doctorId,sort:sort==="-createdAt"?"":sort,page:page===1?"":String(page),size:pageSize===20?"":String(pageSize)}))if(value)values.set(key,value);
    const url=new URL(window.location.href);url.search=values.toString();
    if(url.href!==window.location.href)window.history.replaceState(window.history.state,"",url);
  },[view,search,from,to,status,clinicId,branchId,doctorId,sort,page,pageSize]);
 const sessionStart=sessionId?sessionSelection.availability.data?.startTime||undefined:undefined;
 const params:api.ListAppointmentsParams={search:debounced,from:from||(view==="upcoming"?visitToday:undefined),to:to||(view==="past"?yesterday.toISOString().slice(0,10):undefined),...statusFilter(status),clinicId:clinicId||undefined,branchId:branchId||undefined,doctorId:ownDoctorId||doctorId||undefined,sessionId:sessionStart?undefined:sessionId,startTime:sessionStart,sort,page,pageSize};
 const q=api.useListAppointments(params,{query:{queryKey:api.getListAppointmentsQueryKey(params),enabled:!from||!to||from<=to,refetchInterval:30000,placeholderData:previous=>previous}});
 useEffect(()=>{if(q.data&&!q.isPlaceholderData&&!q.isFetching)setPage(current=>Math.min(current,Math.max(1,Math.ceil((q.data.total??0)/pageSize))));},[q.data,q.isPlaceholderData,q.isFetching,pageSize]);
 const selectedClinic=useSelectedCare("clinics",clinicId,isPatient);
 const selectedBranch=useSelectedCare("branches",branchId,isPatient,{clinicId});
 const selectedDoctor=useSelectedCare("doctors",ownDoctorId||doctorId,isPatient,{clinicId,branchId:branchId||undefined});
 const appointmentChips=[
  ...(clinicId?[{key:"adv:clinic",label:`Clinic Group: ${selectedClinic.data?.name||"Selected"}`,onRemove:()=>{setClinic("");setBranch("");setDoctor("");}}]:[]),
  ...(branchId?[{key:"adv:branch",label:`Clinic: ${selectedBranch.data?.name||"Selected"}`,onRemove:()=>{setBranch("");setDoctor("");}}]:[]),
  ...(doctorId?[{key:"adv:doctor",label:`Doctor: ${selectedDoctor.data?.fullName||"Selected"}`,onRemove:()=>setDoctor("")}]:[]),
  ...(view!=="upcoming"?[{key:"view",label:view==="all"?"All visits":"Past visits",onRemove:()=>setView("upcoming")}]:[]),
 ];
 const freshness=useFreshWorkspace(q.dataUpdatedAt,!!q.error);
 const filtered=!!(search||from||to||status||clinicId||branchId||doctorId);
  return <>{from&&to&&from>to&&<p role="alert" className="error-box">Select an end date on or after the start date.</p>}<FilterBar active={filtered||view!=="upcoming"} onOpen={openFilters} onApply={applyFilters} onReset={()=>{setSearch("");setFrom("");setTo("");setStatus("");setClinic("");setBranch("");setDoctor("");setSort("-createdAt");setView("upcoming");setPage(1);setDraft({from:"",to:"",clinicId:"",branchId:"",doctorId:""});}} chips={[...appointmentChips,...(status?[{key:"adv:status",label:title(status),onRemove:()=>setStatus("")}]:[]),...(from?[{key:"adv:from",label:`From ${from}`,onRemove:()=>setFrom("")}]:[]),...(to?[{key:"adv:to",label:`To ${to}`,onRemove:()=>setTo("")}]:[]),...(search?[{key:"search",label:search,onRemove:()=>setSearch("")}]:[])]} actions={<label>Sort appointments<select aria-label="Sort appointments" value={sort} onChange={event=>setSort(event.target.value as AppointmentDateSort)}><option value="-createdAt">Newest created</option><option value="createdAt">Oldest created</option><option value="date">Visit date: earliest first</option><option value="-date">Visit date: latest first</option></select></label>} advanced={<>
  <label>From<DateFormatInput value={draft.from} preferences={draftClinic.data as Partial<DateTimePreferences>|undefined} onValidityChange={setFromValid} onChange={value=>updateDraft({from:value})}/></label><label>To<DateFormatInput min={draft.from} value={draft.to} preferences={draftClinic.data as Partial<DateTimePreferences>|undefined} onValidityChange={setToValid} onChange={value=>updateDraft({to:value})}/></label>
  <CareLookup kind="clinics" publicAccess={isPatient} label="Clinic Group" value={draft.clinicId} onChange={value=>updateDraft({clinicId:value,branchId:"",doctorId:""})}/>
  <CareLookup kind="branches" publicAccess={isPatient} label="Clinic" value={draft.branchId} onChange={value=>updateDraft({branchId:value,doctorId:""})} disabled={!draft.clinicId} params={{clinicId:draft.clinicId}}/>
  <CareLookup kind="doctors" publicAccess={isPatient} label="Doctor" value={ownDoctorId||draft.doctorId} onChange={value=>updateDraft({doctorId:value})} disabled={!draft.clinicId||identity.data?.user?.role==="doctor"} params={{clinicId:draft.clinicId,branchId:draft.branchId||undefined}}/>
  </>}><SearchInput value={search} onChange={setSearch} placeholder="Search appointments…"/><label>Visit range<select aria-label="Visit range" value={view} onChange={event=>{setView(event.target.value);setFrom("");setTo("");}}><option value="upcoming">Today &amp; upcoming</option><option value="past">Past visits</option><option value="all">All visits</option></select></label></FilterBar>
  {from&&from===to&&branchId&&(ownDoctorId||doctorId)&&<DateTimePreferencesProvider value={selectedClinic.data as Partial<DateTimePreferences>|undefined}><div className="sq-context"><SessionSelector selection={sessionSelection}/></div></DateTimePreferencesProvider>}
  <StatusTabs value={status} onChange={setStatus} counts={(q.data as typeof q.data&{statusCounts?:Record<string,number>})?.statusCounts}/><ErrorNotice error={q.error}/>{freshness.stale&&!q.isLoading&&<p className="notice" role="alert">Offline or stale appointment data. Mutations are disabled until refreshed. <button onClick={()=>q.refetch()}>Refresh appointments</button></p>}{q.dataUpdatedAt>0&&<p className="muted">Updated {formatConfiguredTimestamp(new Date(q.dataUpdatedAt),timezone,{},selectedClinic.data as Partial<DateTimePreferences>|undefined)}</p>}{q.error&&<button onClick={()=>q.refetch()}>Retry appointments</button>}
  <section className="panel table-panel" aria-busy={q.isFetching}>{q.isLoading?<div className="skeleton">Loading appointments…</div>:q.data?.items.length?<AppointmentRows appointments={q.data.items} selectable selectionKey={JSON.stringify(params)} disabled={freshness.stale||q.isFetching||q.isPlaceholderData||!!(from&&to&&from>to)} sort={sort} onSortChange={setSort}/>:q.error?<p>Appointment refresh unavailable. Retry before acting on an appointment.</p>:<div className="empty"><p>{filtered?"No matching appointments":"No appointments in this view. Try All visits to view earlier visits."}</p>{search&&<button onClick={()=>setSearch("")}>Clear search</button>}</div>}<Pagination page={page} pageSize={pageSize} total={q.data?.total??0} onPageChange={setPage} onPageSizeChange={setPageSize}/></section></>;
}
function Booking({identity,context}:{identity:api.Identity;context?:api.QrContext}){
 const queryParams=new URLSearchParams(useSearch());const bookingSettings=api.useGetSettings();
 const {isDoctor,doctorId:restrictedDoctorId}=doctorWorkspaceScope(identity);
 const [clinicId,setClinic]=useState(context?.clinicId||queryParams.get("clinic")||"");const [branchId,setBranch]=useState(context?.branchId||queryParams.get("branch")||"");const [doctorId,setDoctor]=useState(context?.doctorId||restrictedDoctorId||queryParams.get("doctor")||"");const [date,setDate]=useState(today());const [step,setStep]=useState(1);const [patientId,setPatient]=useState(identity.user?.role==="patient"?identity.patientId||"":"");const [consent,setConsent]=useState(false);const [notes,setNotes]=useState("");const [mobile,setMobile]=useState(identity.user?.mobile||"");const [code,setCode]=useState("");const [newPatient,setNewPatient]=useState(false);const [requestId]=useState(()=>crypto.randomUUID());
  const client=useQueryClient();const isPatient=identity.user?.role==="patient";
  const [dateValid,setDateValid]=useState(true);
  useSoleCareDefaults({enabled:!isPatient&&!context,clinicId,branchId,doctorId,setClinic,setBranch,setDoctor});
  const canRegisterPatient=["superAdmin","clinicAdmin","receptionist"].includes(identity.user!.role);
  const [source,setSource]=useState<"phone"|"walkIn">(queryParams.get("source")==="walkIn"?"walkIn":"phone");
  const clinics=useSelectedCare("clinics",clinicId,isPatient);
  const branches=useSelectedCare("branches",branchId,isPatient,{clinicId});
  const doctors=useSelectedCare("doctors",doctorId,isPatient,{clinicId,branchId:branchId||undefined});
  const membershipParams={clinicId,branchId,selectedIds:doctorId,page:1,pageSize:1};
  const publicMembership=api.useListPublicDoctors(membershipParams,{query:{queryKey:api.getListPublicDoctorsQueryKey(membershipParams),enabled:isPatient&&!!clinicId&&!!branchId&&!!doctorId,refetchInterval:30000}});
  const membership=bookingDoctorMembership({
   doctorId,clinicId,branchId,
   pending:isPatient?publicMembership.isPending||publicMembership.isFetching:doctors.isPending||doctors.isFetching,
   error:isPatient?!!publicMembership.error:!!doctors.error,
   publicIds:isPatient?publicMembership.data?.items.map(item=>item.id):undefined,
   doctor:isPatient||!doctors.data?undefined:{clinicIds:doctors.data.clinicIds,branchIds:doctors.data.branchIds,status:doctors.data.status},
  });
  const retainedDoctorNames=useRef(new Map<string,string>());
  const [assignmentChanged,setAssignmentChanged]=useState(false);
  if(doctors.data?.fullName)retainedDoctorNames.current.set(doctorId,String(doctors.data.fullName));
  useEffect(()=>{
   // Fixed QR/self-doctor selections cannot be replaced here; keep them visible with
   // explicit feedback and block booking. Other selections clear only on proven mismatch.
   if(membership==="invalid"&&!context?.doctorId&&!restrictedDoctorId){setDoctor("");setAssignmentChanged(true);}
   if(membership==="valid")setAssignmentChanged(false);
  },[membership,doctorId,context?.doctorId,restrictedDoctorId]);
  const preferences=resolveDateTimePreferences(clinics.data as Partial<DateTimePreferences>|undefined);
  const selection=useDailySession({doctorId,branchId,date,initialSessionId:queryParams.get("sessionId")});const availability=selection.availability;
  const patients=useSelectedCare("patients",!isPatient?patientId:"");
  const visitToday=today(availability.data?.timezone);
  const session=availability.data;
  const bookingFresh=useFreshWorkspace(availability.dataUpdatedAt,!!availability.error);
  const localTime=session?new Date().toLocaleTimeString("en-GB",{timeZone:session.timezone,hour:"2-digit",minute:"2-digit",hour12:false}):"";
  const walkIn=!context&&!isPatient&&source==="walkIn";
  const sourceError=session?.available?(
    walkIn&&session.queueMode==="appointmentsOnly"?"This session accepts advance appointments only.":
    !walkIn&&session.queueMode==="walkInsOnly"?"This session accepts walk-ins only.":
    walkIn&&date!==visitToday?"Walk-ins must be for today at this clinic.":
    walkIn&&localTime<(session.queueOpenTime||session.startTime||"")?"The queue has not opened yet.":
    date===visitToday&&session.queueCloseTime&&localTime>=session.queueCloseTime?(isPatient||context?"Booking for this session has closed.":"Queue booking has closed."):
    walkIn&&session.breakStart&&session.breakEnd&&localTime>=session.breakStart&&localTime<session.breakEnd?"The doctor is on a break.":null):null;
  const canContinue=dateValid&&!!date&&date>=visitToday&&membership==="valid"&&!bookingFresh.stale&&!!clinics.data&&!!branches.data&&!!doctors.data&&!clinics.error&&!branches.error&&!doctors.error&&!!availability.data?.available&&availability.data.remainingTokens>0&&!availability.isFetching&&!availability.error&&!sourceError;
  useEffect(()=>{if(!isPatient&&source==="walkIn")setDate(visitToday);},[source,isPatient,visitToday]);
  useEffect(()=>{if(!isPatient)setPatient("");},[clinicId,branchId,isPatient]);
  const createPatient=usePendingGuard(api.useCreatePatient({mutation:{onSuccess:p=>{setPatient(p.id);setNewPatient(false);client.invalidateQueries();}}}));
 const otp=usePendingGuard(api.useRequestOtp()); const verify=usePendingGuard(api.useVerifyOtp({mutation:{onSuccess:()=>client.invalidateQueries()}}));
 const book=usePendingGuard(api.useCreateAppointment({mutation:{mutationFn:({data})=>api.createAppointment({...data,sessionId:selection.sessionId||undefined}),onSuccess:()=>{sessionStorage.removeItem("clinicflow-qr");notifySuccess("Booking confirmed");client.invalidateQueries();}}}));
  useEffect(()=>{book.reset();otp.reset();verify.reset();},[step]);
  const cutoff=bookingSettings.data?.cancellationCutoffMinutes;
  const cutoffNotice=cutoff==null?null:<p className="notice">Cancellation is available until {cutoff} minutes before the session starts, subject to the appointment's current status. Times follow {session?.timezone||"the clinic timezone"}. Contact the clinic if you need help after the cutoff.</p>;
  if(book.data)return <DateTimePreferencesProvider value={preferences}><section className="panel confirmation"><span className="confirmation-check"><Check size={34}/></span><span className="eyebrow">APPOINTMENT CONFIRMED</span>{book.data.confirmationEmail==="provider_accepted"&&<p role="status">Email accepted for sending.</p>}{(book.data.confirmationEmail==="unavailable"||book.data.confirmationEmail==="not_attempted")&&<p className="notice" role="status">Booking confirmed. Confirmation email could not be confirmed; keep your ticket.</p>}<AppointmentTicket id={book.data.id}/>{cutoffNotice}<Link className="text-link" href={`/${["superAdmin","clinicAdmin"].includes(identity.user!.role)?"admin":identity.user!.role}/appointments`}>View appointments / reopen ticket</Link></section></DateTimePreferencesProvider>;
 return <DateTimePreferencesProvider value={preferences}><section className="panel booking-panel"><div className="booking-steps">{["Choose your care","Your details","Review & book"].map((s,i)=><div className={step===i+1?"active":step>i+1?"done":""} key={s}><span>{step>i+1?<Check size={15}/>:i+1}</span>{s}</div>)}</div><ErrorNotice error={clinics.error||branches.error||doctors.error||availability.error||book.error||patients.error}/>
  {(clinics.error||branches.error||doctors.error||patients.error)&&<button onClick={()=>{if(clinicId)clinics.refetch();if(branchId)branches.refetch();if(doctorId)doctors.refetch();if(patientId&&!isPatient)patients.refetch();}}>Retry selected records</button>}
  {(clinics.isFetching||branches.isFetching||doctors.isFetching||patients.isFetching)&&<p role="status">Loading selected care details…</p>}
  {doctorId&&clinicId&&branchId&&membership==="checking"&&<p role="status">Checking the selected doctor's clinic assignment. Your selection is retained.</p>}
  {assignmentChanged&&<p role="status">The previous doctor is not assigned or available at this clinic. Please choose an available doctor.</p>}
  {doctorId&&clinicId&&branchId&&membership==="error"&&<p role="alert">Unable to verify this doctor's clinic assignment. Your selection is retained; booking is unavailable until verified. <button onClick={()=>{doctors.refetch();if(isPatient)publicMembership.refetch();}}>Retry doctor assignment</button></p>}
  {membership==="invalid"&&<p role="alert">This doctor is not available at the selected clinic. Choose an assigned clinic or another doctor.</p>}
  {branches.data&&<div className="sq-context"><strong>{String(clinics.data?.name||context?.clinicName||"")} · {String(branches.data.name||"")}</strong><p>{String(branches.data.address||"Address not provided")}</p></div>}
  {!bookingFresh.online&&<p role="alert">You are offline. Reconnect and refresh availability before booking.</p>}
  {step===1?<><div className="section-heading"><h2>Where would you like to visit?</h2><p>Choose from real clinics and available consulting sessions.</p></div>
  {!isPatient&&!context&&<SearchableSelect label="Booking source" value={source} onChange={value=>setSource((value||"phone") as "phone"|"walkIn")} options={[{value:"phone",label:"Phone / advance booking"},{value:"walkIn",label:"Walk-in — today"}]}/>}
   {context&&<p className="notice">Booking at {context.clinicName==="ClinicFlow DEMO Clinic"?"DigiQ DEMO Clinic":context.clinicName} · {context.branchName}{context.doctorName&&` · ${context.doctorName}`}. This clinic is fixed by your booking QR.</p>}
   <div className="form-grid">{!context?.clinicId&&<CareLookup kind="clinics" label="Clinic Group" value={clinicId} publicAccess={isPatient} selectedLabel={String(clinics.data?.name||"")} params={{status:"active"}} onChange={v=>{setClinic(v);setBranch("");}}/>}{!context?.branchId&&<CareLookup kind="branches" label="Clinic" value={branchId} publicAccess={isPatient} selectedLabel={String(branches.data?.name||"")} disabled={!clinicId} params={{clinicId,status:"active",doctorId:context?.doctorId}} onChange={setBranch}/>}<CareLookup kind="doctors" label="Doctor" value={doctorId} publicAccess={isPatient} selectedLabel={String(doctors.data?.fullName||retainedDoctorNames.current.get(doctorId)||"")} disabled={!branchId||isDoctor||!!context?.doctorId} params={{clinicId,branchId,status:"active"}} onChange={setDoctor}/><label>Visit date *<DateFormatInput required value={date} min={visitToday} preferences={preferences} onValidityChange={setDateValid} disabled={!isPatient&&!context&&source==="walkIn"} onChange={setDate} data-testid="input-booking-date"/></label></div>
   {branches.data&&<small>Dates and times follow this Clinic Group's format: {formatDate(date,preferences)}, {formatTime("09:00",preferences)} · {session?.timezone||String(branches.data.timezone||"Timezone unavailable")}. A Clinic is a physical care location within its Clinic Group.</small>}
   {cutoffNotice}
  <SessionSelector selection={selection}/>
   {(!clinicId||!branchId||!doctorId)&&<p className="muted">Select a Clinic Group, clinic and doctor to load available sessions. Only authorized clinics are listed.</p>}
  {doctorId&&branchId&&<div className="availability-box">{availability.isFetching?"Checking availability…":availability.error?<button onClick={()=>availability.refetch()}>Retry availability</button>:availability.data?<><strong>{availability.data.maxTokens>0&&availability.data.remainingTokens===0?"Session full — no remaining tokens":availability.data.available?`${availability.data.remainingTokens} of ${availability.data.maxTokens} places remaining`:"Session unavailable"}</strong>{availability.data.startTime&&<p>{formatTime(availability.data.startTime,preferences)} – {availability.data.endTime?formatTime(availability.data.endTime,preferences):"—"} · {availability.data.timezone}{availability.data.breakStart&&` · Break ${formatTime(availability.data.breakStart,preferences)}–${availability.data.breakEnd?formatTime(availability.data.breakEnd,preferences):"—"}`}</p>}{!availability.data.available&&<p>{availability.data.reason||"No session available. Try another date."}</p>}<small>{isPatient||context?"You will receive a visit number for this session. Your visit happens during the session hours shown; an exact time is not guaranteed. Availability is rechecked when you book.":"Queue-based session. Your token identifies your reservation, not your changing queue position. An exact consultation time is not guaranteed. Availability is rechecked on confirmation."}</small></>:<p>No availability response. Choose a session or retry.</p>}<ErrorNotice error={sourceError}/></div>}
  <div className="form-footer"><button className="button" disabled={!canContinue} onClick={()=>setStep(2)}>Continue <ChevronRight size={17}/></button></div></>:step===2?<><h2>Who is this visit for?</h2>{isPatient?<div className="notice">Booking for {identity.user?.fullName}. Your patient profile is securely linked to this account.</div>:<><CareLookup kind="patients" label="Patient" value={patientId} onChange={setPatient} selectedLabel={String(patients.data?.fullName||"")} params={{clinicId,branchId,status:"active"}}/>{createPatient.isSuccess&&<p className="notice" role="status">Patient registered and selected.</p>}{canRegisterPatient?<button className="text-link" onClick={()=>setNewPatient(true)}><Plus size={16}/> Register a new patient</button>:<p className="notice">Doctors can book for existing patients in their scope. Ask reception or an administrator to register a new patient.</p>}<AppDialog open={canRegisterPatient&&newPatient} onClose={()=>setNewPatient(false)} title="Register a new patient" dirty busy={createPatient.isPending}><ErrorNotice error={createPatient.error}/><Editor fields={resources.patients.fields.filter(f=>!["clinicId","branchId"].includes(f.key))} initial={{clinicId,branchId}} onSave={data=>{if(!createPatient.isPending)createPatient.mutate({data:{...data,clinicId,branchId}});}} busy={createPatient.isPending} submitLabel="Register patient"/></AppDialog></>}
 <ErrorNotice error={bookingSettings.error}/>{bookingSettings.error&&<button onClick={()=>bookingSettings.refetch()}>Retry booking policy</button>}
 {isPatient&&bookingSettings.data?.requireMobileVerification&&<div className="verification"><h3>Additional mobile prerequisite</h3><p>This clinic explicitly requires mobile verification. Email sign-in does not verify your mobile. If the configured provider is unavailable, contact clinic staff. International format, for example +14155552671.</p><div className="inline-form"><input type="tel" aria-label="Mobile number" value={mobile} onChange={e=>setMobile(e.target.value)}/><button disabled={otp.isPending||!mobile} onClick={()=>otp.mutate({data:{mobile}})}>Request verification code</button></div><ErrorNotice error={otp.error||verify.error}/>{otp.data&&<><p>Verification requested. Expires at {formatConfiguredTimestamp(otp.data.expiresAt,session?.timezone,{},preferences)}. This does not confirm message delivery.</p><div className="inline-form"><input aria-label="Verification code" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)}/><button disabled={verify.isPending||!code} onClick={()=>verify.mutate({data:{challengeId:otp.data!.challengeId,code}})}>Verify</button></div></>}{verify.data?.verified&&<span className="badge active">Mobile verified</span>}</div>}
  <label>Notes for your visit (optional)<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label><div className="form-footer"><button onClick={()=>setStep(1)}>Back</button><button className="button" disabled={!patientId} onClick={()=>setStep(3)}>Review appointment <ChevronRight size={17}/></button></div></>:<>
  <h2>Everything look right?</h2><div className="review-grid"><div><small>CLINIC GROUP & CLINIC</small><strong>{String(clinics.data?.name||"")}</strong><p>{String(branches.data?.name||"")}</p></div><div><small>YOUR DOCTOR</small><strong>{String(doctors.data?.fullName||"")}</strong><p>{formatDate(date,preferences)} · {availability.data?.startTime?formatTime(availability.data.startTime,preferences):"—"}–{availability.data?.endTime?formatTime(availability.data.endTime,preferences):"—"} · {session?.timezone}</p></div><div><small>PATIENT</small><strong>{isPatient?identity.user?.fullName:String(patients.data?.fullName||"")}</strong></div>{notes.trim()&&<div><small>NOTES FOR YOUR VISIT</small><p>{notes}</p></div>}</div>{cutoffNotice}
  <label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I consent to appointment management and the clinic's booking policy.</label><p className="notice">Your reservation is confirmed only after a token is issued. Availability is checked again when you confirm.</p><ErrorNotice error={sourceError}/><div className="form-footer"><button disabled={book.isPending} onClick={()=>setStep(1)}>Change visit</button><button disabled={book.isPending} onClick={()=>setStep(2)}>Back</button><button className="button" disabled={!consent||book.isPending||!canContinue||!patientId} data-testid="button-confirm-booking" onClick={()=>{if(!book.isPending)book.mutate({data:{clinicId,branchId,doctorId,patientId,date,source:context?"qr":isPatient?"online":source,qrReference:context?.reference,termsAccepted:consent,notes,requestId,sessionId:selection.sessionId||undefined,startTime:availability.data?.startTime||undefined}});}}>{book.isPending?"Confirming…":isPatient||context?"Book Now":"Confirm appointment"} <Check size={17}/></button></div></>}
 </section></DateTimePreferencesProvider>;
}
function Queue({identity,initial}:{identity:api.Identity;initial?:api.Appointment}){
 return <SessionQueue key={identity.user!.id} identity={identity} initial={initial}/>;
}
function Profile({identity}:{identity:api.Identity}){
 const client=useQueryClient();const doctor=api.useGetDoctor(identity.doctorId||"",{query:{queryKey:api.getGetDoctorQueryKey(identity.doctorId||""),enabled:!!identity.doctorId}});const patient=api.useGetPatient(identity.patientId||"",{query:{queryKey:api.getGetPatientQueryKey(identity.patientId||""),enabled:!!identity.patientId}});
 const mutation=usePendingGuard(useMutation<api.Patient|api.Doctor|api.User,Error,any>({mutationFn:(data:any)=>identity.doctorId?api.updateDoctor(identity.doctorId,data):identity.patientId?api.updatePatient(identity.patientId,data):api.updateMe(data),onSuccess:()=>{notifySuccess("Updated successfully");client.invalidateQueries();}}));
 const data=identity.doctorId?doctor.data:identity.patientId?patient.data:identity.user;
   return <><section className="panel padded profile-compact"><h2>{identity.user?.role==="clinicAdmin"?"My profile & consultation":"Your profile"}</h2><p className="muted">Keep your contact and care details up to date. Changing a mobile number resets its verification.</p>{identity.user?.role==="clinicAdmin"&&doctor.data?.status==="inactive"&&<div className="notice" role="status"><p>Your doctor profile is inactive. Your Clinic Admin account remains active.</p><button type="button" disabled={mutation.isPending} onClick={()=>mutation.mutate({status:"active"})}>Reactivate my doctor profile</button></div>}<ErrorNotice error={doctor.error||patient.error||mutation.error}/>{(doctor.error||patient.error)&&<button onClick={()=>{if(identity.doctorId)doctor.refetch();if(identity.patientId)patient.refetch();}}>Retry profile</button>}{mutation.isSuccess&&<p className="notice" role="status">Your profile has been saved.</p>}{data?<Editor key={identity.doctorId||identity.patientId||identity.user?.id} initial={data} fields={identity.doctorId?resources.doctors.fields.filter(f=>!["status","ownerAdminId","clinicIds","branchIds"].includes(f.key)):identity.patientId?resources.patients.fields.filter(f=>!["clinicId","branchId","status"].includes(f.key)):profileFields} busy={mutation.isPending} onSave={d=>mutation.mutate(d)}/>:doctor.error||patient.error?null:<p role="status">Loading profile…</p>}</section>{identity.user?.role==="clinicAdmin"&&<ConsultationManagement identity={identity}/>} {identity.user?.role==="doctor"&&<DoctorClinics identity={identity} embedded/>}</>;
}
export function DoctorClinics({ identity, embedded = false }: { identity: api.Identity; embedded?: boolean }) {
  const [search,setSearch]=useState("");const debounced=useDebouncedValue(search);const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(20);
  const [networkSearch,setNetworkSearch]=useState("");const networkDebounced=useDebouncedValue(networkSearch);const [networkPage,setNetworkPage]=useState(1);const [networkSize,setNetworkSize]=useState(20);
  useEffect(()=>setPage(1),[debounced,pageSize]);useEffect(()=>setNetworkPage(1),[networkDebounced,networkSize]);
  const assignedParams={page,pageSize,search:debounced,status:"active" as const,sort:"name"};
  const assigned = api.useListClinics(assignedParams, { query: { queryKey: api.getListClinicsQueryKey(assignedParams),refetchInterval:30000 } });
  const optionsParams = { targetRole: "receptionist" as const,search:networkDebounced,page:networkPage,pageSize:networkSize };
  const options = api.useGetStaffAssignmentOptions(optionsParams, {
    query: {
      queryKey: api.getGetStaffAssignmentOptionsQueryKey(optionsParams),
      staleTime: 60000,
      refetchInterval: 30000,
      enabled: !!identity.doctorId
    }
  });

  const assignedClinics = assigned.data?.items || [];
  const availableClinics = options.data?.clinics || [];
  const networkTotal=(options.data as any)?.pagination?.clinics?.total??0;

  return (
    <div className="doctor-clinics-page">
      <ErrorNotice error={assigned.error || options.error} />
      {(assigned.error||options.error)&&<button onClick={()=>{assigned.refetch();options.refetch();}}>Retry clinics</button>}
      {!embedded&&<section className="panel table-panel" style={{ marginBottom: '2rem' }}>
        <div className="panel-heading">
          <div>
            <h2>Currently assigned clinics</h2>
            <p>Clinics where you actively practice and manage appointments.</p>
          </div>
        </div>
        <FilterBar active={!!search} onReset={()=>setSearch("")}><SearchInput value={search} onChange={setSearch} placeholder="Search assigned clinics…"/></FilterBar>
        {assigned.isLoading ? <div className="skeleton">Loading assigned clinics…</div> : assignedClinics.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Name</th><th>City</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>
                {assignedClinics.map((c: any) => (
                  <tr key={c.id}>
                    <td data-label="Name"><strong>{c.name}</strong></td>
                    <td data-label="City">{c.city || "—"}</td>
                    <td data-label="Phone">{c.phone || "—"}</td>
                    <td data-label="Status"><span className={`badge ${c.status}`}>{title(c.status || "")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : assigned.error?null:<div className="empty"><p>{search?"No matching assigned clinics":"No active clinics are assigned to you."}</p>{search&&<button onClick={()=>setSearch("")}>Clear search</button>}</div>}
        <Pagination page={page} pageSize={pageSize} total={assigned.data?.total||0} onPageChange={setPage} onPageSizeChange={setPageSize}/>
      </section>}

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>Clinics in your network</h2>
            <p>Clinics managed by your administrator, including existing assignments. Contact your Clinic Admin for clinical assignments.</p>
          </div>
        </div>
        <FilterBar active={!!networkSearch} onReset={()=>setNetworkSearch("")}><SearchInput value={networkSearch} onChange={setNetworkSearch} placeholder="Search network clinics…"/></FilterBar>
        {options.isLoading ? <div className="skeleton">Loading available clinics…</div> : availableClinics.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Name</th><th>City</th><th>Phone</th></tr></thead>
              <tbody>
                {availableClinics.map((c: any) => (
                  <tr key={c.id}>
                    <td data-label="Name"><strong>{c.name}</strong></td>
                    <td data-label="City">{c.city || "—"}</td>
                    <td data-label="Phone">{c.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : options.error?null:<div className="empty"><p>{networkSearch?"No matching network clinics":"No clinics are available in your administrator's network."}</p>{networkSearch&&<button onClick={()=>setNetworkSearch("")}>Clear search</button>}</div>}
        <Pagination page={networkPage} pageSize={networkSize} total={networkTotal} onPageChange={setNetworkPage} onPageSizeChange={setNetworkSize}/>
      </section>
    </div>
  );
}

function PlatformSettings(){
 return <><PlatformPreferences/><IntegrationSettings/></>;
}
function PlatformPreferences(){
 const q=api.useGetSettings();const client=useQueryClient();const mutation=usePendingGuard(api.useUpdateSettings({mutation:{onSuccess:()=>client.invalidateQueries()}}));
  return <section className="panel padded platform-preferences"><h2>Platform preferences</h2><ErrorNotice error={q.error||mutation.error}/>{q.isLoading&&<div className="skeleton">Loading platform preferences…</div>}{q.error&&<button onClick={()=>q.refetch()}>Retry settings</button>}{q.error&&q.data&&<p className="notice" role="alert">Settings could not refresh. Review them after reconnecting before saving.</p>}<details className="settings-integration-note"><summary>Integrations and session limits</summary><p>General notifications are not connected. Session timeout is managed by the authentication service; platform preferences do not change your authentication session.</p><p>SMS provider: {q.isLoading?"Loading…":q.error?"Unavailable":q.data?.otpProviderConfigured?"Configured":"Not connected"} · Queue refresh: 30 seconds</p></details>{mutation.isSuccess&&<p className="notice" role="status">Settings saved.</p>}{q.data&&<fieldset disabled={!!q.error||q.isFetching||mutation.isPending}><Editor initial={q.data} fields={settingsFields} busy={mutation.isPending} onSave={data=>{if(!mutation.isPending)mutation.mutate({data});}}/></fieldset>}</section>;
}
function Reports(){
 const [from,setFrom]=useState(today());const [to,setTo]=useState(today());const [groupBy,setGroup]=useState<"date"|"clinic"|"doctor">("date");const [clinicId,setClinic]=useState("");const [branchId,setBranch]=useState("");const [doctorId,setDoctor]=useState("");const [page,setPage]=useState(1);const [pageSize,setPageSize]=useState(20);
 const [search,setSearch]=useState("");const debounced=useDebouncedValue(search);const [sort,setSort]=useState<NonNullable<api.GetReportsParams["sort"]>>("key");
 const selectedClinic=useSelectedCare("clinics",clinicId);
 const preferences=resolveDateTimePreferences(selectedClinic.data as Partial<DateTimePreferences>|undefined);
  const [draft,setDraft]=useState({groupBy:"date" as "date"|"clinic"|"doctor",clinicId:"",branchId:"",doctorId:""});
  const draftChange=(patch:Partial<typeof draft>)=>setDraft(previous=>({...previous,...patch}));
  const openFilters=()=>setDraft({groupBy,clinicId,branchId,doctorId});
  const applyFilters=()=>{setGroup(draft.groupBy);setClinic(draft.clinicId);setBranch(draft.branchId);setDoctor(draft.doctorId);};
 const [exporting,setExporting]=useState(false);const exportLock=useRef(false);const [exportError,setExportError]=useState<Error|null>(null);const [exportDone,setExportDone]=useState(false);
 const sessionSelection=useDailySession({doctorId,branchId,date:from===to?from:""});
 const sessionId=from===to?sessionSelection.sessionId||undefined:undefined;
 const sessionStart=sessionId?sessionSelection.availability.data?.startTime||undefined:undefined;
 useEffect(()=>{setPage(1);setExportDone(false);},[from,to,groupBy,clinicId,branchId,doctorId,sessionId,pageSize,debounced,sort]);
 const params:api.GetReportsParams={from,to,groupBy,clinicId:clinicId||undefined,branchId:branchId||undefined,doctorId:doctorId||undefined,sessionId:sessionStart?undefined:sessionId,startTime:sessionStart,page,pageSize,search:debounced||undefined,sort};
 const q=api.useGetReports(params,{query:{queryKey:api.getGetReportsQueryKey(params),enabled:!!from&&!!to&&from<=to,refetchInterval:30000,placeholderData:previous=>previous}});
 useEffect(()=>{if(q.data&&!q.isPlaceholderData&&!q.isFetching&&q.data.total!==undefined)setPage(current=>Math.min(current,Math.max(1,Math.ceil(q.data.total!/pageSize))));},[q.data,q.isPlaceholderData,q.isFetching,pageSize]);
 const total=(q.data as (NonNullable<typeof q.data>&{total?:number})|undefined)?.total??0;
 async function download(){
  if(exportLock.current)return;exportLock.current=true;setExporting(true);setExportError(null);setExportDone(false);
  try{
   const keys=["label","appointments","completed","cancelled","noShow","other","registrations","averageWaitMinutes","averageConsultationMinutes"] as const;
   const chunks=[keys.join(",")];const exportedKeys=new Set<string>();let exportPage=1;let loaded=0;let expected=0;
   do{
    const batch=await api.getReports({...params,page:exportPage,pageSize:100} as any) as NonNullable<typeof q.data>&{total:number};
    if(exportPage>1&&batch.total!==expected)throw new Error("Report totals changed while exporting. Please retry for a complete export.");
    expected=batch.total;if(!Number.isFinite(expected))throw new Error("Report export requires server pagination metadata. Please retry after refreshing.");
    if(!batch.rows.length&&loaded<expected)throw new Error("Report changed while exporting. Please retry to avoid an incomplete export.");
    for(const row of batch.rows){if(exportedKeys.has(row.key))throw new Error("Report grouping changed while exporting. Please retry.");exportedKeys.add(row.key);}
    chunks.push(...batch.rows.map(row=>{
     if(reportOtherVisits(row)<0)throw new Error("Report status totals are inconsistent. Refresh before exporting.");
     return keys.map(key=>{let value=String(key==="other"?reportOtherVisits(row):key==="label"&&groupBy==="date"?formatDate(row.key,preferences):row[key]??"");if(/^[=+@-]/.test(value))value="'"+value;return `"${value.replaceAll('"','""')}"`;}).join(",");
    }));
    loaded+=batch.rows.length;exportPage++;
   }while(loaded<expected);
   const url=URL.createObjectURL(new Blob(["\uFEFF"+chunks.join("\r\n")],{type:"text/csv;charset=utf-8"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`DigiQ-report-${from}-${to}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setExportDone(true);
  }catch(error){setExportError(error instanceof Error?error:new Error("Unable to export report."));}finally{setExporting(false);exportLock.current=false;}
 }
  const reportChips=[
    ...(search?[{key:"search",label:search,onRemove:()=>setSearch("")}]:[]),
    ...(clinicId?[{key:"adv:clinic",label:"Clinic Group selected",onRemove:()=>{setClinic("");setBranch("");setDoctor("");}}]:[]),
    ...(branchId?[{key:"adv:branch",label:"Clinic selected",onRemove:()=>{setBranch("");setDoctor("");}}]:[]),
    ...(doctorId?[{key:"adv:doctor",label:"Doctor selected",onRemove:()=>setDoctor("")}]:[]),
    ...(groupBy!=="date"?[{key:"adv:group",label:`Grouped by ${title(groupBy)}`,onRemove:()=>setGroup("date")}]:[]),
  ];
   return <div className="reports-compact"><FilterBar label="Report filters" chips={reportChips} onOpen={openFilters} onApply={applyFilters} advanced={<>
     <SearchableSelect label="Group by" value={draft.groupBy} onChange={value=>draftChange({groupBy:(value||"date") as typeof draft.groupBy})} options={["date","clinic","doctor"].map(value=>({value,label:title(value)}))}/>
      <ResourceLookup resource="clinics" label="Clinic Group" value={draft.clinicId} onChange={value=>{if(value!==draft.clinicId)draftChange({clinicId:value,branchId:"",doctorId:""});}}/>
      <ResourceLookup resource="branches" label="Clinic" value={draft.branchId} disabled={!draft.clinicId} params={{clinicId:draft.clinicId}} onChange={value=>{if(value!==draft.branchId)draftChange({branchId:value,doctorId:""});}}/>
     <ResourceLookup resource="doctors" label="Doctor" value={draft.doctorId} disabled={!draft.clinicId} params={{clinicId:draft.clinicId,branchId:draft.branchId||undefined}} onChange={value=>draftChange({doctorId:value})}/>
   </>} actions={<button className="button secondary small" onClick={()=>void download()} disabled={exporting||q.isFetching||q.isPlaceholderData||!!q.error||!total||!from||!to||from>to}>{exporting?"Exporting…":"Export all results CSV"}</button>} active={!!search||!!clinicId||!!branchId||!!doctorId||from!==today()||to!==today()||groupBy!=="date"} onReset={()=>{setSearch("");setSort("key");setFrom(today());setTo(today());setGroup("date");setClinic("");setBranch("");setDoctor("");setDraft({groupBy:"date",clinicId:"",branchId:"",doctorId:""});}}>
    <SearchInput value={search} onChange={setSearch} placeholder="Search reports…"/>
    <label>Sort reports<select value={sort} onChange={event=>setSort(event.target.value as NonNullable<api.GetReportsParams["sort"]>)}><option value="key">Group: ascending</option><option value="-key">Group: descending</option><option value="appointments">Visits: low to high</option><option value="-appointments">Visits: high to low</option></select></label>
    <label>From *<DateFormatInput required value={from} preferences={preferences} onChange={setFrom}/></label><label>To *<DateFormatInput required min={from} value={to} preferences={preferences} onChange={setTo}/></label>
   </FilterBar>{from===to&&branchId&&doctorId&&<DateTimePreferencesProvider value={preferences}><div className="sq-context"><SessionSelector selection={sessionSelection}/></div></DateTimePreferencesProvider>}
  {(!from||!to||from>to)&&<p role="alert" className="error-box">Select a valid date range.</p>}<ErrorNotice error={q.error||exportError}/>{q.error&&<button onClick={()=>q.refetch()}>Retry report</button>}{q.error&&q.data&&<p className="notice" role="alert">Showing the last available report. Refresh before exporting.</p>}{exportDone&&<p role="status" className="notice">All matching report results exported.</p>}
  <details className="report-methodology"><summary>How visit totals, queue wait and consultation time are calculated</summary><p>Visits include every appointment status. Completed, cancelled, no-show and Other together equal the visit total. Other includes bookings still in progress and any remaining statuses; it is not a completed outcome.</p><p>Queue wait measures time from booking or session start (whichever is later) to consultation, not physical arrival. TAT is the actual average completed consultation duration, not the expected duration or queue wait estimate.</p></details>
  <section className="panel table-panel" aria-busy={q.isFetching}>{q.isLoading?<div className="skeleton">Loading report…</div>:q.data?.rows.length?<div className="table-scroll"><table><thead><tr><th>Group</th><th>Visits</th><th>Outcomes</th><th>Registrations</th><th>Average queue wait</th><th>TAT · actual average consultation</th></tr></thead><tbody>{q.data.rows.map(r=><tr key={r.key}><td data-label="Group">{groupBy==="date"?formatDate(r.key,preferences):r.label}</td><td data-label="Visits"><strong>{r.appointments} appointments</strong><small>{r.completed} completed</small></td><td data-label="Outcomes">{r.cancelled} cancelled<small>{r.noShow} no-show</small><small role={reportOtherVisits(r)<0?"alert":undefined}>{reportOutcomeSummary(r)}</small></td><td data-label="Registrations">{r.registrations}</td><td data-label="Average queue wait">{r.averageWaitMinutes} min</td><td data-label="TAT">{r.averageConsultationMinutes==null?"—":`${r.averageConsultationMinutes} min`}</td></tr>)}</tbody></table></div>:q.error?null:<div className="empty"><p>No matching reports for this date range and scope.</p>{search&&<button onClick={()=>setSearch("")}>Clear search</button>}</div>}<Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize}/></section></div>;
}