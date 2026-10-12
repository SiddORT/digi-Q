import { useEffect, useRef, useState } from "react";
import { useSendNotificationSmsTestMessage } from "@workspace/api-client-react";
import { PhoneInput } from "./PhoneInput";
import { canSendSmsTest } from "../lib/communication-routes";

export function SmsTestMessage({ ready, onBusyChange }: { ready: boolean; onBusyChange?: (b: boolean) => void }) {
  const t = useSendNotificationSmsTestMessage();
  const busyRef = useRef(onBusyChange); busyRef.current = onBusyChange;
  useEffect(() => { busyRef.current?.(t.isPending); }, [t.isPending]);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("DigiQ test message. No action needed.");
  const [dlt, setDlt] = useState({ senderId: "", dltEntityId: "", dltTemplateId: "" });
  const [ok, setOk] = useState(false);
  const can = canSendSmsTest({ ready, confirmed: ok, recipient, message, pending: t.isPending });
  const set = (k: keyof typeof dlt, v: string) => { t.reset(); setDlt(d => ({ ...d, [k]: v })); };
  return <form className="cf-form" aria-label="Send SMS test" data-testid="form-sms-test" onSubmit={e => {
    e.preventDefault(); if (!can) return;
    t.mutate({ data: { recipient, message, senderId: dlt.senderId || undefined, dltEntityId: dlt.dltEntityId || undefined, dltTemplateId: dlt.dltTemplateId || undefined } });
  }}>
    <h3>Send SMS test</h3>
    <p className="muted">Uses the saved provider configuration only. It does not change any event or activation setting. Provider acceptance is not proof of handset delivery.</p>
    <div className="form-field"><label htmlFor="sms-test-to">Test number</label><PhoneInput id="sms-test-to" value={recipient} onChange={(v: string) => { t.reset(); setRecipient(v); }} data-testid="input-sms-test-number" /></div>
    <div className="form-field"><label htmlFor="sms-test-msg">Message</label><textarea id="sms-test-msg" rows={3} maxLength={1600} value={message} onChange={e => { t.reset(); setMessage(e.target.value); }} data-testid="input-sms-test-message" /></div>
    {([["senderId", "Sender ID (optional)"], ["dltEntityId", "DLT Entity ID (optional)"], ["dltTemplateId", "DLT Template ID (optional)"]] as const).map(([k, l]) => <div className="form-field" key={k}><label htmlFor={`sms-test-${k}`}>{l}</label><input id={`sms-test-${k}`} maxLength={50} value={dlt[k]} onChange={e => set(k, e.target.value)} data-testid={`input-sms-test-${k}`} /></div>)}
    <label className="check-label"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} data-testid="checkbox-confirm-sms-test" /> Yes, send a real SMS to this number</label>
    {t.data && <p role="status" className="notice" data-testid="status-sms-test-result">{t.data.message}</p>}
    {t.isError && <p role="alert" className="error-box" data-testid="status-sms-test-error">The test could not run. Check the saved configuration and try again.</p>}
    <div><button type="submit" className="button" disabled={!can} data-testid="button-send-sms-test">{t.isPending ? "Sending…" : "Send test SMS"}</button></div>
  </form>;
}
