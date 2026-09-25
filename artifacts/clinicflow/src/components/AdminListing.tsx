import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { AppDialog } from "./AppDialog";
import { csvCell, statusInput } from "./admin-listing-data";
import "./admin-listing.css";

export const recordName = (row:any) => row.fullName || row.name || row.code || row.id;
export const publicQrLink = (reference:string, display=false) => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,"")}/${display?"display":"book"}/${encodeURIComponent(reference)}`;
function download(body:string,name:string,type:string) {
  const url=URL.createObjectURL(new Blob([body],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function useListingSelection(context:string, rows:any[]) {
  const [state,setState]=useState<{context:string;ids:string[]}>({context,ids:[]});
  const ids=state.context===context?state.ids:[];
  useEffect(()=>setState(previous=>previous.context===context?previous:{context,ids:[]}),[context]);
  const selected=rows.filter(row=>ids.includes(row.id));
  const toggle=(id:string)=>setState(previous=>{
    const current=previous.context===context?previous.ids:[];
    return {context,ids:current.includes(id)?current.filter(value=>value!==id):[...current,id]};
  });
  const clear=()=>setState({context,ids:[]});
  const all=rows.length>0&&selected.length===rows.length;
  return {selected,clear,
    header:<input type="checkbox" data-testid="select-page" aria-label="Select all records on this page" aria-checked={selected.length>0&&!all?"mixed":all} ref={node=>{if(node)node.indeterminate=selected.length>0&&!all;}} checked={all} onChange={()=>setState({context,ids:all?[]:rows.map(row=>row.id)})}/>,
    checkbox:(row:any)=><input type="checkbox" data-testid={`select-${row.id}`} aria-label={`Select ${recordName(row)}`} checked={ids.includes(row.id)} onChange={()=>toggle(row.id)}/>
  };
}
export async function updateListingStatus(resource:string,row:any,status:"active"|"inactive",identity:api.Identity) {
  const role=identity.user?.role;
  if(!["superAdmin","clinicAdmin","doctor"].includes(role||""))throw new Error("You do not have permission to change status.");
  if(status==="inactive"&&(row.id===identity.user?.id||row.userId===identity.user?.id||(resource==="doctors"&&row.id===identity.doctorId)))throw new Error("You cannot deactivate your own account.");
  // These PATCH endpoints require their create-input fields. Do not resend assignments
  // from a scoped list: they may be only a subset of the account's assignments.
  if(resource==="clinics")return api.updateClinic(row.id,statusInput(resource,await api.getClinic(row.id),status));
  if(resource==="branches")return api.updateBranch(row.id,statusInput(resource,await api.getBranch(row.id),status));
  if(resource==="doctors"){
    if(role==="doctor"&&row.id!==identity.doctorId)throw new Error("Doctors may only edit their own doctor profile.");
    return api.updateDoctor(row.id,statusInput(resource,await api.getDoctor(row.id),status));
  }
  if(resource==="users"){
    if(role==="doctor"&&row.role!=="receptionist")throw new Error("Doctors may manage receptionists only.");
    if(role==="clinicAdmin"&&!["doctor","receptionist","patient"].includes(row.role))throw new Error("Administrators cannot change another administrator.");
    return api.updateUser(row.id,statusInput(resource,await api.getUser(row.id),status));
  }
  throw new Error("Status changes are not supported for this list.");
}
const html=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function ListingBulk({selection,resource,columns,identity,context}:{selection:ReturnType<typeof useListingSelection>;resource:string;columns:string[];identity?:api.Identity;context:string}) {
  const client=useQueryClient();
  const [action,setAction]=useState<"active"|"inactive"|null>(null);
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const [results,setResults]=useState<string[]>([]);
  useEffect(()=>{setAction(null);if(!lock.current)setResults([]);},[context]);
  const canStatus=identity&&["superAdmin","clinicAdmin","doctor"].includes(identity.user?.role||"")&&["clinics","branches","doctors","users"].includes(resource);
  async function run(status:"active"|"inactive"){
    if(lock.current||!identity)return;lock.current=true;setBusy(true);
    const rows=[...selection.selected], outcomes:string[]=[];
    try {
      for(const row of rows)try {await updateListingStatus(resource,row,status,identity);outcomes.push(`${recordName(row)}: ${status}.`);}catch(error){outcomes.push(`${recordName(row)}: failed — ${error instanceof Error?error.message:String(error)}`);}
      setResults(outcomes);selection.clear();setAction(null);await client.invalidateQueries();
    } finally {lock.current=false;setBusy(false);}
  }
  async function qrDocument(print:boolean){
    if(lock.current)return;lock.current=true;setBusy(true);setResults([]);
    const popup=print?window.open("","_blank"):null;
    if(print&&!popup){setResults(["Printing was blocked. Allow pop-ups and retry."]);lock.current=false;setBusy(false);return;}
    try{
      const cards:string[]=[],outcomes:string[]=[];
      for(const selected of selection.selected)try{
        const row=await api.getQr(selected.id);
        if(row.status!=="active")throw new Error("QR is inactive; skipped.");
        const url=publicQrLink(row.reference),image=await QRCode.toDataURL(url,{width:400,margin:2});
        cards.push(`<section><h2>${html(row.name)}</h2><img alt="Booking QR code" src="${image}"><p>${html(url)}</p></section>`);
        outcomes.push(`${recordName(row)}: QR prepared using current active reference.`);
      }catch(error){outcomes.push(`${recordName(selected)}: failed — ${error instanceof Error?error.message:String(error)}`);}
      setResults(outcomes);
      if(cards.length){
        const documentHtml=`<!doctype html><html><head><meta charset="utf-8"><title>Selected booking QR codes</title><style>body{font-family:sans-serif;color:#173332}section{text-align:center;break-inside:avoid;padding:24px;border-bottom:1px solid #ccc}img{width:240px}p{overflow-wrap:anywhere}@media print{button{display:none}}</style></head><body>${print?'<button onclick="window.print()">Print QR codes</button>':""}${cards.join("")}</body></html>`;
        if(popup){popup.document.open();popup.document.write(documentHtml);popup.document.close();}
        else download(documentHtml,"selected-booking-qrs.html","text/html;charset=utf-8");
      }else popup?.close();
    }catch(error){popup?.close();setResults([error instanceof Error?error.message:String(error)]);}finally{lock.current=false;setBusy(false);}
  }
  async function copyQrLinks(){
    if(lock.current)return;lock.current=true;setBusy(true);
    const links:string[]=[],outcomes:string[]=[];
    try{
      for(const selected of selection.selected)try{
        const row=await api.getQr(selected.id);
        if(row.status!=="active")throw new Error("Inactive QR; no link copied.");
        links.push(publicQrLink(row.reference));outcomes.push(`${recordName(row)}: active booking link included.`);
      }catch(error){outcomes.push(`${recordName(selected)}: failed — ${error instanceof Error?error.message:String(error)}`);}
      if(links.length){await navigator.clipboard.writeText(links.join("\n"));outcomes.push(`${links.length} public booking links copied.`);}
      setResults(outcomes);
    }catch(error){setResults([...outcomes,`Copy failed — ${error instanceof Error?error.message:String(error)}`]);}finally{lock.current=false;setBusy(false);}
  }
  return <div className="admin-listing-bulk">
    {selection.selected.length>0&&<div className="admin-bulk-bar" aria-label="Selected record actions"><strong>{selection.selected.length} selected on this page</strong>
      <button data-testid="button-clear-selected" disabled={busy} onClick={selection.clear}>Clear selection</button>
      <button data-testid="button-export-selected" disabled={busy} onClick={()=>download([columns.map(csvCell).join(","),...selection.selected.map(row=>columns.map(key=>csvCell(row[key])).join(","))].join("\r\n"),`${resource}-selected.csv`,"text/csv;charset=utf-8")}>Export selected CSV</button>
      {canStatus&&<><button data-testid="button-activate-selected" disabled={busy} onClick={()=>setAction("active")}>Activate</button><button data-testid="button-deactivate-selected" disabled={busy} onClick={()=>setAction("inactive")}>Deactivate</button></>}
      {resource==="qrs"&&<><button data-testid="button-print-selected-qrs" disabled={busy} onClick={()=>qrDocument(true)}>Print selected QRs</button><button data-testid="button-download-selected-qrs" disabled={busy} onClick={()=>qrDocument(false)}>Download QR sheet</button><button data-testid="button-copy-selected-qr-links" disabled={busy} onClick={copyQrLinks}>Copy booking links</button></>}
    </div>}
    {busy&&<p role="status">Processing selected records. Please wait…</p>}
    {!!results.length&&<details open className="notice"><summary>Per-record results</summary><ul>{results.map((result,index)=><li key={index}>{result}</li>)}</ul></details>}
    {action&&<AppDialog open title={`${action==="active"?"Activate":"Deactivate"} selected records?`} busy={busy} onClose={()=>{if(!busy)setAction(null);}}>
      <p>{action==="inactive"?"Inactive accounts lose access; inactive clinics, branches and doctors may no longer be available for booking. Existing history is retained.":"These records will become active and may be available for access or booking again."} Permissions and ownership protections are checked for every record. You cannot deactivate yourself. Administrator ownership must be transferred first; the last active super administrator is protected. Failures do not roll back successful changes.</p>
      <ul>{selection.selected.map(row=><li key={row.id}>{recordName(row)} → {action}</li>)}</ul>
      <button data-testid="button-confirm-bulk-status" className="button" disabled={busy||!selection.selected.length} onClick={()=>run(action)}>{busy?"Updating…":"Confirm status change"}</button>
    </AppDialog>}
  </div>;
}