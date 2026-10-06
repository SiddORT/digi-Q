import { FormActions } from "./FormActions";
import "./integration-settings.css";
import { HelpTip } from "./HelpTip";
import { SearchableSelect } from "./SearchableSelect";
import { EmailInput } from "@/components/EmailInput";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { IntegrationEditor } from "./IntegrationEditor";
import { AppDialog } from "./AppDialog";
import {
  useGetIntegrationSettings, useSendSmtpTestEmail, getGetIntegrationSettingsQueryKey,
  useCheckIntegrationConnection, useGetStorageConfiguration, getGetStorageConfigurationQueryKey,
} from "@workspace/api-client-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

type Service = "smtp" | "sms" | "storage";
/** Only providers the server actually supports are listed. */
export const SERVICES: { value: Service; label: string; providers: { value: string; label: string }[] }[] = [
  { value: "smtp", label: "Email", providers: [{ value: "smtp", label: "SMTP" }] },
  { value: "sms", label: "SMS", providers: [{ value: "twilio", label: "Twilio" }] },
  { value: "storage", label: "Storage", providers: [{ value: "env", label: "Server Environment (Private)" }] },
];

function ConnectionCheck({ provider }: { provider: Service }) {
  const check = useCheckIntegrationConnection();
  const [resultsOpen, setResultsOpen] = useState(false);
  return <div className="int-check">
    <button type="button" className="button secondary" data-testid={`button-check-${provider}`} disabled={check.isPending}
      onClick={() => check.mutate({ provider }, { onSuccess: () => setResultsOpen(true) })}>{check.isPending ? "Checking…" : "Check connection"}</button>
    <HelpTip text="Verifies settings and reachability only. No message or file is sent."/>
    {check.isError && <p role="alert" data-testid={`status-check-${provider}-error`}>The check could not run. Try again shortly.</p>}
    {check.data && resultsOpen && <AppDialog open variant="drawer" onClose={() => setResultsOpen(false)} title="Connection Check Results"><ul aria-label="Connection check results" data-testid={`list-check-${provider}`}>
      {check.data.checks.map(c => <li key={c.name} data-status={c.status}>
        <strong>{c.status === "passed" ? "Passed" : c.status === "failed" ? "Failed" : "Not verified"}</strong> {c.name}: {c.message}
      </li>)}
      <li><small>Source: {check.data.source} · {new Date(check.data.checkedAt).toLocaleString()}</small></li>
    </ul></AppDialog>}
    {check.data && !resultsOpen && <button type="button" className="button secondary small" aria-haspopup="dialog" onClick={() => setResultsOpen(true)} data-testid={`button-check-results-${provider}`}>{check.data.checks.some(c => c.status === "failed") ? "Failed" : "Results"} · view diagnostics</button>}
  </div>;
}

function StoragePanel() {
  const storage = useGetStorageConfiguration({ query: { queryKey: getGetStorageConfigurationQueryKey() } });
  return <div data-testid="panel-storage">
    {storage.isLoading && <p role="status">Loading storage status…</p>}
    {storage.isError && <p role="alert">Storage status is unavailable. <button type="button" className="button secondary" onClick={() => storage.refetch()}>Retry</button></p>}
    {storage.data && <p data-testid="status-storage">{storage.data.configured ? "Configured" : "Not configured"} — provider: {storage.data.provider}, source: {storage.data.source}{storage.data.publicPath ? `, public path ${storage.data.publicPath}` : ""}</p>}
    <p role="note">Server environment only; not editable here. <HelpTip text="MEDIA_STORAGE: storage backend for uploaded media. MEDIA_ROOT: writable server directory where files are written. MEDIA_URL: public URL path files are served from."/></p>
    <ConnectionCheck provider="storage" />
  </div>;
}

export function IntegrationSettings() {
  const query = useGetIntegrationSettings({ query: { queryKey: getGetIntegrationSettingsQueryKey(), staleTime: 0, refetchInterval: 60000 } });
  const send = useSendSmtpTestEmail();
  const form = useForm<{ recipient: string }>({ defaultValues: { recipient: "" } });
  const [service, setService] = useState<Service>("smtp");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const current = SERVICES.find(s => s.value === service)!;
  const data = query.data;
  const label = service === "smtp" ? "SMTP" : "Twilio";
  const closeTest = () => { setTestOpen(false); setConfirmSend(false); form.reset(); send.reset(); };
  return <section className="panel padded int-settings" aria-labelledby="integration-title">
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

    {service === "storage" ? <StoragePanel /> : <>
      {saved && <p role="status" className="notice">Configuration saved. New sends use the selected source. No test message was sent.</p>}
      {query.isLoading && <p role="status" data-testid="status-integrations-loading">Loading readiness…</p>}
      {query.isError && <p role="alert" className="error-box" data-testid="status-integrations-error">Integration readiness is unavailable. <button type="button" className="button secondary" onClick={() => query.refetch()}>Retry</button></p>}
      {data && !query.isError && <div className="int-status">
        <div className="int-status-row">
          <p data-testid={`status-integration-${service}`}><span className={`badge ${data[service].ready ? "" : "muted"}`}>{data[service].ready ? "Configuration ready" : "Configuration required"}</span> <span className="muted">Source: {data[service].source === "database" ? "encrypted website settings" : "server environment"}</span></p>
          <div className="row-actions">
            <button type="button" className="button secondary" data-testid="button-refresh-integrations" disabled={query.isFetching} onClick={() => query.refetch()}>Refresh</button>
            <button type="button" className="button small" aria-haspopup="dialog" disabled={!data.editable} onClick={() => { setSaved(false); setEditorDirty(false); setEditing(true); }} data-testid={`button-configure-${service}`}>Configure {label}</button>
            {service === "smtp" && <button type="button" className="button secondary small" aria-haspopup="dialog" onClick={() => setTestOpen(true)} data-testid="button-open-smtp-test">Send Test Email</button>}
          </div>
        </div>
        <ul className="int-keys">{data[service].keys.map(item => <li key={item.key} data-testid={`status-key-${item.key}`}><code>{item.key}</code>: {item.status}</li>)}</ul>
        <ConnectionCheck key={service} provider={service} />
        {editing && <AppDialog open variant="drawer" onClose={() => setEditing(false)} dirty={editorDirty} busy={editorBusy} title={service === "smtp" ? "SMTP email credentials" : "Twilio SMS credentials"} description="Saving does not send a message.">
          <IntegrationEditor provider={service} settings={data[service]} onDirtyChange={setEditorDirty} onBusyChange={setEditorBusy}
            onCancel={() => setEditing(false)} onDone={() => { setEditorDirty(false); setEditing(false); setSaved(true); send.reset(); void query.refetch(); }} />
        </AppDialog>}
      </div>}
      {service === "sms" && <p className="listing-hint">SMS connects directly to Twilio <HelpTip text="Uses your Twilio account credentials. Development OTP is not a production SMS provider."/></p>}
      {service === "smtp" && testOpen && <AppDialog open onClose={closeTest} busy={send.isPending} dirty={!!form.watch("recipient") && !send.isSuccess} title="Send an SMTP Test" description="Sends one fixed DigiQ Doctors message to the address you enter. Provider acceptance does not confirm inbox delivery. Limited to 3 attempts per user and 10 per IP every 15 minutes.">
        <Form {...form}>
          <form className="int-test-form" onSubmit={form.handleSubmit(d => { if (confirmSend) send.mutate({ data: d }, { onSettled: () => setConfirmSend(false) }); })}>
            <FormField control={form.control} name="recipient" rules={{ required: "Enter a recipient", maxLength: { value: 254, message: "Address is too long" } }} render={({ field }) => <FormItem>
              <FormLabel>Test recipient</FormLabel>
              <FormControl><EmailInput {...field} autoComplete="off" required data-testid="input-smtp-test-recipient" onChange={event => { field.onChange(event); send.reset(); setConfirmSend(false); }} /></FormControl>
              <FormMessage />
            </FormItem>} />
            <label className="check-label"><input type="checkbox" checked={confirmSend} onChange={e => setConfirmSend(e.target.checked)} data-testid="checkbox-confirm-smtp-test" /> Yes, send a real email to this address</label>
            {send.isSuccess && <p role="status" className="notice" data-testid="status-smtp-test-success">{send.data.message}</p>}
            {send.isError && <p role="alert" className="error-box" data-testid="status-smtp-test-error">Test email failed. Check the recipient and configuration, or wait 15 minutes if the attempt limit was reached.</p>}
            <FormActions wide={false} onCancel={closeTest} cancelLabel="Close" busy={send.isPending} busyLabel="Sending…" disabled={!confirmSend || !data?.smtp.ready || query.isError} submitLabel="Send test email" submitTestId="button-send-smtp-test" />
          </form>
        </Form>
      </AppDialog>}
    </>}
  </section>;
}
