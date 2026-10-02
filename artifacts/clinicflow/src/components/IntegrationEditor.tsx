import { useRef, useState } from "react";
import { useUpdateIntegrationSettings, type IntegrationReadiness } from "@workspace/api-client-react";

const fields = {
  smtp: [
    ["SMTP_HOST", "SMTP server", "text"], ["SMTP_PORT", "SMTP port", "text"],
    ["SMTP_USER", "SMTP username", "text"], ["SMTP_PASSWORD", "SMTP password", "password"],
    ["SMTP_FROM", "Sender address (or Name <address>)", "text"],
    ["SMTP_SECURE", "Implicit TLS: true or false (default determined by port)", "text"],
  ],
  sms: [
    ["TWILIO_ACCOUNT_SID", "Twilio account SID", "text"],
    ["TWILIO_MESSAGING_SERVICE_SID", "Twilio messaging service SID", "text"],
    ["TWILIO_AUTH_TOKEN", "Twilio auth token", "password"],
  ],
};

export function IntegrationEditor({ provider, settings, onDone, onCancel }: {
  provider: "smtp" | "sms"; settings: IntegrationReadiness; onDone: () => void; onCancel: () => void;
}) {
  const revision = useRef(settings.revision ?? null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"database" | "environment">("database");
  const [confirmed, setConfirmed] = useState(false);
  const save = useUpdateIntegrationSettings();
  return <form className="panel padded" aria-label={`Configure ${provider}`} autoComplete="off" onSubmit={event => {
    event.preventDefault();
    const changes = mode === "environment" ? {} : Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
    save.mutate({ data: { provider, mode, revision: revision.current, currentPassword: password, values: changes } }, {
      onSuccess: () => { setPassword(""); setValues({}); onDone(); },
      onError: () => setPassword(""),
    });
  }}>
    <h4>{provider === "smtp" ? "SMTP email credentials" : "Twilio SMS credentials"}</h4>
    <p>Stored values are never displayed. Leave a field blank to keep its current value. Saving applies immediately to new sends; it does not send a message.</p>
    <fieldset disabled={save.isPending}>
      <legend>Configuration source</legend>
      <label><input type="radio" name={`${provider}-source`} checked={mode === "database"} onChange={() => setMode("database")} /> Encrypted website settings</label>
      <label><input type="radio" name={`${provider}-source`} checked={mode === "environment"} onChange={() => setMode("environment")} /> Use server environment instead</label>
      {mode === "database" ? fields[provider].map(([key, label, type]) => <div key={key} className="form-field">
        <label htmlFor={`integration-${key}`}>{label}</label>
        <input id={`integration-${key}`} name={key} type={type} autoComplete="off" spellCheck={false} maxLength={2048}
          value={values[key] ?? ""} placeholder={settings.keys.find(item => item.key === key)?.status === "configured" ? "Configured — leave blank to keep" : "Enter a value"}
          onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} />
      </div>) : <>
        <p role="note">This removes the saved website configuration. Email or SMS will stop working if the server environment is incomplete. It does not change the server’s .env file.</p>
        <label><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I understand and want to use server configuration.</label>
      </>}
      <div className="form-field">
        <label htmlFor={`confirm-${provider}`}>Confirm your current Super Admin password</label>
        <input id={`confirm-${provider}`} type="password" autoComplete="current-password" required maxLength={1024}
          value={password} onChange={event => setPassword(event.target.value)} />
      </div>
      <button type="submit" disabled={save.isPending || (mode === "environment" && !confirmed)}>{save.isPending ? "Saving…" : "Save configuration"}</button>
      <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
    </fieldset>
    {save.isError && <p role="alert">Configuration was not saved. Check your password, required fields and server encryption key. If another administrator changed settings, cancel, refresh and try again.</p>}
  </form>;
}