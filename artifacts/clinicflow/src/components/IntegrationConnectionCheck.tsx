import { useState } from "react";
import { useCheckIntegrationConnection } from "@workspace/api-client-react";
import { HelpTip } from "./HelpTip";
import { AppDialog } from "./AppDialog";

/** Manual, saved-configuration checks only. Never sends a message or file. */
export function IntegrationConnectionCheck({ provider }: { provider: "smtp" | "sms" | "storage" }) {
  const check = useCheckIntegrationConnection();
  const [resultsOpen, setResultsOpen] = useState(false);
  return <div className="int-check">
    <button type="button" className="button secondary" data-testid={`button-check-${provider}`} disabled={check.isPending}
      onClick={() => check.mutate({ provider }, { onSuccess: () => setResultsOpen(true) })}>{check.isPending ? "Checking…" : "Check connection"}</button>
    <HelpTip text="Verifies saved settings and reachability only. No message or file is sent."/>
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
