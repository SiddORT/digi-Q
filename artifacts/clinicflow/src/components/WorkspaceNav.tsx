import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Activity, LayoutDashboard, CalendarDays, Users as UsersIcon, Building2, MapPin, Settings, ChevronDown, Clock3, QrCode, SlidersHorizontal, FileText, UserRound, Plus, ShieldCheck } from "lucide-react";
import { title } from "../resources";

const icons: Record<string, any> = { dashboard: LayoutDashboard, appointments: CalendarDays, queue: Activity, clinics: Building2, branches: MapPin, patients: UsersIcon, users: UsersIcon, settings: Settings, reports: FileText, audit: ShieldCheck, availability: Clock3, exceptions: CalendarDays, qrs: QrCode, masters: SlidersHorizontal, profile: UserRound, book: Plus, demo: QrCode };

export function navLabel(p: string, role: string) {
  if (p === "templates") return "Email templates";
  if (p === "permissions") return "Roles & permissions";
  if (p === "integrations") return "Integrations";
  if (p === "users") return "Users & staff";
  if (p === "book") return role === "patient" ? "Book Now" : "Book appointment";
  if (p === "queue" && role === "patient") return "Booking status";
  if (p === "profile" && role === "admin") return "My profile & consultation";
  if (p === "profile" && role === "doctor") return "My profile & clinics";
  const map: Record<string, string> = { dashboard: "Overview", branches: "Locations", clinics: role === "doctor" ? "My clinics" : "Clinics", availability: "Schedule", exceptions: "Schedule · exceptions", qrs: "Booking QR codes", audit: "Audit log", queue: "Live queue", masters: "Master data", demo: "Demo clinic", settings:"Clinic workspace" };
  return map[p] || title(p);
}

type Entry = { kind: "link"; page: string } | { kind: "group"; id: string; name: string; icon: any; pages: string[] };
const layout: Entry[] = [
  { kind: "link", page: "dashboard" }, { kind: "link", page: "book" }, { kind: "link", page: "appointments" }, { kind: "link", page: "queue" }, { kind: "link", page: "patients" },
  { kind: "group", id: "clinic", name: "Clinic", icon: Building2, pages: ["clinics", "branches", "users"] },
  { kind: "group", id: "schedule", name: "Schedule", icon: Clock3, pages: ["availability", "exceptions", "qrs"] },
  { kind: "link", page: "reports" }, { kind: "link", page: "settings" }, { kind: "link", page: "templates" }, { kind: "link", page: "audit" }, { kind: "link", page: "profile" },
  { kind: "group", id: "admin", name: "Administration", icon: ShieldCheck, pages: ["permissions", "integrations", "masters", "demo"] },
];

export function WorkspaceNav({ navigation, role, page, onNavigate, collapsed = false }: { navigation: string[]; role: string; page: string; onNavigate: () => void; collapsed?: boolean }) {
  const activeGroup = layout.find(e => e.kind === "group" && e.pages.includes(page)) as Extract<Entry, { kind: "group" }> | undefined;
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeGroup ? { [activeGroup.id]: true } : {}));
  useEffect(() => { if (activeGroup) setOpen(o => (o[activeGroup.id] ? o : { ...o, [activeGroup.id]: true })); }, [activeGroup?.id]);
  const leaf = (p: string, child = false) => {
    const Icon = icons[p] || FileText;
    return <Link key={p} href={`/${role}/${p}`} className={`wnav-link${child ? " child" : ""}${p === page ? " active" : ""}`} title={collapsed ? navLabel(p, role) : undefined} aria-current={p === page ? "page" : undefined} onClick={onNavigate} data-testid={`nav-${p}`}><Icon size={18} aria-hidden /><span className="wnav-label">{navLabel(p, role)}</span></Link>;
  };
  return <nav className="wnav" aria-label="Workspace">{layout.map(e => {
    if (e.kind === "link") return navigation.includes(e.page) ? leaf(e.page) : null;
    const pages = e.pages.filter(p => navigation.includes(p));
    if (!pages.length) return null;
    if (pages.length === 1) return leaf(pages[0]);
    // Icon rail: flatten groups. Labels stay in the DOM (visually hidden) so accessible names are unchanged.
    if (collapsed) return <div className="wnav-group flat" key={e.id} role="group" aria-label={e.name}>{pages.map(p => leaf(p))}</div>;
    const expanded = !!open[e.id]; const id = `wnav-${e.id}`; const Icon = e.icon;
    return <div className="wnav-group" key={e.id}>
      <button type="button" className={`wnav-link wnav-parent${activeGroup?.id === e.id ? " has-active" : ""}`} aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(o => ({ ...o, [e.id]: !expanded }))} data-testid={`nav-group-${e.id}`}>
        <Icon size={18} aria-hidden /><span className="wnav-label">{e.name}</span><ChevronDown size={15} className="wnav-chevron" aria-hidden />
      </button>
      <div id={id} className="wnav-children" hidden={!expanded}>{pages.map(p => leaf(p, true))}</div>
    </div>;
  })}</nav>;
}
