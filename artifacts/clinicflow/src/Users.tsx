import { useEffect, useState } from "react";
import { assignmentTargetRole, staffInput, type StaffTab } from "./staff-input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Search, Plus, Pencil, Trash2, X, Send } from "lucide-react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { ErrorNotice, Empty, title } from "./resources";
import { Form } from "@/components/ui/form";
import { SearchableMultiSelect } from "./components/SearchableMultiSelect";

export function Users({ identity }: { identity: api.Identity }) {
  const meRole = identity.user!.role;
  const isSuperAdmin = meRole === "superAdmin";
  const isClinicAdmin = meRole === "clinicAdmin";
  const isDoctor = meRole === "doctor";

  const tabs: { id: StaffTab; label: string }[] = [];
  if (isSuperAdmin) tabs.push({ id: "admins", label: "Clinic Admins" });
  if (isSuperAdmin || isClinicAdmin) tabs.push({ id: "doctors", label: "Doctors" });
  if (isSuperAdmin || isClinicAdmin || isDoctor) tabs.push({ id: "receptionists", label: "Receptionists" });

  const qs = new URLSearchParams(window.location.search);
  const initialTab = qs.get("tab");
  const [tab, setTab] = useState<StaffTab>(tabs.find(t => t.id === initialTab)?.id || tabs[0]?.id || "receptionists");

  // Sync tab changes to URL without reloading the page
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }, [tab]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [adminFilter, setAdminFilter] = useState("");

  const [editing, setEditing] = useState<any>(null);

  // Reset page when filters or tab changes
  useEffect(() => { setPage(1); }, [search, statusFilter, clinicFilter, branchFilter, adminFilter, tab]);

  const queryParams = {
    search: search || undefined,
    status: (statusFilter || undefined) as any,
    clinicId: clinicFilter || undefined,
    branchId: tab === "receptionists" ? (branchFilter || undefined) : undefined,
    managingAdminId: isSuperAdmin ? (adminFilter || undefined) : undefined,
    page,
    pageSize: 10,
    sort: "-createdAt"
  };

  const query = useQuery<any>({
    queryKey: ["users-tab", tab, queryParams],
    queryFn: async () => {
      if (tab === "doctors") return api.listDoctors({ ...queryParams, status: queryParams.status as api.StatusParameter } as api.ListDoctorsParams);
      if (tab === "admins") return api.listUsers({ ...queryParams, role: "clinicAdmin", status: queryParams.status as api.StatusParameter } as api.ListUsersParams);
      if (tab === "receptionists") return api.listUsers({ ...queryParams, role: "receptionist", status: queryParams.status as api.StatusParameter } as api.ListUsersParams);
      return { items: [], total: 0 };
    }
  });

  const client = useQueryClient();
  const removeDoctor = useMutation({ mutationFn: (id: string) => api.deleteDoctor(id), onSuccess: () => client.invalidateQueries() });
  const removeUser = useMutation({ mutationFn: (id: string) => api.deleteUser(id), onSuccess: () => client.invalidateQueries() });
  const remove = tab === "doctors" ? removeDoctor : removeUser;

  // Account recovery
  const [recoveryId, setRecoveryId] = useState("");
  const recovery = api.useRequestUserPasswordReset();

  const resendInvitation = api.useResendUserInvitation({ mutation: { onSuccess: () => client.invalidateQueries() } });

  const columns = [
    "Name", "Email", "Mobile",
    isSuperAdmin ? (tab === "admins" ? "Owned Clinics" : "Managing Admin") : null,
    "Clinics", "Branches", "Invitation", "Status", "Created Date"
  ].filter(Boolean) as string[];

  // Use a completely separate query for the toolbar so it isn't constrained by editing IDs
  const optionsParams = { targetRole: assignmentTargetRole(tab) };
  const options = api.useGetStaffAssignmentOptions(optionsParams, {
    query: {
      queryKey: api.getGetStaffAssignmentOptionsQueryKey(optionsParams),
      staleTime: 60000
    }
  });

  const optionsData = options.data || { clinics: [], branches: [], managingAdmins: [] };

  return (
    <>
      <div className="tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-input)', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
        {tabs.map(t => (
          <button 
            key={t.id} 
            className={`tab ${tab === t.id ? "active" : ""}`} 
            onClick={() => setTab(t.id)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              borderBottom: tab === t.id ? '2px solid var(--color-foreground)' : '2px solid transparent',
              padding: '0.5rem 1rem',
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer',
              color: tab === t.id ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar filters">
        <div className="search">
          <Search size={17} />
          <input placeholder={`Search ${tab}…`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select aria-label="Status filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {tab !== "admins" && (
          <select aria-label="Clinic filter" value={clinicFilter} onChange={e => setClinicFilter(e.target.value)}>
            <option value="">All clinics</option>
            {options.isLoading ? <option disabled>Loading…</option> : options.error ? <option disabled>Error loading</option> : optionsData.clinics.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {tab === "receptionists" && (
          <select aria-label="Branch filter" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            <option value="">All branches</option>
            {options.isLoading ? <option disabled>Loading…</option> : options.error ? <option disabled>Error loading</option> : optionsData.branches
              .filter((b: any) => !clinicFilter || b.clinicId === clinicFilter)
              .map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {isSuperAdmin && tab !== "admins" && (
          <select aria-label="Managing admin filter" value={adminFilter} onChange={e => setAdminFilter(e.target.value)}>
            <option value="">All managers</option>
            {options.isLoading ? <option disabled>Loading…</option> : options.error ? <option disabled>Error loading</option> : optionsData.managingAdmins.map((a: any) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
          </select>
        )}
        {(isSuperAdmin || (isClinicAdmin && tab !== "admins") || (isDoctor && tab === "receptionists")) && (
          <button className="button small" onClick={() => setEditing({})} data-testid={`button-add-${tab}`}>
            <Plus size={17} /> Add {tabs.find(t => t.id === tab)?.label.replace(/s$/, "")}
          </button>
        )}
      </div>

      {(!isDoctor) && (
        <section className="panel padded" style={{ marginBottom: 20 }}>
          <h3>Account recovery</h3>
          <p className="muted">Select a {tab.replace(/s$/, "")} to request secure recovery instructions.</p>
          <div className="inline-form">
            <select aria-label="User for password recovery" value={recoveryId} onChange={e => { setRecoveryId(e.target.value); recovery.reset(); }}>
              <option value="">Select user from this page…</option>
              {query.data?.items.map((u: any) => (
                <option key={u.id} value={tab === "doctors" ? u.userId : u.id}>{u.fullName} · {u.email}</option>
              ))}
            </select>
            <button disabled={!recoveryId || recovery.isPending} onClick={() => recovery.mutate({ id: recoveryId })}>
              {recovery.isPending ? "Requesting…" : "Request recovery"}
            </button>
          </div>
          <ErrorNotice error={recovery.error} />
          {recovery.data && (
            <div className="notice">
              <p>{recovery.data.message}</p>
              <Link href="/sign-in" className="text-link">Open secure sign-in</Link>
            </div>
          )}
        </section>
      )}

      <section className="panel table-panel">
        {query.isLoading ? (
          <div className="skeleton">Loading {tab}…</div>
        ) : query.data?.items?.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {columns.map(c => <th key={c}>{c}</th>)}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((row: any) => (
                    <tr key={row.id}>
                      <td><strong>{row.fullName}</strong></td>
                      <td>{row.email}</td>
                      <td>{row.mobile || "—"}</td>
                      {isSuperAdmin && tab === "admins" && (
                        <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.clinicNames ? (Array.isArray(row.clinicNames) ? row.clinicNames.join(", ") : row.clinicNames) : undefined}>
                          {row.clinicNames ? (Array.isArray(row.clinicNames) ? row.clinicNames.join(", ") : row.clinicNames) : "—"}
                        </td>
                      )}
                      {isSuperAdmin && tab !== "admins" && (
                        <td>{row.managingAdminName || row.ownerAdminName || "—"}</td>
                      )}
                      <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.clinicNames ? (Array.isArray(row.clinicNames) ? row.clinicNames.join(", ") : row.clinicNames) : undefined}>
                        {row.clinicNames ? (Array.isArray(row.clinicNames) ? row.clinicNames.join(", ") : row.clinicNames) : "—"}
                      </td>
                      <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.branchNames ? (Array.isArray(row.branchNames) ? row.branchNames.join(", ") : row.branchNames) : undefined}>
                        {row.branchNames ? (Array.isArray(row.branchNames) ? row.branchNames.join(", ") : row.branchNames) : "—"}
                      </td>
                      <td>
                        {row.invitationStatus === "notRequired" ? (row.clerkId ? <span className="muted">Linked</span> : "—") :
                         row.invitationStatus === "sent" ? <span className="badge active">Sent</span> :
                         row.invitationStatus === "failed" ? <span className="badge inactive" style={{color: "var(--color-danger)"}}>Failed</span> : "—"}
                      </td>
                      <td><span className={`badge ${row.status}`}>{title(row.status || "")}</span></td>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</td>
                      <td>
                        <div className="row-actions">
                          {row.invitationStatus === "failed" && (
                            <button aria-label="Resend invitation" disabled={resendInvitation.isPending} onClick={() => {
                              if (confirm("Resend the invitation email to this user?")) resendInvitation.mutate({ id: tab === "doctors" ? row.userId : row.id });
                            }}><Send size={15} /></button>
                          )}
                          <button aria-label="Edit" onClick={() => setEditing(row)}><Pencil size={15} /></button>
                          <button aria-label="Delete or deactivate" disabled={remove.isPending} onClick={() => {
                            if (confirm("Delete or deactivate this record?")) remove.mutate(row.id);
                          }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>{query.data.total} records</span>
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page}</span>
              <button disabled={page * 10 >= query.data.total} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </>
        ) : (
          <Empty label={tab} />
        )}
      </section>

      {editing && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{editing.id ? "UPDATE RECORD" : "NEW RECORD"}</span>
                <h2>{tabs.find(t => t.id === tab)?.label.replace(/s$/, "")}</h2>
              </div>
              <button onClick={() => setEditing(null)} aria-label="Close"><X /></button>
            </div>
            <UserEditor 
              tab={tab} 
              initial={editing} 
              onClose={() => setEditing(null)} 
              isSuperAdmin={isSuperAdmin}
            />
          </section>
        </div>
      )}
    </>
  );
}

function UserEditor({ tab, initial, onClose, isSuperAdmin }: any) {
  const form = useForm({ defaultValues: initial });
  const client = useQueryClient();
  
  const optionsParams = { 
    targetRole: assignmentTargetRole(tab),
    doctorId: tab === "doctors" ? initial.id : undefined,
    userId: tab === "receptionists" ? initial.id : undefined
  };

  const options = api.useGetStaffAssignmentOptions(optionsParams, {
    query: {
      queryKey: api.getGetStaffAssignmentOptionsQueryKey(optionsParams),
      staleTime: 60000,
      enabled: tab !== "admins"
    }
  });

  const optionsData = tab === "admins" ? { clinics: [], branches: [], managingAdmins: [] } : (options.data || { clinics: [], branches: [], managingAdmins: [] });

  const saveDoctor = api.useCreateDoctor({ mutation: { onSuccess: () => { client.invalidateQueries(); onClose(); } } });
  const updateDoctor = api.useUpdateDoctor({ mutation: { onSuccess: () => { client.invalidateQueries(); onClose(); } } });
  const saveUser = api.useCreateUser({ mutation: { onSuccess: () => { client.invalidateQueries(); onClose(); } } });
  const updateUser = api.useUpdateUser({ mutation: { onSuccess: () => { client.invalidateQueries(); onClose(); } } });
  
  const busy = saveDoctor.isPending || updateDoctor.isPending || saveUser.isPending || updateUser.isPending;

  const selectedClinics = form.watch("clinicIds") || [];
  
  // For SA adding a user to multiple clinics, ensure they belong to the same manager.
  const [forcedOwnerAdminId, setForcedOwnerAdminId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin || tab === "admins") return;
    
    if (selectedClinics.length > 0) {
      const firstClinic = optionsData.clinics.find((c: any) => c.id === selectedClinics[0]);
      if (firstClinic?.adminId) setForcedOwnerAdminId(firstClinic.adminId);
      else setForcedOwnerAdminId(null);
    } else {
      setForcedOwnerAdminId(null);
    }
  }, [selectedClinics, optionsData, isSuperAdmin, tab]);

  const selectedBranches = form.watch("branchIds") || [];
  
  useEffect(() => {
    if (options.data && tab !== "admins") {
      const validBranches = selectedBranches.filter((bId: string) => {
        const branch = optionsData.branches.find((b: any) => b.id === bId);
        return branch && selectedClinics.includes(branch.clinicId);
      });
      if (validBranches.length !== selectedBranches.length) {
        form.setValue("branchIds", validBranches);
      }
    }
  }, [selectedClinics.join(","), optionsData.branches, tab, form]);

  const onSubmit = (data: any) => {
    if (tab === "receptionists" && !(data.clinicIds || []).every((clinicId: string) =>
      optionsData.branches.some((branch: any) => branch.clinicId === clinicId && (data.branchIds || []).includes(branch.id)))) {
      form.setError("branchIds", { type: "validate", message: "Select at least one branch for each selected clinic." });
      return;
    }
    const body = staffInput(tab, data);
    
    if (tab === "doctors") {
      if (initial.id) updateDoctor.mutate({ id: initial.id, data: body });
      else saveDoctor.mutate({ data: body });
    } else {
      if (initial.id) updateUser.mutate({ id: initial.id, data: body });
      else saveUser.mutate({ data: body });
    }
  };

  return (
    <Form {...form}>
      <form className="form-grid" onSubmit={form.handleSubmit(onSubmit)}>
        {options.isLoading && tab !== "admins" && <div className="wide"><p className="muted">Loading available assignments…</p></div>}
        {options.error && tab !== "admins" && <div className="wide"><ErrorNotice error={options.error} /></div>}
        
        <label>Full Name <span className="required">*</span>
          <input {...form.register("fullName", { required: true })} />
        </label>
        
        <label>Email <span className="required">*</span>
          <input type="email" {...form.register("email", { required: true })} />
        </label>
        
        <label>Mobile
          <input type="tel" {...form.register("mobile")} />
        </label>
        
        {tab === "doctors" && (
          <>
            <label>Registration Number
              <input {...form.register("registrationNumber")} />
            </label>
            <label>Experience Years
              <input type="number" {...form.register("experienceYears", { valueAsNumber: true })} />
            </label>
          </>
        )}

        {tab === "admins" && !initial.id && (
          <div className="wide notice" style={{ background: "var(--color-input)", padding: "12px", borderRadius: "8px" }}>
            <p>Admin accounts have no clinic access until clinic ownership is assigned.</p>
          </div>
        )}

        {tab !== "admins" && (
          <div className="wide">
            <label>Clinics <span className="required">*</span></label>
            <Controller
              name="clinicIds"
              control={form.control}
              rules={{ required: true }}
              render={({ field }) => (
                <SearchableMultiSelect
                  options={optionsData.clinics
                    .filter((c: any) => {
                      if (forcedOwnerAdminId) return c.adminId === forcedOwnerAdminId;
                      return true;
                    })
                    .map((c: any) => ({ value: c.id, label: c.name }))}
                  value={field.value || []}
                  onChange={field.onChange}
                />
              )}
            />
            {isSuperAdmin && forcedOwnerAdminId && (
              <small className="muted">Additional clinics restricted to the same owner.</small>
            )}
          </div>
        )}

        {tab === "doctors" && (
          <div className="wide">
            <label>Branches</label>
            <Controller
              name="branchIds"
              control={form.control}
              render={({ field }) => {
                const availableBranches = optionsData.branches.filter((b: any) => selectedClinics.includes(b.clinicId));
                return (
                  <SearchableMultiSelect
                    options={availableBranches.map((b: any) => {
                      const clinic = optionsData.clinics.find((c: any) => c.id === b.clinicId);
                      return { value: b.id, label: `${b.name} (${clinic?.name || ''})` };
                    })}
                    value={field.value || []}
                    onChange={field.onChange}
                  />
                );
              }}
            />
          </div>
        )}

        {tab === "receptionists" && selectedClinics.map((clinicId: string) => {
          const clinic = optionsData.clinics.find((c: any) => c.id === clinicId);
          const clinicBranches = optionsData.branches.filter((b: any) => b.clinicId === clinicId);
          if (!clinicBranches.length) return null;
          
          return (
            <div className="wide" key={clinicId} style={{ marginLeft: '1rem', borderLeft: '2px solid var(--color-input)', paddingLeft: '1rem', marginBottom: '1rem' }}>
              <label>Branches for {clinic?.name || 'Selected Clinic'} <span className="required">*</span></label>
              <Controller
                name="branchIds"
                control={form.control}
                rules={{ validate: (val) => {
                  const clinicBranchIds = clinicBranches.map((b: any) => b.id);
                  return (val || []).some((id: string) => clinicBranchIds.includes(id)) || "Select at least one branch for each selected clinic.";
                }}}
                render={({ field }) => {
                  const value = field.value || [];
                  const clinicBranchIds = clinicBranches.map((b: any) => b.id);
                  const selectedForThisClinic = value.filter((id: string) => clinicBranchIds.includes(id));
                  
                  return (
                    <SearchableMultiSelect
                      options={clinicBranches.map((b: any) => ({ value: b.id, label: b.name }))}
                      value={selectedForThisClinic}
                      onChange={(newSelected) => {
                        const otherBranches = value.filter((id: string) => !clinicBranchIds.includes(id));
                        field.onChange([...otherBranches, ...newSelected]);
                      }}
                    />
                  );
                }}
              />
            </div>
          );
        })}

        <label>Status
          <select {...form.register("status")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <div className="wide form-footer">
          {Object.entries(form.formState.errors).map(([field, error]) => (
            <p className="error-message" role="alert" key={field}>
              {typeof error?.message === "string" ? error.message : `Please complete ${field === "clinicIds" ? "the clinic selection" : field === "fullName" ? "the full name" : field}.`}
            </p>
          ))}
          <ErrorNotice error={saveDoctor.error || updateDoctor.error || saveUser.error || updateUser.error} />
          <button className="button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </Form>
  );
}
