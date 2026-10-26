import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { usePreviewEventTemplate, useTestEventTemplate, useGetIntegrationSettings, getGetIntegrationSettingsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { FormField } from "./FormField";
import { HelpTip } from "./HelpTip";
import { EmailInput } from "./EmailInput";
import { PhoneInput } from "./PhoneInput";
import { LoadingButton } from "./LoadingButton";
import { canStartNewTemplateTest } from "../lib/template-test-recovery";
import { templateTestRequestError } from "../lib/template-test-request-error";
import { requiredSecurityEvent } from "../lib/security-template-events";
import { accountRoleLabel, notificationVariableField } from "@workspace/api-zod/notification-variable-contract";
import { DateFormatInput, TimeFormatInput } from "./DateFormatInput";
import { useDateTimePreferences } from "./DateTimePreferences";
import { resolveDateTimePreferences } from "../lib/date-time";
import { templateTestValue } from "../lib/template-test-fields";
import { EmailHtmlPreview } from "./EmailHtmlPreview";

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
  const securityPreview = requiredSecurityEvent(event);
  const used = useMemo(() => usedPlaceholders(content, channel), [content, channel]);
  const [values, setValues] = useState<Record<string, string>>({});
  const inheritedPreferences = useDateTimePreferences();
  const needsFormats = used.some(k => notificationVariableField(k).kind !== "text");
  const clinic = api.useGetClinicSettings(clinicId, { query: { queryKey: api.getGetClinicSettingsQueryKey(clinicId), enabled: !!clinicId && !securityPreview && needsFormats, staleTime: 30000 } });
  const preferences = clinicId ? resolveDateTimePreferences(clinic.data?.clinic) : inheritedPreferences;
  const formatsReady = !needsFormats || !clinicId || securityPreview || (!!clinic.data && !clinic.isError && !clinic.isLoading);
  const [to, setTo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const requestId = useRef(newRequestId());
  const submitted = useRef<api.EventTemplateTestInput | null>(null);
  const sending = useRef(false);
  const preview = usePreviewEventTemplate({ mutation: { retry: false } });
  const test = useTestEventTemplate({ mutation: { retry: false } });
  const readiness = useChannelReadiness(channel);
  const fictional:Record<string,string> = {otp:"123456",expiry_minutes:"10",setup_link:"https://example.invalid/set-password?token=fictional-preview-only",recipient_name:"Example Recipient",role_name:accountRoleLabel(group)};
  const exact = Object.fromEntries(used.map(k => {
    return [k, securityPreview ? fictional[k] || "[Example value]" : templateTestValue(k, values[k] ?? "", preferences)];
  }));
  const complete = formatsReady && (securityPreview || used.every(k => k === "clinic_contact" || exact[k].trim() !== ""));
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
  const requestError = test.isError ? templateTestRequestError(test.error)
    : preview.isError ? templateTestRequestError(preview.error, "preview") : null;
  const failed = result?.status === "pre_dispatch_failed" || result?.status === "provider_rejected";
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
  const startNewTest = () => {
    if (sending.current || test.isPending || !canStartNewTemplateTest(test.data?.status)) return;
    requestId.current = newRequestId();
    submitted.current = null;
    test.reset(); preview.reset(); setConfirmed(false);
  };
  return <section className="panel padded et-test" aria-label="Test this template" data-testid="panel-template-test">
    <h3>{securityPreview ? "Preview security template" : "Test This Template"} <HelpTip text={securityPreview ? "Fictional preview only. No real codes, links or security bodies enter history. Delivery verification requires separate authorization." : "Uses your current edits, including drafts and disabled templates, without publishing or enabling anything. No appointment is created and nothing is queued. Sends one real message to the recipient you enter."} /></h3>
    {!readiness.ready && <p role="note" className="error-box" data-testid="status-test-not-ready">{readiness.reason} <Link href={`/admin/settings?area=${channel === "sms" ? "sms" : "email"}`} className="text-link" data-testid="link-test-configure">Open {channel === "sms" ? "SMS" : "Email"} settings</Link>{!readiness.loading && <> <button type="button" onClick={readiness.retry} data-testid="button-test-recheck">Check Again</button></>}</p>}
    {!formatsReady && <p role="status">Clinic display formats {clinic.isError ? "could not be loaded." : "are loading…"} {clinic.isError && <button type="button" onClick={() => void clinic.refetch()}>Retry Clinic Formats</button>}</p>}
    {used.length === 0 ? <p className="muted">This template uses no placeholders.</p> : <div className="et-test-values">
      {used.map(k => <FormField key={k} label={notificationVariableField(k).label} required={k !== "clinic_contact"}>
        {(a) => {
          // An empty form owner detaches optional test controls from an enclosing
          // wording form, including when Advanced is collapsed. Keep their native
          // validity and the preview/send completeness + consent gates unchanged.
          const props = { ...a, form: "", required: k !== "clinic_contact", value: values[k] ?? "", onChange: (value: string) => setValues(v => ({ ...v, [k]: value })), "data-testid": `input-test-value-${k}` };
          return !securityPreview && notificationVariableField(k).kind === "date" ? <DateFormatInput {...props} preferences={preferences} disabled={!formatsReady} />
            : !securityPreview && notificationVariableField(k).kind === "time" ? <TimeFormatInput {...props} preferences={preferences} disabled={!formatsReady} />
            : <input {...a} form="" type="text" maxLength={500} readOnly={securityPreview} value={securityPreview ? exact[k] : values[k] ?? ""} onChange={e => props.onChange(e.target.value)} data-testid={`input-test-value-${k}`} />;
        }}
      </FormField>)}
    </div>}
    <div className="et-actions">
      <LoadingButton type="button" className="button secondary" loading={preview.isPending} loadingText="Rendering…" disabled={!complete} onClick={() => preview.mutate({ data: body })} data-testid="button-test-preview">Render Preview</LoadingButton>
    </div>
    {!securityPreview && <><FormField label={`Test ${label}`} required helper="One explicit recipient. Never taken from a real patient or staff record.">
      {(a) => channel === "sms"
        ? <PhoneInput {...a} form="" value={to} onChange={setTo} autoComplete="off" data-testid="input-test-recipient" />
        : <EmailInput {...a} form="" value={to} onChange={e => setTo(e.target.value)} autoComplete="off" data-testid="input-test-recipient" />}
    </FormField>
    <label className="check-label"><input form="" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} data-testid="checkbox-confirm-test" /> Yes, send one real {channel === "sms" ? "SMS" : "email"} to this recipient</label>
    <div className="et-actions">
      <LoadingButton type="button" className="button" loading={test.isPending} loadingText="Sending…" disabled={!confirmed || !complete || !to.trim() || !readiness.ready || test.isSuccess || test.isError} onClick={send} data-testid="button-send-test">Send Test</LoadingButton>
    </div></>}
    {requestError && <div role="alert" className="error-box et-test-request-error" data-testid="status-test-error">
      <strong>{requestError.title}</strong>
      <p>{requestError.detail}</p>
      {test.isError && submitted.current && <button type="button" className="button secondary" disabled={test.isPending} onClick={retry} data-testid="button-retry-test">Retry Same Request</button>}
    </div>}
    {result && <div role={failed ? "alert" : "status"} className={`et-test-result ${failed ? "error-box" : "et-notice"}`} data-testid="status-test-result"><strong>{OUTCOME[result.status] ?? result.status}</strong> {result.message}
      {canStartNewTemplateTest(test.data?.status) && <p>After resolving the issue, start a new test and confirm again.
        <button type="button" className="button secondary small" disabled={test.isPending} onClick={startNewTest} data-testid="button-start-new-test">Start New Test</button></p>}
      {channel === "email" && <div data-testid="text-test-subject">{result.subject}</div>}
      {channel === "email" && preview.data?.html && <EmailHtmlPreview html={preview.data.html} />}
      {channel === "email" ? <details><summary>Plain-text view</summary><pre data-testid="text-test-body">{result.body}</pre></details> : <pre data-testid="text-test-body">{result.body}</pre>}</div>}
  </section>;
}
export default EventTemplateTest;
