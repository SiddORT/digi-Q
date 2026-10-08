import { OWNER_ONLY_FIELDS, canChangeClinicDefaults, ownerOnlyLocked } from "./lib/inherited-defaults";
import { clinicDetailsHref } from "./lib/clinic-navigation";
import { EDITOR_TABS, editorTabIndex } from "./lib/form-tabs";
import { FormTabs } from "./components/FormTabs";
import { RowMenu, type RowMenuItem } from "./components/RowMenu";
import { IconAction } from "./components/IconAction";
import { EmailInput } from "@/components/EmailInput";
import { titleCase } from "./lib/title-case";
import { OverflowText } from "./components/OverflowText";
import { Fragment, useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import { beginEditorSubmission } from "./components/editor-submission";
import { submitWithNativeChecks, revealAndFocus } from "./components/native-validity";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { validatePostalCode } from "./lib/address";
import { Link, useLocation, useSearch } from "wouter";
import { createPortal } from "react-dom";
import { Form } from "@/components/ui/form";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { Plus, Pencil, Trash2, Download, Copy, Monitor, QrCode, ArrowUp, ArrowDown, ArrowUpDown, ListFilter, ChevronRight, PanelRightOpen, Eye } from "lucide-react";
import { ColumnSettings, SavedViews } from "./components/ListingViewControls";
import { arrangeColumns, useListingLayout } from "./lib/listing-views";
import { ClinicAdminOnboarding } from "./components/ClinicAdminOnboarding";
import { ResourceLookup, ResourceMultiLookup } from "./components/ResourceLookup";
import { useFilterNames } from "./components/FilterNames";
import { useDirectoryActor } from "./lib/use-directory";
import { validDependentIds } from "./components/relation-validity";
import { Pagination, SearchInput, FilterBar, useDebouncedValue, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE, listingSuggestions, type FilterChip } from "./components/ListingControls";
import { AppDialog } from "./components/AppDialog";
import { SearchableSelect } from "./components/SearchableSelect";
import { SuggestionInput } from "./components/SuggestionInput";
import { emptyFieldValue, scheduleBreakFields, selectInputValue } from "./editor-input";
import { ListingBulk, useListingSelection, publicQrLink, CreatedCell } from "./components/AdminListing";
import { HelpTip } from "./components/HelpTip";
import { collectFilteredPatients, filteredPatientsCsv } from "./components/patient-export";
import { AddressFields, type AddressValue } from "./components/AddressFields";
import { PATIENT_SECONDARY, secondaryFieldErrors } from "./lib/patient-details";
import type { FieldWidth } from "./lib/field-width";
import { PatientDetailsDrawer } from "./components/PatientDetailsDrawer";
import { ExactRecordDrawer, RecordFacts, scanScopedPages, useExactRecord, type RecordFact } from "./components/RecordDetails";
import { WeeklyScheduleEditor } from "./components/schedule/WeeklyScheduleEditor";
import { ExceptionImpactPreview } from "./components/schedule/ExceptionImpactPreview";
import { friendlyError } from "./lib/friendly-error";
import { required, validatePersonName, validatePhone, validateEmail, validateDateOfBirth, ageFromDateOfBirth, normalizePhone, validateNumberRange } from "./lib/validators";
import { formatDate, formatTime, formatConfiguredTimestamp } from "./lib/date-time";
import { TimezoneSelect } from "./components/TimezoneSelect";
import { DateFormatInput, TimeFormatInput } from "./components/DateFormatInput";
import { DateRangeInput } from "./components/DateRangeInput";
import { rangeError } from "./lib/date-picker-logic";
import { FormField } from "./components/FormField";
import { FormActions } from "./components/FormActions";
import { fieldWidthClass } from "./lib/field-width";
import { useConfirm } from "./components/ConfirmDialog";
import { notifySuccess } from "./lib/notify";
import { PhoneInput } from "./components/PhoneInput";
import { StatusSwitch } from "./components/StatusSwitch";
import { useDateTimePreferences } from "./components/DateTimePreferences";
import { TimeRangeSlider } from "./components/ClinicRegistrationHours";
import { useWorkspaceBranch, useRegisterUnsaved } from "./components/WorkspaceBranch";

export const title = (s:string) => titleCase({called:"Called Next",noShow:"Absent",branch:"Clinic",branches:"Clinics",branchName:"Clinic",branchNames:"Clinics",clinic:"Clinic Group",clinicName:"Clinic Group",clinicNames:"Clinic Groups"}[s] || s.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase()));
export const today = (timeZone?:string) => new Date().toLocaleDateString("en-CA",timeZone?{timeZone}:undefined);
export function ErrorNotice({error}:{error:unknown}) { return error ? <div className="error-box" role="alert" data-testid="status-error">{friendlyError(error)}</div> : null; }
export function Empty({label="Records"}:{label?:string}){return <div className="empty" data-testid="status-empty"><span className="empty-icon"><Plus size={24}/></span><h3>No {label} yet</h3><p>When {label} are added, you'll find them here.</p></div>;}
type Field = {key:string; label?:string; type?:string; required?:boolean; options?:string[]; resource?:string; category?:string; nullable?:boolean; hidden?:boolean; disabled?:boolean; wide?:boolean; width?:FieldWidth};
const f=(key:string,type="text",required=false,options?:string[]):Field=>({key,type,required,options});
const relation=(key:string,resource:string,required=false):Field=>({key,resource,required});
const master=(key:string,category:string):Field=>({...relation(key,"masters"),category});
const location=(key:string,required=false):Field=>({key,required,type:"masterText",category:key});
const status=f("status","select",false,["active","inactive"]);
/** Section C shared address layout: wide address line, content-sized country/state/city/PIN. One definition for every form. */
export const addressFields=(requiredLine=false):Field[]=>[{...f("address","address",requiredLine),label:"Address Line",wide:true},...["country","state","city","pincode"].map(key=>({key,type:"addressPart"}))];
const ADDRESS_KEYS=["address","country","state","city","pincode"] as const;
/** Binds the shared AddressFields to an Editor form: same component, same layout as public screens. */
function EditorAddress({form,required:lineRequired}:{form:ReturnType<typeof useForm<Record<string,any>>>;required?:boolean}){
 const watched=useWatch({control:form.control,name:[...ADDRESS_KEYS]}) as string[];
 const value=Object.fromEntries(ADDRESS_KEYS.map((key,i)=>[key,watched?.[i]||""])) as AddressValue;
 form.register("address",{validate:v=>(lineRequired?required()(v):undefined)||true});
 form.register("pincode",{validate:v=>validatePostalCode(v,form.getValues("country"))});
 ["country","state","city"].forEach(key=>form.register(key));
 const errors=Object.fromEntries(ADDRESS_KEYS.filter(key=>form.formState.errors[key]).map(key=>[key,String(form.formState.errors[key]?.message||"This field is required")]));
 return <AddressFields value={value} required={lineRequired} errors={errors} onChange={patch=>Object.entries(patch).forEach(([key,next])=>form.setValue(key,next,{shouldDirty:true,shouldValidate:!!form.formState.errors[key]||key==="pincode"}))}/>;
}
const locationFields=[...addressFields(true),f("phone","tel")];
const person=[f("fullName","text",true),f("mobile","tel",true),f("email","email"),f("dateOfBirth","date"),f("gender","select",false,["female","male","other","preferNotToSay"])];
type Resource = {name:string; list:any;create?:any;update?:any;remove?:any;fields:Field[];columns:string[]};
export const resources:Record<string,Resource>={
 clinics:{name:"clinics",list:api.listClinics,create:api.createClinic,update:api.updateClinic,remove:api.deleteClinic,fields:[f("name","text",true),f("slug"),...locationFields,location("area"),f("email","email"),f("description","textarea"),master("clinicTypeId","clinicType"),master("categoryId","clinicCategory"),master("specialityIds","specialization"),f("referralCode"),relation("adminId","users"),status],columns:["name","code","city","phone","status"]},
 branches:{name:"branches",list:api.listBranches,create:api.createBranch,update:api.updateBranch,remove:api.deleteBranch,fields:[relation("clinicId","clinics",true),f("name","text",true),f("slug"),...locationFields,f("email","email"),{...f("inheritEmail","checkbox"),label:"Use Clinic Email"},{...f("inheritPhone","checkbox"),label:"Use Clinic Phone"},f("timezone"),status],columns:["name","clinicName","city","timezone","status"]},
 doctors:{name:"doctors",list:api.listDoctors,create:api.createDoctor,update:api.updateDoctor,remove:api.deleteDoctor,fields:[...person.map(field=>field.key==="email"?{...field,required:true}:field.key==="mobile"?{...field,required:false}:field),f("photoUrl","url"),master("specializationId","specialization"),f("registrationNumber"),f("experienceYears","number"),f("consultationFee","number"),f("about","textarea"),...addressFields(),relation("ownerAdminId","users"),relation("clinicIds","clinics"),relation("branchIds","branches"),master("qualificationIds","qualification"),{...f("languages","array"),label:"Languages (comma-separated)"},status],columns:["fullName","specializationName","email","clinicNames","branchNames","status"]},
 patients:{name:"patients",list:api.listPatients,create:api.createPatient,update:api.updatePatient,remove:api.deletePatient,fields:[...person.map(field=>field.key==="mobile"?{...field,required:false,label:"Mobile"}:field.key==="email"?{...field,width:"lg" as const}:field),f("age","number"),...addressFields(),{...f("emergencyContactName"),width:"lg" as const},f("emergencyContactPhone","tel"),{...relation("clinicId","clinics"),width:"md" as const},{...relation("branchId","branches"),width:"md" as const},{...status,width:"sm" as const}],columns:["fullName","code","mobile","gender"]},
 users:{name:"users",list:api.listUsers,create:api.createUser,update:api.updateUser,remove:api.deleteUser,fields:[f("fullName","text",true),f("email","email",true),f("mobile","tel"),f("role","select",true,["receptionist","clinicAdmin","patient"]),...addressFields(),relation("clinicIds","clinics"),relation("branchIds","branches"),status],columns:["fullName","email","role","clinicNames","branchNames","status"]},
 masters:{name:"master values",list:api.listMasters,create:api.createMaster,update:api.updateMaster,remove:api.deleteMaster,fields:[f("category","select",true,Object.values(api.MasterInputCategory)),f("name","text",true),f("code","text",true),relation("parentId","masters"),f("sortOrder","number"),status],columns:["name","category","code","status"]},
 availability:{name:"weekly schedules",list:api.listSchedules,create:api.createSchedule,update:api.updateSchedule,remove:api.deleteSchedule,fields:[relation("doctorId","doctors",true),relation("clinicId","clinics",true),relation("branchId","branches",true),{...f("dayOfWeek","select",true,["0","1","2","3","4","5","6"]),width:"md" as const},{...f("isOpen","checkbox"),label:"Session Open",width:"md" as const},f("startTime","time",true),f("endTime","time",true),...scheduleBreakFields,{...f("timezone"),width:"lg" as const},{...f("tokenPrefix","text",true),width:"sm" as const},{...f("maxTokens","number",true),label:"Max Tokens",width:"sm" as const},{...f("consultationMinutes","duration",true),label:"Consultation Duration",width:"sm" as const},{...f("bufferMinutes","number"),label:"Buffer (min)",width:"sm" as const},{...f("queueMode","select",false,["mixed","appointmentsOnly","walkInsOnly"]),width:"md" as const},f("queueOpenTime","time"),f("queueCloseTime","time")],columns:["doctorName","branchName","dayOfWeek","session","break","capacity","isOpen"]},
 exceptions:{name:"date exceptions",list:api.listAvailabilityExceptions,create:api.createAvailabilityException,update:api.updateAvailabilityException,remove:api.deleteAvailabilityException,fields:[relation("doctorId","doctors",true),relation("branchId","branches",true),f("date","date",true),{...f("sessionId","session"),label:"Session (Optional; Blank Applies to All)"},{...f("isClosed","checkbox"),label:"Day Off (Closed)",width:"md" as const},{...f("isExtra","checkbox"),label:"Extra Interval (Adds a Session)",width:"md" as const},{...f("reason","text",true),width:"lg" as const},{...f("startTime","time"),nullable:true},{...f("endTime","time"),nullable:true},...scheduleBreakFields,{...f("maxTokens","number"),nullable:true}],columns:["date","reason","isClosed","session","break","maxTokens"]},
  qrs:{name:"booking QR codes",list:api.listQrs,create:api.createQr,update:api.updateQr,remove:api.deleteQr,fields:[f("name","text",true),relation("clinicId","clinics",true),{...relation("branchId","branches"),nullable:true},{...relation("doctorId","doctors"),nullable:true},status],columns:["name","reference","status"]},
 audit:{name:"audit events",list:api.listAuditLogs,fields:[],columns:["createdAt","actorName","action","summary"]},
};
/**
 * Section E shared patient editor: the same fields and validation from Patients and booking.
 * Clinic/location come from the surrounding context when booking; callers keep their own permissions.
 */
/** Section E: one wording for contact vs notification vs sign-in, used wherever a patient is registered. */
export const PATIENT_CONTACT_RULE="Name is required. Mobile and email are optional booking contacts. Notifications are sent only when the clinic enables them and a matching contact exists; adding a contact never creates a sign-in account.";
export function PatientEditor({initial={},onSave,busy=false,submitLabel="Save Patient",withContext=false}:{initial?:any;onSave:(data:any)=>void;busy?:boolean;submitLabel?:string;withContext?:boolean}){
 return <Editor resourceName="patients" fields={resources.patients.fields.filter(field=>withContext||!!initial.clinicId||!["clinicId","branchId"].includes(field.key))} initial={!withContext&&initial.clinicId?{...initial,verifiedBookingContext:true}:initial} onSave={onSave} busy={busy} submitLabel={submitLabel}/>;
}
/** Free-text field with optional suggestions from the clinic's curated masters (e.g. Area). Address parts use AddressFields. */
function MasterTextInput({field,control}:any){
 const [search,setSearch]=useState("");
 const term=useDebouncedValue(search);
 const q=useQuery({queryKey:["lookup","masters-text",field.category,term],queryFn:()=>api.listMasters({category:field.category,status:"active",search:term,pageSize:20} as any,{signal:AbortSignal.timeout(20000)}),retry:false,staleTime:600000});
 const fieldName=title(field.key).toLowerCase();
 return <Controller name={field.key} control={control} rules={{validate:value=>(field.required?required()(value):undefined)||true}} render={({field:input})=><><SuggestionInput id={`input-${field.key}`} value={input.value||""} onChange={input.onChange} onSearchChange={setSearch} options={q.error?[]:(q.data?.items||[]).map(row=>row.name)} placeholder={`Search ${fieldName}…`} clearLabel={`Clear ${fieldName}`} loading={q.isFetching} onRetry={()=>void q.refetch()} emptyMessage={`No matching ${fieldName}. Keep typing to enter it manually.`} error={q.error?`${friendlyError(q.error,"load")} You can still enter ${fieldName} manually.`:undefined}/><small className="muted field-hint"><HelpTip label={`About ${fieldName}`} text="Optional suggestions from your local catalog; manual entry is always allowed."/></small></>}/>;
}
function ExceptionSessionInput({form,label}:{form:ReturnType<typeof useForm>;label:string}){
 const preferences=useDateTimePreferences();
 const actor=useDirectoryActor();
 const doctorId=form.watch("doctorId")||"",branchId=form.watch("branchId")||"",date=form.watch("date")||"";
 const closed=form.watch("isClosed");
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(date);
 const sessions=useQuery({queryKey:["exception-base-sessions",actor,doctorId,branchId,date],enabled:!!doctorId&&!!branchId&&validDate,queryFn:()=>api.listSchedules({doctorId,branchId,dayOfWeek:new Date(`${date}T12:00:00Z`).getUTCDay(),pageSize:100})});
 const rows=(sessions.data?.items||[]).filter(row=>(row as any).status!=="inactive");
 const savedId=form.watch("sessionId")||"";
 const saved=useQuery({queryKey:["exception-selected-session",actor,savedId],enabled:!!savedId&&!rows.some(row=>row.id===savedId),retry:false,queryFn:({signal})=>api.customFetch<api.Schedule>(`/api/schedules/${encodeURIComponent(savedId)}`,{signal})});
 const options=rows.map(session=>({value:session.id,label:`${formatTime(session.startTime,preferences)}–${formatTime(session.endTime,preferences)}`,disabled:false}));
 if(saved.data&&!saved.error&&!options.some(option=>option.value===savedId))options.push({value:savedId,label:`${formatTime(saved.data.startTime,preferences)}–${formatTime(saved.data.endTime,preferences)}`,disabled:true});
 const needsSession=!closed&&(sessions.data?.total||rows.length)>1;
 return <Controller name="sessionId" control={form.control} rules={{validate:value=>!needsSession||!!value||"Choose a session for this date exception."}} render={({field,fieldState})=><div><SearchableSelect labelScope={JSON.stringify([actor,doctorId,branchId,date])} retainSelectionLabel={false} label={needsSession?"Session":label.replace(/\s*\(optional.*$/,"")} required={needsSession} value={field.value||""} onChange={field.onChange} placeholder={needsSession?"Select a session…":closed?"All sessions":"Only weekly session"} error={fieldState.error?.message||(saved.error?"Unable to load selected session.":sessions.error?"Unable to load sessions.":undefined)} loading={sessions.isFetching||saved.isFetching} onRetry={()=>{void sessions.refetch();if(savedId)void saved.refetch();}} options={options}/><small className="muted field-hint">Session scope <HelpTip label="About session scope" text={closed?"A closure can apply to all sessions.":"Timing overrides require a specific session when this date has more than one weekly session."}/></small><ErrorNotice error={sessions.error}/></div>}/>;
}
function RelationInput({field,form,fields,resourceName,label,initial}:any){
  const pin=useWorkspaceBranch();
 const me=api.useGetMe({query:{queryKey:api.getGetMeQueryKey(),staleTime:60000}});
 const values=form.watch();
 const many=field.key.endsWith("Ids");
 const clinicIds=values.clinicIds || (values.clinicId?[values.clinicId]:[]);
 const hasClinic=fields.some((f:Field)=>["clinicId","clinicIds"].includes(f.key));
 const assignment=((resourceName==="doctors"||resourceName==="users")&&["clinics","branches"].includes(field.resource))||(resourceName==="branches"&&field.resource==="clinics"&&me.data?.user?.role==="doctor");
  const operational=["patients","availability","exceptions","qrs"].includes(resourceName);
  const immutablePatient=resourceName==="patients"&&!!initial?.id&&me.data?.user?.role!=="superAdmin"&&["clinicId","branchId"].includes(field.key);
  const contextual=operational&&!initial?.id&&["clinicId","branchId"].includes(field.key)&&(initial?.verifiedBookingContext || initial?.verifiedClinicContext&&field.key==="clinicId" || pin&&initial?.branchId===pin.branchId&&initial?.clinicId===pin.clinicId);
  const selfDoctor=operational&&field.key==="doctorId"&&me.data?.user?.role==="doctor"&&values.doctorId===me.data?.doctorId;
 const params:Record<string,unknown>=field.category?{category:field.category}:{};
  if(operational && !immutablePatient && ["clinics","branches","doctors"].includes(field.resource))params.status="active";
  if(operational && field.resource==="clinics" && values.doctorId)params.doctorId=values.doctorId;
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
   const contextKey=JSON.stringify([clinicIds,field.resource==="branches"||field.resource==="clinics"?values.doctorId:values.branchId]);
   const originalContext=useRef(contextKey);
   const validateSelected=(records:any[],verifiedMissing:string[])=>{
     if(immutablePatient || contextKey===originalContext.current)return;
     if(!["branches","doctors","clinics"].includes(field.resource)||(!hasClinic&&field.resource!=="clinics"))return;
    const current=form.getValues();
    const selected:string[]=many?current[field.key]||[]:current[field.key]?[current[field.key]]:[];
    if(!selected.length)return;
    const clinics:string[]=current.clinicIds|| (current.clinicId?[current.clinicId]:[]);
    const valid=validDependentIds(field.resource,selected,records,clinics,current.branchId).filter(id=>!verifiedMissing.includes(id));
     if(valid.length!==selected.length){
       form.setValue(field.key,many?valid:valid[0]||"",{shouldValidate:true,shouldDirty:true});
       if(field.key==="clinicId"&&fields.some((f:Field)=>f.key==="branchId"))form.setValue("branchId","",{shouldValidate:true,shouldDirty:true});
     }
  };
   const props={id:`input-${field.key}`,error:form.formState.errors[field.key]?.message,resource:assignment?`assignment:${field.resource}`:field.resource,params,label,placeholder:`Search ${label.toLowerCase()}…`,disabled:!immutablePatient&&!contextual&&["branches","doctors"].includes(field.resource)&&hasClinic&&!clinicIds.length,required:field.required,onChange:change,onSelectedRecords:validateSelected,fixed:immutablePatient||!!contextual||selfDoctor,autoSole:operational&&!immutablePatient&&(field.required||resourceName==="patients")};
 return many?<ResourceMultiLookup {...props} value={values[field.key]||[]}/>:<ResourceLookup {...props} value={values[field.key]||""}/>;
}
 /** Groups long editors into consistent titled sections. Order is stable inside a group; no field is removed. */
const EDITOR_GROUPS:[string,string[]][]=[
 ["Details",[]],
 ["Address",["address","country","state","city","pincode","area"]],
 ["Professional",["specializationId","registrationNumber","experienceYears","consultationFee","about","qualificationIds","languages"]],
 ["Assignment and scope",["role","category","parentId","ownerAdminId","adminId","doctorId","clinicId","clinicIds","branchId","branchIds"]],
 ["Day",["dayOfWeek","isOpen","date","sessionId","isClosed","isExtra","reason"]],
 ["Timing",["startTime","endTime","breakStart","breakEnd","breakStartTime","breakEndTime","timezone","bookingHorizonDays","cancellationCutoffMinutes"]],
 ["Capacity",["tokenPrefix","maxTokens","consultationMinutes","bufferMinutes"]],
 ["Queue window",["queueMode","queueOpenTime","queueCloseTime"]],
 ["Verification and links",["requireMobileVerification","otpExpirySeconds","otpMaxAttempts","termsUrl","privacyUrl"]],
 ["Status",["status"]],
];
/** Section B14: Add/Edit Location groups identity, address and contact; each inherit toggle sits beside its own field. */
export const LOCATION_EDITOR_GROUPS:[string,string[]][]=[["Identity",["clinicId","name","slug","timezone"]],["Address",["address","city","state","pincode","country","area"]],["Contact",["email","inheritEmail","phone","inheritPhone"]],["Status",["status"]]];
/** Patient editor: identity first, then address, assignment and the optional emergency contact (reference layout). */
export const PATIENT_EDITOR_GROUPS:[string,string[]][]=[["Patient information",["fullName","gender","dateOfBirth","age","mobile","email"]],["Clinic and status",["clinicId","branchId","status"]],["Address",["address","country","state","city","pincode"]],["Emergency contact",["emergencyContactName","emergencyContactPhone"]]];
const GROUP_HINTS:Record<string,ReactNode>={"Patient information":"Identity and booking contacts.","Clinic and status":<>Where this record is managed. <HelpTip label="About patient status" text="Active patients can be chosen for new bookings. Inactive profiles stay in historical records but are excluded from active patient pickers. This profile status does not change a linked user's login credentials."/></>,"Address":"Used for communication and location.","Emergency contact":"Optional person to call about this patient.","Professional":"Shown to patients when booking.","Assignment and scope":"Which clinics and locations this applies to.","Contact":"Public contact details for this location.","Capacity":"Tokens and pacing for this session.","Timing":"Session hours and an optional break.","Queue window":"When walk-ins and check-ins are accepted."};
type EditorKind="location"|"patient"|undefined;

const groupsFor=(kind:EditorKind)=>kind==="location"?LOCATION_EDITOR_GROUPS:kind==="patient"?PATIENT_EDITOR_GROUPS:EDITOR_GROUPS;
export const isLocationEditor=(fields:{key:string}[])=>fields.some(field=>field.key==="inheritEmail");
export function editorGroup(key:string,location:boolean|EditorKind=false){const kind:EditorKind=location===true?"location":location||undefined;const groups=groupsFor(kind);return (groups.find(([,keys])=>keys.includes(key))||groups[0])[0];}
function sortEditorFields<T extends {key:string}>(fields:T[],grouped:boolean,kind:EditorKind=undefined){if(!grouped)return fields;const groups=groupsFor(kind);const rank=(k:string)=>{const g=groups.findIndex(([g])=>g===editorGroup(k,kind));const keys=groups[g]?.[1]||[];return g*100+(kind&&keys.includes(k)?keys.indexOf(k):50);};return fields.map((f,i)=>({f,i})).sort((a,b)=>rank(a.f.key)-rank(b.f.key)||a.i-b.i).map(x=>x.f);}
export function Editor({fields,initial={},onSave,onCancel,busy=false,submitLabel="Save Changes",resourceName,onDirtyChange,reviewOnly=false,children,refreshInitial=false,savedRevision=0}:{fields:Field[];initial?:any;onSave:(data:any)=>void;onCancel?:()=>void;busy?:boolean;submitLabel?:string;resourceName?:string;onDirtyChange?:(dirty:boolean)=>void;reviewOnly?:boolean;children?:ReactNode;refreshInitial?:boolean;savedRevision?:number}){
  const identity=api.useGetMe({query:{queryKey:api.getGetMeQueryKey()}});
 const confirmation=useConfirm();
 const [activeTab,setActiveTab]=useState(0);
 const [moreDetails,setMoreDetails]=useState(()=>resourceName==="patients"&&PATIENT_SECONDARY.some(key=>!!initial[key]));
 const initialValues=Object.fromEntries(Object.entries(initial).map(([key,value])=>[key,fields.some(field=>field.key===key&&field.type==="date")&&value?value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10):value]));
  // Legacy exception with both flags: the API already treats it as an extra session, so the form shows that.
  const legacyBoth=resourceName==="exceptions"&&!!initialValues.isClosed&&!!initialValues.isExtra;
  if(legacyBoth)initialValues.isClosed=false;
  const form=useForm<Record<string,any>>({defaultValues:{...fields.some(field=>field.key==="timezone")?{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}:{},...initialValues}});
   // Live profile reads refresh untouched fields, never the user's dirty draft.
   // A successful save publishes its response before advancing savedRevision,
   // so submitted fields become clean and can receive subsequent updates.
   const incomingKey=JSON.stringify(initialValues);
   const synchronized=useRef({key:incomingKey,revision:savedRevision});
   const dirtyFields=form.formState.dirtyFields;
   useEffect(()=>{
     if(!refreshInitial||synchronized.current.key===incomingKey&&synchronized.current.revision===savedRevision)return;
     const keepDraft=synchronized.current.revision===savedRevision;
     synchronized.current={key:incomingKey,revision:savedRevision};
     form.reset(initialValues,{keepDirtyValues:keepDraft,keepErrors:keepDraft,keepTouched:keepDraft});
   },[refreshInitial,incomingKey,savedRevision,form.reset,dirtyFields]);
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
     if(field.key==="inheritEmail")field.label=`Use Clinic Email${parentClinic.data?.email?` (${parentClinic.data.email})`:""}`;
     if(field.key==="inheritPhone")field.label=`Use Clinic Phone${parentClinic.data?.phone?` (${parentClinic.data.phone})`:""}`;
     return field;
   }).filter(f => !f.hidden);
  }, [fields, currentRole, initial.slug, parentClinic.data?.email, parentClinic.data?.phone]);
  const locationEditor=isLocationEditor(fields);
  const editorKind:EditorKind=locationEditor?"location":resourceName==="patients"?"patient":undefined;
 const tabs=resourceName?EDITOR_TABS[resourceName]:undefined;
 const tabbed=!!tabs&&activeFields.length>5;
 const tabFilled=(tabs||[]).map((_,i)=>activeFields.some(field=>field.type!=="addressPart"&&editorTabIndex(resourceName,editorGroup(field.key,editorKind))===i)||(i===(tabs||[]).length-1&&!!children));
 const tabInvalid=(tabs||[]).map((_,i)=>Object.keys(form.formState.errors).some(key=>editorTabIndex(resourceName,editorGroup(key,editorKind))===i));

   return <Form {...form}><div className="editor-container"><form className="form-grid field-grid" noValidate data-location-editor={locationEditor||undefined} data-testid={locationEditor?"location-editor":undefined} onSubmit={submitWithNativeChecks(form,values=>{if(resourceName==="patients"){const secondary=secondaryFieldErrors(values);const keys=Object.keys(secondary);if(keys.length){keys.forEach(key=>form.setError(key,{type:"validate",message:secondary[key]}));setMoreDetails(true);setTimeout(()=>document.getElementById(`input-${keys[0]}`)?.focus()||document.querySelector<HTMLElement>(`[name="${CSS.escape(keys[0])}"]`)?.focus(),0);return;}}if(!beginEditorSubmission(submitting,busy,reviewOnly))return;const body:any={}; activeFields.forEach(field=>{
    if(field.disabled)return;
    // Demographic edits never submit a registration move, including an empty
    // optional location. The server retains the persisted assignment exactly.
    if(resourceName==="patients"&&initial.id&&identity.data?.user?.role!=="superAdmin"&&["clinicId","branchId"].includes(field.key))return;
    let value=values[field.key];
    if(typeof value==="string")value=value.trim();
    if(field.type==="tel"&&value)value=normalizePhone(value);
    if(field.key==="age")value=ageFromDateOfBirth(values.dateOfBirth)??initial.age;
    const isClinicOrBranchMapping = field.key === "clinicIds" || field.key === "branchIds";
     if(isClinicOrBranchMapping&&initial.id&&JSON.stringify([...(value||[])].sort())===JSON.stringify([...(initial[field.key]||[])].sort()))return;
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
  });onSave(body);},errors=>{if(Object.keys(errors).some(key=>PATIENT_SECONDARY.includes(key)))setMoreDetails(true);{const first=Object.keys(errors)[0];if(first&&tabbed)setActiveTab(editorTabIndex(resourceName,editorGroup(first,editorKind)));}requestAnimationFrame(()=>{const key=Object.keys(errors)[0];const element=document.getElementById(`input-${key}`)||document.querySelector<HTMLElement>(`[name="${CSS.escape(key)}"]`)||document.querySelector<HTMLElement>('[aria-invalid="true"]');revealAndFocus(element);});})}>
   {resourceName==="patients"&&<p className="muted wide form-intro" data-testid="text-patient-contact-rules">{PATIENT_CONTACT_RULE}</p>}{confirmation.dialog}
        {resourceName==="branches"&&<p className="muted wide form-context">About clinics <HelpTip label="About clinics" text="A clinic is a physical care location within a Clinic Group, with its own address, timezone, opening hours and booking link. Clinics do not have a separate login. Named staff use their own accounts, assignments and invitations. Contact inheritance controls its public contact details; it does not change staff sign-in addresses or configure notification delivery."/></p>}
    {legacyBoth&&<p className="notice wide" role="status" data-testid="text-exception-legacy-both">This record was saved as both Day Off and Extra Interval. It works as an Extra Interval, so Day Off is shown cleared; saving keeps that behaviour.</p>}
     {resourceName==="exceptions"&&<ExceptionImpactPreview doctorId={doctorId} branchId={branchId} date={form.watch("date")} isClosed={!!form.watch("isClosed")} isExtra={!!form.watch("isExtra")} startTime={startTime} endTime={endTime} sessionId={form.watch("sessionId")}/>}
    {resourceName==="availability"&&<div className="wide"><TimeRangeSlider clinicHours={matchingTimezone?clinicHours:[]} startTime={startTime||""} endTime={endTime||""} onChange={value=>{form.setValue("startTime",value.startTime,{shouldDirty:true,shouldValidate:true});form.setValue("endTime",value.endTime,{shouldDirty:true,shouldValidate:true});}}/><small className="muted field-hint">Session time <HelpTip label="About session time" text="Slide in 15-minute steps or type exact minutes below. Shaded bands show clinic opening hours in the same timezone. Clinic-hour limits and cross-clinic conflicts are checked by the server."/></small>{sessionClinic.data&&<p>Clinic hours: {clinicHours.length?clinicHours.map(hour=>`${formatTime(hour.startTime,preferences)}–${formatTime(hour.endTime,preferences)}`).join(", "):"Closed"} · {sessionClinic.data.timezone}{!matchingTimezone&&" (different session timezone; shading is hidden)"}</p>}{matchingTimezone&&clinicHours.length>0&&startTime&&endTime&&!clinicHours.some(hour=>hour.startTime<=startTime&&hour.endTime>=endTime)&&<p className="notice">This session extends outside a clinic opening interval. Review the times; existing server rules decide whether it can be saved.</p>}{startTime&&endTime&&startTime>=endTime&&<p role="alert" className="field-error">Closing time must follow opening time.</p>}{overlaps&&<p role="alert" className="field-error">This session overlaps another session for this doctor and clinic.</p>}<ErrorNotice error={peers.error||sessionClinic.error}/>{(peers.error||sessionClinic.error)&&<button type="button" onClick={()=>{void peers.refetch();void sessionClinic.refetch();}}>Retry Hours and Overlap Check</button>}</div>}
   {tabbed&&tabs&&<FormTabs tabs={tabs.map(([label])=>label)} active={activeTab} onChange={setActiveTab} invalid={tabInvalid} hiddenTabs={tabFilled.map(filled=>!filled)}/>}
   {(()=>{const v=form.watch();const place=[v.address,v.city,v.state,v.pincode].filter(Boolean).join(", ");const contact=[v.emergencyContactName,v.emergencyContactPhone].filter(Boolean).join(" · ");const secondarySummary=[place&&`Address: ${place}`,contact&&`Emergency: ${contact}`].filter(Boolean).join("  |  ");const grouped=activeFields.length>5;const order:string[]=[];const cells=new Map<string,{nodes:ReactNode[];open:boolean}>();sortEditorFields(activeFields,grouped,editorKind).forEach(field=>{
    const collapsed=resourceName==="patients"&&!tabbed&&!moreDetails&&PATIENT_SECONDARY.includes(field.key)&&!form.formState.errors[field.key];const node=(()=>{
    const label=field.label||title(field.key.replace(/Ids?$/,""));
    const error=form.formState.errors[field.key] ? String(form.formState.errors[field.key]?.message||"This field is required") : undefined;
    const rules={validate:(value:unknown)=> (field.required?required()(value):undefined)||(field.key==="fullName"||field.key==="emergencyContactName"?validatePersonName(value):undefined)||(field.type==="tel"?validatePhone(value):undefined)||(field.type==="email"?validateEmail(value):undefined)||(field.key==="dateOfBirth"?validateDateOfBirth(value):undefined)||(field.type==="number"?validateNumberRange(value,{min:0,integer:!["consultationFee","experienceYears"].includes(field.key)}):undefined)||true};
    if(field.key==="age"){const age=ageFromDateOfBirth(form.watch("dateOfBirth"))??initial.age;return <div key={field.key} className="derived-field" data-testid="text-derived-age"><span className="form-field-label"><span id="label-derived-age">Age</span><HelpTip label="About age" text="Calculated from date of birth. An existing age-only record is retained until a date of birth is provided."/></span><output aria-labelledby="label-derived-age" aria-live="polite">{age!==undefined&&age!==null&&age!==""?`${age} yrs`:"From date of birth"}</output></div>;}
    if(field.key==="timezone")return <Controller key={field.key} name={field.key} control={form.control} rules={rules} render={({field:input})=><TimezoneSelect value={input.value||""} onChange={input.onChange} error={error}/>}/>;
    if(field.type==="number"){
      const min=["maxTokens","bookingHorizonDays","otpExpirySeconds","otpMaxAttempts"].includes(field.key)?1:0;
      const boundedSessionField=["maxTokens","bufferMinutes"].includes(field.key);
      const max=field.key==="maxTokens"?1000:field.key==="bufferMinutes"?1440:field.key==="bookingHorizonDays"?365:field.key==="cancellationCutoffMinutes"?10080:undefined;
      const helper=field.key==="maxTokens"?"Maximum patients in this session: 1–1,000. Enter a whole number.":field.key==="bufferMinutes"?"Extra minutes between consultations: 0–1,440 (one day maximum). Enter a whole number.":field.key==="cancellationCutoffMinutes"?"Minutes before session start after which cancellation is blocked.":undefined;
      return <FormField key={field.key} label={label} required={field.required} optional={!field.required} error={error} info={helper}><input type={boundedSessionField?"text":"number"} inputMode={boundedSessionField?"numeric":undefined} maxLength={boundedSessionField?4:undefined} pattern={boundedSessionField?"[0-9]*":undefined} min={min} max={max} step={["consultationFee","experienceYears"].includes(field.key)?"any":1} {...form.register(field.key,{validate:value=>(field.required?required()(value):undefined)||validateNumberRange(value,{min,max,integer:!["consultationFee","experienceYears"].includes(field.key)})||true})}/></FormField>;
    }
    if(field.type==="tel")return <Controller key={field.key} name={field.key} control={form.control} rules={rules} render={({field:input})=><FormField label={label} required={field.required} optional={!field.required} error={error}><PhoneInput {...input} value={input.value||""}/></FormField>}/>;
    if(field.type==="date"||field.type==="time")return <Controller key={field.key} name={field.key} control={form.control} rules={{...rules,validate:value=>rules.validate(value)!==true?rules.validate(value):field.key==="endTime"&&startTime&&value&&startTime>=value?"Closing time must follow opening time.":true}} render={({field:input})=><FormField id={`input-${field.key}`} label={label} required={field.required} optional={!field.required} error={error} helper={field.key==="dateOfBirth"&&!fields.some(item=>item.key==="age")?<output aria-label="Age (read only)">Age (read only): {ageFromDateOfBirth(input.value)??"—"}</output>:undefined}>{a11y=>field.type==="date"?<DateFormatInput {...a11y} name={field.key} preferences={preferences} value={input.value instanceof Date?input.value.toISOString().slice(0,10):input.value||""} onChange={input.onChange}/>:<TimeFormatInput {...a11y} name={field.key} preferences={preferences} value={input.value||""} onChange={input.onChange}/>}</FormField>}/>;
    if(field.type==="session")return <ExceptionSessionInput key={field.key} form={form} label={label}/>;
    if(field.resource)return <div className={field.type==="textarea"||field.wide?"wide":""} key={field.key}><RelationInput field={field} form={form} fields={fields} resourceName={resourceName} label={label} initial={initial}/>{error&&<small className="field-error">{error}</small>}</div>;
    if(field.type==="addressPart")return null;
    if(field.type==="address")return <EditorAddress key={field.key} form={form} required={field.required}/>;
    if(field.type==="masterText")return <label key={field.key} className="address-compact">{label}{field.required&&<span className="required"> *</span>}<MasterTextInput field={field} control={form.control} setValue={form.setValue}/>{error&&<small className="field-error">{error}</small>}</label>;
    if(field.type==="duration"){
     const legacy=initial[field.key];
     const choices=[20,30,60];
     const opts=[...choices.map(v=>({value:String(v),label:`${v} minutes`})),...(legacy!=null&&legacy!==""&&!choices.includes(Number(legacy))?[{value:String(legacy),label:`${legacy} minutes (current, legacy value)`}]:[])];
     return <Controller key={field.key} name={field.key} control={form.control} rules={{required:field.required}} render={({field:input})=><div><SearchableSelect id={`input-${field.key}`} label={label} required={field.required} value={input.value==null?"":String(input.value)} onChange={input.onChange} placeholder="Select duration…" error={error} options={opts}/>{legacy!=null&&!choices.includes(Number(legacy))&&<small className="muted field-hint">Legacy value <HelpTip label="About legacy duration" text={`This schedule keeps its existing ${legacy}-minute value until you choose 20, 30 or 60 minutes.`}/></small>}</div>}/>;
    }
    if(field.key==="status"&&resourceName==="users")return <Controller key={field.key} name="status" control={form.control} render={({field:input})=><div className="wide"><StatusSwitch label="User Account Active" testId="switch-user-status-editor" active={input.value!=="inactive"} onChange={async active=>{if(!active&&!await confirmation.ask({title:"Deactivate User?",description:"They may lose access. Protected clinic owners cannot be deactivated until ownership is transferred.",confirmLabel:"Deactivate",tone:"danger"}))return;input.onChange(active?"active":"inactive");}}/><small className="muted field-hint">Ownership rules may apply <HelpTip label="About account protection" text="Some administrator accounts are protected by clinic ownership rules. Saving will explain any restriction."/></small></div>}/>;
    if(field.type==="checkbox"){
     // Day Off and Extra Interval are mutually exclusive: the API turns an isExtra record into an extra
     // session and ignores isClosed, so the form never submits both.
     const exclusive=resourceName==="exceptions"&&(field.key==="isClosed"||field.key==="isExtra")?(field.key==="isClosed"?"isExtra":"isClosed"):"";
     return <label key={field.key} className="check-label check-row"><input type="checkbox" data-testid={`input-${field.key}`} disabled={field.disabled} {...form.register(field.key,{onChange:event=>{if(exclusive&&event.target.checked&&form.getValues(exclusive))form.setValue(exclusive,false,{shouldDirty:true});}})}/><span>{label}</span>{exclusive&&<HelpTip label={`About ${label}`} text="Day Off and Extra Interval cannot both apply. Choosing one clears the other."/>}</label>;
    }
    if(field.type==="select")return <Controller key={field.key} name={field.key} control={form.control} rules={{required:field.required}} render={({field:input})=><SearchableSelect id={`input-${field.key}`} label={label} required={field.required} value={selectInputValue(input.value)} onChange={input.onChange} placeholder={`Select ${label.toLowerCase()}…`} error={error} options={(field.options||[]).map(v=>({value:v,label:field.key==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(v)]:title(v)}))}/>}/>;
    return <FormField key={field.key} id={`input-${field.key}`} className={field.type==="textarea"||field.wide?"wide":""} label={label} required={field.required} optional={!field.required} error={error} helper={field.key==="slug"?<>Permanent once saved <HelpTip label="About web address" text={initial.slug?"Web address is permanent. Display names can still change.":"Choose a permanent web address: lowercase letters, digits and hyphens."}/></>:undefined}>{field.type==="textarea"?<textarea aria-invalid={!!error} aria-describedby={error?`error-${field.key}`:undefined} data-testid={`input-${field.key}`} {...form.register(field.key,rules)}/>:field.type==="email"?<EmailInput disabled={field.disabled} aria-invalid={!!error} aria-describedby={error?`error-${field.key}`:undefined} data-testid={`input-${field.key}`} {...form.register(field.key,rules)}/>:<input disabled={field.disabled} aria-invalid={!!error} aria-describedby={error?`error-${field.key}`:undefined} max={field.key==="dateOfBirth"?today():undefined} data-testid={`input-${field.key}`} type={field.type==="array"?"text":field.type} {...form.register(field.key,rules)}/>}</FormField>;
   })();const group=grouped?editorGroup(field.key,editorKind):"";if(!cells.has(group)){cells.set(group,{nodes:[],open:false});order.push(group);}const cell=cells.get(group)!;if(!collapsed)cell.open=true;cell.nodes.push(<Fragment key={field.key}>{collapsed?<div hidden className="wide" data-testid={`collapsed-${field.key}`}>{node}</div>:<div className={fieldWidthClass(field)} data-field-width={field.key}>{node}</div>}</Fragment>);});
    if(!grouped)return order.map(group=><Fragment key={group||"fields"}>{cells.get(group)!.nodes}</Fragment>);
    // Grouped editors render each group as a titled section with its own field grid. Collapsed optional
    // groups stay mounted (hidden) so saved values are preserved and submitted unchanged.
    let index=0;const secondaryAt=editorKind==="patient"?order.findIndex(group=>cells.get(group)!.nodes.length&&PATIENT_EDITOR_GROUPS.find(([name])=>name===group)?.[1].some(key=>PATIENT_SECONDARY.includes(key))):-1;
    return order.map((group,position)=>{const cell=cells.get(group)!;const id=`editor-group-${group.toLowerCase().replace(/[^a-z]+/g,"-")}`;const shown=cell.open;if(shown)index+=1;
     const toggle=!tabbed&&position===secondaryAt?<div className="editor-disclosure wide"><button type="button" className="text-link" aria-expanded={moreDetails} data-testid="button-patient-more-details" onClick={()=>setMoreDetails(value=>!value)}>{moreDetails?"Hide":"Show"} address and emergency contact (optional)</button>{!moreDetails&&<span className="editor-disclosure-summary" data-testid="text-patient-saved-details">{secondarySummary||"Nothing added yet"}</span>}</div>:null;
     return <Fragment key={group}>{toggle}<section className="editor-group wide" hidden={!shown||(tabbed&&editorTabIndex(resourceName,group)!==activeTab)} data-editor-tab={tabbed?editorTabIndex(resourceName,group):undefined} aria-labelledby={id}><header className="editor-group-head"><h3 id={id} className="editor-section wide" data-testid={`editor-section-${group.toLowerCase().replace(/[^a-z]+/g,"-")}`}>{editorKind==="patient"&&<span className="editor-group-index" aria-hidden="true">{index}</span>}{group}</h3>{GROUP_HINTS[group]&&<p className="editor-group-hint">{GROUP_HINTS[group]}</p>}</header><div className="form-grid field-grid editor-group-grid" data-location-editor={locationEditor||undefined}>{cell.nodes}</div></section></Fragment>;});})()}
  {/* Extra sections (e.g. location opening hours) follow the record's own fields; in tabbed forms they live on the last tab. */}
  {tabbed&&tabs?<div className="wide" hidden={activeTab!==tabs.length-1}>{children}</div>:children}
  <FormActions onCancel={onCancel} cancelClosesDialog busy={busy} disabled={overlaps} submitLabel={submitLabel}/></form></div></Form>;
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
function LocationActions({row,resource,portal,extra=[],viewHref}:{row:any;resource:string;portal:string;extra?:RowMenuItem[];viewHref?:string}){
 const [action,setAction]=useState<"book"|"display"|null>(null);
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
 // Section G: never navigate away or open windows automatically; the user explicitly opens the public page in a new tab.
  const qrHref=`/${portal}/qrs?clinicId=${encodeURIComponent(clinicId)}${resource==="branches"?`&branchId=${encodeURIComponent(row.id)}`:""}`;
  return <>{viewHref&&<IconAction label={`View ${row.name}`} hint="View clinic details" icon={<Eye size={15} aria-hidden/>} href={viewHref} testId={`button-view-clinic-${row.id}`}/>}<RowMenu label={`Booking and display actions for ${row.name}`} testId={`menu-location-${row.id}`} items={[
    {key:"book",label:"Open Public Booking…",onSelect:()=>{setBranchId("");setAction("book");}},
    {key:"display",label:"Queue Display",onSelect:()=>{setBranchId("");setAction("display");}},
    {key:"qrs",label:"Manage QR Codes",href:qrHref},
    ...(portal==="admin"?[{key:"configure",label:"Configure clinic & opening hours",href:viewHref||`/admin/settings?clinicId=${encodeURIComponent(clinicId)}`,testId:`link-configure-clinic-${row.id}`}]:[]),
    {key:"sessions",label:"Doctor Sessions",href:`/${portal}/availability?clinicId=${encodeURIComponent(clinicId)}${resource==="branches"?`&branchId=${encodeURIComponent(row.id)}`:""}`,testId:`link-sessions-${row.id}`},
    ...extra]}/>
 <AppDialog open={!!action} onClose={()=>setAction(null)} title={action==="display"?"Open Queue Display":"Open Clinic Booking"}>
 <ErrorNotice error={error}/>{loading?<p role="status">Loading clinic address…</p>:!clinicSlug?<p className="notice">This clinic has no web address. <Link href={`/admin/settings?clinicId=${encodeURIComponent(clinicId)}`}>Set Web Address in Clinic Settings</Link>.</p>:<>
 {resource==="clinics"&&(branches.data?.total??0)>1&&<ResourceLookup resource="branches" label="Select Clinic" params={{clinicId,status:"active"}} value={branchId} onChange={setBranchId}/>}
 {branch&&!branch.slug&&<p className="notice">This clinic has no web address. <Link href={`/admin/settings?clinicId=${encodeURIComponent(clinicId)}`}>Set Web Address in Clinic Settings</Link>.</p>}
 {resource==="clinics"&&branches.data?.total===0&&<p>No active clinics. Add a clinic in settings.</p>}
 {url&&!error&&<a className="button" href={url} target="_blank" rel="noopener noreferrer" data-testid="link-open-public-new-tab">Open {action==="display"?"queue display":"public booking page"} in new tab</a>}
 <div className="form-actions"><button type="button" className="button secondary" onClick={()=>setAction(null)} data-testid="button-public-open-close">Close</button></div>
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
const COLUMN_LABELS:Record<string,string>={adminName:"Owning administrator",locality:"Locality",contact:"Phone / email",session:"Session hours",break:"Break",capacity:"Capacity",isOpen:"Open",isClosed:"Closed all day",maxTokens:"Max tokens",dayOfWeek:"Day"};
const columnLabel=(c:string)=>COLUMN_LABELS[c]||title(c);
/** One short, human context line for the record cell; never codes/references and never a value already shown in another column. */
function genericRecordSecondary(resource:string,row:any,columns:string[]):string{
 const keys:Record<string,string[]>={clinics:["city"],branches:["clinicName"],doctors:["specializationName"],patients:["mobile","email"],users:["email"],masters:[],qrs:["clinicName","branchName","doctorName"]};
 const key=(keys[resource]||[]).find(k=>row[k]&&!columns.includes(k));
 return key?String(row[key]):"";
}
function renderComputed(c:string,row:any){
 if(c==="locality")return <span className="clinic-list-value">{[row.area,row.city,row.state].filter(Boolean).join(" · ")||"Not set"}</span>;
 if(c==="contact")return <div className="clinic-list-value"><span>{row.phone||"Phone not set"}</span><small>{row.email||"Email not set"}</small></div>;
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
 const superadminClinics=resource==="clinics"&&identity?.user?.role==="superAdmin";
 const recordSecondary=(resource:string,row:any,columns:string[])=>superadminClinics?(row.code?`Code: ${row.code}`:"Code not set"):genericRecordSecondary(resource,row,columns);
 const confirmation=useConfirm();
 const settings=api.useGetSettings({query:{queryKey:api.getGetSettingsQueryKey(),staleTime:60000}});
  const baseConfig=resources[resource];const config={...baseConfig,...(resource==="patients"&&identity?.user?.role==="doctor"?{create:undefined,update:undefined,remove:undefined}:{}),name:resource==="branches"?"clinics":resource==="clinics"?"clinic groups":baseConfig.name}; const [,navigate]=useLocation(); const urlSearch=useSearch();
  const urlParams=new URLSearchParams(urlSearch);
  const search=urlParams.get("search")||"";
  const pageValue=Number(urlParams.get("page"));
  const page=Number.isSafeInteger(pageValue)&&pageValue>0?pageValue:1;
  const sizeValue=Number(urlParams.get("pageSize"));
  const pageSize=(PAGE_SIZE_OPTIONS as readonly number[]).includes(sizeValue)?sizeValue:DEFAULT_PAGE_SIZE;
  const sort=urlParams.get("sort")||"-createdAt";
  const [editing,setEditing]=useState<any>(null);
 const [qrPreview,setQrPreview]=useState<any>(null);
 const [auditDetail,setAuditDetail]=useState<any>(null);
 const [patientDetail,setPatientDetail]=useState<any>(null);
 const [registeredPatient,setRegisteredPatient]=useState<any>(null);
 // Exact-record deep link (?open=<id>) from workspace search: highlight that row and open its read-only details where they exist.
 const openId=urlParams.get("open")||"";
 const openedRef=useRef("");
 // Patient Details is read-only: shown to every role that can list patients. Edit/Deactivate stay gated by config.update.
 const hasActions=!!config.update||resource==="patients";
 const [dirty,setDirty]=useState(false);
 useRegisterUnsaved(dirty);
 // Workspace location: patients, weekly sessions and exceptions follow the top-bar location. Clinic settings (fixedClinicId) stay unrestricted.
 const workspacePin=useWorkspaceBranch();
 const branchPin=workspacePin&&!fixedClinicId&&["patients","availability","exceptions"].includes(resource)?workspacePin:null;
 const pinDefaults:Record<string,string>=branchPin?{branchId:branchPin.branchId,clinicId:branchPin.clinicId}:{};
 // Apply verified workspace context to NEW editor input, not just list filters.
 // Existing row values still take precedence when opening an edit.
 defaults={...defaults,...pinDefaults,...fixedClinicId?{clinicId:fixedClinicId,verifiedClinicContext:true}:{}};
 const [success,setSuccess]=useState("");
 const term=useDebouncedValue(search);
 const supportsSearch=true;
  const roleDefaults=useMemo<Record<string,string>>(()=>({...identity?.doctorId&&["doctor","clinicAdmin"].includes(identity.user?.role||"")&&["availability","exceptions"].includes(resource)?{doctorId:identity.doctorId as string}:{},...fixedClinicId?{clinicId:fixedClinicId}:{},...pinDefaults}),[identity,branchPin,resource,fixedClinicId]);
  const filters:Record<string,string>={...roleDefaults,...Object.fromEntries(LIST_FILTER_KEYS.flatMap(key=>urlParams.get(key)?[[key,urlParams.get(key)!]]:[])),...fixedClinicId?{clinicId:fixedClinicId}:{},...pinDefaults};
  // Registration opened from a location-filtered list starts in that exact
  // context. Lookups still validate it; never infer a location from page order.
  if(resource==="patients")defaults={...defaults,...Object.fromEntries(["clinicId","branchId"].filter(key=>filters[key]).map(key=>[key,filters[key]]))};
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
 // Every record filter (status, scope, date, category) and the sort are drafted in the drawer and committed together.
 const applyDraft=()=>{if(rangeError(draft.from||"",draft.to||""))return false;changeUrl({...Object.fromEntries(LIST_FILTER_KEYS.map(key=>[key,draft[key]||roleDefaults[key]||""])),sort:draft.sort||"-createdAt",page:1});return true;};
 const active=!!(search||sort!=="-createdAt"||Object.entries(filters).some(([k,v])=>v&&v!==roleDefaults[k]));
  const reset=()=>{setDraft({});changeUrl(Object.fromEntries(LIST_URL_KEYS.map(key=>[key,""])));};
 const listParams={...Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=="")),search:term||undefined,page,pageSize,sort};
 const [recoveryId,setRecoveryId]=useState("");
 const recovery=api.useRequestUserPasswordReset();
 const client=useQueryClient();
  const query=useQuery<any>({queryKey:[resource,identity?.user?.id,identity?.user?.role,listParams],queryFn:()=>config.list(listParams),placeholderData:(previous:any)=>previous,refetchInterval:30000,refetchOnWindowFocus:true});
 useEffect(()=>{const row=openId&&query.data?.items?.find((r:any)=>r.id===openId);if(!row||openedRef.current===openId)return;openedRef.current=openId;requestAnimationFrame(()=>document.querySelector(`[data-testid="row-${resource}-${openId}"]`)?.scrollIntoView({block:"center"}));},[openId,query.data,resource]);
 // Exact record links (?open=<id>) load the target through its own permission-checked endpoint, so the record opens
 // even when it is not on the current page. Schedules have no single-record endpoint: the link carries the doctor and
 // location scope and the session is matched by id inside that permitted list. Failures are shown, never hidden.
 const linkedSearch=urlParams.get("search")||"";
 const exactLoader=useMemo<((signal:AbortSignal)=>Promise<any>)|null>(()=>{if(!openId)return null;switch(resource){
  case "patients":return()=>api.getPatient(openId);
  case "clinics":return()=>api.getClinic(openId);
  case "branches":return()=>api.getBranch(openId);
  case "doctors":return()=>api.getDoctor(openId);
  case "users":return()=>api.getUser(openId);
  case "availability":return signal=>scanScopedPages(openId,(page,sig)=>api.listSchedules({doctorId:filters.doctorId||undefined,branchId:filters.branchId||undefined,page,pageSize:100},{signal:sig}),signal,"This schedule session is not in your permitted schedules.");
  case "audit":return signal=>scanScopedPages(openId,(page,sig)=>api.listAuditLogs({search:linkedSearch||undefined,page,pageSize:100},{signal:sig}),signal,"This audit event is not in your permitted audit log for this search.");
  default:return null;}},[resource,openId,filters.doctorId,filters.branchId,linkedSearch]);
 const exact=useExactRecord<any>([resource],openId,exactLoader);
 const closeExact=()=>changeUrl({open:""},true);
 const cellValue=(c:string,row:any):ReactNode=>c==="createdAt"?<CreatedCell value={row[c]} timezone={row.timezone||settings.data?.timezone} preferences={row}/>:renderComputed(c,row)??(c==="status"?title(row[c]||""):c==="dayOfWeek"?DAYS[row[c]]:typeof row[c]==="boolean"?(row[c]?"Yes":"No"):Array.isArray(row[c])?<OverflowText value={row[c].join(", ")}/>:typeof row[c]==="string"?<OverflowText value={row[c]}/>:row[c]??"—");
 /** Meaningful record details: every configured field (relations shown by name, secrets omitted) plus computed columns. */
 const recordFacts=(row:any,exclude:string[]=[]):RecordFact[]=>{const seen=new Set<string>(exclude);const out:RecordFact[]=[];
  const push=(key:string,label:string)=>{if(seen.has(key))return;seen.add(key);const v=row[key];const computed=renderComputed(key,row)!==undefined;if(!computed&&(v===undefined||v===null||v===""||(typeof v==="object"&&!Array.isArray(v))))return;out.push([label,cellValue(key,row)]);};
  for(const c of hiddenColumns)push(c,columnLabel(c));
  for(const field of (config.fields||[]) as Field[]){if(field.hidden||field.type==="password")continue;if(field.resource){const nameKey=field.key.replace(/Ids?$/,"Name");push(nameKey,field.label?field.label.replace(/ ID$/,""):columnLabel(nameKey));continue;}push(field.key,field.label||columnLabel(field.key));}
  for(const c of config.columns)push(c,columnLabel(c));
  return out;};
 const selectionContext=JSON.stringify([resource,listParams,search,identity?.user]);
  const selection=useListingSelection(selectionContext,query.error||query.isPlaceholderData?[]:query.data?.items||[]);
 const density="compact";
 const compact=["clinics","branches","doctors","patients","users","masters","qrs"].includes(resource);
 const baseColumns=superadminClinics?["name","adminName","locality","contact","status"]:compact?[config.columns[0],...config.columns.slice(1).filter(c=>!["code","reference","city","email","phone","clinicName","specializationName"].includes(c))]:config.columns;
 // A status tab already states the status of every row; drop the repeated column (users keep their access switch).
 const displayColumnsRaw=!superadminClinics&&filters.status&&resource!=="users"&&config.fields.some(field=>field.key==="status")?baseColumns.filter(c=>c!=="status"):baseColumns;
 // Selected doctor/location is shown once in the filter context; do not repeat it on every schedule row.
 const displayColumnsBase=resource==="availability"?displayColumnsRaw.filter(c=>!(c==="doctorName"&&filters.doctorId)&&!(c==="branchName"&&filters.branchId)):displayColumnsRaw;
 const VIEW_KEYS=useMemo(()=>[...LIST_FILTER_KEYS,"sort","pageSize"],[]);
 const listingLayout=useListingLayout(resource,identity?.user?.id,identity?.user?.role,VIEW_KEYS);
 const arranged=arrangeColumns(displayColumnsBase,listingLayout.layout);
 const displayColumns=arranged.visible;
 const hiddenColumns=arranged.hidden;
 const [expanded,setExpanded]=useState<string|null>(null);
 const currentViewFilters:Record<string,string>={...filters,...(sort!=="-createdAt"?{sort}:{}),...(pageSize!==20?{pageSize:String(pageSize)}:{})};
 // The requested Clinic toolbar explicitly omits the Views trigger. Keep the
 // shared saved-view implementation, stored preferences and backend APIs intact.
 const compactClinicToolbar=["clinics","patients","availability","exceptions"].includes(resource);
 const viewControls=<><ColumnSettings iconOnly={compactClinicToolbar} columns={displayColumnsBase} layout={listingLayout.layout} label={columnLabel} onChange={listingLayout.setLayout} onReset={listingLayout.resetColumns}/>{!compactClinicToolbar&&<SavedViews canShare={listingLayout.canShare} legacyViews={listingLayout.legacyViews} onImport={listingLayout.importLegacyView} views={listingLayout.layout.views} canSave={Object.values(currentViewFilters).some(Boolean)||listingLayout.layout.order.length>0||listingLayout.layout.hidden.length>0||!!listingLayout.layout.pinned} onSave={view=>listingLayout.saveView(view,currentViewFilters)} onDelete={listingLayout.deleteView} onApply={view=>{listingLayout.applyViewColumns(view,displayColumnsBase);changeUrl({...Object.fromEntries(VIEW_KEYS.map(key=>[key,""])),...view.filters,page:1});}}/>}</>;
 const portal=identity?.user?.role==="doctor"?"doctor":identity?.user?.role==="receptionist"?"receptionist":"admin";
 const clinicRecordHref=(id:string)=>superadminClinics?clinicDetailsHref(id,urlSearch):`/admin/settings?clinicId=${encodeURIComponent(id)}&section=general`;
  useEffect(()=>{if(query.data&&!query.isPlaceholderData&&page>1&&page>Math.max(1,Math.ceil(query.data.total/pageSize)))setPage(Math.max(1,Math.ceil(query.data.total/pageSize)));},[query.data,query.isPlaceholderData,page,pageSize]);
 const save=useMutation({mutationFn:(data:any)=>editing?.id?config.update(editing.id,data):config.create(data),onSuccess:(saved:any)=>{
  if(resource==="patients"&&!editing?.id){setRegisteredPatient(saved);setPage(1);}
  setEditing(null);notifySuccess("Updated successfully");client.invalidateQueries();
 }});
 const remove=useMutation({mutationFn:(id:string)=>config.remove(id),onSuccess:()=>{notifySuccess("Record deactivated. Historical records are preserved.");client.invalidateQueries();}});
 const statusUpdate=useMutation({mutationFn:({row,status}:{row:api.User;status:"active"|"inactive"})=>api.updateUser(row.id,{fullName:row.fullName,email:row.email,role:row.role,status,...row.clinicIds?{clinicIds:row.clinicIds}:{},...row.branchIds?{branchIds:row.branchIds}:{}}),onSuccess:()=>{setSuccess("User status updated.");client.invalidateQueries();}});
 const changeUserStatus=async(row:any)=>{
   if(statusUpdate.isPending)return;
   const next=row.status==="active"?"inactive":"active";
   if(next==="inactive"&&!await confirmation.ask({title:`Deactivate ${row.fullName}?`,description:"They may lose access. Protected clinic owners require an ownership transfer first.",confirmLabel:"Deactivate",tone:"danger"}))return;
   setSuccess("");
   statusUpdate.mutate({row,status:next});
 };

 const owningClinicId = editing?.id && (resource === "clinics" || resource === "branches") ? String(resource === "clinics" ? editing.id : editing.clinicId || "") : "";
 const owningClinic = api.useGetClinic(owningClinicId, { query: { queryKey: api.getGetClinicQueryKey(owningClinicId), enabled: !!owningClinicId } });
 // Until ownership is known, protected fields stay read-only (never editable-then-403).
 const isClinicOwner = canChangeClinicDefaults(identity?.user ?? undefined, owningClinic.data);
 const effectiveFields = useMemo(() => {
   if (!identity?.user) return config.fields;
   const meRole = identity.user.role;
   return config.fields.map(f => {
     const field = { ...f };
     if (field.key === "adminId" && meRole !== "superAdmin") field.hidden = true;
     if (field.key === "ownerAdminId" && meRole !== "superAdmin") field.hidden = true;
     if (ownerOnlyLocked(resource, field.key, !!editing?.id, isClinicOwner)) { field.disabled = true; }

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
 }, [config.fields, identity, resource, editing, isClinicOwner]);

  const listName=resource==="branches"?"locations":config.name;
  /** Section B11: the Locations list shows its total once, in the list heading; pagination keeps range and page controls only. */
  const headingCount=resource==="branches";
  const searchPlaceholder=resource==="doctors"?"Search doctors by name, email or specialization…":resource==="patients"?"Search patients by name, email or mobile…":resource==="audit"?"Search audit events…":`Search ${listName}…`;
   const singularName=resource==="branches"?"location":resource==="availability"?"schedule":resource==="qrs"?"QR code":resource==="masters"?"master value":resource.replace(/s$/,"");
  const sortOptions=[{value:"-createdAt",label:"Newest First"},{value:"createdAt",label:"Oldest First"},...(["clinics","branches","masters","qrs"].includes(resource)?[{value:"name",label:"Name A–Z"},{value:"-name",label:"Name Z–A"}]:[]),...(["doctors","patients","users"].includes(resource)?[{value:"fullName",label:"Name A–Z"},{value:"-fullName",label:"Name Z–A"}]:[]),...(resource==="exceptions"?[{value:"date",label:"Earliest Date"},{value:"-date",label:"Latest Date"}]:[]),...(config.fields.some(field=>field.key==="status")?[{value:"status",label:"Status A–Z"},{value:"-status",label:"Status Z–A"}]:[])];
  const sortableColumns=new Set(["name","fullName","date","status","code","email"]);
  const hasAdvanced=true;
  const hasStatusTabs=config.fields.some(field=>field.key==="status");
  const filterNames = useFilterNames(filters);
  const chips:FilterChip[]=[
    ...(search?[{key:"search",label:`Search: ${search}`,onRemove:()=>setSearch("")}]:[]),
    ...Object.entries(filters).filter(([k,v])=>v&&v!==roleDefaults[k]).map(([k,v])=>({key:`adv:${k}`,label:k.endsWith("Id")?`${FILTER_LABELS[k]||title(k)}: ${filterNames.name(k)}`:chipLabel(k,v),onRemove:()=>filter(k,roleDefaults[k]||"")})),
    ...(sort!=="-createdAt"?[{key:"adv:sort",label:`Sort: ${sortOptions.find(o=>o.value===sort)?.label||sort}`,onRemove:()=>setSort("-createdAt")}]:[]),
  ];
 // Common filters are exposed beside the search and apply immediately (date range and status are independent);
 // the drawer keeps the full set. Role defaults and fixed/pinned scope are never offered for change.
 const statusOptions=resource==="users"||config.columns.includes("status")&&!["audit","availability"].includes(resource)?[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]:null;
 const primaryFilters=resource==="masters"||compactClinicToolbar?undefined:<div className="lh-quick-filters" data-testid={`quick-filters-${resource}`}>
  {statusOptions&&<SearchableSelect label="Status" placeholder="All statuses" value={filters.status||""} onChange={value=>filter("status",value)} options={statusOptions}/>}
  {["branches","doctors","patients","qrs"].includes(resource)&&!fixedClinicId&&!branchPin&&<ResourceLookup resource="clinics" label={resource==="patients"?"Registration clinic":"Clinic"} value={filters.clinicId||""} onChange={value=>filter("clinicId",value)}/>}
  {resource==="availability"&&<SearchableSelect label="Day" placeholder="All days" value={filters.dayOfWeek||""} onChange={value=>filter("dayOfWeek",value)} options={DAYS.map((label,index)=>({value:String(index),label}))}/>}
  {resource==="audit"&&<SearchableSelect label="Event Category" placeholder="All events" value={filters.activityType||""} onChange={value=>filter("activityType",value)} options={[{value:"operational",label:"Operational Activity"},{value:"security",label:"Security Audit"}]}/>}
  {["patients","audit"].includes(resource)&&<DateRangeInput fromLabel="From date" toLabel="To date" testId={`${resource}-quick-range`} from={filters.from||""} to={filters.to||""} onChange={range=>{if(!rangeError(range.from,range.to))changeUrl({from:range.from,to:range.to,page:1});}}/>}
 </div>;
   return <><div className={`admin-listing-filter${embedded?" embedded":""}`}><FilterBar compactToolbar={compactClinicToolbar} filters={primaryFilters} title={compactClinicToolbar?<h2>{resource==="clinics"?"Clinic":title(listName)}</h2>:headingCount?<h2 className="lh-heading" data-testid="heading-locations">Locations{query.data&&!query.error?<span className="muted lh-heading-count" data-testid="text-locations-count"> · {query.data.total}</span>:null}</h2>:undefined} secondary={<>{resource==="patients"&&<PatientFilteredExport params={listParams} timezone={settings.data?.timezone} disabled={query.isLoading||query.isPlaceholderData||!!query.error||!query.data?.total}/>}{viewControls}</>} actions={<>{config.create&&allowCreate&&<button className="button small" onClick={()=>{save.reset();setDirty(false);setEditing({...defaults,...resource==="qrs"?Object.fromEntries(["clinicId","branchId","doctorId"].filter(key=>filters[key]).map(key=>[key,filters[key]])):{},...fixedClinicId?{clinicId:fixedClinicId}:{}});}} data-testid={`button-add-${resource}`}><Plus size={17}/> Add {singularName}</button>}</>} onReset={reset} active={active} chips={chips} label={`Filter ${listName}`} activeCount={chips.filter(c=>c.key!=="search").length} onOpen={()=>setDraft({...filters,sort})} onApply={applyDraft} advanced={hasAdvanced?<>
  {hasStatusTabs&&<SearchableSelect label="Status" testId={`select-${resource}-status`} value={draft.status||"all"} onChange={value=>draftFilter("status",value==="active"||value==="inactive"?value:"")} options={[{value:"all",label:"All"},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>}
  {!fixedClinicId&&!branchPin&&["availability","exceptions"].includes(resource)&&<ResourceLookup resource="clinics" label="Clinic" value={draft.clinicId||""} onChange={value=>draftFilter("clinicId",value)}/>}
  {["availability","exceptions"].includes(resource)&&<>{branchPin?<p className="loc-fixed-note" data-testid="text-filter-location-fixed">Location: {branchPin.name} · change it from the top bar</p>:<ResourceLookup resource="branches" label="Location" params={{clinicId:draft.clinicId||undefined}} value={draft.branchId||""} onChange={value=>draftFilter("branchId",value)}/>}<ResourceLookup resource="doctors" label="Doctor" disabled={!!roleDefaults.doctorId} params={{clinicId:draft.clinicId||undefined,branchId:draft.branchId||undefined}} value={roleDefaults.doctorId||draft.doctorId||""} onChange={value=>draftFilter("doctorId",value)}/></>}
  {resource==="exceptions"&&<label>Date<DateFormatInput data-testid="input-exceptions-date-filter" value={draft.date||""} onChange={value=>draftFilter("date",value)}/></label>}
  {resource==="masters"&&<SearchableSelect label="Category" placeholder="All categories" value={draft.category||""} onChange={value=>draftFilter("category",value)} options={Object.values(api.MasterInputCategory).map(category=>({value:category,label:title(category)}))}/>}
  <div className="sort-menu" data-testid={`select-sort-${resource}`}><SearchableSelect label={`Sort ${listName}`} value={sortOptions.some(option=>option.value===draft.sort)?draft.sort:"-createdAt"} onChange={value=>draftFilter("sort",value||"-createdAt")} options={sortOptions}/></div>
  {resource==="clinics"&&identity?.user?.role==="superAdmin"&&<ResourceLookup resource="users" label="Clinic Admin" params={{role:"clinicAdmin"}} value={draft.adminId||""} onChange={value=>draftFilter("adminId",value)}/>}
  {resource==="doctors"&&<ResourceLookup resource="masters" label="Specialization" params={{category:"specialization"}} value={draft.specializationId||""} onChange={value=>draftFilter("specializationId",value)}/>}
  {resource==="doctors"&&identity?.user?.role==="superAdmin"&&<ResourceLookup resource="users" label="Managing Admin" params={{role:"clinicAdmin"}} value={draft.managingAdminId||""} onChange={value=>draftFilter("managingAdminId",value)}/>}
  {["patients","audit"].includes(resource)&&<><DateRangeInput fromLabel="From date" toLabel="To date" testId={`${resource}-range`} fromTestId={`input-${resource}-from`} toTestId={`input-${resource}-to`} from={draft.from||""} to={draft.to||""} onChange={range=>{draftFilter("from",range.from);draftFilter("to",range.to);}}/>{draft.from&&draft.to&&draft.from>draft.to&&<p role="alert" className="field-error">Select an end date on or after the start date.</p>}</>}
  {["doctors","patients"].includes(resource)&&!branchPin&&<ResourceLookup resource="branches" label="Clinic" params={{clinicId:draft.clinicId||undefined}} value={draft.branchId||""} onChange={value=>draftFilter("branchId",value)}/>}
   {["branches","doctors","patients","qrs"].includes(resource)&&!fixedClinicId&&<ResourceLookup resource="clinics" label={resource==="patients"?"Registration clinic":"Clinic"} value={draft.clinicId||""} onChange={value=>draftFilter("clinicId",value)}/>}
   {resource==="qrs"&&<><ResourceLookup resource="branches" label="Location" params={{clinicId:draft.clinicId||undefined}} value={draft.branchId||""} onChange={value=>draftFilter("branchId",value)}/><ResourceLookup resource="doctors" label="Doctor" params={{clinicId:draft.clinicId||undefined,branchId:draft.branchId||undefined}} value={draft.doctorId||""} onChange={value=>draftFilter("doctorId",value)}/></>}
  {resource==="availability"&&<SearchableSelect label="Day" placeholder="All days" value={draft.dayOfWeek||""} onChange={value=>draftFilter("dayOfWeek",value)} options={DAYS.map((label,index)=>({value:String(index),label}))}/>}
   {resource==="audit"&&<SearchableSelect label="Event Category" placeholder="All events" value={draft.activityType||""} onChange={value=>draftFilter("activityType",value)} options={[{value:"operational",label:"Operational Activity"},{value:"security",label:"Security Audit"}]}/>}
 </>:undefined}>
   <SearchInput placeholder={searchPlaceholder} value={search} onChange={setSearch} suggestions={query.error||query.isPlaceholderData?[]:listingSuggestions(query.data?.items,(row:any)=>{const value=row.fullName||row.name||row.reference||row.summary;return value?{id:String(row.id),label:String(value),description:[row.clinicName||row.specializationName||row.city,row.category].filter(Boolean).join(" · ")||undefined,value:String(value)}:null;})} loading={query.isFetching} error={query.error?friendlyError(query.error,"load"):null} onRetry={()=>void query.refetch()} total={query.data?.total} settledQuery={term} scopeKey={JSON.stringify([resource,{...listParams,search:undefined,page:undefined}])}/>
  </FilterBar></div>
  {filterNames.errors}
 {confirmation.dialog}{success&&<p className="notice" role="status">{success}</p>}
  {resource==="availability"&&<p className="listing-hint" data-testid="notice-schedule-vs-opening-hours">Doctor sessions set bookable times and capacity for each doctor and location. Location opening hours are separate; {identity?.user?.role==="superAdmin"||identity?.user?.role==="clinicAdmin"?<Link href={`/admin/settings${filters.clinicId?`?clinicId=${encodeURIComponent(filters.clinicId)}`:""}`} data-testid="link-location-opening-hours">edit opening days and hours in Clinic settings</Link>:"ask the clinic owner to update them"}.</p>}
  {resource==="qrs"&&<p className="listing-hint" data-testid="notice-qr-readiness">A booking QR can identify a clinic before it is ready to accept patients. Check that the location is open and the doctor has active bookable sessions with capacity in <Link href={`/${portal}/availability${filters.clinicId?`?clinicId=${encodeURIComponent(filters.clinicId)}`:""}`} data-testid="link-qr-sessions">Weekly Schedule</Link> before sharing it.</p>}
 {resource==="patients"&&registeredPatient&&<p className="notice" role="status" data-testid="notice-patient-registered">
  {registeredPatient.fullName} is registered. No appointment is required. Your list filters are unchanged.{" "}
  <button type="button" className="text-link" onClick={()=>changeUrl({open:registeredPatient.id})} data-testid="button-open-registered-patient">Open Saved Patient</button>
 </p>}
 {!allowCreate&&resource==="patients"&&<p className="notice">New patient registration is available to receptionists and administrators. Ask your clinic staff to register a new patient.</p>}<ErrorNotice error={remove.error||statusUpdate.error}/>
 <ListingBulk selection={selection} resource={resource} columns={config.columns} identity={identity} context={selectionContext}/>
 {resource==="availability"&&filters.doctorId&&filters.branchId&&<WeeklyScheduleEditor key={`${filters.doctorId}-${filters.branchId}`} doctorId={filters.doctorId} branchId={filters.branchId} onEdit={row=>{save.reset();setDirty(false);setEditing(row);}}/>}
 <section className={`panel table-panel admin-listing-table density-${density}${superadminClinics?" superadmin-clinics-table":""}`}>
   {query.isLoading?<div className="skeleton" role="status">Loading {listName}…</div>:query.error?<><div className="error-box" role="alert">{friendlyError(query.error,"load")}</div><button onClick={()=>query.refetch()}>Retry {listName}</button></>:query.data?.items?.length?<div className="table-scroll" inert={query.isPlaceholderData}><table aria-busy={query.isFetching}>
  <colgroup><col className="col-select"/>{displayColumns.map(c=><col key={c} className={compact&&c===config.columns[0]?"col-record":superadminClinics?`col-${c}`:undefined}/>)}{hasActions&&<col className="col-actions"/>}</colgroup>
  <thead><tr><th scope="col" className="col-select">{selection.header}</th>{displayColumns.map(c=><th scope="col" key={c} aria-sort={sortableColumns.has(c)?sort.replace(/^-/,"")===c?sort.startsWith("-")?"descending":"ascending":"none":undefined} className={[compact&&c===config.columns[0]?"col-record":c==="status"?"col-status":"",c===arranged.pinned?"col-pinned":""].filter(Boolean).join(" ")||undefined}>{sortableColumns.has(c)?<button type="button" className="table-sort-header" style={{display:"inline-flex",alignItems:"center",gap:4,border:0,background:"transparent",font:"inherit",color:"inherit",padding:0,cursor:"pointer"}} onClick={()=>setSort(sort===c?`-${c}`:c)} aria-label={`Sort by ${columnLabel(c)} ${sort===c?"descending":"ascending"}`} data-testid={`sort-${resource}-${c}`}>{columnLabel(c)}{sort.replace(/^-/,"")===c?sort.startsWith("-")?<ArrowDown size={14}/>:<ArrowUp size={14}/>:<ArrowUpDown size={13}/>}</button>:columnLabel(c)}</th>)}{hasActions&&<th scope="col" className="col-actions sticky">Actions</th>}</tr></thead>
 <tbody>{query.data.items.map((row:any)=><Fragment key={row.id}><tr data-testid={`row-${resource}-${row.id}`} className={openId===row.id?"is-linked":undefined}>
 <td data-label="Select" className="col-select"><span className="row-lead">{selection.checkbox(row)}{<button type="button" className="row-expand-toggle" aria-expanded={expanded===row.id} aria-controls={`expand-${row.id}`} aria-label={`${expanded===row.id?"Hide":"Show"} details for ${row.name||row.fullName||"record"}`} onClick={()=>setExpanded(expanded===row.id?null:row.id)} data-testid={`button-expand-${row.id}`}><ChevronRight size={14} aria-hidden/></button>}</span></td>
  {displayColumns.map(c=><td key={c} data-label={columnLabel(c)} className={[compact&&c===config.columns[0]?"col-record":c==="createdAt"?"col-created":"",c===arranged.pinned?"col-pinned":""].filter(Boolean).join(" ")||undefined}>{compact&&c===config.columns[0]?<div className="admin-record"><strong>{resource==="clinics"&&portal==="admin"?<Link href={clinicRecordHref(row.id)}><OverflowText value={row[c]}/></Link>:<OverflowText value={row[c]} testId={`text-${resource}-name-${row.id}`}/>}</strong>{recordSecondary(resource,row,displayColumns)&&<small><OverflowText value={String(recordSecondary(resource,row,displayColumns))}/></small>}</div>:resource==="users"&&c==="status"?<StatusSwitch label={`${row.fullName}: ${row.status==="active"?"Active":"Inactive"}`} testId={`switch-user-status-${row.id}`} active={row.status==="active"} title={row.id===identity?.user?.id?"Change your own status through an authorised administrator":!["superAdmin","clinicAdmin"].includes(identity?.user?.role||"")?"Only administrators can change user access":undefined} disabled={statusUpdate.isPending||row.id===identity?.user?.id||!["superAdmin","clinicAdmin"].includes(identity?.user?.role||"")} onChange={()=>changeUserStatus(row)}>{row.status==="active"?"Active":"Inactive"}{row.id===identity?.user?.id&&<small className="muted"> · Ask another administrator</small>}</StatusSwitch>:resource==="audit"&&c==="action"?title(String(row.action||"").replace(/[._]/g," ")):resource==="audit"&&c==="summary"?<span className="audit-summary-cell"><OverflowText value={row.summary}/><button type="button" className="button secondary small" aria-label={`Event details: ${row.summary||row.action}`} onClick={()=>setAuditDetail(row)} data-testid={`button-audit-details-${row.id}`}>Details</button></span>:c==="createdAt"?<CreatedCell value={row[c]} timezone={row.timezone||settings.data?.timezone} preferences={row}/>:renderComputed(c,row)??(c==="status"?<span className={`badge ${row[c]}`}>{title(row[c]||"")}</span>:c==="dayOfWeek"?DAYS[row[c]]:typeof row[c]==="boolean"?(row[c]?"Yes":"No"):Array.isArray(row[c])?<OverflowText value={row[c].join(", ")}/>:typeof row[c]==="string"?<OverflowText value={row[c]}/>:row[c]??"—")}</td>)}
 {hasActions&&<td data-label="Actions" className="col-actions sticky"><div className="row-actions">{resource==="qrs"&&row.status==="active"&&<IconAction label={`View booking QR for ${row.name}`} hint="View booking QR and link" icon={<QrCode size={15} aria-hidden/>} onClick={()=>setQrPreview(row)} testId={`button-view-qr-${row.id}`}/>}{resource==="patients"&&<IconAction label={`Open details for ${row.fullName||"patient"}`} hint="Details: timeline, activity and documents" icon={<PanelRightOpen size={15} aria-hidden/>} onClick={()=>setPatientDetail(row)} testId={`button-patient-details-${row.id}`}/>}{config.update&&!(OWNER_ONLY_FIELDS[resource]&&(identity?.user?.role==="doctor"||identity?.user?.role==="receptionist"||resource==="clinics"&&identity?.user?.role==="clinicAdmin"&&row.adminId!==identity.user.id))&&(resource==="clinics"&&portal==="admin"?<IconAction label={`Configure ${row.name}`} hint="Configure this clinic" icon={<Pencil size={15} aria-hidden/>} href={clinicRecordHref(row.id)} testId={`button-edit-${row.id}`}/>:<IconAction label={`Edit ${row.name||row.fullName||"record"}`} hint="Edit this record" icon={<Pencil size={15} aria-hidden/>} onClick={()=>{if(onEdit)onEdit(row);else{save.reset();setDirty(false);setEditing(row);}}} testId={`button-edit-${row.id}`}/>)}{(()=>{const scheduleLinks:RowMenuItem[]=resource==="doctors"?[{key:"weekly",label:"Weekly Schedule",href:`/${portal}/availability?doctorId=${encodeURIComponent(row.id)}${row.clinicId?`&clinicId=${encodeURIComponent(row.clinicId)}`:""}`,testId:`link-doctor-weekly-${row.id}`},{key:"exceptions",label:"Date Exceptions",href:`/${portal}/exceptions?doctorId=${encodeURIComponent(row.id)}${row.clinicId?`&clinicId=${encodeURIComponent(row.clinicId)}`:""}`,testId:`link-doctor-exceptions-${row.id}`}]:[];const extra:RowMenuItem[]=[...scheduleLinks,...(config.update?[{key:"deactivate",label:"Deactivate",hint:"Deactivate; historical records are preserved",danger:true,disabled:remove.isPending||row.status==="inactive",testId:`action-deactivate-${row.id}`,onSelect:()=>{void (async()=>{if(!remove.isPending&&await confirmation.ask({title:"Deactivate Record?",description:"The record becomes inactive. Historical records are preserved; this is not permanent deletion.",confirmLabel:"Deactivate",tone:"danger"}))remove.mutate(row.id);})();}}]:[])];return ["clinics","branches"].includes(resource)?<LocationActions row={row} resource={resource} portal={portal} extra={extra} viewHref={superadminClinics?clinicRecordHref(row.id):undefined}/>:extra.length?<RowMenu label={`More actions for ${row.name||row.fullName||"record"}`} testId={`menu-${row.id}`} items={extra}/>:null;})()}</div></td>}
  </tr>{expanded===row.id&&<tr className="row-expansion" id={`expand-${row.id}`}><td colSpan={displayColumns.length+(hasActions?2:1)}><RecordFacts facts={recordFacts(row,displayColumns.filter(c=>c!==config.columns[0]))} testId={`expansion-${resource}-${row.id}`}/></td></tr>}</Fragment>)}</tbody></table></div>:active?<div className="empty"><h3>No matching {listName}</h3><p>Try a different search or clear your filters.</p><button onClick={reset}>Clear Filters</button></div>:<Empty label={listName}/>}
  {query.isFetching&&!query.isLoading&&!query.error&&<span className="admin-listing-refresh" role="status">Updating {listName}…</span>}
  {!query.error&&<div className="admin-listing-pagination"><Pagination page={page} pageSize={pageSize} total={query.data?.total||0} onPageChange={setPage} onPageSizeChange={setPageSize} resetPageOnSizeChange={false} hideTotal={headingCount}/></div>}</section>
  {resource==="users"&&identity?.user?.role!=="doctor"&&<details className="panel listing-disclosure" data-testid="details-account-recovery"><summary>Account Recovery Assistance</summary><p className="muted">Select a linked staff account to view the secure account recovery steps. This action does not send an email.</p><div className="inline-form"><ResourceLookup resource="users" label="Staff Account" params={{role:"receptionist",linkedOnly:true}} value={recoveryId} onChange={value=>{setRecoveryId(value);recovery.reset();}}/><button disabled={!recoveryId||recovery.isPending} onClick={()=>{if(!recovery.isPending)recovery.mutate({id:recoveryId});}} data-testid="button-password-reset">{recovery.isPending?"Loading…":"Get Recovery Steps"}</button></div><ErrorNotice error={recovery.error}/>{recovery.data&&<div className="notice" data-testid="status-password-recovery"><p>{recovery.data.message}</p><Link href="/forgot-password" className="text-link" data-testid="link-password-recovery">Open Secure Password Recovery</Link></div>}</details>}
 {resource==="users"&&identity?.user?.role==="superAdmin"&&allowCreate&&<ClinicAdminOnboarding />}
  {resource==="patients"&&patientDetail&&<PatientDetailsDrawer patient={patientDetail} onClose={()=>setPatientDetail(null)}/>}
  {openId&&exactLoader&&(resource==="patients"&&exact.data?<PatientDetailsDrawer patient={exact.data} onClose={closeExact}/>:<ExactRecordDrawer title={`${title(singularName)} Details`} query={exact} onClose={closeExact} actions={(record:any)=>config.update&&!(resource==="clinics"&&portal==="admin")?<button type="button" className="button secondary" onClick={()=>{closeExact();if(onEdit)onEdit(record);else{save.reset();setDirty(false);setEditing(record);}}} data-testid="button-exact-edit">Edit {title(singularName)}</button>:resource==="clinics"&&portal==="admin"?<Link href={`/admin/settings?clinicId=${encodeURIComponent(record.id)}&section=general`} className="button secondary">Configure Clinic Group</Link>:null}>{(record:any)=><><h3 className="exact-record-title">{record.fullName||record.name||record.doctorName||"Record"}</h3><RecordFacts facts={recordFacts(record)} testId={`exact-facts-${resource}`}/></>}</ExactRecordDrawer>)}{resource==="audit"&&auditDetail&&<AppDialog open variant="drawer" onClose={()=>setAuditDetail(null)} title="Audit Event"><dl className="facts audit-detail" data-testid="audit-detail">{[["Time",auditDetail.createdAt?formatConfiguredTimestamp(auditDetail.createdAt,auditDetail.timezone||settings.data?.timezone,undefined,auditDetail):"—"],["Actor",[auditDetail.actorName,auditDetail.actorRole&&title(auditDetail.actorRole)].filter(Boolean).join(" · ")||"—"],["Action",auditDetail.action],["Record type",auditDetail.entityType],["Summary",auditDetail.summary]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||"—"}</dd></div>)}</dl><details className="audit-technical"><summary>Technical Payload</summary><pre data-testid="audit-payload">{JSON.stringify(auditDetail,null,2)}</pre></details></AppDialog>}
  {resource==="qrs"&&qrPreview&&<AppDialog open onClose={()=>setQrPreview(null)} title={`Booking QR · ${qrPreview.name}`}><QrCard row={qrPreview} onRegenerated={()=>{setQrPreview(null);setSuccess("QR reference regenerated. Replace printed copies.");}}/></AppDialog>}
   {editing&&<AppDialog open size="medium" onClose={()=>setEditing(null)} title={`${editing.id?"Edit":"Add"} ${title(singularName)}`} dirty={dirty} busy={save.isPending}>{resource==="availability"&&<p className="notice">Each record is one consulting session. Add separate, non-overlapping sessions for the same doctor, clinic and weekday. Overnight sessions are not supported.</p>}<ErrorNotice error={save.error}/>{editing.id&&OWNER_ONLY_FIELDS[resource]&&!isClinicOwner?<div className="notice" role="note" data-testid="text-owner-only-fields"><p>{owningClinic.isLoading?"Checking clinic ownership…":owningClinic.error?"Unable to confirm clinic ownership. Editing stays locked.":"These clinic details are read only for you. Only the clinic owner or a Super Admin can change name, address, contact, timezone and hours, in Clinic settings."}</p><button type="button" className="button secondary small" onClick={()=>setEditing(null)} data-testid="button-owner-only-close">Close</button></div>:<Editor fields={effectiveFields} initial={editing} onSave={data=>{if(!save.isPending)save.mutate(data);}} onCancel={resource==="patients"?undefined:async()=>{if(!dirty||await confirmation.ask({title:"Discard Changes?",description:"Your unsaved changes will be lost.",confirmLabel:"Discard Changes",tone:"danger"}))setEditing(null);}} busy={save.isPending} submitLabel={editing.id?"Save Changes":`Add ${title(singularName)}`} resourceName={resource} onDirtyChange={setDirty}/>}</AppDialog>}
 </>;
}
export const profileFields = [f("fullName","text",true),f("mobile","tel"),f("photoUrl","url")];
export const settingsFields = [f("platformName"),f("supportEmail","email"),f("supportPhone","tel"),f("timezone"),{...f("bookingHorizonDays","number"),label:"Booking Horizon (days)",width:"md" as const},{...f("cancellationCutoffMinutes","number"),label:"Cancellation Cutoff (minutes)",width:"md" as const},f("requireMobileVerification","checkbox"),{...f("otpExpirySeconds","number"),label:"OTP Expiry (seconds)",width:"md" as const},{...f("otpMaxAttempts","number"),label:"OTP Max Attempts",width:"md" as const},f("termsUrl","url"),f("privacyUrl","url")];