import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Building2, MapPin, Stethoscope } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { Logo } from "../App";
import { PublicBooking } from "../clinic";
import { AuthAccess } from "../auth/AuthAccess";
import { useAuth } from "@clerk/react";
import { ClinicDisplay } from "./ClinicDisplay";
import { PublicClinicLive } from "./PublicClinicLive";
import { PublicClinicBookingQr } from "./PublicClinicBookingQr";
import "./clinic-registration.css";

const reserved = new Set(["admin", "doctor", "receptionist", "patient", "api", "auth", "sign-in", "sign-up", "login", "logout", "register", "register-clinic", "register-doctor", "onboarding", "patient-login", "scan-qr", "guest-booking", "forgot-password", "set-password", "check-in", "display", "book", "settings", "users", "assets", "public", "health", "healthz", "favicon", "robots", "sitemap", "clinics", "branches", "appointments", "patients", "queue", "reports", "masters", "audit", "qrs", "availability", "exceptions"]);
for (const name of ["signup", "dashboard", "doctors", "schedules", "booking", "qr", "guest", "invite", "invitations", "reset-password", "account", "me", "clinicflow-project-deck"]) reserved.add(name);
const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 3 && value.length <= 63;
export function PublicClinicPage({ clinicSlug, branchSlug }: { clinicSlug: string; branchSlug?: string }) {
  if (!validSlug(clinicSlug) || reserved.has(clinicSlug) || (branchSlug && !validSlug(branchSlug))) return <div className="empty"><h1>Page not found</h1><Link href="/">Return home</Link></div>;
  return <PublicClinicResolved clinicSlug={clinicSlug} branchSlug={branchSlug}/>;
}

function PublicClinicResolved({ clinicSlug, branchSlug }: { clinicSlug: string; branchSlug?: string }) {
  const search = useSearch();
  const auth = useAuth();
  const clinicQuery = api.useResolveClinicSlug(clinicSlug, { query: { queryKey: api.getResolveClinicSlugQueryKey(clinicSlug), enabled: !branchSlug, refetchInterval: 30000, staleTime: 0 } });
  const branchQuery = api.useResolveBranchSlug(clinicSlug, branchSlug || "", { query: { queryKey: api.getResolveBranchSlugQueryKey(clinicSlug, branchSlug || ""), enabled: !!branchSlug, refetchInterval: 30000, staleTime: 0 } });
  const query = branchSlug ? branchQuery : clinicQuery;
  const data = query.data;
  useEffect(() => {
    const previous = document.title;
    document.title = data ? `${data.branch?.name ? `${data.branch.name} · ` : ""}${data.clinic.name} | ClinicFlow` : "Clinic information | ClinicFlow";
    const description = document.createElement("meta"); description.name = "description"; description.content = data ? `Visit ${data.clinic.name}. Find clinic locations, care specialists, live sessions and book a visit.` : "Clinic locations, care teams and booking information.";
    const og = document.createElement("meta"); og.setAttribute("property", "og:title"); og.content = document.title;
    document.head.append(description, og);
    return () => { document.title = previous; description.remove(); og.remove(); };
  }, [data?.clinic.name, data?.branch?.name]);
  const params = new URLSearchParams(search);
  const mode = params.get("display") === "1" ? "display" : params.get("book") === "1" ? "book" : null;
  if (query.isLoading) return <div className="page-loading" role="status">Loading clinic information…</div>;
  if (query.error || !data) return <div className="public-clinic"><Logo/><main className="registration-card"><h1>Clinic page unavailable</h1><p>This address may be unavailable, inactive or temporarily unreachable.</p><div className="error-box" role="alert">{query.error?.message || "No clinic information was returned."}</div><button className="button" data-testid="public-clinic-retry" onClick={() => query.refetch()}>Try again</button> <Link href="/">Return home</Link></main></div>;
  const { clinic, branch, branches, doctors, qrReference } = data;
  const path = `/${clinicSlug}${branch?.slug ? `/${branch.slug}` : ""}`;
  const bookingUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}?book=1`;
  if (mode && branch && qrReference) {
    if (mode === "display") return <ClinicDisplay reference={qrReference} bookingHref={bookingUrl}/>;
    if (!auth.isLoaded) return <div className="page-loading">Preparing secure booking…</div>;
    return auth.isSignedIn ? <AuthAccess><PublicBooking reference={qrReference}/></AuthAccess> : <PublicBooking reference={qrReference}/>;
  }
  const email = branch ? branch.effectiveEmail : clinic.email;
  const phone = branch ? branch.effectivePhone : clinic.phone;
  return <div className="public-clinic"><header className="public-clinic-header"><Logo/><Link href={clinicSlug === "clinicflow-demo" ? "/demo-login" : "/sign-in"} data-testid="public-clinic-staff">{clinicSlug === "clinicflow-demo" ? "Demo staff login" : "Staff login"}</Link></header><main className="public-clinic-content">
    {clinicSlug === "clinicflow-demo" && <div className="notice" role="status" data-testid="demo-clinic-warning"><strong>Fictional demo clinic.</strong> Do not enter real patient information. Guest requests require staff approval before a token is issued.</div>}
    <section className="public-clinic-hero">
      <span className="eyebrow"><Building2 size={15}/> YOUR CARE, CONNECTED</span>
      <h1>{clinic.name}</h1>{branch && <h2>{branch.name}</h2>}
      <p><MapPin size={16}/> {[branch?.address || clinic.address, branch?.city].filter(Boolean).join(", ") || "Contact the clinic for directions."}</p>
      <p>{email && <a href={`mailto:${email}`} data-testid="public-clinic-email">{email}</a>}{email && phone && " · "}{phone && <a href={`tel:${phone}`} data-testid="public-clinic-phone">{phone}</a>}</p>
      <dl><div><dt>Active doctors {branch ? "at this location" : "across this clinic"}</dt><dd data-testid="public-doctor-count">{branch ? doctors.length : clinic.doctorCount ?? "Not available"}</dd></div><div><dt>Clinic-wide average actual consultation</dt><dd data-testid="public-average-duration">{clinic.averageConsultationMinutes == null ? "Not yet available" : `${Math.round(clinic.averageConsultationMinutes * 10) / 10} minutes`}</dd></div></dl>
      {branch && qrReference ? <div className="public-clinic-actions"><Link href={`${path}?book=1`} className="button" data-testid="public-book-visit">Book a visit</Link><Link href={`${path}?display=1`} className="button secondary" data-testid="public-reception-display">Reception display</Link></div> : branch ? <p className="notice" role="status">Online booking and reception display are temporarily unavailable. Please contact the clinic.</p> : <p className="notice">Choose a location to see its care team, booking and reception display.</p>}
      {branch && branches.length > 1 && <Link href={`/${clinicSlug}`} className="text-link" data-testid="public-change-branch">Choose another location</Link>}
      {branch && qrReference && <PublicClinicBookingQr bookingUrl={bookingUrl} branchName={branch.name}/>}
    </section>
    {!branch && <section className="public-clinic-grid">{branches.map(b => <article className="public-clinic-card" key={b.id}><MapPin size={22}/><h2>{b.name}</h2><p>{[b.address, b.city].filter(Boolean).join(", ")}</p>{b.slug ? <Link className="button secondary" href={`/${clinicSlug}/${b.slug}${mode ? `?${mode}=1` : ""}`} data-testid={`public-select-branch-${b.id}`}>Choose location</Link> : <p>Online access is not available for this location. Contact the clinic.</p>}</article>)}</section>}
    {branch && <div className="public-clinic-grid">
      <section className="public-clinic-card"><span className="eyebrow">YOUR CARE TEAM</span><h2><Stethoscope size={20}/> Specialists</h2>
        {doctors.length ? doctors.map(doctor => <article className="public-clinic-session" key={doctor.id}>
          <strong>{doctor.fullName}</strong>
          <p>{doctor.specializationName || "Specialization not listed"}{doctor.qualificationNames?.length ? ` · ${doctor.qualificationNames.join(", ")}` : ""}</p>
          {doctor.about && <p>{doctor.about}</p>}
          <dl><div><dt>Average actual consultation</dt><dd data-testid={`public-doctor-average-${doctor.id}`}>{doctor.averageConsultationMinutes == null ? "Not yet available" : `${Math.round(doctor.averageConsultationMinutes * 10) / 10} minutes`}</dd></div><div><dt>Planned consultation</dt><dd data-testid={`public-doctor-duration-${doctor.id}`}>{doctor.expectedDurationMinutes == null ? "Not configured" : `${doctor.expectedDurationMinutes} minutes`}</dd></div></dl>
          <small className="registration-note">Actual averages use completed consultations, not planned slot lengths. Your visit may take a different amount of time.</small>
        </article>) : <p>No active doctors are currently listed at this location.</p>}
      </section>
      {qrReference && <PublicClinicLive reference={qrReference}/>}
      <section className="public-clinic-card"><h2>Opening hours</h2>
        {branch.openingHours?.length ? Array.from({ length: 7 }, (_, day) => {
          const sessions = branch.openingHours?.filter(h => h.dayOfWeek === day) || [];
          return <div className="public-clinic-session" key={day}><strong>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]}</strong><span>{sessions.length ? sessions.map(s => `${s.startTime}–${s.endTime}`).join(" · ") : "Closed"}</span></div>;
        }) : <p>Opening hours have not been published. Contact the clinic for details.</p>}
        <p className="registration-note">{branch.timezone}. Opening hours do not guarantee doctor availability. Check booking for available sessions.</p>
      </section>
    </div>}
  </main></div>;
}