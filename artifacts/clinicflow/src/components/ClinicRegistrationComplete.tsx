import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Users } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { Logo } from "../App";
import { ActionLabel } from "./ActionLabel";

export function ClinicRegistrationComplete({ result, invitationStatus }: { result: Pick<api.ClinicSettingsResult, "clinic" | "doctorId"> & { branches?: api.Branch[] }; invitationStatus?: string }) {
  const client = useQueryClient();
  const linked = (result.branches || []).filter(branch => branch.linkedSchedule?.enabled);
  return <div className="clinic-registration"><Logo/><main className="registration-card">
    <span className="eyebrow">CLINIC CREATED · {!result.branches || result.doctorId ? "Review Saved Configuration" : "Doctor Sessions Required"}</span>
    <h1>{result.clinic.name} is registered.</h1>
    <p>{!result.branches ? "Open clinic configuration to check the saved timetable and booking readiness." : linked.length ? `Your clinic and linked doctor sessions were saved together for ${linked.length} location(s). Your opening hours are your consultation timetable. Check an open future date before sharing your booking QR; capacity and booking rules still apply.` : result.doctorId ? "Your clinic and doctor profile are saved. Review your saved custom consultation sessions and check an open future date before sharing your booking QR. Opening hours alone do not make appointments bookable." : "Your location hours are saved. Assign a doctor if needed and configure custom sessions before patients can book."}</p>
    {result.doctorId && <p>Your doctor profile and Clinic Admin access use the same account. No role switch or extra login is needed.</p>}
    {invitationStatus && <p role="status" className={invitationStatus === "failed" ? "error-box" : "notice"}>{invitationStatus === "sent" ? "The provider accepted the account invitation email. Inbox delivery is not confirmed." : invitationStatus === "failed" ? "The clinic was created, but the invitation outcome is unavailable. Check the provider before requesting another link from Staff management." : "No new account invitation was required."}</p>}
    <div className="public-clinic-actions registration-complete-actions">
      <Link className="button" href={`/admin/settings?clinicId=${encodeURIComponent(result.clinic.id)}`} onClick={() => void client.invalidateQueries()} data-testid="registration-configure-sessions"><ActionLabel>{result.doctorId ? "Review clinic configuration" : "Complete booking setup"}</ActionLabel></Link>
      <Link className="button secondary" href="/admin/dashboard" onClick={() => void client.invalidateQueries()} data-testid="registration-open-workspace"><ActionLabel>Open Workspace</ActionLabel></Link>
      <Link className="button secondary" href={`/admin/clinic?clinicId=${encodeURIComponent(result.clinic.id)}&section=staff`} onClick={() => void client.invalidateQueries()}><ActionLabel><Users size={17} aria-hidden="true"/>Staff Management</ActionLabel></Link>
      {result.clinic.slug && <Link className="button secondary" href={`/${result.clinic.slug}`}><ActionLabel><Globe size={17} aria-hidden="true"/>Check Public Booking Page</ActionLabel></Link>}
    </div>
  </main></div>;
}