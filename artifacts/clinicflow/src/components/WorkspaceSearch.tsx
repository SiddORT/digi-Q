import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Star, Clock3 } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { navLabel } from "./WorkspaceNav";
import "./workspace-search.css";

type Result = { id: string; label: string; detail?: string; href: string };
type Group = { name: string; results: Result[]; error?: string };
type Preferences = { favorites: string[]; recent: string[] };
const readPreferences = (key: string): Preferences => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 30) : [];
    return { favorites: strings(stored.favorites), recent: strings(stored.recent) };
  } catch { return { favorites: [], recent: [] }; }
};

/** Only page identifiers are persisted, never search terms or patient records. */
export function WorkspaceSearch({ navigation, role, page, userId }: {
  navigation: string[]; role: string; page: string; userId: string;
}) {
  const storageKey = `digiq-navigation:${userId}:${role}`;
  const [preferences, setPreferences] = useState(() => readPreferences(storageKey));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [, navigate] = useLocation();
  const allowed = navigation.join("|");
  const save = (next: Preferences) => {
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageUnavailable(false); }
    catch { setStorageUnavailable(true); }
  };
  useEffect(() => {
    const current = readPreferences(storageKey);
    const next = { ...current, recent: [page, ...current.recent.filter(p => p !== page)].slice(0, 8) };
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { setStorageUnavailable(true); }
    setOpen(false); setQuery(""); setGroups([]);
  }, [storageKey, page]);
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
    <AppDialog open={open} onClose={close} title="Search workspace">
      <div className="workspace-command">
        <label htmlFor="workspace-command-query">Search pages and permitted records</label>
        <input id="workspace-command-query" type="search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Patient, appointment, clinic, location or page…" />
        <p className="muted">Record searches require two characters. Favorites and recent pages are saved on this device; patient results and search terms are not saved.</p>
        {storageUnavailable && <p role="status">Browser storage is unavailable. Shortcuts will not persist after this session.</p>}
        {!query && <>
          <section><h3><Star size={14} aria-hidden/> Favorites</h3><div className="workspace-shortcuts">{shortcutList(preferences.favorites).length ? shortcutList(preferences.favorites).map(pageLink) : <p>No favorites. Use the star beside a page below.</p>}</div></section>
          <section><h3><Clock3 size={14} aria-hidden/> Recent pages</h3><div className="workspace-shortcuts">{shortcutList(preferences.recent).map(pageLink)}</div></section>
        </>}
        <section><h3>Pages and quick actions</h3><ul className="workspace-command-pages">{pages.map(p => <li key={p}>
          <button type="button" onClick={() => { close(); navigate(`/${role}/${p}`); }}>{navLabel(p, role)}</button>
          <button type="button" aria-label={`${preferences.favorites.includes(p) ? "Remove" : "Add"} ${navLabel(p, role)} ${preferences.favorites.includes(p) ? "from" : "to"} favorites`} aria-pressed={preferences.favorites.includes(p)} onClick={() => save({ ...preferences, favorites: preferences.favorites.includes(p) ? preferences.favorites.filter(v => v !== p) : [...preferences.favorites, p] })}><Star size={16} fill={preferences.favorites.includes(p) ? "currentColor" : "none"} aria-hidden/></button>
        </li>)}</ul>{!pages.length && <p>No matching pages.</p>}</section>
        <div aria-live="polite" aria-busy={loading}>{loading && <p role="status">Searching permitted records…</p>}
          {groups.map(group => <section key={group.name}><h3>{group.name}</h3>{group.error ? <p role="alert">{group.error} <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></p> : group.results.length ? <ul className="workspace-command-results">{group.results.map(result => <li key={result.id}><Link href={result.href} onClick={close}><strong>{result.label}</strong><small>{result.detail}</small></Link></li>)}</ul> : <p>No matching records.</p>}</section>)}
        </div>
      </div>
    </AppDialog>
  </>;
}
