import { useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppointmentDetails } from "../src/components/appointments/AppointmentDetails";
import { AppointmentRows } from "../src/components/appointments/AppointmentRows";
import { CalendarDayPanel } from "../src/components/appointments/CalendarDayPanel";
import "./appointment-details.css";
import "../src/components/workspace-consolidation.css";

/** Fictional API responses are supplied by Playwright; this entry never authenticates. */
export function AppointmentDetailsFixture() {
  const client = useQueryClient();
  const [id, setId] = useState("appointment-1");
  const surface = new URLSearchParams(location.search).get("surface");
  const q = api.useGetAppointment(id, { query: { queryKey: api.getGetAppointmentQueryKey(id), enabled: !surface, retry: false } });
  const list = api.useListAppointments(undefined, { query: { queryKey: api.getListAppointmentsQueryKey(), enabled: surface === "rows", retry: false } });
  return <main className="workspace" style={{ display: "block", padding: 16 }}>
    <nav aria-label="Fixture controls" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <button onClick={() => void client.invalidateQueries()}>Refresh fixture</button>
      <button onClick={() => setId("appointment-1")}>First appointment</button>
      <button onClick={() => setId("appointment-2")}>Second appointment</button>
    </nav>
    {surface === "rows" ? <AppointmentRows appointments={list.data?.items || []} />
      : surface === "calendar" ? <CalendarDayPanel date="2030-06-14" today="2030-06-14" root="admin" filters={{}} canBook={false} onClose={() => {}} onOpenList={() => {}} />
      : q.data ? <AppointmentDetails appointment={q.data} />
      : <p role={q.error ? "alert" : "status"}>{q.error ? "Could not load fixture" : "Loading fixture…"}</p>}
  </main>;
}
