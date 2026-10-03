import { Fragment, useEffect, useMemo, useState } from "react";
import { AssignmentSummary } from "./AssignmentSummary";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useGetSystemUsers, getGetSystemUsersQueryKey, useGetPermissionPolicy, getGetPermissionPolicyQueryKey, useGetCustomRoles, getGetCustomRolesQueryKey } from "@workspace/api-client-react";
import { FilterBar, Pagination, SearchInput, useDebouncedValue, listingSuggestions } from "./ListingControls";
import { AppDialog } from "./AppDialog";
import { SearchableSelect } from "./SearchableSelect";
import { ResourceLookup } from "./ResourceLookup";
import { label } from "./permission-matrix";
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
      <ScopeSelect label="Scope" value={clinicId} onChange={setClinicId} options={[{ value: "", label: "Platform (all-scope assignments only)" }, ...user.clinics.map(c => ({ value: c.id, label: c.name }))]} testId={`select-effective-scope-${user.id}`} />
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

const ROLES = ["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"];

/** Super Admin only. Read-only directory of every account across clinics; no credentials are shown. */
export function SystemUsers() {
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
  const active = !!(search || role || status || clinicId);
  const reset = () => { setSearch(""); setRole(""); setStatus(""); setClinicId(""); };

  return <>
    <FilterBar label="System user filters"
      title={data && !q.error ? <span className="listing-count-label"><span className="listing-count">{data.total}</span> {data.total === 1 ? "account" : "accounts"}</span> : undefined}
      status={<div className="sq-status-tabs" role="tablist" aria-label="Account status">{[["", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([v, l]) => <button type="button" key={v} role="tab" aria-selected={status === v} onClick={() => setStatus(v)} data-testid={`tab-system-users-${v || "all"}`}>{l}</button>)}</div>}
      active={active} onReset={reset}
      advanced={<><SearchableSelect label="Role" value={role} onChange={setRole} placeholder="All roles" options={[{ value: "", label: "All roles" }, ...ROLES.map(r => ({ value: r, label: label(r) }))]} testId="select-system-user-role" /><ResourceLookup resource="clinics" label="Clinic" value={clinicId} onChange={setClinicId} /></>}
      chips={[...(role ? [{ key: "adv:role", label: label(role), onRemove: () => setRole("") }] : []), ...(clinicId ? [{ key: "adv:clinic", label: "Clinic selected", onRemove: () => setClinicId("") }] : [])]}
      actions={<Link className="button secondary small" href="/admin/permissions">Roles &amp; permissions</Link>}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" suggestions={q.error||q.isPlaceholderData?[]:listingSuggestions(data?.data,u=>({id:u.id,label:u.fullName,description:u.email,value:u.fullName}))} loading={q.isFetching} error={q.error?"Accounts could not be loaded.":null} onRetry={()=>void q.refetch()} total={data?.total} settledQuery={debounced} scopeKey={JSON.stringify({role,status,clinicId})} />
    </FilterBar>
    <section className="panel table-panel" aria-busy={q.isFetching} data-testid="system-users">
      {q.isLoading ? <div className="skeleton" role="status">Loading accounts…</div>
        : q.error ? <div className="error-box" role="alert">Accounts could not be loaded. <button type="button" onClick={() => void q.refetch()}>Retry</button></div>
        : data?.data.length ? <><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th>{!status && <th>Status</th>}<th>Clinics</th><th className="col-actions"><span className="sr-only">Permissions</span></th></tr></thead><tbody>
          {data.data.map(u => <Fragment key={u.id}><tr data-testid={`row-system-user-${u.id}`}><td><strong title={u.fullName}>{u.fullName}</strong></td><td>{u.email}</td><td>{label(u.role)}</td>
            {!status && <td><span className={`badge ${u.status === "active" ? "" : "muted"}`}>{label(u.status)}</span></td>}
            <td>{u.clinics.length ? <AssignmentSummary owner={u.fullName} clinics={u.clinics.map(c => c.name)} testId={`button-system-assignments-${u.id}`}/> : <span className="muted">{u.role === "superAdmin" ? "Platform-wide" : "None"}</span>}</td>
            <td className="col-actions"><button type="button" className="button secondary small" aria-haspopup="dialog" onClick={() => setExpanded(u.id)} data-testid={`button-effective-${u.id}`}>Permissions <ChevronRight size={14} aria-hidden /></button></td></tr></Fragment>)}
        </tbody></table></div><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} /></>
        : <div className="empty" data-testid="status-empty"><h3>{active ? "No matching accounts" : "No accounts yet"}</h3>{active && <button type="button" onClick={reset}>Clear filters</button>}</div>}
    </section>
    {(() => { const u = data?.data.find(x => x.id === expanded); return u ? <AppDialog open variant="drawer" onClose={() => setExpanded("")} title={`Effective permissions · ${u.fullName}`} description={`${label(u.role)} · ${u.email}`}><EffectivePanel user={u} /></AppDialog> : null; })()}
  </>;
}
