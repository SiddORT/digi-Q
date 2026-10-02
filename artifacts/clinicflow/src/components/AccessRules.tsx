import { SearchableSelect } from "./SearchableSelect";
import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPermissionPolicy, getGetPermissionPolicyQueryKey, useSavePermissionPolicy } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { LoadingButton } from "./LoadingButton";
import { SUPER_ADMIN, permKey, isAllowed, toggle, sameSet, serialize, label } from "./permission-matrix";

const status = (e: any) => e?.status ?? e?.response?.status;

/** Super Admin only (gated by caller). Edits baseline action restrictions; never custom grants. */
export function AccessRules() {
  const queryClient = useQueryClient();
  const queryKey = getGetPermissionPolicyQueryKey();
  const policy = useGetPermissionPolicy({ query: { queryKey } });
  const save = useSavePermissionPolicy();
  const [denied, setDenied] = useState<Set<string>>(new Set());
  const [role, setRole] = useState("");
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

  const roles = useMemo(() => (data?.roles ?? []).filter(r => r !== SUPER_ADMIN), [data]);
  useEffect(() => { if (!role && roles.length) setRole(roles[0]); }, [role, roles]);
  const modules = data?.modules ?? [];
  const actions = data?.actions ?? [];
  const shown = module === "all" ? modules : modules.filter(m => m === module);
  const dirty = !!base.current && !sameSet(denied, base.current.denied);
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
    <h2>Roles &amp; access rules</h2>
    <p>Restrict which baseline actions each role may perform. A checked box means the action stays allowed; clearing it denies it.</p>
    <div role="note" className="notice" data-testid="text-permission-limits">
      <strong>Restrictions only.</strong> Enabling an action never grants more than the built-in rules: clinic ownership, assignments, record ownership and workflow state are still checked by the API on every operation. Super Admin cannot be restricted, so the platform can never be locked out.
    </div>
    {policy.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : policy.isError || !data ? <div role="alert" className="error-box" data-testid="state-error">The permission policy could not be loaded. <button type="button" onClick={() => policy.refetch()} data-testid="button-retry">Retry</button></div>
      : <>
        <div className="filter-bar-row">
          <div className="access-filter">Role <SearchableSelect label="Role" testId="select-role" value={role} onChange={v => { if (v) setRole(v); }} options={roles.map(r => ({ value: r, label: label(r) }))}/></div>
          <div className="access-filter">Module <SearchableSelect label="Module" testId="select-module" value={module} onChange={v => setModule(v || "all")} options={[{ value: "all", label: "All modules" }, ...modules.map(m => ({ value: m, label: label(m) }))]}/></div>
          <div className="filter-bar-tools"><span data-testid="text-revision">Revision {data.revision}</span><Link className="button secondary" href="/admin/users">Manage users &amp; assignments</Link></div>
        </div>
        {!roles.length ? <p data-testid="state-empty">No restrictable roles are defined.</p> :
        <div className="table-scroll"><table className="perm-matrix" data-testid="table-permissions"><thead><tr><th>Module</th>{actions.map(a => <th key={a} style={{ textAlign: "center" }}>{label(a)}</th>)}<th>Row</th></tr></thead>
          <tbody>{shown.map(m => <tr key={m}><td data-label="Module">{label(m)}</td>
            {actions.map(a => { const k = permKey(role, m, a); const changed = base.current && base.current.denied.has(k) !== denied.has(k);
              return <td key={a} data-label={label(a)} style={{ textAlign: "center", background: changed ? "hsl(45 90% 90%)" : undefined }}>
                <input type="checkbox" aria-label={`${label(role)} ${label(m)} ${label(a)}`} checked={isAllowed(denied, role, m, a)} disabled={save.isPending || conflict} onChange={e => set(k, e.target.checked)} data-testid={`checkbox-${k}`} /></td>; })}
            <td data-label="Row"><button type="button" className="secondary" disabled={conflict} onClick={() => setRow(m, true)} data-testid={`button-allow-row-${m}`}>All</button> <button type="button" className="secondary" disabled={conflict} onClick={() => setRow(m, false)} data-testid={`button-deny-row-${m}`}>None</button></td>
          </tr>)}</tbody></table></div>}
        {conflict && <div role="alert" className="error-box" data-testid="state-conflict">Another Super Admin changed this policy. Your unsaved edits are kept on screen. <button type="button" onClick={reload} data-testid="button-reload">Discard my edits and reload</button></div>}
        {save.isError && !conflict && <p role="alert" className="error-box">The policy was not saved. Try again.</p>}
        {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
        <div className="et-actions">
          <LoadingButton type="button" loading={save.isPending} disabled={!dirty || conflict || save.isPending} onClick={() => setConfirm(true)} data-testid="button-save-permissions">Save policy{changes ? ` (${changes})` : ""}</LoadingButton>
          <button type="button" className="secondary" disabled={!dirty || save.isPending} onClick={resetLocal} data-testid="button-reset-local">Reset changes</button>
        </div>
      </>}
    <AppDialog open={confirm} onClose={() => !save.isPending && setConfirm(false)} title="Save permission policy?" busy={save.isPending}>
      <div className="et-dialog"><p>{changes} change{changes === 1 ? "" : "s"} take effect immediately for every user in the affected roles. Built-in ownership and workflow rules still apply; Super Admin is unaffected.</p>
        <div className="et-actions">
          <LoadingButton type="button" loading={save.isPending} onClick={run} data-testid="button-confirm-save">Save policy</LoadingButton>
          <button type="button" className="secondary" disabled={save.isPending} onClick={() => setConfirm(false)} data-testid="button-confirm-cancel">Go back</button>
        </div></div>
    </AppDialog>
  </section>;
}
