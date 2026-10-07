import { assertIndividualCheckIn } from "@/lib/check-in-policy";
import { useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { HelpTip } from "../HelpTip";
import { ErrorNotice } from "../../resources";
import { BRAND_NAME } from "../../branding";
import { embeddedTicketLogo } from "../tickets/VisitTicket";
import { canShowAppointmentTicket } from "./presentation";
import { formatDate, formatTime } from "../../lib/date-time";
import { RowMenu } from "../RowMenu";
import { downloadPdf } from "./ticket-export";
import { TicketEmailDialog } from "./TicketEmailDialog";
import { X } from "lucide-react";

function download(content:string,type:string,name:string) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function BulkAppointments({ids,disabled,onClear,onRetain,labels={}}:{ids:string[];disabled:boolean;onClear:()=>void;onRetain?:(ids:string[])=>void;labels?:Record<string,string>}) {
  const [email,setEmail]=useState(false);
  const [busy,setBusy]=useState(false);const lock=useRef(false);const [confirm,setConfirm]=useState(false);const [reason,setReason]=useState("");const [results,setResults]=useState<string[]>([]);const [error,setError]=useState<unknown>(null);const client=useQueryClient();
  const failed=results.filter(result=>result.includes(": failed — "));
  const skipped=results.filter(result=>result.includes(": skipped — "));
  const issues=[...failed,...skipped];
  async function run(kind:"csv"|"print"|"download"|"cancel") {
    if((kind as string)==="checkIn"){try{assertIndividualCheckIn(ids);}catch(e){setError(e as Error);return;}}
    if(lock.current||disabled||!navigator.onLine)return;
    lock.current=true;setBusy(true);setError(null);setResults([]);
    const popup=kind==="print"?window.open("","_blank"):null;
    if(popup)popup.opener=null;
    const messages:string[]=[];const completedIds:string[]=[];const records:api.Appointment[]=[];const documentOut=document.implementation.createHTMLDocument(`${BRAND_NAME} private tickets`);
    try {
      if(kind==="print"&&!popup)throw new Error("Allow pop-ups to print selected tickets.");
      const logo = kind==="print"||kind==="download" ? await embeddedTicketLogo() : null;
      for(const id of ids) {
        try {
          if(!navigator.onLine)throw new Error("Offline — reconnect and retry.");
          const a=await api.getAppointment(id);
          if((kind==="print"||kind==="download")&&!canShowAppointmentTicket(a)){messages.push(`${a.reference}: skipped — completed visits do not need a ticket.`);continue;}
          if(kind==="cancel") {
            if(!a.allowedActions.includes("cancel")){messages.push(`${a.reference}: skipped — cancellation is not allowed.`);continue;}
            await api.transitionAppointment(id,{action:"cancel",expectedStatus:a.status,expectedRevision:a.revision??0,reason:reason.trim()});
          } else if(kind==="csv") records.push(a);
          else {
            const qr=await api.getAppointmentQr(id);
            if(!qr.checkInUrl?.trim())throw new Error("Personal QR unavailable. Refresh and try again.");
            if(qr.appointmentId!==id)throw new Error("Personal QR does not match the selected appointment.");
            const url=qr.checkInUrl.startsWith("/")?`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,"")}${qr.checkInUrl}`:qr.checkInUrl;
            const image=await QRCode.toDataURL(url,{width:250,margin:2});
            const section=documentOut.createElement("section");section.style.cssText="page-break-after:always;padding:24px;font-family:sans-serif;color:#10274e;background:#fff;border-top:4px solid #087cb7";
            const brand=documentOut.createElement("img");brand.src=logo!;brand.alt="DigiQ Doctors logo";brand.style.cssText="display:block;width:108px;height:54px;object-fit:contain";
            const heading=documentOut.createElement("h2");heading.textContent="Private appointment ticket";heading.style.color="#10274e";
            const detail=documentOut.createElement("p");detail.style.whiteSpace="pre-line";detail.textContent=`${a.patientName}\n${a.reference} · Token ${a.token}\n${a.clinicName} · ${a.branchName}\n${a.doctorName} · ${formatDate(a.date,a)}\nSession ${a.startTime?formatTime(a.startTime,a):"—"}–${a.endTime?formatTime(a.endTime,a):"—"}\n${a.status}\nToken is not queue position. Staff must explicitly confirm consultation check-in.`;
            const img=documentOut.createElement("img");img.src=image;img.alt="Private appointment QR";
            section.append(brand,heading,detail,img);documentOut.body.append(section);
          }
          completedIds.push(id);
          messages.push(`${a.reference}: ${kind==="cancel"?"cancelled":"prepared"}.`);
        }catch(e){messages.push(`${id}: failed — ${e instanceof Error?e.message:"request rejected"}`);}
      }
      if(kind==="csv"&&records.length) {
        const cell=(v:unknown)=>`"${String(v??"").replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')}"`;
        download([["Reference","Patient","Clinic","Branch","Doctor","Date","Session start","Session end","Token","Status"],...records.map(a=>[a.reference,a.patientName,a.clinicName,a.branchName,a.doctorName,formatDate(a.date,a),a.startTime?formatTime(a.startTime,a):"",a.endTime?formatTime(a.endTime,a):"",a.token,a.status])].map(row=>row.map(cell).join(",")).join("\r\n"),"text/csv;charset=utf-8","selected-appointments.csv");
      }
      if((kind==="download"||kind==="print")&&completedIds.length!==ids.length)throw new Error("No tickets exported. All selected appointments must have an available personal QR. Review the results and retry.");
      if(kind==="download"&&documentOut.body.children.length)await downloadPdf("<!doctype html>"+documentOut.documentElement.outerHTML,"private-appointment-tickets.pdf");
      if(popup&&documentOut.body.children.length){popup.document.replaceChild(popup.document.importNode(documentOut.documentElement,true),popup.document.documentElement);await Promise.all(Array.from(popup.document.images).map(img=>img.decode()));popup.focus();popup.print();}
      else popup?.close();
      if(kind==="cancel"){await client.invalidateQueries();setConfirm(false);const remaining=ids.filter(id=>!completedIds.includes(id));if(remaining.length)onRetain?.(remaining);else onClear();}
    }catch(e){setError(e);popup?.close();}finally{setResults(messages);lock.current=false;setBusy(false);}
  }
   return <>{ids.length>0&&<div className="appt-bulk bulk-compact" role="region" aria-label="Bulk appointment actions"><strong data-testid="text-bulk-count">{ids.length} selected</strong><span className="bulk-scope">this page only</span><button disabled={disabled||busy} onClick={()=>void run("csv")} data-testid="button-bulk-csv">Export CSV</button><button disabled={disabled||busy} onClick={()=>void run("print")} data-testid="button-bulk-print">Print Tickets</button><RowMenu label="More bulk actions" testId="menu-bulk-more" items={[{key:"download",label:"Download Tickets PDF",disabled:disabled||busy,onSelect:()=>void run("download")},{key:"email",label:"Email Tickets…",disabled:disabled||busy,onSelect:()=>setEmail(true)},{key:"cancel",label:"Cancel Selected…",danger:true,disabled:disabled||busy,onSelect:()=>setConfirm(true)}]}/>{/* Integration point: main agent wires PDF export and email actions here. */}<button disabled={busy} onClick={onClear} data-testid="button-bulk-clear"><X size={13} aria-hidden/> Clear</button>{busy&&<span role="status" className="bulk-scope" data-testid="status-bulk-progress">Processing {ids.length}…</span>}<span style={{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)"}} data-testid="text-individual-checkin">Check-in is individual only: use the live queue for each patient.</span><HelpTip text="Only rows on this page are selected. Changing page, filters or sorting clears the selection. Rows on other pages are not included. Check-in and check-out are individual only."/></div>}<ErrorNotice error={error}/>{results.length>0&&<><p role="status">Bulk results: {results.length-issues.length} succeeded, {failed.length} failed, {skipped.length} skipped.</p>{issues.length>0&&<details><summary>Review Failures and Skipped Appointments</summary><ul>{issues.map((result,i)=><li key={i}>{result}</li>)}</ul></details>}</>}<TicketEmailDialog open={email} items={ids.map(id=>({id,label:labels[id]||id}))} onClose={()=>setEmail(false)}/><AppDialog open={confirm} onClose={()=>setConfirm(false)} title={`Cancel ${ids.length} selected appointments?`} busy={busy} dirty={!!reason}><p>Each appointment is revalidated. Ineligible appointments are skipped; failures are reported individually. Cancellation cannot be undone.</p><label>Required cancellation reason<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="button" disabled={busy||disabled||!reason.trim()} onClick={()=>void run("cancel")}>{busy?"Cancelling…":"Confirm Cancellations"}</button></AppDialog></>;
}