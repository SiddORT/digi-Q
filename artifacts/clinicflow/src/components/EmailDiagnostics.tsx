import { PageDescription } from "./PageDescription";
import type { IntegrationReadiness } from "@workspace/api-client-react";
import { IntegrationConnectionCheck } from "./IntegrationConnectionCheck";
import "./integration-settings.css";

export function EmailDiagnostics({ r, refreshing, onRefresh }: { r: IntegrationReadiness; refreshing: boolean; onRefresh: () => void }) {
  // Remount the manual check when saved settings change, including a source switch.
  // This also prevents an in-flight result for the previous revision from appearing.
  const savedConfiguration = JSON.stringify([r.revision, r.source, r.keys, r.smtpHost, r.smtpPort, r.fromEmail, r.fromName, r.useTls, r.useSsl, r.notificationsEnabled]);
  return <section className="int-settings" aria-labelledby="email-diagnostics-title" data-testid="section-email-diagnostics">
    <h3 id="email-diagnostics-title">Diagnostics</h3>
    <PageDescription className="muted" text="Check the saved email connection without sending mail." label="About email connection checks" help="Checks run only when requested, using saved settings rather than unsaved edits. Results clear when the saved configuration changes."/>
    <p className="muted">Connection success does not confirm sender permission or inbox delivery.</p>
    <div className="int-status-row">
      <p data-testid="status-integration-smtp"><span className={`badge ${r.ready ? "" : "muted"}`}>{r.ready ? "Configuration ready" : "Configuration required"}</span> <span className="muted">Source: {r.source === "database" ? "encrypted website settings" : "server environment"}</span></p>
      <button type="button" className="button secondary" disabled={refreshing} onClick={onRefresh} data-testid="button-refresh-email-diagnostics">Refresh status</button>
    </div>
    <ul className="int-keys">{r.keys.map(item => <li key={item.key} data-testid={`status-key-${item.key}`}><code>{item.key}</code>: {item.status}</li>)}</ul>
    <IntegrationConnectionCheck key={savedConfiguration} provider="smtp" />
  </section>;
}
