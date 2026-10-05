import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Star, Clock3, LogOut, ChevronDown, UserRound, Plus, Activity, QrCode } from "lucide-react";
import { navLabel } from "./WorkspaceNav";
import { quickActions } from "./WorkspaceSearch";
import { useNavigationPreferences } from "@/lib/workspace-preferences";

/** Sidebar favorites and recent pages, sharing state with WorkspaceSearch. Only permitted pages render. */
export function SidebarShortcuts({ navigation, role, page, userId, onNavigate }: { navigation: string[]; role: string; page: string; userId: string; onNavigate: () => void }) {
  const { prefs, toggleFavorite } = useNavigationPreferences(userId, role);
  const favorites = prefs.favorites.filter(p => navigation.includes(p));
  const recent = prefs.recent.filter(p => navigation.includes(p) && p !== page && !favorites.includes(p)).slice(0, 4);
  if (!favorites.length && !recent.length) return null;
  const item = (p: string, fav: boolean) => <div key={p} className="wnav-shortcut-row" style={{ display: "flex", alignItems: "center" }}>
    <Link href={`/${role}/${p}`} className={`wnav-link child${p === page ? " active" : ""}`} aria-current={p === page ? "page" : undefined} onClick={onNavigate} title={navLabel(p, role)} data-testid={`nav-shortcut-${fav ? "fav" : "recent"}-${p}`} style={{ flex: 1, minWidth: 0 }}>
      {fav ? <Star size={16} aria-hidden /> : <Clock3 size={16} aria-hidden />}<span className="wnav-label">{navLabel(p, role)}</span>
    </Link>
    {fav && <button type="button" className="wnav-label" aria-label={`Remove ${navLabel(p, role)} from favorites`} onClick={() => toggleFavorite(p)} style={{ border: 0, background: "transparent", minHeight: 32, width: 32, padding: 0, color: "var(--soft)" }}>×</button>}
  </div>;
  return <nav className="wnav-shortcuts" aria-label="Shortcuts">
    {favorites.length > 0 && <><h2><Star size={12} aria-hidden /><span>Favorites</span></h2>{favorites.map(p => item(p, true))}</>}
    {recent.length > 0 && <><h2><Clock3 size={12} aria-hidden /><span>Recent</span></h2>{recent.map(p => item(p, false))}</>}
  </nav>;
}

const actionIcon: Record<string, any> = { book: Plus, queue: Activity, "check-in": QrCode, profile: UserRound };

/** Topbar profile menu: identity, permitted quick actions, current-page favorite toggle and sign out.
 *  No workspace switching or notification center: there is no backend for them. */
export function ProfileMenu({ name, roleLabel, role, navigation, page, userId, onSignOut }: { name: string; roleLabel: string; role: string; navigation: string[]; page: string; userId: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { prefs, toggleFavorite } = useNavigationPreferences(userId, role);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  useEffect(() => setOpen(false), [page]);
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const fav = prefs.favorites.includes(page);
  return <div className="profile-menu" ref={root}>
    <button type="button" ref={trigger} className="profile-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)} data-testid="button-profile-menu">
      <span className="avatar" aria-hidden>{initials}</span><span className="pm-name"><strong>{name}</strong><small>{roleLabel}</small></span><ChevronDown size={14} aria-hidden />
    </button>
    {open && <div className="profile-menu-panel" role="menu" aria-label="Account">
      <div className="pm-head"><strong>{name}</strong><br /><small className="muted">{roleLabel}</small></div>
      {quickActions(role, navigation).map(a => { const Icon = actionIcon[a.id] || Plus; return <Link key={a.id} role="menuitem" href={a.href} onClick={() => setOpen(false)} data-testid={`menu-${a.id}`}><Icon size={15} aria-hidden />{a.label}</Link>; })}
      {navigation.includes(page) && <button type="button" role="menuitem" aria-pressed={fav} onClick={() => toggleFavorite(page)} data-testid="menu-toggle-favorite"><Star size={15} fill={fav ? "currentColor" : "none"} aria-hidden />{fav ? "Remove page from favorites" : "Add page to favorites"}</button>}
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }} data-testid="menu-signout"><LogOut size={15} aria-hidden />Sign out</button>
    </div>}
  </div>;
}
