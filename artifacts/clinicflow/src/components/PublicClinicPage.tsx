import { useEffect, useState } from "react";
import { HelpTip } from "./HelpTip";
import { Link, useLocation, useSearch } from "wouter";
import { Building2, MapPin, Stethoscope } from "lucide-react";
import * as api from "@workspace/api-client-react";
import { Logo } from "../App";
import { BRAND_NAME } from "../branding";
import { formatTime } from "../lib/date-time";
import { PublicBooking } from "../clinic";
import { AuthAccess } from "../auth/AuthAccess";
import { useNativeAuth } from "../auth/native-auth";
import { ClinicDisplay } from "./ClinicDisplay";
import { PublicClinicLive } from "./PublicClinicLive";
import { PublicClinicBookingQr } from "./PublicClinicBookingQr";
import { FilterBar, Pagination, SearchInput, listingSuggestions, useDebouncedValue } from "./ListingControls";
import { SearchableSelect } from "./SearchableSelect";
import "./clinic-registration.css";

const reserved = new Set(["admin", "doctor", "receptionist", "patient", "api", "auth", "sign-in", "sign-up", "login", "logout", "register", "register-clinic", "register-doctor", "onboarding", "patient-login", "scan-qr", "guest-booking", "forgot-password", "set-password", "check-in", "display", "book", "settings", "users", "assets", "public", "health", "healthz", "favicon", "robots", "sitemap", "clinics", "branches", "appointments", "patients", "queue", "reports", "masters", "audit", "qrs", "availability", "exceptions"]);
for (const name of ["signup", "dashboard", "doctors", "schedules", "booking", "qr", "guest", "invite", "invitations", "reset-password", "account", "me", "clinicflow-project-deck"]) reserved.add(name);
const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 3 && value.length <= 63;
export function PublicClinicPage({ clinicSlug, branchSlug }: { clinicSlug: string; branchSlug?: string }) {
  if (!validSlug(clinicSlug) || reserved.has(clinicSlug) || (branchSlug && !validSlug(branchSlug))) return <div className="empty"><h1>Page not found</h1><Link href="/">Return home</Link></div>;
  return <PublicClinicResolved key={`${clinicSlug}/${branchSlug || ""}`} clinicSlug={clinicSlug} branchSlug={branchSlug}/>;
}

function PublicClinicResolved({ clinicSlug, branchSlug }: { clinicSlug: string; branchSlug?: string }) {
  const search = useSearch();
  const [, navigate] = useLocation();
   const auth = useNativeAuth();
  const params = new URLSearchParams(search);
  const committedSearch = params.get("search") || "";
  const [searchText, setSearchText] = useState(committedSearch);
  const debouncedSearch = useDebouncedValue(searchText, 300);
  const requestedSize = Number(params.get("pageSize"));
  const pageSize: 10 | 25 | 50 | 100 = requestedSize === 10 || requestedSize === 50 || requestedSize === 100 ? requestedSize : 25;
  const requestedPage = Number(params.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000000 ? requestedPage : 1;
  const sort = params.get("sort") === "-name" ? "-name" as const : "name" as const;
  const directoryParams = { directory: true, page, pageSize, search: committedSearch || undefined, sort };
  const updateDirectory = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
    navigate(`/${clinicSlug}${branchSlug ? `/${branchSlug}` : ""}${next.size ? `?${next}` : ""}`, { replace: true });
  };
  useEffect(() => { setSearchText(committedSearch); }, [committedSearch]);
  useEffect(() => {
    if (debouncedSearch.trim() !== committedSearch) updateDirectory({ search: debouncedSearch.trim() || undefined, page: undefined });
  }, [debouncedSearch]);
  const clinicQuery = api.useResolveClinicSlug(clinicSlug, directoryParams, { query: { queryKey: api.getResolveClinicSlugQueryKey(clinicSlug, directoryParams), enabled: !branchSlug, refetchInterval: 30000, staleTime: 0, placeholderData: previous => previous } });
  const branchQuery = api.useResolveBranchSlug(clinicSlug, branchSlug || "", directoryParams, { query: { queryKey: api.getResolveBranchSlugQueryKey(clinicSlug, branchSlug || "", directoryParams), enabled: !!branchSlug, refetchInterval: 30000, staleTime: 0, placeholderData: previous => previous } });
  const query = branchSlug ? branchQuery : clinicQuery;
  const data = query.data;
  const mode = params.get("display") === "1" ? "display" : params.get("book") === "1" ? "book" : null;
  const onlyBranch = !branchSlug && mode === "book" && data?.branchCount === 1 && data.branch?.slug ? data.branch : null;
  useEffect(() => {
    if (!query.isPlaceholderData && data?.directoryPagination && data.directoryPagination.page !== page) updateDirectory({ page: String(data.directoryPagination.page) });
  }, [data?.directoryPagination?.page, page, query.isPlaceholderData]);
  useEffect(() => {
    if (onlyBranch) navigate(`/${clinicSlug}/${onlyBranch.slug}?book=1`, { replace: true });
  }, [clinicSlug, onlyBranch?.slug, navigate]);
  useEffect(() => {
    const previous = document.title;
    document.title = data ? `${data.branch?.name ? `${data.branch.name} · ` : ""}${data.clinic.name} | ${BRAND_NAME}` : `Clinic information | ${BRAND_NAME}`;
    const description = document.createElement("meta"); description.name = "description"; description.content = data ? `Visit ${data.clinic.name}. Find clinic locations, care specialists, live sessions and book a visit.` : "Clinic locations, care teams and booking information.";
    const og = document.createElement("meta"); og.setAttribute("property", "og:title"); og.content = document.title;
    document.head.append(description, og);
    return () => { document.title = previous; description.remove(); og.remove(); };
  }, [data?.clinic.name, data?.branch?.name]);
  if (onlyBranch) return <div className="page-loading" role="status">Opening your clinic’s only location…</div>;
  if (query.isLoading) return <div className="page-loading" role="status">Loading clinic information…</div>;
  if (query.error || !data) return <div className="public-clinic"><Logo/><main className="registration-card"><h1>Clinic page unavailable</h1><p>This address may be unavailable, inactive or temporarily unreachable.</p><div className="error-box" role="alert">Unable to load clinic information. Please try again.</div><button className="button" data-testid="public-clinic-retry" onClick={() => query.refetch()}>Try again</button> <Link href="/">Return home</Link></main></div>;
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
  const itemsLabel = branch ? "doctors" : "clinics";
  const clearSearch = () => { setSearchText(""); updateDirectory({ search: undefined, page: undefined }); };
  const directoryControls = <div aria-busy={query.isFetching}><FilterBar label={`${itemsLabel} directory filters`} active={!!committedSearch}
    chips={committedSearch ? [{ key: "search", label: `Search: ${committedSearch}`, onRemove: clearSearch }] : []}
    actions={committedSearch ? <button type="button" className="text-link" data-testid="public-directory-clear-all" onClick={clearSearch}>Clear all</button> : undefined}>
    <SearchInput value={searchText} onChange={setSearchText} placeholder={`Search ${itemsLabel}…`} suggestions={query.error?[]:branch?listingSuggestions(doctors,d=>({id:d.id,label:d.fullName,value:d.fullName})):listingSuggestions(branches,b=>({id:b.id,label:b.name,value:b.name}))} loading={query.isFetching} error={query.error?"Unable to load the directory.":null} onRetry={()=>void query.refetch()} total={data.directoryPagination?.total} settledQuery={committedSearch} scopeKey={JSON.stringify({clinicSlug,branchSlug,sort,pageSize})}/>
    <SearchableSelect label="Sort by" value={sort} onChange={value => updateDirectory({ sort: value, page: undefined })}
      options={[{ value: "name", label: "Name ↑ (A–Z)" }, { value: "-name", label: "Name ↓ (Z–A)" }]}/>
  </FilterBar>{query.isFetching && <p role="status" data-testid="public-directory-searching">Updating {itemsLabel}…</p>}</div>;
  const directoryPagination = data.directoryPagination && <div>
    <SearchableSelect label="Items per page" value={String(pageSize)} onChange={value => updateDirectory({ pageSize: value, page: undefined })}
      options={[10, 25, 50, 100].map(size => ({ value: String(size), label: String(size) }))}/>
    {data.directoryPagination.total === 0 && <p data-testid="public-directory-count">Showing 0–0 of 0</p>}
    <Pagination page={data.directoryPagination.page} pageSize={data.directoryPagination.pageSize}
      total={data.directoryPagination.total} onPageChange={next => updateDirectory({ page: String(next) })}/>
  </div>;
  const emptyDirectory = <div className="empty" role="status" data-testid="public-directory-empty"><p>No matching {itemsLabel}</p>{committedSearch && <button type="button" className="button secondary" data-testid="public-directory-clear-search" onClick={clearSearch}>Clear search</button>}</div>;
  return <div className="public-clinic"><header className="public-clinic-header"><Logo/><Link href={clinicSlug === "clinicflow-demo" ? "/demo-login" : "/sign-in"} data-testid="public-clinic-staff">{clinicSlug === "clinicflow-demo" ? "Demo staff login" : "Staff login"}</Link></header><main className="public-clinic-content">
    {clinicSlug === "clinicflow-demo" && <div className="notice" role="status" data-testid="demo-clinic-warning"><strong>Fictional demo clinic.</strong> Do not enter real patient information. Bookings issue a ticket immediately.</div>}
    <section className="public-clinic-hero">
      <span className="eyebrow"><Building2 size={15}/> YOUR CARE, CONNECTED</span>
      <h1>{clinic.name}</h1>{branch && <h2>{branch.name}</h2>}
      <p><MapPin size={16}/> {[branch?.address || clinic.address, branch?.city].filter(Boolean).join(", ") || "Contact the clinic for directions."}</p>
      <p>{email && <a href={`mailto:${email}`} data-testid="public-clinic-email">{email}</a>}{email && phone && " · "}{phone && <a href={`tel:${phone}`} data-testid="public-clinic-phone">{phone}</a>}</p>
      <dl><div><dt>Active doctors {branch ? "at this clinic" : "across this clinic"}</dt><dd data-testid="public-doctor-count">{branch ? data.branchDoctorCount ?? "Not available" : clinic.doctorCount ?? "Not available"}</dd></div><div><dt>Clinic-wide average actual consultation</dt><dd data-testid="public-average-duration">{clinic.averageConsultationMinutes == null ? "Not yet available" : `${Math.round(clinic.averageConsultationMinutes * 10) / 10} minutes`}</dd></div></dl>
      {branch && qrReference ? <div className="public-clinic-actions"><Link href={`${path}?book=1`} className="button" data-testid="public-book-visit">Book a visit</Link><Link href={`${path}?display=1`} className="button secondary" data-testid="public-reception-display">Reception display</Link></div> : branch ? <p className="notice" role="status">Online booking and reception display are temporarily unavailable. Please contact the clinic.</p> : <p className="notice">Choose a location to see its care team, booking and reception display.</p>}
      {branch && (data.branchCount ?? 0) > 1 && <Link href={`/${clinicSlug}${mode ? `?${mode}=1` : ""}`} className="text-link" data-testid="public-change-branch">Choose another clinic</Link>}
      {branch && qrReference && <PublicClinicBookingQr bookingUrl={bookingUrl} branchName={branch.name}/>}
    </section>
    {!branch && <section aria-label="Clinic directory">{directoryControls}<div className="public-clinic-grid">{branches.map(b => <article className="public-clinic-card" key={b.id}><MapPin size={22}/><h2>{b.name}</h2><p>{[b.address, b.city].filter(Boolean).join(", ")}</p>{b.slug ? <Link className="button secondary" href={`/${clinicSlug}/${b.slug}${mode ? `?${mode}=1` : ""}`} data-testid={`public-select-branch-${b.id}`}>Choose clinic</Link> : <p>Online access is not available for this clinic. Contact the clinic.</p>}</article>)}</div>{!branches.length && emptyDirectory}{directoryPagination}</section>}
    {branch && <div className="public-clinic-grid">
      <section className="public-clinic-card"><span className="eyebrow">YOUR CARE TEAM</span><h2><Stethoscope size={20}/> Specialists <HelpTip text="Actual averages use completed consultations, not planned slot lengths. Your visit may take a different amount of time."/></h2>
        {directoryControls}
        {doctors.length ? doctors.map(doctor => <article className="public-clinic-session" key={doctor.id}>
          <strong>{doctor.fullName}</strong>
          <p>{doctor.specializationName || "Specialization not listed"}{doctor.qualificationNames?.length ? ` · ${doctor.qualificationNames.join(", ")}` : ""}</p>
          {doctor.about && <p>{doctor.about}</p>}
          <p className="muted">Average actual consultation <span data-testid={`public-doctor-average-${doctor.id}`}>{doctor.averageConsultationMinutes == null ? "not yet available" : `${Math.round(doctor.averageConsultationMinutes * 10) / 10} minutes`}</span> · Planned <span data-testid={`public-doctor-duration-${doctor.id}`}>{doctor.expectedDurationMinutes == null ? "not configured" : `${doctor.expectedDurationMinutes} minutes`}</span></p>
        </article>) : emptyDirectory}
        {directoryPagination}
      </section>
      {qrReference && <PublicClinicLive reference={qrReference}/>}
      <section className="public-clinic-card"><h2>Opening hours</h2>
        {branch.openingHours?.length ? Array.from({ length: 7 }, (_, day) => {
          const sessions = branch.openingHours?.filter(h => h.dayOfWeek === day) || [];
          return <div className="public-clinic-session" key={day}><strong>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]}</strong><span>{sessions.length ? sessions.map(s => `${formatTime(s.startTime,clinic)}–${formatTime(s.endTime,clinic)}`).join(" · ") : "Closed"}</span></div>;
        }) : <p>Opening hours have not been published. Contact the clinic for details.</p>}
        <p className="registration-note">{branch.timezone}. Opening hours do not guarantee doctor availability. Check booking for available sessions.</p>
      </section>
    </div>}
  </main></div>;
}