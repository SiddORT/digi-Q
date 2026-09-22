import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { Form } from "@/components/ui/form";
import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { Plus, Search, X, Pencil, Trash2, Download } from "lucide-react";

export const title = (s:string) => s.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase());
export const today = () => new Date().toLocaleDateString("en-CA");
export function ErrorNotice({error}:{error:unknown}) { return error ? <div className="error-box" role="alert" data-testid="status-error">{error instanceof Error ? error.message : String(error)}</div> : null; }
export function Empty({label="records"}:{label?:string}){return <div className="empty" data-testid="status-empty"><span className="empty-icon"><Plus size={24}/></span><h3>No {label} yet</h3><p>When {label} are added, you'll find them here.</p></div>;}
type Field = {key:string; label?:string; type?:string; required?:boolean; options?:string[]; resource?:string; category?:string};
const f=(key:string,type="text",required=false,options?:string[]):Field=>({key,type,required,options});
const relation=(key:string,resource:string,required=false):Field=>({key,resource,required});
const master=(key:string,category:string):Field=>({...relation(key,"masters"),category});
const location=(key:string,required=false):Field=>({key,required,type:"masterText",category:key});
const status=f("status","select",false,["active","inactive"]);
const locationFields=[f("address","text",true),location("city"),location("state"),location("pincode"),f("phone","tel")];
const person=[f("fullName","text",true),f("mobile","tel",true),f("email","email"),f("dateOfBirth","date"),f("gender","select",false,["female","male","other","preferNotToSay"])];
type Resource = {name:string; list:any;create?:any;update?:any;remove?:any;fields:Field[];columns:string[]};
export const resources:Record<string,Resource>={
 clinics:{name:"clinics",list:api.listClinics,create:api.createClinic,update:api.updateClinic,remove:api.deleteClinic,fields:[f("name","text",true),...locationFields,location("country"),location("area"),f("email","email"),f("description","textarea"),master("clinicTypeId","clinicType"),master("categoryId","clinicCategory"),status],columns:["name","code","city","phone","status"]},
 branches:{name:"branches",list:api.listBranches,create:api.createBranch,update:api.updateBranch,remove:api.deleteBranch,fields:[relation("clinicId","clinics",true),f("name","text",true),...locationFields,f("timezone"),status],columns:["name","clinicName","city","timezone","status"]},
 doctors:{name:"doctors",list:api.listDoctors,create:api.createDoctor,update:api.updateDoctor,remove:api.deleteDoctor,fields:[...person.map(field=>field.key==="email"?{...field,required:true}:field),f("photoUrl","url"),master("specializationId","specialization"),f("registrationNumber"),f("experienceYears","number"),f("consultationFee","number"),f("about","textarea"),relation("clinicIds","clinics"),relation("branchIds","branches"),master("qualificationIds","qualification"),{...f("languages","array"),label:"Languages (comma-separated)"},status],columns:["fullName","specializationName","email","mobile","status"]},
 patients:{name:"patients",list:api.listPatients,create:api.createPatient,update:api.updatePatient,remove:api.deletePatient,fields:[...person,f("age","number"),f("address"),f("emergencyContactName"),f("emergencyContactPhone","tel"),relation("clinicId","clinics"),relation("branchId","branches"),status],columns:["fullName","code","mobile","gender","mobileVerified"]},
 users:{name:"users",list:api.listUsers,create:api.createUser,update:api.updateUser,remove:api.deleteUser,fields:[f("fullName","text",true),f("email","email",true),f("mobile","tel"),f("role","select",true,["doctor","receptionist","clinicAdmin","patient"]),relation("clinicIds","clinics"),relation("branchIds","branches"),status],columns:["fullName","email","role","status"]},
 masters:{name:"master values",list:api.listMasters,create:api.createMaster,update:api.updateMaster,remove:api.deleteMaster,fields:[f("category","select",true,Object.values(api.MasterInputCategory)),f("name","text",true),f("code","text",true),relation("parentId","masters"),f("sortOrder","number"),status],columns:["name","category","code","status"]},
 availability:{name:"weekly schedules",list:api.listSchedules,create:api.createSchedule,update:api.updateSchedule,remove:api.deleteSchedule,fields:[relation("doctorId","doctors",true),relation("clinicId","clinics",true),relation("branchId","branches",true),f("dayOfWeek","select",true,["0","1","2","3","4","5","6"]),f("isOpen","checkbox"),f("startTime","time",true),f("endTime","time",true),f("breakStart","time"),f("breakEnd","time"),f("timezone"),f("tokenPrefix","text",true),f("maxTokens","number",true),f("consultationMinutes","number",true),f("bufferMinutes","number"),f("queueMode","select",false,["mixed","appointmentsOnly","walkInsOnly"]),f("queueOpenTime","time"),f("queueCloseTime","time")],columns:["doctorName","branchName","dayOfWeek","startTime","endTime","maxTokens"]},
 exceptions:{name:"date exceptions",list:api.listAvailabilityExceptions,create:api.createAvailabilityException,update:api.updateAvailabilityException,remove:api.deleteAvailabilityException,fields:[relation("doctorId","doctors",true),relation("branchId","branches",true),f("date","date",true),f("isClosed","checkbox"),f("reason","text",true),f("startTime","time"),f("endTime","time"),f("breakStart","time"),f("breakEnd","time"),f("maxTokens","number")],columns:["date","reason","isClosed","startTime","endTime"]},
 qrs:{name:"booking QR codes",list:api.listQrs,create:api.createQr,update:api.updateQr,remove:api.deleteQr,fields:[f("name","text",true),relation("clinicId","clinics",true),relation("branchId","branches"),relation("doctorId","doctors"),status],columns:["name","reference","status"]},
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
function RelationInput({field,register,defaultValue}:any){
 const q=useQuery({queryKey:["lookup",field.resource,field.category],queryFn:()=>allPages<any>(resources[field.resource].list,field.category?{category:field.category,status:"active"}:{})});
 const many=field.key.endsWith("Ids");
 return <><select {...register(field.key,{required:field.required})} multiple={many} defaultValue={defaultValue} data-testid={`input-${field.key}`}><option value="">{q.isLoading?"Loading all available records…":many?"Select one or more":"Select…"}</option>{(q.data?.items||[]).map((r:any)=><option key={r.id} value={r.id}>{r.name||r.fullName} {r.code?`· ${r.code}`:""}</option>)}</select><ErrorNotice error={q.error}/>{many&&<small>Hold Ctrl / ⌘ to select multiple.</small>}</>;
}
export function Editor({fields,initial={},onSave,busy=false,submitLabel="Save changes"}:{fields:Field[];initial?:any;onSave:(data:any)=>void;busy?:boolean;submitLabel?:string}){
 const form=useForm({defaultValues:initial});
 return <Form {...form}><form className="form-grid" onSubmit={form.handleSubmit(values=>{const body:any={}; fields.forEach(field=>{let value=values[field.key];if(value===""||value===undefined||value===null)return;if(field.type==="number"||field.key==="dayOfWeek")value=Number(value);if(field.type==="array")value=Array.isArray(value)?value:String(value).split(",").map(s=>s.trim()).filter(Boolean);body[field.key]=value;});onSave(body);})}>
 {fields.map(field=><label className={field.type==="textarea"?"wide":""} key={field.key}>{field.label||title(field.key.replace(/Ids?$/,""))}{field.required&&<span className="required"> *</span>}{field.resource?<RelationInput field={field} register={form.register} defaultValue={initial[field.key]}/>:field.type==="masterText"?<MasterTextInput field={field} register={form.register}/>:field.type==="select"?<select data-testid={`input-${field.key}`} {...form.register(field.key,{required:field.required})}><option value="">Select…</option>{field.options?.map(v=><option key={v} value={v}>{field.key==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(v)]:title(v)}</option>)}</select>:field.type==="textarea"?<textarea data-testid={`input-${field.key}`} {...form.register(field.key,{required:field.required})}/>:<input data-testid={`input-${field.key}`} type={field.type==="array"?"text":field.type} {...form.register(field.key,{required:field.required})}/>} {form.formState.errors[field.key]&&<small className="field-error">Please complete this field.</small>}</label>)}
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
export function ResourcePage({resource,defaults={}}:{resource:string;defaults?:any}){
 const config=resources[resource]; const [search,setSearch]=useState("");const [page,setPage]=useState(1);const [editing,setEditing]=useState<any>(null);
 const supportsSearch=!["availability","exceptions","qrs"].includes(resource);
 const [recoveryId,setRecoveryId]=useState("");
 const recovery=api.useRequestUserPasswordReset();
 const client=useQueryClient();
 const query=useQuery({queryKey:[resource,{search: supportsSearch?search:undefined,page}],queryFn:()=>config.list({...(supportsSearch?{search}:{}),page,pageSize:10})});
 const save=useMutation({mutationFn:(data:any)=>editing?.id?config.update(editing.id,data):config.create(data),onSuccess:()=>{setEditing(null);client.invalidateQueries();}});
 const remove=useMutation({mutationFn:(id:string)=>config.remove(id),onSuccess:()=>client.invalidateQueries()});
 return <><div className="toolbar">{supportsSearch?<div className="search"><Search size={17}/><input placeholder={`Search ${config.name}…`} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} data-testid={`search-${resource}`}/></div>:<span className="muted">{title(config.name)} · Page {page}</span>}{config.create&&<button className="button small" onClick={()=>{save.reset();setEditing(defaults);}} data-testid={`button-add-${resource}`}><Plus size={17}/> Add {resource==="availability"?"schedule":resource==="exceptions"?"exception":resource==="qrs"?"QR code":resource.replace(/s$/,"")}</button>}</div><ErrorNotice error={query.error||remove.error}/>
 {resource==="users"&&<section className="panel padded" style={{marginBottom:20}}><h3>Account recovery</h3><p className="muted">Select a user from the current results to request secure recovery instructions. This action does not itself send a recovery email.</p><div className="inline-form"><select aria-label="User for password recovery" value={recoveryId} onChange={e=>{setRecoveryId(e.target.value);recovery.reset();}} data-testid="select-recovery-user"><option value="">Select user from this page…</option>{query.data?.items.map((u:any)=><option key={u.id} value={u.id}>{u.fullName} · {u.email}</option>)}</select><button disabled={!recoveryId||recovery.isPending} onClick={()=>recovery.mutate({id:recoveryId})} data-testid="button-password-reset">{recovery.isPending?"Requesting…":"Request recovery instructions"}</button></div><ErrorNotice error={recovery.error}/>{recovery.data&&<div className="notice" data-testid="status-password-recovery"><p>{recovery.data.message}</p><Link href="/sign-in" className="text-link" data-testid="link-password-recovery">Open secure sign-in and select Forgot password</Link></div>}</section>}
 <section className="panel table-panel">{query.isLoading?<div className="skeleton">Loading {config.name}…</div>:query.data?.items?.length?<><div className="table-scroll"><table><thead><tr>{config.columns.map(c=><th key={c}>{title(c)}</th>)}{config.update&&<th>Actions</th>}</tr></thead><tbody>{query.data.items.map((row:any)=><tr key={row.id} data-testid={`row-${resource}-${row.id}`}>{config.columns.map(c=><td key={c}>{c==="status"?<span className={`badge ${row[c]}`}>{title(row[c]||"")}</span>:c==="dayOfWeek"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][row[c]]:typeof row[c]==="boolean"?(row[c]?"Yes":"No"):row[c]??"—"}</td>)}{config.update&&<td><div className="row-actions"><button aria-label="Edit" onClick={()=>{save.reset();setEditing(row);}}><Pencil size={15}/></button><button aria-label="Delete or deactivate" disabled={remove.isPending} onClick={()=>{if(confirm("Delete or deactivate this record? Records with history are preserved."))remove.mutate(row.id);}}><Trash2 size={15}/></button></div></td>}</tr>)}</tbody></table></div><div className="pagination"><span>{query.data.total} records</span><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button disabled={page*10>=query.data.total} onClick={()=>setPage(page+1)}>Next</button></div></>:<Empty label={config.name}/>}</section>
 {resource==="qrs"&&<div className="qr-grid">{query.data?.items?.filter((r:any)=>r.status==="active").map((r:any)=><QrCard row={r} key={r.id}/>)}</div>}
 {editing&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="panel-heading"><div><span className="eyebrow">{editing.id?"UPDATE RECORD":"NEW RECORD"}</span><h2>{title(config.name)}</h2></div><button onClick={()=>setEditing(null)} aria-label="Close"><X/></button></div>{resource==="availability"&&<p className="notice">One session and optional break per branch/day. Overnight sessions are not supported.</p>}<ErrorNotice error={save.error}/><Editor fields={config.fields} initial={editing} onSave={data=>save.mutate(data)} busy={save.isPending}/></section></div>}
 </>;
}
export const profileFields = [f("fullName","text",true),f("mobile","tel"),f("photoUrl","url")];
export const settingsFields = [f("platformName"),f("supportEmail","email"),f("supportPhone","tel"),f("timezone"),f("bookingHorizonDays","number"),f("cancellationCutoffMinutes","number"),f("requireMobileVerification","checkbox"),f("otpExpirySeconds","number"),f("otpMaxAttempts","number"),f("termsUrl","url"),f("privacyUrl","url")];