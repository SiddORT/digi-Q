import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail, Save, Send } from "lucide-react";
import { getGetIntegrationSettingsQueryKey, useGetIntegrationSettings, useSendSmtpTestEmail, useUpdateIntegrationSettings, type IntegrationReadiness } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { PasswordInput } from "./PasswordInput";
import { useConfirm } from "./ConfirmDialog";

const pub = (r: IntegrationReadiness) => ({ smtpHost: r.smtpHost ?? "", smtpPort: r.smtpPort ?? 587, fromEmail: r.fromEmail ?? "", fromName: r.fromName ?? "", useTls: r.useTls ?? true, useSsl: r.useSsl ?? false, notificationsEnabled: r.notificationsEnabled ?? true });

/** Write-only credential: grey filled "is configured" row with Replace outside, as in the reference. Never holds or shows the saved value. */
function EmailCredential({ id, label, noun, configured, secret, value, onChange, testId }: { id: string; label: string; noun: string; configured: boolean; secret: boolean; value: string; onChange: (v: string) => void; testId: string }) {
  const [replacing, setReplacing] = useState(!configured);
  const input = secret
    ? <PasswordInput id={id} visibilityLabel={label} autoComplete="new-password" spellCheck={false} maxLength={2048} value={value} placeholder="Enter a new value" onChange={e => onChange(e.target.value)} data-testid={`input-${testId}`} />
    : <input id={id} type="text" autoComplete="off" spellCheck={false} maxLength={2048} value={value} placeholder="Enter a new value" onChange={e => onChange(e.target.value)} data-testid={`input-${testId}`} />;
  if (configured && !replacing) return <div className="em-cred" data-testid={`${testId}-configured`}>
    <div className="em-cred-field"><CheckCircle2 size={16} aria-hidden /><input id={id} type="text" disabled readOnly value={`${noun} is configured`} aria-label={`${label}: ${noun} is configured`} /></div>
    <button type="button" className="button secondary" aria-label={`Replace ${label}`} onClick={() => setReplacing(true)} data-testid={`button-replace-${testId}`}>Replace</button>
  </div>;
  return <div className="em-cred"><div className="em-cred-field em-cred-edit">{input}</div>
    {configured && <button type="button" className="button secondary" onClick={() => { onChange(""); setReplacing(false); }} data-testid={`button-keep-${testId}`}>Keep saved</button>}</div>;
}

export function EmailProviderPanel({ onDirtyChange, onBusyChange }: { onDirtyChange?: (d: boolean) => void; onBusyChange?: (b: boolean) => void }) {
  const query = useGetIntegrationSettings({ query: { queryKey: getGetIntegrationSettingsQueryKey(), staleTime: 0, refetchInterval: 60000 } });
  const dr = useRef(onDirtyChange); dr.current = onDirtyChange;
  const br = useRef(onBusyChange); br.current = onBusyChange;
  useEffect(() => () => { dr.current?.(false); br.current?.(false); }, []);
  const data = query.data;
  return <section className="panel padded cm-provider em-ref" aria-labelledby="em-title" data-testid="panel-email-provider">
    <h2 id="em-title" className="sms-ref-title em-title"><Mail size={18} aria-hidden /> SMTP / Email Configuration</h2>
    {query.isLoading && <p role="status" data-testid="status-integrations-loading">Loading email settings…</p>}
    {query.isError && <p role="alert" className="error-box" data-testid="status-integrations-error">Email settings are unavailable. <button type="button" className="button secondary" onClick={() => query.refetch()}>Retry</button></p>}
    {data && <EmailForm r={data.smtp} editable={data.editable !== false} onDirty={d => dr.current?.(d)} onBusy={b => br.current?.(b)} />}
  </section>;
}

function EmailForm({ r, editable, onDirty, onBusy }: { r: IntegrationReadiness; editable: boolean; onDirty: (d: boolean) => void; onBusy: (b: boolean) => void }) {
  const base = pub(r);
  const ready = r.ready;
  const saved = (k: string) => r.keys.find(i => i.key === k)?.status === "configured";
  const [f, setF] = useState({ enabled: base.notificationsEnabled, host: base.smtpHost, port: String(base.smtpPort), from: base.fromEmail, name: base.fromName, tls: base.useTls, ssl: base.useSsl });
  const [user, setUser] = useState(""); const [pass, setPass] = useState("");
  const [askPw, setAskPw] = useState(false); const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"database" | "environment">("database"); const [envOk, setEnvOk] = useState(false);
  const [to, setTo] = useState("");
  const save = useUpdateIntegrationSettings(); const test = useSendSmtpTestEmail();
  const confirm = useConfirm(); const qc = useQueryClient();
  const baseKey = JSON.stringify(base);
  const last = useRef(base);
  useEffect(() => {
    const p = last.current;
    setF(c => ({ enabled: c.enabled === p.notificationsEnabled ? base.notificationsEnabled : c.enabled, host: c.host === p.smtpHost ? base.smtpHost : c.host, port: c.port === String(p.smtpPort) ? String(base.smtpPort) : c.port, from: c.from === p.fromEmail ? base.fromEmail : c.from, name: c.name === p.fromName ? base.fromName : c.name, tls: c.tls === p.useTls ? base.useTls : c.tls, ssl: c.ssl === p.useSsl ? base.useSsl : c.ssl }));
    last.current = base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);
  const set = (p: Partial<typeof f>) => setF(c => ({ ...c, ...p }));
  const dirty = f.enabled !== base.notificationsEnabled || f.host !== base.smtpHost || f.port !== String(base.smtpPort) || f.from !== base.fromEmail || f.name !== base.fromName || f.tls !== base.useTls || f.ssl !== base.useSsl || !!user || !!pass || mode !== "database";
  const dr = useRef(onDirty); dr.current = onDirty; useEffect(() => { dr.current(dirty); }, [dirty]);
  const busy = save.isPending || test.isPending;
  const br = useRef(onBusy); br.current = onBusy; useEffect(() => { br.current(busy); }, [busy]);
  const portN = Number(f.port);
  const err = !f.tls && !f.ssl ? "Select TLS (STARTTLS) or SSL. Plain SMTP is not allowed."
    : !f.host.trim() ? "SMTP host is required." : !Number.isInteger(portN) || portN < 1 || portN > 65535 ? "Port must be 1 to 65535."
    : !f.from.trim() ? "From email is required." : null;
  const blocked = !editable || !dirty || (mode === "database" ? !!err : !envOk);
  const values = () => {
    const v: Record<string, string> = {};
    if (mode !== "database") return v;
    if (f.host !== base.smtpHost) v.SMTP_HOST = f.host.trim();
    if (f.port !== String(base.smtpPort) || !saved("SMTP_PORT")) v.SMTP_PORT = String(portN);
    if (f.from !== base.fromEmail) v.SMTP_FROM = f.from.trim();
    if (f.name !== base.fromName || f.from !== base.fromEmail) v.SMTP_FROM_NAME = f.name.trim();
    if (user) v.SMTP_USER = user;
    if (pass) v.SMTP_PASSWORD = pass;
    v.SMTP_SECURE = f.ssl ? "true" : "false";
    v.SMTP_REQUIRE_TLS = f.tls ? "true" : "false";
    v.SMTP_NOTIFICATIONS_ENABLED = f.enabled ? "true" : "false";
    return v;
  };
  const doSave = () => save.mutate({ data: { provider: "smtp", mode, revision: r.revision ?? null, currentPassword: pw, values: values() } }, {
    onSuccess: next => {
      qc.setQueryData(getGetIntegrationSettingsQueryKey(), next);
      const nb = pub(next.smtp);
      last.current = nb;
      setF({ enabled: nb.notificationsEnabled, host: nb.smtpHost, port: String(nb.smtpPort), from: nb.fromEmail, name: nb.fromName, tls: nb.useTls, ssl: nb.useSsl });
      setUser(""); setPass(""); setPw(""); setMode("database"); setEnvOk(false); setAskPw(false); setMsg("Email settings saved. No message was sent.");
      void qc.invalidateQueries({ queryKey: getGetIntegrationSettingsQueryKey() });
    },
    onError: () => setPw(""),
  });
  const canTest = ready && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) && !busy;
  const testing = useRef(false);
  const runTest = async () => {
    if (!canTest) return;
    if (testing.current) return;
    testing.current = true;
    try {
    if (!await confirm.ask({ title: "Send a real test email?", description: `One fixed DigiQ test message will be sent to ${to} using saved SMTP settings.`, confirmLabel: "Send test email", tone: "danger" })) return;
    await test.mutateAsync({ data: { recipient: to.trim(), confirmed: true, requestId: crypto.randomUUID() } }).catch(() => {});
    } finally { testing.current = false; }
  };
  return <div className="sms-ref">
    {confirm.dialog}
    {!editable && <p role="note" className="notice">Editing is locked until the server encryption key is configured. Test email remains available when configuration is ready.</p>}
    {msg && <p role="status" className="notice" data-testid="status-smtp-saved">{msg}</p>}
    <fieldset disabled={!editable || busy} className="sms-ref-fields">
      <label className="sms-ref-enable"><input type="checkbox" checked={f.enabled} onChange={e => set({ enabled: e.target.checked })} data-testid="checkbox-email-enabled" /> Enable Email Notifications</label>
      <p className="muted field-hint em-note">Optional notifications only. Sign-in codes, invitations and recovery are unaffected.</p>
      <div className="sms-ref-grid">
        <div className="form-field"><label htmlFor="em-host">SMTP Host</label><input id="em-host" value={f.host} maxLength={255} spellCheck={false} onChange={e => set({ host: e.target.value })} data-testid="input-smtp-host" /></div>
        <div className="form-field"><label htmlFor="em-port">SMTP Port</label><input id="em-port" type="number" inputMode="numeric" min={1} max={65535} value={f.port} onChange={e => set({ port: e.target.value })} data-testid="input-smtp-port" /></div>
        <div className="form-field"><label htmlFor="em-from">From Email</label><input id="em-from" type="email" maxLength={254} value={f.from} onChange={e => set({ from: e.target.value })} data-testid="input-smtp-from" /></div>
        <div className="form-field"><label htmlFor="em-name">From Name</label><input id="em-name" maxLength={100} value={f.name} onChange={e => set({ name: e.target.value })} data-testid="input-smtp-from-name" /></div>
      </div>
      <div className="em-checks">
        <label className="check-label"><input type="checkbox" checked={f.tls} onChange={e => set(e.target.checked ? { tls: true, ssl: false } : { tls: false })} data-testid="checkbox-smtp-tls" /> Use TLS (STARTTLS)</label>
        <label className="check-label"><input type="checkbox" checked={f.ssl} onChange={e => set(e.target.checked ? { ssl: true, tls: false } : { ssl: false })} data-testid="checkbox-smtp-ssl" /> Use SSL</label>
      </div>
      {mode === "database" && err && <p role="alert" className="field-error" data-testid="error-smtp-form">{err}</p>}
      <div className="sms-ref-grid">
        <div className="form-field"><label htmlFor="em-user">SMTP Username</label><EmailCredential key={`user:${r.revision}`} id="em-user" label="SMTP Username" noun="Username" testId="smtp-user" configured={saved("SMTP_USER")} secret={false} value={user} onChange={setUser} /></div>
        <div className="form-field"><label htmlFor="em-pass">SMTP Password</label><EmailCredential key={`pass:${r.revision}`} id="em-pass" label="SMTP Password" noun="Password" testId="smtp-password" configured={saved("SMTP_PASSWORD")} secret value={pass} onChange={setPass} /></div>
      </div>
      <details className="cm-advanced" data-testid="details-smtp-source"><summary>Advanced{mode !== "database" ? " (edited)" : ""}</summary>
        <div className="choice-row" role="radiogroup" aria-label="Configuration source">
          <label className="check-label"><input type="radio" checked={mode === "database"} onChange={() => setMode("database")} data-testid="radio-smtp-source-database" /> Encrypted website settings</label>
          <label className="check-label"><input type="radio" checked={mode === "environment"} onChange={() => setMode("environment")} data-testid="radio-smtp-source-environment" /> Use server environment instead</label>
        </div>
        {mode === "environment" && <label className="check-label"><input type="checkbox" checked={envOk} onChange={e => setEnvOk(e.target.checked)} data-testid="checkbox-smtp-env-confirm" /> This removes saved website settings. Email stops if the server environment is incomplete. I understand.</label>}
      </details>
    </fieldset>
    {test.data && <p role="status" className="notice" data-testid="status-smtp-test-success">{test.data.message} Provider acceptance does not confirm inbox delivery.</p>}
    {test.isError && <p role="alert" className="error-box" data-testid="status-smtp-test-error">Test email failed. Check the recipient and configuration, or wait 15 minutes if the attempt limit was reached.</p>}
    {save.isError && !askPw && <p role="alert" className="error-box" data-testid="error-smtp-save">Settings were not saved. Check your password and fields, or refresh if another administrator made changes.</p>}
    <div className="sms-ref-footer">
      <button type="button" className="button em-btn" disabled={blocked || busy} onClick={() => { setMsg(null); save.reset(); setAskPw(true); }} data-testid="button-save-smtp-settings"><Save size={16} aria-hidden /> {save.isPending ? "Saving…" : "Save Email Settings"}</button>
      <div className="sms-ref-testbar">
        <input type="email" aria-label="Test email address" placeholder="test@example.com" maxLength={254} value={to} onChange={e => { test.reset(); setTo(e.target.value); }} data-testid="input-smtp-test-recipient" />
        <button type="button" className="button secondary em-btn" disabled={!canTest} onClick={() => void runTest()} data-testid="button-send-smtp-test"><Send size={16} aria-hidden /> {test.isPending ? "Sending…" : "Test Email"}</button>
      </div>
    </div>
    {askPw && <AppDialog open onClose={() => { if (!save.isPending) { setAskPw(false); setPw(""); } }} dirty={false} busy={save.isPending} title="Confirm your password" description={mode === "database" && base.notificationsEnabled && !f.enabled ? "Turning off cancels pending optional email notifications. Sign-in, invitation and recovery emails continue. Saving does not send a message." : "Saving does not send a message."}>
      <form className="cf-form" autoComplete="off" onSubmit={e => { e.preventDefault(); doSave(); }}>
        <div className="form-field"><label htmlFor="em-pw">Current Super Admin password</label>
          <PasswordInput id="em-pw" autoComplete="current-password" required maxLength={1024} value={pw} onChange={e => setPw(e.target.value)} /></div>
        {save.isError && <p role="alert" className="error-box" data-testid="error-smtp-save-dialog">Settings were not saved. Check your password and try again.</p>}
        <div className="sms-ref-footer"><button type="submit" className="button" disabled={!pw || save.isPending} data-testid="button-confirm-smtp-save">Confirm and save</button>
          <button type="button" className="button secondary" disabled={save.isPending} onClick={() => { setAskPw(false); setPw(""); }}>Cancel</button></div>
      </form></AppDialog>}
  </div>;
}
export default EmailProviderPanel;
