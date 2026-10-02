import { useState } from "react";
import * as api from "@workspace/api-client-react";
import { friendlyError } from "../lib/friendly-error";
import { SearchableSelect } from "./SearchableSelect";

export type LinkedSchedule = { enabled: boolean; doctorId?: string; maxTokens?: number; consultationMinutes?: number; tokenPrefix?: string; queueMode?: "mixed" | "appointmentsOnly" | "walkInsOnly" };

export function LinkedScheduleControls({ value, onChange, disabled = false }: { value: LinkedSchedule; onChange: (value: LinkedSchedule) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="branch-hours">
    <legend>Owner-doctor consultations</legend>
    <label className="check-label"><input type="checkbox" checked={value.enabled} onChange={event => onChange({ ...value, enabled: event.target.checked })}/>Use this location's hours for the owner's consultations</label>
    <p>{value.enabled ? "Linked: one timetable. Saving hours also updates the owner's linked sessions. Booked or exception-affected sessions cannot be silently changed." : "Custom: doctor sessions are managed in Weekly schedule. Unlinking keeps existing sessions and appointments unchanged."}</p>
    {value.enabled && <div className="form-grid">
      <label>Patients per session<input type="number" required min="1" step="1" value={value.maxTokens ?? ""} onChange={e => onChange({ ...value, maxTokens: e.target.value ? Number(e.target.value) : undefined })}/></label>
      <label>Consultation duration (minutes)<input type="number" required min="1" step="1" value={value.consultationMinutes ?? ""} onChange={e => onChange({ ...value, consultationMinutes: e.target.value ? Number(e.target.value) : undefined })}/></label>
      <label>Ticket prefix<input value={value.tokenPrefix || "A"} maxLength={8} onChange={e => onChange({ ...value, tokenPrefix: e.target.value.toUpperCase() })}/></label>
      <SearchableSelect label="Booking mode" disabled={disabled} value={value.queueMode || "mixed"} onChange={queueMode => { if (queueMode) onChange({ ...value, queueMode: queueMode as LinkedSchedule["queueMode"] }); }} options={[{value:"mixed",label:"Appointments and walk-ins"},{value:"appointmentsOnly",label:"Appointments only"},{value:"walkInsOnly",label:"Walk-ins only (no online bookings)"}]}/>
    </div>}
  </fieldset>;
}

export function ClinicChangeReview({ clinicId, change, onSave, busy }: { clinicId: string; change: api.ClinicSettingsInput; onSave: () => void; busy: boolean }) {
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ allowed: boolean; impacts: { branchId: string; create: number; update: number; retire: number; unlink: boolean }[]; conflicts: string[] } | null>(null);
  async function preview() {
    setChecking(true); setError(""); setResult(null);
    try { setResult(await api.previewClinicSettings(clinicId, change)); }
    catch (e) { setError(friendlyError(e,"save")); }
    finally { setChecking(false); }
  }
  return <section className="notice" aria-label="Review configuration impact">
    <h3>Review before applying</h3>
    <p>Nothing has been saved. Preview checks session changes and conflicts. Applying rechecks everything atomically; existing appointments will not be moved or cancelled.</p>
    {error && <p role="alert">{error}</p>}
    {!result && <button type="button" className="button" disabled={busy || checking} onClick={() => void preview()}>{checking ? "Checking impact…" : "Preview changes"}</button>}
    {result && <><ul>{result.impacts.map(item => <li key={item.branchId}>{item.create} session(s) created · {item.update} updated · {item.retire} retired{item.unlink ? " · existing sessions become custom" : ""}</li>)}</ul>{result.conflicts.length > 0 && <div role="alert"><strong>Resolve these conflicts before saving:</strong><ul>{result.conflicts.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}<button type="button" className="button" disabled={busy || !result.allowed} onClick={onSave}>{busy ? "Applying…" : "Apply reviewed changes"}</button><button type="button" disabled={busy} onClick={() => void preview()}>Recheck</button></>}
  </section>;
}