import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "../SearchableSelect";
import { HelpTip } from "../HelpTip";
import { useConfirm } from "../ConfirmDialog";
import { friendlyError } from "../../lib/friendly-error";

type Link = api.LinkedSchedule;
type Defaults = { maxTokens?: number; consultationMinutes?: number; tokenPrefix?: string; queueMode?: string };

/** Who may switch a doctor's week between custom sessions and following location hours (mirrors server planLinkedSchedules + saveClinicSetup). */
export function followEligibility(input: { role?: string; userId?: string; clinicAdminId?: string; doctorUserId?: string }) {
  const owner = input.role === "superAdmin" || (input.role === "clinicAdmin" && !!input.userId && input.userId === input.clinicAdminId);
  const ownersDoctor = !!input.doctorUserId && input.doctorUserId === input.clinicAdminId;
  return { canToggle: owner && ownersDoctor, owner, ownersDoctor };
}

export function linkBody(branch: api.Branch, link: Link): api.ClinicSettingsInput {
  return { branches: [{ id: branch.id, name: branch.name, address: (branch as { address?: string }).address || "", linkedSchedule: link }] };
}

/** In-editor control: Custom sessions vs Follow location hours. Uses the existing owner-only Clinic settings preview/save endpoints. */
export function FollowLocationHours({ branch, doctorId, defaults, disabled, dirty }: { branch: api.Branch; doctorId: string; defaults: Defaults; disabled?: boolean; dirty?: boolean }) {
  const client = useQueryClient();
  const confirmation = useConfirm();
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 60000 } });
  const clinic = api.useGetClinic(branch.clinicId, { query: { queryKey: api.getGetClinicQueryKey(branch.clinicId), enabled: !!branch.clinicId } });
  const doctor = api.useGetDoctor(doctorId, { query: { queryKey: api.getGetDoctorQueryKey(doctorId), enabled: !!doctorId } });
  const current = (branch.linkedSchedule || { enabled: false }) as Link;
  const following = !!current.enabled && (!current.doctorId || current.doctorId === doctorId);
  const [form, setForm] = useState({ maxTokens: String(current.maxTokens ?? defaults.maxTokens ?? ""), consultationMinutes: String(current.consultationMinutes ?? defaults.consultationMinutes ?? ""), tokenPrefix: current.tokenPrefix ?? defaults.tokenPrefix ?? "", queueMode: current.queueMode ?? defaults.queueMode ?? "mixed" });
  const [choosing, setChoosing] = useState(false);
  const [preview, setPreview] = useState<api.ClinicSettingsPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const eligibility = followEligibility({ role: me.data?.user?.role, userId: me.data?.user?.id, clinicAdminId: (clinic.data as { adminId?: string } | undefined)?.adminId, doctorUserId: (doctor.data as { userId?: string } | undefined)?.userId });
  const hasHours = Array.isArray(branch.openingHours) && branch.openingHours.length > 0;

  if (clinic.isLoading || doctor.isLoading || me.isLoading) return <span className="muted follow-hours-note">Checking location-hours options…</span>;
  if (!eligibility.canToggle) {
    if (following) return <p className="muted follow-hours-note" data-testid="text-follow-hours-status">These sessions follow the location's opening hours. Only the clinic owner or a Super Admin can switch them to custom.</p>;
    return null;
  }
  const link: Link = { enabled: true, doctorId, maxTokens: Number(form.maxTokens), consultationMinutes: Number(form.consultationMinutes), tokenPrefix: form.tokenPrefix.trim().toUpperCase(), queueMode: form.queueMode as api.LinkedScheduleQueueMode };
  const valid = Number.isInteger(link.maxTokens) && link.maxTokens! >= 1 && link.maxTokens! <= 1000 && Number.isInteger(link.consultationMinutes) && link.consultationMinutes! >= 1 && link.consultationMinutes! <= 240 && /^[A-Z0-9]{1,8}$/.test(link.tokenPrefix || "");
  const done = async (next: Link, text: string) => {
    setBusy(true); setError("");
    try { await api.updateClinicSettings(branch.clinicId, linkBody(branch, next)); setMessage(text); setPreview(null); setChoosing(false); await client.invalidateQueries(); }
    catch (e) { setError(friendlyError(e, "save")); }
    finally { setBusy(false); }
  };
  const runPreview = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(""); setMessage("");
    try { setPreview(await api.previewClinicSettings(branch.clinicId, linkBody(branch, link))); }
    catch (e) { setError(friendlyError(e, "load")); }
    finally { setBusy(false); }
  };
  const unlink = async () => {
    if (!await confirmation.ask({ title: "Switch to Custom Sessions?", description: "Linked sessions stay as they are, but become custom: future location-hour changes will no longer update them. Bookings and history are kept.", confirmLabel: "Use Custom Sessions" })) return;
    await done({ ...current, enabled: false }, "Sessions are now custom. Edit them below and save the week.");
  };
  const impact = preview?.impacts?.[0] as { create?: number; update?: number; retire?: number } | undefined;

  return <div className="follow-hours" data-testid="follow-location-hours">
    {confirmation.dialog}
    <div className="seg-toggle" role="radiogroup" aria-label="Weekly sessions source">
      <button type="button" role="radio" aria-checked={!following && !choosing} disabled={busy || disabled} onClick={() => { if (following) void unlink(); else { setChoosing(false); setPreview(null); } }} data-testid="radio-custom-sessions">Custom sessions</button>
      <button type="button" role="radio" aria-checked={following || choosing} disabled={busy || disabled || (!following && !hasHours)} title={!hasHours ? "Set location opening hours first" : undefined} onClick={() => { if (!following) setChoosing(true); }} data-testid="radio-follow-location-hours">Follow location hours</button>
    </div>
    <HelpTip label="About following location hours" text="Follow keeps this doctor's sessions in step with the location's opening hours; when the owner changes hours, sessions update automatically. Copy once fills custom sessions a single time. Only the clinic owner's own consultations can follow."/>
    {following && <p className="muted follow-hours-note" data-testid="text-follow-hours-status">Following location hours: {current.maxTokens} tokens, {current.consultationMinutes} min, prefix {current.tokenPrefix}. Linked sessions are locked below.</p>}
    {!following && choosing && <div className="follow-hours-form">
      {dirty && <p className="notice">Save or discard your week edits first; following replaces custom sessions that overlap location hours.</p>}
      <div className="follow-hours-fields">
        <label>Capacity per session<input inputMode="numeric" value={form.maxTokens} onChange={e => { setPreview(null); setForm(f => ({ ...f, maxTokens: e.target.value.replace(/\D/g, "") })); }} data-testid="input-follow-max-tokens" /></label>
        <label>Minutes per patient<input inputMode="numeric" value={form.consultationMinutes} onChange={e => { setPreview(null); setForm(f => ({ ...f, consultationMinutes: e.target.value.replace(/\D/g, "") })); }} data-testid="input-follow-minutes" /></label>
        <label>Token prefix<input maxLength={8} value={form.tokenPrefix} onChange={e => { setPreview(null); setForm(f => ({ ...f, tokenPrefix: e.target.value.replace(/[^A-Za-z0-9]/g, "") })); }} data-testid="input-follow-prefix" /></label>
        <SearchableSelect label="Booking policy" value={form.queueMode} onChange={value => { setPreview(null); setForm(f => ({ ...f, queueMode: value || "mixed" })); }} options={[{ value: "mixed", label: "Appointments and walk-ins" }, { value: "appointmentsOnly", label: "Appointments only" }, { value: "walkInsOnly", label: "Walk-ins only" }]} />
      </div>
      {!valid && <small className="field-error">Capacity 1–1,000, minutes 1–240 and a 1–8 character prefix are required.</small>}
      {preview && <div className={preview.conflicts.length ? "error-box" : "notice"} role="status" data-testid="status-follow-preview">
        {preview.conflicts.length ? <><strong>Cannot follow yet.</strong><ul>{preview.conflicts.map(c => <li key={c}>{c}</li>)}</ul></> : <>Will create {impact?.create ?? 0}, update {impact?.update ?? 0} and retire {impact?.retire ?? 0} linked session(s). Custom sessions are kept.</>}
      </div>}
      <div className="follow-hours-actions">
        <button type="button" className="button secondary small" onClick={() => { setChoosing(false); setPreview(null); }} disabled={busy}>Cancel</button>
        {!preview || preview.conflicts.length ? <button type="button" className="button small" disabled={!valid || busy || dirty} onClick={() => void runPreview()} data-testid="button-follow-preview">{busy ? "Checking…" : "Review Changes"}</button>
          : <button type="button" className="button small" disabled={busy || dirty} onClick={() => void done(link, "Sessions now follow location hours.")} data-testid="button-follow-apply">{busy ? "Saving…" : "Follow Location Hours"}</button>}
      </div>
    </div>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {message && <p className="notice" role="status" data-testid="status-follow-hours">{message}</p>}
  </div>;
}
