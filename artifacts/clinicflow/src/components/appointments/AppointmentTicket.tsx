import { useRef, useState } from "react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { AppointmentQr } from "../../clinic";
import { ErrorNotice, title } from "../../resources";

export function AppointmentTicket({id}:{id:string}) {
  const appointment=api.useGetAppointment(id,{query:{queryKey:api.getGetAppointmentQueryKey(id),refetchInterval:30000}});
  const me=api.useGetMe();
  const a=appointment.data;
  const params={doctorId:a?.doctorId||"",branchId:a?.branchId||"",date:a?.date||"",appointmentId:id};
  const queue=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled:!!a,refetchInterval:30000}});
  const printable=useRef<HTMLDivElement>(null);
  const [printError,setPrintError]=useState("");
  const role=me.data?.user?.role;
  const root=role==="superAdmin"||role==="clinicAdmin"?"admin":role;
  function print(){
    setPrintError("");
    const popup=window.open("","_blank","width=700,height=800");
    if(!popup){setPrintError("Allow pop-ups to print this ticket.");return;}
    popup.opener=null;
    const heading=popup.document.createElement("title");heading.textContent="ClinicFlow appointment ticket";popup.document.head.append(heading);
    if(printable.current)popup.document.body.append(printable.current.cloneNode(true));
    popup.document.body.querySelectorAll("button,a,small").forEach(el=>{if(el.tagName!=="SMALL")el.remove();});
    const note=popup.document.createElement("p");note.textContent="Private appointment ticket. Keep the QR secure. Printed status is a snapshot; check your signed-in workspace for updates.";popup.document.body.append(note);
    const images=Array.from(popup.document.images);
    void Promise.all(images.map(img=>img.decode().catch(()=>{}))).then(()=>{popup.focus();popup.print();});
  }
  return <><ErrorNotice error={appointment.error}/>{appointment.error&&<button onClick={()=>appointment.refetch()}>Refresh ticket</button>}{!a?<p role="status">Loading ticket…</p>:<>
    <div ref={printable} data-testid="appointment-ticket">
      <h2>ClinicFlow · Appointment ticket</h2><h3>{a.patientName}</h3>
      <p><strong>Reference {a.reference}</strong><br/>Token <strong>{a.token}</strong> · {title(a.status)}</p>
      <p>{a.doctorName}<br/>{a.clinicName} · {a.branchName}<br/>{a.date} · Session {a.startTime||"—"}–{a.endTime||"—"}</p>
      <p>Token identifies this reservation. It is not your queue position.</p>
      <AppointmentQr id={a.id} name={a.patientName}/>
    </div>
    <ErrorNotice error={queue.error}/>
    {queue.error?<p role="alert">Queue updates unavailable. No live estimate is shown. <button onClick={()=>queue.refetch()}>Retry</button></p>:queue.isLoading?<p role="status">Loading queue information…</p>:queue.data?.ownEntry&&<p className="notice">{queue.data.ownEntry.patientsAhead} patients ahead · Approx. wait {queue.data.ownEntry.estimatedWaitMinutes==null?"unavailable — duration not configured":`${queue.data.ownEntry.estimatedWaitMinutes} minutes`}<br/><small>Ahead × expected consultation duration; changes with queue events, not a countdown. Breaks, pauses and delays may extend the actual wait.</small></p>}
    <p>QR is for authorized staff check-in, not public access to patient details. Booking does not replace check-in.</p>
    {root&&<Link className="text-link" href={`/${root}/queue?appointment=${encodeURIComponent(id)}`}>Open signed-in queue information</Link>}
    <p className="muted">Status refreshes every 30 seconds while connected. Printed tickets do not update.</p>
    <ErrorNotice error={printError}/><button className="button secondary" disabled={appointment.isFetching||!!appointment.error} onClick={print} data-testid="button-print-ticket">Print private ticket</button>
  </>}</>;
}