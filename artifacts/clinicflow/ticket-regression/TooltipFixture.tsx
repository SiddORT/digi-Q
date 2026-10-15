import { OverflowText } from "../src/components/OverflowText";
import { HelpTip } from "../src/components/HelpTip";
import { NotificationInfo } from "../src/components/NotificationInfo";
import { GuestRequests } from "../src/components/queue/GuestRequests";
import { SessionQueue } from "../src/components/queue/SessionQueue";
import type { Appointment, Identity } from "@workspace/api-client-react";
import "./notification-fixture.css";

/** Real presentation components with synthetic data; no credentials or live writes. */
export function TooltipFixture() {
  if (new URLSearchParams(location.search).get("surface") === "queue") return <main className="workspace" style={{ display: "block", padding: 16 }}><SessionQueue identity={{ user: { id: "fixture-reception", role: "receptionist" } } as Identity} initial={{ clinicId: "clinic-1", branchId: "branch-1", doctorId: "doctor-1", date: "2030-06-14", sessionId: "session-1", startTime: "09:00", endTime: "12:00" } as Appointment}/></main>;
  return <main className="workspace" style={{ display: "block", padding: 16 }}>
    <section className="event-controls panel padded" style={{ maxWidth: "100%" }}>
      <h1>Tooltip regression</h1>
      <div style={{ width: 180, maxWidth: "100%" }}>
        <OverflowText testId="long-value" value="A genuinely clipped full value that must remain readable by every supported input method." />
        <OverflowText testId="short-value" value="Short value" />
        <OverflowText testId="two-line-value" lines={2} value="Two line clipping must still provide one accessible full value reveal even when a long message wraps over more than two lines." />
      </div>
      <NotificationInfo label="About activation">Inherited system activation. Saved activation: on.</NotificationInfo>
      <HelpTip label="About wait calculation" text="Wait is patients ahead multiplied by consultation duration." />
      <HelpTip text="Refresh is unavailable while loading."><button disabled>Refresh disabled</button></HelpTip>
      <button data-testid="outside-control">Unrelated control</button>
    </section>
    <GuestRequests clinicId="clinic-1" branchId="branch-1" doctorId="doctor-1" date="2030-06-14" sessionId="session-1" startTime="09:00" />
  </main>;
}
