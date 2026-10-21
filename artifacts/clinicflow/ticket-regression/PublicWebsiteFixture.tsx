import { usePublicWebsite, PublicWebsiteStatus } from "../src/lib/public-website";
import { PublicClinicBookingQr } from "../src/components/PublicClinicBookingQr";
import { ClinicDisplay } from "../src/components/ClinicDisplay";
import { ClinicRegistrationComplete } from "../src/components/ClinicRegistrationComplete";
import { VisitTicket } from "../src/components/tickets/VisitTicket";
import "../src/index.css";

/** Real consumers on an alternate browser host; every API is mocked by the test. */
export function PublicWebsiteFixture() {
  const site = usePublicWebsite();
  const url = site.url("/fictional-care/main-location?book=1");
  return <main style={{ padding: 24 }}>
    <PublicWebsiteStatus/>
    <output data-testid="canonical-booking-link">{url || ""}</output>
    {url && <PublicClinicBookingQr bookingUrl={url} branchName="Fictional Location"/>}
    <ClinicRegistrationComplete result={{ clinic: { id: "fictional-clinic", slug: "fictional-care", name: "Fictional Care" } as never, branches: [{ id: "fictional-location", slug: "main-location", name: "Fictional Location" } as never] }}/>
    <VisitTicket ticket={{ patientName: "Fictional Patient", clinicName: "Fictional Care", branchName: "Fictional Location", doctorName: "Fictional Doctor", date: "2030-06-14", reference: "TEST-ONLY", qrUrl: "/check-in?payload=v1.fictional.signature" }}/>
    <ClinicDisplay reference="fictional-reference" bookingHref={url}/>
  </main>;
}
