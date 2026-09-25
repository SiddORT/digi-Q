import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Trash2, Send } from "lucide-react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { assignmentTargetRole, staffInput, type StaffTab } from "./staff-input";
import { ErrorNotice, Empty, title } from "./resources";
import { Form } from "@/components/ui/form";
import { ResourceLookup, ResourceMultiLookup } from "./components/ResourceLookup";
import { Pagination, SearchInput, FilterBar, useDebouncedValue } from "./components/ListingControls";
import { AppDialog } from "./components/AppDialog";
import { ClinicAdminOnboarding } from "./components/ClinicAdminOnboarding";
import { SearchableSelect } from "./components/SearchableSelect";
import { ListingBulk, useListingSelection } from "./components/AdminListing";
import { HelpTip } from "./components/HelpTip";

const SORTS=[{value:"-createdAt",label:"Newest first"},{value:"createdAt",label:"Oldest first"},{value:"fullName",label:"Name A–Z"},{value:"-fullName",label:"Name Z–A"}];

export function Users({ identity }: { identity: api.Identity }) {
  const settings=api.useGetSettings({query:{queryKey:api.getGetSettingsQueryKey(),staleTime:60000}});
  const role = identity.user!.role;
  const isSuperAdmin = role === "superAdmin";
  const tabs: { id: StaffTab; label: string }[] = [
    ...(isSuperAdmin ? [{ id: "admins" as const, label: "Clinic Admins" }] : []),
    ...(["superAdmin", "clinicAdmin"].includes(role) ? [{ id: "doctors" as const, label: "Doctors" }] : []),
    { id: "receptionists", label: "Receptionists" },
  ];
  const [tab, setTab] = useState<StaffTab>(tabs.find(t => t.id === new URLSearchParams(window.location.search).get("tab"))?.id || tabs[0].id);
  const [contexts, setContexts] = useState<Record<string, any>>({});
  const context = contexts[tab] || { search: "", status: "", clinicId: "", branchId: "", managingAdminId: "", specializationId:"", page: 1, pageSize: 20, sort: "-createdAt" };
  const change = (patch: Record<string, unknown>) => setContexts(previous => ({ ...previous, [tab]: { ...context, ...previous[tab], page: 1, ...patch } }));
  const term = useDebouncedValue(context.search);
  const [editing, setEditing] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
    setRecoveryId("");
    recovery.reset();
  }, [tab]);
  const params = { ...context, search: term || undefined, status: context.status || undefined, clinicId: context.clinicId || undefined, branchId: context.branchId || undefined, specializationId:context.specializationId||undefined, managingAdminId: isSuperAdmin ? context.managingAdminId || undefined : undefined };
  const query = useQuery<any>({
    queryKey: ["users-tab", identity.user?.id, role, tab, params],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: () => tab === "doctors" ? api.listDoctors(params) : api.listUsers({ ...params, role: tab === "admins" ? "clinicAdmin" : "receptionist" }),
  });
  const selectionContext=JSON.stringify([tab,context,term,identity.user,role]);
  const selection=useListingSelection(selectionContext,query.error?[]:query.data?.items||[]);
  useEffect(() => {
    if (query.data && context.page > Math.max(1, Math.ceil(query.data.total / context.pageSize))) change({ page: Math.max(1, Math.ceil(query.data.total / context.pageSize)) });
  }, [query.data, context.page, context.pageSize]);
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => tab === "doctors" ? api.deleteDoctor(id) : api.deleteUser(id),
    onSuccess: () => { setSuccess("Record deleted or deactivated successfully."); client.invalidateQueries(); },
  });
  const [recoveryId, setRecoveryId] = useState("");
  const recovery = api.useRequestUserPasswordReset();
  const resendInvitation = api.useResendUserInvitation({ mutation: { onSuccess: () => { setSuccess("Invitation request completed."); client.invalidateQueries(); } } });
  const active = !!(context.sort !== "-createdAt" || context.search || context.status || context.clinicId || context.branchId || context.managingAdminId || context.specializationId);
  const reset = () => change({ search: "", status: "", clinicId: "", branchId: "", managingAdminId: "", specializationId:"", sort: "-createdAt" });
  const assignmentParams = { targetRole: assignmentTargetRole(tab) };
  const beginEdit = (row: any) => { setDirty(false); setBusy(false); setEditing(row); };
  return <>
    <div className="tabs" role="tablist" aria-label="Staff type">{tabs.map(t => <button role="tab" aria-selected={tab === t.id} key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
    <FilterBar actions={<button className="button small" onClick={() => beginEdit({})} data-testid={`button-add-${tab}`}><Plus size={17} /> Add {tabs.find(t => t.id === tab)?.label.replace(/s$/, "")}</button>} active={active} onReset={reset} label="Filter staff" chips={[
      ...(context.search?[{key:"search",label:`Search: ${context.search}`,onRemove:()=>change({search:""})}]:[]),
      ...(context.clinicId?[{key:"clinicId",label:"Clinic selected",onRemove:()=>change({clinicId:"",branchId:""})}]:[]),
      ...(context.branchId?[{key:"branchId",label:"Branch selected",onRemove:()=>change({branchId:""})}]:[]),
      ...(context.status?[{key:"adv:status",label:`Status: ${title(context.status)}`,onRemove:()=>change({status:""})}]:[]),
      ...(context.specializationId?[{key:"adv:specializationId",label:"Specialization selected",onRemove:()=>change({specializationId:""})}]:[]),
      ...(context.managingAdminId?[{key:"adv:managingAdminId",label:"Managing admin selected",onRemove:()=>change({managingAdminId:""})}]:[]),
      ...(context.sort!=="-createdAt"?[{key:"adv:sort",label:`Sort: ${SORTS.find(o=>o.value===context.sort)?.label}`,onRemove:()=>change({sort:"-createdAt"})}]:[]),
    ]} advanced={<>
      <SearchableSelect label="Status" placeholder="All statuses" value={context.status} onChange={status => change({ status })} options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
      {tab==="doctors"&&<ResourceLookup resource="masters" label="Specialization" params={{category:"specialization"}} value={context.specializationId} onChange={specializationId=>change({specializationId})}/>}
      {isSuperAdmin && tab !== "admins" && <ResourceLookup resource="users" label="Managing admin" params={{role:"clinicAdmin"}} value={context.managingAdminId} onChange={managingAdminId => change({ managingAdminId })} />}
      <SearchableSelect label="Sort" value={context.sort} onChange={sort => change({ sort:sort||"-createdAt" })} options={SORTS}/>
    </>}>
      <SearchInput value={context.search} onChange={search => change({ search })} placeholder={tab==="doctors"?"Search doctors by name, email or specialization…":tab==="receptionists"?"Search receptionists by name, email or mobile…":"Search Clinic Admins by name, email or mobile…"} />
      {tab !== "admins" && <ResourceLookup resource="assignment:clinics" label="Clinic" params={assignmentParams} value={context.clinicId} onChange={clinicId => change({ clinicId, branchId: "" })} />}
      {tab === "receptionists" && <ResourceLookup resource="assignment:branches" label="Branch" params={{ ...assignmentParams, clinicId: context.clinicId || undefined }} value={context.branchId} onChange={branchId => change({ branchId })} />}
    </FilterBar>
    {success && <p role="status" className="notice">{success}</p>}
    <ErrorNotice error={remove.error || resendInvitation.error} />
    <ErrorNotice error={settings.error} />
    {role !== "doctor" && <details className="panel padded" style={{ marginBottom: 14 }}>
      <summary>Account recovery assistance</summary><p className="muted">Search linked staff accounts for secure account recovery steps. This action does not send an email.</p>
      <div className="inline-form"><ResourceLookup resource="users" label="Staff account" params={{ role: tab === "admins" ? "clinicAdmin" : tab === "doctors" ? "doctor" : "receptionist", linkedOnly: true }} value={recoveryId} onChange={id => { setRecoveryId(id); recovery.reset(); }} />
        <button disabled={!recoveryId || recovery.isPending} onClick={() => { if (!recovery.isPending) recovery.mutate({ id: recoveryId }); }} data-testid="button-password-help">{recovery.isPending ? "Loading…" : "Get recovery steps"}</button></div>
      <ErrorNotice error={recovery.error} />{recovery.data && <div className="notice" role="status"><p>{recovery.data.message}</p><Link href="/forgot-password" className="text-link">Open secure password recovery</Link></div>}
    </details>}
    <ListingBulk selection={selection} resource={tab==="doctors"?"doctors":"users"} columns={["fullName","email","mobile","role","clinicNames","branchNames","status"]} identity={identity} context={selectionContext}/>
    <section className="panel table-panel admin-listing-table">
      {query.isLoading ? <div className="skeleton" role="status">Loading {tabs.find(item=>item.id===tab)?.label.toLowerCase()}…</div> : query.error ? <><div className="error-box" role="alert">Unable to load {tabs.find(item=>item.id===tab)?.label.toLowerCase()}. {query.error instanceof Error?query.error.message:"Please try again."}</div><button onClick={() => query.refetch()}>Retry {tabs.find(item=>item.id===tab)?.label.toLowerCase()}</button></> : query.data?.items.length ? <div className="table-scroll"><table>
        <thead><tr><th scope="col" className="col-select">{selection.header}</th><th>Staff member</th>{isSuperAdmin && tab !== "admins" && <th>Managing admin</th>}<th>{tab === "admins" ? "Owned clinics" : "Assignments"}</th><th className="col-status">Account</th><th>Created</th><th className="col-actions">Actions</th></tr></thead>
        <tbody>{query.data.items.map((row: any) => <tr key={row.id}>
          <td data-label="Select" className="col-select">{selection.checkbox(row)}</td>
          <td data-label="Staff member" className="admin-record"><strong>{row.fullName}</strong><small>{row.email} · {tab==="admins"?"Clinic admin":tab==="doctors"?"Doctor":"Receptionist"}{row.mobile?` · ${row.mobile}`:""}</small></td>
          {isSuperAdmin && tab !== "admins" && <td data-label="Managing admin">{row.managingAdminName || row.ownerAdminName || "—"}</td>}
          <td data-label={tab === "admins" ? "Owned clinics" : "Assignments"}><div>{Array.isArray(row.clinicNames) ? row.clinicNames.join(", ") || "—" : row.clinicNames || "—"}</div>{tab !== "admins" && <div className="muted">Branches: {Array.isArray(row.branchNames) ? row.branchNames.join(", ") || "—" : row.branchNames || "—"}</div>}</td>
          <td data-label="Account"><span className={`badge ${row.status}`}>{title(row.status || "")}</span><div>{row.invitationStatus === "notRequired" ? row.clerkId ? row.passwordEnabled === true ? "Password set" : row.passwordEnabled === false ? "Needs password setup" : "Linked · state unavailable" : "—" : row.invitationStatus === "sent" ? "Pending setup" : row.invitationStatus === "failed" ? "Delivery failed" : "—"}</div></td>
          <td data-label="Created">{row.createdAt ? settings.data?.timezone ? new Date(row.createdAt).toLocaleDateString(undefined,{timeZone:settings.data.timezone}) : row.createdAt : "—"}</td>
          <td data-label="Actions" className="col-actions"><div className="row-actions">
            {row.invitationStatus !== "notRequired" && <HelpTip text="Revoke the pending invitation and send a new set-password invitation"><button aria-label="Resend set-password invitation" disabled={resendInvitation.isPending} onClick={() => { if (!resendInvitation.isPending && confirm("Revoke any pending invitation and send a new set-password invitation?")) resendInvitation.mutate({ id: tab === "doctors" ? row.userId : row.id }); }}><Send size={15} /></button></HelpTip>}
            <HelpTip text="Edit staff details and assignments"><button aria-label="Edit" onClick={() => beginEdit(row)}><Pencil size={15} /></button></HelpTip>
            <HelpTip text="Delete or deactivate this account; ownership protections apply"><button aria-label="Delete or deactivate" disabled={remove.isPending||row.id===identity.user?.id||row.userId===identity.user?.id} onClick={() => { if (!remove.isPending && confirm("Delete or deactivate this record?")) remove.mutate(row.id); }}><Trash2 size={15} /></button></HelpTip>
          </div></td>
        </tr>)}</tbody>
      </table></div> : active ? <div className="empty"><h3>No matching staff</h3><p>Try another search or clear your filters.</p><button onClick={reset}>Clear filters</button></div> : <Empty label={tab} />}
      {!query.error && <Pagination page={context.page} pageSize={context.pageSize} total={query.data?.total || 0} onPageChange={page => change({ page })} onPageSizeChange={pageSize => change({ pageSize })} />}
    </section>
    {isSuperAdmin && tab === "admins" && <ClinicAdminOnboarding />}
    {editing && <AppDialog open onClose={() => setEditing(null)} title={`${editing.id ? "Edit" : "Add"} ${tabs.find(t => t.id === tab)?.label.replace(/s$/, "")}`} dirty={dirty} busy={busy}>
      <UserEditor tab={tab} initial={editing} isSuperAdmin={isSuperAdmin} onDirtyChange={setDirty} onBusyChange={setBusy} onClose={() => { setEditing(null); setSuccess("Staff member saved successfully."); }} />
    </AppDialog>}
  </>;
}

function UserEditor({ tab, initial, onClose, isSuperAdmin, onDirtyChange, onBusyChange }: any) {
  const form = useForm({ defaultValues: { status: "active", ...initial } });
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
      const body = staffInput(tab, data);
      return tab === "doctors" ? initial.id ? api.updateDoctor(initial.id, body) : api.createDoctor(body) : initial.id ? api.updateUser(initial.id, body) : api.createUser(body);
    },
    onSuccess: () => { client.invalidateQueries(); onClose(); },
    onSettled: () => { locked.current = false; },
  });
  useEffect(() => { onDirtyChange(form.formState.isDirty); }, [form.formState.isDirty]);
  useEffect(() => { onBusyChange(save.isPending); }, [save.isPending]);
  const onSubmit = (data: any) => {
    if (locked.current || save.isPending) return;
    // Do not infer invalid assignments from a partial lookup page. The API validates ownership and branch coverage.
    locked.current = true;
    save.mutate(data);
  };
  return <Form {...form}><form className="form-grid" onSubmit={form.handleSubmit(onSubmit)}>
    <label>Full name <span className="required">*</span><input {...form.register("fullName", { required: true, validate: (v: string) => !!v.trim() })} /></label>
    <label>Email <span className="required">*</span><input type="email" {...form.register("email", { required: true })} /></label>
    <label>Mobile<input type="tel" {...form.register("mobile")} /></label>
    {tab === "doctors" && <><label>Registration number<input {...form.register("registrationNumber")} /></label><label>Experience years<input type="number" min="0" {...form.register("experienceYears", { valueAsNumber: true })} /></label></>}
    {tab === "admins" && !initial.id && <p className="wide notice">Admin accounts have no clinic access until clinic ownership is assigned. Use Clinic Admin setup to create an admin and their first clinic together.</p>}
    {tab !== "admins" && <>
      <div className="wide"><label>Clinics <span className="required">*</span></label><Controller name="clinicIds" control={form.control} rules={{ validate: v => !!v?.length || "Select at least one clinic." }} render={({ field }) => <ResourceMultiLookup resource="assignment:clinics" params={{ ...optionsParams, managingAdminId: isSuperAdmin ? firstOwner : undefined }} value={field.value || []} onRecords={remember} isOptionDisabled={row=>!!firstOwner&&row?.adminId!==firstOwner} onChange={ids => {
        const removed = selectedClinics.filter(id => !ids.includes(id));
        field.onChange(ids);
        if (removed.length) form.setValue("branchIds", selectedBranches.filter(id => !removed.includes(records.current.get(id)?.clinicId)), { shouldDirty: true });
      }} />} /><small className="muted">Clinic assignments must belong to the same managing admin. Existing assignments are retained while searching.</small></div>
      <div className="wide"><label>Branches {tab === "receptionists" && <span className="required">*</span>}</label>
        <Controller name="branchIds" control={form.control} rules={{ validate: v => tab !== "receptionists" || !!v?.length || "Select at least one branch for each selected clinic." }} render={({ field }) => <ResourceMultiLookup resource="assignment:branches" params={{ ...optionsParams, clinicId: selectedClinics.join(",") || undefined }} disabled={!selectedClinics.length} value={field.value || []} onRecords={remember} onChange={field.onChange} />} />
        {tab === "receptionists" && <small className="muted">Select at least one branch for every assigned clinic.</small>}
      </div>
    </>}
    <Controller name="status" control={form.control} render={({field})=><SearchableSelect label="Status" value={field.value||"active"} onChange={field.onChange} options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>}/>
    <div className="wide form-footer">{Object.entries(form.formState.errors).map(([field, error]) => <p className="field-error" role="alert" key={field}>{typeof error?.message === "string" ? error.message : `Please complete ${title(field)}.`}</p>)}<ErrorNotice error={save.error} /><button className="button" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</button></div>
  </form></Form>;
}