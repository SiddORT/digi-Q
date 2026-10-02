import { EmailInput } from "@/components/EmailInput";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { IntegrationEditor } from "./IntegrationEditor";
import { useGetIntegrationSettings, useSendSmtpTestEmail, getGetIntegrationSettingsQueryKey } from "@workspace/api-client-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

export function IntegrationSettings() {
  const query = useGetIntegrationSettings({ query: { queryKey: getGetIntegrationSettingsQueryKey(), staleTime: 0, refetchInterval: 60000 } });
  const send = useSendSmtpTestEmail();
  const form = useForm<{ recipient: string }>({ defaultValues: { recipient: "" } });
  const [editing, setEditing] = useState<"smtp" | "sms" | null>(null);
  const [saved, setSaved] = useState(false);
  return <section className="panel padded" aria-labelledby="integration-title">
    <h2 id="integration-title">Third-party integrations</h2>
    <p>Use private server environment configuration or encrypted website settings. Database, signing and encryption keys stay on the server. Readiness checks syntax and presence, not provider connectivity.</p>
    {query.data && !query.data.editable && <p role="note">Website editing is locked. Your server operator must configure INTEGRATIONS_ENCRYPTION_KEY (64 hexadecimal characters from 32 random bytes). Existing server-configured integrations remain available.</p>}
    {saved && <p role="status">Configuration saved. New sends use the selected source. No test message was sent.</p>}
    {query.isLoading && <p role="status" data-testid="status-integrations-loading">Loading readiness…</p>}
    {query.isError && <p role="alert" data-testid="status-integrations-error">Integration readiness is unavailable. Refresh to retry.</p>}
    <button type="button" data-testid="button-refresh-integrations" disabled={query.isFetching} onClick={() => query.refetch()}>Refresh readiness</button>
    {query.data && !query.isError && (["smtp", "sms"] as const).map(name => <div key={name}>
      <h3>{name === "smtp" ? "SMTP email" : "Twilio SMS"}</h3>
      <p data-testid={`status-integration-${name}`}>{query.data[name].ready ? "Configuration ready" : "Configuration required"} — source: {query.data[name].source === "database" ? "encrypted website settings" : "server environment"}</p>
      <ul>{query.data[name].keys.map(item => <li key={item.key} data-testid={`status-key-${item.key}`}><code>{item.key}</code>: {item.status}</li>)}</ul>
      {editing === name ? <IntegrationEditor provider={name} settings={query.data[name]}
        onCancel={() => setEditing(null)} onDone={() => { setEditing(null); setSaved(true); send.reset(); void query.refetch(); }} />
        : <button type="button" disabled={!query.data.editable || editing !== null}
          onClick={() => { setSaved(false); setEditing(name); }}>Configure {name === "smtp" ? "SMTP" : "SMS"}</button>}
    </div>)}
    <p>SMS connects directly to Twilio using your account credentials; no Replit connector is required. Development OTP is not a production SMS provider.</p>
    <h3>Send an SMTP test</h3>
    <p>This sends one fixed DigiQ Doctors message to the recipient you enter. Provider acceptance does not confirm inbox delivery. Limited to 3 attempts per user and 10 per IP every 15 minutes.</p>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => send.mutate({ data }))}>
        <FormField control={form.control} name="recipient" rules={{ required: "Enter a recipient", maxLength: { value: 254, message: "Address is too long" } }} render={({ field }) => <FormItem>
          <FormLabel>Test recipient</FormLabel>
          <FormControl><EmailInput {...field} autoComplete="off" required data-testid="input-smtp-test-recipient" onChange={event => { field.onChange(event); send.reset(); }} /></FormControl>
          <FormMessage />
        </FormItem>} />
        <button type="submit" data-testid="button-send-smtp-test" disabled={!query.data?.smtp.ready || query.isError || send.isPending}>{send.isPending ? "Sending…" : "Send test email"}</button>
      </form>
    </Form>
    {send.isSuccess && <p role="status" data-testid="status-smtp-test-success">{send.data.message}</p>}
    {send.isError && <p role="alert" data-testid="status-smtp-test-error">Test email failed. Check the recipient and environment configuration, or wait 15 minutes if the attempt limit was reached.</p>}
  </section>;
}