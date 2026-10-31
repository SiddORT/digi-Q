import type { Appointment } from "@workspace/api-client-react";
import { AppointmentRows } from "../src/components/appointments/AppointmentRows";
import { AppointmentBookingTab } from "../src/components/appointments/AppointmentBookingTab";
import { BulkAppointments } from "../src/components/appointments/BulkAppointments";
import { TicketEmailDialog } from "../src/components/appointments/TicketEmailDialog";
import { useState } from "react";
import { emailVisit as visit } from "./ticket-email-test-data";

const emailVisit = visit as Appointment;

/** Uses real entry points. All requests must be intercepted by the fail-closed parent fixture. */
export function TicketEmailFixture({ entry }: { entry: string }) {
  const [open, setOpen] = useState(false);
  return <main className="workspace" style={{padding:16,display:"block"}}>
    {entry === "row" ? <AppointmentRows appointments={[emailVisit]}/> :
      entry === "booking" ? <AppointmentBookingTab appointment={emailVisit}/> :
      entry === "bulk" ? <BulkAppointments ids={["one","two","three"]} labels={{one:"Visit One",two:"Visit Two",three:"Visit Three"}} disabled={false} onClear={()=>{}}/> :
      <><button onClick={()=>setOpen(true)} data-testid="open-email">Email Ticket</button>
        <TicketEmailDialog open={open} items={[{id:"one",label:"Visit One"}]} onClose={()=>setOpen(false)}/></>}
  </main>;
}
