/** Legacy /admin/settings?area= values that moved to dedicated pages. Returns null when the area stays in Settings. */
export function communicationRedirect(userRole: string, area: string | null): string | null {
  if ((area === "sms" || area === "email") && userRole === "superAdmin") return `/admin/communication?tab=${area}`;
  if ((area === "events" || area === "templates") && ["superAdmin", "clinicAdmin"].includes(userRole)) return "/admin/templates";
  return null;
}
export type CommunicationTab = "sms" | "email" | "logs";
export function communicationTab(raw: string | null): CommunicationTab { return raw === "email" || raw === "logs" ? raw : "sms"; }
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
/** API errors are sanitized by the server. Never label every failure a stale edit. */
export function eventControlError(error: unknown) {
  const failure = error as { status?: number; data?: { error?: unknown } } | null;
  if (failure?.status === 409) return "The change was not saved because this template changed. The latest values are being reloaded; review them before trying again.";
  const detail = failure?.data?.error;
  return typeof detail === "string" && detail.trim()
    ? `The change was not saved. ${detail}`
    : "The change was not saved. Please try again.";
}
/** Show only the sanitized API response, not raw transport/debug information. */
export function templateSaveError(error: unknown) {
  const detail = (error as { data?: { error?: unknown } } | null)?.data?.error;
  return typeof detail === "string" && detail.trim()
    ? `The template was not saved. ${detail}`
    : "The template was not saved. No detailed error was returned. Please try again.";
}
/** An off switch is not missing configuration; expose the other delivery gates. */
export function eventSetupReasons(row: { blockedReasons: string[] }) {
  return row.blockedReasons.filter(reason => reason !== "Published activation is off");
}
/** SMS test sends only after an explicit confirmation with a ready saved configuration. */
export function canSendSmsTest(s: { ready: boolean; confirmed: boolean; recipient: string; message: string; pending: boolean }) {
  return s.ready && s.confirmed && !!s.recipient && !!s.message.trim() && !s.pending;
}
