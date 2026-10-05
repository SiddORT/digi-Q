import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { CareLookup } from "./CareLookup";
import { Logo } from "../App";

type PublicOption = { id: string; name?: string; slug?: string };

export function GuestClinicFinder() {
  const [clinic, setClinic] = useState<PublicOption | null>(null);
  const [branch, setBranch] = useState<PublicOption | null>(null);
  const clinics = useQuery({queryKey:["guest-finder-single-clinic"],queryFn:()=>api.listPublicClinics({page:1,pageSize:2}),staleTime:30000});
  const branches = useQuery({queryKey:["guest-finder-single-branch",clinic?.id],enabled:!!clinic?.id,queryFn:()=>api.listPublicBranches({clinicId:clinic!.id,page:1,pageSize:2}),staleTime:30000});
  useEffect(()=>{if(!clinic&&clinics.data?.total===1&&clinics.data.items[0])setClinic(clinics.data.items[0]);},[clinic,clinics.data]);
  useEffect(()=>{if(clinic&&!branch&&branches.data?.total===1&&branches.data.items[0])setBranch(branches.data.items[0]);},[clinic,branch,branches.data]);
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