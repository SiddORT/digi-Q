import { FormActions } from "./components/FormActions";
import { submitWithNativeChecks, revealAndFocus } from "./components/native-validity";
import { RowMenu } from "./components/RowMenu";
import { IconAction } from "./components/IconAction";
import { EmailInput } from "@/components/EmailInput";
import { AssignmentSummary } from "./components/AssignmentSummary";
import { Fragment, useEffect, useRef, useState } from "react";
import { useTableColumns, readTableColumns, writeTableColumns } from "./components/TableColumns";
import { SavedViews } from "./components/ListingViewControls";
import { useListingLayout } from "./lib/listing-views";
import { OverflowText } from "./components/OverflowText";
/** Saved staff views: tab-scoped IDs, status, sort and page size only. Search is never saved. */
const STAFF_VIEW_KEYS = ["status", "clinicId", "branchId", "managingAdminId", "specializationId", "sort", "pageSize"];
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Send, KeyRound, ArrowDown, ArrowUp, ArrowDownUp } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { ExactRecordDrawer, RecordFacts, useExactRecord } from "./components/RecordDetails";
import { planRoleSwitch, type SharedStaff } from "./lib/staff-role-switch";
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
import { ListingBulk, useListingSelection, ResultSummary } from "./components/AdminListing";
import { HelpTip } from "./components/HelpTip";
import { FormSection } from "./components/FormSection";
import { FormField } from "./components/FormField";
import { useConfirm } from "./components/ConfirmDialog";
import { friendlyError } from "./lib/friendly-error";
import { required, validatePersonName, validateEmail, validatePhone, normalizePhone } from "./lib/validators";
import { notifySuccess, notifyWarning, notifyError, notifyBulk } from "./lib/notify";
import type { BulkOutcome } from "./lib/bulk-summary";
import { PhoneInput } from "./components/PhoneInput";
import { StatusSwitch } from "./components/StatusSwitch";
import { FormTabs } from "./components/FormTabs";
import { InheritedClinicSummary } from "./components/InheritedClinicSummary";
import { STAFF_TABS, firstInvalidTab, invalidTabs } from "./lib/form-tabs";
import { inheritedConfirmationError } from "./lib/inherited-defaults";
import { DoctorScheduleContext } from "./components/schedule/DoctorScheduleContext";
import "./components/doctor-editor.css";
import { useRegisterUnsaved } from "./components/WorkspaceBranch";

type StaffContext = {search:string;status:""|"active"|"inactive";clinicId:string;branchId:string;managingAdminId:string;specializationId:string;page:number;pageSize:number;sort:string};
const defaultContext = ():StaffContext=>({search:"",status:"",clinicId:"",branchId:"",managingAdminId:"",specializationId:"",page:1,pageSize:20,sort:"-createdAt"});
const staffTypes: { id:StaffTab; label:string }[] = [{id:"admins",label:"Clinic Admins"},{id:"doctors",label:"Doctors"},{id:"receptionists",label:"Receptionists"}];
const sortName = (sort:string) => sort === "fullName" ? "Name A–Z" : sort === "-fullName" ? "Name Z–A" : sort === "createdAt" ? "Oldest first" : "Newest first";

export function Users({ identity, clinicId, embedded=false }: { identity: api.Identity; clinicId?:string; embedded?:boolean }) {
  const confirmAction = useConfirm();
  const roleConfirm = useConfirm(); // rendered inside the Add Staff dialog so it stacks above it
  const settings=api.useGetSettings({query:{queryKey:api.getGetSettingsQueryKey(),staleTime:60000}});
  const role = identity.user!.role;
  const isSuperAdmin = role === "superAdmin";
   const tabs: { id: StaffTab; label: string }[] = [
    ...(isSuperAdmin ? [{ id: "admins" as const, label: "Clinic Admins" }] : []),
    ...(["superAdmin", "clinicAdmin"].includes(role) ? [{ id: "doctors" as const, label: "Doctors" }] : []),
    { id: "receptionists", label: "Receptionists" },
  ];
  const routeSearch = useSearch();
  // Exact staff record from workspace search (?open=<id>): highlighted in the listing.
  const linkedId = new URLSearchParams(routeSearch).get("open") || "";
  const [, navigateTo] = useLocation();
  // Exact staff link: fetch through the permission-checked id endpoint so the record opens even off the current page.
  const linkedIsDoctor = new URLSearchParams(routeSearch).get("tab") === "doctors";
  const exactStaff = useExactRecord<any>(["staff", linkedIsDoctor ? "doctor" : "user"], linkedId, linkedId ? () => (linkedIsDoctor ? api.getDoctor(linkedId) : api.getUser(linkedId)) as Promise<any> : null);
  const closeExactStaff = () => { const q = new URLSearchParams(routeSearch); q.delete("open"); navigateTo(`${window.location.pathname}${q.size ? `?${q}` : ""}`, { replace: true }); };
  const [tab, setTab] = useState<StaffTab>(tabs.find(t => t.id === new URLSearchParams(window.location.search).get("tab"))?.id || tabs[0].id);
   const [contexts, setContexts] = useState<Partial<Record<StaffTab,StaffContext>>>({});
   const context:StaffContext = contexts[tab] || defaultContext();
   const change = (patch: Partial<StaffContext>) => setContexts(previous => ({ ...previous, [tab]: { ...defaultContext(), ...previous[tab], page: 1, ...patch } }));
   const [draftTab, setDraftTab] = useState(tab);
   const [draft, setDraft] = useState<StaffContext>(context);
   const draftChange = (patch:Partial<StaffContext>) => setDraft(previous=>({...previous,...patch}));
  const term = useDebouncedValue(context.search);
  const [editing, setEditing] = useState<any>(null);
  // Role chosen in the Add Staff dialog; independent of the list's role filter.
  const [editTab, setEditTab] = useState<StaffTab>(tab);
  const snapshot = useRef<{values:Record<string,unknown>;defaults:Record<string,unknown>}>({values:{},defaults:{}});
  const [carry, setCarry] = useState<SharedStaff>({});
  const singular = (id:StaffTab) => tabs.find(t => t.id === id)?.label.replace(/s$/, "") || "Staff Member";
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scheduleEntry, setScheduleEntry] = useState(false);
  const [createdDoctor, setCreatedDoctor] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(()=>{setContexts({});setEditing(null);},[clinicId]);
  useEffect(() => {
    const query = new URLSearchParams(routeSearch);
    if (!query.has("search")) return;
    const requested = tabs.find(t => t.id === query.get("tab"))?.id ?? tabs[0].id;
    const next = { ...defaultContext(), search: query.get("search") ?? "" };
    setTab(requested); setDraftTab(requested);
    setContexts(previous => ({ ...previous, [requested]: next }));
    setDraft(next);
  }, [routeSearch, clinicId, role]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
     window.history.replaceState(window.history.state, "", url);
    setRecoveryId("");
    recovery.reset();
  }, [tab]);
   const params = { ...context, search: term || undefined, status: context.status || undefined, clinicId: clinicId || context.clinicId || undefined, branchId: context.branchId || undefined, specializationId:context.specializationId||undefined, managingAdminId: isSuperAdmin ? context.managingAdminId || undefined : undefined };
   const fetchStaff = (staffTab:StaffTab, options: typeof params) => {
     const request={signal:AbortSignal.timeout(20000)};
     return staffTab==="doctors" ? api.listDoctors(options,request) : api.listUsers({...options,role:staffTab==="admins"?"clinicAdmin":"receptionist"},request);
   };
  const query = useQuery<any>({
    queryKey: ["users-tab", identity.user?.id, role, tab, params],
    retry: false,
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
      const message=sent?"Set-password invitation accepted by the email service. Inbox delivery is not confirmed; check spam as well.":"The staff record is saved, but the invitation was not sent. Use Resend Invitation after email service setup is restored; do not add this account again.";
      setInvitationFeedback({rowId:variables.row.id,message});
      if(sent)notifySuccess(message);else notifyWarning(message);
    },
    onError:(error,variables)=>{setInvitationFeedback({rowId:variables.row.id,message:friendlyError(error,"save")});notifyError(error,"save","Invitation Not Sent");},
    onSettled:()=>{void client.invalidateQueries();},
  });
  const bulkInvitations=useMutation({
    mutationFn:({rows,staffTab}:{rows:any[];staffTab:StaffTab})=>resendStaffInvitations(rows,staffTab,api.resendUserInvitation,error=>friendlyError(error,"save")),
    onSuccess:async outcomes=>{setBulkInvitationResults(outcomes);notifyBulk(outcomes,"sent an invitation");selection.clear();await client.invalidateQueries();},
  });
  const invitationBusy=resendInvitation.isPending||bulkInvitations.isPending;
    const active = !!(tab!==tabs[0].id || context.sort !== "-createdAt" || context.search || context.status || (!clinicId&&context.clinicId) || context.branchId || context.managingAdminId || context.specializationId);
    const reset = () => {change({ search: "", status: "", clinicId: "", branchId: "", managingAdminId: "", specializationId:"", sort: "-createdAt" });setContexts(previous=>({...previous,[tabs[0].id]:{...defaultContext(),pageSize:previous[tabs[0].id]?.pageSize||20}}));setTab(tabs[0].id);setDraftTab(tabs[0].id);setDraft(defaultContext());};
    const beginEdit = (row: any, role:StaffTab = tab, schedule=false) => { setScheduleEntry(schedule); setCreatedDoctor(false); setDirty(false); setBusy(false); snapshot.current={values:{},defaults:{}}; setCarry({}); setEditTab(role); setEditing(row.id?row:{...row,...(clinicId&&role!=="admins"?{clinicIds:[clinicId]}:{})}); };
    const creatable = tabs.filter(t => t.id !== "admins" || (isSuperAdmin && !embedded));
    const beginAdd = () => beginEdit({}, creatable.some(t => t.id === tab) ? tab : creatable[0].id);
    const chooseRole = async (next:StaffTab) => {
       if (next === editTab || busy) return;
       // Shared name/email/mobile carry over; anything role-specific (or admin setup input) needs explicit confirmation.
       const plan = planRoleSwitch(snapshot.current.values,snapshot.current.defaults);
       if (plan.discards && !await roleConfirm.ask({title:`Switch to ${singular(next)}?`,description:`Details entered for the ${singular(editTab)} role will be discarded. Name, email and mobile are kept.`,confirmLabel:"Switch Role",tone:"danger"})) return;
       snapshot.current={values:{},defaults:{}}; setCarry(plan.shared); setDirty(Object.keys(plan.shared).length>0); setEditTab(next);
       setEditing({ status: "active", ...(clinicId&&next!=="admins"?{clinicIds:[clinicId]}:{}) });
     };
   const toggleSort=(key:"fullName"|"createdAt")=>change({sort:context.sort===key?`-${key}`:key});
   const sortable=(key:"fullName"|"createdAt",label:string)=><button type="button" className="sort-button" onClick={()=>toggleSort(key)} aria-label={`Sort ${label} ${context.sort===key?"descending":"ascending"}`}>{label}{context.sort===key?<ArrowUp aria-hidden size={14}/>:context.sort===`-${key}`?<ArrowDown aria-hidden size={14}/>:<ArrowDownUp aria-hidden size={14}/>}</button>;
   const openFilters=()=>{setDraftTab(tab);setDraft({...context});};
   const applyFilters=()=>{setContexts(previous=>({...previous,[draftTab]:{...defaultContext(),...previous[draftTab],...draft,page:1,clinicId:clinicId||draft.clinicId}}));setTab(draftTab);};
   const cols = useTableColumns(`users-${tab}`, identity.user?.id, role, [{ key: "member", label: "Staff Member" }, ...(isSuperAdmin && tab !== "admins" ? [{ key: "admin", label: "Managing Admin" }] : []), { key: "assignments", label: tab === "admins" ? "Owned clinics" : "Assignments" }, { key: "status", label: "Account Status" }], { iconOnly: true });
  const staffLayout = useListingLayout(`users-${tab}`, identity.user?.id, role, STAFF_VIEW_KEYS);
  const staffFilters: Record<string, string> = { status: context.status, clinicId: clinicId ? "" : context.clinicId, branchId: context.branchId, managingAdminId: isSuperAdmin ? context.managingAdminId : "", specializationId: tab === "doctors" ? context.specializationId : "", sort: context.sort === "-createdAt" ? "" : context.sort, pageSize: context.pageSize === 20 ? "" : String(context.pageSize) };
  const staffCols = () => readTableColumns(`users-${tab}`, identity.user?.id, role);
  const staffViews = <SavedViews canShare={staffLayout.canShare} legacyViews={staffLayout.legacyViews} onImport={staffLayout.importLegacyView} views={staffLayout.layout.views} canSave={Object.values(staffFilters).some(Boolean) || !!staffCols()} onSave={view=>staffLayout.saveView(view, staffFilters, staffCols())} onDelete={staffLayout.deleteView}
    onApply={v => { const f = v.filters; writeTableColumns(`users-${tab}`, identity.user?.id, role, v.columns); change({ search: "", status: (["active", "inactive"].includes(f.status) ? f.status : "") as StaffContext["status"], clinicId: clinicId || f.clinicId || "", branchId: f.branchId || "", managingAdminId: isSuperAdmin ? f.managingAdminId || "" : "", specializationId: tab === "doctors" ? f.specializationId || "" : "", sort: ["fullName", "-fullName", "createdAt"].includes(f.sort) ? f.sort : "-createdAt", pageSize: [10, 20, 25, 50, 100].includes(Number(f.pageSize)) ? Number(f.pageSize) : 20 }); }} />;
  const userCell = (k: string, row: any) => k === "member" ? <><OverflowText as="strong" value={row.fullName} testId={`text-staff-name-${row.id}`}/>{tab==="doctors"&&row.specializationName&&<small><OverflowText value={row.specializationName}/></small>}</> : k === "admin" ? <OverflowText value={row.managingAdminName || row.ownerAdminName}/> : k === "assignments" ? <><AssignmentSummary owner={row.fullName} groups={row.clinicNames} clinics={tab!=="admins"?row.branchNames:undefined} testId={`button-assignments-${row.id}`}/></> : k === "status" ? <><StatusSwitch label={`Account active for ${row.fullName}`} active={row.status==="active"} busy={statusUpdate.isPending&&statusTarget?.id===row.id} title={row.id===identity.user?.id||row.userId===identity.user?.id?"You cannot deactivate your own account.":tab==="admins"&&row.status==="active"&&row.clinicIds?.length?"Transfer clinic ownership before deactivation.":undefined} disabled={statusUpdate.isPending||row.id===identity.user?.id||row.userId===identity.user?.id||(tab==="admins"&&row.status==="active"&&!!row.clinicIds?.length)} onChange={async checked=>{const next=checked?"active":"inactive";if(next==="inactive"&&!await confirmAction.ask({title:`Deactivate ${row.fullName}?`,description:"They will lose access. Clinic ownership restrictions may prevent this change. Historical records are preserved.",confirmLabel:"Deactivate",tone:"danger"}))return;setStatusError("");setStatusTarget({id:row.id,userId:row.userId,name:row.fullName,status:next});statusUpdate.mutate({row,status:next,staffTab:tab});}}/><small className="status-sub">{row.passwordEnabled === true ? "Password Set" : row.invitationStatus === "sent" ? "Pending Setup" : row.invitationStatus === "failed" ? "Invitation Not Sent" : "Needs Password Setup"}</small></> : null;
   return <>{confirmAction.dialog}
     {counts.some(item=>item.error)&&<div role="alert" className="error-box">Unable to load staff status counts. <button type="button" onClick={()=>counts.forEach(item=>{if(item.error)void item.refetch();})}>Retry Counts</button></div>}
       <FilterBar compactToolbar title={<h2>Staff</h2>} secondary={<>{role !== "doctor" && <button type="button" className="button secondary small" aria-haspopup="dialog" onClick={() => setRecoveryOpen(true)} data-testid="button-open-account-recovery"><KeyRound size={15} aria-hidden /> Recovery</button>}{cols.settings}</>} actions={<>{creatable.length ? <button type="button" className="button small" aria-haspopup="dialog" onClick={beginAdd} data-testid="button-add-staff"><Plus size={17} aria-hidden /> Add Staff</button> : null}</>} activeCount={[context.status,!clinicId&&context.clinicId,context.branchId,context.specializationId,context.managingAdminId,context.sort!=="-createdAt",tab!==tabs[0].id].filter(Boolean).length} active={active} onReset={reset} onOpen={openFilters} onApply={applyFilters} label="Filter Staff" chips={[
       ...(tab!==tabs[0].id?[{key:"adv:staffType",label:`Staff type: ${tabs.find(item=>item.id===tab)?.label}`,onRemove:()=>setTab(tabs[0].id)}]:[]),
       ...(context.search?[{key:"search",label:`Search: ${context.search}`,onRemove:()=>change({search:""})}]:[]),
      ...(context.status?[{key:"adv:status",label:title(context.status),onRemove:()=>change({status:""})}]:[]),
       ...(!clinicId&&context.clinicId?[{key:"clinicId",label:"Clinic Selected",onRemove:()=>change({clinicId:"",branchId:""})}]:[]),
      ...(context.branchId?[{key:"branchId",label:"Clinic Selected",onRemove:()=>change({branchId:""})}]:[]),
      ...(context.specializationId?[{key:"adv:specializationId",label:"Specialization Selected",onRemove:()=>change({specializationId:""})}]:[]),
      ...(context.managingAdminId?[{key:"adv:managingAdminId",label:"Managing Admin Selected",onRemove:()=>change({managingAdminId:""})}]:[]),
       ...(context.sort!=="-createdAt"?[{key:"sort",label:`Sorted: ${sortName(context.sort)}`,onRemove:()=>change({sort:"-createdAt"})}]:[]),
    ]} advanced={<>
       <SearchableSelect label="Account Status" testId="select-staff-status" value={draft.status||"all"} onChange={value=>draftChange({status:(value==="active"||value==="inactive"?value:"") as StaffContext["status"]})} options={(["","active","inactive"] as const).map((status,index)=>({value:status||"all",label:`${status?title(status):"All"}${counts[index].data?` (${counts[index].data.total})`:""}`}))}/>
      <SearchableSelect label="Staff Type" value={draftTab} onChange={value=>{const next=tabs.find(item=>item.id===value)?.id||tab;setDraftTab(next);setDraft({...defaultContext(),...contexts[next]});}} options={tabs.map(item=>({value:item.id,label:item.label}))}/>
       {draftTab==="doctors"&&<ResourceLookup resource="masters" label="Specialization" params={{category:"specialization"}} value={draft.specializationId} onChange={specializationId=>draftChange({specializationId})}/>}
       {isSuperAdmin && draftTab !== "admins" && <ResourceLookup resource="users" label="Managing Admin" params={{role:"clinicAdmin"}} value={draft.managingAdminId} onChange={managingAdminId => draftChange({ managingAdminId })} />}
        {!clinicId&&<ResourceLookup resource={draftTab==="admins"?"clinics":"assignment:clinics"} label="Clinic" params={draftTab==="admins"?undefined:{targetRole:assignmentTargetRole(draftTab)}} value={draft.clinicId} onChange={value=>draftChange({clinicId:value,branchId:""})}/>}
        {draftTab === "receptionists" && <ResourceLookup resource="assignment:branches" label="Location" params={{targetRole:assignmentTargetRole(draftTab),clinicId:clinicId||draft.clinicId||undefined}} value={draft.branchId} onChange={branchId=>draftChange({branchId})}/>}
        <SearchableSelect label="Sort Staff" value={draft.sort} onChange={sort=>draftChange({sort:sort||"-createdAt"})} options={["-createdAt","createdAt","fullName","-fullName"].map(value=>({value,label:sortName(value)}))}/>
        <HelpTip label="About account status" text="Account status and invitation status are separate. Inactive staff cannot sign in. Activating an account does not send an invitation or reset its password; use the account's invitation or recovery action when needed. Existing history is retained."/>
    </>}>
      <SearchInput value={context.search} onChange={search => change({ search })} placeholder={tab==="doctors"?"Search doctors by name, email or specialization…":tab==="receptionists"?"Search receptionists by name, email or mobile…":"Search Clinic Admins by name, email or mobile…"} suggestions={query.error||query.isPlaceholderData?[]:listingSuggestions(query.data?.items,(row:any)=>({id:row.id,label:row.fullName,description:row.email,value:row.fullName}))} loading={query.isFetching} error={query.error?friendlyError(query.error,"load"):null} onRetry={()=>void query.refetch()} total={query.data?.total} settledQuery={term} scopeKey={JSON.stringify([tab,{...params,search:undefined,page:undefined}])} />
    </FilterBar>
    {success && <p role="status" className="notice">{success}</p>}
     {statusError&&<div role="alert" className="error-box">{statusError} <button type="button" onClick={()=>setStatusError("")}>Dismiss</button></div>}
    <ErrorNotice error={settings.error} />
    <ListingBulk selection={selection} resource={tab==="doctors"?"doctors":"users"} columns={["fullName","email","mobile","role","clinicNames","branchNames","status"]} identity={identity} context={selectionContext}/>
    {!!selection.selected.length&&<div className="admin-bulk-bar"><HelpTip text="Replace pending invitations and send new set-password links. This does not deactivate staff or sign them out. Ineligible records are skipped with an explanation."><button type="button" disabled={invitationBusy||selection.selected.every(row=>!!staffInvitationRestriction(row,tab))} onClick={async()=>{
      const rows=[...selection.selected],staffTab=tab;
      if(!invitationBusy&&await confirmAction.ask({title:`Resend Invitations for ${rows.length} Selected Staff?`,description:"Replace pending set-password invitations and request new emails. This does not deactivate accounts or revoke sessions. Inactive accounts and staff with passwords are skipped. Each eligible account is checked by the server; failures do not undo successful sends.",confirmLabel:"Resend Selected Invitations"}))bulkInvitations.mutate({rows,staffTab});
    }}>{bulkInvitations.isPending?"Sending Invitations…":"Resend Selected Invitations"}</button></HelpTip></div>}
    {!!bulkInvitationResults.length&&<ResultSummary title="Invitations" testId="details-invitation-results" items={bulkInvitationResults.map(result=>({label:result.label,ok:result.ok,message:result.ok?"invitation sent":result.message}))} onDismiss={()=>setBulkInvitationResults([])}/>}
    <section className="panel table-panel admin-listing-table">
      {query.isLoading ? <div className="skeleton" role="status">Loading {tabs.find(item=>item.id===tab)?.label.toLowerCase()}…</div> : query.error ? <><div className="error-box" role="alert">{friendlyError(query.error,"load")}</div><button onClick={() => query.refetch()}>Retry {tabs.find(item=>item.id===tab)?.label.toLowerCase()}</button></> : query.data?.items.length ? <div className="table-scroll" inert={query.isPlaceholderData}><table aria-busy={query.isFetching}>
         <thead><tr><th scope="col" className="col-select">{selection.header}</th>{cols.visible.map(k=>k==="member"?<th key={k} className={cols.cls(k)} aria-sort={context.sort==="fullName"?"ascending":context.sort==="-fullName"?"descending":undefined}>{sortable("fullName","Staff member")}</th>:<th key={k} className={cols.cls(k,k==="status"?"col-status":undefined)}>{cols.label(k)}</th>)}<th className="col-actions sticky">Actions</th></tr></thead>
        <tbody>{query.data.items.map((row: any) => <Fragment key={row.id}><tr data-testid={`row-staff-${row.id}`} className={linkedId===row.id?"is-linked":undefined}>
          <td data-label="Select" className="col-select"><span className="row-lead">{selection.checkbox(row)}{cols.toggle(row.id,row.fullName)}</span></td>
          {cols.visible.map(k=><td key={k} data-label={cols.label(k)} className={cols.cls(k,k==="member"?"admin-record":k==="status"?"col-status":undefined)}>{userCell(k,row)}</td>)}



          <td data-label="Actions" className="col-actions sticky"><div className="row-actions">
            <IconAction label={`Edit ${row.fullName}`} hint="Edit staff details and assignments" icon={<Pencil size={15} aria-hidden />} onClick={() => beginEdit(row)} testId={`button-edit-staff-${row.id}`} />
            {tab==="doctors"&&<button type="button" className="text-link" data-testid={`button-manage-schedule-${row.id}`} onClick={()=>beginEdit(row,"doctors",true)}>Manage schedule</button>}
            {row.invitationStatus !== "notRequired" && <RowMenu label={`More actions for ${row.fullName}`} testId={`menu-staff-${row.id}`} items={[{key:"resend",label:"Resend Invitation",hint:staffInvitationRestriction(row,tab)||"Replace the pending invitation and send a new set-password link. This does not deactivate the account or revoke sessions.",disabled:invitationBusy||!!staffInvitationRestriction(row,tab),testId:`action-resend-invitation-${row.id}`,onSelect:()=>{void (async()=>{ if (!invitationBusy && await confirmAction.ask({title:"Resend Invitation?",description:"The pending invitation will be replaced and a new set-password email requested. This does not deactivate the account or revoke sessions.",confirmLabel:"Resend Invitation"})) resendInvitation.mutate({row,staffTab:tab}); })();}}]}/>}
          </div>{invitationFeedback&&invitationFeedback.rowId===row.id&&<small role="status">{invitationFeedback.message}</small>}</td>
        </tr>{cols.expansion(row.id,cols.visible.length+2,k=>userCell(k,row))}</Fragment>)}</tbody>
      </table></div> : active ? <div className="empty"><h3>No Matching Staff</h3><p>Try another search or clear your filters.</p><button onClick={reset}>Clear Filters</button></div> : <Empty label={tab} />}
      {!query.error && <Pagination page={context.page} pageSize={context.pageSize} total={query.data?.total || 0} onPageChange={page => change({ page })} onPageSizeChange={pageSize => change({ pageSize })} />}
    </section>
    {linkedId && <ExactRecordDrawer title={linkedIsDoctor ? "Doctor Details" : "Staff Details"} query={exactStaff} onClose={closeExactStaff} actions={(record: any) => role === "doctor" ? null : <button type="button" className="button secondary" data-testid="button-exact-staff-edit" onClick={() => { closeExactStaff(); beginEdit(record); }}>Edit {record.fullName}</button>}>{(record: any) => <><h3 className="exact-record-title">{record.fullName}</h3><RecordFacts testId="exact-facts-staff" facts={([["Role", record.role ? title(record.role) : linkedIsDoctor ? "Doctor" : ""], ["Email", record.email], ["Mobile", record.phone || record.mobile], ["Specialization", record.specializationName], ["Clinic", record.clinicName || (Array.isArray(record.clinicNames) ? record.clinicNames.join(", ") : "")], ["Location", record.branchName || (Array.isArray(record.branchNames) ? record.branchNames.join(", ") : "")], ["Status", record.status ? title(record.status) : ""], ["Account", record.userId || record.linked ? "Linked sign-in" : ""]] as [string, string][]).filter(([, v]) => v)}/></>}</ExactRecordDrawer>}
    {recoveryOpen && role !== "doctor" && <AppDialog open variant="drawer" onClose={() => { setRecoveryOpen(false); setRecoveryId(""); recovery.reset(); }} busy={recovery.isPending} title="Account Recovery Assistance" description="Search linked staff accounts for secure account recovery steps. This action does not send an email.">
      <div className="inline-form" data-testid="details-account-recovery"><ResourceLookup resource="users" label="Staff Account" params={{ role: tab === "admins" ? "clinicAdmin" : tab === "doctors" ? "doctor" : "receptionist", linkedOnly: true,clinicId:clinicId||undefined }} value={recoveryId} onChange={id => { setRecoveryId(id); recovery.reset(); }} />
        <button disabled={!recoveryId || recovery.isPending} onClick={() => { if (!recovery.isPending) recovery.mutate({ id: recoveryId }); }} data-testid="button-password-help">{recovery.isPending ? "Loading…" : "Get recovery steps"}</button></div>
      <ErrorNotice error={recovery.error} />{recovery.data && <div className="notice" role="status"><p>{recovery.data.message}</p><Link href="/forgot-password" className="text-link">Open Secure Password Recovery</Link></div>}
    </AppDialog>}
    
    {editing && <AppDialog open size="medium" onClose={() => setEditing(null)} title={editing.id||createdDoctor ? `Edit ${singular(editTab)}` : "Add Staff"} description={editing.id||createdDoctor ? undefined : "Choose a role, then enter the shared details and assignments."} dirty={dirty} busy={busy}>{roleConfirm.dialog}
       {!editing.id && !createdDoctor && creatable.length > 1 && <div className="staff-role-picker"><SearchableSelect label="Role" required testId="select-add-staff-role" value={editTab} disabled={busy} onChange={value => { const next = creatable.find(item => item.id === value)?.id; if (next) void chooseRole(next); }} options={creatable.map(item => ({ value: item.id, label: singular(item.id) }))}/></div>}
       {!editing.id && !createdDoctor && creatable.length === 1 && <p className="muted staff-role-picker" data-testid="text-add-staff-role">Role: <strong>{singular(editTab)}</strong></p>}
       {editTab === "admins" && !editing.id ? <ClinicAdminOnboarding guided carry={carry} onSnapshot={(values,defaults)=>{snapshot.current={values,defaults};}} onDirtyChange={setDirty} onBusyChange={setBusy}/> :
       <UserEditor key={`${editTab}:${editing.id||"new"}`} tab={editTab} initial={editing} scheduleEntry={scheduleEntry} onCreated={()=>setCreatedDoctor(true)} carry={editing.id?undefined:carry} isSuperAdmin={isSuperAdmin} clinicId={clinicId} identity={identity} onDirtyChange={setDirty} onBusyChange={setBusy} onSnapshot={(values:Record<string,unknown>,defaults:Record<string,unknown>)=>{snapshot.current={values,defaults};}} onClose={(result:any) => { const wasEdit=!!editing.id;const savedTab=editTab;setEditing(null);if(!wasEdit&&savedTab!==tab){setTab(savedTab);setDraftTab(savedTab);}if(!wasEdit&&result.invitationStatus==="failed")notifyWarning(`${singular(savedTab)} added, but the invitation could not be sent.`);else notifySuccess(wasEdit?"Updated successfully":`${singular(savedTab)} added successfully.`); }} />}
    </AppDialog>}
  </>;
}

function UserEditor({ tab, initial: opened, carry, onClose, isSuperAdmin, onDirtyChange, onBusyChange, onSnapshot, clinicId, identity, scheduleEntry, onCreated }: any) {
  const [initial, setSaved] = useState(opened);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const confirmAction = useConfirm();
  // Include every mounted doctor field in the reset baseline, including the
  // creation-only confirmation. Otherwise retained unmounted fields and empty
  // numeric inputs can report a saved new doctor as still dirty.
  const doctorValues=(record:any)=>({...record,status:record.status||"active",fullName:record.fullName??"",email:record.email??"",mobile:record.mobile??"",registrationNumber:record.registrationNumber??"",experienceYears:record.experienceYears??undefined,clinicIds:record.clinicIds||[],branchIds:record.branchIds||[],confirmInherited:false});
  const form = useForm({ defaultValues: { status: "active", ...(tab==="doctors"?doctorValues(initial):initial), ...(clinicId&&!initial.id&&tab!=="admins"?{clinicIds:[clinicId]}:{}) } });
  const client = useQueryClient();
  const locked = useRef(false);
  const resendSavedInvitation=useMutation({
    mutationFn:()=>api.resendUserInvitation(tab==="doctors"?initial.userId:initial.id),
    onSuccess:(result)=>{
      setSaved((record:any)=>({...record,invitationStatus:result.invitationStatus,passwordEnabled:result.passwordEnabled}));
      setSavedMessage(result.invitationStatus==="sent"?"Invitation accepted by the email service. Inbox delivery is not confirmed.":"The staff record is saved, but the invitation was not sent. Retry after email service setup is restored; do not add this account again.");
    },
    onSettled:()=>{void client.invalidateQueries();},
  });
  const fixedClinic=api.useGetClinic(clinicId||"",{query:{queryKey:api.getGetClinicQueryKey(clinicId||""),enabled:tab==="doctors"&&!!clinicId}});
  const [hydrated,setHydrated]=useState(tab!=="doctors"||!opened.id);
  const savedBranchIds:string[]=initial.branchIds||[];
  const savedLocations=useQuery({queryKey:["doctor-editor-locations",initial.id,savedBranchIds.join(",")],enabled:tab==="doctors"&&!!initial.id&&!!savedBranchIds.length,retry:false,queryFn:()=>Promise.all(savedBranchIds.map(id=>api.getBranch(id)))});
  const freshDoctor=useQuery({queryKey:["doctor-editor-record",opened.id],enabled:tab==="doctors"&&!!opened.id,queryFn:()=>api.getDoctor(opened.id),retry:false,staleTime:0});
  useEffect(()=>{
    if(!hydrated&&freshDoctor.isFetchedAfterMount&&!freshDoctor.isFetching&&freshDoctor.data){setSaved(freshDoctor.data);form.reset(doctorValues(freshDoctor.data));setHydrated(true);}
  },[freshDoctor.data,freshDoctor.isFetchedAfterMount,freshDoctor.isFetching,hydrated]);
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
    onSuccess: (result) => {
      void client.invalidateQueries();
      if(tab!=="doctors"&&result.invitationStatus!=="failed"){onClose(result);return;}
      setSaved(result); form.reset(doctorValues(result));
      setSavedMessage(result.invitationStatus==="failed"?"The staff record and assignments are saved, but the invitation was not sent. Use Resend Invitation after email service setup is restored; do not add this account again.": "Doctor details and assignments saved. Schedule changes are saved separately.");
      if(!initial.id&&tab==="doctors"){onCreated();if(result.invitationStatus==="failed")notifyWarning("Doctor added, but the invitation could not be sent.");}
    },
    onSettled: () => { locked.current = false; },
  });
  useEffect(() => { onDirtyChange(form.formState.isDirty || scheduleDirty); }, [form.formState.isDirty, scheduleDirty]);
  useEffect(() => { onBusyChange(save.isPending || scheduleBusy || resendSavedInvitation.isPending); }, [save.isPending, scheduleBusy, resendSavedInvitation.isPending]);
  useRegisterUnsaved(form.formState.isDirty||scheduleDirty,save.isPending||scheduleBusy||resendSavedInvitation.isPending);
  const snapshotRef = useRef(onSnapshot); snapshotRef.current = onSnapshot;
  useEffect(() => {
    // Carried shared fields are applied as edits so dirty protection still guards them.
    for (const [key, value] of Object.entries(carry || {})) form.setValue(key as any,value,{shouldDirty:true});
    const defaults = form.formState.defaultValues as Record<string, unknown>;
    snapshotRef.current?.(form.getValues(), defaults);
    const sub = form.watch(values => snapshotRef.current?.(values as Record<string, unknown>, defaults));
    return () => sub.unsubscribe();
  }, [form]);
  const staffTabs = tab==="doctors"?undefined:STAFF_TABS[tab];
  const [activeTab, setActiveTab] = useState(0);
  const errorKeys = Object.keys(form.formState.errors);
  const tabInvalid = staffTabs ? invalidTabs(staffTabs, errorKeys) : [];
  const panel = (i: number) => staffTabs && activeTab !== i ? "staff-tab-panel is-hidden" : "staff-tab-panel";
  // One Save: on a failed submit, open the first tab (in tab order) holding an error. Values stay mounted.
  const onInvalid = (errors: Record<string, unknown>) => { const key = Object.keys(errors)[0]; if (staffTabs) { const i = firstInvalidTab(staffTabs, Object.keys(errors)); if (i >= 0) setActiveTab(i); } if (key) requestAnimationFrame(() => revealAndFocus(document.querySelector<HTMLElement>(`.staff-editor [name="${CSS.escape(key)}"]`) || document.getElementById(`input-${key}`))); };
  const onSubmit = (data: any) => {
    if (locked.current || save.isPending || scheduleBusy) return;
    const assignmentChanged=JSON.stringify([selectedClinics,selectedBranches])!==JSON.stringify([initial.clinicIds||[],initial.branchIds||[]]);
    if(assignmentChanged&&scheduleDirty){setSavedMessage("Save or discard the schedule draft before saving assignment changes.");return;}
    const { confirmInherited: _confirmed, ...rest } = data; data = rest;
    // Do not infer invalid assignments from a partial lookup page. The API validates ownership and branch coverage.
    locked.current = true;
    save.mutate({...data,fullName:data.fullName.trim(),email:data.email.trim(),mobile:normalizePhone(data.mobile)});
  };
  if(!hydrated)return freshDoctor.error?<><ErrorNotice error={freshDoctor.error}/><button type="button" onClick={()=>void freshDoctor.refetch()}>Retry Doctor Details</button></>:<p role="status">Loading doctor details…</p>;
  return <div className={tab==="doctors"?"doctor-editor":undefined} data-details-dirty={tab==="doctors"?String(form.formState.isDirty):undefined} data-schedule-dirty={tab==="doctors"?String(scheduleDirty):undefined}><Form {...form}>{confirmAction.dialog}<form className="form-grid staff-editor" inert={save.isPending||scheduleBusy?true:undefined} noValidate onSubmit={submitWithNativeChecks(form, onSubmit, onInvalid)}>
    {staffTabs && <FormTabs tabs={staffTabs.map(t => t.label)} active={activeTab} onChange={setActiveTab} invalid={tabInvalid}/>}
    <div className={panel(0)} role={staffTabs ? "tabpanel" : undefined}>
    <FormSection title="Staff details" hint={tab==="doctors"?"Sign-in identity and professional registration.":"Sign-in identity. Email receives the invitation."}>
    <FormField id="input-fullName" label="Full Name" required error={form.formState.errors.fullName?.message as string}><input {...form.register("fullName", { validate: (v:unknown) => required()(v)||validatePersonName(v)||true })}/></FormField>
    <FormField label="Email" required error={form.formState.errors.email?.message as string}><EmailInput data-testid="input-user-email" {...form.register("email", { validate: (v:unknown) => required()(v)||validateEmail(v)||true })}/></FormField>
    <Controller name="mobile" control={form.control} rules={{validate:(v:unknown)=>validatePhone(v)||true}} render={({field})=><FormField label="Mobile" optional error={form.formState.errors.mobile?.message as string}><PhoneInput {...field} value={field.value||""}/></FormField>}/>

    </FormSection>
    <Controller name="status" control={form.control} render={({field})=><div className="wide"><StatusSwitch label="Staff Account Active" active={field.value==="active"} disabled={!!initial.id&&(initial.id===identity.user?.id||initial.userId===identity.user?.id)} onChange={async active=>{if(!active&&!await confirmAction.ask({title:"Deactivate Staff Member?",description:"They will lose access. Ownership restrictions may prevent this change.",confirmLabel:"Deactivate",tone:"danger"}))return;field.onChange(active?"active":"inactive");}}/>{initial.id&&(initial.id===identity.user?.id||initial.userId===identity.user?.id)&&<small className="muted">Your own account cannot be deactivated here.</small>}</div>}/>
    </div>
    {tab === "doctors" && <div className={panel(1)}><FormSection title="Professional" hint="Registration and experience.">
    <FormField label="Registration Number" optional><input data-testid="input-staff-registration" {...form.register("registrationNumber")} /></FormField><FormField label="Experience Years" optional><input type="number" min="0" data-testid="input-staff-experience" {...form.register("experienceYears", { setValueAs:value=>value===""||value==null?undefined:Number(value) })} /></FormField>
    </FormSection></div>}
    {tab === "admins" && !initial.id && <p className="wide notice">Admin accounts have no clinic access until clinic ownership is assigned. Use Clinic Admin setup to create an admin and their first clinic together.</p>}
    {tab !== "admins" && <div id="doctor-assignments" className={panel(tab === "doctors" ? 2 : 1)} role={staffTabs?"tabpanel":undefined}><FormSection title={tab==="doctors"?"Assignments":"Assignment"} hint="Which Clinic Groups and locations this person works at.">
       <div className="wide"><Controller name="clinicIds" control={form.control} rules={{ validate: v => !!v?.length || "Select at least one Clinic Group." }} render={({ field }) => clinicId&&tab==="doctors"?<><label>Clinic Groups · inherited context</label><div className="doctor-context-value">{fixedClinic.data?.name||records.current.get(clinicId)?.name||(fixedClinic.isLoading?"Loading Clinic Group…":"Current Clinic Group (fixed)")}</div>{fixedClinic.error&&<><ErrorNotice error={fixedClinic.error}/><button type="button" onClick={()=>void fixedClinic.refetch()}>Retry Fixed Clinic Details</button></>}</>:<ResourceMultiLookup id="input-clinicIds" label="Clinic Groups" required error={form.formState.errors.clinicIds?.message as string} resource="assignment:clinics" params={{ ...optionsParams, managingAdminId: isSuperAdmin ? firstOwner : undefined }} value={field.value || []} onRecords={remember} isOptionDisabled={row=>!!firstOwner&&row?.adminId!==firstOwner||!!clinicId&&row?.id!==clinicId&&!selectedClinics.includes(row?.id)} onChange={ids => {
         if(clinicId){field.onChange([...new Set([...(initial.clinicIds||[]).filter((id:string)=>id!==clinicId),clinicId])]);return;}
        const removed = selectedClinics.filter(id => !ids.includes(id));
        field.onChange(ids);
        if (removed.length) form.setValue("branchIds", selectedBranches.filter(id => !removed.includes(records.current.get(id)?.clinicId)), { shouldDirty: true });
       }} />} /><small className="muted">{clinicId?"This Clinic Group remains assigned here. Assignments at other clinics are retained; use Staff management to change them.":"Clinic Groups must belong to the same managing admin. Existing assignments are retained while searching."}</small></div>
      {form.formState.errors.clinicIds&&<p className="field-error wide" role="alert">{String(form.formState.errors.clinicIds.message)}</p>}
      <div className="wide">
         <Controller name="branchIds" control={form.control} rules={{ validate: v => tab !== "receptionists" || !!v?.length || "Select at least one location for each selected Clinic Group." }} render={({ field }) => <ResourceMultiLookup id="input-branchIds" label="Locations" required={tab==="receptionists"} resource="assignment:branches" params={{ ...optionsParams, clinicId:clinicId|| (selectedClinics.length===1?selectedClinics[0]:undefined) }} disabled={!selectedClinics.length||(tab==="doctors"&&!!clinicId&&!!savedBranchIds.length&&(savedLocations.isPending||savedLocations.isError))} value={clinicId&&tab==="doctors"?(field.value||[]).filter((id:string)=>(savedLocations.data?.find(b=>b.id===id)?.clinicId||records.current.get(id)?.clinicId)===clinicId):field.value || []} onRecords={remember} onChange={ids=>field.onChange(clinicId?[...new Set([...(initial.branchIds||[]).filter((id:string)=>(savedLocations.data?.find(b=>b.id===id)?.clinicId||records.current.get(id)?.clinicId)!==clinicId),...ids.filter((id:string)=>records.current.get(id)?.clinicId===clinicId||!records.current.get(id))])]:ids)} />} />
        {tab==="doctors"&&clinicId&&!!savedBranchIds.length&&savedLocations.isPending&&<small role="status">Loading saved location assignments…</small>}
        {tab==="doctors"&&clinicId&&savedLocations.error&&<><ErrorNotice error={savedLocations.error}/><button type="button" onClick={()=>void savedLocations.refetch()}>Retry Saved Assignments</button></>}
        {tab==="doctors"&&clinicId&&savedLocations.data?.some(b=>b.clinicId!==clinicId)&&<div><label>Other saved locations · retained</label><div className="doctor-context-value">{savedLocations.data.filter(b=>b.clinicId!==clinicId).map(b=>b.name).join(", ")}</div><small className="muted">These assignments cannot be removed in this clinic context. Open Staff management to change them.</small></div>}
        {!selectedClinics.length&&<small className="muted">Choose a Clinic Group first to enable location assignments.</small>}
        {form.formState.errors.branchIds&&<p className="field-error" role="alert">{String(form.formState.errors.branchIds.message)}</p>}
        {tab === "receptionists" && <small className="muted">Select at least one location for every assigned Clinic Group.</small>}
      </div>
      {!initial.id && <>
        <h4 className="wide">Inherited clinic details</h4>
        <InheritedClinicSummary clinicIds={selectedClinics} branchIds={selectedBranches} user={identity.user} doctor={tab === "doctors"}/>
        {selectedClinics.length > 0 && <Controller name="confirmInherited" control={form.control} rules={{ validate: v => inheritedConfirmationError(true, form.getValues("clinicIds"), v) || true }} render={({ field }) => <label className="wide checkbox-row"><input type="checkbox" checked={field.value === true} onChange={e => field.onChange(e.target.checked)} data-testid="checkbox-confirm-inherited"/> Use these clinic details for this {tab === "doctors" ? "doctor" : "receptionist"}</label>}/>}
        {form.formState.errors.confirmInherited && <p className="field-error wide" role="alert">{String(form.formState.errors.confirmInherited.message)}</p>}
      </>}
    </FormSection></div>}
    <FormActions busy={save.isPending||scheduleBusy} cancelClosesDialog submitLabel={initial.id ? tab==="doctors"?"Save Doctor Details":"Save Changes" : `Add ${tab==="doctors"?"Doctor":tab==="admins"?"Clinic Admin":"Receptionist"}`} busyLabel={initial.id ? "Saving…" : "Adding…"} submitTestId="button-save-staff" cancelTestId="button-cancel-staff" secondary={save.error ? <ErrorNotice error={save.error} /> : undefined} />
    {savedMessage&&<p className="notice wide" role="status">{savedMessage}</p>}
    {initial.id&&initial.invitationStatus==="failed"&&<div className="wide">
      <p role="status">This staff record is saved. Its invitation has not been sent.</p>
      <button type="button" data-testid="button-resend-saved-invitation" disabled={save.isPending||scheduleBusy||resendSavedInvitation.isPending||!!staffInvitationRestriction(initial,tab)} title={staffInvitationRestriction(initial,tab)||undefined} onClick={()=>resendSavedInvitation.mutate()}>{resendSavedInvitation.isPending?"Sending…":"Resend Invitation"}</button>
      {resendSavedInvitation.error&&<ErrorNotice error={resendSavedInvitation.error}/>}
    </div>}
  </form></Form>
  {tab==="doctors"&&<DoctorScheduleContext doctor={initial} autoFocus={scheduleEntry} profileBusy={save.isPending} assignmentDirty={JSON.stringify([selectedClinics,selectedBranches])!==JSON.stringify([initial.clinicIds||[],initial.branchIds||[]])} onDirtyChange={setScheduleDirty} onBusyChange={setScheduleBusy}/>}
  </div>;
}