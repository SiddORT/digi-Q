import { openQrInline } from "@/lib/qr-inline";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Star, LogOut, ChevronDown, UserRound, Plus, Activity, QrCode, Building2, Check } from "lucide-react";
import { OverflowText } from "./OverflowText";
import { menuKeyDown } from "@/lib/tabs-a11y";
import * as api from "@/lib/api";
import { navLabel } from "./WorkspaceNav";
import { quickActions } from "./WorkspaceSearch";
import { useNavigationPreferences } from "@/lib/workspace-preferences";

/** Sidebar favorites only (Recent was removed from the sidebar for all roles; recent pages remain in WorkspaceSearch). Only permitted pages render. */
export function SidebarShortcuts({ navigation, role, page, userId, onNavigate }: { navigation: string[]; role: string; page: string; userId: string; onNavigate: () => void }) {
  const { prefs, toggleFavorite } = useNavigationPreferences(userId, role,role==="admin"&&navigation.includes("clinics")&&!navigation.includes("clinic"));
  const favorites = prefs.favorites.filter(p => navigation.includes(p));
  if (!favorites.length) return null;
  const item = (p: string, fav: boolean) => <div key={p} className="wnav-shortcut-row" style={{ display: "flex", alignItems: "center" }}>
    <Link href={`/${role}/${p}`} className={`wnav-link child${p === page ? " active" : ""}`} aria-current={p === page ? "page" : undefined} onClick={onNavigate} title={navLabel(p, role)} data-testid={`nav-shortcut-${fav ? "fav" : "recent"}-${p}`} style={{ flex: 1, minWidth: 0 }}>
      <Star size={16} aria-hidden /><span className="wnav-label">{navLabel(p, role)}</span>
    </Link>
    {fav && <button type="button" className="wnav-label" aria-label={`Remove ${navLabel(p, role)} from favorites`} onClick={() => toggleFavorite(p)} style={{ border: 0, background: "transparent", minHeight: 32, width: 32, padding: 0, color: "var(--soft)" }}>×</button>}
  </div>;
  return <nav className="wnav-shortcuts" aria-label="Shortcuts">
    {favorites.length > 0 && <><h2><Star size={12} aria-hidden /><span>Favorites</span></h2>{favorites.map(p => item(p, true))}</>}
  </nav>;
}

const actionIcon: Record<string, any> = { book: Plus, queue: Activity, "check-in": QrCode, profile: UserRound };

/** Server-authorized workspace switching: narrows scope to one assigned clinic, never expands it.
 *  Caches are cleared on switch so no data from the previous scope can render. */
export function WorkspaceScope({ role, roleLabel, open }: { role: string; roleLabel: string; open: boolean }) {
  const staff = role !== "patient" && role !== "superAdmin";
  const client = useQueryClient();
  const q = api.useListWorkspaces({ query: { queryKey: api.getListWorkspacesQueryKey(), enabled: open && staff, staleTime: 60000 } });
  const select = api.useSelectWorkspace({ mutation: { onSuccess: () => { void client.cancelQueries(); client.clear(); window.location.reload(); } } });
  const list = q.data?.workspaces ?? [];
  const active = q.data?.activeClinicId ?? null;
  const scope = role === "superAdmin" ? "Platform-Wide" : role === "patient" ? "Your Patient Account" : q.isLoading ? "Loading…" : !list.length ? "No Clinic Assigned" : active ? (list.find(w => w.id === active)?.name || "One Clinic") : list.length === 1 ? list[0].name : `All ${list.length} Clinics`;
  return <div className="pm-scope" role="group" aria-label="Workspace" data-testid="menu-workspace">
    <small className="pm-scope-label">Workspace</small>
    <div className="pm-scope-current"><Building2 size={15} aria-hidden /><OverflowText value={`${roleLabel} · ${scope}`} /></div>
    {staff && q.error && <p className="muted" role="alert">Workspaces could not be loaded. <button type="button" className="text-link" onClick={() => void q.refetch()}>Retry</button></p>}
    {q.data?.switchable && <ul className="pm-scope-list" aria-label="Switch workspace">
      {[{ id: "", name: `All My Clinics (${list.length})` }, ...list].map(w => { const on = (w.id || null) === active; return <li key={w.id || "all"}>
        <button type="button" role="menuitemradio" aria-checked={on} disabled={select.isPending} onClick={() => { if (!on) select.mutate({ data: { clinicId: w.id || null } }); }} data-testid={`menu-workspace-${w.id || "all"}`} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", minWidth: 0 }}>
          {on ? <Check size={14} aria-hidden /> : <span style={{ width: 14 }} aria-hidden />}<OverflowText value={w.name} />
        </button></li>; })}
    </ul>}
    {select.isPending && <small className="muted" role="status">Switching workspace…</small>}
    {select.isError && <small className="field-error" role="alert">Switch failed. You may no longer be assigned to that clinic.</small>}
  </div>;
}

export function ProfileMenu({ name, roleLabel, role, navigation, page, userId, onSignOut }: { name: string; roleLabel: string; role: string; navigation: string[]; page: string; userId: string; clinicIds?: string[]; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { prefs, toggleFavorite } = useNavigationPreferences(userId, role,role==="admin"&&navigation.includes("clinics")&&!navigation.includes("clinic"));
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", key);
    // Move focus into the menu so arrow keys work immediately.
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role="menuitem"],[role="menuitemradio"]')?.focus());
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  useEffect(() => setOpen(false), [page]);
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const favoritePage=page==="clinic"&&role==="admin"&&navigation.includes("clinics")&&!navigation.includes("clinic")?"clinics":page;
  const fav = prefs.favorites.includes(favoritePage);
  return <div className="profile-menu" ref={root}>
    <button type="button" ref={trigger} className="profile-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)} onKeyDown={e => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }} data-testid="button-profile-menu">
      <span className="avatar" aria-hidden>{initials}</span><span className="pm-name"><strong>{name}</strong><small>{roleLabel}</small></span><ChevronDown size={14} aria-hidden />
    </button>
    {open && <div className="profile-menu-panel" role="menu" aria-label="Account" ref={panel} onKeyDown={e => { if (e.key === "Tab") setOpen(false); else menuKeyDown(e); }}>
      <div className="pm-head"><strong>{name}</strong><br /><small className="muted">{roleLabel}</small></div>
      <WorkspaceScope role={role} roleLabel={roleLabel} open={open} />
      {quickActions(role, navigation).map(a => { const Icon = actionIcon[a.id] || Plus; return a.inline ? <button key={a.id} type="button" role="menuitem" onClick={() => { setOpen(false); openQrInline(); }} data-testid={`menu-${a.id}`}><Icon size={15} aria-hidden />{a.label}</button> : <Link key={a.id} role="menuitem" href={a.href} onClick={() => setOpen(false)} data-testid={`menu-${a.id}`}><Icon size={15} aria-hidden />{a.label}</Link>; })}
      {navigation.includes(page) && <button type="button" role="menuitem" aria-pressed={fav} onClick={() => toggleFavorite(page)} data-testid="menu-toggle-favorite"><Star size={15} fill={fav ? "currentColor" : "none"} aria-hidden />{fav ? "Remove page from favorites" : "Add page to favorites"}</button>}
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }} data-testid="menu-signout"><LogOut size={15} aria-hidden />Sign Out</button>
    </div>}
  </div>;
}
