import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "./ConfirmDialog";
import { friendlyError } from "../lib/friendly-error";
import { notifySuccess } from "../lib/notify";
import { AssignmentSummary } from "./AssignmentSummary";
import { ShieldCheck, UserCheck, UserX } from "lucide-react";
import { IconAction } from "./IconAction";
import { Link } from "wouter";
import { useGetSystemUsers, getSystemUsers, getUser, updateUser, getGetSystemUsersQueryKey, useGetPermissionPolicy, getGetPermissionPolicyQueryKey, useGetCustomRoles, getGetCustomRolesQueryKey } from "@workspace/api-client-react";
import { FilterBar, Pagination, SearchInput, useDebouncedValue, listingSuggestions } from "./ListingControls";
import { AppDialog } from "./AppDialog";
import { SearchableSelect } from "./SearchableSelect";
import { ResourceLookup } from "./ResourceLookup";
import { label } from "./permission-matrix";
import { useTableColumns, readTableColumns, writeTableColumns } from "./TableColumns";
import { SavedViews } from "./ListingViewControls";
import { useListingLayout } from "@/lib/listing-views";
import { OverflowText } from "./OverflowText";
const SYSTEM_USER_VIEW_KEYS = ["role", "status", "clinicId"];
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { CustomRoleConfig, SystemUser } from "./custom-roles";
import { SearchableSelect as ScopeSelect } from "./SearchableSelect";

type Params = Parameters<typeof useGetSystemUsers>[0];
interface Page { data: SystemUser[]; total: number; page: number; pageSize: number }
export interface EffectiveRow { module: string; action: string; denied: boolean; sources: string[] }
/** Union of baseline role denials and the user's custom-role bindings in scope.
 * clinicId "" = platform: only bindings without a clinic (apply to all their scopes) are included. */
export function effectivePermissions(user: Pick<SystemUser, "id" | "role">, policy: { modules: string[]; actions: string[]; denied: string[] }, config: Pick<CustomRoleConfig, "roles" | "bindings"> | undefined, clinicId: string) {
  const base = new Set(policy.denied);
  const roleById = new Map((config?.roles ?? []).map(r => [r.id, r]));
  const mine = (config?.bindings ?? []).filter(b => b.userId === user.id && roleById.get(b.roleId)?.baseRole === user.role);
  const applied = mine.filter(b => !b.clinicId || b.clinicId === clinicId);
  const pending = clinicId ? [] : mine.filter(b => !!b.clinicId);
  const rows: EffectiveRow[] = [];
  for (const module of policy.modules) for (const action of policy.actions) {
    const sources: string[] = [];
    if (base.has(`${user.role}:${module}:${action}`)) sources.push("Base role policy");
    for (const b of applied) { const r = roleById.get(b.roleId)!; if (r.denied.includes(`${module}:${action}`) && !sources.includes(r.name)) sources.push(r.name); }
    rows.push({ module, action, denied: user.role !== "superAdmin" && sources.length > 0, sources: user.role === "superAdmin" ? [] : sources });
  }
  return { rows, applied: applied.map(b => ({ ...b, roleName: roleById.get(b.roleId)!.name })), pending: pending.map(b => ({ ...b, roleName: roleById.get(b.roleId)!.name })) };
}

function EffectivePanel({ user }: { user: SystemUser }) {
  const [clinicId, setClinicId] = useState("");
  const [onlyDenied, setOnlyDenied] = useState(false);
  const policy = useGetPermissionPolicy({ query: { queryKey: getGetPermissionPolicyQueryKey() } });
  const roles = useGetCustomRoles({ query: { queryKey: getGetCustomRolesQueryKey() } });
  const result = useMemo(() => policy.data ? effectivePermissions(user, policy.data, roles.data as CustomRoleConfig | undefined, clinicId) : null, [policy.data, roles.data, user, clinicId]);
  const clinicName = (id?: string | null) => user.clinics.find(c => c.id === id)?.name || "Selected clinic";
  if (policy.isLoading || roles.isLoading) return <div className="skeleton" role="status">Loading effective permissions…</div>;
  if (policy.error || roles.error || !result) return <div className="error-box" role="alert">Effective permissions could not be loaded. <button type="button" onClick={() => { void policy.refetch(); void roles.refetch(); }}>Retry</button></div>;
  const rows = onlyDenied ? result.rows.filter(r => r.denied) : result.rows;
  return <div className="su-effective" data-testid={`effective-${user.id}`}>
    <div className="su-effective-bar">
      <ScopeSelect label="Scope" value={clinicId || "platform"} onChange={value => setClinicId(value === "platform" ? "" : value)} options={[{ value: "platform", label: "Platform (All-Scope Assignments Only)" }, ...user.clinics.map(c => ({ value: c.id, label: c.name }))]} testId={`select-effective-scope-${user.id}`} />
      <label className="check-label"><input type="checkbox" checked={onlyDenied} onChange={e => setOnlyDenied(e.target.checked)} /> Denied only</label>
      <span className="muted">{result.rows.filter(r => r.denied).length} denied of {result.rows.length}</span>
    </div>
    <p className="muted">"Not restricted" only means no rule removes the action. Built-in clinic ownership, assignments and workflow checks still apply.{user.role === "superAdmin" && " Super Admin cannot be restricted."}</p>
    {result.applied.length > 0 && <p className="muted">Custom roles in scope: {result.applied.map(b => `${b.roleName}${b.clinicId ? ` (${clinicName(b.clinicId)})` : " (all clinics)"}`).join(", ")}</p>}
    {result.pending.length > 0 && <p className="notice" role="status">Clinic-specific assignments not included: {result.pending.map(b => `${b.roleName} at ${clinicName(b.clinicId)}`).join(", ")}. Choose a clinic to include them.</p>}
    {rows.length ? <div className="table-wrap"><table><thead><tr><th>Module</th><th>Action</th><th>Effective</th><th>Source</th></tr></thead><tbody>
      {rows.map(r => <tr key={`${r.module}:${r.action}`}><td>{label(r.module)}</td><td>{label(r.action)}</td><td>{r.denied ? <span className="badge danger">Denied</span> : <span className="muted">Not restricted</span>}</td><td>{r.sources.join(", ") || "—"}</td></tr>)}
    </tbody></table></div> : <p className="muted">No denied actions in this scope.</p>}
  </div>;
}

const ROLES = ["superAdmin", "clinicAdmin", "doctor", "receptionist"];

/** Super Admin only. Staff account directory with safe status changes; no credentials are shown. */
export function SystemUsers() {
  const client=useQueryClient();const confirmAction=useConfirm();const statusLock=useRef(false);
  const [statusError,setStatusError]=useState("");
  const statusUpdate=useMutation({
    mutationFn:async({user,next}:{user:SystemUser;next:"active"|"inactive"})=>{
      const current=await getUser(user.id);
      return updateUser(user.id,{fullName:current.fullName,email:current.email,mobile:current.mobile||undefined,role:current.role,status:next});
    },
    onSuccess:async()=>{setStatusError("");notifySuccess("Account status updated.");await client.invalidateQueries();},
    onError:error=>setStatusError(friendlyError(error,"save")),
  });
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState("");
  useEffect(() => setPage(1), [debounced, role, status, clinicId]);
  const params = { page, search: debounced || undefined, role: role || undefined, status: status || undefined, clinicId: clinicId || undefined } as Params;
  const q = useGetSystemUsers(params, { query: { queryKey: getGetSystemUsersQueryKey(params), placeholderData: (p: unknown) => p, refetchOnWindowFocus: true } as never });
  const data = q.data as Page | undefined;
  const countParams={...params,page:1,status:undefined};
  const counts=useQueries({queries:["","active","inactive"].map(value=>({
    queryKey:getGetSystemUsersQueryKey({...countParams,status:value||undefined}),
    queryFn:()=>getSystemUsers({...countParams,status:value||undefined}),
    staleTime:15000,
  }))});
  useEffect(()=>{if(data&&page>Math.max(1,Math.ceil(data.total/data.pageSize)))setPage(Math.max(1,Math.ceil(data.total/data.pageSize)));},[data,page]);
  const active = !!(search || role || status || clinicId);
  const [draft, setDraft] = useState({ role: "", status: "", clinicId: "" });
  const reset = () => { setSearch(""); setRole(""); setStatus(""); setClinicId(""); setDraft({ role: "", status: "", clinicId: "" }); };

  const me = useGetMe({ query: { queryKey: getGetMeQueryKey(), staleTime: 60000 } });
  const cols = useTableColumns("system-users", me.data?.user?.id, me.data?.user?.role, [{ key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "role", label: "Role" }, ...(!status ? [{ key: "status", label: "Status" }] : []), { key: "clinics", label: "Clinics" }]);
  const viewer = me.data?.user;
  const statusReason=(u:SystemUser)=>viewer?.role!=="superAdmin"?"Only Super Admin can change account status.":u.status==="active"&&u.id===viewer?.id?"You cannot deactivate your own account.":u.status==="active"&&u.role==="clinicAdmin"&&u.clinics.length?"Transfer clinic and staff ownership before deactivating this administrator.":undefined;
  const changeStatus=async(user:SystemUser)=>{
    if(statusLock.current||statusReason(user))return;
    statusLock.current=true;
    const next=user.status==="active"?"inactive":"active";
    try{
      if(!await confirmAction.ask({title:`${next==="inactive"?"Deactivate":"Activate"} ${user.fullName}?`,description:`${user.email} · ${label(user.role)}. ${next==="inactive"?"They will lose access and their existing sessions will be revoked. Historical records are preserved.":"They can sign in again using their existing credentials. Revoked sessions stay revoked; roles and assignments do not change."}`,confirmLabel:next==="inactive"?"Deactivate":"Activate",tone:next==="inactive"?"danger":undefined}))return;
      setStatusError("");await statusUpdate.mutateAsync({user,next}).catch(()=>{/* visible error above listing */});
    }finally{statusLock.current=false;}
  };
  const sysLayout = useListingLayout("system-users", viewer?.id, viewer?.role, SYSTEM_USER_VIEW_KEYS);
  const sysFilters: Record<string, string> = { role, status, clinicId };
  const sysCols = () => readTableColumns("system-users", viewer?.id, viewer?.role);
  const systemViews = <SavedViews canShare={sysLayout.canShare} legacyViews={sysLayout.legacyViews} onImport={sysLayout.importLegacyView} views={sysLayout.layout.views} canSave={Object.values(sysFilters).some(Boolean) || !!sysCols()} onSave={view=>sysLayout.saveView(view, sysFilters, sysCols())} onDelete={sysLayout.deleteView}
    onApply={v => { writeTableColumns("system-users", viewer?.id, viewer?.role, v.columns); setRole(v.filters.role || ""); setStatus(["active", "inactive"].includes(v.filters.status) ? v.filters.status : ""); setClinicId(v.filters.clinicId || ""); }} />;
  const sysCell = (k: string, u: SystemUser) => k === "name" ? <OverflowText as="strong" value={u.fullName} testId={`text-system-user-${u.id}`}/> : k === "email" ? <OverflowText value={u.email}/> : k === "role" ? label(u.role) : k === "status" ? <span className={`badge ${u.status === "active" ? "" : "muted"}`}>{label(u.status)}</span> : k === "clinics" ? (u.clinics.length ? <AssignmentSummary owner={u.fullName} clinics={u.clinics.map(c => c.name)} testId={`button-system-assignments-${u.id}`}/> : <span className="muted">{u.role === "superAdmin" ? "Platform-wide" : "None"}</span>) : null;
  return <>
    {confirmAction.dialog}
    {statusError&&<p role="alert" className="error-box">{statusError} <button onClick={()=>setStatusError("")}>Dismiss</button></p>}
    {statusUpdate.isPending&&<p role="status">Updating account status for {statusUpdate.variables.user.fullName}…</p>}
    {counts.some(c=>c.error)&&<p role="alert">Account status counts could not be loaded. <button onClick={()=>counts.forEach(c=>void c.refetch())}>Retry Counts</button></p>}
    <p className="muted" data-testid="system-status-counts">{["All","Active","Inactive"].map((name,index)=>`${name}: ${counts[index].error?"Unavailable":counts[index].data?.total??"…"}`).join(" · ")}</p>
    <FilterBar label="System User Filters"
      active={active} onReset={reset} activeCount={[role, status, clinicId].filter(Boolean).length}
      onOpen={() => setDraft({ role, status, clinicId })}
      onApply={() => { setRole(draft.role); setStatus(draft.status); setClinicId(draft.clinicId); }}
      advanced={<><SearchableSelect label="Account Status" testId="select-system-user-status" value={draft.status || "all"} onChange={v => setDraft(d => ({ ...d, status: v === "active" || v === "inactive" ? v : "" }))} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /><SearchableSelect label="Role" value={draft.role} onChange={v => setDraft(d => ({ ...d, role: v }))} placeholder="All roles" options={[{ value: "", label: "All Roles" }, ...ROLES.map(r => ({ value: r, label: label(r) }))]} testId="select-system-user-role" /><ResourceLookup resource="clinics" label="Clinic" value={draft.clinicId} onChange={v => setDraft(d => ({ ...d, clinicId: v }))} /></>}
      chips={[...(status ? [{ key: "adv:status", label: label(status), onRemove: () => setStatus("") }] : []), ...(role ? [{ key: "adv:role", label: label(role), onRemove: () => setRole("") }] : []), ...(clinicId ? [{ key: "adv:clinic", label: "Clinic Selected", onRemove: () => setClinicId("") }] : [])]}

      secondary={<><Link className="button secondary small" href="/admin/permissions">Roles &amp; Permissions</Link>{cols.settings}{systemViews}</>}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" suggestions={q.error||q.isPlaceholderData?[]:listingSuggestions(data?.data,u=>({id:u.id,label:u.fullName,description:u.email,value:u.fullName}))} loading={q.isFetching} error={q.error?"Accounts could not be loaded.":null} onRetry={()=>void q.refetch()} total={data?.total} settledQuery={debounced} scopeKey={JSON.stringify({role,status,clinicId})} />
    </FilterBar>
    <section className="panel table-panel admin-listing-table" aria-busy={q.isFetching} data-testid="system-users">
      {q.isLoading ? <div className="skeleton" role="status">Loading accounts…</div>
        : q.error ? <div className="error-box" role="alert">Accounts could not be loaded. <button type="button" onClick={() => void q.refetch()}>Retry</button></div>
         : data?.data.length ? <><div className="table-wrap"><table><thead><tr>{cols.visible.map(k => <th key={k} className={cols.cls(k)}>{cols.label(k)}</th>)}<th className="col-actions sticky"><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {data.data.map(u => <Fragment key={u.id}><tr data-testid={`row-system-user-${u.id}`}>{cols.visible.map((k, ci) => <td key={k} data-label={cols.label(k)} className={cols.cls(k)}>{ci === 0 && cols.hidden.length ? <span className="row-lead">{cols.toggle(u.id, u.fullName)}{sysCell(k, u)}</span> : sysCell(k, u)}</td>)}
             <td data-label="Actions" className="col-actions sticky"><div className="row-actions"><IconAction label={`View effective permissions for ${u.fullName}`} hint="Effective permissions" icon={<ShieldCheck size={15} aria-hidden />} onClick={() => setExpanded(u.id)} testId={`button-effective-${u.id}`} /><IconAction label={`${u.status==="active"?"Deactivate":"Activate"} ${u.fullName}`} hint={statusUpdate.isPending&&statusUpdate.variables?.user.id===u.id?"Updating account…":u.status==="active"?"Deactivate account":"Activate account"} icon={u.status==="active"?<UserX size={15}/>:<UserCheck size={15}/>} tone={u.status==="active"?"danger":undefined} disabled={statusUpdate.isPending||!!statusReason(u)||q.isPlaceholderData||q.isFetching} disabledReason={statusReason(u)} onClick={()=>void changeStatus(u)} testId={`button-status-${u.id}`}/></div></td></tr>{cols.expansion(u.id, cols.visible.length + 1, k => sysCell(k, u))}</Fragment>)}
        </tbody></table></div><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} /></>
        : <div className="empty" data-testid="status-empty"><h3>{active ? "No matching accounts" : "No accounts yet"}</h3>{active && <button type="button" onClick={reset}>Clear Filters</button>}</div>}
    </section>
    {(() => { const u = data?.data.find(x => x.id === expanded); return u ? <AppDialog open variant="drawer" onClose={() => setExpanded("")} title={`Effective Permissions · ${u.fullName}`} description={`${label(u.role)} · ${u.email}`}><EffectivePanel user={u} /></AppDialog> : null; })()}
  </>;
}
