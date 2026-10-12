import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { usePreviewEventTemplate, useTestEventTemplate, useGetIntegrationSettings, getGetIntegrationSettingsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { FormField } from "./FormField";
import { HelpTip } from "./HelpTip";
import { EmailInput } from "./EmailInput";
import { PhoneInput } from "./PhoneInput";
import { LoadingButton } from "./LoadingButton";

type Content = api.NotificationTemplateContent;
const PH = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
/** Only placeholders that the tested channel actually renders need a value. */
export function usedPlaceholders(content: Content, channel: "email" | "sms") {
  const texts = channel === "sms" ? [content.body] : [content.subject, content.prefix, content.body, content.footer];
  const found = new Set<string>();
  for (const t of texts) for (const m of String(t ?? "").matchAll(PH)) found.add(m[1]);
  return [...found];
}
export function newRequestId() { return globalThis.crypto.randomUUID(); }
/** Stable semantic signature: changes only when the tested content, scope, revision or values really change. */
export function testSignature(parts: { channel: string; event: string; group: string; clinicId: string; revision: number; content: Content; values: Record<string, string> }) {
  return JSON.stringify([parts.channel, parts.event, parts.group, parts.clinicId, parts.revision, parts.content, Object.entries(parts.values).sort()]);
}
/** Shared readiness from the same integration query the settings pages use. */
export function useChannelReadiness(channel: "email" | "sms") {
  const q = useGetIntegrationSettings({ query: { queryKey: getGetIntegrationSettingsQueryKey(), staleTime: 30000 } });
  const r = channel === "sms" ? q.data?.notificationSms : q.data?.smtp;
  const missing = (r?.keys ?? []).filter(k => k.status === "missing" || k.status === "invalid").map(k => k.key);
  const reason = q.isLoading ? "Checking channel readiness…" : q.isError ? "Channel readiness could not be loaded." : !r ? "The server did not report readiness for this channel." : r.ready ? "" : `Configuration required${missing.length ? `: ${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} missing or invalid` : ""}.`;
  return { ready: !!r?.ready && !q.isError, reason, loading: q.isLoading, retry: () => void q.refetch() };
}

const OUTCOME: Record<string, string> = {
  preview: "Preview only. Nothing was sent.",
  provider_accepted: "The provider accepted the message. This does not confirm handset or inbox delivery.",
  provider_rejected: "The provider rejected the message.",
  pre_dispatch_failed: "Nothing was sent. Check channel configuration and the template.",
  delivery_unknown: "The outcome is unknown. Do not resend until you have checked the provider; retrying uses the same request.",
};

/** Test action for one event template: explicit recipient, values for used placeholders, confirmation, no auto retry. */
export function EventTemplateTest({ channel, event, recipient: group, clinicId, revision, content }: {
  channel: "email" | "sms"; event: string; recipient: string; clinicId: string; revision: number; content: Content;
}) {
  const used = useMemo(() => usedPlaceholders(content, channel), [content, channel]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [to, setTo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const requestId = useRef(newRequestId());
  const submitted = useRef<api.EventTemplateTestInput | null>(null);
  const sending = useRef(false);
  const preview = usePreviewEventTemplate({ mutation: { retry: false } });
  const test = useTestEventTemplate({ mutation: { retry: false } });
  const readiness = useChannelReadiness(channel);
  const exact = Object.fromEntries(used.map(k => [k, values[k] ?? ""]));
  const complete = used.every(k => (values[k] ?? "").trim() !== "");
  const sig = testSignature({ channel, event, group, clinicId, revision, content, values: exact });
  const rsig = `${sig}|${to}`;
  const first = useRef(true);
  const reset = useRef({ p: preview.reset, t: test.reset }); reset.current = { p: preview.reset, t: test.reset };
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    requestId.current = newRequestId(); submitted.current = null; sending.current = false;
    reset.current.p(); reset.current.t(); setConfirmed(false);
  }, [rsig]);
  const body = { channel: channel as api.EventTemplateTestInputChannel, event: event as api.EventTemplateTestInputEvent, recipientGroup: group as api.EventTemplateTestInputRecipientGroup, clinicId: clinicId || undefined, revision, content, values: exact };
  const result = test.data ?? preview.data;
  const label = channel === "sms" ? "Phone number" : "Email address";
  const send = () => {
    if (sending.current || !confirmed || !complete || !to.trim() || !readiness.ready) return;
    sending.current = true;
    const payload: api.EventTemplateTestInput = JSON.parse(JSON.stringify({ ...body, recipient: to.trim(), confirmed: true, requestId: requestId.current }));
    submitted.current = payload;
    test.mutate({ data: payload }, { onSettled: () => { sending.current = false; } });
  };
  const retry = () => {
    const payload = submitted.current; if (!payload || sending.current) return;
    sending.current = true;
    test.mutate({ data: payload }, { onSettled: () => { sending.current = false; } });
  };
  return <section className="panel padded et-test" aria-label="Test this template" data-testid="panel-template-test">
    <h3>Test This Template <HelpTip text="Uses your current edits, including drafts and disabled templates, without publishing or enabling anything. No appointment is created and nothing is queued. Sends one real message to the recipient you enter." /></h3>
    {!readiness.ready && <p role="note" className="error-box" data-testid="status-test-not-ready">{readiness.reason} <Link href={`/admin/settings?area=${channel === "sms" ? "sms" : "email"}`} className="text-link" data-testid="link-test-configure">Open {channel === "sms" ? "SMS" : "Email"} settings</Link>{!readiness.loading && <> <button type="button" onClick={readiness.retry} data-testid="button-test-recheck">Check Again</button></>}</p>}
    {used.length === 0 ? <p className="muted">This template uses no placeholders.</p> : <div className="et-test-values">
      {used.map(k => <FormField key={k} label={k.replace(/_/g, " ")} required>
        {(a) => <input {...a} type="text" maxLength={500} value={values[k] ?? ""} onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} data-testid={`input-test-value-${k}`} />}
      </FormField>)}
    </div>}
    <div className="et-actions">
      <LoadingButton type="button" className="button secondary" loading={preview.isPending} loadingText="Rendering…" disabled={!complete} onClick={() => preview.mutate({ data: body })} data-testid="button-test-preview">Render Preview</LoadingButton>
    </div>
    <FormField label={`Test ${label}`} required helper="One explicit recipient. Never taken from a real patient or staff record.">
      {(a) => channel === "sms"
        ? <PhoneInput {...a} value={to} onChange={setTo} autoComplete="off" data-testid="input-test-recipient" />
        : <EmailInput {...a} value={to} onChange={e => setTo(e.target.value)} autoComplete="off" data-testid="input-test-recipient" />}
    </FormField>
    <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} data-testid="checkbox-confirm-test" /> Yes, send one real {channel === "sms" ? "SMS" : "email"} to this recipient</label>
    <div className="et-actions">
      <LoadingButton type="button" className="button" loading={test.isPending} loadingText="Sending…" disabled={!confirmed || !complete || !to.trim() || !readiness.ready || test.isSuccess} onClick={send} data-testid="button-send-test">Send Test</LoadingButton>
    </div>
    {(preview.isError || test.isError) && <p role="alert" className="error-box" data-testid="status-test-error">The test could not run. Retrying reuses the same request, so it cannot duplicate a message the provider already accepted.
      {test.isError && submitted.current && <button type="button" onClick={retry} data-testid="button-retry-test">Retry Same Request</button>}</p>}
    {result && <div role="status" className="et-notice" data-testid="status-test-result"><strong>{OUTCOME[result.status] ?? result.status}</strong> {result.message}
      {channel === "email" && <div data-testid="text-test-subject">{result.subject}</div>}<pre data-testid="text-test-body">{result.body}</pre></div>}
  </section>;
}
export default EventTemplateTest;
