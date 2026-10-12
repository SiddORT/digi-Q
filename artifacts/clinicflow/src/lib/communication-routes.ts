/** Legacy /admin/settings?area= values that moved to dedicated pages. Returns null when the area stays in Settings. */
export function communicationRedirect(userRole: string, area: string | null): string | null {
  if ((area === "sms" || area === "email") && userRole === "superAdmin") return `/admin/communication?tab=${area}`;
  if ((area === "events" || area === "templates") && ["superAdmin", "clinicAdmin"].includes(userRole)) return "/admin/templates";
  if (userRole === "clinicAdmin" && !area) return "/admin/templates";
  return null;
}
export type CommunicationTab = "sms" | "email";
export function communicationTab(raw: string | null): CommunicationTab { return raw === "email" ? "email" : "sms"; }
/** Pure helpers for the event-first template list. */
export type ListRow = { channel: "email" | "sms"; event: string; recipient: string; enabled: boolean; ready: boolean; source: string; inherited: boolean; preview: string };
export function filterRows(rows: ListRow[], f: { q: string; channel: string; recipient: string; status: string }) {
  const q = f.q.trim().toLowerCase();
  return rows.filter(r => (!q || `${r.event} ${r.recipient} ${r.preview}`.toLowerCase().includes(q)) && (!f.channel || r.channel === f.channel) && (!f.recipient || r.recipient === f.recipient)
    && (!f.status || (f.status === "on" ? r.enabled && r.ready : f.status === "blocked" ? r.enabled && !r.ready : !r.enabled)));
}

/** Request body for an event activation change. Always explicit confirmation, never replays past events. */
export function eventControlBody(row: { channel: string; event: string; recipient: string; revision: number }, next: boolean, clinicId: string) {
  return { channel: row.channel, event: row.event, recipient: row.recipient, clinicId: clinicId || undefined, revision: row.revision, enabled: next, confirmed: true as const };
}
/** SMS test sends only after an explicit confirmation with a ready saved configuration. */
export function canSendSmsTest(s: { ready: boolean; confirmed: boolean; recipient: string; message: string; pending: boolean }) {
  return s.ready && s.confirmed && !!s.recipient && !!s.message.trim() && !s.pending;
}
