import { PageDescription } from "./PageDescription";
import { StatusSwitch } from "./StatusSwitch";
import { UrlInput } from "./UrlInput";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetIntegrationSettingsQueryKey, type IntegrationReadiness, useSendNotificationSmsTestMessage, useUpdateIntegrationSettings } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { PasswordInput } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { SecretField } from "./SecretField";
import { useConfirm } from "./ConfirmDialog";
import { canSendSmsTest } from "../lib/communication-routes";
import { deliverySummary } from "../lib/delivery-summary";
import { useServerWait } from "../lib/use-server-wait";
import { canRetryLoad } from "../lib/friendly-error";
import { RecoveryActions } from "./RecoveryActions";
import { DEFAULT_MAPPING, parseStatuses, serializeMapping, validateMapping, validateUrl, type SmsMapping } from "./sms-mapping";
const KEEP_IN_TOUCH_URL = "https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS";

export function SmsProviderPanel({ r, editable, onDirtyChange, onBusyChange, onSaved }: { r: IntegrationReadiness; editable: boolean; onDirtyChange: (d: boolean) => void; onBusyChange: (b: boolean) => void; onSaved: () => void }) {
  const initKit = r.keepInTouchApiUrl ?? (r.smsProvider === "keepInTouch" && r.apiUrl ? r.apiUrl : KEEP_IN_TOUCH_URL);
  const initUrl = r.customApiUrl ?? (r.smsProvider === "keepInTouch" ? "" : r.apiUrl ?? ""); const initEnabled = r.notificationsEnabled ?? true;
  const saved = (k: string) => r.keys.find(i => i.key === k)?.status === "configured";
  const initProvider = r.smsProvider ?? "generic";
  const initFormat = r.countryCodeFormat ?? "";
  const [provider, setProvider] = useState(initProvider);
  const [countryFormat, setCountryFormat] = useState(initFormat);
  const kit = provider === "keepInTouch";
  const [enabled, setEnabled] = useState(initEnabled);
  const [url, setUrl] = useState(initUrl);
  const [kitUrl, setKitUrl] = useState(initKit);
  const [secrets, setSecrets] = useState({ key: "", bearer: "", client: "", sender: "" });
  const [map, setMap] = useState<SmsMapping>(DEFAULT_MAPPING);
  const [mapTouched, setMapTouched] = useState(false);
  const [statuses, setStatuses] = useState("200, 202");
  const [mode, setMode] = useState<"database" | "environment">("database");
  const [envOk, setEnvOk] = useState(false);
  const [tplId, setTplId] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [askPw, setAskPw] = useState(false);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const save = useUpdateIntegrationSettings();
  const test = useSendNotificationSmsTestMessage();
  const limit=useServerWait();
  const lastTest=useRef<{key:string;id:string}|null>(null);
  const confirm = useConfirm();
  const qc = useQueryClient();
  const lastInit = useRef({ initKit, initUrl, initEnabled, initProvider, initFormat });
  useEffect(() => {
    const p = lastInit.current;
    if (p.initKit !== initKit) setKitUrl(c => c === p.initKit ? initKit : c);
    if (p.initUrl !== initUrl) setUrl(c => c === p.initUrl ? initUrl : c);
    if (p.initEnabled !== initEnabled) setEnabled(c => c === p.initEnabled ? initEnabled : c);
    if (p.initProvider !== initProvider) setProvider(c => c === p.initProvider ? initProvider : c);
    if (p.initFormat !== initFormat) setCountryFormat(c => c === p.initFormat ? initFormat : c);
    lastInit.current = { initKit, initUrl, initEnabled, initProvider, initFormat };
  }, [initKit, initUrl, initEnabled, initProvider, initFormat]);
  const dirty = provider !== initProvider || countryFormat !== initFormat || enabled !== initEnabled || url !== initUrl || kitUrl !== initKit || Object.values(secrets).some(Boolean) || mapTouched || mode !== "database";
  const dr = useRef(onDirtyChange); dr.current = onDirtyChange;
  useEffect(() => { dr.current(dirty); }, [dirty]);
  const br = useRef(onBusyChange); br.current = onBusyChange;
  const busy = save.isPending || test.isPending;
  useEffect(() => { br.current(busy); }, [busy]);
  const full: SmsMapping = { ...map, acceptedStatuses: parseStatuses(statuses) };
  const errs = mapTouched ? validateMapping(full) : [];
  const urlErr = (kit ? (kitUrl.trim() ? validateUrl(kitUrl.trim()) : "Enter the Keep in Touch https:// endpoint.") : validateUrl(url)) ?? undefined;
  const requiredMissing = (["bearer", "sender"] as const).some(k =>
    !secrets[k].trim() && !saved({ bearer: "NOTIFICATION_SMS_BEARER_TOKEN", sender: "NOTIFICATION_SMS_SENDER_ID" }[k]));
  const kitMissing = kit && (!countryFormat || (["key", "bearer", "client"] as const).some(k =>
    !secrets[k] && !saved({ key: "NOTIFICATION_SMS_KEY", bearer: "NOTIFICATION_SMS_BEARER_TOKEN", client: "NOTIFICATION_SMS_CLIENT_ID" }[k])));
  const blocked = !editable || (mode === "database" ? (!!urlErr || (!kit && errs.length > 0) || kitMissing || requiredMissing) : !envOk);
  const patch = (p: Partial<typeof map>) => { setMapTouched(true); setMap(m => ({ ...m, ...p })); };
  const setS = (k: keyof typeof secrets) => (v: string) => setSecrets(s => ({ ...s, [k]: v }));
  const values = () => {
    const v: Record<string, string> = {};
    if (mode !== "database") return v;
    v.NOTIFICATION_SMS_PROVIDER = provider;
    if (countryFormat) v.NOTIFICATION_SMS_COUNTRY_CODE_FORMAT = countryFormat;
    if (!kit && url && url !== initUrl) v.NOTIFICATION_SMS_URL = url;
    if (kit && kitUrl.trim() !== initKit) v.NOTIFICATION_SMS_KEEP_IN_TOUCH_URL = kitUrl.trim();
    if (secrets.key) v.NOTIFICATION_SMS_KEY = secrets.key;
    if (secrets.bearer) v.NOTIFICATION_SMS_BEARER_TOKEN = secrets.bearer;
    if (secrets.client) v.NOTIFICATION_SMS_CLIENT_ID = secrets.client;
    if (secrets.sender) v.NOTIFICATION_SMS_SENDER_ID = secrets.sender;
    v.NOTIFICATION_SMS_ENABLED = enabled ? "true" : "false";
    const retainedMapping = r.keys.some(k => k.key === "NOTIFICATION_SMS_MAPPING" && ["configured", "invalid"].includes(k.status));
    if (!kit && (mapTouched || !retainedMapping)) v.NOTIFICATION_SMS_MAPPING = serializeMapping(full);
    return v;
  };
  const doSave = () => save.mutate({ data: { provider: "notificationSms", mode, revision: r.revision ?? null, currentPassword: pw, values: values() } }, {
    onSuccess: next => { qc.setQueryData(getGetIntegrationSettingsQueryKey(), next); setPw(""); setAskPw(false); setMapTouched(false); setSecrets({ key: "", bearer: "", client: "", sender: "" }); setMsg("Settings saved. Delivery hasn’t been tested. No message was sent."); void qc.invalidateQueries({ queryKey: getGetIntegrationSettingsQueryKey() }); onSaved(); },
    onError: () => setPw(""),
  });
  const testKey=JSON.stringify([to,body,tplId,r.revision]);
  const sameTest=lastTest.current?.key===testKey;
  const reconcile=sameTest&&(test.isError||test.data?.status==="delivery_unknown");
  const can = !dirty && limit.wait<=0 && !(sameTest&&test.data?.status==="provider_accepted") && !(sameTest&&test.isError&&!canRetryLoad(test.error)) && (!kit || !!tplId.trim()) && canSendSmsTest({ ready: r.ready, confirmed: true, recipient: to, message: body, pending: test.isPending });
  const testing = useRef(false);
  const runTest = async () => {
    if (!can) return;
    if (testing.current) return;
    testing.current = true;
    try {
    if (!reconcile&&!await confirm.ask({ title: "Send a real test SMS?", description: `A real message will be sent to ${to} using saved provider settings and the template ID and body entered here. This does not enable optional notifications.`, confirmLabel: "Send test SMS", tone: "danger" })) return;
    if(!reconcile)lastTest.current={key:testKey,id:crypto.randomUUID()};
    await test.mutateAsync({ data: { recipient: to, message: body, dltTemplateId: tplId || undefined, confirmed: true, requestId:lastTest.current!.id } }).catch(e => {limit.record(e);});
    } finally { testing.current = false; }
  };
  const sec = (id: string, label: string, k: "key" | "bearer" | "client" | "sender", key: string) =>
    <div className="form-field"><label htmlFor={id}>{label}</label><SecretField id={id} label={label} testId={id} configured={saved(key)} value={secrets[k]} onChange={setS(k)} /></div>;
  return <div className="sms-ref">
    {confirm.dialog}
    <h2 id="sms-config-title" className="sms-ref-title">SMS Provider Configuration</h2>
    {!editable && <p role="note" className="notice">Editing is locked until the server encryption key is configured.</p>}
    {!r.ready && <div role="note" className="notice"><p>SMS settings are incomplete. Complete the fields below. Leave saved credentials blank to keep them.</p><details><summary>Technical details</summary>{r.keys.filter(k => k.status === "missing" || k.status === "invalid").map(k => `${k.key}: ${k.status}`).join("; ")}</details></div>}
    {msg && <p role="status" className="notice" data-testid="status-sms-saved">{msg}</p>}
    <fieldset disabled={!editable || save.isPending} className="sms-ref-fields">
      <StatusSwitch label="Enable SMS Notifications" active={enabled} onChange={setEnabled} testId="checkbox-sms-enabled">Enable SMS Notifications</StatusSwitch>
      <p className="muted field-hint">Applies to optional notifications only. Account security codes are unaffected.</p>
      <div className="form-field"><label htmlFor="sms-provider">SMS Provider</label>
        <select id="sms-provider" value={provider} onChange={e => setProvider(e.target.value as typeof provider)} data-testid="select-sms-provider"><option value="generic">Custom API</option><option value="keepInTouch">Keep in Touch</option></select></div>
      {!kit && url.trim() === KEEP_IN_TOUCH_URL && <div className="notice" role="note" data-testid="warning-sms-kit-provider">
        <p>The Keep in Touch endpoint is saved as Custom API. That mode does not use the dedicated Keep in Touch JSON body and Bearer authorization. Select Keep in Touch and digits-only country codes to match the working Postman request.</p>
        <button type="button" className="button secondary" data-testid="button-use-kit-provider" onClick={() => { setProvider("keepInTouch"); setCountryFormat("digits"); setMsg(null); test.reset(); }}>Use Keep in Touch (91)</button>
        <p className="muted">This prepares a draft only. Confirm and save with your password to change the provider. Saved credentials are preserved; no message is sent.</p>
      </div>}
      {kit && <div className="notice" data-testid="help-keep-in-touch">
        <PageDescription text="Configure the Keep in Touch sender and credentials." label="About the Keep in Touch request" help="Uses POST with application/json and Bearer authorization. The body contains countryCode, mobile, senderId, message, apiKey, clientId and templateId. Entity ID is not sent. Publish each event’s DLT Template ID in Notifications. Its URL is separate from the retained Custom API URL and mapping. HTTP 200 with boolean Success:true (or lowercase success) means acceptance; Success:false is rejection. Malformed or conflicting responses remain uncertain. Requests wait up to 30 seconds."/>
        <p>Bearer Token, API Key, Client ID and Sender ID are required; token and key are separate protected values.</p>
        <p>Submitting a message does not confirm delivery. Saving or testing does not turn on notifications.</p>
        <div className="form-field"><label htmlFor="sms-country-format">Country Code format (confirm with provider)</label>
          <select id="sms-country-format" value={countryFormat} onChange={e => setCountryFormat(e.target.value as typeof countryFormat)} data-testid="select-sms-country-format">
            <option value="">Choose explicitly</option><option value="digits">Digits only (91)</option><option value="plus">Plus-prefixed (+91)</option>
          </select>
          <small>The supplied example does not verify the '+' convention. Confirm before sending; the app never tries both. mobile is the national number, preserving leading zeros.</small>
        </div>
      </div>}
      {mode === "database" && <>
        <div className="sms-ref-grid">
          <div className="form-field"><label htmlFor="sms-url">API Base URL</label>
            <UrlInput id="sms-url" validationMessage={urlErr} aria-describedby={urlErr ? "sms-url-error" : undefined} maxLength={2048} value={kit ? kitUrl : url} placeholder="https://" onChange={e => kit ? setKitUrl(e.target.value) : setUrl(e.target.value)} data-testid="input-sms-url" />
            {urlErr && <p id="sms-url-error" role="alert" className="field-error" data-testid="error-sms-url">{urlErr}</p>}</div>
          {sec("sms-key", kit ? "API Key (required)" : "API Key", "key", "NOTIFICATION_SMS_KEY")}
          {sec("sms-client", kit ? "Client ID (required)" : "Client ID", "client", "NOTIFICATION_SMS_CLIENT_ID")}
          {sec("sms-bearer", "Bearer Token (required)", "bearer", "NOTIFICATION_SMS_BEARER_TOKEN")}
          {sec("sms-sender", "Sender ID (required)", "sender", "NOTIFICATION_SMS_SENDER_ID")}
          <small className="muted">Enter the token only, without the “Bearer ” prefix. Custom APIs use this value when Bearer authentication is selected. Blank credential fields preserve saved values.</small>
        </div>
      </>}
    </fieldset>
      <div className="sms-ref-test" data-testid="panel-sms-test">
        <h3>Test SMS Configuration</h3>
        <div className="form-field sms-ref-narrow"><label htmlFor="sms-test-tpl">Test DLT Template ID</label>
          <input id="sms-test-tpl" maxLength={50} value={tplId} onChange={e => { test.reset(); setTplId(e.target.value); }} data-testid="input-sms-test-dltTemplateId" /></div>
        <div className="form-field"><label htmlFor="sms-test-msg">Test Message Body</label>
          <textarea id="sms-test-msg" rows={3} maxLength={1600} value={body} onChange={e => { test.reset(); setBody(e.target.value); }} data-testid="input-sms-test-message" />
          <small className="muted">Must match your DLT-registered test template exactly.</small></div>
        {test.data && <p role="status" className="notice" data-testid="status-sms-test-result">{deliverySummary(test.data.status,"SMS")}</p>}
        {test.isError && <p role="alert" className="error-box" data-testid="status-sms-test-error">We couldn’t confirm the test SMS result. Check the recipient’s messages and saved settings before starting another test.</p>}
        {test.isError&&<RecoveryActions error={test.error}/>}
      </div>
    <fieldset disabled={!editable || save.isPending} className="sms-ref-fields">
      <details className="cm-advanced int-advanced" data-testid="details-sms-mapping"><summary>Advanced{mapTouched ? " (edited)" : ""}</summary>
        <div className="sms-ref-grid">
          {!kit && <>
          <PageDescription className="muted sms-ref-wide" text="Map your provider’s HTTPS POST request." label="About custom SMS mapping" help="Data only; compatibility is confirmed by a successful test. Sender and Entity IDs are defaults unless an event template overrides them."/>
          <p className="sms-ref-wide">The optional status URL is not polled and does not confirm delivery.</p>
          <div className="form-field"><label htmlFor="sms-enc">Body encoding</label><select id="sms-enc" value={map.encoding} onChange={e => patch({ encoding: e.target.value as SmsMapping["encoding"] })} data-testid="select-sms-encoding"><option value="json">JSON</option><option value="form">Form (urlencoded)</option></select></div>
          <div className="form-field"><label htmlFor="sms-auth">Authentication</label><select id="sms-auth" value={map.authMode} onChange={e => patch({ authMode: e.target.value as SmsMapping["authMode"] })} data-testid="select-sms-auth"><option value="header">API key header</option><option value="bearer">Bearer token</option><option value="body">Named body field</option></select></div>
          {map.authMode !== "bearer" && <div className="form-field"><label htmlFor="sms-authfield">{map.authMode === "header" ? "Header name" : "Body field name"}</label><input id="sms-authfield" value={map.authField} maxLength={50} onChange={e => patch({ authField: e.target.value })} data-testid="input-sms-authfield" /></div>}
          <div className="form-field"><label htmlFor="sms-f-clientId">Field for Client ID</label><input id="sms-f-clientId" value={map.fields.clientId ?? ""} maxLength={50} onChange={e => patch({ fields: { ...map.fields, clientId: e.target.value } })} data-testid="input-sms-field-clientId" /></div>
          {(["recipient", "message", "senderId", "dltEntityId", "dltTemplateId"] as const).map(k => <div className="form-field" key={k}><label htmlFor={`sms-f-${k}`}>Field for {k}</label><input id={`sms-f-${k}`} value={map.fields[k]} maxLength={50} onChange={e => patch({ fields: { ...map.fields, [k]: e.target.value } })} data-testid={`input-sms-field-${k}`} /></div>)}
          <div className="form-field"><label htmlFor="sms-status">Accepted HTTP statuses</label><input id="sms-status" value={statuses} onChange={e => { setMapTouched(true); setStatuses(e.target.value); }} data-testid="input-sms-statuses" /></div>
          <label className="check-label sms-ref-wide"><input type="checkbox" checked={map.dltRequired} onChange={e => patch({ dltRequired: e.target.checked })} data-testid="checkbox-sms-dlt-required" /> DLT metadata required for enabled templates</label>
          {errs.length > 0 && <ul role="alert" className="error-box sms-ref-wide" data-testid="error-sms-mapping">{errs.map(x => <li key={x}>{x}</li>)}</ul>}
          </>}
          <div className="sms-ref-wide choice-row" role="radiogroup" aria-label="Configuration source">
            <label className="check-label"><input type="radio" checked={mode === "database"} onChange={() => setMode("database")} data-testid="radio-sms-source-database" /> Encrypted website settings</label>
            <label className="check-label"><input type="radio" checked={mode === "environment"} onChange={() => setMode("environment")} /> Use server environment instead</label>
          </div>
          {mode === "environment" && <label className="check-label sms-ref-wide"><input type="checkbox" checked={envOk} onChange={e => setEnvOk(e.target.checked)} /> This removes saved website settings. SMS stops if the server environment is incomplete. I understand.</label>}
        </div>
      </details>
    </fieldset>
    {save.isError && !askPw && <p role="alert" className="error-box" data-testid="error-sms-save">Settings were not saved. Check your password and fields, or refresh if another administrator made changes.</p>}
    <div className="sms-ref-footer">
      <button type="button" className="button" disabled={blocked || save.isPending || !dirty} onClick={() => { setMsg(null); save.reset(); setAskPw(true); }} data-testid="button-save-sms-settings">{save.isPending ? "Saving…" : "Save SMS Settings"}</button>
      <div className="sms-ref-testbar">
        <PhoneInput id="sms-test-to" value={to} onChange={(v: string) => { test.reset(); setTo(v); }} data-testid="input-sms-test-number" />
        <button type="button" className="button secondary" disabled={!can} onClick={() => void runTest()} data-testid="button-send-sms-test">{test.isPending ? "Checking…" : limit.wait>0?`Try again in ${limit.wait}s`:reconcile?"Check same request":sameTest&&test.data?.status==="provider_accepted"?"Test submitted":"Test SMS"}</button>
      </div>
    </div>
    {askPw && <AppDialog open onClose={() => { if (!save.isPending) { setAskPw(false); setPw(""); } }} dirty={false} busy={save.isPending} title="Confirm your password" description="Saving does not send a message.">
      <form className="cf-form" autoComplete="off" onSubmit={e => { e.preventDefault(); doSave(); }}>
        <div className="form-field"><label htmlFor="sms-pw">Current Super Admin password</label>
          <PasswordInput id="sms-pw" autoComplete="current-password" required maxLength={1024} value={pw} onChange={e => setPw(e.target.value)} /></div>
        {save.isError && <p role="alert" className="error-box" data-testid="error-sms-save-dialog">Settings were not saved. Check your password and try again.</p>}
        <div className="sms-ref-footer"><button type="submit" className="button" disabled={!pw || save.isPending} data-testid="button-confirm-sms-save">Confirm and save</button>
          <button type="button" className="button secondary" disabled={save.isPending} onClick={() => { setAskPw(false); setPw(""); }}>Cancel</button></div>
      </form></AppDialog>}
  </div>;
}
