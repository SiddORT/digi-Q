import { useForm } from "react-hook-form";
import { useGetIntegrationSettings, useSendSmtpTestEmail, getGetIntegrationSettingsQueryKey } from "@workspace/api-client-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

export function IntegrationSettings() {
  const query = useGetIntegrationSettings({ query: { queryKey: getGetIntegrationSettingsQueryKey(), staleTime: 0, refetchInterval: 60000 } });
  const send = useSendSmtpTestEmail();
  const form = useForm<{ recipient: string }>({ defaultValues: { recipient: "" } });
  return <section className="panel padded" aria-labelledby="integration-title">
    <h2 id="integration-title">Third-party integrations</h2>
    <p>Configuration is managed through server environment variables and secrets, never in this form. Readiness checks syntax and presence, not provider connectivity.</p>
    {query.isLoading && <p role="status" data-testid="status-integrations-loading">Loading readiness…</p>}
    {query.isError && <p role="alert" data-testid="status-integrations-error">Integration readiness is unavailable. Refresh to retry.</p>}
    <button type="button" data-testid="button-refresh-integrations" disabled={query.isFetching} onClick={() => query.refetch()}>Refresh readiness</button>
    {query.data && !query.isError && (["smtp", "sms"] as const).map(name => <div key={name}>
      <h3>{name === "smtp" ? "SMTP email" : "SMS environment"}</h3>
      <p data-testid={`status-integration-${name}`}>{query.data[name].ready ? "Environment ready" : "Configuration required"}</p>
      <ul>{query.data[name].keys.map(item => <li key={item.key} data-testid={`status-key-${item.key}`}><code>{item.key}</code>: {item.status}</li>)}</ul>
    </div>)}
    <p>SMS uses the existing Twilio connector; its connection must be verified separately. Development OTP is not a production SMS provider.</p>
    <h3>Send an SMTP test</h3>
    <p>This sends one fixed DigiQ Doctors message to the recipient you enter. Provider acceptance does not confirm inbox delivery. Limited to 3 attempts per user and 10 per IP every 15 minutes.</p>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => send.mutate({ data }))}>
        <FormField control={form.control} name="recipient" rules={{ required: "Enter a recipient", maxLength: { value: 254, message: "Address is too long" } }} render={({ field }) => <FormItem>
          <FormLabel>Test recipient</FormLabel>
          <FormControl><input {...field} type="email" autoComplete="off" required maxLength={254} data-testid="input-smtp-test-recipient" onChange={event => { field.onChange(event); send.reset(); }} /></FormControl>
          <FormMessage />
        </FormItem>} />
        <button type="submit" data-testid="button-send-smtp-test" disabled={!query.data?.smtp.ready || query.isError || send.isPending}>{send.isPending ? "Sending…" : "Send test email"}</button>
      </form>
    </Form>
    {send.isSuccess && <p role="status" data-testid="status-smtp-test-success">{send.data.message}</p>}
    {send.isError && <p role="alert" data-testid="status-smtp-test-error">Test email failed. Check the recipient and environment configuration, or wait 15 minutes if the attempt limit was reached.</p>}
  </section>;
}