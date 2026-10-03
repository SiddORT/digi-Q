import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useGetCustomRoles, getGetCustomRolesQueryKey, useSaveCustomRoles, useGetPermissionPolicy, getGetPermissionPolicyQueryKey, useGetSystemUsers, getGetSystemUsersQueryKey } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { LoadingButton } from "./LoadingButton";
import { SearchableSelect } from "./SearchableSelect";
import { label } from "./permission-matrix";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { BASE_ROLES, type BaseRole, type CustomRole, type CustomRoleConfig, type RoleBinding, type SystemUser, addBinding, bindingError, bindingsFor, capKey, configsEqual, deleteRole, newRoleId, removeBinding, upsertRole, validateRole } from "./custom-roles";

const status = (e: any) => e?.status ?? e?.response?.status;
type UsersParams = Parameters<typeof useGetSystemUsers>[0];

/** Super Admin only (rendered below AccessRules). Custom roles inherit a base role and only remove baseline actions. */
export function CustomRoles() {
  const queryClient = useQueryClient();
  const queryKey = getGetCustomRolesQueryKey();
  const query = useGetCustomRoles({ query: { queryKey } });
  const policy = useGetPermissionPolicy({ query: { queryKey: getGetPermissionPolicyQueryKey() } });
  const save = useSaveCustomRoles();
  const server = query.data as CustomRoleConfig | undefined;
  const base = useRef<CustomRoleConfig | null>(null);
  const [draft, setDraft] = useState<CustomRoleConfig | null>(null);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<CustomRole | null>(null);
  const names = useRef(new Map<string, SystemUser>());

  const dirty = !!draft && !!base.current && !configsEqual(draft, base.current);
  useEffect(() => {
    if (!server) return;
    if (base.current && base.current.revision !== server.revision && dirty) { setConflict(true); return; }
    if (!base.current || base.current.revision !== server.revision) { base.current = server; setDraft(server); }
  }, [server, dirty]);

  const modules = policy.data?.modules ?? [];
  const actions = policy.data?.actions ?? [];

  function commitRole(role: CustomRole) { setNotice(""); setDraft(d => (d ? upsertRole(d, role) : d)); }
  function run() {
    if (!draft || !base.current) return;
    const payload = { revision: base.current.revision, roles: draft.roles, bindings: draft.bindings };
    save.mutate({ data: payload as never }, {
      onSuccess: (next: unknown) => {
        const saved = next as CustomRoleConfig;
        base.current = saved; setDraft(saved); queryClient.setQueryData(queryKey, saved);
        if (editing) setEditing(saved.roles.find(r => r.id === editing.id) ?? null);
        setConfirm(false); setConflict(false); setNotice("Custom roles saved.");
      },
      onError: e => { setConfirm(false); if (status(e) === 409) setConflict(true); },
    });
  }
  const reload = () => { base.current = null; setConflict(false); save.reset(); setEditing(null); void query.refetch(); };
  const discard = () => { if (base.current) setDraft(base.current); setEditing(null); setNotice(""); save.reset(); };

  const saveBar = <div className="cr-savebar">
    {conflict && <p role="alert" className="error-box" data-testid="status-custom-roles-conflict">Another administrator changed custom roles. Your edits are kept here. <button type="button" onClick={reload}>Load latest (discard my edits)</button></p>}
    {save.isError && !conflict && <p role="alert" className="error-box">Custom roles were not saved. Try again.</p>}
    {notice && <p role="status" className="cr-notice">{notice}</p>}
    <div className="button-group">
      <button type="button" className="button secondary small" disabled={!dirty || save.isPending} onClick={discard} data-testid="button-discard-custom-roles">Discard changes</button>
      <button type="button" className="button small" disabled={!dirty || save.isPending || conflict} onClick={() => setConfirm(true)} data-testid="button-save-custom-roles">Save custom roles</button>
    </div>
  </div>;

  return <section className="panel padded custom-roles" data-testid="custom-roles" aria-labelledby="custom-roles-title">
    <div className="cr-head">
      <div><h2 id="custom-roles-title">Custom roles</h2><p>Named variations of a base role for specific staff.</p></div>
      {!editing && draft && <button type="button" className="button small" onClick={() => setEditing({ id: newRoleId(draft.roles), name: "", baseRole: "receptionist", denied: [] })} data-testid="button-add-custom-role"><Plus size={16} aria-hidden /> New custom role</button>}
    </div>
    <details className="help-disclosure"><summary>How custom roles work</summary><p>A custom role starts from its base role and can only remove actions; it never grants access beyond the base role and never crosses clinic ownership. Assign it to staff who already have that base role. Leave the clinic empty to apply it in all of that person's clinics. When several rules apply, the most restrictive wins, and a restricted action whose clinic is unclear requires a clinic to be chosen.</p></details>
    {query.isLoading || policy.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-custom-roles-loading"><span /><span /><span /></div>
      : query.isError || policy.isError || !draft ? <div role="alert" className="error-box">Custom roles could not be loaded. <button type="button" onClick={() => { void query.refetch(); void policy.refetch(); }}>Retry</button></div>
      : editing ? <RoleEditor key={editing.id} role={editing} config={draft} modules={modules} actions={actions} names={names.current}
          onBack={() => setEditing(null)} onChange={role => { commitRole(role); setEditing(role); }} onConfig={c => { setNotice(""); setDraft(c); }} />
      : <RoleList config={draft} names={names.current} onEdit={setEditing} onDelete={setDeleting} />}
    {draft && saveBar}

    <AppDialog open={confirm} onClose={() => !save.isPending && setConfirm(false)} title="Save custom roles?" busy={save.isPending}>
      <p>Changes take effect immediately for every assigned staff member. Base-role rules, clinic ownership and workflow checks still apply.</p>
      <div className="form-footer"><button type="button" onClick={() => setConfirm(false)} disabled={save.isPending}>Keep editing</button><LoadingButton className="button" loading={save.isPending} onClick={run} data-testid="button-confirm-custom-roles">Save now</LoadingButton></div>
    </AppDialog>
    {deleting && draft && <DeleteRoleDialog role={deleting} count={bindingsFor(draft, deleting.id).length} onCancel={() => setDeleting(null)} onConfirm={removeAll => {
      const result = deleteRole(draft, deleting.id, removeAll);
      if ("blocked" in result) return;
      setDraft(result); setDeleting(null); if (editing?.id === deleting.id) setEditing(null); setNotice("Role removed from the draft. Save to apply.");
    }} />}
  </section>;
}

function DeleteRoleDialog({ role, count, onCancel, onConfirm }: { role: CustomRole; count: number; onCancel: () => void; onConfirm: (removeBindings: boolean) => void }) {
  const [ack, setAck] = useState(false);
  return <AppDialog open onClose={onCancel} title={`Delete ${role.name || "custom role"}?`}>
    {count ? <><p>This role is assigned {count} time{count === 1 ? "" : "s"}. Remove the assignments first, or remove them together with the role.</p>
      <label className="check-label"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} data-testid="checkbox-remove-bindings" /> Also remove its {count} assignment{count === 1 ? "" : "s"}</label></>
      : <p>The role has no assignments. It is removed when you save custom roles.</p>}
    <div className="form-footer"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="button danger" disabled={!!count && !ack} onClick={() => onConfirm(!!count)} data-testid="button-confirm-delete-role">Delete role</button></div>
  </AppDialog>;
}

function RoleList({ config, names, onEdit, onDelete }: { config: CustomRoleConfig; names: Map<string, SystemUser>; onEdit: (r: CustomRole) => void; onDelete: (r: CustomRole) => void }) {
  if (!config.roles.length) return <div className="empty" data-testid="state-custom-roles-empty"><h3>No custom roles yet</h3><p>Create one to narrow what specific staff can do.</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>Role</th><th>Base role</th><th>Restrictions</th><th>Assigned</th><th className="col-actions"><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {config.roles.map(r => { const b = bindingsFor(config, r.id); return <tr key={r.id} data-testid={`row-custom-role-${r.id}`}>
      <td><strong>{r.name}</strong></td><td>{label(r.baseRole)}</td><td>{r.denied.length ? `${r.denied.length} removed` : "Same as base"}</td>
      <td>{b.length ? b.slice(0, 2).map(x => names.get(x.userId)?.fullName || "Staff member").join(", ") + (b.length > 2 ? ` +${b.length - 2}` : "") : "—"}</td>
      <td><div className="row-actions" style={{ justifyContent: "flex-end", display: "flex" }}><button type="button" onClick={() => onEdit(r)} data-testid={`button-edit-role-${r.id}`}>Edit</button><button type="button" className="danger" onClick={() => onDelete(r)} aria-label={`Delete ${r.name}`}><Trash2 size={14} aria-hidden /></button></div></td>
    </tr>; })}
  </tbody></table></div>;
}

function RoleEditor({ role, config, modules, actions, names, onBack, onChange, onConfig }: { role: CustomRole; config: CustomRoleConfig; modules: string[]; actions: string[]; names: Map<string, SystemUser>; onBack: () => void; onChange: (r: CustomRole) => void; onConfig: (c: CustomRoleConfig) => void }) {
  const [local, setLocal] = useState<CustomRole>(role);
  const [touched, setTouched] = useState(false);
  const exists = config.roles.some(r => r.id === role.id);
  const error = validateRole(local, config.roles);
  const denied = useMemo(() => new Set(local.denied), [local.denied]);
  const update = (patch: Partial<CustomRole>) => setLocal(l => ({ ...l, ...patch }));
  const toggle = (key: string, allow: boolean) => update({ denied: allow ? local.denied.filter(k => k !== key) : [...local.denied, key] });
  const setRow = (m: string, allow: boolean) => { const keys = actions.map(a => capKey(m, a)); update({ denied: allow ? local.denied.filter(k => !keys.includes(k)) : [...new Set([...local.denied, ...keys])] }); };
  const baseChanged = exists && config.roles.find(r => r.id === role.id)?.baseRole !== local.baseRole;
  const apply = () => { setTouched(true); if (!error) onChange(local); };
  const pending = !exists || JSON.stringify(config.roles.find(r => r.id === role.id)) !== JSON.stringify({ ...local, name: local.name.trim(), denied: [...new Set(local.denied)].sort() });

  return <div className="cr-editor" data-testid="custom-role-editor">
    <div className="cr-editor-bar"><button type="button" onClick={onBack} data-testid="button-back-custom-roles"><ArrowLeft size={15} aria-hidden /> All custom roles</button>{!exists && <span className="badge">New</span>}</div>
    <div className="cr-fields">
      <label>Role name<input value={local.name} maxLength={80} onChange={e => update({ name: e.target.value })} onBlur={() => setTouched(true)} aria-invalid={touched && !!error} data-testid="input-custom-role-name" /></label>
      <SearchableSelect label="Base role" value={local.baseRole} onChange={v => { if (v) update({ baseRole: v as BaseRole }); }} options={BASE_ROLES.map(r => ({ value: r, label: label(r) }))} testId="select-base-role" />
      <div className="cr-apply"><button type="button" className="button small" disabled={!pending} onClick={apply} data-testid="button-apply-role">{exists ? "Apply to draft" : "Add to draft"}</button></div>
    </div>
    {touched && error && <p role="alert" className="field-error">{error}</p>}
    {baseChanged && <p className="notice" role="status">Changing the base role removes this role's current assignments when applied.</p>}
    <h3 className="cr-sub">Allowed actions <small>Unchecked actions are removed from {label(local.baseRole)}.</small></h3>
    {!modules.length ? <p className="muted">No restrictable actions are defined.</p> :
      <div className="table-wrap cr-matrix"><table><thead><tr><th scope="col">Module</th>{actions.map(a => <th key={a} scope="col">{label(a)}</th>)}<th scope="col"><span className="sr-only">Row</span></th></tr></thead><tbody>
        {modules.map(m => <tr key={m}><th scope="row">{label(m)}</th>{actions.map(a => { const k = capKey(m, a); return <td key={a}><input type="checkbox" checked={!denied.has(k)} onChange={e => toggle(k, e.target.checked)} aria-label={`${label(m)}: ${label(a)}`} data-testid={`cap-${m}-${a}`} /></td>; })}
          <td><button type="button" onClick={() => setRow(m, denied.size > 0 && actions.some(a => denied.has(capKey(m, a))))}>{actions.some(a => denied.has(capKey(m, a))) ? "Allow all" : "Remove all"}</button></td></tr>)}
      </tbody></table></div>}
    {exists && !baseChanged ? <Bindings role={config.roles.find(r => r.id === role.id)!} config={config} names={names} onConfig={onConfig} />
      : <p className="muted cr-sub">Add the role to the draft to assign staff.</p>}
  </div>;
}

function Bindings({ role, config, names, onConfig }: { role: CustomRole; config: CustomRoleConfig; names: Map<string, SystemUser>; onConfig: (c: CustomRoleConfig) => void }) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [userId, setUserId] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [err, setErr] = useState("");
  const params = { page: 1, search: debounced || undefined, role: role.baseRole, status: "active" } as UsersParams;
  const users = useGetSystemUsers(params, { query: { queryKey: getGetSystemUsersQueryKey(params), placeholderData: (p: unknown) => p } as never });
  const known = useMemo(() => { const list = ((users.data as { data?: SystemUser[] } | undefined)?.data) ?? []; list.forEach(u => names.set(u.id, u)); return list; }, [users.data, names]);
  const selected = known.find(u => u.id === userId) || names.get(userId) || null;
  const list = bindingsFor(config, role.id);
  const add = () => {
    const e = bindingError(role, selected, clinicId, config);
    if (e) { setErr(e); return; }
    onConfig(addBinding(config, { userId, roleId: role.id, clinicId: clinicId || undefined }));
    setUserId(""); setClinicId(""); setErr("");
  };
  return <div className="cr-bindings">
    <h3 className="cr-sub">Assigned staff <small>{list.length}</small></h3>
    <div className="cr-bind-form">
      <SearchableSelect label={`Staff member (${label(role.baseRole)})`} value={userId} onChange={v => { setUserId(v); setClinicId(""); setErr(""); }} onSearchChange={setSearch} loading={users.isFetching} error={users.isError ? "Unable to load staff." : undefined} onRetry={() => void users.refetch()}
        options={known.map(u => ({ value: u.id, label: `${u.fullName} · ${u.email}` }))} placeholder="Search active staff…" testId="select-binding-user" />
      <SearchableSelect label="Clinic" value={clinicId} onChange={v => { setClinicId(v); setErr(""); }} disabled={!selected} placeholder="All of their clinics"
        options={[{ value: "", label: "All of their clinics" }, ...(selected?.clinics ?? []).map(c => ({ value: c.id, label: c.name }))]} testId="select-binding-clinic" />
      <button type="button" className="button small" disabled={!userId} onClick={add} data-testid="button-add-binding"><Plus size={15} aria-hidden /> Assign</button>
    </div>
    {err && <p role="alert" className="field-error">{err}</p>}
    {list.length ? <ul className="cr-bind-list">{list.map((b: RoleBinding) => { const u = names.get(b.userId); const clinic = b.clinicId ? (u?.clinics.find(c => c.id === b.clinicId)?.name || "Selected clinic") : "All of their clinics"; return <li key={`${b.userId}:${b.clinicId || ""}`}>
      <span><strong>{u?.fullName || "Staff member"}</strong>{u?.email && <small> {u.email}</small>}</span><span className="muted">{clinic}</span>
      <button type="button" onClick={() => onConfig(removeBinding(config, b))} aria-label={`Remove assignment for ${u?.fullName || "staff member"}`} data-testid={`button-remove-binding-${b.userId}`}><X size={14} aria-hidden /></button></li>; })}</ul>
      : <p className="muted">No staff assigned.</p>}
  </div>;
}
