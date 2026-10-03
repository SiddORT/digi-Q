import { HelpTip } from "../HelpTip";
import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { friendlyError } from "../../lib/friendly-error";
import { collectFilteredAppointments, filteredAppointmentsCsv } from "./filtered-export";

export function FilteredAppointmentExport({ params, disabled, contextKey }: { params: api.ListAppointmentsParams; disabled: boolean; contextKey: string }) {
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { page: _page, pageSize: _pageSize, ...filters } = params;
  const context = JSON.stringify(filters);
  useEffect(() => {
    setMessage(""); setError("");
    return () => { controller.current?.abort(); };
  }, [context, contextKey]);

  async function download() {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request; setBusy(true); setMessage(""); setError(""); setProgress("Preparing export…");
    try {
      const records = await collectFilteredAppointments(params, (batch, signal) => api.listAppointments(batch, { signal }), request.signal, (loaded, total) => setProgress(`Preparing ${loaded} of ${total} appointments…`));
      request.signal.throwIfAborted();
      if (!records.length) { setMessage("No matching appointments to export."); return; }
      const url = URL.createObjectURL(new Blob([filteredAppointmentsCsv(records)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "DigiQ-filtered-appointments.csv"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${records.length} matching appointments exported.`);
    } catch (error) {
      if (request.signal.aborted) setMessage("Export cancelled. No file was downloaded.");
      else setError(friendlyError(error, "load", "Unable to export appointments. Please try again."));
    } finally {
      if (controller.current === request) controller.current = null;
      setBusy(false); setProgress("");
    }
  }
  return <div className="export-inline" role="group" aria-label="Export filtered appointments">
    <button type="button" className="button secondary small" aria-label={busy ? "Exporting matching appointments" : "Export all matching appointments"} disabled={disabled || busy} onClick={()=>void download()} data-testid="button-export-filtered-appointments">{busy ? "Exporting…" : "Export"}</button>
    {busy && <button type="button" onClick={()=>controller.current?.abort()} data-testid="button-cancel-appointment-export">Cancel export</button>}
    <HelpTip text="Exports all pages using the current filters and each clinic’s date and time format. Changing filters cancels an in-progress export."/>
    {(progress || message) && <span role="status" className="export-status">{progress || message}</span>}
    {error && <span role="alert" className="export-status error">{error}</span>}
  </div>;
}