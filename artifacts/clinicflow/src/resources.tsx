import { EmailInput } from "@/components/EmailInput";
import { titleCase } from "./lib/title-case";
import { OverflowText } from "./components/OverflowText";
import { Fragment, useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import { beginEditorSubmission } from "./components/editor-submission";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Link, useLocation, useSearch } from "wouter";
import { createPortal } from "react-dom";
import { Form } from "@/components/ui/form";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { Plus, Pencil, Trash2, Download, Copy, Monitor, QrCode, ArrowUp, ArrowDown, ArrowUpDown, ListFilter, ChevronRight, FileText } from "lucide-react";
import { ColumnSettings, SavedViews } from "./components/ListingViewControls";
import { arrangeColumns, useListingLayout } from "./lib/listing-views";
import { tabListKeyDown } from "./lib/tabs-a11y";
import { ClinicAdminOnboarding } from "./components/ClinicAdminOnboarding";
import { ResourceLookup, ResourceMultiLookup } from "./components/ResourceLookup";
import { validDependentIds } from "./components/relation-validity";
import { Pagination, SearchInput, FilterBar, useDebouncedValue, listingSuggestions, type FilterChip } from "./components/ListingControls";
import { AppDialog } from "./components/AppDialog";
import { SearchableSelect } from "./components/SearchableSelect";
import { SuggestionInput } from "./components/SuggestionInput";
import { emptyFieldValue, scheduleBreakFields, selectInputValue } from "./editor-input";
import { ListingBulk, useListingSelection, publicQrLink, CreatedCell } from "./components/AdminListing";
import { HelpTip } from "./components/HelpTip";
import { collectFilteredPatients, filteredPatientsCsv } from "./components/patient-export";
import { PATIENT_SECONDARY, secondaryFieldErrors } from "./lib/patient-details";
import { PatientDetailsDrawer } from "./components/PatientDetailsDrawer";
import { WeeklyScheduleEditor } from "./components/schedule/WeeklyScheduleEditor";
import { friendlyError } from "./lib/friendly-error";
import { required, validatePersonName, validatePhone, validateEmail, validateDateOfBirth, ageFromDateOfBirth, normalizePhone, validateNumberRange } from "./lib/validators";
import { formatDate, formatTime, formatConfiguredTimestamp } from "./lib/date-time";
import { TimezoneSelect } from "./components/TimezoneSelect";
import { DateFormatInput, TimeFormatInput } from "./components/DateFormatInput";
import { FormField } from "./components/FormField";
import { useConfirm } from "./components/ConfirmDialog";
import { notifySuccess } from "./lib/notify";
import { PhoneInput } from "./components/PhoneInput";
import { StatusSwitch } from "./components/StatusSwitch";
import { useDateTimePreferences } from "./components/DateTimePreferences";
import { TimeRangeSlider } from "./components/ClinicRegistrationHours";

export const title = (s:string) => titleCase({called:"Called Next",noShow:"Absent",branch:"Clinic",branches:"Clinics",branchName:"Clinic",branchNames:"Clinics",clinic:"Clinic Group",clinicName:"Clinic Group",clinicNames:"Clinic Groups"}[s] || s.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase()));
export const today = (timeZone?:string) => new Date().toLocaleDateString("en-CA",timeZone?{timeZone}:undefined);
export function ErrorNotice({error}:{error:unknown}) { return error ? <div className="error-box" role="alert" data-testid="status-error">{friendlyError(error)}</div> : null; }
export function Empty({label="Records"}:{label?:string}){return <div className="empty" data-testid="status-empty"><span className="empty-icon"><Plus size={24}/></span><h3>No {label} yet</h3><p>When {label} are added, you'll find them here.</p></div>;}
type Field = {key:string; label?:string; type?:string; required?:boolean; options?:string[]; resource?:string; category?:string; nullable?:boolean; hidden?:boolean; disabled?:boolean};
const f=(key:string,type="text",required=false,options?:string[]):Field=>({key,type,required,options});
const relation=(key:string,resource:string,required=false):Field=>({key,resource,required});
const master=(key:string,category:string):Field=>({...relation(key,"masters"),category});
const location=(key:string,required=false):Field=>({key,required,type:"masterText",category:key});
const status=f("status","select",false,["active","inactive"]);
const locationFields=[f("address","text",true),location("city"),location("state"),location("pincode"),f("phone","tel")];
const person=[f("fullName","text",true),f("mobile","tel",true),f("email","email"),f("dateOfBirth","date"),f("gender","select",false,["female","male","other","preferNotToSay"])];
type Resource = {name:string; list:any;create?:any;update?:any;remove?:any;fields:Field[];columns:string[]};
export const resources:Record<string,Resource>={
 clinics:{name:"clinics",list:api.listClinics,create:api.createClinic,update:api.updateClinic,remove:api.deleteClinic,fields:[f("name","text",true),f("slug"),...locationFields,location("country"),location("area"),f("email","email"),f("description","textarea"),master("clinicTypeId","clinicType"),master("categoryId","clinicCategory"),master("specialityIds","specialization"),f("referralCode"),relation("adminId","users"),status],columns:["name","code","city","phone","status"]},
 branches:{name:"branches",list:api.listBranches,create:api.createBranch,update:api.updateBranch,remove:api.deleteBranch,fields:[relation("clinicId","clinics",true),f("name","text",true),f("slug"),...locationFields,f("email","email"),{...f("inheritEmail","checkbox"),label:"Use Clinic Email"},{...f("inheritPhone","checkbox"),label:"Use Clinic Phone"},f("timezone"),status],columns:["name","clinicName","city","timezone","status"]},
 doctors:{name:"doctors",list:api.listDoctors,create:api.createDoctor,update:api.updateDoctor,remove:api.deleteDoctor,fields:[...person.map(field=>field.key==="email"?{...field,required:true}:field.key==="mobile"?{...field,required:false}:field),f("photoUrl","url"),master("specializationId","specialization"),f("registrationNumber"),f("experienceYears","number"),f("consultationFee","number"),f("about","textarea"),relation("ownerAdminId","users"),relation("clinicIds","clinics"),relation("branchIds","branches"),master("qualificationIds","qualification"),{...f("languages","array"),label:"Languages (comma-separated)"},status],columns:["fullName","specializationName","email","clinicNames","branchNames","status"]},
 patients:{name:"patients",list:api.listPatients,create:api.createPatient,update:api.updatePatient,remove:api.deletePatient,fields:[...person.map(field=>field.key==="mobile"?{...field,required:false,label:"Mobile (optional)"}:field),f("age","number"),f("address"),f("emergencyContactName"),f("emergencyContactPhone","tel"),relation("clinicId","clinics"),relation("branchId","branches"),status],columns:["fullName","code","mobile","gender"]},
 users:{name:"users",list:api.listUsers,create:api.createUser,update:api.updateUser,remove:api.deleteUser,fields:[f("fullName","text",true),f("email","email",true),f("mobile","tel"),f("role","select",true,["receptionist","clinicAdmin","patient"]),relation("clinicIds","clinics"),relation("branchIds","branches"),status],columns:["fullName","email","role","clinicNames","branchNames","status"]},
 masters:{name:"master values",list:api.listMasters,create:api.createMaster,update:api.updateMaster,remove:api.deleteMaster,fields:[f("category","select",true,Object.values(api.MasterInputCategory)),f("name","text",true),f("code","text",true),relation("parentId","masters"),f("sortOrder","number"),status],columns:["name","category","code","status"]},
 availability:{name:"weekly schedules",list:api.listSchedules,create:api.createSchedule,update:api.updateSchedule,remove:api.deleteSchedule,fields:[relation("doctorId","doctors",true),relation("clinicId","clinics",true),relation("branchId","branches",true),f("dayOfWeek","select",true,["0","1","2","3","4","5","6"]),f("isOpen","checkbox"),f("startTime","time",true),f("endTime","time",true),...scheduleBreakFields,f("timezone"),f("tokenPrefix","text",true),f("maxTokens","number",true),{...f("consultationMinutes","duration",true),label:"Expected Consultation Duration"},f("bufferMinutes","number"),f("queueMode","select",false,["mixed","appointmentsOnly","walkInsOnly"]),f("queueOpenTime","time"),f("queueCloseTime","time")],columns:["doctorName","branchName","dayOfWeek","session","break","capacity","isOpen"]},
 exceptions:{name:"date exceptions",list:api.listAvailabilityExceptions,create:api.createAvailabilityException,update:api.updateAvailabilityException,remove:api.deleteAvailabilityException,fields:[relation("doctorId","doctors",true),relation("branchId","branches",true),f("date","date",true),{...f("sessionId","session"),label:"Session (Optional; Blank Applies to All)"},f("isClosed","checkbox"),f("reason","text",true),{...f("startTime","time"),nullable:true},{...f("endTime","time"),nullable:true},...scheduleBreakFields,{...f("maxTokens","number"),nullable:true}],columns:["date","reason","isClosed","session","break","maxTokens"]},
  qrs:{name:"booking QR codes",list:api.listQrs,create:api.createQr,update:api.updateQr,remove:api.deleteQr,fields:[f("name","text",true),relation("clinicId","clinics",true),{...relation("branchId","branches"),nullable:true},{...relation("doctorId","doctors"),nullable:true},status],columns:["name","reference","status"]},
 audit:{name:"audit events",list:api.listAuditLogs,fields:[],columns:["createdAt","actorName","action","summary"]},
};
function MasterTextInput({field,control}:any){
 const [search,setSearch]=useState("");
 const term=useDebouncedValue(search);
  const q=useQuery({queryKey:["lookup","masters",field.category,term],queryFn:()=>api.listMasters({category:field.category,status:"active",search:term,pageSize:20} as any),staleTime:120000});
 const fieldName=title(field.key).toLowerCase();
  return <Controller name={field.key} control={control} rules={{validate:value=>!field.required||required()(value)||true}} render={({field:input})=><><SuggestionInput id={`input-${field.key}`} value={input.value||""} onChange={input.onChange} onSearchChange={setSearch} options={q.error?[]:(q.data?.items||[]).map(row=>row.name)} placeholder={`Type or search ${fieldName}…`} clearLabel={`Clear ${fieldName}`} loading={q.isFetching} onRetry={()=>void q.refetch()} emptyMessage={term?`No matching active ${fieldName} values in the local catalog. Enter your own text.`:`No active ${fieldName} values in the local catalog. Enter your own text.`} error={q.error ? `${friendlyError(q.error,"load")} You can still enter ${fieldName} manually.` : undefined}/><small className="muted">Optional suggestions from the local {fieldName} catalog; not an address search service. Manual entry is accepted.</small></>}/>;
}
function ExceptionSessionInput({form,label}:{form:ReturnType<typeof useForm>;label:string}){
 const preferences=useDateTimePreferences();
 const doctorId=form.watch("doctorId")||"",branchId=form.watch("branchId")||"",date=form.watch("date")||"";
 const closed=form.watch("isClosed");
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(date);
 const sessions=useQuery({queryKey:["exception-base-sessions",doctorId,branchId,date],enabled:!!doctorId&&!!branchId&&validDate,queryFn:()=>api.listSchedules({doctorId,branchId,dayOfWeek:new Date(`${date}T12:00:00Z`).getUTCDay(),pageSize:100})});
 const rows=(sessions.data?.items||[]).filter(row=>(row as any).status!=="inactive");
 const needsSession=!closed&&(sessions.data?.total||rows.length)>1;
 return <Controller name="sessionId" control={form.control} rules={{validate:value=>!needsSession||!!value||"Choose a session for this date exception."}} render={({field,fieldState})=><div><SearchableSelect label={needsSession?"Session":label.replace(/\s*\(optional.*$/,"")} required={needsSession} value={field.value||""} onChange={field.onChange} placeholder={needsSession?"Select a session…":closed?"All sessions":"Only weekly session"} error={fieldState.error?.message} loading={sessions.isFetching} onRetry={()=>void sessions.refetch()} options={rows.map(session=>({value:session.id,label:`${formatTime(session.startTime,preferences)}–${formatTime(session.endTime,preferences)}`}))}/><small className="muted">{closed?"A closure can apply to all sessions.":"Timing overrides require a specific session when this date has more than one weekly session."}</small><ErrorNotice error={sessions.error}/></div>}/>;
}
function RelationInput({field,form,fields,resourceName,label}:any){
 const me=api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),staleTime:60000}});
 const values=form.watch();
 const many=field.key.endsWith("Ids");
 const clinicIds=values.clinicIds || (values.clinicId?[values.clinicId]:[]);
 const hasClinic=fields.some((f:Field)=>["clinicId","clinicIds"].includes(f.key));
 const assignment=((resourceName==="doctors"||resourceName==="users")&&["clinics","branches"].includes(field.resource))||(resourceName==="branches"&&field.resource==="clinics"&&me.data?.user?.role==="doctor");
 const params:Record<string,unknown>=field.category?{category:field.category}:{};
 if(field.resource==="users")params.role="clinicAdmin";
 if(field.resource==="branches"){
   if(clinicIds.length)params.clinicId=clinicIds.join(",");
   if(values.doctorId)params.doctorId=values.doctorId;
 }
 if(field.resource==="doctors"){
   if(["availability","exceptions","qrs"].includes(resourceName))params.status="active";
   if(values.clinicId)params.clinicId=values.clinicId;
   if(values.branchId)params.branchId=values.branchId;
 }
 if(assignment){params.targetRole=resourceName==="doctors"?"doctor":"receptionist";params[resourceName==="doctors"?"doctorId":"userId"]=values.id;}
 useEffect(()=>{form.register(field.key,{validate:(value:any)=>!field.required||(many?value?.length>0:!!value)||(field.key==="clinicId"?"Select a clinic":"This field is required")});},[field.key,field.required]);
 const change=(value:any)=>{
    const previous=values[field.key];
    if(Array.isArray(value)?JSON.stringify(value)===JSON.stringify(previous||[]):value===(previous||""))return;
   form.setValue(field.key,value,{shouldValidate:true,shouldDirty:true});
    // An empty parent cannot have valid dependents. For other changes wait for
    // the scoped lookup to confirm which existing selections still belong.
    if(["clinicId","clinicIds"].includes(field.key)&&!value?.length){
      for(const dependent of ["branchId","branchIds","doctorId"])if(fields.some((f:Field)=>f.key===dependent))form.setValue(dependent,dependent.endsWith("Ids")?[]:"",{shouldDirty:true});
    }
 };
  const validateSelected=(records:any[],verifiedMissing:string[])=>{
    if(!hasClinic||!["branches","doctors"].includes(field.resource))return;
    const current=form.getValues();
    const selected:string[]=many?current[field.key]||[]:current[field.key]?[current[field.key]]:[];
    if(!selected.length)return;
    const clinics:string[]=current.clinicIds|| (current.clinicId?[current.clinicId]:[]);
    const valid=validDependentIds(field.resource,selected,records,clinics,current.branchId).filter(id=>!verifiedMissing.includes(id));
    if(valid.length!==selected.length)form.setValue(field.key,many?valid:valid[0]||"",{shouldValidate:true,shouldDirty:true});
  };
   const props={id:`input-${field.key}`,error:form.formState.errors[field.key]?.message,resource:assignment?`assignment:${field.resource}`:field.resource,params,label,placeholder:`Search ${label.toLowerCase()}…`,disabled:["branches","doctors"].includes(field.resource)&&hasClinic&&!clinicIds.length,required:field.required,onChange:change,onSelectedRecords:validateSelected};
 return many?<ResourceMultiLookup {...props} value={values[field.key]||[]}/>:<ResourceLookup {...props} value={values[field.key]||""}/>;
}
 /** Groups long editors into consistent titled sections. Order is stable inside a group; no field is removed. */
const EDITOR_GROUPS:[string,string[]][]=[
 ["Details",[]],
 ["Professional",["specializationId","registrationNumber","experienceYears","consultationFee","about","qualificationIds","languages"]],
 ["Assignment and scope",["role","category","parentId","ownerAdminId","adminId","doctorId","clinicId","clinicIds","branchId","branchIds"]],
 ["Day",["dayOfWeek","isOpen","date","sessionId","isClosed","reason"]],
 ["Timing",["startTime","endTime","breakStart","breakEnd","breakStartTime","breakEndTime","timezone","bookingHorizonDays","cancellationCutoffMinutes"]],
 ["Capacity",["tokenPrefix","maxTokens","consultationMinutes","bufferMinutes"]],
 ["Queue window",["queueMode","queueOpenTime","queueCloseTime"]],
 ["Verification and links",["requireMobileVerification","otpExpirySeconds","otpMaxAttempts","termsUrl","privacyUrl"]],
 ["Status",["status"]],
];
export function editorGroup(key:string){return (EDITOR_GROUPS.find(([,keys])=>keys.includes(key))||EDITOR_GROUPS[0])[0];}
function sortEditorFields<T extends {key:string}>(fields:T[],grouped:boolean){if(!grouped)return fields;const rank=(k:string)=>EDITOR_GROUPS.findIndex(([g])=>g===editorGroup(k));return fields.map((f,i)=>({f,i})).sort((a,b)=>rank(a.f.key)-rank(b.f.key)||a.i-b.i).map(x=>x.f);}
export function Editor({fields,initial={},onSave,onCancel,busy=false,submitLabel="Save Changes",resourceName,onDirtyChange,reviewOnly=false,children}:{fields:Field[];initial?:any;onSave:(data:any)=>void;onCancel?:()=>void;busy?:boolean;submitLabel?:string;resourceName?:string;onDirtyChange?:(dirty:boolean)=>void;reviewOnly?:boolean;children?:ReactNode}){
 const confirmation=useConfirm();
 const [moreDetails,setMoreDetails]=useState(()=>resourceName==="patients"&&PATIENT_SECONDARY.some(key=>!!initial[key]));
 const initialValues=Object.fromEntries(Object.entries(initial).map(([key,value])=>[key,fields.some(field=>field.key===key&&field.type==="date")&&value?value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10):value]));
 const form=useForm<Record<string,any>>({defaultValues:{...fields.some(field=>field.key==="timezone")?{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}:{},...initialValues}});
 const submitting=useRef(false);
 useEffect(()=>{if(!busy)submitting.current=false;},[busy]);
 useEffect(()=>{onDirtyChange?.(form.formState.isDirty);},[form.formState.isDirty,onDirtyChange]);
 const currentRole = form.watch("role");
 const startTime=form.watch("startTime"),endTime=form.watch("endTime");
 const parentClinicId=form.watch("clinicId")||initial.clinicId||"";
 const parentClinic=api.useGetClinic(parentClinicId,{query:{queryKey:api.getGetClinicQueryKey(parentClinicId),enabled:!!parentClinicId}});
 const inherited=useDateTimePreferences();
 const preferences=parentClinic.data||inherited;
 const doctorId=form.watch("doctorId"),branchId=form.watch("branchId"),dayOfWeek=form.watch("dayOfWeek");
 const sessionClinic=api.useGetBranch(branchId||"",{query:{queryKey:api.getGetBranchQueryKey(branchId||""),enabled:resourceName==="availability"&&!!branchId}});
 const clinicHours=(sessionClinic.data?.openingHours||[]).filter(hour=>hour.dayOfWeek===Number(dayOfWeek));
 const matchingTimezone=!form.watch("timezone")||form.watch("timezone")===sessionClinic.data?.timezone;
 const peers=useQuery({queryKey:["editor-session-overlap",doctorId,branchId,dayOfWeek],enabled:resourceName==="availability"&&!!doctorId&&!!branchId&&dayOfWeek!==undefined,queryFn:()=>api.listSchedules({doctorId,branchId,dayOfWeek:Number(dayOfWeek),pageSize:100})});
 const overlaps=(peers.data?.items||[]).some(row=>row.id!==initial.id&&(row as any).status!=="inactive"&&row.startTime<endTime&&startTime<row.endTime);
 const activeFields = useMemo(() => {
   return fields.map(f => {
     const field = { ...f };
      if(field.key==="slug"&&initial.slug)field.disabled=true;
     if (field.key === "clinicIds" || field.key === "branchIds") {
       if (currentRole === "clinicAdmin" || currentRole === "patient" || currentRole === "superAdmin") {
         field.hidden = true;
        } else {
          const isDoctor = currentRole === "doctor" || fields.some(item => item.key === "ownerAdminId");
          field.required = currentRole === "receptionist" || (isDoctor && field.key === "clinicIds");
       }
     }
     return field;
   }).filter(f => !f.hidden);
  }, [fields, currentRole, initial.slug]);

   return <Form {...form}><form className="form-grid" onSubmit={form.handleSubmit(values=>{if(resourceName==="patients"){const secondary=secondaryFieldErrors(values);const keys=Object.keys(secondary);if(keys.length){keys.forEach(key=>form.setError(key,{type:"validate",message:secondary[key]}));setMoreDetails(true);setTimeout(()=>document.getElementById(`input-${keys[0]}`)?.focus()||document.querySelector<HTMLElement>(`[name="${CSS.escape(keys[0])}"]`)?.focus(),0);return;}}if(!beginEditorSubmission(submitting,busy,reviewOnly))return;const body:any={}; activeFields.forEach(field=>{
    if(field.disabled)return;
    let value=values[field.key];
    if(typeof value==="string")value=value.trim();
    if(field.type==="tel"&&value)value=normalizePhone(value);
    if(field.key==="age")value=ageFromDateOfBirth(values.dateOfBirth)??initial.age;
    const isClinicOrBranchMapping = field.key === "clinicIds" || field.key === "branchIds";
    if (field.key === "adminId" || field.key === "ownerAdminId") {
      if (field.hidden || value === initial[field.key]) return;
    } else if (field.hidden) {
      if (isClinicOrBranchMapping) return; // omit empty mappings for ClinicAdmin/Patient
      return;
    }
    if(value===""||value===undefined||value===null){
      Object.assign(body,emptyFieldValue(field,value));
      // Also omit mapping array if not required to bypass minItems1 on create
      if (isClinicOrBranchMapping && !field.required) return;
      return;
    }
    if(field.type==="number"||field.type==="duration"||field.key==="dayOfWeek")value=Number(value);
    if(field.type==="array")value=Array.isArray(value)?value:String(value).split(",").map(s=>s.trim()).filter(Boolean);
    if(Array.isArray(value))value=value.filter(Boolean);

    body[field.key]=value;
  });onSave(body);},errors=>{if(Object.keys(errors).some(key=>PATIENT_SECONDARY.includes(key)))setMoreDetails(true);requestAnimationFrame(()=>{const key=Object.keys(errors)[0];const element=document.getElementById(`input-${key}`)||document.querySelector<HTMLElement>(`[name="${CSS.escape(key)}"]`)||document.querySelector<HTMLElement>('[aria-invalid="true"]');element?.focus();});})}>
   {confirmation.dialog}{children}
    {resourceName==="patients"&&<p className="muted wide">Active patients can be chosen for new bookings. Inactive profiles stay in historical records but are excluded from active patient pickers. This profile status does not change a linked user's login credentials.</p>}
    {resourceName==="branches"&&<p className="muted wide">A clinic is a physical care location within a Clinic Group, with its own address, timezone, opening hours and booking link. Clinics do not have a separate login. Named staff use their own accounts, assignments and invitations. Contact inheritance controls its public contact details; it does not change staff sign-in addresses or configure notification delivery.</p>}
   {resourceName==="patients"&&<button type="button" className="text-link wide" aria-expanded={moreDetails} data-testid="button-patient-more-details" onClick={()=>setMoreDetails(value=>!value)}>{moreDetails?"Hide":"More"} details (optional)</button>}
    {resourceName==="availability"&&<div className="wide"><TimeRangeSlider clinicHours={matchingTimezone?clinicHours:[]} startTime={startTime||""} endTime={endTime||""} onChange={value=>{form.setValue("startTime",value.startTime,{shouldDirty:true,shouldValidate:true});form.setValue("endTime",value.endTime,{shouldDirty:true,shouldValidate:true});}}/><small className="muted">Slide in 15-minute steps or type exact minutes below. Shaded bands show clinic opening hours in the same timezone. Clinic-hour limits and cross-clinic conflicts are checked by the server.</small>{sessionClinic.data&&<p>Clinic hours: {clinicHours.length?clinicHours.map(hour=>`${formatTime(hour.startTime,preferences)}–${formatTime(hour.endTime,preferences)}`).join(", "):"Closed"} · {sessionClinic.data.timezone}{!matchingTimezone&&" (different session timezone; shading is hidden)"}</p>}{matchingTimezone&&clinicHours.length>0&&startTime&&endTime&&!clinicHours.some(hour=>hour.startTime<=startTime&&hour.endTime>=endTime)&&<p className="notice">This session extends outside a clinic opening interval. Review the times; existing server rules decide whether it can be saved.</p>}{startTime&&endTime&&startTime>=endTime&&<p role="alert" className="field-error">Closing time must follow opening time.</p>}{overlaps&&<p role="alert" className="field-error">This session overlaps another session for this doctor and clinic.</p>}<ErrorNotice error={peers.error||sessionClinic.error}/>{(peers.error||sessionClinic.error)&&<button type="button" onClick={()=>{void peers.refetch();void sessionClinic.refetch();}}>Retry Hours and Overlap Check</button>}</div>}
   {(()=>{let lastGroup="";const grouped=activeFields.length>5;return sortEditorFields(activeFields,grouped).map(field=>{
    const collapsed=resourceName==="patients"&&!moreDetails&&PATIENT_SECONDARY.includes(field.key)&&!form.formState.errors[field.key];const node=(()=>{
    const label=field.label||title(field.key.replace(/Ids?$/,""));
    const error=form.formState.errors[field.key] ? String(form.formState.errors[field.key]?.message||"This field is required") : undefined;
    const rules={validate:(value:unknown)=> (field.required?required()(value):undefined)||(field.key==="fullName"||field.key==="emergencyContactName"?validatePersonName(value):undefined)||(field.type==="tel"?validatePhone(value):undefined)||(field.type==="email"?validateEmail(value):undefined)||(field.key==="dateOfBirth"?validateDateOfBirth(value):undefined)||(field.type==="number"?validateNumberRange(value,{min:0,integer:!["consultationFee","experienceYears"].includes(field.key)}):undefined)||true};
    if(field.key==="age")return <label key={field.key}>Age (read only)<input readOnly value={ageFromDateOfBirth(form.watch("dateOfBirth"))??initial.age??""}/><small className="muted">Calculated from date of birth. An existing age-only record is retained until a date of birth is provided.</small></label>;
    if(field.key==="timezone")return <Controller key={field.key} name={field.key} control={form.control} rules={rules} render={({field:input})=><TimezoneSelect value={input.value||""} onChange={input.onChange} error={error}/>}/>;
    if(field.type==="number"){
      const min=["maxTokens","bookingHorizonDays","otpExpirySeconds","otpMaxAttempts"].includes(field.key)?1:0;
      const max=field.key==="bookingHorizonDays"?365:field.key==="cancellationCutoffMinutes"?10080:undefined;
      const helper=field.key==="maxTokens"?"Maximum patients in this session. Enter a positive whole number.":field.key==="bufferMinutes"?"Extra minutes between consultations. Enter a non-negative whole number.":field.key==="cancellationCutoffMinutes"?"Minutes before session start after which cancellation is blocked.":undefined;
      return <FormField key={field.key} label={label} required={field.required} optional={!field.required} error={error} helper={helper}><input type="number" min={min} max={max} step={["consultationFee","experienceYears"].includes(field.key)?"any":1} {...form.register(field.key,{validate:value=>(field.required?required()(value):undefined)||validateNumberRange(value,{min,max,integer:!["consultationFee","experienceYears"].includes(field.key)})||true})}/></FormField>;
    }
    if(field.type==="tel")return <Controller key={field.key} name={field.key} control={form.control} rules={rules} render={({field:input})=><FormField label={label} required={field.required} optional={!field.required} error={error}><PhoneInput {...input} value={input.value||""}/></FormField>}/>;
    if(field.type==="date"||field.type==="time")return <Controller key={field.key} name={field.key} control={form.control} rules={{...rules,validate:value=>rules.validate(value)!==true?rules.validate(value):field.key==="endTime"&&startTime&&value&&startTime>=value?"Closing time must follow opening time.":true}} render={({field:input})=><FormField id={`input-${field.key}`} label={label} required={field.required} optional={!field.required} error={error} helper={field.key==="dateOfBirth"&&!fields.some(item=>item.key==="age")?<output aria-label="Age (read only)">Age (read only): {ageFromDateOfBirth(input.value)??"—"}</output>:undefined}>{a11y=>field.type==="date"?<DateFormatInput {...a11y} name={field.key} preferences={preferences} value={input.value instanceof Date?input.value.toISOString().slice(0,10):input.value||""} onChange={input.onChange}/>:<TimeFormatInput {...a11y} name={field.key} preferences={preferences} value={input.value||""} onChange={input.onChange}/>}</FormField>}/>;
    if(field.type==="session")return <ExceptionSessionInput key={field.key} form={form} label={label}/>;
    if(field.resource)return <div className={field.type==="textarea"?"wide":""} key={field.key}><RelationInput field={field} form={form} fields={fields} resourceName={resourceName} label={label}/>{error&&<small className="field-error">{error}</small>}</div>;
    if(field.type==="masterText")return <label key={field.key}>{label}{field.required&&<span className="required"> *</span>}<MasterTextInput field={field} control={form.control}/>{error&&<small className="field-error">{error}</small>}</label>;
    if(field.type==="duration"){
     const legacy=initial[field.key];
     const choices=[20,30,60];
     const opts=[...choices.map(v=>({value:String(v),label:`${v} minutes`})),...(legacy!=null&&legacy!==""&&!choices.includes(Number(legacy))?[{value:String(legacy),label:`${legacy} minutes (current, legacy value)`}]:[])];
     return <Controller key={field.key} name={field.key} control={form.control} rules={{required:field.required}} render={({field:input})=><div><SearchableSelect id={`input-${field.key}`} label={label} required={field.required} value={input.value==null?"":String(input.value)} onChange={input.onChange} placeholder="Select duration…" error={error} options={opts}/>{legacy!=null&&!choices.includes(Number(legacy))&&<small className="muted">This schedule keeps its existing {legacy}-minute value until you choose 20, 30 or 60 minutes.</small>}</div>}/>;
    }
    if(field.key==="status"&&resourceName==="users")return <Controller key={field.key} name="status" control={form.control} render={({field:input})=><div className="wide"><StatusSwitch label="User Account Active" testId="switch-user-status-editor" active={input.value!=="inactive"} onChange={async active=>{if(!active&&!await confirmation.ask({title:"Deactivate User?",description:"They may lose access. Protected clinic owners cannot be deactivated until ownership is transferred.",confirmLabel:"Deactivate",tone:"danger"}))return;input.onChange(active?"active":"inactive");}}/><small className="muted">Some administrator accounts are protected by clinic ownership rules. Saving will explain any restriction.</small></div>}/>;
    if(field.type==="select")return <Controller key={field.key} name={field.key} control={form.control} rules={{required:field.required}} render={({field:input})=><SearchableSelect id={`input-${field.key}`} label={label} required={field.required} value={selectInputValue(input.value)} onChange={input.onChange} placeholder={`Select ${label.toLowerCase()}…`} error={error} options={(field.options||[]).map(v=>({value:v,label:field.key==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(v)]:title(v)}))}/>}/>;
    return <label className={field.type==="textarea"?"wide":""} key={field.key}>{label}{field.required?<span className="required"> *</span>:!label.includes("(optional)")?" (optional)":""}{field.type==="textarea"?<textarea aria-invalid={!!error} aria-describedby={error?`error-${field.key}`:undefined} data-testid={`input-${field.key}`} {...form.register(field.key,rules)}/>:field.type==="email"?<EmailInput disabled={field.disabled} aria-invalid={!!error} aria-describedby={error?`error-${field.key}`:undefined} data-testid={`input-${field.key}`} {...form.register(field.key,rules)}/>:<input disabled={field.disabled} aria-invalid={!!error} aria-describedby={error?`error-${field.key}`:undefined} max={field.key==="dateOfBirth"?today():undefined} data-testid={`input-${field.key}`} type={field.type==="array"?"text":field.type} {...form.register(field.key,rules)}/>} {field.key==="slug"&&<small className="muted">{initial.slug?"Web address is permanent. Display names can still change.":"Choose a permanent web address: lowercase letters, digits and hyphens."}</small>}{error&&<small id={`error-${field.key}`} className="field-error" role="alert">{error}</small>}</label>;
   })();const group=grouped?editorGroup(field.key):"";const heading=group&&!collapsed&&group!==lastGroup?(lastGroup=group,<h3 className="editor-section wide" data-testid={`editor-section-${group.toLowerCase().replace(/[^a-z]+/g,"-")}`}>{group}</h3>):null;return <Fragment key={field.key}>{heading}{collapsed?<div hidden className="wide" data-testid={`collapsed-${field.key}`}>{node}</div>:node}</Fragment>;});})()}
  <div className="wide form-footer">{onCancel&&<button type="button" onClick={onCancel} disabled={busy}>Cancel</button>}<button className="button" disabled={busy||overlaps} data-testid="button-save">{busy?"Saving…":submitLabel}</button></div></form></Form>;
}
function PatientFilteredExport({params,timezone,disabled}:{params:Record<string,unknown>;timezone?:string;disabled:boolean}){
 const preferences=useDateTimePreferences();
 const controller=useRef<AbortController|null>(null);
 const [busy,setBusy]=useState(false);const [progress,setProgress]=useState("");const [message,setMessage]=useState("");const [error,setError]=useState("");
 const context=JSON.stringify(params);
 useEffect(()=>{setMessage("");setError("");return()=>{controller.current?.abort();};},[context]);
 const run=async()=>{
  if(controller.current)return;const request=new AbortController();controller.current=request;setBusy(true);setMessage("");setError("");setProgress("Preparing export…");
  try{
   const records=await collectFilteredPatients(params,(batch,signal)=>api.listPatients(batch as any,{signal}) as any,request.signal,(loaded,total)=>setProgress(`Preparing ${loaded} of ${total} patients…`));
   if(!records.length){setMessage("No matching patients to export.");return;}
   const url=URL.createObjectURL(new Blob([filteredPatientsCsv(records,value=>formatDate(String(value).slice(0,10),preferences),value=>formatConfiguredTimestamp(value,timezone,{},preferences))],{type:"text/csv;charset=utf-8"}));
   const link=document.createElement("a");link.href=url;link.download="DigiQ-filtered-patients.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage(`${records.length} matching patients exported.`);
  }catch(e){if(request.signal.aborted)setMessage("Export cancelled. No file was downloaded.");else setError(`${friendlyError(e,"load","Unable to export patients.")} No file was downloaded. Please try again.`);}
  finally{if(controller.current===request)controller.current=null;setBusy(false);setProgress("");}
 };
 return <><HelpTip text="Exports every patient matching the current search, filters and sort, not only this page. Selected-row export is separate."><button type="button" className="button secondary small" disabled={disabled||busy} onClick={()=>void run()} data-testid="button-export-filtered-patients"><Download size={15}/> {busy?"Exporting…":"Export Results CSV"}</button></HelpTip>{busy&&<button type="button" className="small" onClick={()=>controller.current?.abort()} data-testid="button-cancel-patient-export">Cancel Export</button>}{(progress||message||error)&&<small role={error?"alert":"status"} className={error?"field-error":"muted"} data-testid="status-patient-export">{error||progress||message}</small>}</>;
}
function QrReadiness({row}:{row:any}){
 const params={clinicId:row.clinicId,branchId:row.branchId||undefined,doctorId:row.doctorId||undefined,pageSize:100} as any;
 const q=useQuery<any>({queryKey:["qr-readiness",row.id,params],queryFn:()=>api.listSchedules(params),staleTime:60000});
 if(q.isLoading)return <small role="status">Checking sessions…</small>;
 if(q.error)return <small className="muted">Session check unavailable</small>;
 const open=(q.data?.items||[]).filter((s:any)=>s.isOpen&&(s.maxTokens??0)>0);
 const days=new Set(open.map((s:any)=>s.dayOfWeek)).size;
 return <small className={`badge ${open.length?"active":"inactive"}`} data-testid={`status-qr-readiness-${row.id}`}>{open.length?`${open.length} open weekly sessions · ${days} days`:"No open weekly sessions configured"}</small>;
}
function QrCard({row,onRegenerated}:{row:any;onRegenerated?:()=>void}){
 const confirmation=useConfirm();
 const [generated,setGenerated]=useState({url:"",image:""});
 const [error,setError]=useState<unknown>();
 const [attempt,setAttempt]=useState(0);
 const client=useQueryClient();
 const url=publicQrLink(row.reference);
 const [copied,setCopied]=useState(false);
 const image=generated.url===url?generated.image:"";
 useEffect(()=>{
  let cancelled=false;setError(undefined);
  QRCode.toDataURL(url,{width:400,margin:2}).then(image=>{if(!cancelled)setGenerated({url,image});}).catch(error=>{if(!cancelled)setError(error);});
  return()=>{cancelled=true;};
 },[url,attempt]);
 const regenerate=useMutation({mutationFn:()=>api.regenerateQr(row.id),onSuccess:async()=>{await client.invalidateQueries();onRegenerated?.();}});
 return <div className="qr-card compact">{confirmation.dialog}{image?<img src={image} alt={`Booking QR code for ${row.name}`}/>:!error&&<p role="status">Generating QR image…</p>}<strong>{row.name}</strong><small>{row.reference} · Active</small><QrReadiness row={row}/><a href={url} target="_blank" rel="noreferrer">{url}</a><div className="admin-qr-actions"><HelpTip text="Copy public booking link"><button aria-label={`Copy booking link for ${row.name}`} onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch(e){setError(e);}}}><Copy size={15}/></button></HelpTip>{image&&<HelpTip text="Download booking QR image"><a className="button secondary small" aria-label={`Download QR for ${row.name}`} href={image} download={`${row.name}-qr.png`}><Download size={15}/></a></HelpTip>}{row.branchId&&<HelpTip text="Open the public clinic queue display; no private patient tickets"><a className="button secondary small" aria-label={`Open queue display for ${row.name}`} href={publicQrLink(row.reference,true)} target="_blank" rel="noreferrer"><Monitor size={15}/></a></HelpTip>}</div>{copied&&<small role="status">Booking link copied.</small>}<button disabled={regenerate.isPending} onClick={async()=>{if(!regenerate.isPending&&await confirmation.ask({title:"Regenerate QR Code?",description:"Printed copies will stop working.",confirmLabel:"Regenerate Reference",tone:"danger"}))regenerate.mutate();}}>{regenerate.isPending?"Regenerating…":"Regenerate Reference"}</button>{regenerate.isSuccess&&<p className="notice" role="status">QR reference regenerated. Download and replace printed copies.</p>}<ErrorNotice error={error||regenerate.error}/>{!!error&&<button type="button" data-testid={`button-retry-qr-${row.id}`} onClick={()=>setAttempt(value=>value+1)}>Retry QR Image</button>}</div>;
}
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function LocationActions({row,resource,portal}:{row:any;resource:string;portal:string}){
 const [action,setAction]=useState<"book"|"display"|null>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [menuPosition,setMenuPosition]=useState({top:0,left:0});
  const menuTrigger=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!menuOpen)return;
    const place=()=>{
      const rect=menuTrigger.current?.getBoundingClientRect();
      if(!rect)return;
      const height=menuRef.current?.offsetHeight||130;
      setMenuPosition({top:rect.bottom+height+8>window.innerHeight?Math.max(8,rect.top-height-4):rect.bottom+4,left:Math.max(8,Math.min(rect.right-190,window.innerWidth-198))});
    };
    const dismiss=(event:PointerEvent)=>{if(!menuTrigger.current?.contains(event.target as Node)&&!menuRef.current?.contains(event.target as Node))setMenuOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setMenuOpen(false);menuTrigger.current?.focus();}};
    place();
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    window.addEventListener("resize",place);
    window.addEventListener("scroll",place,true);
    document.addEventListener("pointerdown",dismiss);
    document.addEventListener("keydown",escape);
    return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape);};
  },[menuOpen]);
 const [branchId,setBranchId]=useState("");
 const clinicId=resource==="clinics"?row.id:row.clinicId;
 const clinic=api.useGetClinic(clinicId,{query:{queryKey:api.getGetClinicQueryKey(clinicId),enabled:!!action&&resource==="branches"}});
 const params={clinicId,status:"active" as const,pageSize:2};
 const branches=api.useListBranches(params,{query:{queryKey:api.getListBranchesQueryKey(params),enabled:!!action&&resource==="clinics",refetchInterval:30000}});
 const selected=api.useGetBranch(branchId,{query:{queryKey:api.getGetBranchQueryKey(branchId),enabled:!!action&&!!branchId}});
 const clinicSlug=resource==="clinics"?row.slug:clinic.data?.slug;
 const branch=resource==="branches"?row:(branches.data?.total===1?branches.data.items[0]:selected.data);
 const url=clinicSlug&&branch?.slug?`${import.meta.env.BASE_URL.replace(/\/$/,"")}/${encodeURIComponent(clinicSlug)}/${encodeURIComponent(branch.slug)}?${action}=1`:undefined;
 const loading=clinic.isFetching||branches.isFetching||selected.isFetching;
 const error=clinic.error||branches.error||selected.error;
 useEffect(()=>{if(action&&url&&!loading&&!error&&(resource==="branches"||branches.data?.total===1))window.location.assign(url);},[action,url,loading,error,resource,branches.data?.total]);
  return <><HelpTip text="Booking and display actions"><button type="button" ref={menuTrigger} aria-label={`Booking and display actions for ${row.name}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(open=>!open)}><QrCode size={15}/></button></HelpTip>
  {menuOpen&&createPortal(<div ref={menuRef} className="admin-location-menu" role="menu" aria-label={`Booking and display actions for ${row.name}`} style={menuPosition} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==menuTrigger.current)setMenuOpen(false);}} onKeyDown={event=>{if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;event.preventDefault();const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));const index=items.indexOf(document.activeElement as HTMLElement);items[event.key==="Home"?0:event.key==="End"?items.length-1:(index+(event.key==="ArrowDown"?1:items.length-1))%items.length]?.focus();}}>
    <button role="menuitem" onClick={()=>{setMenuOpen(false);setBranchId("");setAction("book");}}>Open Booking</button>
    <button role="menuitem" onClick={()=>{setMenuOpen(false);setBranchId("");setAction("display");}}>Queue Display</button>
    <Link role="menuitem" href={`/${portal}/qrs?clinicId=${encodeURIComponent(clinicId)}${resource==="branches"?`&branchId=${encodeURIComponent(row.id)}`:""}`} onClick={()=>setMenuOpen(false)}>Manage QR Codes</Link>
    {portal==="admin"&&<Link role="menuitem" data-testid={`link-configure-clinic-${row.id}`} href={`/admin/settings?clinicId=${encodeURIComponent(clinicId)}`} onClick={()=>setMenuOpen(false)}>Configure clinic & opening hours</Link>}
    <Link role="menuitem" data-testid={`link-sessions-${row.id}`} href={`/${portal}/availability?clinicId=${encodeURIComponent(clinicId)}${resource==="branches"?`&branchId=${encodeURIComponent(row.id)}`:""}`} onClick={()=>setMenuOpen(false)}>Doctor Sessions</Link>
  </div>,document.body)}
 <AppDialog open={!!action} onClose={()=>setAction(null)} title={action==="display"?"Open Queue Display":"Open Clinic Booking"}>
 <ErrorNotice error={error}/>{loading?<p role="status">Loading clinic address…</p>:!clinicSlug?<p className="notice">This clinic has no web address. <Link href={`/admin/settings?clinicId=${encodeURIComponent(clinicId)}`}>Set Web Address in Clinic Settings</Link>.</p>:<>
 {resource==="clinics"&&(branches.data?.total??0)>1&&<ResourceLookup resource="branches" label="Select Clinic" params={{clinicId,status:"active"}} value={branchId} onChange={setBranchId}/>}
 {branch&&!branch.slug&&<p className="notice">This clinic has no web address. <Link href={`/admin/settings?clinicId=${encodeURIComponent(clinicId)}`}>Set Web Address in Clinic Settings</Link>.</p>}
 {resource==="clinics"&&branches.data?.total===0&&<p>No active clinics. Add a clinic in settings.</p>}
 {url&&!error&&<a className="button" href={url} target="_blank" rel="noreferrer">Open {action==="display"?"queue display":"booking page"}</a>}
 </>}
 </AppDialog></>;
}
const PRIMARY_KEYS:Record<string,string[]>={branches:["clinicId"],doctors:["clinicId"],patients:["clinicId"],availability:["clinicId","branchId","doctorId"],exceptions:["branchId","doctorId","date"],qrs:["clinicId","branchId","doctorId"],masters:["category"]};
const LIST_FILTER_KEYS=["clinicId","branchId","doctorId","adminId","managingAdminId","specializationId","status","from","to","dayOfWeek","activityType","date","category"];
const LIST_URL_KEYS=["search","page","pageSize","sort",...LIST_FILTER_KEYS];
const FILTER_LABELS:Record<string,string>={clinicId:"Clinic Group",branchId:"Clinic",doctorId:"Doctor",adminId:"Clinic admin",managingAdminId:"Managing admin",specializationId:"Specialization",activityType:"Events",dayOfWeek:"Day",from:"From",to:"To"};
function chipLabel(key:string,value:string){
 if(key==="dayOfWeek")return `Day: ${DAYS[Number(value)]}`;
 if(key.endsWith("Id"))return `${FILTER_LABELS[key]||title(key)} selected`;
 return `${FILTER_LABELS[key]||title(key)}: ${title(value)}`;
}
const COLUMN_LABELS:Record<string,string>={session:"Session hours",break:"Break",capacity:"Capacity",isOpen:"Open",isClosed:"Closed all day",maxTokens:"Max tokens",dayOfWeek:"Day"};
const columnLabel=(c:string)=>COLUMN_LABELS[c]||title(c);
/** One short, human context line for the record cell; never codes/references and never a value already shown in another column. */
function recordSecondary(resource:string,row:any,columns:string[]):string{
 const keys:Record<string,string[]>={clinics:["city"],branches:["clinicName"],doctors:["specializationName"],patients:["mobile","email"],users:["email"],masters:[],qrs:["clinicName","branchName","doctorName"]};
 const key=(keys[resource]||[]).find(k=>row[k]&&!columns.includes(k));
 return key?String(row[key]):"";
}
function renderComputed(c:string,row:any){
 if(c==="createdAt")return row[c]?formatConfiguredTimestamp(row[c],row.timezone,undefined,row):"—";
 if(c==="session"){
  if(row.isClosed===true)return <span className="muted">Closed</span>;
  if(!row.startTime&&!row.endTime)return <span className="muted">{"isClosed" in row?"Regular hours":"—"}</span>;
  return <span>{formatTime(row.startTime,row)}–{formatTime(row.endTime,row)}{row.queueMode&&<span className="cell-sub">{title(row.queueMode)}</span>}</span>;
 }
 if(c==="date"||c==="dateOfBirth")return formatDate(row[c],row);
 if(c==="break")return row.breakStart&&row.breakEnd?<span>{formatTime(row.breakStart,row)}–{formatTime(row.breakEnd,row)}</span>:<span className="muted">No break</span>;
 if(c==="capacity")return <HelpTip text="Maximum patients (tokens) for this session. Consultation minutes are the expected duration per patient; remaining availability also depends on existing bookings and queue policy."><span tabIndex={0} className="cap-chip">{row.maxTokens??"—"}<small>patients</small>{row.tokenPrefix&&<span className="cell-sub">Prefix {row.tokenPrefix}{row.consultationMinutes?` · ${row.consultationMinutes} min`:""}</span>}</span></HelpTip>;
 if(c==="isOpen")return <span className={`badge ${row.isOpen?"active":"inactive"}`}>{row.isOpen?"Open":"Closed"}</span>;
 if(c==="isClosed")return <span className={`badge ${row.isClosed?"inactive":"active"}`}>{row.isClosed?"Closed":"Custom hours"}</span>;
 if(c==="maxTokens"&&"isClosed" in row)return row.maxTokens?<span className="cap-chip">{row.maxTokens}<small>tokens</small></span>:<span className="muted">Regular</span>;
 return undefined;
}
export function ResourcePage({resource,identity,defaults={},allowCreate=true,onEdit,embedded=false,fixedClinicId}:{resource:string;identity?:api.Identity;defaults?:any;allowCreate?:boolean;onEdit?:(row:any)=>void;embedded?:boolean;fixedClinicId?:string}){
 const confirmation=useConfirm();
 const settings=api.useGetSettings({query:{queryKey:api.getGetSettingsQueryKey(),staleTime:60000}});
  const baseConfig=resources[resource];const config={...baseConfig,...(resource==="patients"&&identity?.user?.role==="doctor"?{create:undefined,update:undefined,remove:undefined}:{}),name:resource==="branches"?"clinics":resource==="clinics"?"clinic groups":baseConfig.name}; const [,navigate]=useLocation(); const urlSearch=useSearch();
  const urlParams=new URLSearchParams(urlSearch);
  const search=urlParams.get("search")||"";
  const pageValue=Number(urlParams.get("page"));
  const page=Number.isSafeInteger(pageValue)&&pageValue>0?pageValue:1;
  const sizeValue=Number(urlParams.get("pageSize"));
  const pageSize=[10,20,50,100].includes(sizeValue)?sizeValue:20;
  const sort=urlParams.get("sort")||"-createdAt";
  const [editing,setEditing]=useState<any>(null);
 const [qrPreview,setQrPreview]=useState<any>(null);
 const [auditDetail,setAuditDetail]=useState<any>(null);
 const [patientDetail,setPatientDetail]=useState<any>(null);
 // Patient Details is read-only: shown to every role that can list patients. Edit/Deactivate stay gated by config.update.
 const hasActions=!!config.update||resource==="patients";
 const [dirty,setDirty]=useState(false);
 const [success,setSuccess]=useState("");
 const term=useDebouncedValue(search);
 const supportsSearch=true;
  const roleDefaults=useMemo<Record<string,string>>(()=>({...identity?.doctorId&&["doctor","clinicAdmin"].includes(identity.user?.role||"")&&["availability","exceptions"].includes(resource)?{doctorId:identity.doctorId as string}:{},...fixedClinicId?{clinicId:fixedClinicId}:{}}),[identity,resource,fixedClinicId]);
  const filters:Record<string,string>={...roleDefaults,...Object.fromEntries(LIST_FILTER_KEYS.flatMap(key=>urlParams.get(key)?[[key,urlParams.get(key)!]]:[])),...fixedClinicId?{clinicId:fixedClinicId}:{}};
  // The URL is the source of truth so opening an editor and browser Back both retain list context.
  // Keep unrelated query parameters (e.g. links from clinic settings) intact.
  const changeUrl=(changes:Record<string,string|number>,replace=false)=>{
    const next=new URLSearchParams(window.location.search);
    for(const [key,value] of Object.entries(changes)){
      if(key==="clinicId"&&fixedClinicId)continue;
      if(value===""||value===null||value===undefined||key==="page"&&value===1||key==="pageSize"&&value===20||key==="sort"&&value==="-createdAt")next.delete(key);
      else next.set(key,String(value));
    }
    navigate(`${window.location.pathname}${next.size?`?${next}`:""}`,{replace});
  };
  const setPage=(value:number)=>changeUrl({page:value});
  const setPageSize=(value:number)=>changeUrl({pageSize:value,page:1});
  const setSearch=(value:string)=>changeUrl({search:value,page:1},true);
  const setSort=(value:string)=>changeUrl({sort:value,page:1});
  const filter=(key:string,value:string)=>changeUrl({[key]:value,...(key==="clinicId"?{branchId:"",doctorId:roleDefaults.doctorId||""}:{}),page:1});
 const [draft,setDraft]=useState<Record<string,string>>({});
 const draftFilter=(key:string,value:string)=>setDraft(current=>({...current,[key]:value,...(key==="clinicId"?{branchId:"",doctorId:roleDefaults.doctorId||""}:{}),...(key==="branchId"?{doctorId:roleDefaults.doctorId||""}:{}),...(key==="from"&&current.to&&value>current.to?{to:""}:{})}));
 const applyDraft=()=>changeUrl({...Object.fromEntries(LIST_FILTER_KEYS.filter(key=>key!=="status"&&!(["availability","exceptions","masters"].includes(resource)&&PRIMARY_KEYS[resource]?.includes(key))).map(key=>[key,draft[key]||""])),page:1});
 const active=!!(search||sort!=="-createdAt"||Object.entries(filters).some(([k,v])=>v&&v!==roleDefaults[k]));
  const reset=()=>{setDraft({});changeUrl(Object.fromEntries(LIST_URL_KEYS.map(key=>[key,""])));};
 const listParams={...Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=="")),search:term||undefined,page,pageSize,sort};
 const [recoveryId,setRecoveryId]=useState("");
 const recovery=api.useRequestUserPasswordReset();
 const client=useQueryClient();
  const query=useQuery<any>({queryKey:[resource,identity?.user?.id,identity?.user?.role,listParams],queryFn:()=>config.list(listParams),placeholderData:(previous:any)=>previous,refetchInterval:30000,refetchOnWindowFocus:true});
 const selectionContext=JSON.stringify([resource,listParams,search,identity?.user]);
  const selection=useListingSelection(selectionContext,query.error||query.isPlaceholderData?[]:query.data?.items||[]);
 const density="compact";
 const compact=["clinics","branches","doctors","patients","users","masters","qrs"].includes(resource);
 const baseColumns=compact?[config.columns[0],...config.columns.slice(1).filter(c=>!["code","reference","city","email","phone","clinicName","specializationName"].includes(c))]:config.columns;
 // A status tab already states the status of every row; drop the repeated column (users keep their access switch).
 const displayColumnsRaw=filters.status&&resource!=="users"&&config.fields.some(field=>field.key==="status")?baseColumns.filter(c=>c!=="status"):baseColumns;
 // Selected doctor/location is shown once in the filter context; do not repeat it on every schedule row.
 const displayColumnsBase=resource==="availability"?displayColumnsRaw.filter(c=>!(c==="doctorName"&&filters.doctorId)&&!(c==="branchName"&&filters.branchId)):displayColumnsRaw;
 const VIEW_KEYS=useMemo(()=>[...LIST_FILTER_KEYS,"sort","pageSize"],[]);
 const listingLayout=useListingLayout(resource,identity?.user?.id,identity?.user?.role,VIEW_KEYS);
 const arranged=arrangeColumns(displayColumnsBase,listingLayout.layout);
 const displayColumns=arranged.visible;
 const hiddenColumns=arranged.hidden;
 const [expanded,setExpanded]=useState<string|null>(null);
 const currentViewFilters:Record<string,string>={...filters,...(sort!=="-createdAt"?{sort}:{}),...(pageSize!==20?{pageSize:String(pageSize)}:{})};
 const viewControls=<><ColumnSettings columns={displayColumnsBase} layout={listingLayout.layout} label={columnLabel} onChange={listingLayout.setLayout} onReset={listingLayout.resetColumns}/><SavedViews canShare={listingLayout.canShare} legacyViews={listingLayout.legacyViews} onImport={listingLayout.importLegacyView} views={listingLayout.layout.views} canSave={Object.values(currentViewFilters).some(Boolean)||listingLayout.layout.order.length>0||listingLayout.layout.hidden.length>0||!!listingLayout.layout.pinned} onSave={view=>listingLayout.saveView(view,currentViewFilters)} onDelete={listingLayout.deleteView} onApply={view=>{listingLayout.applyViewColumns(view,displayColumnsBase);changeUrl({...Object.fromEntries(VIEW_KEYS.map(key=>[key,""])),...view.filters,page:1});}}/></>;
 const portal=identity?.user?.role==="doctor"?"doctor":identity?.user?.role==="receptionist"?"receptionist":"admin";
  useEffect(()=>{if(query.data&&!query.isPlaceholderData&&page>1&&page>Math.max(1,Math.ceil(query.data.total/pageSize)))setPage(Math.max(1,Math.ceil(query.data.total/pageSize)));},[query.data,query.isPlaceholderData,page,pageSize]);
 const save=useMutation({mutationFn:(data:any)=>editing?.id?config.update(editing.id,data):config.create(data),onSuccess:()=>{setEditing(null);notifySuccess("Updated successfully");client.invalidateQueries();}});
 const remove=useMutation({mutationFn:(id:string)=>config.remove(id),onSuccess:()=>{notifySuccess("Record deactivated. Historical records are preserved.");client.invalidateQueries();}});
 const statusUpdate=useMutation({mutationFn:({row,status}:{row:api.User;status:"active"|"inactive"})=>api.updateUser(row.id,{fullName:row.fullName,email:row.email,role:row.role,status,...row.clinicIds?{clinicIds:row.clinicIds}:{},...row.branchIds?{branchIds:row.branchIds}:{}}),onSuccess:()=>{setSuccess("User status updated.");client.invalidateQueries();}});
 const changeUserStatus=async(row:any)=>{
   if(statusUpdate.isPending)return;
   const next=row.status==="active"?"inactive":"active";
   if(next==="inactive"&&!await confirmation.ask({title:`Deactivate ${row.fullName}?`,description:"They may lose access. Protected clinic owners require an ownership transfer first.",confirmLabel:"Deactivate",tone:"danger"}))return;
   setSuccess("");
   statusUpdate.mutate({row,status:next});
 };

 const effectiveFields = useMemo(() => {
   if (!identity?.user) return config.fields;
   const meRole = identity.user.role;
   return config.fields.map(f => {
     const field = { ...f };
     if (field.key === "adminId" && meRole !== "superAdmin") field.hidden = true;
     if (field.key === "ownerAdminId" && meRole !== "superAdmin") field.hidden = true;

     if (resource === "users" && field.key === "role") {
        if (editing?.id) {
           field.options = [editing.role];
        } else {
           if (meRole === "doctor") field.options = ["receptionist"];
           else if (meRole === "clinicAdmin") field.options = ["receptionist", "patient"];
           else field.options = ["receptionist", "patient"];
        }
     }
     return field;
   });
 }, [config.fields, identity, resource, editing]);

  const listName=resource==="branches"?"locations":config.name;
  const searchPlaceholder=resource==="doctors"?"Search doctors by name, email or specialization…":resource==="patients"?"Search patients by name, email or mobile…":resource==="audit"?"Search audit events…":`Search ${listName}…`;
   const singularName=resource==="branches"?"location":resource==="availability"?"schedule":resource==="qrs"?"QR code":resource==="masters"?"master value":resource.replace(/s$/,"");
  const sortOptions=[{value:"-createdAt",label:"Newest First"},{value:"createdAt",label:"Oldest First"},...(["clinics","branches","masters","qrs"].includes(resource)?[{value:"name",label:"Name A–Z"},{value:"-name",label:"Name Z–A"}]:[]),...(["doctors","patients","users"].includes(resource)?[{value:"fullName",label:"Name A–Z"},{value:"-fullName",label:"Name Z–A"}]:[]),...(resource==="exceptions"?[{value:"date",label:"Earliest Date"},{value:"-date",label:"Latest Date"}]:[]),...(config.fields.some(field=>field.key==="status")?[{value:"status",label:"Status A–Z"},{value:"-status",label:"Status Z–A"}]:[])];
  const sortableColumns=new Set(["name","fullName","date","status","code","email"]);
  const hasAdvanced=resource==="clinics"?identity?.user?.role==="superAdmin":["doctors","patients","qrs","availability","audit"].includes(resource)||resource==="branches"&&!fixedClinicId;
  const hasStatusTabs=config.fields.some(field=>field.key==="status");
  const chips:FilterChip[]=[
    ...(search?[{key:"search",label:`Search: ${search}`,onRemove:()=>setSearch("")}]:[]),
    ...Object.entries(filters).filter(([k,v])=>v&&v!==roleDefaults[k]&&!(k==="status"&&hasStatusTabs)).map(([k,v])=>({key:`${k==="status"||["availability","exceptions","masters"].includes(resource)&&PRIMARY_KEYS[resource]?.includes(k)?"":"adv:"}${k}`,label:resource==="patients"&&k==="clinicId"?"Registration clinic selected":chipLabel(k,v),onRemove:()=>filter(k,roleDefaults[k]||"")})),
    ...(sort!=="-createdAt"?[{key:"sort",label:`Sort: ${sortOptions.find(o=>o.value===sort)?.label||sort}`,onRemove:()=>setSort("-createdAt")}]:[]),
  ];
   return <><div className={`admin-listing-filter${embedded?" embedded":""}`}><FilterBar title={query.data&&!query.error?<span className="listing-count-label"><span className="listing-count">{query.data.total}</span> {listName}</span>:undefined} status={hasStatusTabs?<div className="sq-status-tabs" role="tablist" aria-label={`${title(listName)} status`} onKeyDown={e=>tabListKeyDown(e,["","active","inactive"],filters.status||"",v=>filter("status",v))}>{[["","All"],["active","Active"],["inactive","Inactive"]].map(([value,label])=><button type="button" key={value} role="tab" tabIndex={(filters.status||"")===value?0:-1} aria-selected={(filters.status||"")===value} onClick={()=>filter("status",value)} data-testid={`tab-${resource}-${value||"all"}`}>{label}</button>)}</div>:undefined} meta={<>{!fixedClinicId&&["availability","exceptions"].includes(resource)&&<ResourceLookup resource="clinics" label="Clinic" value={filters.clinicId||""} onChange={value=>filter("clinicId",value)}/>}{["availability","exceptions"].includes(resource)&&<ResourceLookup resource="branches" label="Location" params={{clinicId:filters.clinicId||undefined}} value={filters.branchId||""} onChange={value=>filter("branchId",value)}/>}{["availability","exceptions"].includes(resource)&&<ResourceLookup resource="doctors" label="Doctor" params={{clinicId:filters.clinicId||undefined,branchId:filters.branchId||undefined}} value={filters.doctorId||""} onChange={value=>filter("doctorId",value)}/>}{resource==="exceptions"&&<label>Date<DateFormatInput value={filters.date||""} onChange={value=>filter("date",value)}/></label>}{resource==="masters"&&<SearchableSelect label="Category" placeholder="All categories" value={filters.category||""} onChange={value=>filter("category",value)} options={Object.values(api.MasterInputCategory).map(category=>({value:category,label:title(category)}))}/>}<div className="sort-menu" data-testid={`select-sort-${resource}`}><SearchableSelect label={`Sort ${listName}`} value={sortOptions.some(option=>option.value===sort)?sort:"-createdAt"} onChange={value=>setSort(value||"-createdAt")} options={sortOptions}/></div></>} secondary={<>{resource==="patients"&&<PatientFilteredExport params={listParams} timezone={settings.data?.timezone} disabled={query.isLoading||query.isPlaceholderData||!!query.error||!query.data?.total}/>}{viewControls}</>} actions={<>{config.create&&allowCreate&&<button className="button small" onClick={()=>{save.reset();setDirty(false);setEditing({...defaults,...resource==="qrs"?Object.fromEntries(["clinicId","branchId","doctorId"].filter(key=>filters[key]).map(key=>[key,filters[key]])):{},...fixedClinicId?{clinicId:fixedClinicId}:{}});}} data-testid={`button-add-${resource}`}><Plus size={17}/> Add {singularName}</button>}</>} onReset={reset} active={active} chips={chips} label={`Filter ${listName}`} onOpen={()=>setDraft(filters)} onApply={applyDraft} advanced={hasAdvanced?<>
  {resource==="clinics"&&identity?.user?.role==="superAdmin"&&<ResourceLookup resource="users" label="Clinic Admin" params={{role:"clinicAdmin"}} value={draft.adminId||""} onChange={value=>draftFilter("adminId",value)}/>}
  {resource==="doctors"&&<ResourceLookup resource="masters" label="Specialization" params={{category:"specialization"}} value={draft.specializationId||""} onChange={value=>draftFilter("specializationId",value)}/>}
  {resource==="doctors"&&identity?.user?.role==="superAdmin"&&<ResourceLookup resource="users" label="Managing Admin" params={{role:"clinicAdmin"}} value={draft.managingAdminId||""} onChange={value=>draftFilter("managingAdminId",value)}/>}
  {["patients","audit"].includes(resource)&&<><label>From date<DateFormatInput value={draft.from||""} onChange={value=>draftFilter("from",value)}/></label><label>To date<DateFormatInput min={draft.from||undefined} value={draft.to||""} onChange={value=>draftFilter("to",value)}/></label></>}
  {["doctors","patients"].includes(resource)&&<ResourceLookup resource="branches" label="Clinic" params={{clinicId:draft.clinicId||undefined}} value={draft.branchId||""} onChange={value=>draftFilter("branchId",value)}/>}
   {["branches","doctors","patients","qrs"].includes(resource)&&!fixedClinicId&&<ResourceLookup resource="clinics" label={resource==="patients"?"Registration clinic":"Clinic"} value={draft.clinicId||""} onChange={value=>draftFilter("clinicId",value)}/>}
   {resource==="qrs"&&<><ResourceLookup resource="branches" label="Location" params={{clinicId:draft.clinicId||undefined}} value={draft.branchId||""} onChange={value=>draftFilter("branchId",value)}/><ResourceLookup resource="doctors" label="Doctor" params={{clinicId:draft.clinicId||undefined,branchId:draft.branchId||undefined}} value={draft.doctorId||""} onChange={value=>draftFilter("doctorId",value)}/></>}
  {resource==="availability"&&<SearchableSelect label="Day" placeholder="All days" value={draft.dayOfWeek||""} onChange={value=>draftFilter("dayOfWeek",value)} options={DAYS.map((label,index)=>({value:String(index),label}))}/>}
   {resource==="audit"&&<SearchableSelect label="Event Category" placeholder="All events" value={draft.activityType||""} onChange={value=>draftFilter("activityType",value)} options={[{value:"operational",label:"Operational Activity"},{value:"security",label:"Security Audit"}]}/>}
 </>:undefined}>
   <SearchInput placeholder={searchPlaceholder} value={search} onChange={setSearch} suggestions={query.error||query.isPlaceholderData?[]:listingSuggestions(query.data?.items,(row:any)=>{const value=row.fullName||row.name||row.reference||row.summary;return value?{id:String(row.id),label:String(value),description:[row.clinicName||row.specializationName||row.city,row.category].filter(Boolean).join(" · ")||undefined,value:String(value)}:null;})} loading={query.isFetching} error={query.error?friendlyError(query.error,"load"):null} onRetry={()=>void query.refetch()} total={query.data?.total} settledQuery={term} scopeKey={JSON.stringify([resource,{...listParams,search:undefined,page:undefined}])}/>
  </FilterBar></div>
 {confirmation.dialog}{success&&<p className="notice" role="status">{success}</p>}
  {resource==="availability"&&<p className="listing-hint" data-testid="notice-schedule-vs-opening-hours">Doctor sessions set bookable times and capacity for each doctor and location. Location opening hours are separate; {identity?.user?.role==="superAdmin"||identity?.user?.role==="clinicAdmin"?<Link href={`/admin/settings${filters.clinicId?`?clinicId=${encodeURIComponent(filters.clinicId)}`:""}`} data-testid="link-location-opening-hours">edit opening days and hours in Clinic settings</Link>:"ask the clinic owner to update them"}.</p>}
  {resource==="qrs"&&<p className="listing-hint" data-testid="notice-qr-readiness">A booking QR can identify a clinic before it is ready to accept patients. Check that the location is open and the doctor has active bookable sessions with capacity in <Link href={`/${portal}/availability${filters.clinicId?`?clinicId=${encodeURIComponent(filters.clinicId)}`:""}`} data-testid="link-qr-sessions">Weekly Schedule</Link> before sharing it.</p>}
 {!allowCreate&&resource==="patients"&&<p className="notice">New patient registration is available to receptionists and administrators. Ask your clinic staff to register a new patient.</p>}<ErrorNotice error={remove.error||statusUpdate.error}/>
 <ListingBulk selection={selection} resource={resource} columns={config.columns} identity={identity} context={selectionContext}/>
 {resource==="availability"&&filters.doctorId&&filters.branchId&&<WeeklyScheduleEditor key={`${filters.doctorId}-${filters.branchId}`} doctorId={filters.doctorId} branchId={filters.branchId} onEdit={row=>{save.reset();setDirty(false);setEditing(row);}}/>}
 <section className={`panel table-panel admin-listing-table density-${density}`}>
   {query.isLoading?<div className="skeleton" role="status">Loading {listName}…</div>:query.error?<><div className="error-box" role="alert">{friendlyError(query.error,"load")}</div><button onClick={()=>query.refetch()}>Retry {listName}</button></>:query.data?.items?.length?<div className="table-scroll" inert={query.isPlaceholderData}><table aria-busy={query.isFetching}>
  <colgroup><col className="col-select"/>{displayColumns.map(c=><col key={c} className={compact&&c===config.columns[0]?"col-record":undefined}/>)}{hasActions&&<col className="col-actions"/>}</colgroup>
  <thead><tr><th scope="col" className="col-select">{selection.header}</th>{displayColumns.map(c=><th scope="col" key={c} aria-sort={sortableColumns.has(c)?sort.replace(/^-/,"")===c?sort.startsWith("-")?"descending":"ascending":"none":undefined} className={[compact&&c===config.columns[0]?"col-record":c==="status"?"col-status":"",c===arranged.pinned?"col-pinned":""].filter(Boolean).join(" ")||undefined}>{sortableColumns.has(c)?<button type="button" className="table-sort-header" style={{display:"inline-flex",alignItems:"center",gap:4,border:0,background:"transparent",font:"inherit",color:"inherit",padding:0,cursor:"pointer"}} onClick={()=>setSort(sort===c?`-${c}`:c)} aria-label={`Sort by ${columnLabel(c)} ${sort===c?"descending":"ascending"}`} data-testid={`sort-${resource}-${c}`}>{columnLabel(c)}{sort.replace(/^-/,"")===c?sort.startsWith("-")?<ArrowDown size={14}/>:<ArrowUp size={14}/>:<ArrowUpDown size={13}/>}</button>:columnLabel(c)}</th>)}{hasActions&&<th scope="col" className="col-actions sticky">Actions</th>}</tr></thead>
 <tbody>{query.data.items.map((row:any)=><Fragment key={row.id}><tr data-testid={`row-${resource}-${row.id}`}>
 <td data-label="Select" className="col-select">{selection.checkbox(row)}{hiddenColumns.length>0&&<button type="button" className="row-expand-toggle" aria-expanded={expanded===row.id} aria-controls={`expand-${row.id}`} aria-label={`${expanded===row.id?"Hide":"Show"} hidden details for ${row.name||row.fullName||"record"}`} onClick={()=>setExpanded(expanded===row.id?null:row.id)} data-testid={`button-expand-${row.id}`}><ChevronRight size={14} aria-hidden/></button>}</td>
  {displayColumns.map(c=><td key={c} data-label={columnLabel(c)} className={[compact&&c===config.columns[0]?"col-record":c==="createdAt"?"col-created":"",c===arranged.pinned?"col-pinned":""].filter(Boolean).join(" ")||undefined}>{compact&&c===config.columns[0]?<div className="admin-record"><strong>{resource==="clinics"&&portal==="admin"?<Link href={`/admin/settings?clinicId=${encodeURIComponent(row.id)}&section=general`}><OverflowText value={row[c]}/></Link>:<OverflowText value={row[c]} testId={`text-${resource}-name-${row.id}`}/>}</strong>{recordSecondary(resource,row,displayColumns)&&<small><OverflowText value={String(recordSecondary(resource,row,displayColumns))}/></small>}</div>:resource==="users"&&c==="status"?<StatusSwitch label={`${row.fullName}: ${row.status==="active"?"Active":"Inactive"}`} testId={`switch-user-status-${row.id}`} active={row.status==="active"} title={row.id===identity?.user?.id?"Change your own status through an authorised administrator":!["superAdmin","clinicAdmin"].includes(identity?.user?.role||"")?"Only administrators can change user access":undefined} disabled={statusUpdate.isPending||row.id===identity?.user?.id||!["superAdmin","clinicAdmin"].includes(identity?.user?.role||"")} onChange={()=>changeUserStatus(row)}>{row.status==="active"?"Active":"Inactive"}{row.id===identity?.user?.id&&<small className="muted"> · Ask another administrator</small>}</StatusSwitch>:resource==="audit"&&c==="action"?title(String(row.action||"").replace(/[._]/g," ")):resource==="audit"&&c==="summary"?<span className="audit-summary-cell"><OverflowText value={row.summary}/><button type="button" className="button secondary small" aria-label={`Event details: ${row.summary||row.action}`} onClick={()=>setAuditDetail(row)} data-testid={`button-audit-details-${row.id}`}>Details</button></span>:c==="createdAt"?<CreatedCell value={row[c]} timezone={row.timezone||settings.data?.timezone} preferences={row}/>:renderComputed(c,row)??(c==="status"?<span className={`badge ${row[c]}`}>{title(row[c]||"")}</span>:c==="dayOfWeek"?DAYS[row[c]]:typeof row[c]==="boolean"?(row[c]?"Yes":"No"):Array.isArray(row[c])?<OverflowText value={row[c].join(", ")}/>:typeof row[c]==="string"?<OverflowText value={row[c]}/>:row[c]??"—")}</td>)}
 {hasActions&&<td data-label="Actions" className="col-actions sticky"><div className="row-actions">{resource==="qrs"&&row.status==="active"&&<HelpTip text="View booking QR and link"><button type="button" aria-label={`View booking QR for ${row.name}`} onClick={()=>setQrPreview(row)} data-testid={`button-view-qr-${row.id}`}><QrCode size={15}/></button></HelpTip>}{["clinics","branches"].includes(resource)&&<LocationActions row={row} resource={resource} portal={portal}/>}{resource==="patients"&&<HelpTip text="Timeline, activity and documents"><button type="button" aria-label={`Open details for ${row.fullName||"patient"}`} onClick={()=>setPatientDetail(row)} data-testid={`button-patient-details-${row.id}`}><FileText size={15}/></button></HelpTip>}{config.update&&<><HelpTip text={resource==="clinics"?"Configure this clinic":"Edit this record"}>{resource==="clinics"&&portal==="admin"?<Link aria-label={`Configure ${row.name}`} href={`/admin/settings?clinicId=${encodeURIComponent(row.id)}&section=general`}><Pencil size={15}/></Link>:<button aria-label={`Edit ${row.name||row.fullName||"record"}`} onClick={()=>{if(onEdit)onEdit(row);else{save.reset();setDirty(false);setEditing(row);}}}><Pencil size={15}/></button>}</HelpTip><HelpTip text="Deactivate; historical records are preserved"><button aria-label={`Deactivate ${row.name||row.fullName||"record"}`} disabled={remove.isPending||row.status==="inactive"} onClick={async()=>{if(!remove.isPending&&await confirmation.ask({title:"Deactivate Record?",description:"The record becomes inactive. Historical records are preserved; this is not permanent deletion.",confirmLabel:"Deactivate",tone:"danger"}))remove.mutate(row.id);}}><Trash2 size={15}/></button></HelpTip></>}</div></td>}
  </tr>{expanded===row.id&&hiddenColumns.length>0&&<tr className="row-expansion" id={`expand-${row.id}`}><td colSpan={displayColumns.length+(hasActions?2:1)}><dl>{hiddenColumns.map(c=><div key={c}><dt>{columnLabel(c)}</dt><dd>{c==="createdAt"?<CreatedCell value={row[c]} timezone={row.timezone||settings.data?.timezone} preferences={row}/>:renderComputed(c,row)??(c==="status"?title(row[c]||""):c==="dayOfWeek"?DAYS[row[c]]:typeof row[c]==="boolean"?(row[c]?"Yes":"No"):Array.isArray(row[c])?<OverflowText value={row[c].join(", ")}/>:typeof row[c]==="string"?<OverflowText value={row[c]}/>:row[c]??"—")}</dd></div>)}</dl></td></tr>}</Fragment>)}</tbody></table></div>:active?<div className="empty"><h3>No matching {listName}</h3><p>Try a different search or clear your filters.</p><button onClick={reset}>Clear Filters</button></div>:<Empty label={listName}/>}
  {query.isFetching&&!query.isLoading&&!query.error&&<span className="admin-listing-refresh" role="status">Updating {listName}…</span>}
  {!query.error&&<div className="admin-listing-pagination"><Pagination page={page} pageSize={pageSize} total={query.data?.total||0} onPageChange={setPage} onPageSizeChange={setPageSize} resetPageOnSizeChange={false}/></div>}</section>
  {resource==="users"&&identity?.user?.role!=="doctor"&&<details className="panel listing-disclosure" data-testid="details-account-recovery"><summary>Account Recovery Assistance</summary><p className="muted">Select a linked staff account to view the secure account recovery steps. This action does not send an email.</p><div className="inline-form"><ResourceLookup resource="users" label="Staff Account" params={{role:"receptionist",linkedOnly:true}} value={recoveryId} onChange={value=>{setRecoveryId(value);recovery.reset();}}/><button disabled={!recoveryId||recovery.isPending} onClick={()=>{if(!recovery.isPending)recovery.mutate({id:recoveryId});}} data-testid="button-password-reset">{recovery.isPending?"Loading…":"Get Recovery Steps"}</button></div><ErrorNotice error={recovery.error}/>{recovery.data&&<div className="notice" data-testid="status-password-recovery"><p>{recovery.data.message}</p><Link href="/forgot-password" className="text-link" data-testid="link-password-recovery">Open Secure Password Recovery</Link></div>}</details>}
 {resource==="users"&&identity?.user?.role==="superAdmin"&&allowCreate&&<ClinicAdminOnboarding />}
  {resource==="patients"&&patientDetail&&<PatientDetailsDrawer patient={patientDetail} onClose={()=>setPatientDetail(null)}/>}{resource==="audit"&&auditDetail&&<AppDialog open variant="drawer" onClose={()=>setAuditDetail(null)} title="Audit Event"><dl className="facts audit-detail" data-testid="audit-detail">{[["Time",auditDetail.createdAt?formatConfiguredTimestamp(auditDetail.createdAt,auditDetail.timezone||settings.data?.timezone,undefined,auditDetail):"—"],["Actor",[auditDetail.actorName,auditDetail.actorRole&&title(auditDetail.actorRole)].filter(Boolean).join(" · ")||"—"],["Action",auditDetail.action],["Record type",auditDetail.entityType],["Summary",auditDetail.summary]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||"—"}</dd></div>)}</dl><details className="audit-technical"><summary>Technical Payload</summary><pre data-testid="audit-payload">{JSON.stringify(auditDetail,null,2)}</pre></details></AppDialog>}
  {resource==="qrs"&&qrPreview&&<AppDialog open onClose={()=>setQrPreview(null)} title={`Booking QR · ${qrPreview.name}`}><QrCard row={qrPreview} onRegenerated={()=>{setQrPreview(null);setSuccess("QR reference regenerated. Replace printed copies.");}}/></AppDialog>}
   {editing&&<AppDialog open size="wide" onClose={()=>setEditing(null)} title={`${editing.id?"Edit":"Add"} ${title(singularName)}`} dirty={dirty} busy={save.isPending}>{resource==="availability"&&<p className="notice">Each record is one consulting session. Add separate, non-overlapping sessions for the same doctor, clinic and weekday. Overnight sessions are not supported.</p>}{resource==="branches"&&editing.id&&<p className="notice">Effective contacts: {editing.effectiveEmail||"No email"} · {editing.effectivePhone||"No phone"}. Inherited contacts update when the Clinic Group changes; clinic overrides are retained.</p>}<ErrorNotice error={save.error}/><Editor fields={effectiveFields} initial={editing} onSave={data=>{if(!save.isPending)save.mutate(data);}} onCancel={async()=>{if(!dirty||await confirmation.ask({title:"Discard Changes?",description:"Your unsaved changes will be lost.",confirmLabel:"Discard Changes",tone:"danger"}))setEditing(null);}} busy={save.isPending} resourceName={resource} onDirtyChange={setDirty}/></AppDialog>}
 </>;
}
export const profileFields = [f("fullName","text",true),f("mobile","tel"),f("photoUrl","url")];
export const settingsFields = [f("platformName"),f("supportEmail","email"),f("supportPhone","tel"),f("timezone"),f("bookingHorizonDays","number"),f("cancellationCutoffMinutes","number"),f("requireMobileVerification","checkbox"),f("otpExpirySeconds","number"),f("otpMaxAttempts","number"),f("termsUrl","url"),f("privacyUrl","url")];