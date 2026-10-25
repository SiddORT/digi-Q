import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Booking } from "../src/clinic";
import { GuestBooking } from "../src/components/GuestBooking";
import { SessionQueue } from "../src/components/queue/SessionQueue";

/** Isolated HTTP fixtures only; identity refresh exercises the real booking lifecycle. */
export function BookingFixture({ guest = false, queue = false }: { guest?: boolean; queue?: boolean }) {
  const me = api.useGetMe();
  const client = useQueryClient();
  if (guest) return <GuestBooking reference="fixture-booking" context={{reference:"fixture-booking",clinicId:"c1",branchId:"b1",doctorId:"d1",clinicName:"Fictional Booking Clinic",branchName:"Fictional Booking Location",doctorName:"Fictional Booking Doctor",branchTimezone:"UTC",dateFormat:"YYYY-MM-DD",timeFormat:"24h"}}/>;
  if (!me.data?.user) return <p>Loading fixture identity…</p>;
  if (queue) return <SessionQueue identity={me.data}/>;
  return <>
    <button data-testid="refresh-fixture-identity" onClick={() => void client.invalidateQueries({queryKey: api.getGetMeQueryKey()})}>Refresh fictional identity</button>
    <Booking entryPoint="staff-workspace" identity={me.data}/>
  </>;
}
