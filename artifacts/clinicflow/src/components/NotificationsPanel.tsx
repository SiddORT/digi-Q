import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, X } from "lucide-react";
import { OverflowText } from "./OverflowText";
import * as api from "@/lib/api";
import { formatConfiguredTimestamp } from "@/lib/date-time";
import { CapabilityView, fromQuery, type Capability } from "./CapabilityState";
import { useTabIds } from "@/lib/tabs-a11y";

export type NotificationTab = "all" | "appointments" | "queue" | "system";
const TAB_IDS: NotificationTab[] = ["all", "appointments", "queue", "system"];
const LABELS: Record<NotificationTab, string> = { all: "All", appointments: "Appointments", queue: "Queue", system: "System" };

/** Real in-app events from the server (status history and admin audit records). Read state is stored per user on the server. */
export function NotificationsPanel({ timezone }: { timezone?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const client = useQueryClient();
  const q = api.useListNotifications(undefined, { query: { queryKey: api.getListNotificationsQueryKey(), refetchInterval: 60000, staleTime: 20000 } });
  const mark = api.useMarkNotificationsRead({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: api.getListNotificationsQueryKey() }) } });
  const tabs = useTabIds<NotificationTab>(TAB_IDS, tab, setTab);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  const unread = q.data?.unread ?? 0;
  const base = fromQuery(q, { isEmpty: d => !d.items.length, emptyMessage: "Recent appointment, queue and system updates appear here.", errorMessage: "Notifications could not be loaded." });
  const filtered: Capability<api.WorkspaceNotification[]> = base.state === "loaded"
    ? (() => { const d = tab === "all" ? base.data.items : base.data.items.filter(n => n.kind === tab); return d.length ? { state: "loaded", data: d } : { state: "empty", message: `No ${LABELS[tab].toLowerCase()} notifications in the last 30 days.` }; })()
    : base as Capability<never>;
  return <div className="notif" ref={root}>
    <button type="button" ref={trigger} className="notif-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => setOpen(v => !v)} data-testid="button-notifications">
      <Bell size={18} aria-hidden />{unread > 0 && <span className="notif-count" aria-hidden>{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div className="notif-panel" role="dialog" aria-label="Notifications" data-testid="panel-notifications">
      <div className="notif-head"><strong>Notifications</strong>
        <button type="button" className="notif-close" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={16} aria-hidden /></button></div>
      <div className="notif-tabs" aria-label="Notification type" {...tabs.list}>{TAB_IDS.map(t => <button key={t} type="button" {...tabs.tab(t)} data-testid={`tab-notifications-${t}`}>{LABELS[t]}</button>)}</div>
      <div className="notif-body" {...tabs.panel(tab)}>
        <CapabilityView value={filtered} title="Notifications" testId="notifications">{items => <ul className="notif-list">{items.map(n => <li key={n.id} className={n.read ? "" : "unread"}>
          <div><OverflowText as="strong" value={n.title}/>{n.body && <p>{n.body}</p>}<small className="muted">{formatConfiguredTimestamp(n.createdAt, timezone)}</small></div>
          {!n.read && <button type="button" className="button secondary small" disabled={mark.isPending} onClick={() => mark.mutate({ data: { ids: [n.id] } })} aria-label={`Mark "${n.title}" as read`}>Mark as Read</button>}
        </li>)}</ul>}</CapabilityView>
      </div>
      <div className="notif-foot">
        <small className="muted">Latest 60 appointment and queue updates and 30 system updates from the last 30 days. Unread counts and Mark All as Read apply to this list.</small>
        <button type="button" className="button secondary small" disabled={!unread || mark.isPending} onClick={() => mark.mutate({ data: { all: true } })} data-testid="button-mark-all-read"><CheckCheck size={15} aria-hidden />Mark All as Read</button>
        {mark.isError && <small role="alert" className="field-error">Could not update read state. Try again.</small>}
      </div>
    </div>}
  </div>;
}
