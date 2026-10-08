import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useConfirm } from "./ConfirmDialog";
import { friendlyError } from "../lib/friendly-error";
import { BRANCH_SCOPED_PAGES, branchSelectorMode, resolveSavedBranch, scopedQueryStrip, workspaceBranchKey, type WorkspaceBranchOption } from "../lib/workspace-branch";
import "./workspace-branch.css";
import { notifyWarning } from "../lib/notify";

export type BranchPin = { branchId: string; clinicId: string; name: string; clinicName: string };
type Ctx = {
  /** Roles that use the selector (doctor, receptionist, clinicAdmin). Patients, guests and super admins are never scoped. */
  enabled: boolean;
  status: "off" | "loading" | "error" | "none" | "choice" | "ready";
  branches: WorkspaceBranchOption[];
  pin: BranchPin | null;
  error: unknown;
  retry: () => void;
  select: (branchId: string) => Promise<void>;
  registerUnsaved: (id: string, dirty: boolean) => void;
  registerBusy: (id: string, busy: boolean) => void;
};
const BranchContext = createContext<Ctx | null>(null);

async function loadAccessibleBranches(identity: api.Identity): Promise<WorkspaceBranchOption[]> {
  const items: WorkspaceBranchOption[] = [];
  // Server-scoped list: only branches this account may access. A doctor is narrowed to their own assignments.
  const doctorId = identity.user?.role === "doctor" && identity.doctorId ? identity.doctorId : undefined;
  for (let page = 1; page < 20; page++) {
    const res = await api.listBranches({ status: "active", page, pageSize: 100, ...(doctorId ? { doctorId } : {}) } as api.ListBranchesParams);
    items.push(...res.items.map((b: any) => ({ id: b.id, clinicId: b.clinicId, name: b.name, clinicName: b.clinicName || "" })));
    if (items.length >= res.total) return items.sort((a,b)=>a.clinicName.localeCompare(b.clinicName)||a.name.localeCompare(b.name));
    if (!res.items.length) throw new Error("Your assigned locations were only partially loaded. Retry Locations.");
  }
  throw new Error("Your assigned locations could not be fully loaded. Retry Locations.");
}

export function WorkspaceBranchProvider({ identity, children }: { identity: api.Identity; children: ReactNode }) {
  const userId = identity.user?.id || "";
  const enabled = branchSelectorMode(identity.user?.role) !== "off";
  const client = useQueryClient();
  const [, navigate] = useLocation();
  const confirmation = useConfirm();
  const q = useQuery({ queryKey: ["workspace-branches", userId, identity.user?.role, identity.doctorId || ""], queryFn: () => loadAccessibleBranches(identity), enabled, staleTime: 60000, retry: 1 });
  const branches = q.data || [];
  const [selected, setSelected] = useState<string>("");
  // Validate the remembered choice against the current authorized, active list on every load.
  useEffect(() => {
    if (!q.data) return;
    let saved = "";
    try { saved = localStorage.getItem(workspaceBranchKey(userId)) || ""; } catch { /* storage unavailable */ }
    const id = resolveSavedBranch(saved, q.data);
    setSelected(id);
    try { if (id) localStorage.setItem(workspaceBranchKey(userId), id); else localStorage.removeItem(workspaceBranchKey(userId)); } catch { /* session only */ }
  }, [q.data, userId]);
  const unsaved = useRef(new Set<string>());
  const saving = useRef(new Set<string>());
  const registerBusy = useCallback((id:string,busy:boolean)=>{if(busy)saving.current.add(id);else saving.current.delete(id);},[]);
  const registerUnsaved = useCallback((id: string, dirty: boolean) => { if (dirty) unsaved.current.add(id); else unsaved.current.delete(id); }, []);
  const current = branches.find(b => b.id === selected);
  const pin = useMemo<BranchPin | null>(() => current ? { branchId: current.id, clinicId: current.clinicId, name: current.name, clinicName: current.clinicName } : null, [current]);
  const select = async (branchId: string) => {
    if (branchId === selected || !branches.some(b => b.id === branchId)) return;
    if(saving.current.size){notifyWarning("Finish saving before changing location.");return;}
    if (unsaved.current.size && !await confirmation.ask({ title: "Switch Location?", description: "You have unsaved changes on this page. Switching location discards them and clears the selected doctor and session.", confirmLabel: "Discard and Switch", tone: "danger" })) return;
    unsaved.current.clear();
    try { localStorage.setItem(workspaceBranchKey(userId), branchId); sessionStorage.removeItem("clinicflow-staff-session"); } catch { /* optional */ }
    // Drop location-dependent URL filters so pages cannot restore the previous location, doctor or session.
    const url = new URL(window.location.href);
    const next = scopedQueryStrip(url.search);
    if (next !== url.search.replace(/^\?/, "")) navigate(`${url.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ""), "") || "/"}${next ? `?${next}` : ""}`, { replace: true });
    setSelected(branchId);
    void client.invalidateQueries({ predicate: query => query.queryKey[0] !== "workspace-branches" });
  };
  const status: Ctx["status"] = !enabled ? "off" : q.isLoading ? "loading" : q.error ? "error" : !branches.length ? "none" : pin ? "ready" : branches.length > 1 ? "choice" : "loading";
  const value: Ctx = { enabled, status, branches, pin: enabled ? pin : null, error: q.error, retry: () => void q.refetch(), select, registerUnsaved, registerBusy };
  return <BranchContext.Provider value={value}>{confirmation.dialog}{children}</BranchContext.Provider>;
}

const OFF: Ctx = { enabled: false, status: "off", branches: [], pin: null, error: null, retry: () => {}, select: async () => {}, registerUnsaved: () => {}, registerBusy:()=>{} };
export function useWorkspaceBranchContext() { return useContext(BranchContext) || OFF; }
/** The enforced workspace location, or null when no location restriction applies (patients, guests, super admins, public booking). */
export function useWorkspaceBranch() { return useWorkspaceBranchContext().pin; }

/** Registers a page's unsaved state so a location switch asks for confirmation first. */
export function useRegisterUnsaved(dirty: boolean, busy=false) {
  const { registerUnsaved, registerBusy } = useWorkspaceBranchContext();
  const id = useId();
  useEffect(() => { registerUnsaved(id, dirty); return () => registerUnsaved(id, false); }, [id, dirty, registerUnsaved]);
  useEffect(() => { registerBusy(id,busy);return()=>registerBusy(id,false); },[id,busy,registerBusy]);
}

/** Keeps a page's clinic/location state on the workspace location, even after saved views, resets or deep links. */
export function usePinnedCare(clinicId: string, branchId: string, setClinic: (v: string) => void, setBranch: (v: string) => void) {
  const pin = useWorkspaceBranch();
  useEffect(() => {
    if (!pin) return;
    if (clinicId !== pin.clinicId) setClinic(pin.clinicId);
    if (branchId !== pin.branchId) setBranch(pin.branchId);
  }, [pin, clinicId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps
  return pin;
}

/** Branch-scoped pages wait for the authorized location list. A failed lookup shows an error, never an unscoped (all-locations) view. */
export function BranchScopeGate({ page, children }: { page: string; children: ReactNode }) {
  const ctx = useWorkspaceBranchContext();
  if (!ctx.enabled || !BRANCH_SCOPED_PAGES.includes(page)) return <>{children}</>;
  if (ctx.status === "loading") return <div className="skeleton" role="status" data-testid="status-branch-loading">Loading your locations…</div>;
  if (ctx.status === "error") return <div className="error-box" role="alert" data-testid="status-branch-error">Your locations could not be loaded, so location-specific data is hidden. {friendlyError(ctx.error, "load")} <button type="button" onClick={ctx.retry} data-testid="button-branch-retry">Retry Locations</button></div>;
  if (ctx.status === "none") return <div className="empty" role="status" data-testid="status-branch-none"><span className="empty-icon"><MapPin size={24} aria-hidden /></span><h3>No active location assigned</h3><p>Ask your clinic administrator to assign you to an active location.</p></div>;
  if (ctx.status === "choice") return <section className="panel" aria-label="Choose operational location"><h2>Choose your clinic</h2><p>You have several assigned clinics. Choose one to continue.</p>{ctx.branches.map(b=><button key={b.id} type="button" className="button secondary" onClick={()=>void ctx.select(b.id)}>{b.name} · {b.clinicName}</button>)}</section>;
  return <div key={ctx.pin!.branchId} className="branch-scope" data-branch-id={ctx.pin!.branchId}>{children}</div>;
}

/** Top-right location control: fixed label for one location, searchable picker for two or more. */
export function LocationSelector() {
  const ctx = useWorkspaceBranchContext();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    requestAnimationFrame(() => input.current?.focus());
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  if (!ctx.enabled) return null;
  if (ctx.status === "loading") return <span className="loc-select is-fixed" role="status" data-testid="status-location-loading"><MapPin size={15} aria-hidden /><span className="loc-name">Loading location…</span></span>;
  if (ctx.status === "error") return <button type="button" className="loc-select is-error" onClick={ctx.retry} data-testid="button-location-retry"><MapPin size={15} aria-hidden /><span className="loc-name">Locations unavailable · Retry</span></button>;
  if (ctx.status === "choice") return <span className="loc-select is-fixed" role="status">Choose a clinic below</span>;
  if (ctx.status === "none" || !ctx.pin) return <span className="loc-select is-fixed" data-testid="text-location-none"><MapPin size={15} aria-hidden /><span className="loc-name">No location</span></span>;
  if (ctx.branches.length < 2) return <span className="loc-select is-fixed" title={`${ctx.pin.name} · ${ctx.pin.clinicName}`} data-testid="text-location-fixed"><MapPin size={15} aria-hidden /><span className="loc-name">{ctx.pin.name}</span></span>;
  const t = term.trim().toLowerCase();
  const options = ctx.branches.filter(b => !t || `${b.name} ${b.clinicName}`.toLowerCase().includes(t));
  const choose = (id: string) => { setOpen(false); setTerm(""); void ctx.select(id); };
  return <div className="loc-wrap" ref={wrap} onKeyDown={e => { if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } }}>
    <button type="button" className="loc-select" aria-haspopup="listbox" aria-expanded={open} aria-label={`Location: ${ctx.pin.name}, ${ctx.pin.clinicName}. Change location`} onClick={() => { setOpen(v => !v); setActive(0); }} data-testid="button-location-selector">
      <MapPin size={15} aria-hidden /><span className="loc-name">{ctx.pin.name}</span><ChevronDown size={14} aria-hidden />
    </button>
    {open && <div className="loc-panel" role="dialog" aria-label="Choose location">
      <label className="loc-search"><Search size={14} aria-hidden /><span className="sr-only">Search locations</span>
        <input ref={input} value={term} placeholder="Search locations or clinics…" role="combobox" aria-expanded aria-controls={listId} aria-activedescendant={options[active] ? `${listId}-${options[active].id}` : undefined}
          onChange={e => { setTerm(e.target.value); setActive(0); }}
          onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)); } else if (e.key === "Enter" && options[active]) { e.preventDefault(); choose(options[active].id); } }}
          data-testid="input-location-search" /></label>
      <ul className="loc-list" role="listbox" id={listId} aria-label="Locations">
        {options.map((b, i) => <li key={b.id} id={`${listId}-${b.id}`} role="option" aria-selected={b.id === ctx.pin!.branchId} className={`loc-option${i === active ? " is-active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => choose(b.id)} data-testid={`option-location-${b.id}`}>
          <span><strong>{b.name}</strong><small>{b.clinicName}</small></span>{b.id === ctx.pin!.branchId && <Check size={15} aria-hidden />}
        </li>)}
        {!options.length && <li className="loc-empty" role="presentation">No matching locations.</li>}
      </ul>
    </div>}
  </div>;
}
