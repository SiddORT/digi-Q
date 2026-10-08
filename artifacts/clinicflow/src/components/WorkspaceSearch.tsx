import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Star, Clock3, ChevronDown, RotateCw } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { navLabel } from "./WorkspaceNav";
import { RowMenu } from "./RowMenu";
import { useNavigationPreferences, recordRecentPage } from "@/lib/workspace-preferences";
import { queueRecordHref, reportSearchHref, reportSearchRange } from "@/lib/search-links";
import { CATEGORY_LABEL, MORE_CATEGORIES, PAGE_SIZE, PREVIEW_SIZE, PRIMARY_CATEGORIES, SOURCE_LABEL, appointmentHref, canLoadMore, categorySources, categoryTotal, countLabel, permittedCategories, reachedCap, recordHref, type SearchCategory, type SearchSource, type SearchTab } from "@/lib/search-categories";
import "./workspace-search.css";
import { openQrInline } from "@/lib/qr-inline";

/** Real, permitted quick actions only: each target is an existing route for this role. */
export function quickActions(role: string, navigation: string[]) {
  const out: { id: string; label: string; href: string; inline?: boolean }[] = [];
  if (role === "patient" ? navigation.includes("book") : navigation.includes("appointments")) out.push({ id: "book", label: role === "patient" ? "Book Now" : "Book Appointment", href: `/${role}/book` });
  if (role !== "patient" && navigation.includes("queue")) out.push({ id: "queue", label: "Open Live Queue", href: `/${role}/queue` });
  if (role !== "patient" && navigation.includes("queue")) out.push({ id: "check-in", label: "Validate Appointment QR", href: "/check-in", inline: true });
  if (navigation.includes("profile")) out.push({ id: "profile", label: "My Profile", href: `/${role}/profile` });
  return out;
}

type Result = { id: string; label: string; detail?: string; href: string };
type Slice = { items: Result[]; total: number | null };
type SourceState = Slice & { page: number; loading: boolean; error: string };
const EMPTY_STATE: SourceState = { items: [], total: null, page: 0, loading: false, error: "" };

/** Destination listing that pages through every match (used beyond the in-dialog cap and as "Open in …"). */
export function sourceListingHref(source: SearchSource, role: string, navigation: string[], search: string, today: string) {
  const q = encodeURIComponent(search);
  switch (source) {
    case "patients": return `/${role}/patients?search=${q}`;
    case "appointments": return role !== "patient" && !navigation.includes("appointments") ? `/${role}/queue` : `/${role}/appointments?view=all&search=${q}`;
    case "receptionists": return `/${role}/users?tab=receptionists&search=${q}`;
    case "clinicAdmins": return `/${role}/users?tab=admins&search=${q}`;
    case "doctors": return `/${role}/users?tab=doctors&search=${q}`;
    case "clinics": return `/${role}/clinics?search=${q}`;
    case "branches": return `/${role}/branches?search=${q}`;
    case "schedules": return `/${role}/availability?search=${q}`;
    case "audit": return `/${role}/audit?search=${q}`;
    case "reportClinics": case "reportDoctors": return reportSearchHref(role, { groupBy: source === "reportClinics" ? "clinic" : "doctor", ...reportSearchRange(today), search });
  }
}

/** One source, one bounded server page. Totals come from the API; nothing is filtered client-side after paging,
 *  so counts always match what the destination listing will show. Errors surface; there is no silent fallback. */
function fetchSource(source: SearchSource, role: string, navigation: string[], search: string, page: number, pageSize: number, today: string, signal: AbortSignal): Promise<Slice> {
  const params = { search, page, pageSize };
  const options = { signal };
  const staff = (u: api.User, tab: string, label: string): Result => ({ id: u.id, label: u.fullName, detail: label, href: recordHref(role, "users", u.id, u.fullName, { tab }) });
  switch (source) {
    case "patients":
      return api.listPatients(params, options).then(d => ({ total: d.total, items: d.items.map(p => ({ id: p.id, label: p.fullName, detail: p.code, href: recordHref(role, "patients", p.id, p.fullName) })) }));
    case "appointments":
      if (role !== "patient" && !navigation.includes("appointments")) {
        // Queue-only roles keep scoped record search (token, reference, name). The API is unpaged and may cap its
        // own results, so no total is claimed: the count reads "N shown" and the queue is the full destination.
        return api.searchRecords({ q: search }, options).then(d => ({ total: null, items: d.items.map(r => ({
          id: `rec-${r.id}`, label: `Token ${r.token || r.tokenNumber} · ${r.patientName}`, detail: `${r.reference} · ${r.doctorName} · ${r.date}${r.today ? " · today" : ""}`,
          href: queueRecordHref(role, r, navigation.includes("queue")),
        })) }));
      }
      return api.listAppointments(params, options).then(d => ({ total: d.total, items: d.items.map(a => ({
        id: a.id, label: `${a.patientName} · Token ${a.token}`, detail: `${a.reference} · ${a.doctorName} · ${a.date}${a.date === today ? " · today" : ""} · ${a.status}`,
        href: role !== "patient" && a.date === today && navigation.includes("queue")
          ? queueRecordHref(role, { id: a.id, clinicId: a.clinicId, branchId: a.branchId, doctorId: a.doctorId, date: a.date, sessionId: a.sessionId ?? null, startTime: a.startTime ?? null, reference: a.reference, today: true }, true)
          : appointmentHref(role, a),
      })) }));
    case "receptionists":
      return api.listUsers({ ...params, role: "receptionist" }, options).then(d => ({ total: d.total, items: d.items.map(u => staff(u, "receptionists", "Receptionist")) }));
    case "clinicAdmins":
      return api.listUsers({ ...params, role: "clinicAdmin" }, options).then(d => ({ total: d.total, items: d.items.map(u => staff(u, "admins", "Clinic Admin")) }));
    case "doctors":
      return api.listDoctors(params, options).then(d => ({ total: d.total, items: d.items.map(x => ({ id: x.id, label: x.fullName, detail: x.specializationName ? `Doctor · ${x.specializationName}` : "Doctor", href: recordHref(role, "users", x.id, x.fullName, { tab: "doctors" }) })) }));
    case "clinics":
      return api.listClinics(params, options).then(d => ({ total: d.total, items: d.items.map(c => ({ id: c.id, label: c.name, detail: c.code, href: recordHref(role, "clinics", c.id, c.name) })) }));
    case "branches":
      return api.listBranches(params, options).then(d => ({ total: d.total, items: d.items.map(b => ({ id: b.id, label: b.name, detail: b.clinicName, href: recordHref(role, "branches", b.id, b.name) })) }));
    case "schedules":
      // Exact schedule: doctor + location scope the listing (and its weekly editor); open=<id> selects the session.
      return api.listSchedules(params, options).then(d => ({ total: d.total, items: d.items.map(s => ({ id: s.id, label: s.doctorName ?? "Doctor session", detail: `${s.branchName} · ${s.startTime}–${s.endTime}`, href: recordHref(role, "availability", s.id, "", { doctorId: s.doctorId, branchId: s.branchId }) })) }));
    case "audit":
      return api.listAuditLogs(params, options).then(d => ({ total: d.total, items: d.items.map(a => ({ id: a.id, label: a.summary, detail: a.action, href: recordHref(role, "audit", a.id, search) })) }));
    case "reportClinics": case "reportDoctors": {
      const range = reportSearchRange(today);
      const groupBy = source === "reportClinics" ? "clinic" as const : "doctor" as const;
      return api.getReports({ ...range, groupBy, search, page, pageSize }, options).then(rep => ({ total: rep.total ?? null, items: rep.rows.map(row => ({
        id: `rep-${groupBy}-${row.key}`, label: row.label, detail: `${row.appointments} visits · ${range.from} to ${range.to}`,
        href: reportSearchHref(role, { groupBy, ...range, search: row.label }),
      })) }));
    }
  }
}

/** Only page identifiers are persisted, never search terms or patient records. */
export function WorkspaceSearch({ navigation, role, page, userId }: {
  navigation: string[]; role: string; page: string; userId: string;
}) {
  const { prefs: preferences, toggleFavorite } = useNavigationPreferences(userId, role,role==="admin"&&navigation.includes("clinics")&&!navigation.includes("clinic"));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [groups, setGroups] = useState<Partial<Record<SearchSource, SourceState>>>({});
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllers = useRef<Partial<Record<SearchSource, AbortController>>>({});
  // "Today" follows the configured clinic timezone, the same rule the Appointments listing uses.
  const settings = api.useGetSettings({ query: { queryKey: api.getGetSettingsQueryKey(), staleTime: 60000, enabled: open } });
  const today = new Date().toLocaleDateString("en-CA", settings.data?.timezone ? { timeZone: settings.data.timezone } : undefined);
  const allowed = navigation.join("|");
  const categories = permittedCategories(role, navigation);
  const primary = PRIMARY_CATEGORIES.filter(c => categories.includes(c));
  const more = MORE_CATEGORIES.filter(c => categories.includes(c));
  const search = query.trim();
  const searching = search.length >= 2;

  useEffect(() => {
    if (navigation.includes(page) && !recordRecentPage(userId, role, page)) setStorageUnavailable(true);
    setOpen(false); setQuery(""); setGroups({}); setTab("all");
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

  /** Load (or reload / extend) one source independently: its failure never blocks or re-runs the others. */
  const load = (source: SearchSource, pageNo: number, size: number, append: boolean) => {
    if (!navigation.length || !categories.some(cat => categorySources(cat, role).includes(source))) return;
    controllers.current[source]?.abort();
    const controller = new AbortController();
    controllers.current[source] = controller;
    setGroups(g => ({ ...g, [source]: { ...(g[source] ?? EMPTY_STATE), loading: true, error: "" } }));
    fetchSource(source, role, navigation, search, pageNo, size, today, controller.signal)
      .then(slice => { if (!controller.signal.aborted) setGroups(g => {
        const prev = append ? g[source]?.items ?? [] : [];
        const seen = new Set(prev.map(r => r.id));
        return { ...g, [source]: { items: [...prev, ...slice.items.filter(r => !seen.has(r.id))], total: slice.total, page: pageNo, loading: false, error: "" } };
      }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setGroups(g => ({ ...g, [source]: { ...(g[source] ?? EMPTY_STATE), loading: false, error: `Unable to search ${SOURCE_LABEL[source].toLowerCase()}${error instanceof Error && error.message ? ` (${error.message})` : ""}. Access may be restricted or the service unavailable.` } })); });
  };

  // All shows short previews of every permitted category; a category tab loads its first full page.
  useEffect(() => {
    setGroups({});
    if (!open || !searching) return;
    const timer = setTimeout(() => {
      const targets = tab === "all" ? categories : tab === "pages" ? [] : [tab];
      for (const cat of targets) for (const source of categorySources(cat, role)) load(source, 1, tab === "all" ? PREVIEW_SIZE : PAGE_SIZE, false);
    }, 300);
    const active = controllers.current;
    return () => { clearTimeout(timer); for (const controller of Object.values(active)) if (controller) controller.abort(); };
  }, [query, open, role, allowed, tab]);

  const close = () => { setOpen(false); setQuery(""); setGroups({}); setTab("all"); };
  const pages = navigation.filter(p => navLabel(p, role).toLowerCase().includes(search.toLowerCase()));
  const shortcutList = (items: string[]) => items.filter(p => navigation.includes(p));
  const pageLink = (target: string) => <Link key={target} href={`/${role}/${target}`} onClick={close}>{navLabel(target, role)}</Link>;
  const switchTab = (next: SearchTab) => { setTab(next); inputRef.current?.focus(); };
  const tabButton = (key: SearchTab, label: string) => <button key={key} type="button" role="tab" aria-selected={tab === key} className="ws-tab" onClick={() => switchTab(key)} data-testid={`search-tab-${key}`}>
    {label}{searching && key !== "all" && key !== "pages" && (() => { const total = categoryTotal(categorySources(key, role).map(src => groups[src]?.total)); return total !== null ? <span className="ws-tab-count">{total}</span> : null; })()}
  </button>;

  const directory = <>
    {(() => { const actions = quickActions(role, navigation).filter(a => !search || a.label.toLowerCase().includes(search.toLowerCase())); return actions.length ? <section><h3>Quick Actions</h3><div className="workspace-shortcuts">{actions.map(a => a.inline ? <button key={a.id} type="button" onClick={() => { close(); openQrInline(); }} data-testid={`quick-action-${a.id}`}>{a.label}</button> : <Link key={a.id} href={a.href} onClick={close} data-testid={`quick-action-${a.id}`}>{a.label}</Link>)}</div></section> : null; })()}
    {!search && <div className="ws-directory-pair">
      <section><h3><Star size={14} aria-hidden/> Favorites</h3><div className="workspace-shortcuts">{shortcutList(preferences.favorites).length ? shortcutList(preferences.favorites).map(pageLink) : <p className="muted">Star a page below to pin it here.</p>}</div></section>
      <section><h3><Clock3 size={14} aria-hidden/> Recent Pages</h3><div className="workspace-shortcuts">{shortcutList(preferences.recent).filter(p => p !== page).length ? shortcutList(preferences.recent).filter(p => p !== page).map(pageLink) : <p className="muted">Pages you visit appear here.</p>}</div></section>
    </div>}
  </>;
  const pageList = (limit?: number) => <section><h3>{search ? "Pages" : "All Pages"}{limit && pages.length > limit && <button type="button" className="ws-see-all" onClick={() => switchTab("pages")}>See all {pages.length}</button>}</h3>
    <ul className="workspace-command-pages">{pages.slice(0, limit).map(p => <li key={p}>
      <button type="button" onClick={() => { close(); navigate(`/${role}/${p}`); }}>{navLabel(p, role)}</button>
      <button type="button" aria-label={`${preferences.favorites.includes(p) ? "Remove" : "Add"} ${navLabel(p, role)} ${preferences.favorites.includes(p) ? "from" : "to"} favorites`} aria-pressed={preferences.favorites.includes(p)} onClick={() => toggleFavorite(p)}><Star size={16} fill={preferences.favorites.includes(p) ? "currentColor" : "none"} aria-hidden/></button>
    </li>)}</ul>{!pages.length && <p className="muted">No matching pages.</p>}</section>;

  const sourceBlock = (source: SearchSource, preview: boolean, heading: boolean) => {
    const state = groups[source] ?? EMPTY_STATE;
    const full = sourceListingHref(source, role, navigation, search, today);
    const body = state.error ? <p role="alert" className="ws-error">{state.error} <button type="button" className="button secondary" onClick={() => load(source, 1, preview ? PREVIEW_SIZE : PAGE_SIZE, false)} data-testid={`search-retry-${source}`}><RotateCw size={14} aria-hidden/> Retry {SOURCE_LABEL[source]}</button></p>
      : state.loading && !state.items.length ? <div className="ws-skeleton" role="status" aria-label={`Searching ${SOURCE_LABEL[source]}`}><span/><span/></div>
      : state.items.length ? <ul className="workspace-command-results">{state.items.map(result => <li key={result.id}><Link href={result.href} onClick={close}><strong>{result.label}</strong><small>{result.detail}</small></Link></li>)}</ul>
      : <p className="muted">No matching {SOURCE_LABEL[source].toLowerCase()}.</p>;
    return <div key={source} className="ws-source" aria-busy={state.loading} data-testid={`search-source-${source}`}>
      {heading && <h4>{SOURCE_LABEL[source]}<span className="ws-count">{state.error ? "" : countLabel(state.items.length, state.total)}</span></h4>}
      {body}
      {!preview && !state.error && canLoadMore(state.items.length, state.total) && <button type="button" className="button secondary ws-load-more" disabled={state.loading} onClick={() => load(source, state.page + 1, PAGE_SIZE, true)} data-testid={`search-load-more-${source}`}>{state.loading ? "Loading…" : `Load ${Math.min(PAGE_SIZE, (state.total ?? 0) - state.items.length)} More`}</button>}
      {!preview && !state.error && reachedCap(state.items.length, state.total) && <p className="ws-cap" role="status">Showing the first {state.items.length} of {state.total}. <Link href={full} onClick={close} data-testid={`search-full-${source}`}>Continue in {SOURCE_LABEL[source]} with all {state.total} results</Link></p>}
      {!preview && !state.error && state.total === null && state.items.length > 0 && <p className="ws-cap"><Link href={full} onClick={close} data-testid={`search-full-${source}`}>Open {SOURCE_LABEL[source]} for complete results</Link></p>}
    </div>;
  };
  const categoryBlock = (cat: SearchCategory, preview: boolean) => {
    const sources = categorySources(cat, role);
    const states = sources.map(src => groups[src] ?? EMPTY_STATE);
    const shown = states.reduce((n, st) => n + st.items.length, 0);
    const total = categoryTotal(states.map(st => st.total));
    const loading = states.some(st => st.loading) && !shown;
    const failed = states.every(st => st.error);
    return <section key={cat} data-testid={`search-group-${cat}`}>
      <h3>{CATEGORY_LABEL[cat]}<span className="ws-count">{loading ? "Searching…" : failed ? "" : total === null && states.some(st => st.total === null && st.items.length) ? `${shown} shown` : countLabel(shown, total)}</span>
        {preview && !failed && (total === null ? shown > 0 : total > shown) && <button type="button" className="ws-see-all" onClick={() => switchTab(cat)} data-testid={`search-see-all-${cat}`}>{total === null ? "See all" : `See all ${total}`}</button>}</h3>
      {sources.map(src => sourceBlock(src, preview, sources.length > 1))}
    </section>;
  };

  return <>
    <button type="button" className="workspace-search-trigger" onClick={() => setOpen(true)} aria-label="Search workspace (Control or Command K)" title="Search workspace · Ctrl/Cmd+K">
      <Search size={16} aria-hidden/><span>Search workspace</span><kbd>⌘/Ctrl K</kbd>
    </button>
    <AppDialog open={open} onClose={close} title="Search Workspace" size="medium">
      <div className="workspace-command">
        <div className="ws-sticky">
          <label htmlFor="workspace-command-query" className="sr-only">Search Pages and Permitted Records</label>
          <div className="ws-input"><Search size={18} aria-hidden/><input ref={inputRef} id="workspace-command-query" type="search" autoComplete="off" autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patients, appointments, staff or pages…" /></div>
          <div className="ws-tabs" role="tablist" aria-label="Search categories">
            {tabButton("all", "All")}{tabButton("pages", "Pages")}{primary.map(c => tabButton(c, CATEGORY_LABEL[c]))}
            {more.length > 0 && (more.includes(tab as SearchCategory)
              ? tabButton(tab, CATEGORY_LABEL[tab as SearchCategory])
              : <RowMenu label="More search categories" testId="search-tab-more" trigger={<span className="ws-tab ws-more">More <ChevronDown size={14} aria-hidden/></span>} items={more.map(c => ({ key: c, label: CATEGORY_LABEL[c], onSelect: () => switchTab(c) }))}/>)}
          </div>
          <p className="muted ws-note">Records need two characters. Favorites and recent pages are saved on this device; patient results and search terms are not saved.</p>
          {storageUnavailable && <p role="status">Browser storage is unavailable. Shortcuts will not persist after this session.</p>}
        </div>
        <div aria-live="polite" className="ws-body">
          {tab === "pages" ? <>{directory}{pageList()}</>
            : !searching ? <>{directory}{pageList(8)}{tab !== "all" && <p className="muted">Type at least two characters to search {CATEGORY_LABEL[tab].toLowerCase()}.</p>}</>
            : tab === "all" ? <>{pageList(4)}{categories.map(c => categoryBlock(c, true))}{!categories.length && <p className="muted">No record categories are available for your role.</p>}</>
            : categoryBlock(tab, false)}
        </div>
      </div>
    </AppDialog>
  </>;
}
