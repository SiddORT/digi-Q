import "./integration-settings.css";
import { HelpTip } from "./HelpTip";
import { SearchableSelect } from "./SearchableSelect";
import { useState } from "react";
import { Link } from "wouter";
import { IntegrationEditor } from "./IntegrationEditor";
import { AppDialog } from "./AppDialog";
import { IntegrationConnectionCheck as ConnectionCheck } from "./IntegrationConnectionCheck";
import {
  useGetIntegrationSettings, getGetIntegrationSettingsQueryKey,
  useGetStorageConfiguration, getGetStorageConfigurationQueryKey,
} from "@workspace/api-client-react";

type Service = "smtp" | "sms" | "storage";
/** Only providers the server actually supports are listed. */
export const SERVICES: { value: Service; label: string; providers: { value: string; label: string }[] }[] = [
  { value: "smtp", label: "Email", providers: [{ value: "smtp", label: "SMTP" }] },
  { value: "sms", label: "SMS", providers: [{ value: "twilio", label: "Twilio" }] },
  { value: "storage", label: "Storage", providers: [{ value: "env", label: "Server Environment (Private)" }] },
];

function StoragePanel() {
  const storage = useGetStorageConfiguration({ query: { queryKey: getGetStorageConfigurationQueryKey() } });
  return <div data-testid="panel-storage">
    {storage.isLoading && <p role="status">Loading storage status…</p>}
    {storage.isError && <p role="alert">Storage status is unavailable. <button type="button" className="button secondary" onClick={() => storage.refetch()}>Retry</button></p>}
    {storage.data && <><p data-testid="status-storage">{storage.data.configured ? "Storage settings are complete. Uploads haven’t been tested." : "Storage settings are incomplete. Ask your server operator to update them."}</p><details><summary>Technical details</summary><p>Storage: {storage.data.provider}, source: {storage.data.source}{storage.data.publicPath ? `, public path ${storage.data.publicPath}` : ""}</p></details></>}
    <p role="note">Server environment only; not editable here. <HelpTip text="MEDIA_STORAGE: storage backend for uploaded media. MEDIA_ROOT: writable server directory where files are written. MEDIA_URL: public URL path files are served from."/></p>
    <ConnectionCheck provider="storage" />
  </div>;
}

export function IntegrationSettings() {
  const query = useGetIntegrationSettings({ query: { queryKey: getGetIntegrationSettingsQueryKey(), staleTime: 0, refetchInterval: 60000 } });
  const [service, setService] = useState<Service>("smtp");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const current = SERVICES.find(s => s.value === service)!;
  const data = query.data;
  return <section className="panel padded int-settings cm-provider" aria-labelledby="integration-title">
    <div className="int-head section-head">
      <div className="int-head-title"><h2 id="integration-title">Third-Party Integrations <HelpTip text="Saved website settings replace the whole server environment configuration for that service; values are never mixed. Secrets stay encrypted and are never displayed."/></h2></div>
      <div className="int-chooser">
        <div className="int-field"><SearchableSelect id="int-service" label="Service" testId="select-service" value={service}
            onChange={v => { if (!v) return; setService(v as Service); setSaved(false); setEditing(false); }}
            options={SERVICES.map(s => ({ value: s.value, label: s.label }))} /></div>
        <div className="int-field"><SearchableSelect id="int-provider" label="Provider" testId="select-provider" value={current.providers[0].value} disabled onChange={() => {}}
            aria-describedby="int-provider-help" options={current.providers.map(p => ({ value: p.value, label: p.label }))} /><small id="int-provider-help" className="sr-only">Only supported providers are listed.</small></div>
      </div>
    </div>
    {data && !data.editable && <p role="note" className="notice">Website editing is locked. Your server operator must configure INTEGRATIONS_ENCRYPTION_KEY (64 hexadecimal characters from 32 random bytes). Existing server-configured integrations remain available.</p>}

    {service === "smtp" ? <p>Email configuration, diagnostics and test email are in <Link href="/admin/communication?tab=email" className="text-link" data-testid="link-integration-email-settings">Communication → Email Settings</Link>.</p> : service === "storage" ? <StoragePanel /> : <>
      {saved && <p role="status" className="notice">Settings saved. Delivery hasn’t been tested. No message was sent.</p>}
      {query.isLoading && <p role="status" data-testid="status-integrations-loading">Checking settings…</p>}
      {query.isError && <p role="alert" className="error-box" data-testid="status-integrations-error">We couldn’t check the SMS settings. <button type="button" className="button secondary" disabled={query.isFetching} onClick={() => query.refetch()}>Check again</button></p>}
      {data && !query.isError && <div className="int-status">
        <div className="int-status-row">
          <p data-testid={`status-integration-${service}`}><span className={`badge ${data[service].ready ? "" : "muted"}`}>{data[service].ready ? "SMS settings are complete" : "SMS settings are incomplete"}</span> <span className="muted">Delivery hasn’t been tested.</span></p>
          <div className="row-actions">
            <button type="button" className="button secondary" data-testid="button-refresh-integrations" disabled={query.isFetching} onClick={() => query.refetch()}>Refresh</button>
            <button type="button" className="button small" aria-haspopup="dialog" disabled={!data.editable} onClick={() => { setSaved(false); setEditorDirty(false); setEditing(true); }} data-testid={`button-configure-${service}`}>Configure Twilio</button>
          </div>
        </div>
        <ul className="int-keys">{data[service].keys.map(item => <li key={item.key} data-testid={`status-key-${item.key}`}><code>{item.key}</code>: {item.status}</li>)}</ul>
        <ConnectionCheck key={service} provider={service} />
        {editing && <AppDialog open variant="drawer" onClose={() => setEditing(false)} dirty={editorDirty} busy={editorBusy} title="Twilio SMS credentials" description="Saving does not send a message.">
          <IntegrationEditor provider={service} settings={data[service]} onDirtyChange={setEditorDirty} onBusyChange={setEditorBusy}
            onCancel={() => setEditing(false)} onDone={() => { setEditorDirty(false); setEditing(false); setSaved(true); void query.refetch(); }} />
        </AppDialog>}
      </div>}
      {service === "sms" && <p className="listing-hint">SMS connects directly to Twilio <HelpTip text="Uses your Twilio account credentials. Development OTP is not a production SMS provider."/></p>}
    </>}
  </section>;
}
