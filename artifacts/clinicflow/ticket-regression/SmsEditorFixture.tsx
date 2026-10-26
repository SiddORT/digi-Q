import type { Identity } from "@workspace/api-client-react";
import { EmailTemplates } from "../src/components/EmailTemplates";
import "./notification-fixture.css";

// Browser regression only. Tests intercept every API request before navigation.
export default function SmsEditorFixture() {
  const event = new URLSearchParams(location.search).get("event") || "booking";
  const recipient = event === "staff_mobile_otp" ? "receptionist" : "patient";
  const identity = { user: { id: "template-fixture", role: "superAdmin" } } as Identity;
  return <main className="content workspace" style={{padding:16}}>
    <EmailTemplates identity={identity} notificationPage channel="sms" fixed={{clinicId:"",event,recipient}} />
  </main>;
}
