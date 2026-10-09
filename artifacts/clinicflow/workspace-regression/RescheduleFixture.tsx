import { useState } from "react";
import * as api from "@workspace/api-client-react";
import { RescheduleAppointment } from "../src/components/appointments/RescheduleAppointment";
import { AppointmentDetails } from "../src/components/appointments/AppointmentDetails";

/** Controlled HTTP fixture only; never an authentication bypass in the product. */
export function RescheduleFixture() {
  const query=api.useGetAppointment("unified-appointment");
  const [done,setDone]=useState(false);
  if(!query.data)return <p>Loading fictional visit…</p>;
  return <main className="content">{done?<AppointmentDetails appointment={query.data}/>:<RescheduleAppointment appointment={query.data} onDone={()=>setDone(true)}/>}</main>;
}
