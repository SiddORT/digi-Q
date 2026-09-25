import { useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "../AppDialog";
import { ErrorNotice } from "../../resources";

function download(content:string,type:string,name:string) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function BulkAppointments({ids,disabled,onClear}:{ids:string[];disabled:boolean;onClear:()=>void}) {
  const [busy,setBusy]=useState(false);const lock=useRef(false);const [confirm,setConfirm]=useState(false);const [reason,setReason]=useState("");const [results,setResults]=useState<string[]>([]);const [error,setError]=useState<unknown>(null);const client=useQueryClient();
  async function run(kind:"csv"|"print"|"download"|"cancel") {
    if(lock.current||disabled||!navigator.onLine)return;
    lock.current=true;setBusy(true);setError(null);setResults([]);
    const popup=kind==="print"?window.open("","_blank"):null;
    if(popup)popup.opener=null;
    const messages:string[]=[];const records:api.Appointment[]=[];const documentOut=document.implementation.createHTMLDocument("ClinicFlow private tickets");
    try {
      if(kind==="print"&&!popup)throw new Error("Allow pop-ups to print selected tickets.");
      for(const id of ids) {
        try {
          if(!navigator.onLine)throw new Error("Offline — reconnect and retry.");
          const a=await api.getAppointment(id);
          if(kind==="cancel") {
            if(!a.allowedActions.includes("cancel")){messages.push(`${a.reference}: skipped — cancellation is not allowed.`);continue;}
            await api.transitionAppointment(id,{action:"cancel",expectedStatus:a.status,expectedRevision:a.revision??0,reason:reason.trim()});
          } else if(kind==="csv") records.push(a);
          else {
            const qr=await api.getAppointmentQr(id);
            const url=qr.checkInUrl.startsWith("/")?`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,"")}${qr.checkInUrl}`:qr.checkInUrl;
            const image=await QRCode.toDataURL(url,{width:250,margin:2});
            const section=documentOut.createElement("section");section.style.cssText="page-break-after:always;padding:24px;font-family:sans-serif";
            const heading=documentOut.createElement("h2");heading.textContent="ClinicFlow · Private appointment ticket";
            const detail=documentOut.createElement("p");detail.style.whiteSpace="pre-line";detail.textContent=`${a.patientName}\n${a.reference} · Token ${a.token}\n${a.clinicName} · ${a.branchName}\n${a.doctorName} · ${a.date}\nSession ${a.startTime||"—"}–${a.endTime||"—"}\n${a.status}\nToken is not queue position. Staff must explicitly confirm consultation check-in.`;
            const img=documentOut.createElement("img");img.src=image;img.alt="Private appointment QR";
            section.append(heading,detail,img);documentOut.body.append(section);
          }
          messages.push(`${a.reference}: ${kind==="cancel"?"cancelled":"prepared"}.`);
        }catch(e){messages.push(`${id}: failed — ${e instanceof Error?e.message:"request rejected"}`);}
      }
      if(kind==="csv"&&records.length) {
        const cell=(v:unknown)=>`"${String(v??"").replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')}"`;
        download([["Reference","Patient","Clinic","Branch","Doctor","Date","Session start","Session end","Token","Status"],...records.map(a=>[a.reference,a.patientName,a.clinicName,a.branchName,a.doctorName,a.date,a.startTime,a.endTime,a.token,a.status])].map(row=>row.map(cell).join(",")).join("\r\n"),"text/csv;charset=utf-8","selected-appointments.csv");
      }
      if(kind==="download"&&documentOut.body.children.length)download("<!doctype html>"+documentOut.documentElement.outerHTML,"text/html","private-appointment-tickets.html");
      if(popup){popup.document.replaceChild(popup.document.importNode(documentOut.documentElement,true),popup.document.documentElement);await Promise.all(Array.from(popup.document.images).map(img=>img.decode()));popup.focus();popup.print();}
      if(kind==="cancel"){await client.invalidateQueries();setConfirm(false);onClear();}
    }catch(e){setError(e);popup?.close();}finally{setResults(messages);lock.current=false;setBusy(false);}
  }
  return <><div className="appt-bulk"><strong>{ids.length} selected</strong><button disabled={!ids.length||disabled||busy} onClick={()=>void run("csv")}>Export CSV</button><button disabled={!ids.length||disabled||busy} onClick={()=>void run("print")}>Print QR tickets</button><button disabled={!ids.length||disabled||busy} onClick={()=>void run("download")}>Download QR tickets</button><button disabled={!ids.length||disabled||busy} onClick={()=>setConfirm(true)}>Cancel selected</button><button disabled={busy||!ids.length} onClick={onClear}>Clear</button></div><ErrorNotice error={error}/>{results.length>0&&<details open><summary>Bulk operation results</summary><ul>{results.map((result,i)=><li key={i}>{result}</li>)}</ul></details>}<AppDialog open={confirm} onClose={()=>setConfirm(false)} title={`Cancel ${ids.length} selected appointments?`} busy={busy} dirty={!!reason}><p>Each appointment is revalidated. Ineligible appointments are skipped; failures are reported individually. Cancellation cannot be undone.</p><label>Required cancellation reason<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="button" disabled={busy||disabled||!reason.trim()} onClick={()=>void run("cancel")}>{busy?"Cancelling…":"Confirm cancellations"}</button></AppDialog></>;
}