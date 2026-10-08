import { HelpTip } from "./HelpTip";
import { SearchableSelect } from "./SearchableSelect";
import { Link, useSearch, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPermissionPolicy, getGetPermissionPolicyQueryKey, useSavePermissionPolicy, useGetCustomRoles, getGetCustomRolesQueryKey } from "@workspace/api-client-react";
import { CustomRolePermissions } from "./CustomRolePermissions";
import type { CustomRoleConfig } from "./custom-roles";
import { systemSelection, customSelection, roleDestination } from "./role-selection";
import { useConfirm } from "./ConfirmDialog";
import { AppDialog } from "./AppDialog";
import { LoadingButton } from "./LoadingButton";
import { SUPER_ADMIN, permKey, isAllowed, toggle, sameSet, serialize, label } from "./permission-matrix";

const status = (e: any) => e?.status ?? e?.response?.status;

/** Super Admin only (gated by caller). Edits baseline action restrictions; never custom grants. */
export function AccessRules({onRoleChange,onDirtyChange}:{onRoleChange?:(role:string)=>void;onDirtyChange?:(dirty:boolean)=>void}={}) {
  const queryClient = useQueryClient();
  const queryKey = getGetPermissionPolicyQueryKey();
  const policy = useGetPermissionPolicy({ query: { queryKey } });
  const save = useSavePermissionPolicy();
  const [denied, setDenied] = useState<Set<string>>(new Set());
   const search=useSearch();const [,navigate]=useLocation();
   const custom=useGetCustomRoles({query:{queryKey:getGetCustomRolesQueryKey()}});
   const config=custom.data as CustomRoleConfig|undefined;
   const [customDirty,setCustomDirty]=useState<Record<string,boolean>>({});
  const confirmNavigation=useConfirm();
  const [module, setModule] = useState("all");
  const [confirm, setConfirm] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const base = useRef<{ revision: number; denied: Set<string> } | null>(null);
  const data = policy.data;

  useEffect(() => {
    if (!data) return;
    if (base.current && base.current.revision !== data.revision && !sameSet(denied, base.current.denied)) { setConflict(true); return; }
    if (!base.current || base.current.revision !== data.revision) {
      const d = new Set(data.denied);
      base.current = { revision: data.revision, denied: d };
      setDenied(new Set(d));
    }
  }, [data, denied]);

   const roles = data?.roles ?? [];
   const selection=new URLSearchParams(search).get("role")??(roles.length?systemSelection(roles[0]):"");
   const role=selection.startsWith("system:")?selection.slice(7):"";
   const selectedCustom=selection.startsWith("custom:")?config?.roles.find(r=>customSelection(r.id)===selection):undefined;
   const valid=roles.includes(role)||!!selectedCustom;
   const choose=async(next:string)=>{
     if(onRoleChange){onRoleChange(next);return;}
     if((dirty||Object.values(customDirty).some(Boolean))&&!await confirmNavigation.ask({title:"Continue without saving?",description:"Your draft is kept in this workspace until reload or leaving the page.",confirmLabel:"Continue"}))return;
     navigate(roleDestination(search,"permissions",next));
   };
   useEffect(()=>{
     if(data&&!new URLSearchParams(search).has("role"))navigate(roleDestination(search,new URLSearchParams(search).get("area")||"permissions",systemSelection(roles[0])),{replace:true});
   },[data,search,navigate]);
  const modules = data?.modules ?? [];
  const actions = data?.actions ?? [];
  const shown = module === "all" ? modules : modules.filter(m => m === module);
  const dirty = !!base.current && !sameSet(denied, base.current.denied);
   useEffect(()=>{onDirtyChange?.(dirty||Object.values(customDirty).some(Boolean));},[dirty,customDirty,onDirtyChange]);
  const changes = useMemo(() => {
    if (!base.current) return 0;
    let n = 0; const b = base.current.denied;
    for (const k of denied) if (!b.has(k)) n++;
    for (const k of b) if (!denied.has(k)) n++;
    return n;
  }, [denied]);

  const set = (key: string, allow: boolean) => { setNotice(""); setDenied(d => toggle(d, key, allow)); };
  const setRow = (m: string, allow: boolean) => { setNotice(""); setDenied(d => actions.reduce((acc, a) => toggle(acc, permKey(role, m, a), allow), d)); };
  const resetLocal = () => { if (base.current) setDenied(new Set(base.current.denied)); setNotice(""); save.reset(); };
  const reload = () => { base.current = null; setConflict(false); save.reset(); void policy.refetch(); };

  function run() {
    if (!base.current) return;
    save.mutate({ data: { revision: base.current.revision, denied: serialize(denied) } }, {
      onSuccess: next => {
        base.current = { revision: next.revision, denied: new Set(next.denied) };
        setDenied(new Set(next.denied));
        queryClient.setQueryData(queryKey, next);
        setConfirm(false); setConflict(false); setNotice("Permission policy saved.");
      },
      onError: e => { setConfirm(false); if (status(e) === 409) setConflict(true); },
    });
  }

  return <section className="panel padded" data-testid="access-rules">
    {confirmNavigation.dialog}
    <div className="panel-heading compact-heading section-head"><div><h2>Access Rules <span data-testid="text-permission-limits"><HelpTip text="A checked box keeps the action allowed; clearing it denies it. Enabling an action never grants more than the built-in rules: clinic ownership, assignments, record ownership and workflow state are still checked by the API on every operation. Super Admin cannot be restricted, so the platform can never be locked out." /></span></h2></div></div>
     {policy.isLoading || custom.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
       : policy.isError || custom.isError || !data || !config ? <div role="alert" className="error-box" data-testid="state-error">The permission policy could not be loaded. <button type="button" onClick={() => {void policy.refetch();void custom.refetch();}} data-testid="button-retry">Retry</button></div>
      : <>
        <div className="filter-bar-row">
           <div className="access-filter"><SearchableSelect label="Role" testId="select-role" value={selection} onChange={v => { if (v) choose(v); }} options={[...roles.map(r => ({ value: systemSelection(r), label: `${label(r)} · System` })),...config.roles.map(r=>({value:customSelection(r.id),label:`${r.name} · Custom (${label(r.baseRole)})`}))]}/></div>
          <div className="access-filter"><SearchableSelect label="Module" testId="select-module" value={module} onChange={v => setModule(v || "all")} options={[{ value: "all", label: "All Modules" }, ...modules.map(m => ({ value: m, label: label(m) }))]}/></div>
          <div className="filter-bar-tools"><span className="muted" data-testid="text-revision">Revision {data.revision}</span><Link className="button secondary small" href="/admin/users">Manage users &amp; assignments</Link></div>
        </div>
         {!valid&&<p role="alert" data-testid="state-invalid-role">This role is unknown or was deleted. Choose a role to view its permissions.</p>}
         {role===SUPER_ADMIN&&<p role="status" data-testid="super-admin-unrestricted">Super Admin is unrestricted and read-only. Its built-in permissions cannot be changed.</p>}
         {config.roles.map(r=><div key={r.id} hidden={selection!==customSelection(r.id)}><CustomRolePermissions config={config} id={r.id} policy={data} onDirtyChange={value=>setCustomDirty(previous=>previous[r.id]===value?previous:{...previous,[r.id]:value})}/></div>)}
         <div hidden={!roles.includes(role)}>
         {!roles.length ? <p data-testid="state-empty">No restrictable roles are defined.</p> :
        <div className="table-scroll"><table className="perm-matrix" data-testid="table-permissions"><thead><tr><th>Module</th>{actions.map(a => <th key={a} style={{ textAlign: "center" }}>{label(a)}</th>)}<th>Row</th></tr></thead>
          <tbody>{shown.map(m => <tr key={m}><td data-label="Module">{label(m)}</td>
            {actions.map(a => { const k = permKey(role, m, a); const changed = base.current && base.current.denied.has(k) !== denied.has(k);
              return <td key={a} data-label={label(a)} style={{ textAlign: "center", background: changed ? "hsl(45 90% 90%)" : undefined }}>
                 <input type="checkbox" aria-label={`${label(role)} ${label(m)} ${label(a)}`} checked={isAllowed(denied, role, m, a)} disabled={role===SUPER_ADMIN || save.isPending || conflict} onChange={e => set(k, e.target.checked)} data-testid={`checkbox-${k}`} /></td>; })}
             <td data-label="Row"><button type="button" className="button secondary" disabled={role===SUPER_ADMIN||save.isPending||conflict} onClick={() => setRow(m, true)} data-testid={`button-allow-row-${m}`}>All</button> <button type="button" className="button secondary" disabled={role===SUPER_ADMIN||save.isPending||conflict} onClick={() => setRow(m, false)} data-testid={`button-deny-row-${m}`}>None</button></td>
          </tr>)}</tbody></table></div>}
        {conflict && <div role="alert" className="error-box" data-testid="state-conflict">Another Super Admin changed this policy. Your unsaved edits are kept on screen. <button type="button" onClick={reload} data-testid="button-reload">Discard My Edits and Reload</button></div>}
        {save.isError && !conflict && <p role="alert" className="error-box">The policy was not saved. Try again.</p>}
        {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
        <div className="et-actions">
           <LoadingButton type="button" loading={save.isPending} disabled={role===SUPER_ADMIN || !dirty || conflict || save.isPending} onClick={() => setConfirm(true)} data-testid="button-save-permissions">Save policy{changes ? ` (${changes})` : ""}</LoadingButton>
           <button type="button" className="button secondary" disabled={role===SUPER_ADMIN || !dirty || save.isPending} onClick={resetLocal} data-testid="button-reset-local">Reset Changes</button>
        </div>
         </div>
      </>}
    <AppDialog open={confirm} onClose={() => !save.isPending && setConfirm(false)} title="Save permission policy?" busy={save.isPending}>
      <div className="et-dialog"><p>{changes} change{changes === 1 ? "" : "s"} take effect immediately for every user in the affected roles. Built-in ownership and workflow rules still apply; Super Admin is unaffected.</p>
        <div className="et-actions">
          <LoadingButton type="button" loading={save.isPending} onClick={run} data-testid="button-confirm-save">Save policy</LoadingButton>
          <button type="button" className="button secondary" disabled={save.isPending} onClick={() => setConfirm(false)} data-testid="button-confirm-cancel">Go Back</button>
        </div></div>
    </AppDialog>
  </section>;
}
