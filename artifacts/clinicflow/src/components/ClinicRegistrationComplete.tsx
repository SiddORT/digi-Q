import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Logo } from "../App";

export function ClinicRegistrationComplete({ result, invitationStatus }: { result: Pick<api.ClinicSettingsResult, "clinic" | "doctorId"> & { branches?: api.Branch[] }; invitationStatus?: string }) {
  const client = useQueryClient();
  const linked = (result.branches || []).filter(branch => branch.linkedSchedule?.enabled);
  return <div className="clinic-registration"><Logo/><main className="registration-card">
    <span className="eyebrow">CLINIC CREATED · {!result.branches ? "Review Saved Configuration" : linked.length ? "Linked Sessions Configured" : "Doctor Sessions Required"}</span>
    <h1>{result.clinic.name} is registered.</h1>
    <p>{!result.branches ? "Open clinic configuration to check the saved timetable and booking readiness." : linked.length ? `Your clinic and linked doctor sessions were saved together for ${linked.length} location(s). Your opening hours are your consultation timetable. Check an open future date before sharing your booking QR; capacity and booking rules still apply.` : "Your location hours are saved. Assign a doctor if needed and configure custom sessions before patients can book."}</p>
    {result.doctorId && <p>Your doctor profile and Clinic Admin access use the same account. No role switch or extra login is needed.</p>}
    {invitationStatus && <p role="status" className={invitationStatus === "failed" ? "error-box" : "notice"}>{invitationStatus === "sent" ? "The account invitation was sent." : invitationStatus === "failed" ? "The clinic was created, but invitation delivery failed. Retry from Staff management." : "No new account invitation was required."}</p>}
    <div className="public-clinic-actions">
      <Link className="button" href={`/admin/settings?clinicId=${encodeURIComponent(result.clinic.id)}`} onClick={() => void client.invalidateQueries()} data-testid="registration-configure-sessions">{linked.length ? "Review clinic configuration" : "Complete booking setup"}</Link>
      <Link className="button secondary" href="/admin/dashboard" onClick={() => void client.invalidateQueries()} data-testid="registration-open-workspace">Open Workspace</Link>
      <Link href={`/admin/users?clinicId=${encodeURIComponent(result.clinic.id)}`} onClick={() => void client.invalidateQueries()}>Staff Management</Link>
      {result.clinic.slug && <Link href={`/${result.clinic.slug}`}>Check Public Booking Page</Link>}
    </div>
  </main></div>;
}