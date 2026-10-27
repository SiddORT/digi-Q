import { Activity, Bell, Building2, CalendarDays, CalendarClock, ChartNoAxesCombined, ClipboardList, Clock3, FileText, History, LayoutGrid, ListOrdered, Mail, MapPin, MessageSquare, Plug, QrCode, Settings, ShieldCheck, SlidersHorizontal, Users, UserRound, type LucideIcon } from "lucide-react";

/** Explicit semantic metadata only; never derive an icon from a user-entered name. */
const icons = {
  booking: CalendarDays, details: FileText, history: History, clinics: Building2,
  locations: MapPin, staff: Users, policies: ShieldCheck, activity: Activity,
  roles: Users, permissions: ShieldCheck, system: Settings, platform: Settings,
  integrations: Plug, masters: ClipboardList, audit: History, demo: Building2,
  qrs: QrCode, sms: MessageSquare, email: Mail, logs: History,
  weekly: CalendarDays, exceptions: CalendarClock, timing: Clock3,
  capacity: Users, queue: ListOrdered, personal: UserRound, assignment: MapPin,
  live: ChartNoAxesCombined, templates: FileText, operational: ClipboardList,
  usage: MessageSquare, all: LayoutGrid, pages: FileText, patients: UserRound,
  appointments: CalendarDays, branches: MapPin, schedules: CalendarClock,
  reports: ChartNoAxesCombined, notifications: Bell, documents: FileText,
  timeline: CalendarClock, settings: SlidersHorizontal,
} satisfies Record<string, LucideIcon>;
export type TabIconName = keyof typeof icons;
export function TabIcon({ name }: { name: TabIconName }) {
  const Icon = icons[name];
  return <Icon className="dq-tab-icon" size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
