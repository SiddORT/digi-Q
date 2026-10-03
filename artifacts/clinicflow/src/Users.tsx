import { EmailInput } from "@/components/EmailInput";
import { useEffect, useRef, useState } from "react";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Send, KeyRound, ArrowDown, ArrowUp, ArrowDownUp } from "lucide-react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { assignmentTargetRole, type StaffTab } from "./staff-input";
import { clinicScopedStaffInput, resendStaffInvitations, staffInvitationRestriction } from "./staff-controls";
import { ErrorNotice, Empty, title } from "./resources";
import { Form } from "@/components/ui/form";
import { ResourceLookup, ResourceMultiLookup } from "./components/ResourceLookup";
import { Pagination, SearchInput, FilterBar, useDebouncedValue, listingSuggestions } from "./components/ListingControls";
import { AppDialog } from "./components/AppDialog";
import { ClinicAdminOnboarding } from "./components/ClinicAdminOnboarding";
import { SearchableSelect } from "./components/SearchableSelect";
import { ListingBulk, useListingSelection, CreatedCell, ResultSummary } from "./components/AdminListing";
import { HelpTip } from "./components/HelpTip";
import { FormField } from "./components/FormField";
import { useConfirm } from "./components/ConfirmDialog";
import { friendlyError } from "./lib/friendly-error";
import { required, validatePersonName, validateEmail, validatePhone, normalizePhone } from "./lib/validators";
import { notifySuccess, notifyWarning, notifyError, notifyBulk } from "./lib/notify";
import type { BulkOutcome } from "./lib/bulk-summary";
import { PhoneInput } from "./components/PhoneInput";
import { StatusSwitch } from "./components/StatusSwitch";

type StaffContext = {search:string;status:""|"active"|"inactive";clinicId:string;branchId:string;managingAdminId:string;specializationId:string;page:number;pageSize:number;sort:string};
const defaultContext = ():StaffContext=>({search:"",status:"",clinicId:"",branchId:"",managingAdminId:"",specializationId:"",page:1,pageSize:20,sort:"-createdAt"});
const staffTypes: { id:StaffTab; label:string }[] = [{id:"admins",label:"Clinic Admins"},{id:"doctors",label:"Doctors"},{id:"receptionists",label:"Receptionists"}];
const sortName = (sort:string) => sort === "fullName" ? "Name A–Z" : sort === "-fullName" ? "Name Z–A" : sort === "createdAt" ? "Oldest first" : "Newest first";

export function Users({ identity, clinicId, embedded=false }: { identity: api.Identity; clinicId?:string; embedded?:boolean }) {
  const confirmAction = useConfirm();
  const settings=api.useGetSettings({query:{queryKey:api.getGetSettingsQueryKey(),staleTime:60000}});
  const role = identity.user!.role;
  const isSuperAdmin = role === "superAdmin";
   const tabs: { id: StaffTab; label: string }[] = [
    ...(isSuperAdmin ? [{ id: "admins" as const, label: "Clinic Admins" }] : []),
    ...(["superAdmin", "clinicAdmin"].includes(role) ? [{ id: "doctors" as const, label: "Doctors" }] : []),
    { id: "receptionists", label: "Receptionists" },
  ];
  const [tab, setTab] = useState<StaffTab>(tabs.find(t => t.id === new URLSearchParams(window.location.search).get("tab"))?.id || tabs[0].id);
   const [contexts, setContexts] = useState<Partial<Record<StaffTab,StaffContext>>>({});
   const context:StaffContext = contexts[tab] || defaultContext();
   const change = (patch: Partial<StaffContext>) => setContexts(previous => ({ ...previous, [tab]: { ...defaultContext(), ...previous[tab], page: 1, ...patch } }));
   const [draftTab, setDraftTab] = useState(tab);
   const [draft, setDraft] = useState<StaffContext>(context);
   const draftChange = (patch:Partial<StaffContext>) => setDraft(previous=>({...previous,...patch}));
  const term = useDebouncedValue(context.search);
  const [editing, setEditing] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(()=>{setContexts({});setEditing(null);},[clinicId]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
     window.history.replaceState(window.history.state, "", url);
    setRecoveryId("");
    recovery.reset();
  }, [tab]);
   const params = { ...context, search: term || undefined, status: context.status || undefined, clinicId: clinicId || context.clinicId || undefined, branchId: context.branchId || undefined, specializationId:context.specializationId||undefined, managingAdminId: isSuperAdmin ? context.managingAdminId || undefined : undefined };
   const fetchStaff = (staffTab:StaffTab, options: typeof params) => staffTab==="doctors" ? api.listDoctors(options) : api.listUsers({...options,role:staffTab==="admins"?"clinicAdmin":"receptionist"});
  const query = useQuery<any>({
    queryKey: ["users-tab", identity.user?.id, role, tab, params],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    placeholderData: (previous:any) => previous,
     queryFn: () => fetchStaff(tab,params),
  });
   const countParams={...params,page:1,pageSize:1,status:undefined};
   const counts=useQueries({queries:(["","active","inactive"] as const).map(status=>({
     queryKey:["staff-status-count",identity.user?.id,tab,countParams,status],
     queryFn:()=>fetchStaff(tab,{...countParams,status:status||undefined}),
     staleTime:15000,refetchInterval:30000,
   }))});
  const selectionContext=JSON.stringify([tab,context,term,identity.user,role]);
  const selection=useListingSelection(selectionContext,query.error?[]:query.data?.items||[]);
  useEffect(() => {
    if (query.data && context.page > Math.max(1, Math.ceil(query.data.total / context.pageSize))) change({ page: Math.max(1, Math.ceil(query.data.total / context.pageSize)) });
  }, [query.data, context.page, context.pageSize]);
  const client = useQueryClient();
   const [recoveryId, setRecoveryId] = useState("");
   const [recoveryOpen, setRecoveryOpen] = useState(false);
   const [setupOpen, setSetupOpen] = useState(false);
   const [setupDirty, setSetupDirty] = useState(false);
   const [setupBusy, setSetupBusy] = useState(false);
   const [statusTarget,setStatusTarget]=useState<{id:string;userId?:string;name:string;status:"active"|"inactive"}|null>(null);
   const [statusError,setStatusError]=useState("");
   const statusUpdate=useMutation({
     mutationFn:async({row,status,staffTab}:{row:any;status:"active"|"inactive";staffTab:StaffTab})=>{
       // Update against a fresh record: the list may be stale, and status-only edits
       // must not overwrite another administrator's name, email or mobile change.
       if(staffTab==="doctors"){
         const current=await api.getDoctor(row.id);
         return await api.updateDoctor(row.id,{fullName:current.fullName,email:current.email,mobile:current.mobile||undefined,status});
       }
       const current=await api.getUser(row.id);
       return await api.updateUser(row.id,{fullName:current.fullName,email:current.email,mobile:current.mobile||undefined,role:current.role,status});
     },
     onSuccess:async()=>{setStatusTarget(null);setStatusError("");notifySuccess("Staff account status updated.");await client.invalidateQueries();},
     onMutate:async({row,status})=>{await client.cancelQueries({queryKey:["users-tab"]});const previous=client.getQueriesData({queryKey:["users-tab"]});client.setQueriesData({queryKey:["users-tab"]},(data:any)=>data?{...data,items:data.items.map((item:any)=>item.id===row.id?{...item,status}:item)}:data);return {previous};},
     onError:(error,_variables,context)=>{context?.previous.forEach(([key,value])=>client.setQueryData(key,value));setStatusError(friendlyError(error,"save"));},
     onSettled:()=>{void client.invalidateQueries({queryKey:["users-tab"]});},
   });
  const recovery = api.useRequestUserPasswordReset();
  const [invitationFeedback,setInvitationFeedback]=useState<{rowId:string;message:string}|null>(null);
  const [bulkInvitationResults,setBulkInvitationResults]=useState<BulkOutcome[]>([]);
  useEffect(()=>{setInvitationFeedback(null);setBulkInvitationResults([]);},[selectionContext]);
  const resendInvitation=useMutation({
    mutationFn:({row,staffTab}:{row:any;staffTab:StaffTab})=>api.resendUserInvitation(staffTab==="doctors"?row.userId:row.id),
    onMutate:()=>setInvitationFeedback(null),
    onSuccess:(result,variables)=>{
      const sent=result.invitationStatus==="sent";
      const message=sent?"Set-password invitation sent.":"Invitation was not sent. Reload the account and retry if setup is still required.";
      setInvitationFeedback({rowId:variables.row.id,message});
      if(sent)notifySuccess(message);else notifyWarning(message);
    },
    onError:(error,variables)=>{setInvitationFeedback({rowId:variables.row.id,message:friendlyError(error,"save")});notifyError(error,"save","Invitation not sent");},
    onSettled:()=>{void client.invalidateQueries();},
  });
  const bulkInvitations=useMutation({
    mutationFn:({rows,staffTab}:{rows:any[];staffTab:StaffTab})=>resendStaffInvitations(rows,staffTab,api.resendUserInvitation,error=>friendlyError(error,"save")),
    onSuccess:async outcomes=>{setBulkInvitationResults(outcomes);notifyBulk(outcomes,"sent an invitation");selection.clear();await client.invalidateQueries();},
  });
  const invitationBusy=resendInvitation.isPending||bulkInvitations.isPending;
   const active = !!(context.sort !== "-createdAt" || context.search || context.status || (!clinicId&&context.clinicId) || context.branchId || context.managingAdminId || context.specializationId);
   const reset = () => {change({ search: "", status: "", clinicId: "", branchId: "", managingAdminId: "", specializationId:"", sort: "-createdAt" });setDraft(defaultContext());};
   const beginEdit = (row: any) => { setDirty(false); setBusy(false); setEditing(row.id?row:{...row,...(clinicId&&tab!=="admins"?{clinicIds:[clinicId]}:{})}); };
   const toggleSort=(key:"fullName"|"createdAt")=>change({sort:context.sort===key?`-${key}`:key});
   const sortable=(key:"fullName"|"createdAt",label:string)=><button type="button" className="sort-button" onClick={()=>toggleSort(key)} aria-label={`Sort ${label} ${context.sort===key?"descending":"ascending"}`}>{label}{context.sort===key?<ArrowUp aria-hidden size={14}/>:context.sort===`-${key}`?<ArrowDown aria-hidden size={14}/>:<ArrowDownUp aria-hidden size={14}/>}</button>;
   const openFilters=()=>{setDraftTab(tab);setDraft({...context});};
   const applyFilters=()=>{setContexts(previous=>({...previous,[draftTab]:{...defaultContext(),...previous[draftTab],...draft,page:1,clinicId:clinicId||draft.clinicId}}));setTab(draftTab);};
   return <>{confirmAction.dialog}
     {counts.some(item=>item.error)&&<div role="alert" className="error-box">Unable to load staff status counts. <button type="button" onClick={()=>counts.forEach(item=>{if(item.error)void item.refetch();})}>Retry counts</button></div>}
     <FilterBar title={query.data&&!query.error?<span className="listing-count-label"><span className="listing-count">{query.data.total}</span> {(tabs.find(item=>item.id===tab)?.label||"").toLowerCase()}</span>:undefined} status={<div className="status-tabs" role="group" aria-label="Account status">
       {(["","active","inactive"] as const).map((status,index)=><button type="button" key={status||"all"} className={`tab ${context.status===status?"active":""}`} aria-pressed={context.status===status} onClick={()=>change({status})} data-testid={`tab-staff-${status||"all"}`}>{status?title(status):"All"}{counts[index].data?<span className="count">{counts[index].data.total}</span>:null}</button>)}
     </div>} actions={<>{role !== "doctor" && <button type="button" className="button secondary small" aria-haspopup="dialog" onClick={() => setRecoveryOpen(true)} data-testid="button-open-account-recovery"><KeyRound size={15} aria-hidden /> Recovery</button>}{tab==="admins" ? embedded?<Link className="button small" href="/admin/users?tab=admins">Set up a Clinic Admin</Link>:isSuperAdmin?<button type="button" className="button small" aria-haspopup="dialog" onClick={() => setSetupOpen(true)} data-testid="button-setup-clinic-admin"><Plus size={17} /> Set up Clinic Admin</button>:null : <button className="button small" onClick={() => beginEdit({})} data-testid={`button-add-${tab}`}><Plus size={17} /> Add {tabs.find(t => t.id === tab)?.label.replace(/s$/, "")}</button>}</>} active={active} onReset={reset} onOpen={openFilters} onApply={applyFilters} label="Filter staff" chips={[
      ...(context.search?[{key:"search",label:`Search: ${context.search}`,onRemove:()=>change({search:""})}]:[]),
       ...(!clinicId&&context.clinicId?[{key:"clinicId",label:"Clinic selected",onRemove:()=>change({clinicId:"",branchId:""})}]:[]),
      ...(context.branchId?[{key:"branchId",label:"Clinic selected",onRemove:()=>change({branchId:""})}]:[]),
      ...(context.specializationId?[{key:"adv:specializationId",label:"Specialization selected",onRemove:()=>change({specializationId:""})}]:[]),
      ...(context.managingAdminId?[{key:"adv:managingAdminId",label:"Managing admin selected",onRemove:()=>change({managingAdminId:""})}]:[]),
       ...(context.sort!=="-createdAt"?[{key:"sort",label:`Sorted: ${sortName(context.sort)}`,onRemove:()=>change({sort:"-createdAt"})}]:[]),
    ]} advanced={<>
       <SearchableSelect label="Staff type" value={draftTab} onChange={value=>{const next=tabs.find(item=>item.id===value)?.id||tab;setDraftTab(next);setDraft({...defaultContext(),...contexts[next]});}} options={tabs.map(item=>({value:item.id,label:item.label}))}/>
       {draftTab==="doctors"&&<ResourceLookup resource="masters" label="Specialization" params={{category:"specialization"}} value={draft.specializationId} onChange={specializationId=>draftChange({specializationId})}/>}
       {isSuperAdmin && draftTab !== "admins" && <ResourceLookup resource="users" label="Managing admin" params={{role:"clinicAdmin"}} value={draft.managingAdminId} onChange={managingAdminId => draftChange({ managingAdminId })} />}
       {!clinicId&&draftTab !== "admins"&&<ResourceLookup resource="assignment:clinics" label="Clinic" params={{targetRole:assignmentTargetRole(draftTab)}} value={draft.clinicId} onChange={value=>draftChange({clinicId:value,branchId:""})}/>}
       {draftTab === "receptionists" && <ResourceLookup resource="assignment:branches" label="Clinic" params={{targetRole:assignmentTargetRole(draftTab),clinicId:clinicId||draft.clinicId||undefined}} value={draft.branchId} onChange={branchId=>draftChange({branchId})}/>}
    </>}>
      <SearchInput value={context.search} onChange={search => change({ search })} placeholder={tab==="doctors"?"Search doctors by name, email or specialization…":tab==="receptionists"?"Search receptionists by name, email or mobile…":"Search Clinic Admins by name, email or mobile…"} suggestions={query.error||query.isPlaceholderData?[]:listingSuggestions(query.data?.items,(row:any)=>({id:row.id,label:row.fullName,description:row.email,value:row.fullName}))} loading={query.isFetching} error={query.error?friendlyError(query.error,"load"):null} onRetry={()=>void query.refetch()} total={query.data?.total} settledQuery={term} scopeKey={JSON.stringify([tab,{...params,search:undefined,page:undefined}])} />
    </FilterBar>
    {success && <p role="status" className="notice">{success}</p>}
     {statusError&&<div role="alert" className="error-box">{statusError} <button type="button" onClick={()=>setStatusError("")}>Dismiss</button></div>}
    <ErrorNotice error={settings.error} />
    <ListingBulk selection={selection} resource={tab==="doctors"?"doctors":"users"} columns={["fullName","email","mobile","role","clinicNames","branchNames","status"]} identity={identity} context={selectionContext}/>
    {!!selection.selected.length&&<div className="admin-bulk-bar"><HelpTip text="Replace pending invitations and send new set-password links. This does not deactivate staff or sign them out. Ineligible records are skipped with an explanation."><button type="button" disabled={invitationBusy||selection.selected.every(row=>!!staffInvitationRestriction(row,tab))} onClick={async()=>{
      const rows=[...selection.selected],staffTab=tab;
      if(!invitationBusy&&await confirmAction.ask({title:`Resend invitations for ${rows.length} selected staff?`,description:"Replace pending set-password invitations and request new emails. This does not deactivate accounts or revoke sessions. Inactive accounts and staff with passwords are skipped. Each eligible account is checked by the server; failures do not undo successful sends.",confirmLabel:"Resend selected invitations"}))bulkInvitations.mutate({rows,staffTab});
    }}>{bulkInvitations.isPending?"Sending invitations…":"Resend selected invitations"}</button></HelpTip></div>}
    {!!bulkInvitationResults.length&&<ResultSummary title="Invitations" testId="details-invitation-results" items={bulkInvitationResults.map(result=>({label:result.label,ok:result.ok,message:result.ok?"invitation sent":result.message}))} onDismiss={()=>setBulkInvitationResults([])}/>}
    <section className="panel table-panel admin-listing-table">
      {query.isLoading ? <div className="skeleton" role="status">Loading {tabs.find(item=>item.id===tab)?.label.toLowerCase()}…</div> : query.error ? <><div className="error-box" role="alert">{friendlyError(query.error,"load")}</div><button onClick={() => query.refetch()}>Retry {tabs.find(item=>item.id===tab)?.label.toLowerCase()}</button></> : query.data?.items.length ? <div className="table-scroll" inert={query.isPlaceholderData}><table aria-busy={query.isFetching}>
         <thead><tr><th scope="col" className="col-select">{selection.header}</th><th aria-sort={context.sort==="fullName"?"ascending":context.sort==="-fullName"?"descending":undefined}>{sortable("fullName","Staff member")}</th>{isSuperAdmin && tab !== "admins" && <th>Managing admin</th>}<th>{tab === "admins" ? "Owned clinics" : "Assignments"}</th><th className="col-status">Account status</th><th className="col-created" aria-sort={context.sort==="createdAt"?"ascending":context.sort==="-createdAt"?"descending":undefined}>{sortable("createdAt","Created")}</th><th className="col-actions">Actions</th></tr></thead>
        <tbody>{query.data.items.map((row: any) => <tr key={row.id}>
          <td data-label="Select" className="col-select">{selection.checkbox(row)}</td>
          <td data-label="Staff member" className="admin-record"><strong>{row.fullName}</strong><small>{row.email} · {tab==="admins"?"Clinic admin":tab==="doctors"?"Doctor":"Receptionist"}{row.mobile?` · ${row.mobile}`:""}</small></td>
          {isSuperAdmin && tab !== "admins" && <td data-label="Managing admin">{row.managingAdminName || row.ownerAdminName || "—"}</td>}
          <td data-label={tab === "admins" ? "Owned Clinic Groups" : "Assignments"}><div>{Array.isArray(row.clinicNames) ? row.clinicNames.join(", ") || "—" : row.clinicNames || "—"}</div>{tab !== "admins" && <div className="muted">Clinics: {Array.isArray(row.branchNames) ? row.branchNames.join(", ") || "—" : row.branchNames || "—"}</div>}</td>
           <td data-label="Account status" className="col-status"><StatusSwitch label={`Account active for ${row.fullName}`} active={row.status==="active"} busy={statusUpdate.isPending&&statusTarget?.id===row.id} title={row.id===identity.user?.id||row.userId===identity.user?.id?"You cannot deactivate your own account.":tab==="admins"&&row.status==="active"&&row.clinicIds?.length?"Transfer clinic ownership before deactivation.":undefined} disabled={statusUpdate.isPending||row.id===identity.user?.id||row.userId===identity.user?.id||(tab==="admins"&&row.status==="active"&&!!row.clinicIds?.length)} onChange={async checked=>{const next=checked?"active":"inactive";if(next==="inactive"&&!await confirmAction.ask({title:`Deactivate ${row.fullName}?`,description:"They will lose access. Clinic ownership restrictions may prevent this change. Historical records are preserved.",confirmLabel:"Deactivate",tone:"danger"}))return;setStatusError("");setStatusTarget({id:row.id,userId:row.userId,name:row.fullName,status:next});statusUpdate.mutate({row,status:next,staffTab:tab});}}/><small className="status-sub">{row.passwordEnabled === true ? "Password set" : row.invitationStatus === "sent" ? "Pending setup" : row.invitationStatus === "failed" ? "Invitation not sent" : "Needs password setup"}</small></td>
          <td data-label="Created" className="col-created"><CreatedCell value={row.createdAt} timezone={settings.data?.timezone} preferences={row}/></td>
          <td data-label="Actions" className="col-actions"><div className="row-actions">
            {row.invitationStatus !== "notRequired" && <HelpTip text={staffInvitationRestriction(row,tab)||"Replace the pending invitation and send a new set-password link. This does not deactivate the account or revoke sessions."}><button aria-label={`Resend set-password invitation for ${row.fullName}`} disabled={invitationBusy||!!staffInvitationRestriction(row,tab)} onClick={async () => { if (!invitationBusy && await confirmAction.ask({title:"Resend invitation?",description:"The pending invitation will be replaced and a new set-password email requested. This does not deactivate the account or revoke sessions.",confirmLabel:"Resend invitation"})) resendInvitation.mutate({row,staffTab:tab}); }}><Send size={15} /></button></HelpTip>}
            <HelpTip text="Edit staff details and assignments"><button aria-label="Edit" onClick={() => beginEdit(row)}><Pencil size={15} /></button></HelpTip>
          </div>{invitationFeedback&&invitationFeedback.rowId===row.id&&<small role="status">{invitationFeedback.message}</small>}</td>
        </tr>)}</tbody>
      </table></div> : active ? <div className="empty"><h3>No matching staff</h3><p>Try another search or clear your filters.</p><button onClick={reset}>Clear filters</button></div> : <Empty label={tab} />}
      {!query.error && <Pagination page={context.page} pageSize={context.pageSize} total={query.data?.total || 0} onPageChange={page => change({ page })} onPageSizeChange={pageSize => change({ pageSize })} />}
    </section>
    {recoveryOpen && role !== "doctor" && <AppDialog open variant="drawer" onClose={() => { setRecoveryOpen(false); setRecoveryId(""); recovery.reset(); }} busy={recovery.isPending} title="Account recovery assistance" description="Search linked staff accounts for secure account recovery steps. This action does not send an email.">
      <div className="inline-form" data-testid="details-account-recovery"><ResourceLookup resource="users" label="Staff account" params={{ role: tab === "admins" ? "clinicAdmin" : tab === "doctors" ? "doctor" : "receptionist", linkedOnly: true,clinicId:clinicId||undefined }} value={recoveryId} onChange={id => { setRecoveryId(id); recovery.reset(); }} />
        <button disabled={!recoveryId || recovery.isPending} onClick={() => { if (!recovery.isPending) recovery.mutate({ id: recoveryId }); }} data-testid="button-password-help">{recovery.isPending ? "Loading…" : "Get recovery steps"}</button></div>
      <ErrorNotice error={recovery.error} />{recovery.data && <div className="notice" role="status"><p>{recovery.data.message}</p><Link href="/forgot-password" className="text-link">Open secure password recovery</Link></div>}
    </AppDialog>}
    {setupOpen && isSuperAdmin && <AppDialog open size="wide" onClose={() => { setSetupOpen(false); setSetupDirty(false); }} dirty={setupDirty} busy={setupBusy} title="Set up a new Clinic Admin and their first clinic"><ClinicAdminOnboarding guided onDirtyChange={setSetupDirty} onBusyChange={setSetupBusy}/></AppDialog>}
    {editing && <AppDialog open size="wide" onClose={() => setEditing(null)} title={`${editing.id ? "Edit" : "Add"} ${tabs.find(t => t.id === tab)?.label.replace(/s$/, "")}`} dirty={dirty} busy={busy}>
       <UserEditor tab={tab} initial={editing} isSuperAdmin={isSuperAdmin} clinicId={clinicId} identity={identity} onDirtyChange={setDirty} onBusyChange={setBusy} onClose={(result:any) => { const wasEdit=!!editing.id;setEditing(null);if(!wasEdit&&result.invitationStatus==="failed")notifyWarning(`${tab==="doctors"?"Doctor":"Staff member"} added, but the invitation could not be sent.`);else notifySuccess(wasEdit?"Updated successfully":"Staff member added successfully."); }} />
    </AppDialog>}
  </>;
}

function UserEditor({ tab, initial, onClose, isSuperAdmin, onDirtyChange, onBusyChange, clinicId, identity }: any) {
  const confirmAction = useConfirm();
  const form = useForm({ defaultValues: { status: "active", ...initial, ...(clinicId&&!initial.id&&tab!=="admins"?{clinicIds:[clinicId]}:{}) } });
  const client = useQueryClient();
  const locked = useRef(false);
  const records = useRef(new Map<string, any>());
  const [,setCatalogVersion]=useState(0);
  const remember = (rows: any[]) => { rows.forEach(row => records.current.set(row.id, row)); setCatalogVersion(version=>version+1); };
  const selectedClinics: string[] = form.watch("clinicIds") || [];
  const selectedBranches: string[] = form.watch("branchIds") || [];
  const firstOwner = selectedClinics.length ? records.current.get(selectedClinics[0])?.adminId : undefined;
  const optionsParams = { targetRole: assignmentTargetRole(tab), doctorId: tab === "doctors" ? initial.id : undefined, userId: tab === "receptionists" ? initial.id : undefined };
  const save = useMutation({
    mutationFn: async (data: any) => {
       const body = clinicScopedStaffInput(tab,data,initial,clinicId,records.current);
      return tab === "doctors" ? initial.id ? api.updateDoctor(initial.id, body) : api.createDoctor(body) : initial.id ? api.updateUser(initial.id, body) : api.createUser(body);
    },
    onSuccess: (result) => { client.invalidateQueries(); onClose(result); },
    onSettled: () => { locked.current = false; },
  });
  useEffect(() => { onDirtyChange(form.formState.isDirty); }, [form.formState.isDirty]);
  useEffect(() => { onBusyChange(save.isPending); }, [save.isPending]);
  const onSubmit = (data: any) => {
    if (locked.current || save.isPending) return;
    // Do not infer invalid assignments from a partial lookup page. The API validates ownership and branch coverage.
    locked.current = true;
    save.mutate({...data,fullName:data.fullName.trim(),email:data.email.trim(),mobile:normalizePhone(data.mobile)});
  };
  return <Form {...form}>{confirmAction.dialog}<form className="form-grid" noValidate onSubmit={form.handleSubmit(onSubmit)}>
    <FormField label="Full name" required error={form.formState.errors.fullName?.message as string}><input {...form.register("fullName", { validate: (v:unknown) => required()(v)||validatePersonName(v)||true })}/></FormField>
    <FormField label="Email" required error={form.formState.errors.email?.message as string}><EmailInput data-testid="input-user-email" {...form.register("email", { validate: (v:unknown) => required()(v)||validateEmail(v)||true })}/></FormField>
    <Controller name="mobile" control={form.control} rules={{validate:(v:unknown)=>validatePhone(v)||true}} render={({field})=><FormField label="Mobile" optional error={form.formState.errors.mobile?.message as string}><PhoneInput {...field} value={field.value||""}/></FormField>}/>
    {tab === "doctors" && <><label>Registration number<input {...form.register("registrationNumber")} /></label><label>Experience years<input type="number" min="0" {...form.register("experienceYears", { valueAsNumber: true })} /></label></>}
    {tab === "admins" && !initial.id && <p className="wide notice">Admin accounts have no clinic access until clinic ownership is assigned. Use Clinic Admin setup to create an admin and their first clinic together.</p>}
    {tab !== "admins" && <>
       <div className="wide"><label>Clinics <span className="required">*</span></label><Controller name="clinicIds" control={form.control} rules={{ validate: v => !!v?.length || "Select at least one clinic." }} render={({ field }) => <ResourceMultiLookup resource="assignment:clinics" params={{ ...optionsParams, managingAdminId: isSuperAdmin ? firstOwner : undefined }} value={field.value || []} onRecords={remember} isOptionDisabled={row=>!!firstOwner&&row?.adminId!==firstOwner||!!clinicId&&row?.id!==clinicId&&!selectedClinics.includes(row?.id)} onChange={ids => {
         if(clinicId){field.onChange([...new Set([...(initial.clinicIds||[]).filter((id:string)=>id!==clinicId),clinicId])]);return;}
        const removed = selectedClinics.filter(id => !ids.includes(id));
        field.onChange(ids);
        if (removed.length) form.setValue("branchIds", selectedBranches.filter(id => !removed.includes(records.current.get(id)?.clinicId)), { shouldDirty: true });
       }} />} /><small className="muted">{clinicId?"This clinic remains assigned here. Assignments at other clinics are retained; use Staff management to change them.":"Clinic assignments must belong to the same managing admin. Existing assignments are retained while searching."}</small></div>
      {form.formState.errors.clinicIds&&<p className="field-error wide" role="alert">{String(form.formState.errors.clinicIds.message)}</p>}
      <div className="wide"><label>Clinics {tab === "receptionists" && <span className="required">*</span>}</label>
         <Controller name="branchIds" control={form.control} rules={{ validate: v => tab !== "receptionists" || !!v?.length || "Select at least one clinic for each selected Clinic Group." }} render={({ field }) => <ResourceMultiLookup resource="assignment:branches" params={{ ...optionsParams, clinicId:clinicId|| (selectedClinics.length===1?selectedClinics[0]:undefined) }} disabled={!selectedClinics.length} value={field.value || []} onRecords={remember} onChange={ids=>field.onChange(clinicId?[...new Set([...(initial.branchIds||[]).filter((id:string)=>records.current.get(id)?.clinicId!==clinicId),...ids.filter((id:string)=>records.current.get(id)?.clinicId===clinicId||!records.current.get(id))])]:ids)} />} />
        {form.formState.errors.branchIds&&<p className="field-error" role="alert">{String(form.formState.errors.branchIds.message)}</p>}
        {tab === "receptionists" && <small className="muted">Select at least one clinic for every assigned Clinic Group.</small>}
      </div>
    </>}
     <Controller name="status" control={form.control} render={({field})=><div className="wide"><StatusSwitch label="Staff account active" active={field.value==="active"} disabled={!!initial.id&&(initial.id===identity.user?.id||initial.userId===identity.user?.id)} onChange={async active=>{if(!active&&!await confirmAction.ask({title:"Deactivate staff member?",description:"They will lose access. Ownership restrictions may prevent this change.",confirmLabel:"Deactivate",tone:"danger"}))return;field.onChange(active?"active":"inactive");}}/>{initial.id&&(initial.id===identity.user?.id||initial.userId===identity.user?.id)&&<small className="muted">Your own account cannot be deactivated here.</small>}</div>}/>
    <div className="wide form-footer"><ErrorNotice error={save.error} /><button className="button" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</button></div>
  </form></Form>;
}