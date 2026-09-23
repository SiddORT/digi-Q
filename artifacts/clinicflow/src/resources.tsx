import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Link } from "wouter";
import { Form } from "@/components/ui/form";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { ClinicAdminOnboarding } from "./components/ClinicAdminOnboarding";
import { ResourceLookup, ResourceMultiLookup } from "./components/ResourceLookup";
import { Pagination, SearchInput, FilterBar, useDebouncedValue } from "./components/ListingControls";
import { AppDialog } from "./components/AppDialog";
import { SearchableSelect } from "./components/SearchableSelect";
import { SuggestionInput } from "./components/SuggestionInput";

export const title = (s:string) => s.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase());
export const today = (timeZone?:string) => new Date().toLocaleDateString("en-CA",timeZone?{timeZone}:undefined);
export function ErrorNotice({error}:{error:unknown}) { return error ? <div className="error-box" role="alert" data-testid="status-error">{error instanceof Error ? error.message : String(error)}</div> : null; }
export function Empty({label="records"}:{label?:string}){return <div className="empty" data-testid="status-empty"><span className="empty-icon"><Plus size={24}/></span><h3>No {label} yet</h3><p>When {label} are added, you'll find them here.</p></div>;}
type Field = {key:string; label?:string; type?:string; required?:boolean; options?:string[]; resource?:string; category?:string; nullable?:boolean; hidden?:boolean};
const f=(key:string,type="text",required=false,options?:string[]):Field=>({key,type,required,options});
const relation=(key:string,resource:string,required=false):Field=>({key,resource,required});
const master=(key:string,category:string):Field=>({...relation(key,"masters"),category});
const location=(key:string,required=false):Field=>({key,required,type:"masterText",category:key});
const status=f("status","select",false,["active","inactive"]);
const locationFields=[f("address","text",true),location("city"),location("state"),location("pincode"),f("phone","tel")];
const person=[f("fullName","text",true),f("mobile","tel",true),f("email","email"),f("dateOfBirth","date"),f("gender","select",false,["female","male","other","preferNotToSay"])];
type Resource = {name:string; list:any;create?:any;update?:any;remove?:any;fields:Field[];columns:string[]};
export const resources:Record<string,Resource>={
 clinics:{name:"clinics",list:api.listClinics,create:api.createClinic,update:api.updateClinic,remove:api.deleteClinic,fields:[f("name","text",true),...locationFields,location("country"),location("area"),f("email","email"),f("description","textarea"),master("clinicTypeId","clinicType"),master("categoryId","clinicCategory"),relation("adminId","users"),status],columns:["name","code","city","phone","status"]},
 branches:{name:"branches",list:api.listBranches,create:api.createBranch,update:api.updateBranch,remove:api.deleteBranch,fields:[relation("clinicId","clinics",true),f("name","text",true),...locationFields,f("timezone"),status],columns:["name","clinicName","city","timezone","status"]},
 doctors:{name:"doctors",list:api.listDoctors,create:api.createDoctor,update:api.updateDoctor,remove:api.deleteDoctor,fields:[...person.map(field=>field.key==="email"?{...field,required:true}:field.key==="mobile"?{...field,required:false}:field),f("photoUrl","url"),master("specializationId","specialization"),f("registrationNumber"),f("experienceYears","number"),f("consultationFee","number"),f("about","textarea"),relation("ownerAdminId","users"),relation("clinicIds","clinics"),relation("branchIds","branches"),master("qualificationIds","qualification"),{...f("languages","array"),label:"Languages (comma-separated)"},status],columns:["fullName","specializationName","email","clinicNames","branchNames","status"]},
 patients:{name:"patients",list:api.listPatients,create:api.createPatient,update:api.updatePatient,remove:api.deletePatient,fields:[...person,f("age","number"),f("address"),f("emergencyContactName"),f("emergencyContactPhone","tel"),relation("clinicId","clinics"),relation("branchId","branches"),status],columns:["fullName","code","mobile","gender","mobileVerified"]},
 users:{name:"users",list:api.listUsers,create:api.createUser,update:api.updateUser,remove:api.deleteUser,fields:[f("fullName","text",true),f("email","email",true),f("mobile","tel"),f("role","select",true,["receptionist","clinicAdmin","patient"]),relation("clinicIds","clinics"),relation("branchIds","branches"),status],columns:["fullName","email","role","clinicNames","branchNames","status"]},
 masters:{name:"master values",list:api.listMasters,create:api.createMaster,update:api.updateMaster,remove:api.deleteMaster,fields:[f("category","select",true,Object.values(api.MasterInputCategory)),f("name","text",true),f("code","text",true),relation("parentId","masters"),f("sortOrder","number"),status],columns:["name","category","code","status"]},
 availability:{name:"weekly schedules",list:api.listSchedules,create:api.createSchedule,update:api.updateSchedule,remove:api.deleteSchedule,fields:[relation("doctorId","doctors",true),relation("clinicId","clinics",true),relation("branchId","branches",true),f("dayOfWeek","select",true,["0","1","2","3","4","5","6"]),f("isOpen","checkbox"),f("startTime","time",true),f("endTime","time",true),f("breakStart","time"),f("breakEnd","time"),f("timezone"),f("tokenPrefix","text",true),f("maxTokens","number",true),f("consultationMinutes","number",true),f("bufferMinutes","number"),f("queueMode","select",false,["mixed","appointmentsOnly","walkInsOnly"]),f("queueOpenTime","time"),f("queueCloseTime","time")],columns:["doctorName","branchName","dayOfWeek","startTime","endTime","maxTokens"]},
 exceptions:{name:"date exceptions",list:api.listAvailabilityExceptions,create:api.createAvailabilityException,update:api.updateAvailabilityException,remove:api.deleteAvailabilityException,fields:[relation("doctorId","doctors",true),relation("branchId","branches",true),f("date","date",true),f("isClosed","checkbox"),f("reason","text",true),f("startTime","time"),f("endTime","time"),f("breakStart","time"),f("breakEnd","time"),f("maxTokens","number")],columns:["date","reason","isClosed","startTime","endTime"]},
  qrs:{name:"booking QR codes",list:api.listQrs,create:api.createQr,update:api.updateQr,remove:api.deleteQr,fields:[f("name","text",true),relation("clinicId","clinics",true),{...relation("branchId","branches"),nullable:true},{...relation("doctorId","doctors"),nullable:true},status],columns:["name","reference","status"]},
 audit:{name:"audit events",list:api.listAuditLogs,fields:[],columns:["createdAt","actorName","action","entityType","summary"]},
};
function MasterTextInput({field,control}:any){
 const [search,setSearch]=useState("");
 const term=useDebouncedValue(search);
 const q=useQuery({queryKey:["lookup","masters",field.category,term],queryFn:()=>api.listMasters({category:field.category,status:"active",search:term,pageSize:20} as any)});
 const fieldName=title(field.key).toLowerCase();
 return <Controller name={field.key} control={control} rules={{required:field.required}} render={({field:input})=><SuggestionInput id={`input-${field.key}`} value={input.value||""} onChange={input.onChange} onSearchChange={setSearch} options={(q.data?.items||[]).map(row=>row.name)} placeholder={`Type or search ${fieldName}…`} clearLabel={`Clear ${fieldName}`} loading={q.isFetching} error={q.error ? `Unable to load ${fieldName} suggestions. You can still enter free text.` : undefined}/>}/>;
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
   if(values.clinicId)params.clinicId=values.clinicId;
   if(values.branchId)params.branchId=values.branchId;
 }
 if(assignment){params.targetRole=resourceName==="doctors"?"doctor":"receptionist";params[resourceName==="doctors"?"doctorId":"userId"]=values.id;}
 useEffect(()=>{form.register(field.key,{validate:(value:any)=>!field.required||(many?value?.length>0:!!value)||"Required"});},[field.key,field.required]);
 const change=(value:any)=>{
   form.setValue(field.key,value,{shouldValidate:true,shouldDirty:true});
   if(["clinicId","clinicIds"].includes(field.key)){
     for(const dependent of ["branchId","branchIds","doctorId"])if(fields.some((f:Field)=>f.key===dependent))form.setValue(dependent,dependent.endsWith("Ids")?[]:"",{shouldDirty:true});
   }
   if(field.key==="branchId"&&hasClinic&&fields.some((f:Field)=>f.key==="doctorId"))form.setValue("doctorId","",{shouldDirty:true});
 };
  const props={resource:assignment?`assignment:${field.resource}`:field.resource,params,label,placeholder:`Search ${label.toLowerCase()}…`,disabled:["branches","doctors"].includes(field.resource)&&hasClinic&&!clinicIds.length,required:field.required,onChange:change};
 return many?<ResourceMultiLookup {...props} value={values[field.key]||[]}/>:<ResourceLookup {...props} value={values[field.key]||""}/>;
}
export function Editor({fields,initial={},onSave,busy=false,submitLabel="Save changes",resourceName,onDirtyChange}:{fields:Field[];initial?:any;onSave:(data:any)=>void;busy?:boolean;submitLabel?:string;resourceName?:string;onDirtyChange?:(dirty:boolean)=>void}){
 const form=useForm({defaultValues:initial});
 const submitting=useRef(false);
 useEffect(()=>{if(!busy)submitting.current=false;},[busy]);
 useEffect(()=>{onDirtyChange?.(form.formState.isDirty);},[form.formState.isDirty,onDirtyChange]);
 const currentRole = form.watch("role");
 const activeFields = useMemo(() => {
   return fields.map(f => {
     const field = { ...f };
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
 }, [fields, currentRole]);

   return <Form {...form}><form className="form-grid" onSubmit={form.handleSubmit(values=>{if(busy||submitting.current)return;submitting.current=true;const body:any={}; activeFields.forEach(field=>{
    let value=values[field.key];
    const isClinicOrBranchMapping = field.key === "clinicIds" || field.key === "branchIds";
    if (field.key === "adminId" || field.key === "ownerAdminId") {
      if (field.hidden || value === initial[field.key]) return;
    } else if (field.hidden) {
      if (isClinicOrBranchMapping) return; // omit empty mappings for ClinicAdmin/Patient
      return;
    }
    if(value===""||value===undefined||value===null){
      if(field.nullable)body[field.key]=null;
      // Also omit mapping array if not required to bypass minItems1 on create
      if (isClinicOrBranchMapping && !field.required) return;
      return;
    }
    if(field.type==="number"||field.key==="dayOfWeek")value=Number(value);
    if(field.type==="array")value=Array.isArray(value)?value:String(value).split(",").map(s=>s.trim()).filter(Boolean);
    if(Array.isArray(value))value=value.filter(Boolean);

    body[field.key]=value;
  });onSave(body);})}>
   {activeFields.map(field=>{
    const label=field.label||title(field.key.replace(/Ids?$/,""));
    const error=form.formState.errors[field.key] ? "Please complete this field." : undefined;
    if(field.resource)return <div className={field.type==="textarea"?"wide":""} key={field.key}><RelationInput field={field} form={form} fields={fields} resourceName={resourceName} label={label}/>{error&&<small className="field-error">{error}</small>}</div>;
    if(field.type==="masterText")return <label key={field.key}>{label}{field.required&&<span className="required"> *</span>}<MasterTextInput field={field} control={form.control}/>{error&&<small className="field-error">{error}</small>}</label>;
    if(field.type==="select")return <Controller key={field.key} name={field.key} control={form.control} rules={{required:field.required}} render={({field:input})=><SearchableSelect id={`input-${field.key}`} label={label} required={field.required} value={input.value||""} onChange={input.onChange} placeholder={`Select ${label.toLowerCase()}…`} error={error} options={(field.options||[]).map(v=>({value:v,label:field.key==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(v)]:title(v)}))}/>}/>;
    return <label className={field.type==="textarea"?"wide":""} key={field.key}>{label}{field.required&&<span className="required"> *</span>}{field.type==="textarea"?<textarea data-testid={`input-${field.key}`} {...form.register(field.key,{required:field.required})}/>:<input data-testid={`input-${field.key}`} type={field.type==="array"?"text":field.type} {...form.register(field.key,{required:field.required})}/>} {error&&<small className="field-error">{error}</small>}</label>;
   })}
 <div className="wide form-footer"><button className="button" disabled={busy} data-testid="button-save">{busy?"Saving…":submitLabel}</button></div></form></Form>;
}
function QrCard({row}:{row:any}){
 const [image,setImage]=useState("");
 const [error,setError]=useState<unknown>();
 const client=useQueryClient();
 const url=`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,"")}/book/${row.reference}`;
 useEffect(()=>{QRCode.toDataURL(url,{width:400,margin:2}).then(setImage).catch(setError);},[url]);
 const regenerate=useMutation({mutationFn:()=>api.regenerateQr(row.id),onSuccess:()=>client.invalidateQueries()});
 return <div className="qr-card">{image?<img src={image} alt={`Booking QR code for ${row.name}`}/>:!error&&<p role="status">Generating QR image…</p>}<strong>{row.name}</strong><a href={url} target="_blank" rel="noreferrer">{url}</a>{image&&<a className="button secondary small" href={image} download={`${row.name}-qr.png`}><Download size={15}/> Download PNG</a>}<button disabled={regenerate.isPending} onClick={()=>{if(!regenerate.isPending&&confirm("Regenerate this QR code? Printed copies will stop working."))regenerate.mutate();}}>{regenerate.isPending?"Regenerating…":"Regenerate reference"}</button>{regenerate.isSuccess&&<p className="notice" role="status">QR reference regenerated. Download and replace printed copies.</p>}<ErrorNotice error={error||regenerate.error}/></div>;
}
export function ResourcePage({resource,identity,defaults={},allowCreate=true}:{resource:string;identity?:api.Identity;defaults?:any;allowCreate?:boolean}){
 const settings=api.useGetSettings({query:{queryKey:api.getGetSettingsQueryKey(),staleTime:60000}});
 const config=resources[resource]; const [search,setSearch]=useState("");const [page,setPage]=useState(1);const [editing,setEditing]=useState<any>(null);
 const [pageSize,setPageSize]=useState(20);
 const [filters,setFilters]=useState<Record<string,string>>({});
 const [sort,setSort]=useState("-createdAt");
 const [dirty,setDirty]=useState(false);
 const [success,setSuccess]=useState("");
 const term=useDebouncedValue(search);
 const supportsSearch=true;
 const filter=(key:string,value:string)=>{setFilters(previous=>({...previous,[key]:value,...(key==="clinicId"?{branchId:"",doctorId:""}:{})}));setPage(1);};
 const active=!!(search||Object.values(filters).some(Boolean));
 const reset=()=>{setSearch("");setFilters({});setSort("-createdAt");setPage(1);};
 const listParams={...Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=="")),search:term||undefined,page,pageSize,sort};
 const [recoveryId,setRecoveryId]=useState("");
 const recovery=api.useRequestUserPasswordReset();
 const client=useQueryClient();
 const query=useQuery<any>({queryKey:[resource,listParams],queryFn:()=>config.list(listParams)});
 useEffect(()=>{if(query.data&&page>1&&page>Math.max(1,Math.ceil(query.data.total/pageSize)))setPage(Math.max(1,Math.ceil(query.data.total/pageSize)));},[query.data,page,pageSize]);
 const save=useMutation({mutationFn:(data:any)=>editing?.id?config.update(editing.id,data):config.create(data),onSuccess:()=>{setEditing(null);setSuccess("Record saved successfully.");client.invalidateQueries();}});
 const remove=useMutation({mutationFn:(id:string)=>config.remove(id),onSuccess:()=>{setSuccess("Record deleted or deactivated successfully.");client.invalidateQueries();}});

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

  const searchPlaceholder=resource==="doctors"?"Search doctors by name, email or specialization…":resource==="patients"?"Search patients by name, email or mobile…":resource==="audit"?"Search audit events…":`Search ${config.name}…`;
  const sortOptions=[{value:"-createdAt",label:"Newest first"},{value:"createdAt",label:"Oldest first"},...(["clinics","branches","masters","qrs"].includes(resource)?[{value:"name",label:"Name A–Z"},{value:"-name",label:"Name Z–A"}]:[]),...(["doctors","patients","users"].includes(resource)?[{value:"fullName",label:"Name A–Z"},{value:"-fullName",label:"Name Z–A"}]:[])];
  return <><div className="toolbar"><SearchInput placeholder={searchPlaceholder} value={search} onChange={value=>{setSearch(value);setPage(1);}}/>{config.create&&allowCreate&&<button className="button small" onClick={()=>{save.reset();setDirty(false);setEditing(defaults);}} data-testid={`button-add-${resource}`}><Plus size={17}/> Add {resource==="branches"?"branch":resource==="availability"?"schedule":resource==="exceptions"?"exception":resource==="qrs"?"QR code":resource.replace(/s$/,"")}</button>}</div>
 <FilterBar onReset={reset} active={active}>
  {config.fields.some(f=>f.key==="status")&&<SearchableSelect label="Status" placeholder="All statuses" value={filters.status||""} onChange={value=>filter("status",value)} options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>}
 {resource==="clinics"&&identity?.user?.role==="superAdmin"&&<ResourceLookup resource="users" label="Clinic admin" params={{role:"clinicAdmin"}} value={filters.adminId||""} onChange={value=>filter("adminId",value)}/>}
 {resource==="doctors"&&<ResourceLookup resource="masters" label="Specialization" params={{category:"specialization"}} value={filters.specializationId||""} onChange={value=>filter("specializationId",value)}/>}
 {resource==="doctors"&&identity?.user?.role==="superAdmin"&&<ResourceLookup resource="users" label="Managing admin" params={{role:"clinicAdmin"}} value={filters.managingAdminId||""} onChange={value=>filter("managingAdminId",value)}/>}
 {["patients","audit"].includes(resource)&&<><label>From date<input type="date" value={filters.from||""} onChange={e=>filter("from",e.target.value)}/></label><label>To date<input type="date" min={filters.from||undefined} value={filters.to||""} onChange={e=>filter("to",e.target.value)}/></label></>}
 {["branches","doctors","patients","availability","qrs"].includes(resource)&&<ResourceLookup resource="clinics" label="Clinic" value={filters.clinicId||""} onChange={value=>filter("clinicId",value)}/>}
 {["doctors","patients","availability","exceptions","qrs"].includes(resource)&&<ResourceLookup resource="branches" label="Branch" params={{clinicId:filters.clinicId||undefined}} value={filters.branchId||""} onChange={value=>filter("branchId",value)}/>}
 {["availability","exceptions","qrs"].includes(resource)&&<ResourceLookup resource="doctors" label="Doctor" params={{clinicId:filters.clinicId||undefined,branchId:filters.branchId||undefined}} value={filters.doctorId||""} onChange={value=>filter("doctorId",value)}/>}
  {resource==="masters"&&<SearchableSelect label="Category" placeholder="All categories" value={filters.category||""} onChange={value=>filter("category",value)} options={Object.values(api.MasterInputCategory).map(category=>({value:category,label:title(category)}))}/>}
  {resource==="availability"&&<SearchableSelect label="Day" placeholder="All days" value={filters.dayOfWeek||""} onChange={value=>filter("dayOfWeek",value)} options={["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label,index)=>({value:String(index),label}))}/>}
 {resource==="exceptions"&&<label>Date<input type="date" value={filters.date||""} onChange={e=>filter("date",e.target.value)}/></label>}
  {resource==="audit"&&<SearchableSelect label="Event category" placeholder="All events" value={filters.activityType||""} onChange={value=>filter("activityType",value)} options={[{value:"operational",label:"Operational activity"},{value:"security",label:"Security audit"}]}/>}
  <SearchableSelect label="Sort" value={sort} onChange={value=>{setSort(value||"-createdAt");setPage(1);}} options={sortOptions}/>
 </FilterBar>
 {success&&<p className="notice" role="status">{success}</p>}
 {!allowCreate&&resource==="patients"&&<p className="notice">New patient registration is available to receptionists and administrators. Ask your clinic staff to register a new patient.</p>}<ErrorNotice error={remove.error}/>
  {resource==="users"&&identity?.user?.role!=="doctor"&&<section className="panel padded" style={{marginBottom:20}}><h3>Account recovery assistance</h3><p className="muted">Select a linked staff account to view the secure Clerk recovery steps. This action does not send an email.</p><div className="inline-form"><ResourceLookup resource="users" label="Staff account" params={{role:"receptionist",linkedOnly:true}} value={recoveryId} onChange={value=>{setRecoveryId(value);recovery.reset();}}/><button disabled={!recoveryId||recovery.isPending} onClick={()=>{if(!recovery.isPending)recovery.mutate({id:recoveryId});}} data-testid="button-password-reset">{recovery.isPending?"Loading…":"Get recovery steps"}</button></div><ErrorNotice error={recovery.error}/>{recovery.data&&<div className="notice" data-testid="status-password-recovery"><p>{recovery.data.message}</p><Link href="/forgot-password" className="text-link" data-testid="link-password-recovery">Open secure password recovery</Link></div>}</section>}
 <section className="panel table-panel">
  {query.isLoading?<div className="skeleton" role="status">Loading {config.name}…</div>:query.error?<><div className="error-box" role="alert">Unable to load {config.name}. {query.error instanceof Error?query.error.message:"Please try again."}</div><button onClick={()=>query.refetch()}>Retry {config.name}</button></>:query.data?.items?.length?<div className="table-scroll"><table>
 <thead><tr>{config.columns.map(c=><th key={c}>{title(c)}</th>)}{config.update&&<th>Actions</th>}</tr></thead>
 <tbody>{query.data.items.map((row:any)=><tr key={row.id} data-testid={`row-${resource}-${row.id}`}>
 {config.columns.map(c=><td key={c} data-label={title(c)}>{c==="status"?<span className={`badge ${row[c]}`}>{title(row[c]||"")}</span>:c==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][row[c]]:c==="createdAt"?(settings.data?.timezone?new Date(row[c]).toLocaleString(undefined,{timeZone:settings.data.timezone}):row[c]):typeof row[c]==="boolean"?(row[c]?"Yes":"No"):Array.isArray(row[c])?row[c].join(", ")||"—":row[c]??"—"}</td>)}
 {config.update&&<td data-label="Actions"><div className="row-actions"><button aria-label="Edit" onClick={()=>{save.reset();setDirty(false);setEditing(row);}}><Pencil size={15}/></button><button aria-label="Delete or deactivate" disabled={remove.isPending} onClick={()=>{if(!remove.isPending&&confirm("Delete or deactivate this record? Records with history are preserved."))remove.mutate(row.id);}}><Trash2 size={15}/></button></div></td>}
 </tr>)}</tbody></table></div>:active?<div className="empty"><h3>No matching {config.name}</h3><p>Try a different search or clear your filters.</p><button onClick={reset}>Clear filters</button></div>:<Empty label={config.name}/>}
 {!query.error&&<Pagination page={page} pageSize={pageSize} total={query.data?.total||0} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1);}}/>}</section>
 {resource==="users"&&identity?.user?.role==="superAdmin"&&allowCreate&&<ClinicAdminOnboarding />}
 {resource==="qrs"&&<div className="qr-grid">{query.data?.items?.filter((r:any)=>r.status==="active").map((r:any)=><QrCard row={r} key={r.id}/>)}</div>}
 {editing&&<AppDialog open onClose={()=>setEditing(null)} title={`${editing.id?"Edit":"Add"} ${title(config.name)}`} dirty={dirty} busy={save.isPending}>{resource==="availability"&&<p className="notice">One session and optional break per branch/day. Overnight sessions are not supported.</p>}<ErrorNotice error={save.error}/><Editor fields={effectiveFields} initial={editing} onSave={data=>{if(!save.isPending)save.mutate(data);}} busy={save.isPending} resourceName={resource} onDirtyChange={setDirty}/></AppDialog>}
 </>;
}
export const profileFields = [f("fullName","text",true),f("mobile","tel"),f("photoUrl","url")];
export const settingsFields = [f("platformName"),f("supportEmail","email"),f("supportPhone","tel"),f("timezone"),f("bookingHorizonDays","number"),f("cancellationCutoffMinutes","number"),f("requireMobileVerification","checkbox"),f("otpExpirySeconds","number"),f("otpMaxAttempts","number"),f("termsUrl","url"),f("privacyUrl","url")];