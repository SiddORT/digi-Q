import { PageDescription } from "./PageDescription";
import { RecoveryActions } from "./RecoveryActions";
import { friendlyError } from "../lib/friendly-error";
import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Link, useLocation, useSearch } from "wouter";
import { Building2, MapPin } from "lucide-react";
import { Logo } from "../App";
import { SearchInput, useDebouncedValue } from "./ListingControls";
import { useDirectoryActor } from "../lib/use-directory";
import { publicCareOptions, retainPublicSelectedCare } from "../lib/directory-cache";
import "./guest-finder.css";

type PublicClinic = { id: string; name?: string; slug?: string | null; city?: string | null };
type PublicBranch = { id: string; name?: string; slug?: string | null; address?: string | null; city?: string | null };

/** Public-safe discovery: clinic cards immediately, each expanding to its bookable locations.
 *  Reads share the actor-scoped public directory pages used by every public picker (same keys,
 *  cancellation and freshness). Search lives in the URL so Back from a clinic page restores it.
 *  Nothing is auto-selected: the visitor explicitly chooses a location card. */
export function GuestClinicFinder() {
  const searchString = useSearch();
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(searchString);
  const applied = params.get("search") || "";
  const [search, setSearch] = useState(applied);
  const debounced = useDebouncedValue(search);
  useEffect(() => { setSearch(applied); }, [applied]);
  useEffect(() => {
    if (debounced !== search || debounced === applied) return;
    const next = new URLSearchParams();
    if (debounced.trim()) next.set("search", debounced.trim());
    navigate(`${location}${next.toString() ? `?${next}` : ""}`, { replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  const actor = useDirectoryActor();
  const clinics = useInfiniteQuery(publicCareOptions(actor, "clinics", { status: "active" }, (p, signal) => api.listPublicClinics(p, { signal }), applied));
  const items = (clinics.data?.pages.flatMap(p => p.items) || []) as PublicClinic[];
  const total = clinics.data?.pages[0]?.total || 0;

  return <div className="public-book guest-finder">
    <Logo/>
    <main className="panel padded">
      <span className="eyebrow">Patient Access · No Account Required</span>
      <h1>Guest Booking</h1>
      <PageDescription text="Browse clinics and choose a location to book a visit." help="You review the doctor and session before booking." label="About guest booking"/>
      <SearchInput value={search} onChange={setSearch} placeholder="Search clinics…" label="Search Clinics"/>
      {clinics.error && <div className="error-box" role="alert">{friendlyError(clinics.error,"load","We couldn’t load clinics. Your search is kept.")}<RecoveryActions error={clinics.error} busy={clinics.isFetching} onRetry={()=>clinics.refetch()}/></div>}
      {clinics.isLoading ? <div className="gf-grid" aria-busy="true" role="status">{Array.from({ length: 4 }, (_, i) => <div key={i} className="gf-card gf-skeleton"/>)}</div>
        : !items.length && !clinics.error ? <div className="empty" role="status" data-testid="text-guest-no-clinics"><span className="empty-icon"><Building2 size={22} aria-hidden/></span><h3>No clinics found</h3><p>{applied ? "Try a different search." : "No clinics are accepting online bookings yet."}</p></div>
        : <div className="gf-grid">{items.map(c => <ClinicCard key={c.id} clinic={c}/>)}</div>}
      {items.length > 0 && <p className="muted gf-count" role="status">Showing {items.length} of {total} clinics</p>}
      {clinics.hasNextPage && <button type="button" className="button secondary small" disabled={clinics.isFetchingNextPage} onClick={() => void clinics.fetchNextPage()} data-testid="button-guest-more-clinics">{clinics.isFetchingNextPage ? "Loading…" : "Show more clinics"}</button>}
      <p className="muted">Have a clinic QR code? <Link className="text-link" href="/scan-qr" data-testid="link-guest-scan">Scan QR Code Instead</Link></p>
    </main>
  </div>;
}

function ClinicCard({ clinic }: { clinic: PublicClinic }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient(), actor = useDirectoryActor();
  const branches = useInfiniteQuery({ ...publicCareOptions(actor, "branches", { clinicId: clinic.id, status: "active" }, (p, signal) => api.listPublicBranches(p, { signal })), enabled: open });
  const rows = (branches.data?.pages.flatMap(p => p.items) || []) as PublicBranch[];
  // Explicit Book handoff keeps the chosen names for the booking page's shared selected labels.
  const handoff = (b: PublicBranch) => {
    retainPublicSelectedCare(client, actor, "clinics", { status: "active" }, clinic, Date.now());
    retainPublicSelectedCare(client, actor, "branches", { clinicId: clinic.id, status: "active" }, b, branches.dataUpdatedAt);
  };
  return <article className="gf-card" data-testid={`card-guest-clinic-${clinic.id}`}>
    <div className="gf-card-head"><span className="icon-box"><Building2 size={18} aria-hidden/></span><div><h3>{clinic.name}</h3>{clinic.city && <small>{clinic.city}</small>}</div></div>
    <div className="gf-actions">
      <button type="button" className="button secondary small" aria-expanded={open} onClick={() => setOpen(v => !v)} data-testid={`button-guest-locations-${clinic.id}`}>{open ? "Hide locations" : "Show locations"}</button>
      {clinic.slug && <Link className="text-link" href={`/${encodeURIComponent(clinic.slug)}`} data-testid={`link-guest-clinic-${clinic.id}`}>Clinic page</Link>}
    </div>
    {open && <div className="gf-locations">
      {branches.isLoading ? <p role="status" className="muted">Loading locations…</p>
        : branches.error ? <div role="alert" className="error-box">{friendlyError(branches.error,"load","We couldn’t load locations.")}<RecoveryActions error={branches.error} busy={branches.isFetching} onRetry={()=>branches.refetch()}/></div>
        : !rows.length ? <p className="muted">No locations are available.</p>
        : <ul>{rows.map(b => { const href = clinic.slug && b.slug ? `/${encodeURIComponent(clinic.slug)}/${encodeURIComponent(b.slug)}?book=1` : null; return <li key={b.id} data-testid={`row-guest-location-${b.id}`}>
            <MapPin size={15} aria-hidden/><div><strong>{b.name}</strong>{(b.address || b.city) && <small>{b.address || b.city}</small>}</div>
            {href ? <Link className="button small" href={href} onClick={() => handoff(b)} data-testid={`link-book-location-${b.id}`}>Book</Link> : <small className="muted">Online booking unavailable</small>}
          </li>; })}</ul>}
      {branches.hasNextPage && <button type="button" className="text-link" disabled={branches.isFetchingNextPage} onClick={() => void branches.fetchNextPage()} data-testid={`button-guest-more-locations-${clinic.id}`}>{branches.isFetchingNextPage ? "Loading…" : "Show more locations"}</button>}
    </div>}
  </article>;
}
