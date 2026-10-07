import * as api from "@workspace/api-client-react";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import { formatTime } from "../lib/date-time";
import { addressLine, canChangeClinicDefaults, clinicSettingsHref, contactSource, openingHoursSummary } from "../lib/inherited-defaults";

/** Read-only clinic and location values a new doctor/receptionist inherits. Changed only via Clinic settings by the owner. */
export function InheritedClinicSummary({ clinicIds, branchIds, user, doctor }: { clinicIds: string[]; branchIds: string[]; user?: { id?: string; role?: string }; doctor: boolean }) {
  if (!clinicIds.length) return <p className="muted wide" data-testid="text-inherited-empty">Choose a Clinic Group to see the clinic details this person inherits.</p>;
  return <div className="inherited-summary wide" data-testid="panel-inherited-defaults">
    {clinicIds.slice(0, 5).map(id => <InheritedClinic key={id} clinicId={id} branchIds={branchIds} user={user}/>)}
    {doctor && <p className="muted">Doctor sessions are not copied here. After adding, choose sessions linked to location hours or custom weekly hours in Schedule. Patients per session is set there; it is never guessed.</p>}
  </div>;
}

function InheritedClinic({ clinicId, branchIds, user }: { clinicId: string; branchIds: string[]; user?: { id?: string; role?: string } }) {
  const clinic = api.useGetClinic(clinicId, { query: { queryKey: api.getGetClinicQueryKey(clinicId), staleTime: 60000 } });
  const params = { clinicId, status: "active" as const, pageSize: 100 };
  const branches = api.useListBranches(params, { query: { queryKey: api.getListBranchesQueryKey(params), staleTime: 60000 } });
  if (clinic.isLoading || branches.isLoading) return <div className="skeleton" aria-busy="true">Loading inherited clinic details…</div>;
  if (clinic.error || !clinic.data) return <div className="error-box" role="alert">Unable to load this clinic's details. <button type="button" onClick={() => { clinic.refetch(); branches.refetch(); }}>Retry</button></div>;
  const c = clinic.data;
  const prefs = { dateFormat: c.dateFormat, timeFormat: c.timeFormat } as Parameters<typeof formatTime>[1];
  const all = branches.data?.items || [];
  const chosen = all.filter(b => branchIds.includes(b.id));
  const shown = chosen.length ? chosen : all;
  const owner = canChangeClinicDefaults(user, c);
  return <section className="inherited-clinic" aria-label={`Inherited from ${c.name}`}>
    <header><strong><Lock size={13} aria-hidden/> {c.name}</strong><small className="muted">{owner ? <Link href={clinicSettingsHref(c.id)} className="text-link" data-testid="link-inherited-settings">Change in Clinic settings</Link> : "Read only · only the clinic owner or a Super Admin can change these"}</small></header>
    <dl className="inherited-facts">
      <div><dt>Address</dt><dd>{addressLine(c)}</dd></div>
      <div><dt>Contact</dt><dd>{[c.email, c.phone].filter(Boolean).join(" · ") || "No clinic contact"}</dd></div>
      <div><dt>Booking policies</dt><dd data-testid="text-inherited-policies">Inherited and enforced by the server{owner ? <> · <Link href={clinicSettingsHref(c.id, "policies")} className="text-link">review in Clinic settings</Link></> : ""}</dd></div>
      <div><dt>Date and time</dt><dd>{c.dateFormat || "DD MMM YYYY"} · {c.timeFormat === "24h" ? "24-hour" : "12-hour"}</dd></div>
    </dl>
    {branches.error ? <p className="field-error" role="alert">Unable to load locations.</p> : <ul className="inherited-branches">{shown.map(b => <li key={b.id}><strong>{b.name}</strong> <span className="muted">{b.timezone || "Asia/Kolkata"}</span><br/>{addressLine(b)} · {[b.effectiveEmail, b.effectivePhone].filter(Boolean).join(" · ") || "No location contact"} <span className="muted">({contactSource(b)})</span><br/><small>Opening hours: {openingHoursSummary(b.openingHours, t => formatTime(t, prefs))}</small></li>)}{!shown.length && <li className="muted">No active locations yet.</li>}</ul>}
    {!chosen.length && all.length > 0 && <small className="muted">Showing all locations; select locations to narrow this summary.</small>}
  </section>;
}
