import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { AppointmentQr } from "../../clinic";
import { ErrorNotice, title } from "../../resources";
import QRCode from "qrcode";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";

const statusLabel=(status:string)=>status==="called"?"Called next":["booked","checkedIn","waiting"].includes(status)?"Waiting":title(status);

export function AppointmentTicket({id}:{id:string}) {
  const appointment=api.useGetAppointment(id,{query:{queryKey:api.getGetAppointmentQueryKey(id),refetchInterval:30000}});
  const me=api.useGetMe();
  const a=appointment.data;
  const params={doctorId:a?.doctorId||"",branchId:a?.branchId||"",date:a?.date||"",sessionId:a?.sessionId||undefined,startTime:a?.startTime,appointmentId:id};
  const queue=api.useGetQueue(params,{query:{queryKey:api.getGetQueueQueryKey(params),enabled:!!a,refetchInterval:30000}});
  const printable=useRef<HTMLDivElement>(null);
  const [printError,setPrintError]=useState("");
  const [printing,setPrinting]=useState(false);
  const printLock=useRef(false);
  const freshness=useFreshWorkspace(appointment.dataUpdatedAt,!!appointment.error);
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
  const role=me.data?.user?.role;
  const root=role==="superAdmin"||role==="clinicAdmin"?"admin":role;
  const patientLiveUrl=`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/patient/queue?appointment=${encodeURIComponent(id)}`;
  async function print(){
    if(printLock.current||freshness.stale||!navigator.onLine)return;
    setPrintError("");
    const popup=window.open("","_blank","width=700,height=800");
    if(!popup){setPrintError("Allow pop-ups to print this ticket.");return;}
    printLock.current=true;setPrinting(true);
    popup.opener=null;
    popup.document.body.textContent="Revalidating private appointment ticket…";
    try {
      const fresh=await api.getAppointment(id);
      const qr=await api.getAppointmentQr(id);
      const confirmed=await api.getAppointment(id);
      if(!navigator.onLine)throw new Error("Connection lost. Reconnect and retry printing.");
      if(fresh.revision!==confirmed.revision||fresh.status!==confirmed.status)throw new Error("Appointment changed while preparing the ticket. Refresh and retry.");
      const url=qr.checkInUrl.startsWith("/")?`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,"")}${qr.checkInUrl}`:qr.checkInUrl;
      const image=await QRCode.toDataURL(url,{width:300,margin:2});
      if(popup.closed)throw new Error("Print window closed. Retry to open a new window.");
      popup.document.title="ClinicFlow appointment ticket";
      popup.document.body.textContent="";
      const heading=popup.document.createElement("h2");heading.textContent="ClinicFlow · Private appointment ticket";
      const detail=popup.document.createElement("p");detail.style.whiteSpace="pre-line";detail.textContent=`${confirmed.patientName}\nReference ${confirmed.reference} · Token ${confirmed.token}\n${statusLabel(confirmed.status)}\n${confirmed.doctorName}\n${confirmed.clinicName} · ${confirmed.branchName}\n${confirmed.date} · Session ${confirmed.startTime||"—"}–${confirmed.endTime||"—"}`;
      const img=popup.document.createElement("img");img.src=image;img.alt="Private appointment validation QR";
      const note=popup.document.createElement("p");note.textContent="Token is not queue position. Keep this QR secure. Staff explicitly confirm check-in when consultation begins. Printed status is a snapshot.";
      popup.document.body.append(heading,detail,img,note);
      await img.decode();
      if(!navigator.onLine)throw new Error("Connection lost before printing. Reconnect and retry.");
      popup.focus();popup.print();
      void appointment.refetch();
    }catch(error){popup.close();setPrintError(error instanceof Error?error.message:"Ticket validation failed. Refresh and retry.");}
    finally{printLock.current=false;setPrinting(false);}
  }
  return <><ErrorNotice error={appointment.error}/>{appointment.error&&<button onClick={()=>appointment.refetch()}>Refresh ticket</button>}{!a?<p role="status">Loading ticket…</p>:<>
    <div ref={printable} data-testid="appointment-ticket">
      <h2>ClinicFlow · Appointment ticket</h2><h3>{a.patientName}</h3>
      <p><strong>Reference {a.reference}</strong><br/>Token <strong>{a.token}</strong> · {statusLabel(a.status)}</p>
      <p>{a.doctorName}<br/>{a.clinicName} · {a.branchName}<br/>{a.date} · Session {a.startTime||"—"}–{a.endTime||"—"}</p>
      <p>Token identifies this reservation. It is not your queue position.</p>
      {!queue.error&&online&&queue.data?.ownEntry&&<p>Queue snapshot: {queue.data.ownEntry.patientsAhead} ahead · Approx. wait {queue.data.ownEntry.estimatedWaitMinutes==null?"unavailable":`${queue.data.ownEntry.estimatedWaitMinutes} minutes`} · Updated {new Date(queue.data.updatedAt).toLocaleString()}. This is not a guaranteed consultation time.</p>}
      <AppointmentQr id={a.id} name={a.patientName}/>
      <p>Patient live queue — sign in with the account that owns this appointment:<br/><a data-ticket-live-link data-testid="link-ticket-patient-live" href={patientLiveUrl} style={{overflowWrap:"anywhere"}}>{patientLiveUrl}</a><br/><small>This link does not grant public access to patient details. The QR above is a separate staff check-in link.</small></p>
    </div>
    <ErrorNotice error={queue.error}/>
    {!queue.error&&online&&queue.data?.presence&&<p className="notice">Doctor status: {queue.data.presence.status==="onBreak"?"On break":queue.data.presence.status==="away"?"Away":"Available"}{queue.data.presence.status!=="available"&&" · Calling is paused; your reservation is retained."}</p>}
    {queue.error||!online?<p role="alert">Queue updates unavailable / offline. No live estimate is shown. <button onClick={()=>queue.refetch()}>Retry</button></p>:queue.isLoading?<p role="status">Loading queue information…</p>:queue.data?.ownEntry&&<p className="notice">{queue.data.ownEntry.patientsAhead} patients ahead · Approx. wait {queue.data.ownEntry.estimatedWaitMinutes==null?"unavailable — duration not configured":`${queue.data.ownEntry.estimatedWaitMinutes} minutes`}<br/><small>Ahead × expected consultation duration; changes with queue events, not a countdown. Breaks, pauses and delays may extend the actual wait.</small></p>}
    <p>QR is for authorized staff validation, not public access to patient details. A booking joins the waiting queue; staff explicitly check in when consultation begins.</p>
    {!!a.history?.length&&<details><summary>Appointment history</summary><ul>{a.history.map((event,index)=><li key={index}>{new Date(event.occurredAt).toLocaleString()} · {statusLabel(event.status)}{event.reason&&` · ${event.reason}`}</li>)}</ul></details>}
    {root&&<Link className="text-link" href={`/${root}/queue?appointment=${encodeURIComponent(id)}`}>Open signed-in queue information</Link>}
    <p className="muted">Status refreshes every 30 seconds while connected. Printed tickets do not update.</p>
    <ErrorNotice error={printError}/>{freshness.stale&&<p role="alert">Ticket is offline or stale. Reconnect and refresh before printing.</p>}{(freshness.stale||printError)&&<button disabled={!online||printing} onClick={()=>appointment.refetch()}>Refresh ticket and retry</button>}<button className="button secondary" disabled={printing||freshness.stale||appointment.isFetching||!!appointment.error} onClick={()=>void print()} data-testid="button-print-ticket">{printing?"Revalidating ticket…":"Print private ticket"}</button>
  </>}</>;
}