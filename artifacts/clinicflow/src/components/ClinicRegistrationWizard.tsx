import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { Building2, Check, ChevronRight, Plus } from "lucide-react";
import { Logo } from "../App";
import { ClinicRegistrationHours, newWeek, validateWeek, type RegistrationDay } from "./ClinicRegistrationHours";
import "./clinic-registration.css";
import { formatDate, formatTime, type DateTimePreferences } from "../lib/date-time";
import { SearchableSelect } from "./SearchableSelect";
import { TimezoneSelect } from "./TimezoneSelect";
import { FormField } from "./FormField";
import { required as requireValue, validatePersonName, validatePhone, validateEmail, normalizePhone } from "../lib/validators";
import { useConfirm } from "./ConfirmDialog";
import { friendlyError } from "../lib/friendly-error";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { PhoneInput } from "./PhoneInput";

export const publishedClinicBase = "https://clinic-flow-new-platform.replit.app";
export const normalizeClinicSlug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
export type RegistrationBranch = { name: string; slug: string; address: string; city: string; timezone: string; email: string; phone: string; inheritEmail: boolean; inheritPhone: boolean; hours: RegistrationDay[] };
export type RegistrationValues = {
  dateFormat: DateTimePreferences["dateFormat"]; timeFormat: DateTimePreferences["timeFormat"];
  fullName: string; email: string; mobile: string;
  name: string; slug: string; categoryId: string; specialityIds: string[]; referralCode: string; clinicEmail: string; phone: string;
  branches: RegistrationBranch[]; alsoConsult: boolean; specializationId: string; qualificationIds: string[];
  linkConsultationHours: boolean; sessionCapacity: string; consultationMinutes: string;
};
const newBranch = (): RegistrationBranch => ({ name: "", slug: "", address: "", city: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", email: "", phone: "", inheritEmail: true, inheritPhone: true, hours: newWeek() });
type Option = { id: string; name: string };
type Props = { adminMode?: boolean; initial?: Partial<RegistrationValues>; categories: Option[]; specialities: Option[]; qualifications: Option[]; onSubmit: (values: RegistrationValues) => Promise<void>; checkSlug: (slug: string) => Promise<boolean>; busy: boolean; error?: string; referenceError?: string; finishSecurity?: ReactNode; onStepChange?: () => void };
const steps = ["Clinic identity", "Locations", "Opening hours", "Your practice", "Care team", "Review"];

export function ClinicRegistrationWizard({ adminMode, initial, categories, specialities, qualifications, onSubmit, checkSlug, busy, error, referenceError, finishSecurity, onStepChange }: Props) {
  const confirmation=useConfirm();
  const [,navigate]=useLocation();
  const [step, setStep] = useState(0);
  useEffect(()=>{onStepChange?.();},[step,onStepChange]);
  const [validation, setValidation] = useState("");
  const [slugStatus, setSlugStatus] = useState<{ slug: string; available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const form = useForm<RegistrationValues>({ defaultValues: { dateFormat: "DD MMM YYYY", timeFormat: "12h", fullName: "", email: "", mobile: "", name: "", slug: "", categoryId: "", specialityIds: [], referralCode: "", clinicEmail: "", phone: "", branches: [newBranch()], alsoConsult: false, specializationId: "", qualificationIds: [], linkConsultationHours: true, sessionCapacity: "", consultationMinutes: "", ...initial } });
  const values = form.watch();
  const set = form.setValue;
  const updateBranch = (index: number, patch: Partial<RegistrationBranch>) => set("branches", values.branches.map((b, i) => i === index ? { ...b, ...patch } : b), { shouldDirty: true });
  function validate(target: number) {
    if (target === 0 && (!values.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug) || values.slug.length < 3 || !values.fullName.trim() || !values.email.trim())) return "Complete the administrator name, email, clinic name and a valid public address (at least 3 characters).";
    if (target === 1 && values.branches.some(b => !b.name.trim() || !b.address.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.slug) || b.slug.length < 3 || !b.timezone.trim())) return "Each location needs a name, address, timezone and valid URL slug (at least 3 characters).";
    if (target === 1 && new Set(values.branches.map(b => b.slug)).size !== values.branches.length) return "Each location needs a different URL slug.";
    if(target===1&&values.branches.some(b=>(!b.inheritEmail&&validateEmail(b.email))||(!b.inheritPhone&&validatePhone(b.phone))))return "Correct the clinic contact fields below.";
    if (target === 2) for (const branch of values.branches) { const message = validateWeek(branch.hours); if (message) return `${branch.name}: ${message}`; }
    if (target === 3 && values.alsoConsult && values.linkConsultationHours) {
      if (![values.sessionCapacity, values.consultationMinutes].every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0)) return "Enter a positive whole-number patient capacity and consultation duration.";
      if (values.branches.some(branch => !branch.hours.some(day => day.isOpen && day.sessions.length))) return "Each linked location needs at least one open interval. Return to Opening hours or choose custom consultation hours.";
    }
    return "";
  }
  async function next() {
    setValidation("");
    if(step===0&&!await form.trigger(["fullName","email","mobile","name","clinicEmail","phone"],{shouldFocus:true}))return;
    const problem = validate(step);
    if (problem) return setValidation(problem);
    if (step === 0) {
      if (["doctor", "patient", "receptionist", "audit", "qrs", "exceptions", "health", "healthz", "robots", "sitemap"].includes(values.slug)) return setValidation("This address is reserved for the application. Choose a clinic-specific name.");
      setChecking(true);
      try { const available = await checkSlug(values.slug); setSlugStatus({ slug: values.slug, available }); if (!available) { setValidation("This clinic address is unavailable. Try adding your city or a distinctive clinic name."); return; } }
       catch (e) { setValidation(friendlyError(e,"load")); return; }
      finally { setChecking(false); }
    }
    setStep(s => s + 1);
  }
  async function finish() {
    for (let i = 0; i < steps.length - 1; i++) { const problem = validate(i); if (problem) { setValidation(problem); setStep(i); return; } }
    setValidation("");
     try { await onSubmit({...values,mobile:normalizePhone(values.mobile),phone:normalizePhone(values.phone),branches:values.branches.map(branch=>({...branch,phone:normalizePhone(branch.phone)}))}); } catch (e) { setValidation(friendlyError(e,"save")); }
  }
   const field = (key: "fullName" | "email" | "mobile" | "name" | "referralCode" | "clinicEmail" | "phone", label: string, required = false, type = "text") => type==="tel"?<Controller name={key} control={form.control} rules={{validate:value=>(required?requireValue()(value):undefined)||validatePhone(value)||true}} render={({field:input})=><FormField label={label} required={required} optional={!required} error={form.formState.errors[key]?.message}><PhoneInput {...input} value={input.value||""}/></FormField>}/>:<FormField label={label} required={required} optional={!required&&!label.includes("(optional)")} error={form.formState.errors[key]?.message}><input {...form.register(key,{validate:value=>(required?requireValue()(value):undefined)||(key==="fullName"?validatePersonName(value):undefined)||(type==="email"?validateEmail(value):undefined)||true})} type={type} data-testid={`registration-${key}`} readOnly={!adminMode && key === "email"}/></FormField>;
  return <div className="clinic-registration"><header className="registration-header"><Logo/><Link href={adminMode ? "/admin/users" : "/sign-in"} data-testid="registration-exit" onClick={async event=>{event.preventDefault();if(busy||checking)return;if(!form.formState.isDirty||await confirmation.ask({title:"Discard clinic setup?",description:"Nothing has been saved. Leaving will discard your entered setup.",confirmLabel:"Discard setup",tone:"danger"}))navigate(adminMode?"/admin/users":"/sign-in");}}>Back to {adminMode ? "workspace" : "staff login"}</Link></header><div className="registration-layout"><aside className="registration-progress"><span className="eyebrow">REGISTER A CLINIC</span><h2>Built around your care.</h2><ol>{steps.map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined}>{i < step ? <Check size={14}/> : `${i + 1}.`} {label}{step===5&&i<5&&<button type="button" onClick={()=>{setValidation("");setStep(i);}}>Edit</button>}</li>)}</ol><small>Your setup stays in memory while this page is open. Nothing is saved until you finish. Passwords are handled only by secure account authentication.</small></aside><main className="registration-card"><span className="eyebrow">STEP {step + 1} OF {steps.length}</span><h1>{steps[step]}</h1><p>{["Give your clinic a home and a memorable public address.", "One clinic, one owner. Add each place where your team provides care.", "Set opening hours for every clinic. Doctor availability is managed separately.", "Choose whether the owner also consults at this clinic.", "Bring your team in when you are ready.", "Check the details before creating your clinic."][step]}</p>{referenceError && <div className="error-box" role="alert">{friendlyError(referenceError,"load")}</div>}<form onSubmit={event => { event.preventDefault(); if (busy || checking) return; void (step === steps.length - 1 ? finish() : next()); }}>
    {confirmation.dialog}<fieldset disabled={busy || checking} style={{ border: 0, padding: 0, minWidth: 0 }}>
    {step===1&&<p className="registration-note">A clinic is a physical care location in your Clinic Group. Each clinic has its own booking address, timetable and timezone. Inherited email and phone details are public clinic contacts; they do not change staff login emails or configure email/SMS delivery.</p>}
    {step === 1 && <DateTimeFormatFields value={values} onChange={patch => { if (patch.dateFormat) set("dateFormat", patch.dateFormat, { shouldDirty: true }); if (patch.timeFormat) set("timeFormat", patch.timeFormat, { shouldDirty: true }); }}/>}
    {step === 0 && <div className="registration-fields">
      {field("fullName","Administrator full name",true)}{field("email","Administrator email",true,"email")}{adminMode&&field("mobile","Administrator phone",false,"tel")}{field("name","Clinic Group name",true)}
      <Controller name="categoryId" control={form.control} render={({field:input})=><SearchableSelect label="Category (optional)" value={input.value} onChange={input.onChange} options={categories.map(o=>({value:o.id,label:o.name}))}/>}/>
      {field("clinicEmail","Clinic Group email",false,"email")}{field("phone","Clinic Group phone",false,"tel")}
      <Controller name="specialityIds" control={form.control} render={({field:input})=><SearchableMultiSelect label="Specialities (optional)" value={input.value} onChange={input.onChange} options={specialities.map(o=>({value:o.id,label:o.name}))}/>}/>
      {field("referralCode","Reference / referral code (optional)")}
      <label className="wide">Public clinic address *<input value={values.slug} onChange={e=>{set("slug",e.target.value.toLowerCase(),{shouldDirty:true});setSlugStatus(null);}} required minLength={3} maxLength={63} data-testid="registration-slug"/><button type="button" className="text-link" data-testid="registration-suggest-slug" onClick={()=>{set("slug",normalizeClinicSlug(values.name),{shouldDirty:true});setSlugStatus(null);}}>Suggest from clinic name</button>{validation&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)&&<small className="field-error">Use lowercase letters, numbers and hyphens between words.</small>}</label>
      <div className="registration-url wide"><strong>Published base address · read only</strong><br/>{publishedClinicBase}/<strong>{values.slug||"your-clinic"}</strong>{slugStatus?.slug===values.slug&&<p role="status">{slugStatus.available?"This address is currently available.":"This address is unavailable."}</p>}</div><p className="registration-note wide">Use lowercase letters, numbers and hyphens. Reserved application paths cannot be used. This address becomes permanent after registration; changing the clinic name will not change existing patient links.</p>
    </div>}
    {step === 1 && <><div className="notice">Each clinic has its own address and timezone. Email and phone inheritance are independent. Enter the address manually if suggestions are unavailable.</div>{values.branches.map((branch,index)=><details className="registration-branch" key={index} open><summary>{branch.name||`Clinic ${index+1}`}</summary><div className="registration-fields">
      {(["name","address","city","slug"] as const).map(key=><FormField key={key} label={{name:"Clinic name",address:"Street address",city:"City",slug:"Clinic URL slug"}[key]} required={key!=="city"} optional={key==="city"} error={validation&&!branch[key].trim()&&key!=="city"?"This field is required":undefined}><input value={branch[key]} required={key!=="city"} data-testid={`registration-branch-${index}-${key}`} onChange={e=>updateBranch(index,{[key]:key==="slug"?e.target.value.toLowerCase():e.target.value})}/></FormField>)}
      <TimezoneSelect value={branch.timezone} onChange={timezone=>updateBranch(index,{timezone})}/>
      <button type="button" className="text-link" onClick={()=>updateBranch(index,{slug:normalizeClinicSlug(branch.name)})}>Suggest URL from clinic name</button>
      <label className="registration-check"><input type="checkbox" checked={branch.inheritEmail} onChange={e=>updateBranch(index,{inheritEmail:e.target.checked})}/>Use Clinic Group email</label>
      {!branch.inheritEmail&&<FormField label="Clinic email" optional error={validateEmail(branch.email)}><input type="email" value={branch.email} onChange={e=>updateBranch(index,{email:e.target.value})}/></FormField>}
      <label className="registration-check"><input type="checkbox" checked={branch.inheritPhone} onChange={e=>updateBranch(index,{inheritPhone:e.target.checked})}/>Use Clinic Group phone</label>
      {!branch.inheritPhone&&<FormField label="Clinic phone" optional error={validatePhone(branch.phone)}><PhoneInput value={branch.phone} onChange={phone=>updateBranch(index,{phone})}/></FormField>}
    </div>{values.branches.length>1&&<button type="button" className="text-link" onClick={()=>set("branches",values.branches.filter((_,i)=>i!==index),{shouldDirty:true})}>Remove clinic</button>}</details>)}<button type="button" className="button secondary" onClick={()=>set("branches",[...values.branches,newBranch()],{shouldDirty:true})}><Plus size={16}/>Add another clinic</button></>}
    {step === 2 && values.branches.map((branch, index) => <details className="registration-branch" key={index} open={values.branches.length === 1 || undefined}><summary>{branch.name}</summary><ClinicRegistrationHours value={branch.hours} timezone={branch.timezone} preferences={values} onChange={hours => updateBranch(index, { hours })}/></details>)}
    {step === 3 && <><label className="registration-check"><input type="checkbox" {...form.register("alsoConsult")} data-testid="registration-also-consult"/>{adminMode ? "The clinic owner also consults as a doctor (solo practice)" : "I also consult as a doctor (solo practice)"}</label><p className="registration-note">The owner remains the sole Clinic Admin. A doctor profile adds clinical capabilities to this same account; it does not create another login or switch roles.</p>{values.alsoConsult && <div className="registration-fields"><Controller name="specializationId" control={form.control} render={({field:input})=><SearchableSelect label="Specialization (optional)" value={input.value} onChange={input.onChange} options={specialities.map(o=>({value:o.id,label:o.name}))}/>}/><Controller name="qualificationIds" control={form.control} render={({field:input})=><SearchableMultiSelect label="Qualifications (optional)" value={input.value} onChange={input.onChange} options={qualifications.map(o=>({value:o.id,label:o.name}))}/>}/><p className="registration-note wide">Use one linked timetable below, or choose custom consultation hours to configure separately after registration.</p></div>}</>}
    {step === 3 && values.alsoConsult && <section className="notice"><label className="check-label"><input type="checkbox" {...form.register("linkConsultationHours")} data-testid="registration-link-hours"/>Use clinic hours for my consultations</label><p>{values.linkConsultationHours ? "One timetable: finishing registration creates linked doctor sessions together with the clinic. Later opening-hour changes require a safe impact review." : "Custom consultation hours: configure doctor sessions after registration. The clinic will not yet accept patient bookings."}</p>{values.linkConsultationHours && <div className="form-grid"><label>Patients per session<input type="number" min="1" step="1" required {...form.register("sessionCapacity")} data-testid="registration-session-capacity"/></label><label>Consultation duration (minutes)<input type="number" min="1" step="1" required {...form.register("consultationMinutes")} data-testid="registration-consultation-minutes"/></label><p>Applies to every open interval at the chosen locations. Queue policy: patient appointments and walk-ins. Review capacity before finishing.</p></div>}</section>}
    {step === 4 && <section className="registration-review"><div className="notice"><Building2 size={22}/><h3>Your clinic comes first. Your team can follow.</h3><p>One clinic and one location are enough. Team invitations are optional. After registration, use Staff management to invite doctors and receptionists, choose their locations and track delivery. No second administrator or doctor account is required to consult yourself.</p><p>No invitations are sent from this step.</p></div></section>}
    {step === 5 && <div className="notice" role="status"><strong>{values.alsoConsult && values.linkConsultationHours ? "Linked consultation sessions included." : "Doctor sessions still need configuration."}</strong><p>{values.alsoConsult && values.linkConsultationHours ? `Finish saves your clinic and doctor sessions together: ${values.sessionCapacity} patients per session, ${values.consultationMinutes} minutes per consultation. Doctor sessions use each location's opening hours. Availability remains subject to date, capacity and booking policies.` : "Finish creates the clinic and opening hours. Set custom doctor sessions in Clinic settings before sharing the booking QR."}</p>Review every chosen open day and time below.</div>}
    {step === 5 && <div className="registration-review"><section><h3>{values.name}</h3><p>{values.clinicEmail || "No clinic email"} · {values.phone || "No clinic phone"}</p><p className="registration-url">{publishedClinicBase}/{values.slug}</p><p>Administrator: {values.fullName} · {values.email}</p></section>{values.branches.map((b, i) => <section key={i}><h3>{b.name}</h3><p>{b.address}{b.city ? `, ${b.city}` : ""}</p><p>{b.inheritEmail ? values.clinicEmail || "No clinic email" : b.email || "No location email"} · {b.inheritPhone ? values.phone || "No clinic phone" : b.phone || "No location phone"}</p><p>{b.hours.filter(d => d.isOpen).length} open days per week · {b.timezone}</p><small>/{values.slug}/{b.slug}</small></section>)}<section><h3>One owner, one account</h3><p>{values.alsoConsult ? "Clinic Admin and doctor in the same account, with a doctor profile at your clinic's locations." : "Clinic Admin account. No doctor profile requested."} Staff can be invited after setup; no extra user is required.</p></section><p className="registration-note">Finish saves the clinic setup together. The server rechecks ownership, URL availability and all details. Your public clinic and location addresses cannot be changed later.</p></div>}
    {step === 5 && <section aria-label="Weekly timetable review">{values.branches.map((branch,i)=><details key={i} open><summary>{branch.name} · weekly timetable</summary><ul>{branch.hours.map(day=><li key={day.dayOfWeek}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day.dayOfWeek]}: {day.isOpen?day.sessions.map(session=>`${session.startTime}–${session.endTime}`).join(", "):"Closed"}</li>)}</ul></details>)}</section>}
    {step === 5 && finishSecurity}</fieldset>{(validation || step===5&&error) && <div className="error-box" role="alert" data-testid="registration-error">{validation || friendlyError(error,"save")}</div>}<footer className="registration-footer"><button type="button" className="button secondary" disabled={step === 0 || busy || checking} data-testid="registration-back" onClick={() => { setValidation("");form.clearErrors(); setStep(s => s - 1); }}>Back</button><button className="button" disabled={busy || checking} data-testid="registration-next">{busy ? "Creating clinic…" : checking ? "Checking address…" : step === steps.length - 1 ? "Finish registration" : "Continue"}{!busy && <ChevronRight size={17}/>}</button></footer></form></main></div></div>;
}

export function DateTimeFormatFields({ value, onChange }: { value: Partial<DateTimePreferences>; onChange: (value: Partial<DateTimePreferences>) => void }) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  return <section className="registration-fields" aria-label="Date and time format"><h3 className="wide">Date and time format</h3>
    <SearchableSelect label="Date format" value={value.dateFormat || "DD MMM YYYY"} onChange={dateFormat => onChange({ dateFormat: dateFormat as DateTimePreferences["dateFormat"] })} options={(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const).map(dateFormat => ({ value: dateFormat, label: `${dateFormat} · ${formatDate(date, { ...value, dateFormat })}` }))}/>
    <SearchableSelect label="Time format" value={value.timeFormat || "12h"} onChange={timeFormat => onChange({ timeFormat: timeFormat as DateTimePreferences["timeFormat"] })} options={(["12h", "24h"] as const).map(timeFormat => ({ value: timeFormat, label: `${timeFormat === "12h" ? "12-hour with AM/PM" : "24-hour"} · ${formatTime("09:00", { ...value, timeFormat })}` }))}/>
    <p className="wide" role="status">Appointment on {formatDate(date, value)}, {formatTime("09:00", value)} – {formatTime("14:00", value)}</p><p className="registration-note wide">This format is inherited by every clinic in this Clinic Group, including patient-facing dates and times. Changing it changes display only, never stored dates, session times or bookings.</p>
  </section>;
}