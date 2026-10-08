import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { CareLookup } from "./CareLookup";
import { Logo } from "../App";
import { soleBookable } from "../lib/sole-option";
import { useDirectoryActor } from "../lib/use-directory";
import { retainPublicSelectedCare } from "../lib/directory-cache";

type PublicOption = { id: string; name?: string; slug?: string | null };

export function GuestClinicFinder() {
  const client = useQueryClient(), actor = useDirectoryActor();
  const [clinic, setClinic] = useState<PublicOption | null>(null);
  const [branch, setBranch] = useState<PublicOption | null>(null);
  const clinics = useQuery({queryKey:["guest-finder-single-clinic"],queryFn:()=>api.listPublicClinics({page:1,pageSize:20}),staleTime:30000});
  const branches = useQuery({queryKey:["guest-finder-single-branch",clinic?.id],enabled:!!clinic?.id,queryFn:()=>api.listPublicBranches({clinicId:clinic!.id,page:1,pageSize:20}),staleTime:30000});
  useEffect(()=>{const only=soleBookable(clinics.data);if(!clinic&&only){
    retainPublicSelectedCare(client,actor,"clinics",{status:"active"},only,clinics.dataUpdatedAt);
    setClinic(only);
  }},[clinic,clinics.data,clinics.dataUpdatedAt,client,actor]);
  // Sole option = the only active location that has a public booking address (slug); unslugged rows cannot be booked here.
  useEffect(()=>{const only=soleBookable(branches.data);if(clinic&&!branch&&only){
    retainPublicSelectedCare(client,actor,"branches",{clinicId:clinic.id,status:"active"},only,branches.dataUpdatedAt);
    setBranch(only);
  }},[clinic,branch,branches.data,branches.dataUpdatedAt,client,actor]);
  const bookingPath = clinic?.slug && branch?.slug
    ? `/${encodeURIComponent(clinic.slug)}/${encodeURIComponent(branch.slug)}?book=1`
    : null;

  return <div className="public-book">
    <Logo/>
    <main className="panel padded">
      <span className="eyebrow">Patient Access · No Account Required</span>
      <h1>Guest Booking</h1>
       <p>Find your clinic and location, then review the doctor and session before booking. If there is only one option, it is selected for you.</p>
      <div className="form-grid">
         <CareLookup publicAccess kind="clinics" label="Clinic" value={clinic?.id || ""} selectedLabel={clinic?.name} params={{status:"active"}} onChange={(_, record) => {
          setClinic((record as PublicOption | undefined) || null);
          setBranch(null);
        }}/>
         <CareLookup publicAccess kind="branches" label="Location" value={branch?.id || ""} selectedLabel={branch?.name} disabled={!clinic} params={{clinicId:clinic?.id,status:"active"}} onChange={(_, record) => setBranch((record as PublicOption | undefined) || null)}/>
      </div>
      {branch && !bookingPath && <p className="notice" role="alert">Online booking is not available for this location. Please contact the clinic or scan its current booking QR code.</p>}
       {bookingPath && <div className="patient-selected-clinic" data-testid="status-selected-clinic"><MapPin size={20}/><div><strong>{clinic?.name} · {branch?.name}</strong><p>Review the session, then book. Your ticket is issued immediately.</p></div></div>}
      {bookingPath && <Link className="button" href={bookingPath} data-testid="link-continue-guest-booking">Continue to Booking</Link>}
      <p className="muted">Have a clinic QR code? <Link className="text-link" href="/scan-qr" data-testid="link-guest-scan">Scan QR Code Instead</Link></p>
    </main>
  </div>;
}