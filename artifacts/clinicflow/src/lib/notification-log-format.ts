import type { ListNotificationLogsParams } from "@workspace/api-client-react";
export const LOG_TIMEZONE = "Asia/Kolkata";
export const UNAVAILABLE = "Unavailable";
export function smsProviderErrorHelp(log: { channel: string; httpStatus?: number | null }): string | null {
  if (log.channel !== "sms" || log.httpStatus !== 401) return null;
  return "HTTP 401: the SMS provider rejected authentication. For the Keep in Touch API, select Keep in Touch in SMS Settings and check the saved Bearer Token against the working Postman token. Enter the token only, without the “Bearer ” prefix. API Key and Client ID belong in the JSON body and are separate settings. This message is not retried automatically.";
}
export const STATUS_COPY: Record<string, string> = {
  pending: "Queued; not yet dispatched.",
  sending: "Dispatch claimed. Outcome is unconfirmed.",
  provider_accepted: "Provider accepted the request. This is not proof of delivery to the handset or inbox.",
  provider_rejected: "The provider explicitly rejected the message.",
  pre_dispatch_failed: "Failed before dispatch; nothing was sent.",
  delivery_unknown: "Dispatch may have succeeded. The outcome is unknown and the message is not resent automatically. Stale sending records are reported this way by the server.",
};
STATUS_COPY.not_attempted = "No dispatch was attempted.";
STATUS_COPY.configuration_failed = "Provider configuration prevented dispatch. Nothing was sent.";
STATUS_COPY.preparation_failed = "The message could not be prepared before dispatch. Nothing was sent.";
STATUS_COPY.disabled = "Notifications or this template were disabled before dispatch.";
STATUS_COPY.obsolete = "The booking or recipient was no longer eligible at dispatch.";
STATUS_COPY.no_recipient = "No valid recipient was available at dispatch.";
export const EVENT_OPTIONS = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "provider_test"];
export const STATUS_OPTIONS = ["pending", "sending", "provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "not_attempted", "configuration_failed", "preparation_failed", "disabled", "obsolete", "no_recipient"];
export const GROUP_OPTIONS = ["patient", "clinicAdmin", "doctor", "receptionist", "explicit"];
export const LEGACY_NOTE = "Legacy record: fields recorded before detailed logging are incomplete and shown as unavailable.";
export type LogFilters = { from: string; to: string; channel: string; event: string; status: string; clinicId: string; recipientGroup: string; source: string; sender: string; recipient: string; reference: string };
export const EMPTY_FILTERS: LogFilters = { from: "", to: "", channel: "", event: "", status: "", clinicId: "", recipientGroup: "", source: "", sender: "", recipient: "", reference: "" };

export function show(v: unknown): string { return v === null || v === undefined || v === "" ? UNAVAILABLE : String(v); }
export function formatLogTime(ms: number | null | undefined, tz: string = LOG_TIMEZONE): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return UNAVAILABLE;
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "medium" }).format(new Date(ms)) + ` (${tz})`;
}
/** Local datetime-local value interpreted as Asia/Kolkata (UTC+05:30, no DST) to ISO. */
export function kolkataToIso(local: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return undefined;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 330 * 60000;
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}
export function buildLogParams(f: LogFilters, cursor?: string, pageSize = 25): ListNotificationLogsParams {
  const p: Record<string, unknown> = { pageSize };
  for (const k of ["channel", "event", "status", "clinicId", "recipientGroup", "source"] as const) if (f[k].trim()) p[k] = f[k].trim();
  for (const k of ["sender", "recipient", "reference"] as const) if (f[k].trim()) p[k] = f[k].trim();
  const from = kolkataToIso(f.from), to = kolkataToIso(f.to);
  if (from) p.from = from; if (to) p.to = to;
  if (cursor) p.cursor = cursor;
  return p as ListNotificationLogsParams;
}
export function statusLabel(s: string) { return s.replace(/_/g, " "); }

