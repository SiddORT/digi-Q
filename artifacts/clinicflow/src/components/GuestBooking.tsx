import { HoursWarning } from "./HoursWarning";
import { FormField } from "./FormField";
import { BookingSteps } from "./BookingSteps";
import { StagedBooking, BookingStageActions, BookingSummary } from "./booking/StagedBooking";
import { EmailInput } from "@/components/EmailInput";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DateFormatInput } from "./DateFormatInput";
import { PhoneInput } from "./PhoneInput";
import { validateEmail, validatePhone } from "../lib/validators";
import * as api from "@workspace/api-client-react";
import { Form } from "./ui/form";
import { CareLookup } from "./CareLookup";
import { ErrorNotice, today } from "../resources";
import { useFreshWorkspace } from "./queue/useFreshWorkspace";
import { canPollGuestReceipt } from "../guest-receipt";
import { SessionSelector, useDailySession, formatSessionHours } from "./queue/SessionSelector";
import { VisitTicket, bookingStatusLabel, type TicketData } from "./tickets/VisitTicket";
import { findNextBookableDate } from "./guest-booking-date";
import "./guest-booking.css";
import { confirmationEmailMessage } from "./appointments/confirmation-email";

const toTicket=(r:api.GuestReceipt):TicketData=>({dateFormat:r.dateFormat,timeFormat:r.timeFormat,patientName:r.fullName,clinicName:r.clinicName,branchName:r.branchName,address:r.branchAddress,doctorName:r.doctorName,date:r.date,startTime:r.startTime,endTime:r.endTime,timezone:r.timezone,waitingNumber:r.token,reference:r.reference,statusLabel:bookingStatusLabel(r.appointmentStatus),qrUrl:r.checkInUrl});

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
  const [finding,setFinding]=useState(false);
  const [dateMessage,setDateMessage]=useState("");
  const searchRun=useRef(0);
  const branchOptions=useQuery({queryKey:["guest-single-branch",context.clinicId,context.doctorId],enabled:!context.branchId,queryFn:()=>api.listPublicBranches({clinicId:context.clinicId,doctorId:context.doctorId||undefined,page:1,pageSize:2}),staleTime:30000});
  const doctorOptions=useQuery({queryKey:["guest-single-doctor",context.clinicId,branchId],enabled:!!branchId&&!context.doctorId,queryFn:()=>api.listPublicDoctors({clinicId:context.clinicId,branchId,page:1,pageSize:2}),staleTime:30000});
  useEffect(()=>{if(!context.branchId&&branchOptions.data?.total===1&&branchOptions.data.items[0]&&!branchId)setBranch(branchOptions.data.items[0].id);},[branchOptions.data,branchId,context.branchId]);
  useEffect(()=>{if(!context.doctorId&&doctorOptions.data?.total===1&&doctorOptions.data.items[0]&&branchId&&!doctorId)setDoctor(doctorOptions.data.items[0].id);},[doctorOptions.data,doctorId,branchId,context.doctorId]);
  useEffect(()=>{searchRun.current++;setFinding(false);setDateMessage("");},[branchId,doctorId]);
 const lock=useRef(false);
 const [step,setStep]=useState<1|2|3>(1);
 const form=useForm({defaultValues:{fullName:"",email:"",mobile:"",permission:false}});
 const selection=useDailySession({branchId,doctorId,date});
 const availability=selection.availability;
 const fresh=useFreshWorkspace(availability.dataUpdatedAt,!!availability.error);
  async function findNextDate(){
   if(!branchId||!doctorId||finding)return;
   const run=++searchRun.current;setFinding(true);setDateMessage("");
   try{
    const candidate=await findNextBookableDate(today(context.branchTimezone||availability.data?.timezone||undefined),date=>api.getPublicAvailabilitySessions({doctorId,branchId,date}),()=>run===searchRun.current);
    if(run!==searchRun.current)return;
    if(candidate){setDate(candidate);setDateMessage(`Next available date found: ${candidate}. Review the session and continue to confirm.`);}
    else setDateMessage("No bookable sessions were found in the next 14 days. Try another date or contact the clinic.");
   }catch(error){if(run===searchRun.current)setDateMessage(`Could not search for another date. ${error instanceof Error?error.message:"Please retry."}`);}
   finally{if(run===searchRun.current)setFinding(false);}
  }
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
  if(lock.current||step!==3)return; // Section E: only the explicit Confirmation stage creates a booking
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
 if(attempt)return <section aria-label="Your visit ticket" data-testid="guest-receipt"><BookingSteps step={issued?4:3}/>
  <h2>{issued?"You're Booked":r?.status==="rejected"?"Booking Not Available":r?"Booking Received":"Issuing Your Ticket"}</h2>
  {!r&&<p role="status">{attempt.fullName} · {attempt.date}. Keep this page open; do not book again.</p>}
  {issued&&r&&<>{confirmationEmailMessage(r.confirmationEmail)&&<p role="status">{confirmationEmailMessage(r.confirmationEmail)}</p>}<VisitTicket testId="guest-ticket" ticket={toTicket(r)} prepareExport={prepareExport} exportDisabled={!committed||status.isPending}/></>}
  {r?.status==="pending"&&<p className="notice">This earlier request is still with reception. No waiting number has been issued yet.</p>}
  {r?.status==="rejected"&&<p role="status">{r.reason||"Please speak to reception."}</p>}
  {receiptFresh.stale&&updated>0&&<p className="muted">Ticket shown as last loaded.</p>}
  <ErrorNotice error={create.error}/><ErrorNotice error={storageError}/>
  {committed&&(status.error||!receiptFresh.online)&&<p role="alert">We could not refresh your ticket. Reconnect and retry. If it cannot be recovered, ask reception; do not book again.</p>}
  {committed&&<button className="button secondary" data-testid="button-refresh-guest" disabled={!pollAllowed||status.isPending} onClick={()=>pollRef.current()}>Refresh Ticket</button>}
  {!committed&&!create.isPending&&<><p>We did not receive confirmation that your booking was saved. Retry safely below; it will not create a second booking.</p><button className="button" data-testid="button-retry-guest" onClick={()=>void send(attempt)}>Retry Booking</button></>}
  <p className="muted">Download or print your ticket now. It is recoverable only in this browser tab; there is no public name search. If it is lost, ask reception.</p>
 </section>;
 const available=availability.data;
 const values=form.watch();
 const canContinueVisit=!!branchId&&!!doctorId&&!(fresh.stale||availability.isFetching||!available?.available||available.remainingTokens<=0||available.queueMode==="walkInsOnly");
 async function continuePatient(){if(await form.trigger(["fullName","email","mobile","permission"]))setStep(3);}
  return <section className="guest-booking"><h2>Book a Visit</h2><p className="guest-intro">Choose a visit, add the patient's name, then review and confirm. No account or contact details are required.</p>
  <div className="guest-context" role="group" aria-label="Booking location and doctor"><strong>{context.clinicName}</strong>{(context.branchName||context.doctorName)&&<span>{[context.branchName,context.doctorName].filter(Boolean).join(" · ")}</span>}</div>
 <Form {...form}><form noValidate onSubmit={form.handleSubmit(submit)}>
 <StagedBooking testId="guest-staged-booking" step={step} visit={<><div className="form-grid cf-auto">
  {!context.branchId&&<CareLookup publicAccess kind="branches" label="Location" value={branchId} params={{clinicId:context.clinicId,doctorId:context.doctorId,status:"active"}} onChange={v=>{setBranch(v);setDoctor(context.doctorId||"");}} selectedLabel={branchOptions.data?.items.find(b=>b.id===branchId)?.name}/>}
  {!context.doctorId&&<CareLookup publicAccess kind="doctors" label="Doctor" value={doctorId} disabled={!branchId} params={{clinicId:context.clinicId,branchId,status:"active"}} onChange={setDoctor} selectedLabel={doctorOptions.data?.items.find(d=>d.id===doctorId)?.fullName}/>}
  <FormField label="Visit date" required><DateFormatInput data-testid="input-guest-date" required min={today(available?.timezone)} preferences={{...(context.dateFormat?{dateFormat:context.dateFormat}:{}),...(context.timeFormat?{timeFormat:context.timeFormat}:{})}} value={date} onChange={value=>{searchRun.current++;setFinding(false);setDateMessage("");setDate(value);}}/></FormField>
  {selection.sessions.length===1&&!availability.error?<div className="guest-session"><strong>Consulting session</strong><span>{formatSessionHours(selection.sessions[0])} · {selection.sessions[0].timezone}</span><small>Only session listed for this date. Availability is checked again when you book.</small></div>:<SessionSelector selection={selection}/>}
 </div>
  <div className="availability-box" data-testid="guest-availability-status">{availability.isFetching?"Checking session…":available?<><strong>{available.available&&available.remainingTokens>0&&available.queueMode!=="walkInsOnly"?"Available Session":"Session Unavailable"}</strong><p>{formatSessionHours(available)} · {available.timezone}</p><HoursWarning warning={available.hoursWarning}/>{available.queueMode==="walkInsOnly"?<p>This session accepts walk-ins only. Select another session or date for online booking.</p>:(!available.available||available.remainingTokens<=0)&&<p>{available.reason||"Session full. Choose another date."}</p>}</>:availability.error?<p>Could not check sessions. Retry below.</p>:!branchId||!doctorId?<p>Choose a location and doctor to see the sessions.</p>:selection.sessions.length>1?<p>Select one of the listed consulting sessions to check its availability.</p>:availability.isLoading?<p>Finding doctor sessions…</p>:<p>No doctor session is available for this date. Try another date or ask the clinic to configure its Weekly schedule.</p>}</div>
 <ErrorNotice error={availability.error}/>{(availability.error||fresh.stale)&&branchId&&doctorId&&<button type="button" data-testid="button-retry-guest-availability" onClick={()=>availability.refetch()}>Refresh Availability</button>}
  {branchId&&doctorId&&<div className="guest-next-date"><button type="button" className="button secondary" disabled={finding} onClick={()=>void findNextDate()} data-testid="button-next-guest-date">{finding?"Searching the next 14 days…":"Find Next Available Date"}</button>{dateMessage&&<p role="status">{dateMessage}</p>}</div>}
 <p className="notice">Your ticket shows a session time range, not an exact consultation time.</p>
 <BookingStageActions primaryLabel="Continue to Patient Details" primaryDisabled={!canContinueVisit} onPrimary={()=>setStep(2)} primaryTestId="button-guest-continue-visit"/></>} patient={<><div className="form-grid cf-auto">
 <FormField label="Patient's name" required><input data-testid="input-guest-name" autoComplete="name" maxLength={150} {...form.register("fullName",{required:true,validate:v=>!!v.trim()})}/></FormField>
 </div>
 <details><summary data-testid="toggle-guest-contact" style={{padding:"12px 0",cursor:"pointer"}}>Add contact details (optional)</summary><div className="form-grid cf-auto">
 <FormField label="Email" optional><EmailInput data-testid="input-guest-email" {...form.register("email", { validate: (v:unknown) => validateEmail(v)||true })}/></FormField>
 <Controller name="mobile" control={form.control} rules={{validate:v=>!v?.trim()||!validatePhone(v)}} render={({field})=><FormField label="Mobile" optional><PhoneInput {...field} value={field.value||""} data-testid="input-guest-mobile"/></FormField>}/>
 </div></details>
 {form.formState.errors.fullName&&<p role="alert">Enter the patient's name.</p>}
 {form.formState.errors.mobile&&<p role="alert">Open contact details, choose a country and enter a valid local number, or leave mobile blank.</p>}
 {form.formState.errors.email&&<p role="alert" data-testid="error-guest-email">{String(form.formState.errors.email.message||"Enter a valid email address.")}</p>}
  <p className="muted guest-note">Without contact details we cannot send updates. A family member's contact requires their permission and does not link this visit to their account.</p>
 <label className="check-label"><input data-testid="input-guest-permission" type="checkbox" {...form.register("permission",{required:true})}/> I have permission to book this visit and share any contact details provided.</label>
 {form.formState.errors.permission&&<p role="alert">Please confirm permission to continue.</p>}
 <BookingStageActions onBack={()=>setStep(1)} primaryLabel="Review and Confirm" onPrimary={()=>void continuePatient()} primaryTestId="button-guest-continue-patient"/></>} confirmation={<><BookingSummary rows={[["Clinic",context.clinicName],["Location",context.branchName||branchOptions.data?.items.find(b=>b.id===branchId)?.name],["Doctor",context.doctorName||doctorOptions.data?.items.find(d=>d.id===doctorId)?.fullName],["Visit date",date],["Session",available?`${formatSessionHours(available)} · ${available.timezone}`:""],["Patient",values.fullName.trim()],["Email",values.email.trim()],["Mobile",values.mobile.trim()]]}/>
 <p className="notice">Nothing is booked until you press Confirm Booking. Availability is checked again at that moment; your ticket shows a session range, not an exact time.</p>
 <ErrorNotice error={create.error}/>
 <BookingStageActions onChangeVisit={()=>setStep(1)} onBack={()=>setStep(2)} busy={create.isPending} primaryType="submit" primaryLabel={create.isPending?"Booking…":"Confirm Booking"} primaryDisabled={fresh.stale||availability.isFetching||!available?.available||available.remainingTokens<=0||available.queueMode==="walkInsOnly"} primaryTestId="button-submit-guest"/></>}/>
 </form></Form></section>;
}