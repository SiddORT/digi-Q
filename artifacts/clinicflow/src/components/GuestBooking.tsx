import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as api from "@workspace/api-client-react";
import { Form } from "./ui/form";
import { CareLookup } from "./CareLookup";
import { ErrorNotice, today } from "../resources";
import { useFreshWorkspace } from "./queue/useFreshWorkspace";
import { canPollGuestReceipt, guestReceiptText } from "../guest-receipt";

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
 const params={branchId,doctorId,date};
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=today(context.branchTimezone||undefined);
 const availability=api.useGetPublicAvailability(params,{query:{queryKey:api.getGetPublicAvailabilityQueryKey(params),enabled:!!branchId&&!!doctorId&&validDate,refetchInterval:30000}});
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
  const data:api.GuestRequestInput={qrReference:reference,branchId,doctorId,date,fullName:values.fullName.trim(),email:values.email.trim()||undefined,mobile:values.mobile.trim()||undefined,requestId:crypto.randomUUID(),receiptSecret:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")};
  try{sessionStorage.setItem(storageKey,JSON.stringify(data));}catch{setStorageError("This browser cannot save your receipt. Keep this page open and ask reception for help before closing it.");}
  setAttempt(data);void send(data);
 }
 function printReceipt() {
  if(!receipt||receiptFresh.stale)return;
  const popup=window.open("","_blank","width=650,height=750");
  if(!popup){setStorageError("Allow pop-ups to print your receipt.");return;}
  popup.opener=null;popup.document.title="ClinicFlow visit receipt";
  const text=popup.document.createElement("pre");text.style.cssText="white-space:pre-wrap;font:18px sans-serif;line-height:1.6";
  text.textContent=guestReceiptText(receipt);
  popup.document.body.append(text);popup.focus();popup.print();
 }
 if(attempt)return <section aria-label="Your guest request" data-testid="guest-receipt">
  <h2>{receipt?.status==="confirmed"?"Your visit is confirmed":receipt?.status==="rejected"?"Request declined":receipt?"Awaiting reception confirmation":"Checking your request"}</h2>
  {!receipt&&<p>{attempt.fullName} · {attempt.date}</p>}
  {receipt?<><p>{receipt.fullName} · {receipt.doctorName}</p><p>{receipt.clinicName} · {receipt.branchName}<br/>{receipt.date} · {receipt.startTime}–{receipt.endTime} · {receipt.timezone}</p>
  {receipt.status==="pending"&&<p className="notice">Reception must confirm this request. It does not reserve capacity or a queue place. No token has been issued.</p>}
  {receipt.status==="confirmed"&&<p className="notice" data-testid="guest-token">Your token: <strong>{receipt.token}</strong>. This is not your queue position.</p>}
  {receipt.status==="rejected"&&<p role="status">{receipt.reason||"Please speak to reception."}</p>}
  <button className="button secondary" data-testid="button-print-guest" disabled={receiptFresh.stale||status.isPending} onClick={printReceipt}>Print receipt</button></>:<p>Keep this page open while we check. Do not send a second request.</p>}
  <ErrorNotice error={create.error}/><ErrorNotice error={storageError}/>
   {committed&&(status.error||(updated>0&&receiptFresh.stale)||!receiptFresh.online)&&<p role="alert">Receipt status is unavailable or out of date. Reconnect and retry. If your receipt cannot be recovered, ask reception; do not submit another request.</p>}
   {committed&&<button className="button secondary" data-testid="button-refresh-guest" disabled={!pollAllowed||status.isPending} onClick={()=>pollRef.current()}>Refresh status</button>}
   {!committed&&!create.isPending&&<><p>We have not received confirmation that your request was saved. Retry the same request safely below; this will not create a second request.</p><button className="button" data-testid="button-retry-guest" onClick={()=>void send(attempt)}>Retry same request</button></>}
  <p className="muted">This private receipt is saved only in this browser tab. Closing the tab or clearing browser data can lose access. Ask reception if it is lost; there is no public name search. No message delivery is guaranteed.</p>
 </section>;
 const available=availability.data;
 return <section><h2>Book without an account</h2><p>Enter the patient's name and choose a visit. No account or verification code needed.</p>
 <Form {...form}><form onSubmit={form.handleSubmit(submit)}>
 <div className="form-grid">
 {!context.branchId&&<CareLookup publicAccess kind="branches" label="Location" value={branchId} params={{clinicId:context.clinicId,doctorId:context.doctorId,status:"active"}} onChange={v=>{setBranch(v);setDoctor(context.doctorId||"");}}/>}
 {!context.doctorId&&<CareLookup publicAccess kind="doctors" label="Doctor" value={doctorId} disabled={!branchId} params={{clinicId:context.clinicId,branchId,status:"active"}} onChange={setDoctor}/>}
 <label>Visit date<input data-testid="input-guest-date" type="date" required min={today(available?.timezone)} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>Patient's name<input data-testid="input-guest-name" autoComplete="name" maxLength={150} {...form.register("fullName",{required:true,validate:v=>!!v.trim()})}/></label>
 </div>
 <details><summary data-testid="toggle-guest-contact" style={{padding:"14px 0",cursor:"pointer"}}>Add contact details (optional)</summary><div className="form-grid">
 <label>Email (optional)<input data-testid="input-guest-email" type="email" maxLength={254} autoComplete="email" {...form.register("email")}/></label>
 <label>Mobile (optional, with country code)<input data-testid="input-guest-mobile" type="tel" autoComplete="tel" placeholder="+ country code and number" maxLength={16} {...form.register("mobile",{validate:v=>!v.trim()||/^\+[1-9][0-9]{7,14}$/.test(v.trim())})}/></label>
 </div></details>
 {form.formState.errors.fullName&&<p role="alert">Enter the patient's name.</p>}
 {form.formState.errors.mobile&&<p role="alert">Open contact details and enter + followed by your country code and number (8–15 digits), or leave mobile blank.</p>}
 <ErrorNotice error={create.error}/>
 <p className="muted">Without contact details, we cannot send updates or recover your receipt remotely. You may give a family member's contact with their permission. This does not link the visit to their account. If you lose this receipt, ask reception rather than sending another request.</p>
 <label className="check-label"><input data-testid="input-guest-permission" type="checkbox" {...form.register("permission",{required:true})}/> I have permission to request this visit and share any contact details provided.</label>
 {form.formState.errors.permission&&<p role="alert">Please confirm permission to continue.</p>}
 <div className="availability-box">{availability.isFetching?"Checking session…":available?<><strong>{available.available&&available.remainingTokens>0?"Available session":"Session unavailable"}</strong><p>{available.startTime}–{available.endTime} · {available.timezone}</p>{(!available.available||available.remainingTokens<=0)&&<p>{available.reason||"Session full. Choose another date."}</p>}</>:<p>Choose a location and doctor to see the session.</p>}</div>
 <ErrorNotice error={availability.error}/>{(availability.error||fresh.stale)&&branchId&&doctorId&&<button type="button" data-testid="button-retry-guest-availability" onClick={()=>availability.refetch()}>Refresh availability</button>}
 <p className="notice">Your request needs reception confirmation. No place or token is reserved until staff confirms.</p>
 <button className="button" data-testid="button-submit-guest" disabled={fresh.stale||availability.isFetching||!available?.available||available.remainingTokens<=0||create.isPending} type="submit">Request visit</button>
 </form></Form></section>;
}