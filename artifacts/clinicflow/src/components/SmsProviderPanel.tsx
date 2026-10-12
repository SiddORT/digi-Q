import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetIntegrationSettingsQueryKey, type IntegrationReadiness, useSendNotificationSmsTestMessage, useUpdateIntegrationSettings } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { PasswordInput } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { SecretField } from "./SecretField";
import { useConfirm } from "./ConfirmDialog";
import { canSendSmsTest } from "../lib/communication-routes";
import { DEFAULT_MAPPING, parseStatuses, serializeMapping, validateMapping, validateUrl, type SmsMapping } from "./sms-mapping";

export function SmsProviderPanel({ r, editable, onDirtyChange, onBusyChange, onSaved }: { r: IntegrationReadiness; editable: boolean; onDirtyChange: (d: boolean) => void; onBusyChange: (b: boolean) => void; onSaved: () => void }) {
  const initUrl = r.apiUrl ?? ""; const initStatus = r.statusApiUrl ?? ""; const initEnabled = r.notificationsEnabled ?? true;
  const saved = (k: string) => r.keys.find(i => i.key === k)?.status === "configured";
  const [enabled, setEnabled] = useState(initEnabled);
  const [url, setUrl] = useState(initUrl);
  const [statusUrl, setStatusUrl] = useState(initStatus);
  const [secrets, setSecrets] = useState({ key: "", client: "", sender: "", entity: "" });
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
  const confirm = useConfirm();
  const qc = useQueryClient();
  const lastInit = useRef({ initUrl, initStatus, initEnabled });
  useEffect(() => {
    const p = lastInit.current;
    if (p.initUrl !== initUrl) setUrl(c => c === p.initUrl ? initUrl : c);
    if (p.initStatus !== initStatus) setStatusUrl(c => c === p.initStatus ? initStatus : c);
    if (p.initEnabled !== initEnabled) setEnabled(c => c === p.initEnabled ? initEnabled : c);
    lastInit.current = { initUrl, initStatus, initEnabled };
  }, [initUrl, initStatus, initEnabled]);
  const dirty = enabled !== initEnabled || url !== initUrl || statusUrl !== initStatus || Object.values(secrets).some(Boolean) || mapTouched || mode !== "database";
  const dr = useRef(onDirtyChange); dr.current = onDirtyChange;
  useEffect(() => { dr.current(dirty); }, [dirty]);
  const br = useRef(onBusyChange); br.current = onBusyChange;
  const busy = save.isPending || test.isPending;
  useEffect(() => { br.current(busy); }, [busy]);
  const full: SmsMapping = { ...map, acceptedStatuses: parseStatuses(statuses) };
  const errs = mapTouched ? validateMapping(full) : [];
  const urlErr = validateUrl(url) ?? undefined; const stErr = validateUrl(statusUrl);
  const blocked = !editable || (mode === "database" ? (!!urlErr || !!stErr || errs.length > 0) : !envOk);
  const patch = (p: Partial<typeof map>) => { setMapTouched(true); setMap(m => ({ ...m, ...p })); };
  const setS = (k: keyof typeof secrets) => (v: string) => setSecrets(s => ({ ...s, [k]: v }));
  const values = () => {
    const v: Record<string, string> = {};
    if (mode !== "database") return v;
    if (url && url !== initUrl) v.NOTIFICATION_SMS_URL = url;
    if (statusUrl && statusUrl !== initStatus) v.NOTIFICATION_SMS_STATUS_URL = statusUrl;
    if (secrets.key) v.NOTIFICATION_SMS_KEY = secrets.key;
    if (secrets.client) v.NOTIFICATION_SMS_CLIENT_ID = secrets.client;
    if (secrets.sender) v.NOTIFICATION_SMS_SENDER_ID = secrets.sender;
    if (secrets.entity) v.NOTIFICATION_SMS_ENTITY_ID = secrets.entity;
    v.NOTIFICATION_SMS_ENABLED = enabled ? "true" : "false";
    if (mapTouched || !saved("NOTIFICATION_SMS_MAPPING")) v.NOTIFICATION_SMS_MAPPING = serializeMapping(full);
    return v;
  };
  const doSave = () => save.mutate({ data: { provider: "notificationSms", mode, revision: r.revision ?? null, currentPassword: pw, values: values() } }, {
    onSuccess: next => { qc.setQueryData(getGetIntegrationSettingsQueryKey(), next); setPw(""); setAskPw(false); setSecrets({ key: "", client: "", sender: "", entity: "" }); setMsg("Settings saved. No message was sent."); void qc.invalidateQueries({ queryKey: getGetIntegrationSettingsQueryKey() }); onSaved(); },
    onError: () => setPw(""),
  });
  const can = canSendSmsTest({ ready: r.ready, confirmed: true, recipient: to, message: body, pending: test.isPending });
  const runTest = async () => {
    if (!can) return;
    if (!await confirm.ask({ title: "Send a real test SMS?", description: `A real message will be sent to ${to} using saved provider settings and the template ID and body entered here. This does not enable optional notifications.`, confirmLabel: "Send test SMS", tone: "danger" })) return;
    test.mutate({ data: { recipient: to, message: body, dltTemplateId: tplId || undefined } });
  };
  const sec = (id: string, label: string, k: "key" | "client" | "sender" | "entity", key: string) =>
    <div className="form-field"><label htmlFor={id}>{label}</label><SecretField id={id} label={label} testId={id} configured={saved(key)} value={secrets[k]} onChange={setS(k)} /></div>;
  return <div className="sms-ref">
    {confirm.dialog}
    <h2 id="sms-config-title" className="sms-ref-title">SMS Provider Configuration</h2>
    {!editable && <p role="note" className="notice">Editing is locked until the server encryption key is configured.</p>}
    {msg && <p role="status" className="notice" data-testid="status-sms-saved">{msg}</p>}
    <fieldset disabled={!editable || save.isPending} className="sms-ref-fields">
      <label className="sms-ref-enable"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} data-testid="checkbox-sms-enabled" /> Enable SMS Notifications</label>
      <p className="muted field-hint">Applies to optional notifications only. Account security codes are unaffected.</p>
      <div className="form-field"><label htmlFor="sms-provider">SMS Provider</label>
        <select id="sms-provider" value="custom" onChange={() => undefined} data-testid="select-sms-provider"><option value="custom">Custom API</option></select></div>
      {mode === "database" && <>
        <div className="sms-ref-grid">
          <div className="form-field"><label htmlFor="sms-url">API Base URL</label>
            <input id="sms-url" inputMode="url" spellCheck={false} maxLength={2048} value={url} placeholder="https://" onChange={e => setUrl(e.target.value)} data-testid="input-sms-url" />
            {urlErr && <p role="alert" className="field-error" data-testid="error-sms-url">{urlErr}</p>}</div>
          <div className="form-field"><label htmlFor="sms-status-url">Status API URL</label>
            <input id="sms-status-url" inputMode="url" spellCheck={false} maxLength={2048} value={statusUrl} placeholder="Optional" onChange={e => setStatusUrl(e.target.value)} data-testid="input-sms-status-url" />
            {stErr && <p role="alert" className="field-error" data-testid="error-sms-status-url">{stErr}</p>}</div>
          {sec("sms-key", "API Key", "key", "NOTIFICATION_SMS_KEY")}
          {sec("sms-client", "Client ID", "client", "NOTIFICATION_SMS_CLIENT_ID")}
          {sec("sms-sender", "Sender ID (DLT)", "sender", "NOTIFICATION_SMS_SENDER_ID")}
          {sec("sms-entity", "Entity ID (DLT)", "entity", "NOTIFICATION_SMS_ENTITY_ID")}
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
        {test.data && <p role="status" className="notice" data-testid="status-sms-test-result">{test.data.message} Provider acceptance is not proof of delivery.</p>}
        {test.isError && <p role="alert" className="error-box" data-testid="status-sms-test-error">The test could not run. Check the saved configuration and try again.</p>}
      </div>
    <fieldset disabled={!editable || save.isPending} className="sms-ref-fields">
      <details className="cm-advanced int-advanced" data-testid="details-sms-mapping"><summary>Advanced{mapTouched ? " (edited)" : ""}</summary>
        <div className="sms-ref-grid">
          <p className="muted sms-ref-wide">Request mapping describes a plain HTTPS POST. Data only; compatibility is confirmed by a successful test. The status URL is optional and kept for future provider receipt checks; nothing polls it and it does not confirm delivery. Sender and Entity IDs are defaults used unless an event template overrides them.</p>
          <div className="form-field"><label htmlFor="sms-enc">Body encoding</label><select id="sms-enc" value={map.encoding} onChange={e => patch({ encoding: e.target.value as SmsMapping["encoding"] })} data-testid="select-sms-encoding"><option value="json">JSON</option><option value="form">Form (urlencoded)</option></select></div>
          <div className="form-field"><label htmlFor="sms-auth">Authentication</label><select id="sms-auth" value={map.authMode} onChange={e => patch({ authMode: e.target.value as SmsMapping["authMode"] })} data-testid="select-sms-auth"><option value="header">API key header</option><option value="bearer">Bearer token</option><option value="body">Named body field</option></select></div>
          {map.authMode !== "bearer" && <div className="form-field"><label htmlFor="sms-authfield">{map.authMode === "header" ? "Header name" : "Body field name"}</label><input id="sms-authfield" value={map.authField} maxLength={50} onChange={e => patch({ authField: e.target.value })} data-testid="input-sms-authfield" /></div>}
          <div className="form-field"><label htmlFor="sms-f-clientId">Field for Client ID</label><input id="sms-f-clientId" value={map.fields.clientId ?? ""} maxLength={50} onChange={e => patch({ fields: { ...map.fields, clientId: e.target.value } })} data-testid="input-sms-field-clientId" /></div>
          {(["recipient", "message", "senderId", "dltEntityId", "dltTemplateId"] as const).map(k => <div className="form-field" key={k}><label htmlFor={`sms-f-${k}`}>Field for {k}</label><input id={`sms-f-${k}`} value={map.fields[k]} maxLength={50} onChange={e => patch({ fields: { ...map.fields, [k]: e.target.value } })} data-testid={`input-sms-field-${k}`} /></div>)}
          <div className="form-field"><label htmlFor="sms-status">Accepted HTTP statuses</label><input id="sms-status" value={statuses} onChange={e => { setMapTouched(true); setStatuses(e.target.value); }} data-testid="input-sms-statuses" /></div>
          <label className="check-label sms-ref-wide"><input type="checkbox" checked={map.dltRequired} onChange={e => patch({ dltRequired: e.target.checked })} data-testid="checkbox-sms-dlt-required" /> DLT metadata required for enabled templates</label>
          {errs.length > 0 && <ul role="alert" className="error-box sms-ref-wide" data-testid="error-sms-mapping">{errs.map(x => <li key={x}>{x}</li>)}</ul>}
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
        <button type="button" className="button secondary" disabled={!can} onClick={() => void runTest()} data-testid="button-send-sms-test">{test.isPending ? "Sending…" : "Test SMS"}</button>
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
