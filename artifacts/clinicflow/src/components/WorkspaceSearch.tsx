import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Star, Clock3 } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { navLabel } from "./WorkspaceNav";
import { useNavigationPreferences, recordRecentPage } from "@/lib/workspace-preferences";
import "./workspace-search.css";

/** Real, permitted quick actions only: each target is an existing route for this role. */
export function quickActions(role: string, navigation: string[]) {
  const out: { id: string; label: string; href: string }[] = [];
  if (role === "patient" ? navigation.includes("book") : navigation.includes("appointments")) out.push({ id: "book", label: role === "patient" ? "Book Now" : "Book Appointment", href: `/${role}/book` });
  if (role !== "patient" && navigation.includes("queue")) out.push({ id: "queue", label: "Open Live Queue", href: `/${role}/queue` });
  if (role !== "patient" && navigation.includes("queue")) out.push({ id: "check-in", label: "Validate Appointment QR", href: "/check-in" });
  if (navigation.includes("profile")) out.push({ id: "profile", label: "My Profile", href: `/${role}/profile` });
  return out;
}


type Result = { id: string; label: string; detail?: string; href: string };
type Group = { name: string; results: Result[]; error?: string };
/** Only page identifiers are persisted, never search terms or patient records. */
export function WorkspaceSearch({ navigation, role, page, userId }: {
  navigation: string[]; role: string; page: string; userId: string;
}) {
  const { prefs: preferences, toggleFavorite } = useNavigationPreferences(userId, role);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [, navigate] = useLocation();
  const allowed = navigation.join("|");
  useEffect(() => {
    if (navigation.includes(page) && !recordRecentPage(userId, role, page)) setStorageUnavailable(true);
    setOpen(false); setQuery(""); setGroups([]);
  }, [userId, role, page]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !document.querySelector('[role="dialog"]')) {
        event.preventDefault(); setOpen(true);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  useEffect(() => {
    setGroups([]);
    const search = query.trim();
    if (!open || search.length < 2) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const params = { search, page: 1, pageSize: 5 };
      const options = { signal: controller.signal };
      const href = (target: string, value: string) => `/${role}/${target}?search=${encodeURIComponent(value)}`;
      const jobs: Promise<Group>[] = [];
      const add = <T,>(target: string, name: string, fetcher: () => Promise<{ items: T[] }>, map: (row: T) => Result) => {
        if (!navigation.includes(target)) return;
        jobs.push(fetcher().then(data => ({ name, results: data.items.map(map) })).catch(() => ({
          name, results: [], error: `Unable to search ${name.toLowerCase()}. Access may be restricted or the service unavailable.`,
        })));
      };
      add("appointments", "Appointments", () => api.listAppointments(params, options), a => ({ id: a.id, label: a.patientName, detail: `${a.reference} · ${a.doctorName}`, href: `/${role}/appointments?view=all&search=${encodeURIComponent(a.reference)}` }));
      if (role !== "patient") {
        add("patients", "Patients", () => api.listPatients(params, options), p => ({ id: p.id, label: p.fullName, detail: p.code, href: href("patients", p.fullName) }));
        if (role !== "doctor") add("clinics", "Clinics", () => api.listClinics(params, options), c => ({ id: c.id, label: c.name, detail: c.code, href: href("clinics", c.name) }));
        add("branches", "Locations", () => api.listBranches(params, options), b => ({ id: b.id, label: b.name, detail: b.clinicName, href: href("branches", b.name) }));
        add("users", "Users", () => api.listUsers(params, options).then(data => ({ ...data, items: data.items.filter(u => u.role === "receptionist" || u.role === "clinicAdmin") })), u => ({ id: u.id, label: u.fullName, detail: u.role, href: `${href("users", u.fullName)}&tab=${u.role === "clinicAdmin" ? "admins" : "receptionists"}` }));
        if (role === "admin") add("users", "Doctors", () => api.listDoctors(params, options), d => ({ id: d.id, label: d.fullName, detail: d.specializationName ?? undefined, href: `${href("users", d.fullName)}&tab=doctors` }));
        add("availability", "Schedules", () => api.listSchedules(params, options), s => ({ id: s.id, label: s.doctorName ?? "Doctor session", detail: `${s.branchName} · ${s.startTime}–${s.endTime}`, href: href("availability", search) }));
        add("audit", "Audit logs", () => api.listAuditLogs(params, options), a => ({ id: a.id, label: a.summary, detail: a.action, href: href("audit", search) }));
      }
      const next = await Promise.all(jobs);
      if (!controller.signal.aborted) { setGroups(next); setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, role, allowed, retry]);
  const close = () => { setOpen(false); setQuery(""); setGroups([]); };
  const pages = navigation.filter(p => navLabel(p, role).toLowerCase().includes(query.toLowerCase()));
  const shortcutList = (items: string[]) => items.filter(p => navigation.includes(p));
  const pageLink = (target: string) => <Link key={target} href={`/${role}/${target}`} onClick={close}>{navLabel(target, role)}</Link>;
  return <>
    <button type="button" className="workspace-search-trigger" onClick={() => setOpen(true)} aria-label="Search workspace (Control or Command K)" title="Search workspace · Ctrl/Cmd+K">
      <Search size={16} aria-hidden/><span>Search workspace</span><kbd>⌘/Ctrl K</kbd>
    </button>
    <AppDialog open={open} onClose={close} title="Search Workspace">
      <div className="workspace-command">
        <label htmlFor="workspace-command-query">Search Pages and Permitted Records</label>
        <input id="workspace-command-query" type="search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Patient, appointment, clinic, location or page…" />
        <p className="muted">Record searches require two characters. Favorites and recent pages are saved on this device; patient results and search terms are not saved.</p>
        {storageUnavailable && <p role="status">Browser storage is unavailable. Shortcuts will not persist after this session.</p>}
        {(() => { const actions = quickActions(role, navigation).filter(a => !query || a.label.toLowerCase().includes(query.toLowerCase())); return actions.length ? <section><h3>Quick Actions</h3><div className="workspace-shortcuts">{actions.map(a => <Link key={a.id} href={a.href} onClick={close} data-testid={`quick-action-${a.id}`}>{a.label}</Link>)}</div></section> : null; })()}
        {!query && <>
          <section><h3><Star size={14} aria-hidden/> Favorites</h3><div className="workspace-shortcuts">{shortcutList(preferences.favorites).length ? shortcutList(preferences.favorites).map(pageLink) : <p>No favorites. Use the star beside a page below.</p>}</div></section>
          <section><h3><Clock3 size={14} aria-hidden/> Recent Pages</h3><div className="workspace-shortcuts">{shortcutList(preferences.recent).filter(p => p !== page).length ? shortcutList(preferences.recent).filter(p => p !== page).map(pageLink) : <p>Pages you visit appear here.</p>}</div></section>
        </>}
        <section><h3>{query ? "Suggested pages" : "All pages"}</h3><ul className="workspace-command-pages">{pages.map(p => <li key={p}>
          <button type="button" onClick={() => { close(); navigate(`/${role}/${p}`); }}>{navLabel(p, role)}</button>
          <button type="button" aria-label={`${preferences.favorites.includes(p) ? "Remove" : "Add"} ${navLabel(p, role)} ${preferences.favorites.includes(p) ? "from" : "to"} favorites`} aria-pressed={preferences.favorites.includes(p)} onClick={() => toggleFavorite(p)}><Star size={16} fill={preferences.favorites.includes(p) ? "currentColor" : "none"} aria-hidden/></button>
        </li>)}</ul>{!pages.length && <p>No matching pages.</p>}</section>
        <div aria-live="polite" aria-busy={loading}>{loading && <p role="status">Searching permitted records…</p>}
          {groups.map(group => <section key={group.name}><h3>{group.name}</h3>{group.error ? <p role="alert">{group.error} <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></p> : group.results.length ? <ul className="workspace-command-results">{group.results.map(result => <li key={result.id}><Link href={result.href} onClick={close}><strong>{result.label}</strong><small>{result.detail}</small></Link></li>)}</ul> : <p>No matching records.</p>}</section>)}
        </div>
      </div>
    </AppDialog>
  </>;
}
