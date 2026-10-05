import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { CapabilityView, unavailable, type Capability } from "./CapabilityState";

export type NotificationTab = "all" | "appointments" | "system" | "mentions";
export type WorkspaceNotification = { id: string; kind: Exclude<NotificationTab, "all">; title: string; body?: string; createdAt: string; read: boolean };

/** Data adapter. Only supply one when a real notification API exists; none does today. */
export interface NotificationAdapter {
  list: Capability<WorkspaceNotification[]>;
  markRead?: (id: string) => void;
  markAllRead?: () => void;
}

const TABS: { id: NotificationTab; label: string }[] = [
  { id: "all", label: "All" }, { id: "appointments", label: "Appointments" }, { id: "system", label: "System" }, { id: "mentions", label: "Mentions" },
];
export const NOTIFICATIONS_UNAVAILABLE = "This workspace has no notification service yet, so nothing is delivered here. Appointment and queue changes still appear on their own pages.";
const MARK_READ_REASON = "Mark as Read needs a connected notification service.";

export function NotificationsPanel({ adapter }: { adapter?: NotificationAdapter }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  const list: Capability<WorkspaceNotification[]> = adapter?.list ?? unavailable(NOTIFICATIONS_UNAVAILABLE);
  const unread = list.state === "loaded" ? list.data.filter(n => !n.read).length : 0;
  const filtered: Capability<WorkspaceNotification[]> = list.state === "loaded"
    ? (() => { const d = tab === "all" ? list.data : list.data.filter(n => n.kind === tab); return d.length ? { state: "loaded", data: d } : { state: "empty", message: "Nothing in this tab." }; })()
    : list;
  const canMarkAll = list.state === "loaded" && !!adapter?.markAllRead && unread > 0;
  return <div className="notif" ref={root}>
    <button type="button" ref={trigger} className="notif-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => setOpen(v => !v)} data-testid="button-notifications">
      <Bell size={18} aria-hidden />{unread > 0 && <span className="notif-count" aria-hidden>{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div className="notif-panel" role="dialog" aria-label="Notifications" data-testid="panel-notifications">
      <div className="notif-head"><strong>Notifications</strong>
        <button type="button" className="notif-close" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={16} aria-hidden /></button></div>
      <div className="notif-tabs" role="tablist" aria-label="Notification type">{TABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`tab-notifications-${t.id}`}>{t.label}</button>)}</div>
      <div className="notif-body" role="tabpanel">
        <CapabilityView value={filtered} title="Notifications" testId="notifications">{items => <ul className="notif-list">{items.map(n => <li key={n.id} className={n.read ? "" : "unread"}>
          <div><strong className="ov-text" title={n.title}>{n.title}</strong>{n.body && <p>{n.body}</p>}<small className="muted">{new Date(n.createdAt).toLocaleString()}</small></div>
          {!n.read && adapter?.markRead && <button type="button" className="button secondary small" onClick={() => adapter.markRead!(n.id)}>Mark as Read</button>}
        </li>)}</ul>}</CapabilityView>
      </div>
      <div className="notif-foot">
        <button type="button" className="button secondary small" disabled={!canMarkAll} onClick={() => adapter?.markAllRead?.()} data-testid="button-mark-all-read"><CheckCheck size={15} aria-hidden />Mark All as Read</button>
        {!adapter?.markAllRead && <small className="muted" data-testid="text-mark-read-reason">{MARK_READ_REASON}</small>}
      </div>
    </div>}
  </div>;
}
