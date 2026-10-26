import { useState } from "react";
import { EventTemplateTest } from "../src/components/EventTemplateTest";
import { NotificationLogs } from "../src/components/NotificationLogs";
import { CommunicationUsage } from "../src/components/CommunicationUsage";
import { AppDialog } from "../src/components/AppDialog";
import { LinkedScheduleControls, type LinkedSchedule } from "../src/components/LinkedScheduleControls";
import { StaffDeletionReview } from "../src/components/StaffDeletionReview";
import { EmailProviderPanel } from "../src/components/EmailProviderPanel";
import { SmsProviderPanel } from "../src/components/SmsProviderPanel";
import { Editor, resources } from "../src/resources";
import { DateTimePreferencesProvider } from "../src/components/DateTimePreferences";
import "../src/components/email-templates.css";
import "../src/components/communication.css";
import "../src/components/notification-settings.css";

/** Actual production callers, fictional actors. Browser must intercept every API request before navigation. */
export function FormControlFixture() {
  const params = new URLSearchParams(window.location.search);
  const surface = params.get("surface") || "template";
  const role = params.get("fixtureRole") || "superAdmin";
  const [linked, setLinked] = useState<LinkedSchedule>({ enabled: true, consultationMinutes: 17, maxTokens: 20 });
  const [saved, setSaved] = useState("");
  const [deletion, setDeletion] = useState(true);
  const channel = params.get("channel") === "sms" ? "sms" : "email";
  const body = "{{appointment_date}} {{previous_date}} {{session_start}} {{session_end}} {{previous_session_start}} {{previous_session_end}} {{queue_token}} {{reference}} {{patient_name}}";
  const test = <EventTemplateTest channel={channel} event={params.get("security") ? "staff_email_otp" : "rescheduled"} recipient="patient" clinicId={params.get("scope") || ""} revision={1}
    content={{ subject: "Fictional Test", prefix: "", footer: "", logoUrl: "", body: params.get("security") ? "{{otp}} {{expiry_minutes}}" : body, enabled: false }} />;
  return <DateTimePreferencesProvider value={{ dateFormat: "DD/MM/YYYY", timeFormat: "12h" }}>
    <main className="content" style={{ maxWidth: 1100, margin: "0 auto" }}><h1>Fictional Form Control Acceptance</h1>
      {surface === "template" ? params.get("drawer") ? <AppDialog open variant="drawer" title="Fictional Template" onClose={() => {}}>{test}</AppDialog> : test
        : surface === "logs" ? <NotificationLogs />
        : surface === "usage" ? <CommunicationUsage userId="fixture-actor" role={role} />
        : surface === "duration" ? <LinkedScheduleControls value={linked} onChange={setLinked} />
        : surface === "deletion" ? <StaffDeletionReview actorId="fixture-actor" target={deletion ? { userId: "fixture-doctor", name: "Fictional Doctor" } : null} onClose={() => setDeletion(false)} />
        : surface === "email" ? <EmailProviderPanel />
        : surface === "sms" ? <SmsProviderPanel />
        : surface === "status" ? <><Editor resourceName="branches" initial={{ status: "active", name: "Fictional Location" }} fields={resources.branches.fields.filter(f => f.key === "status")} onSave={v => setSaved(JSON.stringify(v))} /><output data-testid="saved-status">{saved}</output></>
        : null}
    </main>
  </DateTimePreferencesProvider>;
}
