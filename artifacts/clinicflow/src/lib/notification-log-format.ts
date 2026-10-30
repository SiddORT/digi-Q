import type { ListNotificationLogsParams } from "@workspace/api-client-react";
import { isCanonicalDate, isCanonicalTime } from "./date-time.ts";
export const LOG_TIMEZONE = "Asia/Kolkata";
export const UNAVAILABLE = "Unavailable";
export function smsProviderErrorHelp(log: { channel: string; httpStatus?: number | null }): string | null {
  if (log.channel !== "sms" || log.httpStatus !== 401) return null;
  return "HTTP 401: the SMS provider rejected authentication. For the Keep in Touch API, select Keep in Touch in SMS Settings and check the saved Bearer Token against the working Postman token. Enter the token only, without the “Bearer ” prefix. API Key and Client ID belong in the JSON body and are separate settings. This message is not retried automatically.";
}
export const STATUS_COPY: Record<string, string> = {
  pending: "Waiting to be sent.",
  sending: "Sending has started. We haven’t confirmed the result yet.",
  provider_accepted: "Message submitted. Delivery to the phone or inbox isn’t confirmed.",
  provider_rejected: "The message could not be sent. Check the sending settings and recipient.",
  pre_dispatch_failed: "The message was not sent.",
  delivery_unknown: "We couldn’t confirm whether the message was sent. It may still arrive and will not be sent again automatically.",
};
STATUS_COPY.not_attempted = "No send was attempted.";
STATUS_COPY.configuration_failed = "Sending settings prevented this message from being sent. Nothing was sent.";
STATUS_COPY.preparation_failed = "The message could not be prepared. Nothing was sent.";
STATUS_COPY.disabled = "Sending or this template was turned off. Nothing was sent.";
STATUS_COPY.obsolete = "The booking or recipient no longer met the requirements for this message.";
STATUS_COPY.no_recipient = "No valid recipient was available. Nothing was sent.";
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
  if (!m || !isCanonicalDate(local.slice(0, 10)) || !isCanonicalTime(local.slice(11))) return undefined;
  const t = Date.parse(`${local}:00+05:30`);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}
export function buildLogParams(f: LogFilters, cursor?: string, pageSize = 25): ListNotificationLogsParams {
  if (dateTimeRangeError(f.from, f.to)) throw new Error(dateTimeRangeError(f.from, f.to)!);
  const p: Record<string, unknown> = { pageSize };
  for (const k of ["channel", "event", "status", "clinicId", "recipientGroup", "source"] as const) if (f[k].trim()) p[k] = f[k].trim();
  for (const k of ["sender", "recipient", "reference"] as const) if (f[k].trim()) p[k] = f[k].trim();
  const from = kolkataToIso(f.from), to = kolkataToIso(f.to);
  if (from) p.from = from; if (to) p.to = to;
  if (cursor) p.cursor = cursor;
  return p as ListNotificationLogsParams;
}
export function dateTimeRangeError(from: string, to: string): string | undefined {
  const empty = (v: string) => !v || v === "T";
  if ((!empty(from) && !kolkataToIso(from)) || (!empty(to) && !kolkataToIso(to))) return "Enter a complete valid date and time, or clear both parts of a bound.";
  if (!empty(from) && !empty(to) && from > to) return "From must not be after To.";
  return undefined;
}
export function statusLabel(s: string) { return ({pending:"Waiting",sending:"Sending",provider_accepted:"Submitted",provider_rejected:"Couldn’t send",pre_dispatch_failed:"Not sent",delivery_unknown:"Sending unconfirmed",not_attempted:"Not attempted",configuration_failed:"Settings incomplete",preparation_failed:"Couldn’t prepare",disabled:"Sending turned off",obsolete:"No longer needed",no_recipient:"No recipient"} as Record<string,string>)[s]||"Status unavailable"; }

