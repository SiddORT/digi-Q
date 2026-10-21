import { useState } from "react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { clinicDetailsHref } from "../lib/clinic-navigation";
import { ClinicMetadataFacts } from "./ClinicMetadataFields";

/** Reads clinic-owned data, never copies it onto an owner's personal profile. */
export function OwnedClinicInformation({ adminId }: { adminId: string }) {
  const [page, setPage] = useState(1);
  const params = { adminId, page, pageSize: 20, sort: "name" };
  const query = api.useListClinics(params, { query: { queryKey: api.getListClinicsQueryKey(params), refetchInterval: 30000, staleTime: 0 } });
  return <section className="panel padded wide" aria-label="Owned clinic information" data-testid="owned-clinic-information">
    <h3>Owned clinic information</h3>
    {query.isLoading ? <p role="status">Loading owned clinics…</p> : query.error ? <p role="alert">Clinic information could not be loaded. <button type="button" onClick={() => void query.refetch()}>Retry clinic information</button></p>
      : query.data?.items.length ? query.data.items.map(clinic => <section key={clinic.id} aria-label={clinic.name}>
        <h4><Link href={clinicDetailsHref(clinic.id, "")}>{clinic.name}</Link></h4><dl className="cs-list"><ClinicMetadataFacts clinic={clinic}/></dl>
      </section>) : <p>No owned clinics.</p>}
    {query.data && query.data.total > 20 && <nav aria-label="Owned clinics pages">
      <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous clinics</button>
      <span>Page {page} of {Math.ceil(query.data.total / 20)}</span>
      <button type="button" disabled={page * 20 >= query.data.total} onClick={() => setPage(p => p + 1)}>Next clinics</button>
    </nav>}
  </section>;
}
