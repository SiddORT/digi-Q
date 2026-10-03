import "./integration-settings.css";
import { EmailInput } from "@/components/EmailInput";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { IntegrationEditor } from "./IntegrationEditor";
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
  { value: "storage", label: "Storage", providers: [{ value: "env", label: "Server environment (private)" }] },
];

function ConnectionCheck({ provider }: { provider: Service }) {
  const check = useCheckIntegrationConnection();
  return <div className="int-check">
    <button type="button" className="secondary" data-testid={`button-check-${provider}`} disabled={check.isPending}
      onClick={() => check.mutate({ provider })}>{check.isPending ? "Checking…" : "Check connection"}</button>
    <small>Verifies settings and reachability only. No message or file is sent.</small>
    {check.isError && <p role="alert" data-testid={`status-check-${provider}-error`}>The check could not run. Try again shortly.</p>}
    {check.data && <ul aria-label="Connection check results" data-testid={`list-check-${provider}`}>
      {check.data.checks.map(c => <li key={c.name} data-status={c.status}>
        <strong>{c.status === "passed" ? "Passed" : c.status === "failed" ? "Failed" : "Not verified"}</strong> {c.name}: {c.message}
      </li>)}
      <li><small>Source: {check.data.source} · {new Date(check.data.checkedAt).toLocaleString()}</small></li>
    </ul>}
  </div>;
}

function StoragePanel() {
  const storage = useGetStorageConfiguration({ query: { queryKey: getGetStorageConfigurationQueryKey() } });
  return <div data-testid="panel-storage">
    {storage.isLoading && <p role="status">Loading storage status…</p>}
    {storage.isError && <p role="alert">Storage status is unavailable. <button type="button" className="secondary" onClick={() => storage.refetch()}>Retry</button></p>}
    {storage.data && <p data-testid="status-storage">{storage.data.configured ? "Configured" : "Not configured"} — provider: {storage.data.provider}, source: {storage.data.source}{storage.data.publicPath ? `, public path ${storage.data.publicPath}` : ""}</p>}
    <p role="note">Storage is configured only in the private server environment and cannot be edited here.</p>
    <dl className="int-docs">
      <dt><code>MEDIA_STORAGE</code></dt><dd>Storage backend the server uses for uploaded media.</dd>
      <dt><code>MEDIA_ROOT</code></dt><dd>Server directory where files are written. Must be writable by the app.</dd>
      <dt><code>MEDIA_URL</code></dt><dd>Public URL path files are served from.</dd>
    </dl>
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
  const current = SERVICES.find(s => s.value === service)!;
  const data = query.data;
  return <section className="panel padded int-settings" aria-labelledby="integration-title">
    <h2 id="integration-title">Third-party integrations</h2>
    <p>Saved website settings replace the whole server environment configuration for that service; values are never mixed. Secrets stay encrypted and are never displayed.</p>
    {data && !data.editable && <p role="note">Website editing is locked. Your server operator must configure INTEGRATIONS_ENCRYPTION_KEY (64 hexadecimal characters from 32 random bytes). Existing server-configured integrations remain available.</p>}
    <div className="int-chooser">
      <label htmlFor="int-service">Service</label>
      <select id="int-service" value={service} disabled={editing} data-testid="select-service"
        onChange={e => { setService(e.target.value as Service); setSaved(false); }}>
        {SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <label htmlFor="int-provider">Provider</label>
      <select id="int-provider" value={current.providers[0].value} disabled data-testid="select-provider"
        aria-describedby="int-provider-help">
        {current.providers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <small id="int-provider-help">Only supported providers are listed.</small>
    </div>

    {service === "storage" ? <StoragePanel /> : <>
      {saved && <p role="status">Configuration saved. New sends use the selected source. No test message was sent.</p>}
      {query.isLoading && <p role="status" data-testid="status-integrations-loading">Loading readiness…</p>}
      {query.isError && <p role="alert" data-testid="status-integrations-error">Integration readiness is unavailable. <button type="button" className="secondary" onClick={() => query.refetch()}>Retry</button></p>}
      {data && !query.isError && <div>
        <p data-testid={`status-integration-${service}`}>{data[service].ready ? "Configuration ready" : "Configuration required"} — source: {data[service].source === "database" ? "encrypted website settings" : "server environment"}
          {" "}<button type="button" className="secondary" data-testid="button-refresh-integrations" disabled={query.isFetching} onClick={() => query.refetch()}>Refresh</button></p>
        <ul className="int-keys">{data[service].keys.map(item => <li key={item.key} data-testid={`status-key-${item.key}`}><code>{item.key}</code>: {item.status}</li>)}</ul>
        {editing ? <IntegrationEditor provider={service} settings={data[service]}
          onCancel={() => setEditing(false)} onDone={() => { setEditing(false); setSaved(true); send.reset(); void query.refetch(); }} />
          : <button type="button" disabled={!data.editable} onClick={() => { setSaved(false); setEditing(true); }}>Configure {service === "smtp" ? "SMTP" : "Twilio"}</button>}
        <ConnectionCheck key={service} provider={service} />
      </div>}
      {service === "sms" && <p>SMS connects directly to Twilio using your account credentials. Development OTP is not a production SMS provider.</p>}
      {service === "smtp" && <>
        <h3>Send an SMTP test</h3>
        <p>Sends one fixed DigiQ Doctors message to the address you enter. Provider acceptance does not confirm inbox delivery. Limited to 3 attempts per user and 10 per IP every 15 minutes.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => { if (confirmSend) send.mutate({ data: d }, { onSettled: () => setConfirmSend(false) }); })}>
            <FormField control={form.control} name="recipient" rules={{ required: "Enter a recipient", maxLength: { value: 254, message: "Address is too long" } }} render={({ field }) => <FormItem>
              <FormLabel>Test recipient</FormLabel>
              <FormControl><EmailInput {...field} autoComplete="off" required data-testid="input-smtp-test-recipient" onChange={event => { field.onChange(event); send.reset(); setConfirmSend(false); }} /></FormControl>
              <FormMessage />
            </FormItem>} />
            <label><input type="checkbox" checked={confirmSend} onChange={e => setConfirmSend(e.target.checked)} data-testid="checkbox-confirm-smtp-test" /> Yes, send a real email to this address</label>
            <button type="submit" data-testid="button-send-smtp-test" disabled={!confirmSend || !data?.smtp.ready || query.isError || send.isPending}>{send.isPending ? "Sending…" : "Send test email"}</button>
          </form>
        </Form>
        {send.isSuccess && <p role="status" data-testid="status-smtp-test-success">{send.data.message}</p>}
        {send.isError && <p role="alert" data-testid="status-smtp-test-error">Test email failed. Check the recipient and configuration, or wait 15 minutes if the attempt limit was reached.</p>}
      </>}
    </>}
  </section>;
}
