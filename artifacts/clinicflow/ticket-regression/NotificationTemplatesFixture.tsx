import type { Identity } from "@workspace/api-client-react";
import { NotificationTemplatesPage } from "../src/components/NotificationTemplatesPage";
import "../src/index.css";

// All API traffic is intercepted by the regression tests. No real session,
// provider connection or notification delivery is used by this fixture.
const identity = { user: { id: "template-fixture", role: "superAdmin", demoFixture: "template-fixture" } } as Identity;
export function NotificationTemplatesFixture() {
  return <main style={{ padding: 16 }}><NotificationTemplatesPage identity={identity} /></main>;
}
