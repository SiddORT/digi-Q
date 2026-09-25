import { useState } from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { CareLookup } from "./CareLookup";
import { Logo } from "../App";

type PublicOption = { id: string; name?: string; slug?: string };

export function GuestClinicFinder() {
  const [clinic, setClinic] = useState<PublicOption | null>(null);
  const [branch, setBranch] = useState<PublicOption | null>(null);
  const bookingPath = clinic?.slug && branch?.slug
    ? `/${encodeURIComponent(clinic.slug)}/${encodeURIComponent(branch.slug)}?book=1`
    : null;

  return <div className="public-book">
    <Logo/>
    <main className="panel padded">
      <span className="eyebrow">PATIENT ACCESS · NO ACCOUNT REQUIRED</span>
      <h1>Guest booking</h1>
      <p>Choose your clinic and location. You can then see the doctor and available consultation sessions before requesting a visit.</p>
      <div className="form-grid">
        <CareLookup publicAccess kind="clinics" label="Clinic" value={clinic?.id || ""} params={{status:"active"}} onChange={(_, record) => {
          setClinic((record as PublicOption | undefined) || null);
          setBranch(null);
        }}/>
        <CareLookup publicAccess kind="branches" label="Location" value={branch?.id || ""} disabled={!clinic} params={{clinicId:clinic?.id,status:"active"}} onChange={(_, record) => setBranch((record as PublicOption | undefined) || null)}/>
      </div>
      {branch && !bookingPath && <p className="notice" role="alert">Online booking is not available for this location. Please contact the clinic or scan its current booking QR code.</p>}
      {bookingPath && <div className="patient-selected-clinic" data-testid="status-selected-clinic"><MapPin size={20}/><div><strong>{clinic?.name} · {branch?.name}</strong><p>Continue to review the care team and request a visit. Reception must confirm your request.</p></div></div>}
      {bookingPath && <Link className="button" href={bookingPath} data-testid="link-continue-guest-booking">Continue to booking</Link>}
      <p className="muted">Have a clinic QR code? <Link className="text-link" href="/scan-qr" data-testid="link-guest-scan">Scan QR code instead</Link></p>
    </main>
  </div>;
}