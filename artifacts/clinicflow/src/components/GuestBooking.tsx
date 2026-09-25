import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as api from "@workspace/api-client-react";
import { Form } from "./ui/form";
import { CareLookup } from "./CareLookup";
import { ErrorNotice, today } from "../resources";
import { useFreshWorkspace } from "./queue/useFreshWorkspace";
import { canPollGuestReceipt } from "../guest-receipt";
import { SessionSelector, useDailySession } from "./queue/SessionSelector";
import { VisitTicket, bookingStatusLabel, type TicketData } from "./tickets/VisitTicket";

const toTicket=(r:api.GuestReceipt):TicketData=>({patientName:r.fullName,clinicName:r.clinicName,branchName:r.branchName,address:r.branchAddress,doctorName:r.doctorName,date:r.date,startTime:r.startTime,endTime:r.endTime,timezone:r.timezone,waitingNumber:r.token,reference:r.reference,statusLabel:bookingStatusLabel(r.appointmentStatus),qrUrl:r.checkInUrl});

export function GuestBooking({reference,context}:{reference:string;context:api.QrContext}) {
 const storageKey=`clinicflow-guest:${reference}`;
 const [storageError,setStorageError]=useState("");
 const [attempt,setAttempt]=useState<api.GuestRequestInput|null>(()=>{try{return JSON.parse(sessionStorage.getItem(storageKey)||"null");}catch{return null;}});
 const [committed,setCommitted]=useState(()=>{try{return !!attempt&&sessionStorage.getItem(`${storageKey}:committed`)===attempt.requestId;}catch{return false;}});
 const [receipt,setReceipt]=useState<api.GuestReceipt|null>(null);
 const [updated,setUpdated]=useState(0);
 const [branchId,setBranch]=useState(context.branchId||"");
 const [doctorId,setDoctor]=useState(context.doctorId||"");
 const [date,setDate]=useState(today(context.branchTimezone||undefined));
 const lock=useRef(false);
 const form=useForm({defaultValues:{fullName:"",email:"",mobile:"",permission:false}});
 const selection=useDailySession({branchId,doctorId,date});
 const availability=selection.availability;
 const fresh=useFreshWorkspace(availability.dataUpdatedAt,!!availability.error);
 const accept=(value:api.GuestReceipt)=>{setReceipt(value);setUpdated(Date.now());};
 const create=api.useCreateGuestRequest({mutation:{onSuccess:(value,variables)=>{
  accept(value);setCommitted(true);
  try{sessionStorage.setItem(`${storageKey}:committed`,variables.data.requestId);}catch{setStorageError("Keep this page open. Your browser could not save receipt recovery; ask reception if you lose access.");}
 },onError:error=>{
  if([400,403,404,429].includes(error.status)){
   setAttempt(null);
   try{sessionStorage.removeItem(storageKey);}catch{/* The visible storage warning remains. */}
  }
 },gcTime:0}});
 const status=api.useGetGuestReceipt({mutation:{onSuccess:accept,gcTime:0}});
 const receiptFresh=useFreshWorkspace(updated,!!status.error);
 const pollAllowed=canPollGuestReceipt(committed,attempt?.receiptSecret,create.isPending);
 const pollRef=useRef(()=>{});
 pollRef.current=()=>{if(pollAllowed&&attempt&&navigator.onLine&&!status.isPending)status.mutate({data:{receiptSecret:attempt.receiptSecret}});};
 useEffect(()=>{
  if(!pollAllowed)return;
  // Creation already returned a current receipt. Only resumed sessions need an immediate read.
  if(!updated)pollRef.current();
  const timer=window.setInterval(()=>pollRef.current(),20000);
  return()=>clearInterval(timer);
 },[pollAllowed,updated===0]);
 async function send(data:api.GuestRequestInput) {
  if(lock.current)return;lock.current=true;
  try{await create.mutateAsync({data});}catch{/* Mutation renders its error; retained request makes retries idempotent. */}finally{lock.current=false;}
 }
 function submit(values:{fullName:string;email:string;mobile:string;permission:boolean}) {
  if(lock.current)return;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const data:api.GuestRequestInput={qrReference:reference,branchId,doctorId,date,sessionId:selection.sessionId||undefined,fullName:values.fullName.trim(),email:values.email.trim()||undefined,mobile:values.mobile.trim()||undefined,requestId:crypto.randomUUID(),receiptSecret:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")};
  try{sessionStorage.setItem(storageKey,JSON.stringify(data));}catch{setStorageError("This browser cannot save your receipt. Keep this page open and ask reception for help before closing it.");}
  setAttempt(data);void send(data);
 }
 const r=receipt;
 async function prepareExport(){
  if(!attempt||!r)throw new Error("Ticket not ready. Refresh and try again.");
  if(!navigator.onLine)throw new Error("You are offline. Reconnect and try again.");
  const first=await api.getGuestReceipt({receiptSecret:attempt.receiptSecret});
  const second=await api.getGuestReceipt({receiptSecret:attempt.receiptSecret});
  if(first.revision!==second.revision||first.appointmentStatus!==second.appointmentStatus||first.status!==second.status)throw new Error("Your booking changed while preparing the ticket. Try again.");
  accept(second);
  if(second.status==="pending"||second.status==="rejected")throw new Error("This booking has no issued ticket.");
  if(!second.checkInUrl)throw new Error("Your personal QR is not available. Refresh and try again.");
  return toTicket(second);
 }
 const issued=r&&r.status!=="pending"&&r.status!=="rejected";
 if(attempt)return <section aria-label="Your visit ticket" data-testid="guest-receipt">
  <h2>{issued?"You're booked":r?.status==="rejected"?"Booking not available":r?"Booking received":"Issuing your ticket"}</h2>
  {!r&&<p role="status">{attempt.fullName} · {attempt.date}. Keep this page open; do not book again.</p>}
  {issued&&r&&<VisitTicket testId="guest-ticket" ticket={toTicket(r)} prepareExport={prepareExport} exportDisabled={!committed||status.isPending}/>}
  {r?.status==="pending"&&<p className="notice">This earlier request is still with reception. No waiting number has been issued yet.</p>}
  {r?.status==="rejected"&&<p role="status">{r.reason||"Please speak to reception."}</p>}
  {receiptFresh.stale&&updated>0&&<p className="muted">Ticket shown as last loaded.</p>}
  <ErrorNotice error={create.error}/><ErrorNotice error={storageError}/>
  {committed&&(status.error||!receiptFresh.online)&&<p role="alert">We could not refresh your ticket. Reconnect and retry. If it cannot be recovered, ask reception; do not book again.</p>}
  {committed&&<button className="button secondary" data-testid="button-refresh-guest" disabled={!pollAllowed||status.isPending} onClick={()=>pollRef.current()}>Refresh ticket</button>}
  {!committed&&!create.isPending&&<><p>We did not receive confirmation that your booking was saved. Retry safely below; it will not create a second booking.</p><button className="button" data-testid="button-retry-guest" onClick={()=>void send(attempt)}>Retry booking</button></>}
  <p className="muted">Download or print your ticket now. It is recoverable only in this browser tab; there is no public name search. If it is lost, ask reception.</p>
 </section>;
 const available=availability.data;
 return <section><h2>Book a visit</h2><p>Enter the patient's name and choose a session. No account needed; your ticket is issued straight away.</p>
 <Form {...form}><form onSubmit={form.handleSubmit(submit)}>
 <div className="form-grid">
 {!context.branchId&&<CareLookup publicAccess kind="branches" label="Location" value={branchId} params={{clinicId:context.clinicId,doctorId:context.doctorId,status:"active"}} onChange={v=>{setBranch(v);setDoctor(context.doctorId||"");}}/>}
 {!context.doctorId&&<CareLookup publicAccess kind="doctors" label="Doctor" value={doctorId} disabled={!branchId} params={{clinicId:context.clinicId,branchId,status:"active"}} onChange={setDoctor}/>}
 <label>Visit date<input data-testid="input-guest-date" type="date" required min={today(available?.timezone)} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <SessionSelector selection={selection}/>
 <label>Patient's name<input data-testid="input-guest-name" autoComplete="name" maxLength={150} {...form.register("fullName",{required:true,validate:v=>!!v.trim()})}/></label>
 </div>
 <details><summary data-testid="toggle-guest-contact" style={{padding:"14px 0",cursor:"pointer"}}>Add contact details (optional)</summary><div className="form-grid">
 <label>Email (optional)<input data-testid="input-guest-email" type="email" maxLength={254} autoComplete="email" {...form.register("email")}/></label>
 <label>Mobile (optional, with country code)<input data-testid="input-guest-mobile" type="tel" autoComplete="tel" placeholder="+ country code and number" maxLength={16} {...form.register("mobile",{validate:v=>!v.trim()||/^\+[1-9][0-9]{7,14}$/.test(v.trim())})}/></label>
 </div></details>
 {form.formState.errors.fullName&&<p role="alert">Enter the patient's name.</p>}
 {form.formState.errors.mobile&&<p role="alert">Open contact details and enter + followed by your country code and number (8–15 digits), or leave mobile blank.</p>}
 <ErrorNotice error={create.error}/>
 <p className="muted">Contact details are optional. Without them we cannot send updates. You may give a family member's contact with their permission; it does not link the visit to their account.</p>
 <label className="check-label"><input data-testid="input-guest-permission" type="checkbox" {...form.register("permission",{required:true})}/> I have permission to book this visit and share any contact details provided.</label>
 {form.formState.errors.permission&&<p role="alert">Please confirm permission to continue.</p>}
 <div className="availability-box">{availability.isFetching?"Checking session…":available?<><strong>{available.available&&available.remainingTokens>0?"Available session":"Session unavailable"}</strong><p>{available.startTime}–{available.endTime} · {available.timezone}</p>{(!available.available||available.remainingTokens<=0)&&<p>{available.reason||"Session full. Choose another date."}</p>}</>:<p>Choose a location and doctor to see the session.</p>}</div>
 <ErrorNotice error={availability.error}/>{(availability.error||fresh.stale)&&branchId&&doctorId&&<button type="button" data-testid="button-retry-guest-availability" onClick={()=>availability.refetch()}>Refresh availability</button>}
 <p className="notice">Your ticket shows a session time range, not an exact consultation time.</p>
 <button className="button" data-testid="button-submit-guest" disabled={fresh.stale||availability.isFetching||!available?.available||available.remainingTokens<=0||create.isPending} type="submit">{create.isPending?"Booking…":"Book Now"}</button>
 </form></Form></section>;
}