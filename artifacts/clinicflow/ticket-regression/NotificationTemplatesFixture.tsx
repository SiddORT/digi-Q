import type { Identity } from "@workspace/api-client-react";
import { NotificationTemplatesPage } from "../src/components/NotificationTemplatesPage";
import "./notification-fixture.css";

// All API traffic is intercepted by the regression tests. No real session,
// provider connection or notification delivery is used by this fixture.
export function NotificationTemplatesFixture() {
  const role = new URLSearchParams(location.search).get("role") || "superAdmin";
  const identity = { user: { id: "template-fixture", role, demoFixture: "template-fixture" } } as Identity;
  return <main className="content" style={{ padding: 16 }}><div className="page-heading"><h1>Notifications</h1></div><NotificationTemplatesPage identity={identity} /></main>;
}
