import type { Identity } from "@workspace/api-client-react";
import { EmailTemplates } from "../src/components/EmailTemplates";
import "./notification-fixture.css";

// Browser regression only. Tests intercept every API request before navigation.
export default function SmsEditorFixture() {
  const params = new URLSearchParams(location.search);
  const event = params.get("event") || "booking";
  const channel = params.get("channel") === "email" ? "email" : "sms";
  const recipient = event === "clinic_registration_otp" ? "clinicAdmin" : ["staff_mobile_otp", "staff_email_otp"].includes(event) ? "receptionist" : "patient";
  const identity = { user: { id: "template-fixture", role: "superAdmin" } } as Identity;
  return <main className="content workspace" style={{padding:16}}>
    <EmailTemplates identity={identity} notificationPage channel={channel} fixed={{clinicId:"",event,recipient}} />
  </main>;
}
