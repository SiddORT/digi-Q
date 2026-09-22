import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { Form } from "@/components/ui/form";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { Plus, Search, X, Pencil, Trash2, Download } from "lucide-react";
import { ClinicAdminOnboarding } from "./components/ClinicAdminOnboarding";

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
export async function allPages<T>(list:(params:any)=>Promise<{items:T[];total:number}>,params:Record<string,unknown>={}):Promise<{items:T[];total:number}>{
 const first=await list({...params,page:1,pageSize:100});
 const items=[...first.items];
 const pages=Math.ceil(first.total/100);
 for(let page=2;page<=pages;page+=4){
  const batch=await Promise.all(Array.from({length:Math.min(4,pages-page+1)},(_,i)=>list({...params,page:page+i,pageSize:100})));
  batch.forEach(result=>items.push(...result.items));
 }
 return {items,total:first.total};
}
function MasterTextInput({field,register}:any){
 const q=useQuery({queryKey:["lookup","masters",field.category],queryFn:()=>allPages(api.listMasters,{category:field.category,status:"active"})});
 return <><input list={`master-options-${field.key}`} {...register(field.key,{required:field.required})} data-testid={`input-${field.key}`}/><datalist id={`master-options-${field.key}`}>{q.data?.items.map(row=><option key={row.id} value={row.name}/>)}</datalist>{q.isLoading&&<small>Loading location suggestions…</small>}<ErrorNotice error={q.error}/></>;
}
import { SearchableMultiSelect } from "./components/SearchableMultiSelect";

function RelationInput({field,register,defaultValue,form,fields,resourceName}:any){
  const me = api.useGetMe({query:{queryKey:api.getGetMeQueryKey(), staleTime: 60000}});
  const isDoctorBranchClinic = me.data?.user?.role === "doctor" && resourceName === "branches" && field.resource === "clinics";

  const optionsParams = { targetRole: "receptionist" as const };
  const assignmentOptions = api.useGetStaffAssignmentOptions(optionsParams, {
    query: {
      queryKey: api.getGetStaffAssignmentOptionsQueryKey(optionsParams),
      staleTime: 60000,
      enabled: !!(isDoctorBranchClinic && me.data?.doctorId)
    }
  });

  const values=form.watch();
  const clinicIds=values.clinicIds || (values.clinicId?[values.clinicId]:[]);
  const hasClinic=fields.some((f:Field)=>["clinicId","clinicIds"].includes(f.key));
  const params=field.category?{category:field.category}:
    field.resource==="doctors"?{clinicId:values.clinicId||undefined,branchId:hasClinic?values.branchId||undefined:undefined}:
    field.resource==="branches"&&values.clinicId?{clinicId:values.clinicId}:{};
  const q=useQuery({queryKey:["lookup",field.resource,params],queryFn:()=>allPages<any>(resources[field.resource].list,params)});
  const assignedDoctor=useQuery({queryKey:["lookup-doctor-branches",values.doctorId],queryFn:()=>api.getDoctor(values.doctorId),enabled:field.resource==="branches"&&!hasClinic&&!!values.doctorId});
 const many=field.key.endsWith("Ids");

  const baseItems = isDoctorBranchClinic && assignmentOptions.data ? assignmentOptions.data.clinics : (q.data?.items||[]);
  const rows=baseItems.filter((r:any)=>{
    const isSelected = many ? (defaultValue?.includes(r.id) || form.watch(field.key)?.includes(r.id)) : (defaultValue === r.id || form.watch(field.key) === r.id);
    if (r.status === "inactive" && !isSelected) return false;
    if(field.resource==="branches"){
      if(hasClinic&&!clinicIds.includes(r.clinicId))return false;
      if(!hasClinic&&fields.some((f:Field)=>f.key==="doctorId")&&!assignedDoctor.data?.branchIds?.includes(r.id))return false;
    }
    if(field.resource==="doctors"){
      if(hasClinic&&!values.clinicId)return false;
      if(values.clinicId&&!r.clinicIds?.includes(values.clinicId))return false;
      if(hasClinic&&values.branchId&&!r.branchIds?.includes(values.branchId))return false;
    }
    return true;
  });
  const rowIds=rows.map((r:any)=>r.id).join(",");
  useEffect(()=>{
    if(!q.data||q.isFetching||q.error||assignedDoctor.isFetching)return;
    const value=form.getValues(field.key);
    if(many&&Array.isArray(value)){
      const valid=value.filter((id: string)=>rows.some((r:any)=>r.id===id) || (defaultValue && defaultValue.includes(id)));
      if(valid.length!==value.length)form.setValue(field.key,valid);
    }else if(value&&!rows.some((r:any)=>r.id===value))form.setValue(field.key,"");
  },[rowIds,q.data,q.isFetching,q.error,assignedDoctor.isFetching]);

  useEffect(() => {
    if (many) form.register(field.key, { validate: (v: any) => !field.required || (Array.isArray(v) && v.length > 0) || "Required" });
  }, [field.key, field.required, form, many]);

  if (many) {
    const value = form.watch(field.key) || [];
    const options = q.data?.items?.map((r: any) => {
      const isAvailable = rows.some((row: any) => row.id === r.id);
      return { value: r.id, label: r.name || r.fullName, hidden: !isAvailable };
    }) || [];

    return <>
      <SearchableMultiSelect
        options={options}
        value={value}
        onChange={(v) => form.setValue(field.key, v, { shouldValidate: true, shouldDirty: true })}
        isLoading={q.isLoading}
      />
      <ErrorNotice error={q.error}/>
    </>;
  }

  return <><select {...register(field.key,{required:field.required})} defaultValue={defaultValue} data-testid={`input-${field.key}`}><option value="">{q.isLoading?"Loading all available records…":"Select…"}</option>{rows.map((r:any)=><option key={r.id} value={r.id}>{r.name||r.fullName} {r.code?`· ${r.code}`:""}</option>)}</select><ErrorNotice error={q.error}/></>;
}
export function Editor({fields,initial={},onSave,busy=false,submitLabel="Save changes",resourceName}:{fields:Field[];initial?:any;onSave:(data:any)=>void;busy?:boolean;submitLabel?:string;resourceName?:string}){
 const form=useForm({defaultValues:initial});
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

   return <Form {...form}><form className="form-grid" onSubmit={form.handleSubmit(values=>{const body:any={}; activeFields.forEach(field=>{
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
  {activeFields.map(field=><label className={field.type==="textarea"?"wide":""} key={field.key}>{field.label||title(field.key.replace(/Ids?$/,""))}{field.required&&<span className="required"> *</span>}{field.resource?<RelationInput field={field} register={form.register} defaultValue={initial[field.key]} form={form} fields={fields} resourceName={resourceName}/>:field.type==="masterText"?<MasterTextInput field={field} register={form.register}/>:field.type==="select"?<select data-testid={`input-${field.key}`} {...form.register(field.key,{required:field.required})}><option value="">Select…</option>{field.options?.map(v=><option key={v} value={v}>{field.key==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(v)]:title(v)}</option>)}</select>:field.type==="textarea"?<textarea data-testid={`input-${field.key}`} {...form.register(field.key,{required:field.required})}/>:<input data-testid={`input-${field.key}`} type={field.type==="array"?"text":field.type} {...form.register(field.key,{required:field.required})}/>} {form.formState.errors[field.key]&&<small className="field-error">Please complete this field.</small>}</label>)}
 <div className="wide form-footer"><button className="button" disabled={busy} data-testid="button-save">{busy?"Saving…":submitLabel}</button></div></form></Form>;
}
function QrCard({row}:{row:any}){
 const [image,setImage]=useState("");
 const [error,setError]=useState<unknown>();
 const client=useQueryClient();
 const url=`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,"")}/book/${row.reference}`;
 useEffect(()=>{QRCode.toDataURL(url,{width:400,margin:2}).then(setImage).catch(setError);},[url]);
 const regenerate=useMutation({mutationFn:()=>api.regenerateQr(row.id),onSuccess:()=>client.invalidateQueries()});
 return <div className="qr-card">{image&&<img src={image} alt={`Booking QR code for ${row.name}`}/>}<strong>{row.name}</strong><a href={url} target="_blank" rel="noreferrer">{url}</a><a className="button secondary small" href={image} download={`${row.name}-qr.png`}><Download size={15}/> Download PNG</a><button disabled={regenerate.isPending} onClick={()=>{if(confirm("Regenerate this QR code? Printed copies will stop working."))regenerate.mutate();}}>Regenerate reference</button><ErrorNotice error={error||regenerate.error}/></div>;
}
export function ResourcePage({resource,identity,defaults={},allowCreate=true}:{resource:string;identity?:api.Identity;defaults?:any;allowCreate?:boolean}){
 const config=resources[resource]; const [search,setSearch]=useState("");const [page,setPage]=useState(1);const [editing,setEditing]=useState<any>(null);
 const supportsSearch=!["availability","exceptions","qrs"].includes(resource);
 const [recoveryId,setRecoveryId]=useState("");
 const recovery=api.useRequestUserPasswordReset();
 const client=useQueryClient();
 const query=useQuery({queryKey:[resource,{search: supportsSearch?search:undefined,page}],queryFn:()=>config.list({...(supportsSearch?{search}:{}),page,pageSize:10})});
 const save=useMutation({mutationFn:(data:any)=>editing?.id?config.update(editing.id,data):config.create(data),onSuccess:()=>{setEditing(null);client.invalidateQueries();}});
 const remove=useMutation({mutationFn:(id:string)=>config.remove(id),onSuccess:()=>client.invalidateQueries()});

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

 return <><div className="toolbar">{supportsSearch?<div className="search"><Search size={17}/><input placeholder={`Search ${config.name}…`} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} data-testid={`search-${resource}`}/></div>:<span className="muted">{title(config.name)} · Page {page}</span>}{config.create&&allowCreate&&<button className="button small" onClick={()=>{save.reset();setEditing(defaults);}} data-testid={`button-add-${resource}`}><Plus size={17}/> Add {resource==="availability"?"schedule":resource==="exceptions"?"exception":resource==="qrs"?"QR code":resource.replace(/s$/,"")}</button>}</div>{!allowCreate&&resource==="patients"&&<p className="notice">New patient registration is available to receptionists and administrators. Ask your clinic staff to register a new patient.</p>}<ErrorNotice error={query.error||remove.error}/>
 {resource==="users"&&identity?.user?.role!=="doctor"&&<section className="panel padded" style={{marginBottom:20}}><h3>Account recovery</h3><p className="muted">Select a user from the current results to request secure recovery instructions. This action does not itself send a recovery email.</p><div className="inline-form"><select aria-label="User for password recovery" value={recoveryId} onChange={e=>{setRecoveryId(e.target.value);recovery.reset();}} data-testid="select-recovery-user"><option value="">Select user from this page…</option>{query.data?.items.map((u:any)=><option key={u.id} value={u.id}>{u.fullName} · {u.email}</option>)}</select><button disabled={!recoveryId||recovery.isPending} onClick={()=>recovery.mutate({id:recoveryId})} data-testid="button-password-reset">{recovery.isPending?"Requesting…":"Request recovery instructions"}</button></div><ErrorNotice error={recovery.error}/>{recovery.data&&<div className="notice" data-testid="status-password-recovery"><p>{recovery.data.message}</p><Link href="/sign-in" className="text-link" data-testid="link-password-recovery">Open secure sign-in and select Forgot password</Link></div>}</section>}
 <section className="panel table-panel">{query.isLoading?<div className="skeleton">Loading {config.name}…</div>:query.data?.items?.length?<><div className="table-scroll"><table><thead><tr>{config.columns.map(c=><th key={c}>{title(c)}</th>)}{config.update&&<th>Actions</th>}</tr></thead><tbody>{query.data.items.map((row:any)=><tr key={row.id} data-testid={`row-${resource}-${row.id}`}>{config.columns.map(c=><td key={c} style={c === "clinicNames" || c === "branchNames" ? { maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : undefined} title={c === "clinicNames" || c === "branchNames" ? (Array.isArray(row[c]) ? row[c].join(", ") : row[c]) : undefined}>{c==="status"?<span className={`badge ${row[c]}`}>{title(row[c]||"")}</span>:c==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][row[c]]:typeof row[c]==="boolean"?(row[c]?"Yes":"No"):(c === "clinicNames" || c === "branchNames") ? (Array.isArray(row[c]) ? row[c].join(", ") : row[c] || "—") : row[c]??"—"}</td>)}{config.update&&<td><div className="row-actions"><button aria-label="Edit" onClick={()=>{save.reset();setEditing(row);}}><Pencil size={15}/></button><button aria-label="Delete or deactivate" disabled={remove.isPending} onClick={()=>{if(confirm("Delete or deactivate this record? Records with history are preserved."))remove.mutate(row.id);}}><Trash2 size={15}/></button></div></td>}</tr>)}</tbody></table></div><div className="pagination"><span>{query.data.total} records</span><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button disabled={page*10>=query.data.total} onClick={()=>setPage(page+1)}>Next</button></div></>:<Empty label={config.name}/>}</section>
 {resource==="users"&&identity?.user?.role==="superAdmin"&&allowCreate&&<ClinicAdminOnboarding />}
 {resource==="qrs"&&<div className="qr-grid">{query.data?.items?.filter((r:any)=>r.status==="active").map((r:any)=><QrCard row={r} key={r.id}/>)}</div>}
 {editing&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="panel-heading"><div><span className="eyebrow">{editing.id?"UPDATE RECORD":"NEW RECORD"}</span><h2>{title(config.name)}</h2></div><button onClick={()=>setEditing(null)} aria-label="Close"><X/></button></div>{resource==="availability"&&<p className="notice">One session and optional break per branch/day. Overnight sessions are not supported.</p>}<ErrorNotice error={save.error}/><Editor fields={effectiveFields} initial={editing} onSave={data=>save.mutate(data)} busy={save.isPending} resourceName={resource}/></section></div>}
 </>;
}
export const profileFields = [f("fullName","text",true),f("mobile","tel"),f("photoUrl","url")];
export const settingsFields = [f("platformName"),f("supportEmail","email"),f("supportPhone","tel"),f("timezone"),f("bookingHorizonDays","number"),f("cancellationCutoffMinutes","number"),f("requireMobileVerification","checkbox"),f("otpExpirySeconds","number"),f("otpMaxAttempts","number"),f("termsUrl","url"),f("privacyUrl","url")];