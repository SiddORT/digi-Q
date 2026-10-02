import { useEffect, useState } from "react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { ErrorNotice, title } from "../../resources";
import { VisitTicket, bookingStatusLabel, type TicketData } from "../tickets/VisitTicket";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import { confirmationEmailMessage } from "./confirmation-email";

const statusLabel=(status:string)=>status==="called"?"Called next":["booked","checkedIn","waiting"].includes(status)?"Waiting":title(status);

export function AppointmentTicket({id}:{id:string}) {
  const appointment=api.useGetAppointment(id,{query:{queryKey:api.getGetAppointmentQueryKey(id),refetchInterval:30000}});
  const me=api.useGetMe();
  const a=appointment.data;
  const params={doctorId:a?.doctorId||"",branchId:a?.branchId||"",date:a?.date||"",sessionId:a?.sessionId||undefined,startTime:a?.startTime,appointmentId:id};
  const queue=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled:!!a,refetchInterval:30000}});
  const qr=api.useGetAppointmentQr(id,{query:{queryKey:api.getGetAppointmentQrQueryKey(id)}});
  const freshness=useFreshWorkspace(appointment.dataUpdatedAt,!!appointment.error);
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
  const role=me.data?.user?.role;
  const root=role==="superAdmin"||role==="clinicAdmin"?"admin":role;
  const patientLiveUrl=`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/patient/queue?appointment=${encodeURIComponent(id)}`;
  async function prepareExport():Promise<TicketData>{
    if(freshness.stale||!navigator.onLine)throw new Error("Ticket is offline or stale. Reconnect and refresh first.");
    const fresh=await api.getAppointment(id);
    const code=await api.getAppointmentQr(id);
    const confirmed=await api.getAppointment(id);
    if(!navigator.onLine)throw new Error("Connection lost. Reconnect and try again.");
    if(fresh.revision!==confirmed.revision||fresh.status!==confirmed.status)throw new Error("Appointment changed while preparing the ticket. Refresh and try again.");
    if(!code.checkInUrl)throw new Error("Personal QR unavailable. Refresh and try again.");
    void appointment.refetch();
    return {dateFormat:confirmed.dateFormat,timeFormat:confirmed.timeFormat,patientName:confirmed.patientName,clinicName:confirmed.clinicName,branchName:confirmed.branchName,address:confirmed.branchAddress,doctorName:confirmed.doctorName,date:confirmed.date,startTime:confirmed.startTime,endTime:confirmed.endTime,timezone:confirmed.timezone,waitingNumber:confirmed.token,reference:confirmed.reference,statusLabel:bookingStatusLabel(confirmed.status),qrUrl:code.checkInUrl};
  }
  return <><ErrorNotice error={appointment.error}/>{appointment.error&&<button onClick={()=>appointment.refetch()}>Refresh ticket</button>}{!a?<p role="status">Loading ticket…</p>:<>
    {confirmationEmailMessage(a.confirmationEmail)&&<p role="status">{confirmationEmailMessage(a.confirmationEmail)}</p>}
    <VisitTicket testId="appointment-ticket" ticket={{dateFormat:a.dateFormat,timeFormat:a.timeFormat,patientName:a.patientName,clinicName:a.clinicName,branchName:a.branchName,address:a.branchAddress,doctorName:a.doctorName,date:a.date,startTime:a.startTime,endTime:a.endTime,timezone:a.timezone,waitingNumber:a.token,reference:a.reference,statusLabel:bookingStatusLabel(a.status),qrUrl:qr.data?.checkInUrl}} prepareExport={prepareExport} exportDisabled={freshness.stale||!online||appointment.isFetching||!!appointment.error}/>
    {qr.error&&<><ErrorNotice error={qr.error}/><button onClick={()=>qr.refetch()} data-testid="button-retry-appointment-qr">Retry QR</button></>}
        <p>Booking status (sign in with the account that owns this booking): <a data-testid="link-ticket-patient-live" href={patientLiveUrl} style={{overflowWrap:"anywhere"}}>{patientLiveUrl}</a></p>
    <ErrorNotice error={queue.error}/>
    {!queue.error&&online&&queue.data?.presence&&<p className="notice">Doctor status: {queue.data.presence.status==="onBreak"?"On break":queue.data.presence.status==="away"?"Away":"Available"}{queue.data.presence.status!=="available"&&" · Calling is paused; your booking is kept."}</p>}
    {queue.error||!online?<p role="alert">Booking status updates unavailable or offline. No estimate is shown. <button onClick={()=>queue.refetch()}>Retry</button></p>:queue.isLoading?<p role="status">Loading booking status…</p>:queue.data?.ownEntry&&<p className="notice">{queue.data.ownEntry.patientsAhead} patients ahead · Approx. wait {queue.data.ownEntry.estimatedWaitMinutes==null?"unavailable — duration not configured":`${queue.data.ownEntry.estimatedWaitMinutes} minutes`}<br/><small>An estimate only, not a countdown or appointment time. Breaks and delays may extend the wait.</small></p>}
    <p>QR is for authorized staff validation, not public access to patient details. Staff check you in when your consultation begins.</p>
    {!!a.history?.length&&<details><summary>Appointment history</summary><ul>{a.history.map((event,index)=><li key={index}>{new Date(event.occurredAt).toLocaleString()} · {statusLabel(event.status)}{event.reason&&` · ${event.reason}`}</li>)}</ul></details>}
    {root&&<Link className="text-link" href={`/${root}/queue?appointment=${encodeURIComponent(id)}`}>Open booking status</Link>}
    <p className="muted">Status refreshes every 30 seconds while connected. Printed tickets do not update.</p>
    {freshness.stale&&<p role="alert">Ticket is offline or stale. Reconnect and refresh before printing. <button disabled={!online} onClick={()=>appointment.refetch()}>Refresh ticket</button></p>}
  </>}</>;
}