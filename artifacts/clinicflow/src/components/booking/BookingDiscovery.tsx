import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { findNextBookableDate, nextVisitDate, bookingSessionIssue, validVisitDate } from "../guest-booking-date";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import { SessionSelector, formatSessionHours, type useDailySession } from "../queue/SessionSelector";
import { HoursWarning } from "../HoursWarning";
import { ErrorNotice } from "../../resources";

/** Date boundaries come from the location, never from a possibly absent selected session. */
export function useBookingDiscovery({doctorId,branchId,date,setDate,walkIn=false,deliberateDate=false}:{
  doctorId:string;branchId:string;date:string;setDate:(date:string)=>void;walkIn?:boolean;deliberateDate?:boolean;
}){
  const params={doctorId,branchId};
  const context=api.useGetPublicBookingContext(params,{query:{queryKey:api.getGetPublicBookingContextQueryKey(params),enabled:!!doctorId&&!!branchId,refetchInterval:30000}});
  const manual=useRef(deliberateDate);
  const initialized=useRef("");
  const controller=useRef<AbortController|null>(null);
  const [finding,setFinding]=useState(false);
  const [message,setMessage]=useState("");
  const [candidate,setCandidate]=useState("");
  const cancel=()=>{controller.current?.abort();controller.current=null;setFinding(false);setMessage("");setCandidate("");};
  useEffect(()=>{cancel();return()=>controller.current?.abort();},[doctorId,branchId,date,walkIn,context.data?.today,context.data?.lastBookableDate,context.data?.timezone]);
  useEffect(()=>{
    if(!context.data||context.error||context.isFetching)return;
    if(walkIn){if(date!==context.data.today)setDate(context.data.today);}
    else if(initialized.current!==branchId){initialized.current=branchId;if(!manual.current)setDate(context.data.today);}
  },[branchId,context.data,context.error,context.isFetching,walkIn,date,setDate]);
  const changeDate=(value:string)=>{manual.current=true;cancel();setDate(value);};
  const from=validVisitDate(date)&&context.data&&date>context.data.today?date:context.data?.today||"";
  const end=context.data? [nextVisitDate(from,14),context.data.lastBookableDate].sort()[0]:"";
  const contextFresh=useFreshWorkspace(context.dataUpdatedAt,!!context.error);
  const ready=validVisitDate(date)&&!!context.data&&!context.error&&!context.isFetching&&!contextFresh.stale;
  async function find(){
    if(!ready||walkIn||finding||!context.data)return;
    const run=new AbortController();controller.current?.abort();controller.current=run;setFinding(true);setMessage("");
    try{
      const result=await findNextBookableDate(from,d=>api.getPublicAvailabilitySessions({doctorId,branchId,date:d},{signal:run.signal}),()=>!run.signal.aborted,14,context.data.lastBookableDate);
      if(run.signal.aborted)return;
      if(result){setCandidate(result);setMessage(`Found ${result}. Select this date to review the session; nothing is booked yet.`);}
      else setMessage(`No eligible advance session found from ${nextVisitDate(from,1)} through ${end}. This does not rule out later sessions. Choose another date within the booking window or contact the clinic.`);
    }catch(error){if(!run.signal.aborted)setMessage("Could not search availability. Retry or contact the clinic; no date was changed.");}
    finally{if(!run.signal.aborted){controller.current=null;setFinding(false);}}
  }
  return {context,ready,changeDate,finding,message,find,from,end,candidate};
}

export function BookingDiscovery({selection,discovery,date,walkIn=false,manage}:{
  selection:ReturnType<typeof useDailySession>;discovery:ReturnType<typeof useBookingDiscovery>;date:string;walkIn?:boolean;manage?:React.ReactNode;
}){
  const q=selection.availability,session=q.data;
  const fresh=useFreshWorkspace(q.dataUpdatedAt,!!q.error);
  const ctx=discovery.context.data;
  const time=ctx?new Intl.DateTimeFormat("en-GB",{timeZone:ctx.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()):"";
  const issue=session?bookingSessionIssue(session,walkIn,date,ctx?.today,time):null;
  const weekday=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))?new Intl.DateTimeFormat("en",{weekday:"long",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`)):"";
  return <div data-testid="booking-discovery">
    <p role="status">{date} {weekday}{ctx&&` · ${ctx.timezone}`}</p>
    <SessionSelector selection={selection}/>
    <div className="availability-box" data-testid="booking-availability-status">
      {!selection.hasContext?<p>Choose a location, doctor and date to see sessions.</p>:
      !validVisitDate(date)?<p>Choose a valid visit date to see sessions.</p>:
      q.error||discovery.context.error?<p role="alert">Could not check current availability. Your choices are retained; retry before booking.</p>:
      q.isFetching||discovery.context.isFetching?<p role="status">Checking current sessions…</p>:
      fresh.stale||!discovery.ready?<p role="alert">Availability is not current. Refresh before continuing.</p>:
      date>(ctx?.lastBookableDate||date)?<p>This date is outside the booking window. Choose a date through {ctx?.lastBookableDate}.</p>:
      !selection.sessions.length?<p>No doctor session is listed for this location on {weekday}, {date}. Other weekdays or dates may have sessions. Try another date or contact the clinic. Location opening hours alone do not create doctor sessions.</p>:
      !session?<p>Select a consulting session to continue.</p>:
      <><strong>{session.available&&session.remainingTokens>0&&!issue?`${session.remainingTokens} places remaining`:"Session unavailable"}</strong><p>{formatSessionHours(session)} · {session.timezone}</p><HoursWarning warning={session.hoursWarning}/>{(issue||session.reason)&&<p>{session.reason||issue}</p>}</>}
    </div>
    <ErrorNotice error={discovery.context.error}/>
    {selection.hasContext&&<button type="button" className="text-link" data-testid="button-refresh-booking-availability" disabled={q.isFetching||discovery.context.isFetching} onClick={()=>{void q.refetch();void discovery.context.refetch();}}>Refresh Availability</button>}
    {walkIn?<p className="notice">Walk-ins are today-only in the location timezone. Queue opening, break and session-mode restrictions apply; future dates are not suggested.</p>:
    selection.hasContext&&<div className="guest-next-date"><button type="button" className="button secondary" data-testid="button-next-booking-date" disabled={!discovery.ready||discovery.finding||discovery.end<=discovery.from} onClick={()=>void discovery.find()}>{discovery.finding?"Searching…":"Find Next Available Date"}</button>{ctx&&<p className="muted">{discovery.end>discovery.from?`Search ${nextVisitDate(discovery.from,1)} through ${discovery.end}: up to 14 days after your selected date, limited by the clinic booking window (${ctx.lastBookableDate}).`:`No later dates remain in the booking window (${ctx.lastBookableDate}).`}</p>}{discovery.message&&<p role="status">{discovery.message}</p>}</div>}
    {discovery.candidate&&<button type="button" className="button secondary" data-testid="button-use-next-date" onClick={()=>discovery.changeDate(discovery.candidate)}>Review sessions on {discovery.candidate}</button>}
    {manage}
    <p className="notice">Your ticket shows a session range, not an exact consultation time. Availability is checked again when you confirm.</p>
  </div>;
}
