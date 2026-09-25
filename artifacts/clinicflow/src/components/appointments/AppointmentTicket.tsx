import { useEffect, useRef, useState } from "react";
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
  const [qrReady,setQrReady]=useState(false);
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
  const role=me.data?.user?.role;
  const root=role==="superAdmin"||role==="clinicAdmin"?"admin":role;
  const patientLiveUrl=`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/patient/queue?appointment=${encodeURIComponent(id)}`;
  function print(){
    setPrintError("");
    const popup=window.open("","_blank","width=700,height=800");
    if(!popup){setPrintError("Allow pop-ups to print this ticket.");return;}
    popup.opener=null;
    const heading=popup.document.createElement("title");heading.textContent="ClinicFlow appointment ticket";popup.document.head.append(heading);
    if(printable.current)popup.document.body.append(printable.current.cloneNode(true));
    popup.document.body.querySelectorAll("button,a:not([data-ticket-live-link])").forEach(el=>el.remove());
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
      {!queue.error&&online&&queue.data?.ownEntry&&<p>Queue snapshot: {queue.data.ownEntry.patientsAhead} ahead · Approx. wait {queue.data.ownEntry.estimatedWaitMinutes==null?"unavailable":`${queue.data.ownEntry.estimatedWaitMinutes} minutes`} · Updated {new Date(queue.data.updatedAt).toLocaleString()}. This is not a guaranteed consultation time.</p>}
      <AppointmentQr id={a.id} name={a.patientName} onReady={setQrReady}/>
      <p>Patient live queue — sign in with the account that owns this appointment:<br/><a data-ticket-live-link data-testid="link-ticket-patient-live" href={patientLiveUrl} style={{overflowWrap:"anywhere"}}>{patientLiveUrl}</a><br/><small>This link does not grant public access to patient details. The QR above is a separate staff check-in link.</small></p>
    </div>
    <ErrorNotice error={queue.error}/>
    {queue.error||!online?<p role="alert">Queue updates unavailable / offline. No live estimate is shown. <button onClick={()=>queue.refetch()}>Retry</button></p>:queue.isLoading?<p role="status">Loading queue information…</p>:queue.data?.ownEntry&&<p className="notice">{queue.data.ownEntry.patientsAhead} patients ahead · Approx. wait {queue.data.ownEntry.estimatedWaitMinutes==null?"unavailable — duration not configured":`${queue.data.ownEntry.estimatedWaitMinutes} minutes`}<br/><small>Ahead × expected consultation duration; changes with queue events, not a countdown. Breaks, pauses and delays may extend the actual wait.</small></p>}
    <p>QR is for authorized staff check-in, not public access to patient details. Booking does not replace check-in.</p>
    {!!a.history?.length&&<details><summary>Appointment history</summary><ul>{a.history.map((event,index)=><li key={index}>{new Date(event.occurredAt).toLocaleString()} · {title(event.status)}{event.reason&&` · ${event.reason}`}</li>)}</ul></details>}
    {root&&<Link className="text-link" href={`/${root}/queue?appointment=${encodeURIComponent(id)}`}>Open signed-in queue information</Link>}
    <p className="muted">Status refreshes every 30 seconds while connected. Printed tickets do not update.</p>
    <ErrorNotice error={printError}/><button className="button secondary" disabled={!qrReady||appointment.isFetching||!!appointment.error} onClick={print} data-testid="button-print-ticket">Print private ticket</button>
  </>}</>;
}