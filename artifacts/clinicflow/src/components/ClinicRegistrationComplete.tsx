import { clinicWorkspaceHref } from "../lib/clinic-navigation";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Users } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { Logo } from "../App";
import { ActionLabel } from "./ActionLabel";
import { usePublicWebsite, PublicWebsiteStatus, PublicWebsiteLink } from "../lib/public-website";
import { PageDescription } from "./PageDescription";
import { noticeLabel } from "../lib/staff-account";

export function ClinicRegistrationComplete({ result, invitationStatus, notice }: { result: Pick<api.ClinicSettingsResult, "clinic" | "doctorId"> & { branches?: api.Branch[] }; invitationStatus?: string; notice?: { email?: string | null; sms?: string | null } }) {
  const client = useQueryClient();
  const site = usePublicWebsite();
  const linked = (result.branches || []).filter(branch => branch.linkedSchedule?.enabled);
  return <div className="clinic-registration"><Logo/><main className="registration-card">
    {notice && <p className="muted small" data-testid="status-creation-notice">Your notice: email {noticeLabel(notice.email).toLowerCase()}; SMS {noticeLabel(notice.sms).toLowerCase()}.</p>}
    <span className="eyebrow">CLINIC CREATED · {!result.branches || result.doctorId ? "Review Saved Configuration" : "Doctor Sessions Required"}</span>
    <h1>{result.clinic.name} is registered.</h1>
    <PageDescription text="Review your saved clinic setup before sharing booking links." help="Open clinic configuration to review the timetable. Your doctor profile and Clinic Admin access use the same account; no role switch or extra login is needed." label="About your saved clinic"/>
    <p className="notice">{!result.branches ? "Check the saved timetable and booking readiness." : linked.length ? `Linked doctor sessions saved for ${linked.length} location(s); opening hours are your consultation timetable. Check a future date before sharing the QR; capacity and booking rules still apply.` : result.doctorId ? "Check saved consultation sessions and a future date before sharing the QR; opening hours alone do not make appointments bookable." : "Assign a doctor and configure sessions before patients can book."}</p>
    {invitationStatus && <p role="status" className={invitationStatus === "failed" ? "error-box" : "notice"}>{invitationStatus === "sent" ? "The provider accepted the account invitation email. Inbox delivery is not confirmed." : invitationStatus === "failed" ? "The clinic was created, but the invitation outcome is unavailable. Check the provider before requesting another link from Staff management." : invitationStatus === "notRequired" ? "Saved. The administrator account is active and can sign in with its email and password." : "No new account invitation was required."}</p>}
    <div className="public-clinic-actions registration-complete-actions">
      <Link className="button" href={clinicWorkspaceHref(result.clinic.id)} onClick={() => void client.invalidateQueries()} data-testid="registration-configure-sessions"><ActionLabel>{result.doctorId ? "Review clinic configuration" : "Complete booking setup"}</ActionLabel></Link>
      <Link className="button secondary" href="/admin/dashboard" onClick={() => void client.invalidateQueries()} data-testid="registration-open-workspace"><ActionLabel>Open Workspace</ActionLabel></Link>
      <Link className="button secondary" href={clinicWorkspaceHref(result.clinic.id,"staff")} onClick={() => void client.invalidateQueries()}><ActionLabel><Users size={17} aria-hidden="true"/>Staff Management</ActionLabel></Link>
       {result.clinic.slug && site.origin && <a className="button secondary" href={site.url(`/${result.clinic.slug}`)}><ActionLabel><Globe size={17} aria-hidden="true"/>Check Public Booking Page</ActionLabel></a>}
    </div>
     {result.clinic.slug && <><PublicWebsiteStatus/><div className="registration-url">Clinic link: <PublicWebsiteLink route={`/${result.clinic.slug}`}/></div>{result.branches?.filter(b => b.slug).map(b => <div className="registration-url" key={b.id}>{b.name}: <PublicWebsiteLink route={`/${result.clinic.slug}/${b.slug}`}/></div>)}</>}
   </main></div>;
}