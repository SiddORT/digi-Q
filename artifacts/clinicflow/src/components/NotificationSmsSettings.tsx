import { PageDescription } from "./PageDescription";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useGetIntegrationSettings, getGetIntegrationSettingsQueryKey, useUpdateIntegrationSettings } from "@workspace/api-client-react";
import { HelpTip } from "./HelpTip";
import { AppDialog, useAppDialogClose } from "./AppDialog";
import { SmsProviderPanel } from "./SmsProviderPanel";
import { FormActions } from "./FormActions";
import { FormSection } from "./FormSection";
import { PasswordInput } from "./PasswordInput";
import { SecretField } from "./SecretField";
import "./integration-settings.css";
import { DEFAULT_MAPPING, parseStatuses, smsConfigurationValues, validateMapping, validateUrl, type SmsMapping } from "./sms-mapping";

function Editor({ revision, keys, onDone, onCancel, onDirtyChange, onBusyChange }: { revision: string | null; keys: { key: string; status: string }[]; onDone: () => void; onCancel: () => void; onDirtyChange: (d: boolean) => void; onBusyChange: (b: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [map, setMap] = useState<SmsMapping>(DEFAULT_MAPPING);
  const [mapTouched, setMapTouched] = useState(false);
  const [statuses, setStatuses] = useState("200, 202");
  const [staticText, setStaticText] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"database" | "environment">("database");
  const [confirmed, setConfirmed] = useState(false);
  const save = useUpdateIntegrationSettings();
  const close = useAppDialogClose();
  const dirty = !!url || !!apiKey || mapTouched || !!password || mode !== "database";
  const ref = useRef(onDirtyChange); ref.current = onDirtyChange;
  useEffect(() => { ref.current(dirty); }, [dirty]);
  const busyRef = useRef(onBusyChange); busyRef.current = onBusyChange;
  useEffect(() => { busyRef.current(save.isPending); }, [save.isPending]);
  const patch = (p: Partial<SmsMapping>) => { setMapTouched(true); setMap(m => ({ ...m, ...p })); };
  const staticFields = Object.fromEntries(staticText.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf("="); return i < 0 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const full: SmsMapping = { ...map, acceptedStatuses: parseStatuses(statuses), staticFields };
  const mapErrors = mapTouched ? validateMapping(full) : [];
  const urlError = validateUrl(url);
  const saved = (k: string) => keys.find(i => i.key === k)?.status === "configured";
  const blocked = mode === "database" && (!!urlError || mapErrors.length > 0);
  const set = (k: keyof SmsMapping["fields"], v: string) => patch({ fields: { ...map.fields, [k]: v } });
  return <form className="int-editor" aria-label="Configure notification SMS" autoComplete="off" onSubmit={e => {
    e.preventDefault();
    const values = mode==="database"
      ?smsConfigurationValues(url,apiKey,full,mapTouched,saved("NOTIFICATION_SMS_MAPPING")):{};
    save.mutate({ data: { provider: "notificationSms", mode, revision, currentPassword: password, values } }, { onSuccess: () => { setPassword(""); setApiKey(""); onDone(); }, onError: () => setPassword("") });
  }}>
    <p className="muted field-hint">Leave a field blank to keep its saved value. Saved values are never shown. Saving does not send a message.</p>
    <fieldset disabled={save.isPending} className="int-editor-sections">
      <FormSection title="Configuration source" grid={false}><div className="choice-row" role="radiogroup" aria-label="Configuration source">
        <label className="check-label"><input type="radio" checked={mode === "database"} onChange={() => setMode("database")} data-testid="radio-sms-source-database" /> Encrypted website settings</label>
        <label className="check-label"><input type="radio" checked={mode === "environment"} onChange={() => setMode("environment")} /> Use server environment instead (optional)</label>
      </div></FormSection>
      {mode === "database" ? <>
        <FormSection title="Provider endpoint" grid={false}><div className="cf-form">
          <div className="form-field"><label htmlFor="sms-url">API URL</label>
            <input id="sms-url" type="text" inputMode="url" spellCheck={false} maxLength={2048} value={url} placeholder={saved("NOTIFICATION_SMS_URL") ? "Configured — leave blank to keep" : "https://api.provider.example/send"} onChange={e => setUrl(e.target.value)} data-testid="input-sms-url" />
            <small>HTTPS, port 443, public destination, no query string or credentials.</small>{urlError && <p role="alert" className="field-error" data-testid="error-sms-url">{urlError}</p>}</div>
          <div className="form-field"><label htmlFor="sms-key">API key</label>
            <SecretField id="sms-key" label="API key" testId="sms-key" configured={saved("NOTIFICATION_SMS_KEY")} value={apiKey} onChange={setApiKey} /></div>
        </div></FormSection>
        <FormSection title="Request mapping" grid={false}><details className="int-advanced" data-testid="details-sms-mapping"><summary>Advanced API mapping{mapTouched ? " (edited)" : ""}</summary><div className="cf-form">
          <PageDescription className="muted" text="Map a plain HTTPS POST request for your provider." help="This is data only: no scripts, other protocols, multi-step or OAuth flows. Compatibility is confirmed only by a successful test." label="About request mapping"/>
          <div className="form-field"><label htmlFor="sms-enc">Body encoding</label><select id="sms-enc" value={map.encoding} onChange={e => patch({ encoding: e.target.value as SmsMapping["encoding"] })} data-testid="select-sms-encoding"><option value="json">JSON</option><option value="form">Form (urlencoded)</option></select></div>
          <div className="form-field"><label htmlFor="sms-auth">Authentication</label><select id="sms-auth" value={map.authMode} onChange={e => patch({ authMode: e.target.value as SmsMapping["authMode"] })} data-testid="select-sms-auth"><option value="header">API key header</option><option value="bearer">Bearer token</option><option value="body">Named body field</option></select></div>
          {map.authMode !== "bearer" && <div className="form-field"><label htmlFor="sms-authfield">{map.authMode === "header" ? "Header name" : "Body field name"}</label><input id="sms-authfield" value={map.authField} maxLength={50} onChange={e => patch({ authField: e.target.value })} data-testid="input-sms-authfield" /></div>}
          {(["recipient", "message", "senderId", "dltEntityId", "dltTemplateId"] as const).map(k => <div className="form-field" key={k}><label htmlFor={`sms-f-${k}`}>Field for {k === "senderId" ? "Sender ID" : k === "dltEntityId" ? "DLT Entity ID" : k === "dltTemplateId" ? "DLT Template ID" : k}</label><input id={`sms-f-${k}`} value={map.fields[k]} maxLength={50} onChange={e => set(k, e.target.value)} data-testid={`input-sms-field-${k}`} /></div>)}
          <div className="form-field"><label htmlFor="sms-static">Static fields (one name=value per line, non-secret)</label><textarea id="sms-static" rows={3} value={staticText} onChange={e => { setMapTouched(true); setStaticText(e.target.value); }} data-testid="input-sms-static" /></div>
          <div className="form-field"><label htmlFor="sms-status">Accepted HTTP statuses</label><input id="sms-status" value={statuses} onChange={e => { setMapTouched(true); setStatuses(e.target.value); }} data-testid="input-sms-statuses" /></div>
          <div className="form-field"><label htmlFor="sms-rf">Response field (optional dot path)</label><input id="sms-rf" value={map.responseField ?? ""} onChange={e => patch({ responseField: e.target.value })} data-testid="input-sms-response-field" /></div>
          {!!map.responseField && <div className="form-field"><label htmlFor="sms-rv">Expected response value (optional)</label><input id="sms-rv" value={map.responseValue ?? ""} onChange={e => patch({ responseValue: e.target.value })} /></div>}
          <label className="check-label"><input type="checkbox" checked={map.dltRequired} onChange={e => patch({ dltRequired: e.target.checked })} data-testid="checkbox-sms-dlt-required" /> DLT metadata is required: enabled templates must have Entity and Template IDs to publish</label>
          {mapErrors.length > 0 && <ul role="alert" className="error-box" data-testid="error-sms-mapping">{mapErrors.map(x => <li key={x}>{x}</li>)}</ul>}
          {!mapTouched && saved("NOTIFICATION_SMS_MAPPING") && <p className="muted">A mapping is saved. Edit any field above to replace it as a whole; otherwise it is kept.</p>}
        </div></details></FormSection>
      </> : <FormSection title="Server configuration" grid={false}>
        <p role="note">This removes the saved website configuration. SMS stops working if the server environment is incomplete.</p>
        <label className="check-label"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I understand and want to use server configuration.</label></FormSection>}
      <FormSection title="Confirm identity" grid={false}><div className="form-field form-field-narrow"><label htmlFor="sms-pw">Confirm your current Super Admin password</label>
        <PasswordInput id="sms-pw" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} /></div></FormSection>
      <FormActions wide={false} onCancel={() => (close ? close() : onCancel())} busy={save.isPending} disabled={blocked || (mode === "environment" && !confirmed)} submitLabel="Save configuration" />
    </fieldset>
    {save.isError && <p role="alert" data-testid="error-sms-save">Configuration was not saved. Check your password and fields. If another administrator changed settings, cancel, refresh and try again.</p>}
  </form>;
}

export function NotificationSmsSettings({ onDirtyChange, onBusyChange, inline = false }: { inline?: boolean; onDirtyChange?: (d: boolean) => void; onBusyChange?: (b: boolean) => void }) {
  const query = useGetIntegrationSettings({ query: { queryKey: getGetIntegrationSettingsQueryKey(), staleTime: 30000 } });
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(onDirtyChange); ref.current = onDirtyChange;
  useEffect(() => { ref.current?.(dirty); }, [dirty]);
  useEffect(() => () => ref.current?.(false), []);
  const parentBusy = useRef(onBusyChange); parentBusy.current = onBusyChange;
  useEffect(() => { parentBusy.current?.(busy); }, [busy]);
  const d = query.data; const r = d?.notificationSms;
  if (inline) return <section className="panel padded int-settings cm-provider" aria-labelledby="sms-config-title" data-testid="panel-sms-config">
    {query.isLoading && <p role="status" data-testid="status-sms-loading">Checking settings…</p>}
    {query.isError && <p role="alert" className="error-box">We couldn’t check the SMS settings. <button type="button" className="button secondary" disabled={query.isFetching} onClick={() => query.refetch()}>Check again</button></p>}
    {d && !r && <p role="note" className="notice" data-testid="status-sms-unavailable">SMS settings are unavailable.</p>}
    {d && r && <SmsProviderPanel key={r.revision ?? "rev"} r={r} editable={!!d.editable} onDirtyChange={setDirty} onBusyChange={setBusy} onSaved={() => { void query.refetch(); }} />}
  </section>;
  return <section className="panel padded int-settings cm-provider" aria-labelledby="sms-config-title" data-testid="panel-sms-config">
    <div className="int-head section-head"><h2 id="sms-config-title">SMS Provider <HelpTip text="Configurable HTTPS POST API. The key is encrypted and never displayed. Account security messages use Twilio separately and are unaffected." /></h2></div>
    {saved && <p role="status" className="notice">Settings saved. Delivery hasn’t been tested. No message was sent.</p>}
    {query.isLoading && <p role="status" data-testid="status-sms-loading">Checking settings…</p>}
    {query.isError && <p role="alert" className="error-box">We couldn’t check the SMS settings. <button type="button" className="button secondary" disabled={query.isFetching} onClick={() => query.refetch()}>Check again</button></p>}
    {d && !r && <p role="note" className="notice" data-testid="status-sms-unavailable">SMS settings are unavailable.</p>}
    {d && r && <div className="int-status"><div className="int-status-row">
      <p data-testid="status-integration-notificationSms"><span className={`badge ${r.ready ? "" : "muted"}`}>{r.ready ? "Settings complete" : "SMS settings are incomplete"}</span> <span className="muted">{r.ready ? "Delivery hasn’t been tested." : "Add the API URL and key using Configure SMS."}</span></p>
      {!inline && <div className="row-actions"><button type="button" className="button small" disabled={!d.editable} onClick={() => { setSaved(false); setDirty(false); setEditing(true); }} data-testid="button-configure-notificationSms">Configure SMS</button></div>}</div>
      <details className="cm-advanced" data-testid="details-sms-technical"><summary>Technical details</summary><ul className="int-keys">{r.keys.map(k => <li key={k.key} data-testid={`status-key-${k.key}`}><code>{k.key}</code>: {k.status}</li>)}</ul></details>
      {!d.editable && <p role="note" className="notice">Website editing is locked until the server encryption key is configured.</p>}
      {inline && d.editable && <Editor key={`${formKey}:${r.revision ?? ""}`} revision={r.revision ?? null} keys={r.keys} onDirtyChange={setDirty} onBusyChange={setBusy} onCancel={() => { setDirty(false); setFormKey(k => k + 1); }} onDone={() => { setDirty(false); setSaved(true); setBusy(false); setFormKey(k => k + 1); void query.refetch(); void qc.invalidateQueries({ queryKey: getGetIntegrationSettingsQueryKey() }); }} />}
      {!inline && editing && <AppDialog open variant="drawer" onClose={() => setEditing(false)} dirty={dirty} busy={busy} title="SMS provider configuration" description="Saving does not send a message.">
        <SmsProviderPanel key={r.revision ?? "rev"} r={r} editable={!!d.editable} onDirtyChange={setDirty} onBusyChange={setBusy} onSaved={() => { setEditing(false); setSaved(true); void query.refetch(); }} /></AppDialog>}
    </div>}
  </section>;
}
export default NotificationSmsSettings;
